# Cambios web 3.18.3

## Nueva dirección de conexión

- La web queda configurada para utilizar el nuevo despliegue de Google Apps Script terminado en `/exec`.
- La dirección se incluye directamente en `configuracion.js`.
- Android utiliza la misma dirección para inicio de sesión, GPS, seguimiento y solicitudes del sistema.

## Funciones conservadas

- Se mantiene el interruptor **Avisos emergentes**, exclusivo de Administradores.
- Al silenciar los avisos, la cola y el contador siguen actualizándose.
- El menú principal es el único responsable de mostrar avisos automáticos cuando el sistema funciona dentro del panel modular.
- Se conservan la deduplicación del servidor, Oficina Virtual, GPS, seguimiento, mapas, QR, combustible, check-in, documentos, permisos y auditoría.
