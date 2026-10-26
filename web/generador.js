// generador.js
//
// Interfaz del Paso 4: dimensionamiento del generador fotovoltaico.
// Toma el consumo que ya calculó la aplicación (Paso 3) sin pedir que se
// reingrese nada, lo combina con el recurso solar y el catálogo de módulos, y
// muestra el resultado. Los cálculos viven en dimensionamiento.js.

(function () {
  'use strict';

  const D = window.Dimensionamiento;
  const M = window.MotorCalculo;
  const fmt = M.formatoNumero;
  // Valor de ficha con sus propios decimales (14,31 A; -0,23 %/°C).
  const fv = v => fmt(v, (String(v).split('.')[1] || '').length);
  const estado = window.__estadoAppReto01;
  const $ = id => document.getElementById(id);

  const RUTA_CATALOGO = 'datos/catalogo_modulos.json';
  const RUTA_SITIOS = 'datos/base_sitios.json';

  const datos = {
    catalogo: [],
    sitios: [],
    origenCatalogo: '',
    origenSitios: '',
    sitiosConsultados: [],   // resultados de la consulta en línea en esta sesión
  };
  let dimensionado = false;  // si ya se pulsó "Dimensionar" al menos una vez
  // Ajuste que el usuario aceptó en el paso de conversión y almacenamiento:
  // { potenciaMinimaKWp, modulosSerieFijo } o null.
  let ajusteConversion = null;
  // Segunda fuente de recurso consultada en línea en esta sesión, por sitio.
  const segundasEnLinea = {};

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
  // Datos heredados del consumo y coincidencia con el sol
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
      ['Energía diaria', fmt(r.energiaDiariaKWh, 3) + ' kWh', 'Ed, por día'],
      ['Demanda máxima', fmt(r.demandaMaximaW, 0) + ' W', 'a las ' + h2(r.horaDemandaMaximaH) + ':00 h'],
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
      '<strong>Coincidencia con el recurso solar:</strong> de los ' + fmt(r.energiaDiariaKWh, 3) + ' kWh diarios, ' +
      '<strong>' + fmt(c.dentroKWh, 3) + ' kWh (' + fmt(c.fraccionDentro * 100, 1) + ' %)</strong> se consumen dentro de la ventana solar ' +
      '(' + h2(ini) + ':00–' + h2(fin) + ':00 h) y <strong>' + fmt(c.fueraKWh, 3) + ' kWh</strong> fuera de ella. ' +
      'La demanda máxima, a las ' + h2(r.horaDemandaMaximaH) + ':00 h, cae ' + (picoEnVentana ? 'dentro' : 'fuera') + ' de la ventana. ' +
      '<span class="nota">La ventana se configura en el Paso 3 (hora de inicio y fin del día).</span>';
    $('coincidenciaSolar').hidden = false;
  }

  // ---------------------------------------------------------------------
  // Recurso solar del sitio
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
      ? '<p class="nota">Caso de prueba: sus valores anual y del mes crítico son declarados y no incluyen los doce meses. Para reproducir el resultado de referencia, elija manualmente el módulo del caso de prueba.</p>'
      : '';
    $('recursoInfo').innerHTML = `
      <div class="recurso-nombre">${escapar(sitio.nombre)}</div>
      <div class="recurso-dato">Lat ${fv(sitio.latitud)}° · Lon ${fv(sitio.longitud)}° · Inclinación ${fv(sitio.inclinacionGrados)}° · Azimut ${fv(sitio.azimutGrados)}°</div>
      <div class="recurso-valores">
        <span><strong>${fmt(rec.anual, 2)}</strong> kWh/m²·día promedio anual</span>
        <span><strong>${fmt(rec.mesCritico.valor, 2)}</strong> kWh/m²·día en el mes crítico (${escapar(rec.mesCritico.nombre)})</span>
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
      s += `<text x="${padL - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#6b6058">${fmt(v, v % 1 ? 1 : 0)}</text>`;
    });
    rec.mensual.forEach((v, m) => {
      const altura = (v / escala.maximo) * alto;
      const x = padL + m * paso + (paso - barra) / 2;
      const y = padT + alto - altura;
      const critico = m === rec.mesCritico.indice;
      s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barra.toFixed(1)}" height="${altura.toFixed(1)}" rx="2" fill="${critico ? '#b85f32' : '#e8a77c'}"><title>${D.NOMBRES_MES[m]}: ${fmt(v, 2)} kWh/m²·día</title></rect>`;
      s += `<text x="${(x + barra / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#6b6058">${nombres[m]}</text>`;
    });
    const yAnual = padT + alto - (rec.anual / escala.maximo) * alto;
    s += `<line x1="${padL}" y1="${yAnual.toFixed(1)}" x2="${W - padR}" y2="${yAnual.toFixed(1)}" stroke="#2a2320" stroke-dasharray="4 3"/>`;
    s += `<text x="${W - padR - 2}" y="${(yAnual - 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#2a2320">promedio anual ${fmt(rec.anual, 2)}</text>`;
    svg.innerHTML = s;
  }

  // ---------------------------------------------------------------------
  // Consulta en línea a NASA POWER con contingencia
  // Sin credenciales: NASA POWER no pide clave y sí admite consultas
  // directas desde páginas web. Se guarda en caché cada consulta de la
  // sesión y, si falla, se sigue con la base local y se declara.
  // ---------------------------------------------------------------------
  const cacheConsultas = new Map();
  let ultimaContingencia = null;
  const URL_NASA_POWER = 'https://power.larc.nasa.gov/api/temporal/climatology/point';
  const VALOR_FALTANTE_NASA = -999;
  const MESES_NASA = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  // Inclinaciones que entrega NASA POWER (superficie orientada al ecuador)
  // y el nombre del dato correspondiente en su respuesta.
  const PLANOS_NASA = {
    'latitud': { clave: 'SI_TILTED_AVG_LATITUDE', angulo: lat => Math.abs(lat), texto: 'igual a la latitud' },
    'latitud+15': { clave: 'SI_TILTED_AVG_LAT_PLUS15', angulo: lat => Math.abs(lat) + 15, texto: 'latitud + 15°' },
    'horizontal': { clave: 'SI_TILTED_AVG_HORIZONTAL', angulo: () => 0, texto: 'horizontal' },
  };
  // Fecha del computador del usuario (no la de Greenwich): en Colombia, de
  // noche, toISOString() ya daría el día siguiente.
  function fechaLocalHoy() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  async function leerMensajeDeError(respuesta) {
    try {
      const j = await respuesta.json();
      if (j && Array.isArray(j.messages) && j.messages.length) return j.messages.join(' ');
      return j && (j.message || j.error || j.header) ? String(j.message || j.error || j.header) : '';
    } catch (e) {
      return '';
    }
  }

  async function consultarNasaPower(lat, lon, plano) {
    const clave = [lat, lon].map(v => Number(v).toFixed(3)).concat(plano).join('|');
    if (cacheConsultas.has(clave)) return Object.assign({}, cacheConsultas.get(clave), { desdeCache: true });

    const url = URL_NASA_POWER + '?parameters=SI_EF_TILTED_SURFACE&community=RE&longitude=' + lon +
      '&latitude=' + lat + '&format=JSON';
    const control = typeof AbortController === 'function' ? new AbortController() : null;
    const temporizador = control ? setTimeout(() => control.abort(), 15000) : null;
    try {
      const respuesta = await window.fetch(url, control ? { signal: control.signal } : {});
      if (!respuesta.ok) {
        const detalle = await leerMensajeDeError(respuesta);
        throw new Error('el servicio respondió con el código ' + respuesta.status + (detalle ? ': ' + detalle : ''));
      }
      const json = await respuesta.json();
      const sitio = interpretarRespuestaNasa(json, { lat, lon, plano });
      cacheConsultas.set(clave, sitio);
      return sitio;
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('el servicio no respondió en 15 segundos');
      if (err instanceof TypeError || (err && err.name === 'TypeError')) throw new Error('sin conexión a internet o servicio no disponible');
      throw err;
    } finally {
      if (temporizador) clearTimeout(temporizador);
    }
  }

  function interpretarRespuestaNasa(json, p) {
    const def = PLANOS_NASA[p.plano];
    const serie = json && json.properties && json.properties.parameter && json.properties.parameter[def.clave];
    if (!serie) throw new Error('la respuesta no trae la irradiación sobre el plano inclinado');
    const mensual = MESES_NASA.map(m => {
      const v = serie[m];
      if (typeof v !== 'number' || v === VALOR_FALTANTE_NASA) throw new Error('la respuesta no trae los doce valores mensuales');
      return Number(v.toFixed(2));
    });
    const anual = typeof serie.ANN === 'number' && serie.ANN !== VALOR_FALTANTE_NASA
      ? Number(serie.ANN.toFixed(2))
      : Number(D.promedioAnualDesdeMensual(mensual).toFixed(2));
    const header = json.header || {};
    const version = header.api && header.api.version ? ' ' + header.api.version : '';
    const periodo = header.range ? ', ' + String(header.range).replace(/^.*\(([^)]+)\).*$/, '$1').replace(' - ', ' a ').replace('January', 'enero').replace('December', 'diciembre') : '';
    const inclinacion = Number(def.angulo(p.lat).toFixed(1));
    return {
      id: 'nasa-' + p.lat + '-' + p.lon + '-' + p.plano,
      nombre: 'Consulta NASA POWER (' + p.lat + ', ' + p.lon + ')',
      latitud: p.lat, longitud: p.lon,
      // Azimut con la convención de la base local (0 = sur): la superficie
      // mira al ecuador, es decir al sur en el norte y al norte en el sur.
      inclinacionGrados: inclinacion, azimutGrados: p.lat >= 0 ? 0 : 180,
      irradiacionAnual: anual,
      mensual,
      fuente: 'NASA POWER, API de climatología' + version + ' (superficie orientada al ecuador, inclinación ' + def.texto +
        ')' + periodo + ', consulta en línea',
      fechaConsulta: fechaLocalHoy(),
      consultaEnLinea: true,
    };
  }

  $('btnConsultarApi').addEventListener('click', async () => {
    const lat = Number($('apiLat').value);
    const lon = Number($('apiLon').value);
    const plano = $('apiIncl').value;
    if ($('apiLat').value === '' || $('apiLon').value === '' || !(lat >= -90 && lat <= 90) || !(lon >= -180 && lon <= 180)) {
      mostrarEstado('estadoApi', 'Escriba una latitud entre −90 y 90 y una longitud entre −180 y 180.', 'error');
      return;
    }
    if (!PLANOS_NASA[plano]) {
      mostrarEstado('estadoApi', 'Elija la inclinación del generador.', 'error');
      return;
    }
    if (typeof window.fetch !== 'function') {
      registrarContingencia('este navegador no permite consultas en línea');
      return;
    }
    mostrarEstado('estadoApi', 'Consultando NASA POWER…', '');
    $('btnConsultarApi').disabled = true;
    try {
      const sitio = await consultarNasaPower(lat, lon, plano);
      if (!datos.sitiosConsultados.some(s => s.id === sitio.id)) datos.sitiosConsultados.push(sitio);
      ultimaContingencia = null;
      poblarSelectores();
      $('selSitio').value = sitio.id;
      renderizarRecurso();
      mostrarEstado('estadoApi', (sitio.desdeCache ? 'Resultado tomado de la caché de esta sesión (no se repitió la consulta). ' : 'Consulta exitosa. ') +
        'Plano a ' + fv(sitio.inclinacionGrados) + '°, irradiación media anual ' + fmt(sitio.irradiacionAnual, 2) + ' kWh/m²·día.', 'ok');
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
      'No se pudo consultar NASA POWER (' + motivo + '). Se continúa con ' + (deLaBase ? 'la base de datos local' : 'el sitio ya seleccionado') +
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
      moduloManualId: criterioModulo === 'manual' ? $('genModuloManual').value : (ajusteConversion && ajusteConversion.moduloId) || null,
      moduloFijadoPorAjuste: criterioModulo !== 'manual' && !!(ajusteConversion && ajusteConversion.moduloId),
      metodoPotencia: $('genMetodo').value,
      etaBat: $('genEtaBat').value === '' ? NaN : Number($('genEtaBat').value),
      crecimientoPct: $('genCrecimiento').value === '' ? 0 : Number($('genCrecimiento').value),
      coberturaPct: $('genCobertura').value === '' ? 100 : Number($('genCobertura').value),
      contexto: estado.proyecto ? estado.proyecto.contexto : null,
      potenciaMinimaKWp: ajusteConversion && ajusteConversion.potenciaMinimaKWp > 0 ? ajusteConversion.potenciaMinimaKWp : null,
      modulosSerieFijo: ajusteConversion && ajusteConversion.modulosSerieFijo > 0 ? ajusteConversion.modulosSerieFijo : null,
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
      estado.generador.segundaFuente = contrastar(estado.generador);
      dimensionado = true;
      renderizarResultados(estado.generador);
      mostrarEstado('estadoGenerador', 'Generador dimensionado correctamente.', 'ok');
    } catch (err) {
      limpiarResultadosGenerador();
      mostrarEstado('estadoGenerador', 'Error: ' + err.message, 'error');
    }
    avisarConversion();
  }

  // Contraste con la segunda fuente: la consultada en línea en esta sesión o,
  // si no hay, la guardada en la base local junto al sitio.
  function contrastar(g) {
    const sitio = g.sitio;
    if (!sitio || sitio.casoPrueba) return null;
    const segunda = segundasEnLinea[sitio.id] || sitio.segundaFuente || null;
    if (!segunda) return null;
    try {
      return D.contrastarSegundaFuente(sitio, segunda, g.criterioRecurso, g.potenciaPicoKWp);
    } catch (err) {
      return null;
    }
  }

  // Plano de NASA POWER más parecido a la inclinación del sitio.
  function planoNasaParaSitio(sitio) {
    let mejor = 'latitud', menor = Infinity;
    Object.keys(PLANOS_NASA).forEach(k => {
      const d = Math.abs(PLANOS_NASA[k].angulo(sitio.latitud) - sitio.inclinacionGrados);
      if (d < menor) { menor = d; mejor = k; }
    });
    return mejor;
  }

  function renderizarSegundaFuente(g) {
    const caja = $('segundaFuenteGenerador');
    const sitio = g.sitio;
    const c = g.segundaFuente;
    const boton = '<button type="button" class="btn btn-secondary btn-small" id="btnSegundaFuente">Consultar NASA POWER para este sitio</button>';
    let html = '<h2>Contraste con una segunda fuente</h2>';
    if (sitio.casoPrueba) {
      html += '<p class="nota">El caso de prueba trae valores declarados; no se contrasta con otra fuente.</p>';
    } else if (sitio.consultaEnLinea) {
      html += '<p class="nota">El recurso de este sitio ya viene de NASA POWER. Para contrastarlo, elija en la lista un sitio de la base local (PVGIS) en la misma ubicación.</p>';
    } else if (!c) {
      html += '<p class="nota">Este sitio no tiene todavía una segunda fuente guardada. Consulte NASA POWER para comparar la irradiación y la potencia pico.</p>' + boton;
    } else {
      const est = c.dentroDeTolerancia ? 'cumple' : 'no_cumple';
      const signo = v => (v >= 0 ? '+' : '') + fmt(v, 1) + ' %';
      const usado = c.criterioRecurso === 'anual' ? 'promedio anual' : 'mes de menor recurso';
      html += `
        <div class="table-wrap"><table class="tabla-contraste">
          <thead><tr><th>Dato</th><th>${escapar(fuenteBreve(sitio.fuente))}</th><th>${escapar(fuenteBreve(c.fuente))}</th><th>Diferencia</th></tr></thead>
          <tbody>
            <tr><td>Irradiación promedio anual</td><td>${fmt(c.anual.principal, 2)} kWh/m²·día</td><td>${fmt(c.anual.segunda, 2)} kWh/m²·día</td><td>${signo(c.anual.difPct)}</td></tr>
            <tr><td>Mes de menor recurso</td><td>${fmt(c.critico.principal, 2)} (${escapar(c.critico.mesPrincipal)})</td><td>${fmt(c.critico.segunda, 2)} (${escapar(c.critico.mesSegunda)})</td><td>${signo(c.critico.difPct)}</td></tr>
            <tr class="is-selected"><td><strong>Potencia pico</strong> (${usado})</td><td><strong>${fmt(c.potencia.principal, 2)} kWp</strong></td><td><strong>${fmt(c.potencia.segunda, 2)} kWp</strong></td><td class="estado-${est}"><strong>${signo(c.potencia.difPct)}</strong></td></tr>
          </tbody>
        </table></div>
        <p class="veredicto-contraste estado-${est}">${c.dentroDeTolerancia
          ? '✓ La potencia pico con la segunda fuente difiere ' + signo(c.potencia.difPct) + ': está dentro de la diferencia aceptada de ±' + c.toleranciaPct + ' %.'
          : '✗ La potencia pico con la segunda fuente difiere ' + signo(c.potencia.difPct) + ': supera la diferencia aceptada de ±' + c.toleranciaPct + ' %. Revise el sitio, la inclinación o la fuente.'}</p>
        <p class="nota">Segunda fuente: ${escapar(c.fuente)}${c.fechaConsulta ? ' · consulta ' + escapar(c.fechaConsulta) : ''}${c.enLinea ? ' (consultada en línea en esta sesión)' : ' (guardada en la base local)'}. La potencia pico es inversa a la irradiación: Ppico₂ = Ppico₁ · HSP₁ / HSP₂.</p>
        ${boton}`;
    }
    html += '<p class="status" id="estadoSegundaFuente" role="status"></p>';
    caja.innerHTML = html;
    caja.hidden = false;
    const btn = $('btnSegundaFuente');
    if (btn) btn.addEventListener('click', () => consultarSegundaFuente(sitio));
  }

  function fuenteBreve(fuente) {
    const t = String(fuente || '');
    if (/PVGIS/i.test(t)) return 'PVGIS (principal)';
    if (/NASA/i.test(t)) return 'NASA POWER';
    return t.split(/[,(]/)[0].trim() || 'Fuente principal';
  }

  async function consultarSegundaFuente(sitio) {
    const plano = planoNasaParaSitio(sitio);
    mostrarEstado('estadoSegundaFuente', 'Consultando NASA POWER…', '');
    try {
      if (typeof window.fetch !== 'function') throw new Error('este navegador no permite consultas en línea');
      const r = await consultarNasaPower(sitio.latitud, sitio.longitud, plano);
      segundasEnLinea[sitio.id] = {
        fuente: r.fuente.replace(', consulta en línea', ''),
        inclinacionGrados: r.inclinacionGrados,
        irradiacionAnual: r.irradiacionAnual,
        mensual: r.mensual,
        fechaConsulta: r.fechaConsulta,
        enLinea: true,
      };
      dimensionar(true);
      mostrarEstado('estadoSegundaFuente', 'Contraste actualizado con la consulta en línea (plano a ' + fmt(r.inclinacionGrados, 1) + '°).', 'ok');
    } catch (err) {
      mostrarEstado('estadoSegundaFuente', 'No se pudo consultar NASA POWER (' + (err.message || 'error de red') + ').' +
        (sitio.segundaFuente ? ' Se mantiene el contraste con los valores guardados en la base local.' : ' Intente más tarde; el dimensionamiento no cambia.'), 'error');
    }
  }

  function avisarConversion() {
    if (window.UIConversion) window.UIConversion.alCambiarGenerador();
  }

  function limpiarResultadosGenerador() {
    estado.generador = null;
    $('resultadosGenerador').hidden = true;
  }

  function aplicarAjusteConversion(ajuste) {
    // El ajuste conserva el módulo que ya se había elegido: agregar paneles o
    // reorganizarlos no debe cambiar la referencia del panel.
    ajusteConversion = ajuste && (ajuste.potenciaMinimaKWp > 0 || ajuste.modulosSerieFijo > 0)
      ? { potenciaMinimaKWp: ajuste.potenciaMinimaKWp || null, modulosSerieFijo: ajuste.modulosSerieFijo || null,
          moduloId: ajuste.moduloId || (estado.generador && estado.generador.seleccion ? estado.generador.seleccion.modulo.id : null) }
      : null;
    dimensionar(true);
  }

  function renderizarAjuste(g) {
    const caja = $('ajusteConversion');
    if (!ajusteConversion) { caja.hidden = true; caja.innerHTML = ''; return; }
    const partes = [];
    if (g.ajustePorCierre) partes.push('se dimensiona con <strong>' + fmt(g.potenciaDimensionadoKWp, 2) + ' kWp</strong>, la potencia requerida por el balance de cierre (la calculada aquí es ' + fmt(g.potenciaPicoKWp, 2) + ' kWp)');
    if (g.modulosSerieFijo) partes.push('se usan <strong>' + g.modulosSerieFijo + ' módulos en serie</strong> por cadena para que el equipo de conversión los admita');
    if (ajusteConversion.moduloId && g.seleccion && g.seleccion.modulo.id === ajusteConversion.moduloId && $('genCriterioModulo').value !== 'manual') partes.push('se mantiene el módulo ' + g.seleccion.modulo.fabricante + ' ' + g.seleccion.modulo.modelo);
    if (partes.length === 0) partes.push('el ajuste ya no cambia el generador, porque la potencia calculada aquí es mayor que la requerida');
    caja.innerHTML = '<strong>Ajuste aceptado en el paso de conversión y almacenamiento:</strong> ' + partes.join('; ') + '. ' +
      '<button type="button" class="btn-enlace" id="btnQuitarAjuste">Quitar ajuste</button>';
    caja.hidden = false;
    $('btnQuitarAjuste').addEventListener('click', () => aplicarAjusteConversion(null));
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

    // Advertencias
    const avisos = g.advertencias.slice();
    if (g.contingencia) avisos.unshift('La consulta en línea falló (' + g.contingencia.motivo + '); se usó la base de datos local.');
    $('avisosGenerador').innerHTML = avisos.length
      ? '<strong>Advertencias:</strong><ul>' + avisos.map(a => '<li>' + escapar(a) + '</li>').join('') + '</ul>'
      : '';
    $('avisosGenerador').hidden = avisos.length === 0;
    renderizarAjuste(g);

    // Resultado principal
    $('indicadoresGenerador').innerHTML = tarjetas([
      ['Potencia pico ' + (g.metodo.id === 'balance' ? 'de diseño' : 'necesaria'), fmt(g.potenciaPicoKWp, 2) + ' kWp', 'por ' + etiquetaRecurso + (g.metodo.id === 'balance' ? ' · método propio' : '')],
      ['Irradiación usada', fmt(g.hspUsada, 2) + ' kWh/m²', 'por día · PR ' + fmt(g.pr, 2)],
      ['Módulos', s.numeroModulos + ' × ' + m.potenciaW + ' Wp', m.fabricante + ' ' + m.modelo],
      ['Potencia instalada', fmt(s.potenciaInstaladaW / 1000, 2) + ' kWp', (s.excedenteW >= 0 ? '+' : '') + fmt(s.excedenteW / 1000, 3) + ' kWp (' + (s.excedentePct >= 0 ? '+' : '') + fmt(s.excedentePct, 1) + ' %)'],
      ['Energía generada', fmt(g.energiaGeneradaDiariaKWh, 2) + ' kWh/día', 'cubre el ' + fmt(g.coberturaPct, 0) + ' % de Ed (prom. anual)'],
    ]);

    const mt = g.metodo;
    if (mt.id === 'balance') {
      $('comparacionMetodo').innerHTML =
        '<strong>Método propio: balance día/noche con factor de crecimiento y meta de cobertura.</strong>' + (mt.etaBat === 1 ? ' Sin almacenamiento (η_bat = 1).' : '') + '<br>' +
        'E_eq = E_día + E_noche / η_bat = ' + fmt(mt.eDiaKWh, 3) + ' + ' + fmt(mt.eNocheKWh, 3) + ' / ' + fmt(mt.etaBat, 2) +
        ' = <strong>' + fmt(mt.energiaEquivalenteKWh, 3) + ' kWh/día</strong>. ' +
        'Fc = 1 + g = ' + fmt(mt.fc, 2) + ' · Cob = ' + mt.coberturaPct + ' % → E_diseño = Fc · Cob · E_eq = <strong>' + fmt(mt.energiaDisenoKWh, 3) + ' kWh/día</strong>.<br>' +
        'Potencia pico con la misma irradiación: método de referencia <strong>' + fmt(mt.potenciaReferenciaKWp, 2) + ' kWp</strong> · ' +
        'balance sin crecimiento <strong>' + fmt(mt.potenciaBalanceKWp, 2) + ' kWp</strong> · ' +
        'diseño con crecimiento y cobertura <strong>' + fmt(mt.potenciaDisenoKWp, 2) + ' kWp</strong>.';
      $('comparacionMetodo').hidden = false;
    } else {
      $('comparacionMetodo').innerHTML = '';
      $('comparacionMetodo').hidden = true;
    }

    const comparacion = 'Por promedio anual se requieren <strong>' + fmt(g.potenciaPicoAnualKWp, 2) + ' kWp</strong>; por el mes de menor recurso, <strong>' + fmt(g.potenciaPicoCriticoKWp, 2) + ' kWp</strong>. ';
    const porQue = g.modoSeleccion === 'manual'
      ? 'La referencia se eligió manualmente.'
      : 'Criterio de selección: <strong>' + escapar(g.criterio.nombre) + '</strong>. ' + escapar(g.criterio.explicacion);
    $('explicacionSeleccion').innerHTML = comparacion + porQue;

    // Configuración eléctrica
    $('configuracionGenerador').innerHTML = tarjetas([
      ['Configuración', s.cadenasParalelo + (s.cadenasParalelo === 1 ? ' cadena' : ' cadenas') + ' de ' + s.modulosSerie, 'máx. ' + s.maxModulosSerie + ' en serie con ' + g.parametros.vMaxSistema + ' V'],
      ['Voc del generador', fmt(s.vocGeneradorTminV, 1) + ' V', 'a ' + g.parametros.tMinC + ' °C (módulo ' + fmt(s.vocModuloTminV, 2) + ' V)'],
      ['Vmp del generador', fmt(s.vmpGeneradorOperacionV, 1) + ' V', 'celda a ' + fmt(s.temperaturaCeldaC, 1) + ' °C'],
      ['Isc del generador', fmt(s.iscGeneradorA, 1) + ' A', s.cadenasParalelo + ' × ' + fv(m.iscA) + ' A'],
      ['Corriente de diseño', fmt(s.corrienteDisenoA, 1) + ' A', '1,25 × 1,25 × Isc (NTC 2050)'],
      ['Área ocupada', fmt(s.areaGeneradorM2, 2) + ' m²', s.cabeEnArea ? 'cabe en ' + g.parametros.areaDisponibleM2 + ' m²' : 'NO cabe en ' + g.parametros.areaDisponibleM2 + ' m²'],
    ]);

    // Catálogo evaluado (filtrar, seleccionar, cuantificar)
    $('cuerpoCatalogo').innerHTML = g.evaluaciones.map(e => {
      const mod = e.modulo;
      const nombre = escapar(mod.fabricante + ' ' + mod.modelo) + (mod.referenciaTdR ? ' <span class="etiqueta-ref">caso de prueba</span>' : '');
      if (!e.viable) {
        return `<tr class="fila-descartada"><td>${nombre}</td><td>${mod.potenciaW}</td><td>${e.maxModulosSerie}</td><td colspan="5">—</td><td>Descartado: ${escapar(e.motivoDescarte)}</td></tr>`;
      }
      let estadoFila = e.id === s.id ? '<strong>Seleccionado</strong>' : (mod.referenciaTdR ? 'Solo manual' : 'Viable');
      if (e.cabeEnArea === false) estadoFila += ' · no cabe';
      return `<tr class="${e.id === s.id ? 'is-selected' : ''}">
        <td>${nombre}</td><td>${mod.potenciaW}</td><td>${e.maxModulosSerie}</td><td>${e.numeroModulos}</td>
        <td>${e.cadenasParalelo} × ${e.modulosSerie}</td><td>${fmt(e.potenciaInstaladaW / 1000, 3)} kWp</td>
        <td>${e.excedentePct >= 0 ? '+' : ''}${fmt(e.excedentePct, 1)} %</td><td>${fmt(e.areaGeneradorM2, 2)} m²</td><td>${estadoFila}</td></tr>`;
    }).join('');

    renderizarSegundaFuente(g);

    // Supuestos (todos visibles)
    $('listaSupuestos').innerHTML = (g.supuestos || []).map(sp => '<li>' + escapar(sp.texto) + '</li>').join('');

    $('resultadosGenerador').hidden = false;
  }

  function supuestos(g) {
    const s = g.seleccion;
    return [
      g.metodo.id === 'balance'
        ? { id: 'potencia', texto: 'Potencia pico (método propio): Ppico = Fc · E_eq / (HSP · PR) = ' + fmt(g.metodo.fc, 2) + ' · ' + fmt(g.metodo.energiaEquivalenteKWh, 3) + ' / (' + fmt(g.hspUsada, 2) + ' · ' + fmt(g.pr, 2) + ') = ' + fmt(g.potenciaPicoKWp, 3) + ' kWp. Con el método de referencia serían ' + fmt(g.metodo.potenciaReferenciaKWp, 3) + ' kWp.' }
        : { id: 'potencia', texto: 'Potencia pico: Ppico = Ed / (HSP · PR) = ' + fmt(estado.resultados.energiaDiariaKWh, 3) + ' / (' + fmt(g.hspUsada, 2) + ' · ' + fmt(g.pr, 2) + ') = ' + fmt(g.potenciaPicoKWp, 3) + ' kWp.' },
      ...(g.metodo.id === 'balance' ? [
        { id: 'balance', texto: 'Energía equivalente: E_eq = E_día + E_noche / η_bat = ' + fmt(g.metodo.eDiaKWh, 3) + ' + ' + fmt(g.metodo.eNocheKWh, 3) + ' / ' + fmt(g.metodo.etaBat, 2) + ' = ' + fmt(g.metodo.energiaEquivalenteKWh, 3) + ' kWh/día. ' + (g.metodo.etaBat === 1 ? 'Sin almacenamiento (η_bat = 1): la energía nocturna se cuenta sin pérdidas porque la cubre otra fuente.' : 'Se supone que toda la energía nocturna pasa por la batería y que la diurna se consume directo.') },
        { id: 'etaBat', texto: 'Eficiencia de ida y vuelta de la batería η_bat = ' + fmt(g.metodo.etaBat, 2) + (g.fuenteEtaBat ? '. Fuente: ' + g.fuenteEtaBat : '') + '.' },
        { id: 'crecimiento', texto: 'Factor de crecimiento Fc = 1 + g = ' + fmt(g.metodo.fc, 2) + ' (g = ' + g.metodo.crecimientoPct + ' %)' + (g.justificacionCrecimiento ? '. Justificación: ' + g.justificacionCrecimiento : (g.metodo.crecimientoPct > 0 ? '. Sin justificación registrada' : '')) + '.' },
        { id: 'cobertura', texto: 'Meta de cobertura Cob = ' + g.metodo.coberturaPct + ' % de la energía (kWh) que consumen las cargas; se aplica a la energía y no al valor de la factura. ' + (g.metodo.coberturaPct < 100 ? 'El resto lo debe cubrir otra fuente (red o planta).' : 'El generador cubre toda la energía.') },
      ] : []),
      { id: 'pr', texto: 'El factor global de desempeño (PR = ' + fmt(g.pr, 2) + ') agrupa las pérdidas por temperatura, suciedad, cableado y conversión.' },
      { id: 'recurso', texto: 'Recurso solar: ' + g.sitio.nombre + ', irradiación sobre el plano del generador (' + g.sitio.inclinacionGrados + '°, azimut ' + g.sitio.azimutGrados + '°). Fuente: ' + g.sitio.fuente + ' (' + g.sitio.fechaConsulta + ').' },
      { id: 'voc', texto: 'Voc corregido a la temperatura mínima: Voc · [1 + β (Tmin − 25)], con β = ' + fv(s.modulo.coefVocPctC) + ' %/°C.' },
      { id: 'celda', texto: 'Temperatura de celda con el modelo ' + s.modulo.tipoTemperaturaNominal + ': Tamb + (' + s.modulo.tipoTemperaturaNominal + ' − 20) / 800 · 1000 W/m² = ' + fmt(s.temperaturaCeldaC, 1) + ' °C.' },
      { id: 'vmp', texto: 'Vmp en operación corregido con el coeficiente de temperatura de la tensión (β).' },
      { id: 'corriente', texto: 'Corriente de diseño = 1,25 · 1,25 · Isc del generador, según NTC 2050 art. 690-8.' },
      { id: 'cadenas', texto: 'Todas las cadenas tienen el mismo número de módulos.' },
      { id: 'energia', texto: 'La energía generada se estima con el promedio anual: Pinstalada · HSPanual · PR. En el mes crítico serían ' + fmt(g.energiaGeneradaMesCriticoKWh, 2) + ' kWh/día (' + fmt(g.coberturaMesCriticoPct, 0) + ' % de Ed).' },
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
    if (!estado.resultados) { limpiarResultadosGenerador(); avisarConversion(); return; }
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
      ajusteConversion,
    };
  }

  function aplicarConfiguracion(cfg) {
    // Cada proyecto trae su propia justificación; si no trae, el cuadro queda vacío
    // para no arrastrar la de otro caso.
    $('genJustificacion').value = (cfg && typeof cfg.justificacionGrupo === 'string') ? cfg.justificacionGrupo.slice(0, 400) : '';
    actualizarContadorJustificacion();
    if (!cfg) {
      // Un proyecto sin configuración del generador vuelve al método de referencia.
      ajusteConversion = null;
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
    ajusteConversion = cfg.ajusteConversion && (cfg.ajusteConversion.potenciaMinimaKWp > 0 || cfg.ajusteConversion.modulosSerieFijo > 0)
      ? cfg.ajusteConversion : null;
    if (cfg.dimensionado) dimensionar(true);
  }

  window.UIGenerador = {
    alCambiarConsumo,
    obtenerConfiguracion,
    aplicarConfiguracion,
    dimensionar,
    aplicarAjusteConversion,
    obtenerAjusteConversion: () => ajusteConversion,
    datosListos: cargarDatos(),
  };

  renderizarHeredados();
})();
