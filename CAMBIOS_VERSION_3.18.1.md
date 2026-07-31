# Cambios web 3.18.1

## Oficina Virtual rápida

- Apertura inmediata mediante un estado liviano que no recorre las hojas operacionales.
- Pendientes cargados después de pintar la pantalla, con caché por usuario e invalidación al cambiar documentos, vehículos, conductores, rutas o check-ins.
- Índices de documentos, licencias, vehículos, conductores y rutas que eliminan búsquedas repetidas.
- El chat actualiza solamente la conversación y no vuelve a construir todo el módulo.
- La revisión manual se inicia en segundo plano para permitir que el usuario continúe trabajando.
- Asistente en español que explica GPS, rutas, operaciones, check-in, combustible, QR, documentos, alertas, permisos e inicio de sesión.
- Respuestas adaptadas al rol y a los registros visibles para el usuario.
- Panel personal de documentos vencidos, próximos a vencer, sin archivo, licencias, rutas asignadas y check-ins pendientes.
- Botón de revisión inmediata y acceso directo al módulo donde se resuelve cada tarea.

## Modo automático

- Interruptor disponible únicamente para Administradores.
- Revisión programada cada cinco minutos.
- El activador se reconstruye automáticamente si falta.
- La advertencia técnica `ACTIVADOR-OFICINA` se cierra únicamente después de comprobar que el activador ya existe.
- Diagnóstico de estructura, punto operacional, activadores y operaciones sin GPS reciente.
- Reparaciones técnicas seguras de hojas, catálogos, permisos, cachés y activadores.
- No elimina datos ni modifica rutas u operaciones.
- Toda activación, revisión y reparación queda registrada en Auditoría.

## Avisos sin duplicados

- Una sola notificación activa por tarea y destinatario.
- Si un documento pasa de próximo a vencer a vencido, se actualiza el mismo aviso.
- Las tareas resueltas se cierran automáticamente.
- Las alertas globales antiguas de documentos se consolidan con la tarea personal.
- Se mantienen alertas operacionales independientes únicamente cuando representan eventos distintos.
- Una falla se conserva como un solo registro visible para todos los Administradores, incluso si no estaban conectados.
- Las alertas operacionales solo pueden ser validadas y cerradas por un Administrador real.
- Oficina Virtual nunca cierra automáticamente alertas de GPS, operaciones, rutas, check-in, mantenciones, vehículos ni terreno.

## Control de instrucciones

- Un Conductor no puede activar el modo automático, reparar, configurar, eliminar ni ordenar cambios mediante Oficina Virtual.
- Si un Conductor informa una falla o solicita un cambio, Oficina Virtual crea un reporte único para los Administradores y no modifica el sistema.
- El reporte permanece pendiente hasta la validación administrativa.

## Rendimiento

- Las revisiones disparadas por cambios se ejecutan en segundo plano.
- Los avisos personales se recalculan sin bloquear el formulario.
- El módulo usa estado rápido, carga diferida, caché controlada e índices lineales.
- Se conserva el mapa incremental, el seguimiento en línea, el lector QR y todos los módulos existentes.
