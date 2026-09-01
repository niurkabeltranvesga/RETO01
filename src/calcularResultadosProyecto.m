function resultados = calcularResultadosProyecto(proyecto, parametros)
% CALCULARRESULTADOSPROYECTO  
% Entradas:
%   proyecto   - struct de proyecto (ver crearProyecto.m), con su campo
%                'cargas' ya lleno (arreglo de structs, ver crearCarga.m)
%   parametros - struct con parámetros de la proyección/costo, campos:
%       .horaInicioDia      (opcional, por defecto 6)
%       .horaFinDia         (opcional, por defecto 18)
%       .diasOperacionMes   (obligatorio, ej. 30)
%       .diasOperacionAnio  (obligatorio, ej. 360)
%       .costoUnitarioCU    (obligatorio, $/kWh)
%
% Salida:
%   resultados - struct con todos los indicadores exigidos por el TdR:
%       .potenciaInstaladaW
%       .demandaMaximaW
%       .perfilHorarioW        (1x24)
%       .energiaDiariaKWh
%       .energiaMensualKWh
%       .energiaAnualKWh
%       .costoDiario
%       .costoMensual
%       .costoAnual
%       .clasificacionCargas   (cell array, una clasificación por carga)

    if isempty(proyecto.cargas)
        error('Reto01:SinCargas', 'El proyecto no tiene cargas registradas.');
    end

    if nargin < 2 || isempty(parametros)
        error('Reto01:ParametrosFaltantes', ...
            'Debe indicar días de operación (mes y año) y el costo unitario CU.');
    end

    horaInicioDia = 6;
    horaFinDia = 18;
    if isfield(parametros, 'horaInicioDia') && ~isempty(parametros.horaInicioDia)
        horaInicioDia = parametros.horaInicioDia;
    end
    if isfield(parametros, 'horaFinDia') && ~isempty(parametros.horaFinDia)
        horaFinDia = parametros.horaFinDia;
    end

    camposObligatorios = {'diasOperacionMes', 'diasOperacionAnio', 'costoUnitarioCU'};
    for i = 1:numel(camposObligatorios)
        if ~isfield(parametros, camposObligatorios{i})
            error('Reto01:ParametrosFaltantes', ...
                'Falta el parámetro "%s".', camposObligatorios{i});
        end
    end

    cargas = proyecto.cargas;

 
    Pinst = calcularPotenciaInstalada(cargas);

    
    perfilHorario = calcularPerfilHorario(cargas);
    Pmax = calcularDemandaMaxima(perfilHorario);
    Ed = calcularEnergiaDiaria(perfilHorario);

    
    [Em, Ea] = calcularProyeccionConsumo(Ed, parametros.diasOperacionMes, parametros.diasOperacionAnio);

    
    [costoDiario, costoMensual, costoAnual] = calcularCostos(Ed, Em, Ea, parametros.costoUnitarioCU);

    clasificacionCargas = cell(1, numel(cargas));
    for i = 1:numel(cargas)
        clasificacionCargas{i} = clasificarCarga(cargas(i).horario, horaInicioDia, horaFinDia);
    end

    Ed_verificacion = sum(perfilHorario) / 1000;
    assert(abs(Ed - Ed_verificacion) < 1e-9, ...
        'Inconsistencia interna entre perfil horario y energía diaria.');

    resultados.potenciaInstaladaW    = Pinst;
    resultados.demandaMaximaW        = Pmax;
    resultados.perfilHorarioW        = perfilHorario;
    resultados.energiaDiariaKWh      = Ed;
    resultados.energiaMensualKWh     = Em;
    resultados.energiaAnualKWh       = Ea;
    resultados.costoDiario           = costoDiario;
    resultados.costoMensual          = costoMensual;
    resultados.costoAnual            = costoAnual;
    resultados.clasificacionCargas   = clasificacionCargas;
end
