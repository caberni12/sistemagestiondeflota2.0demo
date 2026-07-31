from pathlib import Path
root = Path(__file__).resolve().parent
code = (root / 'Codigo_Completo.gs').read_text(encoding='utf-8')
checks = {
    'version': "const VERSION_APLICACION = '3.18.8'" in code,
    'hoja': '19Ggp4mVNICMxP-m8jpeMAUHaMS98NrASUCg003e74NI' in code,
    'pdf_exclusivo': "ID_CARPETA_DOCUMENTOS_PDF: ID_CARPETA_DOCUMENTOS_PDF_OFICIAL_" in code,
    'fotos_separadas': "ID_CARPETA_DOCUMENTOS_FOTOS: '1lWKDp7E28XU2D45ihvZctIq29Ji_aoq9'" in code,
    'combustible_separado': "ID_CARPETA_BOLETAS_COMBUSTIBLE: '1JE9_yNAo0gpCZ1CnAnXMN8bhNh6fZTPj'" in code,
    'limpieza': "properties.deleteProperty(key)" in code,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit('Falló la verificación: ' + ', '.join(failed))
print('Sistema Web 3.18.8 verificado: la última carpeta se usa solo para documentos PDF.')
