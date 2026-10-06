// dimensionamiento.js
//
// Módulo de dimensionamiento del generador fotovoltaico (Reto 02).
// Funciones puras: no tocan la interfaz. Reciben la energía y el perfil que
// ya calcula el Reto 01, el recurso solar del sitio y el catálogo de
// módulos, y devuelven la potencia pico, la configuración en cadenas, las
// tensiones, las corrientes y el área del generador.
//
// Fórmulas (TdR Reto 02, sección 7.3):
//   (1) Ppico = Ed / (HSP · PR)
//   (2) Voc,gen = Nserie · Voc,STC · [1 + β (Tmin − 25)]  ≤  Vmax del sistema
//   (3) Idiseño = 1,25 · 1,25 · Isc,gen                  (NTC 2050 art. 690-8)
// Temperatura de celda en operación, modelo NOCT:
//       Tcelda = Tamb + (NOCT − 20) / 800 · G,   con G = 1000 W/m²

(function (raiz) {
    'use strict';

    const DIAS_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const NOMBRES_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const IRRADIANCIA_DISENO = 1000;      // W/m², condición del modelo NOCT del TdR
    const FACTOR_NTC_2050 = 1.25 * 1.25;  // = 1,5625

    // Rangos con los que se advierte un valor poco razonable (RF-24).
    const RANGOS = {
        hsp: [2, 8],                 // kWh/m²·día: en Colombia suele estar entre 3,5 y 6,5
        pr: [0.6, 0.9],
        vMaxSistema: [48, 1500],     // V
        tMinC: [-10, 35],            // °C
        tAmbOperacionC: [10, 45],    // °C
        etaBat: [0.7, 0.98],         // eficiencia de ida y vuelta de baterías
        crecimientoPct: [0, 50],     // % de crecimiento de carga
        coberturaPct: [0, 100],      // % de la energía que se quiere cubrir con el generador
    };

    // Métodos para llegar a la energía con la que se dimensiona el generador.
    const METODOS_POTENCIA = {
        referencia: {
            nombre: 'Método de referencia',
            formula: 'Ppico = Ed / (HSP · PR)',
        },
        balance: {
            nombre: 'Método propio: balance día/noche con factor de crecimiento y meta de cobertura',
            formula: 'Ppico = Fc · Cob · (E_día + E_noche / η_bat) / (HSP · PR), con Fc = 1 + g',
        },
    };

    // ---------------------------------------------------------------------
    // Coincidencia entre demanda y recurso solar (RF-17)
    // Usa el mismo criterio horario que la clasificación diurna/nocturna del
    // Reto 01: la hora h está dentro de la ventana si inicio ≤ h < fin.
    // ---------------------------------------------------------------------
    function energiaEnVentanaSolar(perfilW, horaInicio = 6, horaFin = 18) {
        if (!Array.isArray(perfilW) || perfilW.length !== 24) {
            throw new Error('El perfil horario debe tener 24 valores.');
        }
        let dentroWh = 0;
        let fueraWh = 0;
        for (let h = 0; h < 24; h++) {
            const enVentana = horaInicio < horaFin
                ? (h >= horaInicio && h < horaFin)
                : (h >= horaInicio || h < horaFin);
            if (enVentana) dentroWh += perfilW[h];
            else fueraWh += perfilW[h];
        }
        const totalWh = dentroWh + fueraWh;
        return {
            dentroKWh: dentroWh / 1000,
            fueraKWh: fueraWh / 1000,
            fraccionDentro: totalWh > 0 ? dentroWh / totalWh : 0,
            horaInicio,
            horaFin,
        };
    }

    // ---------------------------------------------------------------------
    // Recurso solar del sitio (RF-14, RF-16)
    // ---------------------------------------------------------------------
    function promedioAnualDesdeMensual(mensual) {
        let suma = 0;
        for (let m = 0; m < 12; m++) suma += mensual[m] * DIAS_MES[m];
        return suma / 365;
    }

    function analizarRecurso(sitio) {
        if (!sitio) throw new Error('No se ha seleccionado un sitio.');
        const mensual = Array.isArray(sitio.mensual) && sitio.mensual.length === 12 ? sitio.mensual.slice() : null;

        let anual = typeof sitio.irradiacionAnual === 'number' ? sitio.irradiacionAnual : null;
        if (anual === null && mensual) anual = promedioAnualDesdeMensual(mensual);

        let mesCritico = null;
        if (mensual) {
            let indice = 0;
            for (let m = 1; m < 12; m++) if (mensual[m] < mensual[indice]) indice = m;
            mesCritico = { indice, nombre: NOMBRES_MES[indice], valor: mensual[indice] };
        }
        // Un valor de mes crítico declarado explícitamente (caso de prueba) manda.
        if (typeof sitio.irradiacionMesCritico === 'number') {
            mesCritico = {
                indice: mesCritico ? mesCritico.indice : null,
                nombre: mesCritico ? mesCritico.nombre : 'declarado',
                valor: sitio.irradiacionMesCritico,
            };
        }

        if (anual === null || !(anual > 0)) {
            throw new Error('El sitio "' + (sitio.nombre || '') + '" no tiene irradiación anual válida.');
        }
        if (!mesCritico || !(mesCritico.valor > 0)) {
            throw new Error('El sitio "' + (sitio.nombre || '') + '" no tiene datos para el mes de menor recurso.');
        }
        return { anual, mesCritico, mensual };
    }

    // ---------------------------------------------------------------------
    // Potencia pico (RF-18), fórmula (1)
    // ---------------------------------------------------------------------
    function calcularPotenciaPicoKWp(energiaDiariaKWh, hsp, pr) {
        if (!(energiaDiariaKWh > 0)) throw new Error('La energía diaria debe ser mayor que cero.');
        if (!(hsp > 0)) throw new Error('La irradiación (HSP) debe ser mayor que cero.');
        if (!(pr > 0 && pr <= 1)) throw new Error('El factor global de desempeño debe estar entre 0 y 1.');
        return energiaDiariaKWh / (hsp * pr);
    }

    // ---------------------------------------------------------------------
    // Correcciones por temperatura (RF-20)
    // ---------------------------------------------------------------------
    function temperaturaCelda(tAmbC, temperaturaNominalC, irradiancia = IRRADIANCIA_DISENO) {
        return tAmbC + (temperaturaNominalC - 20) / 800 * irradiancia;
    }

    function corregirPorTemperatura(valorSTC, coeficientePctC, temperaturaC) {
        return valorSTC * (1 + (coeficientePctC / 100) * (temperaturaC - 25));
    }

    // ---------------------------------------------------------------------
    // Evaluación de un módulo del catálogo (RF-19 a RF-22)
    // ---------------------------------------------------------------------
    function evaluarModulo(modulo, ctx) {
        const vocTmin = corregirPorTemperatura(modulo.vocV, modulo.coefVocPctC, ctx.tMinC);
        const maxSerie = Math.floor(ctx.vMaxSistema / vocTmin);

        const base = {
            id: modulo.id,
            modulo,
            vocModuloTminV: vocTmin,
            maxModulosSerie: maxSerie,
        };

        // Filtro del TdR: un módulo cuyo Voc corregido no deja armar ni una
        // cadena bajo la tensión máxima queda descartado.
        if (maxSerie < 1) {
            return Object.assign(base, {
                viable: false,
                motivoDescarte: 'Su Voc a ' + ctx.tMinC + ' °C (' + vocTmin.toFixed(2) + ' V) supera la tensión máxima del sistema (' + ctx.vMaxSistema + ' V).',
            });
        }

        const modulosRequeridos = Math.ceil((ctx.potenciaPicoKWp * 1000) / modulo.potenciaW - 1e-9);
        // Cadenas iguales: tantas en paralelo como hagan falta para no pasar
        // del máximo en serie, y el mismo número de módulos en cada una.
        const cadenasParalelo = Math.ceil(modulosRequeridos / maxSerie);
        const modulosSerie = Math.ceil(modulosRequeridos / cadenasParalelo);
        const numeroModulos = modulosSerie * cadenasParalelo;

        const potenciaInstaladaW = numeroModulos * modulo.potenciaW;
        const potenciaPicoW = ctx.potenciaPicoKWp * 1000;
        const excedenteW = potenciaInstaladaW - potenciaPicoW;

        const tCelda = temperaturaCelda(ctx.tAmbOperacionC, modulo.temperaturaNominalC);
        // El TdR corrige Vmp con el coeficiente de Voc (β); se sigue igual.
        const vmpModuloOperacion = corregirPorTemperatura(modulo.vmpV, modulo.coefVocPctC, tCelda);
        const iscGenerador = modulo.iscA * cadenasParalelo;
        const areaGenerador = numeroModulos * modulo.areaM2;

        return Object.assign(base, {
            viable: true,
            modulosRequeridos,
            modulosSerie,
            cadenasParalelo,
            numeroModulos,
            modulosAdicionalesPorCadenas: numeroModulos - modulosRequeridos,
            potenciaInstaladaW,
            excedenteW,
            excedentePct: (excedenteW / potenciaPicoW) * 100,
            vocGeneradorTminV: modulosSerie * vocTmin,
            temperaturaCeldaC: tCelda,
            vmpGeneradorOperacionV: modulosSerie * vmpModuloOperacion,
            iscGeneradorA: iscGenerador,
            corrienteDisenoA: FACTOR_NTC_2050 * iscGenerador,
            areaGeneradorM2: areaGenerador,
            cabeEnArea: ctx.areaDisponibleM2 > 0 ? areaGenerador <= ctx.areaDisponibleM2 : null,
            potenciaOperacionW: corregirPorTemperatura(potenciaInstaladaW, modulo.coefPmaxPctC, tCelda),
        });
    }

    // ---------------------------------------------------------------------
    // Selección con criterio explícito (sección 5 del TdR)
    // ---------------------------------------------------------------------
    const CRITERIOS = {
        menor_excedente: {
            nombre: 'Menor excedente',
            explicacion: 'Se elige la referencia cuya potencia instalada queda más cerca de la potencia pico calculada, para no pagar capacidad que no se necesita.',
            comparar: (a, b) => a.excedenteW - b.excedenteW || a.numeroModulos - b.numeroModulos,
        },
        menor_numero: {
            nombre: 'Menor número de módulos',
            explicacion: 'Se elige la referencia que requiere menos unidades, lo que reduce soportes, conexiones y tiempo de montaje.',
            comparar: (a, b) => a.numeroModulos - b.numeroModulos || a.excedenteW - b.excedenteW,
        },
        menor_area: {
            nombre: 'Menor área ocupada',
            explicacion: 'Se elige la referencia que ocupa menos superficie, útil cuando el espacio disponible es la restricción principal.',
            comparar: (a, b) => a.areaGeneradorM2 - b.areaGeneradorM2 || a.excedenteW - b.excedenteW,
        },
    };

    function seleccionarModulo(evaluaciones, criterio) {
        const regla = CRITERIOS[criterio];
        if (!regla) throw new Error('Criterio de selección desconocido: ' + criterio);

        // Solo compiten referencias comerciales viables. El módulo de
        // referencia del TdR no es un producto real y solo se usa si se elige
        // a mano para reproducir el caso de prueba.
        const candidatos = evaluaciones.filter(e => e.viable && !e.modulo.referenciaTdR);
        if (candidatos.length === 0) return null;

        // Si alguna cabe en el área disponible, se escoge entre las que caben.
        const queCaben = candidatos.filter(e => e.cabeEnArea !== false);
        const grupo = queCaben.length > 0 ? queCaben : candidatos;
        return grupo.slice().sort(regla.comparar)[0];
    }

    // ---------------------------------------------------------------------
    // Validación de entradas (RF-24)
    // ---------------------------------------------------------------------
    // ---------------------------------------------------------------------
    // Método propio (docs/METODO_PROPIO.md): balance día/noche con factor
    // de crecimiento. La energía nocturna pasa por la batería y se pierde una
    // parte (η_bat); el crecimiento de carga esperado se declara con Fc = 1 + g.
    // ---------------------------------------------------------------------
    function energiaEquivalenteBalance(eDiaKWh, eNocheKWh, etaBat) {
        if (!(etaBat > 0 && etaBat <= 1)) throw new Error('La eficiencia de la batería (η_bat) debe estar entre 0 y 1.');
        return eDiaKWh + eNocheKWh / etaBat;
    }

    function factorCrecimiento(crecimientoPct) {
        if (!(crecimientoPct >= 0)) throw new Error('El crecimiento de carga esperado no puede ser negativo.');
        return 1 + crecimientoPct / 100;
    }

    function factorCobertura(coberturaPct) {
        if (!(coberturaPct > 0 && coberturaPct <= 100)) throw new Error('La meta de cobertura debe estar entre 1 y 100 %.');
        return coberturaPct / 100;
    }

    function validarParametros(p) {
        const errores = [];
        const advertencias = [];
        const fuera = (valor, [min, max]) => valor < min || valor > max;

        if (!(p.pr > 0 && p.pr <= 1)) errores.push('El factor global de desempeño debe estar entre 0 y 1.');
        else if (fuera(p.pr, RANGOS.pr)) advertencias.push('El factor global de desempeño (' + p.pr + ') está fuera del rango habitual de ' + RANGOS.pr[0] + ' a ' + RANGOS.pr[1] + '.');

        if (!(p.vMaxSistema > 0)) errores.push('La tensión máxima del sistema debe ser mayor que cero.');
        else if (fuera(p.vMaxSistema, RANGOS.vMaxSistema)) advertencias.push('La tensión máxima del sistema (' + p.vMaxSistema + ' V) es poco habitual.');

        if (typeof p.tMinC !== 'number' || isNaN(p.tMinC)) errores.push('Indique la temperatura ambiente mínima esperada.');
        else if (fuera(p.tMinC, RANGOS.tMinC)) advertencias.push('La temperatura mínima (' + p.tMinC + ' °C) es poco habitual para Colombia.');

        if (typeof p.tAmbOperacionC !== 'number' || isNaN(p.tAmbOperacionC)) errores.push('Indique la temperatura ambiente de operación.');
        else if (fuera(p.tAmbOperacionC, RANGOS.tAmbOperacionC)) advertencias.push('La temperatura de operación (' + p.tAmbOperacionC + ' °C) es poco habitual.');

        if (!(p.tAmbOperacionC >= p.tMinC)) advertencias.push('La temperatura de operación es menor que la mínima esperada; revise los dos valores.');

        if (!(p.areaDisponibleM2 > 0)) errores.push('El área disponible debe ser mayor que cero.');

        return { errores, advertencias };
    }

    // ---------------------------------------------------------------------
    // Orquestador del módulo de dimensionamiento
    // ---------------------------------------------------------------------
    function dimensionarGenerador(entrada) {
        const {
            energiaDiariaKWh, perfilW, horaInicioDia = 6, horaFinDia = 18,
            sitio, criterioRecurso = 'critico', pr, vMaxSistema, tMinC,
            tAmbOperacionC, areaDisponibleM2, catalogo, criterioSeleccion = 'menor_excedente',
            moduloManualId = null, diasOperacionAnio = 365,
            metodoPotencia = 'referencia', etaBat = 0.85, crecimientoPct = 0,
            coberturaPct = 100, contexto = null,
        } = entrada;
        if (!METODOS_POTENCIA[metodoPotencia]) throw new Error('Método de cálculo desconocido: ' + metodoPotencia);

        const { errores, advertencias } = validarParametros({ pr, vMaxSistema, tMinC, tAmbOperacionC, areaDisponibleM2 });
        if (errores.length > 0) throw new Error(errores.join(' '));
        if (!Array.isArray(catalogo) || catalogo.length === 0) throw new Error('El catálogo de módulos está vacío.');

        const recurso = analizarRecurso(sitio);
        const hspAnual = recurso.anual;
        const hspCritico = recurso.mesCritico.valor;
        const hspUsada = criterioRecurso === 'anual' ? hspAnual : hspCritico;
        if (hspUsada < RANGOS.hsp[0] || hspUsada > RANGOS.hsp[1]) {
            advertencias.push('La irradiación usada (' + hspUsada.toFixed(2) + ' kWh/m²·día) está fuera del rango razonable de ' + RANGOS.hsp[0] + ' a ' + RANGOS.hsp[1] + '.');
        }

        const coincidencia = Array.isArray(perfilW)
            ? energiaEnVentanaSolar(perfilW, horaInicioDia, horaFinDia)
            : null;

        // Energía con la que se dimensiona según el método elegido.
        let energiaEquivalenteKWh = energiaDiariaKWh;
        let fc = 1;
        let cob = 1;
        if (metodoPotencia === 'balance') {
            if (!coincidencia) throw new Error('El método propio necesita el perfil horario de 24 h para separar el consumo de día y de noche.');
            energiaEquivalenteKWh = energiaEquivalenteBalance(coincidencia.dentroKWh, coincidencia.fueraKWh, etaBat);
            fc = factorCrecimiento(crecimientoPct);
            cob = factorCobertura(coberturaPct);
            if (contexto === 'off-grid' && coberturaPct < 100) {
                advertencias.push('El sistema es off-grid (sin otra fuente): con una meta de cobertura de ' + coberturaPct + ' % quedaría sin atender cerca del ' + (100 - coberturaPct) + ' % de la energía que consumen las cargas.');
            }
            // η_bat = 1 significa "sin almacenamiento" (la noche la cubre otra fuente): no se advierte.
            if (etaBat < 1 && (etaBat < RANGOS.etaBat[0] || etaBat > RANGOS.etaBat[1])) {
                advertencias.push('La eficiencia de la batería (' + etaBat + ') está fuera del rango habitual de ' + RANGOS.etaBat[0] + ' a ' + RANGOS.etaBat[1] + '.');
            }
            if (crecimientoPct > RANGOS.crecimientoPct[1]) {
                advertencias.push('Un crecimiento de carga de ' + crecimientoPct + ' % es alto: el generador producirá energía que no se usa mientras la carga nueva no exista.');
            }
        }
        const energiaDisenoKWh = energiaEquivalenteKWh * fc * cob;

        const potenciaPicoAnualKWp = calcularPotenciaPicoKWp(energiaDisenoKWh, hspAnual, pr);
        const potenciaPicoCriticoKWp = calcularPotenciaPicoKWp(energiaDisenoKWh, hspCritico, pr);
        const potenciaPicoKWp = criterioRecurso === 'anual' ? potenciaPicoAnualKWp : potenciaPicoCriticoKWp;

        const metodo = {
            id: metodoPotencia,
            nombre: METODOS_POTENCIA[metodoPotencia].nombre,
            formula: METODOS_POTENCIA[metodoPotencia].formula,
            eDiaKWh: coincidencia ? coincidencia.dentroKWh : null,
            eNocheKWh: coincidencia ? coincidencia.fueraKWh : null,
            etaBat: metodoPotencia === 'balance' ? etaBat : null,
            crecimientoPct: metodoPotencia === 'balance' ? crecimientoPct : 0,
            fc,
            coberturaPct: metodoPotencia === 'balance' ? coberturaPct : 100,
            factorCobertura: cob,
            energiaEquivalenteKWh,
            energiaDisenoKWh,
            // Las tres potencias con la misma irradiación, para compararlas.
            potenciaReferenciaKWp: calcularPotenciaPicoKWp(energiaDiariaKWh, hspUsada, pr),
            potenciaBalanceKWp: calcularPotenciaPicoKWp(energiaEquivalenteKWh, hspUsada, pr),
            potenciaDisenoKWp: potenciaPicoKWp,
        };

        const ctx = { potenciaPicoKWp, vMaxSistema, tMinC, tAmbOperacionC, areaDisponibleM2 };
        const evaluaciones = catalogo.map(m => evaluarModulo(m, ctx));

        let seleccion;
        let modoSeleccion;
        if (moduloManualId) {
            seleccion = evaluaciones.find(e => e.id === moduloManualId) || null;
            if (!seleccion) throw new Error('El módulo elegido no está en el catálogo.');
            if (!seleccion.viable) throw new Error('El módulo elegido no es viable: ' + seleccion.motivoDescarte);
            modoSeleccion = 'manual';
        } else {
            seleccion = seleccionarModulo(evaluaciones, criterioSeleccion);
            if (!seleccion) throw new Error('Ningún módulo comercial del catálogo permite formar cadenas bajo ' + vMaxSistema + ' V.');
            modoSeleccion = 'automatica';
        }

        if (seleccion.cabeEnArea === false) {
            advertencias.push('El generador ocupa ' + seleccion.areaGeneradorM2.toFixed(2) + ' m² y el área disponible es de ' + areaDisponibleM2 + ' m²: no cabe.');
        }
        if (seleccion.modulosAdicionalesPorCadenas > 0) {
            advertencias.push('Para que todas las cadenas tengan el mismo número de módulos se instalan ' + seleccion.modulosAdicionalesPorCadenas + ' módulo(s) más de los estrictamente necesarios.');
        }

        // Energía que entregaría el generador instalado, con el promedio anual.
        const energiaGeneradaDiariaKWh = (seleccion.potenciaInstaladaW / 1000) * hspAnual * pr;
        const energiaGeneradaMesCriticoKWh = (seleccion.potenciaInstaladaW / 1000) * hspCritico * pr;

        return {
            recurso,
            criterioRecurso,
            hspUsada,
            pr,
            potenciaPicoKWp,
            potenciaPicoAnualKWp,
            potenciaPicoCriticoKWp,
            metodo,
            energiaDisenoKWh,
            evaluaciones,
            seleccion,
            modoSeleccion,
            criterioSeleccion: modoSeleccion === 'automatica' ? criterioSeleccion : null,
            criterio: modoSeleccion === 'automatica' ? CRITERIOS[criterioSeleccion] : null,
            energiaGeneradaDiariaKWh,
            energiaGeneradaMesCriticoKWh,
            energiaGeneradaAnualKWh: energiaGeneradaDiariaKWh * 365,
            energiaDemandadaAnualKWh: energiaDiariaKWh * diasOperacionAnio,
            coberturaPct: (energiaGeneradaDiariaKWh / energiaDiariaKWh) * 100,
            coberturaMesCriticoPct: (energiaGeneradaMesCriticoKWh / energiaDiariaKWh) * 100,
            coincidencia,
            parametros: { vMaxSistema, tMinC, tAmbOperacionC, areaDisponibleM2, irradianciaDiseno: IRRADIANCIA_DISENO },
            advertencias,
        };
    }

    const Dimensionamiento = {
        DIAS_MES, NOMBRES_MES, CRITERIOS, RANGOS, FACTOR_NTC_2050, METODOS_POTENCIA,
        energiaEquivalenteBalance, factorCrecimiento, factorCobertura,
        energiaEnVentanaSolar, promedioAnualDesdeMensual, analizarRecurso,
        calcularPotenciaPicoKWp, temperaturaCelda, corregirPorTemperatura,
        evaluarModulo, seleccionarModulo, validarParametros, dimensionarGenerador,
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = Dimensionamiento;
    if (raiz) raiz.Dimensionamiento = Dimensionamiento;

})(typeof window !== 'undefined' ? window : null);
