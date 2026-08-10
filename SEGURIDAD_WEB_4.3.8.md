# Seguridad Web 4.3.8

- Los módulos HTML solo se ejecutan dentro de `main.html` y con ticket efímero por pestaña.
- Una apertura directa de `rutas.html`, `usuarios.html`, etc. redirige a `index.html`.
- El panel valida `me` en la API antes de abrir el primer módulo.
- La Web de producción no acepta el modo local desde `sessionStorage`/DevTools.
- `postMessage` se restringe al iframe esperado y al mismo origen.
- Los permisos reales siguen siendo validados en la API; ocultar/minificar JavaScript no reemplaza seguridad de servidor.
- La entrega plana de producción no contiene los JavaScript fuente legibles ni source maps.
