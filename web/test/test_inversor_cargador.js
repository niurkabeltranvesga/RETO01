// test_inversor_cargador.js
//
// Equipo que carga las baterías: inversor-cargador con MPPT integrado (todo en
// uno) o regulador MPPT aparte. Revisa los cálculos (entrada solar, potencia FV,
// potencia de salida, tensión del banco, unidades en paralelo) y la interfaz:
// selector, proyectos guardados antes de la opción, informe, exportación y
// guardado del proyecto.
//
// Uso (desde la carpeta web/):  npm install jsdom   y luego   node test/test_inversor_cargador.js

const fs = require('fs');
const path = require('path');
const C = require('../conversion.js');

const RAIZ = path.join(__dirname, '..');
const leer = f => fs.readFileSync(path.join(RAIZ, f), 'utf-8');
const catalogo = JSON.parse(leer('datos/catalogo_equipos.json'));

let fallas = 0;
function ok(condicion, mensaje) {
  console.log((condicion ? '  ok    ' : '  FALLA ') + mensaje);
  if (!condicion) fallas++;
}
function leerBlob(b, win) {
  if (typeof b.text === 'function') return b.text();
  return new Promise(res => { const fr = new win.FileReader(); fr.onload = () => res(fr.result); fr.readAsText(b); });
}

console.log('=== 1. Catálogo ===');
const ic = catalogo.inversoresCargadores || [];
ok(ic.length === 3 && ic.every(e => e.fabricante === 'Must Solar'), 'tres inversores-cargadores Must PV18 (3, 4 y 5 kW a 48 V)');
ok(!catalogo.reguladores.some(e => e.id === 'must-pv18-3048-vpm'), 'el PV18-3048 ya no está en la lista de reguladores');
ok(ic.every(e => e.vocMaxV === 145 && e.mpptMinV === 60 && e.mpptMaxV === 130 && e.corrienteSalidaA === 80 && e.potenciaFvMaxW === 4000 && e.maxParalelo === 3),
  'datos de la ficha: 145 V, ventana 60–130 V, 80 A, 4.000 W FV, hasta 3 en paralelo');
ok(ic.map(e => e.pacW).join(',') === '3000,4000,5000' && ic.map(e => e.potenciaPicoVA).join(',') === '6000,8000,10000', 'potencia nominal y de pico de cada modelo');

console.log('\n=== 2. Cálculos ===');
const modulo = { potenciaW: 450, vocV: 49.5, vmpV: 41.5, iscA: 11.5, impA: 10.85, coefVocPctC: -0.27 };
const base = {
  rama: 'con', catalogo, energiaDiariaKWh: 8, demandaMaximaW: 2500, hspAnual: 5, hspCritico: 4.4, pr: 0.75, criterioRecurso: 'critico',
  etaInv: 0.9, vNominalV: 48, vBancoV: 51.2, autonomiaDias: 1, modoAutonomia: 'dias', dodPct: 80, fT: 1, etaBat: 0.95,
  bateria: catalogo.baterias.find(b => b.id === 'felicity-lpbf48100-m'),
};
const gen = (ns, np) => ({ modulo, modulosSerie: ns, cadenasParalelo: np, tMinC: 18, tCeldaC: 55 });
const calc = extra => C.dimensionarConversion(Object.assign({}, base, extra));

let r = calc({ generador: gen(2, 4), equipoCarga: 'todoEnUno' });
ok(r.tipoEquipo === 'inversorCargador' && r.equipoCarga === 'todoEnUno', 'con «todo en uno» se revisan inversores-cargadores, no reguladores');
ok(r.seleccion && r.seleccion.equipo.id === 'must-pv18-3048-vpm' && r.seleccion.unidades === 1 && r.seleccion.veredicto === 'cumple',
  'demanda 2.500 W y 3,6 kWp: elige 1 × PV18-3048 VPM (el más pequeño que cubre la demanda)');
const crit = id => r.seleccion.criterios.find(c => c.id === id);
ok(Math.abs(crit('salida').valor - 3600 / 48) < 1e-9 && crit('salida').estado === 'cumple', 'corriente al banco 75 A ≤ 80 A');
ok(crit('pfv').valor === 3600 && crit('pfv').estado === 'cumple', 'potencia FV 3.600 W ≤ 4.000 W');
ok(crit('pac').valor === 3000 && crit('pac').limite === 2500 && crit('pac').estado === 'cumple', 'potencia de salida 3.000 W ≥ 2.500 W de demanda');
ok(crit('tensionBanco').estado === 'cumple', 'el sistema de 48 V es admitido');

r = calc({ generador: gen(2, 4), equipoCarga: 'todoEnUno', demandaMaximaW: 7000 });
ok(r.seleccion.unidades === 2 && r.seleccion.equipo.id === 'must-pv18-4048-vpm' && r.seleccion.potenciaSalidaW === 8000,
  'demanda 7.000 W: 2 × PV18-4048 (8.000 W) antes que 3 × PV18-3048 (menos equipos)');

r = calc({ generador: gen(2, 4), equipoCarga: 'todoEnUno', demandaMaximaW: 16000 });
const v16 = r.verificaciones[0];
ok(!r.seleccion && v16.criterios.find(c => c.id === 'pac').estado === 'no_cumple', 'demanda 16.000 W: ninguno alcanza ni con 3 en paralelo');
ok(v16.propuesta && !v16.propuesta.posible && /Reorganizar los paneles no lo resuelve/.test(v16.propuesta.motivo), 'no propone reorganizar paneles cuando falta potencia de salida');

r = calc({ generador: gen(2, 6), equipoCarga: 'todoEnUno' });
ok(r.seleccion.unidades === 2 && r.seleccion.grupos.join('+') === '3+3' && r.seleccion.potenciaGrupoW === 2700,
  '5,4 kWp supera los 4.000 W FV de un equipo: 2 en paralelo con 3 + 3 cadenas');

r = calc({ generador: gen(3, 2), equipoCarga: 'todoEnUno' });
ok(!r.seleccion && r.verificaciones[0].criterios.find(c => c.id === 'voc').estado === 'no_cumple' && r.verificaciones[0].propuesta.posible && r.verificaciones[0].propuesta.ns === 2,
  '3 módulos en serie pasan los 145 V: propone cadenas de 2');

r = calc({ generador: gen(2, 4), equipoCarga: 'todoEnUno', vNominalV: 24, vBancoV: 25.6, bateria: catalogo.baterias.find(b => b.id === 'victron-lfp-smart-25-6-200') });
ok(r.verificaciones.every(v => v.criterios.find(c => c.id === 'tensionBanco').estado === 'no_cumple'), 'sistema de 24 V: los PV18 de 48 V no cumplen');

r = calc({ generador: gen(2, 4), equipoCarga: 'regulador' });
ok(r.tipoEquipo === 'regulador' && r.seleccion.equipo.id.startsWith('victron'), 'con «regulador aparte» se revisan los reguladores, como antes');
const r0 = calc({ generador: gen(2, 4) });
ok(r0.tipoEquipo === 'regulador' && r0.seleccion.equipo.id === r.seleccion.equipo.id, 'sin indicar el equipo (proyectos anteriores) se usa el regulador');
ok(calc({ generador: gen(2, 4), equipoCarga: 'todoEnUno' }).banco.numeroBaterias === r.banco.numeroBaterias, 'el banco de baterías no cambia con el tipo de equipo');

console.log('\n=== 3. Interfaz ===');
(async () => {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM(leer('index.html'), { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true });
  const w = dom.window, doc = w.document;
  w.fetch = async () => { throw new TypeError('sin servidor'); };
  let paginas = 0;
  const textos = [];
  w.jspdf = { jsPDF: function () { paginas = 1; return { setFillColor(){}, rect(){}, setFont(){}, setFontSize(){}, setTextColor(){}, text(t){ textos.push([].concat(t).join(' ')); }, roundedRect(){}, circle(){}, setDrawColor(){}, line(){}, addPage(){ paginas++; }, save(){}, splitTextToSize(t){ return [t]; }, setLineWidth(){}, getTextWidth(t){ return String(t).length * 2; }, getNumberOfPages(){ return paginas || 1; }, setPage(){}, setLineDashPattern(){}, triangle(){}, setGState(){}, GState: function () {} }; } };
  let descargado = null;
  w.URL.createObjectURL = b => { descargado = b; return 'blob:prueba'; };
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () {};
  ['motorCalculo.js', 'medicion.js', 'dimensionamiento.js', 'datos/datos_respaldo.js', 'informe.js', 'informeResumen.js', 'exportar.js', 'asistente.js', 'app.js', 'generador.js', 'conversion.js', 'pasoConversion.js']
    .forEach(f => w.eval(leer(f)));
  await w.UIGenerador.datosListos;
  await w.UIConversion.datosListos;
  const $ = id => doc.getElementById(id);
  const E = w.__estadoAppReto01;
  const esperar = () => new Promise(res => setTimeout(res, 30));
  const click = id => $(id).dispatchEvent(new w.Event('click', { bubbles: true }));
  const marcar = valor => { const radio = doc.querySelector('input[name="equipoCarga"][value="' + valor + '"]'); radio.checked = true; radio.dispatchEvent(new w.Event('change', { bubbles: true })); };
  async function cargarProyecto(contenido, nombre) {
    E.generador = null; E.conversion = null;
    const archivo = new w.File([contenido], nombre, { type: 'application/json' });
    Object.defineProperty($('inputCargarArchivo'), 'files', { value: [archivo], configurable: true });
    $('inputCargarArchivo').dispatchEvent(new w.Event('change'));
    for (let i = 0; i < 50 && !E.conversion; i++) await esperar();
    await esperar();
  }

  const casoPrueba = leer('ejemplos/caso_prueba_alta_guajira.json');
  await cargarProyecto(casoPrueba, 'caso_prueba_alta_guajira.json');
  let res = E.conversion.resultado;
  ok(res.rama === 'con' && res.tipoEquipo === 'regulador' && res.seleccion.equipo.id === 'ctrl-b', 'el caso de prueba guardado antes de la opción sigue con el regulador CTRL-B');
  ok(doc.querySelector('input[name="equipoCarga"]:checked').value === 'regulador' && !$('convSelectorCarga').hidden, 'el selector muestra «Regulador MPPT aparte»');

  marcar('todoEnUno');
  res = E.conversion.resultado;
  console.log('  Todo en uno: ' + res.verificaciones.map(v => v.unidades + ' × ' + v.equipo.modelo + ' ' + v.veredicto + ' (' + v.criterios.filter(c => c.estado === 'no_cumple').map(c => c.id).join(', ') + ')').join(' | ') + ' | elegido: ' + (res.seleccion ? res.seleccion.equipo.modelo : 'ninguno'));
  ok(res.tipoEquipo === 'inversorCargador' && res.verificaciones.length === 3, 'al elegir «todo en uno» se revisan los inversores-cargadores');
  ok(/PV18-3048 VPM/.test($('convTarjetasEquipos').textContent) && !/SmartSolar/.test($('convTarjetasEquipos').textContent), 'las tarjetas muestran inversores-cargadores y no reguladores');
  ok(/trae el regulador MPPT por dentro/.test($('convAyudaEquipos').textContent), 'la ayuda explica que el regulador viene dentro');
  ok(/Potencia de salida/.test($('convCabeceraEquipos').textContent) && /Potencia FV/.test($('convCabeceraEquipos').textContent), 'la tabla técnica tiene potencia FV y potencia de salida');
  ok(E.conversion.supuestos.some(s => /Inversor-cargador: su entrada solar se verifica como un regulador/.test(s)), 'los supuestos explican cómo se verifica el inversor-cargador');
  ok(res.banco && res.banco.numeroBaterias > 0, 'el banco de baterías se sigue calculando');

  click('btnGenerarInforme');
  ok(paginas >= 4 && textos.some(t => /Inversor-cargador seleccionado/.test(t)), 'el informe completo incluye la sección del inversor-cargador (' + paginas + ' páginas)');
  textos.length = 0;
  click('btnGenerarResumen');
  ok(textos.some(t => /inversor-cargador y banco de baterías/.test(t)), 'el informe de una página dice que el sistema usa un inversor-cargador');

  click('btnExportarCSV');
  const csv = await leerBlob(descargado, w);
  ok(/Equipo que carga las baterías;inversor-cargador \(todo en uno\)/.test(csv), 'el CSV indica el equipo que carga las baterías');

  click('btnGuardarArchivo');
  const guardado = JSON.parse(await leerBlob(descargado, w));
  ok(guardado.conversion.equipoCarga === 'todoEnUno', 'el proyecto guarda la opción elegida');
  marcar('regulador');
  await cargarProyecto(JSON.stringify(guardado), 'guardado.json');
  ok(E.conversion.resultado.tipoEquipo === 'inversorCargador' && doc.querySelector('input[name="equipoCarga"]:checked').value === 'todoEnUno', 'al abrir el proyecto se recupera «todo en uno»');

  const viejo = JSON.parse(casoPrueba);
  viejo.conversion.reguladorId = 'must-pv18-3048-vpm';
  await cargarProyecto(JSON.stringify(viejo), 'viejo_pv18.json');
  ok(E.conversion.resultado.tipoEquipo === 'inversorCargador' && E.conversion.resultado.modoSeleccion === 'manual' && E.conversion.resultado.seleccion.equipo.id === 'must-pv18-3048-vpm',
    'un proyecto que tenía el PV18 como regulador abre con el PV18 como inversor-cargador');

  const sinLista = JSON.parse(leer('datos/catalogo_equipos.json'));
  delete sinLista.inversoresCargadores;
  const archivoCat = new w.File([JSON.stringify(sinLista)], 'catalogo_viejo.json', { type: 'application/json' });
  Object.defineProperty($('inputCatalogoEquipos'), 'files', { value: [archivoCat], configurable: true });
  $('inputCatalogoEquipos').dispatchEvent(new w.Event('change'));
  for (let i = 0; i < 20 && !/cargado/.test($('estadoCatalogoEquipos').textContent); i++) await esperar();
  ok(/cargado/.test($('estadoCatalogoEquipos').textContent), 'un catálogo editado sin la lista nueva se sigue aceptando');
  marcar('todoEnUno');
  ok(/no tiene inversores-cargadores/.test($('estadoConv').textContent), 'y avisa que no tiene inversores-cargadores');
  marcar('regulador');
  ok(E.conversion && E.conversion.resultado.tipoEquipo === 'regulador', 'con ese catálogo el regulador aparte sigue funcionando');

  console.log(fallas ? '\n' + fallas + ' prueba(s) fallaron.' : '\n=== TODAS LAS PRUEBAS DEL INVERSOR-CARGADOR PASARON ===');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
