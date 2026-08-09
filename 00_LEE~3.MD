# Sistema de Gestión de Flotas — Web 4.2.50

## Objetivo de esta versión
Corrección visual y de compatibilidad multinavegador sobre Web 4.2.49.

### Tema claro
- Fondo general blanco.
- Tarjetas, tablas, formularios, filtros y modales blancos.
- Texto principal negro y texto secundario gris oscuro.
- Bordes neutros finos.
- Verde/amarillo/rojo/azul se conservan para acciones y estados.

### Tema oscuro
- Se conserva íntegramente.
- La preferencia se guarda por dispositivo.
- El cambio se sincroniza entre el menú principal y los módulos cargados en iframe.
- También se respeta la preferencia inicial del sistema/dispositivo.

### Compatibilidad
Preparada para Chrome, Edge, Firefox y Safari modernos mediante:
- fallback de requestIdleCallback;
- fallback de String.replaceAll;
- fallback de color-mix en elementos críticos;
- fallback de 100dvh;
- -webkit-backdrop-filter para Safari;
- eliminación de la dependencia CSS :has en el detalle del mapa;
- controles y desplazamiento táctil normalizados.

## Importante
No requiere SQL nuevo. No se modificó la lógica de negocio de Supabase/API, Check-in, Rutas, GPS, Notificaciones ni Permisos.
