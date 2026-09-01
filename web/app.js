
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
  };

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

        actualizarTablaCargas();
        calcularResultados(true);

        mostrarEstado('estadoArchivo', 'Proyecto cargado desde: ' + archivo.name, 'ok');
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

  document.getElementById('btnAgregarCarga').addEventListener('click', () => {
    try {
      const desc = document.getElementById('descCarga').value;
      const cant = Number(document.getElementById('cantCarga').value);
      const pot = Number(document.getElementById('potCarga').value);
      const horario = leerHorarioSeleccionado();

      const nuevaCarga = M.crearCarga(desc, cant, pot, horario);
      estado.listaCargas.push(nuevaCarga);
      actualizarTablaCargas();

      document.getElementById('descCarga').value = '';
      document.getElementById('cantCarga').value = 1;
      document.getElementById('potCarga').value = 100;
      limpiarHorarioSeleccionado();

      mostrarEstado('estadoCarga', 'Carga agregada correctamente.', 'ok');
    } catch (err) {
      mostrarEstado('estadoCarga', 'Error: ' + err.message, 'error');
    }
  });

  document.getElementById('btnEliminarCarga').addEventListener('click', () => {
    if (estado.filaSeleccionada === null) {
      mostrarEstado('estadoCarga', 'Seleccione primero una fila de la tabla para eliminar.', 'error');
      return;
    }
    estado.listaCargas.splice(estado.filaSeleccionada, 1);
    estado.filaSeleccionada = null;
    actualizarTablaCargas();
    mostrarEstado('estadoCarga', 'Carga eliminada.', 'ok');
  });

  function actualizarTablaCargas() {
    const cuerpo = document.getElementById('cuerpoTablaCargas');
    cuerpo.innerHTML = '';
    estado.listaCargas.forEach((c, i) => {
      const clasificacion = M.clasificarCarga(c.horario, estado.parametros.horaInicioDia, estado.parametros.horaFinDia);
      const horasUso = c.horario.reduce((a, b) => a + b, 0);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="fila-check"><input type="radio" name="filaCarga" ${estado.filaSeleccionada === i ? 'checked' : ''}></td>
        <td>${i + 1}</td>
        <td>${escapeHtml(c.descripcion)}</td>
        <td>${c.cantidad}</td>
        <td>${c.potenciaUnitariaW}</td>
        <td>${c.potenciaTotalW}</td>
        <td>${horasUso}</td>
        <td>${clasificacion}</td>
      `;
      tr.addEventListener('click', () => {
        estado.filaSeleccionada = (estado.filaSeleccionada === i) ? null : i;
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

  //RESULTADOS
  
  document.getElementById('btnCalcular').addEventListener('click', () => calcularResultados(false));

  function calcularResultados(silencioso) {
    if (!estado.proyecto) {
      if (!silencioso) mostrarEstado('estadoResultados', 'Primero guarde los datos del proyecto en el Paso 1.', 'error');
      return;
    }
    if (estado.listaCargas.length === 0) {
      if (!silencioso) mostrarEstado('estadoResultados', 'Agregue al menos una carga en el Paso 2.', 'error');
      return;
    }

    estado.parametros.diasOperacionMes = Number(document.getElementById('diasMes').value);
    estado.parametros.diasOperacionAnio = Number(document.getElementById('diasAnio').value);
    estado.parametros.costoUnitarioCU = Number(document.getElementById('costoUnitario').value);
    estado.parametros.horaInicioDia = Number(document.getElementById('horaInicioDia').value);
    estado.parametros.horaFinDia = Number(document.getElementById('horaFinDia').value);

    try {
      estado.proyecto.cargas = estado.listaCargas;
      estado.resultados = M.calcularResultadosProyecto(estado.proyecto, estado.parametros);

      renderizarIndicadores(estado.resultados);
      renderizarGrafica(estado.resultados.perfilHorarioW);
      actualizarTablaCargas(); // refresca clasificación por si cambió el criterio día/noche

      mostrarEstado('estadoResultados', 'Resultados calculados correctamente.', 'ok');
    } catch (err) {
      mostrarEstado('estadoResultados', 'Error: ' + err.message, 'error');
    }
  }

  function renderizarIndicadores(r) {
    const grid = document.getElementById('indicadoresGrid');
    const items = [
      ['Potencia instalada', r.potenciaInstaladaW.toFixed(1) + ' W', '(' + (r.potenciaInstaladaW / 1000).toFixed(2) + ' kW)'],
      ['Demanda máxima', r.demandaMaximaW.toFixed(1) + ' W', '(' + (r.demandaMaximaW / 1000).toFixed(2) + ' kW)'],
      ['Energía diaria', r.energiaDiariaKWh.toFixed(2) + ' kWh', 'por día'],
      ['Energía mensual', r.energiaMensualKWh.toFixed(1) + ' kWh', 'por mes'],
      ['Energía anual', r.energiaAnualKWh.toFixed(0) + ' kWh', 'por año'],
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
    const maxValor = Math.max(...perfil, 1);
    const anchoBarra = anchoGrafico / 24 * 0.72;
    const pasoX = anchoGrafico / 24;

    let svgContent = '';

    // Líneas de referencia 
    const nLineas = 5;
    for (let i = 0; i <= nLineas; i++) {
      const y = padT + altoGrafico - (i / nLineas) * altoGrafico;
      const valor = Math.round((i / nLineas) * maxValor / 10) * 10;
      svgContent += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#ece2d6" stroke-width="1"/>`;
      svgContent += `<text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-family="IBM Plex Mono" font-size="11" fill="#6b6058">${valor}</text>`;
    }

    // Barras
    perfil.forEach((valor, h) => {
      const alturaBarra = maxValor > 0 ? (valor / maxValor) * altoGrafico : 0;
      const x = padL + h * pasoX + (pasoX - anchoBarra) / 2;
      const y = padT + altoGrafico - alturaBarra;
      svgContent += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${anchoBarra.toFixed(1)}" height="${alturaBarra.toFixed(1)}" fill="#e08a52" rx="2"/>`;
      if (h % 2 === 0) {
        svgContent += `<text x="${(x + anchoBarra / 2).toFixed(1)}" y="${H - padB + 18}" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" fill="#6b6058">${h}</text>`;
      }
    });

    svgContent += `<text x="${W/2}" y="${H - 2}" text-anchor="middle" font-family="Inter" font-size="12" fill="#6b6058">Hora del día</text>`;
    svgContent += `<text x="14" y="${H/2}" text-anchor="middle" font-family="Inter" font-size="12" fill="#6b6058" transform="rotate(-90 14 ${H/2})">Potencia [W]</text>`;

    svg.innerHTML = svgContent;
  }

  //INFORME
  
  document.getElementById('btnGenerarInforme').addEventListener('click', () => {
    if (!estado.resultados) {
      mostrarEstado('estadoInforme', 'Primero calcule los resultados en el Paso 3.', 'error');
      return;
    }
    try {
      generarInformePDF(estado.proyecto, estado.resultados, estado.parametros);
      mostrarEstado('estadoInforme', 'Informe descargado como PDF.', 'ok');
    } catch (err) {
      mostrarEstado('estadoInforme', 'Error al generar el informe: ' + err.message, 'error');
    }
  });

  // Generar 24 checkboxes ya se hizo arriba; inicializar tabla vacía
  actualizarTablaCargas();

  // Exponer generarInformePDF definido en informe.js
  window.__estadoAppReto01 = estado; // útil para depuración/pruebas
})();
