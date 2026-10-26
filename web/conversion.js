// conversion.js
//
// Equipo de conversión y almacenamiento.
// Funciones puras: no tocan la interfaz. Reciben el generador ya
// dimensionado, el consumo y los datos del equipo, y devuelven las
// verificaciones, el banco de baterías y el balance de cierre.
//
// Método: sesiones 8 y 10 del curso (Messenger y Abtahi, 2017; Chaaban,
// AE 868; Dobos, 2014).
//   Voc en frío      = Voc · [1 + |β| · (25 − Tmin)]
//   Vmp en caliente  = Vmp · [1 − |β| · (Tc − 25)]
//   Vmp en frío      = Vmp · [1 + |β| · (25 − Tmin)]
//   I al banco       = Ppico / Vnominal (con k reguladores en paralelo, cada
//                      uno recibe un grupo de cadenas: I = Pgrupo / Vnominal)
//   Relación DC/AC   = Ppico / Pac
//   Ecc = Ed / η_inv;  Cn[Wh] = Ecc · N / (DoD · fT);  Cn[Ah] = Cn[Wh] / Vbanco
//   Ns = Vbanco / Vunidad;  Np = ⌈Cn[Ah] / Cunidad⌉
//   DoD_fin = Ecc · N / E_instalada;  DoD diario = DoD de diseño / N
//   Egen = Ecc / η_bat;  Preq = Egen / (HSP · PR)
//   trec = N · Ecc / (Eprod · η_bat − Ecc),  Eprod = Ppico · HSP anual · PR
//
// Autonomía por consumo nocturno (método propio): el banco cubre la energía
// de las horas fuera de la ventana solar durante N noches.
//   Ecc_banco = E_noche / η_inv;  Cn[Wh] = Ecc_banco · N / (DoD · fT)
//   Egen = E_día / η_inv + E_noche / (η_inv · η_bat)
//   trec = N · Ecc_banco / ((Eprod − Egen) · η_bat)   (con autonomía por días
//   Egen = Ecc / η_bat y la fórmula queda igual a la del método del curso)

(function (raiz) {
    'use strict';

    // Números para los mensajes: coma decimal y punto de miles, como en la pantalla.
    function fx(valor, decimales) {
        const fijo = Math.abs(Number(valor)).toFixed(decimales);
        const [entera, fraccion] = fijo.split('.');
        const signo = Number(valor) < 0 && Number(fijo) !== 0 ? '-' : '';
        return signo + entera.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (fraccion ? ',' + fraccion : '');
    }

    const FACTOR_CONDUCTORES = 1.25;          // NTC 2050, art. 690-8
    const MARGEN_ARRANQUE_V = 5;              // la tensión FV debe superar la del banco en 5 V
    const RANGO_DC_AC = [1.0, 1.3];
    // DoD de diseño usual por química cuando la ficha no fija uno.
    const DOD_CURSO_PCT = { AGM: 50, GEL: 50, LFP: 80 };

    function dodDeDiseno(bateria) {
        if (typeof bateria.dodDisenoPct === 'number') return { valor: bateria.dodDisenoPct, origen: 'ficha' };
        if (DOD_CURSO_PCT[bateria.tecnologia]) return { valor: DOD_CURSO_PCT[bateria.tecnologia], origen: 'curso' };
        return { valor: null, origen: null };
    }
    const TOLERANCIA = 1e-9;

    const RAMAS = {
        con: {
            id: 'con',
            nombre: 'Con almacenamiento',
            descripcion: 'Off-grid o híbrido: regulador MPPT y banco de baterías.',
        },
        sin: {
            id: 'sin',
            nombre: 'Sin almacenamiento',
            descripcion: 'On-grid sin baterías: inversor de red con entrada MPPT.',
        },
    };

    function ramaPorContexto(contexto) {
        return contexto === 'on-grid' ? 'sin' : 'con';
    }

    // ---------------------------------------------------------------------
    // Tensiones y corrientes del arreglo
    // ---------------------------------------------------------------------
    function tensionesModulo(modulo, tMinC, tCeldaC) {
        const beta = Math.abs(modulo.coefVocPctC) / 100;
        return {
            beta,
            vocFrio: modulo.vocV * (1 + beta * (25 - tMinC)),
            vmpCaliente: modulo.vmpV * (1 - beta * (tCeldaC - 25)),
            vmpFrio: modulo.vmpV * (1 + beta * (25 - tMinC)),
        };
    }

    function describirArreglo(arreglo) {
        const t = tensionesModulo(arreglo.modulo, arreglo.tMinC, arreglo.tCeldaC);
        const ns = arreglo.modulosSerie;
        const np = arreglo.cadenasParalelo;
        return {
            ns, np,
            numeroModulos: ns * np,
            potenciaW: ns * np * arreglo.modulo.potenciaW,
            modulo: t,
            vocFrioV: ns * t.vocFrio,
            vmpCalienteV: ns * t.vmpCaliente,
            vmpFrioV: ns * t.vmpFrio,
            iscA: np * arreglo.modulo.iscA,
            impA: np * arreglo.modulo.impA,
        };
    }

    function cadenasPorEntrada(np, entradas) {
        const n = entradas > 0 ? Math.floor(entradas) : 1;
        return Math.ceil(np / n);
    }

    // Un criterio: { id, nombre, valor, limite, estado: 'cumple'|'alerta'|'no_cumple'|'no_aplica', texto }
    function criterio(id, nombre, estado, valor, limite, texto) {
        return { id, nombre, estado, valor, limite, texto };
    }

    function veredictoGlobal(criterios) {
        if (criterios.some(c => c.estado === 'no_cumple')) return 'no_cumple';
        if (criterios.some(c => c.estado === 'alerta')) return 'alerta';
        return 'cumple';
    }

    const f1 = v => fx(Math.round(v * 10) / 10, 1);
    // Valor de ficha con sus propios decimales (12,5 A; 600 V).
    const fv = v => fx(v, (String(v).split('.')[1] || '').length);

    // ---------------------------------------------------------------------
    // Verificación de un regulador MPPT (rama con almacenamiento)
    // ---------------------------------------------------------------------
    // Reparte np cadenas en k grupos lo más parejos posible.
    function repartirCadenas(np, k) {
        const grupos = [];
        for (let i = 0; i < k; i++) grupos.push(Math.floor(np / k) + (i < np % k ? 1 : 0));
        return grupos;
    }

    // Un regulador admite varias unidades en paralelo solo si su ficha lo
    // declara (maxParalelo). Se busca el menor número de unidades con el que
    // cada una cumple; si ninguno cumple, el menor con solo alertas.
    function verificarRegulador(equipo, arreglo, ctx) {
        const np = arreglo.cadenasParalelo;
        const permitido = ctx.permitirParalelo !== false && typeof equipo.maxParalelo === 'number' && equipo.maxParalelo > 1
            ? Math.min(Math.floor(equipo.maxParalelo), np) : 1;
        const opciones = [];
        for (let k = 1; k <= permitido; k++) opciones.push(verificarUnidadRegulador(equipo, arreglo, ctx, k));
        const elegida = opciones.find(o => o.veredicto === 'cumple') || opciones.find(o => o.veredicto === 'alerta') || opciones[0];
        elegida.maxUnidades = permitido;
        return elegida;
    }

    function verificarUnidadRegulador(equipo, arreglo, ctx, unidades) {
        const a = describirArreglo(arreglo);
        const grupos = repartirCadenas(a.np, unidades);
        const npGrupo = grupos[0];
        const porUnidad = unidades > 1 ? ' por regulador' : '';
        const vArranque = ctx.vBancoV + (ctx.margenArranqueV != null ? ctx.margenArranqueV : MARGEN_ARRANQUE_V);
        const iBanco = npGrupo * a.ns * arreglo.modulo.potenciaW / ctx.vNominalV;
        const npEntrada = cadenasPorEntrada(npGrupo, equipo.entradasMppt);
        const iscEntrada = npEntrada * arreglo.modulo.iscA;
        const lista = [];

        lista.push(a.vocFrioV <= equipo.vocMaxV + TOLERANCIA
            ? criterio('voc', 'Voc en frío', 'cumple', a.vocFrioV, equipo.vocMaxV, f1(a.vocFrioV) + ' V ≤ ' + fv(equipo.vocMaxV) + ' V')
            : criterio('voc', 'Voc en frío', 'no_cumple', a.vocFrioV, equipo.vocMaxV, f1(a.vocFrioV) + ' V supera los ' + fv(equipo.vocMaxV) + ' V de entrada: daña el equipo'));

        lista.push(a.vmpCalienteV >= vArranque - TOLERANCIA
            ? criterio('arranque', 'Arranque (Vbanco + 5 V)', 'cumple', a.vmpCalienteV, vArranque, f1(a.vmpCalienteV) + ' V ≥ ' + f1(vArranque) + ' V')
            : criterio('arranque', 'Arranque (Vbanco + 5 V)', 'no_cumple', a.vmpCalienteV, vArranque, 'Vmp en caliente ' + f1(a.vmpCalienteV) + ' V no alcanza los ' + f1(vArranque) + ' V para cargar el banco'));

        if (typeof equipo.mpptMinV === 'number') {
            lista.push(a.vmpCalienteV >= equipo.mpptMinV - TOLERANCIA
                ? criterio('mpptMin', 'Ventana MPPT (mínimo)', 'cumple', a.vmpCalienteV, equipo.mpptMinV, f1(a.vmpCalienteV) + ' V ≥ ' + fv(equipo.mpptMinV) + ' V')
                : criterio('mpptMin', 'Ventana MPPT (mínimo)', 'no_cumple', a.vmpCalienteV, equipo.mpptMinV, 'Vmp en caliente ' + f1(a.vmpCalienteV) + ' V queda bajo el mínimo de ' + fv(equipo.mpptMinV) + ' V'));
        }
        if (typeof equipo.mpptMaxV === 'number') {
            lista.push(a.vmpFrioV <= equipo.mpptMaxV + TOLERANCIA
                ? criterio('mpptMax', 'Ventana MPPT (máximo)', 'cumple', a.vmpFrioV, equipo.mpptMaxV, f1(a.vmpFrioV) + ' V ≤ ' + fv(equipo.mpptMaxV) + ' V')
                : criterio('mpptMax', 'Ventana MPPT (máximo)', 'no_cumple', a.vmpFrioV, equipo.mpptMaxV, 'Vmp en frío ' + f1(a.vmpFrioV) + ' V supera el máximo de ' + fv(equipo.mpptMaxV) + ' V'));
        } else {
            lista.push(criterio('mpptMax', 'Ventana MPPT (máximo)', 'no_aplica', a.vmpFrioV, null, 'La ficha no declara un máximo de ventana; manda la Voc máxima'));
        }

        if (iBanco <= equipo.corrienteSalidaA + TOLERANCIA) {
            lista.push(criterio('salida', 'Corriente al banco', 'cumple', iBanco, equipo.corrienteSalidaA, f1(iBanco) + ' A' + porUnidad + ' ≤ ' + fv(equipo.corrienteSalidaA) + ' A'));
        } else {
            const recortePct = (1 - equipo.corrienteSalidaA / iBanco) * 100;
            lista.push(criterio('salida', 'Corriente al banco', 'alerta', iBanco, equipo.corrienteSalidaA,
                f1(iBanco) + ' A' + porUnidad + ' > ' + fv(equipo.corrienteSalidaA) + ' A: el regulador limita la carga y recorta cerca del ' + fx(recortePct, 0) + ' % de la potencia en las horas pico'));
        }

        if (typeof equipo.iscMaxA === 'number') {
            lista.push(iscEntrada <= equipo.iscMaxA + TOLERANCIA
                ? criterio('isc', 'Isc por entrada', 'cumple', iscEntrada, equipo.iscMaxA, f1(iscEntrada) + ' A' + porUnidad + ' ≤ ' + fv(equipo.iscMaxA) + ' A')
                : criterio('isc', 'Isc por entrada', 'no_cumple', iscEntrada, equipo.iscMaxA, f1(iscEntrada) + ' A' + porUnidad + ' supera el cortocircuito máximo de ' + fv(equipo.iscMaxA) + ' A'));
        } else {
            lista.push(criterio('isc', 'Isc por entrada', 'no_aplica', iscEntrada, null, 'La ficha no declara la corriente de cortocircuito máxima; confírmela con el fabricante'));
        }

        return {
            equipo,
            arreglo: a,
            criterios: lista,
            veredicto: veredictoGlobal(lista),
            unidades,
            grupos,
            corrienteBancoA: iBanco,
            corrienteBancoTotalA: a.potenciaW / ctx.vNominalV,
            corrienteConductoresA: FACTOR_CONDUCTORES * a.iscA,
            tensionArranqueV: vArranque,
            limites: limitesSerie(equipo, a, vArranque),
        };
    }

    // ---------------------------------------------------------------------
    // Verificación de un inversor de red (rama sin almacenamiento)
    // ---------------------------------------------------------------------
    function verificarInversor(equipo, arreglo, ctx) {
        const a = describirArreglo(arreglo);
        const npEntrada = cadenasPorEntrada(a.np, equipo.entradasMppt);
        const iscEntrada = npEntrada * arreglo.modulo.iscA;
        const impEntrada = npEntrada * arreglo.modulo.impA;
        const rango = ctx.rangoDcAc || RANGO_DC_AC;
        const dcAc = a.potenciaW / equipo.pacW;
        const lista = [];

        lista.push(a.vocFrioV <= equipo.vocMaxV + TOLERANCIA
            ? criterio('voc', 'Voc en frío', 'cumple', a.vocFrioV, equipo.vocMaxV, f1(a.vocFrioV) + ' V ≤ ' + fv(equipo.vocMaxV) + ' V')
            : criterio('voc', 'Voc en frío', 'no_cumple', a.vocFrioV, equipo.vocMaxV, f1(a.vocFrioV) + ' V supera los ' + fv(equipo.vocMaxV) + ' V de entrada: daña el equipo'));

        lista.push(a.vmpCalienteV >= equipo.mpptMinV - TOLERANCIA
            ? criterio('mpptMin', 'Ventana MPPT (mínimo)', 'cumple', a.vmpCalienteV, equipo.mpptMinV, f1(a.vmpCalienteV) + ' V ≥ ' + fv(equipo.mpptMinV) + ' V')
            : criterio('mpptMin', 'Ventana MPPT (mínimo)', 'no_cumple', a.vmpCalienteV, equipo.mpptMinV, 'Vmp en caliente ' + f1(a.vmpCalienteV) + ' V queda bajo el mínimo de ' + fv(equipo.mpptMinV) + ' V'));

        lista.push(a.vmpFrioV <= equipo.mpptMaxV + TOLERANCIA
            ? criterio('mpptMax', 'Ventana MPPT (máximo)', 'cumple', a.vmpFrioV, equipo.mpptMaxV, f1(a.vmpFrioV) + ' V ≤ ' + fv(equipo.mpptMaxV) + ' V')
            : criterio('mpptMax', 'Ventana MPPT (máximo)', 'no_cumple', a.vmpFrioV, equipo.mpptMaxV, 'Vmp en frío ' + f1(a.vmpFrioV) + ' V supera el máximo de ' + fv(equipo.mpptMaxV) + ' V'));

        if (typeof equipo.arranqueV === 'number') {
            lista.push(a.vmpCalienteV >= equipo.arranqueV - TOLERANCIA
                ? criterio('arranque', 'Tensión de arranque', 'cumple', a.vmpCalienteV, equipo.arranqueV, f1(a.vmpCalienteV) + ' V ≥ ' + fv(equipo.arranqueV) + ' V')
                : criterio('arranque', 'Tensión de arranque', 'no_cumple', a.vmpCalienteV, equipo.arranqueV, 'Vmp en caliente ' + f1(a.vmpCalienteV) + ' V no alcanza el arranque de ' + fv(equipo.arranqueV) + ' V'));
        }

        lista.push(impEntrada <= equipo.impMaxA + TOLERANCIA
            ? criterio('imp', 'Imp por entrada', 'cumple', impEntrada, equipo.impMaxA, f1(impEntrada) + ' A ≤ ' + fv(equipo.impMaxA) + ' A')
            : criterio('imp', 'Imp por entrada', 'no_cumple', impEntrada, equipo.impMaxA, f1(impEntrada) + ' A supera la corriente máxima de ' + fv(equipo.impMaxA) + ' A por entrada'));

        lista.push(iscEntrada <= equipo.iscMaxA + TOLERANCIA
            ? criterio('isc', 'Isc por entrada', 'cumple', iscEntrada, equipo.iscMaxA, f1(iscEntrada) + ' A ≤ ' + fv(equipo.iscMaxA) + ' A')
            : criterio('isc', 'Isc por entrada', 'no_cumple', iscEntrada, equipo.iscMaxA, f1(iscEntrada) + ' A supera el cortocircuito máximo de ' + fv(equipo.iscMaxA) + ' A'));

        let estadoDcAc = 'cumple';
        let textoDcAc = fx(dcAc, 2) + ' dentro del rango ' + fx(rango[0], 2) + ' – ' + fx(rango[1], 2);
        if (dcAc > rango[1] + TOLERANCIA) {
            estadoDcAc = 'alerta';
            textoDcAc = fx(dcAc, 2) + ' > ' + fx(rango[1], 2) + ': se espera recorte en las horas de mayor sol';
        } else if (dcAc < rango[0] - TOLERANCIA) {
            estadoDcAc = 'alerta';
            textoDcAc = fx(dcAc, 2) + ' < ' + fx(rango[0], 2) + ': inversor sobredimensionado para este generador';
        }
        lista.push(criterio('dcac', 'Relación DC/AC', estadoDcAc, dcAc, rango, textoDcAc));

        return {
            equipo,
            arreglo: a,
            criterios: lista,
            veredicto: veredictoGlobal(lista),
            relacionDcAc: dcAc,
            rangoDcAc: rango,
            corrienteConductoresA: FACTOR_CONDUCTORES * a.iscA,
            limites: limitesSerie(equipo, a, null),
        };
    }

    // Mínimo y máximo de módulos en serie que admite el equipo.
    function limitesSerie(equipo, a, vArranqueRegulador) {
        const maxPorVoc = Math.floor(equipo.vocMaxV / a.modulo.vocFrio + TOLERANCIA);
        const maxPorVentana = typeof equipo.mpptMaxV === 'number' ? Math.floor(equipo.mpptMaxV / a.modulo.vmpFrio + TOLERANCIA) : Infinity;
        const minimos = [];
        if (typeof vArranqueRegulador === 'number') minimos.push(vArranqueRegulador);
        if (typeof equipo.mpptMinV === 'number') minimos.push(equipo.mpptMinV);
        if (typeof equipo.arranqueV === 'number') minimos.push(equipo.arranqueV);
        const vMin = minimos.length ? Math.max.apply(null, minimos) : 0;
        return {
            maxSerie: Math.min(maxPorVoc, maxPorVentana),
            maxSeriePorVoc: maxPorVoc,
            minSerie: Math.max(1, Math.ceil(vMin / a.modulo.vmpCaliente - TOLERANCIA)),
        };
    }

    // ---------------------------------------------------------------------
    // Propuesta de otra configuración de cadenas cuando el equipo no admite
    // la del generador. Se mantiene el número de módulos o se agrega el
    // mínimo para que todas las cadenas queden iguales.
    // ---------------------------------------------------------------------
    function proponerConfiguracion(tipo, equipo, arreglo, ctx) {
        const n = arreglo.modulosSerie * arreglo.cadenasParalelo;
        const verificar = tipo === 'regulador' ? verificarRegulador : verificarInversor;
        const base = verificar(equipo, arreglo, ctx);
        const { minSerie, maxSerie } = base.limites;
        if (maxSerie < 1 || minSerie > maxSerie) {
            return { posible: false, motivo: 'Con este módulo ninguna cadena queda a la vez bajo la tensión máxima y sobre la tensión mínima del equipo.' };
        }
        const candidatas = [];
        for (let ns = minSerie; ns <= maxSerie; ns++) {
            const np = Math.ceil(n / ns);
            const prueba = verificar(equipo, Object.assign({}, arreglo, { modulosSerie: ns, cadenasParalelo: np }), ctx);
            if (prueba.veredicto === 'no_cumple') continue;
            candidatas.push({ ns, np, total: ns * np, adicionales: ns * np - n, verificacion: prueba });
        }
        if (candidatas.length === 0) {
            return { posible: false, motivo: 'Ninguna combinación de cadenas cumple las corrientes por entrada de este equipo.' };
        }
        candidatas.sort((x, y) => x.adicionales - y.adicionales
            || (x.verificacion.veredicto === 'cumple' ? 0 : 1) - (y.verificacion.veredicto === 'cumple' ? 0 : 1)
            || y.ns - x.ns);
        return Object.assign({ posible: true }, candidatas[0]);
    }

    // ---------------------------------------------------------------------
    // Banco de baterías
    // ---------------------------------------------------------------------
    function validarBanco(p) {
        const errores = [];
        const noche = p.modoAutonomia === 'noche';
        if (!(p.autonomiaDias > 0)) errores.push(noche ? 'El número de noches de autonomía debe ser mayor que cero.' : 'La autonomía debe ser mayor que cero días.');
        if (noche && !(p.energiaNocheKWh > 0)) errores.push('El perfil no tiene consumo fuera de la ventana solar, así que no hay energía nocturna que guardar: use la autonomía por días.');
        if (!(p.dodPct > 0 && p.dodPct <= 100)) errores.push('El DoD de diseño debe estar entre 0 y 100 %.');
        if (!(p.etaInv > 0 && p.etaInv <= 1)) errores.push('La eficiencia del inversor debe estar entre 0 y 1.');
        if (!(p.etaBat > 0 && p.etaBat <= 1)) errores.push('La eficiencia de ida y vuelta de la batería debe estar entre 0 y 1.');
        if (!(p.fT > 0 && p.fT <= 1)) errores.push('El factor de temperatura debe estar entre 0 y 1 (1,0 con temperatura mínima de 18 °C o más).');
        if (!(p.vBancoV > 0)) errores.push('La tensión del banco debe ser mayor que cero.');
        if (!(p.vNominalV > 0)) errores.push('La tensión nominal del sistema debe ser mayor que cero.');
        return errores;
    }

    function tensionBancoSugerida(vNominalV, bateria) {
        const ns = Math.max(1, Math.round(vNominalV / bateria.tensionV));
        return Number((ns * bateria.tensionV).toFixed(2));
    }

    function dimensionarBanco(p) {
        const errores = validarBanco(p);
        if (errores.length) throw new Error(errores.join(' '));
        const bat = p.bateria;
        const advertencias = [];

        const modo = p.modoAutonomia === 'noche' ? 'noche' : 'dias';
        const eccWh = (p.energiaDiariaKWh * 1000) / p.etaInv;
        // Energía que el banco entrega en cada día (o noche) de autonomía.
        const eccBancoWh = modo === 'noche' ? (p.energiaNocheKWh * 1000) / p.etaInv : eccWh;
        const cnWh = eccBancoWh * p.autonomiaDias / ((p.dodPct / 100) * p.fT);
        const cnAh = cnWh / p.vBancoV;

        const nsExacto = p.vBancoV / bat.tensionV;
        const ns = Math.round(nsExacto);
        if (ns < 1 || Math.abs(nsExacto - ns) > 1e-6) {
            throw new Error('La tensión del banco (' + fx(p.vBancoV, 1) + ' V) no es un múltiplo de la tensión de la batería (' + fx(bat.tensionV, 1) + ' V). Con esta batería use, por ejemplo, ' + fx(tensionBancoSugerida(p.vNominalV, bat), 1) + ' V.');
        }
        if (typeof bat.maxSerie === 'number' && ns > bat.maxSerie) {
            throw new Error('Con un banco de ' + fx(p.vBancoV, 1) + ' V harían falta ' + ns + ' baterías de ' + fx(bat.tensionV, 1) + ' V en serie y la ficha admite ' +
                (bat.maxSerie === 1 ? 'solo conexión en paralelo (no en serie)' : 'como máximo ' + bat.maxSerie + ' en serie') + '. Use un banco de ' + fx(bat.tensionV * bat.maxSerie, 1) + ' V o menos, u otra batería.');
        }
        const np = Math.ceil(cnAh / bat.capacidadAh - TOLERANCIA);
        const ahInstalados = np * bat.capacidadAh;
        const whInstalados = ahInstalados * p.vBancoV;
        const dodFin = eccBancoWh * p.autonomiaDias / whInstalados;
        const dodDiarioDiseno = (p.dodPct / 100) / p.autonomiaDias;
        const dodDiarioReal = eccBancoWh / whInstalados;

        if (dodFin > (p.dodPct / 100) + TOLERANCIA) {
            advertencias.push('Con el arreglo instalado el DoD al final de la autonomía (' + fx(dodFin * 100, 1) + ' %) supera el DoD de diseño (' + p.dodPct + ' %).');
        }
        if (typeof bat.dodDisenoPct === 'number' && p.dodPct > bat.dodDisenoPct + TOLERANCIA) {
            advertencias.push('El DoD de diseño (' + p.dodPct + ' %) es mayor que el que declara la ficha de la batería (' + bat.dodDisenoPct + ' %): la vida del banco será menor.');
        }
        if (typeof bat.maxBaterias === 'number' && ns * np > bat.maxBaterias) {
            advertencias.push('El banco necesita ' + (ns * np) + ' baterías y el fabricante admite como máximo ' + bat.maxBaterias + ' por sistema.');
        }
        if (typeof bat.maxParalelo === 'number' && np > bat.maxParalelo) {
            advertencias.push('El banco necesita ' + np + ' ramas en paralelo y el fabricante admite como máximo ' + bat.maxParalelo + '.');
        }
        if (Math.abs(p.vBancoV - p.vNominalV) / p.vNominalV > 0.15) {
            advertencias.push('La tensión del banco (' + fx(p.vBancoV, 1) + ' V) está lejos de la tensión nominal del sistema (' + fx(p.vNominalV, 0) + ' V); revise que el regulador y el inversor la admitan.');
        }

        return {
            bateria: bat,
            modoAutonomia: modo,
            energiaNocheKWh: modo === 'noche' ? p.energiaNocheKWh : null,
            eccWh, eccBancoWh, cnWh, cnAh,
            ns, np,
            numeroBaterias: ns * np,
            ahInstalados, whInstalados,
            kWhInstalados: whInstalados / 1000,
            dodFin, dodDiarioDiseno, dodDiarioReal,
            autonomiaDias: p.autonomiaDias, dodPct: p.dodPct, fT: p.fT,
            vBancoV: p.vBancoV, vNominalV: p.vNominalV,
            etaInv: p.etaInv, etaBat: p.etaBat,
            advertencias,
        };
    }

    // ---------------------------------------------------------------------
    // Tasa C, recuperación y vida
    // ---------------------------------------------------------------------
    function tasasC(banco, potenciaGeneradorW, demandaMaximaW) {
        const bat = banco.bateria;
        const iCarga = potenciaGeneradorW / banco.vNominalV;
        const cCarga = iCarga / banco.ahInstalados;
        const iDescarga = demandaMaximaW / (banco.etaInv * banco.vNominalV);
        const cDescarga = iDescarga / banco.ahInstalados;
        const carga = typeof bat.limiteCargaC === 'number'
            ? { estado: cCarga <= bat.limiteCargaC + TOLERANCIA ? 'cumple' : 'no_cumple', limite: bat.limiteCargaC }
            : { estado: 'no_aplica', limite: null };
        const descarga = typeof bat.limiteDescargaC === 'number'
            ? { estado: cDescarga <= bat.limiteDescargaC + TOLERANCIA ? 'cumple' : 'no_cumple', limite: bat.limiteDescargaC }
            : { estado: 'no_aplica', limite: null };
        return {
            corrienteCargaA: iCarga, tasaCarga: cCarga, carga,
            corrienteDescargaA: iDescarga, tasaDescarga: cDescarga, descarga,
            // Capacidad mínima para que la corriente de carga no supere el límite.
            ahMinimosPorCarga: typeof bat.limiteCargaC === 'number' ? iCarga / bat.limiteCargaC : null,
        };
    }

    // Energía diaria que debe producir el generador para el consumo, con las
    // pérdidas del inversor y, para la energía que pasa por el banco, de la batería.
    function energiaAGenerarWh(p) {
        const eccWh = (p.energiaDiariaKWh * 1000) / p.etaInv;
        if (p.modoAutonomia !== 'noche') return eccWh / p.etaBat;
        const nocheWh = (p.energiaNocheKWh * 1000) / p.etaInv;
        return (eccWh - nocheWh) + nocheWh / p.etaBat;
    }

    function recuperacion(banco, potenciaGeneradorW, hspAnual, pr) {
        const eProdWh = potenciaGeneradorW * hspAnual * pr;
        const egenWh = energiaAGenerarWh({ energiaDiariaKWh: banco.eccWh * banco.etaInv / 1000, energiaNocheKWh: banco.energiaNocheKWh, etaInv: banco.etaInv, etaBat: banco.etaBat, modoAutonomia: banco.modoAutonomia });
        // Lo que sobra cada día después de cubrir el consumo llega al banco con η_bat.
        const denominador = (eProdWh - egenWh) * banco.etaBat;
        return {
            eProdWh,
            egenWh,
            excedenteDiarioWh: denominador,
            seRecupera: denominador > TOLERANCIA,
            dias: denominador > TOLERANCIA ? (banco.autonomiaDias * banco.eccBancoWh) / denominador : null,
        };
    }

    // ---------------------------------------------------------------------
    // Balance de cierre
    // ---------------------------------------------------------------------
    function balanceCierre(p) {
        const eccWh = (p.energiaDiariaKWh * 1000) / p.etaInv;
        const egenWh = energiaAGenerarWh(p);
        const calc = hsp => {
            const preqW = egenWh / (hsp * p.pr);
            const margenW = p.potenciaInstaladaW - preqW;
            return {
                hsp,
                potenciaRequeridaW: preqW,
                margenW,
                margenPct: (margenW / preqW) * 100,
                modulosAdicionales: margenW < -TOLERANCIA ? Math.ceil(-margenW / p.potenciaModuloW - TOLERANCIA) : 0,
            };
        };
        const anual = calc(p.hspAnual);
        const critico = calc(p.hspCritico);
        const usado = p.criterioRecurso === 'anual' ? anual : critico;
        return {
            eccWh, egenWh,
            modoAutonomia: p.modoAutonomia === 'noche' ? 'noche' : 'dias',
            potenciaInstaladaW: p.potenciaInstaladaW,
            anual, critico,
            criterioRecurso: p.criterioRecurso,
            usado,
            hayDeficit: usado.margenW < -TOLERANCIA,
        };
    }

    // ---------------------------------------------------------------------
    // Comparación de tecnologías: energía nominal instalada por año de vida
    // ---------------------------------------------------------------------
    function compararTecnologias(baterias, p) {
        return baterias.map(bat => {
            try {
                const vBanco = tensionBancoSugerida(p.vNominalV, bat);
                const dod = dodDeDiseno(bat);
                const banco = dimensionarBanco(Object.assign({}, p, {
                    bateria: bat,
                    vBancoV: vBanco,
                    dodPct: dod.valor !== null ? dod.valor : p.dodPct,
                    etaBat: typeof bat.eficienciaIdaVuelta === 'number' ? bat.eficienciaIdaVuelta : p.etaBat,
                }));
                const c = tasasC(banco, p.potenciaGeneradorW, p.demandaMaximaW);
                const vida = typeof bat.vidaAnios === 'number' ? bat.vidaAnios : null;
                const delFormulario = [];
                if (dod.origen === null) delFormulario.push('DoD');
                if (typeof bat.eficienciaIdaVuelta !== 'number') delFormulario.push('η');
                return {
                    bateria: bat, banco, tasas: c, delFormulario, origenDod: dod.origen,
                    vidaAnios: vida,
                    kWhPorAnio: vida ? banco.kWhInstalados / vida : null,
                };
            } catch (err) {
                return { bateria: bat, error: err.message };
            }
        });
    }

    // ---------------------------------------------------------------------
    // Sensibilidad del banco a la autonomía, con la batería y el DoD elegidos
    // ---------------------------------------------------------------------
    function sensibilidadAutonomia(p, dias) {
        return dias.map(n => {
            try {
                const b = dimensionarBanco(Object.assign({}, p, { autonomiaDias: n }));
                return { autonomiaDias: n, banco: b };
            } catch (err) {
                return { autonomiaDias: n, error: err.message };
            }
        });
    }

    // ---------------------------------------------------------------------
    // Selección del equipo con criterio explícito
    // ---------------------------------------------------------------------
    const CRITERIOS_EQUIPO = {
        regulador: {
            nombre: 'Menos reguladores y menor corriente nominal que cumple',
            explicacion: 'Entre los reguladores que cumplen, se elige el que necesita menos unidades en paralelo y, entre esos, el de menor corriente de salida, porque es el más ajustado al generador. Si ninguno cumple sin alertas, se elige entre los que solo tienen alertas el que necesita menos unidades y menos recorta (el de mayor corriente de salida).',
            comparar: (a, b) => (a.unidades || 1) - (b.unidades || 1) || a.equipo.corrienteSalidaA - b.equipo.corrienteSalidaA || a.equipo.vocMaxV - b.equipo.vocMaxV,
            compararConAlerta: (a, b) => (a.unidades || 1) - (b.unidades || 1) || b.equipo.corrienteSalidaA - a.equipo.corrienteSalidaA || a.equipo.vocMaxV - b.equipo.vocMaxV,
        },
        inversor: {
            nombre: 'Relación DC/AC más cercana a 1,2',
            explicacion: 'Entre los inversores que cumplen, se elige el de relación DC/AC más cercana a 1,2, el valor que propone PVWatts. Si ninguno cumple sin alertas, se elige entre los que solo tienen alertas.',
            comparar: (a, b) => Math.abs(a.relacionDcAc - 1.2) - Math.abs(b.relacionDcAc - 1.2) || a.equipo.pacW - b.equipo.pacW,
        },
    };

    function seleccionarEquipo(tipo, verificaciones) {
        const regla = CRITERIOS_EQUIPO[tipo];
        const comerciales = verificaciones.filter(v => !v.equipo.referenciaTdR);
        const cumplen = comerciales.filter(v => v.veredicto === 'cumple');
        const conAlerta = comerciales.filter(v => v.veredicto === 'alerta');
        if (cumplen.length) return cumplen.slice().sort(regla.comparar)[0];
        if (conAlerta.length) return conAlerta.slice().sort(regla.compararConAlerta || regla.comparar)[0];
        return null;
    }

    // ---------------------------------------------------------------------
    // Orquestador
    // ---------------------------------------------------------------------
    function dimensionarConversion(e) {
        if (!e || !e.generador) throw new Error('Primero dimensione el generador en el paso anterior.');
        const rama = e.rama === 'sin' ? 'sin' : 'con';
        const g = e.generador;
        const arreglo = {
            modulo: g.modulo,
            modulosSerie: g.modulosSerie,
            cadenasParalelo: g.cadenasParalelo,
            tMinC: g.tMinC,
            tCeldaC: g.tCeldaC,
        };
        const potenciaW = g.modulosSerie * g.cadenasParalelo * g.modulo.potenciaW;
        const advertencias = [];
        const tipo = rama === 'con' ? 'regulador' : 'inversor';
        const lista = rama === 'con' ? (e.catalogo.reguladores || []) : (e.catalogo.inversores || []);
        if (lista.length === 0) throw new Error('El catálogo no tiene ' + (rama === 'con' ? 'reguladores MPPT' : 'inversores de red') + '.');

        const ctxEquipo = rama === 'con'
            ? { vBancoV: e.vBancoV, vNominalV: e.vNominalV, margenArranqueV: e.margenArranqueV, permitirParalelo: e.permitirParalelo }
            : { rangoDcAc: e.rangoDcAc || RANGO_DC_AC };
        if (rama === 'con' && !(e.vNominalV > 0 && e.vBancoV > 0)) throw new Error('Indique la tensión nominal del sistema y la del banco.');
        if (rama === 'sin') {
            const r = ctxEquipo.rangoDcAc;
            if (!(r[0] > 0 && r[1] > r[0])) throw new Error('El rango de la relación DC/AC debe tener un mínimo mayor que cero y un máximo mayor que el mínimo.');
        }

        const verificar = rama === 'con' ? verificarRegulador : verificarInversor;
        const verificaciones = lista.map(eq => {
            const v = verificar(eq, arreglo, ctxEquipo);
            if (v.veredicto === 'no_cumple') v.propuesta = proponerConfiguracion(tipo, eq, arreglo, ctxEquipo);
            return v;
        });

        let seleccion;
        let modoSeleccion;
        if (e.equipoManualId) {
            seleccion = verificaciones.find(v => v.equipo.id === e.equipoManualId) || null;
            if (!seleccion) throw new Error('El equipo elegido no está en el catálogo.');
            modoSeleccion = 'manual';
        } else {
            seleccion = seleccionarEquipo(tipo, verificaciones);
            modoSeleccion = 'automatica';
        }
        const ningunoCumple = !verificaciones.some(v => v.veredicto !== 'no_cumple');
        if (ningunoCumple) {
            advertencias.push('Ningún equipo del catálogo admite este generador. Agregue al catálogo un equipo con mayor tensión o corriente de entrada, o reduzca el generador.');
        } else if (!seleccion && modoSeleccion === 'automatica') {
            advertencias.push('Solo los equipos del caso de prueba admiten este generador; elíjalo de forma manual.');
        }

        const resultado = {
            rama,
            tipoEquipo: tipo,
            potenciaGeneradorW: potenciaW,
            arreglo: describirArreglo(arreglo),
            verificaciones,
            seleccion,
            modoSeleccion,
            criterioSeleccion: modoSeleccion === 'automatica' ? CRITERIOS_EQUIPO[tipo] : null,
            ningunoCumple,
            corrienteConductoresA: FACTOR_CONDUCTORES * describirArreglo(arreglo).iscA,
            advertencias,
        };

        if (rama === 'con') {
            if (!e.bateria) throw new Error('Elija una batería del catálogo.');
            const pBanco = {
                energiaDiariaKWh: e.energiaDiariaKWh,
                etaInv: e.etaInv, etaBat: e.etaBat,
                autonomiaDias: e.autonomiaDias, dodPct: e.dodPct, fT: e.fT,
                vBancoV: e.vBancoV, vNominalV: e.vNominalV,
                bateria: e.bateria,
                modoAutonomia: e.modoAutonomia === 'noche' ? 'noche' : 'dias',
                energiaNocheKWh: e.energiaNocheKWh,
            };
            const banco = dimensionarBanco(pBanco);
            const tasas = tasasC(banco, potenciaW, e.demandaMaximaW);
            const rec = recuperacion(banco, potenciaW, e.hspAnual, e.pr);
            const balance = balanceCierre({
                energiaDiariaKWh: e.energiaDiariaKWh, etaInv: e.etaInv, etaBat: e.etaBat,
                modoAutonomia: pBanco.modoAutonomia, energiaNocheKWh: e.energiaNocheKWh,
                hspAnual: e.hspAnual, hspCritico: e.hspCritico, pr: e.pr,
                potenciaInstaladaW: potenciaW, potenciaModuloW: g.modulo.potenciaW,
                criterioRecurso: e.criterioRecurso,
            });
            const comparacion = compararTecnologias(e.bateriasComparar || [e.bateria], Object.assign({}, pBanco, {
                potenciaGeneradorW: potenciaW, demandaMaximaW: e.demandaMaximaW,
            }));

            banco.advertencias.forEach(a => advertencias.push(a));
            if (tasas.carga.estado === 'no_cumple') {
                advertencias.push('La corriente de carga (' + fx(tasas.corrienteCargaA, 1) + ' A, ' + fx(tasas.tasaCarga, 2) + ' C) supera el límite de la batería (' + fx(tasas.carga.limite, 2) + ' C). Limite la corriente en el regulador o aumente el banco a ' + Math.ceil(tasas.ahMinimosPorCarga) + ' Ah.');
            }
            if (!rec.seRecupera) {
                advertencias.push('Con este generador el banco no se recupera después de agotar la autonomía: la energía que llega a la batería no alcanza a cubrir el consumo diario.');

            }
            if (balance.hayDeficit) {
                advertencias.push('El generador instalado queda corto en ' + fx(Math.abs(balance.usado.margenPct), 1) + ' % frente a la potencia requerida con las pérdidas del inversor y de la batería: faltan ' + balance.usado.modulosAdicionales + ' módulo(s).');
            }
            const diasSensibilidad = Array.from(new Set([1, 2, 3, 4, e.autonomiaDias])).sort((x, y) => x - y);
            const sensibilidad = sensibilidadAutonomia(pBanco, diasSensibilidad);
            Object.assign(resultado, { banco, tasas, recuperacion: rec, balance, comparacion, sensibilidad, modoAutonomia: pBanco.modoAutonomia });
        }
        return resultado;
    }

    const Conversion = {
        RAMAS, RANGO_DC_AC, DOD_CURSO_PCT, dodDeDiseno, FACTOR_CONDUCTORES, MARGEN_ARRANQUE_V, CRITERIOS_EQUIPO,
        ramaPorContexto, tensionesModulo, describirArreglo,
        verificarRegulador, verificarInversor, limitesSerie, proponerConfiguracion, repartirCadenas, energiaAGenerarWh,
        tensionBancoSugerida, dimensionarBanco, tasasC, recuperacion, balanceCierre,
        compararTecnologias, sensibilidadAutonomia, seleccionarEquipo, dimensionarConversion,
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = Conversion;
    if (raiz) raiz.Conversion = Conversion;

})(typeof window !== 'undefined' ? window : null);
