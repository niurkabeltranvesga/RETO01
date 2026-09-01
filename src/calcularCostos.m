function [costoDiario, costoMensual, costoAnual] = calcularCostos(Ed, Em, Ea, CU)
% Entradas:
%   Ed - energía diaria [kWh/día]
%   Em - energía mensual [kWh/mes]
%   Ea - energía anual [kWh/año]
%   CU - costo unitario [$/kWh]
% Salidas:
%   costoDiario, costoMensual, costoAnual

    if CU < 0
        error('Reto01:CostoUnitarioInvalido', 'El costo unitario (CU) no puede ser negativo.');
    end

    costoDiario  = Ed * CU;
    costoMensual = Em * CU;
    costoAnual   = Ea * CU;
end
