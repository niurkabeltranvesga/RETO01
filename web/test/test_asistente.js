// test_asistente.js
//
// Asistente de ayuda: preguntas escritas de distintas formas deben llevar a la
// respuesta correcta del manual, y lo que no está en el manual no se inventa.
// Incluye un recorrido por la ventana del asistente en la interfaz.
//
// Uso (desde la carpeta web/):  npm install jsdom   y luego   node test/test_asistente.js

const fs = require('fs');
const path = require('path');
const A = require('../asistente.js');

let fallas = 0;
function ok(condicion, texto) {
  console.log((condicion ? '  ok    ' : '  FALLA ') + texto);
  if (!condicion) fallas++;
}

console.log('=== 1. Preguntas frecuentes ===');
const CASOS = [
  ['¿Qué es el CU?', 'cu'],
  ['que pongo en el CU si no se', 'cu'],
  ['¿Cómo marco un horario que pasa de medianoche?', 'medianoche'],
  ['mi aparato se usa en la mañana y en la tarde', 'dos-franjas'],
  ['como borro una carga', 'editar-carga'],
  ['no me deja agregar la carga', 'no-agrega'],
  ['dónde veo la potencia de la nevera', 'potencia-aparato'],
  ['mi ciudad no aparece', 'sitio'],
  ['cuantos paneles necesito', 'potencia-pico'],
  ['qué es el PR', 'pr'],
  ['que significa alerta', 'veredictos'],
  ['el inversor no sirve', 'ninguno-sirve'],
  ['qué es la relación DC/AC', 'dcac'],
  ['la bomba arranca con mucha corriente', 'arranque'],
  ['como exporto a excel', 'exportar'],
  ['funciona sin internet', 'internet'],
  ['sirve en el celular', 'celular'],
  ['cuanto cuesta un panel', 'costos-equipos'],
  ['¿usa inteligencia artificial?', 'asistente'],
  ['QUÉ ES LA SEGUNDA FUENTE', 'segunda-fuente'],
];
CASOS.forEach(([pregunta, esperado]) => {
  const r = A.responder(pregunta);
  ok(r.tipo === 'respuesta' && r.entrada.id === esperado, '«' + pregunta + '» → ' + (r.entrada ? r.entrada.id : r.tipo));
});

console.log('\n=== 2. Saludos y preguntas fuera del manual ===');
ok(A.responder('hola').tipo === 'saludo', 'saluda');
ok(A.responder('gracias').tipo === 'gracias', 'responde al agradecimiento');
ok(A.responder('perro').tipo === 'sin_respuesta', 'una palabra ajena no recibe respuesta inventada');
ok(A.responder('').tipo === 'sin_respuesta', 'texto vacío');
ok(A.PREGUNTAS.every(e => e.pregunta && e.respuesta && e.claves), 'todas las entradas tienen pregunta, respuesta y palabras clave');
ok(new Set(A.PREGUNTAS.map(e => e.id)).size === A.PREGUNTAS.length, 'identificadores únicos');

console.log('\n=== 3. Ventana del asistente en la interfaz ===');
(async () => {
  const { JSDOM } = require('jsdom');
  const RAIZ = path.join(__dirname, '..');
  const leer = f => fs.readFileSync(path.join(RAIZ, f), 'utf-8');
  const dom = new JSDOM(leer('index.html'), { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true });
  const w = dom.window, doc = w.document;
  w.fetch = async () => { throw new TypeError('sin servidor'); };
  ['motorCalculo.js', 'medicion.js', 'dimensionamiento.js', 'datos/datos_respaldo.js', 'informe.js', 'informeResumen.js', 'exportar.js', 'asistente.js', 'app.js', 'generador.js', 'conversion.js', 'pasoConversion.js']
    .forEach(f => w.eval(leer(f)));
  const $ = id => doc.getElementById(id);
  const click = el => el.dispatchEvent(new w.Event('click', { bubbles: true }));
  click($('btnComenzar'));
  click($('btnAsistente'));
  // El usuario está en el Paso 1 y pregunta por algo del Paso 2.
  ok(!$('panelAsistente').hidden && $('btnAsistente').getAttribute('aria-expanded') === 'true', 'se abre la ventana');
  ok(/Paso 1/.test($('asistenteSugerencias').textContent), 'propone preguntas del paso en el que está el usuario');
  $('entradaAsistente').value = 'como marco un horario que cruza la medianoche';
  $('formAsistente').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  const ultimo = [...doc.querySelectorAll('.asistente-bot')].pop();
  ok(/22:00 hasta 04:00/.test(ultimo.textContent), 'responde la pregunta escrita');
  const ir = ultimo.querySelector('.asistente-ir');
  ok(ir && /Paso 2/.test(ir.textContent), 'ofrece ir al paso correspondiente');
  click(ir);
  ok($('panel-2').classList.contains('is-active') && $('panelAsistente').hidden, 'lleva al Paso 2 y cierra la ventana');
  click($('btnAsistente'));
  click(doc.querySelector('.asistente-chip'));
  ok([...doc.querySelectorAll('.asistente-usuario')].length === 2, 'las preguntas sugeridas se responden con un clic');

  console.log(fallas ? '\n' + fallas + ' PRUEBA(S) FALLARON' : '\n=== TODAS LAS PRUEBAS DEL ASISTENTE PASARON ===');
  if (fallas) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
