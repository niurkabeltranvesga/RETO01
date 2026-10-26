# Manual de usuario

Plataforma web de dimensionamiento fotovoltaico · versión 1.0.0
Dirección: https://niurkabeltranvesga.github.io/RETO01/web/

La plataforma calcula cuánta energía consume un proyecto, cuántos paneles solares necesita y qué equipo de conversión (y, si aplica, qué baterías) debe usar. No requiere instalación ni registro: se abre en el navegador del computador o del teléfono. La misma ayuda está dentro de la aplicación, en el botón **? Ayuda** de la barra superior.

## Antes de empezar

- Cada paso usa lo que ya se escribió en los anteriores: nunca hay que repetir datos.
- Los resultados se recalculan solos cuando se cambia algo.
- Los números usan coma decimal y punto de miles (3.942 W; 32,688 kWh).
- Si tiene un proyecto guardado (un archivo `.json`, como el ejemplo `escenario_f_cartagena.json`), ábralo en el Paso 1 con **"Cargar proyecto desde archivo"**: todos los pasos quedan calculados.

## Paso 1 · Proyecto

1. Escriba el nombre del proyecto, los integrantes y la fecha.
2. Elija el contexto: **On-grid** si hay red eléctrica; **Off-grid** si el sistema es aislado; los híbridos combinan ambos.
3. Pulse **"Guardar datos del proyecto"**.

En este paso también puede guardar el proyecto en un archivo `.json` o abrir uno guardado antes (por ejemplo, los de la carpeta `ejemplos` del repositorio).

## Paso 2 · Cargas

1. Escriba el nombre del aparato, cuántos hay iguales y la potencia de cada uno en vatios (W), como aparece en su placa.
2. Marque las horas en que está encendido. Cada casilla es una hora completa: 08:00 significa de 08:00 a 09:00.
   - Para marcar varias horas a la vez use **"Marcar franja"**: elija *desde* y *hasta* (por ejemplo, 08:00 a 20:00).
   - Si el aparato se usa en dos momentos del día, marque una franja y luego la otra.
   - Si la hora final es menor que la inicial (por ejemplo 22:00 a 04:00), la franja cruza la medianoche; la aplicación lo avisa.
3. Pulse **"Agregar carga al cuadro"**.
4. Para corregir una carga, selecciónela en la tabla y pulse **"Editar"**; para quitarla, **"Eliminar"** (pide confirmación).

## Paso 3 · Resultados

1. Revise los días de operación al mes y al año, el costo de la energía (**CU**, en $/kWh) y la ventana solar (por defecto 06:00 a 18:00).
2. Pulse **"Calcular resultados"**.

Verá la potencia instalada, la demanda máxima y su hora, la energía diaria, mensual y anual, los costos y la gráfica de las 24 horas (toque o pase el cursor sobre una barra para ver su valor). Si la demanda máxima ocurre en varias horas, se reporta la primera y se listan las demás.

## Paso 4 · Generador

1. Elija el sitio en la lista. Si no está, abra **"Consultar otra ubicación en línea (NASA POWER)"**, escriba la latitud y la longitud y pulse **"Consultar NASA POWER"**.
2. Elija si dimensiona con el mes de menor recurso o con el promedio anual (en sistemas on-grid suele usarse el promedio anual).
3. Revise los parámetros (factor de desempeño PR, tensión máxima, área disponible, temperaturas) y pulse **"Dimensionar generador"**.

Verá la potencia pico, el número de paneles y cómo se conectan, y la tabla **"Contraste con una segunda fuente"**, que compara el resultado con otra base de datos de radiación solar (se acepta hasta ±15 % de diferencia).

## Paso 5 · Conversión y almacenamiento

1. Indique si el sistema tiene baterías (la aplicación lo propone según el contexto del Paso 1).
2. Responda las preguntas numeradas. Si hay baterías: qué deben cubrir (**días completos sin sol**, el método del curso, o **solo el consumo de la noche**, útil en sistemas híbridos), cuántos días o noches y qué batería usar. Si no hay baterías: el rango de tamaño del inversor.
3. Lea el resumen de arriba: dice en palabras sencillas si el sistema funciona. Si algo falla, el mismo resumen ofrece el botón para corregirlo (agregar paneles o reorganizarlos).

Las tarjetas de equipos explican por qué cada regulador o inversor sirve o no. Si el generador es grande, la plataforma puede proponer **varios reguladores en paralelo** (por ejemplo, "4 × SmartSolar MPPT 150/70"): los paneles se reparten en grupos y cada grupo va a su regulador, todos cargando las mismas baterías. Solo lo hace con reguladores cuya ficha permite trabajar en paralelo. El detalle técnico y las fórmulas están en **"Ver detalle técnico"**.

## Paso 6 · Informe y resultados

- **Informe de una página (PDF):** resumen con días de operación, CU, consumo, generador, segunda fuente y equipo.
- **Informe completo (PDF):** incluye la memoria de cálculo.
- **Resultados en CSV:** para abrir en Excel u otra hoja de cálculo.
- **Resultados en JSON:** para otros programas.

## Asistente de ayuda

El botón **«¿Dudas?»** de la esquina inferior derecha abre un asistente. Escriba su pregunta con sus propias palabras (por ejemplo, «¿qué es el CU?» o «¿cómo marco un horario que pasa de medianoche?») y el asistente responde con la información de este manual. Cuando aplica, ofrece un botón para ir directamente al paso del que habla la respuesta. También muestra preguntas frecuentes del paso en el que usted está.

El asistente no usa inteligencia artificial: busca las palabras de su pregunta en las preguntas frecuentes del manual. Si no encuentra una respuesta, se lo dice y le propone temas parecidos.

## Si algo no funciona

- **Un mensaje en rojo** dice exactamente qué dato corregir (por ejemplo, "La cantidad no puede ser cero").
- **Sin internet:** la aplicación sigue con la base de datos local de radiación y lo informa; el PDF necesita conexión para descargarse, pero el CSV y el JSON no.
- **Para no perder el trabajo:** guárdelo con **"Guardar proyecto en archivo (.json)"** en el Paso 1.
