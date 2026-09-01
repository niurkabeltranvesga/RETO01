% CASOS - Pruebas mínimas exigidas
%   1) Carga exclusivamente diurna
%   2) Carga exclusivamente nocturna
%   3) Caso mixto con simultaneidad y/o cruce de medianoche
%
% Ejecutar desde la carpeta 'test' con el path apuntando a '../src'.

addpath('../src');

fprintf('=== CASO 1: Carga exclusivamente diurna ===\n');

horarioDiurno = zeros(1,24);
horarioDiurno(9:17) = 1;  
cargaDiurna = crearCarga('Ventilador oficina', 2, 150, horarioDiurno);
clas1 = clasificarCarga(cargaDiurna.horario, 6, 18);
fprintf('Clasificación esperada: diurna | obtenida: %s\n', clas1);
assert(strcmp(clas1, 'diurna'), 'FALLÓ: clasificación diurna incorrecta');

proy1 = crearProyecto('Caso diurno', {'Estudiante A'}, '2026-08-23', 'on-grid');
proy1.cargas = cargaDiurna;
params = struct('diasOperacionMes', 30, 'diasOperacionAnio', 360, 'costoUnitarioCU', 800);
res1 = calcularResultadosProyecto(proy1, params);
fprintf('Pinst = %.1f W | Pmax = %.1f W | Ed = %.3f kWh/día\n', ...
    res1.potenciaInstaladaW, res1.demandaMaximaW, res1.energiaDiariaKWh);
assert(res1.potenciaInstaladaW == 300, 'FALLÓ: Pinst caso 1');
assert(res1.demandaMaximaW == 300, 'FALLÓ: Pmax caso 1');
assert(abs(res1.energiaDiariaKWh - (300*9/1000)) < 1e-9, 'FALLÓ: Ed caso 1');
fprintf('CASO 1 OK\n\n');

fprintf('=== CASO 2: Carga exclusivamente nocturna ===\n');

horarioNocturno = zeros(1,24);
horarioNocturno([20:24, 1:5]) = 1;  
cargaNocturna = crearCarga('Luminaria exterior', 4, 60, horarioNocturno);
clas2 = clasificarCarga(cargaNocturna.horario, 6, 18);
fprintf('Clasificación esperada: nocturna | obtenida: %s\n', clas2);
assert(strcmp(clas2, 'nocturna'), 'FALLÓ: clasificación nocturna incorrecta');

proy2 = crearProyecto('Caso nocturno', {'Estudiante B'}, '2026-08-23', 'on-grid');
proy2.cargas = cargaNocturna;
res2 = calcularResultadosProyecto(proy2, params);
fprintf('Pinst = %.1f W | Pmax = %.1f W | Ed = %.3f kWh/día\n', ...
    res2.potenciaInstaladaW, res2.demandaMaximaW, res2.energiaDiariaKWh);
assert(res2.potenciaInstaladaW == 240, 'FALLÓ: Pinst caso 2');
assert(res2.demandaMaximaW == 240, 'FALLÓ: Pmax caso 2');
assert(abs(res2.energiaDiariaKWh - (240*10/1000)) < 1e-9, 'FALLÓ: Ed caso 2');
fprintf('CASO 2 OK\n\n');

fprintf('=== CASO 3: Caso mixto, simultaneidad y cruce de medianoche ===\n');

horarioNevera = ones(1,24);  
cargaNevera = crearCarga('Nevera', 1, 120, horarioNevera);

horarioAire = zeros(1,24);
horarioAire([15:23]) = 1;   
cargaAire = crearCarga('Aire acondicionado', 1, 1200, horarioAire);

clasNevera = clasificarCarga(cargaNevera.horario, 6, 18);
clasAire = clasificarCarga(cargaAire.horario, 6, 18);
fprintf('Nevera -> %s (esperado: mixta)\n', clasNevera);
fprintf('Aire   -> %s (esperado: mixta, cruza 18:00)\n', clasAire);
assert(strcmp(clasNevera, 'mixta'), 'FALLÓ: clasificación nevera');
assert(strcmp(clasAire, 'mixta'), 'FALLÓ: clasificación aire');

proy3 = crearProyecto('Caso mixto', {'Estudiante C'}, '2026-08-23', 'on-grid');
proy3.cargas = [cargaNevera, cargaAire];
res3 = calcularResultadosProyecto(proy3, params);
fprintf('Pinst = %.1f W | Pmax = %.1f W | Ed = %.3f kWh/día\n', ...
    res3.potenciaInstaladaW, res3.demandaMaximaW, res3.energiaDiariaKWh);


assert(res3.potenciaInstaladaW == 1320, 'FALLÓ: Pinst caso 3');

assert(res3.demandaMaximaW == 1320, 'FALLÓ: Pmax caso 3 (simultaneidad)');

EdEsperada = (120*24 + 1200*9) / 1000;
assert(abs(res3.energiaDiariaKWh - EdEsperada) < 1e-9, 'FALLÓ: Ed caso 3');
fprintf('CASO 3 OK\n\n');

fprintf('=== TODAS LAS PRUEBAS PASARON CORRECTAMENTE ===\n');
