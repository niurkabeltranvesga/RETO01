function [Em, Ea] = calcularProyeccionConsumo(Ed, diasOperacionMes, diasOperacionAnio)
% CALCULARPROYECCIONCONSUMO  Proyección de consumo mensual y anual
% Entradas:
%   Ed                 - energía diaria, en kWh/día
%   diasOperacionMes   - número de días de operación considerados en el mes
%   diasOperacionAnio  - número de días de operación considerados en el año
% Salidas:
%   Em - energía mensual estimada, en kWh/mes
%   Ea - energía anual estimada, en kWh/año

    if diasOperacionMes <= 0 || diasOperacionAnio <= 0
        error('Reto01:DiasOperacionInvalidos', ...
            'Los días de operación (mes y año) deben ser mayores que cero.');
    end

    Em = Ed * diasOperacionMes;
    Ea = Ed * diasOperacionAnio;
end
