# Sistema de Gestión de Flotas Web 4.2.45

Entrega oficial en una sola carpeta. Incluye Oficina Virtual, rutas, operaciones, check-in, ubicación en tiempo real, fotografías, documentos, alertas, lector QR, conexiones en línea, reportes y KPI modernos.

En el primer uso, el RUT consulta el directorio empresarial de Google Sheets. Solamente una empresa con estado `ACTIVA` y una `URL_CONEXION` HTTPS válida habilita el formulario real de inicio de sesión. La URL queda guardada en el navegador y se conserva al cerrar, apagar o reiniciar. Antes de cada nuevo acceso se confirma silenciosamente que la empresa siga `ACTIVA`; `BLOQUEADA` impide crear o reanudar sesiones sin volver a solicitar el RUT.

Consulte:

- `../../00_LEEME_PRIMERO.md`
- `../../04_DOCUMENTACION/01_GUIA_IMPLEMENTACION_COMPLETA.md`
- `../../04_DOCUMENTACION/13_VALIDACION_INICIAL_UNICA_Y_DIRECTORIO_CRUD_4.2.45_3.2.8.md`
