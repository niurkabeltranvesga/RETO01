// motorCalculo.js

//validación de una carga
function validarCarga(descripcion, cantidad, potenciaUnitariaW, horario) {
    if (!descripcion || descripcion.trim() === '') {
        return { esValido: false, mensaje: 'La descripción de la carga no puede estar vacía.' };
    }
    if (typeof cantidad !== 'number' || isNaN(cantidad)) {
        return { esValido: false, mensaje: 'Escriba la cantidad de aparatos iguales (un número entero, por ejemplo 1).' };
    }
    if (cantidad === 0) {
        return { esValido: false, mensaje: 'La cantidad no puede ser cero: escriba cuántos aparatos iguales hay (1 o más).' };
    }
    if (!Number.isInteger(cantidad) || cantidad < 0) {
        return { esValido: false, mensaje: 'La cantidad debe ser un número entero mayor que cero (se escribió ' + cantidad + ').' };
    }
    if (typeof potenciaUnitariaW !== 'number' || isNaN(potenciaUnitariaW)) {
        return { esValido: false, mensaje: 'Escriba la potencia de cada aparato en vatios (W).' };
    }
    if (potenciaUnitariaW < 0) {
        return { esValido: false, mensaje: 'La potencia no puede ser negativa (se escribió ' + potenciaUnitariaW + ' W). Escriba la potencia de placa del aparato.' };
    }
    if (potenciaUnitariaW === 0) {
        return { esValido: false, mensaje: 'La potencia unitaria (W) debe ser mayor que cero.' };
    }
    if (!Array.isArray(horario) || horario.length !== 24) {
        return { esValido: false, mensaje: 'El horario debe tener exactamente 24 valores (uno por cada hora, 0 a 23).' };
    }
    if (!horario.every(v => v === 0 || v === 1)) {
        return { esValido: false, mensaje: 'El horario solo admite valores 0 (apagado) o 1 (encendido) por hora.' };
    }
    if (horario.every(v => v === 0)) {
        return { esValido: false, mensaje: 'La carga no tiene ninguna hora de uso: marque las horas en la cuadrícula o use «Marcar franja».' };
    }
    return { esValido: true, mensaje: '' };
}

//crear una carga 
function crearCarga(descripcion, cantidad, potenciaUnitariaW, horario) {
    const { esValido, mensaje } = validarCarga(descripcion, cantidad, potenciaUnitariaW, horario);
    if (!esValido) {
        throw new Error(mensaje);
    }
    return {
        descripcion: descripcion.trim(),
        cantidad,
        potenciaUnitariaW,
        horario: horario.slice(),
        potenciaTotalW: cantidad * potenciaUnitariaW,
    };
}

//clasificación temporal 
function clasificarCarga(horario, horaInicioDia = 6, horaFinDia = 18) {
    let usaDia = false;
    let usaNoche = false;
    for (let h = 0; h < 24; h++) {
        const esHoraDiurna = (horaInicioDia < horaFinDia)
            ? (h >= horaInicioDia && h < horaFinDia)
            : (h >= horaInicioDia || h < horaFinDia);
        if (horario[h] === 1) {
            if (esHoraDiurna) usaDia = true;
            else usaNoche = true;
        }
    }
    if (usaDia && usaNoche) return 'mixta';
    if (usaDia) return 'diurna';
    return 'nocturna';
}

//potencia instalada
function calcularPotenciaInstalada(cargas) {
    return cargas.reduce((acc, c) => acc + c.potenciaTotalW, 0);
}

//perfil horario
function calcularPerfilHorario(cargas) {
    const perfil = new Array(24).fill(0);
    for (const c of cargas) {
        for (let h = 0; h < 24; h++) {
            perfil[h] += c.horario[h] * c.potenciaTotalW;
        }
    }
    return perfil;
}

//demanda máxima
function calcularDemandaMaxima(perfilHorario) {
    return Math.max(...perfilHorario);
}

//hora en la que ocurre la demanda máxima (primera hora en la que se alcanza el pico)
function calcularHoraDemandaMaxima(perfilHorario) {
    let horaMax = 0;
    let valorMax = perfilHorario[0];
    for (let h = 1; h < perfilHorario.length; h++) {
        if (perfilHorario[h] > valorMax) {
            valorMax = perfilHorario[h];
            horaMax = h;
        }
    }
    return horaMax;
}

//todas las horas en las que se alcanza la demanda máxima (la primera es la que se reporta)
function calcularHorasDemandaMaxima(perfilHorario) {
    const maximo = Math.max(...perfilHorario);
    const horas = [];
    perfilHorario.forEach((v, h) => { if (v === maximo) horas.push(h); });
    return horas;
}

//energía diaria
function calcularEnergiaDiaria(perfilHorario) {
    const deltaT = 1; // horas
    return perfilHorario.reduce((a, b) => a + b, 0) * deltaT / 1000;
}

//proyección de consumo
function calcularProyeccionConsumo(Ed, diasOperacionMes, diasOperacionAnio) {
    if (diasOperacionMes <= 0 || diasOperacionAnio <= 0) {
        throw new Error('Los días de operación (mes y año) deben ser mayores que cero.');
    }
    return {
        Em: Ed * diasOperacionMes,
        Ea: Ed * diasOperacionAnio,
    };
}

//costos
function calcularCostos(Ed, Em, Ea, CU) {
    if (CU < 0) {
        throw new Error('El costo unitario (CU) no puede ser negativo.');
    }
    return {
        costoDiario: Ed * CU,
        costoMensual: Em * CU,
        costoAnual: Ea * CU,
        // CU = 0 no es un error (puede ser un contexto sin tarifa), pero los
        // costos quedan en $0 y la interfaz debe advertirlo en vez de
        // mostrarlo en silencio.
        advertenciaCU0: CU === 0,
    };
}

//¿dos horarios de 24 valores son exactamente iguales?
function horariosIguales(horarioA, horarioB) {
    if (!Array.isArray(horarioA) || !Array.isArray(horarioB) || horarioA.length !== horarioB.length) {
        return false;
    }
    for (let h = 0; h < horarioA.length; h++) {
        if (horarioA[h] !== horarioB[h]) return false;
    }
    return true;
}

//detección de cargas duplicadas: misma descripción, potencia unitaria y horario.
//indiceExcluir permite ignorar la propia fila cuando se está editando una carga existente.
function encontrarCargaDuplicada(cargas, descripcion, potenciaUnitariaW, horario, indiceExcluir = -1) {
    const descripcionNormalizada = (descripcion || '').trim().toLowerCase();
    for (let i = 0; i < cargas.length; i++) {
        if (i === indiceExcluir) continue;
        const c = cargas[i];
        if (c.descripcion.trim().toLowerCase() === descripcionNormalizada &&
            c.potenciaUnitariaW === potenciaUnitariaW &&
            horariosIguales(c.horario, horario)) {
            return i;
        }
    }
    return -1;
}

//representación compacta del horario de una carga (rangos en vez de solo un conteo de horas),
//para que el informe y la interfaz muestren CUÁNDO se usa la carga y no solo cuántas horas.
//Maneja franjas discontinuas y el cruce de medianoche (ej. 22h-05h).
function formatoHorarioCompacto(horario) {
    if (!Array.isArray(horario) || horario.length !== 24) return '';
    const activos = new Set();
    for (let h = 0; h < 24; h++) if (horario[h] === 1) activos.add(h);
    if (activos.size === 0) return '—';
    if (activos.size === 24) return '00-23 (todo el día)';

    const rangos = [];
    let inicio = null;
    for (let h = 0; h <= 24; h++) {
        const activa = h < 24 && activos.has(h);
        if (activa && inicio === null) inicio = h;
        if (!activa && inicio !== null) {
            rangos.push([inicio, h - 1]);
            inicio = null;
        }
    }

    // Si el primer y el último bloque quedan separados solo por la
    // frontera 23h→00h, se fusionan como un único rango que cruza la
    // medianoche (ej. horas 22,23,0,1 -> "22-01", no "00-01, 22-23").
    if (rangos.length > 1 && rangos[0][0] === 0 && rangos[rangos.length - 1][1] === 23) {
        const primero = rangos.shift();
        const ultimo = rangos.pop();
        rangos.unshift([ultimo[0], primero[1]]);
    }

    const f = n => String(n).padStart(2, '0');
    return rangos.map(([a, b]) => (a === b ? `${f(a)}:00` : `${f(a)}-${f(b)}`)).join(', ');
}

//franjas de uso con hora de inicio y de fin, como se escriben en un cuadro
//de cargas: horas activas 8 a 19 -> "08:00–20:00"; 22,23,0..3 -> "22:00–04:00".
function formatoFranjas(horario) {
    if (!Array.isArray(horario) || horario.length !== 24) return '';
    if (horario.every(v => v === 0)) return '—';
    if (horario.every(v => v === 1)) return '00:00–24:00 (todo el día)';
    const rangos = [];
    let inicio = null;
    for (let h = 0; h <= 24; h++) {
        const activa = h < 24 && horario[h] === 1;
        if (activa && inicio === null) inicio = h;
        if (!activa && inicio !== null) { rangos.push([inicio, h]); inicio = null; }
    }
    if (rangos.length > 1 && rangos[0][0] === 0 && rangos[rangos.length - 1][1] === 24) {
        const primero = rangos.shift();
        const ultimo = rangos.pop();
        rangos.unshift([ultimo[0], primero[1]]);
    }
    const f = n => String(n).padStart(2, '0') + ':00';
    return rangos.map(([a, b]) => f(a) + '–' + f(b)).join(' y ');
}

//escala "redonda" para el eje Y de la gráfica de perfil horario: en vez de
//dividir el valor máximo en partes iguales (que da marcas como 182, 364, 546...),
//elige un paso legible (1, 2, 2.5, 5 o 10 por su potencia de diez) de modo que
//las marcas sean 0, 200, 400, 600... y cada rótulo coincida exactamente con su línea.
function calcularEscalaEjeY(maxValor, divisionesDeseadas = 5) {
    if (!(maxValor > 0) || !isFinite(maxValor)) {
        return { maximo: 1, paso: 1, marcas: [0, 1] };
    }
    const pasoCrudo = maxValor / divisionesDeseadas;
    const magnitud = Math.pow(10, Math.floor(Math.log10(pasoCrudo)));
    const normalizado = pasoCrudo / magnitud; // queda entre 1 y 10

    let multiplicador;
    if (normalizado <= 1.5) multiplicador = 1;
    else if (normalizado <= 2) multiplicador = 2;
    else if (normalizado <= 2.5) multiplicador = 2.5;
    else if (normalizado <= 5) multiplicador = 5;
    else multiplicador = 10;

    const paso = multiplicador * magnitud;
    const maximo = Math.ceil(maxValor / paso) * paso;
    const cantidad = Math.round(maximo / paso);
    const marcas = [];
    for (let i = 0; i <= cantidad; i++) {
        marcas.push(Number((i * paso).toFixed(6)));
    }
    return { maximo: Number(maximo.toFixed(6)), paso, marcas };
}

//comparación entre el perfil estimado (desde el cuadro de cargas) y el perfil
//medido por el equipo: dice cuánta energía quedó sin identificar.
function compararPerfiles(perfilEstimadoW, perfilMedidoW) {
    if (!Array.isArray(perfilEstimadoW) || !Array.isArray(perfilMedidoW)) return null;
    if (perfilEstimadoW.length !== 24 || perfilMedidoW.length !== 24) return null;

    const EdEstimada = calcularEnergiaDiaria(perfilEstimadoW);
    const EdMedida = calcularEnergiaDiaria(perfilMedidoW);
    const diferenciaKWh = EdMedida - EdEstimada;
    return {
        EdEstimada,
        EdMedida,
        diferenciaKWh,
        diferenciaPorcentaje: EdEstimada > 0 ? (diferenciaKWh / EdEstimada) * 100 : null,
        demandaMaximaEstimadaW: calcularDemandaMaxima(perfilEstimadoW),
        demandaMaximaMedidaW: calcularDemandaMaxima(perfilMedidoW),
        horaDemandaMaximaEstimadaH: calcularHoraDemandaMaxima(perfilEstimadoW),
        horaDemandaMaximaMedidaH: calcularHoraDemandaMaxima(perfilMedidoW),
    };
}

//  Orquestador único para garantizar similitud con MATLAB
//
//  El perfil horario puede venir de dos orígenes y el resto del cálculo es
//  idéntico en ambos casos: del cuadro de cargas (estimado, como siempre) o
//  de proyecto.perfilMedidoW, cuando el usuario cargó la hoja de datos del
//  equipo de medición. proyecto.fuentePerfil decide cuál se usa si hay ambos.
function calcularResultadosProyecto(proyecto, parametros) {
    const cargas = proyecto.cargas || [];
    const medido = proyecto.perfilMedidoW;
    const hayMedicion = Array.isArray(medido) && medido.length === 24;

    if (cargas.length === 0 && !hayMedicion) {
        throw new Error('El proyecto no tiene cargas registradas ni un perfil medido.');
    }
    const horaInicioDia = parametros.horaInicioDia ?? 6;
    const horaFinDia = parametros.horaFinDia ?? 18;

    if (!('diasOperacionMes' in parametros) || !('diasOperacionAnio' in parametros) || !('costoUnitarioCU' in parametros)) {
        throw new Error('Debe indicar días de operación (mes y año) y el costo unitario CU.');
    }

    const perfilEstimadoW = cargas.length > 0 ? calcularPerfilHorario(cargas) : null;
    const perfilMedidoW = hayMedicion ? medido.slice() : null;

    // Se usa el perfil medido salvo que el usuario pida explícitamente el
    // estimado (y haya cargas con las cuales estimarlo).
    const usarMedido = hayMedicion && (perfilEstimadoW === null || proyecto.fuentePerfil !== 'estimado');
    const fuentePerfil = usarMedido ? 'medido' : 'estimado';

    const potenciaInstaladaW = perfilEstimadoW !== null ? calcularPotenciaInstalada(cargas) : null;
    const perfilHorarioW = usarMedido ? perfilMedidoW : perfilEstimadoW;
    const demandaMaximaW = calcularDemandaMaxima(perfilHorarioW);
    const horaDemandaMaximaH = calcularHoraDemandaMaxima(perfilHorarioW);
    const horasDemandaMaximaH = calcularHorasDemandaMaxima(perfilHorarioW);
    const energiaDiariaKWh = calcularEnergiaDiaria(perfilHorarioW);
    const { Em, Ea } = calcularProyeccionConsumo(energiaDiariaKWh, parametros.diasOperacionMes, parametros.diasOperacionAnio);
    const { costoDiario, costoMensual, costoAnual, advertenciaCU0 } = calcularCostos(energiaDiariaKWh, Em, Ea, parametros.costoUnitarioCU);

    const clasificacionCargas = cargas.map(c => clasificarCarga(c.horario, horaInicioDia, horaFinDia));

    
    const EdVerificacion = perfilHorarioW.reduce((a, b) => a + b, 0) / 1000;
    if (Math.abs(energiaDiariaKWh - EdVerificacion) > 1e-9) {
        throw new Error('Inconsistencia interna entre perfil horario y energía diaria.');
    }

    return {
        potenciaInstaladaW,
        demandaMaximaW,
        horaDemandaMaximaH,
        horasDemandaMaximaH,
        perfilHorarioW,
        fuentePerfil,
        perfilEstimadoW,
        perfilMedidoW,
        comparacionPerfiles: (perfilEstimadoW && perfilMedidoW) ? compararPerfiles(perfilEstimadoW, perfilMedidoW) : null,
        energiaDiariaKWh,
        energiaMensualKWh: Em,
        energiaAnualKWh: Ea,
        costoDiario,
        costoMensual,
        costoAnual,
        advertenciaCU0,
        clasificacionCargas,
    };
}

//validación de los parámetros de operación: devuelve los errores (impiden
//calcular) y las advertencias (se calcula, pero se avisa al usuario)
function validarParametros(p) {
    const errores = [];
    const advertencias = [];
    const vacio = v => v === '' || v === null || v === undefined || (typeof v === 'number' && isNaN(v));
    if (vacio(p.diasOperacionMes)) errores.push('Escriba los días de operación al mes.');
    else if (!Number.isInteger(p.diasOperacionMes) || p.diasOperacionMes < 1 || p.diasOperacionMes > 31) errores.push('Los días de operación al mes deben ser un número entero entre 1 y 31.');
    if (vacio(p.diasOperacionAnio)) errores.push('Escriba los días de operación al año.');
    else if (!Number.isInteger(p.diasOperacionAnio) || p.diasOperacionAnio < 1 || p.diasOperacionAnio > 366) errores.push('Los días de operación al año deben ser un número entero entre 1 y 366.');
    if (vacio(p.costoUnitarioCU)) errores.push('Escriba el costo unitario de la energía (CU) en $/kWh. Si no aplica, escriba 0.');
    else if (p.costoUnitarioCU < 0) errores.push('El costo unitario (CU) no puede ser negativo.');
    else if (p.costoUnitarioCU === 0) advertencias.push('El costo unitario (CU) es 0: todos los costos saldrán en $ 0.');
    const horaValida = h => Number.isInteger(h) && h >= 0 && h <= 24;
    if (vacio(p.horaInicioDia) || vacio(p.horaFinDia)) errores.push('Escriba la hora de inicio y la hora de fin del día solar.');
    else if (!horaValida(p.horaInicioDia) || !horaValida(p.horaFinDia)) errores.push('Las horas del día solar deben ser números enteros entre 0 y 24.');
    else if (p.horaInicioDia >= p.horaFinDia) errores.push('El día solar está invertido: la hora de inicio (' + String(p.horaInicioDia).padStart(2, '0') + ':00) debe ser anterior a la hora de fin (' + String(p.horaFinDia).padStart(2, '0') + ':00).');
    if (!vacio(p.diasOperacionMes) && !vacio(p.diasOperacionAnio) && errores.length === 0 && p.diasOperacionMes * 12 < p.diasOperacionAnio - 12) {
        advertencias.push('Los días al mes (' + p.diasOperacionMes + ') y al año (' + p.diasOperacionAnio + ') no parecen coherentes entre sí; revíselos.');
    }
    return { errores, advertencias };
}

//convierte una franja "desde hh:00 hasta hh:00" en las horas activas del
//horario de 24 valores. La hora final no se incluye (08:00 a 20:00 son 12 h).
//Si la hora final es menor que la inicial, la franja cruza la medianoche.
function franjaAHorario(desde, hasta) {
    if (!Number.isInteger(desde) || !Number.isInteger(hasta) || desde < 0 || desde > 23 || hasta < 0 || hasta > 24) {
        throw new Error('Las horas de la franja deben ser enteras: inicio entre 0 y 23 y fin entre 0 y 24.');
    }
    const fin = hasta === 24 ? 0 : hasta;
    if (fin === desde) {
        throw new Error('La franja empieza y termina a la misma hora (' + String(desde).padStart(2, '0') + ':00): debe durar al menos una hora.');
    }
    const horario = new Array(24).fill(0);
    let h = desde;
    while (h !== fin) { horario[h] = 1; h = (h + 1) % 24; }
    return { horario, horas: horario.reduce((a, b) => a + b, 0), cruzaMedianoche: fin !== 0 && fin < desde };
}

//formato de números en español: coma decimal y punto de miles (3.942,5)
function formatoNumero(valor, decimales = 0) {
    const n = Number(valor);
    if (!isFinite(n)) return '—';
    const fijo = Math.abs(n).toFixed(decimales);
    const [entera, fraccion] = fijo.split('.');
    const conMiles = entera.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const negativo = n < 0 && Number(fijo) !== 0;
    return (negativo ? '-' : '') + conMiles + (fraccion ? ',' + fraccion : '');
}

//pesos colombianos sin decimales: $ 9.096
function formatoPesos(valor) {
    return '$ ' + formatoNumero(Math.round(Number(valor)), 0);
}

//crear proyecto
function crearProyecto(nombreProyecto, integrantes, fecha, contexto) {
    const contextosValidos = ['off-grid', 'on-grid', 'hibrido-off-grid', 'hibrido-on-grid'];
    if (!contextosValidos.includes((contexto || '').toLowerCase())) {
        throw new Error('El contexto debe ser uno de: off-grid, on-grid, hibrido-off-grid, hibrido-on-grid.');
    }
    if (!nombreProyecto || nombreProyecto.trim() === '') {
        throw new Error('El nombre/ID del proyecto no puede estar vacío.');
    }
    return {
        nombreProyecto: nombreProyecto.trim(),
        integrantes,
        fecha,
        contexto: contexto.toLowerCase(),
        cargas: [],
    };
}

const MotorCalculo = {
    crearProyecto,
    validarCarga, crearCarga, clasificarCarga, calcularPotenciaInstalada,
    calcularPerfilHorario, calcularDemandaMaxima, calcularHoraDemandaMaxima, calcularHorasDemandaMaxima,
    calcularEnergiaDiaria, calcularProyeccionConsumo, calcularCostos,
    calcularResultadosProyecto, horariosIguales, encontrarCargaDuplicada,
    formatoHorarioCompacto, formatoFranjas, calcularEscalaEjeY, compararPerfiles,
    validarParametros, franjaAHorario, formatoNumero, formatoPesos,
};

// Compatible con Node.js (pruebas con `require`) y con el navegador (script
// plano, sin bundler): en el navegador queda disponible como `window.MotorCalculo`.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MotorCalculo;
}
if (typeof window !== 'undefined') {
    window.MotorCalculo = MotorCalculo;
}

