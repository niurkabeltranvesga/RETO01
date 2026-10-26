// test_escenario_f.js
//
// Escenario F (cafetería y tienda de alimentos en Cartagena, on-grid) de
// principio a fin, contra el cálculo a mano, y los casos borde de validación:
// carga desde el archivo incluido ejemplos/escenario_f_cartagena.json, requerimiento, generador con segunda fuente,
// rama de conversión, informe de una página, exportación CSV/JSON y mensajes
// de error concretos.
//
// Uso (desde la carpeta web/):  npm install jsdom   y luego   node test/test_escenario_f.js

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RAIZ = path.join(__dirname, '..');
const leer = f => fs.readFileSync(path.join(RAIZ, f), 'utf-8');
let fallas = 0;
function ok(condicion, texto) {
  console.log((condicion ? '  ok    ' : '  FALLA ') + texto);
  if (!condicion) fallas++;
}
const cerca = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-6);

// Cálculo a mano del escenario F
const CARGAS = [
  { n: 'Vitrinas refrigeradas', c: 3, w: 250, horas: [[8, 20]] },
  { n: 'Congelador', c: 1, w: 300, horas: [[6, 12], [18, 24]] },
  { n: 'Iluminación LED', c: 24, w: 18, horas: [[7, 21]] },
  { n: 'Aire acondicionado', c: 1, w: 1200, horas: [[10, 18]] },
  { n: 'Cajas registradoras y computadores', c: 2, w: 80, horas: [[7, 21]] },
  { n: 'Bomba presurizadora', c: 1, w: 1100, horas: [[6, 7], [16, 17]] },
];
const perfilMano = new Array(24).fill(0);
CARGAS.forEach(k => k.horas.forEach(([a, b]) => { for (let h = a; h < b; h++) perfilMano[h] += k.c * k.w; }));
const PINST = CARGAS.reduce((s, k) => s + k.c * k.w, 0);              // 3 942 W
const ED = perfilMano.reduce((a, b) => a + b, 0) / 1000;               // 32,688 kWh/día
const PPICO = ED / (5.26 * 0.70);                                      // PVGIS, promedio anual
const PPICO_NASA = ED / (4.99 * 0.70);                                 // NASA POWER, promedio anual

async function main() {
  const dom = new JSDOM(leer('index.html'), { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true });
  const w = dom.window, doc = w.document;
  w.fetch = async () => { throw new TypeError('sin servidor'); };
  let paginas = 0, maxY = 0;
  w.jspdf = { jsPDF: function () {
    paginas = 1; maxY = 0;
    const o = {};
    ['setFillColor', 'rect', 'setFont', 'setFontSize', 'setTextColor', 'roundedRect', 'circle', 'setDrawColor', 'line', 'save', 'setLineWidth', 'setPage'].forEach(k => { o[k] = () => {}; });
    o.text = (t, x, y) => { if (y < 285 && y > maxY) maxY = y; };
    o.addPage = () => { paginas++; };
    o.splitTextToSize = t => [String(t)];
    o.getTextWidth = t => String(t).length * 1.6;
    o.getNumberOfPages = () => paginas;
    return o;
  } };
  const descargas = [];
  w.URL.createObjectURL = b => { descargas.push(b); return 'blob:prueba'; };
  w.URL.revokeObjectURL = () => {};
  ['motorCalculo.js', 'medicion.js', 'dimensionamiento.js', 'datos/datos_respaldo.js', 'informe.js', 'informeResumen.js', 'exportar.js', 'app.js', 'generador.js', 'conversion.js', 'pasoConversion.js']
    .forEach(f => w.eval(leer(f)));
  await w.UIGenerador.datosListos;
  await w.UIConversion.datosListos;
  const $ = id => doc.getElementById(id);
  const E = w.__estadoAppReto01;
  const esperar = () => new Promise(r => setTimeout(r, 30));
  const click = id => $(id).dispatchEvent(new w.Event('click', { bubbles: true }));
  const poner = (id, v, ev) => { $(id).value = v; $(id).dispatchEvent(new w.Event(ev || 'change', { bubbles: true })); };

  console.log('=== 1. El escenario se carga desde el archivo incluido ===');
  click('btnComenzar');
  const archivoEscenario = new w.File([leer('ejemplos/escenario_f_cartagena.json')], 'escenario_f_cartagena.json', { type: 'application/json' });
  Object.defineProperty($('inputCargarArchivo'), 'files', { value: [archivoEscenario], configurable: true });
  $('inputCargarArchivo').dispatchEvent(new w.Event('change'));
  for (let i = 0; i < 50 && !E.generador; i++) await esperar();
  ok(E.proyecto && /Cartagena/.test(E.proyecto.nombreProyecto), 'proyecto del escenario F cargado');
  ok(E.listaCargas.length === 6, 'seis cargas sin digitarlas');
  ok(/escenario_f_cartagena\.json/.test($('estadoArchivo').textContent), 'confirma el archivo cargado');

  console.log('\n=== 2. Requerimiento contra el cálculo a mano ===');
  const r = E.resultados;
  ok(r.potenciaInstaladaW === PINST && PINST === 3942, 'potencia instalada 3.942 W');
  ok(r.demandaMaximaW === 3642 && r.horaDemandaMaximaH === 16, 'demanda máxima 3.642 W a las 16:00');
  ok(r.horasDemandaMaximaH.length === 1, 'la demanda máxima no se repite');
  ok(cerca(r.energiaDiariaKWh, ED) && cerca(ED, 32.688), 'energía diaria 32,688 kWh');
  ok(r.perfilHorarioW.join(',') === perfilMano.join(','), 'perfil de 24 h igual al calculado a mano');
  ok(cerca(r.energiaMensualKWh, ED * 30) && cerca(r.energiaAnualKWh, ED * 365), 'energía mensual (30 d) y anual (365 d)');
  ok(Math.round(r.costoDiario) === 39226 && Math.round(r.costoAnual) === 14317344, 'costos con CU = 1.200 $/kWh');
  const tarjetas = [...doc.querySelectorAll('#indicadoresGrid .value, #costosGrid .value')].map(e => e.textContent);
  ok(tarjetas.join(' | ') === '3.942 W | 3.642 W | 32,688 kWh | 980,6 kWh | 11.931,1 kWh | $ 39.226 | $ 1.176.768 | $ 14.317.344', 'pantalla con coma decimal y punto de miles');
  ok(E.resultados.clasificacionCargas.join(',') === 'mixta,mixta,mixta,diurna,mixta,diurna', 'clasificación con la ventana 06:00–18:00 (vitrinas hasta las 20:00: mixta; bomba 06:00 y 16:00: diurna)');

  console.log('\n=== 3. Generador con la fuente del sitio y la segunda fuente ===');
  const g = E.generador;
  ok(g.sitio.id === 'cartagena-bolivar' && /PVGIS/.test(g.sitio.fuente), 'recurso de Cartagena desde PVGIS');
  ok(g.criterioRecurso === 'anual' && cerca(g.potenciaPicoKWp, PPICO, 1e-9), 'Ppico = Ed / (HSP · PR) = ' + PPICO.toFixed(3) + ' kWp');
  ok(g.seleccion.numeroModulos * g.seleccion.modulo.potenciaW >= PPICO * 1000, 'la potencia instalada cubre la calculada');
  ok(g.seleccion.cabeEnArea, 'el generador cabe en 70 m²');
  const c = g.segundaFuente;
  ok(c && /NASA POWER/.test(c.fuente), 'segunda fuente: NASA POWER');
  ok(cerca(c.potencia.segunda, PPICO_NASA, 1e-9), 'Ppico con NASA POWER = ' + PPICO_NASA.toFixed(3) + ' kWp');
  ok(c.dentroDeTolerancia && Math.abs(c.potencia.difPct) <= 15, 'diferencia ' + c.potencia.difPct.toFixed(1) + ' % dentro de ±15 %');
  ok(/dentro de la diferencia aceptada/.test($('segundaFuenteGenerador').textContent), 'la pantalla muestra el contraste');

  console.log('\n=== 4. Conversión: rama del escenario ===');
  const rc = E.conversion.resultado;
  ok(rc.rama === 'sin', 'on-grid sin almacenamiento: inversor de red');
  ok(rc.seleccion && rc.seleccion.equipo.modelo === 'SUN2000-8KTL-M1' && rc.seleccion.veredicto === 'cumple', 'elige el Huawei SUN2000-8KTL-M1 y cumple');
  ok(cerca(rc.seleccion.relacionDcAc, 9000 / 8000), 'relación DC/AC = 9.000 / 8.000 = 1,125');
  const v = id => rc.verificaciones.find(x => x.equipo.id === id).veredicto;
  ok(v('huawei-sun2000-6ktl-m1') === 'alerta' && v('huawei-sun2000-10ktl-m1') === 'alerta', '6 kW: alerta por recorte (1,50); 10 kW: alerta por sobredimensionado (0,90)');
  ok(v('huawei-sun2000-5ktl-l1') === 'no_cumple', 'la serie L1 no admite la Imp de 13,27 A del módulo (máximo 12,5 A)');
  ok(E.conversion.supuestos.some(s => /Arranque de bombas/.test(s) && /Bomba presurizadora/.test(s)), 'documenta cómo se considera el arranque de la bomba');

  console.log('\n=== 5. Informe de una página y exportación ===');
  click('btnGenerarResumen');
  ok(paginas === 1 && /una página/.test($('estadoInforme').textContent), 'informe de una sola página (contenido hasta y = ' + maxY.toFixed(0) + ' mm)');
  click('btnExportarCSV');
  const csv = await descargas[descargas.length - 1].text();
  ok(/Energía diaria;32,688;kWh\/día/.test(csv) && /Costo unitario CU;1200;\$\/kWh/.test(csv) && /Días de operación al año;365;días/.test(csv), 'CSV con coma decimal, días y CU');
  ok(/Diferencia de potencia pico;5,4;%/.test(csv), 'CSV con la segunda fuente');
  click('btnExportarJSON');
  const json = JSON.parse(await descargas[descargas.length - 1].text());
  ok(json.consumo.energiaDiaria_kWh === 32.688 && json.consumo.horaDemandaMaxima === '16:00' && json.generador.segundaFuente.dentroDeTolerancia === true, 'JSON con los mismos resultados');

  console.log('\n=== 6. Casos borde de validación ===');
  const intentarCarga = (desc, cant, pot) => {
    $('descCarga').value = desc; $('cantCarga').value = cant; $('potCarga').value = pot;
    doc.querySelectorAll('#horarioGrid input').forEach(k => { k.checked = Number(k.dataset.hora) === 3; });
    click('btnAgregarCarga');
    return $('estadoCarga').textContent;
  };
  ok(/no puede ser negativa/.test(intentarCarga('Prueba', 1, -50)), 'potencia negativa: ' + $('estadoCarga').textContent);
  ok(/no puede ser cero/.test(intentarCarga('Prueba', 0, 50)), 'cantidad en cero: ' + $('estadoCarga').textContent);
  ok(/Escriba la potencia/.test(intentarCarga('Prueba', 1, '')), 'potencia vacía: ' + $('estadoCarga').textContent);
  ok(/descripción/.test(intentarCarga('', 1, 50)), 'descripción vacía: ' + $('estadoCarga').textContent);
  ok(E.listaCargas.length === 6, 'ninguna carga inválida entró al cuadro');
  poner('franjaDesde', '9'); poner('franjaHasta', '9');
  click('btnMarcarFranja');
  ok(/misma hora/.test($('estadoFranja').textContent), 'franja de duración cero: ' + $('estadoFranja').textContent);
  poner('franjaDesde', '22'); poner('franjaHasta', '4');
  click('btnMarcarFranja');
  ok(/cruzando la medianoche/.test($('estadoFranja').textContent), 'franja invertida se avisa como cruce de medianoche');
  const marcadas = [...doc.querySelectorAll('#horarioGrid input')].filter(k => k.checked).map(k => k.dataset.hora).join(',');
  ok(marcadas === '0,1,2,3,22,23', 'marca 22:00 a 04:00 (' + marcadas + ')');
  click('btnLimpiarHoras');

  poner('horaInicioDia', '18'); poner('horaFinDia', '6');
  ok(/invertido/.test($('estadoResultados').textContent) && E.resultados === null, 'día solar invertido: ' + $('estadoResultados').textContent);
  poner('horaInicioDia', '6'); poner('horaFinDia', '18');
  ok(E.resultados !== null, 'al corregir, se recalcula solo');
  poner('costoUnitario', '');
  ok(/costo unitario/.test($('estadoResultados').textContent) && E.resultados === null, 'CU vacío: ' + $('estadoResultados').textContent);
  poner('costoUnitario', '0');
  ok(!$('avisoCU0').hidden && E.resultados.costoAnual === 0, 'CU = 0: se calcula y se advierte');
  poner('costoUnitario', '1200');

  // Demanda máxima repetida: un proyecto con dos horas de igual pico.
  w.eval('window.__probarPico = ' + JSON.stringify({
    nombreProyecto: 'Pico repetido', integrantes: 'Prueba', fecha: '25/10/2026', contexto: 'on-grid',
    parametros: { diasOperacionMes: 30, diasOperacionAnio: 365, costoUnitarioCU: 1000, horaInicioDia: 6, horaFinDia: 18 },
    cargas: [{ descripcion: 'Motor', cantidad: 1, potenciaUnitariaW: 500, horario: [0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0] }],
  }));
  const archivo = new w.File([JSON.stringify(w.__probarPico)], 'pico.json', { type: 'application/json' });
  Object.defineProperty($('inputCargarArchivo'), 'files', { value: [archivo], configurable: true });
  $('inputCargarArchivo').dispatchEvent(new w.Event('change'));
  for (let i = 0; i < 20 && (!E.proyecto || E.proyecto.nombreProyecto !== 'Pico repetido'); i++) await esperar();
  ok(E.resultados.horaDemandaMaximaH === 8 && E.resultados.horasDemandaMaximaH.join(',') === '8,14,20', 'reporta la primera hora (08:00) y lista 14:00 y 20:00');
  ok(!$('avisoPicoRepetido').hidden && /14:00, 20:00/.test($('avisoPicoRepetido').textContent), 'la pantalla lista las otras horas');

  // Informe sin cargas
  E.listaCargas.splice(0);
  E.resultados = null;
  click('btnGenerarResumen');
  ok(/no tiene cargas/.test($('estadoInforme').textContent), 'informe sin cargas: ' + $('estadoInforme').textContent);

  console.log(fallas ? '\n' + fallas + ' PRUEBA(S) FALLARON' : '\n=== TODAS LAS PRUEBAS DEL ESCENARIO F PASARON ===');
  if (fallas) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
