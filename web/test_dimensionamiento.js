// test_dimensionamiento.js
//
// Pruebas del módulo de dimensionamiento (Reto 02) contra el caso de prueba
// estandarizado del TdR (sección 7): Alta Guajira, módulo de referencia de 550 Wp.

const fs = require('fs');
const path = require('path');
const D = require('../dimensionamiento');
const M = require('../motorCalculo');

function assert(cond, msg) {
    if (!cond) throw new Error('FALLÓ: ' + msg);
    console.log('  OK: ' + msg);
}
const cerca = (a, b, tol) => Math.abs(a - b) <= tol;

const catalogo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'datos', 'catalogo_modulos.json'), 'utf-8')).modulos;
const sitios = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'datos', 'base_sitios.json'), 'utf-8')).sitios;
const sitioCaso = sitios.find(s => s.casoPrueba);
const moduloRef = catalogo.find(m => m.referenciaTdR);

// Perfil de referencia del caso de prueba (concepto de evaluación del Reto 01)
const perfil = [240,240,240,240,160,160,790,160,510,390,435,435,85,85,435,435,510,910,160,160,160,160,240,240];
const Ed = M.calcularEnergiaDiaria(perfil);

const entradaCaso = {
    energiaDiariaKWh: Ed, perfilW: perfil, horaInicioDia: 6, horaFinDia: 18,
    sitio: sitioCaso, pr: 0.70, vMaxSistema: 600, tMinC: 20, tAmbOperacionC: 32,
    areaDisponibleM2: 20, catalogo, moduloManualId: moduloRef.id, diasOperacionAnio: 365,
};

console.log('=== CASO 1: Datos que hereda del Reto 01 y coincidencia con la ventana solar (RF-17) ===');
{
    assert(cerca(Ed, 7.580, 1e-9), 'Ed heredada = 7,580 kWh/día');
    const c = D.energiaEnVentanaSolar(perfil, 6, 18);
    assert(cerca(c.dentroKWh, 5.180, 1e-9), 'Energía dentro de la ventana solar (06–18 h) = 5,180 kWh');
    assert(cerca(c.fueraKWh, 2.400, 1e-9), 'Energía fuera de la ventana solar = 2,400 kWh');
    assert(cerca(c.fraccionDentro * 100, 68.34, 0.01), 'Fracción dentro de la ventana = 68,3 %');
    const otra = D.energiaEnVentanaSolar(perfil, 7, 17);
    assert(!cerca(otra.dentroKWh, c.dentroKWh, 1e-6), 'El criterio horario es configurable y cambia el resultado');
}

console.log('\n=== CASO 2: Resultado de referencia del TdR, dimensionando por mes crítico ===');
{
    const r = D.dimensionarGenerador(Object.assign({}, entradaCaso, { criterioRecurso: 'critico' }));
    const s = r.seleccion;
    assert(cerca(r.potenciaPicoAnualKWp, 1.87, 0.005), 'Potencia pico por promedio anual = 1,87 kWp');
    assert(cerca(r.potenciaPicoCriticoKWp, 2.08, 0.005), 'Potencia pico por mes crítico = 2,08 kWp');
    assert(s.numeroModulos === 4, 'Módulos necesarios (550 Wp) = 4');
    assert(s.potenciaInstaladaW === 2200, 'Potencia finalmente instalada = 2,20 kWp');
    assert(cerca(s.excedentePct, 5.6, 0.05), 'Excedente sobre el mes crítico = +5,6 %');
    assert(cerca((s.potenciaInstaladaW / (r.potenciaPicoAnualKWp * 1000) - 1) * 100, 17.8, 0.05), 'Excedente sobre el promedio anual = +17,8 %');
    assert(cerca(s.vocModuloTminV, 50.17, 0.005), 'Voc del módulo a 20 °C = 50,17 V');
    assert(s.maxModulosSerie === 11, 'Máximo de módulos en serie con 600 V = 11');
    assert(s.modulosSerie === 4 && s.cadenasParalelo === 1, 'Configuración = 1 cadena de 4');
    assert(cerca(s.vocGeneradorTminV, 200.7, 0.05), 'Voc del generador a 20 °C = 200,7 V');
    assert(cerca(s.temperaturaCeldaC, 63.2, 0.06), 'Temperatura de celda en operación = 63,2 °C');
    assert(cerca(s.vmpGeneradorOperacionV, 148.9, 0.05), 'Vmp del generador a 63,2 °C = 148,9 V');
    assert(cerca(s.iscGeneradorA, 14.0, 1e-9), 'Isc del generador = 14,0 A');
    assert(cerca(s.corrienteDisenoA, 21.9, 0.03), 'Corriente de diseño = 21,9 A (factor 1,5625)');
    assert(cerca(s.areaGeneradorM2, 10.32, 1e-9), 'Área del generador = 10,32 m²');
    assert(s.cabeEnArea === true, 'Cabe en los 20 m² disponibles');
    assert(cerca(r.energiaGeneradaDiariaKWh, 8.93, 0.005), 'Energía diaria estimada del generador = 8,93 kWh/día');
    assert(cerca(s.potenciaOperacionW, 1905, 1), 'Comprobación cruzada: potencia a 63,2 °C ≈ 1 905 W');
}

console.log('\n=== CASO 3: Dimensionando por promedio anual, mismo hardware (punto clave del TdR) ===');
{
    const r = D.dimensionarGenerador(Object.assign({}, entradaCaso, { criterioRecurso: 'anual' }));
    assert(r.seleccion.numeroModulos === 4, 'Por promedio anual también salen 4 módulos de 550 Wp');
    assert(cerca(r.seleccion.excedentePct, 17.8, 0.05), 'Pero el excedente es +17,8 %: cambia la justificación, no el hardware');
}

console.log('\n=== CASO 4: Tensión máxima (RF-19: se cambia y se recalcula) ===');
{
    const r = D.dimensionarGenerador(Object.assign({}, entradaCaso, { vMaxSistema: 150 }));
    assert(r.seleccion.maxModulosSerie === 2, 'Con 150 V caben 2 módulos en serie');
    assert(r.seleccion.modulosSerie === 2 && r.seleccion.cadenasParalelo === 2, 'Configuración = 2 cadenas de 2');
    assert(cerca(r.seleccion.iscGeneradorA, 28.0, 1e-9), 'Isc del generador con 2 cadenas = 28,0 A');
    const descartado = D.evaluarModulo(moduloRef, { potenciaPicoKWp: 2, vMaxSistema: 40, tMinC: 20, tAmbOperacionC: 32, areaDisponibleM2: 20 });
    assert(descartado.viable === false, 'Con 40 V el módulo se descarta: su Voc corregido no cabe ni una vez');
}

console.log('\n=== CASO 5: Área insuficiente (RF-22) ===');
{
    const r = D.dimensionarGenerador(Object.assign({}, entradaCaso, { areaDisponibleM2: 8 }));
    assert(r.seleccion.cabeEnArea === false, 'Con 8 m² el generador de 10,32 m² no cabe');
    assert(r.advertencias.some(a => a.includes('no cabe')), 'Se advierte al usuario');
}

console.log('\n=== CASO 6: Selección automática en el catálogo real con criterio explícito (RF-23) ===');
{
    const base = Object.assign({}, entradaCaso, { moduloManualId: null });
    const porExcedenteCritico = D.dimensionarGenerador(Object.assign({}, base, { criterioRecurso: 'critico', criterioSeleccion: 'menor_excedente' }));
    assert(porExcedenteCritico.seleccion.modulo.modelo.startsWith('TSM-DEG19C.20'), 'Mes crítico + menor excedente -> Trina 550 W');
    assert(!porExcedenteCritico.seleccion.modulo.referenciaTdR, 'El módulo de referencia del TdR no compite en la selección automática');

    const porExcedenteAnual = D.dimensionarGenerador(Object.assign({}, base, { criterioRecurso: 'anual', criterioSeleccion: 'menor_excedente' }));
    assert(porExcedenteAnual.seleccion.modulo.modelo === 'CS6.2-66TB-625HP', 'Promedio anual + menor excedente -> Canadian Solar 625 W');
    assert(porExcedenteAnual.seleccion.numeroModulos === 3, 'Con 3 módulos');

    const porArea = D.dimensionarGenerador(Object.assign({}, base, { criterioRecurso: 'critico', criterioSeleccion: 'menor_area' }));
    assert(porArea.seleccion.areaGeneradorM2 === Math.min(...porArea.evaluaciones.filter(e => e.viable && !e.modulo.referenciaTdR).map(e => e.areaGeneradorM2)),
        'Menor área -> elige la referencia que ocupa menos superficie');

    const nuevo = Object.assign({}, catalogo[0], { id: 'nuevo-modulo', modelo: 'Prueba', potenciaW: 700 });
    const ampliado = D.dimensionarGenerador(Object.assign({}, base, { catalogo: catalogo.concat([nuevo]) }));
    assert(ampliado.evaluaciones.length === catalogo.length + 1, 'Una referencia nueva en el catálogo se evalúa sin tocar el código');
}

console.log('\n=== CASO 7: Recurso solar desde la base local (RF-14, RF-16) ===');
{
    const santaMarta = sitios.find(s => s.id === 'unimagdalena-santa-marta');
    const rec = D.analizarRecurso(santaMarta);
    assert(rec.mensual.length === 12, 'Muestra los doce valores mensuales');
    assert(rec.mesCritico.valor === 4.44 && rec.mesCritico.nombre === 'Junio', 'Mes crítico de Santa Marta = junio, 4,44');
    assert(cerca(D.promedioAnualDesdeMensual(santaMarta.mensual), santaMarta.irradiacionAnual, 0.01),
        'El promedio de los 12 meses coincide con el anual anotado (5,01)');
    assert(sitios.length >= 5 && sitios.filter(s => !s.casoPrueba).length >= 5, 'La base tiene al menos cinco casos documentados');
    assert(sitios.every(s => s.fuente && s.fechaConsulta), 'Todos los sitios declaran fuente y fecha');
}

console.log('\n=== CASO 8: Validación de entradas (RF-24) ===');
{
    let lanzo = false;
    try { D.dimensionarGenerador(Object.assign({}, entradaCaso, { pr: 0 })); } catch (e) { lanzo = true; }
    assert(lanzo, 'PR = 0 se rechaza');
    lanzo = false;
    try { D.dimensionarGenerador(Object.assign({}, entradaCaso, { areaDisponibleM2: 0 })); } catch (e) { lanzo = true; }
    assert(lanzo, 'Área disponible = 0 se rechaza');
    const raro = D.dimensionarGenerador(Object.assign({}, entradaCaso, { pr: 0.98 }));
    assert(raro.advertencias.some(a => a.includes('desempeño')), 'PR = 0,98 se acepta pero se advierte como fuera de rango');
    assert(catalogo.every(m => m.fuente && m.fechaConsulta), 'Todos los módulos del catálogo declaran fuente y fecha');
}

console.log('\n=== CASO 9: Método propio, balance día/noche con factor de crecimiento (docs/METODO_PROPIO.md) ===');
{
    const ref = D.dimensionarGenerador(entradaCaso);
    assert(ref.metodo.id === 'referencia' && cerca(ref.potenciaPicoKWp, 2.082, 0.001), 'Por defecto se usa el método de referencia del TdR (2,08 kWp)');
    const bal = D.dimensionarGenerador(Object.assign({}, entradaCaso, { metodoPotencia: 'balance', etaBat: 0.85, crecimientoPct: 0 }));
    assert(cerca(bal.metodo.energiaEquivalenteKWh, 5.18 + 2.40 / 0.85, 1e-9), 'E_eq = 5,18 + 2,40 / 0,85 = 8,00 kWh/día');
    assert(cerca(bal.potenciaPicoKWp, 2.199, 0.001), 'Sin crecimiento: Ppico = 8,00 / (5,2 · 0,70) = 2,20 kWp');
    assert(bal.seleccion.numeroModulos === 4, 'Sin crecimiento siguen siendo 4 módulos de 550 Wp');
    const cre = D.dimensionarGenerador(Object.assign({}, entradaCaso, { metodoPotencia: 'balance', etaBat: 0.85, crecimientoPct: 20 }));
    assert(cerca(cre.metodo.fc, 1.2, 1e-12) && cerca(cre.metodo.energiaDisenoKWh, 9.604, 0.001), 'Con g = 20 %: Fc = 1,20 y E_diseño = 9,60 kWh/día');
    assert(cerca(cre.potenciaPicoKWp, 2.639, 0.001), 'Con g = 20 %: Ppico = 9,60 / 3,64 = 2,64 kWp');
    assert(cre.seleccion.numeroModulos === 5, 'Con g = 20 % se necesitan 5 módulos de 550 Wp');
    assert(cerca(cre.metodo.potenciaReferenciaKWp, 2.082, 0.001) && cerca(cre.metodo.potenciaBalanceKWp, 2.199, 0.001),
        'Se reportan las tres potencias: referencia 2,08 · balance 2,20 · diseño 2,64 kWp');
    let lanzo = false;
    try { D.dimensionarGenerador(Object.assign({}, entradaCaso, { metodoPotencia: 'balance', etaBat: 0 })); } catch (e) { lanzo = true; }
    assert(lanzo, 'η_bat = 0 se rechaza');
    lanzo = false;
    try { D.dimensionarGenerador(Object.assign({}, entradaCaso, { metodoPotencia: 'balance', crecimientoPct: -5 })); } catch (e) { lanzo = true; }
    assert(lanzo, 'Un crecimiento negativo se rechaza');
    const alto = D.dimensionarGenerador(Object.assign({}, entradaCaso, { metodoPotencia: 'balance', crecimientoPct: 80 }));
    assert(alto.advertencias.some(a => a.includes('crecimiento')), 'Un crecimiento de 80 % se acepta pero se advierte');

    // Meta de cobertura: Ppico = Fc · Cob · E_eq / (HSP · PR)
    const c80 = D.dimensionarGenerador(Object.assign({}, entradaCaso, { metodoPotencia: 'balance', coberturaPct: 80, contexto: 'on-grid' }));
    assert(cerca(c80.potenciaPicoKWp, 0.8 * 8.0035 / 3.64, 0.001) && cerca(c80.potenciaPicoKWp, 1.759, 0.001), 'Cobertura 80 %: Ppico = 0,80 · 8,00 / 3,64 = 1,76 kWp');
    assert(c80.seleccion.numeroModulos === 4, 'Cobertura 80 %: 1,76 / 0,55 = 3,2 → 4 módulos');
    assert(!c80.advertencias.some(a => a.includes('off-grid')), 'En on-grid una cobertura menor al 100 % no se advierte');
    const c50 = D.dimensionarGenerador(Object.assign({}, entradaCaso, { metodoPotencia: 'balance', coberturaPct: 50, contexto: 'on-grid' }));
    assert(c50.seleccion.numeroModulos === 2, 'Cobertura 50 %: 1,10 kWp → 2 módulos');
    const off = D.dimensionarGenerador(Object.assign({}, entradaCaso, { metodoPotencia: 'balance', coberturaPct: 80, contexto: 'off-grid' }));
    assert(off.advertencias.some(a => a.includes('off-grid')), 'En off-grid una cobertura menor al 100 % se advierte');
    const ambos = D.dimensionarGenerador(Object.assign({}, entradaCaso, { metodoPotencia: 'balance', crecimientoPct: 20, coberturaPct: 80, contexto: 'on-grid' }));
    assert(cerca(ambos.metodo.energiaDisenoKWh, 1.2 * 0.8 * 8.0035, 0.001), 'Crecimiento y cobertura se combinan: E_diseño = 1,20 · 0,80 · E_eq');
    const sinBat = D.dimensionarGenerador(Object.assign({}, entradaCaso, { metodoPotencia: 'balance', etaBat: 1, contexto: 'hibrido-off-grid' }));
    assert(!sinBat.advertencias.some(a => a.includes('batería')), 'η_bat = 1 (sin almacenamiento) no se advierte como fuera de rango');
    for (const malo of [0, 120]) {
        let fallo = false;
        try { D.dimensionarGenerador(Object.assign({}, entradaCaso, { metodoPotencia: 'balance', coberturaPct: malo })); } catch (e) { fallo = true; }
        assert(fallo, 'Cobertura de ' + malo + ' % se rechaza');
    }
}

console.log('\n=== TODAS LAS PRUEBAS DEL DIMENSIONAMIENTO PASARON ===');
