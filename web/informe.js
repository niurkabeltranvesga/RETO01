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

function generarInformePDF(proyecto, resultados, parametros, generador) {
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
        'Contraste estimado vs. medido: ' + comparacion.EdEstimada.toFixed(2) + ' kWh/día estimados frente a ' +
        comparacion.EdMedida.toFixed(2) + ' kWh/día medidos (' + signo +
        Math.abs(comparacion.diferenciaKWh).toFixed(2) + ' kWh/día).',
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
      ? ['Potencia instalada', resultados.potenciaInstaladaW.toFixed(0) + ' W', '(' + (resultados.potenciaInstaladaW/1000).toFixed(2) + ' kW)']
      : ['Potencia instalada', '—', 'sin cuadro de cargas'],
    ['Demanda máxima', resultados.demandaMaximaW.toFixed(0) + ' W', '(' + (resultados.demandaMaximaW/1000).toFixed(2) + ' kW) · h=' + String(resultados.horaDemandaMaximaH).padStart(2, '0') + ':00'],
    ['Energía diaria', resultados.energiaDiariaKWh.toFixed(2) + ' kWh', 'por día'],
    ['Energía mensual', resultados.energiaMensualKWh.toFixed(1) + ' kWh', 'por mes'],
    ['Energía anual', resultados.energiaAnualKWh.toFixed(1) + ' kWh', 'por año'],
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
    { titulo: '#', ancho: 0.05 }, { titulo: 'Carga', ancho: 0.31 },
    { titulo: 'Cant.', ancho: 0.08 }, { titulo: 'Pot.unit.', ancho: 0.13 },
    { titulo: 'Pot.total', ancho: 0.13 }, { titulo: 'Horario', ancho: 0.17 },
    { titulo: 'Uso', ancho: 0.13 },
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
    if (i % 2 === 1) {
      doc.setFillColor(...COLOR_BANDA);
      doc.rect(margen, y, anchoUtil, altoFila, 'F');
    }
    const horario = window.MotorCalculo.formatoHorarioCompacto(c.horario);
    const fila = [
      String(i + 1), c.descripcion, String(c.cantidad),
      c.potenciaUnitariaW + ' W', c.potenciaTotalW + ' W',
      horario, capitalizar(resultados.clasificacionCargas[i]),
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
    doc.text(String(marca), xGrafico - 2, yLinea + 1, { align: 'right' });
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

  //PÁGINA DEL GENERADOR (Reto 02): solo si ya se dimensionó
  if (generador && generador.seleccion) {
    dibujarPaginaGenerador();
  }

  const nombreArchivo = 'Informe de Requerimiento Energético.pdf';
  doc.save(nombreArchivo);

  function dibujarPaginaGenerador() {
    const g = generador;
    const s = g.seleccion;
    const m = s.modulo;
    const f = (n, d) => Number(n).toFixed(d);
    // Recibe el número ya formateado (texto) para conservar los decimales: +12.0 y no +12.
    const signo = n => (Number(n) >= 0 ? '+' : '-') + String(n).replace(/^-/, '');
    // La fuente básica de jsPDF no trae el superíndice ² ni el signo menos
    // tipográfico: se escriben como "m2" y "-" para que siempre se vean.
    const t = texto => String(texto).replace(/²/g, '2').replace(/−/g, '-').replace(/β/g, 'beta').replace(/η/g, 'eta').replace(/→/g, '->');

    // Tamaños de la sección del generador: nada por debajo de 8,5 pt para
    // que todo se lea cómodo, y aire entre secciones.
    const TAM_TEXTO = 9.5, SALTO_TEXTO = 4.7;
    const TAM_SECUNDARIO = 8.8, SALTO_SECUNDARIO = 4.3;
    const ESPACIO_SECCION = 7;
    const limiteInferior = altoPagina - margen - 6;

    function encabezado(continuacion) {
      doc.addPage();
      doc.setFillColor(...COLOR_ACENTO);
      doc.rect(0, 0, anchoPagina, 22, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(...COLOR_OSCURO);
      doc.text('Dimensionamiento del generador fotovoltaico' + (continuacion ? ' (continuación)' : ''), margen, 11);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(t(String(proyecto.nombreProyecto || '') + '   ·   Contexto: ' + String(proyecto.contexto || '').toUpperCase()), margen, 17.5);
      y = 32;
    }

    // Si lo que sigue no cabe, se pasa a una hoja nueva con su encabezado.
    function asegurarEspacio(alto) {
      if (y + alto > limiteInferior) encabezado(true);
    }

    function seccion(texto, altoMinimo) {
      asegurarEspacio(9 + (altoMinimo || 12));
      tituloSeccion(texto);
      y += 1;
    }

    function parrafo(texto, opciones) {
      const o = Object.assign({ tam: TAM_TEXTO, estilo: 'normal', color: COLOR_OSCURO, salto: SALTO_TEXTO, sangria: 0, despues: 1.6 }, opciones || {});
      doc.setFont('helvetica', o.estilo);
      doc.setFontSize(o.tam);
      const lineas = doc.splitTextToSize(t(texto), anchoUtil - o.sangria);
      asegurarEspacio(lineas.length * o.salto);
      doc.setFont('helvetica', o.estilo);
      doc.setFontSize(o.tam);
      doc.setTextColor(...o.color);
      doc.text(lineas, margen + o.sangria, y);
      y += lineas.length * o.salto + o.despues;
    }

    function secundario(texto) {
      parrafo(texto, { tam: TAM_SECUNDARIO, salto: SALTO_SECUNDARIO, color: COLOR_GRIS });
    }

    // Texto con una etiqueta en negrita al inicio ("Fuente: ...").
    function dato(etiqueta, texto) {
      parrafo(etiqueta + ': ' + texto, { tam: TAM_SECUNDARIO, salto: SALTO_SECUNDARIO, color: COLOR_GRIS });
    }

    function vineta(texto) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(TAM_SECUNDARIO);
      const lineas = doc.splitTextToSize(t(texto), anchoUtil - 6);
      asegurarEspacio(lineas.length * SALTO_SECUNDARIO);
      doc.setFillColor(...COLOR_ACENTO);
      doc.circle(margen + 1.6, y - 1.1, 0.7, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(TAM_SECUNDARIO);
      doc.setTextColor(...COLOR_OSCURO);
      doc.text(lineas, margen + 5, y);
      y += lineas.length * SALTO_SECUNDARIO + 1.8;
    }

    function filaTabla(celdas, anchos, opciones) {
      const o = Object.assign({ negrita: false, fondo: null, alto: 7, tam: 8.8, colorTexto: COLOR_OSCURO }, opciones || {});
      if (o.fondo) { doc.setFillColor(...o.fondo); doc.rect(margen, y, anchoUtil, o.alto, 'F'); }
      doc.setFont('helvetica', o.negrita ? 'bold' : 'normal');
      doc.setFontSize(o.tam);
      doc.setTextColor(...o.colorTexto);
      let x = margen + 2.5;
      celdas.forEach((c, i) => {
        doc.text(t(c), x, y + o.alto / 2 + 1.2, { maxWidth: anchos[i] * anchoUtil - 3 });
        x += anchos[i] * anchoUtil;
      });
      y += o.alto;
    }

    encabezado(false);

    // 1. Datos de partida (heredados del consumo)
    seccion('Datos de partida');
    parrafo('Energía diaria Ed = ' + f(resultados.energiaDiariaKWh, 3) + ' kWh/día  ·  demanda máxima ' + f(resultados.demandaMaximaW, 0) +
      ' W a las ' + String(resultados.horaDemandaMaximaH).padStart(2, '0') + ':00 h  ·  perfil ' + (resultados.fuentePerfil === 'medido' ? 'medido' : 'estimado') +
      '  ·  ' + parametros.diasOperacionAnio + ' días de operación al año.');
    const c = g.coincidencia;
    if (c) {
      secundario('Coincidencia con el recurso solar: ' + f(c.dentroKWh, 3) + ' kWh (' + f(c.fraccionDentro * 100, 1) + ' %) se consumen dentro de la ventana solar (' +
        String(c.horaInicio).padStart(2, '0') + ':00-' + String(c.horaFin).padStart(2, '0') + ':00 h) y ' + f(c.fueraKWh, 3) + ' kWh fuera de ella.');
    }
    y += ESPACIO_SECCION - 1.6;

    // 2. Recurso solar
    seccion('Recurso solar');
    const sitio = g.sitio;
    parrafo(sitio.nombre + ' (lat ' + sitio.latitud + '°, lon ' + sitio.longitud + '°), plano a ' + sitio.inclinacionGrados + '° y azimut ' + sitio.azimutGrados + '°.');
    secundario('Irradiación: ' + f(g.recurso.anual, 2) + ' kWh/m²·día promedio anual y ' + f(g.recurso.mesCritico.valor, 2) + ' kWh/m²·día en el mes crítico' +
      (g.recurso.mesCritico.nombre ? ' (' + g.recurso.mesCritico.nombre + ')' : '') + '. Dimensionado con ' +
      (g.criterioRecurso === 'anual' ? 'el promedio anual' : 'el mes de menor recurso') + ': HSP = ' + f(g.hspUsada, 2) + ' kWh/m²·día.');
    dato('Fuente', String(sitio.fuente).replace(/\.\s*$/, '') + '. Fecha de consulta: ' + sitio.fechaConsulta + '.');
    if (g.contingencia) {
      parrafo('Aviso: la consulta en línea falló (' + g.contingencia.motivo + ', ' + g.contingencia.fecha + '); se usó la base de datos local.',
        { estilo: 'bold', color: COLOR_ACENTO_TEXTO, tam: TAM_SECUNDARIO, salto: SALTO_SECUNDARIO });
    }
    y += ESPACIO_SECCION - 1.6;

    // 3. Resultado principal
    seccion('Resultado', 30);
    const tarjetasGen = [
      [(g.metodo && g.metodo.id === 'balance') ? 'Potencia pico de diseño' : 'Potencia pico', f(g.potenciaPicoKWp, 2) + ' kWp',
        (g.criterioRecurso === 'anual' ? 'por promedio anual' : 'por mes crítico') + ((g.metodo && g.metodo.id === 'balance') ? ' · método propio' : '')],
      ['Módulos', s.numeroModulos + ' x ' + m.potenciaW + ' Wp', s.cadenasParalelo + ' cadena(s) de ' + s.modulosSerie],
      ['Potencia instalada', f(s.potenciaInstaladaW / 1000, 2) + ' kWp', signo(f(s.excedentePct, 1)) + ' % (' + signo(f(s.excedenteW / 1000, 3)) + ' kWp)'],
      ['Energía generada', f(g.energiaGeneradaDiariaKWh, 2) + ' kWh/día', 'cubre el ' + f(g.coberturaPct, 0) + ' % de Ed'],
    ];
    const espacioTarjeta = 3;
    const anchoTarjeta = (anchoUtil - 3 * espacioTarjeta) / 4;
    const altoTarjeta = 22;
    tarjetasGen.forEach(([etq, val, sub], i) => {
      const x = margen + i * (anchoTarjeta + espacioTarjeta);
      doc.setFillColor(...COLOR_ACENTO_CLARO);
      doc.setDrawColor(...COLOR_BORDE_CARD);
      doc.roundedRect(x, y, anchoTarjeta, altoTarjeta, 1.8, 1.8, 'FD');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...COLOR_GRIS);
      doc.text(etq, x + 3, y + 6);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13.5); doc.setTextColor(...COLOR_ACENTO_TEXTO);
      doc.text(t(val), x + 3, y + 13.2);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...COLOR_GRIS);
      doc.text(t(sub), x + 3, y + 18.6);
    });
    y += altoTarjeta + 6;
    const mt = g.metodo || { id: 'referencia' };
    secundario('Por promedio anual se requieren ' + f(g.potenciaPicoAnualKWp, 2) + ' kWp y por el mes crítico ' + f(g.potenciaPicoCriticoKWp, 2) +
      ' kWp, con PR = ' + f(g.pr, 2) + (mt.id === 'balance'
        ? ' y el método propio: Ppico = Fc · Cob · (E_día + E_noche / η_bat) / (HSP · PR).'
        : '. Método de cálculo: método de referencia, Ppico = Ed / (HSP · PR).'));
    if (mt.id === 'balance') {
      // Recuadro con el método propio y la comparación con el de referencia.
      const relleno = 4;
      const lineasMetodo = [
        'E_eq = E_día + E_noche / η_bat = ' + f(mt.eDiaKWh, 3) + ' + ' + f(mt.eNocheKWh, 3) + ' / ' + f(mt.etaBat, 2) + ' = ' + f(mt.energiaEquivalenteKWh, 3) + ' kWh/día' +
          (g.fuenteEtaBat ? '  (η_bat: ' + g.fuenteEtaBat + ')' : ''),
        'Fc = 1 + g = ' + f(mt.fc, 2) + ' (crecimiento g = ' + mt.crecimientoPct + ' %)  ·  meta de cobertura Cob = ' + mt.coberturaPct + ' %  ->  E_diseño = Fc · Cob · E_eq = ' + f(mt.energiaDisenoKWh, 3) + ' kWh/día',
        'Potencia pico: método de referencia ' + f(mt.potenciaReferenciaKWp, 2) + ' kWp  ·  balance sin crecimiento ' + f(mt.potenciaBalanceKWp, 2) +
          ' kWp  ·  diseño con crecimiento y cobertura ' + f(mt.potenciaDisenoKWp, 2) + ' kWp',
      ];
      if (g.justificacionCrecimiento) lineasMetodo.push('Justificación del crecimiento y de la cobertura: ' + g.justificacionCrecimiento);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(TAM_SECUNDARIO);
      const partes = lineasMetodo.map(l => doc.splitTextToSize(t(l), anchoUtil - 2 * relleno));
      const nLineas = partes.reduce((a, p) => a + p.length, 0);
      const altoCuadro = relleno + 5 + nLineas * SALTO_SECUNDARIO + (partes.length - 1) * 1 + relleno - 1;
      y += 2;
      asegurarEspacio(altoCuadro);
      doc.setFillColor(...COLOR_ACENTO_CLARO);
      doc.setDrawColor(...COLOR_BORDE_CARD);
      doc.roundedRect(margen, y, anchoUtil, altoCuadro, 1.8, 1.8, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.setTextColor(...COLOR_ACENTO_TEXTO);
      doc.text(t('Método propio: balance día/noche con factor de crecimiento y meta de cobertura'), margen + relleno, y + relleno + 2.2);
      let yy = y + relleno + 2.2 + 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(TAM_SECUNDARIO);
      doc.setTextColor(...COLOR_OSCURO);
      partes.forEach(p => { doc.text(p, margen + relleno, yy); yy += p.length * SALTO_SECUNDARIO + 1; });
      y += altoCuadro + 1;
    }
    y += ESPACIO_SECCION - 1.6;

    // 4. Módulo y criterio
    seccion('Módulo seleccionado y criterio');
    parrafo(m.fabricante + ' ' + m.modelo, { estilo: 'bold', despues: 0.8 });
    secundario(m.potenciaW + ' Wp  ·  Voc ' + m.vocV + ' V  ·  Isc ' + m.iscA + ' A  ·  Vmp ' + m.vmpV + ' V  ·  Imp ' + m.impA + ' A  ·  coef. Voc ' +
      m.coefVocPctC + ' %/°C  ·  coef. Pmax ' + m.coefPmaxPctC + ' %/°C  ·  ' + m.tipoTemperaturaNominal + ' ' + m.temperaturaNominalC + ' °C  ·  ' +
      m.areaM2 + ' m²  ·  eficiencia ' + m.eficienciaPct + ' %.');
    dato('Ficha técnica', String(m.fuente).replace(/\.\s*$/, '') + '. Fecha de consulta: ' + m.fechaConsulta + '.');
    y += 1.5;
    parrafo(g.modoSeleccion === 'manual'
      ? 'Criterio aplicado: selección manual de la referencia.'
      : 'Criterio aplicado: ' + g.criterio.nombre + '. ' + g.criterio.explicacion);
    if (g.justificacionGrupo) {
      // Recuadro con los mismos colores de las tarjetas de "Resultado", para
      // que la justificación se distinga del texto de arriba.
      const relleno = 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(TAM_TEXTO);
      const lineasJust = doc.splitTextToSize(t(g.justificacionGrupo), anchoUtil - 2 * relleno);
      const altoCuadro = relleno + 4.5 + lineasJust.length * SALTO_TEXTO + relleno - 1;
      y += 1.5;
      asegurarEspacio(altoCuadro);
      doc.setFillColor(...COLOR_ACENTO_CLARO);
      doc.setDrawColor(...COLOR_BORDE_CARD);
      doc.roundedRect(margen, y, anchoUtil, altoCuadro, 1.8, 1.8, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.setTextColor(...COLOR_ACENTO_TEXTO);
      doc.text('Justificación técnica', margen + relleno, y + relleno + 2.2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(TAM_TEXTO);
      doc.setTextColor(...COLOR_OSCURO);
      doc.text(lineasJust, margen + relleno, y + relleno + 2.2 + 5.2);
      y += altoCuadro + 2;
    }

    // Segunda hoja de la sección del generador: detalle eléctrico, comparación y supuestos.
    encabezado(true);

    // 5. Configuración eléctrica
    seccion('Configuración eléctrica', 60);
    const anchosConf = [0.34, 0.2, 0.46];
    filaTabla(['Magnitud', 'Valor', 'Condición'], anchosConf, { negrita: true, fondo: COLOR_ACENTO });
    const filasConf = [
      ['Módulos en serie / cadenas', s.modulosSerie + ' / ' + s.cadenasParalelo, 'máximo ' + s.maxModulosSerie + ' en serie con ' + g.parametros.vMaxSistema + ' V'],
      ['Voc del generador', f(s.vocGeneradorTminV, 1) + ' V', 'a ' + g.parametros.tMinC + ' °C (módulo ' + f(s.vocModuloTminV, 2) + ' V)'],
      ['Vmp del generador', f(s.vmpGeneradorOperacionV, 1) + ' V', 'celda a ' + f(s.temperaturaCeldaC, 1) + ' °C (Tamb ' + g.parametros.tAmbOperacionC + ' °C, 1000 W/m²)'],
      ['Isc del generador', f(s.iscGeneradorA, 1) + ' A', s.cadenasParalelo + ' cadena(s) x ' + m.iscA + ' A'],
      ['Corriente de diseño', f(s.corrienteDisenoA, 1) + ' A', '1,25 x 1,25 x Isc (NTC 2050 art. 690-8)'],
      ['Área del generador', f(s.areaGeneradorM2, 2) + ' m²', (s.cabeEnArea ? 'cabe en ' : 'NO cabe en ') + g.parametros.areaDisponibleM2 + ' m² disponibles'],
      ['Potencia en operación', f(s.potenciaOperacionW, 0) + ' W', 'corregida con coef. Pmax a ' + f(s.temperaturaCeldaC, 1) + ' °C'],
    ];
    filasConf.forEach((fila, i) => filaTabla(fila, anchosConf, { fondo: i % 2 ? COLOR_BANDA : null }));
    y += ESPACIO_SECCION + 2;

    // 6. Catálogo evaluado
    seccion('Catálogo evaluado', 7 * (g.evaluaciones.length + 1));
    const anchosCat = [0.32, 0.07, 0.1, 0.1, 0.13, 0.12, 0.16];
    filaTabla(['Módulo', 'Wp', 'Módulos', 'Cadenas', 'P. instalada', 'Excedente', 'Estado'], anchosCat, { negrita: true, fondo: COLOR_ACENTO });
    g.evaluaciones.forEach((e, i) => {
      const nombre = e.modulo.referenciaTdR ? 'Referencia del TdR (550 Wp)' : e.modulo.fabricante + ' ' + e.modulo.modelo;
      const fila = e.viable
        ? [nombre, e.modulo.potenciaW, e.numeroModulos, e.cadenasParalelo + ' x ' + e.modulosSerie, f(e.potenciaInstaladaW / 1000, 3) + ' kWp',
           signo(f(e.excedentePct, 1)) + ' %', e.id === s.id ? 'Elegido' : (e.modulo.referenciaTdR ? 'Solo manual' : (e.cabeEnArea === false ? 'No cabe' : 'Viable'))]
        : [nombre, e.modulo.potenciaW, '-', '-', '-', '-', 'Descartado'];
      filaTabla(fila, anchosCat, { fondo: e.id === s.id ? COLOR_ACENTO_CLARO : (i % 2 ? COLOR_BANDA : null), negrita: e.id === s.id, tam: 8.5 });
    });
    y += 4;
    // Solo se declara el archivo si el usuario cargó un catálogo o una base propios.
    const propio = o => !!o && !/datos\/(catalogo_modulos|base_sitios)\.json/.test(o);
    const cargados = [];
    if (propio(g.origenCatalogo)) cargados.push('catálogo de módulos cargado desde ' + g.origenCatalogo);
    if (propio(g.origenSitios)) cargados.push('base de sitios cargada desde ' + g.origenSitios);
    if (cargados.length) secundario('Datos de entrada: ' + cargados.join('; ') + '.');
    y += ESPACIO_SECCION - 1.6;

    // 7. Advertencias
    if (g.advertencias.length) {
      seccion('Advertencias');
      g.advertencias.forEach(a => parrafo(a, { estilo: 'bold', color: COLOR_ACENTO_TEXTO, tam: TAM_SECUNDARIO, salto: SALTO_SECUNDARIO }));
      y += ESPACIO_SECCION - 1.6;
    }

    // 8. Supuestos del cálculo (RF-18, RF-24): la fuente del sitio y la ficha
    // del módulo ya se declararon arriba, así que aquí no se repiten.
    const listaSupuestos = (g.supuestos || []).filter(sp => sp.id !== 'recurso' && sp.id !== 'modulo');
    if (listaSupuestos.length) {
      seccion('Supuestos del cálculo');
      listaSupuestos.forEach(sp => vineta(sp.texto));
    }
  }
}
