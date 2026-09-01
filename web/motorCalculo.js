// motorCalculo.js

//validación de una carga
function validarCarga(descripcion, cantidad, potenciaUnitariaW, horario) {
    if (!descripcion || descripcion.trim() === '') {
        return { esValido: false, mensaje: 'La descripción de la carga no puede estar vacía.' };
    }
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
        return { esValido: false, mensaje: 'La cantidad debe ser un número entero mayor que cero.' };
    }
    if (typeof potenciaUnitariaW !== 'number' || isNaN(potenciaUnitariaW) || potenciaUnitariaW <= 0) {
        return { esValido: false, mensaje: 'La potencia unitaria (W) debe ser mayor que cero.' };
    }
    if (!Array.isArray(horario) || horario.length !== 24) {
        return { esValido: false, mensaje: 'El horario debe tener exactamente 24 valores (uno por cada hora, 0 a 23).' };
    }
    if (!horario.every(v => v === 0 || v === 1)) {
        return { esValido: false, mensaje: 'El horario solo admite valores 0 (apagado) o 1 (encendido) por hora.' };
    }
    if (horario.every(v => v === 0)) {
        return { esValido: false, mensaje: 'La carga no tiene ninguna hora de uso activa. Verifique el horario.' };
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
    };
}

//  Orquestador único para garantizar similitud con MATLAB
function calcularResultadosProyecto(proyecto, parametros) {
    if (!proyecto.cargas || proyecto.cargas.length === 0) {
        throw new Error('El proyecto no tiene cargas registradas.');
    }
    const horaInicioDia = parametros.horaInicioDia ?? 6;
    const horaFinDia = parametros.horaFinDia ?? 18;

    if (!('diasOperacionMes' in parametros) || !('diasOperacionAnio' in parametros) || !('costoUnitarioCU' in parametros)) {
        throw new Error('Debe indicar días de operación (mes y año) y el costo unitario CU.');
    }

    const cargas = proyecto.cargas;
    const potenciaInstaladaW = calcularPotenciaInstalada(cargas);
    const perfilHorarioW = calcularPerfilHorario(cargas);
    const demandaMaximaW = calcularDemandaMaxima(perfilHorarioW);
    const energiaDiariaKWh = calcularEnergiaDiaria(perfilHorarioW);
    const { Em, Ea } = calcularProyeccionConsumo(energiaDiariaKWh, parametros.diasOperacionMes, parametros.diasOperacionAnio);
    const { costoDiario, costoMensual, costoAnual } = calcularCostos(energiaDiariaKWh, Em, Ea, parametros.costoUnitarioCU);

    const clasificacionCargas = cargas.map(c => clasificarCarga(c.horario, horaInicioDia, horaFinDia));

    
    const EdVerificacion = perfilHorarioW.reduce((a, b) => a + b, 0) / 1000;
    if (Math.abs(energiaDiariaKWh - EdVerificacion) > 1e-9) {
        throw new Error('Inconsistencia interna entre perfil horario y energía diaria.');
    }

    return {
        potenciaInstaladaW,
        demandaMaximaW,
        perfilHorarioW,
        energiaDiariaKWh,
        energiaMensualKWh: Em,
        energiaAnualKWh: Ea,
        costoDiario,
        costoMensual,
        costoAnual,
        clasificacionCargas,
    };
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
    calcularPerfilHorario, calcularDemandaMaxima, calcularEnergiaDiaria,
    calcularProyeccionConsumo, calcularCostos, calcularResultadosProyecto,
};

// Compatible con Node.js (pruebas con `require`) y con el navegador (script
// plano, sin bundler): en el navegador queda disponible como `window.MotorCalculo`.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MotorCalculo;
}
if (typeof window !== 'undefined') {
    window.MotorCalculo = MotorCalculo;
}

