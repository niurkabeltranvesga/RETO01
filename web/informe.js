// informe.js


function formatoPesosCOP(valor) {
  valor = Math.round(valor);
  const signo = valor < 0 ? '-' : '';
  valor = Math.abs(valor);
  const digitos = String(valor);
  const partes = [];
  let resto = digitos;
  while (resto.length > 3) {
    partes.unshift(resto.slice(-3));
    resto = resto.slice(0, -3);
  }
  partes.unshift(resto);
  return signo + '$ ' + partes.join('.');
}

function capitalizar(palabra) {
  if (!palabra) return palabra;
  return palabra.charAt(0).toUpperCase() + palabra.slice(1);
}

function generarInformePDF(proyecto, resultados, parametros) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const COLOR_ACENTO = [224, 138, 82];       // durazno
  const COLOR_ACENTO_TEXTO = [184, 95, 50];  // durazno más saturado
  const COLOR_ACENTO_CLARO = [252, 235, 221];
  const COLOR_BORDE_CARD = [237, 220, 196];
  const COLOR_GRIS = [107, 96, 88];
  const COLOR_OSCURO = [42, 35, 32];
  const COLOR_BANDA = [253, 248, 243];

  const anchoPagina = 210, altoPagina = 297, margen = 14;
  const anchoUtil = anchoPagina - 2 * margen;
  let y = 0;

  function nuevaPagina() {
    doc.addPage();
    y = margen;
  }

  function espacioDisponible() {
    return altoPagina - margen - y;
  }

  function tituloSeccion(texto) {
    doc.setFillColor(...COLOR_ACENTO);
    doc.rect(margen, y, 1.6, 5.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...COLOR_OSCURO);
    doc.text(texto, margen + 4, y + 4.3);
    y += 9;
  }

  //ENCABEZADO
  const altoHeader = 30;
  doc.setFillColor(...COLOR_ACENTO);
  doc.rect(0, 0, anchoPagina, altoHeader, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(...COLOR_OSCURO);
  doc.text('Informe de Requerimiento Energético', margen, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.text(String(proyecto.nombreProyecto || ''), margen, 17.5);

  const integrantesTexto = Array.isArray(proyecto.integrantes) ? proyecto.integrantes.join(', ') : proyecto.integrantes;
  doc.setFontSize(8.5);
  doc.setTextColor(102, 77, 61);
  doc.text('Integrantes: ' + (integrantesTexto || ''), margen, 22.5);
  doc.text('Fecha: ' + (proyecto.fecha || '') + '      Contexto: ' + String(proyecto.contexto || '').toUpperCase(), margen, 27);

  y = altoHeader + 8;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_GRIS);
  doc.text('Este informe resume cuánta energía consume el proyecto, cuánto cuesta y en qué horas del día se usa más electricidad.', margen, y, { maxWidth: anchoUtil });
  y += 9;

  //INDICADORES
  tituloSeccion('Indicadores principales');
  const indicadores = [
    ['Potencia instalada', resultados.potenciaInstaladaW.toFixed(0) + ' W', '(' + (resultados.potenciaInstaladaW/1000).toFixed(2) + ' kW)'],
    ['Demanda máxima', resultados.demandaMaximaW.toFixed(0) + ' W', '(' + (resultados.demandaMaximaW/1000).toFixed(2) + ' kW)'],
    ['Energía diaria', resultados.energiaDiariaKWh.toFixed(2) + ' kWh', 'por día'],
    ['Energía mensual', resultados.energiaMensualKWh.toFixed(1) + ' kWh', 'por mes'],
    ['Energía anual', resultados.energiaAnualKWh.toFixed(0) + ' kWh', 'por año'],
  ];
  const altoCardInd = 18, espacioCard = 2.5;
  const anchoCardInd = (anchoUtil - 4 * espacioCard) / 5;
  indicadores.forEach(([label, val, sub], i) => {
    const x = margen + i * (anchoCardInd + espacioCard);
    doc.setFillColor(...COLOR_ACENTO_CLARO);
    doc.setDrawColor(...COLOR_BORDE_CARD);
    doc.roundedRect(x, y, anchoCardInd, altoCardInd, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_GRIS);
    doc.text(label, x + 2.2, y + 5, { maxWidth: anchoCardInd - 4 });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLOR_ACENTO_TEXTO);
    doc.text(val, x + 2.2, y + 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_GRIS);
    doc.text(sub, x + 2.2, y + 15.5);
  });
  y += altoCardInd + 8;

  //CUADRO DE CARGAS
  tituloSeccion('Cuadro de cargas');
  const altoFila = 6.2, altoEncabezado = 7;
  const columnas = [
    { titulo: '#', ancho: 0.05 }, { titulo: 'Carga', ancho: 0.33 },
    { titulo: 'Cant.', ancho: 0.09 }, { titulo: 'Pot.unit.', ancho: 0.145 },
    { titulo: 'Pot.total', ancho: 0.145 }, { titulo: 'Horas/día', ancho: 0.12 },
    { titulo: 'Uso', ancho: 0.12 },
  ];
  const xPos = [];
  let acumulado = margen + 2;
  columnas.forEach(c => { xPos.push(acumulado); acumulado += c.ancho * anchoUtil; });

  function dibujarEncabezadoTabla() {
    doc.setFillColor(...COLOR_ACENTO);
    doc.rect(margen, y, anchoUtil, altoEncabezado, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_OSCURO);
    columnas.forEach((c, i) => doc.text(c.titulo, xPos[i], y + altoEncabezado / 2 + 1.2));
    y += altoEncabezado;
  }

  dibujarEncabezadoTabla();

  proyecto.cargas.forEach((c, i) => {
    if (espacioDisponible() < altoFila + 30) { // deja espacio para no cortar feo; +30 margen de cortesía
      nuevaPagina();
      tituloSeccion('Cuadro de cargas (continuación)');
      dibujarEncabezadoTabla();
    }
    if (i % 2 === 1) {
      doc.setFillColor(...COLOR_BANDA);
      doc.rect(margen, y, anchoUtil, altoFila, 'F');
    }
    const horasUso = c.horario.reduce((a, b) => a + b, 0);
    const fila = [
      String(i + 1), c.descripcion, String(c.cantidad),
      c.potenciaUnitariaW + ' W', c.potenciaTotalW + ' W',
      horasUso + ' h', capitalizar(resultados.clasificacionCargas[i]),
    ];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(...COLOR_OSCURO);
    fila.forEach((texto, j) => doc.text(String(texto), xPos[j], y + altoFila / 2 + 1.2, { maxWidth: columnas[j].ancho * anchoUtil - 2 }));
    y += altoFila;
  });
  y += 8;

  //PERFIL HORARIO
  if (espacioDisponible() < 75) nuevaPagina();
  tituloSeccion('Perfil horario de demanda (24 horas)');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_GRIS);
  doc.text('Muestra en qué horas del día se concentra el mayor consumo de energía.', margen, y);
  y += 6;

  const altoGrafico = 48;
  const anchoGraficoArea = anchoUtil - 10;
  const xGrafico = margen + 8;
  const maxValor = Math.max(...resultados.perfilHorarioW, 1);
  const pasoX = anchoGraficoArea / 24;
  const anchoBarra = pasoX * 0.7;

  doc.setDrawColor(230, 226, 214);
  for (let i = 0; i <= 4; i++) {
    const yLinea = y + altoGrafico - (i / 4) * altoGrafico;
    doc.line(xGrafico, yLinea, xGrafico + anchoGraficoArea, yLinea);
    doc.setFontSize(6.5);
    doc.setTextColor(...COLOR_GRIS);
    doc.text(String(Math.round((i / 4) * maxValor)), xGrafico - 2, yLinea + 1, { align: 'right' });
  }

  doc.setFillColor(...COLOR_ACENTO_TEXTO);
  resultados.perfilHorarioW.forEach((valor, h) => {
    const alturaBarra = (valor / maxValor) * altoGrafico;
    const x = xGrafico + h * pasoX + (pasoX - anchoBarra) / 2;
    doc.setFillColor(...COLOR_ACENTO_TEXTO); // reestablecer: setTextColor (abajo) comparte el mismo estado de color en jsPDF
    doc.rect(x, y + altoGrafico - alturaBarra, anchoBarra, alturaBarra, 'F');
    if (h % 2 === 0) {
      doc.setFontSize(6.5);
      doc.setTextColor(...COLOR_GRIS);
      doc.text(String(h), x + anchoBarra / 2, y + altoGrafico + 4, { align: 'center' });
    }
  });
  y += altoGrafico + 10;

  // COSTOS 
  if (espacioDisponible() < 35) nuevaPagina();
  tituloSeccion('Costos estimados');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(...COLOR_GRIS);
  doc.text('Calculado con un costo de ' + formatoPesosCOP(parametros.costoUnitarioCU) + ' / kWh por cada kWh consumido.', margen, y);
  y += 6;

  const costos = [
    ['Costo diario', formatoPesosCOP(resultados.costoDiario)],
    ['Costo mensual', formatoPesosCOP(resultados.costoMensual)],
    ['Costo anual', formatoPesosCOP(resultados.costoAnual)],
  ];
  const altoCardCosto = 16, anchoCardCosto = (anchoUtil - 2 * espacioCard) / 3;
  costos.forEach(([label, val], i) => {
    const x = margen + i * (anchoCardCosto + espacioCard);
    doc.setFillColor(...COLOR_ACENTO_CLARO);
    doc.setDrawColor(...COLOR_BORDE_CARD);
    doc.roundedRect(x, y, anchoCardCosto, altoCardCosto, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_GRIS);
    doc.text(label, x + 3, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(...COLOR_ACENTO_TEXTO);
    doc.text(val, x + 3, y + 12.5);
  });

  const nombreArchivo = 'Informe de Requerimiento Energético.pdf';
  doc.save(nombreArchivo);
}
