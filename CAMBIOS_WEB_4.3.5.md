# Web 4.3.5 · Documentos y cumpleaños

- Carga múltiple de documentos conservada: cada archivo mantiene su propio tipo.
- Si se carga un documento del mismo tipo para el mismo Conductor o Vehículo, la nueva versión reemplaza a la anterior mediante validación del servidor.
- Solo OPERADOR, ADMINISTRADOR y GERENCIA pueden eliminar documentos; el botón se oculta para otros roles y la API vuelve a validar el rol.
- La eliminación y el reemplazo quedan auditados; la API intenta retirar también el archivo privado anterior de Storage.
- El usuario que está de cumpleaños recibe el saludo inicial y un ambiente festivo durante todo el día. El ambiente se elimina automáticamente al comenzar el día siguiente.
- No se modifica `index.html`.
