#!/usr/bin/env python3
"""
build_standalone.py

Genera index_standalone.html: una versión de UN SOLO ARCHIVO de la app
web, con el CSS, el JavaScript y la imagen de fondo incrustados
directamente adentro (sin archivos "hermanos" sueltos). Con el fin de poder ver la app
por app como wpp.

Ejecutar cada vez que se edite index.html, styles.css, app.js,
motorCalculo.js, informe.js o la imagen de fondo:

    python3 build_standalone.py
"""
import base64
import os

CARPETA = os.path.dirname(os.path.abspath(__file__))

def leer(nombre, binario=False):
    ruta = os.path.join(CARPETA, nombre)
    modo = 'rb' if binario else 'r'
    with open(ruta, modo, encoding=None if binario else 'utf-8') as f:
        return f.read()

def main():
    html = leer('index.html')
    css = leer('styles.css')
    motor = leer('motorCalculo.js')
    informe = leer('informe.js')
    app = leer('app.js')
    img_bytes = leer('assets/fondo-paneles.png', binario=True)
    img_b64 = base64.b64encode(img_bytes).decode('ascii')

    css = css.replace(
        "url('assets/fondo-paneles.png')",
        f"url('data:image/png;base64,{img_b64}')"
    )

    html = html.replace(
        '<link rel="stylesheet" href="styles.css">',
        f'<style>\n{css}\n</style>'
    )
    html = html.replace('<script src="motorCalculo.js"></script>', f'<script>\n{motor}\n</script>')
    html = html.replace('<script src="informe.js"></script>', f'<script>\n{informe}\n</script>')
    html = html.replace('<script src="app.js"></script>', f'<script>\n{app}\n</script>')

    salida = os.path.join(CARPETA, 'index_standalone.html')
    with open(salida, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f'Generado: {salida} ({os.path.getsize(salida):,} bytes)')

if __name__ == '__main__':
    main()
