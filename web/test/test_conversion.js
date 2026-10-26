// test_conversion.js
//
// Caso de prueba estandarizado del Reto 03 (estación de la Alta Guajira):
// generador de 4 módulos de 550 Wp en una cadena (2,20 kWp), Ed = 7,58 kWh/día,
// η_inv = 0,90, N = 2 días, fT = 1,0, 48 V nominales, HSP 5,8 / 5,2, PR 0,70.
// Los valores esperados se calcularon a mano con las fórmulas del TdR.
//
// Uso (desde la carpeta web/):  node test/test_conversion.js

const C = require('../conversion.js');

let fallas = 0;
function cerca(nombre, obtenido, esperado, tol) {
    const ok = Math.abs(obtenido - esperado) <= (tol === undefined ? Math.abs(esperado) * 0.001 + 1e-9 : tol);
    console.log((ok ? '  ok   ' : '  FALLA') + ' ' + nombre + ': ' + (typeof obtenido === 'number' ? +obtenido.toFixed(4) : obtenido) + ' (esperado ' + esperado + ')');
    if (!ok) fallas++;
}
function igual(nombre, obtenido, esperado) {
    const ok = obtenido === esperado;
    console.log((ok ? '  ok   ' : '  FALLA') + ' ' + nombre + ': ' + obtenido + (ok ? '' : ' (esperado ' + esperado + ')'));
    if (!ok) fallas++;
}

const modulo = { potenciaW: 550, vocV: 49.5, vmpV: 41.5, iscA: 14.0, impA: 13.3, coefVocPctC: -0.27 };
const generador = { modulo, modulosSerie: 4, cadenasParalelo: 1, tMinC: 20, tCeldaC: 63.2 };

const reguladores = [
    { id: 'ctrl-a', referenciaTdR: true, modelo: 'CTRL-A', vocMaxV: 150, corrienteSalidaA: 60, iscMaxA: 50 },
    { id: 'ctrl-b', referenciaTdR: true, modelo: 'CTRL-B', vocMaxV: 250, corrienteSalidaA: 80, iscMaxA: 50 },
    { id: 'ctrl-c', referenciaTdR: true, modelo: 'CTRL-C', vocMaxV: 250, corrienteSalidaA: 40, iscMaxA: 50 },
];
const inversores = [
    { id: 'inv-a', referenciaTdR: true, modelo: 'INV-A', pacW: 1500, vocMaxV: 500, mpptMinV: 80, mpptMaxV: 450, impMaxA: 12, iscMaxA: 15 },
    { id: 'inv-b', referenciaTdR: true, modelo: 'INV-B', pacW: 2000, vocMaxV: 600, mpptMinV: 90, mpptMaxV: 550, impMaxA: 16, iscMaxA: 20 },
    { id: 'inv-c', referenciaTdR: true, modelo: 'INV-C', pacW: 3000, vocMaxV: 600, mpptMinV: 90, mpptMaxV: 550, impMaxA: 16, iscMaxA: 20 },
];
const agm = { id: 'agm', referenciaTdR: true, tecnologia: 'AGM', tensionV: 12, capacidadAh: 200, dodDisenoPct: 50, eficienciaIdaVuelta: 0.80, limiteCargaC: 0.2, vidaAnios: 4 };
const lfp = { id: 'lfp', referenciaTdR: true, tecnologia: 'LFP', tensionV: 51.2, capacidadAh: 100, dodDisenoPct: 80, eficienciaIdaVuelta: 0.92, limiteCargaC: 0.5, vidaAnios: 10 };
const catalogo = { reguladores, inversores, baterias: [agm, lfp] };

const comun = {
    generador, catalogo,
    energiaDiariaKWh: 7.58, demandaMaximaW: 910,
    hspAnual: 5.8, hspCritico: 5.2, pr: 0.70, criterioRecurso: 'critico',
    etaInv: 0.90, autonomiaDias: 2, fT: 1.0, vNominalV: 48,
    bateriasComparar: [agm, lfp],
};

console.log('=== Arreglo (ambas ramas) ===');
const t = C.tensionesModulo(modulo, 20, 63.2);
cerca('Voc en frío del módulo [V]', t.vocFrio, 50.168, 0.001);
cerca('Vmp en caliente del módulo [V]', t.vmpCaliente, 37.219, 0.001);
cerca('Vmp en frío del módulo [V]', t.vmpFrio, 42.060, 0.001);

console.log('\n=== Rama con almacenamiento, AGM 12 V / 200 Ah, banco de 48 V ===');
const conAgm = C.dimensionarConversion(Object.assign({}, comun, {
    rama: 'con', bateria: agm, vBancoV: 48, dodPct: 50, etaBat: 0.80, equipoManualId: 'ctrl-b',
}));
const vr = id => conAgm.verificaciones.find(v => v.equipo.id === id);
igual('Máximo en serie con CTRL-A', vr('ctrl-a').limites.maxSerie, 2);
igual('Máximo en serie con CTRL-B', vr('ctrl-b').limites.maxSerie, 4);
igual('Veredicto CTRL-A (Voc 200,7 V > 150 V)', vr('ctrl-a').veredicto, 'no_cumple');
igual('Veredicto CTRL-B', vr('ctrl-b').veredicto, 'cumple');
igual('Veredicto CTRL-C (45,8 A > 40 A: recorta)', vr('ctrl-c').veredicto, 'alerta');
igual('Propuesta para CTRL-A', vr('ctrl-a').propuesta.np + ' cadenas de ' + vr('ctrl-a').propuesta.ns, '2 cadenas de 2');
cerca('Corriente al banco [A]', conAgm.seleccion.corrienteBancoA, 45.833, 0.001);
cerca('Corriente de conductores 1,25·Isc [A]', conAgm.corrienteConductoresA, 17.5, 1e-9);
const b = conAgm.banco;
cerca('Ecc [Wh/día]', b.eccWh, 8422.2, 0.1);
cerca('Cn [Wh]', b.cnWh, 33688.9, 0.1);
cerca('Cn [Ah]', b.cnAh, 701.85, 0.01);
igual('Ns', b.ns, 4);
igual('Np', b.np, 4);
igual('Baterías', b.numeroBaterias, 16);
igual('Ah instalados', b.ahInstalados, 800);
cerca('kWh instalados', b.kWhInstalados, 38.4, 1e-9);
cerca('DoD al final de la autonomía', b.dodFin, 0.4387, 0.0001);
cerca('DoD diario de diseño', b.dodDiarioDiseno, 0.25, 1e-9);
cerca('DoD diario con el arreglo instalado', b.dodDiarioReal, 0.2193, 0.0001);
cerca('Tasa C de carga', conAgm.tasas.tasaCarga, 0.0573, 0.0001);
igual('Tasa de carga frente a 0,2 C', conAgm.tasas.carga.estado, 'cumple');
cerca('Tasa C de descarga', conAgm.tasas.tasaDescarga, 0.0263, 0.0001);
cerca('Preq anual [W]', conAgm.balance.anual.potenciaRequeridaW, 2593.0, 0.1);
cerca('Preq mes crítico [W]', conAgm.balance.critico.potenciaRequeridaW, 2892.2, 0.1);
cerca('Margen anual [%]', conAgm.balance.anual.margenPct, -15.16, 0.01);
cerca('Margen mes crítico [%]', conAgm.balance.critico.margenPct, -23.93, 0.01);
igual('Módulos adicionales (anual)', conAgm.balance.anual.modulosAdicionales, 1);
igual('Módulos adicionales (mes crítico)', conAgm.balance.critico.modulosAdicionales, 2);
igual('¿Se recupera el banco?', conAgm.recuperacion.seRecupera, false);

console.log('\n=== Rama con almacenamiento, LFP 51,2 V / 100 Ah ===');
const conLfp = C.dimensionarConversion(Object.assign({}, comun, {
    rama: 'con', bateria: lfp, vBancoV: 51.2, dodPct: 80, etaBat: 0.92, equipoManualId: 'ctrl-b',
}));
const l = conLfp.banco;
cerca('Cn [Ah]', l.cnAh, 411.24, 0.01);
igual('Ns × Np', l.ns + ' × ' + l.np, '1 × 5');
cerca('kWh instalados', l.kWhInstalados, 25.6, 1e-9);
cerca('DoD final', l.dodFin, 0.6580, 0.0001);
cerca('Tasa C de carga', conLfp.tasas.tasaCarga, 0.0917, 0.0001);
cerca('Preq mes crítico [W]', conLfp.balance.critico.potenciaRequeridaW, 2515.0, 0.1);
igual('Módulos adicionales (mes crítico)', conLfp.balance.critico.modulosAdicionales, 1);
igual('¿Se recupera el banco?', conLfp.recuperacion.seRecupera, false);

console.log('\n=== Comparación de tecnologías (kWh nominales por año de vida) ===');
const cmp = conAgm.comparacion;
cerca('AGM: kWh/año', cmp[0].kWhPorAnio, 9.6, 1e-9);
cerca('LFP: kWh/año', cmp[1].kWhPorAnio, 2.56, 1e-9);

console.log('\n=== Rama sin almacenamiento ===');
const sin = C.dimensionarConversion(Object.assign({}, comun, { rama: 'sin', rangoDcAc: [1.0, 1.3] }));
const vi = id => sin.verificaciones.find(v => v.equipo.id === id);
cerca('DC/AC con INV-A', vi('inv-a').relacionDcAc, 1.467, 0.001);
cerca('DC/AC con INV-B', vi('inv-b').relacionDcAc, 1.100, 0.001);
cerca('DC/AC con INV-C', vi('inv-c').relacionDcAc, 0.733, 0.001);
igual('Veredicto INV-A (Imp 13,3 A > 12 A)', vi('inv-a').veredicto, 'no_cumple');
igual('Veredicto INV-B', vi('inv-b').veredicto, 'cumple');
igual('Veredicto INV-C (sobredimensionado)', vi('inv-c').veredicto, 'alerta');

console.log('\n=== Recuperación con un generador que sí alcanza ===');
const grande = C.dimensionarConversion(Object.assign({}, comun, {
    generador: Object.assign({}, generador, { modulosSerie: 3, cadenasParalelo: 2 }),
    rama: 'con', bateria: agm, vBancoV: 48, dodPct: 50, etaBat: 0.80,
}));
// Eprod = 3300 · 5,8 · 0,7 = 13398 Wh; trec = 2 · 8422,2 / (13398 · 0,8 − 8422,2) = 7,34 días
cerca('Días de recuperación', grande.recuperacion.dias, 7.336, 0.005);
igual('Selección automática (sin equipos comerciales en este catálogo)', grande.seleccion, null);

console.log('\n=== Validaciones ===');
const errores = [
    ['autonomía 0', { autonomiaDias: 0 }],
    ['DoD 120 %', { dodPct: 120 }],
    ['η inversor 1,2', { etaInv: 1.2 }],
    ['η batería 0', { etaBat: 0 }],
    ['banco no múltiplo', { vBancoV: 50 }],
];
errores.forEach(([nombre, cambio]) => {
    let lanzo = false;
    try {
        C.dimensionarConversion(Object.assign({}, comun, { rama: 'con', bateria: agm, vBancoV: 48, dodPct: 50, etaBat: 0.8 }, cambio));
    } catch (e) { lanzo = true; }
    igual('Rechaza ' + nombre, lanzo, true);
});

if (fallas) {
    console.error('\n' + fallas + ' prueba(s) fallaron.');
    process.exit(1);
}
console.log('\n=== TODAS LAS PRUEBAS DEL RETO 03 PASARON ===');
