# Web 4.3.8

- Checkbox de permisos realmente editables; modo PERSONALIZADO se activa sin revertir el clic.
- Guardado de permisos verificado contra la fila releída por `flotas-api`.
- La sesión toma `VERSION_PERMISOS` nueva sin cerrar sesión ni cambiar de perfil.
- Reasignación de vehículo invalida el contexto/documentación del vehículo anterior.
- Documentos del Conductor vuelve a consultar únicamente el vehículo vigente cuando cambia la firma de asignación.
- Campanita estabiliza respuestas transitorias: un único snapshot ausente no hace desaparecer avisos pendientes.
- Ciclo visible de campanita: 10 s; oculto: 30 s.
- La campanita no recarga módulos ni formularios.
- No existe actualización automática general de módulos de 1 minuto.
