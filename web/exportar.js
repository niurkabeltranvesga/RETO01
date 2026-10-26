// exportar.js
//
// Reúne los resultados del proyecto (consumo, generador, conversión y
// almacenamiento) en un objeto ordenado y lo convierte a CSV. Los números se
// redondean igual que en la pantalla y en el informe; en el CSV se escriben
// con coma decimal y punto y coma entre columnas.

(function (raiz) {
  'use strict';

  const r = (v, d) => (typeof v === 'number' && isFinite(v) ? Number(v.toFixed(d)) : null);
  const h2 = h => String(h).padStart(2, '0') + ':00';
  const ETIQUETA = { cumple: 'Cumple', alerta: 'Alerta', no_cumple: 'No cumple' };

  function reunirResultados(estado, version) {
    const M = raiz.MotorCalculo;
    const p = estado.parametros;
    const res = estado.resultados;
    const proyecto = estado.proyecto;

    const salida = {
      plataforma: {
        nombre: 'Requerimiento Energético',
        version: version ? version.numero : '',
        fechaVersion: version ? version.fecha : '',
        fechaExportacion: new Date().toISOString().slice(0, 10),
      },
      proyecto: {
        nombre: proyecto.nombreProyecto,
        integrantes: Array.isArray(proyecto.integrantes) ? proyecto.integrantes.join(', ') : proyecto.integrantes,
        fecha: proyecto.fecha,
        contexto: proyecto.contexto,
      },
      parametros: {
        diasOperacionMes: p.diasOperacionMes,
        diasOperacionAnio: p.diasOperacionAnio,
        costoUnitarioCU_COP_kWh: p.costoUnitarioCU,
        ventanaSolar: h2(p.horaInicioDia) + ' a ' + h2(p.horaFinDia),
      },
      cargas: (proyecto.cargas || []).map((c, i) => ({
        descripcion: c.descripcion,
        cantidad: c.cantidad,
        potenciaUnitaria_W: c.potenciaUnitariaW,
        potenciaTotal_W: c.potenciaTotalW,
        horario: M.formatoFranjas(c.horario),
        horasPorDia: c.horario.reduce((a, b) => a + b, 0),
        clasificacion: res.clasificacionCargas[i],
      })),
      consumo: {
        origenPerfil: res.fuentePerfil === 'medido' ? 'medido con el equipo' : 'estimado desde el cuadro de cargas',
        potenciaInstalada_W: r(res.potenciaInstaladaW, 0),
        demandaMaxima_W: r(res.demandaMaximaW, 0),
        horaDemandaMaxima: h2(res.horaDemandaMaximaH),
        otrasHorasDemandaMaxima: (res.horasDemandaMaximaH || []).slice(1).map(h2),
        energiaDiaria_kWh: r(res.energiaDiariaKWh, 3),
        energiaMensual_kWh: r(res.energiaMensualKWh, 1),
        energiaAnual_kWh: r(res.energiaAnualKWh, 1),
        costoDiario_COP: r(res.costoDiario, 0),
        costoMensual_COP: r(res.costoMensual, 0),
        costoAnual_COP: r(res.costoAnual, 0),
        perfilHorario_W: res.perfilHorarioW.map(v => r(v, 0)),
      },
      generador: null,
      conversion: null,
    };

    const g = estado.generador;
    if (g && g.seleccion) {
      const s = g.seleccion;
      const c = g.segundaFuente;
      salida.generador = {
        sitio: g.sitio.nombre,
        latitud: g.sitio.latitud,
        longitud: g.sitio.longitud,
        inclinacion_grados: g.sitio.inclinacionGrados,
        azimut_grados: g.sitio.azimutGrados,
        fuenteRecurso: g.sitio.fuente,
        fechaConsultaRecurso: g.sitio.fechaConsulta,
        irradiacionAnual_kWh_m2_dia: r(g.recurso.anual, 2),
        mesCritico: g.recurso.mesCritico.nombre,
        irradiacionMesCritico_kWh_m2_dia: r(g.recurso.mesCritico.valor, 2),
        criterioRecurso: g.criterioRecurso === 'anual' ? 'promedio anual' : 'mes de menor recurso',
        HSP_usada_h: r(g.hspUsada, 2),
        PR: r(g.pr, 2),
        potenciaPicoCalculada_kWp: r(g.potenciaPicoKWp, 2),
        potenciaPicoAnual_kWp: r(g.potenciaPicoAnualKWp, 2),
        potenciaPicoMesCritico_kWp: r(g.potenciaPicoCriticoKWp, 2),
        modulo: s.modulo.fabricante + ' ' + s.modulo.modelo,
        potenciaModulo_Wp: s.modulo.potenciaW,
        numeroModulos: s.numeroModulos,
        configuracion: s.cadenasParalelo + ' cadena(s) de ' + s.modulosSerie + ' módulos en serie',
        potenciaInstalada_kWp: r(s.potenciaInstaladaW / 1000, 2),
        excedente_pct: r(s.excedentePct, 1),
        vocGeneradorEnFrio_V: r(s.vocGeneradorTminV, 1),
        vmpGeneradorEnOperacion_V: r(s.vmpGeneradorOperacionV, 1),
        iscGenerador_A: r(s.iscGeneradorA, 1),
        areaOcupada_m2: r(s.areaGeneradorM2, 2),
        energiaGeneradaDiaria_kWh: r(g.energiaGeneradaDiariaKWh, 2),
        segundaFuente: c ? {
          fuente: c.fuente,
          fechaConsulta: c.fechaConsulta,
          irradiacionAnual_kWh_m2_dia: r(c.anual.segunda, 2),
          diferenciaAnual_pct: r(c.anual.difPct, 1),
          irradiacionMesCritico_kWh_m2_dia: r(c.critico.segunda, 2),
          diferenciaMesCritico_pct: r(c.critico.difPct, 1),
          potenciaPicoSegundaFuente_kWp: r(c.potencia.segunda, 2),
          diferenciaPotenciaPico_pct: r(c.potencia.difPct, 1),
          toleranciaAceptada_pct: c.toleranciaPct,
          dentroDeTolerancia: c.dentroDeTolerancia,
        } : null,
      };
    }

    const conv = estado.conversion;
    if (conv && conv.resultado) {
      const x = conv.resultado;
      const sel = x.seleccion;
      salida.conversion = {
        rama: x.rama === 'con' ? 'con almacenamiento' : 'sin almacenamiento',
        tipoEquipo: x.tipoEquipo,
        equipo: sel ? sel.equipo.fabricante + ' ' + sel.equipo.modelo : null,
        unidadesEnParalelo: sel ? (sel.unidades || 1) : null,
        veredicto: sel ? ETIQUETA[sel.veredicto] || sel.veredicto : 'Ningún equipo del catálogo admite el generador',
        relacionDcAc: sel && typeof sel.relacionDcAc === 'number' ? r(sel.relacionDcAc, 2) : null,
        corrienteAlBanco_A: sel && typeof sel.corrienteBancoA === 'number' ? r(sel.corrienteBancoA, 1) : null,
        corrienteConductoresFV_A: r(x.corrienteConductoresA, 1),
        alertas: x.advertencias.slice(),
        banco: x.banco ? {
          bateria: x.banco.bateria.fabricante + ' ' + x.banco.bateria.modelo,
          configuracion: x.banco.ns + 'S x ' + x.banco.np + 'P',
          numeroBaterias: x.banco.numeroBaterias,
          tensionBanco_V: r(x.banco.vBancoV, 1),
          capacidadInstalada_Ah: r(x.banco.ahInstalados, 0),
          energiaInstalada_kWh: r(x.banco.kWhInstalados, 2),
          DoDFinal_pct: r(x.banco.dodFin * 100, 1),
          autonomia: x.banco.modoAutonomia === 'noche' ? 'consumo nocturno' : 'días completos',
          autonomiaN: x.banco.autonomiaDias,
          energiaNocturna_kWh: x.banco.modoAutonomia === 'noche' ? r(x.banco.energiaNocheKWh, 3) : null,
          recuperacion_dias: x.recuperacion && x.recuperacion.seRecupera ? r(x.recuperacion.dias, 1) : null,
        } : null,
      };
    }
    return salida;
  }

  // ---------------------------------------------------------------------
  // CSV: secciones con filas «indicador; valor; unidad», coma decimal.
  // ---------------------------------------------------------------------
  function celda(v) {
    if (v === null || v === undefined) return '';
    let t = typeof v === 'number' ? String(v).replace('.', ',') : (typeof v === 'boolean' ? (v ? 'sí' : 'no') : String(v));
    if (typeof v === 'string' && /^-?\d+\.\d+$/.test(v)) t = v.replace('.', ',');
    if (/[;"\n\r]/.test(t)) t = '"' + t.replace(/"/g, '""') + '"';
    return t;
  }
  const linea = celdas => celdas.map(celda).join(';');

  function aCSV(d) {
    const L = [];
    // d: decimales fijos del valor, iguales a los de la pantalla y el informe.
    const fila = (seccion, indicador, valor, unidad, d) =>
      L.push(linea([seccion, indicador, typeof valor === 'number' && d !== undefined ? valor.toFixed(d) : valor, unidad || '']));
    L.push(linea(['Sección', 'Indicador', 'Valor', 'Unidad']));
    fila('Plataforma', 'Versión', d.plataforma.version + ' (' + d.plataforma.fechaVersion + ')');
    fila('Plataforma', 'Fecha de exportación', d.plataforma.fechaExportacion);
    fila('Proyecto', 'Nombre', d.proyecto.nombre);
    fila('Proyecto', 'Integrantes', d.proyecto.integrantes);
    fila('Proyecto', 'Fecha', d.proyecto.fecha);
    fila('Proyecto', 'Contexto', d.proyecto.contexto);
    fila('Parámetros', 'Días de operación al mes', d.parametros.diasOperacionMes, 'días');
    fila('Parámetros', 'Días de operación al año', d.parametros.diasOperacionAnio, 'días');
    fila('Parámetros', 'Costo unitario CU', d.parametros.costoUnitarioCU_COP_kWh, '$/kWh');
    fila('Parámetros', 'Ventana solar', d.parametros.ventanaSolar);
    const c = d.consumo;
    fila('Consumo', 'Origen del perfil', c.origenPerfil);
    fila('Consumo', 'Potencia instalada', c.potenciaInstalada_W, 'W');
    fila('Consumo', 'Demanda máxima', c.demandaMaxima_W, 'W');
    fila('Consumo', 'Hora de la demanda máxima', c.horaDemandaMaxima);
    if (c.otrasHorasDemandaMaxima.length) fila('Consumo', 'La demanda máxima se repite a las', c.otrasHorasDemandaMaxima.join(', '));
    fila('Consumo', 'Energía diaria', c.energiaDiaria_kWh, 'kWh/día', 3);
    fila('Consumo', 'Energía mensual', c.energiaMensual_kWh, 'kWh/mes', 1);
    fila('Consumo', 'Energía anual', c.energiaAnual_kWh, 'kWh/año', 1);
    fila('Costos', 'Costo diario', c.costoDiario_COP, '$');
    fila('Costos', 'Costo mensual', c.costoMensual_COP, '$');
    fila('Costos', 'Costo anual', c.costoAnual_COP, '$');

    const g = d.generador;
    if (g) {
      fila('Generador', 'Sitio', g.sitio);
      fila('Generador', 'Latitud', g.latitud, '°');
      fila('Generador', 'Longitud', g.longitud, '°');
      fila('Generador', 'Inclinación', g.inclinacion_grados, '°');
      fila('Generador', 'Azimut (0 = sur)', g.azimut_grados, '°');
      fila('Generador', 'Fuente del recurso solar', g.fuenteRecurso + ' (consulta ' + g.fechaConsultaRecurso + ')');
      fila('Generador', 'Irradiación promedio anual', g.irradiacionAnual_kWh_m2_dia, 'kWh/m²·día', 2);
      fila('Generador', 'Irradiación del mes crítico (' + g.mesCritico + ')', g.irradiacionMesCritico_kWh_m2_dia, 'kWh/m²·día', 2);
      fila('Generador', 'Dimensionado con', g.criterioRecurso);
      fila('Generador', 'HSP usada', g.HSP_usada_h, 'h', 2);
      fila('Generador', 'Factor de desempeño PR', g.PR, '', 2);
      fila('Generador', 'Potencia pico calculada', g.potenciaPicoCalculada_kWp, 'kWp', 2);
      fila('Generador', 'Módulo', g.modulo + ' (' + g.potenciaModulo_Wp + ' Wp)');
      fila('Generador', 'Número de módulos', g.numeroModulos);
      fila('Generador', 'Configuración', g.configuracion);
      fila('Generador', 'Potencia instalada', g.potenciaInstalada_kWp, 'kWp', 2);
      fila('Generador', 'Voc del generador en frío', g.vocGeneradorEnFrio_V, 'V', 1);
      fila('Generador', 'Vmp del generador en operación', g.vmpGeneradorEnOperacion_V, 'V', 1);
      fila('Generador', 'Isc del generador', g.iscGenerador_A, 'A', 1);
      fila('Generador', 'Área ocupada', g.areaOcupada_m2, 'm²', 2);
      fila('Generador', 'Energía generada', g.energiaGeneradaDiaria_kWh, 'kWh/día', 2);
      const s = g.segundaFuente;
      if (s) {
        fila('Segunda fuente', 'Fuente', s.fuente + ' (consulta ' + s.fechaConsulta + ')');
        fila('Segunda fuente', 'Irradiación promedio anual', s.irradiacionAnual_kWh_m2_dia, 'kWh/m²·día', 2);
        fila('Segunda fuente', 'Diferencia anual', s.diferenciaAnual_pct, '%', 1);
        fila('Segunda fuente', 'Irradiación del mes crítico', s.irradiacionMesCritico_kWh_m2_dia, 'kWh/m²·día', 2);
        fila('Segunda fuente', 'Diferencia del mes crítico', s.diferenciaMesCritico_pct, '%', 1);
        fila('Segunda fuente', 'Potencia pico con la segunda fuente', s.potenciaPicoSegundaFuente_kWp, 'kWp', 2);
        fila('Segunda fuente', 'Diferencia de potencia pico', s.diferenciaPotenciaPico_pct, '%', 1);
        fila('Segunda fuente', 'Dentro de ±' + s.toleranciaAceptada_pct + ' %', s.dentroDeTolerancia);
      }
    }

    const v = d.conversion;
    if (v) {
      fila('Conversión', 'Rama', v.rama);
      fila('Conversión', 'Equipo seleccionado', v.equipo || 'ninguno');
      if (v.unidadesEnParalelo > 1) fila('Conversión', 'Reguladores en paralelo', v.unidadesEnParalelo);
      fila('Conversión', 'Veredicto', v.veredicto);
      if (v.relacionDcAc !== null) fila('Conversión', 'Relación DC/AC', v.relacionDcAc, '', 2);
      if (v.corrienteAlBanco_A !== null) fila('Conversión', 'Corriente al banco', v.corrienteAlBanco_A, 'A', 1);
      fila('Conversión', 'Corriente de los conductores FV (1,25 · Isc)', v.corrienteConductoresFV_A, 'A', 1);
      if (v.banco) {
        fila('Baterías', 'Batería', v.banco.bateria);
        fila('Baterías', 'Configuración', v.banco.configuracion + ' (' + v.banco.numeroBaterias + ' baterías)');
        fila('Baterías', 'Tensión del banco', v.banco.tensionBanco_V, 'V', 1);
        fila('Baterías', 'Capacidad instalada', v.banco.capacidadInstalada_Ah, 'Ah');
        fila('Baterías', 'Energía instalada', v.banco.energiaInstalada_kWh, 'kWh', 2);
        fila('Baterías', 'DoD final', v.banco.DoDFinal_pct, '%', 1);
        fila('Baterías', 'Autonomía', v.banco.autonomia + ': ' + v.banco.autonomiaN + (v.banco.autonomia === 'consumo nocturno' ? ' noche(s)' : ' día(s)'));
        if (v.banco.energiaNocturna_kWh !== null) fila('Baterías', 'Energía nocturna', v.banco.energiaNocturna_kWh, 'kWh', 3);
        fila('Baterías', 'Recuperación', v.banco.recuperacion_dias === null ? 'no se recupera' : v.banco.recuperacion_dias, 'días', 1);
      }
      v.alertas.forEach(a => fila('Conversión', 'Alerta', a));
    }

    L.push('');
    L.push(linea(['Perfil horario', 'Hora', 'Potencia', 'Unidad']));
    c.perfilHorario_W.forEach((w, h) => L.push(linea(['Perfil horario', h2(h) + ' a ' + h2((h + 1) % 24), w, 'W'])));

    if (d.cargas.length) {
      L.push('');
      L.push(linea(['Carga', 'Cantidad', 'Potencia unitaria (W)', 'Potencia total (W)', 'Horario', 'Horas por día', 'Clasificación']));
      d.cargas.forEach(k => L.push(linea([k.descripcion, k.cantidad, k.potenciaUnitaria_W, k.potenciaTotal_W, k.horario, k.horasPorDia, k.clasificacion])));
    }
    return L.join('\r\n') + '\r\n';
  }

  const Exportar = { reunirResultados, aCSV };
  if (typeof module !== 'undefined' && module.exports) module.exports = Exportar;
  if (raiz) raiz.Exportar = Exportar;
})(typeof window !== 'undefined' ? window : null);
