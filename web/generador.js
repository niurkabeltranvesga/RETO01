// generador.js
//
// Interfaz del Paso 4: dimensionamiento del generador fotovoltaico (Reto 02).
// Toma el consumo que ya calculó la aplicación (Paso 3) sin pedir que se
// reingrese nada, lo combina con el recurso solar y el catálogo de módulos, y
// muestra el resultado. Los cálculos viven en dimensionamiento.js.

(function () {
  'use strict';

  const D = window.Dimensionamiento;
  const M = window.MotorCalculo;
  const estado = window.__estadoAppReto01;
  const $ = id => document.getElementById(id);

  const RUTA_CATALOGO = 'datos/catalogo_modulos.json';
  const RUTA_SITIOS = 'datos/base_sitios.json';

  const datos = {
    catalogo: [],
    sitios: [],
    origenCatalogo: '',
    origenSitios: '',
    sitiosConsultados: [],   // resultados de PVGIS en esta sesión
  };
  let dimensionado = false;  // si ya se pulsó "Dimensionar" al menos una vez

  // ---------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------
  function mostrarEstado(id, mensaje, tipo) {
    const el = $(id);
    el.textContent = mensaje;
    el.className = 'status ' + (tipo || '');
  }

  function escapar(texto) {
    const div = document.createElement('div');
    div.textContent = texto === null || texto === undefined ? '' : String(texto);
    return div.innerHTML;
  }

  function tarjetas(items) {
    return items.map(([label, valor, sub]) => `
      <div class="indicador-card">
        <div class="label">${escapar(label)}</div>
        <div class="value">${escapar(valor)}</div>
        <div class="sub">${escapar(sub || '')}</div>
      </div>`).join('');
  }

  const h2 = n => String(n).padStart(2, '0');

  // ---------------------------------------------------------------------
  // Carga de los archivos de datos (catálogo y base de sitios)
  // Primero se intenta leer los .json; si la página se abrió sin servidor
  // (doble clic) el navegador no lo permite y se usa la copia de respaldo
  // que genera build_standalone.py a partir de esos mismos archivos.
  // ---------------------------------------------------------------------
  async function leerJSON(ruta) {
    if (typeof window.fetch !== 'function') return null;
    try {
      const respuesta = await window.fetch(ruta, { cache: 'no-store' });
      if (!respuesta.ok) return null;
      return await respuesta.json();
    } catch (err) {
      return null;
    }
  }

  async function cargarDatos() {
    const respaldo = window.DATOS_RESPALDO || {};

    const catalogo = await leerJSON(RUTA_CATALOGO);
    if (catalogo && Array.isArray(catalogo.modulos)) {
      datos.catalogo = catalogo.modulos;
      datos.origenCatalogo = RUTA_CATALOGO;
    } else if (respaldo.catalogo) {
      datos.catalogo = respaldo.catalogo.modulos;
      datos.origenCatalogo = 'copia de respaldo de ' + RUTA_CATALOGO;
    }

    const sitios = await leerJSON(RUTA_SITIOS);
    if (sitios && Array.isArray(sitios.sitios)) {
      datos.sitios = sitios.sitios;
      datos.origenSitios = RUTA_SITIOS;
    } else if (respaldo.sitios) {
      datos.sitios = respaldo.sitios.sitios;
      datos.origenSitios = 'copia de respaldo de ' + RUTA_SITIOS;
    }

    poblarSelectores();
    if (datos.catalogo.length === 0 || datos.sitios.length === 0) {
      mostrarEstado('estadoDatos', 'No se encontraron el catálogo o la base de sitios. Cárguelos con el botón "Cargar catálogo o base de sitios".', 'error');
    } else {
      mostrarEstado('estadoDatos', resumenDatos(), '');
    }
  }

  function todosLosSitios() {
    return datos.sitios.concat(datos.sitiosConsultados);
  }

  function poblarSelectores() {
    const selSitio = $('selSitio');
    const previo = selSitio.value;
    selSitio.innerHTML = todosLosSitios().map(s =>
      `<option value="${escapar(s.id)}">${escapar(s.nombre)}</option>`).join('');
    if (previo && todosLosSitios().some(s => s.id === previo)) selSitio.value = previo;

    const selModulo = $('genModuloManual');
    const previoModulo = selModulo.value;
    selModulo.innerHTML = datos.catalogo.map(m =>
      `<option value="${escapar(m.id)}">${escapar(m.fabricante + ' ' + m.modelo + ' — ' + m.potenciaW + ' Wp')}</option>`).join('');
    if (previoModulo && datos.catalogo.some(m => m.id === previoModulo)) selModulo.value = previoModulo;

    renderizarRecurso();
  }

  // Resumen para el usuario: cuántos sitios y módulos hay. Solo se nombra el
  // archivo cuando el usuario cargó uno propio; los datos incluidos en la
  // aplicación no necesitan explicación técnica.
  function esOrigenPropio(origen) {
    return !!origen && origen.indexOf(RUTA_CATALOGO) === -1 && origen.indexOf(RUTA_SITIOS) === -1;
  }
  function resumenDatos() {
    const extra = [];
    if (esOrigenPropio(datos.origenSitios)) extra.push('sitios cargados desde ' + datos.origenSitios);
    if (esOrigenPropio(datos.origenCatalogo)) extra.push('módulos cargados desde ' + datos.origenCatalogo);
    return datos.sitios.length + ' sitios y ' + datos.catalogo.length + ' módulos disponibles' +
      (extra.length ? ' (' + extra.join('; ') + ')' : '') + '.';
  }

  // Carga manual de un catálogo o una base de sitios desde un archivo .json:
  // permite actualizar los datos sin tocar el código, incluso sin servidor.
  $('inputDatosGenerador').addEventListener('change', (evento) => {
    const archivo = evento.target.files[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => {
      try {
        const contenido = JSON.parse(lector.result);
        if (Array.isArray(contenido.modulos)) {
          datos.catalogo = contenido.modulos;
          datos.origenCatalogo = archivo.name;
          mostrarEstado('estadoGenerador', 'Catálogo cargado desde ' + archivo.name + ': ' + contenido.modulos.length + ' módulos.', 'ok');
        } else if (Array.isArray(contenido.sitios)) {
          datos.sitios = contenido.sitios;
          datos.origenSitios = archivo.name;
          mostrarEstado('estadoGenerador', 'Base de sitios cargada desde ' + archivo.name + ': ' + contenido.sitios.length + ' sitios.', 'ok');
        } else {
          throw new Error('el archivo debe tener una lista "modulos" o una lista "sitios".');
        }
        poblarSelectores();
        mostrarEstado('estadoDatos', resumenDatos(), '');
        recalcularSiCorresponde();
      } catch (err) {
        mostrarEstado('estadoGenerador', 'No se pudo leer el archivo: ' + err.message, 'error');
      }
      evento.target.value = '';
    };
    lector.readAsText(archivo);
  });

  // ---------------------------------------------------------------------
  // Datos heredados del consumo (RF-13) y coincidencia con el sol (RF-17)
  // ---------------------------------------------------------------------
  function renderizarHeredados() {
    const r = estado.resultados;
    const hayConsumo = !!(r && estado.proyecto);
    $('avisoSinResultados').hidden = hayConsumo;
    $('btnDimensionar').disabled = !hayConsumo;

    if (!hayConsumo) {
      $('heredadosGrid').innerHTML = '';
      $('coincidenciaSolar').hidden = true;
      return;
    }

    const contexto = { 'off-grid': 'Off-grid', 'on-grid': 'On-grid', 'hibrido-off-grid': 'Híbrido off-grid', 'hibrido-on-grid': 'Híbrido on-grid' };
    $('heredadosGrid').innerHTML = tarjetas([
      ['Energía diaria', r.energiaDiariaKWh.toFixed(2) + ' kWh', 'Ed, por día'],
      ['Demanda máxima', r.demandaMaximaW.toFixed(0) + ' W', 'a las ' + h2(r.horaDemandaMaximaH) + ':00 h'],
      ['Tipo de aplicación', contexto[estado.proyecto.contexto] || estado.proyecto.contexto, 'del Paso 1'],
      ['Días de operación', estado.parametros.diasOperacionAnio + ' d/año', estado.parametros.diasOperacionMes + ' d/mes'],
      ['Perfil de consumo', r.fuentePerfil === 'medido' ? 'Medido' : 'Estimado', r.fuentePerfil === 'medido' ? 'equipo de medición' : 'cuadro de cargas'],
    ]);

    const ini = estado.parametros.horaInicioDia;
    const fin = estado.parametros.horaFinDia;
    const c = D.energiaEnVentanaSolar(r.perfilHorarioW, ini, fin);
    const picoEnVentana = ini < fin
      ? (r.horaDemandaMaximaH >= ini && r.horaDemandaMaximaH < fin)
      : (r.horaDemandaMaximaH >= ini || r.horaDemandaMaximaH < fin);
    $('coincidenciaSolar').innerHTML =
      '<strong>Coincidencia con el recurso solar:</strong> de los ' + r.energiaDiariaKWh.toFixed(2) + ' kWh diarios, ' +
      '<strong>' + c.dentroKWh.toFixed(3) + ' kWh (' + (c.fraccionDentro * 100).toFixed(1) + ' %)</strong> se consumen dentro de la ventana solar ' +
      '(' + h2(ini) + ':00–' + h2(fin) + ':00 h) y <strong>' + c.fueraKWh.toFixed(3) + ' kWh</strong> fuera de ella. ' +
      'La demanda máxima, a las ' + h2(r.horaDemandaMaximaH) + ':00 h, cae ' + (picoEnVentana ? 'dentro' : 'fuera') + ' de la ventana. ' +
      '<span class="nota">La ventana se configura en el Paso 3 (hora de inicio y fin del día).</span>';
    $('coincidenciaSolar').hidden = false;
  }

  // ---------------------------------------------------------------------
  // Recurso solar del sitio (RF-14, RF-16)
  // ---------------------------------------------------------------------
  function sitioSeleccionado() {
    return todosLosSitios().find(s => s.id === $('selSitio').value) || null;
  }

  function renderizarRecurso() {
    const sitio = sitioSeleccionado();
    if (!sitio) { $('recursoSitio').hidden = true; return; }

    let rec;
    try { rec = D.analizarRecurso(sitio); } catch (err) {
      $('recursoInfo').innerHTML = '<p class="status error">' + escapar(err.message) + '</p>';
      $('graficoMensual').innerHTML = '';
      $('recursoSitio').hidden = false;
      return;
    }

    const nota = sitio.casoPrueba
      ? '<p class="nota">Caso de prueba del TdR: sus valores anual y del mes crítico son declarados; el TdR no entrega los doce meses. Para reproducir el resultado de referencia, elija manualmente el módulo de referencia del TdR.</p>'
      : '';
    $('recursoInfo').innerHTML = `
      <div class="recurso-nombre">${escapar(sitio.nombre)}</div>
      <div class="recurso-dato">Lat ${sitio.latitud}° · Lon ${sitio.longitud}° · Inclinación ${sitio.inclinacionGrados}° · Azimut ${sitio.azimutGrados}°</div>
      <div class="recurso-valores">
        <span><strong>${rec.anual.toFixed(2)}</strong> kWh/m²·día promedio anual</span>
        <span><strong>${rec.mesCritico.valor.toFixed(2)}</strong> kWh/m²·día en el mes crítico (${escapar(rec.mesCritico.nombre)})</span>
      </div>
      <div class="recurso-fuente">Fuente: ${escapar(sitio.fuente)} · Consulta: ${escapar(sitio.fechaConsulta)}</div>
      ${nota}`;
    renderizarGraficoMensual(rec);
    $('recursoSitio').hidden = false;
  }

  function renderizarGraficoMensual(rec) {
    const svg = $('graficoMensual');
    if (!rec.mensual) {
      svg.innerHTML = `<text x="300" y="95" text-anchor="middle" font-size="13" fill="#6b6058">Sin valores mensuales para este sitio</text>`;
      return;
    }
    const W = 600, H = 190, padL = 36, padR = 8, padT = 14, padB = 26;
    const ancho = W - padL - padR, alto = H - padT - padB;
    const escala = M.calcularEscalaEjeY(Math.max(...rec.mensual), 4);
    const paso = ancho / 12, barra = paso * 0.66;
    const nombres = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    let s = '';
    escala.marcas.forEach(v => {
      const y = padT + alto - (v / escala.maximo) * alto;
      s += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="#ece2d6"/>`;
      s += `<text x="${padL - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#6b6058">${v}</text>`;
    });
    rec.mensual.forEach((v, m) => {
      const altura = (v / escala.maximo) * alto;
      const x = padL + m * paso + (paso - barra) / 2;
      const y = padT + alto - altura;
      const critico = m === rec.mesCritico.indice;
      s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barra.toFixed(1)}" height="${altura.toFixed(1)}" rx="2" fill="${critico ? '#b85f32' : '#e8a77c'}"><title>${D.NOMBRES_MES[m]}: ${v.toFixed(2)} kWh/m²·día</title></rect>`;
      s += `<text x="${(x + barra / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#6b6058">${nombres[m]}</text>`;
    });
    const yAnual = padT + alto - (rec.anual / escala.maximo) * alto;
    s += `<line x1="${padL}" y1="${yAnual.toFixed(1)}" x2="${W - padR}" y2="${yAnual.toFixed(1)}" stroke="#2a2320" stroke-dasharray="4 3"/>`;
    s += `<text x="${W - padR - 2}" y="${(yAnual - 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#2a2320">promedio anual ${rec.anual.toFixed(2)}</text>`;
    svg.innerHTML = s;
  }

  // ---------------------------------------------------------------------
  // Consulta en línea a PVGIS con contingencia (RF-15)
  // Sin credenciales: PVGIS no pide clave. Se guarda en caché cada consulta
  // de la sesión y, si falla, se sigue con la base local y se declara.
  // ---------------------------------------------------------------------
  const cachePVGIS = new Map();
  let ultimaContingencia = null;
  const URL_PVGIS = 'https://re.jrc.ec.europa.eu/api/';
  // Fecha del computador del usuario (no la de Greenwich): en Colombia, de
  // noche, toISOString() ya daría el día siguiente.
  function fechaLocalHoy() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  async function leerMensajeDeError(respuesta) {
    try {
      const j = await respuesta.json();
      return j && (j.message || j.error) ? String(j.message || j.error) : '';
    } catch (e) {
      return '';
    }
  }

  async function consultarPVGIS(lat, lon, inclinacion, azimut) {
    const clave = [lat, lon, inclinacion, azimut].map(v => Number(v).toFixed(3)).join('|');
    if (cachePVGIS.has(clave)) return Object.assign({}, cachePVGIS.get(clave), { desdeCache: true });

    // Misma base de datos (PVGIS-ERA5) que se usó para armar la base local,
    // para que los valores consultados sean comparables con ella.
    const parametros = 'lat=' + lat + '&lon=' + lon + '&raddatabase=PVGIS-ERA5&peakpower=1&loss=14&angle=' + inclinacion +
      '&aspect=' + azimut + '&outputformat=json';
    const versiones = ['v5_3', 'v5_2'];
    let ultimoError = null;

    for (const version of versiones) {
      const url = URL_PVGIS + version + '/PVcalc?' + parametros;
      const control = typeof AbortController === 'function' ? new AbortController() : null;
      const temporizador = control ? setTimeout(() => control.abort(), 15000) : null;
      try {
        const respuesta = await window.fetch(url, control ? { signal: control.signal } : {});
        if (temporizador) clearTimeout(temporizador);
        if (respuesta.status === 404) { ultimoError = new Error('versión ' + version + ' no disponible'); continue; }
        if (!respuesta.ok) {
          const detalle = await leerMensajeDeError(respuesta);
          throw new Error('el servicio respondió con el código ' + respuesta.status + (detalle ? ': ' + detalle : ''));
        }
        const json = await respuesta.json();
        const sitio = interpretarRespuestaPVGIS(json, { lat, lon, inclinacion, azimut, version });
        cachePVGIS.set(clave, sitio);
        return sitio;
      } catch (err) {
        if (temporizador) clearTimeout(temporizador);
        if (err.name === 'AbortError') {
          ultimoError = new Error('el servicio no respondió en 15 segundos');
        } else if (err instanceof TypeError) {
          // fetch lanza TypeError cuando no hay red o cuando el navegador
          // bloquea la respuesta. PVGIS declara en su documentación que no
          // admite consultas AJAX desde páginas web (política CORS).
          ultimoError = new Error('el navegador no pudo completar la consulta: sin conexión, o bloqueada porque PVGIS no admite consultas directas desde páginas web');
        } else {
          ultimoError = err;
        }
        if (!(err.message || '').includes('no disponible')) break;
      }
    }
    throw ultimoError || new Error('no se pudo consultar el servicio');
  }

  function interpretarRespuestaPVGIS(json, p) {
    const mensuales = json && json.outputs && json.outputs.monthly
      ? (json.outputs.monthly.fixed || json.outputs.monthly)
      : null;
    if (!Array.isArray(mensuales) || mensuales.length !== 12) {
      throw new Error('la respuesta no trae los doce valores mensuales');
    }
    const mensual = mensuales.map((fila, i) => {
      if (typeof fila['H(i)_d'] === 'number') return Number(fila['H(i)_d'].toFixed(2));
      if (typeof fila['H(i)_m'] === 'number') return Number((fila['H(i)_m'] / D.DIAS_MES[i]).toFixed(2));
      throw new Error('la respuesta no trae la irradiación mensual en el plano');
    });
    const totales = json.outputs.totals && (json.outputs.totals.fixed || json.outputs.totals);
    const anualTotal = totales && typeof totales['H(i)_y'] === 'number' ? totales['H(i)_y'] : null;
    const base = json.inputs && json.inputs.meteo_data && json.inputs.meteo_data.radiation_db;
    return {
      id: 'pvgis-' + p.lat + '-' + p.lon + '-' + p.inclinacion + '-' + p.azimut,
      nombre: 'Consulta PVGIS (' + p.lat + ', ' + p.lon + ')',
      latitud: p.lat, longitud: p.lon,
      inclinacionGrados: p.inclinacion, azimutGrados: p.azimut,
      irradiacionAnual: anualTotal !== null ? Number((anualTotal / 365).toFixed(2)) : Number(D.promedioAnualDesdeMensual(mensual).toFixed(2)),
      irradiacionAnualKWhm2Anio: anualTotal,
      mensual,
      fuente: 'PVGIS API ' + p.version + ' (PVcalc)' + (base ? ', base de datos ' + base : '') + ', consulta en línea',
      fechaConsulta: fechaLocalHoy(),
      consultaEnLinea: true,
    };
  }

  $('btnConsultarApi').addEventListener('click', async () => {
    const lat = Number($('apiLat').value);
    const lon = Number($('apiLon').value);
    const incl = Number($('apiIncl').value);
    const azim = Number($('apiAzim').value);
    if ($('apiLat').value === '' || $('apiLon').value === '' || !(lat >= -90 && lat <= 90) || !(lon >= -180 && lon <= 180)) {
      mostrarEstado('estadoApi', 'Escriba una latitud entre −90 y 90 y una longitud entre −180 y 180.', 'error');
      return;
    }
    if (!(incl >= 0 && incl <= 90) || !(azim >= -180 && azim <= 180)) {
      mostrarEstado('estadoApi', 'La inclinación va de 0 a 90° y el azimut de −180 a 180°.', 'error');
      return;
    }
    if (typeof window.fetch !== 'function') {
      registrarContingencia('este navegador no permite consultas en línea');
      return;
    }
    mostrarEstado('estadoApi', 'Consultando PVGIS…', '');
    $('btnConsultarApi').disabled = true;
    try {
      const sitio = await consultarPVGIS(lat, lon, incl, azim);
      if (!datos.sitiosConsultados.some(s => s.id === sitio.id)) datos.sitiosConsultados.push(sitio);
      ultimaContingencia = null;
      poblarSelectores();
      $('selSitio').value = sitio.id;
      renderizarRecurso();
      mostrarEstado('estadoApi', (sitio.desdeCache ? 'Resultado tomado de la caché de esta sesión (no se repitió la consulta). ' : 'Consulta exitosa. ') + 'Fuente: ' + sitio.fuente + '.', 'ok');
      recalcularSiCorresponde();
    } catch (err) {
      registrarContingencia(err.message || 'error de red');
    } finally {
      $('btnConsultarApi').disabled = false;
    }
  });

  function registrarContingencia(motivo) {
    const local = sitioSeleccionado();
    ultimaContingencia = {
      motivo,
      fecha: fechaLocalHoy(),
      sitioLocal: local ? local.nombre : null,
    };
    const deLaBase = !(local && local.consultaEnLinea);
    mostrarEstado('estadoApi',
      'No se pudo consultar PVGIS (' + motivo + '). Se continúa con ' + (deLaBase ? 'la base de datos local' : 'el sitio ya seleccionado') +
      (local ? ': ' + local.nombre : '') + '. Esto quedará declarado en el informe.', 'error');
    recalcularSiCorresponde();
  }

  // ---------------------------------------------------------------------
  // Dimensionamiento
  // ---------------------------------------------------------------------
  function leerEntrada() {
    const r = estado.resultados;
    const criterioModulo = $('genCriterioModulo').value;
    return {
      energiaDiariaKWh: r.energiaDiariaKWh,
      perfilW: r.perfilHorarioW,
      horaInicioDia: estado.parametros.horaInicioDia,
      horaFinDia: estado.parametros.horaFinDia,
      diasOperacionAnio: estado.parametros.diasOperacionAnio,
      sitio: sitioSeleccionado(),
      criterioRecurso: document.querySelector('input[name="criterioRecurso"]:checked').value,
      pr: Number($('genPR').value),
      vMaxSistema: Number($('genVmax').value),
      tMinC: $('genTmin').value === '' ? NaN : Number($('genTmin').value),
      tAmbOperacionC: $('genTamb').value === '' ? NaN : Number($('genTamb').value),
      areaDisponibleM2: Number($('genArea').value),
      catalogo: datos.catalogo,
      criterioSeleccion: criterioModulo === 'manual' ? 'menor_excedente' : criterioModulo,
      moduloManualId: criterioModulo === 'manual' ? $('genModuloManual').value : null,
      metodoPotencia: $('genMetodo').value,
      etaBat: $('genEtaBat').value === '' ? NaN : Number($('genEtaBat').value),
      crecimientoPct: $('genCrecimiento').value === '' ? 0 : Number($('genCrecimiento').value),
      coberturaPct: $('genCobertura').value === '' ? 100 : Number($('genCobertura').value),
      contexto: estado.proyecto ? estado.proyecto.contexto : null,
    };
  }

  function dimensionar(silencioso) {
    if (!estado.resultados || !estado.proyecto) {
      limpiarResultadosGenerador();
      if (!silencioso) mostrarEstado('estadoGenerador', 'Primero calcule los resultados en el Paso 3.', 'error');
      return;
    }
    try {
      const resultado = D.dimensionarGenerador(leerEntrada());
      const sitio = sitioSeleccionado();
      estado.generador = Object.assign(resultado, {
        sitio,
        origenCatalogo: datos.origenCatalogo,
        origenSitios: datos.origenSitios,
        contingencia: ultimaContingencia,
        justificacionGrupo: leerJustificacion(),
        fuenteEtaBat: $('genFuenteEta').value.trim(),
        justificacionCrecimiento: $('genJustCrecimiento').value.trim(),
      });
      // Los supuestos se guardan con el resultado para que la app y el
      // informe PDF muestren exactamente la misma lista.
      estado.generador.supuestos = supuestos(estado.generador);
      dimensionado = true;
      renderizarResultados(estado.generador);
      mostrarEstado('estadoGenerador', 'Generador dimensionado correctamente.', 'ok');
    } catch (err) {
      limpiarResultadosGenerador();
      mostrarEstado('estadoGenerador', 'Error: ' + err.message, 'error');
    }
  }

  function limpiarResultadosGenerador() {
    estado.generador = null;
    $('resultadosGenerador').hidden = true;
  }

  function recalcularSiCorresponde() {
    if (dimensionado) dimensionar(true);
  }

  function renderizarResultados(g) {
    const s = g.seleccion;
    const m = s.modulo;
    const etiquetaRecurso = g.criterioRecurso === 'anual'
      ? 'promedio anual'
      : 'mes crítico (' + g.recurso.mesCritico.nombre + ')';

    // Advertencias (RF-22, RF-24)
    const avisos = g.advertencias.slice();
    if (g.contingencia) avisos.unshift('La consulta en línea falló (' + g.contingencia.motivo + '); se usó la base de datos local.');
    $('avisosGenerador').innerHTML = avisos.length
      ? '<strong>Advertencias:</strong><ul>' + avisos.map(a => '<li>' + escapar(a) + '</li>').join('') + '</ul>'
      : '';
    $('avisosGenerador').hidden = avisos.length === 0;

    // Resultado principal (RF-18, RF-19)
    $('indicadoresGenerador').innerHTML = tarjetas([
      ['Potencia pico ' + (g.metodo.id === 'balance' ? 'de diseño' : 'necesaria'), g.potenciaPicoKWp.toFixed(2) + ' kWp', 'por ' + etiquetaRecurso + (g.metodo.id === 'balance' ? ' · método propio' : '')],
      ['Irradiación usada', g.hspUsada.toFixed(2) + ' kWh/m²', 'por día · PR ' + g.pr.toFixed(2)],
      ['Módulos', s.numeroModulos + ' × ' + m.potenciaW + ' Wp', m.fabricante + ' ' + m.modelo],
      ['Potencia instalada', (s.potenciaInstaladaW / 1000).toFixed(2) + ' kWp', (s.excedenteW >= 0 ? '+' : '') + (s.excedenteW / 1000).toFixed(3) + ' kWp (' + (s.excedentePct >= 0 ? '+' : '') + s.excedentePct.toFixed(1) + ' %)'],
      ['Energía generada', g.energiaGeneradaDiariaKWh.toFixed(2) + ' kWh/día', 'cubre el ' + g.coberturaPct.toFixed(0) + ' % de Ed (prom. anual)'],
    ]);

    const mt = g.metodo;
    if (mt.id === 'balance') {
      $('comparacionMetodo').innerHTML =
        '<strong>Método propio: balance día/noche con factor de crecimiento y meta de cobertura.</strong>' + (mt.etaBat === 1 ? ' Sin almacenamiento (η_bat = 1).' : '') + '<br>' +
        'E_eq = E_día + E_noche / η_bat = ' + mt.eDiaKWh.toFixed(3) + ' + ' + mt.eNocheKWh.toFixed(3) + ' / ' + mt.etaBat.toFixed(2) +
        ' = <strong>' + mt.energiaEquivalenteKWh.toFixed(3) + ' kWh/día</strong>. ' +
        'Fc = 1 + g = ' + mt.fc.toFixed(2) + ' · Cob = ' + mt.coberturaPct + ' % → E_diseño = Fc · Cob · E_eq = <strong>' + mt.energiaDisenoKWh.toFixed(3) + ' kWh/día</strong>.<br>' +
        'Potencia pico con la misma irradiación: método de referencia <strong>' + mt.potenciaReferenciaKWp.toFixed(2) + ' kWp</strong> · ' +
        'balance sin crecimiento <strong>' + mt.potenciaBalanceKWp.toFixed(2) + ' kWp</strong> · ' +
        'diseño con crecimiento y cobertura <strong>' + mt.potenciaDisenoKWp.toFixed(2) + ' kWp</strong>.';
      $('comparacionMetodo').hidden = false;
    } else {
      $('comparacionMetodo').innerHTML = '';
      $('comparacionMetodo').hidden = true;
    }

    const comparacion = 'Por promedio anual se requieren <strong>' + g.potenciaPicoAnualKWp.toFixed(2) + ' kWp</strong>; por el mes de menor recurso, <strong>' + g.potenciaPicoCriticoKWp.toFixed(2) + ' kWp</strong>. ';
    const porQue = g.modoSeleccion === 'manual'
      ? 'La referencia se eligió manualmente.'
      : 'Criterio de selección: <strong>' + escapar(g.criterio.nombre) + '</strong>. ' + escapar(g.criterio.explicacion);
    $('explicacionSeleccion').innerHTML = comparacion + porQue;

    // Configuración eléctrica (RF-19, RF-20, RF-21, RF-22)
    $('configuracionGenerador').innerHTML = tarjetas([
      ['Configuración', s.cadenasParalelo + (s.cadenasParalelo === 1 ? ' cadena' : ' cadenas') + ' de ' + s.modulosSerie, 'máx. ' + s.maxModulosSerie + ' en serie con ' + g.parametros.vMaxSistema + ' V'],
      ['Voc del generador', s.vocGeneradorTminV.toFixed(1) + ' V', 'a ' + g.parametros.tMinC + ' °C (módulo ' + s.vocModuloTminV.toFixed(2) + ' V)'],
      ['Vmp del generador', s.vmpGeneradorOperacionV.toFixed(1) + ' V', 'celda a ' + s.temperaturaCeldaC.toFixed(1) + ' °C'],
      ['Isc del generador', s.iscGeneradorA.toFixed(1) + ' A', s.cadenasParalelo + ' × ' + m.iscA + ' A'],
      ['Corriente de diseño', s.corrienteDisenoA.toFixed(1) + ' A', '1,25 × 1,25 × Isc (NTC 2050)'],
      ['Área ocupada', s.areaGeneradorM2.toFixed(2) + ' m²', s.cabeEnArea ? 'cabe en ' + g.parametros.areaDisponibleM2 + ' m²' : 'NO cabe en ' + g.parametros.areaDisponibleM2 + ' m²'],
    ]);

    // Catálogo evaluado (filtrar, seleccionar, cuantificar)
    $('cuerpoCatalogo').innerHTML = g.evaluaciones.map(e => {
      const mod = e.modulo;
      const nombre = escapar(mod.fabricante + ' ' + mod.modelo) + (mod.referenciaTdR ? ' <span class="etiqueta-ref">referencia TdR</span>' : '');
      if (!e.viable) {
        return `<tr class="fila-descartada"><td>${nombre}</td><td>${mod.potenciaW}</td><td>${e.maxModulosSerie}</td><td colspan="5">—</td><td>Descartado: ${escapar(e.motivoDescarte)}</td></tr>`;
      }
      let estadoFila = e.id === s.id ? '<strong>Seleccionado</strong>' : (mod.referenciaTdR ? 'Solo manual' : 'Viable');
      if (e.cabeEnArea === false) estadoFila += ' · no cabe';
      return `<tr class="${e.id === s.id ? 'is-selected' : ''}">
        <td>${nombre}</td><td>${mod.potenciaW}</td><td>${e.maxModulosSerie}</td><td>${e.numeroModulos}</td>
        <td>${e.cadenasParalelo} × ${e.modulosSerie}</td><td>${(e.potenciaInstaladaW / 1000).toFixed(3)} kWp</td>
        <td>${e.excedentePct >= 0 ? '+' : ''}${e.excedentePct.toFixed(1)} %</td><td>${e.areaGeneradorM2.toFixed(2)} m²</td><td>${estadoFila}</td></tr>`;
    }).join('');

    // Supuestos (RF-18: todos visibles)
    $('listaSupuestos').innerHTML = (g.supuestos || []).map(sp => '<li>' + escapar(sp.texto) + '</li>').join('');

    $('resultadosGenerador').hidden = false;
  }

  function supuestos(g) {
    const s = g.seleccion;
    return [
      g.metodo.id === 'balance'
        ? { id: 'potencia', texto: 'Potencia pico (método propio): Ppico = Fc · E_eq / (HSP · PR) = ' + g.metodo.fc.toFixed(2) + ' · ' + g.metodo.energiaEquivalenteKWh.toFixed(3) + ' / (' + g.hspUsada.toFixed(2) + ' · ' + g.pr.toFixed(2) + ') = ' + g.potenciaPicoKWp.toFixed(3) + ' kWp. Con el método de referencia serían ' + g.metodo.potenciaReferenciaKWp.toFixed(3) + ' kWp.' }
        : { id: 'potencia', texto: 'Potencia pico: Ppico = Ed / (HSP · PR) = ' + estado.resultados.energiaDiariaKWh.toFixed(3) + ' / (' + g.hspUsada.toFixed(2) + ' · ' + g.pr.toFixed(2) + ') = ' + g.potenciaPicoKWp.toFixed(3) + ' kWp.' },
      ...(g.metodo.id === 'balance' ? [
        { id: 'balance', texto: 'Energía equivalente: E_eq = E_día + E_noche / η_bat = ' + g.metodo.eDiaKWh.toFixed(3) + ' + ' + g.metodo.eNocheKWh.toFixed(3) + ' / ' + g.metodo.etaBat.toFixed(2) + ' = ' + g.metodo.energiaEquivalenteKWh.toFixed(3) + ' kWh/día. ' + (g.metodo.etaBat === 1 ? 'Sin almacenamiento (η_bat = 1): la energía nocturna se cuenta sin pérdidas porque la cubre otra fuente.' : 'Se supone que toda la energía nocturna pasa por la batería y que la diurna se consume directo.') },
        { id: 'etaBat', texto: 'Eficiencia de ida y vuelta de la batería η_bat = ' + g.metodo.etaBat.toFixed(2) + (g.fuenteEtaBat ? '. Fuente: ' + g.fuenteEtaBat : '') + '.' },
        { id: 'crecimiento', texto: 'Factor de crecimiento Fc = 1 + g = ' + g.metodo.fc.toFixed(2) + ' (g = ' + g.metodo.crecimientoPct + ' %)' + (g.justificacionCrecimiento ? '. Justificación: ' + g.justificacionCrecimiento : (g.metodo.crecimientoPct > 0 ? '. Sin justificación registrada' : '')) + '.' },
        { id: 'cobertura', texto: 'Meta de cobertura Cob = ' + g.metodo.coberturaPct + ' % de la energía (kWh) que consumen las cargas; se aplica a la energía y no al valor de la factura. ' + (g.metodo.coberturaPct < 100 ? 'El resto lo debe cubrir otra fuente (red o planta).' : 'El generador cubre toda la energía.') },
      ] : []),
      { id: 'pr', texto: 'El factor global de desempeño (PR = ' + g.pr.toFixed(2) + ') agrupa las pérdidas por temperatura, suciedad, cableado y conversión.' },
      { id: 'recurso', texto: 'Recurso solar: ' + g.sitio.nombre + ', irradiación sobre el plano del generador (' + g.sitio.inclinacionGrados + '°, azimut ' + g.sitio.azimutGrados + '°). Fuente: ' + g.sitio.fuente + ' (' + g.sitio.fechaConsulta + ').' },
      { id: 'voc', texto: 'Voc corregido a la temperatura mínima: Voc · [1 + β (Tmin − 25)], con β = ' + s.modulo.coefVocPctC + ' %/°C.' },
      { id: 'celda', texto: 'Temperatura de celda con el modelo ' + s.modulo.tipoTemperaturaNominal + ': Tamb + (' + s.modulo.tipoTemperaturaNominal + ' − 20) / 800 · 1000 W/m² = ' + s.temperaturaCeldaC.toFixed(1) + ' °C.' },
      { id: 'vmp', texto: 'Vmp en operación corregido con el coeficiente de temperatura de la tensión (β).' },
      { id: 'corriente', texto: 'Corriente de diseño = 1,25 · 1,25 · Isc del generador, según NTC 2050 art. 690-8.' },
      { id: 'cadenas', texto: 'Todas las cadenas tienen el mismo número de módulos.' },
      { id: 'energia', texto: 'La energía generada se estima con el promedio anual: Pinstalada · HSPanual · PR. En el mes crítico serían ' + g.energiaGeneradaMesCriticoKWh.toFixed(2) + ' kWh/día (' + g.coberturaMesCriticoPct.toFixed(0) + ' % de Ed).' },
      { id: 'modulo', texto: 'Módulo: ' + s.modulo.fabricante + ' ' + s.modulo.modelo + '. Ficha técnica: ' + s.modulo.fuente + ' (consulta ' + s.modulo.fechaConsulta + ').' },
    ];
  }

  // Justificación del grupo: texto libre con el porqué de la regla elegida
  // para este caso. No cambia ningún cálculo; solo viaja al informe y al .json.
  function leerJustificacion() {
    return $('genJustificacion').value.trim();
  }

  function actualizarContadorJustificacion() {
    $('contadorJustificacion').textContent = $('genJustificacion').value.length + ' / 400 caracteres';
  }

  // ---------------------------------------------------------------------
  // Eventos de la interfaz
  // ---------------------------------------------------------------------
  $('genJustificacion').addEventListener('input', () => {
    actualizarContadorJustificacion();
    if (estado.generador) estado.generador.justificacionGrupo = leerJustificacion();
  });

  $('btnDimensionar').addEventListener('click', () => dimensionar(false));

  $('selSitio').addEventListener('change', () => { renderizarRecurso(); recalcularSiCorresponde(); });

  $('genCriterioModulo').addEventListener('change', () => {
    $('campoModuloManual').hidden = $('genCriterioModulo').value !== 'manual';
    recalcularSiCorresponde();
  });

  $('genMetodo').addEventListener('change', () => {
    $('campoMetodoBalance').hidden = $('genMetodo').value !== 'balance';
    recalcularSiCorresponde();
  });
  ['genFuenteEta', 'genJustCrecimiento'].forEach(id => {
    $(id).addEventListener('input', () => {
      if (!estado.generador) return;
      estado.generador.fuenteEtaBat = $('genFuenteEta').value.trim();
      estado.generador.justificacionCrecimiento = $('genJustCrecimiento').value.trim();
      estado.generador.supuestos = supuestos(estado.generador);
      $('listaSupuestos').innerHTML = estado.generador.supuestos.map(sp => '<li>' + escapar(sp.texto) + '</li>').join('');
    });
  });

  ['genModuloManual', 'genPR', 'genVmax', 'genArea', 'genTmin', 'genTamb', 'genEtaBat', 'genCrecimiento', 'genCobertura'].forEach(id => {
    $(id).addEventListener('change', recalcularSiCorresponde);
  });
  Array.from(document.querySelectorAll('input[name="criterioRecurso"]')).forEach(radio => {
    radio.addEventListener('change', recalcularSiCorresponde);
  });

  // ---------------------------------------------------------------------
  // Interfaz pública que usa app.js
  // ---------------------------------------------------------------------
  function alCambiarConsumo() {
    renderizarHeredados();
    if (!estado.resultados) { limpiarResultadosGenerador(); return; }
    recalcularSiCorresponde();
  }

  function obtenerConfiguracion() {
    return {
      sitioId: $('selSitio').value,
      criterioRecurso: document.querySelector('input[name="criterioRecurso"]:checked').value,
      pr: Number($('genPR').value),
      vMaxSistema: Number($('genVmax').value),
      tMinC: Number($('genTmin').value),
      tAmbOperacionC: Number($('genTamb').value),
      areaDisponibleM2: Number($('genArea').value),
      criterioModulo: $('genCriterioModulo').value,
      moduloManualId: $('genModuloManual').value,
      justificacionGrupo: leerJustificacion(),
      metodoPotencia: $('genMetodo').value,
      etaBat: Number($('genEtaBat').value),
      crecimientoPct: Number($('genCrecimiento').value),
      coberturaPct: Number($('genCobertura').value),
      fuenteEtaBat: $('genFuenteEta').value,
      justificacionCrecimiento: $('genJustCrecimiento').value,
      sitiosConsultados: datos.sitiosConsultados,
      dimensionado,
    };
  }

  function aplicarConfiguracion(cfg) {
    // Cada proyecto trae su propia justificación; si no trae, el cuadro queda vacío
    // para no arrastrar la de otro caso.
    $('genJustificacion').value = (cfg && typeof cfg.justificacionGrupo === 'string') ? cfg.justificacionGrupo.slice(0, 400) : '';
    actualizarContadorJustificacion();
    if (!cfg) {
      // Un proyecto sin configuración del generador vuelve al método de referencia.
      $('genMetodo').value = 'referencia';
      $('genCrecimiento').value = 0;
      $('genCobertura').value = 100;
      $('genJustCrecimiento').value = '';
      $('campoMetodoBalance').hidden = true;
      renderizarHeredados();
      return;
    }
    if (Array.isArray(cfg.sitiosConsultados)) {
      cfg.sitiosConsultados.forEach(s => { if (!datos.sitiosConsultados.some(x => x.id === s.id)) datos.sitiosConsultados.push(s); });
      poblarSelectores();
    }
    if (cfg.sitioId && todosLosSitios().some(s => s.id === cfg.sitioId)) $('selSitio').value = cfg.sitioId;
    const radio = document.querySelector('input[name="criterioRecurso"][value="' + cfg.criterioRecurso + '"]');
    if (radio) radio.checked = true;
    const asignar = (id, v) => { if (v !== undefined && v !== null && !isNaN(v)) $(id).value = v; };
    asignar('genPR', cfg.pr); asignar('genVmax', cfg.vMaxSistema); asignar('genTmin', cfg.tMinC);
    asignar('genTamb', cfg.tAmbOperacionC); asignar('genArea', cfg.areaDisponibleM2);
    if (cfg.criterioModulo) $('genCriterioModulo').value = cfg.criterioModulo;
    $('genMetodo').value = cfg.metodoPotencia === 'balance' ? 'balance' : 'referencia';
    asignar('genEtaBat', cfg.etaBat);
    asignar('genCrecimiento', cfg.crecimientoPct);
    $('genCobertura').value = (typeof cfg.coberturaPct === 'number' && cfg.coberturaPct > 0) ? cfg.coberturaPct : 100;
    if (typeof cfg.fuenteEtaBat === 'string') $('genFuenteEta').value = cfg.fuenteEtaBat;
    $('genJustCrecimiento').value = typeof cfg.justificacionCrecimiento === 'string' ? cfg.justificacionCrecimiento : '';
    $('campoMetodoBalance').hidden = $('genMetodo').value !== 'balance';
    if (cfg.moduloManualId) $('genModuloManual').value = cfg.moduloManualId;
    $('campoModuloManual').hidden = $('genCriterioModulo').value !== 'manual';
    renderizarRecurso();
    renderizarHeredados();
    if (cfg.dimensionado) dimensionar(true);
  }

  window.UIGenerador = {
    alCambiarConsumo,
    obtenerConfiguracion,
    aplicarConfiguracion,
    dimensionar,
    datosListos: cargarDatos(),
  };

  renderizarHeredados();
})();
