# Reto 01 · Requerimiento Energético — Aplicación web

Versión: 1.0 · Agosto 2026

Versión web de la aplicación para caracterizar el requerimiento
energético de un proyecto (cuadro de cargas, perfil horario, potencia,
energía y costos), con la misma lógica de cálculo que la versión de
escritorio.

## Dependencias
- Un navegador (Chrome, Firefox o Edge). No requiere instalación.
- Conexión a internet solo para generar el informe en PDF (librería
  jsPDF, cargada desde un CDN).

## Estructura
- app.html            → versión con archivos separados (CSS/JS aparte)
- app-compartir.html  → versión de un solo archivo (todo incluido)
- motorCalculo.js        → lógica de cálculo
- app.js / informe.js    → interfaz y generación del PDF

## Instrucciones
1. Si tienes la carpeta completa: abrir "app.html" con doble clic.
2. Si vas a compartir un solo archivo (ej. WhatsApp, correo): usar
   "app-compartir.html".
3. Seguir el flujo: Proyecto → Cargas → Resultados → Informe.

## Pruebas
En la carpeta test se encuentran los 3 casos de ejemplos para cargar y verificar, aparte contiene los informes de cada prueba.