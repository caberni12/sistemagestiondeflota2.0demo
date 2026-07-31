# Cambios web 3.18.5

## Rendimiento del panel

- Se integra la nueva URL de despliegue terminada en `/exec`.
- Alertas y notificaciones se consultan juntas mediante una sola solicitud agrupada.
- Una revisión lenta nunca puede superponerse con la siguiente.
- La cola solo vuelve a dibujarse cuando realmente cambia.
- Las tareas secundarias comienzan después de abrir el módulo principal.
- El estado de Oficina Virtual se reutiliza durante 60 segundos y no se solicita nuevamente en cada cambio de módulo.
- Cuando la aplicación queda en segundo plano, la revisión de avisos reduce su frecuencia automáticamente.
- Al volver a la aplicación, el contador se actualiza de inmediato.

## Funciones conservadas

- Se mantiene la nueva URL `/exec`.
- Se mantiene el interruptor **Avisos emergentes**, exclusivo de Administradores.
- Al silenciar los avisos, la cola y el contador siguen actualizándose.
- El menú principal es el único responsable de mostrar avisos automáticos cuando el sistema funciona dentro del panel modular.
- Se conservan la deduplicación del servidor, Oficina Virtual, GPS, seguimiento, mapas, QR, combustible, check-in, documentos, permisos y auditoría.
