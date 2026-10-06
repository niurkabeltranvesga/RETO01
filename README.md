# RETO 01 y RETO 02 · Energía Solar Fotovoltaica

Universidad del Magdalena · Electiva ESFV 2026-II
Integrantes: Niurka Beltrán Vesga, Miguel Ángel Bernal López

- **Reto 01:** caracterización del consumo energético (cuadro de cargas, perfil horario, energía y costos).
- **Reto 02:** dimensionamiento del generador fotovoltaico (potencia pico, número de módulos, configuración en cadenas, tensiones, corrientes, área e informe), integrado en la misma aplicación web.

### 🌐 Aplicación Web (Reto 01 + Reto 02)
Puedes acceder a la app web desplegada a través del siguiente enlace:
- [Ver Aplicación Web](https://niurkabeltranvesga.github.io/RETO01/web/)

También se puede abrir sin internet con doble clic en `web/index_standalone.html` (versión de un solo archivo).

La documentación de la aplicación web está en la carpeta `web/docs/`:
- `web/docs/README.md`: dependencias, cómo ejecutarla, versión, qué hace falta para que la API funcione y dónde está cada entregable del Reto 02.
- `web/docs/DECISIONES.md`: decisión de diseño sobre la consulta en línea del recurso solar.
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
* `web/`: Aplicación web interactiva (Reto 01 y Reto 02), desplegada en GitHub Pages.
  * `web/datos/`: catálogo de módulos y base de datos de sitios (recurso solar).
  * `web/docs/`: documentación de la aplicación web.
  * `web/ejemplos/`: caso de prueba del TdR, caso propio (Distrimedical) y ejemplos.
  * `web/informes/`: informes generados por la aplicación.
  * `web/test/`: pruebas automáticas de la aplicación web.
* `gui/`: Archivos de la interfaz de escritorio, código fuente `.m`, ejecutable directo e instalador de Runtime.
* `src/`: Funciones de cálculo matemático, lógica y generación de reportes.
* `test/`: Pruebas unitarias y validaciones del sistema.


