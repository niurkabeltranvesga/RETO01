# Plataforma web de dimensionamiento fotovoltaico

Universidad del Magdalena · Electiva ESFV 2026-II  
Integrantes: Niurka Beltrán Vesga, Miguel Ángel Bernal López

**Versión:** 1.0.0 (26/10/2026) · ver `CHANGELOG.md` en la raíz del repositorio. La versión y la fecha se muestran en la barra superior de la aplicación y en el pie de los informes.

**Dirección pública (HTTPS, sin instalación, sin registro):** https://niurkabeltranvesga.github.io/RETO01/web/

Integra en un solo flujo la caracterización del consumo (Reto 01), el dimensionamiento del generador fotovoltaico (Reto 02) y la conversión y el almacenamiento (Reto 03). La entrega formal (Reto 04) agrega despliegue, ejemplos precargados, exportación, validaciones, pruebas, ayuda integrada y versionado.

- Manual de usuario: `docs/MANUAL_USUARIO.md` (también está como ayuda integrada: botón **? Ayuda** de la barra superior).
- Decisiones de diseño: `docs/DECISIONES.md`.
- Método propio para la potencia pico: `docs/METODO_PROPIO.md`.

## Qué hace

La aplicación funciona en seis pasos:

1. **Proyecto**: nombre, integrantes, fecha y contexto (aislado o conectado a la red). Desde aquí se guarda o se recupera el proyecto en un archivo `.json`; así se abren también los proyectos de ejemplo de la carpeta `ejemplos/` (escenario F de Cartagena, caso de prueba estandarizado, vivienda en Valledupar y el caso propio).
2. **Cargas**: cada equipo con su potencia, cantidad y horario de uso en 24 horas. Las horas se marcan en una cuadrícula o con **"Marcar franja"** (desde / hasta); si la hora final es menor que la inicial, la franja cruza la medianoche y se avisa. Las cargas se pueden editar, eliminar (con confirmación) y no se admiten duplicadas.

   Opcional: cargar una medición real (CSV del nodo ESP32); es el complemento que se trabaja para el curso de proyecto culminante.

3. **Resultados**: potencia instalada, demanda máxima y su hora (si se repite en varias horas, se reporta la primera y se listan las demás), energía diaria, mensual y anual, costos diario, mensual y anual, y perfil de 24 horas. Todo se recalcula solo al cambiar una carga o un parámetro.
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
5. **Conversión y almacenamiento**: toma el generador del paso 4 y el consumo sin volver a escribirlos y trabaja en dos ramas. El valor inicial sale del contexto del Paso 1 (off-grid e híbridos: con almacenamiento; on-grid: sin almacenamiento) y el usuario puede cambiarlo; todo se recalcula al instante con cada cambio.
   - **Con almacenamiento:** verifica cada regulador MPPT del catálogo (Voc en frío, arranque con Vbanco + 5 V, ventana MPPT si la ficha la declara, corriente al banco e Isc por entrada) y dimensiona el banco de baterías: capacidad en Ah y kWh, configuración serie-paralelo con unidades enteras, DoD al final de la autonomía y DoD diario, tasa C de carga y de descarga, días de recuperación y comparación de tecnologías (kWh nominales por año de servicio). Con el **balance de cierre** recalcula la potencia pico requerida con las eficiencias del inversor y de la batería y, si falta, informa el déficit y los módulos adicionales; con un clic el ajuste vuelve al paso 4 y el generador se redimensiona.
   - **Sin almacenamiento:** verifica cada inversor de red (Voc en frío, ventana MPPT, arranque, Imp e Isc por entrada) y la relación DC/AC con un rango visible y configurable (1,0 a 1,3 por defecto), con alerta por recorte o por inversor sobredimensionado.
   - El paso está pensado para que cualquier persona lo use sin ayuda: arriba muestra un resumen en lenguaje sencillo ("Así queda su sistema": paneles, equipo, baterías y si alcanza la energía) con el botón que resuelve cada problema; debajo, preguntas numeradas con una explicación en cada dato; los equipos aparecen como tarjetas que dicen en palabras simples por qué funcionan o no. El detalle técnico (tabla de verificación, tasa C, comparación de baterías, sensibilidad y fórmulas) queda en "Ver detalle técnico".
   - Cada equipo recibe un veredicto **cumple / alerta / no cumple** por criterio, con el dato que falla. Si un equipo no admite la configuración de cadenas del paso 4, la aplicación propone otra y permite usarla con un clic. Si ningún equipo cumple, lo dice y sugiere agregar un equipo al catálogo o reducir el generador.
   - **Arranque de bombas y motores:** en la rama sin almacenamiento, el inversor de red sigue la tensión y la frecuencia de la red y solo inyecta la energía de los paneles; la corriente de arranque la entrega la red, por eso no se usa para elegir el inversor (y si la red falla, el inversor se apaga por protección antiisla). En la rama con almacenamiento, el inversor de baterías forma la red y debe soportar el arranque de la carga mayor con las demás funcionando. Las fórmulas y supuestos del paso lo declaran y listan las cargas con motor del proyecto (sesión de la semana 10: inversores que siguen a la red frente a los que la forman; RETIE, inversores autónomos).
   - **Asistente de ayuda** (botón «¿Dudas?», en todas las pantallas): ventana de chat que responde con las preguntas frecuentes del manual (`asistente.js`, 43 preguntas). No usa inteligencia artificial ni servicios externos: busca las palabras de la pregunta (sin tildes, sin palabras vacías y sin plurales) en las palabras clave y el título de cada respuesta, y muestra la que más coincide. Si ninguna coincide, lo dice y propone temas parecidos; nunca inventa una respuesta. Funciona sin internet y no necesita claves.
6. **Informe y resultados**:
   - **Informe de una página (PDF):** días de operación y CU explícitos, consumo, perfil de 24 horas, cuadro de cargas con sus franjas, costos, generador con la fuente del recurso solar y el contraste con la segunda fuente, y el equipo de conversión.
   - **Informe completo (PDF):** consumo, memoria de cálculo del generador y de la conversión y el almacenamiento, con fórmulas, supuestos y alertas.
   - **Exportar resultados** en **CSV** (punto y coma entre columnas, coma decimal) o **JSON** (datos estructurados, mismos redondeos).

El proyecto completo (cargas, parámetros, configuración del generador y del paso de conversión y almacenamiento) se puede guardar y volver a abrir como archivo `.json`.

## Cómo ejecutarla y despliegue

No necesita instalación, registro ni servidor propio.

- **En línea:** https://niurkabeltranvesga.github.io/RETO01/web/ (GitHub Pages sirve la carpeta del repositorio por HTTPS). Para publicar una versión nueva basta con subir los cambios a la rama principal; GitHub Pages la actualiza en uno o dos minutos.

- **Opción 1, un solo archivo:** abrir `index_standalone.html` con doble clic. Tiene todo incrustado: estilos, código, catálogos y base de sitios.
- **Opción 2, carpeta completa:** abrir `index.html`.
  - Con doble clic, los datos se leen de `datos/datos_respaldo.js`.
  - Si se sirve con un servidor local, se leen directamente de `datos/*.json`. Por ejemplo: `python3 -m http.server`, y luego abrir `http://localhost:8000`.

Se recomienda un navegador actualizado (Chrome, Edge o Firefox).

**Para ejecutar el escenario F:** en el Paso 1, botón "Cargar proyecto desde archivo", abrir `ejemplos/escenario_f_cartagena.json`. Se cargan las seis cargas, el sitio de Cartagena y la configuración, y todos los pasos quedan calculados.

**Para ejecutar el caso de prueba estandarizado:** en el Paso 1, botón "Cargar proyecto desde archivo", abrir `ejemplos/caso_prueba_alta_guajira.json`. Se cargan las 8 cargas de la estación de la Alta Guajira, el sitio del caso de prueba y el módulo de referencia, el generador queda dimensionado y el Paso 5 queda con los datos del TdR del Reto 03 (η_inv 0,90, N = 2 días, 48 V, batería AGM de referencia y regulador CTRL-B). Para la rama sin almacenamiento basta con elegir "Sin almacenamiento" en el Paso 5. Luego, en el Paso 6, "Generar informe (PDF)".

## Arquitectura

La aplicación es una página estática (HTML, CSS y JavaScript sin compilar ni empaquetar). La lógica de cálculo está separada de la interfaz:

| Capa | Archivos | Responsabilidad |
|---|---|---|
| Cálculo (funciones puras) | `motorCalculo.js`, `medicion.js`, `dimensionamiento.js`, `conversion.js`, `exportar.js`, búsqueda de `asistente.js` | Consumo, validaciones y formato de números; lectura de mediciones; generador y contraste con la segunda fuente; regulador o inversor y banco de baterías; resultados para CSV y JSON. No tocan la página y se prueban con Node.js. |
| Interfaz | `app.js` (pasos 1 a 3, guardar y abrir proyectos, exportación y ayuda), `generador.js` (paso 4 y NASA POWER), `pasoConversion.js` (paso 5) | Leen los campos, llaman al cálculo y muestran los resultados. |
| Informes | `informeResumen.js` (una página), `informe.js` (completo) | PDF con jsPDF. |
| Datos | `datos/*.json`, `ejemplos/*.json`, `datos/datos_respaldo.js` | Catálogos, sitios y proyectos de ejemplo (se abren con "Cargar proyecto desde archivo"); la copia de respaldo de los catálogos y sitios permite abrir la aplicación sin servidor. |

Flujo de datos: cada paso guarda su resultado en un estado común y avisa al siguiente, que se recalcula sin pedir datos de nuevo (cargas → resultados → generador → conversión → informe). Cada resultado se reconstruye desde las entradas guardadas en el `.json` del proyecto y las reglas de cálculo.

## Formato de números y unidades

Coma decimal y punto de miles en pantalla, informes y CSV (por ejemplo 3.942 W y 32,688 kWh); en el CSV se omite el punto de miles para que la hoja de cálculo lea el número. El JSON usa números (punto decimal, como exige el formato) redondeados igual que la pantalla. Redondeo: potencias en W sin decimales, energía diaria con 3 decimales, mensual y anual con 1, kWp e irradiación con 2, porcentajes con 1 y pesos sin decimales. Toda magnitud lleva su unidad.

## Dependencias

| Dependencia | Uso | Cómo se obtiene |
|---|---|---|
| jsPDF 2.5.1 | Generar el informe PDF | Se carga desde cdnjs.cloudflare.com, así que el informe necesita conexión a internet |
| Node.js (opcional) | Solo para correr las pruebas automáticas | — |
| jsdom (opcional) | Pruebas de la interfaz (`test_jsdom.js`, `test_consulta_nasa.js` y `test_paso_conversion.js`) | `npm install jsdom` |
| Python 3 (opcional) | Regenerar `index_standalone.html` y `datos/datos_respaldo.js` | — |

El resto está escrito en JavaScript sin librerías.

## Datos de entrada (catálogo y sitios)

- `datos/catalogo_modulos.json`: catálogo externo y editable con **4 módulos comerciales reales** (LONGi LR5-54HTB-450M, Trina Solar TSM-DEG19C.20 550 W, Canadian Solar CS6.2-66TB-625HP y LONGi LR8-66HVD-650M), tomados de sus hojas de datos. Cada uno declara su fuente (URL de la ficha técnica) y la fecha de consulta. Incluye además el módulo de referencia del TdR (sección 7.2), marcado como `referenciaTdR`: no es un producto comercial, por lo que la selección automática no lo considera y solo se puede elegir de forma manual para reproducir el caso de prueba.
- `datos/base_sitios.json`: base de datos local con **7 casos documentados** (los 6 iniciales y Cartagena, Bolívar, para el escenario F: PVGIS-5, PVGIS-ERA5, 10°, azimut 0°; copia de la consulta en `fuentes/PVGIS_Cartagena_Bolivar.pdf`). Un sitio puede traer una `segundaFuente` (para Cartagena, NASA POWER con inclinación igual a la latitud, consultada el 25/10/2026) con la que el Paso 4 contrasta la potencia pico; con el botón "Consultar NASA POWER para este sitio" el contraste se actualiza en línea. Cada uno registra nombre, latitud, longitud, irradiación diaria media anual, los doce valores mensuales, inclinación, azimut, fuente y fecha de consulta.
  - 5 sitios consultados en PVGIS-5 (base PVGIS-ERA5, inclinación 12°, azimut 0°): Nazareth (Alta Guajira), Universidad del Magdalena (Santa Marta), IED San José (Pueblo Viejo), Aeropuerto Alfonso López (Valledupar) y UIS (Bucaramanga). Los valores mensuales de PVGIS (kWh/m²·mes) se convirtieron a kWh/m²·día dividiendo por los días de cada mes.
  - El caso de prueba del TdR (sección 7.1), marcado como `casoPrueba`, con los valores declarados por el TdR: 5,8 kWh/m²·día anual y 5,2 en el mes crítico. El TdR no entrega los doce valores mensuales de este caso, por eso esa entrada no los tiene. Para el mismo lugar, la entrada de Nazareth consultada en PVGIS sí trae los doce meses.

Para actualizar los datos hay dos caminos:

- Editar los `.json` y ejecutar `python3 build_standalone.py`.
- Dentro de la aplicación, usar el botón **"Cargar catálogo o base de sitios (.json)"**. Esto no modifica el código.

- `datos/catalogo_equipos.json`: catálogo externo y editable de equipos de conversión y baterías, con equipos comerciales tomados de sus fichas técnicas oficiales (copias en `fuentes/fichas/`):
  - Reguladores MPPT: Victron SmartSolar MPPT 150/35, 150/45, 150/60, 150/70, 250/60 y 250/70, y el cargador MPPT integrado del Must PV18-3048 VPM (banco de 48 V). Las fichas de los 150/60, 150/70, 250/60 y 250/70 declaran operación en paralelo de hasta 10 unidades (`maxParalelo`); la del 150/35 y 150/45 no lo declara.
  - Inversores de red: Huawei SUN2000-2KTL-L1, SUN2000-3KTL-L1 y SUN2000-5KTL-L1 (monofásicos), y SUN2000-6KTL-M1, SUN2000-8KTL-M1 y SUN2000-10KTL-M1 (trifásicos, versión de alta corriente: 13,5 A por MPPT), y Growatt MOD10KTL3-X a MOD15KTL3-X (trifásicos de 10 a 15 kW).
  - Baterías: Victron AGM Deep Cycle 12 V 220 Ah (plomo-ácido), Victron Lithium Battery Smart 25,6 V de 100 y 200 Ah (LFP) y Felicity Solar LPBF48100-M (5 kWh), LPBF48200-M (10 kWh), LPBF48300 (15 kWh) y FLA12300 (12,8 V, 3,75 kWh), todas LFP. Las fichas Felicity dan la energía y no la capacidad en Ah: se calcula como energía / tensión nominal y queda anotado. La LPBF48200-M no admite conexión en serie y la FLA12300 admite como máximo 4 en serie (`maxSerie`): la aplicación rechaza un banco que la ficha no permite.

  Cada equipo declara fabricante, modelo, parámetros, la ficha técnica de la que se tomaron y la fecha de consulta. Cuando la ficha no declara un dato, el campo queda vacío (`null`) y no se completa con supuestos: la ficha Must no declara la corriente de cortocircuito FV máxima, la ficha AGM no declara la eficiencia de ida y vuelta ni un DoD de diseño, y la ficha LFP no declara una vida de diseño en años (sí los ciclos). Si falta el DoD de diseño se propone el de la sesión 10 del curso (AGM 50 %, LFP 80 %) y se indica; si falta la eficiencia, la aplicación pide escribirla. Incluye los equipos declarados en el caso de prueba del TdR del Reto 03 (CTRL-A, CTRL-B, CTRL-C, INV-A, INV-B, INV-C y las baterías AGM y LFP), marcados como `referenciaTdR`: no son productos comerciales y solo se eligen de forma manual. Dentro de la aplicación, en el Paso 5, el bloque "Catálogo de equipos y baterías" permite descargar el catálogo, editarlo y volver a cargarlo.

## Método del Reto 03 (conversión y almacenamiento)

Es el de las sesiones 8 y 10 del curso (Messenger y Abtahi, 2017; Chaaban, AE 868; Dobos, 2014). Todas las fórmulas aparecen con sus valores en "Ver fórmulas y supuestos" del Paso 5 y en el informe.

| Magnitud | Fórmula |
|---|---|
| Voc en frío | Voc · [1 + \|β\| · (25 − Tmin)]; máximo en serie = parte entera de (Voc máx. del equipo / Voc en frío) |
| Vmp en caliente / en frío | Vmp · [1 − \|β\| · (Tc − 25)] / Vmp · [1 + \|β\| · (25 − Tmin)], con el β de Voc como en el Reto 02 |
| Corriente al banco | Ppico / Vnominal, sin el factor 1,25 |
| Corriente de diseño de conductores | 1,25 · Isc (NTC 2050, 690-8), mostrada aparte |
| Relación DC/AC | Ppico / Pac |
| Energía en CC | Ecc = Ed / η_inv (todas las cargas en CA) |
| Capacidad del banco | Cn[Wh] = Ecc · N / (DoD · fT); Cn[Ah] = Cn[Wh] / Vbanco |
| Configuración | Ns = Vbanco / Vunidad; Np = ⌈Cn[Ah] / Cunidad⌉ |
| DoD | final = Ecc · N / E instalada; diario de diseño = DoD / N; diario con el banco instalado = Ecc / E instalada |
| Balance de cierre | Egen = Ecc / η_bat; Preq = Egen / (HSP · PR), con la HSP anual y la del mes crítico |
| Recuperación | trec = N · Ecc / (Eprod · η_bat − Ecc), Eprod = Ppico · HSP anual · PR |
| Tasa C | carga = (Ppico / Vnominal) / Ah instalados; descarga = demanda máxima / (η_inv · Vnominal) / Ah instalados |

Decisiones tomadas con el material del curso:

- Si la corriente al banco supera la del regulador, el equipo limita la carga y recorta potencia en las horas pico: se marca como **alerta** con el porcentaje de recorte, como en el ejemplo de la sesión 8 ("sirve con recorte"). Una tensión fuera de los límites del equipo sí es **no cumple**.
- La tasa C de descarga se compara con la ficha solo si la ficha declara un límite; si no, se informa como dato, como en la sesión 10.
- La comparación de tecnologías usa la energía nominal instalada dividida por la vida de diseño de la ficha (kWh por año de servicio). No incluye costos, porque el análisis económico está fuera del alcance del reto.
- **Reguladores en paralelo:** si la ficha del regulador permite varias unidades sobre el mismo banco (`maxParalelo`), las cadenas del generador se reparten en k grupos lo más parejos posible y cada grupo va a su regulador. Se busca el menor k (hasta el máximo de la ficha) con el que cada unidad cumple; la corriente al banco y el Isc se revisan con el grupo más grande, y las tensiones no cambian porque todas las cadenas son iguales. Si ninguna k cumple, el menor k con solo alertas. Sin dato en la ficha se usa una unidad.
- Selección automática del equipo: entre los que cumplen, el regulador que necesita menos unidades en paralelo y, a igualdad, el de menor corriente nominal; el inversor con la relación DC/AC más cercana a 1,2. Si ninguno cumple sin alertas, se elige entre los que tienen solo alertas: el regulador con menos unidades que menos recorta (mayor corriente de salida) y el inversor con la relación DC/AC más cercana a 1,2.
- **Autonomía por consumo nocturno (método propio, opcional):** además de N días completos sin sol (método del curso, predeterminado), el banco se puede dimensionar para cubrir solo la energía de las horas fuera de la ventana solar del Paso 3 durante N noches: Ecc_noche = E_noche / η_inv; Cn = Ecc_noche · N / (DoD · fT). En ese caso solo la energía nocturna pasa por la batería: Egen = E_día / η_inv + E_noche / (η_inv · η_bat), y la recuperación es trec = N · Ecc_noche / ((Eprod − Egen) · η_bat), que con autonomía por días es la misma fórmula del curso. Ver `docs/DECISIONES.md`, decisión 7.
- Al aceptar el ajuste del balance de cierre, el Paso 4 dimensiona el generador con la potencia requerida según su propio criterio de recurso (promedio anual o mes crítico). El ajuste se ve en el Paso 4 y se puede quitar.

## Consulta en línea del recurso solar (API)

En el paso 4 hay un bloque opcional, "Consultar otra ubicación en línea (NASA POWER)", que consulta la API de climatología de NASA POWER (servicio `temporal/climatology/point`, parámetro `SI_EF_TILTED_SURFACE`) con la latitud y la longitud del sitio.

- **Qué entrega:** los doce valores mensuales y el promedio anual de irradiación diaria (kWh/m²·día) sobre una superficie orientada hacia el ecuador, como promedio del periodo 2001–2025. NASA POWER solo los calcula para algunas inclinaciones, por eso la aplicación ofrece tres opciones: **igual a la latitud** (predeterminada), **latitud + 15°** y **horizontal (0°)**. El azimut queda fijo hacia el ecuador (0° = sur en el hemisferio norte).
- **Credenciales:** NASA POWER no pide clave ni usuario. La aplicación no usa ni publica credenciales de ningún tipo.
- **Qué hace falta para que la API funcione:** solo conexión a internet. NASA POWER sí admite consultas directas desde páginas web; se comprobó en la página publicada en GitHub Pages.
- **Uso del resultado:** el sitio consultado se agrega a la lista de sitios, queda seleccionado y se usa en el dimensionamiento igual que uno de la base local. La fuente, la inclinación y la fecha de consulta aparecen en pantalla y en el informe PDF. Si se guarda el proyecto, el sitio consultado se guarda con él.
- **Diferencia con la base local:** la base local viene de PVGIS (base PVGIS-ERA5) y NASA POWER usa otras fuentes de datos, con una resolución espacial más gruesa (del orden de 1°), así que para un mismo lugar los valores no son iguales. Por ejemplo, para la Universidad del Magdalena la base local (PVGIS, 12°) da 5,01 kWh/m²·día y NASA POWER (inclinación igual a la latitud, 11,2°) da 5,51 kWh/m²·día. Por eso el informe siempre declara de qué fuente salió el recurso usado.
- **Contingencia:** cuando la consulta no se completa (sin conexión, error del servicio o tiempo agotado de 15 s), la aplicación:
  1. sigue con el sitio seleccionado de la base local,
  2. muestra un aviso con el motivo,
  3. deja la contingencia declarada en el informe PDF (motivo, fecha y sitio usado).
- **Caché:** cada consulta exitosa se guarda durante la sesión; repetir las mismas coordenadas e inclinación no vuelve a llamar al servicio.

El dimensionamiento nunca depende de que la API responda.

Por qué se pasó de PVGIS a NASA POWER para la consulta en línea está documentado en `docs/DECISIONES.md`.

## Contraste con una segunda fuente

En el Paso 4, debajo del resultado, la tabla "Contraste con una segunda fuente" compara la irradiación anual, la del mes de menor recurso y la potencia pico calculada con la fuente principal (PVGIS) y con la segunda (NASA POWER). Como Ppico = E / (HSP · PR), con la segunda fuente Ppico₂ = Ppico₁ · HSP₁ / HSP₂. La diferencia aceptada es de ±15 % en la potencia pico. Para el escenario F (promedio anual): PVGIS 5,26 y NASA POWER 4,99 kWh/m²·día, potencia pico 8,88 y 9,36 kWp, diferencia +5,4 %.

## Validaciones y casos borde

| Caso | Qué hace la aplicación |
|---|---|
| Potencia negativa o cero | Rechaza la carga: "La potencia no puede ser negativa (se escribió −50 W)…" |
| Cantidad en cero o no entera | Rechaza la carga con un mensaje concreto |
| Campos vacíos | Pide el dato que falta (descripción, cantidad, potencia, días, CU, horas) |
| Carga sin horas | Pide marcar las horas o usar "Marcar franja" |
| Franja invertida | Si la hora final es menor que la inicial, la marca cruzando la medianoche y lo avisa; si empieza y termina a la misma hora, la rechaza |
| Día solar invertido | Rechaza que la hora de inicio sea igual o posterior a la de fin |
| Días fuera de rango | Mes: 1 a 31; año: 1 a 366 |
| CU = 0 | Calcula y muestra un aviso (también en el informe) |
| CU negativo | Lo rechaza |
| Demanda máxima repetida | Reporta la primera hora y lista las demás (pantalla, informes y exportación) |
| Informe o exportación sin cargas | No lo genera y dice qué falta |
| Autonomía, DoD o tensión del banco no válidos | El Paso 5 indica el dato que hay que corregir |
| Carga duplicada | La rechaza e indica la fila existente |
| Consulta en línea fallida | Sigue con la base local, avisa y lo declara en el informe |

## Limitaciones conocidas

- El informe PDF usa jsPDF desde cdnjs: sin internet la aplicación funciona, pero el PDF no se puede generar (sí la exportación CSV y JSON).
- El recurso solar es un promedio climatológico; no considera sombras, suciedad ni pérdidas detalladas más allá del factor PR.
- NASA POWER solo entrega planos con inclinación igual a la latitud, latitud + 15° u horizontal, siempre hacia el ecuador.
- La rama con almacenamiento dimensiona el regulador y el banco; el inversor de baterías (y su capacidad de arranque) no se dimensiona.
- No incluye análisis económico (costos de equipos, retorno de la inversión).
- Los catálogos traen pocas referencias; se amplían editando los `.json` o cargándolos desde la aplicación.
- La clasificación diurna / nocturna usa la ventana solar definida en el Paso 3, no la hora real de salida y puesta del sol.

## Pruebas automáticas

Desde la carpeta principal de la aplicación, con Node.js (para las pruebas de interfaz, instalar antes `npm install jsdom`). Todas a la vez:

```
node test/ejecutar_todas.js
```

Por separado:

```
node test/test_motorCalculo.js       # motor de consumo (coincide con MATLAB)
node test/test_medicion.js           # carga de mediciones del ESP32
node test/test_dimensionamiento.js   # dimensionamiento: reproduce los valores de referencia del TdR
node test/test_jsdom.js              # recorrido completo por la interfaz
node test/test_consulta_nasa.js      # consulta en línea a NASA POWER y su contingencia (sin usar internet)
node test/test_conversion.js         # Reto 03: caso estandarizado (regulador, banco, balance de cierre y rama sin almacenamiento)
node test/test_paso_conversion.js    # Reto 03: recorrido por el Paso 5 (ramas, ajuste del generador, informe y guardado)
node test/test_escenario_f.js        # Escenario F de Cartagena contra cálculo a mano, segunda fuente, informe de una página, CSV/JSON y casos borde
node test/test_asistente.js          # asistente de ayuda: preguntas escritas de distintas formas y ventana del chat
node test/test_paralelo_noche.js     # reguladores en paralelo, autonomía por consumo nocturno y baterías que no admiten serie
```

Cobertura pedida: los tres casos de consumo (solo diurno, solo nocturno y mixto con cruce de medianoche) están en `test_motorCalculo.js`; el caso estandarizado de los Retos 02 y 03 en `test_dimensionamiento.js`, `test_conversion.js` y `test_paso_conversion.js`; el escenario del grupo en `test_escenario_f.js`.

Lista de verificación manual (dos navegadores y teléfono): abrir la dirección pública en Chrome y en Firefox (o Edge), y en un teléfono (360 px de ancho); en cada uno abrir `ejemplos/escenario_f_cartagena.json` con "Cargar proyecto desde archivo", recorrer los pasos 3 a 6, descargar el informe de una página y el CSV, y comprobar que no hay desplazamiento horizontal.

## Estructura de archivos

```
index.html               Interfaz (6 pasos)
index_standalone.html    Versión de un solo archivo (generada)
styles.css               Estilos
motorCalculo.js          Lógica: cálculo del consumo (funciones puras)
medicion.js              Lógica: lectura y comparación de mediciones del ESP32
dimensionamiento.js      Lógica: cálculo del generador fotovoltaico (funciones puras)
generador.js             Interfaz del paso 4 y consulta a NASA POWER
conversion.js            Lógica: regulador o inversor MPPT y banco de baterías (funciones puras)
pasoConversion.js        Interfaz del paso 5
informe.js               Informe PDF completo
informeResumen.js        Informe PDF de una página
exportar.js              Lógica: resultados para CSV y JSON
asistente.js             Asistente de ayuda: preguntas frecuentes del manual y ventana de chat
app.js                   Control general de la interfaz, proyectos .json, exportación y ayuda
datos/                   Catálogo de módulos, catálogo de equipos y baterías, base de sitios y su copia de respaldo
ejemplos/                Escenario F (Cartagena), caso de prueba estandarizado, práctica de Valledupar, caso propio (Distrimedical) y medición de ejemplo del ESP32
informes/                Informes generados por la aplicación (caso de prueba y Reto 01 de Distrimedical)
assets/                  Imagen de fondo
build_standalone.py      Genera la versión de un solo archivo
fuentes/                 Copias de las fichas técnicas y de la consulta PVGIS de Cartagena
docs/                    Documentación: este README, MANUAL_USUARIO.md, DECISIONES.md y METODO_PROPIO.md
test/                    Pruebas automáticas
```

La lógica de cálculo (`motorCalculo.js`, `medicion.js`, `dimensionamiento.js`, `conversion.js`) está separada de la interfaz: son funciones puras que no tocan la página, y por eso se pueden probar solas con Node.js.

## Documentación

- `docs/DECISIONES.md`: decisiones de diseño sobre la consulta en línea al recurso solar: las alternativas evaluadas con PVGIS y el cambio a NASA POWER.
- `docs/METODO_PROPIO.md`: método propio para la potencia pico (balance día/noche con factor de crecimiento y meta de cobertura), con su justificación, un ejemplo con el caso de prueba, su aplicación al caso propio y cómo está incorporado en la aplicación.

## Entregables del Reto 02

| Entregable | Dónde está |
|---|---|
| Aplicación | `index_standalone.html` (o la carpeta completa con `index.html`) |
| Repositorio | Esta carpeta, con este README |
| Catálogo de módulos | `datos/catalogo_modulos.json` |
| Base de datos de recurso | `datos/base_sitios.json` |
| Informe del caso de prueba | `informes/Informe_caso_prueba_Alta_Guajira.pdf` (se regenera abriendo `ejemplos/caso_prueba_alta_guajira.json`) |

## Entregables del Reto 03

| Entregable | Dónde está |
|---|---|
| Aplicación | `index_standalone.html` (o la carpeta completa con `index.html`), Paso 5 |
| Catálogo de equipos de conversión y baterías | `datos/catalogo_equipos.json` |
| Lógica separada de la interfaz | `conversion.js` (cálculo) y `pasoConversion.js` (interfaz) |
| Pruebas del caso estandarizado | `test/test_conversion.js` y `test/test_paso_conversion.js` |
| Informe ampliado | Paso 6: páginas de conversión y almacenamiento |

## Entregables del Reto 04

| Requisito | Dónde está |
|---|---|
| Disponibilidad pública (HTTPS, sin instalación ni credenciales) | https://niurkabeltranvesga.github.io/RETO01/web/ |
| Flujo completo en seis pasos | Proyecto → Cargas → Resultados → Generador → Conversión → Informe |
| Escenario del grupo precargado | Archivo incluido `ejemplos/escenario_f_cartagena.json`, que se abre con "Cargar proyecto desde archivo" del Paso 1 |
| Guardar / recuperar, informe y exportación | Paso 1 (`.json`), Paso 6 (informe de una página, informe completo, CSV y JSON) |
| Contingencia del recurso solar | Base local si NASA POWER no responde, con aviso y registro en el informe |
| Sin secretos expuestos | NASA POWER no usa clave; no hay credenciales en el código ni en el repositorio |
| Compatibilidad y teléfono | Diseño adaptable probado a 360 px; lista de verificación en "Pruebas automáticas" |
| Idioma, unidades y formato | Ver "Formato de números y unidades" |
| Pruebas | `test/ejecutar_todas.js` |
| Validación y casos borde | Ver "Validaciones y casos borde" |
| Documentación | `docs/MANUAL_USUARIO.md`, ayuda integrada («? Ayuda» y asistente «¿Dudas?») y este README |
| Versionado | Etiqueta `v1.0.0`, `CHANGELOG.md`, versión y fecha visibles en la aplicación |

