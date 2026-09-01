function Pmax = calcularDemandaMaxima(perfilHorario)
% CALCULARDEMANDAMAXIMA  Pmax = max[P(h)] para h = 0..23
% Entrada:
%   perfilHorario - vector 1x24 [W] 
% Salida:
%   Pmax - demanda máxima simultánea, en W

    Pmax = max(perfilHorario);
end
