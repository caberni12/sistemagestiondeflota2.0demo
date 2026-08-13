from pathlib import Path
import re
root = Path(__file__).resolve().parent
url = 'https://script.google.com/macros/s/AKfycbyPAsAMUmGzYTMKmOxaKGoOvYbHVAzfpy2FFPXiz-7iYZWju_sYkJNSV0H1JYnkjd0lag/exec'
errors = []
config = (root / 'configuracion.js').read_text(encoding='utf-8')
code = (root / 'Codigo_Completo.gs').read_text(encoding='utf-8')
if "VERSION: '3.18.9'" not in config: errors.append('versión Web incorrecta')
if "const VERSION_APLICACION = '3.18.9'" not in code: errors.append('versión del servidor incorrecta')
if url not in config: errors.append('URL oficial ausente en configuracion.js')
pat = re.compile(r'https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec')
found = set()
for f in root.rglob('*'):
    if f.is_file() and f.suffix.lower() in ['.bat', '.css', '.csv', '.gradle', '.gs', '.html', '.java', '.js', '.json', '.kt', '.md', '.pro', '.properties', '.py', '.sh', '.txt', '.xml', '.yaml', '.yml']:
        try: found.update(pat.findall(f.read_text(encoding='utf-8')))
        except (UnicodeDecodeError, OSError): pass
if found != {url}: errors.append('se encontraron URLs distintas: ' + ', '.join(sorted(found)))
if errors: raise SystemExit('Falló la verificación: ' + '; '.join(errors))
print('Sistema Web 3.18.9 verificado: contiene una sola URL oficial de Apps Script.')
