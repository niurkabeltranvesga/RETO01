// test_paralelo_noche.js
//
// Reguladores en paralelo y autonomía por consumo nocturno, contra cálculo a
// mano, con los equipos del catálogo (fichas Victron y Felicity). Incluye un
// recorrido por la interfaz con el caso propio (Distrimedical).
//
// Uso (desde la carpeta web/):  npm install jsdom   y luego   node test/test_paralelo_noche.js

const fs = require('fs');
const path = require('path');
const C = require('../conversion.js');

const RAIZ = path.join(__dirname, '..');
const leer = f => fs.readFileSync(path.join(RAIZ, f), 'utf-8');
const equipos = JSON.parse(leer('datos/catalogo_equipos.json'));
const porId = (lista, id) => equipos[lista].find(e => e.id === id);

let fallas = 0;
function ok(condicion, texto) {
  console.log((condicion ? '  ok    ' : '  FALLA ') + texto);
  if (!condicion) fallas++;
}
const cerca = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? Math.abs(b) * 1e-6 + 1e-9 : tol);

// Módulo de 550 Wp del caso de prueba; generador de 8 cadenas de 3 módulos (13,2 kWp).
const modulo = { potenciaW: 550, vocV: 49.5, vmpV: 41.5, iscA: 14.0, impA: 13.3, coefVocPctC: -0.27 };
const arreglo = { modulo, modulosSerie: 3, cadenasParalelo: 8, tMinC: 25, tCeldaC: 61.8 };
const ctx = { vBancoV: 51.2, vNominalV: 48 };

console.log('=== 1. Reparto de cadenas ===');
ok(C.repartirCadenas(8, 4).join(',') === '2,2,2,2', '8 cadenas en 4 grupos: 2 + 2 + 2 + 2');
ok(C.repartirCadenas(7, 3).join(',') === '3,2,2', '7 cadenas en 3 grupos: 3 + 2 + 2 (el grupo mayor manda)');

console.log('\n=== 2. Victron SmartSolar MPPT 150/70 (ficha: hasta 10 en paralelo) ===');
const r70 = porId('reguladores', 'victron-smartsolar-150-70');
ok(r70.maxParalelo === 10, 'la ficha declara 10 unidades en paralelo');
const v70 = C.verificarRegulador(r70, arreglo, ctx);
// Total: 24 · 550 / 48 = 275 A. Con k = 4, cada grupo de 2 cadenas: 2·3·550/48 = 68,75 A ≤ 70 A; Isc 2·14 = 28 A ≤ 50 A.
// Con k = 3 el grupo mayor tiene 3 cadenas: 103,1 A > 70 A (solo alerta); por eso k = 4 es el menor que cumple.
ok(v70.unidades === 4 && v70.veredicto === 'cumple', 'menor número que cumple: 4 reguladores (obtuvo ' + v70.unidades + ', ' + v70.veredicto + ')');
ok(cerca(v70.corrienteBancoA, 2 * 3 * 550 / 48) && cerca(v70.corrienteBancoTotalA, 275), 'corriente por regulador 68,75 A; total 275 A');
ok(cerca(v70.criterios.find(c => c.id === 'isc').valor, 28), 'Isc por regulador: 2 cadenas × 14 A = 28 A');
const vocFrio = 3 * 49.5;   // a 25 °C no hay corrección: 148,5 V ≤ 150 V
ok(cerca(v70.arreglo.vocFrioV, vocFrio), 'las tensiones no cambian con el paralelo: Voc en frío ' + vocFrio.toFixed(1) + ' V');

console.log('\n=== 3. Sin dato de paralelo en la ficha: una sola unidad ===');
const r45 = porId('reguladores', 'victron-smartsolar-150-45');
ok(r45.maxParalelo === undefined, 'la ficha del 150/45 no declara operación en paralelo');
const v45 = C.verificarRegulador(r45, arreglo, ctx);
ok(v45.unidades === 1 && v45.veredicto === 'no_cumple', 'se evalúa con 1 unidad: Isc 8 × 14 = 112 A > 50 A, no cumple');
const caso = porId('reguladores', 'ctrl-b');
ok(C.verificarRegulador(caso, { modulo, modulosSerie: 4, cadenasParalelo: 1, tMinC: 20, tCeldaC: 63.2 }, { vBancoV: 48, vNominalV: 48 }).unidades === 1, 'los equipos del caso de prueba siguen con 1 unidad');
ok(C.verificarRegulador(r70, arreglo, Object.assign({ permitirParalelo: false }, ctx)).unidades === 1, 'el paralelo se puede desactivar');

console.log('\n=== 4. Selección automática: menos unidades primero ===');
const sel = C.dimensionarConversion({
  rama: 'con', generador: arreglo, catalogo: equipos, energiaDiariaKWh: 40.8, demandaMaximaW: 3470,
  hspAnual: 5.01, hspCritico: 4.4, pr: 0.7, criterioRecurso: 'critico',
  etaInv: 0.9, vNominalV: 48, vBancoV: 51.2, autonomiaDias: 1, modoAutonomia: 'noche', energiaNocheKWh: 5.7,
  dodPct: 80, fT: 1, etaBat: 0.95, bateria: porId('baterias', 'felicity-lpbf48200-m'), bateriasComparar: equipos.baterias,
});
ok(sel.seleccion.equipo.id === 'victron-smartsolar-150-70' && sel.seleccion.unidades === 4, 'elige 4 × 150/70 (el 150/60 y los 250 necesitarían 8)');

console.log('\n=== 5. Autonomía por consumo nocturno (LPBF48200-M, 1 noche) ===');
const b = sel.banco;
const eccNoche = 5700 / 0.9;                 // 6.333,3 Wh
const cnWh = eccNoche * 1 / (0.8 * 1);      // 7.916,7 Wh
const ah = 10000 / 51.2;                    // 195,31 Ah (energía / tensión de la ficha)
ok(cerca(b.eccBancoWh, eccNoche) && cerca(b.cnWh, cnWh), 'Cn = E_noche / η_inv · N / (DoD · fT) = ' + cnWh.toFixed(1) + ' Wh');
ok(cerca(b.bateria.capacidadAh, ah, 0.01), 'capacidad de la ficha: 10 kWh / 51,2 V = 195,31 Ah');
ok(b.ns === 1 && b.np === 1, 'banco 1S × 1P (Cn = ' + (cnWh / 51.2).toFixed(1) + ' Ah ≤ 195,31 Ah)');
ok(cerca(b.dodFin, eccNoche / (b.bateria.capacidadAh * 51.2)), 'DoD final = Ecc_noche / E instalada = ' + (eccNoche / 100).toFixed(1) + ' %');
const egen = (40800 - 5700) / 0.9 + 5700 / (0.9 * 0.95);
ok(cerca(sel.balance.egenWh, egen), 'Egen = E_día / η_inv + E_noche / (η_inv · η_bat) = ' + egen.toFixed(0) + ' Wh/día');
const eprod = 13200 * 5.01 * 0.7;
ok(cerca(sel.recuperacion.dias, eccNoche / ((eprod - egen) * 0.95)), 'trec = N · Ecc_noche / ((Eprod − Egen) · η_bat) = ' + (eccNoche / ((eprod - egen) * 0.95)).toFixed(2) + ' días');

console.log('\n=== 6. Por días, la recuperación es la fórmula del curso ===');
const pDias = { energiaDiariaKWh: 7.58, etaInv: 0.9, etaBat: 0.8, autonomiaDias: 2, dodPct: 50, fT: 1, vBancoV: 48, vNominalV: 48, bateria: porId('baterias', 'agm-tdr') };
const bd = C.dimensionarBanco(pDias);
const rec = C.recuperacion(bd, 4000, 5.8, 0.7);
const ecc = 7580 / 0.9;
ok(cerca(rec.dias, 2 * ecc / (4000 * 5.8 * 0.7 * 0.8 - ecc)), 'trec = N·Ecc / (Eprod·η_bat − Ecc) = ' + (2 * ecc / (4000 * 5.8 * 0.7 * 0.8 - ecc)).toFixed(2) + ' días, igual que antes');

console.log('\n=== 7. Baterías que no admiten serie ===');
let mensaje = '';
try { C.dimensionarBanco(Object.assign({}, pDias, { vBancoV: 102.4, vNominalV: 96, bateria: porId('baterias', 'felicity-lpbf48200-m') })); } catch (e) { mensaje = e.message; }
ok(/solo conexión en paralelo/.test(mensaje), 'LPBF48200-M a 102,4 V se rechaza: ' + mensaje);
mensaje = '';
try { C.dimensionarBanco(Object.assign({}, pDias, { vBancoV: 64, vNominalV: 64, bateria: porId('baterias', 'felicity-fla12300') })); } catch (e) { mensaje = e.message; }
ok(/como máximo 4 en serie/.test(mensaje), 'FLA12300 con 5 en serie se rechaza');
ok(C.dimensionarBanco(Object.assign({}, pDias, { vBancoV: 51.2, bateria: porId('baterias', 'felicity-fla12300') })).ns === 4, 'FLA12300 con 4 en serie (51,2 V) se acepta');
mensaje = '';
try { C.dimensionarBanco(Object.assign({}, pDias, { modoAutonomia: 'noche', energiaNocheKWh: 0 })); } catch (e) { mensaje = e.message; }
ok(/no hay energía nocturna/.test(mensaje), 'sin consumo nocturno se pide usar la autonomía por días');

console.log('\n=== 8. Interfaz con el caso propio (Distrimedical) ===');
(async () => {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM(leer('index.html'), { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true });
  const w = dom.window, doc = w.document;
  w.fetch = async () => { throw new TypeError('sin servidor'); };
  ['motorCalculo.js', 'medicion.js', 'dimensionamiento.js', 'datos/datos_respaldo.js', 'informe.js', 'informeResumen.js', 'exportar.js', 'asistente.js', 'app.js', 'generador.js', 'conversion.js', 'pasoConversion.js']
    .forEach(f => w.eval(leer(f)));
  await w.UIGenerador.datosListos;
  await w.UIConversion.datosListos;
  const $ = id => doc.getElementById(id);
  const E = w.__estadoAppReto01;
  const esperar = () => new Promise(r => setTimeout(r, 40));
  const proyecto = JSON.parse(leer('ejemplos/caso_propio_distrimedical.json'));
  proyecto.generador = { sitioId: 'unimagdalena-santa-marta', criterioRecurso: 'critico', pr: 0.7, vMaxSistema: 600, tMinC: 17, tAmbOperacionC: 33, areaDisponibleM2: 150, criterioModulo: 'menor_excedente', dimensionado: true };
  const archivo = new w.File([JSON.stringify(proyecto)], 'distrimedical.json', { type: 'application/json' });
  Object.defineProperty($('inputCargarArchivo'), 'files', { value: [archivo], configurable: true });
  $('inputCargarArchivo').dispatchEvent(new w.Event('change'));
  for (let i = 0; i < 50 && !E.conversion; i++) await esperar();
  w.UIGenerador.aplicarAjusteConversion({ modulosSerieFijo: 3 });
  await esperar();
  const r = E.conversion.resultado;
  ok(r.seleccion && r.seleccion.unidades > 1 && r.seleccion.veredicto === 'cumple', 'con 3 módulos en serie elige ' + (r.seleccion ? r.seleccion.unidades + ' × ' + r.seleccion.equipo.modelo : 'ninguno'));
  ok(/en paralelo/.test($('convResumen').textContent), 'el resumen dice que los reguladores van en paralelo');
  const noche = doc.querySelector('input[name="modoAutonomia"][value="noche"]');
  noche.checked = true;
  noche.dispatchEvent(new w.Event('change', { bubbles: true }));
  ok(E.conversion.resultado.banco.modoAutonomia === 'noche' && /Noches de autonomía/.test($('convEtiquetaAutonomia').textContent), 'la opción «solo el consumo de la noche» cambia el cálculo y el formulario');
  ok(/noche/.test($('convResumen').textContent), 'el resumen habla de noches');
  ok(w.UIConversion.obtenerConfiguracion().modoAutonomia === 'noche', 'la opción se guarda en el proyecto');

  console.log(fallas ? '\n' + fallas + ' PRUEBA(S) FALLARON' : '\n=== TODAS LAS PRUEBAS DE PARALELO Y AUTONOMÍA NOCTURNA PASARON ===');
  if (fallas) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
