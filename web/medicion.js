// medicion.js
//
// Lectura de la hoja de datos del nodo de medición (ESP32 + pinzas SCT-013
// + sensor de voltaje). Convierte una serie de lecturas en el tiempo en el
// perfil horario de 24 valores que ya usa el resto de la aplicación.
//
// Es un módulo de funciones puras: no toca el DOM ni la interfaz. La app
// sigue funcionando igual si nunca se carga una medición; este archivo solo
// aporta una segunda forma de obtener el perfil.
//
// Formato esperado (lo define la aplicación, el firmware se acomoda):
//
//     fecha_hora,potencia_w
//     2026-10-02 00:00,1650.0
//     2026-10-02 00:10,1648.2
//     ...
//
// Si no viene la columna de potencia pero sí corrientes y voltaje, se estima
// la potencia y se avisa de que es un valor aparente (VA), no real (W).

(function (raiz) {
    'use strict';

    // Nombres de columna aceptados. Se comparan ya normalizados (sin tildes,
    // en minúsculas y con guion bajo), para tolerar encabezados en español,
    // en inglés o los que pone Google Sheets por su cuenta.
    const ALIAS_COLUMNAS = {
        hora: ['fecha_hora', 'fechahora', 'marca_temporal', 'timestamp', 'fecha', 'hora', 'datetime', 'time'],
        potencia: ['potencia_w', 'potencia_total_w', 'potencia', 'p_w', 'watts', 'w'],
        corriente1: ['corriente_l1_a', 'corriente_l1', 'corriente_1', 'corriente1', 'i1', 'il1'],
        corriente2: ['corriente_l2_a', 'corriente_l2', 'corriente_2', 'corriente2', 'i2', 'il2'],
        voltaje: ['voltaje_v', 'voltaje', 'tension', 'v', 'volt', 'volts'],
    };

    function normalizarNombre(texto) {
        return String(texto === null || texto === undefined ? '' : texto)
            .replace(/^﻿/, '')
            .trim()
            .toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes
            .replace(/[\s.\-/]+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
    }

    // El CSV que exporta Google Sheets en configuración regional de Colombia
    // usa punto y coma como separador y coma como decimal. El de configuración
    // inglesa usa coma y punto. Se detecta cuál es por el encabezado.
    function detectarDelimitador(lineaEncabezado) {
        const cuenta = s => (lineaEncabezado.match(new RegExp('\\' + s, 'g')) || []).length;
        const puntoYComa = cuenta(';');
        const coma = cuenta(',');
        const tabulador = (lineaEncabezado.match(/\t/g) || []).length;
        if (tabulador > puntoYComa && tabulador > coma) return '\t';
        if (puntoYComa > 0 && puntoYComa >= coma) return ';';
        return ',';
    }

    function partirLinea(linea, delimitador) {
        const campos = [];
        let actual = '';
        let entreComillas = false;
        for (let i = 0; i < linea.length; i++) {
            const caracter = linea[i];
            if (caracter === '"') {
                if (entreComillas && linea[i + 1] === '"') { actual += '"'; i++; }
                else entreComillas = !entreComillas;
            } else if (caracter === delimitador && !entreComillas) {
                campos.push(actual);
                actual = '';
            } else {
                actual += caracter;
            }
        }
        campos.push(actual);
        return campos.map(c => c.trim());
    }

    function aNumero(valor, decimalEsComa) {
        if (typeof valor === 'number') return isFinite(valor) ? valor : NaN;
        if (valor === null || valor === undefined) return NaN;
        let texto = String(valor).trim().replace(/"/g, '').replace(/\s/g, '');
        if (texto === '') return NaN;
        if (decimalEsComa) {
            texto = texto.replace(/\./g, '').replace(',', '.');   // 1.234,56 -> 1234.56
        } else if (/^-?\d+,\d+$/.test(texto)) {
            texto = texto.replace(',', '.');                       // 123,45 entre comillas
        }
        const numero = Number(texto);
        return isFinite(numero) ? numero : NaN;
    }

    // Saca la hora del día (0 a 23) de una marca de tiempo en casi cualquier
    // formato: ISO, dd/mm/aaaa hh:mm, con a.m./p.m., o un número suelto.
    function extraerHora(valor) {
        if (typeof valor === 'number' && isFinite(valor)) {
            const h = Math.floor(valor);
            return (h >= 0 && h <= 23) ? h : null;
        }
        const texto = String(valor === null || valor === undefined ? '' : valor).trim().replace(/"/g, '');
        if (texto === '') return null;

        const conHora = texto.match(/(\d{1,2}):(\d{2})/);
        if (conHora) {
            let hora = Number(conHora[1]);
            const meridiano = texto.toLowerCase().match(/\b([ap])\.?\s?m\.?/);
            if (meridiano) {
                if (meridiano[1] === 'p' && hora < 12) hora += 12;
                if (meridiano[1] === 'a' && hora === 12) hora = 0;
            }
            return (hora >= 0 && hora <= 23) ? hora : null;
        }

        const soloNumero = texto.match(/^(\d{1,2})$/);
        if (soloNumero) {
            const hora = Number(soloNumero[1]);
            return (hora >= 0 && hora <= 23) ? hora : null;
        }
        return null;
    }

    function ubicarColumnas(encabezados) {
        const normalizados = encabezados.map(normalizarNombre);
        const indices = {};
        Object.keys(ALIAS_COLUMNAS).forEach(campo => {
            indices[campo] = -1;
            for (const alias of ALIAS_COLUMNAS[campo]) {
                const i = normalizados.indexOf(alias);
                if (i !== -1) { indices[campo] = i; break; }
            }
        });
        return indices;
    }

    // Potencia de una lectura. Prioridad: la columna de potencia que mande el
    // firmware. Si no está, se estima a partir de corrientes y voltaje.
    //
    // El voltaje del montaje se mide ENTRE LÍNEAS (L1-L2), así que la tensión
    // de cada rama respecto al neutro es la mitad. Con eso, P = (V/2)(I1+I2)
    // vale tanto para cargas de 110 V como para las de 220 V, que aparecen por
    // igual en las dos pinzas.
    function potenciaDeLectura(valores, indices, decimalEsComa) {
        if (indices.potencia !== -1) {
            const potencia = aNumero(valores[indices.potencia], decimalEsComa);
            if (!isNaN(potencia)) return { potenciaW: potencia, estimada: false };
        }
        const i1 = indices.corriente1 !== -1 ? aNumero(valores[indices.corriente1], decimalEsComa) : NaN;
        const i2 = indices.corriente2 !== -1 ? aNumero(valores[indices.corriente2], decimalEsComa) : 0;
        const v = indices.voltaje !== -1 ? aNumero(valores[indices.voltaje], decimalEsComa) : NaN;
        if (!isNaN(i1) && !isNaN(v)) {
            const corrienteTotal = i1 + (isNaN(i2) ? 0 : i2);
            return { potenciaW: (v / 2) * corrienteTotal, estimada: true };
        }
        return { potenciaW: NaN, estimada: false };
    }

    function parsearCSV(texto) {
        const lineas = texto.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim() !== '');
        if (lineas.length < 2) {
            throw new Error('El archivo no tiene datos: se esperaba una fila de encabezados y al menos una lectura.');
        }

        const delimitador = detectarDelimitador(lineas[0]);
        const decimalEsComa = delimitador === ';';
        const encabezados = partirLinea(lineas[0], delimitador);
        const indices = ubicarColumnas(encabezados);

        if (indices.hora === -1) {
            throw new Error('No se encontró la columna de fecha u hora. Se esperaba una llamada "fecha_hora", "hora" o "marca temporal".');
        }
        if (indices.potencia === -1 && (indices.corriente1 === -1 || indices.voltaje === -1)) {
            throw new Error('No se encontró la columna "potencia_w", ni corriente y voltaje para estimarla.');
        }

        const lecturas = [];
        let filasDescartadas = 0;
        let algunaEstimada = false;

        for (let i = 1; i < lineas.length; i++) {
            const valores = partirLinea(lineas[i], delimitador);
            const hora = extraerHora(valores[indices.hora]);
            const { potenciaW, estimada } = potenciaDeLectura(valores, indices, decimalEsComa);
            if (hora === null || isNaN(potenciaW) || potenciaW < 0) { filasDescartadas++; continue; }
            if (estimada) algunaEstimada = true;
            lecturas.push({ hora, potenciaW });
        }

        return { lecturas, filasDescartadas, potenciaEstimada: algunaEstimada, formato: 'csv', delimitador };
    }

    function parsearJSON(texto) {
        let datos;
        try {
            datos = JSON.parse(texto);
        } catch (err) {
            throw new Error('El archivo parece JSON pero no se pudo interpretar: ' + err.message);
        }

        // Caso directo: el equipo ya entrega el perfil de 24 valores.
        const perfilDirecto = Array.isArray(datos) && datos.length === 24 && datos.every(v => typeof v === 'number')
            ? datos
            : (datos && Array.isArray(datos.perfilW) ? datos.perfilW : null);
        if (perfilDirecto) {
            if (perfilDirecto.length !== 24 || !perfilDirecto.every(v => typeof v === 'number' && isFinite(v) && v >= 0)) {
                throw new Error('El perfil entregado debe tener 24 valores numéricos no negativos.');
            }
            return { perfilDirecto: perfilDirecto.slice(), lecturas: [], filasDescartadas: 0, potenciaEstimada: false, formato: 'json' };
        }

        const filas = Array.isArray(datos) ? datos : (Array.isArray(datos.lecturas) ? datos.lecturas : null);
        if (!filas) {
            throw new Error('El JSON debe ser una lista de lecturas, un objeto con "lecturas", o un "perfilW" de 24 valores.');
        }

        const lecturas = [];
        let filasDescartadas = 0;
        let algunaEstimada = false;

        filas.forEach(fila => {
            const claves = Object.keys(fila || {});
            const indices = ubicarColumnas(claves);
            const valores = claves.map(k => fila[k]);
            const hora = indices.hora !== -1 ? extraerHora(valores[indices.hora]) : null;
            const { potenciaW, estimada } = potenciaDeLectura(valores, indices, false);
            if (hora === null || isNaN(potenciaW) || potenciaW < 0) { filasDescartadas++; return; }
            if (estimada) algunaEstimada = true;
            lecturas.push({ hora, potenciaW });
        });

        return { lecturas, filasDescartadas, potenciaEstimada: algunaEstimada, formato: 'json' };
    }

    // Promedia todas las lecturas que caen en la misma hora del día. Si el
    // archivo trae varios días, el promedio los abarca a todos, que es
    // justamente lo que se quiere para un perfil representativo.
    function construirPerfilHorario(lecturas) {
        const suma = new Array(24).fill(0);
        const cuenta = new Array(24).fill(0);
        lecturas.forEach(l => { suma[l.hora] += l.potenciaW; cuenta[l.hora]++; });
        const perfilW = suma.map((s, h) => (cuenta[h] > 0 ? Number((s / cuenta[h]).toFixed(3)) : 0));
        const horasSinDato = [];
        cuenta.forEach((c, h) => { if (c === 0) horasSinDato.push(h); });
        return { perfilW, lecturasPorHora: cuenta, horasSinDato };
    }

    // Punto de entrada: recibe el contenido del archivo y devuelve el perfil
    // de 24 valores más todo lo que la interfaz necesita para informar al
    // usuario qué se leyó y con qué salvedades.
    function perfilDesdeHojaDeDatos(contenido) {
        const texto = String(contenido === null || contenido === undefined ? '' : contenido).replace(/^﻿/, '');
        if (texto.trim() === '') throw new Error('El archivo está vacío.');

        const primerCaracter = texto.trim()[0];
        const resultado = (primerCaracter === '[' || primerCaracter === '{')
            ? parsearJSON(texto.trim())
            : parsearCSV(texto);

        const avisos = [];

        if (resultado.perfilDirecto) {
            return {
                perfilW: resultado.perfilDirecto,
                totalLecturas: 24,
                lecturasPorHora: new Array(24).fill(1),
                horasSinDato: [],
                filasDescartadas: 0,
                potenciaEstimada: false,
                formato: resultado.formato,
                avisos,
            };
        }

        if (resultado.lecturas.length === 0) {
            throw new Error('No se encontró ninguna lectura válida en el archivo. Revise que la columna de hora y la de potencia tengan datos.');
        }

        const { perfilW, lecturasPorHora, horasSinDato } = construirPerfilHorario(resultado.lecturas);

        if (resultado.potenciaEstimada) {
            avisos.push('La potencia se estimó a partir de corriente y voltaje, así que es potencia aparente (VA) y no potencia real (W): con motores como neveras o aires el consumo puede quedar sobrestimado. Para un resultado exacto, el equipo debe enviar la columna "potencia_w" calculada con las formas de onda.');
        }
        if (horasSinDato.length > 0) {
            const lista = horasSinDato.map(h => String(h).padStart(2, '0') + ':00').join(', ');
            avisos.push('No hay lecturas en estas horas, que quedaron en 0 W: ' + lista + '. Conviene medir un día completo.');
        }
        if (resultado.filasDescartadas > 0) {
            avisos.push('Se descartaron ' + resultado.filasDescartadas + ' fila(s) por no tener una hora o una potencia válidas.');
        }

        return {
            perfilW,
            totalLecturas: resultado.lecturas.length,
            lecturasPorHora,
            horasSinDato,
            filasDescartadas: resultado.filasDescartadas,
            potenciaEstimada: resultado.potenciaEstimada,
            formato: resultado.formato,
            avisos,
        };
    }

    const Medicion = {
        perfilDesdeHojaDeDatos,
        construirPerfilHorario,
        extraerHora,
        normalizarNombre,
        detectarDelimitador,
        partirLinea,
        aNumero,
    };

    // Compatible con Node.js (pruebas con `require`) y con el navegador.
    if (typeof module !== 'undefined' && module.exports) module.exports = Medicion;
    if (raiz) raiz.Medicion = Medicion;

})(typeof window !== 'undefined' ? window : null);
