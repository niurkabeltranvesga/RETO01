
const {
    crearCarga, clasificarCarga, calcularResultadosProyecto,
} = require('./motorCalculo');

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

console.log('\n=== TODAS LAS PRUEBAS PASARON: el motor JS da los MISMOS resultados que MATLAB ===');
