# Sistema de Gestión de Flotas 3.4.0

## Instalación

1. Haga una copia de seguridad de Google Sheets.
2. Reemplace todos los archivos del frontend.
3. En Google Apps Script use todos los archivos `.gs` numerados o solamente `Codigo_Completo.gs`. No combine ambas alternativas.
4. Ejecute `actualizarSistema()`.
5. Publique una nueva versión del despliegue web.
6. Revise la dirección terminada en `/exec` dentro de `configuracion.js`.
7. Recargue con `Ctrl + F5`.

## Reglas operacionales

- El Conductor finaliza únicamente dentro del punto base.
- Administrador y Supervisor pueden hacer cierre excepcional fuera de base con motivo y auditoría.
- Solo el Administrador puede editar o eliminar operaciones.
- Los kilometrajes son opcionales y no bloquean el inicio ni el cierre.
- Eliminar una operación es una eliminación lógica: la auditoría, historial y evidencias no se borran.


## Rendimiento 3.5.0
El menú mantiene un solo iframe activo. Al cambiar de módulo, la vista se abre desde la memoria local y no se recargan todos los archivos comunes. Use el botón **Sincronizar** dentro de cada módulo para consultar nuevamente la base central. Para limpiar la memoria del navegador, cierre sesión o borre los datos del sitio.

## Carpetas de Google Drive integradas
- Fotos de documentos: `1lWKDp7E28XU2D45ihvZctIq29Ji_aoq9`
- PDF de documentos: `1_2TgmSkzhRzcOQvw0_-ZiHfLTdUuQD2M`
- Fotos de boletas de combustible: `1JE9_yNAo0gpCZ1CnAnXMN8bhNh6fZTPj`

La cuenta que publica o ejecuta Google Apps Script debe tener permiso de edición en las tres carpetas. Las fotos se optimizan automáticamente en el navegador y comienzan a subirse apenas se seleccionan.
