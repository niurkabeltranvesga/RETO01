// test_medicion.js
//
// Pruebas del lector de la hoja de datos del nodo de medición (ESP32 + pinzas)
// y de su enganche con el motor de cálculo.

const Medicion = require('../medicion');
const {
    crearCarga, calcularResultadosProyecto, calcularEnergiaDiaria, compararPerfiles,
} = require('../motorCalculo');

function assert(cond, msg) {
    if (!cond) throw new Error('FALLÓ: ' + msg);
    console.log('  OK: ' + msg);
}

console.log('=== CASO 1: CSV sencillo, separado por comas ===');
{
    const csv = [
        'fecha_hora,potencia_w',
        '2026-10-02 00:00,1600',
        '2026-10-02 00:30,1700',
        '2026-10-02 06:00,2400',
    ].join('\n');
    const r = Medicion.perfilDesdeHojaDeDatos(csv);
    assert(r.totalLecturas === 3, 'Lee las 3 lecturas');
    assert(r.perfilW[0] === 1650, 'Promedia las dos lecturas de la hora 0 -> 1650 W');
    assert(r.perfilW[6] === 2400, 'La hora 6 queda en 2400 W');
    assert(r.horasSinDato.length === 22, 'Detecta las 22 horas sin lecturas');
    assert(r.avisos.length >= 1, 'Avisa de las horas sin dato');
}

console.log('\n=== CASO 2: CSV de Google Sheets en español (punto y coma, coma decimal) ===');
{
    const csv = [
        'Marca temporal;Potencia (W)',
        '02/10/2026 14:35:00;1.234,50',
        '02/10/2026 14:45:00;1.265,50',
    ].join('\r\n');
    const r = Medicion.perfilDesdeHojaDeDatos(csv);
    assert(r.perfilW[14] === 1250, 'Interpreta "1.234,50" y "1.265,50" y promedia 1250 W');
}

console.log('\n=== CASO 3: Varios días se promedian en el mismo perfil de 24 h ===');
{
    const csv = [
        'fecha_hora,potencia_w',
        '2026-10-01 10:00,1000',
        '2026-10-02 10:00,2000',
        '2026-10-03 10:00,3000',
    ].join('\n');
    const r = Medicion.perfilDesdeHojaDeDatos(csv);
    assert(r.perfilW[10] === 2000, 'Tres días a las 10:00 promedian 2000 W');
    assert(r.totalLecturas === 3, 'Cuenta las lecturas de todos los días');
}

console.log('\n=== CASO 4: Sin columna de potencia, se estima de corriente y voltaje ===');
{
    // El voltaje se mide entre líneas (220 V), así que cada rama está a V/2
    // respecto al neutro: P = (V/2)(I1+I2) sirve para cargas de 110 y de 220.
    const csv = [
        'fecha_hora,corriente_l1_a,corriente_l2_a,voltaje_v',
        '2026-10-02 08:00,5.0,5.0,220',
    ].join('\n');
    const r = Medicion.perfilDesdeHojaDeDatos(csv);
    assert(r.perfilW[8] === 1100, 'P = (220/2)(5+5) = 1100 W');
    assert(r.potenciaEstimada === true, 'Marca que la potencia fue estimada');
    assert(r.avisos.some(a => a.includes('aparente')), 'Advierte que es potencia aparente (VA) y no real (W)');
}

console.log('\n=== CASO 5: Formatos de fecha y hora que suelta cualquier hoja de cálculo ===');
{
    const casos = [
        ['2026-10-02T17:05:00', 17], ['02/10/2026 17:05', 17], ['2026-10-02 17:05:30', 17],
        ['5:05 p. m.', 17], ['5:05 a. m.', 5], ['12:30 a. m.', 0], ['17', 17], ['0', 0],
        ['2026-10-02', null], ['', null], ['texto cualquiera', null], ['25', null],
    ];
    casos.forEach(([texto, esperado]) => {
        const obtenido = Medicion.extraerHora(texto);
        assert(obtenido === esperado, `"${texto}" -> ${esperado === null ? 'sin hora' : esperado}`);
    });
}

console.log('\n=== CASO 6: JSON, tanto de lecturas como de perfil ya armado ===');
{
    const porLecturas = JSON.stringify([
        { hora: 9, potencia_w: 800 },
        { hora: 9, potencia_w: 1000 },
    ]);
    assert(Medicion.perfilDesdeHojaDeDatos(porLecturas).perfilW[9] === 900, 'JSON de lecturas: promedia 900 W en la hora 9');

    const perfil = new Array(24).fill(0).map((_, h) => h * 10);
    const directo = JSON.stringify({ perfilW: perfil });
    const r = Medicion.perfilDesdeHojaDeDatos(directo);
    assert(r.perfilW[23] === 230, 'JSON con perfilW de 24 valores se toma tal cual');
    assert(r.horasSinDato.length === 0, 'Un perfil ya armado no reporta horas faltantes');
}

console.log('\n=== CASO 7: Archivos inválidos se rechazan con un mensaje claro ===');
{
    const invalidos = [
        ['', 'archivo vacío'],
        ['   \n  ', 'solo espacios'],
        ['fecha_hora,potencia_w', 'encabezado sin filas'],
        ['columna_rara,otra\n1,2', 'sin columna de hora'],
        ['fecha_hora,algo\n2026-10-02 08:00,5', 'sin potencia ni corriente/voltaje'],
    ];
    invalidos.forEach(([contenido, descripcion]) => {
        let lanzo = false;
        try { Medicion.perfilDesdeHojaDeDatos(contenido); } catch (e) { lanzo = e.message.length > 10; }
        assert(lanzo, 'Rechaza con mensaje útil: ' + descripcion);
    });
}

console.log('\n=== CASO 8: Filas corruptas se descartan sin tumbar la lectura ===');
{
    const csv = [
        'fecha_hora,potencia_w',
        '2026-10-02 08:00,1000',
        'sin fecha,500',
        '2026-10-02 09:00,no es un numero',
        '2026-10-02 10:00,-30',
        '2026-10-02 08:00,2000',
    ].join('\n');
    const r = Medicion.perfilDesdeHojaDeDatos(csv);
    assert(r.totalLecturas === 2, 'Conserva solo las 2 lecturas válidas');
    assert(r.perfilW[8] === 1500, 'Promedia bien las que sí sirven');
    assert(r.filasDescartadas === 3, 'Cuenta las 3 filas descartadas');
    assert(r.avisos.some(a => a.includes('descartaron')), 'Lo informa al usuario');
}

console.log('\n=== CASO 9: El motor acepta el perfil medido sin romper lo anterior ===');
{
    const params = { diasOperacionMes: 30, diasOperacionAnio: 360, costoUnitarioCU: 800 };
    const cargas = [crearCarga('Nevera', 1, 150, new Array(24).fill(1))];
    const perfilMedido = new Array(24).fill(200);

    const soloCargas = calcularResultadosProyecto({ cargas }, params);
    assert(soloCargas.fuentePerfil === 'estimado', 'Sin medición, el perfil sigue siendo el estimado de siempre');
    assert(soloCargas.potenciaInstaladaW === 150, 'La potencia instalada se calcula igual que antes');
    assert(soloCargas.comparacionPerfiles === null, 'Sin medición no hay comparación');

    const soloMedicion = calcularResultadosProyecto({ cargas: [], perfilMedidoW: perfilMedido }, params);
    assert(soloMedicion.fuentePerfil === 'medido', 'Con solo medición se usa el perfil medido');
    assert(Math.abs(soloMedicion.energiaDiariaKWh - 4.8) < 1e-9, 'Ed = 4,80 kWh/día desde la medición');
    assert(soloMedicion.potenciaInstaladaW === null, 'Sin cuadro de cargas no hay potencia instalada que reportar');

    const ambos = calcularResultadosProyecto({ cargas, perfilMedidoW: perfilMedido }, params);
    assert(ambos.fuentePerfil === 'medido', 'Con ambos, manda la medición');
    assert(ambos.comparacionPerfiles !== null, 'Con ambos aparece la comparación');
    assert(Math.abs(ambos.comparacionPerfiles.diferenciaKWh - 1.2) < 1e-9, 'Diferencia medido − estimado = 1,20 kWh/día');

    const forzado = calcularResultadosProyecto({ cargas, perfilMedidoW: perfilMedido, fuentePerfil: 'estimado' }, params);
    assert(forzado.fuentePerfil === 'estimado', 'El usuario puede forzar el perfil estimado');
    assert(Math.abs(forzado.energiaDiariaKWh - 3.6) < 1e-9, 'Y entonces los resultados usan el estimado');
}

console.log('\n=== CASO 10: Se sigue impidiendo calcular sin ningún dato ===');
{
    const params = { diasOperacionMes: 30, diasOperacionAnio: 360, costoUnitarioCU: 800 };
    let lanzo = false;
    try { calcularResultadosProyecto({ cargas: [] }, params); } catch (e) { lanzo = true; }
    assert(lanzo, 'Sin cargas y sin medición sigue bloqueando (fortaleza del Reto 01)');
}

console.log('\n=== CASO 11: Comparación de perfiles ===');
{
    const estimado = new Array(24).fill(100);
    const medido = new Array(24).fill(150);
    const c = compararPerfiles(estimado, medido);
    assert(Math.abs(c.EdEstimada - 2.4) < 1e-9, 'Ed estimada = 2,40 kWh/día');
    assert(Math.abs(c.EdMedida - 3.6) < 1e-9, 'Ed medida = 3,60 kWh/día');
    assert(Math.abs(c.diferenciaPorcentaje - 50) < 1e-9, 'La diferencia es +50 %');
    assert(compararPerfiles(null, medido) === null, 'Sin un perfil no hay comparación');
}

console.log('\n=== TODAS LAS PRUEBAS DE MEDICIÓN PASARON ===');
