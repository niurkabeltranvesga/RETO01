function clasificacion = clasificarCarga(horario, horaInicioDia, horaFinDia)
% CLASIFICARCARGA  
% Entradas:
%   horario        - vector 1x24 de 0/1 (horas 0..23)
%   horaInicioDia  - hora en que inicia el periodo diurno 
%   horaFinDia     - hora en que termina el periodo diurno, EXCLUSIVE
%                    (opcional, por defecto 18)
% Salida:
%   clasificacion - 'diurna', 'nocturna' o 'mixta'

    if nargin < 2 || isempty(horaInicioDia)
        horaInicioDia = 6;
    end
    if nargin < 3 || isempty(horaFinDia)
        horaFinDia = 18;
    end

    horas = 0:23;

    if horaInicioDia < horaFinDia
        esHoraDiurna = (horas >= horaInicioDia) & (horas < horaFinDia);
    else
        % Por si se configura un periodo diurno que cruza la medianoche
        esHoraDiurna = (horas >= horaInicioDia) | (horas < horaFinDia);
    end

    horarioActivo = horario == 1;

    usaDia   = any(horarioActivo & esHoraDiurna);
    usaNoche = any(horarioActivo & ~esHoraDiurna);

    if usaDia && usaNoche
        clasificacion = 'mixta';
    elseif usaDia
        clasificacion = 'diurna';
    else
        clasificacion = 'nocturna';
    end
end
