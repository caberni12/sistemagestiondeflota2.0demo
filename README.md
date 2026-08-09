# Sistema de Gestión de Flotas — Web 4.2.50

Versión Web corregida sobre la base 4.2.49.

## Cambios visuales
- Tema claro: fondo blanco real (#FFFFFF), texto negro (#111111), texto secundario oscuro (#333333).
- Tarjetas, tablas, filtros, formularios y modales con superficies blancas en modo claro.
- Se conserva el menú lateral y los colores semánticos para estados, alertas y acciones.
- Tema oscuro conservado y sincronizado entre menú principal y módulos.

## Compatibilidad
- Capa común para Chrome, Edge, Firefox y Safari modernos.
- Fallback de requestIdleCallback y String.replaceAll.
- Prefijo -webkit-backdrop-filter para Safari.
- Fallback de altura dinámica (dvh), color-mix y desplazamiento táctil.
- Controles de formulario normalizados sin alterar las acciones existentes.

## Funcionalidad
No se modificó la lógica de negocio de Check-in, rutas, GPS, notificaciones, permisos ni Supabase.
