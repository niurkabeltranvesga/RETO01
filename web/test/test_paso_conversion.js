// test_paso_conversion.js
//
// Recorrido por la interfaz del paso de conversión y almacenamiento con el
// caso de prueba estandarizado (ejemplos/caso_prueba_alta_guajira.json):
// datos heredados sin reingreso, rama inicial según el contexto, cambio de
// rama, veredictos, ajuste del generador por el balance de cierre, propuesta
// de cadenas, informe y guardado del proyecto.
//
// Uso (desde la carpeta web/):  npm install jsdom   y luego   node test/test_paso_conversion.js

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RAIZ = path.join(__dirname, '..');
const leer = f => fs.readFileSync(path.join(RAIZ, f), 'utf-8');
function falla(msg) { throw new Error('FALLÓ: ' + msg); }

async function main() {
  const dom = new JSDOM(leer('index.html'), { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true });
  const { window } = dom;
  const doc = window.document;
  window.fetch = async () => { throw new TypeError('sin servidor'); };
  let paginasInforme = 0;
  window.jspdf = { jsPDF: function () { paginasInforme = 1; return { setFillColor(){}, rect(){}, setFont(){}, setFontSize(){}, setTextColor(){}, text(){}, roundedRect(){}, circle(){}, setDrawColor(){}, line(){}, addPage(){ paginasInforme++; }, save(){}, splitTextToSize(t){ return [t]; }, setLineWidth(){}, getTextWidth(t){ return String(t).length * 2; }, getNumberOfPages(){ return paginasInforme || 1; }, setPage(){} }; } };
  let descargado = null;
  window.URL.createObjectURL = blob => { descargado = blob; return 'blob:prueba'; };
  window.URL.revokeObjectURL = () => {};

  ['motorCalculo.js', 'medicion.js', 'dimensionamiento.js', 'datos/datos_respaldo.js', 'informe.js', 'app.js', 'generador.js', 'conversion.js', 'pasoConversion.js']
    .forEach(f => window.eval(leer(f)));
  await window.UIGenerador.datosListos;
  await window.UIConversion.datosListos;

  const $ = id => doc.getElementById(id);
  const click = id => $(id).dispatchEvent(new window.Event('click', { bubbles: true }));
  const cambiar = (id, v, evento) => { $(id).value = v; $(id).dispatchEvent(new window.Event(evento || 'change', { bubbles: true })); };
  const esperar = () => new Promise(r => setTimeout(r, 30));
  const estado = window.__estadoAppReto01;

  async function cargarProyecto(contenido, nombre) {
    const archivo = new window.File([contenido], nombre, { type: 'application/json' });
    Object.defineProperty($('inputCargarArchivo'), 'files', { value: [archivo], configurable: true });
    $('inputCargarArchivo').dispatchEvent(new window.Event('change'));
    for (let i = 0; i < 50 && !estado.generador; i++) await esperar();
    await esperar();
  }

  console.log('=== 1. Proyecto del caso de prueba y datos heredados ===');
  await cargarProyecto(leer('ejemplos/caso_prueba_alta_guajira.json'), 'caso_prueba_alta_guajira.json');
  if (!estado.generador) falla('no se dimensionó el generador al cargar el proyecto');
  const heredados = [...doc.querySelectorAll('#convHeredados .value')].map(e => e.textContent.trim());
  console.log('  Heredados:', heredados.join(' | '));
  if (!heredados[0].includes('7,580')) falla('la energía diaria no llegó al paso de conversión');
  if (!heredados[1].includes('910')) falla('la demanda máxima no llegó');
  if (!heredados[2].includes('2,20')) falla('el generador no llegó');
  const rama = doc.querySelector('input[name="ramaConv"]:checked').value;
  console.log('  Rama inicial con contexto off-grid:', rama);
  if (rama !== 'con') falla('con contexto off-grid la rama inicial debía ser "con almacenamiento"');

  console.log('\n=== 2. Rama con almacenamiento: veredictos del caso de prueba ===');
  cambiar('convRegulador', 'ctrl-b');
  const r = estado.conversion.resultado;
  const veredictos = r.verificaciones.filter(v => v.equipo.referenciaTdR).map(v => v.equipo.modelo + ' ' + v.veredicto).join(' | ');
  console.log('  ' + veredictos);
  if (veredictos !== 'CTRL-A no_cumple | CTRL-B cumple | CTRL-C alerta') falla('veredictos de reguladores inesperados');
  const b = r.banco;
  console.log('  Banco:', b.ns + 'S × ' + b.np + 'P,', b.numeroBaterias, 'baterías,', b.ahInstalados, 'Ah,', b.kWhInstalados, 'kWh, DoD final', (b.dodFin * 100).toFixed(1), '%');
  if (b.numeroBaterias !== 16 || b.ahInstalados !== 800) falla('banco AGM inesperado');
  if (!r.balance.hayDeficit || r.balance.critico.modulosAdicionales !== 2) falla('el balance de cierre debía mostrar déficit de 2 módulos');
  if (!$('btnAplicarAjuste')) falla('falta el botón para aplicar el ajuste');
  if (!$('convResumen').textContent.includes('faltan 2 paneles')) falla('el resumen debía decir que faltan 2 paneles');
  console.log('  Resumen:', $('convResumen').querySelector('.resumen-cab strong').textContent);
  if ($('resultadosConv').hidden) falla('los resultados no se muestran');

  console.log('\n=== 3. Entradas fuera de rango ===');
  cambiar('convAutonomia', 0, 'input');
  console.log('  ' + $('estadoConv').textContent);
  if (!$('estadoConv').textContent.includes('autonomía')) falla('no se avisó la autonomía inválida');
  cambiar('convAutonomia', 2, 'input');
  cambiar('convDod', 120, 'input');
  if (!$('estadoConv').textContent.includes('DoD')) falla('no se avisó el DoD inválido');
  cambiar('convDod', 50, 'input');
  if (!estado.conversion) falla('al corregir los datos debía recalcularse');

  console.log('\n=== 4. Cambio de batería a LFP ===');
  cambiar('convBateria', 'lfp-tdr');
  console.log('  Tensión del banco', $('convVbanco').value, 'V, DoD', $('convDod').value, '%, η', $('convEtaBat').value);
  if (Number($('convVbanco').value) !== 51.2 || Number($('convDod').value) !== 80) falla('no se propusieron los valores de la ficha LFP');
  if (estado.conversion.resultado.banco.numeroBaterias !== 5) falla('el banco LFP debía tener 5 baterías');
  cambiar('convBateria', 'agm-tdr');

  console.log('\n=== 5. Aceptar el ajuste del balance de cierre ===');
  click('btnAplicarAjuste');
  await esperar();
  const g = estado.generador;
  console.log('  Generador ajustado:', g.seleccion.numeroModulos, 'módulos,', g.seleccion.cadenasParalelo + ' × ' + g.seleccion.modulosSerie);
  if (g.seleccion.numeroModulos !== 6) falla('el ajuste debía llevar el generador a 6 módulos');
  if ($('ajusteConversion').hidden) falla('el Paso 4 no muestra el ajuste aceptado');
  const r2 = estado.conversion.resultado;
  const vb = r2.verificaciones.find(v => v.equipo.id === 'ctrl-b');
  console.log('  CTRL-B con 1 × 6:', vb.veredicto, '| propuesta', vb.propuesta && vb.propuesta.np + ' × ' + vb.propuesta.ns);
  if (vb.veredicto !== 'no_cumple' || !vb.propuesta.posible || vb.propuesta.ns !== 3) falla('se esperaba la propuesta de 2 cadenas de 3 para CTRL-B');

  console.log('\n=== 6. Usar la configuración propuesta ===');
  const boton = doc.querySelector('#bloqueEquipos button[data-elegir="ctrl-b"][data-serie]');
  if (!boton) falla('la tarjeta de CTRL-B no ofrece reorganizar los paneles');
  boton.dispatchEvent(new window.Event('click', { bubbles: true }));
  await esperar();
  const r3 = estado.conversion.resultado;
  console.log('  Generador:', estado.generador.seleccion.cadenasParalelo + ' × ' + estado.generador.seleccion.modulosSerie, '| CTRL-B', r3.seleccion.veredicto,
    '| margen crítico', r3.balance.critico.margenPct.toFixed(1), '% | recuperación', r3.recuperacion.dias.toFixed(1), 'días');
  if (r3.seleccion.veredicto !== 'cumple') falla('con 2 × 3 CTRL-B debía cumplir');
  console.log('  Resumen:', $('convResumen').querySelector('.resumen-cab strong').textContent);
  if ($('convResumen').querySelector('.resumen-cab strong').textContent !== 'El sistema funciona') falla('tras los ajustes el resumen debía decir que el sistema funciona');
  if (r3.balance.hayDeficit) falla('tras el ajuste no debía haber déficit');
  if (!r3.recuperacion.seRecupera) falla('tras el ajuste el banco debía recuperarse');

  console.log('\n=== 7. Rama sin almacenamiento (el usuario la cambia) ===');
  click('btnQuitarAjusteConv');
  await esperar();
  if (estado.generador.seleccion.numeroModulos !== 4) falla('al quitar el ajuste el generador debía volver a 4 módulos');
  const sin = doc.querySelector('input[name="ramaConv"][value="sin"]');
  sin.checked = true; sin.dispatchEvent(new window.Event('change', { bubbles: true }));
  cambiar('convInversor', 'inv-b');
  const rs = estado.conversion.resultado;
  const vi = rs.verificaciones.filter(v => v.equipo.referenciaTdR).map(v => v.equipo.modelo + ' ' + v.veredicto + ' ' + v.relacionDcAc.toFixed(2)).join(' | ');
  console.log('  ' + vi);
  if (vi !== 'INV-A no_cumple 1.47 | INV-B cumple 1.10 | INV-C alerta 0.73') falla('veredictos de inversores inesperados');
  if ($('convEntradasCon').hidden !== true || $('convResultadosBanco').hidden !== true) falla('la rama sin almacenamiento no debía mostrar el banco');
  cambiar('convDcAcMax', 1.05, 'input');
  if (estado.conversion.resultado.seleccion.veredicto !== 'alerta') falla('con rango hasta 1,05 la relación 1,10 debía dar alerta de recorte');
  cambiar('convDcAcMax', 1.3, 'input');

  console.log('\n=== 8. Informe ===');
  click('btnGenerarInforme');
  console.log('  Páginas:', paginasInforme, '|', $('estadoInforme').textContent);
  if (paginasInforme < 4) falla('el informe debía incluir las páginas de conversión');

  console.log('\n=== 9. Guardar y volver a abrir el proyecto ===');
  click('btnGuardarArchivo');
  const guardado = JSON.parse(await descargado.text());
  if (!guardado.conversion || guardado.conversion.rama !== 'sin' || guardado.conversion.inversorId !== 'inv-b') falla('el archivo no guardó la configuración del paso');
  const otro = doc.querySelector('input[name="ramaConv"][value="con"]');
  otro.checked = true; otro.dispatchEvent(new window.Event('change', { bubbles: true }));
  estado.generador = null;
  await cargarProyecto(JSON.stringify(guardado), 'guardado.json');
  const rr = estado.conversion.resultado;
  console.log('  Recuperado: rama', rr.rama, '| equipo', rr.seleccion.equipo.modelo, '| DC/AC', rr.seleccion.relacionDcAc.toFixed(2));
  if (rr.rama !== 'sin' || rr.seleccion.equipo.id !== 'inv-b') falla('no se recuperó la configuración guardada');

  console.log('\n=== TODAS LAS PRUEBAS DE LA INTERFAZ DEL RETO 03 PASARON ===');
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
