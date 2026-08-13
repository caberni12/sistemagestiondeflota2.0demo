from pathlib import Path
import base64, shutil, re, secrets, hashlib
src=Path(__file__).resolve().parent
out=src.parent/'WEB_PRODUCCION_PLANA'
if out.exists(): shutil.rmtree(out)
out.mkdir(parents=True)
htmls=['index.html','main.html','panel-principal.html','oficina-virtual.html','rutas.html','checkin-vehicular.html','operaciones.html','ubicacion-tiempo-real.html','notificaciones.html','vehiculos.html','conductores.html','checkin-aprobaciones.html','checkin-historial.html','mantenciones.html','combustible.html','documentos.html','historial.html','alertas.html','conexiones-en-linea.html','usuarios.html','empresa.html','reportes.html','auditoria.html','configuracion.html','actualizaciones-app.html']
css=['acceso.css','estilos.css','responsive.css','interfaz-moderna.css','menu-principal.css']
assets=['logo.svg','Plantilla_Importacion_Vehiculos.xlsx','Plantilla_Importacion_Conductores.xlsx','Plantilla_Importacion_Documentos.xlsx','compatibilidad-web-4318.js']
for f in htmls+css+assets: shutil.copy2(src/f,out/f)
shutil.copy2(src/'seguridad-modulo.js',out/'seguridad-modulo.js')
shutil.copy2(src/'tema.js',out/'tema.js')
def pack(files,dest,label):
    code='\n;\n'.join((src/f).read_text(encoding='utf-8') for f in files)
    key=secrets.token_bytes(29); raw=code.encode(); enc=bytes(b^key[i%len(key)] for i,b in enumerate(raw))
    payload=base64.b64encode(enc).decode(); key64=base64.b64encode(key).decode()
    loader=f'(()=>{{"use strict";const p="{payload}",k=Uint8Array.from(atob("{key64}"),c=>c.charCodeAt(0)),r=atob(p),b=new Uint8Array(r.length);for(let i=0;i<r.length;i++)b[i]=r.charCodeAt(i)^k[i%k.length];const c=new TextDecoder().decode(b),u=URL.createObjectURL(new Blob([c],{{type:"text/javascript"}})),s=document.createElement("script");s.src=u;s.dataset.sgfBundle="{label}";s.onload=()=>URL.revokeObjectURL(u);s.onerror=()=>{{URL.revokeObjectURL(u);console.error("No se pudo iniciar {label}")}};document.head.appendChild(s)}})();'
    (out/dest).write_text(loader,encoding='utf-8')
    return dest, hashlib.sha256((out/dest).read_bytes()).hexdigest(), len(raw), (out/dest).stat().st_size
bundles=[pack(['configuracion.js','conexion.js','acceso.js'],'sgf-login.4321.js','LOGIN'),pack(['configuracion.js','conexion.js','menu-principal.js'],'sgf-shell.4321.js','SHELL'),pack(['configuracion.js','mapa.js','conexion.js','jszip.min.js','qr-flotas.js','reportes-exportacion.js','sgf-publicador-android.js','aplicacion.js'],'sgf-module.4321.js','MODULO')]
p=out/'index.html';t=p.read_text();t=re.sub(r'<script src="configuracion\.js[^>]*></script>\s*<script src="conexion\.js[^>]*></script>\s*<script src="acceso\.js[^>]*></script>','<script src="sgf-login.4321.js?v=web4321-cache-final"></script>',t);p.write_text(t)
p=out/'main.html';t=p.read_text();t=re.sub(r'<script src="configuracion\.js[^>]*></script>\s*<script src="conexion\.js[^>]*></script>\s*<script src="menu-principal\.js[^>]*></script>','<script src="sgf-shell.4321.js?v=web4321-cache-final"></script>',t);p.write_text(t)
for name in [x for x in htmls if x not in ('index.html','main.html')]:
    p=out/name;t=p.read_text()
    for js in ['configuracion.js','mapa.js','conexion.js','jszip.min.js','qr-flotas.js','reportes-exportacion.js']:
        t=re.sub(rf'\s*<script src="{re.escape(js)}[^>]*></script>','',t)
    t=re.sub(r'<script src="aplicacion\.js[^>]*></script>','<script src="sgf-module.4321.js?v=web4321-cache-final"></script>',t)
    p.write_text(t)
(out/'00_LEEME_SUBIR_ESTOS_ARCHIVOS.txt').write_text('''SGF WEB 4.3.21 - PRODUCCION SEGURA PLANA\n\nSuba TODOS estos archivos juntos en la raíz del sitio. No se requieren subcarpetas.\n\nProtecciones: módulos directos vuelven al login; ticket efímero por pestaña; validación API antes de abrir módulos; modo local deshabilitado en producción; postMessage limitado al iframe/origen; identidad y permisos solo se aceptan desde la API; JavaScript de negocio empaquetado/ofuscado sin source maps.\n\nPublicación Android: si se interrumpe la carga, la Web consulta el estado del almacenamiento seguro y continúa desde el último byte confirmado. Si el archivo terminó de cargarse pero se perdió la respuesta final, el sistema lo recupera por su identificador sin duplicarlo. La confirmación admite hasta 180 segundos.\n\nNota: en un hosting estático el código que ejecuta el navegador nunca puede ser 100% secreto. La seguridad real está en la API, que valida sesión, rol, permisos y alcance.\n''',encoding='utf-8')
lines=['SGF WEB PRODUCCION SEGURA PLANA 4.3.21','']+[f'{d} | SHA256 {h} | fuente {a} | distribuido {b}' for d,h,a,b in bundles]
(out/'MANIFIESTO_SEGURIDAD_WEB_4.3.21.txt').write_text('\n'.join(lines)+'\n')

(out/'.nojekyll').write_text('',encoding='utf-8')
(out/'404.html').write_text('''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow,noarchive"><meta http-equiv="refresh" content="0;url=index.html?sesion=ruta_no_autorizada"><title>Acceso protegido</title></head><body><script>location.replace('index.html?sesion=ruta_no_autorizada');</script><p>Redirigiendo al acceso seguro…</p></body></html>''',encoding='utf-8')
print('Web segura generada en:',out)
