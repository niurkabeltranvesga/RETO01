// test_jsdom.js

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

async function main() {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'http://localhost/',
    pretendToBeVisual: true,
  });
  const { window } = dom;

  
  window.jspdf = { jsPDF: function () { return { setFillColor(){}, rect(){}, setFont(){}, setFontSize(){}, setTextColor(){}, text(){}, roundedRect(){}, setDrawColor(){}, line(){}, addPage(){}, save(){} }; } };


  const motorCalculo = fs.readFileSync(path.join(__dirname, 'motorCalculo.js'), 'utf-8');
  const informe = fs.readFileSync(path.join(__dirname, 'informe.js'), 'utf-8');
  const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf-8');

  window.eval(motorCalculo);
  window.eval(informe);
  window.eval(appJs);

  const doc = window.document;

  function click(id) {
    doc.getElementById(id).dispatchEvent(new window.Event('click', { bubbles: true }));
  }
  function setVal(id, val) {
    doc.getElementById(id).value = val;
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

  console.log('\n=== TODO OK: la web app funciona de principio a fin y coincide con MATLAB ===');
}

main().catch(err => {
  console.error('ERROR EN LA PRUEBA:', err.message);
  process.exit(1);
});
