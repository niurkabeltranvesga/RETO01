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
| **E. Cambiar a otra API** (NASA POWER) | Otra fuente de datos de radiación | Podría permitir consultas desde el navegador | No se pudo confirmar que admita consultas desde páginas web. Además entrega la radiación sobre plano horizontal, lo que obligaría a agregar un modelo de transposición al plano inclinado: un supuesto más, distinto de la fuente de la base local |

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
