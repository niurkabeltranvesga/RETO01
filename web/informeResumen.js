// informeResumen.js
//
// Informe de una página (A4): datos del proyecto con días de operación y CU,
// consumo y perfil de 24 horas, generador con la fuente del recurso solar y
// la segunda fuente, y el equipo de conversión. Usa el mismo formato de
// números que la pantalla (coma decimal, punto de miles).

function generarResumenPDF(proyecto, resultados, parametros, generador, conversion) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = window.MotorCalculo;
  const fmt = M.formatoNumero;
  const pesos = M.formatoPesos;
  const h2 = h => String(h).padStart(2, '0') + ':00';
  const version = window.VERSION_APP || { numero: '', fecha: '' };

  const ACENTO = [224, 138, 82];
  const ACENTO_TEXTO = [184, 95, 50];
  const ACENTO_CLARO = [252, 235, 221];
  const OSCURO = [42, 35, 32];
  const GRIS = [107, 96, 88];
  const LINEA = [232, 224, 214];
  const SUAVE = [250, 247, 243];
  const VERDE = [47, 122, 79], VERDE_FONDO = [234, 245, 238];
  const AMBAR = [154, 91, 18], AMBAR_FONDO = [253, 243, 224];
  const ROJO = [179, 64, 47], ROJO_FONDO = [250, 230, 226];
  const COLOR_ESTADO = { cumple: [VERDE, VERDE_FONDO], alerta: [AMBAR, AMBAR_FONDO], no_cumple: [ROJO, ROJO_FONDO] };

  const AP = 210, AL = 297, MG = 13, AU = AP - 2 * MG;
  const t = texto => String(texto === null || texto === undefined ? '' : texto)
    .replace(/²/g, '2').replace(/−/g, '-').replace(/η/g, 'eta').replace(/→/g, '->').replace(/×/g, 'x')
    .replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/…/g, '...').replace(/₁/g, '1').replace(/₂/g, '2');
  let y = 0;

  function texto(s, x, yy, o) {
    o = o || {};
    doc.setFont('helvetica', o.estilo || 'normal');
    doc.setFontSize(o.tam || 8);
    doc.setTextColor(...(o.color || OSCURO));
    doc.text(t(s), x, yy, o.alinear ? { align: o.alinear } : undefined);
  }

  function seccion(numero, titulo) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...ACENTO_TEXTO);
    doc.text(numero, MG, y + 3.6);
    doc.setTextColor(...OSCURO);
    doc.text(t(titulo), MG + 7, y + 3.6);
    doc.setDrawColor(...LINEA);
    doc.setLineWidth(0.25);
    doc.line(MG + 9 + doc.getTextWidth(t(titulo)), y + 2.6, AP - MG, y + 2.6);
    y += 7;
  }

  // Tarjetas en una fila: [etiqueta, valor, nota, estado]
  function tarjetas(items, alto) {
    alto = alto || 14.5;
    const esp = 2.4, ancho = (AU - (items.length - 1) * esp) / items.length;
    items.forEach(([etq, val, sub, est], i) => {
      const x = MG + i * (ancho + esp);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...LINEA);
      doc.setLineWidth(0.25);
      doc.roundedRect(x, y, ancho, alto, 1, 1, 'FD');
      doc.setFillColor(...(est ? COLOR_ESTADO[est][0] : ACENTO));
      doc.rect(x, y, 0.9, alto, 'F');
      texto(etq.toUpperCase(), x + 3, y + 4.2, { tam: 6.2, color: GRIS });
      // El valor se achica si no cabe en la tarjeta (por ejemplo, un modelo largo).
      let tam = 10.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(tam);
      while (tam > 7 && doc.getTextWidth(t(val)) > ancho - 5) { tam -= 0.5; doc.setFontSize(tam); }
      texto(val, x + 3, y + 9.3, { tam, estilo: 'bold', color: est ? COLOR_ESTADO[est][0] : OSCURO });
      if (sub) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.2);
        texto(doc.splitTextToSize(t(sub), ancho - 5)[0], x + 3, y + 12.8, { tam: 6.2, color: GRIS });
      }
    });
    y += alto + 3;
  }

  // Ficha de dos columnas con etiqueta pequeña y valor
  function ficha(pares, x0, ancho) {
    const col = ancho / 2;
    for (let i = 0; i < pares.length; i += 2) {
      const fila = pares.slice(i, i + 2);
      doc.setFontSize(7.8);
      const lineas = fila.map(([, v]) => doc.splitTextToSize(t(v), col - 3).slice(0, 2));
      const alto = 3.4 + Math.max(...lineas.map(l => l.length)) * 3.3 + 1.4;
      fila.forEach(([etq], j) => {
        const x = x0 + j * col;
        texto(etq.toUpperCase(), x, y + 2.6, { tam: 5.9, color: GRIS });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.8);
        doc.setTextColor(...OSCURO);
        doc.text(lineas[j], x, y + 6);
      });
      y += alto;
      doc.setDrawColor(...LINEA);
      doc.setLineWidth(0.15);
      doc.line(x0, y - 0.8, x0 + ancho, y - 0.8);
    }
    y += 1.5;
  }

  function franja(textoFranja, est) {
    const [color, fondo] = COLOR_ESTADO[est] || [ACENTO_TEXTO, SUAVE];
    doc.setFontSize(7.6);
    const lineas = doc.splitTextToSize(t(textoFranja), AU - 6).slice(0, 3);
    const alto = lineas.length * 3.2 + 2.6;
    doc.setFillColor(...fondo);
    doc.rect(MG, y, AU, alto, 'F');
    doc.setFillColor(...color);
    doc.rect(MG, y, 0.9, alto, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    doc.setTextColor(...OSCURO);
    doc.text(lineas, MG + 3, y + 3.6);
    y += alto + 2;
  }

  // ---------------- Encabezado ----------------
  doc.setFillColor(...ACENTO);
  doc.rect(0, 0, AP, 25, 'F');
  texto('INFORME DEL PROYECTO', MG, 7.5, { tam: 7, estilo: 'bold', color: [102, 60, 36] });
  texto(proyecto.nombreProyecto || '', MG, 14.5, { tam: 14, estilo: 'bold' });
  const integrantes = Array.isArray(proyecto.integrantes) ? proyecto.integrantes.join(', ') : (proyecto.integrantes || '');
  texto('Integrantes: ' + integrantes + '   ·   Fecha: ' + (proyecto.fecha || '') + '   ·   Contexto: ' + String(proyecto.contexto || '').toUpperCase(), MG, 20.5, { tam: 7.6, color: [70, 50, 40] });
  y = 30;

  // Parámetros de operación, siempre explícitos
  const parametrosTexto = [
    ['Días de operación', parametros.diasOperacionMes + ' al mes · ' + parametros.diasOperacionAnio + ' al año'],
    ['Costo unitario (CU)', pesos(parametros.costoUnitarioCU) + ' / kWh'],
    ['Ventana solar', h2(parametros.horaInicioDia) + ' a ' + h2(parametros.horaFinDia)],
    ['Perfil horario', resultados.fuentePerfil === 'medido' ? 'medido con el equipo' : 'estimado desde las cargas'],
  ];
  const anchoParam = AU / 4;
  doc.setFillColor(...SUAVE);
  doc.rect(MG, y, AU, 10, 'F');
  parametrosTexto.forEach(([e, v], i) => {
    const x = MG + 3 + i * anchoParam;
    texto(e.toUpperCase(), x, y + 3.8, { tam: 5.9, color: GRIS });
    texto(v, x, y + 7.8, { tam: 8, estilo: 'bold' });
  });
  y += 14;

  // ---------------- 1. Consumo ----------------
  seccion('01', 'Requerimiento energético');
  const repetidas = (resultados.horasDemandaMaximaH || []).slice(1);
  tarjetas([
    ['Potencia instalada', resultados.potenciaInstaladaW === null ? '—' : fmt(resultados.potenciaInstaladaW, 0) + ' W', resultados.potenciaInstaladaW === null ? 'sin cuadro de cargas' : fmt(resultados.potenciaInstaladaW / 1000, 2) + ' kW'],
    ['Demanda máxima', fmt(resultados.demandaMaximaW, 0) + ' W', 'a las ' + h2(resultados.horaDemandaMaximaH) + (repetidas.length ? ' (se repite)' : '')],
    ['Energía diaria', fmt(resultados.energiaDiariaKWh, 3) + ' kWh', 'por día'],
    ['Energía mensual', fmt(resultados.energiaMensualKWh, 1) + ' kWh', parametros.diasOperacionMes + ' días'],
    ['Energía anual', fmt(resultados.energiaAnualKWh, 1) + ' kWh', parametros.diasOperacionAnio + ' días'],
  ]);
  if (repetidas.length) {
    texto('La demanda máxima también ocurre a las ' + repetidas.map(h2).join(', ') + '; se reporta la primera hora.', MG, y - 0.6, { tam: 6.8, color: GRIS });
    y += 3;
  }

  // Perfil (izquierda) y cuadro de cargas (derecha)
  const yBloque = y;
  const anchoGraf = 88, altoGraf = 34, xG = MG + 9;
  const perfil = resultados.perfilHorarioW;
  const escala = M.calcularEscalaEjeY(Math.max(...perfil, 1), 4);
  texto('Perfil horario de demanda [W]', MG, y + 1.5, { tam: 7.2, estilo: 'bold', color: GRIS });
  const yG = y + 4;
  doc.setDrawColor(...LINEA);
  doc.setLineWidth(0.15);
  escala.marcas.forEach(m => {
    const yy = yG + altoGraf - (m / escala.maximo) * altoGraf;
    doc.line(xG, yy, xG + anchoGraf - 9, yy);
    texto(fmt(m, m % 1 ? 1 : 0), xG - 1.5, yy + 1, { tam: 5.4, color: GRIS, alinear: 'right' });
  });
  const paso = (anchoGraf - 9) / 24, barra = paso * 0.7;
  perfil.forEach((v, hh) => {
    const alto = (v / escala.maximo) * altoGraf;
    const x = xG + hh * paso + (paso - barra) / 2;
    const esPico = v === resultados.demandaMaximaW && v > 0;
    doc.setFillColor(...(esPico ? [150, 70, 30] : ACENTO_TEXTO));
    doc.rect(x, yG + altoGraf - alto, barra, alto, 'F');
    if (hh % 3 === 0) texto(String(hh), x + barra / 2, yG + altoGraf + 3, { tam: 5.4, color: GRIS, alinear: 'center' });
  });
  texto('hora del día', xG + (anchoGraf - 9) / 2, yG + altoGraf + 6.4, { tam: 5.4, color: GRIS, alinear: 'center' });

  // Cuadro de cargas compacto
  const xT = MG + anchoGraf + 4, anchoT = AU - anchoGraf - 4;
  const cargas = proyecto.cargas || [];
  texto('Cuadro de cargas', xT, y + 1.5, { tam: 7.2, estilo: 'bold', color: GRIS });
  let yT = y + 3.5;
  const cols = [{ t: 'Carga', a: 0.4 }, { t: 'Cant. x W', a: 0.18, d: true }, { t: 'Horario', a: 0.42 }];
  doc.setFillColor(58, 48, 43);
  doc.rect(xT, yT, anchoT, 4.4, 'F');
  let xc = xT;
  cols.forEach(c => { texto(c.t, c.d ? xc + c.a * anchoT - 1.5 : xc + 1.5, yT + 3.1, { tam: 6.2, estilo: 'bold', color: [255, 255, 255], alinear: c.d ? 'right' : undefined }); xc += c.a * anchoT; });
  yT += 4.4;
  const maxFilas = 8;
  if (!cargas.length) {
    texto('Sin cuadro de cargas: el perfil viene de la medición.', xT + 1.5, yT + 3.3, { tam: 6.6, color: GRIS });
    yT += 4.6;
  }
  cargas.slice(0, maxFilas).forEach((c, i) => {
    if (i % 2 === 1) { doc.setFillColor(...SUAVE); doc.rect(xT, yT, anchoT, 4.3, 'F'); }
    const celdas = [doc.splitTextToSize(t(c.descripcion), cols[0].a * anchoT - 3)[0], c.cantidad + ' x ' + fmt(c.potenciaUnitariaW, c.potenciaUnitariaW % 1 ? 1 : 0), M.formatoFranjas(c.horario)];
    xc = xT;
    celdas.forEach((v, j) => {
      const linea = doc.splitTextToSize(t(v), cols[j].a * anchoT - 3)[0];
      texto(linea, cols[j].d ? xc + cols[j].a * anchoT - 1.5 : xc + 1.5, yT + 3.1, { tam: 6.4, alinear: cols[j].d ? 'right' : undefined });
      xc += cols[j].a * anchoT;
    });
    yT += 4.3;
  });
  if (cargas.length > maxFilas) {
    texto('y ' + (cargas.length - maxFilas) + ' carga(s) más (ver el informe completo).', xT + 1.5, yT + 3, { tam: 6.2, color: GRIS });
    yT += 4.3;
  }
  y = Math.max(yG + altoGraf + 8, yT + 2);

  // Costos
  doc.setFillColor(...ACENTO_CLARO);
  doc.rect(MG, y, AU, 8, 'F');
  [['Costo diario', resultados.costoDiario], ['Costo mensual', resultados.costoMensual], ['Costo anual', resultados.costoAnual]].forEach(([e, v], i) => {
    const x = MG + 3 + i * (AU / 3);
    texto(e + ':', x, y + 5.3, { tam: 7.4, color: GRIS });
    texto(pesos(v), x + doc.getTextWidth(t(e + ':')) + 9, y + 5.3, { tam: 9, estilo: 'bold', color: ACENTO_TEXTO });
  });
  y += 10;
  if (resultados.advertenciaCU0) {
    texto('Aviso: el costo unitario (CU) es 0, por lo que los costos son $ 0 y no reflejan una tarifa real.', MG, y + 1, { tam: 6.8, estilo: 'bold', color: AMBAR });
    y += 4;
  }
  y += 2;

  // ---------------- 2. Generador ----------------
  seccion('02', 'Generador fotovoltaico');
  if (generador && generador.seleccion) {
    const g = generador, s = g.seleccion, m = s.modulo;
    tarjetas([
      ['Potencia pico', fmt(g.potenciaPicoKWp, 2) + ' kWp', g.criterioRecurso === 'anual' ? 'por promedio anual' : 'por mes crítico (' + g.recurso.mesCritico.nombre + ')'],
      ['Módulos', s.numeroModulos + ' x ' + m.potenciaW + ' Wp', s.cadenasParalelo + (s.cadenasParalelo === 1 ? ' cadena de ' : ' cadenas de ') + s.modulosSerie],
      ['Potencia instalada', fmt(s.potenciaInstaladaW / 1000, 2) + ' kWp', (s.excedentePct >= 0 ? '+' : '') + fmt(s.excedentePct, 1) + ' % de excedente'],
      ['Energía generada', fmt(g.energiaGeneradaDiariaKWh, 2) + ' kWh/día', 'cubre el ' + fmt(g.coberturaPct, 0) + ' % de Ed'],
    ]);
    ficha([
      ['Sitio', g.sitio.nombre + ' (lat ' + fmt(g.sitio.latitud, 3) + '°, lon ' + fmt(g.sitio.longitud, 3) + '°)'],
      ['Plano del generador', 'inclinación ' + fmt(g.sitio.inclinacionGrados, 1) + '°, azimut ' + g.sitio.azimutGrados + '° (0° = sur)'],
      ['Fuente del recurso solar', String(g.sitio.fuente).replace(/\.\s*$/, '') + ' · consulta ' + g.sitio.fechaConsulta],
      ['Irradiación', fmt(g.recurso.anual, 2) + ' kWh/m²·día anual · ' + fmt(g.recurso.mesCritico.valor, 2) + ' en ' + g.recurso.mesCritico.nombre],
      ['Cálculo', 'Ppico = Ed / (HSP · PR) con HSP ' + fmt(g.hspUsada, 2) + ' h y PR ' + fmt(g.pr, 2) + (g.metodo && g.metodo.id === 'balance' ? ' (método propio)' : '')],
      ['Módulo', m.fabricante + ' ' + m.modelo + ' · área ' + fmt(s.areaGeneradorM2, 2) + ' m² de ' + fmt(g.parametros.areaDisponibleM2, 0) + ' m²'],
    ], MG, AU);
    const c = g.segundaFuente;
    if (c) {
      const sg = v => (v >= 0 ? '+' : '') + fmt(v, 1) + ' %';
      franja('Segunda fuente: ' + c.fuente + ' (consulta ' + c.fechaConsulta + '). Irradiación anual ' + fmt(c.anual.segunda, 2) + ' (' + sg(c.anual.difPct) + '), mes crítico ' +
        fmt(c.critico.segunda, 2) + ' (' + sg(c.critico.difPct) + '). Potencia pico con la segunda fuente: ' + fmt(c.potencia.segunda, 2) + ' kWp (' + sg(c.potencia.difPct) + '), ' +
        (c.dentroDeTolerancia ? 'dentro' : 'fuera') + ' de la diferencia aceptada de ±' + c.toleranciaPct + ' %.', c.dentroDeTolerancia ? 'cumple' : 'no_cumple');
    } else {
      franja('Segunda fuente: no se contrastó la irradiación de este sitio con otra fuente.', 'alerta');
    }
    if (g.contingencia) franja('La consulta en línea falló (' + g.contingencia.motivo + '); se usó la base de datos local.', 'alerta');
  } else {
    franja('El generador todavía no se ha dimensionado (Paso 4).', 'alerta');
  }

  // ---------------- 3. Conversión ----------------
  y += 1;
  seccion('03', 'Conversión y almacenamiento');
  if (conversion && conversion.resultado) {
    const r = conversion.resultado;
    const sel = r.seleccion;
    const ETQ = { cumple: 'Cumple', alerta: 'Alerta', no_cumple: 'No cumple' };
    const nombreEq = eq => eq.referenciaTdR ? eq.modelo + ' (caso de prueba)' : eq.fabricante + ' ' + eq.modelo;
    const items = [
      ['Tipo de sistema', r.rama === 'con' ? 'Con baterías' : 'Sin baterías', r.rama === 'con' ? 'regulador y banco de baterías' : 'inversor conectado a la red'],
      [r.tipoEquipo === 'regulador' ? (sel && sel.unidades > 1 ? 'Reguladores en paralelo' : 'Regulador') : 'Inversor', sel ? (sel.unidades > 1 ? sel.unidades + ' x ' : '') + sel.equipo.modelo : 'Ninguno sirve',
        sel ? (sel.equipo.referenciaTdR ? 'caso de prueba' : sel.equipo.fabricante) + (sel.equipo.pacW ? ' · ' + fmt(sel.equipo.pacW, 0) + ' W' : '') + ' · ' + ETQ[sel.veredicto] : 'se requiere otro equipo', sel ? sel.veredicto : 'no_cumple'],
    ];
    if (r.rama === 'sin' && sel) items.push(['Relación DC/AC', fmt(sel.relacionDcAc, 2), 'rango ' + fmt(sel.rangoDcAc[0], 2) + ' a ' + fmt(sel.rangoDcAc[1], 2), (sel.criterios.find(k => k.id === 'dcac') || {}).estado]);
    if (r.rama === 'con' && r.banco) {
      const b = r.banco;
      items.push(['Banco de baterías', b.ns + 'S x ' + b.np + 'P', b.numeroBaterias + ' x ' + b.bateria.modelo]);
      items.push(['Energía del banco', fmt(b.kWhInstalados, 2) + ' kWh', fmt(b.autonomiaDias, b.autonomiaDias % 1 ? 1 : 0) + (b.modoAutonomia === 'noche' ? ' noche(s)' : ' día(s)') + ' · DoD final ' + fmt(b.dodFin * 100, 1) + ' %']);
    }
    tarjetas(items);
    if (r.rama === 'sin') {
      franja('Arranque de la bomba y otros motores: el inversor de red solo inyecta la energía de los paneles y la red entrega la corriente de arranque, por eso no se usa para elegir el inversor. Si la red falla, el inversor se apaga por protección antiisla.', null);
    } else {
      franja('Arranque de motores: el inversor de baterías debe soportar el arranque de la carga mayor con las demás funcionando; verifique su potencia de sobrecarga en la ficha.', null);
    }
    if (r.advertencias.length) franja('Alertas: ' + r.advertencias.slice(0, 2).join(' '), 'alerta');
  } else {
    franja('La conversión y el almacenamiento todavía no se han revisado (Paso 5).', 'alerta');
  }

  // ---------------- Pie ----------------
  doc.setDrawColor(...LINEA);
  doc.setLineWidth(0.25);
  doc.line(MG, AL - 11.5, AP - MG, AL - 11.5);
  texto('Universidad del Magdalena  ·  Energía Solar Fotovoltaica 2026-II  ·  Plataforma v' + version.numero + ' (' + version.fecha + ')', MG, AL - 7, { tam: 6.8, color: GRIS });
  texto('Página 1 de 1', AP - MG, AL - 7, { tam: 6.8, color: GRIS, alinear: 'right' });

  doc.save('Informe de una pagina - ' + String(proyecto.nombreProyecto || 'proyecto').replace(/[\\/:*?"<>|]/g, '-') + '.pdf');
  return { paginas: doc.getNumberOfPages(), yFinal: y };
}

if (typeof window !== 'undefined') window.generarResumenPDF = generarResumenPDF;
