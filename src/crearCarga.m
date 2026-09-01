function carga = crearCarga(descripcion, cantidad, potenciaUnitariaW, horario)
% CREARCARGA  
% Entradas:
%   descripcion        - texto
%   cantidad           - entero positivo (N)
%   potenciaUnitariaW  - numérico positivo (W)
%   horario            - vector 1x24 de 0/1
%
% Salida:
%   carga - struct con campos: descripcion, cantidad, potenciaUnitariaW,
%           horario, potenciaTotalW (N*P, informativo por carga)

    [esValido, mensaje] = validarCarga(descripcion, cantidad, potenciaUnitariaW, horario);
    if ~esValido
        error('Reto01:CargaInvalida', mensaje);
    end

    carga.descripcion       = strtrim(descripcion);
    carga.cantidad          = cantidad;
    carga.potenciaUnitariaW = potenciaUnitariaW;
    carga.horario           = double(horario(:)');   % asegura vector fila 1x24
    carga.potenciaTotalW    = cantidad * potenciaUnitariaW;
end
