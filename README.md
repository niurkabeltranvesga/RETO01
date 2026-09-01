# RETO 01

### 🌐 Aplicación Web
Puedes acceder a la app web desplegada a través del siguiente enlace:
- [Ver Aplicación Web](https://niurkabeltranvesga.github.io/RETO01/web/)
  
---

## 💻 2. Aplicación de Escritorio (`gui/`)
Es una aplicación independiente para Windows que **no requiere abrir MATLAB ni manipular código fuente**.

Los archivos para ejecutarla se encuentran dentro de la carpeta `gui/`:

### 🔹 Caso A: Si ya tienes MATLAB instalado en tu computadora
1. Entra a la carpeta `gui/`.
2. Descarga y ejecuta directamente el archivo **`AppReto01.exe`** con doble clic.

---

### 🔹 Caso B: Si NO tienes MATLAB instalado (o estás en otra PC)
Para correr la aplicación sin tener el software de MATLAB, se requiere el motor gratuito de ejecución (**MATLAB Runtime**):

1. Entra a la carpeta `gui/` y descarga el archivo **`MyAppInstaller_web.exe`**.
2. Ejecuta **`MyAppInstaller_web.exe`**: este instalador descargará y configurará automáticamente el MATLAB Runtime gratuito en tu sistema.
3. Una vez finalizada la instalación, podrás abrir y usar la aplicación normalmente desde el acceso directo creado o ejecutando **`AppReto01.exe`**.

---

## 📁 Estructura del Repositorio

- `gui/`: Contiene el ejecutable independiente (`AppReto01.exe`), el instalador web (`MyAppInstaller_web.exe`) y el archivo fuente `.m`.
- `src/`: Funciones de cálculo, modelos matemáticos y generación de reportes.
- `web/`: Archivos HTML, JavaScript y estilos desplegados en GitHub Pages.
- `test/`: Pruebas unitarias y validaciones de persistencia y cálculo.
