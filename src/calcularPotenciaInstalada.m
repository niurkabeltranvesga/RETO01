function Pinst = calcularPotenciaInstalada(cargas)
% CALCULARPOTENCIAINSTALADA  Pinst = Sum(Ni * Pi) 
% Entrada:
%   cargas - arreglo de structs de carga (ver crearCarga.m)
% Salida:
%   Pinst - potencia instalada total, en W

    Pinst = 0;
    for i = 1:numel(cargas)
        Pinst = Pinst + cargas(i).potenciaTotalW;
    end
end
