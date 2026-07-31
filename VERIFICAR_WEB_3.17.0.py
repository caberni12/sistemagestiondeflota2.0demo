from pathlib import Path
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parent
errors = []

required = [
    'Codigo_Completo.gs', 'aplicacion.js', 'conexion.js', 'configuracion.js',
    'combustible.html', 'checkin-vehicular.html', 'operaciones.html',
    'CAMBIOS_VERSION_3.17.0.md', 'LEEME_ACTUALIZACION_3.17.0.md',
    'PRUEBAS_VERSION_3.17.0.md',
]
for name in required:
    if not (root / name).is_file():
        errors.append(f'Falta: {name}')

app = (root / 'aplicacion.js').read_text(encoding='utf-8')
connection = (root / 'conexion.js').read_text(encoding='utf-8')
server = (root / 'Codigo_Completo.gs').read_text(encoding='utf-8')
configuration = (root / 'configuracion.js').read_text(encoding='utf-8')

for value in [
    "VERSION: '3.17.0'", 'data-open-fuel-qr', 'data-open-checkin-qr',
    "openQr('combustible')", "openQr('checkin')", 'aplicarVehiculoQrCheckin',
    "api.request('validateVehicleQr',{codigo:limpio,contexto:context})",
    'AUTORIZACION_QR',
]:
    if value not in configuration + app:
        errors.append(f'La interfaz QR contextual no contiene: {value}')

for value in [
    "const VERSION_APLICACION = '3.17.0'", 'normalizarContextoQrVehiculo_',
    'consumirAutorizacionQr_', 'CONTEXTO:context',
    "context === 'combustible'", "context === 'checkin'",
    'COMBUSTIBLE_ASIGNACION_ACTIVA_REQUERIDA', 'acceso mediante QR',
]:
    if value not in server:
        errors.append(f'El servidor QR contextual no contiene: {value}')

for value in [
    'localQrContext', 'localConsumeVehicleQrAuthorization',
    'CONTEXTO:context', 'COMBUSTIBLE_ASIGNACION_ACTIVA_REQUERIDA',
]:
    if value not in connection:
        errors.append(f'El modo local QR contextual no contiene: {value}')

for html in root.glob('*.html'):
    text = html.read_text(encoding='utf-8')
    if 'aplicacion.js' in text and 'aplicacion.js?v=3.17.0' not in text:
        errors.append(f'{html.name} no referencia aplicacion.js 3.17.0')

for js in root.glob('*.js'):
    result = subprocess.run(['node', '--check', str(js)], capture_output=True, text=True)
    if result.returncode:
        errors.append(f'JavaScript inválido {js.name}: {result.stderr.strip()}')

with tempfile.NamedTemporaryFile('w', suffix='.js', encoding='utf-8') as temporary:
    temporary.write(server)
    temporary.flush()
    result = subprocess.run(['node', '--check', temporary.name], capture_output=True, text=True)
    if result.returncode:
        errors.append(f'Codigo_Completo.gs inválido: {result.stderr.strip()}')

if errors:
    print('\n'.join(errors))
    sys.exit(1)

print('Sistema web 3.17.0 verificado correctamente.')
