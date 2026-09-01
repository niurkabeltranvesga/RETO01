function guardarProyecto(proyecto, rutaArchivo, parametros)
% GUARDARPROYECTO  
% Entradas:
%   proyecto    - struct de proyecto con su campo 'cargas' lleno
%                 (ver crearProyecto.m y crearCarga.m)
%   rutaArchivo - ruta del archivo de salida, ej. 'miProyecto.json'
%   parametros  - (opcional) struct con diasOperacionMes, diasOperacionAnio,
%                 costoUnitarioCU, horaInicioDia, horaFinDia. Se incluye
%                 para que el informe sea totalmente reproducible al
%                 recuperar el proyecto (trazabilidad, sección 4 del TdR):
%                 sin esto, el costo unitario y los días de operación se
%                 perderían al guardar/cargar.

    if nargin < 3
        parametros = [];
    end

    if isempty(strtrim(rutaArchivo))
        error('Reto01:RutaInvalida', 'Debe indicar una ruta de archivo válida.');
    end

    datos.version         = '1.1';
    datos.nombreProyecto  = proyecto.nombreProyecto;
    datos.integrantes     = proyecto.integrantes;
    datos.fecha           = proyecto.fecha;
    datos.contexto        = proyecto.contexto;
    datos.parametros      = parametros;  

    numCargas = numel(proyecto.cargas);
    cargasOut = cell(1, numCargas);
    for i = 1:numCargas
        c = proyecto.cargas(i);
        cargaOut.descripcion       = c.descripcion;
        cargaOut.cantidad          = c.cantidad;
        cargaOut.potenciaUnitariaW = c.potenciaUnitariaW;
        cargaOut.horario           = c.horario;
        cargasOut{i} = cargaOut;
    end
    datos.cargas = cargasOut;

    esOctave = exist('OCTAVE_VERSION', 'builtin') ~= 0;
    if esOctave
       
        texto = jsonencode(datos);
    else
        texto = jsonencode(datos, 'PrettyPrint', true);
    end

    fid = fopen(rutaArchivo, 'w');
    if fid == -1
        error('Reto01:ErrorEscritura', ...
            'No se pudo crear el archivo "%s". Verifique la ruta y los permisos.', rutaArchivo);
    end
    fwrite(fid, texto, 'char');
    fclose(fid);
end
