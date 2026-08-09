from pathlib import Path
import re
root = Path(__file__).resolve().parent
errors=[]
required=['Codigo_Completo.gs','conexion.js','aplicacion.js','estilos.css','qr-flotas.js','LICENCIA_QR.txt','vehiculos.html']
for name in required:
    if not (root/name).is_file(): errors.append(f'Falta {name}')
checks={
 'Codigo_Completo.gs':["const VERSION_APLICACION = '3.18.6'",'obtenerEtiquetaQrVehiculo_','ETIQUETA_QR_ROL_NO_AUTORIZADO',"TITULO:'CONTROL DE FLOTA'",'ANCHO_MM:100','ALTO_MM:50','GENERAR_ETIQUETA_QR'],
 'conexion.js':["vehicleQrLabel:'obtenerEtiquetaQrVehiculo'",'function localVehicleQrLabel',"['ROL-ADMIN','ROL-SUPERVISOR']",'ANCHO_MM:100','ALTO_MM:50'],
 'aplicacion.js':['data-print-vehicle-qr','function puedeImprimirQrVehiculo','function documentoEtiquetaQr','@page{size:100mm 50mm;margin:0}','window.AndroidConfig.imprimirEtiquetaQr','window.FlotasQr.crearSvg'],
 'estilos.css':['Etiqueta QR vehicular 100 × 50 mm','.vehicle-label-preview'],
 'qr-flotas.js':['FlotasQr','crearSvg']
}
for name,tokens in checks.items():
    text=(root/name).read_text(encoding='utf-8',errors='ignore')
    for token in tokens:
        if token not in text: errors.append(f'{name}: falta {token}')
for html in root.glob('*.html'):
    text=html.read_text(encoding='utf-8',errors='ignore')
    if 'aplicacion.js' in text:
        if 'aplicacion.js?v=3.18.6' not in text: errors.append(f'{html.name}: aplicación sin versión 3.18.6')
        if 'qr-flotas.js?v=3.18.6' not in text: errors.append(f'{html.name}: no carga generador QR')
if errors:
    print('\n'.join('ERROR: '+e for e in errors))
    raise SystemExit(1)
print('Sistema Web 3.18.6 verificado correctamente: etiqueta QR 100 × 50 mm, permisos y generador local incluidos.')
