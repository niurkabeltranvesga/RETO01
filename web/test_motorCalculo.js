
const {
    crearCarga, clasificarCarga, calcularResultadosProyecto,
    calcularDemandaMaxima, calcularHoraDemandaMaxima, calcularEnergiaDiaria,
    calcularProyeccionConsumo, calcularCostos, encontrarCargaDuplicada,
    formatoHorarioCompacto, calcularEscalaEjeY,
} = require('../motorCalculo');

function assert(cond, msg) {
    if (!cond) throw new Error('FALLÓ: ' + msg);
    console.log('  OK: ' + msg);
}

function horarioDesdeHoras(horasActivas) {
    const h = new Array(24).fill(0);
    horasActivas.forEach(hr => { h[hr] = 1; });
    return h;
}

console.log('=== CASO 1: Carga exclusivamente diurna ===');
{
    const horario = horarioDesdeHoras([8,9,10,11,12,13,14,15,16]); // 9 horas
    const carga = crearCarga('Ventilador oficina', 2, 150, horario);
    const clas = clasificarCarga(carga.horario, 6, 18);
    assert(clas === 'diurna', `clasificación diurna (obtuvo: ${clas})`);

    const proyecto = { cargas: [carga] };
    const params = { diasOperacionMes: 30, diasOperacionAnio: 360, costoUnitarioCU: 800 };
    const res = calcularResultadosProyecto(proyecto, params);
    console.log(`  Pinst=${res.potenciaInstaladaW} Pmax=${res.demandaMaximaW} Ed=${res.energiaDiariaKWh}`);
    assert(res.potenciaInstaladaW === 300, 'Pinst = 300 W');
    assert(res.demandaMaximaW === 300, 'Pmax = 300 W');
    assert(Math.abs(res.energiaDiariaKWh - 2.7) < 1e-9, 'Ed = 2.70 kWh/día');
}

console.log('\n=== CASO 2: Carga exclusivamente nocturna (cruza medianoche) ===');
{
    const horario = horarioDesdeHoras([19,20,21,22,23,0,1,2,3,4]); // 10 horas
    const carga = crearCarga('Luminaria exterior', 4, 60, horario);
    const clas = clasificarCarga(carga.horario, 6, 18);
    assert(clas === 'nocturna', `clasificación nocturna (obtuvo: ${clas})`);

    const proyecto = { cargas: [carga] };
    const params = { diasOperacionMes: 30, diasOperacionAnio: 360, costoUnitarioCU: 800 };
    const res = calcularResultadosProyecto(proyecto, params);
    console.log(`  Pinst=${res.potenciaInstaladaW} Pmax=${res.demandaMaximaW} Ed=${res.energiaDiariaKWh}`);
    assert(res.potenciaInstaladaW === 240, 'Pinst = 240 W');
    assert(res.demandaMaximaW === 240, 'Pmax = 240 W');
    assert(Math.abs(res.energiaDiariaKWh - 2.4) < 1e-9, 'Ed = 2.40 kWh/día');
}

console.log('\n=== CASO 3: Mixta, simultaneidad y cruce de medianoche ===');
{
    const horarioNevera = new Array(24).fill(1); // 24h
    const cargaNevera = crearCarga('Nevera', 1, 120, horarioNevera);

    const horarioAire = horarioDesdeHoras([14,15,16,17,18,19,20,21,22]); // 9 horas
    const cargaAire = crearCarga('Aire acondicionado', 1, 1200, horarioAire);

    const clasNevera = clasificarCarga(cargaNevera.horario, 6, 18);
    const clasAire = clasificarCarga(cargaAire.horario, 6, 18);
    assert(clasNevera === 'mixta', `nevera mixta (obtuvo: ${clasNevera})`);
    assert(clasAire === 'mixta', `aire mixta (obtuvo: ${clasAire})`);

    const proyecto = { cargas: [cargaNevera, cargaAire] };
    const params = { diasOperacionMes: 30, diasOperacionAnio: 360, costoUnitarioCU: 800 };
    const res = calcularResultadosProyecto(proyecto, params);
    console.log(`  Pinst=${res.potenciaInstaladaW} Pmax=${res.demandaMaximaW} Ed=${res.energiaDiariaKWh}`);
    assert(res.potenciaInstaladaW === 1320, 'Pinst = 1320 W');
    assert(res.demandaMaximaW === 1320, 'Pmax = 1320 W (simultaneidad)');
    const EdEsperada = (120*24 + 1200*9) / 1000;
    assert(Math.abs(res.energiaDiariaKWh - EdEsperada) < 1e-9, `Ed = ${EdEsperada.toFixed(2)} kWh/día`);
}

console.log('\n=== CASO 4 (extra): 8 cargas, mismo caso usado en el informe MATLAB ===');
{
    const sh = horarioDesdeHoras;
    const cargas = [
        crearCarga('nevera', 1, 150, new Array(24).fill(1)),
        crearCarga('tv', 1, 120, sh([19,20,21,22])),
        crearCarga('aire', 1, 1200, sh([22,23,0,1,2,3,4,5])),
        crearCarga('luces interiores', 1, 300, sh([18,19,20,21,22,23,0,1,2,3,4,5])),
        crearCarga('motobomba', 1, 750, sh([6,7])),
        crearCarga('lavadora', 2, 500, sh([8,9])),
        crearCarga('computador', 1, 200, sh([8,9,10,11,12,13,14,15,16,17])),
        crearCarga('ducha electrica', 1, 1500, sh([6])),
    ];
    const proyecto = { cargas };
    const params = { diasOperacionMes: 30, diasOperacionAnio: 360, costoUnitarioCU: 800 };
    const res = calcularResultadosProyecto(proyecto, params);
    console.log(`  Pinst=${res.potenciaInstaladaW} Pmax=${res.demandaMaximaW} Ed=${res.energiaDiariaKWh.toFixed(2)} CostoDiario=${res.costoDiario}`);
    assert(res.potenciaInstaladaW === 5220, 'Pinst = 5220 W (igual que MATLAB)');
    assert(res.demandaMaximaW === 2400, 'Pmax = 2400 W (igual que MATLAB)');
    assert(Math.abs(res.energiaDiariaKWh - 24.28) < 1e-9, 'Ed = 24.28 kWh/día (igual que MATLAB)');
    assert(Math.abs(res.costoDiario - 19424) < 1e-6, 'Costo diario = $19424 (igual que MATLAB)');
}

console.log('\n=== CASO 5: Perfil de referencia de la evaluación (Alta Guajira, Parte B) ===');
{
    // Perfil horario [W] tal como lo reporta el concepto de evaluación del Reto 01:
    // Pmax = 910 W en h = 17, Ed = 7,580 kWh/día, CU = 1200, 30 días/mes, 365 días/año.
    const perfil = [240,240,240,240,160,160,790,160,510,390,435,435,85,85,435,435,510,910,160,160,160,160,240,240];

    const demandaMaximaW = calcularDemandaMaxima(perfil);
    const horaDemandaMaximaH = calcularHoraDemandaMaxima(perfil);
    const energiaDiariaKWh = calcularEnergiaDiaria(perfil);
    assert(demandaMaximaW === 910, 'Demanda máxima = 910 W (referencia del evaluador)');
    assert(horaDemandaMaximaH === 17, 'Hora de la demanda máxima = 17 (referencia del evaluador)');
    assert(Math.abs(energiaDiariaKWh - 7.580) < 1e-9, 'Energía diaria = 7,580 kWh/día (referencia del evaluador)');

    const { Em, Ea } = calcularProyeccionConsumo(energiaDiariaKWh, 30, 365);
    assert(Math.abs(Em - 227.400) < 1e-9, 'Energía mensual = 227,400 kWh/mes (referencia del evaluador)');
    assert(Math.abs(Ea - 2766.700) < 1e-9, 'Energía anual = 2 766,700 kWh/año (referencia del evaluador)');

    const costos = calcularCostos(energiaDiariaKWh, Em, Ea, 1200);
    assert(Math.abs(costos.costoDiario - 9096) < 1e-6, 'Costo diario = $9096 (referencia del evaluador)');
    assert(Math.abs(costos.costoMensual - 272880) < 1e-6, 'Costo mensual = $272880 (referencia del evaluador)');
    assert(Math.abs(costos.costoAnual - 3320040) < 1e-6, 'Costo anual = $3320040 (referencia del evaluador)');
    assert(costos.advertenciaCU0 === false, 'CU=1200 no debe activar la advertencia de CU=0');
}

console.log('\n=== CASO 6: Advertencia cuando CU = 0 (hallazgo transversal del curso) ===');
{
    const costos = calcularCostos(7.58, 227.4, 2766.7, 0);
    assert(costos.costoDiario === 0 && costos.costoMensual === 0 && costos.costoAnual === 0, 'Costos en 0 cuando CU = 0');
    assert(costos.advertenciaCU0 === true, 'La advertencia de CU=0 debe activarse para que la interfaz avise al usuario');
}

console.log('\n=== CASO 7: Detección de cargas duplicadas (RF-09) ===');
{
    const horarioA = horarioDesdeHoras([19, 20, 21, 22]);
    const cargas = [crearCarga('Nevera', 1, 150, horarioA)];

    const idxIgual = encontrarCargaDuplicada(cargas, '  nevera  ', 150, horarioA);
    assert(idxIgual === 0, 'Detecta duplicado con misma descripción (sin importar mayúsculas/espacios), potencia y horario');

    const idxPotenciaDistinta = encontrarCargaDuplicada(cargas, 'Nevera', 200, horarioA);
    assert(idxPotenciaDistinta === -1, 'No marca duplicado si la potencia unitaria es distinta');

    const horarioB = horarioDesdeHoras([6, 7]);
    const idxHorarioDistinto = encontrarCargaDuplicada(cargas, 'Nevera', 150, horarioB);
    assert(idxHorarioDistinto === -1, 'No marca duplicado si el horario es distinto');

    const idxExcluyendoPropia = encontrarCargaDuplicada(cargas, 'Nevera', 150, horarioA, 0);
    assert(idxExcluyendoPropia === -1, 'Al editar una carga, se excluye su propio índice de la búsqueda de duplicados');
}

console.log('\n=== CASO 8: Formato compacto del horario (informe y cuadro de cargas) ===');
{
    assert(formatoHorarioCompacto(new Array(24).fill(1)) === '00-23 (todo el día)', 'Carga activa las 24 horas');
    assert(formatoHorarioCompacto(horarioDesdeHoras([8,9,10,11,12,13,14,15,16])) === '08-16', 'Rango diurno contiguo');
    assert(formatoHorarioCompacto(horarioDesdeHoras([6])) === '06:00', 'Una sola hora activa');
    assert(formatoHorarioCompacto(horarioDesdeHoras([22,23,0,1,2,3,4,5])) === '22-05', 'Rango que cruza la medianoche se fusiona en un solo tramo');
    assert(formatoHorarioCompacto(horarioDesdeHoras([8,9,14,15,16])) === '08-09, 14-16', 'Dos tramos separados sin cruce de medianoche');
}

console.log('\n=== CASO 9: Escala redonda del eje Y de la gráfica ===');
{
    const e910 = calcularEscalaEjeY(910); // caso de referencia del evaluador
    assert(e910.marcas.join(',') === '0,200,400,600,800,1000', 'Pmax=910 W -> marcas 0,200,...,1000 (obtuvo: ' + e910.marcas.join(',') + ')');

    const e2400 = calcularEscalaEjeY(2400); // caso de 8 cargas
    assert(e2400.marcas.join(',') === '0,500,1000,1500,2000,2500', 'Pmax=2400 W -> marcas 0,500,...,2500');

    const e150 = calcularEscalaEjeY(150);
    assert(e150.maximo === 150 && e150.marcas.join(',') === '0,50,100,150', 'Pmax=150 W -> escala exacta 0,50,100,150');

    // Invariantes que deben cumplirse para cualquier valor
    [1, 85, 300, 437, 910, 1200, 5220, 12345].forEach(v => {
        const e = calcularEscalaEjeY(v);
        assert(e.maximo >= v, 'La escala cubre el valor máximo (' + v + ' W <= ' + e.maximo + ')');
        assert(e.marcas[0] === 0, 'La escala arranca en 0 para ' + v + ' W');
        assert(e.marcas[e.marcas.length - 1] === e.maximo, 'La última marca es el tope de la escala para ' + v + ' W');
    });
}

console.log('\n=== TODAS LAS PRUEBAS PASARON: el motor JS da los MISMOS resultados que MATLAB ===');
