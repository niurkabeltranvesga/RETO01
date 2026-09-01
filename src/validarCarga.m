function [esValido, mensaje] = validarCarga(descripcion, cantidad, potenciaUnitariaW, horario)
% VALIDARCARGA 
% Entradas:
%   descripcion        - texto, no vacío
%   cantidad           - entero positivo (N)
%   potenciaUnitariaW  - numérico positivo (W)
%   horario            - vector 1x24 con valores 0 o 1 (una posición por hora, 0..23)
% Salidas:
%   esValido - true/false
%   mensaje  - texto concreto indicando qué dato corregir (vacío si es válido)


    esValido = true;
    mensaje = '';

    if isempty(strtrim(descripcion))
        esValido = false;
        mensaje = 'La descripción de la carga no puede estar vacía.';
        return;
    end


    if ~isnumeric(cantidad) || isempty(cantidad) || cantidad <= 0 || mod(cantidad,1) ~= 0
        esValido = false;
        mensaje = 'La cantidad debe ser un número entero mayor que cero.';
        return;
    end

    if ~isnumeric(potenciaUnitariaW) || isempty(potenciaUnitariaW) || potenciaUnitariaW <= 0
        esValido = false;
        mensaje = 'La potencia unitaria (W) debe ser mayor que cero.';
        return;
    end

 
    if isempty(horario) || numel(horario) ~= 24
        esValido = false;
        mensaje = 'El horario debe tener exactamente 24 valores (uno por cada hora, 0 a 23).';
        return;
    end

    valoresValidos = all(horario == 0 | horario == 1);
    if ~valoresValidos
        esValido = false;
        mensaje = 'El horario solo admite valores 0 (apagado) o 1 (encendido) por hora.';
        return;
    end

    if all(horario == 0)
        esValido = false;
        mensaje = 'La carga no tiene ninguna hora de uso activa. Verifique el horario.';
        return;
    end
end
