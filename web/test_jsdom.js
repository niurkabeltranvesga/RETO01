// test_jsdom.js

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

async function main() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf-8');

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'http://localhost/',
    pretendToBeVisual: true,
  });
  const { window } = dom;

  
  let paginasInforme = 0;
  window.jspdf = { jsPDF: function () { paginasInforme = 1; return { setFillColor(){}, rect(){}, setFont(){}, setFontSize(){}, setTextColor(){}, text(){}, roundedRect(){}, circle(){}, setDrawColor(){}, line(){}, addPage(){ paginasInforme++; }, save(){}, splitTextToSize(t){ return [t]; } }; } };


  const motorCalculo = fs.readFileSync(path.join(__dirname, '..', 'motorCalculo.js'), 'utf-8');
  const medicion = fs.readFileSync(path.join(__dirname, '..', 'medicion.js'), 'utf-8');
  const dimensionamiento = fs.readFileSync(path.join(__dirname, '..', 'dimensionamiento.js'), 'utf-8');
  const respaldo = fs.readFileSync(path.join(__dirname, '..', 'datos', 'datos_respaldo.js'), 'utf-8');
  const generadorJs = fs.readFileSync(path.join(__dirname, '..', 'generador.js'), 'utf-8');
  const informe = fs.readFileSync(path.join(__dirname, '..', 'informe.js'), 'utf-8');
  const appJs = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf-8');

  window.eval(motorCalculo);
  window.eval(medicion);
  window.eval(dimensionamiento);
  window.eval(respaldo);
  window.eval(informe);
  window.eval(appJs);
  window.eval(generadorJs);
  await window.UIGenerador.datosListos;

  const doc = window.document;

  function click(id) {
    doc.getElementById(id).dispatchEvent(new window.Event('click', { bubbles: true }));
  }
  function setVal(id, val) {
    doc.getElementById(id).value = val;
  }
  function change(id) {
    doc.getElementById(id).dispatchEvent(new window.Event('change', { bubbles: true }));
  }

  console.log('=== PASO 1: Proyecto ===');
  setVal('nombreProyecto', 'Prueba jsdom');
  setVal('integrantes', 'niurka');
  setVal('fechaProyecto', '27/08/2026');
  setVal('contexto', 'on-grid');
  click('btnGuardarProyecto');
  const estadoProyecto = doc.getElementById('estadoProyecto').textContent;
  console.log('  Estado:', estadoProyecto);
  if (!estadoProyecto.includes('correctamente')) throw new Error('FALLÓ paso 1');

  console.log('\n=== PASO 2: Cargas (8 cargas, mismo caso validado antes) ===');
  const casos = [
    ['nevera', 1, 150, Array.from({length:24}, () => 1)],
    ['tv', 1, 120, horario([19,20,21,22])],
    ['aire', 1, 1200, horario([22,23,0,1,2,3,4,5])],
    ['luces interiores', 1, 300, horario([18,19,20,21,22,23,0,1,2,3,4,5])],
    ['motobomba', 1, 750, horario([6,7])],
    ['lavadora', 2, 500, horario([8,9])],
    ['computador', 1, 200, horario([8,9,10,11,12,13,14,15,16,17])],
    ['ducha electrica', 1, 1500, horario([6])],
  ];

  function horario(horas) {
    const h = new Array(24).fill(0);
    horas.forEach(x => h[x] = 1);
    return h;
  }

  for (const [desc, cant, pot, hor] of casos) {
    setVal('descCarga', desc);
    setVal('cantCarga', cant);
    setVal('potCarga', pot);
    const checks = doc.querySelectorAll('#horarioGrid input[type=checkbox]');
    checks.forEach(chk => { chk.checked = hor[Number(chk.dataset.hora)] === 1; });
    click('btnAgregarCarga');
  }
  const filas = doc.querySelectorAll('#cuerpoTablaCargas tr');
  console.log('  Filas en la tabla:', filas.length);
  if (filas.length !== 8) throw new Error('FALLÓ: se esperaban 8 filas, hay ' + filas.length);

  console.log('\n=== PASO 3: Resultados ===');
  setVal('diasMes', 30);
  setVal('diasAnio', 360);
  setVal('costoUnitario', 800);
  setVal('horaInicioDia', 6);
  setVal('horaFinDia', 18);
  click('btnCalcular');
  const estadoResultados = doc.getElementById('estadoResultados').textContent;
  console.log('  Estado:', estadoResultados);

  const valores = [...doc.querySelectorAll('.indicador-card .value')].map(e => e.textContent);
  console.log('  Indicadores:', valores);

  if (!valores[0].includes('5220')) throw new Error('FALLÓ: Pinst esperado 5220, obtuvo ' + valores[0]);
  if (!valores[1].includes('2400')) throw new Error('FALLÓ: Pmax esperado 2400, obtuvo ' + valores[1]);
  if (!valores[2].includes('24.28')) throw new Error('FALLÓ: Ed esperado 24.28, obtuvo ' + valores[2]);

  const subDemandaMaxima = [...doc.querySelectorAll('.indicador-card .sub')][1].textContent;
  console.log('  Sub demanda máxima:', subDemandaMaxima);
  if (!subDemandaMaxima.includes('h=')) throw new Error('FALLÓ: no se muestra la hora de la demanda máxima');

  console.log('\n=== PASO 3b: La gráfica expone el valor exacto de cada hora (tooltip) ===');
  const zonas = doc.querySelectorAll('#graficoPerfil rect.barra-hit');
  const barras = doc.querySelectorAll('#graficoPerfil rect.barra');
  console.log('  Zonas sensibles:', zonas.length, '| barras:', barras.length);
  if (zonas.length !== 24) throw new Error('FALLÓ: se esperaban 24 zonas sensibles, hay ' + zonas.length);
  if (barras.length !== 24) throw new Error('FALLÓ: se esperaban 24 barras, hay ' + barras.length);
  const perfilEnGrafica = [...zonas].map(z => Number(z.dataset.valor));
  const perfilReal = window.__estadoAppReto01.resultados.perfilHorarioW;
  if (perfilEnGrafica.join(',') !== perfilReal.join(','))
    throw new Error('FALLÓ: los valores del tooltip no coinciden con el perfil calculado');
  console.log('  Valor expuesto en h=6:', perfilEnGrafica[6], 'W (coincide con el perfil calculado)');

  console.log('\n=== PASO 4: Rechazar una carga duplicada (RF-09) ===');
  setVal('descCarga', 'NEVERA'); // misma descripción (otro casing), misma potencia y horario que la fila 0
  setVal('cantCarga', 1);
  setVal('potCarga', 150);
  doc.querySelectorAll('#horarioGrid input[type=checkbox]').forEach(chk => { chk.checked = true; }); // 24 h, igual a "nevera"
  click('btnAgregarCarga');
  const filasTrasDuplicado = doc.querySelectorAll('#cuerpoTablaCargas tr');
  if (filasTrasDuplicado.length !== 8) throw new Error('FALLÓ: la carga duplicada no debió agregarse, hay ' + filasTrasDuplicado.length + ' filas');
  const estadoDuplicado = doc.getElementById('estadoCarga').textContent;
  console.log('  Estado:', estadoDuplicado);
  if (!estadoDuplicado.includes('Ya existe una carga igual')) throw new Error('FALLÓ: no se detectó el duplicado');

  console.log('\n=== PASO 5: Editar una carga existente y verificar recálculo automático (RF-02 / F-8) ===');
  const potenciaInstaladaAntes = doc.querySelectorAll('.indicador-card .value')[0].textContent;
  const filaMotobomba = doc.querySelectorAll('#cuerpoTablaCargas tr')[4]; // 0:nevera 1:tv 2:aire 3:luces 4:motobomba
  filaMotobomba.dispatchEvent(new window.Event('click', { bubbles: true }));
  click('btnEditarCarga');
  if (doc.getElementById('btnAgregarCarga').textContent !== 'Guardar cambios') throw new Error('FALLÓ: no entró en modo edición');
  setVal('potCarga', 900); // motobomba: de 750 W a 900 W
  click('btnAgregarCarga'); // guarda cambios
  const filasTrasEditar = doc.querySelectorAll('#cuerpoTablaCargas tr');
  if (filasTrasEditar.length !== 8) throw new Error('FALLÓ: editar no debe cambiar el número de filas, hay ' + filasTrasEditar.length);
  const potMotobombaEditada = filasTrasEditar[4].querySelectorAll('td')[4].textContent;
  if (potMotobombaEditada !== '900') throw new Error('FALLÓ: la potencia editada no se guardó, obtuvo ' + potMotobombaEditada);
  const potenciaInstaladaDespues = doc.querySelectorAll('.indicador-card .value')[0].textContent;
  console.log('  Potencia instalada antes/después de editar:', potenciaInstaladaAntes, '->', potenciaInstaladaDespues);
  if (potenciaInstaladaAntes === potenciaInstaladaDespues) throw new Error('FALLÓ: los resultados no se recalcularon automáticamente tras editar una carga');

  console.log('\n=== PASO 6: Advertencia cuando CU = 0 (hallazgo transversal del curso) ===');
  setVal('costoUnitario', 0);
  change('costoUnitario');
  const avisoCU0 = doc.getElementById('avisoCU0');
  if (avisoCU0.hidden) throw new Error('FALLÓ: el aviso de CU=0 debía mostrarse');
  console.log('  Aviso visible:', avisoCU0.textContent.trim());
  setVal('costoUnitario', 800);
  change('costoUnitario');
  if (!doc.getElementById('avisoCU0').hidden) throw new Error('FALLÓ: el aviso de CU=0 debía ocultarse al volver a un CU > 0');

  console.log('\n=== PASO 7: Eliminar con confirmación y recálculo automático ===');
  doc.querySelectorAll('#cuerpoTablaCargas tr')[7].dispatchEvent(new window.Event('click', { bubbles: true })); // ducha eléctrica
  click('btnEliminarCarga');
  if (doc.getElementById('confirmarEliminarCarga').hidden) throw new Error('FALLÓ: debía pedirse confirmación antes de eliminar');
  if (doc.querySelectorAll('#cuerpoTablaCargas tr').length !== 8) throw new Error('FALLÓ: no debe eliminarse antes de confirmar');
  click('btnConfirmarEliminar');
  const filasTrasEliminar = doc.querySelectorAll('#cuerpoTablaCargas tr');
  if (filasTrasEliminar.length !== 7) throw new Error('FALLÓ: se esperaban 7 filas tras eliminar, hay ' + filasTrasEliminar.length);
  if (!doc.getElementById('confirmarEliminarCarga').hidden) throw new Error('FALLÓ: la confirmación debía ocultarse tras eliminar');

  console.log('\n=== PASO 8: Generar el informe PDF sin errores (incluye horario, días de operación y aviso CU=0) ===');
  click('btnCalcular'); // vuelve a dejar resultados válidos con CU=800 antes de generar el informe
  click('btnGenerarInforme');
  const estadoInforme = doc.getElementById('estadoInforme').textContent;
  console.log('  Estado:', estadoInforme);
  if (!estadoInforme.includes('descargado')) throw new Error('FALLÓ al generar el informe: ' + estadoInforme);

  console.log('\n=== PASO 9: Cargar el perfil medido del equipo (opción con hardware) ===');
  const estadoApp = window.__estadoAppReto01;
  const EdAntes = estadoApp.resultados.energiaDiariaKWh;
  const fuenteAntes = estadoApp.resultados.fuentePerfil;
  console.log('  Antes de la medición -> fuente:', fuenteAntes, '| Ed:', EdAntes.toFixed(2));
  if (fuenteAntes !== 'estimado') throw new Error('FALLÓ: sin medición el perfil debe ser el estimado');

  // Se simula la lectura del archivo tal como la hace el navegador.
  const Medicion = window.Medicion;
  if (!Medicion) throw new Error('FALLÓ: medicion.js no quedó disponible en la página');
  const csvPrueba = ['fecha_hora,potencia_w']
    .concat(Array.from({ length: 24 }, (_, h) => `2026-10-02 ${String(h).padStart(2, '0')}:00,1000`))
    .join('\n');
  const lectura = Medicion.perfilDesdeHojaDeDatos(csvPrueba);
  estadoApp.medicion = {
    perfilW: lectura.perfilW, totalLecturas: lectura.totalLecturas,
    horasSinDato: lectura.horasSinDato, potenciaEstimada: lectura.potenciaEstimada,
    avisos: lectura.avisos, archivo: 'prueba.csv', fecha: '02/10/2026',
  };
  estadoApp.fuentePerfil = 'medido';
  click('btnCalcular');

  const rMedido = estadoApp.resultados;
  console.log('  Con medición        -> fuente:', rMedido.fuentePerfil, '| Ed:', rMedido.energiaDiariaKWh.toFixed(2));
  if (rMedido.fuentePerfil !== 'medido') throw new Error('FALLÓ: debía usarse el perfil medido');
  if (Math.abs(rMedido.energiaDiariaKWh - 24) > 1e-9) throw new Error('FALLÓ: Ed medida esperada 24.00, obtuvo ' + rMedido.energiaDiariaKWh);
  if (!rMedido.comparacionPerfiles) throw new Error('FALLÓ: debía aparecer la comparación estimado vs medido');
  console.log('  Comparación: estimado', rMedido.comparacionPerfiles.EdEstimada.toFixed(2),
              '| medido', rMedido.comparacionPerfiles.EdMedida.toFixed(2));
  if (doc.getElementById('avisoFuentePerfil').hidden) throw new Error('FALLÓ: debía mostrarse el origen del perfil');
  if (doc.getElementById('avisoComparacion').hidden) throw new Error('FALLÓ: debía mostrarse la comparación');

  console.log('\n=== PASO 10: Volver al perfil estimado y quitar la medición ===');
  doc.getElementById('fuentePerfil').value = 'estimado';
  change('fuentePerfil');
  if (estadoApp.resultados.fuentePerfil !== 'estimado') throw new Error('FALLÓ: el selector debía devolver al perfil estimado');
  if (Math.abs(estadoApp.resultados.energiaDiariaKWh - EdAntes) > 1e-9)
    throw new Error('FALLÓ: al volver al estimado, Ed debía ser la de antes (' + EdAntes.toFixed(2) + ')');
  console.log('  Selector en "estimado" -> Ed vuelve a', estadoApp.resultados.energiaDiariaKWh.toFixed(2));

  click('btnQuitarMedicion');
  if (estadoApp.medicion !== null) throw new Error('FALLÓ: la medición debía quedar retirada');
  if (!doc.getElementById('resumenMedicion').hidden) throw new Error('FALLÓ: el resumen de la medición debía ocultarse');
  click('btnCalcular');
  if (estadoApp.resultados.comparacionPerfiles !== null) throw new Error('FALLÓ: sin medición no debe quedar comparación');
  if (Math.abs(estadoApp.resultados.energiaDiariaKWh - EdAntes) > 1e-9)
    throw new Error('FALLÓ: tras quitar la medición, los resultados deben ser los originales');
  console.log('  Medición retirada -> la app queda exactamente como antes (Ed', estadoApp.resultados.energiaDiariaKWh.toFixed(2) + ')');

  console.log('\n=== PASO 11: Cargar un proyecto NO debe borrar la medición en silencio ===');
  // Reproduce la secuencia real: primero se carga la medición y después un
  // proyecto .json que no la incluye (los guardados antes de esta función).
  estadoApp.medicion = {
    perfilW: new Array(24).fill(1000), totalLecturas: 288, horasSinDato: [],
    potenciaEstimada: false, avisos: [], archivo: 'medicion_previa.csv', fecha: '02/10/2026',
  };
  estadoApp.fuentePerfil = 'medido';

  const proyectoSinMedicion = {
    nombreProyecto: 'Proyecto sin medición', integrantes: 'niurka', fecha: '02/10/2026',
    contexto: 'off-grid',
    cargas: [{ descripcion: 'nevera', cantidad: 1, potenciaUnitariaW: 150, horario: new Array(24).fill(1) }],
  };
  // Se invoca el mismo manejador del input de archivo con un File simulado.
  const inputProyecto = doc.getElementById('inputCargarArchivo');
  const archivoSimulado = new window.File([JSON.stringify(proyectoSinMedicion)], 'proyecto.json', { type: 'application/json' });
  Object.defineProperty(inputProyecto, 'files', { value: [archivoSimulado], configurable: true });
  inputProyecto.dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 120)); // el FileReader es asíncrono

  const estadoArchivo = doc.getElementById('estadoArchivo').textContent;
  console.log('  Mensaje:', estadoArchivo);
  if (estadoApp.medicion === null) throw new Error('FALLÓ: la medición no debía borrarse al cargar un proyecto que no la trae');
  if (!estadoArchivo.includes('conservó')) throw new Error('FALLÓ: debía avisarse que la medición se conservó');
  if (estadoApp.resultados.fuentePerfil !== 'medido') throw new Error('FALLÓ: debía seguir usándose el perfil medido');
  if (!estadoApp.resultados.comparacionPerfiles) throw new Error('FALLÓ: con cargas y medición debía aparecer la comparación');
  console.log('  Medición conservada | fuente:', estadoApp.resultados.fuentePerfil,
              '| comparación: estimado', estadoApp.resultados.comparacionPerfiles.EdEstimada.toFixed(2),
              'vs medido', estadoApp.resultados.comparacionPerfiles.EdMedida.toFixed(2));

  console.log('\n=== PASO 12: Generador (Reto 02) — datos heredados sin reingreso (RF-13) ===');
  click('btnCalcular');
  const heredados = [...doc.querySelectorAll('#heredadosGrid .indicador-card .value')].map(e => e.textContent);
  console.log('  Heredados:', heredados.join(' | '));
  if (!heredados[0].includes(estadoApp.resultados.energiaDiariaKWh.toFixed(2))) throw new Error('FALLÓ: la energía diaria no llegó al Paso 4');
  if (doc.getElementById('coincidenciaSolar').hidden) throw new Error('FALLÓ: falta la coincidencia con la ventana solar (RF-17)');
  const opcionesSitio = doc.querySelectorAll('#selSitio option').length;
  console.log('  Sitios disponibles:', opcionesSitio, '|', doc.getElementById('estadoDatos').textContent.trim());
  if (opcionesSitio < 6) throw new Error('FALLÓ: la base de sitios no se cargó');

  console.log('\n=== PASO 13: Caso de prueba del TdR con el módulo de referencia ===');
  setVal('selSitio', 'nazareth-caso-prueba'); change('selSitio');
  setVal('genCriterioModulo', 'manual'); change('genCriterioModulo');
  setVal('genModuloManual', 'referencia-tdr-550'); change('genModuloManual');
  // Para reproducir el caso de prueba se usa su propio perfil (Ed = 7,58 kWh/día)
  const perfilCaso = [240,240,240,240,160,160,790,160,510,390,435,435,85,85,435,435,510,910,160,160,160,160,240,240];
  estadoApp.medicion = { perfilW: perfilCaso, totalLecturas: 24, horasSinDato: [], potenciaEstimada: false, avisos: [], archivo: 'perfil_caso_prueba.json', fecha: '04/10/2026' };
  estadoApp.fuentePerfil = 'medido';
  click('btnCalcular');
  click('btnDimensionar');
  const g = estadoApp.generador;
  if (!g) throw new Error('FALLÓ: no se dimensionó: ' + doc.getElementById('estadoGenerador').textContent);
  const sel = g.seleccion;
  console.log('  Ppico crítico', g.potenciaPicoKWp.toFixed(2), '| módulos', sel.numeroModulos, '| config', sel.cadenasParalelo + 'x' + sel.modulosSerie,
              '| Voc gen', sel.vocGeneradorTminV.toFixed(1), '| Isc', sel.iscGeneradorA.toFixed(1), '| Idis', sel.corrienteDisenoA.toFixed(1), '| área', sel.areaGeneradorM2.toFixed(2));
  if (Math.abs(g.potenciaPicoKWp - 2.08) > 0.005) throw new Error('FALLÓ: Ppico crítico esperado 2,08');
  if (sel.numeroModulos !== 4 || sel.modulosSerie !== 4 || sel.cadenasParalelo !== 1) throw new Error('FALLÓ: se esperaba 1 cadena de 4');
  if (Math.abs(sel.corrienteDisenoA - 21.875) > 1e-9) throw new Error('FALLÓ: corriente de diseño esperada 21,9 A');
  if (doc.getElementById('resultadosGenerador').hidden) throw new Error('FALLÓ: los resultados del generador no se muestran');
  if (doc.querySelectorAll('#cuerpoCatalogo tr').length !== 5) throw new Error('FALLÓ: la tabla del catálogo debía tener 5 filas');

  console.log('\n=== PASO 14: Cambiar la tensión máxima recalcula solo (RF-19) ===');
  setVal('genVmax', 150); change('genVmax');
  console.log('  Con 150 V ->', estadoApp.generador.seleccion.cadenasParalelo + ' cadenas de ' + estadoApp.generador.seleccion.modulosSerie);
  if (estadoApp.generador.seleccion.cadenasParalelo !== 2) throw new Error('FALLÓ: con 150 V debían salir 2 cadenas');
  setVal('genVmax', 600); change('genVmax');

  console.log('\n=== PASO 15: Selección automática con el catálogo real (RF-23) ===');
  setVal('genCriterioModulo', 'menor_excedente'); change('genCriterioModulo');
  console.log('  Mes crítico + menor excedente ->', estadoApp.generador.seleccion.modulo.fabricante, estadoApp.generador.seleccion.modulo.modelo);
  if (!estadoApp.generador.seleccion.modulo.modelo.startsWith('TSM-DEG19C.20')) throw new Error('FALLÓ: se esperaba el Trina 550');
  doc.querySelector('input[name="criterioRecurso"][value="anual"]').checked = true;
  doc.querySelector('input[name="criterioRecurso"][value="anual"]').dispatchEvent(new window.Event('change', { bubbles: true }));
  console.log('  Promedio anual + menor excedente ->', estadoApp.generador.seleccion.modulo.fabricante, estadoApp.generador.seleccion.modulo.modelo);
  if (estadoApp.generador.seleccion.modulo.modelo !== 'CS6.2-66TB-625HP') throw new Error('FALLÓ: se esperaba el Canadian 625');

  console.log('\n=== PASO 16: Área insuficiente se advierte (RF-22) ===');
  setVal('genArea', 5); change('genArea');
  if (doc.getElementById('avisosGenerador').hidden) throw new Error('FALLÓ: debía advertirse que no cabe');
  console.log('  Aviso:', doc.getElementById('avisosGenerador').textContent.replace(/\s+/g, ' ').trim().slice(0, 90));
  setVal('genArea', 20); change('genArea');

  console.log('\n=== PASO 17: Informe con la página del generador (RF-24) ===');
  click('btnGenerarInforme');
  if (!doc.getElementById('estadoInforme').textContent.includes('no incluye la justificación técnica')) throw new Error('FALLÓ: debía avisar que falta la justificación');
  const textoJust = 'Se seleccionó el criterio de menor excedente debido a que el sistema es aislado y no conviene instalar potencia que no se aprovecha.';
  setVal('genJustificacion', textoJust);
  doc.getElementById('genJustificacion').dispatchEvent(new window.Event('input', { bubbles: true }));
  if (estadoApp.generador.justificacionGrupo !== textoJust) throw new Error('FALLÓ: la justificación no llegó al estado del generador');
  console.log('  Justificación técnica:', estadoApp.generador.justificacionGrupo, '|', doc.getElementById('contadorJustificacion').textContent);
  click('btnGenerarInforme');
  if (doc.getElementById('estadoInforme').textContent.includes('no incluye la justificación')) throw new Error('FALLÓ: con justificación no debía avisar');
  console.log('  Estado:', doc.getElementById('estadoInforme').textContent, '| páginas:', paginasInforme);
  if (!doc.getElementById('estadoInforme').textContent.includes('descargado')) throw new Error('FALLÓ: el informe no se generó');
  if (paginasInforme !== 3) throw new Error('FALLÓ: el informe debía tener 3 páginas (1 de consumo + 2 del generador), tuvo ' + paginasInforme);
  if (!estadoApp.generador.supuestos || estadoApp.generador.supuestos.length !== 10) throw new Error('FALLÓ: los supuestos no quedaron guardados con el resultado');
  if (doc.querySelectorAll('#listaSupuestos li').length !== 10) throw new Error('FALLÓ: la lista de supuestos de la app debía tener 10 elementos');
  if (doc.getElementById('bloqueSupuestos').open) throw new Error('FALLÓ: los supuestos debían empezar plegados');

  console.log('\n=== PASO 18: La configuración del generador viaja en el .json del proyecto ===');
  const cfg = window.UIGenerador.obtenerConfiguracion();
  if (cfg.sitioId !== 'nazareth-caso-prueba' || cfg.criterioRecurso !== 'anual' || !cfg.dimensionado) throw new Error('FALLÓ: configuración incompleta');
  console.log('  Guardado:', cfg.sitioId, cfg.criterioRecurso, cfg.criterioModulo, 'dimensionado=' + cfg.dimensionado);
  if (!cfg.justificacionGrupo || !cfg.justificacionGrupo.startsWith('Se seleccionó')) throw new Error('FALLÓ: la justificación no se guarda en el .json');
  window.UIGenerador.aplicarConfiguracion(null);
  if (doc.getElementById('genJustificacion').value !== '') throw new Error('FALLÓ: un proyecto sin justificación no debía heredar la anterior');
  window.UIGenerador.aplicarConfiguracion(cfg);
  if (doc.getElementById('genJustificacion').value !== cfg.justificacionGrupo) throw new Error('FALLÓ: la justificación no se restauró');
  console.log('  La justificación se guarda, se restaura y no pasa de un proyecto a otro.');

  console.log('\n=== PASO 19: Método propio en la interfaz (balance día/noche con crecimiento) ===');
  window.UIGenerador.aplicarConfiguracion(cfg);
  setVal('genCriterioModulo', 'manual'); change('genCriterioModulo');
  setVal('genModuloManual', 'referencia-tdr-550'); change('genModuloManual');
  doc.querySelector('input[name="criterioRecurso"][value="critico"]').checked = true;
  doc.querySelector('input[name="criterioRecurso"][value="critico"]').dispatchEvent(new window.Event('change', { bubbles: true }));
  if (!doc.getElementById('campoMetodoBalance').hidden) throw new Error('FALLÓ: los campos del método propio debían estar ocultos con el método de referencia');
  setVal('genMetodo', 'balance'); change('genMetodo');
  if (doc.getElementById('campoMetodoBalance').hidden) throw new Error('FALLÓ: los campos del método propio no aparecieron');
  setVal('genCrecimiento', 20); change('genCrecimiento');
  const gm = estadoApp.generador;
  console.log('  Ppico de diseño', gm.potenciaPicoKWp.toFixed(2), 'kWp | módulos', gm.seleccion.numeroModulos, '| E_eq', gm.metodo.energiaEquivalenteKWh.toFixed(2), '| Fc', gm.metodo.fc);
  if (Math.abs(gm.potenciaPicoKWp - 2.639) > 0.001 || gm.seleccion.numeroModulos !== 5) throw new Error('FALLÓ: con g = 20 % debían salir 2,64 kWp y 5 módulos');
  if (doc.getElementById('comparacionMetodo').hidden || !doc.getElementById('comparacionMetodo').textContent.includes('2.08')) throw new Error('FALLÓ: falta la comparación con el método de referencia');
  if (!gm.supuestos.some(sp => sp.id === 'crecimiento')) throw new Error('FALLÓ: los supuestos no incluyen el crecimiento');
  click('btnGenerarInforme');
  if (!doc.getElementById('estadoInforme').textContent.includes('descargado')) throw new Error('FALLÓ: el informe con el método propio no se generó');
  const cfgM = window.UIGenerador.obtenerConfiguracion();
  if (cfgM.metodoPotencia !== 'balance' || cfgM.crecimientoPct !== 20) throw new Error('FALLÓ: el método no se guarda en el .json');
  setVal('genCrecimiento', 0); change('genCrecimiento');
  setVal('genCobertura', 80); change('genCobertura');
  const gc = estadoApp.generador;
  console.log('  Cobertura 80 % (caso off-grid): Ppico', gc.potenciaPicoKWp.toFixed(2), 'kWp | advertencia:', gc.advertencias.some(a => a.includes('off-grid')));
  if (Math.abs(gc.potenciaPicoKWp - 1.759) > 0.001) throw new Error('FALLÓ: con cobertura 80 % debían salir 1,76 kWp');
  if (doc.getElementById('avisosGenerador').hidden || !doc.getElementById('avisosGenerador').textContent.includes('off-grid')) throw new Error('FALLÓ: faltó la advertencia de cobertura en off-grid');
  if (!gc.supuestos.some(sp => sp.id === 'cobertura')) throw new Error('FALLÓ: los supuestos no incluyen la meta de cobertura');
  if (window.UIGenerador.obtenerConfiguracion().coberturaPct !== 80) throw new Error('FALLÓ: la cobertura no se guarda en el .json');
  window.UIGenerador.aplicarConfiguracion(null);
  if (doc.getElementById('genCobertura').value !== '100') throw new Error('FALLÓ: un proyecto sin configuración debía volver a cobertura 100 %');
  if (doc.getElementById('genMetodo').value !== 'referencia') throw new Error('FALLÓ: un proyecto sin configuración debía volver al método de referencia');
  console.log('  El método se guarda en el .json y un proyecto nuevo vuelve al método de referencia.');

  console.log('\n=== TODO OK: la web app funciona de principio a fin, corrige las observaciones del evaluador y coincide con MATLAB ===');
}

main().catch(err => {
  console.error('ERROR EN LA PRUEBA:', err.message);
  process.exit(1);
});
