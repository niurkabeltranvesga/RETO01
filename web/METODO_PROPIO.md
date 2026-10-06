# Método propio para la potencia pico: balance día/noche con factor de crecimiento y meta de cobertura

**Integrantes:** Niurka Beltrán Vesga, Miguel Ángel Bernal López  
**Estado:** método documentado (versión 3, con factor de crecimiento y meta de cobertura) e incorporado en la aplicación como opción del paso 4. El método de referencia del TdR sigue siendo el predeterminado.

---

## 1. Qué problema resuelve

El método de referencia del TdR calcula la potencia pico así:

> **Ppico = Ed / (HSP · PR)**

donde:

- **Ed** es la energía diaria que consumen las cargas (kWh/día);
- **HSP** son las horas de sol pleno del sitio (kWh/m²·día);
- **PR** es el factor global de desempeño (0,70 en el caso de prueba).

Esta fórmula tiene dos limitaciones:

1. **Trata toda la energía del día por igual.** En un sistema aislado, la energía que se consume de día puede ir casi directo del generador a las cargas. La de noche, en cambio, tiene que guardarse primero en la batería y sacarse después, y en ese ciclo se pierde una parte.
2. **Dimensiona solo para la carga de hoy.** Si el usuario piensa ampliar sus cargas (más equipos, más sedes, más horas de uso), el sistema queda corto desde el primer día de la ampliación.

La aplicación ya calcula, desde el Reto 01, cuánta energía se consume dentro y fuera de la ventana solar (RF-17), pero el método de referencia no usa ese dato. Este método sí lo usa, y además deja que quien diseña declare cuánto espera que crezca la carga.

## 2. Idea del método

Se separa el consumo en dos partes y solo a la parte de la noche se le carga la pérdida de la batería. El resultado es la **energía equivalente** que el generador tiene que producir. Esa energía se multiplica por un **factor de crecimiento** y por una **meta de cobertura**, que define quien diseña junto con el cliente, y con el resultado se calcula la potencia pico con la misma fórmula del TdR.

## 3. Paso a paso

**Paso 1. Separar el consumo** con el perfil horario de 24 h (la aplicación ya lo hace):

- **E_día:** energía consumida dentro de la ventana solar (06:00–18:00).
- **E_noche:** energía consumida fuera de ella.
- Se cumple que E_día + E_noche = Ed.

**Paso 2. Calcular la energía equivalente:**

> **E_eq = E_día + E_noche / η_bat**

donde **η_bat** es la eficiencia de ida y vuelta de la batería: de cada kWh que entra, la fracción que se puede volver a sacar.

**Paso 3. Aplicar el factor de crecimiento y la meta de cobertura:**

> **F_c = 1 + g**
>
> **E_dis = F_c · Cob · E_eq**

donde **g** es el crecimiento de carga esperado, expresado como fracción (20 % → g = 0,20 → F_c = 1,20). El valor de g lo define quien diseña y debe declararlo con su justificación. Si no se prevé crecimiento, g = 0 y F_c = 1, y el método se reduce a la versión sin factor.

**Cob** es la meta de cobertura: la fracción de la energía que el cliente quiere cubrir con el generador (80 % → Cob = 0,80). Si se quiere cubrir toda la energía, Cob = 1 (100 %).

**Paso 4. Calcular la potencia pico** con la fórmula del TdR, usando E_dis en lugar de Ed:

> **Ppico = E_dis / (HSP · PR) = F_c · Cob · E_eq / (HSP · PR)**

## 4. Qué es el factor de crecimiento y por qué se justifica

El factor de crecimiento **F_c** es un número mayor o igual que 1 que multiplica la energía que el generador debe producir. Representa la holgura que se deja a propósito para cargas futuras.

**Cómo se elige.** F_c = 1 + g. Por ejemplo:

- g = 10 % → F_c = 1,10;
- g = 20 % → F_c = 1,20;
- g = 35 % → F_c = 1,35.

Se escribe con el 1 sumado porque se quiere el 100 % de la carga actual más el porcentaje de crecimiento. Multiplicar por 0,2 daría solo la quinta parte de la energía.

**Por qué se justifica:**

- **Es un dato del proyecto, no un margen arbitrario.** El crecimiento lo conoce quien diseña: planes del cliente, equipos que se van a sumar. Declararlo hace visible la decisión, que así se puede discutir, en lugar de quedar escondida dentro de un PR más bajo o de un módulo de más.
- **Separa tres cosas distintas.** El PR cubre las pérdidas del sistema, la batería cubre el almacenamiento y el F_c cubre el crecimiento de la demanda. Cada una tiene su propio parámetro y no se mezclan.
- **Es más barato prever que ampliar.** Dejar la capacidad prevista desde el diseño evita rehacer cálculos, estructura y cableado más adelante.
- **Es lineal y fácil de verificar.** Como Ppico es proporcional a la energía, multiplicar la energía por F_c es igual a multiplicar la potencia pico por F_c. El resultado se comprueba con una sola operación.
- **Es opcional y neutro.** Con F_c = 1 el método reproduce el resultado sin crecimiento, así que no afecta el caso de prueba del TdR.

## 5. Qué es la meta de cobertura y cuándo se usa

Así como se le pregunta al cliente si quiere un factor de crecimiento, también se le pregunta **cuánto de su consumo quiere cubrir** con energía solar. Muchos clientes no buscan cubrir el 100 %, sino una parte, por ejemplo el 80 % o el 50 %, para bajar su factura con una inversión menor.

- **Cómo se aplica:** se multiplica la energía por Cob. Con Cob = 0,80 el generador se dimensiona para el 80 % de la energía.
- **Cuándo tiene sentido:** cuando hay otra fuente que cubre el resto, como la red (on-grid) o una planta (híbrido).
- **Cuándo no:** en un sistema **off-grid**, el generador es la única fuente. Una cobertura menor al 100 % dejaría sin atender esa parte de la energía, así que la batería se agotaría y las cargas se apagarían. Por eso la aplicación lo **advierte**, aunque permite hacer el cálculo: la decisión queda en manos del diseñador, pero informada.
- **Energía, no factura:** la meta se aplica a la energía (kWh). Cubrir el 80 % de la energía no es exactamente lo mismo que cubrir el 80 % del valor de la factura, porque la factura incluye cargos fijos y la tarifa puede variar.
- **Se combina con el crecimiento.** Por ejemplo, con g = 20 % y Cob = 80 %: 1,20 · 0,80 = 0,96. Los dos factores casi se compensan. Por eso se declaran y se muestran por separado: son dos decisiones distintas del cliente.

## 6. Supuestos y su justificación

| Supuesto | Justificación |
|---|---|
| El **PR = 0,70** representa las pérdidas del camino directo generador–cargas: temperatura, suciedad, cableado y conversión. **No incluye el almacenamiento** | Así lo describe la aplicación en sus supuestos del cálculo. Si el PR ya incluyera la batería, la pérdida se estaría contando dos veces. En ese caso habría que usar un PR más alto para la parte directa |
| Toda la energía nocturna pasa por la batería | En un sistema aislado no hay otra fuente de noche |
| La energía diurna se consume directo, sin pasar por la batería | Es una simplificación. Ver la sección 10 |
| **η_bat = 0,85** en el ejemplo | Es el valor de eficiencia de ida y vuelta que adopta el NREL para baterías de ion-litio en su *Annual Technology Baseline* 2025. Como referencia de operación real, la EIA reportó que el parque de baterías a gran escala de EE. UU. operó al 82 % en 2019. El valor final se elige según la tecnología de batería del proyecto y se declara |
| La carga nueva mantiene la misma proporción día/noche que la actual | Permite aplicar un solo F_c a E_eq. Si la ampliación va a ser sobre todo nocturna, conviene calcular E_eq con el perfil esperado y no solo multiplicar |
| g lo declara quien diseña, con su razón | El método no adivina el crecimiento; solo da el lugar donde se registra y se aplica |
| La meta de cobertura se aplica a la energía (kWh), no al valor de la factura | La aplicación trabaja con energía. El valor de la factura depende de cargos fijos y tarifas que están fuera de este cálculo |
| Si Cob es menor que 100 %, otra fuente cubre el resto | Es la condición para que una cobertura parcial no deje cargas sin atender. En off-grid la aplicación lo advierte |

## 7. Ejemplo con el caso de prueba del TdR (Alta Guajira)

**Datos** (TdR, sección 7.1): Ed = 7,58 kWh/día · E_día = 5,18 kWh · E_noche = 2,40 kWh · HSP del mes crítico = 5,2 · PR = 0,70. Se supone un crecimiento de g = 20 % (F_c = 1,20) y η_bat = 0,85.

**Método de referencia:**

> Ppico = 7,58 / (5,2 · 0,70) = **2,08 kWp**

**Método propio sin crecimiento:**

> E_eq = 5,18 + 2,40 / 0,85 = 5,18 + 2,82 = **8,00 kWh/día**
>
> Ppico = 8,00 / (5,2 · 0,70) = **2,20 kWp**

**Método propio con crecimiento (F_c = 1,20):**

> E_dis = 1,20 · 8,00 = **9,60 kWh/día**
>
> Ppico = 9,60 / (5,2 · 0,70) = 9,60 / 3,64 = **2,64 kWp**

| | Método de referencia | Método propio (F_c = 1) | Método propio (F_c = 1,20) |
|---|---|---|---|
| Energía que debe producir el generador | 7,58 kWh/día | 8,00 kWh/día | 9,60 kWh/día |
| Potencia pico | 2,08 kWp | 2,20 kWp (+5,6 %) | 2,64 kWp (+26,9 %) |
| Módulos de 550 Wp | 2,08 / 0,55 = 3,8 → 4 | 2,20 / 0,55 = 4,0 → 4 | 2,64 / 0,55 = 4,8 → 5 |

**Conclusión del ejemplo:**

- **Con F_c = 1** el número de módulos no cambia (4), pero el excedente del 5,6 % queda explicado como la pérdida de la batería.
- **Con F_c = 1,20** el número de módulos sube a 5, y ese módulo extra está justificado: cubre la pérdida de la batería y el 20 % de crecimiento declarado.

**Con meta de cobertura** (sin crecimiento, E_eq = 8,00 kWh/día):

| Meta de cobertura | E_dis | Potencia pico | Módulos de 550 Wp |
|---|---|---|---|
| 100 % | 8,00 kWh/día | 2,20 kWp | 4 |
| 80 % | 6,40 kWh/día | 1,76 kWp | 1,76 / 0,55 = 3,2 → 4 |
| 50 % | 4,00 kWh/día | 1,10 kWp | 1,10 / 0,55 = 2,0 → 2 |

Como el caso de prueba es **off-grid**, con una cobertura menor al 100 % la aplicación advierte que una parte de la energía quedaría sin atender. En este caso la meta debería ser 100 %.

Esto coincide con lo que el propio TdR destaca en la sección 7.3: el criterio de dimensionamiento no siempre cambia la solución, pero sí cambia si la solución se puede defender.

## 8. Aplicación al caso propio (Distrimedical, Santa Marta)

**Datos del proyecto** (Reto 01): Ed = 40,80 kWh/día. Es un sistema **híbrido off-grid sin baterías**: de noche, la energía la cubre el respaldo.

- **E_día** (06:00–18:00) = **35,10 kWh**, es decir, el 86 % del consumo: aires, computadoras, luces y televisor funcionan de 08:00 a 18:00.
- **E_noche** = **5,70 kWh**, el 14 %: reflectores, cámaras y nevera.

**Cómo se configura el método para este caso:**

| Parámetro | Valor | Justificación |
|---|---|---|
| η_bat | **1,00** | Sin almacenamiento: la energía nocturna no pasa por una batería, así que no hay pérdida de ida y vuelta |
| Cob | **86 %** | El generador cubre el consumo diurno (35,10 / 40,80 = 86 %); el 14 % nocturno lo cubre el respaldo |
| g | **0 %** | No se prevé crecimiento de carga |

> E_eq = 35,10 + 5,70 / 1,00 = **40,80 kWh/día**
>
> E_dis = F_c · Cob · E_eq = 1,00 · 0,86 · 40,80 = **35,09 kWh/día**

**Datos del sitio y de diseño:**

| Dato | Valor | Fuente o justificación |
|---|---|---|
| Sitio | Universidad del Magdalena, Santa Marta | Base de datos de sitios (PVGIS-ERA5). Mes crítico: junio, HSP = 4,44 kWh/m²·día |
| PR | 0,70 | Se adopta el valor del caso de referencia del TdR |
| Tensión máxima del sistema | 600 V | Se adopta el valor del caso de referencia del TdR |
| Temperatura mínima esperada | 17 °C | Mínima récord del aeropuerto Simón Bolívar de Santa Marta, 1991–2020 (IDEAM) |
| Temperatura ambiente de operación | 33 °C | Máxima media diaria del mismo registro (33,2 °C) |
| Área disponible | 50 m² | **Supuesto:** el área real de la cubierta no se ha medido. Se supone que la empresa dispone de al menos 50 m² |

**Resultado** (dimensionando por el mes crítico):

> Ppico = 35,09 / (4,44 · 0,70) = **11,29 kWp**

| | Método de referencia | Método propio |
|---|---|---|
| Energía con la que se dimensiona | 40,80 kWh/día | 35,09 kWh/día |
| Potencia pico | 13,13 kWp | **11,29 kWp** (14 % menos) |

Con el criterio de menor excedente, la aplicación selecciona **18 módulos LONGi LR8-66HVD-650M en 2 cadenas de 9**:

- 11,70 kWp instalados (+3,6 %);
- 48,62 m² ocupados, que caben en los 50 m² supuestos;
- Voc del generador a 17 °C = 454,6 V, por debajo de los 600 V;
- corriente de diseño de 51,7 A.

**Lectura:** al no haber batería, la energía que el generador produzca de más durante el día no se puede guardar para la noche. Con el método de referencia se instalarían 13,13 kWp, y cerca del 14 % de esa capacidad produciría energía sin cargas diurnas que la usen. El método propio dimensiona solo para lo que el generador puede entregar a las cargas, y deja el consumo nocturno al respaldo.

*Comparación: si el proyecto tuviera baterías (η_bat = 0,85, Cob = 100 %), la energía equivalente sería 35,10 + 5,70 / 0,85 = 41,81 kWh/día, un 2,5 % más que Ed. Es menos que en el caso de prueba (5,6 %), porque casi todo el consumo ocurre de día.*

## 9. Cómo definir g en la práctica

Para que el factor de crecimiento no sea un número arbitrario, se recomienda registrar junto a él:

1. **Qué crece:** equipos nuevos, más horas de uso, nueva sede, etc.
2. **Cuánto:** estimación en kWh/día adicionales o en porcentaje sobre la carga actual. Si se estima en kWh/día, g = E_nueva / E_actual.
3. **Cuándo:** horizonte de tiempo previsto, por ejemplo a 3 o 5 años.
4. **Fuente:** plan del cliente, solicitud escrita o criterio del diseñador.

## 10. Limitaciones

- **La ventana solar fija (06:00–18:00) es una aproximación.** En las primeras y últimas horas del día el sol es débil, y parte de ese consumo "diurno" también saldrá de la batería. Por eso el método todavía puede quedarse corto en perfiles con mucho consumo temprano o tarde.
- **η_bat cambia** con la tecnología (plomo-ácido o litio), la temperatura, la profundidad de descarga y la edad de la batería.
- **El factor de crecimiento es una sola cifra para toda la carga.** Si el crecimiento esperado es sobre todo nocturno, el F_c subestima el efecto de la batería sobre esa parte nueva.
- **Un F_c alto sobredimensiona el sistema mientras la carga extra no exista:** al principio el generador produce energía que nadie usa. Conviene que g sea realista y esté justificado.
- **El método no dimensiona la batería:** solo tiene en cuenta su pérdida al calcular la potencia pico. Si la carga crece, la batería, el inversor y el controlador también deben revisarse con la carga ampliada.

## 11. Cómo está incorporado en la aplicación

En el paso 4, sección "Método de cálculo de la potencia pico":

1. Un selector **"Método: método de referencia / método propio"**. El método de referencia es el predeterminado, así que el caso de prueba sigue reproduciendo los valores del TdR.
2. Con el método propio aparecen:
   - un campo para **η_bat** (0,85 por defecto) y otro para **su fuente**. Con η_bat = 1 la aplicación entiende que no hay almacenamiento;
   - un campo para el **crecimiento esperado g (%)**, con valor por defecto 0;
   - un campo para la **meta de cobertura (%)**, con valor por defecto 100, y una advertencia si el sistema es off-grid y la meta es menor al 100 %;
   - una casilla para escribir la **justificación del crecimiento y de la cobertura**.
3. Los resultados muestran lado a lado la potencia pico de **referencia**, la de **balance día-noche sin crecimiento** y la de **diseño con crecimiento y cobertura**. Lo mismo aparece en el informe PDF, junto con E_eq, F_c, Cob y la justificación.
4. η_bat, g, Cob, la fuente y la justificación se guardan en el archivo `.json` del proyecto, y quedan declarados en los supuestos del cálculo.

## Fuentes

- TdR Reto 02 (ESFV 2026-II), secciones 1, 6, 7.1 y 7.3.
- NREL, *Annual Technology Baseline 2025 — Utility-Scale Battery Storage*. Asume una eficiencia de ida y vuelta de 85 %. https://atb.nlr.gov/electricity/2025/utility-scale_battery_storage
- U.S. Energy Information Administration (EIA), datos 2019, citado en *Renewable Energy World*: el parque de baterías a gran escala operó al 82 %. https://www.renewableenergyworld.com/storage/pumped-storage-hydro-utility-scale-batteries-return-about-80-of-the-electricity-they-store/
- IDEAM, registros climáticos del aeropuerto Simón Bolívar de Santa Marta (1991–2020), tomados de la tabla de clima de Santa Marta en Wikipedia: mínima récord de 17,0 °C y máxima media diaria de 33,2 °C. https://en.wikipedia.org/wiki/Santa_Marta
