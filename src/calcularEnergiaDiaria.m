function Ed = calcularEnergiaDiaria(perfilHorario)
% CALCULARENERGIADIARIA  Ed = Sum(P(h)*Δt) / 1000 [kWh/día] 
% Con resolución de 1 hora, Δt = 1 h, por lo que Ed equivale a la suma del
% perfil horario en Wh, convertida a kWh.
% Entrada:
%   perfilHorario - vector 1x24 [W]
% Salida:
%   Ed - energía diaria, en kWh/día

    deltaT_horas = 1;
    Ed = sum(perfilHorario) * deltaT_horas / 1000;
end
