# Web 4.3.3 — protección de actualización visual

- Actualización automática DESACTIVADA por defecto.
- Al activarla: intervalo de 60 segundos.
- No refresca Ubicación en Tiempo Real ni Conexiones; esos procesos conservan su lógica de tiempo real.
- No refresca mientras hay formularios, modales, filtros/entradas modificadas o acciones de botones en curso.
- La actualización manual no destruye una edición: si hay trabajo activo, se pospone y se informa al usuario.
- Se conserva la asignación automática Conductor → Vehículo y el prellenado desde Check-in.
