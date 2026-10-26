// test_consulta_nasa.js
//
// Prueba de la consulta en línea del recurso solar (NASA POWER) en el Paso 4.
// No se conecta a internet: simula la respuesta del servicio con una respuesta
// real guardada (Universidad del Magdalena, Santa Marta) y comprueba que:
//   1. la irradiación sobre el plano elegido llega al dimensionamiento,
//   2. la fuente y la fecha quedan registradas,
//   3. si el servicio falla, se sigue con la base local y se declara la contingencia.
//
// Uso (desde la carpeta web/):  npm install jsdom   y luego   node test/test_consulta_nasa.js

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RAIZ = path.join(__dirname, '..');
const leer = f => fs.readFileSync(path.join(RAIZ, f), 'utf-8');

// Respuesta real de NASA POWER (API de climatología v2.10.1) para lat 11.22, lon -74.19,
// parámetro SI_EF_TILTED_SURFACE. Solo se dejan las series que usa la aplicación.
const RESPUESTA_NASA = {
  type: 'Feature',
  properties: { parameter: {
    SI_TILTED_AVG_HORIZONTAL: { JAN: 5.4886, FEB: 5.9467, MAR: 6.0701, APR: 5.8106, MAY: 5.2574, JUN: 5.4019, JUL: 5.6232, AUG: 5.6078, SEP: 5.3722, OCT: 4.8948, NOV: 4.7021, DEC: 5.0489, ANN: 5.4353 },
    SI_TILTED_AVG_LATITUDE: { JAN: 5.9772, FEB: 6.2705, MAR: 6.1565, APR: 5.7065, MAY: 5.0645, JUN: 5.1446, JUL: 5.3722, AUG: 5.4607, SEP: 5.3762, OCT: 5.0359, NOV: 4.9994, DEC: 5.5265, ANN: 5.5075 },
    SI_TILTED_AVG_LAT_PLUS15: { JAN: 6.3096, FEB: 6.3785, MAR: 5.975, APR: 5.3126, MAY: 4.5962, JUN: 4.5862, JUL: 4.8067, AUG: 5.0237, SEP: 5.1406, OCT: 4.9961, NOV: 5.1521, DEC: 5.8718, ANN: 5.3458 },
  } },
  header: {
    api: { version: 'v2.10.1', name: 'POWER Climatology API' },
    fill_value: -999.0,
    range: '25-year Meteorological and Solar Monthly & Annual Climatologies (January 2001 - December 2025)',
  },
};

function falla(msg) { throw new Error('FALLÓ: ' + msg); }

async function main() {
  const dom = new JSDOM(leer('index.html'), { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true });
  const { window } = dom;
  const doc = window.document;
  window.jspdf = { jsPDF: function () { return { setFillColor(){}, rect(){}, setFont(){}, setFontSize(){}, setTextColor(){}, text(){}, roundedRect(){}, circle(){}, setDrawColor(){}, line(){}, addPage(){}, save(){}, splitTextToSize(t){ return [t]; } }; } };

  // fetch simulado: responde lo que indique "modoServicio" y cuenta las llamadas
  let modoServicio = 'ok';
  const urlsPedidas = [];
  window.fetch = async (url) => {
    urlsPedidas.push(String(url));
    if (String(url).includes('datos/')) throw new TypeError('sin servidor'); // fuerza la copia de respaldo
    if (modoServicio === 'sin-red') throw new TypeError('Failed to fetch');
    return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(RESPUESTA_NASA)) };
  };

  ['motorCalculo.js', 'medicion.js', 'dimensionamiento.js', 'datos/datos_respaldo.js', 'informe.js', 'app.js', 'generador.js']
    .forEach(f => window.eval(leer(f)));
  await window.UIGenerador.datosListos;

  const setVal = (id, v) => { doc.getElementById(id).value = v; };
  const click = id => doc.getElementById(id).dispatchEvent(new window.Event('click', { bubbles: true }));
  const change = id => doc.getElementById(id).dispatchEvent(new window.Event('change', { bubbles: true }));
  const esperar = () => new Promise(r => setTimeout(r, 20));
  const estado = window.__estadoAppReto01;

  // Pasos 1 a 3 con un proyecto pequeño
  setVal('nombreProyecto', 'Prueba NASA POWER'); setVal('integrantes', 'prueba'); setVal('fechaProyecto', '24/10/2026');
  setVal('contexto', 'on-grid'); click('btnGuardarProyecto');
  [['nevera', 1, 150, h => true], ['computador', 2, 200, h => h >= 8 && h <= 17]].forEach(([d, c, p, f]) => {
    setVal('descCarga', d); setVal('cantCarga', c); setVal('potCarga', p);
    doc.querySelectorAll('#horarioGrid input[type=checkbox]').forEach(chk => { chk.checked = f(Number(chk.dataset.hora)); });
    click('btnAgregarCarga');
  });
  click('btnCalcular');
  if (!estado.resultados) falla('no se calcularon los resultados del Paso 3');

  console.log('=== 1. Consulta exitosa (inclinación igual a la latitud) ===');
  const sitiosAntes = doc.querySelectorAll('#selSitio option').length;
  setVal('apiLat', 11.22); setVal('apiLon', -74.19); setVal('apiIncl', 'latitud');
  click('btnConsultarApi'); await esperar();
  const url = urlsPedidas.find(u => u.includes('power.larc.nasa.gov'));
  if (!url) falla('no se llamó a NASA POWER');
  if (!url.includes('parameters=SI_EF_TILTED_SURFACE') || !url.includes('latitude=11.22') || !url.includes('longitude=-74.19')) falla('URL mal armada: ' + url);
  const sitio = doc.getElementById('selSitio').value;
  const s = estado.generador ? estado.generador.sitio : null;
  console.log('  Estado:', doc.getElementById('estadoApi').textContent);
  console.log('  Sitio seleccionado:', sitio);
  if (doc.querySelectorAll('#selSitio option').length !== sitiosAntes + 1) falla('el sitio consultado no se agregó a la lista');
  if (!sitio.startsWith('nasa-')) falla('no quedó seleccionado el sitio consultado');
  click('btnDimensionar');
  const g = estado.generador;
  if (!g) falla('no se dimensionó: ' + doc.getElementById('estadoGenerador').textContent);
  console.log('  Anual', g.sitio.irradiacionAnual, '| mensual', g.sitio.mensual.join(' '), '| plano', g.sitio.inclinacionGrados + '°, azimut', g.sitio.azimutGrados + '°');
  console.log('  Fuente:', g.sitio.fuente);
  if (g.sitio.irradiacionAnual !== 5.51) falla('anual esperado 5,51');
  if (g.sitio.mensual.length !== 12 || g.sitio.mensual[4] !== 5.06) falla('mensuales mal leídos');
  if (g.sitio.inclinacionGrados !== 11.2 || g.sitio.azimutGrados !== 0) falla('inclinación o azimut mal asignados');
  if (!g.sitio.fuente.includes('NASA POWER') || !g.sitio.fuente.includes('enero 2001 a diciembre 2025')) falla('fuente incompleta');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g.sitio.fechaConsulta)) falla('falta la fecha de consulta');
  if (g.contingencia) falla('no debía haber contingencia');
  console.log('  Ppico', g.potenciaPicoKWp.toFixed(2), 'kWp | módulos', g.seleccion.numeroModulos);

  console.log('\n=== 2. Otra inclinación y caché ===');
  setVal('apiIncl', 'latitud+15'); click('btnConsultarApi'); await esperar();
  const s15 = estado.generador.sitio;
  console.log('  Plano', s15.inclinacionGrados + '°, anual', s15.irradiacionAnual);
  if (s15.inclinacionGrados !== 26.2 || s15.irradiacionAnual !== 5.35) falla('latitud + 15 mal leída');
  const llamadas = urlsPedidas.filter(u => u.includes('power.larc')).length;
  setVal('apiIncl', 'latitud+15'); click('btnConsultarApi'); await esperar();
  if (urlsPedidas.filter(u => u.includes('power.larc')).length !== llamadas) falla('la caché no evitó repetir la consulta');
  if (!doc.getElementById('estadoApi').textContent.includes('caché')) falla('no se avisó que se usó la caché');
  console.log('  Repetir la misma consulta no volvió a llamar al servicio');

  console.log('\n=== 3. Sin conexión: contingencia ===');
  setVal('selSitio', 'unimagdalena-santa-marta'); change('selSitio');
  modoServicio = 'sin-red';
  setVal('apiLat', 4.6); setVal('apiLon', -74.08); setVal('apiIncl', 'latitud');
  click('btnConsultarApi'); await esperar();
  console.log('  Estado:', doc.getElementById('estadoApi').textContent);
  click('btnDimensionar');
  const gc = estado.generador;
  if (!gc || !gc.contingencia) falla('no se registró la contingencia');
  if (!gc.contingencia.motivo.includes('sin conexión')) falla('el motivo debía explicarse en español');
  if (gc.sitio.consultaEnLinea) falla('con la consulta fallida debía seguir con la base local');
  console.log('  Se continuó con:', gc.sitio.nombre, '| contingencia:', gc.contingencia.motivo);

  console.log('\nTodas las pruebas de la consulta en línea pasaron.');
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
