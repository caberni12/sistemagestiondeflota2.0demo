# Cambios web 3.18.2

## Avisos emergentes administrables

- Nuevo interruptor **Avisos emergentes** en el menú de usuario, visible únicamente para Administradores.
- Activado: las alertas y notificaciones nuevas pueden aparecer como avisos flotantes.
- Desactivado: no aparecen avisos flotantes repetitivos en la pantalla.
- Las consultas periódicas continúan activas y el contador del icono sigue actualizándose.
- Ninguna alerta o notificación se marca como leída al desactivar el interruptor.
- Todos los pendientes permanecen disponibles en el centro de notificaciones.
- La preferencia se guarda por Administrador y se aplica de forma inmediata, sin consultar el servidor.

## Estabilidad

- El menú principal es el único responsable de mostrar avisos automáticos cuando el sistema funciona dentro del panel modular.
- Se evita que el módulo interior y el menú principal presenten el mismo aviso simultáneamente.
- Se conservan la deduplicación del servidor, Oficina Virtual, GPS, seguimiento, mapas, QR, combustible, check-in, documentos, permisos y auditoría.
