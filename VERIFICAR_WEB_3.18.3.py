from pathlib import Path
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parent
errors = []

required = [
    'Codigo_Completo.gs', 'aplicacion.js', 'conexion.js', 'configuracion.js',
    'combustible.html', 'checkin-vehicular.html', 'operaciones.html', 'oficina-virtual.html',
    'main.html', 'menu-principal.js',
    'CAMBIOS_VERSION_3.18.3.md', 'LEEME_ACTUALIZACION_3.18.3.md', 'PRUEBAS_VERSION_3.18.3.md',
]
for name in required:
    if not (root / name).is_file():
        errors.append(f'Falta: {name}')

app = (root / 'aplicacion.js').read_text(encoding='utf-8')
connection = (root / 'conexion.js').read_text(encoding='utf-8')
server = (root / 'Codigo_Completo.gs').read_text(encoding='utf-8')
configuration = (root / 'configuracion.js').read_text(encoding='utf-8')
main = (root / 'main.html').read_text(encoding='utf-8')
menu = (root / 'menu-principal.js').read_text(encoding='utf-8')
url_servicio = 'https://script.google.com/macros/s/AKfycbyPAsAMUmGzYTMKmOxaKGoOvYbHVAzfpy2FFPXiz-7iYZWju_sYkJNSV0H1JYnkjd0lag/exec'
if url_servicio not in configuration:
    errors.append('La nueva URL /exec no está integrada en configuracion.js')

for value in [
    "VERSION: '3.18.3'", 'data-open-fuel-qr', 'data-open-checkin-qr',
    "openQr('combustible')", "openQr('checkin')", 'aplicarVehiculoQrCheckin',
    "api.request('validateVehicleQr',{codigo:limpio,contexto:context})",
    'AUTORIZACION_QR',
]:
    if value not in configuration + app:
        errors.append(f'La interfaz QR contextual no contiene: {value}')

for value in [
    "const VERSION_APLICACION = '3.18.3'", 'normalizarContextoQrVehiculo_',
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

for value in [
    "['office','◆','Oficina Virtual']", 'renderOficinaVirtual',
    "api.request('officeAsk'", "api.request('officeQuickStatus'",
    "api.request('officeTasks'", 'cargarPendientesOficinaVirtual',
    'data-office-auto', 'Un solo aviso por tarea', 'Validar y cerrar',
]:
    if value not in app:
        errors.append(f'La interfaz de Oficina Virtual no contiene: {value}')

for value in [
    "case 'estadoRapidoOficinaVirtual'", "case 'pendientesOficinaVirtual'",
    "case 'estadoOficinaVirtual'", 'consultarOficinaVirtual_',
    'configurarModoOficinaVirtual_', 'procesarOficinaVirtualProgramada_',
    'generarAvisosPersonalesOficinaVirtual_', 'prepararContextoTareasOficinaVirtual_',
    'OFICINA_VIRTUAL_CACHE_VERSION_', 'cerrarAlertaTecnicaActivadorResueltaOficinaVirtual_',
    'ALERTA_OPERACIONAL_REQUIERE_ADMINISTRADOR', 'registrarReporteConductorOficinaVirtual_',
    'OV-TAREA-', 'alertasDocumentosHeredadas',
]:
    if value not in server:
        errors.append(f'El servidor de Oficina Virtual no contiene: {value}')

for value in ['officeQuickStatus', 'officeTasks', 'officeStatus', 'officeAsk', 'localOfficeTasks', 'localOfficeQuickStatus', 'localReportDriverOffice', 'localSyncOfficeTasks']:
    if value not in connection:
        errors.append(f'El modo local de Oficina Virtual no contiene: {value}')

for value in [
    'avisosEmergentesMenu', 'interruptorAvisosEmergentes',
    'Los pendientes siguen en el icono',
]:
    if value not in main:
        errors.append(f'El interruptor administrativo no contiene: {value}')

for value in [
    'claveAvisosEmergentesMenu', 'avisosEmergentesActivosMenu',
    "localStorage.setItem(claveAvisosEmergentesMenu(),activo?'SI':'NO')",
    "document.querySelectorAll('.toast-aviso-menu')",
    'if(!avisosEmergentesActivosMenu())return',
    'Avisos emergentes silenciados · pendientes en el icono',
]:
    if value not in menu:
        errors.append(f'El control del menú no contiene: {value}')

for value in [
    'claveAvisosEmergentes', 'avisosEmergentesActivos',
    'if(embeddedMode||!avisosEmergentesActivos())return',
    'notificationSnapshotReady&&avisosEmergentesActivos()',
    "badge.textContent=count>99?'99+':String(count)",
]:
    if value not in app:
        errors.append(f'La cola silenciosa no contiene: {value}')

if "api.request('readNotification'" in menu or "api.request('readAlert'" in menu:
    errors.append('El interruptor no debe marcar avisos como leídos')

for html in root.glob('*.html'):
    text = html.read_text(encoding='utf-8')
    if 'aplicacion.js' in text and 'aplicacion.js?v=3.18.3' not in text:
        errors.append(f'{html.name} no referencia aplicacion.js 3.18.3')

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

print('Sistema web 3.18.3 verificado correctamente.')
