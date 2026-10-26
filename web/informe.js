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

function generarInformePDF(proyecto, resultados, parametros, generador, conversion) {
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
  doc.text('Informe de Dimensionamiento Fotovoltaico', margen, 11);

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

  // Trazabilidad: de dónde salió el perfil horario con el que se calculó todo.
  const medicion = proyecto.medicion || null;
  const perfilEsMedido = resultados.fuentePerfil === 'medido';
  if (perfilEsMedido || medicion) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR_ACENTO_TEXTO);
    let origen;
    if (perfilEsMedido) {
      origen = 'Origen del perfil: MEDIDO con equipo de medición'
        + (medicion && medicion.archivo ? ' (' + medicion.archivo + ')' : '')
        + (medicion && medicion.totalLecturas ? ', ' + medicion.totalLecturas + ' lecturas' : '')
        + (medicion && medicion.fecha ? ', cargado el ' + medicion.fecha : '') + '.';
      if (medicion && medicion.potenciaEstimada) {
        origen += ' La potencia se estimó de corriente y voltaje (potencia aparente, VA).';
      }
    } else {
      origen = 'Origen del perfil: ESTIMADO a partir del cuadro de cargas. La medición cargada se dejó como referencia.';
    }
    doc.text(origen, margen, y, { maxWidth: anchoUtil });
    y += 7;

    const comparacion = resultados.comparacionPerfiles;
    if (comparacion) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...COLOR_GRIS);
      const signo = comparacion.diferenciaKWh >= 0 ? '+' : '-';
      doc.text(
        'Contraste estimado vs. medido: ' + f(comparacion.EdEstimada, 2) + ' kWh/día estimados frente a ' +
        f(comparacion.EdMedida, 2) + ' kWh/día medidos (' + signo +
        f(Math.abs(comparacion.diferenciaKWh), 2) + ' kWh/día).',
        margen, y, { maxWidth: anchoUtil }
      );
      y += 7;
    }
  }

  //INDICADORES
  tituloSeccion('Indicadores principales');
  const hayPotenciaInstalada = resultados.potenciaInstaladaW !== null && resultados.potenciaInstaladaW !== undefined;
  const indicadores = [
    hayPotenciaInstalada
      ? ['Potencia instalada', f(resultados.potenciaInstaladaW, 0) + ' W', f(resultados.potenciaInstaladaW / 1000, 2) + ' kW']
      : ['Potencia instalada', '—', 'sin cuadro de cargas'],
    ['Demanda máxima', f(resultados.demandaMaximaW, 0) + ' W', 'a las ' + String(resultados.horaDemandaMaximaH).padStart(2, '0') + ':00' + ((resultados.horasDemandaMaximaH || []).length > 1 ? ' (se repite)' : '')],
    ['Energía diaria', f(resultados.energiaDiariaKWh, 3) + ' kWh', 'por día'],
    ['Energía mensual', f(resultados.energiaMensualKWh, 1) + ' kWh', parametros.diasOperacionMes + ' días al mes'],
    ['Energía anual', f(resultados.energiaAnualKWh, 1) + ' kWh', parametros.diasOperacionAnio + ' días al año'],
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
  const cargasDelProyecto = proyecto.cargas || [];
  tituloSeccion('Cuadro de cargas');
  if (cargasDelProyecto.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR_GRIS);
    doc.text('No se registró el inventario de aparatos: los resultados provienen únicamente de la medición del equipo, que entrega el consumo total sin desagregar por carga.', margen, y, { maxWidth: anchoUtil });
    y += 12;
  }
  const altoFila = 6.2, altoEncabezado = 7;
  const columnas = [
    { titulo: '#', ancho: 0.05 }, { titulo: 'Carga', ancho: 0.26 },
    { titulo: 'Cant.', ancho: 0.07 }, { titulo: 'Pot.unit.', ancho: 0.11 },
    { titulo: 'Pot.total', ancho: 0.11 }, { titulo: 'Horario', ancho: 0.29 },
    { titulo: 'Uso', ancho: 0.11 },
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

  if (cargasDelProyecto.length > 0) dibujarEncabezadoTabla();

  cargasDelProyecto.forEach((c, i) => {
    if (espacioDisponible() < altoFila + 30) { // deja espacio para no cortar feo; +30 margen de cortesía
      nuevaPagina();
      tituloSeccion('Cuadro de cargas (continuación)');
      dibujarEncabezadoTabla();
    }
    const horario = window.MotorCalculo.formatoFranjas(c.horario);
    const fila = [
      String(i + 1), c.descripcion, String(c.cantidad),
      fv(c.potenciaUnitariaW) + ' W', fv(c.potenciaTotalW) + ' W',
      horario, capitalizar(resultados.clasificacionCargas[i]),
    ];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    // Cada celda se parte en renglones y la fila crece con el más largo.
    const renglones = fila.map((texto, j) => doc.splitTextToSize(String(texto), columnas[j].ancho * anchoUtil - 2.5));
    const altoEsta = Math.max(altoFila, Math.max(...renglones.map(l => l.length)) * 3.3 + 2.9);
    if (i % 2 === 1) {
      doc.setFillColor(...COLOR_BANDA);
      doc.rect(margen, y, anchoUtil, altoEsta, 'F');
    }
    doc.setTextColor(...COLOR_OSCURO);
    renglones.forEach((lineas, j) => doc.text(lineas, xPos[j], y + 4.3));
    y += altoEsta;
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
  // Misma escala redonda que la gráfica de la app, para que el informe y la
  // pantalla se lean igual (sin rotular cada barra: serían 24 cifras apiñadas).
  const escala = window.MotorCalculo.calcularEscalaEjeY(Math.max(...resultados.perfilHorarioW, 1), 4);
  const maxValor = escala.maximo;
  const pasoX = anchoGraficoArea / 24;
  const anchoBarra = pasoX * 0.7;

  doc.setDrawColor(230, 226, 214);
  escala.marcas.forEach(marca => {
    const yLinea = y + altoGrafico - (marca / maxValor) * altoGrafico;
    doc.line(xGrafico, yLinea, xGrafico + anchoGraficoArea, yLinea);
    doc.setFontSize(6.5);
    doc.setTextColor(...COLOR_GRIS);
    doc.text(f(marca, marca % 1 ? 1 : 0), xGrafico - 2, yLinea + 1, { align: 'right' });
  });

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
  doc.text(
    'Calculado con ' + parametros.diasOperacionMes + ' días de operación al mes y ' +
    parametros.diasOperacionAnio + ' días al año, a un costo de ' +
    formatoPesosCOP(parametros.costoUnitarioCU) + ' / kWh.',
    margen, y, { maxWidth: anchoUtil }
  );
  y += 6;
  if (resultados.advertenciaCU0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(...COLOR_ACENTO_TEXTO);
    doc.text('AVISO: el costo unitario (CU) es 0, por lo que los costos de esta página son $0 y no reflejan una tarifa real.', margen, y, { maxWidth: anchoUtil });
    y += 6;
  }

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

  //PÁGINAS DEL GENERADOR Y DE CONVERSIÓN: solo si ya se dimensionó
  if (generador && generador.seleccion) {
    dibujarPaginaGenerador();
    if (conversion && conversion.resultado) dibujarPaginaConversion();
  }

  dibujarPies();

  const nombreArchivo = 'Informe de Dimensionamiento Fotovoltaico.pdf';
  doc.save(nombreArchivo);

  // =====================================================================
  // Estilo común de las páginas técnicas
  // =====================================================================
  function crearKit(etiqueta, titulo, subtituloExtra) {
    const COLOR_LINEA = [232, 224, 214];
    const COLOR_SUAVE = [250, 247, 243];
    const COLOR_TABLA = [58, 48, 43];
    const ESTADO_TEXTO = { cumple: [47, 122, 79], alerta: [154, 91, 18], no_cumple: [179, 64, 47], no_aplica: COLOR_GRIS, info: COLOR_ACENTO_TEXTO };
    const ESTADO_FONDO = { cumple: [234, 245, 238], alerta: [253, 243, 224], no_cumple: [250, 230, 226], no_aplica: COLOR_SUAVE, info: [252, 240, 230] };
    const LIMITE = altoPagina - 20;
    const t = texto => String(texto === null || texto === undefined ? '' : texto)
      .replace(/²/g, '2').replace(/−/g, '-').replace(/β/g, 'beta').replace(/η/g, 'eta').replace(/→/g, '->')
      .replace(/⌈/g, 'techo(').replace(/⌉/g, ')').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/×/g, 'x').replace(/…/g, '...');
    let contadorSeccion = 0;

    function encabezado(continuacion) {
      doc.addPage();
      doc.setFillColor(...COLOR_ACENTO);
      doc.rect(0, 0, anchoPagina, 2.4, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.4);
      doc.setTextColor(...COLOR_ACENTO_TEXTO);
      doc.text(t(etiqueta).toUpperCase(), margen, 11, { charSpace: 0.5 });
      doc.setFontSize(16);
      doc.setTextColor(...COLOR_OSCURO);
      doc.text(t(titulo + (continuacion ? ' (continuación)' : '')), margen, 18.6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.8);
      doc.setTextColor(...COLOR_GRIS);
      doc.text(t(String(proyecto.nombreProyecto || '') + (subtituloExtra ? '   ·   ' + subtituloExtra : '')), margen, 24.6);
      doc.setDrawColor(...COLOR_LINEA);
      doc.setLineWidth(0.3);
      doc.line(margen, 28.4, anchoPagina - margen, 28.4);
      y = 37;
    }

    function asegurarEspacio(alto) {
      if (y + alto > LIMITE) encabezado(true);
    }

    function seccion(texto, altoMinimo) {
      asegurarEspacio(12 + (altoMinimo || 14));
      contadorSeccion++;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...COLOR_ACENTO_TEXTO);
      doc.text(String(contadorSeccion).padStart(2, '0'), margen, y + 4);
      doc.setTextColor(...COLOR_OSCURO);
      doc.setFontSize(11.5);
      doc.text(t(texto), margen + 8.5, y + 4);
      doc.setDrawColor(...COLOR_ACENTO);
      doc.setLineWidth(0.5);
      doc.line(margen, y + 7, margen + 8.5 + doc.getTextWidth(t(texto)), y + 7);
      doc.setDrawColor(...COLOR_LINEA);
      doc.setLineWidth(0.25);
      doc.line(margen + 8.5 + doc.getTextWidth(t(texto)) + 1, y + 7, anchoPagina - margen, y + 7);
      y += 11.5;
    }

    function parrafo(texto, o) {
      o = Object.assign({ tam: 9, estilo: 'normal', color: COLOR_OSCURO, salto: 4.3, despues: 1.8, ancho: anchoUtil, x: margen }, o || {});
      doc.setFont('helvetica', o.estilo);
      doc.setFontSize(o.tam);
      const lineas = doc.splitTextToSize(t(texto), o.ancho);
      asegurarEspacio(lineas.length * o.salto);
      doc.setFont('helvetica', o.estilo);
      doc.setFontSize(o.tam);
      doc.setTextColor(...o.color);
      doc.text(lineas, o.x, y);
      y += lineas.length * o.salto + o.despues;
    }
    const nota = texto => parrafo(texto, { tam: 7.8, color: COLOR_GRIS, salto: 3.7, despues: 1.6 });

    // Ficha: pares etiqueta/valor en columnas, con una línea fina entre filas.
    function ficha(pares, columnas) {
      columnas = columnas || 2;
      const ancho = anchoUtil / columnas;
      for (let i = 0; i < pares.length; i += columnas) {
        const fila = pares.slice(i, i + columnas);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const lineas = fila.map(([, valor]) => doc.splitTextToSize(t(valor), ancho - 5));
        const alto = 4.9 + Math.max(...lineas.map(l => l.length)) * 3.9 + 2;
        asegurarEspacio(alto);
        fila.forEach(([etiquetaPar], j) => {
          const x = margen + j * ancho;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.3);
          doc.setTextColor(...COLOR_GRIS);
          doc.text(t(etiquetaPar).toUpperCase(), x, y + 3.2, { charSpace: 0.2 });
          doc.setFontSize(9);
          doc.setTextColor(...COLOR_OSCURO);
          doc.text(lineas[j], x, y + 7.6);
        });
        y += alto;
        doc.setDrawColor(...COLOR_LINEA);
        doc.setLineWidth(0.2);
        doc.line(margen, y - 1.2, anchoPagina - margen, y - 1.2);
      }
      y += 3;
    }

    // Tarjetas: blancas, con borde fino y una barra de color a la izquierda.
    function tarjetas(items) {
      const esp = 3.5, n = items.length, ancho = (anchoUtil - (n - 1) * esp) / n, alto = 18.5;
      asegurarEspacio(alto + 3);
      items.forEach(([etq, val, sub, est], i) => {
        const x = margen + i * (ancho + esp);
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...COLOR_LINEA);
        doc.setLineWidth(0.25);
        doc.roundedRect(x, y, ancho, alto, 1.2, 1.2, 'FD');
        doc.setFillColor(...(est ? ESTADO_TEXTO[est] : COLOR_ACENTO));
        doc.rect(x, y, 1.1, alto, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);
        doc.setTextColor(...COLOR_GRIS);
        doc.text(t(etq).toUpperCase(), x + 4, y + 5.4, { charSpace: 0.2 });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(...(est ? ESTADO_TEXTO[est] : COLOR_OSCURO));
        doc.text(t(val), x + 4, y + 11.6);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);
        doc.setTextColor(...COLOR_GRIS);
        doc.text(doc.splitTextToSize(t(sub), ancho - 6).slice(0, 2), x + 4, y + 15.4);
      });
      y += alto + 4;
    }

    // Tabla: encabezado oscuro, filas con línea fina, números a la derecha.
    // columnas: [{ titulo, ancho (fracción), alinear: 'right' | 'left' }]
    // filas: [{ celdas: [...], estados: [...], destacada: bool }]
    function tabla(columnas, filas, o) {
      o = Object.assign({ tam: 8 }, o || {});
      const anchos = columnas.map(c => c.ancho * anchoUtil);
      const dibujarCabecera = () => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.4);
        const lineasCab = columnas.map((c, i) => doc.splitTextToSize(t(c.titulo), anchos[i] - 3.5));
        const altoCab = Math.max(...lineasCab.map(l => l.length)) * 3.3 + 3.6;
        doc.setFillColor(...COLOR_TABLA);
        doc.rect(margen, y, anchoUtil, altoCab, 'F');
        doc.setTextColor(255, 255, 255);
        let x = margen;
        lineasCab.forEach((l, i) => {
          const derecha = columnas[i].alinear === 'right';
          doc.text(l, derecha ? x + anchos[i] - 2 : x + 2, y + 4.2, derecha ? { align: 'right' } : undefined);
          x += anchos[i];
        });
        y += altoCab;
      };
      asegurarEspacio(12 + 7 * Math.min(filas.length, 3));
      dibujarCabecera();
      filas.forEach((f, k) => {
        doc.setFont('helvetica', f.destacada ? 'bold' : 'normal');
        doc.setFontSize(o.tam);
        const lineas = f.celdas.map((c, i) => doc.splitTextToSize(t(c), anchos[i] - 3.5));
        const alto = Math.max(...lineas.map(l => l.length)) * 3.5 + 3.4;
        if (y + alto > LIMITE) { encabezado(true); dibujarCabecera(); }
        if (f.destacada) { doc.setFillColor(...COLOR_ACENTO_CLARO); doc.rect(margen, y, anchoUtil, alto, 'F'); }
        else if (k % 2 === 1) { doc.setFillColor(...COLOR_SUAVE); doc.rect(margen, y, anchoUtil, alto, 'F'); }
        let x = margen;
        lineas.forEach((l, i) => {
          const est = f.estados && f.estados[i];
          if (est && est !== 'cumple') { doc.setFillColor(...ESTADO_FONDO[est]); doc.rect(x, y, anchos[i], alto, 'F'); }
          doc.setFont('helvetica', f.destacada || (est && i === lineas.length - 1) ? 'bold' : 'normal');
          doc.setFontSize(o.tam);
          doc.setTextColor(...(est ? ESTADO_TEXTO[est] : COLOR_OSCURO));
          const derecha = columnas[i].alinear === 'right';
          doc.text(l, derecha ? x + anchos[i] - 2 : x + 2, y + 4.3, derecha ? { align: 'right' } : undefined);
          x += anchos[i];
        });
        y += alto;
        doc.setDrawColor(...COLOR_LINEA);
        doc.setLineWidth(0.2);
        doc.line(margen, y, anchoPagina - margen, y);
      });
      y += 4;
    }

    // Recuadro de nota: fondo suave y barra de color según el tipo.
    function recuadro(titulo, lineasTexto, tipo) {
      const relleno = 3.6;
      const color = tipo ? ESTADO_TEXTO[tipo] : COLOR_ACENTO;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.4);
      const partes = lineasTexto.map(l => doc.splitTextToSize(t(l), anchoUtil - 2 * relleno - 2));
      const n = partes.reduce((a, p) => a + p.length, 0);
      const alto = relleno + (titulo ? 5 : 0) + n * 3.9 + (partes.length - 1) * 1.2 + relleno - 0.6;
      asegurarEspacio(alto + 2);
      doc.setFillColor(...(tipo ? ESTADO_FONDO[tipo] : COLOR_SUAVE));
      doc.rect(margen, y, anchoUtil, alto, 'F');
      doc.setFillColor(...color);
      doc.rect(margen, y, 1.1, alto, 'F');
      let yy = y + relleno + 2.6;
      if (titulo) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.6);
        doc.setTextColor(...color);
        doc.text(t(titulo), margen + relleno + 1.5, yy);
        yy += 5;
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.4);
      doc.setTextColor(...COLOR_OSCURO);
      partes.forEach(p => { doc.text(p, margen + relleno + 1.5, yy); yy += p.length * 3.9 + 1.2; });
      y += alto + 4;
    }

    // Lista de fórmulas y supuestos dentro de un recuadro suave.
    function formulas(lista) {
      lista.forEach(texto => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const lineas = doc.splitTextToSize(t(texto), anchoUtil - 9);
        const alto = lineas.length * 3.4 + 1.3;
        asegurarEspacio(alto);
        doc.setFillColor(...COLOR_SUAVE);
        doc.rect(margen, y - 3.2, anchoUtil, alto, 'F');
        doc.setFillColor(...COLOR_ACENTO);
        doc.rect(margen + 2.2, y - 1.9, 1.3, 1.3, 'F');
        doc.setTextColor(...COLOR_OSCURO);
        doc.text(lineas, margen + 6, y);
        y += alto;
      });
      y += 3;
    }

    return { t, encabezado, asegurarEspacio, seccion, parrafo, nota, ficha, tarjetas, tabla, recuadro, formulas, ESTADO_TEXTO };
  }

  // Declaradas como funciones para que existan antes de dibujar las páginas.
  function f(n, d) { return window.MotorCalculo.formatoNumero(n, d); }
  function fv(v) { return typeof v === 'number' ? f(v, (String(v).split('.')[1] || '').length) : String(v); }
  // Recibe el número ya formateado ("1,4" o "-0,5") y le antepone el signo.
  function signo(texto) { const t = String(texto); return (t.startsWith('-') ? '-' : '+') + t.replace(/^-/, ''); }
  function hora(h) { return String(h).padStart(2, '0') + ':00'; }
  // En el informe basta con el documento y la copia en el repositorio; el
  // detalle completo de la ficha queda en el catálogo y en la aplicación.
  function fuenteCorta(fuente) {
    const texto = String(fuente || 'no declarada');
    const oraciones = texto.split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚ])/);
    return oraciones.slice(0, 2).join(' ').replace(/,\s*(https?:\/\/|www\.)\S+?(?=\.\s|\.?$)/g, '').replace(/\.\s*$/, '');
  }

  // =====================================================================
  // Páginas del generador fotovoltaico
  // =====================================================================
  function dibujarPaginaGenerador() {
    const g = generador;
    const s = g.seleccion;
    const m = s.modulo;
    const k = crearKit('Generador fotovoltaico', 'Dimensionamiento del generador fotovoltaico', 'Contexto: ' + String(proyecto.contexto || '').toUpperCase());
    const mt = g.metodo || { id: 'referencia' };

    k.encabezado(false);

    k.seccion('Datos de partida');
    const c = g.coincidencia;
    k.ficha([
      ['Energía diaria, Ed', f(resultados.energiaDiariaKWh, 3) + ' kWh/día'],
      ['Demanda máxima', f(resultados.demandaMaximaW, 0) + ' W a las ' + hora(resultados.horaDemandaMaximaH) + ' h'],
      ['Perfil de consumo', resultados.fuentePerfil === 'medido' ? 'Medido con el equipo' : 'Estimado desde el cuadro de cargas'],
      ['Días de operación', parametros.diasOperacionAnio + ' días al año'],
      ...(c ? [
        ['Consumo en la ventana solar (' + hora(c.horaInicio) + '-' + hora(c.horaFin) + ')', f(c.dentroKWh, 3) + ' kWh (' + f(c.fraccionDentro * 100, 1) + ' %)'],
        ['Consumo fuera de la ventana solar', f(c.fueraKWh, 3) + ' kWh (' + f((1 - c.fraccionDentro) * 100, 1) + ' %)'],
      ] : []),
    ]);

    k.seccion('Recurso solar');
    const sitio = g.sitio;
    k.ficha([
      ['Sitio', sitio.nombre],
      ['Coordenadas y plano', 'lat ' + fv(sitio.latitud) + '°, lon ' + fv(sitio.longitud) + '° · ' + fv(sitio.inclinacionGrados) + '° de inclinación, azimut ' + fv(sitio.azimutGrados) + '°'],
      ['Irradiación promedio anual', f(g.recurso.anual, 2) + ' kWh/m²·día'],
      ['Mes crítico', f(g.recurso.mesCritico.valor, 2) + ' kWh/m²·día' + (g.recurso.mesCritico.nombre ? ' (' + g.recurso.mesCritico.nombre + ')' : '')],
      ['Dimensionado con', (g.criterioRecurso === 'anual' ? 'el promedio anual' : 'el mes de menor recurso') + ': HSP = ' + f(g.hspUsada, 2) + ' h'],
      ['Factor de desempeño, PR', f(g.pr, 2)],
    ]);
    k.nota('Fuente: ' + String(sitio.fuente).replace(/\.\s*$/, '') + '. Fecha de consulta: ' + sitio.fechaConsulta + '.');
    const c2 = g.segundaFuente;
    if (c2) {
      const sg = v => (v >= 0 ? '+' : '') + f(v, 1) + ' %';
      k.tabla([
        { titulo: 'Contraste con una segunda fuente', ancho: 0.34 }, { titulo: 'Fuente principal', ancho: 0.22, alinear: 'right' },
        { titulo: 'Segunda fuente', ancho: 0.22, alinear: 'right' }, { titulo: 'Diferencia', ancho: 0.22, alinear: 'right' },
      ], [
        { celdas: ['Irradiación promedio anual', f(c2.anual.principal, 2), f(c2.anual.segunda, 2), sg(c2.anual.difPct)] },
        { celdas: ['Mes de menor recurso', f(c2.critico.principal, 2) + ' (' + c2.critico.mesPrincipal + ')', f(c2.critico.segunda, 2) + ' (' + c2.critico.mesSegunda + ')', sg(c2.critico.difPct)] },
        { celdas: ['Potencia pico (' + (c2.criterioRecurso === 'anual' ? 'promedio anual' : 'mes crítico') + ')', f(c2.potencia.principal, 2) + ' kWp', f(c2.potencia.segunda, 2) + ' kWp', sg(c2.potencia.difPct)],
          estados: [null, null, null, c2.dentroDeTolerancia ? 'cumple' : 'no_cumple'], destacada: true },
      ]);
      k.nota('Segunda fuente: ' + c2.fuente + ' (consulta ' + c2.fechaConsulta + '). Irradiación en kWh/m²·día. Ppico2 = Ppico1 · HSP1 / HSP2; diferencia aceptada ±' + c2.toleranciaPct + ' %: ' + (c2.dentroDeTolerancia ? 'cumple' : 'no cumple') + '.');
    }
    if (g.contingencia) {
      k.recuadro('Consulta en línea no disponible', ['La consulta en línea falló (' + g.contingencia.motivo + ', ' + g.contingencia.fecha + '); se usó la base de datos local.'], 'alerta');
    }
    y += 2;

    k.seccion('Resultado', 30);
    k.tarjetas([
      [mt.id === 'balance' ? 'Potencia pico de diseño' : 'Potencia pico', f(g.potenciaPicoKWp, 2) + ' kWp', (g.criterioRecurso === 'anual' ? 'por promedio anual' : 'por mes crítico') + (mt.id === 'balance' ? ' · método propio' : '')],
      ['Módulos', s.numeroModulos + ' x ' + m.potenciaW + ' Wp', s.cadenasParalelo + ' cadena(s) de ' + s.modulosSerie],
      ['Potencia instalada', f(s.potenciaInstaladaW / 1000, 2) + ' kWp', signo(f(s.excedentePct, 1)) + ' % (' + signo(f(s.excedenteW / 1000, 3)) + ' kWp)'],
      ['Energía generada', f(g.energiaGeneradaDiariaKWh, 2) + ' kWh/día', 'cubre el ' + f(g.coberturaPct, 0) + ' % de Ed'],
    ]);
    k.nota('Por promedio anual se requieren ' + f(g.potenciaPicoAnualKWp, 2) + ' kWp y por el mes crítico ' + f(g.potenciaPicoCriticoKWp, 2) + ' kWp. ' +
      (mt.id === 'balance' ? 'Método propio: Ppico = Fc · Cob · (E_día + E_noche / η_bat) / (HSP · PR).' : 'Método de referencia: Ppico = Ed / (HSP · PR).'));
    if (g.ajustePorCierre || g.modulosSerieFijo) {
      const partes = [];
      if (g.ajustePorCierre) partes.push('El generador se dimensionó con ' + f(g.potenciaDimensionadoKWp, 2) + ' kWp, la potencia requerida por el balance de cierre del paso de conversión y almacenamiento.');
      if (g.modulosSerieFijo) partes.push('Se usan ' + g.modulosSerieFijo + ' módulos en serie por cadena para que el equipo de conversión los admita.');
      k.recuadro('Ajuste aceptado en el paso de conversión y almacenamiento', partes, 'info');
    }
    if (mt.id === 'balance') {
      const lineas = [
        'E_eq = E_día + E_noche / η_bat = ' + f(mt.eDiaKWh, 3) + ' + ' + f(mt.eNocheKWh, 3) + ' / ' + f(mt.etaBat, 2) + ' = ' + f(mt.energiaEquivalenteKWh, 3) + ' kWh/día' + (g.fuenteEtaBat ? ' (η_bat: ' + g.fuenteEtaBat + ')' : ''),
        'Fc = 1 + g = ' + f(mt.fc, 2) + ' (g = ' + mt.crecimientoPct + ' %) · Cob = ' + mt.coberturaPct + ' % · E_diseño = Fc · Cob · E_eq = ' + f(mt.energiaDisenoKWh, 3) + ' kWh/día',
        'Potencia pico: método de referencia ' + f(mt.potenciaReferenciaKWp, 2) + ' kWp · balance sin crecimiento ' + f(mt.potenciaBalanceKWp, 2) + ' kWp · diseño ' + f(mt.potenciaDisenoKWp, 2) + ' kWp',
      ];
      if (g.justificacionCrecimiento) lineas.push('Justificación del crecimiento y de la cobertura: ' + g.justificacionCrecimiento);
      k.recuadro('Método propio: balance día/noche con factor de crecimiento y meta de cobertura', lineas);
    }
    y += 1;

    k.seccion('Módulo seleccionado y criterio', 34);
    k.parrafo(m.fabricante + ' ' + m.modelo, { estilo: 'bold', tam: 10, despues: 2.4 });
    k.ficha([
      ['Potencia', fv(m.potenciaW) + ' Wp'], ['Eficiencia', fv(m.eficienciaPct) + ' %'], ['Área', fv(m.areaM2) + ' m²'],
      ['Voc / Isc', fv(m.vocV) + ' V / ' + fv(m.iscA) + ' A'], ['Vmp / Imp', fv(m.vmpV) + ' V / ' + fv(m.impA) + ' A'], [m.tipoTemperaturaNominal, fv(m.temperaturaNominalC) + ' °C'],
      ['Coef. Voc', fv(m.coefVocPctC) + ' %/°C'], ['Coef. Pmax', fv(m.coefPmaxPctC) + ' %/°C'], ['Criterio', g.modoSeleccion === 'manual' ? 'Selección manual' : g.criterio.nombre],
    ], 3);
    k.nota('Ficha técnica: ' + String(m.fuente).replace(/\.\s*$/, '') + '. Fecha de consulta: ' + m.fechaConsulta + '.');
    if (g.modoSeleccion !== 'manual') k.parrafo(g.criterio.explicacion, { tam: 8.6, salto: 4 });
    if (g.justificacionGrupo) k.recuadro('Justificación técnica', [g.justificacionGrupo]);
    y += 1;

    k.seccion('Configuración eléctrica', 60);
    k.tabla([
      { titulo: 'Magnitud', ancho: 0.32 }, { titulo: 'Valor', ancho: 0.18, alinear: 'right' }, { titulo: 'Condición', ancho: 0.5 },
    ], [
      ['Módulos en serie / cadenas', s.modulosSerie + ' / ' + s.cadenasParalelo, 'máximo ' + s.maxModulosSerie + ' en serie con ' + g.parametros.vMaxSistema + ' V'],
      ['Voc del generador', f(s.vocGeneradorTminV, 1) + ' V', 'a ' + g.parametros.tMinC + ' °C (módulo ' + f(s.vocModuloTminV, 2) + ' V)'],
      ['Vmp del generador', f(s.vmpGeneradorOperacionV, 1) + ' V', 'celda a ' + f(s.temperaturaCeldaC, 1) + ' °C (Tamb ' + g.parametros.tAmbOperacionC + ' °C, 1000 W/m²)'],
      ['Isc del generador', f(s.iscGeneradorA, 1) + ' A', s.cadenasParalelo + ' cadena(s) x ' + fv(m.iscA) + ' A'],
      ['Corriente de diseño', f(s.corrienteDisenoA, 1) + ' A', '1,25 x 1,25 x Isc (NTC 2050 art. 690-8)'],
      ['Área del generador', f(s.areaGeneradorM2, 2) + ' m²', (s.cabeEnArea ? 'cabe en ' : 'no cabe en ') + fv(g.parametros.areaDisponibleM2) + ' m² disponibles'],
      ['Potencia en operación', f(s.potenciaOperacionW, 0) + ' W', 'corregida con coef. Pmax a ' + f(s.temperaturaCeldaC, 1) + ' °C'],
    ].map(celdas => ({ celdas, estados: celdas[0] === 'Área del generador' && !s.cabeEnArea ? [null, 'no_cumple', 'no_cumple'] : [] })));

    k.seccion('Catálogo evaluado', 7 * (g.evaluaciones.length + 1));
    k.tabla([
      { titulo: 'Módulo', ancho: 0.31 }, { titulo: 'Wp', ancho: 0.07, alinear: 'right' }, { titulo: 'Módulos', ancho: 0.1, alinear: 'right' },
      { titulo: 'Cadenas', ancho: 0.11, alinear: 'right' }, { titulo: 'P. instalada', ancho: 0.14, alinear: 'right' }, { titulo: 'Excedente', ancho: 0.12, alinear: 'right' },
      { titulo: 'Estado', ancho: 0.15 },
    ], g.evaluaciones.map(e => {
      const nombre = e.modulo.referenciaTdR ? 'Módulo del caso de prueba (550 Wp)' : e.modulo.fabricante + ' ' + e.modulo.modelo;
      const elegido = e.id === s.id;
      return e.viable
        ? { celdas: [nombre, e.modulo.potenciaW, e.numeroModulos, e.cadenasParalelo + ' x ' + e.modulosSerie, f(e.potenciaInstaladaW / 1000, 3) + ' kWp', signo(f(e.excedentePct, 1)) + ' %',
            elegido ? 'Elegido' : (e.modulo.referenciaTdR ? 'Solo manual' : (e.cabeEnArea === false ? 'No cabe' : 'Viable'))], destacada: elegido }
        : { celdas: [nombre, e.modulo.potenciaW, '-', '-', '-', '-', 'Descartado'], estados: [null, null, null, null, null, null, 'no_cumple'] };
    }));
    const propio = o => !!o && !/datos\/(catalogo_modulos|base_sitios)\.json/.test(o);
    const cargados = [];
    if (propio(g.origenCatalogo)) cargados.push('catálogo de módulos cargado desde ' + g.origenCatalogo);
    if (propio(g.origenSitios)) cargados.push('base de sitios cargada desde ' + g.origenSitios);
    if (cargados.length) k.nota('Datos de entrada: ' + cargados.join('; ') + '.');

    if (g.advertencias.length) {
      k.seccion('Advertencias');
      k.recuadro(null, g.advertencias, 'alerta');
    }

    const listaSupuestos = (g.supuestos || []).filter(sp => sp.id !== 'recurso' && sp.id !== 'modulo');
    if (listaSupuestos.length) {
      k.seccion('Supuestos del cálculo');
      k.formulas(listaSupuestos.map(sp => sp.texto));
    }
  }

  // =====================================================================
  // Páginas de conversión y almacenamiento
  // =====================================================================
  function dibujarPaginaConversion() {
    const r = conversion.resultado;
    const e = conversion.entradas;
    const h = conversion.heredados;
    const k = crearKit('Equipos de conversión y baterías', 'Conversión y almacenamiento', r.rama === 'con' ? 'Con almacenamiento' : 'Sin almacenamiento');
    const ETIQ = { cumple: 'Cumple', alerta: 'Alerta', no_cumple: 'No cumple', no_aplica: 'No declarado' };
    const nombre = eq => eq.referenciaTdR ? eq.modelo + ' (caso de prueba)' : eq.fabricante + ' ' + eq.modelo;
    const CORTO = { voc: 'Voc', arranque: 'arranque', mpptMin: 'ventana', mpptMax: 'ventana', salida: 'corriente', isc: 'Isc', imp: 'Imp', dcac: 'DC/AC' };
    const fallos = v => Array.from(new Set(v.criterios.filter(c => c.estado === 'no_cumple' || c.estado === 'alerta').map(c => CORTO[c.id] || c.nombre))).join(', ');
    const valorDe = (v, ids) => {
      const cs = v.criterios.filter(c => ids.includes(c.id) && c.estado !== 'no_aplica');
      if (!cs.length) return { texto: 'no declarado', estado: 'no_aplica' };
      const peor = ['no_cumple', 'alerta', 'cumple'].find(x => cs.some(c => c.estado === x));
      return { estado: peor, texto: cs.map(c => (c.id === 'dcac' ? f(c.valor, 2) : f(c.valor, 1) + (['salida', 'isc', 'imp'].includes(c.id) ? ' A' : ' V'))).join(' / ') };
    };

    k.encabezado(false);

    k.seccion('Tipo de sistema y generador');
    k.ficha([
      ['Rama', r.rama === 'con' ? 'Con almacenamiento: regulador MPPT y banco de baterías' : 'Sin almacenamiento: inversor de red con entrada MPPT'],
      ['Contexto del proyecto', String(proyecto.contexto || '').toUpperCase()],
      ['Generador', r.arreglo.np + ' cadena(s) de ' + r.arreglo.ns + ' módulos de ' + h.generador.modulo.potenciaW + ' Wp (' + f(r.potenciaGeneradorW / 1000, 2) + ' kWp)'],
      ['Voc en frío', f(r.arreglo.vocFrioV, 1) + ' V a ' + h.generador.tMinC + ' °C'],
      ['Vmp en caliente / en frío', f(r.arreglo.vmpCalienteV, 1) + ' V (celda a ' + f(h.generador.tCeldaC, 1) + ' °C) / ' + f(r.arreglo.vmpFrioV, 1) + ' V'],
      ['Isc del generador', f(r.arreglo.iscA, 1) + ' A'],
    ]);

    k.seccion(r.tipoEquipo === 'regulador' ? 'Regulador MPPT seleccionado' : 'Inversor de red seleccionado', 34);
    if (r.seleccion) {
      const v = r.seleccion;
      const eq = v.equipo;
      const enParalelo = v.unidades > 1;
      k.parrafo((enParalelo ? v.unidades + ' x ' : '') + nombre(eq) + (enParalelo ? ' en paralelo' : '') + '   ·   ' + ETIQ[v.veredicto], { estilo: 'bold', tam: 10, color: k.ESTADO_TEXTO[v.veredicto], despues: 2.6 });
      k.tarjetas([
        r.tipoEquipo === 'regulador'
          ? [enParalelo ? 'Corriente por regulador' : 'Corriente al banco', f(v.corrienteBancoA, 1) + ' A',
              (enParalelo ? v.unidades + ' grupos de ' + v.grupos.join(' + ') + ' cadenas · total ' + f(v.corrienteBancoTotalA, 1) + ' A' : 'Ppico / Vnominal (' + f(e.vNominalV, 0) + ' V)') + ' · equipo ' + fv(eq.corrienteSalidaA) + ' A', v.criterios.find(c => c.id === 'salida').estado]
          : ['Relación DC/AC', f(v.relacionDcAc, 2), 'rango aceptado ' + f(v.rangoDcAc[0], 2) + ' a ' + f(v.rangoDcAc[1], 2), v.criterios.find(c => c.id === 'dcac').estado],
        ['Módulos en serie', v.limites.minSerie + ' a ' + v.limites.maxSerie, 'el generador usa ' + r.arreglo.ns],
        ['Circuito FV, 1,25 x Isc', f(r.corrienteConductoresA, 1) + ' A', 'NTC 2050, 690-8'],
      ]);
      k.nota((r.tipoEquipo === 'regulador'
        ? 'Ficha: Voc máx. ' + fv(eq.vocMaxV) + ' V · carga ' + fv(eq.corrienteSalidaA) + ' A · Isc máx. ' + (typeof eq.iscMaxA === 'number' ? fv(eq.iscMaxA) + ' A' : 'no declarada') + (eq.mpptMinV ? ' · ventana ' + eq.mpptMinV + '-' + fv(eq.mpptMaxV) + ' V' : '')
        : 'Ficha: Pac ' + fv(eq.pacW) + ' W · Voc máx. ' + fv(eq.vocMaxV) + ' V · ventana ' + eq.mpptMinV + '-' + fv(eq.mpptMaxV) + ' V · Imp máx. ' + fv(eq.impMaxA) + ' A · Isc máx. ' + fv(eq.iscMaxA) + ' A por entrada') +
        '. Fuente: ' + fuenteCorta(eq.fuente) + (eq.fechaConsulta ? ' (consulta ' + eq.fechaConsulta + ')' : '') + '.');
      k.parrafo(r.modoSeleccion === 'automatica' ? 'Criterio de selección: ' + r.criterioSeleccion.nombre + '. ' + r.criterioSeleccion.explicacion : 'Equipo elegido de forma manual.', { tam: 8.6, salto: 4 });
    } else {
      k.recuadro('Sin equipo seleccionado', [r.ningunoCumple ? 'Ningún equipo del catálogo admite este generador.' : 'Solo los equipos de referencia admiten el generador.'], 'no_cumple');
    }

    k.seccion('Verificación de los equipos del catálogo', 7 * (r.verificaciones.length + 1));
    if (r.tipoEquipo === 'regulador') {
      k.tabla([
        { titulo: 'Regulador', ancho: 0.24 }, { titulo: 'Voc en frío', ancho: 0.11, alinear: 'right' }, { titulo: 'Arranque y ventana', ancho: 0.15, alinear: 'right' },
        { titulo: 'Al banco', ancho: 0.11, alinear: 'right' }, { titulo: 'Isc', ancho: 0.1, alinear: 'right' }, { titulo: 'Veredicto', ancho: 0.29 },
      ], r.verificaciones.map(v => {
        const cols = [valorDe(v, ['voc']), valorDe(v, ['arranque', 'mpptMin', 'mpptMax']), valorDe(v, ['salida']), valorDe(v, ['isc'])];
        const fallo = fallos(v);
        const prop = v.propuesta && v.propuesta.posible ? '. Propuesta ' + v.propuesta.np + ' x ' + v.propuesta.ns : '';
        return { celdas: [(v.unidades > 1 ? v.unidades + ' x ' : '') + nombre(v.equipo), cols[0].texto, cols[1].texto, cols[2].texto, cols[3].texto, ETIQ[v.veredicto] + (fallo ? ': ' + fallo : '') + prop],
          estados: [null, cols[0].estado, cols[1].estado, cols[2].estado, cols[3].estado, v.veredicto], destacada: !!(r.seleccion && r.seleccion.equipo.id === v.equipo.id) };
      }));
    } else {
      k.tabla([
        { titulo: 'Inversor', ancho: 0.21 }, { titulo: 'Pac', ancho: 0.09, alinear: 'right' }, { titulo: 'DC/AC', ancho: 0.08, alinear: 'right' },
        { titulo: 'Voc en frío', ancho: 0.11, alinear: 'right' }, { titulo: 'Ventana', ancho: 0.14, alinear: 'right' }, { titulo: 'Imp', ancho: 0.08, alinear: 'right' },
        { titulo: 'Isc', ancho: 0.08, alinear: 'right' }, { titulo: 'Veredicto', ancho: 0.21 },
      ], r.verificaciones.map(v => {
        const cols = [valorDe(v, ['dcac']), valorDe(v, ['voc']), valorDe(v, ['mpptMin', 'mpptMax', 'arranque']), valorDe(v, ['imp']), valorDe(v, ['isc'])];
        const fallo = fallos(v);
        return { celdas: [nombre(v.equipo), fv(v.equipo.pacW) + ' W', cols[0].texto, cols[1].texto, cols[2].texto, cols[3].texto, cols[4].texto, ETIQ[v.veredicto] + (fallo ? ': ' + fallo : '')],
          estados: [null, null, cols[0].estado, cols[1].estado, cols[2].estado, cols[3].estado, cols[4].estado, v.veredicto], destacada: !!(r.seleccion && r.seleccion.equipo.id === v.equipo.id) };
      }));
    }

    if (r.rama === 'con') {
      const b = r.banco;
      k.seccion('Banco de baterías', 44);
      k.parrafo(nombre(b.bateria) + '   ·   ' + b.bateria.tecnologia, { estilo: 'bold', tam: 10, despues: 2.6 });
      k.tarjetas([
        ['Capacidad nominal', f(b.cnAh, 1) + ' Ah', f(b.cnWh / 1000, 2) + ' kWh · ' + (b.modoAutonomia === 'noche' ? 'Ecc noche ' + f(b.eccBancoWh, 0) + ' Wh' : 'Ecc ' + f(b.eccWh, 0) + ' Wh/día')],
        ['Configuración', b.ns + 'S x ' + b.np + 'P', b.numeroBaterias + ' baterías'],
        ['Instalado', f(b.ahInstalados, 0) + ' Ah', f(b.kWhInstalados, 2) + ' kWh a ' + f(b.vBancoV, 1) + ' V'],
        ['DoD final / diario', f(b.dodFin * 100, 1) + ' / ' + f(b.dodDiarioReal * 100, 1) + ' %', 'diseño ' + e.dodPct + ' % / ' + f(b.dodDiarioDiseno * 100, 1) + ' %'],
      ]);
      k.nota('Entradas: η_inv ' + f(e.etaInv, 2) + ' · N = ' + f(e.autonomiaDias, e.autonomiaDias % 1 ? 1 : 0) + (b.modoAutonomia === 'noche' ? ' noche(s), solo el consumo nocturno (' + f(b.energiaNocheKWh, 2) + ' kWh por noche)' : ' días') + ' · DoD ' + e.dodPct + ' % · fT ' + f(e.fT, 2) + ' · banco de ' + f(e.vBancoV, 1) + ' V · η_bat ' + f(e.etaBat, 2) +
        '. Ficha: ' + fuenteCorta(b.bateria.fuente) + '.');
      y += 1;

      const bal = r.balance;
      k.seccion('Balance de cierre', 34);
      k.tabla([
        { titulo: 'Recurso', ancho: 0.28 }, { titulo: 'P requerida', ancho: 0.18, alinear: 'right' }, { titulo: 'P instalada', ancho: 0.18, alinear: 'right' },
        { titulo: 'Margen', ancho: 0.18, alinear: 'right' }, { titulo: 'Módulos adicionales', ancho: 0.18, alinear: 'right' },
      ], [['Promedio anual', bal.anual], ['Mes crítico', bal.critico]].map(([n, x]) => ({
        celdas: [n + ((bal.criterioRecurso === 'anual') === (n === 'Promedio anual') ? '  (criterio)' : ''), f(x.potenciaRequeridaW, 0) + ' W', f(bal.potenciaInstaladaW, 0) + ' W',
          (x.margenW >= 0 ? '+' : '') + f(x.margenPct, 1) + ' %', String(x.modulosAdicionales)],
        estados: [null, null, null, x.margenW >= 0 ? 'cumple' : 'no_cumple', null],
      })));
      k.nota((bal.modoAutonomia === 'noche'
        ? 'Egen = E_día / η_inv + E_noche / (η_inv · η_bat) = ' + f(bal.egenWh, 0) + ' Wh/día'
        : 'Egen = Ecc / η_bat = ' + f(bal.eccWh, 0) + ' / ' + f(e.etaBat, 2) + ' = ' + f(bal.egenWh, 0) + ' Wh/día') + '; Preq = Egen / (HSP · PR).' +
        (conversion.ajuste ? ' El generador ya incluye el ajuste aceptado.' : ''));
      if (!bal.hayDeficit) k.parrafo('El generador cubre la potencia requerida con un margen de ' + f(bal.usado.margenPct, 1) + ' %.', { estilo: 'bold', tam: 8.8, color: k.ESTADO_TEXTO.cumple });
      y += 1;

      k.seccion('Tasa C, recuperación y tecnologías', 30);
      const tc = r.tasas, rec = r.recuperacion;
      k.tarjetas([
        ['Tasa C de carga', f(tc.tasaCarga, 3) + ' C', f(tc.corrienteCargaA, 1) + ' A' + (tc.carga.limite !== null ? ' · límite ' + f(tc.carga.limite, 2) + ' C' : ''), tc.carga.estado],
        ['Tasa C de descarga', f(tc.tasaDescarga, 3) + ' C', f(tc.corrienteDescargaA, 1) + ' A con la demanda máxima', tc.descarga.limite !== null ? tc.descarga.estado : null],
        ['Recuperación del banco', rec.seRecupera ? f(rec.dias, 1) + ' días' : 'No se recupera', (b.modoAutonomia === 'noche' ? 'N·Ecc noche / ((Eprod - Egen)·η_bat); Eprod = ' : 'N·Ecc / (Eprod·η_bat - Ecc); Eprod = ') + f(rec.eProdWh, 0) + ' Wh/día', rec.seRecupera ? 'cumple' : 'no_cumple'],
      ]);
      k.tabla([
        { titulo: 'Batería', ancho: 0.3 }, { titulo: 'Banco', ancho: 0.17 }, { titulo: 'Unidades', ancho: 0.1, alinear: 'right' }, { titulo: 'kWh', ancho: 0.1, alinear: 'right' },
        { titulo: 'DoD final', ancho: 0.11, alinear: 'right' }, { titulo: 'Vida', ancho: 0.1, alinear: 'right' }, { titulo: 'kWh / año', ancho: 0.12, alinear: 'right' },
      ], r.comparacion.map(cp => cp.error
        ? { celdas: [nombre(cp.bateria), cp.error, '', '', '', '', ''] }
        : { celdas: [nombre(cp.bateria), f(cp.banco.vBancoV, 1) + ' V · ' + cp.banco.ns + 'S x ' + cp.banco.np + 'P', String(cp.banco.numeroBaterias), f(cp.banco.kWhInstalados, 2),
            f(cp.banco.dodFin * 100, 1) + ' %', cp.vidaAnios !== null ? cp.vidaAnios + ' años' : 'n. d.', cp.kWhPorAnio !== null ? f(cp.kWhPorAnio, 2) : '-'],
          destacada: cp.bateria.id === b.bateria.id }));
      k.nota('kWh / año: energía nominal instalada dividida por la vida de diseño de la ficha (energía nominal por año de servicio). n. d.: la ficha no la declara.');
      y += 1;
    }

    if (r.advertencias.length) {
      k.seccion('Alertas');
      k.recuadro(null, r.advertencias, 'alerta');
    }

    const lista = (conversion.supuestos || []).filter(sp => !/^(Rama|Equipo|Batería|Balance de cierre|Recuperación|Comparación de tecnologías|Arranque del regulador): /.test(sp));
    if (lista.length) {
      k.seccion('Fórmulas y supuestos');
      k.formulas(lista);
    }
  }

  // Pie de página en todas las hojas: institución y numeración.
  function dibujarPies() {
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setDrawColor(232, 224, 214);
      doc.setLineWidth(0.25);
      doc.line(margen, altoPagina - 11.5, anchoPagina - margen, altoPagina - 11.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.4);
      doc.setTextColor(...COLOR_GRIS);
      const v = window.VERSION_APP;
      doc.text('Universidad del Magdalena  ·  Energía Solar Fotovoltaica 2026-II' + (v ? '  ·  Plataforma v' + v.numero + ' (' + v.fecha + ')' : ''), margen, altoPagina - 7);
      doc.text('Página ' + i + ' de ' + total, anchoPagina - margen, altoPagina - 7, { align: 'right' });
    }
  }
}
