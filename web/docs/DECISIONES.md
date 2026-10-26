# Decisiones de diseño

## Decisión 1. Cómo obtener el recurso solar en línea (API de PVGIS)

**Fecha:** 4 de octubre de 2026  
**Integrantes:** Niurka Beltrán Vesga, Miguel Ángel Bernal López  

### Contexto

El TdR del Reto 02 define dos niveles para el recurso solar:

- una base de datos local (obligatoria);
- una consulta a una API en línea (opcional, puntúa).

Para la consulta en línea se eligió PVGIS, la herramienta del Centro Común de Investigación (JRC) de la Comisión Europea. Tiene tres ventajas:

- no pide clave ni usuario;
- entrega los doce valores mensuales sobre el plano inclinado del generador;
- es la misma fuente con la que se armó la base local (PVGIS-ERA5).

Al integrarla apareció una restricción que no depende de la aplicación. La documentación oficial de PVGIS indica textualmente: *"access to PVGIS APIs via AJAX is not allowed"*. En otras palabras, PVGIS no responde a consultas hechas directamente desde una página web en el navegador. Como la aplicación es una página web que se abre en el navegador, la consulta directa siempre falla.

### Alternativas evaluadas

| Alternativa | Cómo funciona | A favor | Por qué se descartó |
|---|---|---|---|
| **A. Consulta directa desde el navegador** | La página llama a la API de PVGIS | No requiere nada adicional | PVGIS la bloquea por política propia: no se puede resolver desde la aplicación |
| **B. Servidor intermediario local** (`servidor.py`) | Un programa en Python, en el computador del usuario, consulta PVGIS en nombre de la página | La consulta funciona. Se construyó un prototipo y se probó con una respuesta simulada con el mismo formato de PVGIS: consulta, caché y contingencia funcionaron | Obliga a cada usuario a tener Python y a ejecutar un comando en una terminal antes de usar la aplicación. Esto contradice el objetivo de que cualquier persona pueda usarla con solo abrirla |
| **C. Función en la nube** (por ejemplo, Netlify o Vercel) | El intermediario se publica en internet junto con la página | Para el usuario final sería transparente: solo abre un enlace | Exige publicar la aplicación en un servicio externo, crear y mantener cuentas y depender de ese proveedor. No se puede verificar ni dejar en funcionamiento dentro del plazo del reto |
| **D. Intermediarios públicos de terceros** ("proxies CORS") | Un servicio ajeno reenvía la consulta | No requiere infraestructura propia | No son confiables (pueden caerse o desaparecer), no se controla qué hacen con las peticiones y no es una práctica profesional |
| **E. Cambiar a otra API** (NASA POWER) | Otra fuente de datos de radiación | Podría permitir consultas desde el navegador | En ese momento no se pudo confirmar que admita consultas desde páginas web, ni que entregue la irradiación sobre plano inclinado. Se revisó después: ver la Decisión 2 |

### Decisión

Se priorizó que **la aplicación funcione para cualquier persona sin instalar nada**:

- El recurso solar se toma de la **base de datos local**: 6 casos documentados con fuente y fecha de consulta.
- La consulta en línea se mantiene en la interfaz como intento opcional. Cuando no se completa, la aplicación aplica la **contingencia**:
  1. sigue con el sitio seleccionado de la base local;
  2. avisa al usuario con el motivo;
  3. deja declarados en el informe PDF el motivo, la fecha y el sitio usado.

### Consecuencias

- **Se gana:** la aplicación no depende de internet ni de servicios externos para dimensionar. El resultado es reproducible porque los datos están en el repositorio, con su fuente. En el aula funciona aunque no haya conexión.
- **Se asume:** la consulta en línea a PVGIS no se completa desde el navegador, y por eso no puede mostrarse funcionando en la sustentación.
- **Cómo se recuperaría:** la aplicación ya maneja la consulta, la caché y la contingencia. Para habilitarla bastaría con publicar la aplicación con un intermediario (alternativa C), sin cambiar la lógica de cálculo.

### Evidencia

- Documentación de la API de PVGIS (JRC): https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/getting-started-pvgis/api-non-interactive-service_en
- Informes de PVGIS de cada sitio de la base local: carpeta de fuentes del repositorio.

## Decisión 2. Consulta en línea con NASA POWER

**Fecha:** 24 de octubre de 2026  
**Integrantes:** Niurka Beltrán Vesga, Miguel Ángel Bernal López  

### Contexto

Con la Decisión 1 la consulta en línea quedó en la interfaz, pero no se completaba desde el navegador porque PVGIS no lo permite. Se volvió a evaluar la alternativa E (NASA POWER), que había quedado sin confirmar.

### Qué se comprobó

- **Consultas desde páginas web:** se hizo la consulta desde la aplicación publicada en GitHub Pages y NASA POWER respondió con los datos (código 200). No necesita intermediario ni instalar nada.
- **Irradiación sobre plano inclinado:** la API de climatología entrega, con el parámetro `SI_EF_TILTED_SURFACE`, los doce valores mensuales y el anual sobre superficies orientadas al ecuador con inclinaciones fijas (horizontal, latitud − 15°, latitud, latitud + 15° y vertical). Por eso no hace falta agregar un modelo de transposición propio.
- **Credenciales:** no pide clave ni usuario.

### Decisión

La consulta en línea del paso 4 usa NASA POWER en lugar de PVGIS:

- El usuario escribe latitud y longitud y elige la inclinación entre **igual a la latitud** (predeterminada), **latitud + 15°** y **horizontal**. No se ofrece "latitud − 15°" porque en Colombia daría un ángulo negativo. Tampoco se usa el valor "óptimo" de NASA POWER, porque ese valor cambia de ángulo cada mes y no corresponde a un generador fijo.
- La **base de datos local** (PVGIS) se mantiene igual y sigue siendo la fuente del caso de prueba y de los sitios documentados.
- La contingencia y la caché funcionan igual que antes.

### Consecuencias

- **Se gana:** la consulta en línea funciona para cualquier persona desde la página publicada, sin instalar nada.
- **Se asume:**
  - Las inclinaciones disponibles son solo las que calcula NASA POWER; no se puede pedir un ángulo cualquiera.
  - NASA POWER y PVGIS usan datos distintos, así que para un mismo lugar dan valores distintos. Para la Universidad del Magdalena: PVGIS (base local, 12°) da 5,01 kWh/m²·día y NASA POWER (latitud, 11,2°) da 5,51 kWh/m²·día. El informe declara siempre la fuente del recurso usado.

### Evidencia

- Respuesta de NASA POWER usada en la prueba automática `test/test_consulta_nasa.js` (Universidad del Magdalena, consulta del 24 de octubre de 2026).
- Documentación de NASA POWER: https://power.larc.nasa.gov/docs/services/api/temporal/climatology/
- Explicación de la irradiación sobre superficies inclinadas: https://power.larc.nasa.gov/docs/faqs/solar/

## Decisión 3. Parámetros del escenario F (Cartagena) y segunda fuente

**Fecha:** 25 de octubre de 2026  
**Integrantes:** Niurka Beltrán Vesga, Miguel Ángel Bernal López  

### Contexto

El escenario F es una cafetería y tienda de alimentos en Cartagena, Bolívar (10,39° N; 75,48° O), on-grid sin almacenamiento, con 70 m², CU = 1 200 $/kWh, 365 días de operación y ventana solar de 06:00 a 18:00. Las cargas y horarios son los del enunciado. La inclinación y el azimut los decide el grupo, y la potencia pico se contrasta con una segunda fuente (diferencia aceptada ±15 %).

### Decisión

| Dato | Valor | Por qué |
|---|---|---|
| Fuente principal | PVGIS-5, PVGIS-ERA5, sistema conectado a red | Misma herramienta que el resto de la base local; consulta guardada en `fuentes/PVGIS_Cartagena_Bolivar.pdf` |
| Inclinación / azimut | 10° / 0° (sur) | Cercana a la latitud (10,39°), mirando al ecuador, como se consultó en PVGIS |
| Criterio de recurso | Promedio anual | En on-grid la red cubre los meses de menor recurso |
| Factor de desempeño | PR = 0,70 | Valor de referencia del curso |
| Temperatura mínima | 18 °C | Mínima absoluta de Cartagena, IDEAM 1991–2020 (tabla de clima de Cartagena de Indias en Wikipedia) |
| Temperatura de operación | 32 °C | Máxima media mensual más alta (31,8 °C, junio a agosto), IDEAM 1991–2020 |
| Segunda fuente | NASA POWER, inclinación igual a la latitud (10,4°), consulta del 25/10/2026 | Fuente independiente de PVGIS y la misma API de la consulta en línea |

### Resultado del contraste

| Dato | PVGIS | NASA POWER | Diferencia |
|---|---|---|---|
| Irradiación anual (kWh/m²·día) | 5,26 | 4,99 | −5,1 % |
| Mes de menor recurso (kWh/m²·día) | 4,68 (noviembre) | 4,40 (octubre) | −6,0 % |
| Potencia pico, promedio anual (kWp) | 8,88 | 9,36 | +5,4 % |

La diferencia en la potencia pico (+5,4 %) está dentro de ±15 %. Los planos no son idénticos (10° frente a 10,4°), pero la diferencia de inclinación es menor a medio grado.

### Consecuencias

- El escenario queda guardado en `ejemplos/escenario_f_cartagena.json` y se abre con "Cargar proyecto desde archivo", sin digitar las cargas.
- La segunda fuente queda guardada junto al sitio, de modo que el contraste funciona aunque no haya internet; con internet se puede repetir la consulta desde el Paso 4.

## Decisión 4. Arranque de bombas y motores al elegir el inversor

**Fecha:** 25 de octubre de 2026  
**Integrantes:** Niurka Beltrán Vesga, Miguel Ángel Bernal López  

### Contexto

Todos los escenarios incluyen una bomba de 0,5 a 1 HP, que arranca con una corriente mayor que la nominal. El escenario F tiene además vitrinas, congelador y aire acondicionado, que también arrancan con motor (compresor).

### Decisión

- **Sin almacenamiento (on-grid, escenario F):** el inversor de red sigue la tensión y la frecuencia de la red (*grid-following*) y solo inyecta la energía de los paneles. Las cargas están conectadas a la red, que entrega la corriente de arranque de la bomba; por eso el arranque **no** es un criterio para elegir este inversor, que se elige por la tensión y la corriente de entrada y por la relación DC/AC. Si la red falla, el inversor se apaga por protección antiisla y la bomba no funciona con el sistema solar.
- **Con almacenamiento (off-grid):** el inversor de baterías forma la red (*grid-forming*) y debe soportar el arranque de la carga mayor con las demás funcionando. La aplicación dimensiona el regulador y el banco; el inversor de baterías no se dimensiona, y el paso lo advierte para que se verifique su potencia de sobrecarga en la ficha.
- La aplicación lista en las fórmulas y supuestos del Paso 5 y en los informes las cargas con motor del proyecto.

### Inversor del escenario F

Ninguno de los inversores monofásicos del catálogo servía: el mayor es de 5 kW (relación DC/AC 1,80 con 9 kWp) y la serie L1 admite 12,5 A por MPPT, menos que la Imp del módulo (13,27 A). Se agregó la serie trifásica Huawei SUN2000-KTL-M1 (versión de alta corriente) desde su ficha técnica (`fuentes/fichas/Huawei_SUN2000-3-10KTL-M1.pdf`, consulta del 25/10/2026). Con el generador de 2 cadenas de 10 módulos (9,00 kWp), una cadena por MPPT:

| Inversor | Pac | DC/AC | Veredicto |
|---|---|---|---|
| SUN2000-6KTL-M1 | 6 000 W | 1,50 | Alerta: recorte en las horas de mayor sol |
| **SUN2000-8KTL-M1** | **8 000 W** | **1,13** | **Cumple** (Voc en frío 408,8 V ≤ 1 100 V; Vmp 309,7 V dentro de 140–980 V y sobre el arranque de 200 V; 13,3 A ≤ 13,5 A y 14,3 A ≤ 19,5 A por MPPT) |
| SUN2000-10KTL-M1 | 10 000 W | 0,90 | Alerta: inversor sobredimensionado |

La ficha recomienda hasta 12 000 Wp de paneles para el modelo de 8 kW, por encima de los 9 000 Wp del escenario. Según esta decisión, el arranque de la bomba de 1 100 W no cambia la elección, porque lo entrega la red.

### Fuente

Sesión de la semana 10 del curso: inversor que sigue a la red ("sin red, se apaga") frente al que forma la red ("debe soportar arranques de motores"), y requisito para inversores autónomos: "soportar la carga de mayor arranque con las demás operando".

## Decisión 5. Formato de números

**Fecha:** 25 de octubre de 2026  

La pantalla, los informes y el CSV usan coma decimal y punto de miles (convención de Colombia). En el CSV se omite el punto de miles para que la hoja de cálculo lea el valor como número. El JSON usa números con punto decimal, como exige el formato, redondeados igual que la pantalla. El formato está en una sola función (`formatoNumero` de `motorCalculo.js`) para que sea el mismo en todas partes.

## Decisión 6. Reguladores MPPT en paralelo

**Fecha:** 26 de octubre de 2026  
**Integrantes:** Niurka Beltrán Vesga, Miguel Ángel Bernal López  

### Contexto

Los reguladores comerciales del catálogo cargan como máximo 70 A (Victron) u 80 A (Must). Un proyecto con baterías y un generador grande, como el caso propio (Distrimedical, unos 13 kWp a 48 V, 275 A hacia el banco), no tenía ningún regulador que cumpliera.

### Decisión

Se permite usar varias unidades del mismo regulador en paralelo sobre el mismo banco, **solo si la ficha del fabricante lo declara** (campo `maxParalelo`). Las fichas de los Victron SmartSolar MPPT 150/60, 150/70, 250/60 y 250/70 dicen *"Parallel operation: Yes: up to 10 units can be synchronized with Bluetooth"*. La ficha del 150/35 y 150/45 no lo declara, así que esos se evalúan con una sola unidad.

- Las cadenas se reparten en k grupos lo más parejos posible y cada grupo va a su regulador.
- Se busca el menor k que cumple; la corriente al banco (Pgrupo / Vnominal) y el Isc se revisan con el grupo más grande. Las tensiones no cambian, porque todas las cadenas son iguales.
- En la selección automática gana el que necesita menos unidades y, a igualdad, el de menor corriente.

### Resultado con el caso propio

Con el generador reorganizado en 8 cadenas de 3 módulos de 550 W: 4 × SmartSolar MPPT 150/70, grupos de 2 cadenas, 68,8 A por regulador (límite 70 A) y 36,8 A de Isc (límite 50 A).

## Decisión 7. Autonomía por consumo nocturno

**Fecha:** 26 de octubre de 2026  
**Integrantes:** Niurka Beltrán Vesga, Miguel Ángel Bernal López  

### Contexto

El método del curso dimensiona el banco para N días completos sin sol (Cn = Ecc · N / (DoD · fT)), que es lo adecuado en sistemas aislados. En un sistema híbrido, la batería se usa sobre todo para cubrir lo que se consume cuando no hay sol (sesión 10: "déficit en la noche", "autoconsumo y respaldo en sistemas con red"). La plataforma ya calcula esa energía: la que se consume fuera de la ventana solar del Paso 3.

### Decisión

Se agrega una segunda opción en el Paso 5, «Solo el consumo de la noche». La opción «Días completos sin sol» sigue siendo la predeterminada, porque es el método del curso y el que fijan los escenarios con almacenamiento (2 días).

| Magnitud | Días completos (curso) | Solo la noche (método propio) |
|---|---|---|
| Energía que cubre el banco | Ecc = Ed / η_inv | Ecc_noche = E_noche / η_inv |
| Capacidad | Cn = Ecc · N / (DoD · fT) | Cn = Ecc_noche · N / (DoD · fT) |
| Energía a generar | Egen = Ecc / η_bat | Egen = E_día / η_inv + E_noche / (η_inv · η_bat) |
| Recuperación | trec = N · Ecc / (Eprod · η_bat − Ecc) | trec = N · Ecc_noche / ((Eprod − Egen) · η_bat) |

La fórmula general de la recuperación, trec = N · E_banco / ((Eprod − Egen) · η_bat), da exactamente la del curso cuando se usan días completos. Si el perfil no tiene consumo fuera de la ventana solar, la opción nocturna no aplica y la plataforma lo dice.

### Consecuencias

- El banco es mucho más pequeño. En el caso propio, 1 noche son 5,70 kWh: un banco de 10 kWh, frente a unos 120 kWh para 2 días completos.
- Con un banco pequeño y un generador grande, la tasa C de carga puede superar el límite de la batería. La plataforma lo advierte; se corrige limitando la corriente en los reguladores o aumentando el banco.
