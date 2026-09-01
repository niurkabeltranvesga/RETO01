function proyecto = cargarProyecto(rutaArchivo)
% CARGARPROYECTO  
% Entrada:
%   rutaArchivo - ruta del archivo .json generado por guardarProyecto.m
%
% Salida:
%   proyecto - struct de proyecto, listo para pasar a calcularResultadosProyecto.m

    if exist(rutaArchivo, 'file') ~= 2
        error('Reto01:ArchivoNoEncontrado', ...
            'No se encontró el archivo "%s".', rutaArchivo);
    end

    fid = fopen(rutaArchivo, 'r');
    if fid == -1
        error('Reto01:ErrorLectura', 'No se pudo abrir el archivo "%s".', rutaArchivo);
    end
    texto = fread(fid, '*char')';
    fclose(fid);

    try
        datos = jsondecode(texto);
    catch causaError
        error('Reto01:ArchivoCorrupto', ...
            'El archivo "%s" no tiene un formato JSON válido: %s', rutaArchivo, causaError.message);
    end

    camposRequeridos = {'nombreProyecto', 'integrantes', 'fecha', 'contexto', 'cargas'};
    for i = 1:numel(camposRequeridos)
        if ~isfield(datos, camposRequeridos{i})
            error('Reto01:ArchivoIncompleto', ...
                'El archivo no contiene el campo obligatorio "%s".', camposRequeridos{i});
        end
    end

    proyecto = crearProyecto(datos.nombreProyecto, datos.integrantes, datos.fecha, datos.contexto);

    numCargas = numel(datos.cargas);
    cargasReconstruidas = struct([]);
    for i = 1:numCargas
        c = datos.cargas(i);
        if iscell(datos.cargas)
            c = datos.cargas{i};
        end
        cargaNueva = crearCarga(c.descripcion, c.cantidad, c.potenciaUnitariaW, c.horario(:)');
        if isempty(cargasReconstruidas)
            cargasReconstruidas = cargaNueva;
        else
            cargasReconstruidas(end+1) = cargaNueva; 
        end
    end

    proyecto.cargas = cargasReconstruidas;

    if isfield(datos, 'parametros') && ~isempty(datos.parametros)
        proyecto.parametros = datos.parametros;
    else
        proyecto.parametros = [];
    end
end
