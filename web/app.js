
// Lógica de interfaz de la app web. 

(function () {
  'use strict';
  const M = window.MotorCalculo;

  // ESTADO DE LA APP 
  const estado = {
    proyecto: null,      // { nombreProyecto, integrantes, fecha, contexto, cargas: [] }
    listaCargas: [],      // arreglo de cargas (ver crearCarga)
    parametros: {
      diasOperacionMes: 30,
      diasOperacionAnio: 360,
      costoUnitarioCU: 0,
      horaInicioDia: 6,
      horaFinDia: 18,
    },
    resultados: null,
    filaSeleccionada: null,
    filaEdicion: null, // índice de la carga que se está editando (null = modo "agregar")
    medicion: null,    // perfil cargado desde la hoja de datos del equipo (opcional)
    fuentePerfil: 'medido', // cuál perfil usar cuando hay medición y cargas a la vez
    generador: null,        // resultado del dimensionamiento (Paso 4, Reto 02)
  };

  // El módulo de dimensionamiento (generador.js) se entera de cada cambio en
  // el consumo para recalcular solo, sin que el usuario reingrese nada.
  function avisarCambioDeConsumo() {
    if (window.UIGenerador) window.UIGenerador.alCambiarConsumo();
  }

  // NAVEGACIÓN 
  function irAPaso(n) {
    Array.from(document.querySelectorAll('.panel')).forEach(p => p.classList.remove('is-active'));
    document.getElementById('panel-' + n).classList.add('is-active');

    Array.from(document.querySelectorAll('.step')).forEach(s => {
      const num = Number(s.dataset.step);
      s.classList.toggle('is-active', num === n);
      s.classList.toggle('is-done', num < n);
    });
  }

  // BIENVENIDA 
  document.getElementById('btnComenzar').addEventListener('click', () => {
    document.getElementById('stepperNav').classList.add('is-visible');
    irAPaso(1);
  });

  Array.from(document.querySelectorAll('[data-goto]')).forEach(btn => {
    btn.addEventListener('click', () => irAPaso(Number(btn.dataset.goto)));
  });

  // UTILIDAD: mensajes de estado
  function mostrarEstado(elId, mensaje, tipo) {
    const el = document.getElementById(elId);
    el.textContent = mensaje;
    el.className = 'status ' + (tipo || '');
  }

  //PROYECTO

  document.getElementById('btnGuardarProyecto').addEventListener('click', () => {
    try {
      const nombre = document.getElementById('nombreProyecto').value;
      const integrantes = document.getElementById('integrantes').value;
      const fecha = document.getElementById('fechaProyecto').value;
      const contexto = document.getElementById('contexto').value;

      estado.proyecto = M.crearProyecto(nombre, integrantes, fecha, contexto);
      estado.proyecto.cargas = estado.listaCargas;

      mostrarEstado('estadoProyecto', 'Datos del proyecto guardados correctamente.', 'ok');
    } catch (err) {
      mostrarEstado('estadoProyecto', 'Error: ' + err.message, 'error');
    }
  });

  document.getElementById('btnGuardarArchivo').addEventListener('click', () => {
    if (!estado.proyecto) {
      mostrarEstado('estadoArchivo', 'Primero guarde los datos del proyecto (botón de arriba).', 'error');
      return;
    }
    estado.proyecto.cargas = estado.listaCargas;
    const datos = {
      version: '1.0-web',
      nombreProyecto: estado.proyecto.nombreProyecto,
      integrantes: estado.proyecto.integrantes,
      fecha: estado.proyecto.fecha,
      contexto: estado.proyecto.contexto,
      parametros: estado.parametros,
      cargas: estado.listaCargas.map(c => ({
        descripcion: c.descripcion, cantidad: c.cantidad,
        potenciaUnitariaW: c.potenciaUnitariaW, horario: c.horario,
      })),
      medicion: estado.medicion ? {
        perfilW: estado.medicion.perfilW,
        totalLecturas: estado.medicion.totalLecturas,
        horasSinDato: estado.medicion.horasSinDato,
        potenciaEstimada: estado.medicion.potenciaEstimada,
        avisos: estado.medicion.avisos,
        archivo: estado.medicion.archivo,
        fecha: estado.medicion.fecha,
      } : null,
      fuentePerfil: estado.fuentePerfil,
      generador: window.UIGenerador ? window.UIGenerador.obtenerConfiguracion() : null,
    };
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (estado.proyecto.nombreProyecto || 'proyecto') + '.json';
    a.click();
    URL.revokeObjectURL(url);
    mostrarEstado('estadoArchivo', 'Proyecto descargado como ' + a.download, 'ok');
  });

  document.getElementById('inputCargarArchivo').addEventListener('change', (event) => {
    const archivo = event.target.files[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => {
      try {
        const datos = JSON.parse(lector.result);
        const camposRequeridos = ['nombreProyecto', 'integrantes', 'fecha', 'contexto', 'cargas'];
        for (const campo of camposRequeridos) {
          if (!(campo in datos)) throw new Error('El archivo no contiene el campo obligatorio "' + campo + '".');
        }

        estado.proyecto = M.crearProyecto(datos.nombreProyecto, datos.integrantes, datos.fecha, datos.contexto);
        estado.listaCargas = datos.cargas.map(c => M.crearCarga(c.descripcion, c.cantidad, c.potenciaUnitariaW, c.horario));
        estado.proyecto.cargas = estado.listaCargas;

        document.getElementById('nombreProyecto').value = estado.proyecto.nombreProyecto;
        document.getElementById('integrantes').value = Array.isArray(estado.proyecto.integrantes) ? estado.proyecto.integrantes.join(', ') : estado.proyecto.integrantes;
        document.getElementById('fechaProyecto').value = estado.proyecto.fecha;
        document.getElementById('contexto').value = estado.proyecto.contexto;

        if (datos.parametros) {
          estado.parametros = datos.parametros;
          document.getElementById('diasMes').value = estado.parametros.diasOperacionMes;
          document.getElementById('diasAnio').value = estado.parametros.diasOperacionAnio;
          document.getElementById('costoUnitario').value = estado.parametros.costoUnitarioCU;
          document.getElementById('horaInicioDia').value = estado.parametros.horaInicioDia;
          document.getElementById('horaFinDia').value = estado.parametros.horaFinDia;
        }

        // La medición es opcional y vive aparte del cuadro de cargas. Si el
        // archivo trae una, se restaura; si no trae pero ya había una cargada
        // en esta sesión, se conserva en vez de borrarla en silencio. En
        // cualquier caso se le dice al usuario qué pasó con ella.
        let notaMedicion = '';
        if (datos.medicion && Array.isArray(datos.medicion.perfilW) && datos.medicion.perfilW.length === 24) {
          estado.medicion = {
            perfilW: datos.medicion.perfilW,
            totalLecturas: datos.medicion.totalLecturas || 0,
            horasSinDato: datos.medicion.horasSinDato || [],
            potenciaEstimada: !!datos.medicion.potenciaEstimada,
            avisos: datos.medicion.avisos || [],
            archivo: datos.medicion.archivo || 'medición guardada',
            fecha: datos.medicion.fecha || '',
          };
          estado.fuentePerfil = datos.fuentePerfil === 'estimado' ? 'estimado' : 'medido';
          notaMedicion = ' Se restauró la medición guardada en el archivo (' + estado.medicion.archivo + ').';
        } else if (estado.medicion) {
          notaMedicion = ' Se conservó la medición que ya tenías cargada (' + estado.medicion.archivo +
            '); si no corresponde a este proyecto, retírala en el Paso 2.';
        }
        document.getElementById('fuentePerfil').value = estado.fuentePerfil;
        renderizarResumenMedicion();

        actualizarTablaCargas();
        calcularResultados(true);

        if (window.UIGenerador) window.UIGenerador.aplicarConfiguracion(datos.generador || null);

        mostrarEstado('estadoArchivo', 'Proyecto cargado desde: ' + archivo.name + '.' + notaMedicion, 'ok');
      } catch (err) {
        mostrarEstado('estadoArchivo', 'Error al cargar: ' + err.message, 'error');
      }
      event.target.value = '';
    };
    lector.readAsText(archivo);
  });

  //CARGAS
  const horarioGrid = document.getElementById('horarioGrid');
  for (let h = 0; h < 24; h++) {
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" data-hora="${h}"> ${String(h).padStart(2, '0')}:00`;
    horarioGrid.appendChild(label);
  }

  function leerHorarioSeleccionado() {
    const checks = horarioGrid.querySelectorAll('input[type=checkbox]');
    const horario = new Array(24).fill(0);
    Array.from(checks).forEach(chk => { horario[Number(chk.dataset.hora)] = chk.checked ? 1 : 0; });
    return horario;
  }

  function limpiarHorarioSeleccionado() {
    Array.from(horarioGrid.querySelectorAll('input[type=checkbox]')).forEach(chk => { chk.checked = false; });
  }

  function limpiarFormularioCarga() {
    document.getElementById('descCarga').value = '';
    document.getElementById('cantCarga').value = 1;
    document.getElementById('potCarga').value = 100;
    limpiarHorarioSeleccionado();
  }

  function ocultarConfirmarEliminar() {
    const confirmar = document.getElementById('confirmarEliminarCarga');
    if (confirmar) confirmar.hidden = true;
  }

  function salirModoEdicion() {
    estado.filaEdicion = null;
    document.getElementById('btnAgregarCarga').textContent = 'Agregar carga al cuadro';
    const btnCancelar = document.getElementById('btnCancelarEdicion');
    if (btnCancelar) btnCancelar.hidden = true;
    limpiarFormularioCarga();
  }

  document.getElementById('btnAgregarCarga').addEventListener('click', () => {
    try {
      const desc = document.getElementById('descCarga').value;
      const cant = Number(document.getElementById('cantCarga').value);
      const pot = Number(document.getElementById('potCarga').value);
      const horario = leerHorarioSeleccionado();

      const candidata = M.crearCarga(desc, cant, pot, horario);

      const indiceExcluir = estado.filaEdicion !== null ? estado.filaEdicion : -1;
      const indiceDuplicado = M.encontrarCargaDuplicada(
        estado.listaCargas, candidata.descripcion, candidata.potenciaUnitariaW, candidata.horario, indiceExcluir
      );
      if (indiceDuplicado !== -1) {
        estado.filaSeleccionada = indiceDuplicado;
        actualizarTablaCargas();
        mostrarEstado(
          'estadoCarga',
          'Ya existe una carga igual en la fila ' + (indiceDuplicado + 1) +
          ' (misma descripción, potencia y horario). Edítala o aumenta su cantidad en vez de crear una nueva.',
          'error'
        );
        return;
      }

      if (estado.filaEdicion !== null) {
        estado.listaCargas[estado.filaEdicion] = candidata;
        mostrarEstado('estadoCarga', 'Carga actualizada correctamente.', 'ok');
        salirModoEdicion();
      } else {
        estado.listaCargas.push(candidata);
        mostrarEstado('estadoCarga', 'Carga agregada correctamente.', 'ok');
        limpiarFormularioCarga();
      }

      actualizarTablaCargas();
      recalcularSiCorresponde();
    } catch (err) {
      mostrarEstado('estadoCarga', 'Error: ' + err.message, 'error');
    }
  });

  document.getElementById('btnEditarCarga').addEventListener('click', () => {
    if (estado.filaSeleccionada === null) {
      mostrarEstado('estadoCarga', 'Seleccione primero una fila de la tabla para editar.', 'error');
      return;
    }
    const c = estado.listaCargas[estado.filaSeleccionada];
    document.getElementById('descCarga').value = c.descripcion;
    document.getElementById('cantCarga').value = c.cantidad;
    document.getElementById('potCarga').value = c.potenciaUnitariaW;
    Array.from(horarioGrid.querySelectorAll('input[type=checkbox]')).forEach(chk => {
      chk.checked = c.horario[Number(chk.dataset.hora)] === 1;
    });

    estado.filaEdicion = estado.filaSeleccionada;
    document.getElementById('btnAgregarCarga').textContent = 'Guardar cambios';
    document.getElementById('btnCancelarEdicion').hidden = false;
    ocultarConfirmarEliminar();
    mostrarEstado(
      'estadoCarga',
      'Editando la carga de la fila ' + (estado.filaSeleccionada + 1) + '. Modifica los campos y pulsa «Guardar cambios».',
      ''
    );
  });

  document.getElementById('btnCancelarEdicion').addEventListener('click', () => {
    salirModoEdicion();
    mostrarEstado('estadoCarga', 'Edición cancelada.', '');
  });

  document.getElementById('btnEliminarCarga').addEventListener('click', () => {
    if (estado.filaSeleccionada === null) {
      mostrarEstado('estadoCarga', 'Seleccione primero una fila de la tabla para eliminar.', 'error');
      return;
    }
    document.getElementById('confirmarEliminarCarga').hidden = false;
  });

  document.getElementById('btnCancelarEliminar').addEventListener('click', () => {
    ocultarConfirmarEliminar();
  });

  document.getElementById('btnConfirmarEliminar').addEventListener('click', () => {
    if (estado.filaSeleccionada === null) return;
    if (estado.filaEdicion !== null) salirModoEdicion(); // evita índices desfasados si se edita y elimina a la vez
    estado.listaCargas.splice(estado.filaSeleccionada, 1);
    estado.filaSeleccionada = null;
    ocultarConfirmarEliminar();
    actualizarTablaCargas();
    recalcularSiCorresponde();
    mostrarEstado('estadoCarga', 'Carga eliminada.', 'ok');
  });

  function actualizarTablaCargas() {
    const cuerpo = document.getElementById('cuerpoTablaCargas');
    cuerpo.innerHTML = '';
    estado.listaCargas.forEach((c, i) => {
      const clasificacion = M.clasificarCarga(c.horario, estado.parametros.horaInicioDia, estado.parametros.horaFinDia);
      const horario = M.formatoHorarioCompacto(c.horario);
      const tr = document.createElement('tr');
      if (estado.filaSeleccionada === i) tr.classList.add('is-selected');
      tr.innerHTML = `
        <td class="fila-check"><input type="radio" name="filaCarga" ${estado.filaSeleccionada === i ? 'checked' : ''}></td>
        <td>${i + 1}</td>
        <td>${escapeHtml(c.descripcion)}</td>
        <td>${c.cantidad}</td>
        <td>${c.potenciaUnitariaW}</td>
        <td>${c.potenciaTotalW}</td>
        <td>${horario}</td>
        <td>${clasificacion}</td>
      `;
      tr.addEventListener('click', () => {
        estado.filaSeleccionada = (estado.filaSeleccionada === i) ? null : i;
        ocultarConfirmarEliminar();
        actualizarTablaCargas();
      });
      cuerpo.appendChild(tr);
    });
  }

  function escapeHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
  }

  // MEDICIÓN (opcional): hoja de datos del nodo ESP32 con las pinzas.
  // Es una vía alterna para obtener el perfil horario; si no se usa, la app
  // se comporta exactamente como antes.

  document.getElementById('inputCargarMedicion').addEventListener('change', (evento) => {
    const archivo = evento.target.files[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => {
      try {
        const lectura = window.Medicion.perfilDesdeHojaDeDatos(lector.result);
        estado.medicion = {
          perfilW: lectura.perfilW,
          totalLecturas: lectura.totalLecturas,
          horasSinDato: lectura.horasSinDato,
          potenciaEstimada: lectura.potenciaEstimada,
          avisos: lectura.avisos,
          archivo: archivo.name,
          fecha: new Date().toLocaleDateString('es-CO'),
        };
        estado.fuentePerfil = 'medido';
        document.getElementById('fuentePerfil').value = 'medido';

        mostrarEstado('estadoMedicion',
          'Medición cargada desde ' + archivo.name + ': ' + lectura.totalLecturas + ' lecturas.', 'ok');
        renderizarResumenMedicion();
        recalcularSiCorresponde();
      } catch (err) {
        estado.medicion = null;
        renderizarResumenMedicion();
        mostrarEstado('estadoMedicion', 'Error al leer la hoja de datos: ' + err.message, 'error');
      }
      evento.target.value = '';
    };
    lector.readAsText(archivo);
  });

  document.getElementById('btnQuitarMedicion').addEventListener('click', () => {
    estado.medicion = null;
    estado.fuentePerfil = 'medido';
    renderizarResumenMedicion();
    mostrarEstado('estadoMedicion', 'Medición retirada. Se volverá a usar el perfil estimado de tus aparatos.', '');
    recalcularSiCorresponde();
  });

  document.getElementById('fuentePerfil').addEventListener('change', (evento) => {
    estado.fuentePerfil = evento.target.value;
    recalcularSiCorresponde();
  });

  function renderizarResumenMedicion() {
    const resumen = document.getElementById('resumenMedicion');
    const aviso = document.getElementById('avisoMedicion');
    const btnQuitar = document.getElementById('btnQuitarMedicion');

    if (!estado.medicion) {
      resumen.hidden = true;
      aviso.hidden = true;
      btnQuitar.hidden = true;
      return;
    }

    const m = estado.medicion;
    const Ed = M.calcularEnergiaDiaria(m.perfilW);
    const Pmax = M.calcularDemandaMaxima(m.perfilW);
    const horaPico = M.calcularHoraDemandaMaxima(m.perfilW);
    const horasConDato = 24 - m.horasSinDato.length;

    const tarjetas = [
      ['Lecturas leídas', String(m.totalLecturas), 'del archivo'],
      ['Horas con dato', horasConDato + ' de 24', m.horasSinDato.length === 0 ? 'día completo' : 'faltan ' + m.horasSinDato.length],
      ['Energía diaria medida', Ed.toFixed(2) + ' kWh', 'por día'],
      ['Demanda máxima medida', Pmax.toFixed(1) + ' W', 'h=' + String(horaPico).padStart(2, '0') + ':00'],
    ];
    document.getElementById('indicadoresMedicion').innerHTML = tarjetas.map(([label, val, sub]) => `
      <div class="indicador-card">
        <div class="label">${label}</div>
        <div class="value">${val}</div>
        <div class="sub">${sub}</div>
      </div>
    `).join('');

    if (m.avisos.length > 0) {
      aviso.innerHTML = '<strong>Ten en cuenta:</strong><ul>' +
        m.avisos.map(a => '<li>' + escapeHtml(a) + '</li>').join('') + '</ul>';
      aviso.hidden = false;
    } else {
      aviso.hidden = true;
    }

    resumen.hidden = false;
    btnQuitar.hidden = false;
  }

  //RESULTADOS
  
  document.getElementById('btnCalcular').addEventListener('click', () => calcularResultados(false));

  // Recalcula automáticamente cuando ya había resultados en pantalla y el
  // cuadro de cargas o los parámetros cambian, para que nunca se muestren
  // valores desactualizados sin avisar (agregar/editar/eliminar cargas, o
  // cambiar días/CU/criterio día-noche).
  function recalcularSiCorresponde() {
    if (estado.resultados) calcularResultados(true);
  }

  ['diasMes', 'diasAnio', 'costoUnitario', 'horaInicioDia', 'horaFinDia'].forEach(id => {
    document.getElementById(id).addEventListener('change', recalcularSiCorresponde);
  });

  function limpiarResultados() {
    estado.resultados = null;
    document.getElementById('indicadoresGrid').innerHTML = '';
    document.getElementById('graficoPerfil').innerHTML = '';
    ocultarTooltipGrafica();
    ['avisoCU0', 'avisoFuentePerfil', 'avisoComparacion'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });
    avisarCambioDeConsumo();
  }

  function calcularResultados(silencioso) {
    if (!estado.proyecto) {
      limpiarResultados();
      if (!silencioso) mostrarEstado('estadoResultados', 'Primero guarde los datos del proyecto en el Paso 1.', 'error');
      return;
    }
    if (estado.listaCargas.length === 0 && !estado.medicion) {
      limpiarResultados();
      if (!silencioso) mostrarEstado('estadoResultados', 'Agregue al menos una carga en el Paso 2, o cargue la hoja de datos del equipo de medición.', 'error');
      return;
    }

    estado.parametros.diasOperacionMes = Number(document.getElementById('diasMes').value);
    estado.parametros.diasOperacionAnio = Number(document.getElementById('diasAnio').value);
    estado.parametros.costoUnitarioCU = Number(document.getElementById('costoUnitario').value);
    estado.parametros.horaInicioDia = Number(document.getElementById('horaInicioDia').value);
    estado.parametros.horaFinDia = Number(document.getElementById('horaFinDia').value);

    try {
      estado.proyecto.cargas = estado.listaCargas;
      estado.proyecto.perfilMedidoW = estado.medicion ? estado.medicion.perfilW : null;
      estado.proyecto.fuentePerfil = estado.fuentePerfil;
      estado.proyecto.medicion = estado.medicion; // para la trazabilidad del informe
      estado.resultados = M.calcularResultadosProyecto(estado.proyecto, estado.parametros);

      renderizarIndicadores(estado.resultados);
      renderizarGrafica(estado.resultados.perfilHorarioW);
      actualizarTablaCargas(); // refresca clasificación por si cambió el criterio día/noche
      renderizarAvisosPerfil(estado.resultados);

      const avisoCU0 = document.getElementById('avisoCU0');
      if (avisoCU0) avisoCU0.hidden = !estado.resultados.advertenciaCU0;

      mostrarEstado('estadoResultados', 'Resultados calculados correctamente.', 'ok');
      avisarCambioDeConsumo();
    } catch (err) {
      limpiarResultados();
      mostrarEstado('estadoResultados', 'Error: ' + err.message, 'error');
    }
  }

  // Banda informativa del Paso 3: de dónde salió el perfil y, si hay ambos,
  // cuánta energía medida no quedó explicada por las cargas registradas.
  function renderizarAvisosPerfil(r) {
    const avisoFuente = document.getElementById('avisoFuentePerfil');
    const avisoComparacion = document.getElementById('avisoComparacion');
    if (!avisoFuente || !avisoComparacion) return;

    if (estado.medicion) {
      const origen = r.fuentePerfil === 'medido'
        ? 'Los resultados usan el <strong>perfil medido</strong> con el equipo (' + escapeHtml(estado.medicion.archivo) + ').'
        : 'Los resultados usan el <strong>perfil estimado</strong> a partir de tus aparatos. La medición cargada queda solo como referencia.';
      avisoFuente.innerHTML = origen;
      avisoFuente.hidden = false;
    } else {
      avisoFuente.hidden = true;
    }

    const c = r.comparacionPerfiles;
    if (c) {
      const signo = c.diferenciaKWh >= 0 ? '+' : '−';
      const magnitud = Math.abs(c.diferenciaKWh).toFixed(2);
      const porcentaje = c.diferenciaPorcentaje === null ? '' :
        ' (' + signo + Math.abs(c.diferenciaPorcentaje).toFixed(1) + ' %)';
      const explicacion = c.diferenciaKWh >= 0
        ? 'Hay <strong>' + magnitud + ' kWh/día</strong> que el equipo midió y tus aparatos registrados no explican: pueden ser cargas que no anotaste o que consumen más de lo supuesto.'
        : 'Tus aparatos registrados suman <strong>' + magnitud + ' kWh/día</strong> más de lo que el equipo midió: probablemente alguno no se usa tantas horas como se supuso.';
      avisoComparacion.innerHTML =
        'Estimado ' + c.EdEstimada.toFixed(2) + ' kWh/día · Medido ' + c.EdMedida.toFixed(2) +
        ' kWh/día' + porcentaje + '. ' + explicacion;
      avisoComparacion.hidden = false;
    } else {
      avisoComparacion.hidden = true;
    }
  }

  function renderizarIndicadores(r) {
    const grid = document.getElementById('indicadoresGrid');
    const potenciaInstalada = (r.potenciaInstaladaW === null || r.potenciaInstaladaW === undefined)
      ? ['Potencia instalada', '—', 'requiere el cuadro de cargas']
      : ['Potencia instalada', r.potenciaInstaladaW.toFixed(1) + ' W', '(' + (r.potenciaInstaladaW / 1000).toFixed(2) + ' kW)'];
    const items = [
      potenciaInstalada,
      ['Demanda máxima', r.demandaMaximaW.toFixed(1) + ' W', '(' + (r.demandaMaximaW / 1000).toFixed(2) + ' kW) · h=' + String(r.horaDemandaMaximaH).padStart(2, '0') + ':00'],
      ['Energía diaria', r.energiaDiariaKWh.toFixed(2) + ' kWh', 'por día'],
      ['Energía mensual', r.energiaMensualKWh.toFixed(1) + ' kWh', 'por mes'],
      ['Energía anual', r.energiaAnualKWh.toFixed(1) + ' kWh', 'por año'],
    ];
    grid.innerHTML = items.map(([label, val, sub]) => `
      <div class="indicador-card">
        <div class="label">${label}</div>
        <div class="value">${val}</div>
        <div class="sub">${sub}</div>
      </div>
    `).join('');
  }

  function renderizarGrafica(perfil) {
    const svg = document.getElementById('graficoPerfil');
    const W = 900, H = 320, padL = 55, padB = 34, padT = 10, padR = 10;
    const anchoGrafico = W - padL - padR;
    const altoGrafico = H - padT - padB;
    const escala = M.calcularEscalaEjeY(Math.max(...perfil, 1));
    const anchoBarra = anchoGrafico / 24 * 0.72;
    const pasoX = anchoGrafico / 24;

    let svgContent = '';

    // Líneas de referencia con marcas redondas (0, 200, 400...): así cada
    // rótulo corresponde exactamente a la altura de su línea.
    escala.marcas.forEach(valor => {
      const y = padT + altoGrafico - (valor / escala.maximo) * altoGrafico;
      svgContent += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="#ece2d6" stroke-width="1"/>`;
      svgContent += `<text x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-family="IBM Plex Mono" font-size="11" fill="#6b6058">${valor}</text>`;
    });

    // Barras
    perfil.forEach((valor, h) => {
      const alturaBarra = (valor / escala.maximo) * altoGrafico;
      const x = padL + h * pasoX + (pasoX - anchoBarra) / 2;
      const y = padT + altoGrafico - alturaBarra;
      svgContent += `<rect class="barra" data-hora="${h}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${anchoBarra.toFixed(1)}" height="${alturaBarra.toFixed(1)}" fill="#e08a52" rx="2"/>`;
      if (h % 2 === 0) {
        svgContent += `<text x="${(x + anchoBarra / 2).toFixed(1)}" y="${H - padB + 18}" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" fill="#6b6058">${h}</text>`;
      }
    });

    svgContent += `<text x="${W/2}" y="${H - 2}" text-anchor="middle" font-family="Inter" font-size="12" fill="#6b6058">Hora del día</text>`;
    svgContent += `<text x="14" y="${H/2}" text-anchor="middle" font-family="Inter" font-size="12" fill="#6b6058" transform="rotate(-90 14 ${H/2})">Potencia [W]</text>`;

    // Zonas transparentes que cubren TODA la columna de cada hora: permiten
    // mostrar el valor exacto aunque la barra sea muy baja. Van al final para
    // quedar por encima de las barras y recibir el puntero.
    perfil.forEach((valor, h) => {
      const x = padL + h * pasoX;
      svgContent += `<rect class="barra-hit" data-hora="${h}" data-valor="${valor}" x="${x.toFixed(1)}" y="${padT}" width="${pasoX.toFixed(1)}" height="${altoGrafico}" fill="transparent" pointer-events="all"/>`;
    });

    svg.innerHTML = svgContent;
    ocultarTooltipGrafica();
  }

  // TOOLTIP DE LA GRÁFICA: muestra el valor exacto de la hora señalada, útil
  // cuando la barra cae entre dos marcas del eje Y (ej. 435 W entre 400 y 600).
  const svgGrafica = document.getElementById('graficoPerfil');
  const tooltipGrafica = document.getElementById('tooltipGrafico');

  function ocultarTooltipGrafica() {
    if (!tooltipGrafica || !svgGrafica) return;
    tooltipGrafica.hidden = true;
    Array.from(svgGrafica.querySelectorAll('rect.barra.is-hover'))
      .forEach(barra => barra.classList.remove('is-hover'));
  }

  function mostrarTooltipGrafica(zona) {
    const hora = Number(zona.dataset.hora);
    const valor = Number(zona.dataset.valor);

    Array.from(svgGrafica.querySelectorAll('rect.barra.is-hover'))
      .forEach(barra => barra.classList.remove('is-hover'));
    const barra = svgGrafica.querySelector('rect.barra[data-hora="' + hora + '"]');
    if (barra) barra.classList.add('is-hover');

    tooltipGrafica.innerHTML =
      '<span class="tooltip-hora">' + String(hora).padStart(2, '0') + ':00 h</span>' +
      '<span class="tooltip-valor">' + valor.toFixed(1) + ' W</span>';
    tooltipGrafica.hidden = false;

    // Posición en píxeles reales: el SVG se escala con el ancho de la pantalla,
    // así que se toma la geometría ya renderizada de la barra.
    const contenedor = tooltipGrafica.parentElement.getBoundingClientRect();
    const caja = (barra || zona).getBoundingClientRect();
    const anchoTooltip = tooltipGrafica.offsetWidth;
    let x = caja.left + caja.width / 2 - contenedor.left;
    if (contenedor.width > anchoTooltip) {
      x = Math.min(Math.max(x, anchoTooltip / 2 + 2), contenedor.width - anchoTooltip / 2 - 2);
    }
    tooltipGrafica.style.left = x.toFixed(1) + 'px';
    tooltipGrafica.style.top = (caja.top - contenedor.top).toFixed(1) + 'px';
  }

  if (svgGrafica && tooltipGrafica) {
    const alSenalar = (evento) => {
      const zona = evento.target && evento.target.closest ? evento.target.closest('rect.barra-hit') : null;
      if (zona) mostrarTooltipGrafica(zona);
      else ocultarTooltipGrafica();
    };
    svgGrafica.addEventListener('pointermove', alSenalar);
    svgGrafica.addEventListener('pointerdown', alSenalar); // toque en móvil/tablet
    svgGrafica.addEventListener('pointerleave', ocultarTooltipGrafica);
    svgGrafica.addEventListener('pointercancel', ocultarTooltipGrafica);
  }

  //INFORME
  
  document.getElementById('btnGenerarInforme').addEventListener('click', () => {
    if (!estado.resultados) {
      mostrarEstado('estadoInforme', 'Primero calcule los resultados en el Paso 3.', 'error');
      return;
    }
    try {
      generarInformePDF(estado.proyecto, estado.resultados, estado.parametros, estado.generador);
      const sinJustificacion = estado.generador && estado.generador.seleccion && !estado.generador.justificacionGrupo;
      mostrarEstado('estadoInforme', 'Informe descargado como PDF.' +
        (sinJustificacion ? ' Nota: el informe no incluye la justificación técnica del criterio; puede registrarse en el Paso 4 y generarse nuevamente.' : ''), 'ok');
    } catch (err) {
      mostrarEstado('estadoInforme', 'Error al generar el informe: ' + err.message, 'error');
    }
  });

  // Generar 24 checkboxes ya se hizo arriba; inicializar tabla vacía
  actualizarTablaCargas();

  // Exponer generarInformePDF definido en informe.js
  window.__estadoAppReto01 = estado; // útil para depuración/pruebas
})();
