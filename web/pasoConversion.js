// pasoConversion.js
//
// Interfaz del Paso 5: conversión y almacenamiento.
// Toma el consumo (Pasos 1 a 3) y el generador (Paso 4) sin pedir que se
// reingresen, y recalcula al instante con cada cambio. Los cálculos viven en
// conversion.js.

(function () {
  'use strict';

  const C = window.Conversion;
  const estado = window.__estadoAppReto01;
  const $ = id => document.getElementById(id);

  const RUTA_EQUIPOS = 'datos/catalogo_equipos.json';
  const ETIQUETA = { cumple: 'Cumple', alerta: 'Alerta', no_cumple: 'No cumple', no_aplica: 'No aplica' };
  const ICONO = { cumple: '✓', alerta: '!', no_cumple: '✕', no_aplica: '–' };
  const NOMBRES_CONTEXTO = {
    'off-grid': 'Off-grid', 'on-grid': 'On-grid',
    'hibrido-off-grid': 'Híbrido off-grid', 'hibrido-on-grid': 'Híbrido on-grid',
  };

  const catalogo = { reguladores: [], inversores: [], baterias: [], origen: '' };
  let ramaElegidaPorUsuario = false;
  let tensionBancoEditada = false;

  // ---------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------
  function escapar(texto) {
    const div = document.createElement('div');
    div.textContent = texto === null || texto === undefined ? '' : String(texto);
    return div.innerHTML;
  }
  function mostrarEstado(id, mensaje, tipo) {
    const el = $(id);
    el.textContent = mensaje;
    el.className = 'status ' + (tipo || '');
  }
  const num = (v, d) => Number(v).toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (v, d) => num(v * 100, d === undefined ? 1 : d) + ' %';
  function chip(estadoCriterio, texto) {
    return '<span class="chip chip-' + estadoCriterio + '">' + ICONO[estadoCriterio] + ' ' + escapar(texto || ETIQUETA[estadoCriterio]) + '</span>';
  }
  function tarjetas(items) {
    return items.map(([label, valor, sub, clase]) => `
      <div class="indicador-card ${clase || ''}">
        <div class="label">${escapar(label)}</div>
        <div class="value">${valor}</div>
        <div class="sub">${sub || ''}</div>
      </div>`).join('');
  }
  function nombreEquipo(eq) {
    return eq.referenciaTdR ? eq.modelo : (eq.fabricante + ' ' + eq.modelo);
  }
  // Nombre con el número de unidades cuando se usan varios reguladores en paralelo.
  function nombreConUnidades(v) {
    return (v.unidades > 1 ? v.unidades + ' × ' : '') + nombreEquipo(v.equipo);
  }
  function fechaLocalHoy() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ---------------------------------------------------------------------
  // Catálogo de equipos y baterías
  // ---------------------------------------------------------------------
  async function leerJSON(ruta) {
    if (typeof window.fetch !== 'function') return null;
    try {
      const r = await window.fetch(ruta, { cache: 'no-store' });
      return r.ok ? await r.json() : null;
    } catch (err) {
      return null;
    }
  }

  function validarCatalogo(c) {
    if (!c || !Array.isArray(c.reguladores) || !Array.isArray(c.inversores) || !Array.isArray(c.baterias)) {
      throw new Error('El archivo debe tener las listas "reguladores", "inversores" y "baterias".');
    }
    const faltan = [];
    const revisar = (lista, nombre, campos) => lista.forEach((e, i) => {
      campos.forEach(campo => { if (typeof e[campo] !== 'number' || !(e[campo] > 0)) faltan.push(nombre + ' ' + (e.modelo || i + 1) + ': ' + campo); });
      if (!e.id) faltan.push(nombre + ' ' + (i + 1) + ': id');
    });
    revisar(c.reguladores, 'Regulador', ['vocMaxV', 'corrienteSalidaA']);
    revisar(c.inversores, 'Inversor', ['pacW', 'vocMaxV', 'mpptMinV', 'mpptMaxV', 'impMaxA', 'iscMaxA']);
    revisar(c.baterias, 'Batería', ['tensionV', 'capacidadAh']);
    if (faltan.length) throw new Error('Faltan valores o no son válidos: ' + faltan.slice(0, 6).join('; ') + (faltan.length > 6 ? '…' : '') + '.');
  }

  function usarCatalogo(c, origen) {
    catalogo.reguladores = c.reguladores;
    catalogo.inversores = c.inversores;
    catalogo.baterias = c.baterias;
    catalogo.origen = origen;
    catalogo.original = c;
    poblarSelectores();
    $('convResumenCatalogo').textContent =
      catalogo.reguladores.length + ' reguladores MPPT, ' + catalogo.inversores.length + ' inversores de red y ' +
      catalogo.baterias.length + ' baterías (' + Array.from(new Set(catalogo.baterias.map(b => b.tecnologia))).join(', ') + '). ' +
      'Cada equipo declara la ficha técnica de la que se tomaron sus valores. Para agregar o corregir un equipo, descargue el catálogo, edítelo y vuelva a cargarlo.';
  }

  async function cargarCatalogo() {
    const leido = await leerJSON(RUTA_EQUIPOS);
    const respaldo = window.DATOS_RESPALDO && window.DATOS_RESPALDO.equipos;
    try {
      if (leido) { validarCatalogo(leido); usarCatalogo(leido, RUTA_EQUIPOS); return; }
    } catch (err) { /* se usa la copia de respaldo */ }
    if (respaldo) usarCatalogo(respaldo, 'copia de respaldo');
    else mostrarEstado('estadoCatalogoEquipos', 'No se encontró el catálogo de equipos. Cárguelo con el botón "Cargar catálogo editado".', 'error');
  }

  function poblarSelectores() {
    const llenar = (sel, lista, auto) => {
      const previo = sel.value;
      sel.innerHTML = (auto ? '<option value="">' + escapar(auto) + '</option>' : '') +
        lista.map(e => '<option value="' + escapar(e.id) + '">' + escapar(nombreEquipo(e) + (e.referenciaTdR ? ' (caso de prueba)' : '') + resumenEquipo(e)) + '</option>').join('');
      if (previo !== '' && lista.some(e => e.id === previo)) sel.value = previo;
    };
    llenar($('convRegulador'), catalogo.reguladores, 'Automático: ' + C.CRITERIOS_EQUIPO.regulador.nombre.toLowerCase());
    llenar($('convInversor'), catalogo.inversores, 'Automático: ' + C.CRITERIOS_EQUIPO.inversor.nombre.toLowerCase());
    // Primero las baterías comerciales; las del caso de prueba quedan al final.
    const selBat = $('convBateria');
    const previo = selBat.value;
    const ordenadas = catalogo.baterias.filter(b => !b.referenciaTdR).concat(catalogo.baterias.filter(b => b.referenciaTdR));
    llenar(selBat, ordenadas, null);
    if (!previo || !catalogo.baterias.some(b => b.id === previo)) {
      // Por defecto, una batería comercial cuya ficha trae todos los datos del cálculo.
      const completa = ordenadas.find(b => typeof b.eficienciaIdaVuelta === 'number' && C.dodDeDiseno(b).valor !== null);
      if (completa) selBat.value = completa.id;
      aplicarValoresBateria();
    }
  }

  function resumenEquipo(e) {
    if (typeof e.corrienteSalidaA === 'number') return ' — ' + e.vocMaxV + ' V / ' + e.corrienteSalidaA + ' A';
    if (typeof e.pacW === 'number') return ' — ' + num(e.pacW, 0) + ' W';
    if (typeof e.capacidadAh === 'number') return ' — ' + num(e.tensionV, 1) + ' V / ' + num(e.capacidadAh, e.capacidadAh % 1 ? 2 : 0) + ' Ah';
    return '';
  }

  function bateriaSeleccionada() {
    return catalogo.baterias.find(b => b.id === $('convBateria').value) || catalogo.baterias[0] || null;
  }

  // Al elegir una batería se proponen los valores de su ficha; el usuario
  // puede cambiarlos y el cálculo usa siempre lo que se ve en pantalla.
  function aplicarValoresBateria() {
    const bat = bateriaSeleccionada();
    if (!bat) return;
    // Si la ficha no declara el dato, el campo queda vacío para que el usuario lo escriba.
    const dod = C.dodDeDiseno(bat);
    $('convDod').value = dod.valor !== null ? dod.valor : '';
    $('convEtaBat').value = typeof bat.eficienciaIdaVuelta === 'number' ? bat.eficienciaIdaVuelta : '';
    tensionBancoEditada = false;
    actualizarTensionBanco();
  }

  function actualizarTensionBanco() {
    const bat = bateriaSeleccionada();
    const vnom = Number($('convVnom').value);
    if (!bat || tensionBancoEditada || !(vnom > 0)) return;
    $('convVbanco').value = C.tensionBancoSugerida(vnom, bat);
  }

  // ---------------------------------------------------------------------
  // Datos heredados y rama
  // ---------------------------------------------------------------------
  function datosHeredados() {
    const r = estado.resultados;
    const g = estado.generador;
    if (!r || !g || !g.seleccion) return null;
    const s = g.seleccion;
    return {
      energiaDiariaKWh: r.energiaDiariaKWh,
      demandaMaximaW: r.demandaMaximaW,
      horaDemandaMaximaH: r.horaDemandaMaximaH,
      dentroKWh: g.coincidencia ? g.coincidencia.dentroKWh : null,
      fueraKWh: g.coincidencia ? g.coincidencia.fueraKWh : null,
      contexto: estado.proyecto ? estado.proyecto.contexto : null,
      horaInicioDia: estado.parametros.horaInicioDia,
      horaFinDia: estado.parametros.horaFinDia,
      generador: {
        modulo: s.modulo,
        modulosSerie: s.modulosSerie,
        cadenasParalelo: s.cadenasParalelo,
        tMinC: g.parametros.tMinC,
        tCeldaC: s.temperaturaCeldaC,
      },
      potenciaInstaladaW: s.potenciaInstaladaW,
      hspAnual: g.recurso.anual,
      hspCritico: g.recurso.mesCritico.valor,
      mesCritico: g.recurso.mesCritico.nombre,
      pr: g.pr,
      criterioRecurso: g.criterioRecurso,
    };
  }

  function renderizarHeredados(h) {
    if (!h) { $('convHeredados').innerHTML = ''; return; }
    const m = h.generador.modulo;
    const hh = n => String(n).padStart(2, '0') + ':00';
    $('convHeredados').innerHTML = tarjetas([
      ['Energía diaria, Ed', num(h.energiaDiariaKWh, 3) + ' kWh', h.dentroKWh !== null ? 'día ' + num(h.dentroKWh, 2) + ' · noche ' + num(h.fueraKWh, 2) + ' kWh' : ''],
      ['Demanda máxima', num(h.demandaMaximaW, 0) + ' W', 'a las ' + hh(h.horaDemandaMaximaH)],
      ['Generador', num(h.potenciaInstaladaW / 1000, 2) + ' kWp', h.generador.cadenasParalelo + (h.generador.cadenasParalelo === 1 ? ' cadena' : ' cadenas') + ' de ' + h.generador.modulosSerie + ' × ' + m.potenciaW + ' Wp'],
      ['Módulo', num(m.vocV, 1) + ' / ' + num(m.vmpV, 1) + ' V', 'Voc / Vmp · Isc ' + num(m.iscA, 1) + ' A · Imp ' + num(m.impA, 1) + ' A · β ' + num(m.coefVocPctC, 2) + ' %/°C'],
      ['Temperaturas', num(h.generador.tMinC, 0) + ' / ' + num(h.generador.tCeldaC, 1) + ' °C', 'mínima / celda en operación'],
      ['Recurso y desempeño', num(h.hspAnual, 2) + ' / ' + num(h.hspCritico, 2), 'HSP anual / mes crítico · PR ' + num(h.pr, 2)],
    ]);
  }

  function modoAutonomia() {
    const marcado = document.querySelector('input[name="modoAutonomia"]:checked');
    return marcado && marcado.value === 'noche' ? 'noche' : 'dias';
  }

  // Textos del campo de autonomía según lo que deben cubrir las baterías.
  function actualizarTextosAutonomia(h) {
    const noche = modoAutonomia() === 'noche';
    $('convEtiquetaAutonomia').textContent = noche ? 'Noches de autonomía, N' : 'Días de autonomía, N';
    $('convAyudaAutonomia').textContent = noche
      ? 'Son las noches seguidas que el banco cubre con la energía nocturna del perfil' + (h && h.fueraKWh !== null ? ' (' + num(h.fueraKWh, 2) + ' kWh por noche, de ' + String(h.horaFinDia).padStart(2, '0') + ':00 a ' + String(h.horaInicioDia).padStart(2, '0') + ':00)' : '') + '. Con 1 noche el banco solo pasa la noche; con más, también respalda días nublados.'
      : 'Son los días seguidos nublados que el sistema debe aguantar. Más días dan más respaldo, pero se necesitan más baterías.';
    Array.from(document.querySelectorAll('.opcion-autonomia')).forEach(op => op.classList.toggle('is-selected', op.querySelector('input').checked));
  }
  const unidadAutonomia = (n, modo) => num(n, n % 1 ? 1 : 0) + (modo === 'noche' ? (n === 1 ? ' noche' : ' noches') : (n === 1 ? ' día' : ' días'));

  function ramaActual() {
    const marcado = document.querySelector('input[name="ramaConv"]:checked');
    return marcado ? marcado.value : 'con';
  }

  function fijarRama(rama) {
    const radio = document.querySelector('input[name="ramaConv"][value="' + rama + '"]');
    if (radio) radio.checked = true;
    $('convEntradasCon').hidden = rama !== 'con';
    $('convEntradasSin').hidden = rama !== 'sin';
    $('convNumEquipo').textContent = rama === 'con' ? '4' : '3';
    $('convTituloEquipos').textContent = rama === 'con' ? '¿Qué regulador conecta los paneles a las baterías?' : '¿Qué inversor entrega la energía a la red?';
    $('convAyudaEquipos').textContent = rama === 'con'
      ? 'El regulador (controlador de carga MPPT) recibe la energía de los paneles y carga las baterías sin dañarlas. Abajo están los del catálogo con su resultado: la aplicación elige el que mejor se ajusta, y usted puede elegir otro.'
      : 'El inversor de red convierte la energía de los paneles en corriente alterna y la entrega a la instalación y a la red. Abajo están los del catálogo con su resultado: la aplicación elige el que mejor se ajusta, y usted puede elegir otro.';
    Array.from(document.querySelectorAll('.opcion-rama')).forEach(op => op.classList.toggle('is-selected', op.querySelector('input').checked));
  }

  function ramaInicialDesdeContexto() {
    const contexto = estado.proyecto ? estado.proyecto.contexto : null;
    if (!ramaElegidaPorUsuario) fijarRama(C.ramaPorContexto(contexto));
    const nombre = NOMBRES_CONTEXTO[contexto];
    const sugerida = C.ramaPorContexto(contexto);
    const opcion = { con: '«Sí, con baterías»', sin: '«No, conectado a la red»' };
    $('convNotaRama').textContent = nombre
      ? 'En el Paso 1 el sistema quedó como ' + nombre + ', por eso se marcó ' + opcion[sugerida] + '. ' +
        (ramaActual() !== sugerida ? 'Usted eligió la otra opción.' : 'Puede cambiarlo y todo se recalcula.')
      : '';
  }

  // ---------------------------------------------------------------------
  // Cálculo
  // ---------------------------------------------------------------------
  function leerEntradas(h) {
    const rama = ramaActual();
    const n = id => $(id).value === '' ? NaN : Number($(id).value);
    const comun = {
      rama,
      generador: h.generador,
      catalogo,
      energiaDiariaKWh: h.energiaDiariaKWh,
      demandaMaximaW: h.demandaMaximaW,
      hspAnual: h.hspAnual, hspCritico: h.hspCritico, pr: h.pr,
      criterioRecurso: h.criterioRecurso,
    };
    if (rama === 'con') {
      return Object.assign(comun, {
        etaInv: n('convEtaInvCon'),
        vNominalV: n('convVnom'),
        vBancoV: n('convVbanco'),
        autonomiaDias: n('convAutonomia'),
        modoAutonomia: modoAutonomia(),
        energiaNocheKWh: h.fueraKWh,
        dodPct: n('convDod'),
        fT: n('convFt'),
        etaBat: n('convEtaBat'),
        bateria: bateriaSeleccionada(),
        bateriasComparar: catalogo.baterias,
        equipoManualId: $('convRegulador').value || null,
      });
    }
    return Object.assign(comun, {
      rangoDcAc: [n('convDcAcMin'), n('convDcAcMax')],
      equipoManualId: $('convInversor').value || null,
    });
  }

  function calcular() {
    const h = datosHeredados();
    renderizarHeredados(h);
    $('avisoSinGenerador').hidden = !!h;
    ramaInicialDesdeContexto();
    actualizarTextosAutonomia(h);
    notaTemperatura(h);
    const ocultar = () => {
      estado.conversion = null;
      $('resultadosConv').hidden = true;
      $('convResumen').hidden = true;
      $('bloqueEquipos').hidden = true;
    };
    if (!h) {
      ocultar();
      mostrarEstado('estadoConv', '', '');
      return;
    }
    const faltante = datoFaltanteDeFicha();
    if (faltante) {
      ocultar();
      mostrarEstado('estadoConv', faltante, 'error');
      return;
    }
    try {
      const entradas = leerEntradas(h);
      const r = C.dimensionarConversion(entradas);
      estado.conversion = {
        resultado: r,
        entradas: resumenEntradas(entradas),
        heredados: h,
        ajuste: window.UIGenerador ? window.UIGenerador.obtenerAjusteConversion() : null,
        origenCatalogo: catalogo.origen,
        fecha: fechaLocalHoy(),
      };
      estado.conversion.supuestos = supuestos(estado.conversion);
      renderizar(estado.conversion);
      mostrarEstado('estadoConv', '', '');
    } catch (err) {
      ocultar();
      mostrarEstado('estadoConv', 'Revise los datos: ' + err.message, 'error');
    }
  }

  function datoFaltanteDeFicha() {
    if (ramaActual() !== 'con') return null;
    const bat = bateriaSeleccionada();
    if (!bat) return null;
    if ($('convDod').value === '' && typeof bat.dodDisenoPct !== 'number') {
      return 'La ficha de esta batería no fija un DoD de diseño: escríbalo en "Profundidad de descarga, DoD (%)". Valores de diseño usuales: 50 % para AGM y 80 % para LFP.';
    }
    if ($('convEtaBat').value === '' && typeof bat.eficienciaIdaVuelta !== 'number') {
      return 'La ficha de esta batería no declara la eficiencia de ida y vuelta: escríbala en "Eficiencia de la batería, η_bat". El RETIE exige al menos 0,75 en baterías de plomo.';
    }
    return null;
  }

  function resumenEntradas(e) {
    const copia = Object.assign({}, e);
    delete copia.catalogo; delete copia.generador; delete copia.bateriasComparar;
    return copia;
  }

  function notaTemperatura(h) {
    const nota = $('convNotaBateria');
    const bat = bateriaSeleccionada();
    const partes = [];
    const dod = bat ? C.dodDeDiseno(bat) : null;
    if (bat) partes.push('Desde la ficha de la batería: DoD ' + (bat.dodDisenoPct != null ? bat.dodDisenoPct + ' %' : 'no declarado' + (dod.origen === 'curso' ? ' (se propone ' + dod.valor + ' %, el valor de diseño usual para ' + bat.tecnologia + ')' : '')) + ', η ' + (bat.eficienciaIdaVuelta != null ? num(bat.eficienciaIdaVuelta, 2) : 'no declarada') +
      (bat.ciclosVida ? ', vida en ciclos ' + bat.ciclosVida.map(x => x.ciclos + ' al ' + x.dodPct + ' %').join(' · ') : '') + '. Puede cambiar los valores; el cálculo usa lo que se ve en pantalla.');
    if (h && h.generador.tMinC < 18) partes.push('La temperatura mínima del sitio es ' + h.generador.tMinC + ' °C, menor a 18 °C: use el factor de temperatura que indique la ficha de la batería.');
    else if (h) partes.push('Con temperatura mínima de 18 °C o más, fT = 1,0.');
    nota.textContent = partes.join(' ');
  }

  // ---------------------------------------------------------------------
  // Presentación de resultados
  // ---------------------------------------------------------------------
  const COLUMNAS = {
    regulador: [
      { titulo: 'Voc en frío', ids: ['voc'], u: 'V' },
      { titulo: 'Arranque', ids: ['arranque'], u: 'V' },
      { titulo: 'Ventana MPPT', ids: ['mpptMin', 'mpptMax'], u: 'V' },
      { titulo: 'Corriente al banco', ids: ['salida'], u: 'A' },
      { titulo: 'Isc por entrada', ids: ['isc'], u: 'A' },
    ],
    inversor: [
      { titulo: 'Voc en frío', ids: ['voc'], u: 'V' },
      { titulo: 'Ventana MPPT', ids: ['mpptMin', 'mpptMax'], u: 'V' },
      { titulo: 'Arranque', ids: ['arranque'], u: 'V' },
      { titulo: 'Imp por entrada', ids: ['imp'], u: 'A' },
      { titulo: 'Isc por entrada', ids: ['isc'], u: 'A' },
      { titulo: 'DC/AC', ids: ['dcac'], u: '' },
    ],
  };
  const PEOR = ['no_cumple', 'alerta', 'cumple', 'no_aplica'];

  function celda(v, col) {
    const crits = v.criterios.filter(c => col.ids.includes(c.id) && c.estado !== 'no_aplica');
    if (crits.length === 0) return '<td class="celda-no_aplica" title="La ficha no declara este dato">—<small>no declarado</small></td>';
    const peor = PEOR.find(e => crits.some(c => c.estado === e));
    let contenido;
    if (col.ids.length > 1) {
      const min = crits.find(c => c.id === 'mpptMin');
      const max = crits.find(c => c.id === 'mpptMax');
      const valores = [min, max].filter(Boolean).map(c => num(c.valor, 1));
      const limites = (min ? num(min.limite, 0) : '…') + '–' + (max ? num(max.limite, 0) : '…');
      contenido = valores.join(' / ') + ' V<small>ventana ' + limites + ' V</small>';
    } else {
      const c = crits[0];
      const val = col.u === '' ? num(c.valor, 2) : num(c.valor, 1) + ' ' + col.u;
      const lim = c.id === 'dcac'
        ? 'rango ' + num(c.limite[0], 2) + '–' + num(c.limite[1], 2)
        : (['arranque', 'mpptMin'].includes(c.id) ? '≥ ' : '≤ ') + num(c.limite, c.limite % 1 ? 1 : 0) + ' ' + col.u;
      contenido = val + '<small>' + lim + '</small>';
    }
    const titulo = crits.map(c => c.nombre + ': ' + c.texto).join(' · ');
    return '<td class="celda-' + peor + '" title="' + escapar(titulo) + '"><span class="icono-celda" aria-label="' + ETIQUETA[peor] + '">' + ICONO[peor] + '</span>' + contenido + '</td>';
  }

  function renderizarTablaEquipos(r) {
    const cols = COLUMNAS[r.tipoEquipo];
    $('convCabeceraEquipos').innerHTML = '<tr><th>Equipo</th>' + cols.map(c => '<th>' + c.titulo + '</th>').join('') + '<th>Veredicto</th></tr>';
    $('convCuerpoEquipos').innerHTML = r.verificaciones.map(v => {
      const eq = v.equipo;
      const elegido = r.seleccion && r.seleccion.equipo.id === eq.id;
      const fallas = v.criterios.filter(c => c.estado === 'no_cumple' || c.estado === 'alerta');
      let detalle = fallas.map(c => '<li class="txt-' + c.estado + '">' + escapar(c.nombre + ': ' + c.texto) + '</li>').join('');
      if (v.propuesta) {
        detalle += '<li class="propuesta">' + escapar(v.propuesta.posible
          ? 'Propuesta: ' + v.propuesta.np + (v.propuesta.np === 1 ? ' cadena' : ' cadenas') + ' de ' + v.propuesta.ns + ' (' + v.propuesta.total + ' módulos).'
          : v.propuesta.motivo) + '</li>';
      }
      const desc = eq.referenciaTdR ? '<small>caso de prueba</small>' : '<small>' + escapar(eq.fabricante) + '</small>';
      return '<tr class="' + (elegido ? 'is-selected' : '') + '"><td class="celda-equipo"><strong>' + escapar((v.unidades > 1 ? v.unidades + ' × ' : '') + eq.modelo) + '</strong>' + desc +
        (elegido ? '<span class="etiqueta-elegido">elegido</span>' : '') + '</td>' +
        cols.map(c => celda(v, c)).join('') +
        '<td class="celda-veredicto">' + chip(v.veredicto) + (detalle ? '<ul>' + detalle + '</ul>' : '') + '</td></tr>';
    }).join('');
  }

  // ---------------------------------------------------------------------
  // Vista sencilla: lo que el usuario necesita saber, en palabras simples
  // ---------------------------------------------------------------------
  const VEREDICTO_SENCILLO = { cumple: 'Funciona', alerta: 'Funciona con observaciones', no_cumple: 'No funciona con sus paneles', no_aplica: 'Sin dato' };

  function razonSencilla(c, tipo, unidades) {
    const cada = unidades > 1 ? 'Cada uno de los ' + unidades + ' reguladores recibe' : 'Sus paneles pueden mandar';
    const v1 = num(c.valor, 1);
    const lim = typeof c.limite === 'number' ? num(c.limite, c.limite % 1 ? 1 : 0) : '';
    switch (c.id) {
      case 'voc': return 'En días fríos sus paneles pueden llegar a ' + v1 + ' V y este equipo aguanta como máximo ' + lim + ' V: se dañaría.';
      case 'arranque': return 'Con calor sus paneles bajan a ' + v1 + ' V y el equipo necesita al menos ' + lim + ' V para ' + (tipo === 'regulador' ? 'empezar a cargar las baterías.' : 'arrancar.');
      case 'mpptMin': return 'Con calor sus paneles bajan a ' + v1 + ' V y el equipo necesita al menos ' + lim + ' V para trabajar.';
      case 'mpptMax': return 'En días fríos sus paneles trabajan a ' + v1 + ' V y el equipo admite hasta ' + lim + ' V.';
      case 'salida': return cada + ' ' + v1 + ' A y el equipo carga como máximo ' + lim + ' A: en las horas de más sol se pierde cerca del ' + num((1 - c.limite / c.valor) * 100, 0) + ' % de la energía.';
      case 'isc': return c.estado === 'no_aplica'
        ? 'La ficha no dice cuánta corriente de cortocircuito soporta: confírmelo con el fabricante.'
        : 'En un cortocircuito ' + (unidades > 1 ? 'el grupo de paneles de cada regulador da ' : 'sus paneles dan ') + v1 + ' A y el equipo soporta ' + lim + ' A.';
      case 'imp': return 'Sus paneles trabajan con ' + v1 + ' A por entrada y el equipo admite ' + lim + ' A.';
      case 'dcac': return c.valor > c.limite[1]
        ? 'El inversor es pequeño para sus paneles (relación ' + num(c.valor, 2) + ', se acepta hasta ' + num(c.limite[1], 2) + '): en las horas de más sol se pierde algo de energía.'
        : 'El inversor es más grande de lo necesario para sus paneles (relación ' + num(c.valor, 2) + ', se acepta desde ' + num(c.limite[0], 2) + ').';
      default: return c.texto;
    }
  }

  function razonesDe(v, tipo) {
    const lista = v.criterios.filter(c => c.estado === 'no_cumple' || c.estado === 'alerta' || (c.estado === 'no_aplica' && c.id === 'isc'))
      .sort((a, b) => PEOR.indexOf(a.estado) - PEOR.indexOf(b.estado));
    const razones = lista.map(c => ({ estado: c.estado === 'no_aplica' ? 'info' : c.estado, texto: razonSencilla(c, tipo, v.unidades) }));
    if (v.unidades > 1) {
      razones.unshift({ estado: 'paralelo', texto: 'Se necesitan ' + v.unidades + ' reguladores en paralelo cargando el mismo banco: los paneles se reparten en ' + v.unidades + ' grupos (' + v.grupos.join(' + ') + ' filas) y cada grupo va a su regulador. La ficha permite hasta ' + v.equipo.maxParalelo + ' unidades.' });
    }
    return razones;
  }

  function datosFicha(eq) {
    if (typeof eq.corrienteSalidaA === 'number') {
      return 'Aguanta hasta ' + eq.vocMaxV + ' V de los paneles · carga hasta ' + eq.corrienteSalidaA + ' A' + (typeof eq.mpptMinV === 'number' ? ' · trabaja desde ' + eq.mpptMinV + ' V' : '') +
        (typeof eq.maxParalelo === 'number' && eq.maxParalelo > 1 ? ' · hasta ' + eq.maxParalelo + ' en paralelo' : '');
    }
    return 'Potencia ' + num(eq.pacW, 0) + ' W · trabaja entre ' + eq.mpptMinV + ' y ' + eq.mpptMaxV + ' V · hasta ' + num(eq.impMaxA, 1) + ' A por entrada';
  }

  function tarjetaEquipo(v, r) {
    const eq = v.equipo;
    const elegido = r.seleccion && r.seleccion.equipo.id === eq.id;
    const razones = razonesDe(v, r.tipoEquipo);
    let acciones = '';
    if (elegido) {
      acciones = '<span class="etiqueta-elegido">Elegido</span>' +
        (r.modoSeleccion === 'manual' ? ' <button type="button" class="btn-enlace" data-auto="1">Volver a la elección automática</button>' : ' <small>elección automática</small>');
    } else if (v.veredicto !== 'no_cumple') {
      acciones = '<button type="button" class="btn btn-secondary btn-small" data-elegir="' + escapar(eq.id) + '">Elegir este equipo</button>';
    }
    if (v.veredicto === 'no_cumple' && v.propuesta && v.propuesta.posible) {
      const p = v.propuesta;
      acciones += '<button type="button" class="btn ' + (elegido ? 'btn-primary' : 'btn-secondary') + ' btn-small" data-elegir="' + escapar(eq.id) + '" data-serie="' + p.ns + '">Reorganizar mis paneles para este equipo</button>' +
        '<small>Quedarían ' + p.np + (p.np === 1 ? ' fila' : ' filas') + ' de ' + p.ns + ' paneles' + (p.adicionales > 0 ? ' (' + p.adicionales + ' panel(es) más para que todas las filas queden iguales)' : '') + '.</small>';
    } else if (v.veredicto === 'no_cumple' && v.propuesta) {
      acciones += '<small>' + escapar(v.propuesta.motivo) + '</small>';
    }
    return '<div class="tarjeta-equipo estado-' + v.veredicto + (elegido ? ' is-elegido' : '') + '">' +
      '<div class="te-cab"><div><strong>' + escapar((v.unidades > 1 ? v.unidades + ' × ' : '') + (eq.referenciaTdR ? eq.modelo : eq.fabricante + ' ' + eq.modelo)) + '</strong><small>' + escapar(datosFicha(eq)) + '</small></div>' +
      chip(v.veredicto, VEREDICTO_SENCILLO[v.veredicto]) + '</div>' +
      '<ul class="te-razones">' + (razones.length ? razones.map(x => '<li class="razon-' + x.estado + '">' + escapar(x.texto) + '</li>').join('') : '<li class="razon-cumple">Funciona con sus paneles sin observaciones.</li>') + '</ul>' +
      (acciones ? '<div class="te-acciones">' + acciones + '</div>' : '') + '</div>';
  }

  function renderizarTarjetasEquipos(r) {
    const orden = v => (r.seleccion && r.seleccion.equipo.id === v.equipo.id ? 0 : 1) * 10 + ['cumple', 'alerta', 'no_cumple'].indexOf(v.veredicto);
    const comerciales = r.verificaciones.filter(v => !v.equipo.referenciaTdR).sort((a, b) => orden(a) - orden(b));
    const referencia = r.verificaciones.filter(v => v.equipo.referenciaTdR).sort((a, b) => orden(a) - orden(b));
    $('convTarjetasEquipos').innerHTML = comerciales.length ? comerciales.map(v => tarjetaEquipo(v, r)).join('') : '<p class="nota-campos">El catálogo no tiene equipos comerciales de este tipo.</p>';
    $('convTarjetasReferencia').innerHTML = referencia.map(v => tarjetaEquipo(v, r)).join('');
    $('convGrupoReferencia').hidden = referencia.length === 0;
    $('convResumenReferencia').textContent = 'Equipos del caso de prueba (' + referencia.length + ')';
    if (r.seleccion && r.seleccion.equipo.referenciaTdR) $('convGrupoReferencia').open = true;
    const sel = r.tipoEquipo === 'regulador' ? $('convRegulador') : $('convInversor');
    $('convCriterio').innerHTML = r.modoSeleccion === 'automatica'
      ? (r.seleccion
        ? 'La aplicación eligió <strong>' + escapar(nombreConUnidades(r.seleccion)) + '</strong>' + (r.seleccion.unidades > 1 ? ' (en paralelo)' : '') + ' con este criterio: ' + escapar(r.criterioSeleccion.explicacion)
        : 'Ningún equipo comercial del catálogo funciona con estos paneles. Abajo verá qué falla en cada uno y, cuando se puede, cómo reorganizar los paneles para que funcione.')
      : 'Usted eligió el equipo. <button type="button" class="btn-enlace" data-auto="1">Volver a la elección automática</button>';
    Array.from(document.querySelectorAll('#bloqueEquipos [data-elegir]')).forEach(btn => btn.addEventListener('click', () => {
      sel.value = btn.dataset.elegir;
      if (btn.dataset.serie) {
        const ajuste = window.UIGenerador.obtenerAjusteConversion() || {};
        window.UIGenerador.aplicarAjusteConversion({ potenciaMinimaKWp: ajuste.potenciaMinimaKWp || null, modulosSerieFijo: Number(btn.dataset.serie) });
      } else {
        calcular();
      }
    }));
    Array.from(document.querySelectorAll('#bloqueEquipos [data-auto]')).forEach(btn => btn.addEventListener('click', () => { sel.value = ''; calcular(); }));
  }

  function aplicarAjusteDeCierre(bal) {
    const previo = window.UIGenerador.obtenerAjusteConversion() || {};
    window.UIGenerador.aplicarAjusteConversion({ potenciaMinimaKWp: bal.usado.potenciaRequeridaW / 1000, modulosSerieFijo: previo.modulosSerieFijo || null });
  }

  // Entre los equipos comerciales que no admiten los paneles como están, el que
  // funciona mejor si se reorganizan: primero los que no piden paneles
  // adicionales, luego los que quedan sin alertas y, en reguladores, el que menos recorta.
  function mejorReorganizacion(r) {
    const opciones = r.verificaciones.filter(v => !v.equipo.referenciaTdR && v.propuesta && v.propuesta.posible);
    if (!opciones.length) return null;
    return opciones.slice().sort((a, b) =>
      a.propuesta.adicionales - b.propuesta.adicionales ||
      (a.propuesta.verificacion.veredicto === 'cumple' ? 0 : 1) - (b.propuesta.verificacion.veredicto === 'cumple' ? 0 : 1) ||
      (b.equipo.corrienteSalidaA || 0) - (a.equipo.corrienteSalidaA || 0))[0];
  }

  function renderizarResumen(conv) {
    const r = conv.resultado;
    const h = conv.heredados;
    const g = h.generador;
    const items = [];
    let accionEquipo = '';
    const nPaneles = g.modulosSerie * g.cadenasParalelo;
    items.push({ estado: 'cumple', titulo: 'Paneles', texto: nPaneles + ' paneles de ' + g.modulo.potenciaW + ' W (' + num(r.potenciaGeneradorW / 1000, 2) + ' kWp), en ' + g.cadenasParalelo + (g.cadenasParalelo === 1 ? ' fila' : ' filas') + ' de ' + g.modulosSerie + '. Vienen del Paso 4.' +
      (conv.ajuste ? ' Ya incluyen los cambios hechos aquí.' : '') });
    const tipoNombre = r.tipoEquipo === 'regulador' ? 'Regulador' : 'Inversor';
    if (r.seleccion) {
      const razones = razonesDe(r.seleccion, r.tipoEquipo).filter(x => x.estado !== 'info');
      const enParalelo = r.seleccion.unidades > 1;
      const problema = razones.find(x => x.estado !== 'paralelo');
      items.push({ estado: r.seleccion.veredicto, titulo: enParalelo ? 'Reguladores' : tipoNombre,
        texto: (enParalelo ? r.seleccion.unidades + ' × ' + nombreEquipo(r.seleccion.equipo) + ' en paralelo, cada uno con un grupo de paneles (' + r.seleccion.grupos.join(' + ') + ' filas)' : nombreEquipo(r.seleccion.equipo)) +
          ': ' + (problema ? problema.texto : 'funciona' + (enParalelo ? 'n' : '') + ' con sus paneles.') });
    } else {
      const mejor = mejorReorganizacion(r);
      if (mejor) {
        const p = mejor.propuesta;
        items.push({ estado: 'no_cumple', titulo: tipoNombre, texto: 'Ningún equipo comercial funciona con los paneles como están. Solución sugerida: reorganizarlos en ' + p.np + (p.np === 1 ? ' fila' : ' filas') + ' de ' + p.ns +
          ' para usar ' + nombreEquipo(mejor.equipo) + (p.adicionales > 0 ? ' (con ' + p.adicionales + ' panel(es) más para igualar las filas)' : '') + '.' });
        accionEquipo = '<button type="button" class="btn btn-primary" id="btnReorganizarSugerido" data-elegir="' + escapar(mejor.equipo.id) + '" data-serie="' + p.ns + '">Reorganizar los paneles en ' + p.np + ' × ' + p.ns + '</button>';
      } else items.push({ estado: 'no_cumple', titulo: tipoNombre, texto: r.ningunoCumple
        ? 'Ningún equipo del catálogo funciona con estos paneles. Revise abajo las opciones para reorganizarlos, agregue un equipo al catálogo o reduzca el generador.'
        : 'Ningún equipo comercial funciona con estos paneles; revise abajo qué falla en cada uno y cómo reorganizar los paneles.' });
    }
    let accion = accionEquipo;
    if (r.rama === 'con') {
      const b = r.banco;
      const estadoBanco = r.tasas.carga.estado === 'no_cumple' || b.advertencias.length ? 'alerta' : 'cumple';
      items.push({ estado: estadoBanco, titulo: 'Baterías', texto: b.numeroBaterias + ' × ' + nombreEquipo(b.bateria) + ' = ' + num(b.kWhInstalados, 1) + ' kWh. ' +
        (b.modoAutonomia === 'noche' ? 'Cubren el consumo de ' + unidadAutonomia(b.autonomiaDias, 'noche') + ' (' + num(b.energiaNocheKWh, 2) + ' kWh por noche).' : 'Alcanzan para ' + unidadAutonomia(b.autonomiaDias, 'dias') + ' sin sol.') +
        (r.tasas.carga.estado === 'no_cumple' ? ' Ojo: la corriente de carga es alta para estas baterías.' : '') + (b.advertencias.length ? ' ' + b.advertencias[0] : '') });
      const bal = r.balance;
      if (bal.hayDeficit) {
        const n = bal.usado.modulosAdicionales;
        items.push({ estado: 'no_cumple', titulo: '¿Alcanza la energía?', texto: 'No. Las baterías y el inversor pierden una parte de la energía; para cubrir el consumo ' + (n === 1 ? 'falta 1 panel' : 'faltan ' + n + ' paneles') + '.' });
        accion = '<button type="button" class="btn btn-primary" id="btnAplicarAjuste">Agregar ' + (n === 1 ? '1 panel' : n + ' paneles') + ' al generador</button>';
      } else if (!r.recuperacion.seRecupera) {
        items.push({ estado: 'alerta', titulo: '¿Alcanza la energía?', texto: 'Cubre el consumo, pero si el banco se descarga del todo, las baterías no se vuelven a llenar.' });
      } else {
        items.push({ estado: 'cumple', titulo: '¿Alcanza la energía?', texto: 'Sí, con ' + num(bal.usado.margenPct, 0) + ' % de margen. Si el banco se descarga del todo (' + unidadAutonomia(b.autonomiaDias, b.modoAutonomia) + (b.modoAutonomia === 'noche' ? ' sin recargar' : ' sin sol') + '), las baterías se recargan en unos ' + num(r.recuperacion.dias, 1) + ' días.' });
      }
    } else if (r.seleccion) {
      const c = r.seleccion.criterios.find(x => x.id === 'dcac');
      items.push({ estado: c.estado, titulo: 'Tamaño del inversor', texto: c.estado === 'cumple' ? 'Adecuado para sus paneles (relación DC/AC ' + num(c.valor, 2) + ').' : razonSencilla(c, 'inversor') });
    }
    if (conv.ajuste) accion += '<button type="button" class="btn btn-secondary" id="btnQuitarAjusteConv">Deshacer los cambios en los paneles</button>';

    const problemas = items.filter(x => x.estado === 'no_cumple').length;
    const alertas = items.filter(x => x.estado === 'alerta').length;
    const general = problemas ? 'no_cumple' : alertas ? 'alerta' : 'cumple';
    const titulo = problemas ? 'Hay ' + (problemas === 1 ? 'un punto' : problemas + ' puntos') + ' por resolver'
      : alertas ? 'El sistema funciona, con observaciones' : 'El sistema funciona';
    const caja = $('convResumen');
    caja.className = 'resumen-sistema estado-' + general;
    caja.innerHTML = '<div class="resumen-cab"><span class="resumen-icono">' + ICONO[general] + '</span><div><strong>' + titulo + '</strong><span>Así queda su sistema con los datos de abajo. Se actualiza al cambiar cualquier respuesta.</span></div></div>' +
      '<ul class="resumen-lista">' + items.map(x => '<li class="estado-' + x.estado + '"><span class="resumen-item-icono">' + ICONO[x.estado] + '</span><div><strong>' + escapar(x.titulo) + '</strong><span>' + escapar(x.texto) + '</span></div></li>').join('') + '</ul>' +
      (accion ? '<div class="resumen-acciones">' + accion + '</div>' : '');
    caja.hidden = false;
    const btn = $('btnAplicarAjuste');
    if (btn) btn.addEventListener('click', () => aplicarAjusteDeCierre(r.balance));
    const reorganizar = $('btnReorganizarSugerido');
    if (reorganizar) reorganizar.addEventListener('click', () => {
      (r.tipoEquipo === 'regulador' ? $('convRegulador') : $('convInversor')).value = '';
      const ajuste = window.UIGenerador.obtenerAjusteConversion() || {};
      window.UIGenerador.aplicarAjusteConversion({ potenciaMinimaKWp: ajuste.potenciaMinimaKWp || null, modulosSerieFijo: Number(reorganizar.dataset.serie) });
    });
    const quitar = $('btnQuitarAjusteConv');
    if (quitar) quitar.addEventListener('click', () => window.UIGenerador.aplicarAjusteConversion(null));
  }

  function renderizarBancoSimple(r) {
    const b = r.banco;
    $('convBancoSimple').innerHTML = tarjetas([
      ['Baterías necesarias', b.numeroBaterias + ' × ' + escapar(b.bateria.tecnologia), escapar(nombreEquipo(b.bateria)) + ' · ' + b.ns + ' en serie × ' + b.np + (b.np === 1 ? ' grupo' : ' grupos') + ' en paralelo'],
      ['Energía guardada', num(b.kWhInstalados, 1) + ' kWh', (b.modoAutonomia === 'noche' ? 'cubre ' + unidadAutonomia(b.autonomiaDias, 'noche') : 'alcanza para ' + unidadAutonomia(b.autonomiaDias, 'dias') + ' sin sol') + ' usando hasta el ' + pct(b.dodFin, 0) + ' del banco'],
      [b.modoAutonomia === 'noche' ? 'Uso en una noche normal' : 'Uso en un día normal', pct(b.dodDiarioReal, 0), 'de la energía del banco se usa ' + (b.modoAutonomia === 'noche' ? 'cada noche' : 'cada día')],
    ]);
  }

  function renderizarVeredicto(r) {
    const caja = $('convVeredicto');
    if (!r.seleccion) {
      caja.innerHTML = '<div class="veredicto-cabecera">' + chip('no_cumple', 'Sin equipo') + '<div><strong>No hay un equipo seleccionado.</strong><span>' +
        escapar(r.ningunoCumple ? 'Ningún equipo del catálogo admite este generador.' : 'Elija uno de la lista de arriba.') + '</span></div></div>';
      caja.className = 'veredicto-equipo veredicto-no_cumple';
      return;
    }
    const v = r.seleccion;
    const eq = v.equipo;
    const datos = [];
    if (r.tipoEquipo === 'regulador') {
      if (v.unidades > 1) {
        datos.push(['Reguladores en paralelo', String(v.unidades), 'grupos de ' + v.grupos.join(' + ') + ' cadenas · la ficha permite hasta ' + v.equipo.maxParalelo]);
        datos.push(['Corriente por regulador', num(v.corrienteBancoA, 1) + ' A', 'total al banco ' + num(v.corrienteBancoTotalA, 1) + ' A = Ppico / Vnominal']);
      } else {
        datos.push(['Corriente al banco', num(v.corrienteBancoA, 1) + ' A', 'Ppico / Vnominal = ' + num(r.potenciaGeneradorW, 0) + ' W / ' + num(estado.conversion.entradas.vNominalV, 0) + ' V']);
      }
    } else {
      datos.push(['Relación DC/AC', num(v.relacionDcAc, 2), 'Ppico / Pac = ' + num(r.potenciaGeneradorW, 0) + ' / ' + num(eq.pacW, 0) + ' W']);
    }
    datos.push(['Módulos en serie', 'de ' + v.limites.minSerie + ' a ' + v.limites.maxSerie, 'el generador usa ' + r.arreglo.ns]);
    datos.push(['Corriente de conductores', num(r.corrienteConductoresA, 1) + ' A', '1,25 × Isc del generador (NTC 2050, 690-8); no se usa para el equipo']);
    caja.className = 'veredicto-equipo veredicto-' + v.veredicto;
    caja.innerHTML = '<div class="veredicto-cabecera">' + chip(v.veredicto) +
      '<div><strong>' + escapar((r.tipoEquipo === 'regulador' ? (v.unidades > 1 ? 'Reguladores ' : 'Regulador ') : 'Inversor ') + nombreConUnidades(v)) + '</strong>' +
      '<span>' + escapar(r.modoSeleccion === 'automatica' ? 'Elegido automáticamente' : 'Elegido de forma manual') +
      (v.veredicto === 'cumple' ? ' · admite el generador sin observaciones.' : v.veredicto === 'alerta' ? ' · admite el generador con observaciones.' : ' · no admite el generador; vea qué falla en la tabla.') + '</span></div></div>' +
      '<div class="indicadores indicadores-compactos">' + tarjetas(datos) + '</div>' +
      (eq.fuente ? '<p class="fuente-equipo">Ficha: ' + escapar(eq.fuente) + (eq.fechaConsulta ? ' (consulta ' + escapar(eq.fechaConsulta) + ')' : '') + '</p>' : '');
  }

  function renderizarBanco(r) {
    const b = r.banco;
    $('convBanco').innerHTML = tarjetas([
      b.modoAutonomia === 'noche'
        ? ['Energía nocturna en CC', num(b.eccBancoWh, 0) + ' Wh', 'Ecc_noche = E_noche / η_inv']
        : ['Energía diaria en CC', num(b.eccWh, 0) + ' Wh', 'Ecc = Ed / η_inv'],
      ['Capacidad nominal', num(b.cnAh, 1) + ' Ah', num(b.cnWh / 1000, 2) + ' kWh · Cn = ' + (b.modoAutonomia === 'noche' ? 'Ecc_noche' : 'Ecc') + '·N / (DoD·fT)'],
      ['Configuración', b.ns + 'S × ' + b.np + 'P', b.numeroBaterias + (b.numeroBaterias === 1 ? ' batería' : ' baterías') + ' de ' + num(b.bateria.tensionV, 1) + ' V / ' + num(b.bateria.capacidadAh, b.bateria.capacidadAh % 1 ? 2 : 0) + ' Ah'],
      ['Instalado', num(b.ahInstalados, 0) + ' Ah', num(b.kWhInstalados, 2) + ' kWh a ' + num(b.vBancoV, 1) + ' V'],
      ['DoD al final de la autonomía', pct(b.dodFin), 'diseño ' + num(b.dodPct, 0) + ' %'],
      ['DoD diario', pct(b.dodDiarioReal), 'diseño ' + pct(b.dodDiarioDiseno) + ' (DoD / N)'],
    ]);
    const maxDibujo = 48;
    const total = b.numeroBaterias;
    let ramas = '';
    if (total <= maxDibujo) {
      for (let p = 0; p < b.np; p++) {
        let fila = '';
        for (let s = 0; s < b.ns; s++) fila += '<span class="bateria-celda">' + num(b.bateria.tensionV, 1).replace(',0', '') + ' V</span>';
        ramas += '<div class="rama-bateria">' + fila + '</div>';
      }
    }
    $('convEsquema').innerHTML = total <= maxDibujo
      ? '<div class="esquema-titulo">' + b.np + (b.np === 1 ? ' rama' : ' ramas') + ' en paralelo de ' + b.ns + (b.ns === 1 ? ' batería' : ' baterías') + ' en serie</div><div class="esquema-ramas">' + ramas + '</div>'
      : '<div class="esquema-titulo">' + b.np + ' ramas en paralelo de ' + b.ns + ' baterías en serie (' + total + ' baterías)</div>';
  }

  function renderizarBalance(r) {
    const bal = r.balance;
    const e = estado.conversion.entradas;
    const columna = (titulo, x, usado) => {
      const ok = x.margenW >= -1e-9;
      return '<div class="balance-col ' + (usado ? 'is-usado' : '') + '">' +
        '<div class="balance-titulo">' + titulo + (usado ? ' <small>criterio del Paso 4</small>' : '') + '</div>' +
        '<div class="balance-fila"><span>HSP</span><strong>' + num(x.hsp, 2) + '</strong></div>' +
        '<div class="balance-fila"><span>Potencia requerida</span><strong>' + num(x.potenciaRequeridaW, 0) + ' W</strong></div>' +
        '<div class="balance-fila"><span>Potencia instalada</span><strong>' + num(bal.potenciaInstaladaW, 0) + ' W</strong></div>' +
        '<div class="balance-fila"><span>' + (ok ? 'Margen' : 'Déficit') + '</span><strong class="' + (ok ? 'txt-cumple' : 'txt-no_cumple') + '">' + (ok ? '+' : '−') + num(Math.abs(x.margenPct), 1) + ' %</strong></div>' +
        '<div class="balance-fila"><span>Módulos adicionales</span><strong>' + x.modulosAdicionales + '</strong></div></div>';
    };
    const modulo = estado.conversion.heredados.generador.modulo;
    const explicacion = (bal.modoAutonomia === 'noche'
      ? 'La energía de la noche pierde una parte al pasar por la batería (eficiencia ' + num(e.etaBat * 100, 0) + ' %) y toda pasa por el inversor (' + num(e.etaInv * 100, 0) + ' %). '
      : 'Parte de la energía se pierde al pasar por la batería (eficiencia ' + num(e.etaBat * 100, 0) + ' %) y por el inversor (' + num(e.etaInv * 100, 0) + ' %). ') +
      'Con esas pérdidas, los paneles deben sumar ' + num(bal.usado.potenciaRequeridaW, 0) + ' W y hoy suman ' + num(bal.potenciaInstaladaW, 0) + ' W.';
    let mensaje;
    if (bal.hayDeficit) {
      const n = bal.usado.modulosAdicionales;
      mensaje = '<div class="balance-mensaje balance-deficit"><div><strong>No alcanza: ' + (n === 1 ? 'falta 1 panel' : 'faltan ' + n + ' paneles') + ' de ' + modulo.potenciaW + ' W.</strong> ' + explicacion +
        ' Si agrega los paneles, el Paso 4 se recalcula solo.</div><button type="button" class="btn btn-primary btn-small" data-ajuste-cierre="1">Agregar ' + (n === 1 ? '1 panel' : n + ' paneles') + '</button></div>';
    } else {
      mensaje = '<div class="balance-mensaje balance-ok"><div><strong>Sí alcanza, con ' + num(bal.usado.margenPct, 1) + ' % de margen.</strong> ' + explicacion +
        (r.recuperacion.seRecupera ? ' Si el banco se descarga del todo, las baterías se recargan en unos ' + num(r.recuperacion.dias, 1) + ' días.' : ' Pero si el banco se descarga del todo, las baterías no se vuelven a llenar.') + '</div></div>';
    }
    $('convBalance').innerHTML = mensaje;
    const btn = $('convBalance').querySelector('[data-ajuste-cierre]');
    if (btn) btn.addEventListener('click', () => aplicarAjusteDeCierre(bal));
    $('convBalanceCols').innerHTML = columna('Promedio anual', bal.anual, bal.criterioRecurso === 'anual') +
      columna('Mes crítico', bal.critico, bal.criterioRecurso !== 'anual');
    $('convBalanceFormula').textContent = bal.modoAutonomia === 'noche'
      ? 'Egen = E_día / η_inv + E_noche / (η_inv · η_bat) = ' + num(bal.egenWh, 0) + ' Wh/día; Preq = Egen / (HSP · PR).'
      : 'Egen = Ecc / η_bat = ' + num(bal.eccWh, 0) + ' / ' + num(e.etaBat, 2) + ' = ' + num(bal.egenWh, 0) + ' Wh/día; Preq = Egen / (HSP · PR).';
  }

  function renderizarTasas(r) {
    const t = r.tasas;
    const rec = r.recuperacion;
    const lim = x => x.limite !== null ? (x.estado === 'cumple' ? '≤ ' : '> ') + num(x.limite, 2) + ' C de la ficha' : 'la ficha no declara límite';
    $('convTasas').innerHTML = tarjetas([
      ['Corriente de carga', num(t.corrienteCargaA, 1) + ' A', 'tasa ' + num(t.tasaCarga, 3) + ' C ' + chip(t.carga.estado, lim(t.carga)), 'card-' + t.carga.estado],
      ['Corriente de descarga', num(t.corrienteDescargaA, 1) + ' A', 'tasa ' + num(t.tasaDescarga, 3) + ' C · demanda máxima / (η_inv · Vnominal)' + (t.descarga.limite !== null ? ' ' + chip(t.descarga.estado, lim(t.descarga)) : ''), t.descarga.limite !== null ? 'card-' + t.descarga.estado : ''],
      ['Recuperación del banco', rec.seRecupera ? num(rec.dias, 1) + ' días' : 'No se recupera',
        rec.seRecupera
          ? (r.banco.modoAutonomia === 'noche' ? 'trec = N·Ecc_noche / ((Eprod − Egen)·η_bat)' : 'trec = N·Ecc / (Eprod·η_bat − Ecc)') + ', Eprod = ' + num(rec.eProdWh, 0) + ' Wh/día'
          : 'Eprod (' + num(rec.eProdWh, 0) + ' Wh) no supera Egen (' + num(rec.egenWh, 0) + ' Wh): el generador no repone el banco',
        rec.seRecupera ? 'card-cumple' : 'card-no_cumple'],
    ]);
  }

  function renderizarTecnologias(r) {
    const elegida = r.banco.bateria.id;
    const conDatos = r.comparacion.filter(c => !c.error && c.kWhPorAnio !== null);
    const mejor = conDatos.length ? conDatos.slice().sort((a, b) => a.kWhPorAnio - b.kWhPorAnio)[0].bateria.id : null;
    $('convCuerpoTecnologias').innerHTML = r.comparacion.map(c => {
      const nombre = '<strong>' + escapar(c.bateria.tecnologia) + '</strong> ' + escapar(nombreEquipo(c.bateria)) + (c.bateria.id === elegida ? ' <span class="etiqueta-elegido">elegida</span>' : '');
      if (c.error) return '<tr><td>' + nombre + '</td><td colspan="7">' + escapar(c.error) + '</td></tr>';
      const b = c.banco;
      const notas = [];
      if (c.origenDod === 'curso') notas.push('DoD ' + b.dodPct + ' %, valor de diseño usual');
      if (c.delFormulario && c.delFormulario.length) notas.push(c.delFormulario.join(' y ') + ' del formulario');
      const nota = notas.length ? '<small class="nota-tabla">' + notas.join(' · ') + ' (la ficha no lo declara)</small>' : '';
      return '<tr class="' + (c.bateria.id === elegida ? 'is-selected' : '') + '"><td>' + nombre + nota + '</td>' +
        '<td>' + num(b.vBancoV, 1) + ' V · ' + b.ns + 'S × ' + b.np + 'P</td><td>' + b.numeroBaterias + '</td>' +
        '<td>' + num(b.kWhInstalados, 2) + '</td><td>' + pct(b.dodFin) + '</td>' +
        '<td>' + num(c.tasas.tasaCarga, 3) + ' C ' + chip(c.tasas.carga.estado, c.tasas.carga.limite !== null ? '≤ ' + num(c.tasas.carga.limite, 2) + ' C' : '—') + '</td>' +
        '<td>' + (c.vidaAnios !== null ? c.vidaAnios + ' años' : 'no declarada' + (c.bateria.ciclosVida ? '<small class="nota-tabla">' + c.bateria.ciclosVida.map(x => x.ciclos + ' ciclos al ' + x.dodPct + ' %').join(', ') + '</small>' : '')) + '</td>' +
        '<td>' + (c.kWhPorAnio !== null ? '<strong>' + num(c.kWhPorAnio, 2) + '</strong>' + (c.bateria.id === mejor && conDatos.length > 1 ? ' <span class="etiqueta-mejor">menor</span>' : '') : '—') + '</td></tr>';
    }).join('');
  }

  function renderizarSensibilidad(r) {
    const actual = r.banco.autonomiaDias;
    const modo = r.banco.modoAutonomia;
    $('convTituloSensibilidad').textContent = modo === 'noche' ? 'Sensibilidad a las noches de autonomía' : 'Sensibilidad a la autonomía';
    $('convCuerpoSensibilidad').innerHTML = r.sensibilidad.map(x => {
      if (x.error) return '<tr><td>' + unidadAutonomia(x.autonomiaDias, modo) + '</td><td colspan="6">' + escapar(x.error) + '</td></tr>';
      const b = x.banco;
      const es = x.autonomiaDias === actual;
      return '<tr class="' + (es ? 'is-selected' : '') + '"><td>' + unidadAutonomia(x.autonomiaDias, modo) + (es ? ' <span class="etiqueta-elegido">actual</span>' : '') + '</td>' +
        '<td>' + num(b.cnAh, 1) + ' Ah</td><td>' + b.ns + 'S × ' + b.np + 'P</td><td>' + b.numeroBaterias + '</td>' +
        '<td>' + num(b.kWhInstalados, 2) + '</td><td>' + pct(b.dodFin) + '</td><td>' + pct(b.dodDiarioReal) + '</td></tr>';
    }).join('');
  }

  function renderizarDcAc(r) {
    const v = r.seleccion;
    if (!v) { $('convDcAc').innerHTML = ''; return; }
    const rango = v.rangoDcAc;
    const escalaMax = Math.max(2, v.relacionDcAc * 1.15, rango[1] * 1.3);
    const x = val => Math.min(100, Math.max(0, (val / escalaMax) * 100));
    const estadoDcAc = v.criterios.find(c => c.id === 'dcac');
    $('convDcAc').innerHTML =
      '<div class="medidor-barra"><div class="medidor-rango" style="left:' + x(rango[0]) + '%;width:' + (x(rango[1]) - x(rango[0])) + '%"></div>' +
      '<div class="medidor-marca medidor-' + estadoDcAc.estado + '" style="left:' + x(v.relacionDcAc) + '%"><span>' + num(v.relacionDcAc, 2) + '</span></div></div>' +
      '<div class="medidor-escala"><span>0</span><span>' + num(escalaMax, 1) + '</span></div>' +
      '<p>' + chip(estadoDcAc.estado, VEREDICTO_SENCILLO[estadoDcAc.estado]) + ' ' + escapar(estadoDcAc.estado === 'cumple'
        ? 'La potencia de los paneles es ' + num(v.relacionDcAc, 2) + ' veces la del inversor, dentro del rango aceptado (' + num(rango[0], 2) + ' a ' + num(rango[1], 2) + ').'
        : razonSencilla(estadoDcAc, 'inversor')) + '</p>';
  }

  function renderizar(conv) {
    const r = conv.resultado;
    const avisos = r.advertencias.slice();
    $('convAvisos').innerHTML = avisos.length ? '<strong>Advertencias:</strong><ul>' + avisos.map(a => '<li>' + escapar(a) + '</li>').join('') + '</ul>' : '';
    $('convAvisos').hidden = avisos.length === 0;
    renderizarResumen(conv);
    renderizarTarjetasEquipos(r);
    renderizarVeredicto(r);
    renderizarTablaEquipos(r);
    $('convResultadosBanco').hidden = r.rama !== 'con';
    $('convTecnicoBanco').hidden = r.rama !== 'con';
    $('convResultadosInversor').hidden = r.rama !== 'sin';
    if (r.rama === 'con') {
      renderizarBancoSimple(r);
      renderizarBanco(r);
      renderizarBalance(r);
      renderizarTasas(r);
      renderizarTecnologias(r);
      renderizarSensibilidad(r);
    } else {
      renderizarDcAc(r);
    }
    $('convSupuestos').innerHTML = conv.supuestos.map(s => '<li>' + escapar(s) + '</li>').join('');
    $('resultadosConv').hidden = false;
    $('bloqueEquipos').hidden = false;
  }

  // Cargas que arrancan con un motor (corriente de arranque mayor que la nominal).
  function cargasConMotor() {
    const app = window.__estadoAppReto01;
    const cargas = app && app.listaCargas ? app.listaCargas : [];
    return cargas.filter(c => /bomba|motor|compresor|aire acondicionado|nevera|congelador|refrigera|lavadora|licuadora|ventilador/i.test(c.descripcion));
  }

  function supuestos(conv) {
    const r = conv.resultado;
    const e = conv.entradas;
    const a = r.arreglo;
    const lista = [
      'Rama: ' + C.RAMAS[r.rama].nombre.toLowerCase() + '. ' + C.RAMAS[r.rama].descripcion,
      'Voc en frío = Voc · [1 + |β| · (25 − Tmin)] = ' + num(a.modulo.vocFrio, 2) + ' V por módulo; ' + a.ns + ' en serie dan ' + num(a.vocFrioV, 1) + ' V. Máximo de módulos en serie = parte entera de (Voc máxima del equipo / Voc en frío del módulo).',
      'Vmp en caliente = Vmp · [1 − |β| · (Tc − 25)] = ' + num(a.modulo.vmpCaliente, 2) + ' V por módulo (' + num(a.vmpCalienteV, 1) + ' V la cadena); Vmp en frío = ' + num(a.modulo.vmpFrio, 2) + ' V (' + num(a.vmpFrioV, 1) + ' V la cadena). Se usa el β de Voc, como en el Paso 4.',
      'La corriente de diseño de conductores (1,25 × Isc = ' + num(r.corrienteConductoresA, 1) + ' A, NTC 2050 art. 690-8) se muestra aparte y no se usa para verificar el equipo.',
    ];
    if (r.rama === 'con') {
      const b = r.banco;
      lista.push(
        'Corriente de salida al banco = Ppico / Vnominal = ' + num(r.potenciaGeneradorW, 0) + ' / ' + num(e.vNominalV, 0) + ' = ' + num(r.potenciaGeneradorW / e.vNominalV, 1) + ' A, sin el factor 1,25. Si supera la corriente del regulador, el equipo limita la carga y recorta potencia: se marca como alerta.',
        'Reguladores en paralelo: si la ficha del regulador permite varias unidades sobre el mismo banco (maxParalelo), las cadenas se reparten en k grupos y cada grupo va a su regulador. Se usa el menor k con el que cada unidad cumple: la corriente al banco y el Isc se revisan con el grupo más grande; las tensiones no cambian porque todas las cadenas son iguales.' +
          (r.seleccion && r.seleccion.unidades > 1 ? ' Para este generador: ' + r.seleccion.unidades + ' × ' + nombreEquipo(r.seleccion.equipo) + ', grupos de ' + r.seleccion.grupos.join(' + ') + ' cadenas, ' + num(r.seleccion.corrienteBancoA, 1) + ' A por regulador.' : ''),
        'Arranque del regulador: la tensión Vmp en caliente debe superar la del banco en 5 V (' + num(e.vBancoV + C.MARGEN_ARRANQUE_V, 1) + ' V).',
        'Todas las cargas se alimentan en CA a través del inversor: Ecc = Ed / η_inv = ' + num(e.energiaDiariaKWh * 1000, 0) + ' / ' + num(e.etaInv, 2) + ' = ' + num(b.eccWh, 1) + ' Wh/día.',
        b.modoAutonomia === 'noche'
          ? 'Autonomía por consumo nocturno (método propio): el banco cubre la energía de las horas fuera de la ventana solar del Paso 3, E_noche = ' + num(b.energiaNocheKWh, 3) + ' kWh, durante N = ' + num(e.autonomiaDias, 1) + ' noche(s). Ecc_noche = E_noche / η_inv = ' + num(b.eccBancoWh, 1) + ' Wh; Cn[Wh] = Ecc_noche · N / (DoD · fT) = ' + num(b.eccBancoWh, 1) + ' · ' + num(e.autonomiaDias, 1) + ' / (' + num(e.dodPct / 100, 2) + ' · ' + num(e.fT, 2) + ') = ' + num(b.cnWh, 0) + ' Wh; Cn[Ah] = Cn[Wh] / Vbanco = ' + num(b.cnAh, 1) + ' Ah. De día los paneles alimentan las cargas directamente.'
          : 'Cn[Wh] = Ecc · N / (DoD · fT) = ' + num(b.eccWh, 1) + ' · ' + num(e.autonomiaDias, 1) + ' / (' + num(e.dodPct / 100, 2) + ' · ' + num(e.fT, 2) + ') = ' + num(b.cnWh, 0) + ' Wh; Cn[Ah] = Cn[Wh] / Vbanco = ' + num(b.cnAh, 1) + ' Ah.',
        'Ns = Vbanco / Vunidad = ' + num(e.vBancoV, 1) + ' / ' + num(b.bateria.tensionV, 1) + ' = ' + b.ns + '; Np = ⌈Cn[Ah] / Cunidad⌉ = ⌈' + num(b.cnAh, 1) + ' / ' + num(b.bateria.capacidadAh, b.bateria.capacidadAh % 1 ? 2 : 0) + '⌉ = ' + b.np + ' (siempre hacia arriba). ' +
        'DoD al final de la autonomía = Ecc · N / E instalada = ' + pct(b.dodFin) + '. DoD diario de diseño = DoD / N = ' + pct(b.dodDiarioDiseno) + '; con el banco instalado, Ecc / E instalada = ' + pct(b.dodDiarioReal) + '. Tasa C de carga = (Ppico / Vnominal) / Ah instalados; de descarga = demanda máxima / (η_inv · Vnominal) / Ah instalados.',
        (b.modoAutonomia === 'noche' ? 'Balance de cierre: solo la energía nocturna pasa por la batería, Egen = E_día / η_inv + E_noche / (η_inv · η_bat); Preq = Egen / (HSP · PR),' : 'Balance de cierre: Egen = Ecc / η_bat; Preq = Egen / (HSP · PR),') + ' con la HSP anual y la del mes crítico. Si se acepta el ajuste, el Paso 4 dimensiona el generador con la potencia requerida según su criterio (' + (r.balance.criterioRecurso === 'anual' ? 'promedio anual' : 'mes crítico') + ').',
        (b.modoAutonomia === 'noche'
          ? 'Recuperación: trec = N · Ecc_noche / ((Eprod − Egen) · η_bat), con Eprod = Ppico · HSP anual · PR: lo que sobra cada día después de cubrir el consumo llega al banco con η_bat. Con autonomía por días esta fórmula es la misma del curso.'
          : 'Recuperación: trec = N · Ecc / (Eprod · η_bat − Ecc), con Eprod = Ppico · HSP anual · PR.') + ' Si el denominador es cero o negativo, el banco no se recupera con ese generador.',
        'Comparación de tecnologías: energía nominal instalada dividida por la vida de diseño de la ficha (kWh por año de servicio). No incluye costos.',
        'Batería: ' + nombreEquipo(b.bateria) + '. Ficha: ' + (b.bateria.fuente || 'no declarada') + (b.bateria.fechaConsulta ? ' (consulta ' + b.bateria.fechaConsulta + ')' : '') + '.'
      );
    } else {
      lista.push('Relación DC/AC = Ppico / Pac, con rango aceptado de ' + num(e.rangoDcAc[0], 2) + ' a ' + num(e.rangoDcAc[1], 2) + ' (PVWatts propone 1,2).',
        'Corrientes por entrada: Imp e Isc del generador repartidas entre las entradas MPPT del inversor, con cadenas completas en cada entrada.');
    }
    const motores = cargasConMotor();
    const conMotor = motores.length ? ' Cargas con motor en este proyecto: ' + motores.map(c => c.descripcion + ' (' + num(c.potenciaTotalW, 0) + ' W)').join(', ') + '.' : '';
    if (r.rama === 'sin') {
      lista.push('Arranque de bombas y motores: el inversor de red sigue la tensión y la frecuencia de la red y solo inyecta la energía de los paneles; la corriente de arranque de las cargas la entrega la red, por eso no se usa para elegir este inversor. Si la red falla, el inversor se apaga por protección antiisla y no alimenta las cargas.' + conMotor);
    } else {
      lista.push('Arranque de bombas y motores: el inversor de baterías que alimenta las cargas forma la red y debe soportar el arranque de la carga mayor con las demás funcionando; ese inversor no se dimensiona en este paso, así que en su ficha debe verificarse la potencia de sobrecarga frente a la demanda máxima más el arranque.' + conMotor);
    }
    if (r.seleccion) lista.push('Equipo: ' + nombreEquipo(r.seleccion.equipo) + '. Ficha: ' + (r.seleccion.equipo.fuente || 'no declarada') + (r.seleccion.equipo.fechaConsulta ? ' (consulta ' + r.seleccion.equipo.fechaConsulta + ')' : '') + '.');
    return lista;
  }

  // ---------------------------------------------------------------------
  // Eventos
  // ---------------------------------------------------------------------
  Array.from(document.querySelectorAll('input[name="ramaConv"]')).forEach(radio => {
    radio.addEventListener('change', () => {
      ramaElegidaPorUsuario = true;
      fijarRama(ramaActual());
      calcular();
    });
  });
  $('convBateria').addEventListener('change', () => { aplicarValoresBateria(); calcular(); });
  Array.from(document.querySelectorAll('input[name="modoAutonomia"]')).forEach(radio => radio.addEventListener('change', calcular));
  $('convVnom').addEventListener('input', () => { actualizarTensionBanco(); calcular(); });
  $('convVbanco').addEventListener('input', () => { tensionBancoEditada = true; calcular(); });
  ['convRegulador', 'convInversor'].forEach(id => $(id).addEventListener('change', calcular));
  ['convEtaInvCon', 'convAutonomia', 'convDod', 'convFt', 'convEtaBat', 'convDcAcMin', 'convDcAcMax'].forEach(id => $(id).addEventListener('input', calcular));
  $('btnGuardarProyecto').addEventListener('click', calcular);

  $('btnDescargarEquipos').addEventListener('click', () => {
    const datos = catalogo.original || { reguladores: catalogo.reguladores, inversores: catalogo.inversores, baterias: catalogo.baterias };
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'catalogo_equipos.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  $('inputCatalogoEquipos').addEventListener('change', (ev) => {
    const archivo = ev.target.files[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => {
      try {
        const c = JSON.parse(lector.result);
        validarCatalogo(c);
        usarCatalogo(c, archivo.name);
        mostrarEstado('estadoCatalogoEquipos', 'Catálogo cargado desde ' + archivo.name + '.', 'ok');
        calcular();
      } catch (err) {
        mostrarEstado('estadoCatalogoEquipos', 'No se pudo usar el archivo: ' + err.message, 'error');
      }
      ev.target.value = '';
    };
    lector.readAsText(archivo);
  });

  // ---------------------------------------------------------------------
  // Interfaz pública que usan app.js y generador.js
  // ---------------------------------------------------------------------
  function obtenerConfiguracion() {
    return {
      rama: ramaActual(),
      ramaElegidaPorUsuario,
      reguladorId: $('convRegulador').value,
      inversorId: $('convInversor').value,
      bateriaId: $('convBateria').value,
      etaInv: Number($('convEtaInvCon').value),
      vNominalV: Number($('convVnom').value),
      vBancoV: Number($('convVbanco').value),
      tensionBancoEditada,
      autonomiaDias: Number($('convAutonomia').value),
      modoAutonomia: modoAutonomia(),
      dodPct: Number($('convDod').value),
      fT: Number($('convFt').value),
      etaBat: Number($('convEtaBat').value),
      dcAcMin: Number($('convDcAcMin').value),
      dcAcMax: Number($('convDcAcMax').value),
    };
  }

  function aplicarConfiguracion(cfg) {
    ramaElegidaPorUsuario = !!(cfg && cfg.ramaElegidaPorUsuario);
    if (!cfg) {
      tensionBancoEditada = false;
      document.querySelector('input[name="modoAutonomia"][value="dias"]').checked = true;
      calcular();
      return;
    }
    const asignar = (id, v) => { if (typeof v === 'number' && !isNaN(v)) $(id).value = v; };
    if (cfg.bateriaId && catalogo.baterias.some(b => b.id === cfg.bateriaId)) $('convBateria').value = cfg.bateriaId;
    if (typeof cfg.reguladorId === 'string' && (cfg.reguladorId === '' || catalogo.reguladores.some(e => e.id === cfg.reguladorId))) $('convRegulador').value = cfg.reguladorId;
    if (typeof cfg.inversorId === 'string' && (cfg.inversorId === '' || catalogo.inversores.some(e => e.id === cfg.inversorId))) $('convInversor').value = cfg.inversorId;
    asignar('convEtaInvCon', cfg.etaInv); asignar('convVnom', cfg.vNominalV); asignar('convVbanco', cfg.vBancoV);
    asignar('convAutonomia', cfg.autonomiaDias); asignar('convDod', cfg.dodPct); asignar('convFt', cfg.fT);
    asignar('convEtaBat', cfg.etaBat); asignar('convDcAcMin', cfg.dcAcMin); asignar('convDcAcMax', cfg.dcAcMax);
    tensionBancoEditada = !!cfg.tensionBancoEditada;
    const radioModo = document.querySelector('input[name="modoAutonomia"][value="' + (cfg.modoAutonomia === 'noche' ? 'noche' : 'dias') + '"]');
    if (radioModo) radioModo.checked = true;
    if (cfg.rama === 'con' || cfg.rama === 'sin') fijarRama(cfg.rama);
    calcular();
  }

  window.UIConversion = {
    alCambiarGenerador: calcular,
    obtenerConfiguracion,
    aplicarConfiguracion,
    calcular,
    datosListos: cargarCatalogo().then(calcular),
  };
})();
