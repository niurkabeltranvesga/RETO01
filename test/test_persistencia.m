% PERSISTENCIA  Verifica que guardar y luego cargar un proyecto 
addpath('../src');

fprintf('=== PRUEBA DE PERSISTENCIA (guardar / cargar) ===\n');

% Proyecto de ejemplo con 2 cargas (mixta + diurna)
horarioNevera = ones(1,24);
cargaNevera = crearCarga('Nevera', 1, 150, horarioNevera);

horarioTV = zeros(1,24);
horarioTV(19:23) = 1;  
cargaTV = crearCarga('Televisor', 1, 120, horarioTV);

proyectoOriginal = crearProyecto('Casa - prueba persistencia', {'Estudiante'}, '2026-08-23', 'on-grid');
proyectoOriginal.cargas = [cargaNevera, cargaTV];

params = struct('diasOperacionMes', 30, 'diasOperacionAnio', 360, 'costoUnitarioCU', 800);
resultadosOriginal = calcularResultadosProyecto(proyectoOriginal, params);

rutaTemp = 'proyecto_prueba_temp.json';
guardarProyecto(proyectoOriginal, rutaTemp);
fprintf('Proyecto guardado en: %s\n', rutaTemp);

proyectoRecuperado = cargarProyecto(rutaTemp);
resultadosRecuperado = calcularResultadosProyecto(proyectoRecuperado, params);

fprintf('Pinst  original=%.2f  recuperado=%.2f\n', ...
    resultadosOriginal.potenciaInstaladaW, resultadosRecuperado.potenciaInstaladaW);
fprintf('Pmax   original=%.2f  recuperado=%.2f\n', ...
    resultadosOriginal.demandaMaximaW, resultadosRecuperado.demandaMaximaW);
fprintf('Ed     original=%.4f  recuperado=%.4f\n', ...
    resultadosOriginal.energiaDiariaKWh, resultadosRecuperado.energiaDiariaKWh);

assert(resultadosOriginal.potenciaInstaladaW == resultadosRecuperado.potenciaInstaladaW, ...
    'FALLÓ: Pinst no coincide tras guardar/cargar');
assert(resultadosOriginal.demandaMaximaW == resultadosRecuperado.demandaMaximaW, ...
    'FALLÓ: Pmax no coincide tras guardar/cargar');
assert(abs(resultadosOriginal.energiaDiariaKWh - resultadosRecuperado.energiaDiariaKWh) < 1e-9, ...
    'FALLÓ: Ed no coincide tras guardar/cargar');
assert(isequal(resultadosOriginal.clasificacionCargas, resultadosRecuperado.clasificacionCargas), ...
    'FALLÓ: clasificación de cargas no coincide tras guardar/cargar');

delete(rutaTemp);
fprintf('\n=== PERSISTENCIA OK: los resultados son idénticos tras guardar y recuperar ===\n');
