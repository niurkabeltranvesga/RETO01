function AppReto01
% APPRETO01  Aplicación de escritorio para el Reto 01 (Requerimiento
% Energético) 
    % --- Asegurar que 'src' esté en el path, sin importar la carpeta actual ---
    rutaActual = fileparts(mfilename('fullpath'));
    rutaSrc = fullfile(rutaActual, '..', 'src');
    addpath(rutaSrc);
    rutaAssets = fullfile(rutaActual, 'assets');

    % ESTADO COMPARTIDO DE LA APP  
    proyecto = struct([]);
    listaCargas = struct([]);
    resultados = struct([]);
    parametros = struct( ...
        'diasOperacionMes', 30, ...
        'diasOperacionAnio', 360, ...
        'costoUnitarioCU', 0, ...
        'horaInicioDia', 6, ...
        'horaFinDia', 18);
    horarioTemporal = zeros(1, 24);  % se usa mientras se captura una carga en el Tab 2

    % VENTANA PRINCIPAL Y PESTAÑAS
   
    fig = uifigure('Name', 'Requerimiento Energético', ...
                    'Position', [100 60 950 680], 'Resize', 'off');

    set(fig, 'AutoResizeChildren', 'off');

    tabGroup = uitabgroup(fig, 'Position', [10 10 930 660], ...
        'SelectionChangedFcn', @bloquearCambioManualTab);

    cambioPermitido = false;

    tab1 = uitab(tabGroup, 'Title', '1. Proyecto');
    tab2 = uitab(tabGroup, 'Title', '2. Cargas');
    tab3 = uitab(tabGroup, 'Title', '3. Resultados');
    tab4 = uitab(tabGroup, 'Title', '4. Informe');

   
    colorAcento = [0.96 0.72 0.55];  
    colorBoton  = [0.80 0.42 0.25];   

    % Función auxiliar: encabezado de color para cada pestaña
    function crearEncabezado(tabPadre, texto, rutaIcono)
        panelEncabezado = uipanel(tabPadre, 'Position', [0 600 930 30], ...
            'BackgroundColor', colorAcento, 'BorderType', 'none');
        uilabel(panelEncabezado, 'Position', [15 3 700 24], 'Text', texto, ...
            'FontSize', 14, 'FontWeight', 'bold', 'FontColor', [0.35 0.22 0.15]);
        if nargin >= 3 && ~isempty(rutaIcono) && isfile(rutaIcono)
            uiimage(panelEncabezado, 'ImageSource', rutaIcono, 'Position', [890 2 26 26]);
        end
    end

    % TAB 1.PROYECTO Y CONTEXTO 

    crearEncabezado(tab1, '1. Datos del proyecto y contexto');

    uilabel(tab1, 'Position', [20 540 240 22], 'Text', 'Nombre / ID del proyecto:');
    campoNombreProyecto = uieditfield(tab1, 'text', 'Position', [270 540 320 22]);

    uilabel(tab1, 'Position', [20 500 240 22], 'Text', 'Integrantes (separados por coma):');
    campoIntegrantes = uieditfield(tab1, 'text', 'Position', [270 500 320 22]);

    uilabel(tab1, 'Position', [20 460 240 22], 'Text', 'Fecha (dd/mm/aaaa):');
    campoFecha = uieditfield(tab1, 'text', 'Position', [270 460 200 22], ...
        'Value', datestr(now, 'dd/mm/yyyy')); %#ok<TNOW1,DATST>

    uilabel(tab1, 'Position', [20 420 240 22], 'Text', 'Contexto de operación:');
    listaContextos = {'Off-grid', 'On-grid', 'Híbrido off-grid', 'Híbrido on-grid'};
    menuContexto = uidropdown(tab1, 'Position', [270 420 200 22], ...
        'Items', listaContextos, 'Value', 'On-grid');

    botonGuardarProyecto = uibutton(tab1, 'push', ...
        'Position', [270 370 220 30], ...
        'Text', 'Guardar datos del proyecto', ...
        'ButtonPushedFcn', @guardarProyectoCallback);

    etiquetaEstadoProyecto = uilabel(tab1, 'Position', [20 330 700 22], ...
        'Text', '', 'FontColor', [0.13 0.55 0.13]);

    %Persistencia del proyecto completo 
    uilabel(tab1, 'Position', [20 270 400 22], 'Text', 'Guardar o recuperar el proyecto:', ...
        'FontWeight', 'bold');
    botonGuardarArchivo = uibutton(tab1, 'push', 'Position', [20 235 220 30], ...
        'Text', 'Guardar proyecto en archivo (.json)', ...
        'ButtonPushedFcn', @guardarArchivoCallback);
    botonCargarArchivo = uibutton(tab1, 'push', 'Position', [250 235 220 30], ...
        'Text', 'Cargar proyecto desde archivo', ...
        'ButtonPushedFcn', @cargarArchivoCallback);
    etiquetaEstadoArchivo = uilabel(tab1, 'Position', [20 200 700 22], 'Text', '');

    uibutton(tab1, 'push', 'Position', [790 20 120 32], 'Text', 'Siguiente >', ...
        'BackgroundColor', colorBoton, 'FontColor', [1 1 1], 'FontWeight', 'bold', ...
        'ButtonPushedFcn', @(~,~) irATab(tab2));

    % Imagen
    rutaIconoProyecto = fullfile(rutaAssets, 'icono_proyecto.png');
    if isfile(rutaIconoProyecto)
        uiimage(tab1, 'ImageSource', rutaIconoProyecto, 'Position', [610 260 280 280]);
    end

    %Guardar datos del proyecto
    function guardarProyectoCallback(~, ~)
        nombre = campoNombreProyecto.Value;
        integrantesTexto = campoIntegrantes.Value;
        fecha = campoFecha.Value;

        mapaContexto = containers.Map( ...
            {'Off-grid', 'On-grid', 'Híbrido off-grid', 'Híbrido on-grid'}, ...
            {'off-grid', 'on-grid', 'hibrido-off-grid', 'hibrido-on-grid'});
        contexto = mapaContexto(menuContexto.Value);

        try
            proyecto = crearProyecto(nombre, integrantesTexto, fecha, contexto);
            proyecto.cargas = listaCargas;  

            etiquetaEstadoProyecto.Text = 'Datos del proyecto guardados correctamente.';
            etiquetaEstadoProyecto.FontColor = [0.13 0.55 0.13];
        catch errorCreacion
            etiquetaEstadoProyecto.Text = ['Error: ' errorCreacion.message];
            etiquetaEstadoProyecto.FontColor = [0.75 0.1 0.1];
        end
    end

    %Guardar proyecto completo en archivo
    function guardarArchivoCallback(~, ~)
        if isempty(proyecto)
            etiquetaEstadoArchivo.Text = 'Primero guarde los datos del proyecto (botón de arriba).';
            etiquetaEstadoArchivo.FontColor = [0.75 0.1 0.1];
            return;
        end
        [nombreArchivo, ruta] = uiputfile('*.json', 'Guardar proyecto como');
        if isequal(nombreArchivo, 0)
            return;  % el usuario canceló
        end
        try
            proyecto.cargas = listaCargas;
            guardarProyecto(proyecto, fullfile(ruta, nombreArchivo), parametros);
            etiquetaEstadoArchivo.Text = ['Proyecto guardado en: ' fullfile(ruta, nombreArchivo)];
            etiquetaEstadoArchivo.FontColor = [0.13 0.55 0.13];
        catch errorGuardado
            etiquetaEstadoArchivo.Text = ['Error al guardar: ' errorGuardado.message];
            etiquetaEstadoArchivo.FontColor = [0.75 0.1 0.1];
        end
    end

    %Cargar proyecto completo desde archivo
    function cargarArchivoCallback(~, ~)
        [nombreArchivo, ruta] = uigetfile('*.json', 'Seleccionar archivo de proyecto');
        if isequal(nombreArchivo, 0)
            return;  % el usuario canceló
        end
        try
            proyectoRecuperado = cargarProyecto(fullfile(ruta, nombreArchivo));
            proyecto = proyectoRecuperado;
            listaCargas = proyecto.cargas;

            % Refrescar los campos del Tab 1 con los datos recuperados
            campoNombreProyecto.Value = proyecto.nombreProyecto;
            if iscell(proyecto.integrantes)
                campoIntegrantes.Value = strjoin(proyecto.integrantes, ', ');
            else
                campoIntegrantes.Value = proyecto.integrantes;
            end
            campoFecha.Value = proyecto.fecha;
            mapaInverso = containers.Map( ...
                {'off-grid', 'on-grid', 'hibrido-off-grid', 'hibrido-on-grid'}, ...
                {'Off-grid', 'On-grid', 'Híbrido off-grid', 'Híbrido on-grid'});
            menuContexto.Value = mapaInverso(proyecto.contexto);

            actualizarTablaCargas();  % refresca el Tab 2 con las cargas recuperadas

            % Restaurar parámetros de cálculo (CU, días de operación,
            % franja día/noche) si el archivo los incluía, y actualizar
            % los campos del Tab 3 con esos valores ANTES de recalcular.
            if isfield(proyecto, 'parametros') && ~isempty(proyecto.parametros)
                parametros = proyecto.parametros;
                campoDiasMes.Value        = parametros.diasOperacionMes;
                campoDiasAnio.Value       = parametros.diasOperacionAnio;
                campoCU.Value             = parametros.costoUnitarioCU;
                campoHoraInicioDia.Value  = parametros.horaInicioDia;
                campoHoraFinDia.Value     = parametros.horaFinDia;
            end

            % Recalcular automáticamente para que Resultados e Informe
            % queden consistentes de inmediato con lo recién cargado,
            % sin depender de que el usuario presione "Calcular" de nuevo.
            calcularCallback([], []);

            etiquetaEstadoArchivo.Text = ['Proyecto cargado desde: ' fullfile(ruta, nombreArchivo)];
            etiquetaEstadoArchivo.FontColor = [0.13 0.55 0.13];
        catch errorCarga
            etiquetaEstadoArchivo.Text = ['Error al cargar: ' errorCarga.message];
            etiquetaEstadoArchivo.FontColor = [0.75 0.1 0.1];
        end
    end

    % TAB 2·CUADRO DE CARGAS Y HORARIOS 
    crearEncabezado(tab2, '2. Cuadro de cargas y horarios', fullfile(rutaAssets, 'icono_cargas.png'));

    uilabel(tab2, 'Position', [20 550 150 22], 'Text', 'Descripción de la carga:');
    campoDescripcionCarga = uieditfield(tab2, 'text', 'Position', [190 550 300 22]);

    uilabel(tab2, 'Position', [20 515 150 22], 'Text', 'Cantidad (N):');
    campoCantidadCarga = uieditfield(tab2, 'numeric', 'Position', [190 515 100 22], ...
        'Value', 1, 'Limits', [1 Inf]);

    uilabel(tab2, 'Position', [320 515 150 22], 'Text', 'Potencia unitaria (W):');
    campoPotenciaCarga = uieditfield(tab2, 'numeric', 'Position', [470 515 100 22], ...
        'Value', 100, 'Limits', [0.01 Inf]);

    uilabel(tab2, 'Position', [20 480 400 22], ...
        'Text', 'Horario de uso (marque las horas activas, 0 a 23):', 'FontWeight', 'bold');

    % 24 checkboxes en 2 filas de 12 (horas 0-11 y 12-23). Se guardan en un
    % arreglo de handles para poder leer/limpiar su estado fácilmente.
    checkboxesHorario = gobjects(1, 24);
    anchoCheckbox = 68;
    for h = 0:23
        if h < 12
            fila = 445;
            col = h;
        else
            fila = 410;
            col = h - 12;
        end
        x = 20 + col * anchoCheckbox;
        checkboxesHorario(h+1) = uicheckbox(tab2, 'Position', [x fila 60 22], ...
            'Text', sprintf('%02d:00', h));
    end

    botonAgregarCarga = uibutton(tab2, 'push', 'Position', [20 365 220 30], ...
        'Text', 'Agregar carga al cuadro', ...
        'ButtonPushedFcn', @agregarCargaCallback);
    botonEliminarCarga = uibutton(tab2, 'push', 'Position', [250 365 220 30], ...
        'Text', 'Eliminar carga seleccionada', ...
        'ButtonPushedFcn', @eliminarCargaCallback);

    etiquetaEstadoCarga = uilabel(tab2, 'Position', [20 330 850 22], 'Text', '');

    % La tabla se dimensiona dinámicamente en actualizarTablaCargas() según
    % la cantidad real de cargas
    TOPE_TABLA_CARGAS = 290;
    ALTURA_MIN_TABLA = 90;
    ALTURA_MAX_TABLA = 245;

    tablaCargas = uitable(tab2, 'Position', [20 TOPE_TABLA_CARGAS-ALTURA_MIN_TABLA 890 ALTURA_MIN_TABLA], ...
        'ColumnName', {'#', 'Carga', 'Cant.', 'Pot.unit.(W)', 'Pot.total(W)', 'Horas/día', 'Clasificación'}, ...
        'ColumnWidth', {30, 360, 70, 120, 120, 90, 100});

    uibutton(tab2, 'push', 'Position', [660 5 120 32], 'Text', '< Atrás', ...
        'ButtonPushedFcn', @(~,~) irATab(tab1));
    uibutton(tab2, 'push', 'Position', [790 5 120 32], 'Text', 'Siguiente >', ...
        'BackgroundColor', colorBoton, 'FontColor', [1 1 1], 'FontWeight', 'bold', ...
        'ButtonPushedFcn', @(~,~) irATab(tab3));

    %Agregar carga
    function agregarCargaCallback(~, ~)
        try
            horario = double([checkboxesHorario.Value]);
            nuevaCarga = crearCarga(campoDescripcionCarga.Value, ...
                campoCantidadCarga.Value, campoPotenciaCarga.Value, horario);

            if isempty(listaCargas)
                listaCargas = nuevaCarga;
            else
                listaCargas(end+1) = nuevaCarga; %#ok<AGROW>
            end

            actualizarTablaCargas();

            % Limpiar campos para la siguiente carga
            campoDescripcionCarga.Value = '';
            campoCantidadCarga.Value = 1;
            campoPotenciaCarga.Value = 100;
            for h = 1:24
                checkboxesHorario(h).Value = false;
            end

            etiquetaEstadoCarga.Text = 'Carga agregada correctamente.';
            etiquetaEstadoCarga.FontColor = [0.13 0.55 0.13];
        catch errorCarga
            etiquetaEstadoCarga.Text = ['Error: ' errorCarga.message];
            etiquetaEstadoCarga.FontColor = [0.75 0.1 0.1];
        end
    end

    %Eliminar carga seleccionada de la tabla
    function eliminarCargaCallback(~, ~)
        seleccion = tablaCargas.Selection;
        if isempty(seleccion)
            etiquetaEstadoCarga.Text = 'Seleccione primero una fila de la tabla para eliminar.';
            etiquetaEstadoCarga.FontColor = [0.75 0.1 0.1];
            return;
        end
        filaSeleccionada = seleccion(1, 1);
        listaCargas(filaSeleccionada) = [];
        actualizarTablaCargas();
        etiquetaEstadoCarga.Text = 'Carga eliminada.';
        etiquetaEstadoCarga.FontColor = [0.13 0.55 0.13];
    end

    %Reconstruye la tabla resumen a partir de listaCargas
    function actualizarTablaCargas()
        n = numel(listaCargas);

        % Redimensionar la tabla según la cantidad real de filas
        alturaNecesaria = 40 + max(n,1) * 24;
        alturaFinal = min(max(alturaNecesaria, ALTURA_MIN_TABLA), ALTURA_MAX_TABLA);
        tablaCargas.Position = [20, TOPE_TABLA_CARGAS - alturaFinal, 890, alturaFinal];

        if n == 0
            tablaCargas.Data = {};
            return;
        end
        datosTabla = cell(n, 7);
        for i = 1:n
            c = listaCargas(i);
            clasificacion = clasificarCarga(c.horario, parametros.horaInicioDia, parametros.horaFinDia);
            datosTabla{i,1} = i;
            datosTabla{i,2} = c.descripcion;
            datosTabla{i,3} = c.cantidad;
            datosTabla{i,4} = c.potenciaUnitariaW;
            datosTabla{i,5} = c.potenciaTotalW;
            datosTabla{i,6} = sum(c.horario);
            datosTabla{i,7} = clasificacion;
        end
        tablaCargas.Data = datosTabla;
    end

    % TAB3·RESULTADOS
    crearEncabezado(tab3, '3. Parámetros y resultados');

    uilabel(tab3, 'Position', [20 545 200 22], 'Text', 'Días de operación / mes:');
    campoDiasMes = uieditfield(tab3, 'numeric', 'Position', [230 545 100 22], ...
        'Value', parametros.diasOperacionMes, 'Limits', [1 31]);

    uilabel(tab3, 'Position', [350 545 200 22], 'Text', 'Días de operación / año:');
    campoDiasAnio = uieditfield(tab3, 'numeric', 'Position', [560 545 100 22], ...
        'Value', parametros.diasOperacionAnio, 'Limits', [1 366]);

    uilabel(tab3, 'Position', [20 510 200 22], 'Text', 'Costo unitario CU ($/kWh):');
    campoCU = uieditfield(tab3, 'numeric', 'Position', [230 510 100 22], ...
        'Value', parametros.costoUnitarioCU, 'Limits', [0 Inf]);

    uilabel(tab3, 'Position', [350 510 200 22], 'Text', 'Hora inicio día / fin día:');
    campoHoraInicioDia = uieditfield(tab3, 'numeric', 'Position', [560 510 60 22], ...
        'Value', parametros.horaInicioDia, 'Limits', [0 23]);
    campoHoraFinDia = uieditfield(tab3, 'numeric', 'Position', [630 510 60 22], ...
        'Value', parametros.horaFinDia, 'Limits', [0 23]);

    botonCalcular = uibutton(tab3, 'push', 'Position', [20 465 220 30], ...
        'Text', 'Calcular resultados', 'ButtonPushedFcn', @calcularCallback);

    etiquetaEstadoResultados = uilabel(tab3, 'Position', [20 430 850 22], 'Text', '');

    % Indicadores 
    etiquetasIndicadores = gobjects(1,5);
    nombresIndicadores = {'Potencia instalada', 'Demanda máxima', 'Energía diaria', ...
                           'Energía mensual', 'Energía anual'};
    for i = 1:5
        x = 20 + (i-1)*175;
        uilabel(tab3, 'Position', [x 395 170 18], 'Text', nombresIndicadores{i}, ...
            'FontColor', [0.35 0.35 0.35]);
        etiquetasIndicadores(i) = uilabel(tab3, 'Position', [x 372 170 22], ...
            'Text', '--', 'FontWeight', 'bold');
    end

    ejesPerfil = uiaxes(tab3, 'Position', [20 45 890 290]);
    title(ejesPerfil, 'Perfil horario de demanda (24 h)');
    xlabel(ejesPerfil, 'Hora del día');
    ylabel(ejesPerfil, 'Potencia [W]');

    uibutton(tab3, 'push', 'Position', [660 5 120 32], 'Text', '< Atrás', ...
        'ButtonPushedFcn', @(~,~) irATab(tab2));
    uibutton(tab3, 'push', 'Position', [790 5 120 32], 'Text', 'Siguiente >', ...
        'BackgroundColor', colorBoton, 'FontColor', [1 1 1], 'FontWeight', 'bold', ...
        'ButtonPushedFcn', @(~,~) irATab(tab4));

    %Calcular resultados
    function calcularCallback(~, ~)
        if isempty(proyecto)
            etiquetaEstadoResultados.Text = 'Primero guarde los datos del proyecto en el Tab 1.';
            etiquetaEstadoResultados.FontColor = [0.75 0.1 0.1];
            return;
        end
        if isempty(listaCargas)
            etiquetaEstadoResultados.Text = 'Agregue al menos una carga en el Tab 2.';
            etiquetaEstadoResultados.FontColor = [0.75 0.1 0.1];
            return;
        end

        parametros.diasOperacionMes  = campoDiasMes.Value;
        parametros.diasOperacionAnio = campoDiasAnio.Value;
        parametros.costoUnitarioCU   = campoCU.Value;
        parametros.horaInicioDia     = campoHoraInicioDia.Value;
        parametros.horaFinDia        = campoHoraFinDia.Value;

        try
            proyecto.cargas = listaCargas;
            resultados = calcularResultadosProyecto(proyecto, parametros);

            etiquetasIndicadores(1).Text = sprintf('%.1f W', resultados.potenciaInstaladaW);
            etiquetasIndicadores(2).Text = sprintf('%.1f W', resultados.demandaMaximaW);
            etiquetasIndicadores(3).Text = sprintf('%.2f kWh/día', resultados.energiaDiariaKWh);
            etiquetasIndicadores(4).Text = sprintf('%.2f kWh/mes', resultados.energiaMensualKWh);
            etiquetasIndicadores(5).Text = sprintf('%.2f kWh/año', resultados.energiaAnualKWh);

            bar(ejesPerfil, 0:23, resultados.perfilHorarioW, 'FaceColor', colorBoton);
            xlim(ejesPerfil, [-0.5 23.5]);
            grid(ejesPerfil, 'on');

            actualizarTablaCargas();  

            etiquetaEstadoResultados.Text = 'Resultados calculados correctamente.';
            etiquetaEstadoResultados.FontColor = [0.13 0.55 0.13];
        catch errorCalculo
            etiquetaEstadoResultados.Text = ['Error: ' errorCalculo.message];
            etiquetaEstadoResultados.FontColor = [0.75 0.1 0.1];
        end
    end

    % TAB 4· INFORME 
    crearEncabezado(tab4, '4. Informe ejecutivo');

    uilabel(tab4, 'Position', [20 545 700 40], ...
        'Text', ['Genera un informe de una página en PDF con los datos del proyecto, ' ...
                 'indicadores, cuadro de cargas, perfil horario y costos.']);

    botonGenerarInforme = uibutton(tab4, 'push', 'Position', [20 490 220 30], ...
        'Text', 'Generar informe (PDF)', 'ButtonPushedFcn', @generarInformeCallback);

    etiquetaEstadoInforme = uilabel(tab4, 'Position', [20 450 850 22], 'Text', '');

    uibutton(tab4, 'push', 'Position', [790 5 120 32], 'Text', '< Atrás', ...
        'ButtonPushedFcn', @(~,~) irATab(tab3));

    rutaIconoInforme = fullfile(rutaAssets, 'icono_informe.png');
    if isfile(rutaIconoInforme)
        uiimage(tab4, 'ImageSource', rutaIconoInforme, 'Position', [610 130 280 280]);
    end

    % cambiar de pestaña con botones
    function irATab(tabDestino)
        cambioPermitido = true;
        tabGroup.SelectedTab = tabDestino;
        cambioPermitido = false;
    end

    function bloquearCambioManualTab(~, event)
        if ~cambioPermitido
            tabGroup.SelectedTab = event.OldValue;
        end
    end

    %Generar informe 
    function generarInformeCallback(~, ~)
        if isempty(resultados)
            etiquetaEstadoInforme.Text = 'Primero calcule los resultados en el Tab 3.';
            etiquetaEstadoInforme.FontColor = [0.75 0.1 0.1];
            return;
        end
        [nombreArchivo, ruta] = uiputfile('*.pdf', 'Guardar informe como', ...
            'Informe de Requerimiento Energético.pdf');
        if isequal(nombreArchivo, 0)
            return;  % el usuario canceló
        end
        try
            generarInforme(proyecto, resultados, parametros, fullfile(ruta, nombreArchivo));
            etiquetaEstadoInforme.Text = ['Informe generado en: ' fullfile(ruta, nombreArchivo)];
            etiquetaEstadoInforme.FontColor = [0.13 0.55 0.13];
        catch errorInforme
            etiquetaEstadoInforme.Text = ['Error al generar el informe: ' errorInforme.message];
            etiquetaEstadoInforme.FontColor = [0.75 0.1 0.1];
        end
    end

end
