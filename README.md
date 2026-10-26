# Plataforma de dimensionamiento fotovoltaico · Energía Solar Fotovoltaica

**Versión 1.0.0 (26/10/2026)** · ver [CHANGELOG.md](CHANGELOG.md)

Universidad del Magdalena · Electiva ESFV 2026-II
Integrantes: Niurka Beltrán Vesga, Miguel Ángel Bernal López

- **Reto 01:** caracterización del consumo energético (cuadro de cargas, perfil horario, energía y costos).
- **Reto 02:** dimensionamiento del generador fotovoltaico (potencia pico, número de módulos, configuración en cadenas, tensiones, corrientes, área e informe), integrado en la misma aplicación web.
- **Reto 03:** dimensionamiento del regulador o inversor MPPT y del banco de baterías (con y sin almacenamiento, balance de cierre e informe), integrado en la misma aplicación web.
- **Reto 04:** entrega formal de la plataforma: despliegue en línea, escenario del grupo F (Cartagena) precargado, contraste con una segunda fuente, informe de una página, exportación CSV/JSON, validaciones, pruebas, ayuda integrada y versionado.

### 🌐 Aplicación Web (Retos 01 a 04)
Puedes acceder a la app web desplegada a través del siguiente enlace:
- [Ver Aplicación Web](https://niurkabeltranvesga.github.io/RETO01/web/)

También se puede abrir sin internet con doble clic en `web/index_standalone.html` (versión de un solo archivo).

La documentación de la aplicación web está en la carpeta `web/docs/`:
- `web/docs/README.md`: arquitectura, dependencias, despliegue, fuentes de datos, formato de números, validaciones, limitaciones, pruebas y dónde está cada entregable de los Retos 02 a 04.
- `web/docs/MANUAL_USUARIO.md`: manual de usuario (también como ayuda integrada en la aplicación).
- `web/docs/DECISIONES.md`: decisiones de diseño (consulta en línea del recurso solar, escenario F, arranque de motores y formato de números).
- `web/docs/METODO_PROPIO.md`: método propio para la potencia pico.

---

## 💻 2. Versión de Escritorio (MATLAB) · Reto 01
Aplicación independiente para Windows que se ejecuta como un programa normal sin abrir el entorno de MATLAB ni ver código fuente.

Según el equipo donde la vayas a ejecutar, elige una de las dos opciones:

### 🔹 Opción A: Si ya tienes MATLAB instalado en tu PC
Solo necesitas descargar y abrir directamente el ejecutable:
1. Ve a la carpeta: `gui/AppReto01/for_redistribution_files_only/`
2. Descarga y ejecuta con doble clic el archivo **`AppReto01.exe`**.

---

### 🔹 Opción B: Si NO tienes MATLAB instalado
Para computadoras sin MATLAB, se requiere instalar previamente el motor de ejecución gratuito (**MATLAB Runtime**):
1. Ve a la carpeta: `gui/AppReto01/for_redistribution/`
2. Descarga y ejecuta el instalador **`MyAppInstaller_web.exe`**.
3. El instalador descargará e instalará automáticamente el motor gratuito necesario.
4. Al finalizar la instalación, podrás abrir y usar la aplicación con normalidad.

---

## 📁 Estructura del Proyecto
* `web/`: Aplicación web interactiva (Retos 01 a 04), desplegada en GitHub Pages.
  * `web/datos/`: catálogo de módulos, catálogo de equipos de conversión y baterías, y base de datos de sitios (recurso solar).
  * `web/docs/`: documentación de la aplicación web.
  * `web/ejemplos/`: proyectos `.json` que se abren con "Cargar proyecto desde archivo": escenario F (Cartagena), caso de prueba estandarizado, caso propio (Distrimedical) y ejemplos.
  * `web/informes/`: informes generados por la aplicación.
  * `web/test/`: pruebas automáticas de la aplicación web (`node test/ejecutar_todas.js`).
* `gui/`: Archivos de la interfaz de escritorio, código fuente `.m`, ejecutable directo e instalador de Runtime.
* `src/`: Funciones de cálculo matemático, lógica y generación de reportes.
* `test/`: Pruebas unitarias y validaciones del sistema.


