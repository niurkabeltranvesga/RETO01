// ejecutar_todas.js
//
// Ejecuta todas las pruebas automáticas de la plataforma y muestra un resumen:
//   - test_motorCalculo.js      casos solo diurno, solo nocturno y mixto con cruce de medianoche
//   - test_medicion.js          lectura de la hoja de datos del equipo de medición
//   - test_dimensionamiento.js  generador del caso de prueba estandarizado
//   - test_conversion.js        conversión y almacenamiento del caso estandarizado, contra cálculo a mano
//   - test_consulta_nasa.js     consulta en línea y contingencia sin conexión
//   - test_jsdom.js             recorrido completo de la interfaz
//   - test_paso_conversion.js   interfaz del paso de conversión con el caso estandarizado
//   - test_escenario_f.js       escenario del grupo F (Cartagena) y casos borde de validación
//   - test_asistente.js         asistente de ayuda (preguntas frecuentes del manual)
//   - test_paralelo_noche.js    reguladores en paralelo y autonomía por consumo nocturno
//
// Uso (desde la carpeta web/):  npm install jsdom   y luego   node test/ejecutar_todas.js

const { spawnSync } = require('child_process');
const path = require('path');

const PRUEBAS = ['test_motorCalculo.js', 'test_medicion.js', 'test_dimensionamiento.js', 'test_conversion.js',
  'test_consulta_nasa.js', 'test_jsdom.js', 'test_paso_conversion.js', 'test_escenario_f.js', 'test_asistente.js', 'test_paralelo_noche.js'];

let fallidas = 0;
PRUEBAS.forEach(archivo => {
  const r = spawnSync(process.execPath, [path.join(__dirname, archivo)], { encoding: 'utf-8', env: process.env });
  const paso = r.status === 0;
  if (!paso) fallidas++;
  console.log((paso ? 'PASA   ' : 'FALLA  ') + archivo);
  if (!paso) console.log((r.stdout || '').split('\n').slice(-15).join('\n') + (r.stderr || ''));
});
console.log('\n' + (PRUEBAS.length - fallidas) + ' de ' + PRUEBAS.length + ' archivos de prueba pasaron.');
process.exit(fallidas ? 1 : 0);
