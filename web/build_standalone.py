#!/usr/bin/env python3
"""
build_standalone.py

Genera index_standalone.html: una versión de UN SOLO ARCHIVO de la app
web, con el CSS, el JavaScript y la imagen de fondo incrustados
directamente adentro (sin archivos "hermanos" sueltos). Con el fin de poder ver la app
por app como wpp.

Además genera datos/datos_respaldo.js, una copia del catálogo de módulos y
de la base de sitios que la app usa cuando se abre sin servidor (doble clic),
porque en ese caso el navegador no deja leer los .json directamente.

Ejecutar cada vez que se edite cualquier archivo de la app, el catálogo
(datos/catalogo_modulos.json), la base de sitios (datos/base_sitios.json) o
la imagen de fondo:

    python3 build_standalone.py
"""
import base64
import json
import os

CARPETA = os.path.dirname(os.path.abspath(__file__))

def leer(nombre, binario=False):
    ruta = os.path.join(CARPETA, nombre)
    modo = 'rb' if binario else 'r'
    with open(ruta, modo, encoding=None if binario else 'utf-8') as f:
        return f.read()

def generar_respaldo_datos():
    catalogo = json.loads(leer('datos/catalogo_modulos.json'))
    sitios = json.loads(leer('datos/base_sitios.json'))
    contenido = (
        '// Archivo generado por build_standalone.py: NO editar a mano.\n'
        '// Copia de datos/catalogo_modulos.json y datos/base_sitios.json para\n'
        '// cuando la aplicación se abre sin servidor.\n'
        'window.DATOS_RESPALDO = ' + json.dumps({'catalogo': catalogo, 'sitios': sitios}, ensure_ascii=False, indent=2) + ';\n'
    )
    with open(os.path.join(CARPETA, 'datos', 'datos_respaldo.js'), 'w', encoding='utf-8') as f:
        f.write(contenido)
    print(f"Generado: datos/datos_respaldo.js ({len(catalogo['modulos'])} módulos, {len(sitios['sitios'])} sitios)")
    return contenido

def main():
    respaldo = generar_respaldo_datos()
    html = leer('index.html')
    css = leer('styles.css')
    motor = leer('motorCalculo.js')
    medicion = leer('medicion.js')
    dimensionamiento = leer('dimensionamiento.js')
    generador = leer('generador.js')
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
    html = html.replace('<script src="medicion.js"></script>', f'<script>\n{medicion}\n</script>')
    html = html.replace('<script src="dimensionamiento.js"></script>', f'<script>\n{dimensionamiento}\n</script>')
    html = html.replace('<script src="datos/datos_respaldo.js"></script>', f'<script>\n{respaldo}\n</script>')
    html = html.replace('<script src="generador.js"></script>', f'<script>\n{generador}\n</script>')
    html = html.replace('<script src="informe.js"></script>', f'<script>\n{informe}\n</script>')
    html = html.replace('<script src="app.js"></script>', f'<script>\n{app}\n</script>')

    salida = os.path.join(CARPETA, 'index_standalone.html')
    with open(salida, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f'Generado: {salida} ({os.path.getsize(salida):,} bytes)')

if __name__ == '__main__':
    main()
