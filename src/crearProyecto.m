function proyecto = crearProyecto(nombreProyecto, integrantes, fecha, contexto)
% CREARPROYECTO  
% Entradas:
%   nombreProyecto - texto (nombre o ID del proyecto)
%   integrantes    - texto o cell array de nombres del equipo
%   fecha          - texto o datetime
%   contexto       - uno de: 'off-grid', 'on-grid', 'hibrido-off-grid', 'hibrido-on-grid'
% Salida:
%   proyecto - struct con los datos anteriores y un campo 'cargas' vacío
%              (arreglo de structs de carga, se llena luego con crearCarga.m)

    contextosValidos = {'off-grid', 'on-grid', 'hibrido-off-grid', 'hibrido-on-grid'};
    if ~ismember(lower(contexto), contextosValidos)
        error('Reto01:ContextoInvalido', ...
            'El contexto debe ser uno de: off-grid, on-grid, hibrido-off-grid, hibrido-on-grid.');
    end

    if isempty(strtrim(nombreProyecto))
        error('Reto01:NombreProyectoInvalido', 'El nombre/ID del proyecto no puede estar vacío.');
    end

    proyecto.nombreProyecto = strtrim(nombreProyecto);
    proyecto.integrantes    = integrantes;
    proyecto.fecha          = fecha;
    proyecto.contexto       = lower(contexto);
    proyecto.cargas         = struct([]);   % se llena con crearCarga.m
end
