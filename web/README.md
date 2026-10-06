# Aplicación web ESFV: consumo energético y generador fotovoltaico

Universidad del Magdalena · Electiva ESFV  
Integrantes: Niurka Beltrán Vesga, Miguel Ángel Bernal López

**Versión:** 2.0 (Reto 01: caracterización del consumo · Reto 02: dimensionamiento del generador fotovoltaico)

## Qué hace

La aplicación funciona en cinco pasos:

1. **Proyecto**: nombre, integrantes, contexto (aislado o conectado a la red) y parámetros de operación.
2. **Cargas**: cada equipo con su potencia, cantidad y horario de uso en 24 horas. 

**NOTA: La parte de cargar una medición real (CSV del ESP32), es el plus que se esta trabajando para el curso de proyecto culminante.**

3. **Resultados**: energía diaria, mensual y anual, perfil de potencia por hora, consumo diurno y nocturno, y costo.
4. **Generador**: toma la energía diaria y el perfil del paso 3 sin volver a escribirlos. Los combina con el recurso solar del sitio y con el catálogo de módulos, y calcula:
   - la potencia pico,
   - el número de módulos,
   - la configuración en serie y en paralelo,
   - las tensiones y corrientes corregidas por temperatura,
   - la corriente de diseño según NTC 2050,
   - el área ocupada,
   - la energía generada.

   La potencia pico se puede calcular con el método de referencia del TdR (predeterminado) o con el **método propio** del grupo: balance día/noche con factor de crecimiento y meta de cobertura (ver `docs/METODO_PROPIO.md`).

   Evalúa todo el catálogo y elige el módulo según el criterio indicado (menor excedente, menor número de módulos o menor área) o según una elección manual.
5. **Informe**: genera un PDF. La página 1 es el consumo (Reto 01) y las páginas 2 y 3 son el dimensionamiento del generador, con fuentes, fechas de consulta y supuestos del cálculo.

El proyecto completo (cargas, parámetros y configuración del generador) se puede guardar y volver a abrir como archivo `.json`.

## Cómo ejecutarla

No necesita instalación ni servidor propio.

- **Opción 1, un solo archivo:** abrir `index_standalone.html` con doble clic. Tiene todo incrustado: estilos, código, catálogo de módulos y base de sitios.
- **Opción 2, carpeta completa:** abrir `index.html`.
  - Con doble clic, los datos se leen de `datos/datos_respaldo.js`.
  - Si se sirve con un servidor local, se leen directamente de `datos/*.json`. Por ejemplo: `python3 -m http.server`, y luego abrir `http://localhost:8000`.

Se recomienda un navegador actualizado (Chrome, Edge o Firefox).

**Para ejecutar el caso de prueba del TdR:** en el Paso 1, botón "Cargar proyecto desde archivo", abrir `ejemplos/caso_prueba_alta_guajira.json`. Se cargan las 8 cargas de la estación de la Alta Guajira, el sitio del caso de prueba y el módulo de referencia, y el generador queda dimensionado. Luego, en el Paso 5, "Generar informe (PDF)".

## Dependencias

| Dependencia | Uso | Cómo se obtiene |
|---|---|---|
| jsPDF 2.5.1 | Generar el informe PDF | Se carga desde cdnjs.cloudflare.com, así que el informe necesita conexión a internet |
| Node.js (opcional) | Solo para correr las pruebas automáticas | — |
| jsdom (opcional) | Prueba de la interfaz completa (`test_jsdom.js`) | `npm install jsdom` |
| Python 3 (opcional) | Regenerar `index_standalone.html` y `datos/datos_respaldo.js` | — |

El resto está escrito en JavaScript sin librerías.

## Datos de entrada (catálogo y sitios)

- `datos/catalogo_modulos.json`: catálogo externo y editable con **4 módulos comerciales reales** (LONGi LR5-54HTB-450M, Trina Solar TSM-DEG19C.20 550 W, Canadian Solar CS6.2-66TB-625HP y LONGi LR8-66HVD-650M), tomados de sus hojas de datos. Cada uno declara su fuente (URL de la ficha técnica) y la fecha de consulta. Incluye además el módulo de referencia del TdR (sección 7.2), marcado como `referenciaTdR`: no es un producto comercial, por lo que la selección automática no lo considera y solo se puede elegir de forma manual para reproducir el caso de prueba.
- `datos/base_sitios.json`: base de datos local con **6 casos documentados**. Cada uno registra nombre, latitud, longitud, irradiación diaria media anual, los doce valores mensuales, inclinación, azimut, fuente y fecha de consulta.
  - 5 sitios consultados en PVGIS-5 (base PVGIS-ERA5, inclinación 12°, azimut 0°): Nazareth (Alta Guajira), Universidad del Magdalena (Santa Marta), IED San José (Pueblo Viejo), Aeropuerto Alfonso López (Valledupar) y UIS (Bucaramanga). Los valores mensuales de PVGIS (kWh/m²·mes) se convirtieron a kWh/m²·día dividiendo por los días de cada mes.
  - El caso de prueba del TdR (sección 7.1), marcado como `casoPrueba`, con los valores declarados por el TdR: 5,8 kWh/m²·día anual y 5,2 en el mes crítico. El TdR no entrega los doce valores mensuales de este caso, por eso esa entrada no los tiene. Para el mismo lugar, la entrada de Nazareth consultada en PVGIS sí trae los doce meses.

Para actualizar los datos hay dos caminos:

- Editar los `.json` y ejecutar `python3 build_standalone.py`.
- Dentro de la aplicación, usar el botón **"Cargar catálogo o base de sitios (.json)"**. Esto no modifica el código.

## Consulta en línea del recurso solar (API)

En el paso 4 hay un bloque opcional, "Consultar otra ubicación en línea (PVGIS)", para consultar la API de PVGIS (v5.3 del JRC, servicio `PVcalc`) con latitud, longitud, inclinación y azimut.

- **Credenciales:** PVGIS no pide clave ni usuario. La aplicación no usa ni publica credenciales de ningún tipo.
- **Qué hace falta para que la API funcione:** conexión a internet y un intermediario (un servidor) que haga la petición a PVGIS en nombre de la página. La documentación oficial de PVGIS indica que su API no admite consultas directas desde páginas web (AJAX), así que desde el navegador la consulta no se completa.
- **Decisión de diseño:** esta versión no incluye ese intermediario. Se priorizó que cualquier persona pueda usar la aplicación con solo abrirla, sin instalar programas ni ejecutar comandos. Por eso el recurso solar se toma de la base de datos local, y la consulta en línea queda como contingencia documentada.
- **Contingencia:** cuando la consulta no se completa (por la restricción anterior, sin conexión, error de PVGIS o tiempo agotado de 15 s), la aplicación:
  1. sigue con el sitio seleccionado de la base local,
  2. muestra un aviso con el motivo,
  3. deja la contingencia declarada en el informe PDF (motivo, fecha y sitio usado).
- **Caché:** cada consulta exitosa se guarda durante la sesión; repetir las mismas coordenadas no vuelve a llamar al servicio.

El dimensionamiento nunca depende de que la API responda.

Las alternativas evaluadas para la consulta en línea, por qué se descartaron y la decisión tomada están documentadas en `docs/DECISIONES.md`.

## Pruebas automáticas

Desde la carpeta principal de la aplicación, con Node.js (para la última, instalar antes `npm install jsdom`):

```
node test/test_motorCalculo.js       # motor de consumo (coincide con MATLAB)
node test/test_medicion.js           # carga de mediciones del ESP32
node test/test_dimensionamiento.js   # dimensionamiento: reproduce los valores de referencia del TdR
node test/test_jsdom.js              # recorrido completo por la interfaz
```

## Estructura de archivos

```
index.html               Interfaz (5 pasos)
index_standalone.html    Versión de un solo archivo (generada)
styles.css               Estilos
motorCalculo.js          Lógica: cálculo del consumo (funciones puras)
medicion.js              Lógica: lectura y comparación de mediciones del ESP32
dimensionamiento.js      Lógica: cálculo del generador fotovoltaico (funciones puras)
generador.js             Interfaz del paso 4 y consulta a PVGIS
informe.js               Informe PDF
app.js                   Control general de la interfaz
datos/                   Catálogo de módulos, base de sitios y su copia de respaldo
ejemplos/                Caso de prueba del TdR, caso propio (Distrimedical), ejemplo de 8 cargas y medición de ejemplo del ESP32
informes/                Informes generados por la aplicación (caso de prueba y Reto 01 de Distrimedical)
assets/                  Imagen de fondo
build_standalone.py      Genera la versión de un solo archivo
docs/                    Documentación: este README, DECISIONES.md (decisiones de diseño) y METODO_PROPIO.md (método propio para la potencia pico)
test/                    Pruebas automáticas
```

La lógica de cálculo (`motorCalculo.js`, `medicion.js`, `dimensionamiento.js`) está separada de la interfaz: son funciones puras que no tocan la página, y por eso se pueden probar solas con Node.js.

## Documentación

- `docs/DECISIONES.md`: decisión de diseño sobre la consulta en línea al recurso solar, con las alternativas evaluadas y por qué se descartaron.
- `docs/METODO_PROPIO.md`: método propio para la potencia pico (balance día/noche con factor de crecimiento y meta de cobertura), con su justificación, un ejemplo con el caso de prueba, su aplicación al caso propio y cómo está incorporado en la aplicación.

## Entregables del Reto 02

| Entregable | Dónde está |
|---|---|
| Aplicación | `index_standalone.html` (o la carpeta completa con `index.html`) |
| Repositorio | Esta carpeta, con este README |
| Catálogo de módulos | `datos/catalogo_modulos.json` |
| Base de datos de recurso | `datos/base_sitios.json` |
| Informe del caso de prueba | `informes/Informe_caso_prueba_Alta_Guajira.pdf` (se regenera abriendo `ejemplos/caso_prueba_alta_guajira.json`) |
