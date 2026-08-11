# Sistema de Gestión de Flotas 3.1.1

# Estructura modular 2.8.0

## Flujo principal

`index.html` → inicio de sesión → `main.html` → botón hamburguesa → vista seleccionada.

`main.html` mantiene un único iframe. Al abrir otra opción, la vista anterior se descarga y se libera.

## Flujo preoperacional

1. El conductor abre `checkin-vehicular.html`.
2. Selecciona el vehículo y completa los 18 controles.
3. El sistema evalúa la inspección.
4. Si hay observaciones leves, Administrador o Supervisor revisa en `checkin-aprobaciones.html`.
5. Una falla crítica bloquea la salida.
6. El módulo Operaciones solo acepta un check-in aprobado, vigente, sin utilizar y coincidente.
7. Al iniciar, el check-in queda vinculado a la operación como referencia, pero continúa vigente por 24 horas para el mismo conductor y vehículo. Solo vence por tiempo o por reasignación del vehículo a otro conductor.
8. La trazabilidad queda disponible en `checkin-historial.html`.

## Flujo de primera configuración

`index.html` consulta el estado del servicio. Si no existe ningún usuario con acceso, cambia automáticamente del formulario de inicio de sesión al formulario de preconfiguración. Después de crear la empresa y el primer Administrador, abre `main.html`.

## Flujo de permisos

El Administrador puede mantener los permisos del rol o guardar una matriz personalizada por usuario. La sesión permanece activa, mientras el servidor vuelve a calcular los permisos efectivos en cada solicitud.

## Flujo de voz

El módulo `notificaciones.html` permite escuchar pendientes, activar comandos predefinidos y dictar el título o el cuerpo de una notificación.

## Arquitectura de carga rápida 3.5.0
- `main.html` conserva un solo iframe durante toda la sesión.
- Los cambios de módulo se envían mediante `postMessage` y no reemplazan el archivo cargado.
- `conexion.js` mantiene una copia de lectura en memoria y `localStorage`.
- El botón **Sincronizar** invalida solo las dependencias del módulo actual.
