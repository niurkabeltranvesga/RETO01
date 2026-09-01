function generarInforme(proyecto, resultados, parametros, rutaSalida)
% GENERARINFORME 
% Entradas:
%   proyecto    - struct de proyecto (con .cargas lleno)
%   resultados  - struct devuelto por calcularResultadosProyecto.m
%   parametros  - mismos parámetros usados en el cálculo (para mostrar
%                 CU y días de operación en el informe)
%   rutaSalida  - ruta del archivo PDF de salida, ej. 'informe.pdf'

    if isempty(strtrim(rutaSalida))
        error('Reto01:RutaInvalida', 'Debe indicar una ruta de archivo de salida.');
    end

    %Paleta de colores 
    paleta.acento      = [0.96 0.72 0.55];   
    paleta.acentoTexto = [0.80 0.42 0.25];   
    paleta.acentoClaro = [0.99 0.94 0.90];   
    paleta.bordeCard   = [0.93 0.80 0.70];   
    paleta.grisTexto   = [0.40 0.40 0.40];
    paleta.textoOscuro = [0.15 0.15 0.15];
    paleta.bandaPar    = [0.99 0.96 0.93];   

    anchoPagina = 21;
    altoPagina  = 29.7;   
    margen      = 1.3;
    anchoUtil   = anchoPagina - 2*margen;
    DPI         = 200;
    altoPaginaPx = round(altoPagina / 2.54 * DPI);

    altoFilaTabla       = 0.62;
    altoEncabezadoTabla = 0.65;
    altoTituloCargas    = 0.7;
    altoMargenCargas    = 0.5;

    %BLOQUES DE ALTURA FIJA
    altoHeader      = 3.4 + 0.65 + 0.9;
    altoIndicadores = 0.75 + 2.5 + 0.5;
    altoGrafico     = 6.8;
    altoPerfil      = 0.35 + 0.55 + altoGrafico + 0.5;
    altoCostos      = 0.5 + 0.65 + 2.3 + 0.3;

    imgHeader      = renderizarHeader(anchoPagina, altoHeader, margen, proyecto, paleta, DPI);
    imgIndicadores = renderizarIndicadores(anchoPagina, altoIndicadores, margen, anchoUtil, resultados, paleta, DPI);
    imgPerfil      = renderizarPerfil(anchoPagina, altoPerfil, margen, anchoUtil, resultados, paleta, altoGrafico, DPI);
    imgCostos      = renderizarCostos(anchoPagina, altoCostos, margen, anchoUtil, resultados, parametros, paleta, DPI);

    % ARMAR PÁGINAS 
    paginas = {};
    bloquesActuales = {};
    altoActualPx = 0;

    function cerrarPagina()
        if isempty(bloquesActuales)
            return;
        end
        anchoRef = size(bloquesActuales{1}, 2);
        for k = 1:numel(bloquesActuales)
            bloquesActuales{k} = ajustarAncho(bloquesActuales{k}, anchoRef);
        end
        imgPagina = cat(1, bloquesActuales{:});
        if size(imgPagina,1) < altoPaginaPx
            relleno = 255*ones(altoPaginaPx-size(imgPagina,1), size(imgPagina,2), size(imgPagina,3), 'like', imgPagina);
            imgPagina = cat(1, imgPagina, relleno);
        end
        paginas{end+1} = imgPagina; %#ok<AGROW>
        bloquesActuales = {};
        altoActualPx = 0;
    end

    function agregarBloque(img)
        altoBloquePx = size(img,1);
        if altoActualPx + altoBloquePx > altoPaginaPx && ~isempty(bloquesActuales)
            cerrarPagina();
        end
        bloquesActuales{end+1} = img; %#ok<AGROW>
        altoActualPx = altoActualPx + altoBloquePx;
    end

    agregarBloque(imgHeader);
    agregarBloque(imgIndicadores);

    % Tabla de cargas
    numCargas = numel(proyecto.cargas);
    filaInicio = 1;
    esPrimerTramo = true;
    while filaInicio <= numCargas
        espacioDisponibleCm = (altoPaginaPx - altoActualPx) / DPI * 2.54;
        alturaFija = altoTituloCargas*esPrimerTramo + altoEncabezadoTabla + altoMargenCargas;
        filasQueCaben = floor((espacioDisponibleCm - alturaFija) / altoFilaTabla);

        if filasQueCaben < 1
            cerrarPagina();
            espacioDisponibleCm = altoPagina;
            filasQueCaben = floor((espacioDisponibleCm - alturaFija) / altoFilaTabla);
        end

        filasEsteTramo = min(filasQueCaben, numCargas - filaInicio + 1);
        esUltimoTramo = (filaInicio + filasEsteTramo - 1) >= numCargas;

        imgTramo = renderizarCargasTramo(anchoPagina, margen, anchoUtil, proyecto, resultados, paleta, ...
            filaInicio, filasEsteTramo, altoFilaTabla, altoEncabezadoTabla, altoTituloCargas, ...
            altoMargenCargas, esPrimerTramo, esUltimoTramo, DPI);
        agregarBloque(imgTramo);

        filaInicio = filaInicio + filasEsteTramo;
        esPrimerTramo = false;
    end

    agregarBloque(imgPerfil);
    agregarBloque(imgCostos);
    cerrarPagina();

    % EXPORTAR CADA PÁGINA AL PDF
    usaExportgraphics = exist('exportgraphics', 'file') == 2 || exist('exportgraphics', 'builtin') == 5;
    for p = 1:numel(paginas)
        fPdf = figure('Visible', 'off', 'Units', 'centimeters', ...
                       'Position', [0 0 anchoPagina altoPagina], 'Color', 'w', ...
                       'PaperUnits', 'centimeters', 'PaperSize', [anchoPagina altoPagina], ...
                       'PaperPosition', [0 0 anchoPagina altoPagina]);
        axImg = axes('Parent', fPdf, 'Units', 'normalized', 'Position', [0 0 1 1]);
        image(axImg, paginas{p});
        axis(axImg, 'off', 'image');
        drawnow;

        try
            if usaExportgraphics
                if p == 1
                    exportgraphics(axImg, rutaSalida, 'ContentType', 'image');
                else
                    exportgraphics(axImg, rutaSalida, 'ContentType', 'image', 'Append', true);
                end
            else
                if p == 1
                    print(fPdf, rutaSalida, '-dpdf', sprintf('-r%d', DPI));
                else
                    print(fPdf, rutaSalida, '-dpdf', sprintf('-r%d', DPI), '-append');
                end
            end
        catch causaError
            close(fPdf);
            error('Reto01:ErrorExportacion', 'No se pudo exportar la página %d del informe: %s', p, causaError.message);
        end
        close(fPdf);
    end
end

%FUNCIONES DE RENDERIZADO POR BLOQUE

function img = capturarFigura(f, rutaTemp, DPI)
    drawnow;
    print(f, rutaTemp, '-dpng', sprintf('-r%d', DPI));
    close(f);
    img = imread(rutaTemp);
    delete(rutaTemp);
end

function img = renderizarHeader(anchoPagina, altura, margen, proyecto, paleta, DPI)
    f = figure('Visible', 'off', 'Units', 'centimeters', 'Position', [0 0 anchoPagina altura], 'Color', 'w');
    ax = axes('Parent', f, 'Units', 'centimeters', 'Position', [0 0 anchoPagina altura], ...
              'XLim', [0 anchoPagina], 'YLim', [0 altura], 'Visible', 'off');
    hold(ax, 'on');

    altoHeaderBanda = 3.4;
    rectangle(ax, 'Position', [0, altura-altoHeaderBanda, anchoPagina, altoHeaderBanda], ...
        'FaceColor', paleta.acento, 'EdgeColor', 'none');

    if iscell(proyecto.integrantes)
        integrantesTexto = strjoin(proyecto.integrantes, ', ');
    else
        integrantesTexto = proyecto.integrantes;
    end

    yTop = altura;
    text(ax, margen, yTop-1.0, 'Informe de Requerimiento Energético', ...
        'FontSize', 17, 'FontWeight', 'bold', 'Color', paleta.textoOscuro, 'VerticalAlignment', 'top');
    text(ax, margen, yTop-1.75, sprintf('%s', proyecto.nombreProyecto), ...
        'FontSize', 10.5, 'Color', paleta.textoOscuro, 'VerticalAlignment', 'top');
    text(ax, margen, yTop-2.3, sprintf('Integrantes: %s', integrantesTexto), ...
        'FontSize', 8.5, 'Color', [0.40 0.30 0.24], 'VerticalAlignment', 'top');
    text(ax, margen, yTop-2.75, sprintf('Fecha: %s      Contexto: %s', ...
        proyecto.fecha, upper(proyecto.contexto)), ...
        'FontSize', 8.5, 'Color', [0.40 0.30 0.24], 'VerticalAlignment', 'top');

    yIntro = altura - altoHeaderBanda - 0.65;
    text(ax, margen, yIntro, ...
        ['Este informe resume cuánta energía consume el proyecto, cuánto cuesta' ...
         ' y en qué horas del día se usa más electricidad.'], ...
        'FontSize', 8.5, 'FontAngle', 'italic', 'Color', paleta.grisTexto, ...
        'VerticalAlignment', 'top');

    img = capturarFigura(f, [tempname() '.png'], DPI);
end

function img = renderizarIndicadores(anchoPagina, altura, margen, anchoUtil, resultados, paleta, DPI)
    f = figure('Visible', 'off', 'Units', 'centimeters', 'Position', [0 0 anchoPagina altura], 'Color', 'w');
    ax = axes('Parent', f, 'Units', 'centimeters', 'Position', [0 0 anchoPagina altura], ...
              'XLim', [0 anchoPagina], 'YLim', [0 altura], 'Visible', 'off');
    hold(ax, 'on');

    yCursor = altura;
    tituloSeccion(ax, margen, yCursor, 'Indicadores principales', paleta.textoOscuro, paleta.acento);
    yCursor = yCursor - 0.75;

    etiquetasInd = {'Potencia instalada', 'Demanda máxima', 'Energía diaria', ...
                    'Energía mensual', 'Energía anual'};
    valoresInd = { ...
        sprintf('%.0f W', resultados.potenciaInstaladaW), ...
        sprintf('%.0f W', resultados.demandaMaximaW), ...
        sprintf('%.2f kWh', resultados.energiaDiariaKWh), ...
        sprintf('%.1f kWh', resultados.energiaMensualKWh), ...
        sprintf('%.0f kWh', resultados.energiaAnualKWh) ...
    };
    subvaloresInd = { ...
        sprintf('(%.2f kW)', resultados.potenciaInstaladaW/1000), ...
        sprintf('(%.2f kW)', resultados.demandaMaximaW/1000), ...
        'por día', 'por mes', 'por año' ...
    };

    altoTarjetaInd = 2.5;
    nCards = 5;
    espacioCards = 0.3;
    anchoCard = (anchoUtil - (nCards-1)*espacioCards) / nCards;
    for i = 1:nCards
        xIni = margen + (i-1)*(anchoCard + espacioCards);
        yIni = yCursor - altoTarjetaInd;
        rectangle(ax, 'Position', [xIni, yIni, anchoCard, altoTarjetaInd], ...
            'FaceColor', paleta.acentoClaro, 'EdgeColor', paleta.bordeCard, ...
            'Curvature', [0.15 0.12]);
        text(ax, xIni+0.18, yCursor-0.35, etiquetasInd{i}, 'FontSize', 7.3, ...
            'Color', paleta.grisTexto, 'VerticalAlignment', 'top');
        text(ax, xIni+0.18, yCursor-1.05, valoresInd{i}, 'FontSize', 12, ...
            'FontWeight', 'bold', 'Color', paleta.acentoTexto, 'VerticalAlignment', 'top');
        text(ax, xIni+0.18, yCursor-1.75, subvaloresInd{i}, 'FontSize', 7.3, ...
            'Color', paleta.grisTexto, 'VerticalAlignment', 'top');
    end

    img = capturarFigura(f, [tempname() '.png'], DPI);
end

function img = renderizarCargasTramo(anchoPagina, margen, anchoUtil, proyecto, resultados, paleta, ...
                                      filaInicio, numFilas, altoFilaTabla, altoEncabezadoTabla, ...
                                      altoTituloCargas, altoMargenCargas, esPrimerTramo, esUltimoTramo, DPI)
% Dibuja un TRAMO de la tabla de cargas (filas filaInicio..filaInicio+numFilas-1).
% Si no es el primer tramo, se agrega un título "(continuación)" y se
% repite el encabezado de columnas, para que quede claro que es la misma
% tabla continuando en la página siguiente.

    altoTitulo = altoTituloCargas * esPrimerTramo + (~esPrimerTramo) * 0.55;
    altura = altoTitulo + altoEncabezadoTabla + numFilas*altoFilaTabla + 0.15 + altoMargenCargas;

    f = figure('Visible', 'off', 'Units', 'centimeters', 'Position', [0 0 anchoPagina altura], 'Color', 'w');
    ax = axes('Parent', f, 'Units', 'centimeters', 'Position', [0 0 anchoPagina altura], ...
              'XLim', [0 anchoPagina], 'YLim', [0 altura], 'Visible', 'off');
    hold(ax, 'on');

    yCursor = altura;
    if esPrimerTramo
        tituloSeccion(ax, margen, yCursor, 'Cuadro de cargas', paleta.textoOscuro, paleta.acento);
    else
        tituloSeccion(ax, margen, yCursor, 'Cuadro de cargas (continuación)', paleta.textoOscuro, paleta.acento);
    end
    yCursor = yCursor - altoTitulo;

    altoTablaTramo = altoEncabezadoTabla + numFilas*altoFilaTabla + 0.15;
    rectangle(ax, 'Position', [margen, yCursor-altoTablaTramo, anchoUtil, altoTablaTramo], ...
        'FaceColor', 'w', 'EdgeColor', 'none', 'Curvature', [0.03 0.03]);
    rectangle(ax, 'Position', [margen, yCursor-altoEncabezadoTabla, anchoUtil, altoEncabezadoTabla], ...
        'FaceColor', paleta.acento, 'EdgeColor', 'none', 'Curvature', [0.03 0.3]);

    encabezados = {'#', 'Carga', 'Cant.', 'Pot.unit.', 'Pot.total', 'Horas/día', 'Uso'};
    anchosFrac  = [0.045, 0.335, 0.09, 0.145, 0.145, 0.12, 0.12];
    xPosFrac = cumsum([0, anchosFrac(1:end-1)]);
    xPos = margen + 0.25 + xPosFrac * (anchoUtil - 0.4);

    yTextoEncabezado = yCursor - altoEncabezadoTabla/2;
    for i = 1:numel(encabezados)
        text(ax, xPos(i), yTextoEncabezado, encabezados{i}, 'FontSize', 8, ...
            'FontWeight', 'bold', 'Color', paleta.textoOscuro, 'VerticalAlignment', 'middle');
    end

    yFilaTope = yCursor - altoEncabezadoTabla;
    for idx = 1:numFilas
        i = filaInicio + idx - 1;
        c = proyecto.cargas(i);
        horasUso = sum(c.horario);
        yCentroFila = yFilaTope - altoFilaTabla/2;

        if mod(idx,2) == 0
            rectangle(ax, 'Position', [margen, yFilaTope-altoFilaTabla, anchoUtil, altoFilaTabla], ...
                'FaceColor', paleta.bandaPar, 'EdgeColor', 'none');
        end

        fila = { num2str(i), c.descripcion, num2str(c.cantidad), ...
                 sprintf('%.0f W', c.potenciaUnitariaW), sprintf('%.0f W', c.potenciaTotalW), ...
                 sprintf('%d h', horasUso), capitalizar(resultados.clasificacionCargas{i}) };
        for j = 1:numel(fila)
            text(ax, xPos(j), yCentroFila, fila{j}, 'FontSize', 7.8, ...
                'Color', paleta.textoOscuro, 'VerticalAlignment', 'middle', 'Interpreter', 'none');
        end
        yFilaTope = yFilaTope - altoFilaTabla;
    end

    img = capturarFigura(f, [tempname() '.png'], DPI); %#ok<NASGU>
    if ~esUltimoTramo
        % (reservado para futura anotación "continúa en la página siguiente")
    end
end

function img = renderizarPerfil(anchoPagina, altura, margen, anchoUtil, resultados, paleta, altoGrafico, DPI)
    f = figure('Visible', 'off', 'Units', 'centimeters', 'Position', [0 0 anchoPagina altura], 'Color', 'w');
    axTitulo = axes('Parent', f, 'Units', 'centimeters', 'Position', [0 0 anchoPagina altura], ...
              'XLim', [0 anchoPagina], 'YLim', [0 altura], 'Visible', 'off');
    hold(axTitulo, 'on');

    yCursor = altura;
    tituloSeccion(axTitulo, margen, yCursor, 'Perfil horario de demanda (24 horas)', paleta.textoOscuro, paleta.acento);
    yCursor = yCursor - 0.35;

    text(axTitulo, margen, yCursor, ...
        'Muestra en qué horas del día se concentra el mayor consumo de energía.', ...
        'FontSize', 7.8, 'FontAngle', 'italic', 'Color', paleta.grisTexto, ...
        'VerticalAlignment', 'top');
    yCursor = yCursor - 0.55;

    axPerfil = axes('Parent', f, 'Units', 'centimeters', ...
                     'Position', [margen+0.4 yCursor-altoGrafico anchoUtil-0.8 altoGrafico]);
    horas = 0:23;
    bar(axPerfil, horas, resultados.perfilHorarioW, 'FaceColor', paleta.acentoTexto, ...
        'EdgeColor', 'none', 'BarWidth', 0.75);
    xlim(axPerfil, [-0.5 23.5]);
    xticks(axPerfil, 0:2:23);
    xlabel(axPerfil, 'Hora del día', 'FontSize', 8.5);
    ylabel(axPerfil, 'Potencia [W]', 'FontSize', 8.5);
    grid(axPerfil, 'on');
    set(axPerfil, 'GridAlpha', 0.15, 'Box', 'off', 'FontSize', 7.8, 'Color', 'none');

    img = capturarFigura(f, [tempname() '.png'], DPI);
end

function img = renderizarCostos(anchoPagina, altura, margen, anchoUtil, resultados, parametros, paleta, DPI)
    f = figure('Visible', 'off', 'Units', 'centimeters', 'Position', [0 0 anchoPagina altura], 'Color', 'w');
    ax = axes('Parent', f, 'Units', 'centimeters', 'Position', [0 0 anchoPagina altura], ...
              'XLim', [0 anchoPagina], 'YLim', [0 altura], 'Visible', 'off');
    hold(ax, 'on');

    yCursor = altura;
    tituloSeccion(ax, margen, yCursor, 'Costos estimados', paleta.textoOscuro, paleta.acento);
    yCursor = yCursor - 0.5;

    text(ax, margen, yCursor, sprintf('Calculado con un costo de %s por cada kWh consumido.', ...
        [formatoPesosCOP(parametros.costoUnitarioCU) ' / kWh']), ...
        'FontSize', 8.2, 'Color', paleta.grisTexto, 'VerticalAlignment', 'top');
    yCursor = yCursor - 0.65;

    altoTarjetaCosto = 2.3;
    etiquetasCosto = {'Costo diario', 'Costo mensual', 'Costo anual'};
    valoresCosto = { formatoPesosCOP(resultados.costoDiario), ...
                     formatoPesosCOP(resultados.costoMensual), ...
                     formatoPesosCOP(resultados.costoAnual) };
    nCardsCosto = 3;
    espacioCards = 0.3;
    anchoCardCosto = (anchoUtil - (nCardsCosto-1)*espacioCards) / nCardsCosto;
    for i = 1:nCardsCosto
        xIni = margen + (i-1)*(anchoCardCosto + espacioCards);
        yIni = yCursor - altoTarjetaCosto;
        rectangle(ax, 'Position', [xIni, yIni, anchoCardCosto, altoTarjetaCosto], ...
            'FaceColor', paleta.acentoClaro, 'EdgeColor', paleta.bordeCard, ...
            'Curvature', [0.15 0.15]);
        text(ax, xIni+0.22, yCursor-0.4, etiquetasCosto{i}, 'FontSize', 8, ...
            'Color', paleta.grisTexto, 'VerticalAlignment', 'top');
        text(ax, xIni+0.22, yCursor-1.15, valoresCosto{i}, 'FontSize', 13.5, ...
            'FontWeight', 'bold', 'Color', paleta.acentoTexto, 'VerticalAlignment', 'top');
    end

    img = capturarFigura(f, [tempname() '.png'], DPI);
end

% FUNCIONES AUXILIARES GENERALES

function imgAjustada = ajustarAncho(img, anchoRef)
    anchoActual = size(img, 2);
    if anchoActual == anchoRef
        imgAjustada = img;
    elseif anchoActual > anchoRef
        imgAjustada = img(:, 1:anchoRef, :);
    else
        relleno = 255 * ones(size(img,1), anchoRef-anchoActual, size(img,3), 'like', img);
        imgAjustada = cat(2, img, relleno);
    end
end

function tituloSeccion(ax, x, y, texto, color, colorBarra)
    rectangle(ax, 'Position', [x, y-0.42, 0.12, 0.42], 'FaceColor', colorBarra, ...
        'EdgeColor', 'none');
    text(ax, x+0.28, y, texto, 'FontSize', 11.5, 'FontWeight', 'bold', ...
        'Color', color, 'VerticalAlignment', 'top');
end

function texto = formatoPesosCOP(valor)
    valor = round(valor);
    signo = '';
    if valor < 0
        signo = '-';
        valor = abs(valor);
    end
    digitos = sprintf('%d', valor);
    partes = {};
    while length(digitos) > 3
        partes = [{digitos(end-2:end)}, partes]; %#ok<AGROW>
        digitos = digitos(1:end-3);
    end
    partes = [{digitos}, partes];
    texto = [signo '$ ' strjoin(partes, '.')];
end

function texto = capitalizar(palabra)
    if isempty(palabra)
        texto = palabra;
    else
        texto = [upper(palabra(1)) palabra(2:end)];
    end
end
