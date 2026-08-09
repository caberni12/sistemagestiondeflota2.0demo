# Sistema de Gestión de Flotas Web 4.2.46

Entrega oficial en una sola carpeta. Incluye Oficina Virtual, rutas, operaciones, check-in, ubicación en tiempo real, fotografías, documentos, alertas, lector QR, conexiones en línea, reportes y KPI modernos.

En el primer uso, el RUT consulta el directorio empresarial de Google Sheets. Solamente una empresa con estado `ACTIVA` y una `URL_CONEXION` HTTPS válida habilita el formulario real de inicio de sesión. La URL queda guardada en el navegador y se conserva al cerrar, apagar o reiniciar. Antes de cada nuevo acceso se confirma silenciosamente que la empresa siga `ACTIVA`; `BLOQUEADA` impide crear o reanudar sesiones sin volver a solicitar el RUT.

Documentos se presenta por expedientes en tarjetas. Administración, Gerencia y Operador consultan todos los expedientes; el Conductor ve siempre sus documentos personales y únicamente los del vehículo asignado vigente. `Ver expediente completo` abre fotografías y PDF, y después de la primera apertura conserva una copia privada para futuras consultas sin conexión.

Check-in utiliza una relación explícita entre usuario, conductor y vehículo. El modal administrativo actualiza las listas antes de abrir, muestra nombre y RUT, y relaciona por correo exacto cuando falta `USUARIO_ID`. El perfil Conductor recibe solamente su vehículo vigente y no puede modificar los selectores ni utilizar el QR de otro vehículo.

Consulte:

- `../../00_LEEME_PRIMERO.md`
- `../../04_DOCUMENTACION/01_GUIA_IMPLEMENTACION_COMPLETA.md`
- `../../04_DOCUMENTACION/13_VALIDACION_INICIAL_UNICA_Y_DIRECTORIO_CRUD_4.2.46_3.3.0.md`
- `../../04_DOCUMENTACION/14_AJUSTES_OPERACIONALES_FINALES_WEB_4.2.46_ANDROID_3.3.0.md`
