
addpath('../src');

proyecto = crearProyecto('Vivienda - Santa Marta', {'Estudiante'}, '23/08/2026', 'on-grid');

horNevera = ones(1,24);
horTV     = zeros(1,24); horTV(19:23) = 1;              % 18-22h
horAire   = zeros(1,24); horAire([23:24, 1:6]) = 1;     % 22:00-05:00 (cruza medianoche)
horLuces  = zeros(1,24); horLuces([19:24, 1:6]) = 1;    % 18:00-06:00
horBomba  = zeros(1,24); horBomba([7:8]) = 1;            % 06:00-07:00
horLavad  = zeros(1,24); horLavad([9:10]) = 1;           % 08:00-09:00

cargas = [ ...
    crearCarga('Nevera', 1, 150, horNevera), ...
    crearCarga('Televisor sala', 1, 120, horTV), ...
    crearCarga('Aire acondicionado habitacion', 1, 1200, horAire), ...
    crearCarga('Circuito luces interiores', 1, 300, horLuces), ...
    crearCarga('Motobomba de agua', 1, 750, horBomba), ...
    crearCarga('Lavadora', 1, 500, horLavad) ...
];

proyecto.cargas = cargas;

parametros.diasOperacionMes  = 30;
parametros.diasOperacionAnio = 360;
parametros.costoUnitarioCU   = 850;  % $/kWh (valor de ejemplo)

resultados = calcularResultadosProyecto(proyecto, parametros);

fprintf('Pinst=%.1f W | Pmax=%.1f W | Ed=%.2f kWh/día | Costo diario=$%.2f\n', ...
    resultados.potenciaInstaladaW, resultados.demandaMaximaW, ...
    resultados.energiaDiariaKWh, resultados.costoDiario);

generarInforme(proyecto, resultados, parametros, 'informe_prueba.pdf');
fprintf('Informe generado: informe_prueba.pdf\n');
