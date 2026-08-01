# Sistema de Gestión de Flotas 3.1.1

# Estructura de carpeta única 2.8.0

Todos los archivos deben subirse al mismo nivel en GitHub. No se utilizan subcarpetas.

## Archivos principales

- `index.html`: preconfiguración automática cuando no hay usuarios e inicio de sesión cuando el sistema ya está configurado.
- `main.html`: contenedor del menú y de las vistas.
- `menu-principal.js`: navegación con un único iframe.
- `configuracion.js`: dirección del servicio y parámetros.
- `conexion.js`: comunicación con Google Apps Script y modo local.
- `aplicacion.js`: lógica de las vistas.
- `estilos.css` y `responsive.css`: diseño general y adaptable.

## Vistas de check-in

- `checkin-vehicular.html`
- `checkin-aprobaciones.html`
- `checkin-historial.html`

## Backend de check-in

- `22_Checkin_Vehicular.gs`

Todos estos archivos permanecen en la raíz junto con el resto del proyecto.

## Archivos de la versión 2.8.0

- `23_Permisos_Usuario.gs`: permisos personalizados sin invalidar sesiones.
- `MEJORAS_VERSION_2.8.0.md`: resumen de preconfiguración, permisos y voz.
- `PRUEBAS_VERSION_2.8.0.md`: validaciones ejecutadas.

La preconfiguración está integrada en `index.html`. Los comandos de voz pertenecen a `notificaciones.html` y se implementan desde `aplicacion.js`.
