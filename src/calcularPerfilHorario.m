function perfilHorario = calcularPerfilHorario(cargas)
% CALCULARPERFILHORARIO  P(h) = Sum de potencia de las cargas activas en la hora h
% Entrada:
%   cargas - arreglo de structs de carga
% Salida:
%   perfilHorario - vector 1x24 con la potencia total [W] para cada hora
% (posición k corresponde a la hora k-1, es decir 0..23)

    perfilHorario = zeros(1, 24);
    for i = 1:numel(cargas)
        c = cargas(i);
        perfilHorario = perfilHorario + c.horario * c.potenciaTotalW;
    end
end
