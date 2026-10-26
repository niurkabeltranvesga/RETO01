# Registro de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico: MAYOR.MENOR.PARCHE.

## [1.0.0] - 2026-10-26

Entrega formal de la plataforma (Reto 04).

### Agregado
- Proyecto del escenario F (cafetería y tienda de alimentos en Cartagena, on-grid) en `web/ejemplos/escenario_f_cartagena.json`, que se abre con "Cargar proyecto desde archivo", junto con la práctica de Valledupar.
- Inversores trifásicos Huawei SUN2000-6/8/10KTL-M1 (versión de alta corriente) en el catálogo, con su ficha técnica.
- Cartagena, Bolívar, en la base de sitios (PVGIS-5, PVGIS-ERA5, 10°, azimut 0°) con su segunda fuente (NASA POWER).
- Contraste de la potencia pico con una segunda fuente de recurso solar (diferencia aceptada ±15 %), en pantalla, en los informes y en la exportación; consulta en línea del contraste con NASA POWER.
- Informe de una página (PDF) con días de operación y CU explícitos; el informe anterior queda como informe completo.
- Exportación de resultados en CSV y JSON.
- Costos diario, mensual y anual en la pantalla de resultados.
- "Marcar franja" (desde / hasta) en el cuadro de cargas, con aviso de cruce de medianoche.
- Aviso cuando la demanda máxima se repite: se reporta la primera hora y se listan las demás.
- Validaciones con mensajes concretos: potencia negativa, cantidad en cero, campos vacíos, franja de duración cero, día solar invertido, días fuera de rango, CU vacío o negativo, informe y exportación sin cargas.
- Documentación del arranque de bombas y motores al elegir el inversor (fórmulas y supuestos del paso de conversión y del informe).
- Reguladores en paralelo: si la ficha del regulador lo permite, la plataforma reparte las cadenas en grupos y propone el menor número de reguladores con el que cada uno cumple (por ejemplo, 4 × SmartSolar MPPT 150/70).
- Autonomía por consumo nocturno (método propio, opcional): el banco cubre la energía de las horas fuera de la ventana solar durante N noches, con su balance de cierre y su recuperación.
- Reguladores Victron SmartSolar MPPT 150/60, 150/70, 250/60 y 250/70; inversores Growatt MOD10KTL3-X a MOD15KTL3-X; baterías Felicity Solar LPBF48100-M, LPBF48200-M, LPBF48300 y FLA12300, con sus fichas técnicas. Las baterías declaran cuántas unidades admiten en serie y en paralelo.
- Asistente de ayuda (botón "¿Dudas?"): ventana de chat que responde con 43 preguntas frecuentes del manual, sin inteligencia artificial ni servicios externos, y lleva al paso correspondiente.
- Ayuda integrada (botón "? Ayuda"), manual de usuario (`web/docs/MANUAL_USUARIO.md`) y README con arquitectura, despliegue, fuentes, validaciones y limitaciones.
- Versión y fecha visibles en la barra superior, en el pie de la página y en los informes.
- Prueba del escenario F y ejecutor de todas las pruebas (`web/test/ejecutar_todas.js`).

### Cambiado
- Formato de números unificado: coma decimal y punto de miles en pantalla, informes y CSV.
- Horarios mostrados como franjas con hora de inicio y fin (08:00–20:00).
- Diseño para teléfono (360 px): pasos en una fila, indicadores de a dos y tablas con desplazamiento propio.

## [0.3.0] - 2026-10

Conversión y almacenamiento (Reto 03).

### Agregado
- Paso 5: regulador MPPT y banco de baterías (con almacenamiento) o inversor de red (sin almacenamiento), con veredictos cumple / alerta / no cumple, balance de cierre, recuperación del banco, tasa C, comparación de tecnologías y ajuste del generador con un clic.
- Catálogo de equipos de conversión y baterías con fichas técnicas reales.
- Páginas de conversión y almacenamiento en el informe.

## [0.2.0] - 2026-10-05

Dimensionamiento del generador fotovoltaico (Reto 02).

### Agregado
- Paso 4: potencia pico, número de módulos, configuración serie-paralelo, tensiones y corrientes corregidas por temperatura, corriente de diseño (NTC 2050), área y energía generada.
- Catálogo de módulos y base de sitios (PVGIS); consulta en línea a NASA POWER con contingencia.
- Método propio para la potencia pico.

## [0.1.0] - 2026-08-31

Caracterización del consumo energético (Reto 01).

### Agregado
- Cuadro de cargas con horarios de 24 horas, perfil horario, potencia instalada, demanda máxima, energía diaria, mensual y anual, costos y clasificación diurna / nocturna / mixta.
- Informe PDF de una página, guardado y recuperación del proyecto, versión web y versión de escritorio (MATLAB).
