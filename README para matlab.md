# Reto 01 · Requerimiento Energético — Aplicación de escritorio (MATLAB)

Versión: 1.0 · Agosto 2026

Aplicación de escritorio para caracterizar el requerimiento energético
de un proyecto (cuadro de cargas, perfil horario, potencia, energía y
costos), como etapa previa al dimensionamiento de un sistema solar
fotovoltaico.

## Dependencias
- MATLAB R2019b o superior (u Octave 8+, sin toolboxes adicionales).

## Estructura
- src/  → funciones de cálculo (lógica, sin interfaz)
- gui/  → aplicación de escritorio (AppReto01.m)
- test/ → pruebas y un informe de ejemplo en PDF

## Instrucciones
1. Abrir MATLAB y ubicar la carpeta "reto01" como carpeta actual.
2. Agregar la carpeta "src" al path (clic derecho → Add to Path).
3. Entrar a la carpeta "gui" y ejecutar: AppReto01
4. Seguir el flujo: Proyecto → Cargas → Resultados → Informe.

## Pruebas
En la carpeta test se encuentran los 3 casos de ejemplos para cargar y verificar, aparte contiene los informes de cada prueba.