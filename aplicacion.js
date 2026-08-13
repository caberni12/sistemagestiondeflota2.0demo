(function () {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const api = window.ConexionFlotas;
  const config = window.CONFIGURACION_FLOTAS;
  const moduleConfig = window.MODULO_FLOTAS || Object.freeze({});
  const embeddedMode = Boolean(moduleConfig.incrustado);
  const initialSection = moduleConfig.seccion || 'dashboard';
  const defaultLogo = 'logo.svg';

  const operationalPointDeviceKey = 'flotas_punto_operacional_dispositivo_v1';
  const lastKnownLocationDeviceKey = 'flotas_ultima_ubicacion_dispositivo_v1';
  let currentUser = null;
  let appInicializada = false;
  let currentCompany = cargarPuntoOperacionDispositivo() || null;
  let reconocimientoVoz = null;
  let vozEscuchando = false;
  let dictadoNativoPendiente = null;
  let currentSection = initialSection;
  let mapaFlota = null;
  let promesaComponenteMapa = null;
  let promesaInicializacionMapaGps = null;
  let promesaInicializacionMapaConexiones = null;
  let ultimaUbicacionEnviada = null;
  let ultimaPosicionConfiableNavegador = null;
  let ultimaPosicionConocida = null;
  let gpsRefreshTimer = null;
  let gpsRefreshPending = null;
  let gpsRefreshQueued = false;
  let gpsRefreshFailures = 0;
  let ultimoResumenGps = { locations:[], devices:[], trackingVehicles:[], totals:{} };
  let gpsSendPending = false;
  let gpsPendingPosition = null;
  let gpsLocationsPaintKey = '';
  let gpsDevicesPaintKey = '';
  let gpsTotalsPaintKey = '';
  let connectionsRefreshTimer = null;
  let connectionsRefreshPending = null;
  let connectionsRequestGeneration = 0;
  let connectionsFailureCount = 0;
  let connectionTrackingLiveTimer = null;
  let connectionTrackingLivePending = null;
  let connectionTrackingLiveFailures = 0;
  let connectionsFilterTimer = null;
  let ultimoResumenConexiones = { equipos:[], ubicaciones:[], totales:{}, opciones:{} };
  let connectionTrackedUserId = '';
  let connectionTrackedPositionKey = '';
  let connectionTrackingServerLoaded = false;
  let connectionTrackingSavePending = false;
  let connectionTrackingGeneration = 0;
  let connectionTrackedVisibility = null;
  const filtrosConexiones = { FECHA_DESDE:'', FECHA_HASTA:'', USUARIO_ID:'', CONDUCTOR_ID:'', ESTADO:'TODOS', GPS:'TODOS', VEHICULO_ID:'', DISPOSITIVO_ID:'', TIPO_RED:'', PLATAFORMA:'', PRECISION_MAXIMA:'', BUSCAR:'' };
  let heartbeatTimer = null;
  let notificationTimer = null;
  let routeClockInterval = null;
  let selectedActiveRouteId = '';
  let notificationSnapshotReady = false;
  let notificationCenterState = { notifications:[], alerts:[] };
  let knownNotificationIds = new Set();
  let knownAlertIds = new Set();
  let knownAssignmentAlertIds = new Set();
  let assignmentAlertNode = null;
  let assignmentAlertQueue = [];
  let nexoSpeedAlertNode = null;
  let gpsWatchId = null;
  let mediaStream = null;
  let barcodeDetector = null;
  let scanFrameId = null;
  let facingMode = 'environment';
  let qrContextoActual = 'vehiculo-operacion';
  let batteryLevel = '';
  let clientPublicIp = sessionStorage.getItem('flotas_ip_publica_v1') || '';
  let lastAddressLookup = { key:'', address:'', time:0 };
  const addressLookupCache = new Map();
  const addressLookupPending = new Map();
  let addressQueueRunning = false;
  let gpsAddressQueueRunning = false;
  let lastAddressRequestAt = 0;
  let lastAddressSearchAt = 0;
  let addressSearchQueue = Promise.resolve();
  const addressSearchCache = new Map();
  const cacheVistasModulo = new Map();
  const cacheListasFormulario = new Map();
  const cacheRegistros = new Map();
  const expedientesDocumentalesActuales = new Map();
  let actualizacionVehiculoAsignadoPendiente = false;
  const listasFormularioPendientes = new Map();
  const limitesRegistrosPermitidos = Object.freeze([100,150,200,1000,'TODOS']);
  const limiteRegistrosPredeterminado = 150;
  const claveLimitesRegistros = 'flotas_limites_registros_modulos_v1';
  const seccionesConListado = new Set(['routes','checkin','checkinApprovals','checkinHistory','operations','notifications','vehicles','drivers','maintenance','fuel','documents','history','alerts','users','reports','audit']);
  const claveEstadoSincronizacion = 'flotas_estado_sincronizacion_modulos_v1';
  const cargaManualModulos = false; // La carga es automática e independiente para el módulo abierto.
  const estadoSincronizacionModulos = {};
  const modulosSincronizadosSesion = new Set();
  const actualizacionesModuloPendientes = new Map();
  let conversacionOficinaVirtual = [];
  let cargaPendientesOficinaVirtual = null;
  try { localStorage.removeItem(claveEstadoSincronizacion); } catch (_) {}
  const dependenciasCacheSeccion = Object.freeze({
    dashboard:{ actions:['dashboard','realtimeSummary'], resources:['operations','routes','notifications','vehicles','drivers','connections'] },
    office:{ actions:['officeQuickStatus','officeTasks','officeStatus','consultarActualizacionAndroid'], resources:['notifications','alerts','documents','routes','checkins'] },
    appUpdates:{ actions:['listarActualizacionesAndroid'], resources:[] },
    routes:{ actions:['dashboard','realtimeSummary'], resources:['routes','drivers','vehicles','notifications','companies'] },
    checkin:{ actions:['dashboard'], resources:['checkins','vehicles','drivers'] },
    checkinApprovals:{ actions:['dashboard'], resources:['checkins','vehicles','drivers','notifications'] },
    checkinHistory:{ actions:['dashboard'], resources:['checkins','vehicles','drivers','operations'] },
    operations:{ actions:['dashboard','operationsSummary','realtimeSummary','getOperationalPoint'], resources:['operations','routes','vehicles','drivers','checkins','companies'] },
    gps:{ actions:['realtimeSummary','getOperationalPoint'], resources:['gps','connections','vehicles','drivers','operations','routes','companies'] },
    connections:{ actions:['connectionsOnline','connectionTrackingLive'], resources:['gps','connections','vehicles','drivers','users','notifications','alerts'] },
    notifications:{ actions:['dashboard','realtimeSummary'], resources:['notifications','drivers','users'] },
    vehicles:{ actions:['dashboard'], resources:['vehicles'] },
    drivers:{ actions:['dashboard'], resources:['drivers','users'] },
    maintenance:{ actions:['dashboard'], resources:['maintenance','vehicles'] },
    fuel:{ actions:['dashboard','fuelSummary'], resources:['fuel','fuelAuthorizations','vehicles','drivers','operations','routes'] },
    documents:{ actions:['dashboard'], resources:['documents','vehicles','drivers','companies'] },
    history:{ actions:['dashboard'], resources:['history','operations','routes','checkins','alerts','notifications'] },
    alerts:{ actions:['dashboard'], resources:['alerts'] },
    users:{ actions:['dashboard','me'], resources:['users','roles','permissions'] },
    company:{ actions:['getOperationalPoint'], resources:['companies'] },
    reports:{ actions:['dashboard'], resources:['operations','drivers','vehicles','checkins'] },
    audit:{ actions:[], resources:['audit'] },
    settings:{ actions:['status','diagnoseSystem','getOperationalPoint','obtenerConfiguracionConexiones'], resources:['companies'] },
  });
  let secuenciaNavegacion = 0;
  let secuenciaModal = 0;
  let precargaIniciada = false;
  let sincronizacionPendiente = null;
  let geolocationPermissionState = 'desconocido';
  let geolocationPermissionHandle = null;
  let wakeLock = null;
  let lastGpsErrorAt = 0;
  const trackingPreferenceKeyBase = 'flotas_ubicacion_continua_v1';
  const routeTrackingKey = 'flotas_ruta_seguimiento_activa_v1';
  const pendingRoutePrefillKey = 'flotas_ruta_prefill_checkin_v1';
  const pendingRouteCheckinKey = 'flotas_ruta_checkin_pendiente_v1';
  // 4.3.6: los módulos trabajan únicamente con actualización manual.
  // No existe temporizador de refresco visual. GPS, alertas y notificaciones
  // conservan sus ciclos independientes y no reconstruyen el módulo abierto.
  let bloqueoRefrescoVisualHasta = 0;
  let accionesInterfazEnCurso = 0;
  let routeSyncTimer = null;
  let routeSyncRevision = '';
  let routeSyncPendingRefresh = false;
  let routeSyncRequestPending = false;
  let routeSyncActiveIds = '';
  const routeSyncSections = new Set(['dashboard','routes','operations','vehicles','drivers','checkin','fuel','notifications','history','reports']);
  const bloquearRefrescoVisualTemporal = (milisegundos=8000) => { bloqueoRefrescoVisualHasta = Math.max(bloqueoRefrescoVisualHasta, Date.now()+Math.max(500,Number(milisegundos)||0)); };
  const hayEdicionUsuarioActiva = () => {
    if (Date.now() < bloqueoRefrescoVisualHasta) return true;
    if ($('#modalBackdrop')?.classList.contains('open')) return true;
    if (assignmentAlertNode?.isConnected) return true;
    const content=$('#content');
    if(content?.dataset?.trabajoUsuario==='1')return true;
    if(content?.querySelector?.('[data-trabajo-usuario="1"]'))return true;
    const active=document.activeElement;
    if(active&&/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))return true;
    return Boolean($('#content form:focus-within')||$('#content [contenteditable="true"]:focus'));
  };
  const hayInteraccionVisualActiva = () => accionesInterfazEnCurso>0 || hayEdicionUsuarioActiva();
  const marcarTrabajoUsuario = event => {
    const target=event?.target;
    if(!target?.matches?.('input,textarea,select,[contenteditable="true"]'))return;
    if(target.matches('[data-record-limit]'))return;
    const form=target.closest?.('form');
    if(form)form.dataset.trabajoUsuario='1';
    else {
      const content=$('#content');
      if(content)content.dataset.trabajoUsuario='1';
    }
  };
  function leerJsonLocal(clave){try{return JSON.parse(localStorage.getItem(clave)||'null');}catch(_){return null;}}
  let routeTrackingContext = leerJsonLocal(routeTrackingKey);
  const gpsTrackingModeKey = 'flotas_seguimiento_modo_v1';
  const gpsSelectedVehiclesKey = 'flotas_seguimiento_vehiculos_v1';
  const gpsConnectionFilterKey = 'flotas_seguimiento_estado_v1';
  const checkinReceiptKey = 'flotas_ultimo_checkin_confirmado_v1';
  let gpsTrackingMode = localStorage.getItem(gpsTrackingModeKey) === 'specific' ? 'specific' : 'all';
  let gpsSelectedVehicles = (() => {
    try { return new Set(JSON.parse(localStorage.getItem(gpsSelectedVehiclesKey) || '[]').map(String)); }
    catch (_) { return new Set(); }
  })();
  let gpsDraftTrackingMode = gpsTrackingMode;
  let gpsDraftSelectedVehicles = new Set(gpsSelectedVehicles);
  const estadosConexionGpsPermitidos = new Set(['all','online','driving','withoutGps','offline']);
  let gpsConnectionFilter = estadosConexionGpsPermitidos.has(localStorage.getItem(gpsConnectionFilterKey)) ? localStorage.getItem(gpsConnectionFilterKey) : 'all';
  let gpsDraftConnectionFilter = gpsConnectionFilter;
  const gpsDriverFiltersKey = 'flotas_filtros_gps_conductor_v1';
  const gpsDriverFiltersDefault = Object.freeze({ FECHA_DESDE:'', FECHA_HASTA:'', VEHICULO_ID:'', CONDUCTOR_ID:'', GPS_ESTADO:'TODOS', LIMITE_PUNTOS:'25' });
  let gpsDriverFilters = (()=>{try{return {...gpsDriverFiltersDefault,...JSON.parse(localStorage.getItem(gpsDriverFiltersKey)||'{}')};}catch(_){return {...gpsDriverFiltersDefault};}})();
  const deviceId = (() => {
    const key='flotas_dispositivo_id_v1';let value=localStorage.getItem(key);
    if(!value){value=`DISP-${crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)}`;localStorage.setItem(key,value);}
    return value;
  })();
  const clientSessionId = (() => {
    const key='flotas_sesion_cliente_v1';let value=sessionStorage.getItem(key);
    if(!value){value=`SES-CLI-${crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)}`;sessionStorage.setItem(key,value);}
    return value;
  })();
  function usuarioActualStorageId(){return String(currentUser?.ID||api.getAuth()?.user?.ID||'sin_usuario').replace(/[^A-Za-z0-9_-]/g,'_');}
  function trackingPreferenceStorageKey(){return `${trackingPreferenceKeyBase}_${usuarioActualStorageId()}`;}
  function ultimaUbicacionStorageKey(){return `${lastKnownLocationDeviceKey}_${usuarioActualStorageId()}`;}
  function prepararEstadoGpsUsuarioActual(){
    ultimaUbicacionEnviada=null;ultimaPosicionConfiableNavegador=null;gpsPendingPosition=null;gpsSendPending=false;
    ultimaPosicionConocida=cargarUltimaUbicacionDispositivo();
  }

  const navGroups = [
    ['GENERAL', [
      ['dashboard','⌂','Panel principal'], ['office','◆','NEXO IA'], ['routes','➜','Rutas asignadas'], ['checkin','✓','Check-in vehicular'], ['operations','⇄','Operaciones'], ['gps','⌖','Ubicación en tiempo real'],
      ['notifications','🔔','Notificaciones']
    ]],
    ['GESTIÓN', [
      ['vehicles','▣','Vehículos'], ['drivers','♙','Conductores'], ['checkinApprovals','☑','Aprobar check-ins'], ['checkinHistory','▤','Historial de check-in'], ['maintenance','⚙','Mantenciones'], ['fuel','⛽','Combustible'],
      ['documents','▤','Documentos'], ['history','↻','Historial'], ['alerts','!','Alertas']
    ]],
    ['ADMINISTRACIÓN', [
      ['connections','◎','Conexiones en línea'], ['users','♚','Usuarios'], ['company','🏢','Empresa'], ['reports','▥','Reportes'], ['audit','☷','Auditoría'], ['appUpdates','⬆','Actualización de Aplicación'], ['settings','⚒','Configuración']
    ]]
  ];

  const resourceFields = {
    vehicles: {
      title:'Vehículo', eyebrow:'FLOTA', fields:[
        ['PATENTE','Patente','text',true],['MARCA','Marca','text',true],['MODELO','Modelo','text',true],['ANIO','Año','number',false],
        ['COLOR','Color','text',false],['COMBUSTIBLE','Combustible','select',['Diésel','Gasolina','Eléctrico','Híbrido','Gas']],
        ['VIN','VIN / chasis','text',false],['KILOMETRAJE','Kilometraje','number',false],
        ['ESTADO','Estado','select',['Disponible','En ruta','En operación','En mantención','Fuera de servicio','Inactivo']],['PROXIMA_MANTENCION','Próxima mantención','date',false]
      ]
    },
    drivers: {
      title:'Conductor', eyebrow:'PERSONAL', fields:[
        ['NOMBRE','Nombre completo','text',true],['RUT','RUT','text',true],['TELEFONO','Teléfono','text',false],['CORREO','Correo','email',false],
        ['LICENCIA_CLASE','Clase de licencia','select',['A1','A2','A3','A4','A5','B','C','D','E','F']],
        ['LICENCIA_VENCIMIENTO','Vencimiento licencia','date',false],['ESTADO','Estado','select',['Disponible','En ruta','En operación','Licencia vencida','Suspendido','Inactivo']],
        ['USUARIO_ID','Usuario asociado','userSelect',false]
      ]
    },
    maintenance: {
      title:'Mantención', eyebrow:'TALLER', fields:[
        ['VEHICULO_ID','Vehículo','vehicleSelect',true],['TIPO','Tipo','select',['Preventiva','Correctiva','Inspección']],['TITULO','Trabajo','text',true],
        ['DESCRIPCION','Descripción','textarea',false],['FECHA_PROGRAMADA','Fecha programada','date',true],['FECHA_REALIZADA','Fecha realizada','date',false],
        ['KILOMETRAJE','Kilometraje','number',false],['COSTO','Costo','number',false],['ESTADO','Estado','select',['Programada','En proceso','Completada','Atrasada','Cancelada']],
        ['TALLER','Taller','text',false],['OBSERVACIONES','Observaciones','textarea',false]
      ]
    },
    documents: {
      title:'Documento', eyebrow:'DOCUMENTACIÓN', fields:[
        ['TIPO','Tipo','select',['SOAP','Revisión técnica','Permiso de circulación','Licencia de conducir','Certificado de gases','Seguro','Otro']],
        ['ASOCIADO_TIPO','Asociado a','select',['Conductor','Usuario','Vehículo','Empresa']],['CONDUCTOR_ASOCIADO_ID','Conductor asociado','driverSelect',false],
        ['VEHICULO_SELECTOR_ID','Vehículo asociado','vehicleSelect',false],['USUARIO_ASOCIADO_ID','Cuenta asociada','userSelect',false],['ASOCIADO_ID','ID asociado (automático)','text',false],['CORREO_ASOCIADO','Correo asociado (automático)','email',false],['IDENTIFICACION','RUT, patente o identificación','text',true],
        ['FECHA_EMISION','Fecha emisión','date',false],['FECHA_VENCIMIENTO','Fecha vencimiento','date',true],['ESTADO','Vigencia del documento','select',['Vigente','Por vencer','Vencido','Anulado']],
        ['ESTADO_REVISION','Estado de aprobación','text',false],['DIRECCION_ARCHIVO','Archivo adjunto seguro','url',false],['OBSERVACIONES','Observaciones','textarea',false]
      ]
    },
    users: {
      title:'Usuario', eyebrow:'SEGURIDAD', fields:[
        ['NOMBRE','Nombre completo','text',true],['CORREO','Correo','email',true],['CONTRASENA','Contraseña','password',true],
        ['ROL_ID','Rol','select',[['ROL-ADMIN','Administrador'],['ROL-GERENCIA','Gerencia'],['ROL-SUPERVISOR','Operador'],['ROL-CONDUCTOR','Conductor']]],
        ['ESTADO','Estado','select',['Activo','Inactivo','Bloqueado']],['TELEFONO','Teléfono','text',false],['FECHA_NACIMIENTO','Fecha de nacimiento','date',false]
      ]
    },
    alerts: {
      title:'Alerta', eyebrow:'NOTIFICACIÓN', fields:[
        ['TIPO','Tipo','text',true],['NIVEL','Nivel','select',['Info','Advertencia','Crítica']],['TITULO','Título','text',true],
        ['MENSAJE','Mensaje','textarea',true],['MODULO','Módulo','text',false],['REGISTRO_ID','ID relacionado','text',false],['LEIDA','Leída','select',['NO','SI']]
      ]
    }
  };

  const bulkImportDefinitions = Object.freeze({
    vehicles:{title:'Vehículos',template:'Plantilla_Importacion_Vehiculos.xlsx',required:['PATENTE','MARCA','MODELO'],headers:['PATENTE','MARCA','MODELO','ANIO','COLOR','COMBUSTIBLE','VIN','KILOMETRAJE','ESTADO','QR_CODIGO','PROXIMA_MANTENCION'],key:'PATENTE',maxRows:1500,maxFileBytes:12582912},
    drivers:{title:'Conductores',template:'Plantilla_Importacion_Conductores.xlsx',required:['NOMBRE','RUT'],headers:['NOMBRE','RUT','TELEFONO','CORREO','LICENCIA_CLASE','LICENCIA_VENCIMIENTO','ESTADO','USUARIO_ID'],key:'RUT',maxRows:1500,maxFileBytes:12582912},
    documents:{title:'Documentos',template:'Plantilla_Importacion_Documentos.xlsx',required:['TIPO','ASOCIADO_TIPO','IDENTIFICACION','FECHA_VENCIMIENTO'],headers:['TIPO','ASOCIADO_TIPO','IDENTIFICACION','ASOCIADO_ID','FECHA_EMISION','FECHA_VENCIMIENTO','ESTADO','OBSERVACIONES'],key:'IDENTIFICACION',maxRows:1500}
  });

  const labels = {
    dashboard:'Panel principal',office:'NEXO IA',routes:'Rutas asignadas',vehicles:'Vehículos',drivers:'Conductores',checkin:'Check-in vehicular',checkins:'Check-ins',checkinApprovals:'Aprobación de check-ins',checkinHistory:'Historial de check-in',operations:'Operaciones',gps:'Ubicación en tiempo real',maintenance:'Mantenciones',fuel:'Combustible',
    notifications:'Notificaciones',documents:'Documentos del conductor',history:'Historial',alerts:'Alertas',connections:'Conexiones en línea',users:'Usuarios',reports:'Reportes',audit:'Auditoría',company:'Empresa',appUpdates:'Actualización de Aplicación',settings:'Configuración'
  };

  const navPermission = {
    dashboard:'PANEL_PRINCIPAL',office:'OFICINA_VIRTUAL',routes:'RUTAS',checkin:'CHECKIN',checkinApprovals:'CHECKIN_APROBACIONES',checkinHistory:'CHECKIN',operations:'OPERACIONES',gps:'GPS',notifications:'NOTIFICACIONES',
    vehicles:'VEHICULOS',drivers:'CONDUCTORES',maintenance:'MANTENCIONES',fuel:'COMBUSTIBLE',documents:'DOCUMENTOS',history:'HISTORIAL',
    alerts:'ALERTAS',connections:'CONEXIONES',users:'USUARIOS',company:'CONFIGURACION',reports:'REPORTES',audit:'BITACORA',appUpdates:'ACTUALIZACIONES_APP',settings:'CONFIGURACION'
  };
  const resourcePermission={vehicles:'VEHICULOS',drivers:'CONDUCTORES',maintenance:'MANTENCIONES',fuel:'COMBUSTIBLE',documents:'DOCUMENTOS',alerts:'ALERTAS',users:'USUARIOS'};
  const permissionCatalog = Object.freeze([
    ['PANEL_PRINCIPAL','Panel principal'],['OFICINA_VIRTUAL','NEXO IA'],['USUARIOS','Usuarios'],['VEHICULOS','Vehículos'],['CONDUCTORES','Conductores'],
    ['OPERACIONES','Operaciones'],['CHECKIN','Check-in'],['CHECKIN_APROBACIONES','Aprobar check-ins'],['GPS','Ubicación en tiempo real'],
    ['HISTORIAL','Historial'],['MANTENCIONES','Mantenciones'],['COMBUSTIBLE','Combustible'],['DOCUMENTOS','Documentos del conductor'],['ALERTAS','Alertas'],
    ['REPORTES','Reportes'],['BITACORA','Auditoría'],['CONFIGURACION','Configuración'],['QR','QR'],['RUTAS','Rutas'],
    ['NOTIFICACIONES','Notificaciones'],['CONEXIONES','Conexiones en línea · acceso delegado'],['ACTUALIZACIONES_APP','Actualización de Aplicación']
  ]);
  const permissionActions = Object.freeze([['LEER','Ver'],['CREAR','Crear'],['ACTUALIZAR','Editar'],['ELIMINAR','Eliminar']]);
  const buttonPermissionCatalog = Object.freeze([
    ['USUARIOS','GESTIONAR_PERMISOS',"Gestionar permisos y botones"],
    ['USUARIOS','DESACTIVAR',"Desactivar usuarios"],
    ['ACTUALIZACIONES_APP','PUBLICAR',"Publicar actualización Android y alertas masivas"],
    ['ACTUALIZACIONES_APP','REENVIAR',"Reenviar alertas de actualización"],
    ['VEHICULOS','IMPRIMIR_QR',"Generar e imprimir QR"],
    ['VEHICULOS','IMPORTAR',"Importar vehículos"],
    ['CONDUCTORES','IMPORTAR',"Importar conductores"],
    ['DOCUMENTOS','VER_ARCHIVO',"Visualizar archivos privados"],
    ['DOCUMENTOS','CARGAR_PROPIO',"Cargar documentos propios"],
    ['DOCUMENTOS','IMPORTAR',"Importar documentos"],
    ['DOCUMENTOS','APROBAR',"Aprobar documentos"],
    ['DOCUMENTOS','RECHAZAR',"Rechazar documentos"],
    ['OPERACIONES','INICIAR',"Iniciar operación"],
    ['OPERACIONES','FINALIZAR',"Finalizar operación"],
    ['OPERACIONES','CIERRE_EXCEPCIONAL',"Cerrar fuera de la base"],
    ['OPERACIONES','EDITAR_ADMIN',"Editar operación administrativamente"],
    ['OPERACIONES','ELIMINAR_ADMIN',"Eliminar operación administrativamente"],
    ['CONFIGURACION','GESTIONAR_PUNTO_BASE',"Configurar punto operacional"],
    ['CONFIGURACION','LIMPIAR_DATOS',"Limpiar datos operativos"],
    ['CONFIGURACION','RESPALDO_GENERAL',"Descargar respaldo general XLSX"],
    ['CHECKIN','VALIDAR_QR',"Validar QR de check-in"],
    ['CHECKIN_APROBACIONES','APROBAR',"Aprobar check-in"],
    ['CHECKIN_APROBACIONES','RECHAZAR',"Rechazar o bloquear check-in"],
    ['RUTAS','NAVEGAR',"Abrir navegación de ruta"],
    ['RUTAS','INICIAR',"Iniciar ruta"],
    ['RUTAS','COMPLETAR',"Completar ruta"],
    ['RUTAS','CANCELAR',"Cancelar ruta"],
    ['RUTAS','REASIGNAR',"Reasignar ruta por contingencia"],
    ['RUTAS','CARGAR_EVIDENCIA',"Cargar respaldo fotográfico"],
    ['COMBUSTIBLE','REGISTRAR',"Registrar carga de combustible"],
    ['COMBUSTIBLE','EDITAR',"Editar carga de combustible"],
    ['COMBUSTIBLE','SOLICITAR_ELIMINACION',"Solicitar eliminación de carga"],
    ['COMBUSTIBLE','AUTORIZAR_ELIMINACION',"Aprobar o rechazar eliminación"],
    ['COMBUSTIBLE','ELIMINAR',"Ejecutar eliminación autorizada"],
    ['NOTIFICACIONES','ENVIAR',"Enviar notificaciones"],
    ['NOTIFICACIONES','MARCAR_LEIDA',"Marcar notificación como leída"],
    ['NOTIFICACIONES','ACEPTAR_ASIGNACIONES_AJENAS',"Aceptar asignaciones de otros usuarios"],
    ['ALERTAS','ENVIAR',"Enviar alertas"],
    ['ALERTAS','CERRAR',"Validar y cerrar alertas"],
    ['CONEXIONES','SEGUIR',"Seguir usuario en el mapa"],
    ['CONEXIONES','ENVIAR_AVISO',"Enviar aviso desde conexiones"],
    ['CONEXIONES','DESCONECTAR_USUARIO',"Desconectar usuario conectado"],
    ['REPORTES','EXPORTAR_CSV',"Exportar CSV"],
    ['REPORTES','EXPORTAR_XLSX',"Exportar Excel"],
    ['REPORTES','EXPORTAR_PDF',"Exportar PDF"],
    ['OFICINA_VIRTUAL','DIAGNOSTICAR',"Revisar estado del servidor"],
    ['OFICINA_VIRTUAL','REPORTAR_FALLA',"Informar una falla"],
    ['OFICINA_VIRTUAL','GENERAR_REPORTE',"Generar reporte de salud"],
    ['OFICINA_VIRTUAL','REPARAR',"Ejecutar reparaciones seguras"],
    ['OFICINA_VIRTUAL','CONFIGURAR',"Configurar modo automático"],
    ['CHECKIN','ASIGNAR_VEHICULO',"Asignar vehículo y enviar alerta de check-in"],
  ]);

  const checkinCatalog = Object.freeze([
    {id:'documentacion',categoria:'Documentación',item:'Documentos obligatorios vigentes y disponibles',critico:true},
    {id:'luces',categoria:'Exterior',item:'Luces, intermitentes y señalización',critico:true},
    {id:'frenos',categoria:'Seguridad',item:'Frenos de servicio y estacionamiento',critico:true},
    {id:'direccion',categoria:'Seguridad',item:'Dirección sin juego, trabas ni ruidos anormales',critico:true},
    {id:'neumaticos',categoria:'Exterior',item:'Neumáticos instalados: presión y desgaste',critico:true},
    {id:'rueda_repuesto',categoria:'Exterior',item:'Rueda de repuesto disponible y en buen estado',critico:true},
    {id:'carroceria',categoria:'Exterior',item:'Estado general de la carrocería',critico:false},
    {id:'espejos_vidrios',categoria:'Exterior',item:'Espejos, parabrisas y vidrios con visibilidad segura',critico:true},
    {id:'cinturones',categoria:'Cabina',item:'Cinturones de seguridad y asientos',critico:true},
    {id:'bocina',categoria:'Cabina',item:'Bocina operativa',critico:false},
    {id:'limpiaparabrisas',categoria:'Cabina',item:'Limpiaparabrisas y líquido lavador',critico:false},
    {id:'aceite',categoria:'Motor y fluidos',item:'Nivel de aceite de motor',critico:true},
    {id:'refrigerante',categoria:'Motor y fluidos',item:'Nivel de refrigerante y temperatura normal',critico:true},
    {id:'fugas',categoria:'Motor y fluidos',item:'Ausencia de fugas de combustible, aceite o refrigerante',critico:true},
    {id:'extintor',categoria:'Emergencia',item:'Extintor vigente y accesible',critico:true},
    {id:'botiquin',categoria:'Emergencia',item:'Botiquín disponible',critico:false},
    {id:'herramientas',categoria:'Emergencia',item:'Gata, triángulos y herramientas básicas',critico:false},
    {id:'combustible',categoria:'Operación',item:'Combustible o carga suficiente para la ruta',critico:false},
  ]);
  function hasPermission(module,action='LEER'){
    const permissions=currentUser?.PERMISOS||[];
    return permissions.includes('*:*')||permissions.includes(`${module}:${action}`);
  }
  function puedeDesconectarUsuariosConectados(){return esAdministrador()&&hasPermission('CONEXIONES','DESCONECTAR_USUARIO');}
  function puedeAdministrarPuntoOperacion(){return hasPermission('CONFIGURACION','GESTIONAR_PUNTO_BASE')&&['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'].includes(String(currentUser?.ROL_ID||''));}
  function puedeCierreExcepcional(){return hasPermission('OPERACIONES','CIERRE_EXCEPCIONAL')&&['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'].includes(String(currentUser?.ROL_ID||''));}
  function puedeReenviarAlertaAsignacion(){return ['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'].includes(String(currentUser?.ROL_ID||'').toUpperCase())&&hasPermission('NOTIFICACIONES','ENVIAR');}
  function puedeAceptarAsignacionesAjenas(){const rol=String(currentUser?.ROL_ID||'').toUpperCase();return esAdministradorEstricto()||(['ROL-GERENCIA','ROL-SUPERVISOR'].includes(rol)&&hasPermission('NOTIFICACIONES','ACEPTAR_ASIGNACIONES_AJENAS')&&hasPermission('NOTIFICACIONES','MARCAR_LEIDA'));}
  function esAdministrador(){const rol=String(currentUser?.ROL_ID||currentUser?.ROL_NOMBRE||'').trim().toUpperCase();return ['ROL-ADMIN','ADMINISTRADOR','ROL-GERENCIA','GERENCIA'].includes(rol)||(Array.isArray(currentUser?.PERMISOS)&&currentUser.PERMISOS.includes('*:*'));}
  function esAdministradorEstricto(){const rol=String(currentUser?.ROL_ID||currentUser?.ROL_NOMBRE||'').trim().toUpperCase();return ['ROL-ADMIN','ADMINISTRADOR'].includes(rol)||(Array.isArray(currentUser?.PERMISOS)&&currentUser.PERMISOS.includes('*:*'));}
  function puedeRevisarDocumentos(){return ['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'].includes(String(currentUser?.ROL_ID||'').trim().toUpperCase());}
  function puedeEliminarDocumentosPorRol(){const rol=String(currentUser?.ROL_ID||currentUser?.ROL_NOMBRE||'').trim().toUpperCase();return ['ROL-ADMIN','ADMINISTRADOR','ROL-GERENCIA','GERENCIA','ROL-SUPERVISOR','ROL-OPERADOR','SUPERVISOR','OPERADOR'].includes(rol);}
  function claveAvisosEmergentes(){return `flotas_avisos_emergentes_admin_v1_${String(currentUser?.ID||currentUser?.USUARIO_ID||'sin_usuario')}`;}
  function avisosEmergentesActivos(){
    if(!['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'].includes(String(currentUser?.ROL_ID||'').toUpperCase()))return true;
    try{return localStorage.getItem(claveAvisosEmergentes())!=='NO';}
    catch(_){return true;}
  }
  function claveVozAsignaciones(){return `flotas_voz_asignaciones_v1_${String(currentUser?.ID||currentUser?.USUARIO_ID||'sin_usuario')}`;}
  function vozAsignacionesActiva(){try{return localStorage.getItem(claveVozAsignaciones())!=='NO';}catch(_){return true;}}
  function guardarVozAsignaciones(activa){
    try{localStorage.setItem(claveVozAsignaciones(),activa?'SI':'NO');}
    catch(_){return false;}
    if(!activa)try{if('speechSynthesis'in window)window.speechSynthesis.cancel();window.AndroidConfig?.detenerVozNativa?.();}catch(_){ }
    return true;
  }
  function puedeFinalizarOperacion(){return hasPermission('OPERACIONES','FINALIZAR');}
  function accionPermisoExportacion(formato='csv'){
    const f=String(formato||'csv').toLowerCase();
    return f==='xlsx'?'EXPORTAR_XLSX':f==='pdf'?'EXPORTAR_PDF':'EXPORTAR_CSV';
  }
  function puedeExportarFormato(formato='csv'){return hasPermission('REPORTES',accionPermisoExportacion(formato));}
  function botonesExportacion(atributo,valor,compacto=false){
    const clase=compacto?' compact':'';
    const botones=[];
    if(puedeExportarFormato('csv'))botones.push(`<button class="btn soft${compacto?' small':''}" type="button" ${atributo}="${esc(valor)}" data-export-format="csv">CSV</button>`);
    if(puedeExportarFormato('xlsx'))botones.push(`<button class="btn soft${compacto?' small':''}" type="button" ${atributo}="${esc(valor)}" data-export-format="xlsx">Excel</button>`);
    if(puedeExportarFormato('pdf'))botones.push(`<button class="btn primary${compacto?' small':''}" type="button" ${atributo}="${esc(valor)}" data-export-format="pdf">PDF</button>`);
    return botones.length?`<div class="report-format-actions${clase}">${botones.join('')}</div>`:'';
  }
  function postParent(message){
    if(!embeddedMode||window.parent===window)return;
    const targetOrigin=location.origin==='null'?'*':location.origin;
    try{window.parent.postMessage(message,targetOrigin);}catch(_){}
  }
  function navigateSection(section){
    if(embeddedMode&&window.parent!==window){postParent({tipo:'flotas:navegar',seccion:section});return Promise.resolve(true);}
    return go(section);
  }

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const fmtDate = (value, time = false) => {
    if (!value) return '—';
    const raw=String(value).trim(),onlyDate=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(onlyDate)return `${onlyDate[3]}/${onlyDate[2]}/${onlyDate[1]}`;
    const date=value instanceof Date?value:new Date(value);if(Number.isNaN(date.getTime()))return esc(value);
    const parts=Object.fromEntries(new Intl.DateTimeFormat('es-CL',{day:'2-digit',month:'2-digit',year:'numeric',hour:time?'2-digit':undefined,minute:time?'2-digit':undefined,hourCycle:'h23'}).formatToParts(date).map(part=>[part.type,part.value]));
    const base=`${parts.day}/${parts.month}/${parts.year}`;
    return time?`${base}:${parts.hour}:${parts.minute}`:base;
  };
  // Compatibilidad 4.3.21: evita que cualquier bloque legado que aún invoque formatDate detenga Configuración.
  const formatDate = fmtDate;
  const fechaVisualIso = (value, time = false) => {
    const raw=String(value||'').trim();if(!raw)return '';
    if(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(raw))return raw;
    const match=raw.match(time?/^(\d{2})\/(\d{2})\/(\d{4}):(\d{2}):(\d{2})$/:/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if(!match)throw new Error(time?'FECHA_HORA_FORMATO_INVALIDO':'FECHA_FORMATO_INVALIDO');
    const day=Number(match[1]),month=Number(match[2]),year=Number(match[3]),hour=Number(match[4]||0),minute=Number(match[5]||0),date=new Date(year,month-1,day,hour,minute,0,0);
    if(date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day||hour>23||minute>59)throw new Error(time?'FECHA_HORA_FORMATO_INVALIDO':'FECHA_FORMATO_INVALIDO');
    return time?date.toISOString():`${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  };
  const fechaInputLocal = value => { if(!value)return ''; const date=new Date(value); if(Number.isNaN(date.getTime()))return ''; const local=new Date(date.getTime()-date.getTimezoneOffset()*60000); return local.toISOString().slice(0,16); };
  const number = value => new Intl.NumberFormat('es-CL').format(Number(value || 0));
  const clp = value => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(value||0));
  const decimal = (value,digits=2) => new Intl.NumberFormat('es-CL',{maximumFractionDigits:digits}).format(Number(value||0));
  const initials = name => String(name || 'U').split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase();
  const statusClass = value => {
    const text = String(value || '').toLowerCase();
    if (/\b(inactivo|inactiva|desconectado|desconectada|bloqueado|bloqueada)\b|sin gps/.test(text)) return 'bad';
    if (/\b(disponible|activo|activa|vigente|finalizada|completada|conduciendo|conectado|conectada|aprobado|aprobada|conforme|sí|si)\b|en línea/.test(text)) return 'ok';
    if (/ruta|viaje|info|sesión administrativa/.test(text)) return 'info';
    if (/programada|proceso|por vencer|advertencia|mantención|pendiente|observaciones/.test(text)) return 'warn';
    return 'bad';
  };
  const status = value => `<span class="status ${statusClass(value)}">${esc(value || 'Sin estado')}</span>`;
  const heading = (tag, title, description, actions = '') => `<div class="heading"><div><p class="tag">${tag}</p><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${actions}</div></div>`;
  const empty = (icon, title, text, action = '') => `<div class="empty-state"><div><i>${icon}</i><h3>${title}</h3><p>${text}</p>${action}</div></div>`;
  const tableCellLabels = (headers, rows) => {
    if (!rows) return rows;
    const labels = headers.map(label => String(label || '').replace(/<[^>]*>/g, '').trim());
    return String(rows).replace(/<tr([^>]*)>([\s\S]*?)<\/tr>/gi, (row, rowAttributes, cells) => {
      let cellIndex = 0;
      const labelledCells = cells.replace(/<td([^>]*)>/gi, (cell, attributes) => {
        if (/\bcolspan\s*=/i.test(attributes) || /\bdata-label\s*=/i.test(attributes)) return `<td${attributes}>`;
        const label = labels[cellIndex++] || 'Información';
        return `<td${attributes} data-label="${esc(label)}">`;
      });
      return `<tr${rowAttributes}>${labelledCells}</tr>`;
    });
  };
  const table = (headers, rows, emptyText = 'Sin registros.') => {
    const body = rows ? tableCellLabels(headers, rows) : `<tr><td colspan="${headers.length}" class="muted">${emptyText}</td></tr>`;
    return `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
  };

  function translateError(error) {
    const key = String(error?.message || error || 'ERROR');
    const messages = {
      CREDENCIALES_INVALIDAS:'Correo o contraseña incorrectos. Solicite al Administrador revisar la cuenta y restablecer el acceso.', CLAVE_INSTALACION_INVALIDA:'La clave de instalación no coincide con la generada por instalarSistema().',
      CLAVE_INSTALACION_REQUERIDA:'Ingrese una clave de instalación.', CONTRASENA_REQUERIDA:'Ingrese la contraseña elegida.',
      DATOS_DE_ADMINISTRADOR_INVALIDOS:'Complete los datos del administrador e ingrese una contraseña.',
      SISTEMA_YA_INICIALIZADO:'El sistema ya tiene usuarios registrados.', AUTENTICACION_REQUERIDA:'La sesión no está disponible.', SESION_INVALIDA:'La sesión dejó de ser válida.',
      SESION_EXPIRADA:'La sesión expiró.', PERMISO_DENEGADO:'Su rol no tiene permiso para realizar esta acción.', ULTIMO_ADMINISTRADOR_PROTEGIDO:'No se puede quitar o desactivar al último administrador activo.', CONTRASENAS_NO_COINCIDEN:'Las contraseñas no coinciden.', RECURSO_NO_ENCONTRADO:'El recurso solicitado no existe.',
      REGISTRO_NO_ENCONTRADO:'El registro no existe.', NOMBRE_USUARIO_REQUERIDO:'Ingrese el nombre completo del usuario.', ROL_USUARIO_INVALIDO:'Seleccione un rol válido para el usuario.', USUARIO_VALOR_NUMERICO_INVALIDO:'La base de datos tenía un límite numérico insuficiente para la versión de permisos. Ejecute el SQL correctivo 4.2.3 y vuelva a intentar.', VALOR_NUMERICO_FUERA_DE_RANGO:'Uno de los valores numéricos supera el límite permitido.', USUARIO_NO_CONFIRMADO:'El servidor no pudo confirmar el usuario guardado.', SIN_CAMBIOS_PARA_GUARDAR:'No se detectaron cambios para guardar.', NO_PUEDE_ELIMINAR_SU_PROPIA_CUENTA:'No puede eliminar la cuenta con la que tiene la sesión abierta.', NO_PUEDE_DESCONECTAR_SU_PROPIA_SESION:'Use Cerrar sesión para desconectar su propia cuenta.', MOTIVO_DESCONEXION_REQUERIDO:'Escriba un motivo de al menos 5 caracteres.', SESIONES_NO_DISPONIBLES:'No fue posible consultar las sesiones del usuario.', ULTIMO_ADMINISTRADOR_NO_PUEDE_MODIFICARSE:'Debe existir al menos otro Administrador activo antes de cambiar este rol o estado.', ULTIMO_ADMINISTRADOR_NO_PUEDE_ELIMINARSE:'No se puede eliminar el último Administrador activo.', VEHICULO_NO_DISPONIBLE:'El vehículo no está disponible.', CONDUCTOR_NO_DISPONIBLE:'El conductor no está disponible.',
      OPERACION_NO_ACTIVA:'La operación ya no está activa.', CORREO_YA_EXISTE:'El correo ya está registrado.', DIRECCION_APLICACION_NO_CONFIGURADA:'Falta configurar la dirección de la aplicación en configuracion.js.', CONEXION_EMPRESA_REQUERIDA:'Primero conecte este dispositivo con una empresa.', DIRECTORIO_EMPRESAS_NO_CONFIGURADO:'Falta configurar el directorio de conexión del sistema.', DIRECTORIO_EMPRESAS_NO_DISPONIBLE:'El directorio empresarial no está disponible temporalmente.', RUT_EMPRESA_INVALIDO:'Ingrese un RUT de empresa válido.', RUT_INVALIDO:'Ingrese un RUT de empresa válido.', EMPRESA_NO_REGISTRADA:'El RUT no está registrado en el directorio empresarial.', EMPRESA_INACTIVA:'La conexión de esta empresa está inactiva.', EMPRESA_BLOQUEADA:'La empresa está bloqueada. Contacte al Administrador.', CONEXION_EMPRESA_NO_DISPONIBLE:'La empresa fue encontrada, pero su servicio no respondió correctamente.', RESPUESTA_DIRECTORIO_INVALIDA:'El directorio devolvió una configuración incompleta.', TIEMPO_DE_ESPERA_DIRECTORIO:'El directorio tardó demasiado en responder.', MODULO_CONFIGURACION_CONEXIONES_REQUIERE_SQL:'Falta instalar el módulo de configuración de conexiones en la base de datos.', DIRECTORIO_URL_HTTPS_REQUERIDA:'La dirección del directorio debe usar HTTPS.', ACTUALIZACIONES_URL_HTTPS_REQUERIDA:'La dirección del servicio de actualizaciones debe usar HTTPS.', API_RESPALDO_URL_HTTPS_REQUERIDA:'La dirección de respaldo debe usar HTTPS.', PRUEBA_CONEXION_NO_SUPERADA:'Una o más conexiones no superaron la prueba. Revise las direcciones antes de guardar.',
      ID_HOJA_NO_CONFIGURADO:'La base de datos central no está configurada correctamente.', TIEMPO_DE_ESPERA_AGOTADO:'La base de datos tardó demasiado en responder.',
      CONTRASENA_ACTUAL_INVALIDA:'La contraseña actual no es correcta.', FORMATO_LOGOTIPO_INVALIDO:'El formato del logotipo no es válido.', LOGOTIPO_DEMASIADO_GRANDE:'El logotipo supera el tamaño máximo de 1,5 MB.',
      ID_HOJA_NO_CONFIGURADO:'La base de datos central no está configurada correctamente.', CONFIRMACION_REQUERIDA:'Debe escribir exactamente “LIMPIAR DATOS”.',
      CONDUCTOR_NO_ASOCIADO:'La cuenta no está asociada a un conductor.', CONDUCTOR_NO_ENCONTRADO:'El conductor seleccionado no existe.', VEHICULO_NO_ENCONTRADO:'El vehículo seleccionado no existe.',
      QR_NO_RECONOCIDO:'El código QR no corresponde a un vehículo registrado.', CODIGO_QR_REQUERIDO:'Ingrese o escanee un código QR.', ETIQUETA_QR_ROL_NO_AUTORIZADO:'Solo los Administradores y Operadores pueden generar o imprimir etiquetas QR de vehículos.', GENERADOR_QR_NO_DISPONIBLE:'No se pudo cargar el generador QR local. Recargue la aplicación e inténtelo nuevamente.', VEHICULO_PATENTE_REQUERIDA:'El vehículo debe tener una patente válida para generar su QR.', VEHICULO_REQUERIDO:'Seleccione un vehículo para generar la etiqueta QR.', RUTA_NO_ENCONTRADA:'La ruta no existe.',
      ALERTA_OPERACIONAL_REQUIERE_ADMINISTRADOR:'Esta alerta operacional debe ser validada y cerrada por un Administrador real después de comprobar la situación en terreno.', ALERTA_ASIGNACION_NO_AUTORIZADA:'Solo Administradores y Operadores pueden enviar o reenviar alertas emergentes de asignación.', ASIGNACION_REENVIO_INVALIDA:'No fue posible identificar la ruta u operación que desea reenviar.', ASIGNACION_REQUIERE_ACEPTACION:'Esta asignación permanecerá pendiente hasta que el conductor presione Aceptar.',
      ESTADO_RUTA_INVALIDO:'El estado solicitado para la ruta no es válido.', DESTINATARIO_REQUERIDO:'Seleccione un destinatario.', USUARIO_DESTINATARIO_NO_ENCONTRADO:'El usuario destinatario no existe o no está activo.', SIN_DESTINATARIOS_PARA_EL_ALCANCE:'No existen cuentas activas que coincidan con el grupo seleccionado.', TITULO_Y_MENSAJE_REQUERIDOS:'Complete el título y el mensaje.', TIPO_AVISO_INVALIDO:'Seleccione una clase de aviso válida.', ALCANCE_AVISO_INVALIDO:'Seleccione un grupo de destinatarios válido.', NOTIFICACION_NO_ENCONTRADA:'La notificación no existe.', ALERTA_NO_ENCONTRADA:'La alerta no existe.', LECTURA_NOTIFICACION_NO_CONFIRMADA:'La notificación no confirmó su estado leído en la base central.', LECTURA_ALERTA_NO_CONFIRMADA:'La alerta no confirmó su estado leído en la base central.',
      COORDENADAS_INVALIDAS:'Las coordenadas recibidas no son válidas.', REFERENCIA_RELACIONADA_NO_EXISTE_GPS_ACTUAL:'La ubicación tenía una asociación anterior de ruta u operación que ya no existe. El sistema la corregirá automáticamente y continuará el seguimiento.', REFERENCIA_RELACIONADA_NO_EXISTE_GPS:'La ubicación tenía una asociación anterior no disponible. El sistema continuará sin esa referencia.', OFICINA_INCIDENTES_NO_DISPONIBLES:'No fue posible consultar los incidentes de NEXO IA.', DETALLE_FALLA_REQUERIDO:'Describa la falla con al menos diez caracteres.', PREGUNTA_REQUERIDA:'Escriba una consulta para NEXO IA.', CARGA_DOCUMENTAL_REQUIERE_CONEXION_CENTRAL:'La carga documental requiere conexión con la Base de Datos central.', AUTORIZACION_QR_INVALIDA:'Valide nuevamente el QR del vehículo. La autorización dura cinco minutos.', CHECKIN_QR_REQUERIDO:'Debe escanear el QR físico del vehículo asignado antes de realizar el check-in.', CHECKIN_QR_EXPIRADO:'La autorización QR venció. Escanee nuevamente el vehículo.', CHECKIN_QR_YA_UTILIZADO:'Este QR ya fue utilizado para un check-in. Escanee nuevamente.', VEHICULO_QR_NO_COINCIDE_ASIGNACION:'El QR escaneado no corresponde al vehículo asignado a este conductor.', CHECKIN_DECISION_INVALIDA:'La decisión debe ser Aprobar o Anular.', COMENTARIO_REVISION_REQUERIDO:'Debe escribir un comentario para aprobar o anular el check-in.',
      ACCION_ESPECIAL_REQUERIDA:'Utilice el botón específico del módulo para realizar esta acción.',
      SINCRONIZACION_NO_COMPLETADA:'La base de datos no respondió correctamente durante la sincronización.',
      CHECKIN_REQUERIDO:'Debe seleccionar un check-in aprobado antes de iniciar la operación.', CHECKIN_DIARIO_REQUERIDO:'Debe realizar un check-in hoy para este mismo vehículo y conductor antes de iniciar la ruta.', CHECKIN_NO_ENCONTRADO:'El check-in seleccionado no existe.',
      CHECKIN_NO_COINCIDE:'El check-in no corresponde al vehículo y conductor seleccionados.', CHECKIN_NO_APROBADO:'El check-in todavía no está aprobado.',
      CHECKIN_YA_UTILIZADO:'Este check-in ya fue utilizado en otra operación.', CHECKIN_EXPIRADO:'El check-in expiró. Realice una inspección nueva.',
      CHECKIN_CONFIRMACION_REQUERIDA:'Debe confirmar que realizó personalmente la inspección.', CHECKIN_LISTA_INVALIDA:'La lista de inspección no es válida.',
      CHECKIN_DATOS_REQUERIDOS:'Complete el vehículo, conductor, kilometraje y todos los puntos de inspección.', CHECKIN_DECISION_INVALIDA:'Seleccione aprobar o rechazar.',
      CHECKIN_CRITICO_NO_APROBABLE:'Un check-in con fallas críticas no puede aprobarse. Debe corregirse la falla y realizar una inspección nueva.',
      PUNTO_OPERACION_NO_CONFIGURADO:'El Administrador debe configurar el punto base de inicio y finalización en Configuración.', PUNTO_OPERACION_NO_CONFIRMADO:'El servidor no confirmó el punto operacional. Ejecute la reparación del sistema y vuelva a guardarlo.', VALIDACION_UBICACION_DESACTIVADA:'La validación geográfica de operaciones está desactivada. Debe activarse en Configuración.',
      UBICACION_OPERACION_REQUERIDA:'Debe permitir el acceso al GPS y obtener la ubicación antes de continuar.', PRECISION_GPS_REQUERIDA:'El dispositivo no informó la precisión de la ubicación.',
      UBICACION_GPS_IMPRECISA:'La señal GPS es demasiado imprecisa. Salga a un lugar abierto y vuelva a intentarlo.', UBICACION_GPS_COORDENADAS_INVALIDAS:'La lectura GPS contiene coordenadas no válidas.', UBICACION_GPS_PRECISION_REQUERIDA:'El dispositivo no informó la precisión necesaria.', UBICACION_SIMULADA_RECHAZADA:'La ubicación simulada fue rechazada por seguridad.', UBICACION_RED_IMPRECISA:'La ubicación aproximada de red no tiene precisión suficiente. Espere señal GPS.', FECHA_GPS_ANTIGUA:'La ubicación recibida es antigua y no reemplazará la última posición confiable.', FECHA_GPS_FUTURA:'La fecha del dispositivo no es válida para registrar el GPS.', FECHA_GPS_ANTERIOR:'Se descartó una ubicación anterior a la última señal aceptada.', SALTO_GPS_IMPOSIBLE:'Se descartó un salto de ubicación incompatible con el movimiento real del vehículo.', UBICACION_GPS_DEGRADADA:'La nueva lectura es mucho menos precisa y fue descartada.', FUERA_DEL_PUNTO_DE_INICIO:'No puede iniciar la operación fuera del punto autorizado por el Administrador.',
      FUERA_DEL_PUNTO_DE_FINALIZACION:'No puede finalizar la operación hasta regresar al punto autorizado.', RADIO_OPERACION_INVALIDO:'Los radios y la precisión permitida deben estar entre 10 y 5.000 metros.',
      RUTA_NO_DISPONIBLE:'La ruta seleccionada ya no está disponible.', ESTADO_OPERATIVO_AUTOMATICO:'Los estados En ruta y En operación se administran automáticamente al iniciar o finalizar una ruta u operación.', ESTADO_ADMINISTRATIVO_CON_OCUPACION_ACTIVA:'No puede aplicar un estado administrativo mientras exista una ruta u operación activa. Abra Ver ocupación para revisar qué registro mantiene ocupado al conductor o vehículo.', CONDUCTOR_NO_DISPONIBLE:'El conductor ya está ocupado en una ruta u operación activa.', VEHICULO_NO_DISPONIBLE:'El vehículo ya está ocupado en una ruta u operación activa.', RUTA_NO_CONFIRMADA_EN_CURSO:'El servidor respondió, pero no confirmó la ruta en estado En curso. Publique nuevamente Codigo_Completo.gs.', RUTA_VEHICULO_REQUERIDO:'La ruta necesita un vehículo asignado o una operación activa con vehículo.', RUTA_VEHICULO_NO_COINCIDE_OPERACION:'La operación activa utiliza otro vehículo distinto al asignado en la ruta.', RUTA_NO_COINCIDE_CONDUCTOR:'La ruta no corresponde al conductor seleccionado.', RUTA_NO_COINCIDE_VEHICULO:'La ruta no corresponde al vehículo seleccionado.', RUTA_YA_VINCULADA:'La ruta ya está vinculada a otra operación activa.',
      PUNTO_OPERACION_ROL_NO_AUTORIZADO:'Solo un Administrador o Operador puede configurar o cambiar el punto base.', CIERRE_EXCEPCIONAL_NO_AUTORIZADO:'Solo un Administrador o Operador puede cerrar una operación fuera de la base.',
      CIERRE_EXCEPCIONAL_CONFIRMACION_REQUERIDA:'Active la opción de cierre excepcional para continuar fuera de la base.', CIERRE_EXCEPCIONAL_MOTIVO_REQUERIDO:'Explique el motivo del cierre excepcional con al menos 10 caracteres.',
      KILOMETRAJE_FINAL_INVALIDO:'El kilometraje será guardado para revisión, pero no impedirá finalizar.', SOLO_ADMINISTRADOR:'Solo un Administrador puede realizar esta acción.', ACCESO_CONEXIONES_NO_AUTORIZADO:'El Administrador no ha habilitado el acceso a Conexiones en línea para este usuario.', USUARIO_SEGUIMIENTO_NO_ENCONTRADO:'El usuario seleccionado para seguimiento ya no está disponible.', MOTIVO_EDICION_REQUERIDO:'Indique un motivo de al menos 5 caracteres para registrar la edición.', FECHA_OPERACION_INVALIDA:'La fecha indicada no es válida.', RECURSO_IMPORTACION_NO_PERMITIDO:'Este módulo no admite importación masiva.',
      COMBUSTIBLE_VEHICULO_REQUERIDO:'Seleccione el vehículo de la carga.', COMBUSTIBLE_CONDUCTOR_REQUERIDO:'Seleccione el conductor relacionado.',
      COMBUSTIBLE_LITROS_INVALIDO:'Ingrese una cantidad de litros mayor que cero.', COMBUSTIBLE_PRECIO_LITRO_INVALIDO:'Ingrese un precio por litro válido.', COMBUSTIBLE_KILOMETRAJE_INVALIDO:'Ingrese un kilometraje válido.',
      COMBUSTIBLE_FECHA_INVALIDA:'La fecha y hora de la carga no son válidas.', COMBUSTIBLE_OPERACION_NO_COINCIDE:'La operación seleccionada no corresponde al vehículo y conductor.',
      COMBUSTIBLE_RUTA_NO_COINCIDE:'La ruta seleccionada no corresponde al vehículo y conductor.', COMBUSTIBLE_ASIGNACION_ACTIVA_REQUERIDA:'Debe seleccionar una operación o ruta activa para registrar la carga.', COMBUSTIBLE_ASIGNACION_NO_VIGENTE:'La asignación seleccionada ya no está activa.',
      COMBUSTIBLE_MOTIVO_ELIMINACION_REQUERIDO:'Indique un motivo suficiente para eliminar el registro.', COMBUSTIBLE_SOLICITUD_YA_EXISTE:'Ya existe una solicitud pendiente o aprobada para esta carga.',
      COMBUSTIBLE_AUTORIZACION_ADMIN_REQUERIDA:'La eliminación requiere una autorización vigente de un Administrador.', COMBUSTIBLE_DECISION_INVALIDA:'Seleccione aprobar o rechazar la solicitud.',
      COMBUSTIBLE_SOLICITUD_NO_ENCONTRADA:'La solicitud de eliminación no existe.', COMBUSTIBLE_SOLICITUD_YA_RESUELTA:'La solicitud ya fue resuelta.', SOLO_SUPERVISOR_SOLICITA_ELIMINACION:'Solo el Operador puede solicitar esta autorización.',
      COMBUSTIBLE_OPERACION_NO_AUTORIZADA:'La operación seleccionada pertenece a otro conductor.', COMBUSTIBLE_RUTA_NO_AUTORIZADA:'La ruta seleccionada pertenece a otro conductor.', CONDUCTOR_NO_ASOCIADO_USUARIO:'Su cuenta todavía no está asociada a un registro de conductor.',
      DOCUMENTO_CONDUCTOR_NO_ENCONTRADO:'El conductor seleccionado no existe.', DOCUMENTO_USUARIO_NO_ENCONTRADO:'La cuenta seleccionada no existe.',
      IMPORTACION_SIN_FILAS:'La planilla no contiene filas para importar.', IMPORTACION_DEMASIADAS_FILAS:'La planilla supera el máximo de 1.500 filas por carga.', COLUMNAS_IMPORTACION_NO_RECONOCIDAS:'No se reconocieron encabezados válidos en la hoja DATOS.', PATENTE_INVALIDA:'La patente debe contener entre 4 y 15 letras o números.', ANIO_VEHICULO_INVALIDO:'El año del vehículo no es válido.', KILOMETRAJE_VEHICULO_INVALIDO:'El kilometraje debe ser un número igual o mayor que cero.', COMBUSTIBLE_INVALIDO:'El tipo de combustible no está incluido en la plantilla oficial.', ESTADO_VEHICULO_INVALIDO:'El estado del vehículo no está incluido en la plantilla oficial.', FECHA_MANTENCION_INVALIDA:'La próxima mantención debe tener formato AAAA-MM-DD.', RUT_INVALIDO:'El RUT no es válido o su dígito verificador es incorrecto.', CORREO_INVALIDO:'El correo no tiene un formato válido.', LICENCIA_CLASE_INVALIDA:'La clase de licencia no está incluida en la plantilla oficial.', LICENCIA_VENCIMIENTO_INVALIDA:'El vencimiento de licencia debe tener formato AAAA-MM-DD.', ESTADO_CONDUCTOR_INVALIDO:'El estado del conductor no está incluido en la plantilla oficial.', DUPLICADA_EN_ARCHIVO:'La clave está repetida dentro de la misma planilla.', USUARIO_ID_NO_EXISTE:'El USUARIO_ID no corresponde a un usuario activo.', USUARIO_ASOCIADO_DEBE_SER_CONDUCTOR:'La cuenta seleccionada debe tener rol Conductor.', USUARIO_YA_ASOCIADO_A_OTRO_CONDUCTOR:'El usuario ya está asociado a otro conductor.', USUARIO_ASOCIADO_A_MULTIPLES_CONDUCTORES:'La cuenta está vinculada a más de un conductor. El Administrador debe corregir la asociación.', CORREO_CONDUCTOR_AMBIGUO:'El correo coincide con más de un conductor. Asocie la cuenta manualmente.', CONDUCTOR_ASOCIADO_A_OTRO_USUARIO:'El conductor ya está asociado a otra cuenta de usuario.', PATENTE_YA_EXISTE:'La patente ya existe en otro vehículo activo.', RUT_YA_EXISTE:'El RUT ya existe en otro conductor activo.', IMPORTACION_NO_PERMITIDA:'Este módulo no admite importación masiva.', DUPLICADO_EXISTENTE_EN_BASE:'Existen dos registros activos con la misma patente o RUT. Corrija ese duplicado antes de importar.', LECTOR_XLSX_NO_DISPONIBLE:'No se cargó el lector de Excel. Recargue la página con Ctrl + F5.', FORMATO_IMPORTACION_INVALIDO:'Use una plantilla XLSX o CSV válida.', IMPORTACION_SIN_ARCHIVO:'Seleccione una planilla antes de importar.', ARCHIVO_IMPORTACION_DEMASIADO_GRANDE:'La planilla supera el máximo de 12 MB.', CSV_IMPORTACION_MALFORMADO:'El CSV contiene comillas sin cerrar o una estructura inválida.', EXPORTADOR_REPORTES_NO_DISPONIBLE:'No se cargó el componente de exportación. Recargue la página con Ctrl + F5.', FORMATO_REPORTE_NO_SOPORTADO:'El formato solicitado no está disponible.', JSZip_NO_DISPONIBLE:'No se pudo cargar el generador de archivos Excel.', PLANILLA_SIN_HOJA_DATOS:'La planilla no contiene la hoja de datos esperada.', ASOCIADO_NO_ENCONTRADO:'No se encontró el vehículo, conductor o empresa indicado en el documento.',
      CARGA_DRIVE_INTERRUMPIDA_REINTENTE:'La conexión se interrumpió y no fue posible confirmar el APK después de los reintentos automáticos. Revise la conexión y vuelva a publicar.', CONFIRMACION_SERVIDOR_INTERRUMPIDA_REINTENTE:'El archivo fue recibido correctamente, pero el sistema no respondió después de los reintentos automáticos. Espere unos segundos y actualice el módulo para verificar si quedó publicado.', DRIVE_NO_CONFIRMACION_DEL_BLOQUE:'El almacenamiento seguro no confirmó el último bloque. Vuelva a intentar la publicación.', CARGA_DRIVE_AUN_NO_CONFIRMADA:'El almacenamiento seguro todavía está procesando el archivo. Espere unos segundos y vuelva a intentar.',
      ARCHIVO_REQUERIDO:'Seleccione un archivo para subir.', ARCHIVO_LEGADO_DRIVE_REQUIERE_RECARGA:'Este adjunto pertenece al almacenamiento anterior. Edite el documento y vuelva a cargar el archivo en el almacenamiento privado.', DOCUMENTO_SIN_ARCHIVO_ADJUNTO:'Este documento no tiene un archivo adjunto disponible.', ARCHIVO_REQUIERE_SESION:'La sesión debe estar activa para visualizar este archivo.', PERMISO_ARCHIVO_DENEGADO:'No tiene permisos para visualizar este archivo.', ARCHIVO_NO_ENCONTRADO:'El archivo no está disponible en el almacenamiento privado.', LIMPIEZA_NO_CONFIRMADA:'El servidor no confirmó la limpieza de los datos operativos.', CONFIRMACION_REQUERIDA:'Escriba LIMPIAR DATOS para confirmar la limpieza.', DIRECCION_REQUERIDA:'No se recibió una dirección válida para la ubicación.', DESTINO_ARCHIVO_INVALIDO:'La carpeta de destino no es válida.', CARGA_DOCUMENTOS_BLOQUEADA_ADMIN:'El Administrador bloqueó temporalmente la carga de documentos para esta cuenta.', FORMATO_ARCHIVO_DRIVE_INVALIDO:'Use una imagen para fotos o un archivo PDF para documentos PDF.', ARCHIVO_BASE64_INVALIDO:'No se pudo procesar el archivo seleccionado.', ARCHIVO_DRIVE_DEMASIADO_GRANDE:'El archivo supera el máximo permitido de 12 MB.', CARPETA_DRIVE_NO_DISPONIBLE:'No se pudo acceder al almacenamiento privado configurado.', DRIVE_REQUIERE_CONEXION_CENTRAL:'La carga de archivos requiere conexión con el servicio central de la Base de Datos.', EVIDENCIA_RUTA_NO_AUTORIZADA:'La fotografía no pertenece a esta ruta o no está autorizada.', EVIDENCIA_RUTA_NO_DISPONIBLE:'La fotografía no está disponible en almacenamiento privado.', EVIDENCIA_RUTA_NO_ES_IMAGEN:'El respaldo seleccionado no es una imagen válida.', EVIDENCIA_RUTA_DEMASIADO_GRANDE:'La imagen es demasiado grande para mostrarse.'
    };
    if (messages[key]) return messages[key];
    if (key.startsWith('COLUMNAS_REQUERIDAS:')) return `Faltan columnas obligatorias: ${key.split(':').slice(1).join(':').trim()}.`;
    if (key.startsWith('COLUMNAS_DUPLICADAS:')) return `La planilla contiene encabezados repetidos: ${key.split(':').slice(1).join(':').trim()}.`;
    if (key.startsWith('CAMPO_REQUERIDO_')) return `El campo ${key.replace('CAMPO_REQUERIDO_','')} es obligatorio.`;
    return key.replaceAll('_',' ');
  }

  function toast(title, message = '', type = 'success') {
    const node = document.createElement('div'); node.className = `toast ${type === 'error' ? 'error' : ''}`;
    node.innerHTML = `<i>${type === 'error' ? '!' : '✓'}</i><div><b>${esc(title)}</b><small>${esc(message)}</small></div><button aria-label="Cerrar">×</button>`;
    $('#toastStack').append(node); $('button', node).addEventListener('click', () => node.remove()); setTimeout(() => node.remove(), 4200);
  }

  function activarCargaBoton(button, text = 'Procesando…') {
    if (!button || button.dataset.loading === '1') return null;
    const state = {
      html: button.innerHTML,
      disabled: button.disabled,
      minWidth: button.style.minWidth,
      ariaBusy: button.getAttribute('aria-busy'),
    };
    const width = button.getBoundingClientRect().width;
    button.dataset.loading = '1';
    button.disabled = true;
    button.classList.add('is-loading');
    button.setAttribute('aria-busy','true');
    if (width) button.style.minWidth = `${Math.ceil(width)}px`;
    const compact=button.matches('.row-actions button,.icon-button,.assignment-alert-card button,[role=\"alertdialog\"] button[data-accept-assignment],[role=\"alertdialog\"] button[data-read-alert],[role=\"alertdialog\"] button[data-read-notification]')||(button.classList.contains('topbar-sync')&&window.matchMedia?.('(max-width:760px)').matches);
    button.classList.toggle('is-loading-compact',compact);
    button.textContent = compact?'':text;
    return () => {
      button.innerHTML = state.html;
      button.disabled = state.disabled;
      button.style.minWidth = state.minWidth;
      button.classList.remove('is-loading');
      button.classList.remove('is-loading-compact');
      delete button.dataset.loading;
      if (state.ariaBusy === null) button.removeAttribute('aria-busy');
      else button.setAttribute('aria-busy', state.ariaBusy);
    };
  }

  async function conCargaBoton(button, text, action) {
    if (!button) {
      accionesInterfazEnCurso++;
      try { return await action(); }
      finally { accionesInterfazEnCurso=Math.max(0,accionesInterfazEnCurso-1); }
    }
    const finalizar = activarCargaBoton(button, text);
    if (!finalizar) return;
    accionesInterfazEnCurso++;
    try { return await action(); }
    finally {
      accionesInterfazEnCurso=Math.max(0,accionesInterfazEnCurso-1);
      finalizar();
    }
  }

  function guardarListaFormulario(resource, rows = []) {
    const list = Array.isArray(rows) ? rows : [];
    const prefix = `${resource}:`;
    [...cacheRegistros.keys()].forEach(key => { if (key.startsWith(prefix)) cacheRegistros.delete(key); });
    list.forEach(row => { if (row?.ID) cacheRegistros.set(`${resource}:${row.ID}`, row); });
    cacheListasFormulario.set(resource, list);
    return list;
  }

  function guardarRegistro(resource, row) {
    if (row?.ID) cacheRegistros.set(`${resource}:${row.ID}`, row);
    return row;
  }

  function listaFormulario(resource) {
    return cacheListasFormulario.get(resource) || [];
  }

  function registroFormulario(resource, id) {
    return cacheRegistros.get(`${resource}:${id}`) || null;
  }

  function invalidarListasFormulario(...resources) {
    if (!resources.length) {
      cacheListasFormulario.clear();
      cacheRegistros.clear();
      listasFormularioPendientes.clear();
      return;
    }
    resources.forEach(resource => {
      cacheListasFormulario.delete(resource);
      listasFormularioPendientes.delete(resource);
      const prefix = `${resource}:`;
      [...cacheRegistros.keys()].forEach(key => { if (key.startsWith(prefix)) cacheRegistros.delete(key); });
    });
  }

  function cargarListaFormulario(resource) {
    if (cacheListasFormulario.has(resource)) return Promise.resolve(listaFormulario(resource));
    if (listasFormularioPendientes.has(resource)) return listasFormularioPendientes.get(resource);
    const pending = api.request('list',{resource,limit:1000,cache:false})
      .then(result => guardarListaFormulario(resource,result.rows||[]))
      .finally(() => {
        if (listasFormularioPendientes.get(resource) === pending) listasFormularioPendientes.delete(resource);
      });
    listasFormularioPendientes.set(resource,pending);
    return pending;
  }

  function limitesRegistrosGuardados(){
    try{return JSON.parse(localStorage.getItem(claveLimitesRegistros)||'{}')||{};}catch(_){return{};}
  }
  function limiteRegistrosActual(section=currentSection){
    const raw=limitesRegistrosGuardados()[section];
    if(raw==='TODOS')return 'TODOS';
    const numeric=Number(raw);
    return limitesRegistrosPermitidos.includes(numeric)?numeric:limiteRegistrosPredeterminado;
  }
  function guardarLimiteRegistros(section,value){
    const normalized=value==='TODOS'?'TODOS':Number(value);
    if(!limitesRegistrosPermitidos.includes(normalized))return;
    const state=limitesRegistrosGuardados();state[section]=normalized;
    localStorage.setItem(claveLimitesRegistros,JSON.stringify(state));
  }
  function selectorLimiteRegistros(section){
    if(!seccionesConListado.has(section))return '';
    const selected=limiteRegistrosActual(section);
    const options=[
      [100,'Mostrar 100 recientes'],[150,'Mostrar 150 recientes'],[200,'Mostrar 200 recientes'],
      [1000,'Mostrar 1000 recientes'],['TODOS','Mostrar todos los registros']
    ];
    return `<label class="module-record-limit"><span>Registros</span><select data-record-limit aria-label="Cantidad de registros a consultar">${options.map(([value,label])=>`<option value="${value}" ${String(value)===String(selected)?'selected':''}>${label}</option>`).join('')}</select><small>Orden: más recientes primero</small></label>`;
  }
  async function solicitarListaPaginada(resource,{limit=limiteRegistrosActual(),cache=false}={}){
    if(limit!=='TODOS'){
      return api.request('list',{resource,limit:Number(limit)||limiteRegistrosPredeterminado,cache});
    }
    const rows=[],seen=new Set();let offset=0,last={};
    while(true){
      last=await api.request('list',{resource,limit:1000,offset,cache:false});
      const page=Array.isArray(last.rows)?last.rows:[];
      let added=0;
      page.forEach((row,index)=>{
        const key=String(row?.ID||`${offset+index}:${JSON.stringify(row)}`);
        if(seen.has(key))return;seen.add(key);rows.push(row);added+=1;
      });
      if(page.length<1000||last.hasMore===false||page.length===0||added===0)break;
      offset+=1000;
    }
    return {...last,rows,total:rows.length,desde:0,limite:'TODOS',hasMore:false,orden:'MAS_RECIENTES_PRIMERO'};
  }

  function setConnection(ok, text) {
    const box = $('#connectionStatus'); box.classList.toggle('error', !ok); $('span', box).textContent = text;
  }
  function setSave(text, mode = '') {
    const box = $('#saveStatus'); box.className = `save-status ${mode}`; $('span', box).textContent = text;
  }
  async function updateBattery(){
    try{const battery=await navigator.getBattery?.();if(battery){const assign=()=>{batteryLevel=Math.round(battery.level*100);};assign();battery.addEventListener('levelchange',assign);}}catch(_){}
  }
  function connectionType(){return navigator.connection?.effectiveType||navigator.connection?.type||'';}
  async function sendHeartbeat(state='En línea'){
    if(!currentUser)return;
    try{
      const stored=ultimaPosicionConocida||cargarUltimaUbicacionDispositivo()||{};
      const last=ubicacionLocalConfiable(stored,86400000)?stored:{};
      const edadUltima=last.fecha?Math.max(0,Date.now()-Number(last.fecha)):Infinity;
      const retenida=Boolean(last.fecha&&edadUltima>Number(config.EDAD_GPS_MAPA_MAXIMA_SEGUNDOS||180)*1000);
      const estadoEfectivo=retenida&&gpsWatchId!==null?'GPS temporalmente sin señal':state;
      const result=await api.request('heartbeat',{data:{DISPOSITIVO_ID:deviceId,SESION_CLIENTE_ID:clientSessionId,SECCION_ACTUAL:currentSection,GPS_ACTIVO:gpsWatchId===null?'NO':'SI',PAGINA_VISIBLE:document.hidden?'NO':'SI',ESTADO:estadoEfectivo,ACTIVIDAD:estadoEfectivo,UBICACION_RETENIDA:retenida?'SI':'NO',PLATAFORMA:navigator.platform||'',NAVEGADOR:navigator.userAgent,TIPO_RED:connectionType(),BATERIA_PORCENTAJE:batteryLevel,IP_PUBLICA:clientPublicIp,LATITUD:last.latitud??'',LONGITUD:last.longitud??'',PRECISION_METROS:last.precision??'',FECHA_GPS:last.fecha?new Date(last.fecha).toISOString():'',FUENTE_GPS:retenida?'ULTIMA_UBICACION_CONFIABLE_RETENIDA':last.fuente||'',DIRECCION:last.direccion||''}});
      if(result?.user){
        const previousVersion=Number(currentUser.VERSION_PERMISOS||0),nextVersion=Number(result.user.VERSION_PERMISOS||0);
        const previousRole=String(currentUser.ROL_ID||''),nextRole=String(result.user.ROL_ID||'');
        if(previousVersion!==nextVersion||previousRole!==nextRole){
          currentUser=result.user;
          const auth=api.getAuth();api.setAuth({...auth,user:result.user});
          postParent({tipo:'flotas:usuario-actualizado',usuario:result.user,seccion:currentSection});
          buildNav();
          if(!hasPermission(navPermission[currentSection]||'PANEL_PRINCIPAL','LEER'))navigateSection('dashboard');
        }
      }
      setConnection(navigator.onLine!==false,api.isRemote()?'Servicio conectado':'Modo local activo');
    }catch(error){setConnection(false,'Sin conexión con el servicio');}
  }
  function alertItemDate(item){return new Date(item.FECHA_ENVIO||item.FECHA_HORA||item.CREADO_EN||0).getTime();}
  function esAlertaVelocidadNexo(item){return String(item?.CATEGORIA||item?.categoria||'').toUpperCase()==='VELOCIDAD';}
  function showSpeedAlertNexo(item){
    if(embeddedMode||!avisosEmergentesActivos()||!item?.ID)return;
    nexoSpeedAlertNode?.remove();
    const velocidad=Number(item.VELOCIDAD_KMH||0),critical=String(item.NIVEL||'').toLowerCase().includes('cr')||String(item.TITULO||'').toLowerCase().includes('crít');
    const node=document.createElement('section');node.className=`nexo-speed-alert ${critical?'critical':''}`;
    node.innerHTML=`<div class="nexo-speed-orb">NX</div><div class="nexo-speed-content"><span>NEXO IA · CENTRO INTELIGENTE DE GESTIÓN</span><h3>${critical?'Alerta crítica de velocidad':'Aumento de velocidad detectado'}</h3><div class="nexo-speed-number">${velocidad?`${velocidad.toFixed(1)} <small>km/h</small>`:'VELOCIDAD'}</div><p>${esc(item.MENSAJE||item.TITULO||'Se detectó un exceso de velocidad.')}</p><div class="nexo-speed-meta"><b>${esc(item.PATENTE||item.VEHICULO_ID||'Vehículo')}</b><small>${fmtDate(item.FECHA_DETECTADA||item.FECHA_HORA||item.CREADO_EN,true)}</small></div><div class="nexo-speed-actions"><button class="btn soft" type="button" data-nexo-speed-close>Continuar</button><button class="btn primary" type="button" data-nexo-speed-open>Ver alertas</button></div></div>`;
    document.body.append(node);nexoSpeedAlertNode=node;
    $('[data-nexo-speed-close]',node)?.addEventListener('click',()=>{node.remove();if(nexoSpeedAlertNode===node)nexoSpeedAlertNode=null;});
    $('[data-nexo-speed-open]',node)?.addEventListener('click',()=>{node.remove();if(nexoSpeedAlertNode===node)nexoSpeedAlertNode=null;navigateSection('alerts');});
    setTimeout(()=>{if(nexoSpeedAlertNode===node){node.remove();nexoSpeedAlertNode=null;}},10000);
  }
  function showIncomingNotice(item,kind){
    if(embeddedMode||!avisosEmergentesActivos())return;
    if(esAvisoAsignacion(item)){showAssignmentAlert(item);return;}
    if(kind==='alert'&&esAlertaVelocidadNexo(item)){showSpeedAlertNexo(item);return;}
    const critical=kind==='alert'&&String(item.NIVEL||'').toLowerCase().includes('cr')||['Urgente','Alta'].includes(item.PRIORIDAD);
    toast(kind==='alert'?'Nueva alerta':'Nueva notificación',item.TITULO||item.MENSAJE||'Existe un nuevo aviso pendiente.',critical?'error':'success');
  }
  function esAvisoAsignacion(item){return ['RUTA_ASIGNADA','RUTA_SIGUIENTE_DESTINO','OPERACION_ASIGNADA','VEHICULO_CHECKIN_ASIGNADO'].includes(String(item?.CATEGORIA_EMERGENTE||'').toUpperCase())&&String(item?.ESTADO_RESPUESTA||'PENDIENTE').toUpperCase()==='PENDIENTE';}
  async function responderAvisoAsignacionWeb(item,respuesta,button){
    if(!item?.ID)return;if(button)button.disabled=true;
    try{const result=await api.request('respondAssignmentAlert',{id:item.ID,data:{NOTIFICACION_ID:item.ID,RESPUESTA:respuesta}});assignmentAlertNode?.remove();assignmentAlertNode=null;knownNotificationIds.delete(String(item.ID));invalidarListasFormulario('notifications','routes','operations');await refreshNotificationBadge();if(result?.RUTA_INICIADA===true||result?.rutaIniciada===true){const route=result.RUTA||result.ruta||{},seguimiento=result.SEGUIMIENTO||result.seguimiento||null;if(seguimiento)await activarSeguimientoRutaCliente(seguimiento);const siguiente=String(item.CATEGORIA_EMERGENTE||'').toUpperCase()==='RUTA_SIGUIENTE_DESTINO';toast(siguiente?'Siguiente destino aceptado':'Ruta aceptada e iniciada',siguiente?'Abriendo automáticamente la navegación al próximo punto.':'GPS activado. Abriendo la navegación planificada.');programarNavegacionRutaPlanificada(route);}else if(result?.POSPUESTA===true||result?.pospuesta===true)toast('Siguiente destino pendiente','La tarjeta se cerró, pero el destino continúa disponible en la campanita para retomarlo.');else toast(respuesta==='ACEPTADA'?'Asignación aceptada':'Aviso cerrado','La respuesta quedó confirmada en el sistema.');setTimeout(mostrarSiguienteAvisoAsignacionWeb,120);}
    catch(error){if(button)button.disabled=false;toast('No se pudo confirmar',translateError(error),'error');}
  }
  function hacerPersistenteAvisoAsignacion(node){
    if(!node||node.dataset.persistente==='1')return;
    node.dataset.persistente='1';
    node.classList.add('assignment-alert-persistent');
    const footer=$('footer',node);if(footer)footer.classList.add('accept-only');
    const cuerpo=$('.assignment-alert-body',node);if(cuerpo&&!$('[data-assignment-pending]',cuerpo)){
      const aviso=document.createElement('p');aviso.dataset.assignmentPending='1';aviso.className='assignment-alert-pending';aviso.textContent='Aviso pendiente: permanecerá en la bandeja hasta que presione Aceptar.';cuerpo.append(aviso);
    }
  }
  function mostrarSiguienteAvisoAsignacionWeb(){
    if(assignmentAlertNode?.isConnected)return;
    while(assignmentAlertQueue.length){const siguiente=assignmentAlertQueue.shift();if(siguiente?.ID){showAssignmentAlert(siguiente);break;}}
  }
  function showAssignmentAlert(item){
    if(embeddedMode||!avisosEmergentesActivos()||!item?.ID)return;
    if(assignmentAlertNode?.isConnected){
      const actual=String(assignmentAlertNode.dataset.assignmentId||'');
      if(actual===String(item.ID))return;
      if(!assignmentAlertQueue.some(row=>String(row?.ID||'')===String(item.ID)))assignmentAlertQueue.push(item);
      return;
    }
    const recibidaFuera=document.hidden;
    const categoria=String(item.CATEGORIA_EMERGENTE||'').toUpperCase(),esSiguiente=categoria==='RUTA_SIGUIENTE_DESTINO',clase=categoria.startsWith('VEHICULO_CHECKIN')?'vehículo para check-in':categoria.startsWith('OPERACION')?'operación':'ruta',encabezado=esSiguiente?'Llegaste al punto · siguiente destino':categoria.startsWith('VEHICULO_CHECKIN')?'Vehículo asignado':`Nueva ${clase} asignada`;
    const node=document.createElement('section');node.className='assignment-alert-card';node.setAttribute('role','alertdialog');node.dataset.assignmentId=String(item.ID);
    const etiquetaAceptar=esSiguiente?'Aceptar y continuar':esAdministrador()?'Aceptar como Administrador':puedeAceptarAsignacionesAjenas()?'Aceptar como Operador':'Aceptar';
    node.innerHTML=`<header><i>${clase==='ruta'?'➜':clase==='operación'?'⇄':'▣'}</i><div><span>AVISO PRIORITARIO</span><h2>${encabezado}</h2></div></header><div class="assignment-alert-body"><h3>${esc(item.NOMBRE_ASIGNACION||item.TITULO||'Nueva asignación')}</h3><div><span>Usuario</span><b>${esc(item.DESTINATARIO_NOMBRE||currentUser?.NOMBRE||'Conductor')}</b></div><div><span>Desde</span><b>${esc(item.ORIGEN||'No informado')}</b></div><div><span>Hasta</span><b>${esc(item.DESTINO||'No informado')}</b></div>${clase==='ruta'?`<div><span>Navegación</span><b>${esc(item.PROVEEDOR_NAVEGACION||'Google Maps')}</b></div>`:''}<p>${categoria.startsWith('VEHICULO_CHECKIN')?'Retire la llave y complete el check-in antes de iniciar la ruta.':`${item.DISTANCIA_KM==null?'Distancia por calcular':`${esc(item.DISTANCIA_KM)} km estimados`} · ${item.DURACION_MINUTOS==null?'Tiempo por calcular':`${esc(item.DURACION_MINUTOS)} min estimados`}`}</p><p class="assignment-alert-pending" data-assignment-pending="1">La asignación permanecerá visible hasta que presione Aceptar.</p></div><footer class="accept-only"><button class="primary" data-assignment-response="ACEPTADA">✓ ${etiquetaAceptar}</button></footer>`;
    document.body.append(node);assignmentAlertNode=node;$$('[data-assignment-response]',node).forEach(button=>button.onclick=()=>conCargaBoton(button,button.dataset.assignmentResponse==='ACEPTADA'?'Aceptando…':'Cerrando…',()=>responderAvisoAsignacionWeb(item,button.dataset.assignmentResponse,button)));
    if(recibidaFuera)hacerPersistenteAvisoAsignacion(node);
    if(vozAsignacionesActiva())hablar(`${encabezado} para ${item.DESTINATARIO_NOMBRE||'el conductor'}. ${item.NOMBRE_ASIGNACION||''}. Desde ${item.ORIGEN||'origen no informado'} hasta ${item.DESTINO||'destino no informado'}.`);
    // Sin cierre automático ni botón X: la tarjeta permanece hasta Aceptar.
  }
  function claveVisualAviso(item,tipo){
    const normal=value=>String(value??'').trim().toUpperCase().replace(/\s+/g,' ');
    if(item.CLAVE_UNICA)return tipo==='notification'
      ? `${tipo}|${normal(item.CLAVE_UNICA)}|${normal(item.DESTINATARIO_USUARIO_ID)}|${normal(item.DESTINATARIO_CONDUCTOR_ID)}`
      : `${tipo}|${normal(item.CLAVE_UNICA)}`;
    return tipo==='alert'
      ? ['ALT',item.TIPO,item.MODULO,item.REGISTRO_ID,item.TITULO,item.MENSAJE,item.USUARIO_ID].map(normal).join('|')
      : ['NOT',item.DESTINATARIO_USUARIO_ID,item.DESTINATARIO_CONDUCTOR_ID,item.TIPO,item.TITULO,item.MENSAJE,item.RUTA_ID,item.OPERACION_ID].map(normal).join('|');
  }
  function deduplicarAvisos(rows,tipo){
    const mapa=new Map();
    (rows||[]).forEach(row=>{
      const key=claveVisualAviso(row,tipo),current=mapa.get(key);
      if(!current||alertItemDate(row)>alertItemDate(current))mapa.set(key,row);
    });
    return [...mapa.values()];
  }
  const ausenciasAvisosVisual={notification:new Map(),alert:new Map()};
  function estabilizarAvisosVisuales(anteriores,nuevos,tipo){
    const ausencias=ausenciasAvisosVisual[tipo]||new Map(),actuales=new Map((nuevos||[]).map(item=>[String(item.ID||''),item]).filter(([id])=>id));
    const salida=[...actuales.values()];actuales.forEach((_,id)=>ausencias.delete(id));
    (anteriores||[]).forEach(item=>{const id=String(item?.ID||'');if(!id||actuales.has(id))return;const faltas=(ausencias.get(id)||0)+1;if(faltas<3){ausencias.set(id,faltas);salida.push(item);}else ausencias.delete(id);});
    return deduplicarAvisos(salida,tipo);
  }

  async function refreshNotificationBadge(){
    if(!currentUser)return;
    if(embeddedMode){postParent({tipo:'flotas:actualizar-avisos'});return;}
    try{
      const canNotifications=hasPermission('NOTIFICACIONES','LEER'),canAlerts=hasPermission('ALERTAS','LEER');
      const pendientes=(canNotifications||canAlerts)?await api.request('pendingNotices',{cache:false}):{};
      const nuevasNotifications=canNotifications?deduplicarAvisos((pendientes.notifications||pendientes.notificaciones||[]).filter(row=>!['SI','TRUE','1'].includes(String(row.LEIDA??row.leida??'NO').trim().toUpperCase())),'notification').sort((a,b)=>alertItemDate(b)-alertItemDate(a)):[];
      const nuevasAlerts=canAlerts?deduplicarAvisos((pendientes.alerts||pendientes.alertas||[]).filter(row=>!['SI','TRUE','1'].includes(String(row.LEIDA??row.leida??'NO').trim().toUpperCase())),'alert').sort((a,b)=>alertItemDate(b)-alertItemDate(a)):[];
      const notifications=canNotifications?estabilizarAvisosVisuales(notificationCenterState.notifications,nuevasNotifications,'notification').sort((a,b)=>alertItemDate(b)-alertItemDate(a)):[];
      const alerts=canAlerts?estabilizarAvisosVisuales(notificationCenterState.alerts,nuevasAlerts,'alert').sort((a,b)=>alertItemDate(b)-alertItemDate(a)):[];
      if(!canNotifications)ausenciasAvisosVisual.notification.clear();if(!canAlerts)ausenciasAvisosVisual.alert.clear();
      notificationCenterState={notifications,alerts};
      const newNotifications=notifications.filter(row=>!knownNotificationIds.has(String(row.ID)));
      const newAlerts=alerts.filter(row=>!knownAlertIds.has(String(row.ID)));
      const newAssignments=notifications.filter(esAvisoAsignacion).filter(row=>!knownAssignmentAlertIds.has(String(row.ID)));
      if(notificationSnapshotReady&&avisosEmergentesActivos()){
        [...newAlerts,...newNotifications.filter(item=>!esAvisoAsignacion(item))].sort((a,b)=>alertItemDate(a)-alertItemDate(b)).slice(-3).forEach(item=>showIncomingNotice(item,alerts.includes(item)?'alert':'notification'));
        const extra=newAlerts.length+newNotifications.length-3;if(extra>0&&!embeddedMode)toast('Nuevos avisos',`${extra} aviso${extra===1?'':'s'} adicional${extra===1?'':'es'} en el centro de notificaciones.`);
      }
      const assignmentQueue=(notificationSnapshotReady?newAssignments.slice(-3):newAssignments.slice(-1)).sort((a,b)=>alertItemDate(a)-alertItemDate(b));assignmentQueue.forEach((item,index)=>setTimeout(()=>showAssignmentAlert(item),index*6500));
      knownNotificationIds=new Set(notifications.map(row=>String(row.ID)));
      knownAlertIds=new Set(alerts.map(row=>String(row.ID)));
      knownAssignmentAlertIds=new Set([...knownAssignmentAlertIds,...notifications.filter(esAvisoAsignacion).map(row=>String(row.ID))]);
      notificationSnapshotReady=true;
      const count=notifications.length+alerts.length,badge=$('#notificationBadge'),button=$('#notificationButton');
      badge.textContent=count>99?'99+':String(count);badge.hidden=count===0;
      button?.setAttribute('aria-label',count?`Abrir ${count} avisos pendientes`:'Abrir centro de notificaciones');
      if(count)document.title=`(${count}) ${document.title.replace(/^\(\d+\)\s*/,'')}`;else document.title=document.title.replace(/^\(\d+\)\s*/,'');
    }catch(_){}
  }
  function openNotificationCenter(){
    if(!currentUser)return;
    const notifications=notificationCenterState.notifications||[],alerts=notificationCenterState.alerts||[];
    const alertRows=alerts.slice(0,8).map(row=>`<article class="notification-card"><header><div><h4>${esc(row.TITULO||'Alerta')}</h4><p>${esc(row.MENSAJE||'')}</p></div>${status(row.NIVEL||'Alerta')}</header><div class="route-meta"><span>${fmtDate(row.FECHA_HORA||row.CREADO_EN,true)}</span><span>${esc(row.MODULO||'Sistema')}</span></div>${hasPermission('ALERTAS','CERRAR')?`<button class="link-button" data-read-alert="${row.ID}" type="button">Validar y cerrar</button>`:'<span class="status warning">Pendiente del Administrador</span>'}</article>`).join('');
    const notificationRows=notifications.slice(0,8).map(notificationCard).join('');
    $('#modalEyebrow').textContent='AVISOS AUTOMÁTICOS';$('#modalTitle').textContent='Centro de notificaciones';
    $('#modalBody').innerHTML=`<label class="assignment-alert-switch"><input type="checkbox" data-assignment-voice-toggle ${vozAsignacionesActiva()?'checked':''}><i></i><span><b>Voz de nuevas asignaciones</b><small>Puede silenciarla; la tarjeta emergente, la campanita y los avisos pendientes seguirán activos.</small></span></label><div class="notification-center-summary"><div class="info-item"><span>Notificaciones pendientes</span><b>${notifications.length}</b></div><div class="info-item"><span>Alertas pendientes</span><b>${alerts.length}</b></div></div><div class="notification-dashboard"><article class="card"><div class="card-header"><div><h3>Notificaciones</h3><p>Mensajes dirigidos a su usuario.</p></div></div><div class="notification-list">${notificationRows||empty('✓','Sin notificaciones','No hay mensajes pendientes.')}</div><button class="btn soft full" type="button" data-center-nav="notifications">Abrir notificaciones</button></article><article class="card"><div class="card-header"><div><h3>Alertas</h3><p>Eventos generados automáticamente por el sistema.</p></div></div><div class="notification-list">${alertRows||empty('✓','Sin alertas','No hay alertas pendientes.')}</div><button class="btn soft full" type="button" data-center-nav="alerts">Abrir alertas</button></article></div>`;
    openModal();$('[data-assignment-voice-toggle]',$('#modalBody'))?.addEventListener('change',event=>{const activa=event.target.checked;if(!guardarVozAsignaciones(activa)){event.target.checked=!activa;toast('No se pudo guardar','La preferencia de voz no pudo guardarse en este navegador.','error');return;}toast(activa?'Voz activada':'Voz silenciada',activa?'Las nuevas asignaciones también se anunciarán por voz.':'Las alertas visuales y pendientes continuarán funcionando.');});$$('[data-center-nav]',$('#modalBody')).forEach(button=>button.addEventListener('click',()=>{closeModal();navigateSection(button.dataset.centerNav);}));$$('[data-read-notification]',$('#modalBody')).forEach(button=>button.addEventListener('click',()=>conCargaBoton(button,'Actualizando…',()=>readNotification(button.dataset.readNotification))));$$('[data-accept-assignment]',$('#modalBody')).forEach(button=>button.addEventListener('click',()=>conCargaBoton(button,'Aceptando…',()=>responderAvisoAsignacionWeb({ID:button.dataset.acceptAssignment},'ACEPTADA',button))));$$('[data-checkin-route-notification]',$('#modalBody')).forEach(button=>button.addEventListener('click',()=>{const item=notifications.find(row=>String(row.ID)===String(button.dataset.checkinRouteNotification));if(item?.CHECKIN_ID)openCheckinDetailModal(item.CHECKIN_ID,{notificacion:item});}));$$('[data-read-alert]',$('#modalBody')).forEach(button=>button.addEventListener('click',()=>conCargaBoton(button,'Actualizando…',()=>readAlert(button.dataset.readAlert))));
  }
  function stopRouteRealtimeSync(){if(routeSyncTimer)clearTimeout(routeSyncTimer);routeSyncTimer=null;routeSyncRequestPending=false;routeSyncPendingRefresh=false;routeSyncRevision='';routeSyncActiveIds='';}
  function scheduleRouteRealtimeSync(delay){if(routeSyncTimer)clearTimeout(routeSyncTimer);routeSyncTimer=setTimeout(routeRealtimeSyncTick,Math.max(500,Number(delay)||1000));}
  function depurarContextoRutaReasignadaWeb(info={}){
    if(String(currentUser?.ROL_ID||'').toUpperCase()!=='ROL-CONDUCTOR')return false;
    const activas=Array.isArray(info.RUTAS_ACTIVAS_IDS)?info.RUTAS_ACTIVAS_IDS.map(String):[];
    let depurado=false;
    const rutaSeguida=String(routeTrackingContext?.RUTA_ID||'');
    if(rutaSeguida&&!activas.includes(rutaSeguida)){guardarContextoSeguimientoRuta(null);depurado=true;}
    const pendiente=leerJsonLocal(pendingRouteCheckinKey),rutaPendiente=String(pendiente?.RUTA_ID||'');
    if(rutaPendiente&&!activas.includes(rutaPendiente)){try{localStorage.removeItem(pendingRouteCheckinKey);}catch(_){}depurado=true;}
    if(depurado){assignmentAlertQueue=assignmentAlertQueue.filter(item=>!item?.RUTA_ID||activas.includes(String(item.RUTA_ID)));if(currentSection==='routes')closeModal();}
    return depurado;
  }
  async function refreshVisibleSectionAfterRouteChange(info={},forzar=false){
    invalidarListasFormulario('routes','vehicles','drivers','operations','notifications','checkins','fuel');
    ['routes','dashboard','operations','vehicles','drivers','checkin','fuel','notifications'].forEach(section=>cacheVistasModulo.delete(section));
    if(!routeSyncSections.has(currentSection))return;
    if(hayInteraccionVisualActiva()&&!forzar){routeSyncPendingRefresh=true;setSave(`Ruta ${info.ULTIMA_RUTA_ID||''} actualizada en línea · refresco pendiente`);return;}
    routeSyncPendingRefresh=false;
    await actualizarSeccionEnSegundoPlano(currentSection);
    refreshNotificationBadge().catch(()=>{});
    setSave(forzar?'Asignación de ruta actualizada inmediatamente':`Ruta ${info.ULTIMA_RUTA_ID||''} actualizada en línea`);
  }
  async function routeRealtimeSyncTick(){
    routeSyncTimer=null;
    if(!currentUser){return;}
    const interval=Math.max(750,Number(config.INTERVALO_SINCRONIZACION_RUTAS_MILISEGUNDOS||1000));
    if(document.hidden||!routeSyncSections.has(currentSection)){scheduleRouteRealtimeSync(Math.max(1500,interval));return;}
    if(routeSyncPendingRefresh&&!hayInteraccionVisualActiva()){refreshVisibleSectionAfterRouteChange({ULTIMA_RUTA_ID:''}).catch(()=>{});}
    if(routeSyncRequestPending){scheduleRouteRealtimeSync(interval);return;}
    routeSyncRequestPending=true;
    try{
      const info=await api.request('routeSyncState',{cache:false,force:true});
      const revision=String(info?.REVISION||info?.revision||'');
      const esConductor=String(currentUser?.ROL_ID||'').toUpperCase()==='ROL-CONDUCTOR';
      const idsActivos=esConductor&&Array.isArray(info?.RUTAS_ACTIVAS_IDS)?info.RUTAS_ACTIVAS_IDS.map(String).sort():[];
      const firmaIds=esConductor?idsActivos.join('|'):'';
      let cambioPropiedad=false;
      if(esConductor){if(routeSyncActiveIds==='')routeSyncActiveIds=firmaIds;else if(firmaIds!==routeSyncActiveIds){routeSyncActiveIds=firmaIds;cambioPropiedad=true;depurarContextoRutaReasignadaWeb(info||{});}}
      if(!routeSyncRevision){routeSyncRevision=revision;}
      else if(revision&&revision!==routeSyncRevision){routeSyncRevision=revision;await refreshVisibleSectionAfterRouteChange(info||{},cambioPropiedad);}
      else if(cambioPropiedad){await refreshVisibleSectionAfterRouteChange(info||{},true);}
    }catch(error){if(api.isAuthError?.(error)){forceLogout();return;}}
    finally{routeSyncRequestPending=false;}
    scheduleRouteRealtimeSync(interval);
  }
  function startRouteRealtimeSync(){stopRouteRealtimeSync();scheduleRouteRealtimeSync(250);}
  function stopRealtimeServices(){
    [heartbeatTimer,notificationTimer].forEach(timer=>{if(timer)clearInterval(timer);});
    heartbeatTimer=null;notificationTimer=null;stopRouteRealtimeSync();
  }
  function startRealtimeServices(){
    stopRealtimeServices();updateBattery();
    api.getClientIp?.().then(ip=>{if(!ip)return;clientPublicIp=ip;api.registerConnectionIp?.({DISPOSITIVO_ID:deviceId,SESION_CLIENTE_ID:clientSessionId}).catch(()=>{});sendHeartbeat();}).catch(()=>{});
    sendHeartbeat();
    heartbeatTimer=setInterval(()=>sendHeartbeat(),config.INTERVALO_CONEXION_MILISEGUNDOS||20000);
    if(!embeddedMode){
      refreshNotificationBadge();
      // Ciclo exclusivo de campanita/avisos; no recarga ni reconstruye el módulo abierto.
      notificationTimer=setInterval(refreshNotificationBadge,3000);
    }
    startRouteRealtimeSync();
    resumeTrackingIfAllowed();
  }

  async function checkSystem() {
    const savedAuth = api.getAuth();
    hideAuthCards();

    // En producción segura el módulo no confía en una sesión almacenada por sí solo.
    // Debe estar dentro del shell protegido y recibir la identidad validada desde main.html.
    if (embeddedMode) {
      if (config.PRODUCCION_SEGURA === true) {
        if (!window.__SGF_MODULO_SEGURO__?.valido) {
          postParent({tipo:'flotas:autenticacion-requerida',codigo:'MODULO_NO_AUTORIZADO',seccion:initialSection});
          return;
        }
        postParent({tipo:'flotas:autenticacion-requerida',codigo:'VALIDAR_SESION_PADRE',seccion:initialSection});
        return;
      }
      if (!savedAuth.token || !savedAuth.user) {
        postParent({tipo:'flotas:autenticacion-requerida',seccion:initialSection});
        return;
      }
      currentUser = savedAuth.user;
      showApp();
      return;
    }

    if (!savedAuth.token) $('#loginForm').classList.remove('hidden');
    $('#authBackendLabel').textContent = `Conectando con ${api.backendLabel()}…`;
    try {
      const mePromise = savedAuth.token
        ? api.request('me',{cache:false}).then(value => ({ value })).catch(error => ({ error }))
        : Promise.resolve(null);
      const [statusData, meResult] = await Promise.all([api.request('status'), mePromise]);
      if (currentUser) return;
      applyBranding(statusData.company || null);
      $('#authBackendLabel').textContent = `${api.backendLabel()} · Conectado`;
      if (statusData.needsSetup) {
        hideAuthCards();
        $('#setupForm').classList.remove('hidden');
      } else if (savedAuth.token && (meResult?.value?.user || meResult?.value?.usuario)) {
        currentUser = meResult.value.user || meResult.value.usuario;
        api.setAuth({...savedAuth,user:currentUser});
        showApp();
      } else {
        if (savedAuth.token && meResult?.error && api.isAuthError?.(meResult.error)) api.setAuth({});
        hideAuthCards();
        $('#loginForm').classList.remove('hidden');
      }
    } catch (error) {
      if (currentUser) return;
      hideAuthCards();
      $('#connectionErrorText').textContent = translateError(error);
      $('#connectionError').classList.remove('hidden');
      $('#authBackendLabel').textContent = `${api.backendLabel()} · Error`;
    }
  }

  function hideAuthCards() { ['setupForm','loginForm','connectionError'].forEach(id => $('#' + id).classList.add('hidden')); }

  async function handleSetup(event) {
    event.preventDefault(); const formElement=event.currentTarget;const form = new FormData(formElement); const button = $('button[type="submit"]', formElement);
    await conCargaBoton(button,'Instalando…',async()=>{
      try {
        await api.request('bootstrap', Object.fromEntries(form.entries()));
        toast('Sistema instalado','El administrador inicial fue creado.'); formElement.reset(); await checkSystem();
      } catch (error) { toast('No fue posible instalar',translateError(error),'error'); }
    });
  }

  async function handleLogin(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const button = $('button[type="submit"]',event.currentTarget);
    await conCargaBoton(button,'Verificando…',async()=>{
      try {
        const loginData=Object.fromEntries(form.entries());loginData.DISPOSITIVO_ID=deviceId;loginData.SESION_CLIENTE_ID=clientSessionId;const ipPromise=api.getClientIp?.().catch(()=> '')||Promise.resolve('');const fastIp=clientPublicIp||sessionStorage.getItem('flotas_ip_publica_v1')||'';if(fastIp)loginData.IP_PUBLICA=fastIp;const result = await api.request('login', loginData); api.setAuth({ token:result.token, sessionId:result.sessionId||'', user:result.user, expiresAt:result.expiresAt });
        currentUser = result.user; showApp(); toast('Bienvenido',`Sesión iniciada como ${currentUser.ROL_NOMBRE}.`);
      } catch (error) { toast('Acceso denegado',translateError(error),'error'); }
    });
  }

  function fechaCumpleanosValida(value){
    const raw=String(value||'').trim();if(!raw)return null;const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw)?`${raw}T12:00:00`:raw);return Number.isNaN(d.getTime())?null:d;
  }
  let temporizadorFinCumpleanos=0;
  function esCumpleanosHoy(){
    const nacimiento=fechaCumpleanosValida(currentUser?.FECHA_NACIMIENTO);if(!nacimiento)return false;
    const hoy=new Date();return hoy.getMonth()===nacimiento.getMonth()&&hoy.getDate()===nacimiento.getDate();
  }
  function limpiarAmbienteCumpleanos(){
    document.body.classList.remove('birthday-day');document.querySelector('.birthday-day-decor')?.remove();
    if(temporizadorFinCumpleanos){clearTimeout(temporizadorFinCumpleanos);temporizadorFinCumpleanos=0;}
  }
  function activarAmbienteCumpleanos(){
    limpiarAmbienteCumpleanos();if(!currentUser||!esCumpleanosHoy())return false;
    document.body.classList.add('birthday-day');
    const primerNombre=esc(String(currentUser.NOMBRE||'').trim().split(/\s+/)[0]||'Usuario');
    const decor=document.createElement('div');decor.className='birthday-day-decor';decor.setAttribute('aria-hidden','true');
    decor.innerHTML=`<div class="birthday-day-garland">🎈 ✨ 🎉 🎂 🎊 ✨ 🎈</div><div class="birthday-day-chip">🎂 ¡Feliz cumpleaños, ${primerNombre}! 🎉</div><div class="birthday-day-confetti">${Array.from({length:18},(_,i)=>`<i style="--i:${i}">${['🎉','✨','🎈','🎊'][i%4]}</i>`).join('')}</div>`;
    document.body.append(decor);
    const ahora=new Date(),fin=new Date(ahora.getFullYear(),ahora.getMonth(),ahora.getDate()+1,0,0,1,0),espera=Math.max(1000,fin.getTime()-ahora.getTime());
    temporizadorFinCumpleanos=setTimeout(()=>limpiarAmbienteCumpleanos(),espera);
    return true;
  }
  function mostrarCumpleanosUsuario(){
    if(!activarAmbienteCumpleanos())return;
    const hoy=new Date();const clave=`flotas_cumple_${currentUser.ID}_${hoy.getFullYear()}-${hoy.getMonth()+1}-${hoy.getDate()}`;if(sessionStorage.getItem(clave)==='1')return;sessionStorage.setItem(clave,'1');
    const overlay=document.createElement('div');overlay.className='birthday-celebration';overlay.innerHTML=`<div class="birthday-balloons" aria-hidden="true">${Array.from({length:14},(_,i)=>`<i style="--i:${i}">🎈</i>`).join('')}</div><article><span>🎉</span><h2>¡Feliz Cumpleaños, ${esc(String(currentUser.NOMBRE||'').split(' ')[0]||'')}!</h2><p>Todo el equipo te desea una excelente jornada. El ambiente festivo permanecerá activo solo durante hoy.</p><button class="btn primary" type="button">¡Gracias!</button></article>`;document.body.append(overlay);const cerrar=()=>overlay.remove();overlay.querySelector('button').addEventListener('click',cerrar);setTimeout(cerrar,10000);
  }

  function showApp() {
    prepararEstadoGpsUsuarioActual();
    $('#authScreen').classList.add('hidden'); $('#appShell').classList.remove('hidden');
    $('#userName').textContent=currentUser.NOMBRE; $('#userRole').textContent=currentUser.ROL_NOMBRE || currentUser.ROL_ID; mostrarInicialesAvatarUsuario(); cargarFotoPerfilUsuario().catch(()=>{});
    $('#backendName').textContent=api.backendLabel(); $('#backendDetail').textContent=api.isRemote()?'Actualización manual del módulo · sesión sincronizada':'Información guardada en este dispositivo';
    if(currentCompany)applyBranding(currentCompany);
    setTimeout(mostrarCumpleanosUsuario,350);
    setConnection(true, api.isRemote()?'Módulo listo · actualización manual':'Base de datos local activa'); buildNav();
    if(appInicializada){
      if(embeddedMode)postParent({tipo:'flotas:modulo-listo',usuario:currentUser,seccion:currentSection,actualizadoEn:estadoSincronizacionModulos[currentSection]?.time||0});
      return;
    }
    appInicializada=true;
    go(initialSection).finally(() => {
      startRealtimeServices();
      if(config.GPS_AUTOMATICO_OBLIGATORIO){
        localStorage.setItem(trackingPreferenceStorageKey(),'1');
        setTimeout(()=>startTracking({silent:true}),250);
      }
    });
  }

  function buildNav() {
    if(embeddedMode){$('#nav').innerHTML='';return;}
    let html='';
    navGroups.forEach(([group,items]) => {
      const visible = items.filter(([id]) => hasPermission(navPermission[id]||'PANEL_PRINCIPAL','LEER'));
      if (!visible.length) return;
      html += `<p class="nav-label">${group}</p>` + visible.map(([id,icon,label]) => `<button class="nav-button ${currentSection===id?'active':''}" data-nav="${id}"><i>${icon}</i>${label}</button>`).join('');
    });
    $('#nav').innerHTML=html;
  }

  function consultasPrecarga() {
    const resources = [
      ['routes','RUTAS'], ['operations','OPERACIONES'], ['notifications','NOTIFICACIONES'],
      ['vehicles','VEHICULOS'], ['drivers','CONDUCTORES'], ['maintenance','MANTENCIONES'], ['fuel','COMBUSTIBLE'],
      ['documents','DOCUMENTOS'], ['history','HISTORIAL'], ['alerts','ALERTAS'],
      ['users','USUARIOS'], ['audit','BITACORA'], ['companies','CONFIGURACION'],
    ];
    return resources
      .filter(([, module]) => hasPermission(module,'LEER'))
      .map(([resource]) => ({ key:`lista_${resource}`, action:'list', payload:{ resource } }));
  }

  function precargarModulos() {
    // Regla 4.2.48: no consultar todos los módulos a la vez. Cada módulo
    // sincroniza únicamente sus propios datos cuando el usuario lo abre.
    return;
  }

  function dependenciaSeccion(section) {
    return dependenciasCacheSeccion[section] || { actions:[], resources:[] };
  }

  function invalidarCacheSeccion(section) {
    const dependency = dependenciaSeccion(section);
    api.invalidate({ actions:dependency.actions, resources:dependency.resources });
    dependency.resources.forEach(resource => invalidarListasFormulario(resource));
    cacheVistasModulo.delete(section);
  }

  function registrarSincronizacionSeccion(section, source='SERVIDOR') {
    estadoSincronizacionModulos[section] = { time:Date.now(), source };
    modulosSincronizadosSesion.add(section);
  }

  function textoActualizacionSeccion(section) {
    const saved = estadoSincronizacionModulos[section];
    if (!saved?.time) return 'Actualización manual · use ↻ Actualizar cuando lo necesite';
    const date = new Date(saved.time);
    if (Number.isNaN(date.getTime())) return 'Actualización manual';
    return `Última sincronización: ${fmtDate(date,true)} · actualización manual`;
  }

  function decorarModuloConSincronizacion(html, section) {
    const hasSync = /data-sync|data-refresh-locations/.test(html);
    const button = hasSync ? '' : '<button class="btn soft small" type="button" data-sync>↻ Actualizar este módulo</button>';
    return `<div class="module-query-controls"><div class="module-cache-status" data-module-cache-status><div><i></i><span>${esc(textoActualizacionSeccion(section))}</span></div>${button}</div><div class="module-query-options">${selectorLimiteRegistros(section)}</div></div>${html}`;
  }

  function actualizarEstadoSincronizacionVisible(text, mode='') {
    const node=$('[data-module-cache-status]');
    if(!node)return;
    node.classList.toggle('syncing',mode==='syncing');
    node.classList.toggle('error',mode==='error');
    const span=$('span',node);if(span)span.textContent=text;
  }

  function esqueletoModulo() {
    return '<div class="module-skeleton" aria-label="Preparando módulo"><i></i><div><span></span><span></span><span></span></div><section><b></b><b></b><b></b><b></b></section></div>';
  }

  async function go(section, options = {}) {
    if(section==='connections'&&!hasPermission('CONEXIONES','LEER')){toast('Acceso restringido','El Administrador no ha habilitado este módulo para su cuenta.','error');return false;}
    if (!renderers[section]) section = 'dashboard';
    const sequence = ++secuenciaNavegacion;
    cleanupSection(); currentSection=section; buildNav();
    if(currentUser&&routeSyncSections.has(section))scheduleRouteRealtimeSync(200);
    if (options.force) {
      invalidarCacheSeccion(section);
      precargaIniciada = false;
    }
    if (heartbeatTimer) sendHeartbeat();
    $('#pageTitle').textContent=labels[section]; $('#breadcrumb').textContent=`Sistema / ${labels[section]}`;
    closeSidebar();


    const cachedView = (section === 'gps' || section === 'connections') ? null : cacheVistasModulo.get(section);
    if (cachedView && !options.force) {
      $('#content').innerHTML=cachedView;
      bindSection();
      if(section==='gps')setTimeout(initMap,40);
      if(section==='connections')setTimeout(initConnectionsMap,40);
      actualizarEstadoSincronizacionVisible(textoActualizacionSeccion(section));
      window.scrollTo({top:0,behavior:'auto'});
      return true;
    }
    $('#content').innerHTML=esqueletoModulo();
    try {
      const html = await renderers[section]();
      if (sequence !== secuenciaNavegacion || section !== currentSection) return;
      const decorated = decorarModuloConSincronizacion(html, section);
      $('#content').innerHTML=decorated;
      if(section!=='gps'&&section!=='connections')cacheVistasModulo.set(section, decorated);
      if (cacheVistasModulo.size > 18) cacheVistasModulo.delete(cacheVistasModulo.keys().next().value);
      registrarSincronizacionSeccion(section,'SERVIDOR');
      bindSection();
      if (section==='gps') setTimeout(initMap,80);
      if (section==='connections') setTimeout(initConnectionsMap,80);
      actualizarEstadoSincronizacionVisible(textoActualizacionSeccion(section));
      if(embeddedMode)postParent({tipo:'flotas:modulo-listo',usuario:currentUser,seccion:section,actualizadoEn:estadoSincronizacionModulos[section]?.time||0});
    } catch (error) {
      if (sequence !== secuenciaNavegacion || section !== currentSection) return;
      if (['AUTENTICACION_REQUERIDA','SESION_INVALIDA','SESION_EXPIRADA'].includes(error.message)) {forceLogout();return false;}
      if (cachedView) {
        $('#content').innerHTML=cachedView;bindSection();
        actualizarEstadoSincronizacionVisible('Se mantiene la información de esta sesión · no respondió el servidor','error');
        toast('No se actualizó el módulo','Se conserva la información ya cargada.','warning');
        return true;
      }
      $('#content').innerHTML=`<div class="card">${empty('!','No se pudo cargar el módulo',translateError(error),'<button class="btn primary" data-retry>Reintentar</button>')}</div>`;
      bindSection(); setConnection(false,'Error del servicio de datos');postParent({tipo:'flotas:error-modulo',mensaje:translateError(error)});
      return false;
    }
    window.scrollTo({top:0,behavior:'auto'});
    return true;
  }

  function actualizarSeccionEnSegundoPlano(section,opciones={}) {
    if(!currentUser||!renderers[section])return Promise.resolve(false);
    if(actualizacionesModuloPendientes.has(section))return actualizacionesModuloPendientes.get(section);
    const task=(async()=>{
      try{
        invalidarCacheSeccion(section);
        const html=await renderers[section]();
        const decorated=decorarModuloConSincronizacion(html,section);
        cacheVistasModulo.set(section,decorated);
        registrarSincronizacionSeccion(section,'SEGUNDO_PLANO');
        if(currentSection===section){
          $('#content').innerHTML=decorated;bindSection();
          if(section==='gps')setTimeout(initMap,60);
          if(section==='connections')setTimeout(initConnectionsMap,60);
          actualizarEstadoSincronizacionVisible(textoActualizacionSeccion(section));
        }
        setSave(`${labels[section]||'Módulo'} actualizado`);
        return true;
      }catch(error){
        if(!api.isAuthError?.(error))setSave('Actualización pendiente','error');
        return false;
      }finally{actualizacionesModuloPendientes.delete(section);}
    })();
    actualizacionesModuloPendientes.set(section,task);
    return task;
  }

  function cleanupSection() {
    stopRouteClocks();
    if (gpsRefreshTimer) clearTimeout(gpsRefreshTimer); gpsRefreshTimer=null;
    if (connectionsRefreshTimer) clearTimeout(connectionsRefreshTimer); connectionsRefreshTimer=null;
    if (connectionTrackingLiveTimer) clearTimeout(connectionTrackingLiveTimer); connectionTrackingLiveTimer=null;
    if (connectionsFilterTimer) clearTimeout(connectionsFilterTimer); connectionsFilterTimer=null;
    connectionsRequestGeneration++;
    connectionsRefreshPending=null;
    connectionTrackingLivePending=null;
    connectionTrackingLiveFailures=0;
    gpsRefreshQueued=false;gpsLocationsPaintKey='';gpsDevicesPaintKey='';gpsTotalsPaintKey='';
    document.body.classList.remove('mapa-pantalla-completa');$('#mapCard')?.classList.remove('map-fullscreen');
    if (mapaFlota) { mapaFlota.eliminar(); mapaFlota=null; }
  }


  function estadoActualizacionClase(value){const v=String(value||'').toUpperCase();return v==='INSTALADA'?'ok':['DESCARGADA','INSTALACION_INICIADA'].includes(v)?'info':v==='ERROR'?'bad':'warn';}
  function filaUsuarioActualizacion(item){const u=item.USUARIOS||item.usuarios||{},estado=item.ESTADO||'PENDIENTE';return `<tr><td><strong>${esc(u.nombre||u.NOMBRE||item.USUARIO_ID||'Usuario')}</strong><span class="muted">${esc(u.correo||u.CORREO||'')}</span></td><td><span class="status ${estadoActualizacionClase(estado)}">${esc(estado)}</span></td><td>${esc(item.VERSION_INSTALADA||'—')} ${item.VERSION_CODE_INSTALADA?`(${number(item.VERSION_CODE_INSTALADA)})`:''}</td><td>${esc(item.DISPOSITIVO_ID||'—')}</td><td>${fmtDate(item.ACTUALIZADO_EN||item.FECHA_INSTALACION||item.FECHA_ULTIMA_ALERTA,true)}</td></tr>`;}
  async function renderActualizacionesApp(){
    const data=await api.request('listarActualizacionesAndroid',{data:{LIMITE:30}}),rows=Array.isArray(data.rows)?data.rows:[],latest=rows[0]||null,usuarios=Array.isArray(data.usuarios)?data.usuarios:[],res=data.resumen||{};
    const history=rows.map(r=>`<tr><td><strong>${esc(r.VERSION_NAME||'—')}</strong><span class="muted">code ${esc(r.VERSION_CODE||'')}</span></td><td>${status(r.OBLIGATORIA==='SI'?'Prioritaria':'Normal')}</td><td>${fmtDate(r.PUBLICADO_EN,true)}</td><td>${esc(r.PUBLICADO_POR_NOMBRE||r.PUBLICADO_POR||'')}</td><td><a class="btn soft small" href="${esc(r.URL_APK||'#')}" target="_blank" rel="noopener">Abrir APK</a></td></tr>`).join('');
    const userRows=usuarios.map(filaUsuarioActualizacion).join('');
    return heading('CENTRO DE DISTRIBUCIÓN ANDROID','Actualización de Aplicación','Importe una APK: SGF detecta versión, versionCode y SHA-256, procesa la publicación de forma segura y notifica solo después de confirmarla.',latest?`<button class="btn soft" type="button" data-resend-update="${esc(latest.ID)}">↻ Reenviar alertas pendientes</button>`:'')+
      `<div class="kpi-grid">${metric('⬆','Última versión',latest?.VERSION_NAME||'—',latest?`versionCode ${latest.VERSION_CODE}`:'Sin publicación')}${metric('✓','Instaladas',Number(res.instaladas||0),'Usuarios confirmados')}${metric('⇣','Descargadas',Number(res.descargadas||0),'Descarga/instalación iniciada')}${metric('!','Pendientes',Number(res.pendientes||0),'Aún sin confirmar')}</div>`+
      `<div class="dashboard-grid"><article class="card"><div class="card-header"><div><h3>Publicar nueva APK</h3><p>Seleccione el archivo. No escriba versión, versionCode, SHA-256 ni URL: SGF los obtiene y registra automáticamente.</p></div><span class="status ok">Publicación automática</span></div><form id="appUpdateForm" class="form-grid app-update-upload-form"><label class="file-drop full app-apk-drop"><input name="APK_FILE" type="file" accept=".apk,application/vnd.android.package-archive" required data-app-apk-file><i>⇧</i><b>Seleccione o arrastre la APK</b><span>SGF validará AndroidManifest.xml y calculará SHA-256</span></label><div class="app-apk-metadata full" data-app-apk-metadata><span><small>Versión</small><b data-app-apk-version>—</b></span><span><small>versionCode</small><b data-app-apk-code>—</b></span><span><small>Tamaño</small><b data-app-apk-size>—</b></span><span class="hash"><small>SHA-256</small><b data-app-apk-sha>Se calculará automáticamente</b></span></div><label class="field"><span>Versión mínima de referencia (code)</span><input name="VERSION_MINIMA_CODE" type="number" min="0" value="0"></label><label class="field"><span>Prioridad</span><select name="OBLIGATORIA"><option value="NO">Normal</option><option value="SI">Prioritaria (no bloquea)</option></select></label><label class="field full"><span>Notas de la versión <small>(opcional)</small></span><textarea name="NOTAS" maxlength="6000" placeholder="Cambios, mejoras y correcciones"></textarea></label><div class="app-upload-progress full" data-app-upload-progress hidden><div class="app-upload-progress-head"><b data-app-upload-message>Preparando…</b><span data-app-upload-percent>0%</span></div><div class="app-upload-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i data-app-upload-bar></i></div></div><div class="app-upload-success full" data-app-upload-success hidden><i>✓</i><div><b>Publicación confirmada</b><span>La actualización fue publicada correctamente, la versión quedó registrada en la base de datos y las notificaciones fueron enviadas.</span></div></div><div class="form-actions"><button class="btn primary" type="submit">Importar APK, publicar y notificar</button></div></form><p class="helper">Las notificaciones masivas se crean únicamente cuando el sistema confirma que el archivo se cargó correctamente. Si la carga falla, no se publica ninguna versión.</p></article>`+
      `<article class="card"><div class="card-header"><div><h3>Estado de la última publicación</h3><p>Seguimiento de instalación por usuario.</p></div></div>${userRows?table(['Usuario','Estado','Versión instalada','Dispositivo','Última actividad'],userRows):empty('⬆','Sin estados todavía','Publique una actualización para comenzar el seguimiento.')}</article></div>`+
      `<article class="card"><div class="card-header"><div><h3>Historial de versiones</h3><p>Publicaciones realizadas desde el Centro de Distribución Android.</p></div></div>${history?table(['Versión','Tipo','Publicada','Responsable','APK'],history):empty('▥','Sin versiones publicadas','La primera publicación aparecerá aquí.')}</article>`;
  }

  const renderers = {
    async dashboard() {
      const batch=await api.requestBatch([
        { key:'dashboard', action:'dashboard' },
        { key:'realtime', action:'realtimeSummary' },
      ]);
      const data=batch.dashboard||{},realtime=batch.realtime||{};if(data.error)throw new Error(data.error);const raw=data.metrics||{};
      const numeric=(...values)=>{for(const value of values){const parsed=Number(value);if(Number.isFinite(parsed))return parsed;}return 0;};
      const m={
        vehicles:numeric(raw.vehicles,raw.totalVehicles),availableVehicles:numeric(raw.availableVehicles),
        drivers:numeric(raw.drivers,raw.totalDrivers),availableDrivers:numeric(raw.availableDrivers),
        activeOperations:numeric(raw.activeOperations,data.activeOperations?.length),activeRoutes:numeric(raw.activeRoutes,raw.assignedRoutes),
        unreadAlerts:numeric(raw.unreadAlerts),unreadNotifications:numeric(raw.unreadNotifications),
        openMaintenance:numeric(raw.openMaintenance,raw.pendingMaintenance),expiredDocuments:numeric(raw.expiredDocuments),expiringDocuments:numeric(raw.expiringDocuments),
        fuelLoadsMonth:numeric(raw.fuelLoadsMonth),fuelLitersMonth:numeric(raw.fuelLitersMonth),fuelCostMonth:numeric(raw.fuelCostMonth,raw.fuelMonthCost),
        onlineDevices:numeric(raw.onlineDevices),pendingCheckins:numeric(raw.pendingCheckins),blockedCheckins:numeric(raw.blockedCheckins),approvedCheckins:numeric(raw.approvedCheckins)
      };
      const operationRows=Array.isArray(data.recentOperations)?data.recentOperations:(Array.isArray(data.activeOperations)?data.activeOperations:[]);
      const routeRows=Array.isArray(data.routes)?data.routes:(Array.isArray(data.recentRoutes)?data.recentRoutes:[]);
      const operations=operationRows.map(op=>`<tr><td><strong>${esc(op.ID)}</strong></td><td>${esc(op.VEHICULO_ID)}</td><td>${esc(op.CONDUCTOR_ID)}</td><td>${fmtDate(op.FECHA_INICIO||op.CREADO_EN,true)}</td><td>${status(op.ESTADO)}</td><td>${esc(op.ORIGEN||'')} → ${esc(op.DESTINO||'')}</td></tr>`).join('');
      const notifications=(data.notifications||[]).map(notificationCard).join('');
      const normalizeState=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
      const routes=routeRows.filter(r=>['asignada','en curso','iniciada','activa'].includes(normalizeState(r.ESTADO)));
      const vehicleKpis=Array.isArray(data.vehicleKpis)?data.vehicleKpis:(Array.isArray(data.KPI_VEHICULOS)?data.KPI_VEHICULOS:[]);
      const vehicleKpiRows=vehicleKpis.map(item=>`<tr><td><strong>${esc(item.PATENTE||item.ID)}</strong><span class="muted">${esc(`${item.MARCA||''} ${item.MODELO||''}`.trim())}</span></td><td>${number(Number(item.KM_RECORRIDOS||0).toFixed(1))} km</td><td>${number(Number(item.VELOCIDAD_ACTUAL_KMH||0).toFixed(1))} / ${number(Number(item.VELOCIDAD_MAXIMA_KMH||0).toFixed(1))} km/h</td><td>${number(Number(item.CONSUMO_LITROS_DIA||0).toFixed(2))} L/día</td><td>${number(Number(item.RENDIMIENTO_KM_L||0).toFixed(2))} km/L</td><td>${clp(Number(item.PRECIO_PROMEDIO_LITRO||0))}</td><td>${clp(Number(item.COSTO_DIA||0))}</td></tr>`).join('');
      const headingActions=`<button class="icon-button dashboard-refresh-circle" type="button" data-sync aria-label="Actualizar panel principal ahora" title="Actualizar panel principal">↻</button>${hasPermission('RUTAS','CREAR')?'<button class="btn primary" data-new-route>＋ Asignar ruta</button>':''}`;
      const driverHero=currentUser.ROL_ID==='ROL-CONDUCTOR'&&routes.length?`<div class="driver-home"><article class="card driver-route-hero"><div class="card-header"><div><h3>Próxima ruta asignada</h3><p>Lista para iniciar navegación</p></div>${status(routes[0].ESTADO)}</div>${routeCard(routes[0],true)}</article><article class="card"><div class="card-header"><div><h3>Mi conexión</h3><p>Estado del dispositivo</p></div></div><div class="tracking-notice ${gpsWatchId===null?'inactive':'active'}" data-tracking-notice><i data-tracking-icon>${gpsWatchId===null?'○':'●'}</i><div><b data-tracking-title>${gpsWatchId===null?'Ubicación continua detenida':'Ubicación continua activada'}</b><span data-tracking-detail>${trackingDetail()}</span></div></div><button class="btn ${gpsWatchId===null?'primary':'danger'} full" data-toggle-tracking>${gpsWatchId===null?'Activar ubicación continua':'Detener ubicación continua'}</button></article></div>`:'';
      const kpis=[
        hasPermission('VEHICULOS','LEER')?metric('▣','Vehículos',m.vehicles,`${m.availableVehicles} disponibles`,'vehicles'):'',
        hasPermission('CONDUCTORES','LEER')?metric('♙','Conductores',m.drivers,`${m.availableDrivers} disponibles`,'drivers'):'',
        hasPermission('OPERACIONES','LEER')?metric('⇄','Operaciones activas',m.activeOperations,'Seguimiento en curso','operations'):'',
        hasPermission('RUTAS','LEER')?metric('➜','Rutas activas',m.activeRoutes,'Asignadas o en curso','routes'):'',
        hasPermission('ALERTAS','LEER')?metric('!','Alertas pendientes',m.unreadAlerts,`${m.unreadNotifications} notificaciones sin leer`,'alerts'):'',
        hasPermission('DOCUMENTOS','LEER')?metric('▤','Documentos vencidos',m.expiredDocuments,`${m.expiringDocuments} vencen en 30 días`,'documents'):'',
        hasPermission('COMBUSTIBLE','LEER')?metric('⛽','Combustible del mes',`${decimal(m.fuelLitersMonth,1)} L`,`${m.fuelLoadsMonth} cargas · ${clp(m.fuelCostMonth)}`,'fuel'):'',
        hasPermission('MANTENCIONES','LEER')?metric('⚙','Mantenciones abiertas',m.openMaintenance,'Pendientes o en proceso','maintenance'):''
      ].join('');
      const onlineCount=numeric(realtime.totals?.onlineDevices,realtime.totals?.activos,m.onlineDevices);
      return heading('RESUMEN OPERACIONAL',`Hola, ${esc(currentUser.NOMBRE.split(' ')[0])}`,'Indicadores calculados desde la Base de Datos y limitados a la información autorizada para su rol.',headingActions)+
        driverHero+
        `<div class="kpi-grid">${kpis||metric('✓','Panel disponible',0,'No hay módulos adicionales habilitados')}</div>`+
        `${vehicleKpiRows?`<article class="card vehicle-kpi-card"><div class="card-header"><div><h3>${currentUser.ROL_ID==='ROL-CONDUCTOR'?'Rendimiento de mi vehículo':'Rendimiento por vehículo'}</h3><p>Kilómetros, velocidad, consumo y costo del mes actual. El alcance respeta el rol y la asignación activa.</p></div></div>${table(['Vehículo','KM recorridos','Velocidad actual / máxima','Consumo diario','Rendimiento','Precio por litro','Costo diario'],vehicleKpiRows)}</article>`:''}`+
        `<div class="live-strip">${liveStat('⌖','Sesiones abiertas',onlineCount,'online')}${liveStat('🚐','Conduciendo',numeric(realtime.totals?.drivingSessions),'online')}${liveStat('✓','Check-ins aprobados',m.approvedCheckins,'online')}${liveStat('!','Check-ins por atender',m.pendingCheckins+m.blockedCheckins,(m.pendingCheckins+m.blockedCheckins)?'warning':'')}</div>`+
        `<div class="dashboard-insights"><article class="card"><div class="card-header"><div><h3>Operaciones de los últimos 7 días</h3><p>Actividad diaria visible para su rol</p></div></div>${weeklyBars(data.charts?.operationsByDay||[])}</article><article class="card"><div class="card-header"><div><h3>Estado de la flota</h3><p>Distribución actual de vehículos</p></div></div>${stateDonut(data.charts?.vehicleStates||[])}</article><article class="card"><div class="card-header"><div><h3>Acciones rápidas</h3><p>Accesos según sus permisos</p></div></div>${quickActions()}</article></div>`+
        `${hasPermission('CONEXIONES','LEER')?`<article class="card session-control-card"><div class="card-header"><div><h3>Control de sesiones abiertas</h3><p>Usuario, conductor, módulo abierto, vehículo, operación, ruta y GPS por cada sesión.</p></div><button class="link-button" data-nav="gps">Abrir monitoreo</button></div><div class="device-list dashboard-session-list">${(realtime.devices||[]).slice(0,12).map(deviceCard).join('')||empty('○','Sin sesiones registradas','Las sesiones aparecerán cuando los usuarios ingresen al sistema.')}</div></article>`:''}`+
        `<div class="dashboard-grid"><article class="card"><div class="card-header"><div><h3>Operaciones recientes</h3><p>Movimientos creados en el sistema</p></div></div>${operations?table(['Operación','Vehículo','Conductor','Inicio','Estado','Ruta'],operations):empty('⇄','Aún no hay operaciones','No existen recorridos visibles para esta cuenta.',hasPermission('OPERACIONES','CREAR')?'<button class="btn primary" data-nav="operations">Crear operación</button>':'')}</article>`+
        `<article class="card"><div class="card-header"><div><h3>Notificaciones pendientes</h3><p>Mensajes dirigidos al usuario</p></div>${hasPermission('NOTIFICACIONES','LEER')?'<button class="link-button" data-nav="notifications">Ver todas</button>':''}</div><div class="notification-list">${notifications||empty('✓','Sin notificaciones','No existen mensajes pendientes.')}</div></article></div>`;
    },
    async office(){return renderOficinaVirtual();},
    async appUpdates(){return renderActualizacionesApp();},
    async vehicles(){return renderResourcePage('vehicles','FLOTA','Vehículos','Administre las unidades, patentes, kilometraje y códigos QR.',vehicleRows,['Vehículo','Patente','Año','Kilometraje','Estado','QR','']);},
    async drivers(){return renderResourcePage('drivers','PERSONAL','Conductores','Gestione licencias, disponibilidad y usuarios asociados.',driverRows,['Conductor','RUT','Licencia','Vencimiento','Estado','Usuario','']);},
    async maintenance(){return renderResourcePage('maintenance','PREVENCIÓN','Mantenciones','Programe trabajos preventivos y correctivos.',maintenanceRows,['Trabajo','Vehículo','Tipo','Fecha','Costo','Estado','']);},
    async fuel(){return renderFuel();},
    async documents(){return renderDocuments();},
    async alerts(){return renderAlerts();},
    async users(){const page=await renderResourcePage('users','SEGURIDAD','Usuarios','Administre accesos, roles, permisos personalizados y estado de las cuentas sin cerrar sus sesiones.',userRows,['Usuario','Correo','Rol','Permisos','Último acceso','Estado','']);return page.replace('<button class="btn soft" data-sync>','<button class="btn soft" type="button" data-restore-role-permissions>✓ Restaurar permisos base</button><button class="btn soft" data-sync>');},
    async checkin(){return renderCheckin();},
    async checkinApprovals(){return renderCheckinApprovals();},
    async checkinHistory(){return renderCheckinHistory();},
    async operations(){return renderOperations();},
    async routes(){return renderRoutes();},
    async gps(){return renderGps();},
    async connections(){return renderConnectionsOnline();},
    async notifications(){return renderNotifications();},
    async history(){return renderHistory();},
    async reports(){return renderReports();},
    async audit(){return renderAudit();},
    async company(){return renderCompany();},
    async settings(){return renderSettings();}
  };

  function metric(icon,label,value,detail,section=''){const content=`<i class="metric-icon">${icon}</i><div><span>${label}</span><b>${value}</b><small>${detail}</small></div>`;return section?`<button class="metric-card metric-card-button" type="button" data-nav="${esc(section)}">${content}</button>`:`<article class="metric-card">${content}</article>`;}
  function liveStat(icon,label,value,mode=''){return `<article class="live-stat ${mode}"><i>${icon}</i><div><span>${label}</span><b>${number(value)}</b></div></article>`;}
  function navigationUrl(route){
    const latitude=Number(route.DESTINO_LATITUD),longitude=Number(route.DESTINO_LONGITUD);
    const destination=Number.isFinite(latitude)&&Number.isFinite(longitude)&&route.DESTINO_LATITUD!==''?`${latitude},${longitude}`:route.DESTINO;
    if(route.PROVEEDOR_NAVEGACION==='Waze')return `https://www.waze.com/ul?q=${encodeURIComponent(destination||'')}&navigate=yes`;
    const params=new URLSearchParams({api:'1',destination:destination||'',travelmode:'driving'});
    if(route.ORIGEN&&route.ORIGEN!=='Ubicación actual')params.set('origin',route.ORIGEN);
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }
  function abrirNavegacionRutaPlanificada(route){
    const id=String(route?.ID||''),guardada=id?(registroFormulario('routes',id)||{}):{},planificada={...guardada,...(route||{})};
    const latitud=Number(planificada.DESTINO_LATITUD),longitud=Number(planificada.DESTINO_LONGITUD),coordenadas=Number.isFinite(latitud)&&Number.isFinite(longitud)&&String(planificada.DESTINO_LATITUD??'').trim()!==''&&String(planificada.DESTINO_LONGITUD??'').trim()!=='';
    if(!coordenadas&&!String(planificada.DESTINO||'').trim()){toast('Ruta iniciada','No se abrió la navegación porque esta ruta no tiene destino configurado.','warning');return false;}
    if(!hasPermission('RUTAS','NAVEGAR')){toast('Ruta iniciada','La navegación automática no está habilitada para este perfil.','warning');return false;}
    const proveedor=String(planificada.PROVEEDOR_NAVEGACION||'Google Maps').toLowerCase()==='waze'?'Waze':'Google Maps';
    toast('Abriendo navegación',`${proveedor} utilizará el destino planificado.`,'success');
    window.location.assign(navigationUrl({...planificada,PROVEEDOR_NAVEGACION:proveedor}));
    return true;
  }
  function programarNavegacionRutaPlanificada(route){setTimeout(()=>abrirNavegacionRutaPlanificada(route),350);}

  function formatRouteElapsed(totalValue){
    const total=Math.max(0,Math.floor(Number(totalValue)||0)),hours=Math.floor(total/3600),minutes=Math.floor((total%3600)/60),seconds=total%60;
    return [hours,minutes,seconds].map(value=>String(value).padStart(2,'0')).join(':');
  }
  function routeClockData(route,now=Date.now()){
    const item=route||{},state=String(item.ESTADO||'Asignada'),startValue=item.CRONOMETRO_INICIO||item.FECHA_ASIGNACION||item.CREADO_EN,start=new Date(startValue||0).getTime();
    const stopped=['Completada','Cancelada'].includes(state),endValue=item.CRONOMETRO_FIN||item.FECHA_FIN,end=new Date(endValue||0).getTime();
    let seconds=Number(item.TIEMPO_TRANSCURRIDO_SEGUNDOS||0);
    if(Number.isFinite(start)&&start>0)seconds=Math.max(0,Math.floor(((stopped&&Number.isFinite(end)&&end>0?end:now)-start)/1000));
    return{seconds,text:item.TIEMPO_TRANSCURRIDO_TEXTO||formatRouteElapsed(seconds),running:!stopped&&start>0,start:startValue||'',end:endValue||'',state};
  }
  function routeClockMarkup(route,compact=false){
    const clock=routeClockData(route),id=String(route?.ID||'');
    return `<div class="route-clock ${clock.running?'running':'stopped'} ${compact?'compact':''}" data-route-clock="${esc(id)}" data-route-clock-start="${esc(clock.start)}" data-route-clock-end="${esc(clock.end)}" data-route-clock-state="${esc(clock.state)}" data-route-clock-seconds="${clock.seconds}"><i>${clock.running?'◷':'✓'}</i><span><small>${clock.running?'Tiempo transcurrido':'Tiempo registrado'}</small><b data-route-clock-value>${esc(clock.text)}</b></span></div>`;
  }
  function updateRouteClocks(){
    $$('[data-route-clock]').forEach(node=>{const state=String(node.dataset.routeClockState||''),start=new Date(node.dataset.routeClockStart||0).getTime(),end=new Date(node.dataset.routeClockEnd||0).getTime(),stopped=['Completada','Cancelada'].includes(state);let seconds=Number(node.dataset.routeClockSeconds||0);if(Number.isFinite(start)&&start>0)seconds=Math.max(0,Math.floor(((stopped&&Number.isFinite(end)&&end>0?end:Date.now())-start)/1000));const value=$('[data-route-clock-value]',node);if(value)value.textContent=formatRouteElapsed(seconds);});
  }
  function stopRouteClocks(){if(routeClockInterval){clearInterval(routeClockInterval);routeClockInterval=null;}}
  function startRouteClocks(){stopRouteClocks();updateRouteClocks();if($('[data-route-clock].running'))routeClockInterval=setInterval(updateRouteClocks,1000);}
  function puedeVerLineaTiempoRuta(){return ['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'].includes(String(currentUser?.ROL_ID||'').toUpperCase())&&hasPermission('RUTAS','LEER');}
  function routeTimelineMarkup(route){
    if(!puedeVerLineaTiempoRuta())return'';
    const events=Array.isArray(route?.LINEA_TIEMPO)?route.LINEA_TIEMPO:[],kpi=route?.KPI_TRAZABILIDAD||{},byEvent=Object.fromEntries(events.map(event=>[String(event.EVENTO||'').toUpperCase(),event]));
    const stages=[
      {event:'ASIGNADA',label:'Ruta asignada',date:'FECHA_ASIGNACION',actor:'ASIGNADO_POR_NOMBRE',duration:'',help:'Inicio de la trazabilidad'},
      {event:'ACEPTADA',label:'Aceptada',date:'FECHA_ACEPTACION',actor:'ACEPTADO_POR_NOMBRE',duration:'TIEMPO_ASIGNACION_ACEPTACION_SEGUNDOS',help:'Desde la asignación'},
      {event:'INICIADA',label:'Ruta iniciada',date:'FECHA_INICIO',actor:'INICIADO_POR_NOMBRE',duration:'TIEMPO_ACEPTACION_INICIO_SEGUNDOS',help:'Desde la aceptación'},
      {event:'COMPLETADA',label:'Completada',date:'FECHA_COMPLETADA',actor:'COMPLETADO_POR_NOMBRE',duration:'TIEMPO_INICIO_COMPLETADA_SEGUNDOS',help:'Tiempo de ejecución'},
    ];
    return`<div class="route-timeline" aria-label="Trazabilidad de la ruta">${stages.map((stage,index)=>{const event=byEvent[stage.event]||{},date=kpi[stage.date]||event.FECHA_EVENTO||(stage.event==='ASIGNADA'?(route.FECHA_ASIGNACION||route.CREADO_EN):stage.event==='INICIADA'?route.FECHA_INICIO:stage.event==='COMPLETADA'&&textoEstadoKpi(route.ESTADO)==='completada'?route.FECHA_FIN:'')||'',actor=kpi[stage.actor]||event.USUARIO_NOMBRE||'',seconds=stage.duration?Number(kpi[stage.duration]??event.DURACION_DESDE_ANTERIOR_SEGUNDOS??0):0,done=Boolean(date),total=stage.event==='COMPLETADA'?Number(kpi.TIEMPO_TOTAL_CICLO_SEGUNDOS||0):0,eventDate=done?new Date(date):null,validDate=eventDate&&!Number.isNaN(eventDate.getTime()),dateText=validDate?new Intl.DateTimeFormat('es-CL',{day:'2-digit',month:'2-digit',year:'numeric'}).format(eventDate):done?String(date):'Fecha pendiente',clockText=validDate?new Intl.DateTimeFormat('es-CL',{hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(eventDate):done?'Hora registrada':'Hora pendiente';return`<div class="${done?'completed':'pending'}"><i>${done?'✓':index+1}</i><span><b>${stage.label}</b><small class="route-stage-date">${esc(dateText)}</small><small class="route-stage-clock">${esc(clockText)}</small><small class="route-stage-time">${done?(stage.event==='ASIGNADA'?'Inicio de la trazabilidad':seconds?`${stage.help}: ${formatRouteElapsed(seconds)}`:'Duración pendiente'):'Duración pendiente'}</small>${done&&total?`<small class="route-stage-total">Ciclo total: ${formatRouteElapsed(total)}</small>`:''}${actor?`<em>${esc(actor)}</em>`:''}</span></div>`;}).join('')}</div>`;
  }

  function puedeVerTrazabilidadRutas(){
    return ['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'].includes(String(currentUser?.ROL_ID||'').toUpperCase())&&hasPermission('RUTAS','LEER');
  }
  function routeTraceEvent(route,eventName){
    const events=Array.isArray(route?.LINEA_TIEMPO)?route.LINEA_TIEMPO:[];
    return events.find(event=>String(event.EVENTO||'').toUpperCase()===String(eventName||'').toUpperCase())||{};
  }
  function routeTraceValue(route,eventName,kpiField,fallback=''){
    const kpi=route?.KPI_TRAZABILIDAD||{},event=routeTraceEvent(route,eventName);
    return kpi?.[kpiField]||event.FECHA_EVENTO||fallback||'';
  }
  function traceDateMarkup(value){
    if(!value)return '<span class="route-trace-pending">Pendiente</span>';
    const date=new Date(value);if(Number.isNaN(date.getTime()))return `<span>${esc(value)}</span>`;
    const dateText=new Intl.DateTimeFormat('es-CL',{day:'2-digit',month:'2-digit',year:'numeric'}).format(date);
    const timeText=new Intl.DateTimeFormat('es-CL',{hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(date);
    return `<span class="route-trace-time"><b>${esc(dateText)}</b><small>${esc(timeText)}</small></span>`;
  }
  function activeRouteChip(route,selected=false){
    const state=String(route?.ESTADO||'Asignada'),vehicle=route?.VEHICULO_PATENTE||route?.VEHICULO_ID||'',driver=route?.CONDUCTOR_NOMBRE||route?.CONDUCTOR_ID||'';
    return `<button type="button" class="active-route-chip ${selected?'active':''}" data-active-route="${esc(route?.ID||'')}" aria-pressed="${selected?'true':'false'}"><span>${status(state)}</span><b>${esc(route?.NOMBRE||route?.ID||'Ruta')}</b><small>${esc([vehicle,driver].filter(Boolean).join(' · '))}</small></button>`;
  }
  function bindRouteDetailActions(root){
    if(!root)return;
    $$('[data-route-state]',root).forEach(btn=>btn.addEventListener('click',()=>conCargaBoton(btn,'Actualizando…',()=>changeRouteState(btn.dataset.routeState))));
    $$('[data-route-evidence]',root).forEach(btn=>btn.addEventListener('click',()=>openRouteEvidenceModal(btn.dataset.routeEvidence)));
    $$('[data-route-weather]',root).forEach(btn=>btn.addEventListener('click',()=>openRouteWeatherModal(btn.dataset.routeWeather)));
    $$('[data-resend-assignment]',root).forEach(btn=>btn.addEventListener('click',()=>{const [tipo,id]=String(btn.dataset.resendAssignment||'').split(':');conCargaBoton(btn,'Reenviando…',()=>reenviarAlertaAsignacion(tipo,id,btn));}));
    $$('[data-whatsapp-driver]',root).forEach(btn=>btn.addEventListener('click',()=>openWhatsAppDriver(btn.dataset.whatsappDriver)));
    enlazarVisoresRuta(root);enlazarGaleriasRuta(root);startRouteClocks();
  }
  function seleccionarRutaActiva(routeId){
    const id=String(routeId||'').trim(),routes=cacheListasFormulario.get('routes')||[],route=routes.find(item=>String(item.ID)===id);
    if(!route)return;
    selectedActiveRouteId=id;
    $$('[data-active-route]').forEach(button=>{const active=String(button.dataset.activeRoute)===id;button.classList.toggle('active',active);button.setAttribute('aria-pressed',active?'true':'false');});
    const detail=$('[data-active-route-detail]');if(!detail)return;
    detail.innerHTML=routeCard(route);
    bindRouteDetailActions(detail);
    detail.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function esNotificacionCheckinListaRuta(item){
    return ['CHECKIN_LISTO_RUTA','CHECKIN_REVISION'].includes(String(item?.CATEGORIA_EMERGENTE||'').toUpperCase())&&Boolean(item?.CHECKIN_ID)&&puedeVerTrazabilidadRutas();
  }
  async function abrirAsignacionDesdeCheckin(item){
    if(!item)return;
    try{
      const checkinId=String(item.CHECKIN_ID||'').trim();
      let checkin=checkinId?registroFormulario('checkins',checkinId):null;
      if(checkinId&&(!checkin||!checkin.CONDUCTOR_ID||!checkin.VEHICULO_ID)){
        try{const result=await api.request('get',{resource:'checkins',id:checkinId,cache:false});if(result?.row){checkin=result.row;guardarRegistro('checkins',checkin);}}catch(_){}
      }
      const prefill={CHECKIN_ID:checkinId||checkin?.ID||'',CONDUCTOR_ID:checkin?.CONDUCTOR_ID||item.CONDUCTOR_ID||item.DESTINATARIO_CONDUCTOR_ID||'',VEHICULO_ID:checkin?.VEHICULO_ID||item.VEHICULO_ID||'',NOTIFICACION_ID:item.ID||''};
      if(!prefill.CHECKIN_ID||!prefill.CONDUCTOR_ID||!prefill.VEHICULO_ID)throw new Error('CHECKIN_DATOS_REQUERIDOS');
      try{localStorage.setItem(pendingRoutePrefillKey,JSON.stringify(prefill));}catch(_){}
      bloquearRefrescoVisualTemporal(12000);
      await navigateSection('routes');
      if(!embeddedMode)setTimeout(()=>consumirPrefillRutaCheckin(),180);
    }catch(error){toast('No se pudo precargar la ruta',translateError(error),'error');}
  }
  function consumirPrefillRutaCheckin(){
    if(currentSection!=='routes')return false;
    const prefill=leerJsonLocal(pendingRoutePrefillKey);if(!prefill?.CHECKIN_ID)return false;
    try{localStorage.removeItem(pendingRoutePrefillKey);}catch(_){}
    setTimeout(()=>openRouteModal(prefill),90);return true;
  }

  function paradasRutaCodificadas(route){
    let raw=route?.PARADAS_CODIFICADAS??route?.paradas_codificadas??[];
    if(typeof raw==='string'){try{raw=JSON.parse(raw||'[]');}catch(_){raw=[];}}
    if(!Array.isArray(raw))return [];
    return raw.map((item,index)=>({...item,ORDEN:Number(item?.ORDEN||index+1),DESTINO:String(item?.DESTINO||item?.destino||'').trim(),ESTADO:String(item?.ESTADO||item?.estado||'PENDIENTE').toUpperCase()})).filter(item=>item.DESTINO).sort((a,b)=>a.ORDEN-b.ORDEN);
  }
  function routeStopsMarkup(route){
    const stops=paradasRutaCodificadas(route);if(stops.length<2)return '';
    const completed=stops.filter(stop=>stop.ESTADO==='COMPLETADA').length;
    const active=stops.find(stop=>['ACTIVA','LLEGADA_DETECTADA'].includes(stop.ESTADO));
    return `<div class="route-multi-progress"><div class="route-multi-summary"><b>Ruta múltiple · ${completed}/${stops.length} destino(s) completado(s)</b>${active?`<span>Siguiente: ${esc(active.DESTINO)}</span>`:''}</div><div class="route-multi-sequence">${stops.map(stop=>{const cls=stop.ESTADO==='COMPLETADA'?'done':['ACTIVA','LLEGADA_DETECTADA'].includes(stop.ESTADO)?'active':'pending',label=stop.ESTADO==='COMPLETADA'?'✓':stop.ESTADO==='LLEGADA_DETECTADA'?'●':String(stop.ORDEN);return `<span class="route-stop ${cls}" title="${esc(stop.ESTADO)}"><i>${esc(label)}</i><b>${esc(stop.DESTINO)}</b></span>`;}).join('')}</div></div>`;
  }

  function rutaListaParaCompletar(route){
    const stops=paradasRutaCodificadas(route);if(stops.length<2)return true;
    const pending=stops.filter(stop=>stop.ESTADO!=='COMPLETADA');
    if(!pending.length)return true;
    const last=stops[stops.length-1];return pending.length===1&&pending[0].PUNTO_ID===last.PUNTO_ID&&pending[0].ESTADO==='LLEGADA_DETECTADA';
  }

  function routeCard(route,hero=false){
    const item=route||{};
    const id=String(item.ID||'').trim();
    const state=String(item.ESTADO||'Asignada').trim()||'Asignada';
    const priority=String(item.PRIORIDAD||'Normal').trim()||'Normal';
    const driver=item.CONDUCTOR_NOMBRE||item.CONDUCTOR_ID||'Sin conductor';
    const vehicle=item.VEHICULO_PATENTE||item.VEHICULO_ID||'Sin vehículo';
    const origin=item.ORIGEN||'Origen no informado';
    const destination=item.DESTINO||'Destino no informado';
    const instructions=String(item.INSTRUCCIONES||'').trim();
    const evidenceCount=evidenciasRuta(item).length;
    const canStart=hasPermission('RUTAS','INICIAR');
    const canComplete=hasPermission('RUTAS','COMPLETAR');
    const canCancel=hasPermission('RUTAS','CANCELAR');
    const canEvidence=hasPermission('RUTAS','CARGAR_EVIDENCIA');
    const actions=[];
    if(hasPermission('RUTAS','NAVEGAR'))actions.push(`<a class="btn soft small" href="${esc(navigationUrl(item))}" target="_blank" rel="noopener">Navegar</a>`);
    if(id&&state==='Asignada'&&canStart)actions.push(`<button class="btn primary small" type="button" data-route-state="${esc(id)}:En curso">Iniciar ruta</button>`);
    if(id&&['Asignada','En curso'].includes(state)&&canComplete)actions.push(`<button class="btn primary small" type="button" data-route-state="${esc(id)}:Completada" title="Disponible siempre. Si finaliza antes del destino, el sistema registrará auditoría y alertará a los roles autorizados.">Completar ruta</button>`);
    if(id&&['Asignada','En curso'].includes(state)&&canCancel)actions.push(`<button class="btn danger small" type="button" data-route-state="${esc(id)}:Cancelada">Cancelar</button>`);
    if(id&&['Asignada','En curso'].includes(state)&&hasPermission('RUTAS','REASIGNAR'))actions.push(`<button class="btn soft small" type="button" data-route-reassign="${esc(id)}">↻ Reasignar</button>`);
    if(id&&canEvidence)actions.push(`<button class="btn soft small" type="button" data-route-evidence="${esc(id)}">📷 Respaldo</button>`);
    if(id)actions.push(`<button class="btn soft small" type="button" data-route-weather="${esc(id)}">☁ Clima de la ruta</button>`);
    if(id&&puedeReenviarAlertaAsignacion())actions.push(`<button class="btn soft small" type="button" data-resend-assignment="RUTA:${esc(id)}">🔔 Reenviar alerta</button>`);
    if(evidenceCount)actions.push(botonGaleriaRuta(item,`Ver ${evidenceCount} foto(s)`));
    if(item.CONDUCTOR_TELEFONO&&item.CONDUCTOR_ID)actions.push(`<button class="btn whatsapp small" type="button" data-whatsapp-driver="${esc(item.CONDUCTOR_ID)}">WhatsApp</button>`);
    return `<article class="route-card ${hero?'route-card-hero':''}"><header><div><h4>${esc(item.NOMBRE||id||'Ruta asignada')}</h4><p>${esc(driver)} · ${esc(vehicle)}</p></div><span class="priority ${esc(priority.toLowerCase())}">${esc(priority)}</span></header><div class="route-path"><i></i><span><b>Origen</b><br>${esc(origin)}</span><i class="end"></i><span><b>Destino</b><br>${esc(destination)}</span></div>${routeStopsMarkup(item)}${instructions?`<p class="route-instructions"><b>Indicaciones:</b> ${esc(instructions)}</p>`:''}${routeClockMarkup(item)}${routeTimelineMarkup(item)}<div class="route-meta"><span>${status(state)}</span><span>Asignada ${fmtDate(item.FECHA_ASIGNACION||item.CREADO_EN,true)}</span>${item.PROVEEDOR_NAVEGACION?`<span>${esc(item.PROVEEDOR_NAVEGACION)}</span>`:''}${item.OPERACION_ID?`<span>Operación ${esc(item.OPERACION_ID)}</span>`:''}</div><div class="route-actions">${actions.join('')}</div></article>`;
  }

  async function reenviarAlertaAsignacion(tipo,id,boton){
    if(!puedeReenviarAlertaAsignacion())throw new Error('ALERTA_ASIGNACION_NO_AUTORIZADA');
    const clase=String(tipo||'').toUpperCase(),registroId=String(id||'').trim();
    if(!['RUTA','OPERACION'].includes(clase)||!registroId)throw new Error('ASIGNACION_REENVIO_INVALIDA');
    await api.request('resendAssignmentAlert',{id:registroId,data:{CLASE:clase,REGISTRO_ID:registroId}});
    toast('Alerta emergente reenviada',`El aviso de ${clase==='RUTA'?'ruta':'operación'} fue dirigido nuevamente al conductor asociado.`);
    if(boton)boton.blur();
  }

  const cacheImagenesEvidenciaRuta=new Map();
  function extraerIdDriveCliente(value){const text=String(value||'').trim();if(/^[a-zA-Z0-9_-]{10,}$/.test(text))return text;const match=text.match(/(?:\/d\/|[?&]id=)([a-zA-Z0-9_-]{10,})/);return match?match[1]:'';}
  function normalizarEvidenciaRuta(item){const value=typeof item==='string'?{url:item}:(item||{});return {...value,url:String(value.url||''),archivoId:String(value.archivoId||value.id||'')};}
  function evidenciasRuta(route){let list=[];try{const parsed=JSON.parse(String(route?.EVIDENCIAS_FOTOS_CODIFICADAS||'[]'));if(Array.isArray(parsed))list=parsed;}catch(_){}if(!list.length&&route?.ULTIMA_EVIDENCIA_URL)list=[{url:route.ULTIMA_EVIDENCIA_URL,fecha:route.ULTIMA_EVIDENCIA_FECHA}];return list.map(normalizarEvidenciaRuta).filter(item=>item.url||item.archivoId);}
  function botonImagenRuta(route,item,label='Ver imagen'){const evidence=normalizarEvidenciaRuta(item);return `<button type="button" class="link-button" data-route-image-route-id="${esc(route?.ID||'')}" data-route-image-file-id="${esc(evidence.archivoId||'')}" data-route-image-url="${esc(evidence.url||'')}">${esc(label)}</button>`;}
  function botonGaleriaRuta(route,label='Ver fotografías'){const total=evidenciasRuta(route).length;return `<button type="button" class="link-button" data-route-gallery-id="${esc(route?.ID||'')}">${esc(label||`Ver ${total} foto(s)`)}</button>`;}
  async function cargarImagenEvidenciaRuta(routeId,evidence){const item=normalizarEvidenciaRuta(evidence),url=String(item.url||'');if(!routeId||!url)throw new Error('EVIDENCIA_RUTA_NO_DISPONIBLE');const key=`${routeId}:${url}`;if(cacheImagenesEvidenciaRuta.has(key))return cacheImagenesEvidenciaRuta.get(key);const pending=api.request('routeEvidenceImage',{data:{RUTA_ID:routeId,URL:url},cache:false}).then(result=>{const dataUrl=result?.dataUrl||result?.url||url;if(!dataUrl)throw new Error('EVIDENCIA_RUTA_NO_DISPONIBLE');return{...result,dataUrl};}).catch(error=>{cacheImagenesEvidenciaRuta.delete(key);throw error;});cacheImagenesEvidenciaRuta.set(key,pending);return pending;}

  async function abrirVisorImagenRuta(routeId,evidence,positionLabel=''){
    const item=normalizarEvidenciaRuta(evidence);
    if(!routeId||(!item.url&&!item.archivoId)){toast('Evidencia no disponible','La fotografía no tiene una referencia válida.','error');return;}
    $('#modalEyebrow').textContent='EVIDENCIA DE RUTA';
    $('#modalTitle').textContent=positionLabel||`Fotografía de ruta ${routeId}`;
    $('#modalBody').innerHTML=contenidoCargaModal('Solicitando acceso a la fotografía…');
    openModal();
    try{
      const result=await cargarImagenEvidenciaRuta(routeId,item),url=result?.dataUrl||result?.url||item.url;
      if(!url)throw new Error('EVIDENCIA_RUTA_NO_DISPONIBLE');
      const fecha=item.fecha||item.FECHA||item.creadoEn||'';
      $('#modalBody').innerHTML=`<div class="route-evidence-viewer"><div class="route-evidence-stage"><img src="${esc(url)}" alt="${esc(positionLabel||'Evidencia fotográfica de ruta')}"></div><div class="route-evidence-meta"><div><b>${esc(positionLabel||'Evidencia fotográfica')}</b><span>${fecha?`Registrada ${esc(fmtDate(fecha,true))}`:'Archivo privado autorizado'}</span></div><small>Ruta ${esc(routeId)}</small></div><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cerrar</button><a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener">Abrir imagen</a></div></div>`;
      $('[data-cancel-modal]',$('#modalBody')).onclick=closeModal;
    }catch(error){
      $('#modalBody').innerHTML=`<div class="modal-error"><b>No se pudo visualizar la fotografía</b><p>${esc(translateError(error))}</p><button class="btn soft" type="button" data-cancel-modal>Cerrar</button></div>`;
      $('[data-cancel-modal]',$('#modalBody')).onclick=closeModal;
    }
  }

  function enlazarVisoresRuta(root=document){
    const scope=root||document;
    $$('[data-route-image-route-id]',scope).forEach(button=>{
      if(button.dataset.routeViewerBound==='1')return;
      button.dataset.routeViewerBound='1';
      button.addEventListener('click',()=>{
        const routeId=String(button.dataset.routeImageRouteId||'').trim();
        const evidence={archivoId:button.dataset.routeImageFileId||'',url:button.dataset.routeImageUrl||''};
        abrirVisorImagenRuta(routeId,evidence,button.dataset.routeImageLabel||'Fotografía de ruta');
      });
    });
  }

  async function abrirGaleriaRuta(routeId){
    const route=registroFormulario('routes',routeId)||(cacheListasFormulario.get('routes')||[]).find(row=>String(row.ID)===String(routeId));
    if(!route){toast('Ruta no disponible','Sincronice las rutas e intente nuevamente.','error');return;}
    const items=evidenciasRuta(route);
    if(!items.length){toast('Sin fotografías','Esta ruta todavía no tiene evidencias fotográficas.','warning');return;}
    $('#modalEyebrow').textContent='GALERÍA DE RUTA';
    $('#modalTitle').textContent=route.NOMBRE||`Ruta ${route.ID}`;
    $('#modalBody').innerHTML=`<div class="route-evidence-gallery"><div class="route-evidence-gallery-head"><div><b>${items.length} fotografía(s)</b><span>Seleccione una imagen para verla en tamaño completo.</span></div><button class="btn soft small" type="button" data-cancel-modal>Cerrar</button></div><div class="route-evidence-grid">${items.map((item,index)=>`<article class="route-evidence-card loading" data-route-gallery-item="${index}"><div class="route-evidence-skeleton"></div><span>Cargando fotografía ${index+1}…</span></article>`).join('')}</div></div>`;
    openModal();
    const body=$('#modalBody');
    $('[data-cancel-modal]',body).onclick=closeModal;
    await Promise.allSettled(items.map(async(item,index)=>{
      const node=$(`[data-route-gallery-item="${index}"]`,body);
      if(!node)return;
      try{
        const result=await cargarImagenEvidenciaRuta(route.ID,item),url=result?.dataUrl||result?.url||item.url;
        if(!url)throw new Error('EVIDENCIA_RUTA_NO_DISPONIBLE');
        const normalized=normalizarEvidenciaRuta(item),label=`Fotografía ${index+1} de ${items.length}`;
        node.className='route-evidence-card';
        node.innerHTML=`<button type="button" class="route-evidence-thumb" data-route-image-route-id="${esc(route.ID)}" data-route-image-file-id="${esc(normalized.archivoId||'')}" data-route-image-url="${esc(normalized.url||url)}" data-route-image-label="${esc(label)}"><img src="${esc(url)}" alt="${esc(label)}" loading="lazy"><span>Ver fotografía</span></button><small>${normalized.fecha?esc(fmtDate(normalized.fecha,true)):label}</small>`;
      }catch(error){
        node.className='route-evidence-card error';
        node.innerHTML=`<div class="route-evidence-unavailable"><i>!</i><b>No disponible</b><span>${esc(translateError(error))}</span></div>`;
      }
    }));
    enlazarVisoresRuta(body);
  }

  function enlazarGaleriasRuta(root=document){
    const scope=root||document;
    $$('[data-route-gallery-id]',scope).forEach(button=>{
      if(button.dataset.routeGalleryBound==='1')return;
      button.dataset.routeGalleryBound='1';
      button.addEventListener('click',()=>abrirGaleriaRuta(String(button.dataset.routeGalleryId||'').trim()));
    });
  }

  function notificationCard(item){
    const priority=String(item.PRIORIDAD||'Normal').toLowerCase();
    const etiquetaAceptacion=esAdministrador()?'Aceptar como Administrador':puedeAceptarAsignacionesAjenas()?'Aceptar como Operador autorizado':'Aceptar asignación';
    let accion='';
    if(esNotificacionCheckinListaRuta(item))accion=`<button class="btn primary small notification-direct-action" data-checkin-route-notification="${esc(item.ID)}" type="button">▤ Ver inspección</button>`;
    else if(item.LEIDA!=='SI')accion=esAvisoAsignacion(item)?`<button class="link-button assignment-accept-button" data-accept-assignment="${item.ID}" type="button">✓ ${etiquetaAceptacion}</button>`:`<button class="link-button" data-read-notification="${item.ID}" type="button">Marcar como leída</button>`;
    return `<article class="notification-card"><header><div><h4>${esc(item.TITULO)}</h4><p>${esc(item.MENSAJE)}</p></div><span class="priority ${esc(priority)}">${esc(item.PRIORIDAD||'Normal')}</span></header><div class="route-meta"><span>${fmtDate(item.FECHA_ENVIO||item.CREADO_EN,true)}</span><span>${esc(item.TIPO||'Información')}</span></div>${accion}</article>`;
  }
  function deviceCard(item){
    const activity=item.EN_LINEA?(item.ACTIVIDAD||'Conectado'):'Inactivo',sectionName=labels[item.SECCION_ACTUAL]||item.SECCION_ACTUAL||'Sin identificar';
    const sessionReference=String(item.SESION_CLIENTE_ID||item.SESION_ID||item.DISPOSITIVO_ID||'').slice(-10);
    return `<article class="device-card ${item.EN_LINEA?'online':'offline'} ${activity==='Conduciendo'?'driving':''}"><i class="device-dot"></i><div><div class="device-title"><b>${esc(item.USUARIO_NOMBRE||'Usuario')}</b>${status(activity)}</div><span><strong>Conductor:</strong> ${esc(item.CONDUCTOR_NOMBRE||'No asociado')}</span><div class="session-facts"><span><b>Sección</b>${esc(sectionName)}</span><span><b>Vehículo</b>${esc(item.VEHICULO_PATENTE||item.VEHICULO_ID||'Sin asignar')}</span><span><b>Operación</b>${esc(item.OPERACION_ID||'Sin operación')}</span><span><b>Ruta</b>${esc(item.RUTA_ID||'Sin ruta')}</span><span><b>GPS</b>${gpsConexionActivo(item)?'Activo':'Inactivo'}</span><span><b>Visibilidad</b>${item.PAGINA_VISIBLE==='NO'?'Segundo plano':'Visible'}</span></div><small>Sesión ${esc(sessionReference||'sin referencia')} · IP ${esc(item.IP_PUBLICA||'no disponible')} · ${esc(item.PLATAFORMA||'Dispositivo')} · Última señal: ${fmtDate(item.ULTIMA_CONEXION,true)}${item.BATERIA_PORCENTAJE!==''?` · Batería ${number(item.BATERIA_PORCENTAJE)}%`:''}</small></div></article>`;
  }
  function weeklyBars(series=[]){
    const max=Math.max(1,...series.map(item=>Number(item.TOTAL||0)));
    return `<div class="weekly-chart">${series.map(item=>`<div class="weekly-column"><b>${number(item.TOTAL)}</b><i style="height:${Math.max(8,Math.round(Number(item.TOTAL||0)/max*100))}%"></i><span>${esc(item.ETIQUETA||'')}</span></div>`).join('')}</div>`;
  }
  function stateDonut(states=[]){
    const colors=['#0e9f91','#2e6fe8','#e8a128','#d65454','#8b67cc','#718393'],total=states.reduce((sum,item)=>sum+Number(item.TOTAL||0),0);
    let current=0;const stops=states.map((item,index)=>{const start=current;current+=total?Number(item.TOTAL||0)/total*360:0;return `${colors[index%colors.length]} ${start.toFixed(1)}deg ${current.toFixed(1)}deg`;});
    const background=total?`conic-gradient(${stops.join(',')})`:'conic-gradient(#dfe8ec 0deg 360deg)';
    return `<div class="donut-layout"><div class="donut-chart" style="background:${background}"><span><b>${number(total)}</b><small>vehículos</small></span></div><div class="chart-legend">${states.map((item,index)=>`<div><i style="background:${colors[index%colors.length]}"></i><span>${esc(item.ESTADO)}</span><b>${number(item.TOTAL)}</b></div>`).join('')||'<p class="muted">Sin datos registrados.</p>'}</div></div>`;
  }
  function quickActions(){
    const actions=[];
    if(hasPermission('RUTAS','CREAR'))actions.push(['routes','➜','Asignar ruta']);
    if(hasPermission('CHECKIN','CREAR'))actions.push(['checkin','✓','Realizar check-in']);
    if(hasPermission('OPERACIONES','INICIAR'))actions.push(['operations','⇄','Iniciar operación']);
    if(hasPermission('NOTIFICACIONES','ENVIAR'))actions.push(['notifications','🔔','Enviar aviso']);
    if(hasPermission('VEHICULOS','CREAR'))actions.push(['vehicles','▣','Registrar vehículo']);
    if(hasPermission('COMBUSTIBLE','REGISTRAR'))actions.push(['fuel','⛽','Registrar combustible']);
    return `<div class="quick-actions">${actions.map(([section,icon,label])=>`<button data-nav="${section}"><i>${icon}</i><span>${label}</span></button>`).join('')||'<p class="muted">No hay acciones rápidas habilitadas para este rol.</p>'}</div>`;
  }
  function numeroDireccionSolicitado(query){const principal=String(query||'').split(',')[0].trim(),coincidencias=[...principal.matchAll(/\b\d+[a-zA-Z]?(?:[-/]\d+[a-zA-Z]?)?\b/g)];return coincidencias.length?coincidencias[coincidencias.length-1][0]:'';}
  function normalizarConsultaDireccion(query){
    const partes=String(query||'').split(',').map(parte=>parte.trim()).filter(Boolean),principal=partes.shift()||'',final=principal.match(/^(.+?\D)\s+(\d+[a-zA-Z]?(?:[-/]\d+[a-zA-Z]?)?)$/);
    const calle=final?`${final[2]} ${final[1].trim()}`:principal;
    const completa=[calle,...partes].join(', ');
    return /\bchile\b/i.test(completa)?completa:`${completa}, Chile`;
  }
  function ordenarDireccionesPrecisas(result,query){
    const solicitado=numeroDireccionSolicitado(query),canon=valor=>String(valor||'').toUpperCase().replace(/[^0-9A-Z]/g,'');
    return (Array.isArray(result)?result:[]).map(item=>{const numero=item?.address?.house_number||'',exacto=!solicitado||canon(numero)===canon(solicitado);return{...item,_numero_solicitado:solicitado,_numero_exacto:exacto,_numero_encontrado:numero};}).sort((a,b)=>Number(b._numero_exacto)-Number(a._numero_exacto)||Number(b.importance||0)-Number(a.importance||0));
  }
  function searchAddresses(query){
    const normalized=String(query||'').trim().toLowerCase(),cached=addressSearchCache.get(normalized);
    if(cached)return Promise.resolve(cached);
    const task=addressSearchQueue.catch(()=>{}).then(async()=>{
      const wait=Math.max(0,1000-(Date.now()-lastAddressSearchAt));if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
      lastAddressSearchAt=Date.now();
      const url=new URL(config.DIRECCION_BUSQUEDA_DIRECCIONES);url.searchParams.set('format','jsonv2');url.searchParams.set('q',normalizarConsultaDireccion(query));url.searchParams.set('limit','10');url.searchParams.set('addressdetails','1');url.searchParams.set('namedetails','1');url.searchParams.set('extratags','1');url.searchParams.set('dedupe','1');url.searchParams.set('accept-language','es');
      if(config.PAIS_BUSQUEDA_DIRECCIONES)url.searchParams.set('countrycodes',config.PAIS_BUSQUEDA_DIRECCIONES);
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
      try{const response=await fetch(url,{headers:{Accept:'application/json'},signal:controller.signal});if(!response.ok)throw new Error('BUSQUEDA_DIRECCION_NO_DISPONIBLE');const result=ordenarDireccionesPrecisas(await response.json(),query);addressSearchCache.set(normalized,result);if(addressSearchCache.size>80)addressSearchCache.delete(addressSearchCache.keys().next().value);return result;}
      finally{clearTimeout(timer);}
    });
    addressSearchQueue=task;return task;
  }
  function enlazarCalendarios(root=document){
    $$('input[type="date"]',root).forEach(input=>{
      if(input.dataset.calendarBound==='1')return;
      input.dataset.calendarBound='1';
      input.setAttribute('autocomplete','off');
      const abrir=()=>{
        if(input.disabled||input.readOnly)return;
        try{if(typeof input.showPicker==='function')input.showPicker();}catch(_){}
      };
      input.addEventListener('click',abrir);
      input.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();abrir();}});
    });
  }

  function bindAddressAutocomplete(root=document){
    $$('[data-address-autocomplete]',root).forEach(input=>{
      if(input.dataset.addressBound==='1')return;input.dataset.addressBound='1';input.setAttribute('autocomplete','off');input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');
      const suggestions=document.createElement('div');suggestions.className='address-suggestions';suggestions.setAttribute('role','listbox');suggestions.hidden=true;input.insertAdjacentElement('afterend',suggestions);
      let timer=null,sequence=0,activeIndex=-1,items=[];
      const close=()=>{suggestions.hidden=true;suggestions.innerHTML='';items=[];activeIndex=-1;input.setAttribute('aria-expanded','false');};
      const select=item=>{input.value=item.display_name||'';const form=input.closest('form')||root;const latName=input.dataset.latTarget,lngName=input.dataset.lngTarget;if(latName&&form.querySelector(`[name="${latName}"]`))form.querySelector(`[name="${latName}"]`).value=item.lat||'';if(lngName&&form.querySelector(`[name="${lngName}"]`))form.querySelector(`[name="${lngName}"]`).value=item.lon||'';input.dataset.numeroVerificado=item._numero_exacto?'SI':'NO';input.dispatchEvent(new Event('direccion:seleccionada',{bubbles:true}));close();};
      const render=result=>{items=result||[];if(!items.length){suggestions.innerHTML='<p>No se encontraron coincidencias. Escriba calle, número y comuna.</p>';suggestions.hidden=false;return;}const conNumero=items.some(item=>item._numero_solicitado),hayExacta=items.some(item=>item._numero_solicitado&&item._numero_exacto);suggestions.innerHTML=(conNumero&&!hayExacta?'<p class="address-precision-warning">No se encontró ese número exacto; revise las alternativas antes de guardar.</p>':'')+items.map((item,index)=>`<button type="button" role="option" data-address-index="${index}"><i>${item._numero_solicitado?(item._numero_exacto?'✓':'⌖'):'⌖'}</i><span><b>${esc(item.display_name||'Dirección')}</b><small>${item._numero_solicitado?(item._numero_exacto?`Número ${esc(item._numero_encontrado)} verificado`:'Número exacto no verificado'):esc(item.type||item.category||'Lugar')}</small></span></button>`).join('');suggestions.hidden=false;input.setAttribute('aria-expanded','true');$$('[data-address-index]',suggestions).forEach(button=>button.addEventListener('mousedown',event=>{event.preventDefault();select(items[Number(button.dataset.addressIndex)]);}));};
      input.addEventListener('input',()=>{
        const form=input.closest('form')||root;[input.dataset.latTarget,input.dataset.lngTarget].filter(Boolean).forEach(name=>{const field=form.querySelector(`[name="${name}"]`);if(field)field.value='';});
        clearTimeout(timer);const query=input.value.trim();sequence+=1;const ownSequence=sequence;if(query.length<(config.MINIMO_CARACTERES_DIRECCION||3))return close();
        timer=setTimeout(async()=>{suggestions.innerHTML='<p>Buscando direcciones…</p>';suggestions.hidden=false;try{const result=await searchAddresses(query);if(ownSequence===sequence)render(result);}catch(_){if(ownSequence===sequence){suggestions.innerHTML='<p>No fue posible consultar direcciones. Puede continuar escribiéndola manualmente.</p>';suggestions.hidden=false;}}},config.ESPERA_BUSQUEDA_DIRECCION_MILISEGUNDOS||450);
      });
      input.addEventListener('keydown',event=>{const buttons=$$('button',suggestions);if(!buttons.length)return;if(event.key==='ArrowDown'){event.preventDefault();activeIndex=(activeIndex+1)%buttons.length;}else if(event.key==='ArrowUp'){event.preventDefault();activeIndex=(activeIndex-1+buttons.length)%buttons.length;}else if(event.key==='Enter'&&activeIndex>=0){event.preventDefault();select(items[activeIndex]);return;}else if(event.key==='Escape')return close();else return;buttons.forEach((button,index)=>button.classList.toggle('active',index===activeIndex));buttons[activeIndex]?.scrollIntoView({block:'nearest'});});
      input.addEventListener('blur',()=>setTimeout(close,180));
    });
  }

  function normalizeImportHeader(value){return String(value||'').replace(/^\uFEFF/,'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');}
  function excelSerialToIso(value){const serial=Number(value);if(!Number.isFinite(serial))return value;const millis=Math.round((serial-25569)*86400000);const date=new Date(millis);return Number.isNaN(date.getTime())?value:date.toISOString().slice(0,10);}
  function detectCsvDelimiter(text){const first=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).find(line=>line.trim())||'';const count=delimiter=>{let quoted=false,total=0;for(let i=0;i<first.length;i++){if(first[i]==='"'){if(quoted&&first[i+1]==='"')i++;else quoted=!quoted;}else if(first[i]===delimiter&&!quoted)total++;}return total;};return [[';',count(';')],['\t',count('\t')],[',',count(',')]].sort((a,b)=>b[1]-a[1])[0][0];}
  function parseCsvText(text){const delimiter=detectCsvDelimiter(text),rows=[];let row=[],cell='',quoted=false;const source=String(text||'').replace(/^\uFEFF/,'');for(let i=0;i<source.length;i++){const ch=source[i],next=source[i+1];if(ch==='"'){if(quoted&&next==='"'){cell+='"';i++;}else quoted=!quoted;}else if(ch===delimiter&&!quoted){row.push(cell);cell='';}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(cell);if(row.some(value=>String(value).trim()!==''))rows.push(row);row=[];cell='';}else cell+=ch;}if(quoted)throw new Error('CSV_IMPORTACION_MALFORMADO');row.push(cell);if(row.some(value=>String(value).trim()!==''))rows.push(row);return rows;}
  function xmlText(node){return node?.textContent??'';}
  function xmlElements(node,localName){
    if(!node)return[];
    if(typeof node.getElementsByTagNameNS==='function'){
      const namespaced=[...node.getElementsByTagNameNS('*',localName)];
      if(namespaced.length)return namespaced;
    }
    if(typeof node.getElementsByTagName==='function'){
      const direct=[...node.getElementsByTagName(localName)];
      if(direct.length)return direct;
      const prefixed=[...node.getElementsByTagName(`x:${localName}`)];
      if(prefixed.length)return prefixed;
    }
    return[];
  }
  function xmlFirst(node,localName){return xmlElements(node,localName)[0]||null;}
  async function parseXlsxFile(file,maxRows=1500){
    if(typeof JSZip==='undefined')throw new Error('LECTOR_XLSX_NO_DISPONIBLE');
    let zip;try{zip=await JSZip.loadAsync(await file.arrayBuffer());}catch(_){throw new Error('FORMATO_IMPORTACION_INVALIDO');}
    const shared=[],sharedFile=zip.file('xl/sharedStrings.xml');
    if(sharedFile){const xml=new DOMParser().parseFromString(await sharedFile.async('string'),'application/xml');xmlElements(xml,'si').forEach(item=>shared.push(xmlElements(item,'t').map(xmlText).join('')));}
    const dateStyles=new Set(),stylesFile=zip.file('xl/styles.xml');
    if(stylesFile){const xml=new DOMParser().parseFromString(await stylesFile.async('string'),'application/xml'),custom={};xmlElements(xml,'numFmt').forEach(node=>custom[node.getAttribute('numFmtId')]=node.getAttribute('formatCode')||'');const cellXfs=xmlFirst(xml,'cellXfs');if(cellXfs)xmlElements(cellXfs,'xf').forEach((node,index)=>{const id=Number(node.getAttribute('numFmtId')||0),fmt=custom[id]||'';if([14,15,16,17,18,19,20,21,22,45,46,47].includes(id)||/[dmy]/i.test(fmt.replace(/\[[^\]]*\]|"[^"]*"/g,'')))dateStyles.add(index);});}
    const workbookFile=zip.file('xl/workbook.xml'),relsFile=zip.file('xl/_rels/workbook.xml.rels');let sheetPath='xl/worksheets/sheet1.xml',date1904=false;
    if(workbookFile&&relsFile){const workbookXml=new DOMParser().parseFromString(await workbookFile.async('string'),'application/xml'),properties=xmlFirst(workbookXml,'workbookPr');date1904=String(properties?.getAttribute('date1904')||'').toLowerCase()==='true'||properties?.getAttribute('date1904')==='1';const sheets=xmlElements(workbookXml,'sheet'),selected=sheets.find(node=>normalizeImportHeader(node.getAttribute('name'))==='DATOS')||sheets[0],relId=selected?.getAttribute('r:id')||selected?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id'),relsXml=new DOMParser().parseFromString(await relsFile.async('string'),'application/xml'),rel=xmlElements(relsXml,'Relationship').find(node=>node.getAttribute('Id')===relId),target=rel?.getAttribute('Target');if(target)sheetPath='xl/'+target.replace(/^\//,'').replace(/^xl\//,'').replace(/^\.\.\//,'');}
    const sheetFile=zip.file(sheetPath)||zip.file('xl/worksheets/sheet1.xml');if(!sheetFile)throw new Error('PLANILLA_SIN_HOJA_DATOS');
    const xml=new DOMParser().parseFromString(await sheetFile.async('string'),'application/xml');if(xmlElements(xml,'parsererror').length)throw new Error('FORMATO_IMPORTACION_INVALIDO');const matrix=[];
    xmlElements(xml,'row').forEach(rowNode=>{const rowIndex=Math.max(0,Number(rowNode.getAttribute('r')||matrix.length+1)-1);if(rowIndex>maxRows+100)throw new Error('IMPORTACION_DEMASIADAS_FILAS');const row=matrix[rowIndex]||(matrix[rowIndex]=[]);xmlElements(rowNode,'c').forEach(cellNode=>{const ref=cellNode.getAttribute('r')||'',letters=(ref.match(/[A-Z]+/i)||['A'])[0].toUpperCase();let col=0;for(const letter of letters)col=col*26+letter.charCodeAt(0)-64;col-=1;const type=cellNode.getAttribute('t')||'',style=Number(cellNode.getAttribute('s')||-1),valueNode=xmlFirst(cellNode,'v'),inlineNode=xmlFirst(cellNode,'is');let value=type==='inlineStr'?xmlElements(inlineNode,'t').map(xmlText).join(''):xmlText(valueNode);if(type==='s')value=shared[Number(value)]??'';else if(type==='b')value=value==='1'?'SI':'NO';else if(value!==''&&dateStyles.has(style))value=excelSerialToIso(Number(value)+(date1904?1462:0));row[col]=value;});});return matrix;
  }
  async function readImportFile(file,definition){if(!file)throw new Error('IMPORTACION_SIN_ARCHIVO');if(Number(file.size||0)>Number(definition?.maxFileBytes||12582912))throw new Error('ARCHIVO_IMPORTACION_DEMASIADO_GRANDE');const extension=String(file.name||'').split('.').pop().toLowerCase();let matrix;if(extension==='csv'||extension==='txt')matrix=parseCsvText(await file.text());else if(extension==='xlsx')matrix=await parseXlsxFile(file,definition?.maxRows||1500);else throw new Error('FORMATO_IMPORTACION_INVALIDO');matrix=matrix.filter(row=>Array.isArray(row)&&row.some(value=>String(value??'').trim()!==''));if(matrix.length<2)throw new Error('IMPORTACION_SIN_FILAS');const headers=(matrix.shift()||[]).map(normalizeImportHeader),duplicates=headers.filter((header,index)=>header&&headers.indexOf(header)!==index);if(!headers.some(Boolean))throw new Error('COLUMNAS_IMPORTACION_NO_RECONOCIDAS');if(duplicates.length)throw new Error(`COLUMNAS_DUPLICADAS: ${[...new Set(duplicates)].join(', ')}`);const rows=matrix.map((row,index)=>({...Object.fromEntries(headers.map((header,column)=>[header,row[column]??'']).filter(([header])=>header)),__FILA_ORIGEN:index+2}));return{headers:[...new Set(headers.filter(Boolean))],rows};}
  function cleanImportText(value,max=300){return String(value??'').trim().replace(/\s+/g,' ').slice(0,max);}
  function importDate(value){const raw=cleanImportText(value,40);if(!raw)return'';const match=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);if(!match)return'';const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]),date=new Date(Date.UTC(year,month-1,day));return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?`${match[1]}-${match[2]}-${match[3]}`:'';}
  function importNumber(value){if(value===''||value==null)return null;const normalized=String(value).trim().replace(/\s/g,'').replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.');const numberValue=Number(normalized);return Number.isFinite(numberValue)?numberValue:null;}
  function canonicalImport(value,allowed){const raw=cleanImportText(value,80),key=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();return allowed.find(item=>item.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()===key)||'';}
  function importRutKey(value){return String(value||'').toUpperCase().replace(/[^0-9K]/g,'');}
  function formatImportRut(value){const key=importRutKey(value);if(key.length<2)return'';const body=key.slice(0,-1),dv=key.slice(-1);return `${Number(body).toLocaleString('es-CL')}-${dv}`;}
  function validImportRut(value){const key=importRutKey(value);if(!/^\d{6,8}[0-9K]$/.test(key))return false;let sum=0,multiplier=2;for(let i=key.length-2;i>=0;i--){sum+=Number(key[i])*multiplier;multiplier=multiplier===7?2:multiplier+1;}const result=11-(sum%11),expected=result===11?'0':result===10?'K':String(result);return expected===key.slice(-1);}
  function importKey(resource,row){return resource==='vehicles'?cleanImportText(row.PATENTE,30).toUpperCase().replace(/[^A-Z0-9]/g,''):resource==='drivers'?importRutKey(row.RUT):[row.TIPO,row.ASOCIADO_TIPO,row.IDENTIFICACION,row.FECHA_VENCIMIENTO].map(value=>cleanImportText(value,200).toUpperCase()).join('|');}
  function validateImportRows(resource,fileData){
    const definition=bulkImportDefinitions[resource],headers=fileData.headers||[],rawRows=fileData.rows||[],errors=[],validRows=[],seen=new Set();
    const missingHeaders=definition.required.filter(field=>!headers.includes(field));if(missingHeaders.length)throw new Error(`COLUMNAS_REQUERIDAS: ${missingHeaders.join(', ')}`);if(rawRows.length>definition.maxRows)throw new Error('IMPORTACION_DEMASIADAS_FILAS');
    const vehicleStates=['Disponible','En mantención','Fuera de servicio','Inactivo'],fuels=['Diésel','Gasolina','Eléctrico','Híbrido','GLP','Otro'],driverStates=['Disponible','Licencia vencida','Inactivo','Suspendido'],licenses=['A1','A2','A3','A4','A5','B','C','D','E','F'];
    rawRows.forEach((raw,index)=>{const row={...raw},line=Number(raw.__FILA_ORIGEN||index+2),rowErrors=[];definition.headers.forEach(field=>{if(field in row&&typeof row[field]==='string')row[field]=row[field].trim();});definition.required.forEach(field=>{if(cleanImportText(row[field],500)==='')rowErrors.push(`CAMPO_REQUERIDO_${field}`);});
      if(resource==='vehicles'){
        row.PATENTE=cleanImportText(row.PATENTE,30).toUpperCase().replace(/[^A-Z0-9]/g,'');row.MARCA=cleanImportText(row.MARCA,100);row.MODELO=cleanImportText(row.MODELO,100);row.COLOR=cleanImportText(row.COLOR,60);row.VIN=cleanImportText(row.VIN,50).toUpperCase();
        if(row.PATENTE&&!/^[A-Z0-9]{4,15}$/.test(row.PATENTE))rowErrors.push('PATENTE_INVALIDA');
        if(row.ANIO!==''&&row.ANIO!=null){const year=importNumber(row.ANIO);if(year===null||!Number.isInteger(year)||year<1950||year>new Date().getFullYear()+2)rowErrors.push('ANIO_VEHICULO_INVALIDO');else row.ANIO=year;}else row.ANIO='';
        if(row.KILOMETRAJE!==''&&row.KILOMETRAJE!=null){const km=importNumber(row.KILOMETRAJE);if(km===null||km<0)rowErrors.push('KILOMETRAJE_VEHICULO_INVALIDO');else row.KILOMETRAJE=km;}else row.KILOMETRAJE='';
        if(row.COMBUSTIBLE){const value=canonicalImport(row.COMBUSTIBLE,fuels);if(!value)rowErrors.push('COMBUSTIBLE_INVALIDO');else row.COMBUSTIBLE=value;}else row.COMBUSTIBLE='';
        if(row.ESTADO){const value=canonicalImport(row.ESTADO,vehicleStates);if(!value)rowErrors.push('ESTADO_VEHICULO_INVALIDO');else row.ESTADO=value;}else row.ESTADO='';
        if(row.PROXIMA_MANTENCION){const date=importDate(row.PROXIMA_MANTENCION);if(!date)rowErrors.push('FECHA_MANTENCION_INVALIDA');else row.PROXIMA_MANTENCION=date;}
        row.QR_CODIGO=cleanImportText(row.QR_CODIGO,100);
      }else if(resource==='drivers'){
        row.NOMBRE=cleanImportText(row.NOMBRE,160);row.RUT=formatImportRut(row.RUT);row.TELEFONO=cleanImportText(row.TELEFONO,50);row.CORREO=cleanImportText(row.CORREO,200).toLowerCase();row.USUARIO_ID=cleanImportText(row.USUARIO_ID,100);
        if(raw.RUT&&!validImportRut(raw.RUT))rowErrors.push('RUT_INVALIDO');
        if(row.CORREO&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.CORREO))rowErrors.push('CORREO_INVALIDO');
        if(row.LICENCIA_CLASE){const value=canonicalImport(row.LICENCIA_CLASE,licenses);if(!value)rowErrors.push('LICENCIA_CLASE_INVALIDA');else row.LICENCIA_CLASE=value;}
        if(row.LICENCIA_VENCIMIENTO){const date=importDate(row.LICENCIA_VENCIMIENTO);if(!date)rowErrors.push('LICENCIA_VENCIMIENTO_INVALIDA');else row.LICENCIA_VENCIMIENTO=date;}
        if(row.ESTADO){const value=canonicalImport(row.ESTADO,driverStates);if(!value)rowErrors.push('ESTADO_CONDUCTOR_INVALIDO');else row.ESTADO=value;}else row.ESTADO='';
      }
      const key=importKey(resource,row);if(key){if(seen.has(key))rowErrors.push('DUPLICADA_EN_ARCHIVO');else seen.add(key);}if(rowErrors.length)errors.push(...rowErrors.map(error=>({fila:line,error})));else validRows.push({...row,__FILA_ORIGEN:line});
    });
    return{rows:validRows,errors,total:rawRows.length,headers,ignoredHeaders:headers.filter(header=>!definition.headers.includes(header))};
  }
  function importPreviewTable(validation,definition){const rows=validation.rows||[],headers=definition.headers.filter(header=>rows.some(row=>String(row[header]??'').trim()!=='')),visible=headers.slice(0,8),body=rows.slice(0,8).map(row=>`<tr><td>${number(row.__FILA_ORIGEN)}</td>${visible.map(header=>`<td>${esc(row[header]??'')}</td>`).join('')}<td><span class="import-row-ok">Válida</span></td></tr>`).join('');const errorPreview=(validation.errors||[]).slice(0,12).map(item=>`<div><b>Fila ${number(item.fila)}</b><span>${esc(translateError({message:item.error}))}</span></div>`).join('');return `<div class="import-preview"><div class="import-preview-summary"><b>${number(rows.length)} filas válidas de ${number(validation.total)}</b><span>Vista previa de las primeras ${Math.min(8,rows.length)} filas</span></div>${rows.length?table(['Fila',...visible,'Validación'],body):''}${validation.errors.length?`<article class="import-errors import-pre-errors"><h4>${number(validation.errors.length)} observaciones antes de importar</h4>${errorPreview}${validation.errors.length>12?`<p>Se muestran 12 de ${number(validation.errors.length)} observaciones.</p>`:''}</article>`:''}${validation.ignoredHeaders.length?`<p class="import-ignored-columns">Columnas no utilizadas: ${esc(validation.ignoredHeaders.join(', '))}</p>`:''}</div>`;}
  function importResultMarkup(result){const errors=result.errores||[],created=Number(result.creadas??result.creados??0),updated=Number(result.actualizadas??result.actualizados??0),skipped=Number(result.omitidas??result.omitidos??0);return `<div class="import-result"><div class="kpi-grid compact">${metric('＋','Creados',created,'Nuevos registros')}${metric('↻','Actualizados',updated,'Coincidencias encontradas')}${metric('—','Omitidos',skipped,'Sin cambios')}${metric('!','Errores',errors.length,'Filas que requieren revisión')}</div>${errors.length?`<article class="import-errors"><h4>Filas con observaciones</h4>${errors.slice(0,60).map(item=>`<div><b>Fila ${number(item.fila)}</b><span>${esc(translateError({message:item.error}))}</span></div>`).join('')}${errors.length>60?`<p>Se muestran 60 de ${number(errors.length)} errores.</p>`:''}</article><button class="btn soft" type="button" data-download-import-errors>⇩ Descargar errores CSV</button>`:'<div class="tracking-notice active"><i>✓</i><div><b>Importación completada sin errores</b><span>Los registros quedaron disponibles en el sistema.</span></div></div>'}<div class="form-actions"><button class="btn primary" type="button" data-cancel-modal>Cerrar</button></div></div>`;}
  function downloadImportErrors(errors,title='importacion'){if(!errors?.length)return;const csv=['FILA;ERROR',...errors.map(item=>`${Number(item.fila)||''};"${String(translateError({message:item.error})||'').replaceAll('"','""')}"`)].join('\r\n');const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`Errores_${String(title).replace(/\s+/g,'_')}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
  function openBulkImportModal(resource){
    const definition=bulkImportDefinitions[resource];if(!definition)return;$('#modalEyebrow').textContent='IMPORTACIÓN MASIVA';$('#modalTitle').textContent=`Importar ${definition.title.toLowerCase()}`;
    $('#modalBody').innerHTML=`<form id="bulkImportForm" class="bulk-import-form"><div class="import-steps"><div><i>1</i><span><b>Descargue la plantilla oficial</b><small>No cambie los encabezados.</small></span></div><div><i>2</i><span><b>Complete hasta ${number(definition.maxRows)} filas</b><small>Use la hoja DATOS de Excel o CSV.</small></span></div><div><i>3</i><span><b>Revise y confirme</b><small>Las filas inválidas no se enviarán.</small></span></div></div><div class="import-template-card"><div><b>Plantilla oficial de ${esc(definition.title)}</b><span>Incluye ejemplo, instrucciones y listas permitidas.</span></div><a class="btn soft" href="${esc(definition.template)}" download>⇩ Descargar plantilla</a></div><label class="file-drop" data-import-drop><input name="archivo" type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"><i>⇧</i><b>Seleccione o arrastre la planilla</b><span>XLSX o CSV · máximo ${number(definition.maxRows)} filas</span></label><label class="import-update-option"><input name="actualizarExistentes" type="checkbox" value="SI" checked><span><b>Actualizar registros existentes</b><small>${resource==='vehicles'?'La coincidencia se detecta por patente.':resource==='drivers'?'La coincidencia se detecta por RUT.':'Las coincidencias se detectan por la clave del registro.'}</small></span></label><div data-import-status class="import-status"><i>○</i><span>Seleccione un archivo para comenzar.</span></div><div data-import-preview></div><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn primary" type="submit" disabled>Importar registros</button></div></form>`;
    openModal();const form=$('#bulkImportForm'),fileInput=form.elements.archivo,submit=$('button[type="submit"]',form),statusNode=$('[data-import-status]',form),preview=$('[data-import-preview]',form),drop=$('[data-import-drop]',form);let selectedFile=null,validation={rows:[],errors:[],total:0,headers:[],ignoredHeaders:[]};$('[data-cancel-modal]',form).onclick=closeModal;
    const processFile=async file=>{selectedFile=file||null;validation={rows:[],errors:[],total:0,headers:[],ignoredHeaders:[]};submit.disabled=true;preview.innerHTML='';if(!selectedFile){statusNode.className='import-status';statusNode.innerHTML='<i>○</i><span>Seleccione un archivo para comenzar.</span>';return;}statusNode.className='import-status loading';statusNode.innerHTML=`<i></i><span>Leyendo y validando ${esc(selectedFile.name||'la planilla')}…</span>`;try{const fileData=await readImportFile(selectedFile,definition);validation=validateImportRows(resource,fileData);statusNode.className=validation.errors.length?'import-status warning':'import-status ready';statusNode.innerHTML=`<i>${validation.errors.length?'!':'✓'}</i><span>${esc(selectedFile.name||'Planilla')} · ${number(validation.rows.length)} filas válidas · ${number(validation.errors.length)} observaciones.</span>`;preview.innerHTML=importPreviewTable(validation,definition);submit.disabled=!validation.rows.length;submit.textContent=validation.rows.length?`Importar ${number(validation.rows.length)} registros válidos`:'Importar registros';}catch(error){statusNode.className='import-status error';statusNode.innerHTML=`<i>!</i><span>${esc(translateError(error))}</span>`;}};
    fileInput.addEventListener('change',()=>processFile(fileInput.files?.[0]));['dragenter','dragover'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();drop.classList.add('dragover');}));['dragleave','drop'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();drop.classList.remove('dragover');}));drop.addEventListener('drop',event=>{const file=event.dataTransfer?.files?.[0];if(!file)return;try{const transfer=new DataTransfer();transfer.items.add(file);fileInput.files=transfer.files;}catch(_){}processFile(file);});
    form.addEventListener('submit',event=>{event.preventDefault();if(!validation.rows.length)return;conCargaBoton(submit,'Importando…',async()=>{try{const serverResult=await api.request('bulkImport',{resource,data:{filas:validation.rows,actualizarExistentes:form.elements.actualizarExistentes.checked?'SI':'NO',IP_PUBLICA:clientPublicIp}}),serverErrors=serverResult.errores||[],result={...serverResult,errores:[...validation.errors,...serverErrors],totalRecibidas:validation.total};invalidarListasFormulario(resource);cacheVistasModulo.delete(resource);$('#modalEyebrow').textContent='RESULTADO DE IMPORTACIÓN';$('#modalTitle').textContent=`${definition.title} procesados`;$('#modalBody').innerHTML=importResultMarkup(result);$('[data-cancel-modal]',$('#modalBody')).onclick=()=>{closeModal();actualizarSeccionEnSegundoPlano(resource);};$('[data-download-import-errors]',$('#modalBody'))?.addEventListener('click',()=>downloadImportErrors(result.errores,definition.title));const created=Number(result.creadas??result.creados??0),updated=Number(result.actualizadas??result.actualizados??0);toast('Importación finalizada',`${number(created)} creados · ${number(updated)} actualizados · ${number(result.errores.length)} observaciones`,result.errores.length?'warning':'success');}catch(error){toast('No se pudo importar',translateError(error),'error');}});});
  }

  function leerArchivoDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error('ARCHIVO_BASE64_INVALIDO'));reader.readAsDataURL(file);});}
  async function optimizarImagenArchivo(file){
    if(!file?.type?.startsWith('image/')||file.size<=850000)return file;
    let bitmap;
    try{bitmap=await createImageBitmap(file);}catch(_){return file;}
    const max=1280,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d',{alpha:false});context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.72));
    if(!blob||blob.size>=file.size)return file;
    const base=String(file.name||'foto').replace(/\.[^.]+$/,'');return new File([blob],`${base}.jpg`,{type:'image/jpeg',lastModified:Date.now()});
  }
  function markupCargaArchivo({campo,url='',combustible=false,record={}}){
    const accept=combustible?'image/*':'image/*,application/pdf,.pdf',capture=combustible?' capture="environment"':'';
    const name=record.NOMBRE_ARCHIVO||'',mime=record.TIPO_MIME||'',bucket=record.ARCHIVO_BUCKET||'',path=record.ARCHIVO_RUTA||'',size=record.TAMANO_BYTES||'';
    const linked=Boolean(url||bucket&&path),legacy=/drive\.google\.com/i.test(String(url||''));
    const estado=linked
      ? `<div class="drive-upload-status ${legacy?'warning':'ready'}" data-drive-upload-status><i>${legacy?'!':'✓'}</i><span>${legacy?'Archivo legado no migrado: edite el registro y vuelva a cargar el adjunto una sola vez para dejarlo disponible en todos los dispositivos.':`Archivo privado disponible${name?` · ${esc(name)}`:''}`}</span></div>`
      : `<div class="drive-upload-status" data-drive-upload-status><i>○</i><span>Sin archivo adjunto.</span></div>`;
    return `<div class="drive-fast-upload secure-storage-upload" data-drive-upload="${combustible?'fuel':'documents'}"><label class="drive-file-picker"><input type="file" data-drive-file accept="${accept}"${capture}><i>⇧</i><span><b>${combustible?'Tomar foto o elegir comprobante':'Elegir foto o PDF'}</b><small>Se almacena de forma privada en la Base de Datos y solo se muestra a usuarios autorizados.</small></span></label>${estado}<input name="${campo}" type="hidden" value="${esc(url)}" data-drive-url><input name="ARCHIVO_BUCKET" type="hidden" value="${esc(bucket)}" data-file-bucket><input name="ARCHIVO_RUTA" type="hidden" value="${esc(path)}" data-file-path><input name="NOMBRE_ARCHIVO" type="hidden" value="${esc(name)}" data-file-name><input name="TIPO_MIME" type="hidden" value="${esc(mime)}" data-file-mime><input name="TAMANO_BYTES" type="hidden" value="${esc(size)}" data-file-size></div>`;
  }
  function contextoArchivoFormulario(form,tipo){
    if(tipo==='fuel')return [form.elements.NUMERO_DOCUMENTO?.value,form.elements.VEHICULO_ID?.value].filter(Boolean).join(' - ')||'Boleta combustible';
    return [form.elements.TIPO?.value,form.elements.IDENTIFICACION?.value].filter(Boolean).join(' - ')||'Documento';
  }
  function enlazarCargaArchivo(form,tipo){
    const box=$('[data-drive-upload]',form),input=$('[data-drive-file]',box),statusNode=$('[data-drive-upload-status]',box),urlInput=$('[data-drive-url]',box);if(!input||!urlInput)return;
    const field=selector=>$(selector,box);
    input.addEventListener('change',()=>{
      const original=input.files?.[0];if(!original)return;const uploadSequence=Number(input.dataset.uploadSequence||0)+1;input.dataset.uploadSequence=String(uploadSequence);
      const isPdf=original.type==='application/pdf'||/\.pdf$/i.test(original.name||'');
      if(tipo==='fuel'&&isPdf){input.value='';statusNode.className='drive-upload-status error';statusNode.innerHTML='<i>!</i><span>Para el comprobante seleccione o tome una foto.</span>';return;}
      if(original.size>12582912){input.value='';statusNode.className='drive-upload-status error';statusNode.innerHTML='<i>!</i><span>El archivo supera 12 MB.</span>';return;}
      const promise=(async()=>{
        statusNode.className='drive-upload-status loading';statusNode.innerHTML='<i></i><span>Optimizando y guardando en almacenamiento privado…</span>';
        const file=await optimizarImagenArchivo(original),dataUrl=await leerArchivoDataUrl(file);
        const destino=tipo==='fuel'?'BOLETA_COMBUSTIBLE':(isPdf?'DOCUMENTO_PDF':'DOCUMENTO_FOTO');
        const result=await api.request('uploadDriveFile',{data:{DESTINO:destino,NOMBRE_ARCHIVO:file.name,TIPO_MIME:file.type||(isPdf?'application/pdf':'image/jpeg'),ARCHIVO_BASE64:dataUrl,CONTEXTO:contextoArchivoFormulario(form,tipo),IP_PUBLICA:clientPublicIp}});
        if(Number(input.dataset.uploadSequence)!==uploadSequence)return result;
        urlInput.value=result.url||result.direccionArchivo||'';field('[data-file-bucket]').value=result.bucket||'';field('[data-file-path]').value=result.path||'';field('[data-file-name]').value=result.nombre||file.name;field('[data-file-mime]').value=result.tipoMime||file.type||'';field('[data-file-size]').value=result.tamanoBytes||file.size||0;
        statusNode.className='drive-upload-status ready';statusNode.innerHTML=`<i>✓</i><span>Archivo privado cargado · ${esc(result.nombre||file.name)}</span>`;
        return result;
      })().catch(error=>{if(Number(input.dataset.uploadSequence)===uploadSequence){statusNode.className='drive-upload-status error';statusNode.innerHTML=`<i>!</i><span>${esc(translateError(error))}</span>`;}throw error;});
      form._driveUploadPromise=promise;
    });
  }
  async function esperarCargaArchivo(form){
    if(!form?._driveUploadPromise)return;
    await form._driveUploadPromise;
    form._driveUploadPromise=null;
  }

  async function renderResourcePage(resource,tag,title,description,rowRenderer,headers) {
    const result=await solicitarListaPaginada(resource); const rows=result.rows||[];
    guardarListaFormulario(resource,rows);
    const puedeCrear=resource==='documents'
      ?(currentUser.ROL_ID==='ROL-CONDUCTOR'?hasPermission('DOCUMENTOS','CARGAR_PROPIO'):hasPermission('DOCUMENTOS','CREAR'))
      :hasPermission(resourcePermission[resource],'CREAR');
    const createLabel=resource==='documents'?'＋ Cargar documentos':'＋ Nuevo registro';
    const createButton=puedeCrear?`<button class="btn primary" data-add="${resource}">${createLabel}</button>`:'';
    const accesoBloqueado=resource==='documents'&&currentUser.ROL_ID==='ROL-CONDUCTOR'&&!puedeCrear?`<div class="tracking-notice blocked document-upload-blocked"><i>🔒</i><div><b>Carga de documentos bloqueada</b><span>El Administrador retiró temporalmente el permiso para cargar documentos. Puede seguir consultando sus documentos asociados.</span></div></div>`:'';
    const importDefinition=bulkImportDefinitions[resource];
    const importPermission=resource==='vehicles'?'VEHICULOS:IMPORTAR':resource==='drivers'?'CONDUCTORES:IMPORTAR':resource==='documents'?'DOCUMENTOS:IMPORTAR':'';
    const importButtons=importDefinition&&importPermission&&hasPermission(...importPermission.split(':'))?`<a class="btn soft" href="${esc(importDefinition.template)}" download>⇩ Plantilla</a><button class="btn soft" data-bulk-import="${resource}">⇧ Importación masiva</button>`:'';
    const folderButtons='';
    const rowHtml=rows.map(row=>rowRenderer(row)).join('');
    return heading(tag,title,description,`<button class="btn soft" data-sync>↻ Actualizar</button>${folderButtons}${importButtons}${createButton}`)+accesoBloqueado+`<article class="card resource-card resource-${esc(resource)}"><div class="toolbar"><label class="search-box"><span>⌕</span><input data-table-search placeholder="Buscar en ${title.toLowerCase()}"></label>${puedeExportarFormato('csv')?`<button class="btn soft push" data-export="${resource}">Exportar CSV</button>`:''}</div><div data-filter-table class="resource-table resource-${esc(resource)}">${table(headers,rowHtml,`No hay ${title.toLowerCase()} registrados.`)}</div></article>`;
  }

  function vehicleRows(v){return `<tr data-filter-date="${esc(v.PROXIMA_MANTENCION||v.ACTUALIZADO_EN||v.CREADO_EN||'')}" data-search-row="${esc(`${v.PATENTE} ${v.MARCA} ${v.MODELO} ${v.ESTADO}`.toLowerCase())}"><td><div class="entity"><i class="entity-icon">🚐</i><div><strong>${esc(v.MARCA||'Sin marca')} ${esc(v.MODELO||'')}</strong><span class="muted">${esc(v.ID)}</span></div></div></td><td><strong>${esc(v.PATENTE)}</strong></td><td>${esc(v.ANIO||'—')}</td><td>${number(v.KILOMETRAJE)} km</td><td>${status(v.ESTADO)}</td><td><code class="vehicle-qr-code">${esc(codigoQrVehiculo(v))}</code></td><td>${accionesVehiculo(v)}</td></tr>`;}
  function driverRows(d){const whatsapp=d.TELEFONO?`<button class="btn whatsapp small" data-whatsapp-driver="${esc(d.ID)}" title="Enviar WhatsApp">◉ WhatsApp</button>`:'';const ocupacion=`<button class="btn soft small" type="button" data-driver-occupation="${esc(d.ID)}">◎ Ver ocupación</button>`;const documentos=`<button class="btn soft small" type="button" data-driver-documents="${esc(d.ID)}">▤ Documentos</button>`;return `<tr data-filter-date="${esc(d.LICENCIA_VENCIMIENTO||d.ACTUALIZADO_EN||d.CREADO_EN||'')}" data-search-row="${esc(`${d.NOMBRE} ${d.RUT} ${d.ESTADO} ${d.TELEFONO||''}`.toLowerCase())}"><td><div class="entity"><span class="avatar">${initials(d.NOMBRE)}</span><div><strong>${esc(d.NOMBRE)}</strong><span class="muted">${esc(d.TELEFONO||'Sin teléfono')}</span></div></div></td><td>${esc(d.RUT)}</td><td>${esc(d.LICENCIA_CLASE||'—')}</td><td>${fmtDate(d.LICENCIA_VENCIMIENTO)}</td><td>${status(d.ESTADO)}</td><td>${esc(d.USUARIO_ID||'Sin asociar')}</td><td><div class="row-button-stack">${ocupacion}${documentos}${whatsapp}${actions('drivers',d.ID)}</div></td></tr>`;}
  function maintenanceRows(m){return `<tr data-filter-date="${esc(m.FECHA_PROGRAMADA||m.FECHA_REALIZADA||m.CREADO_EN||'')}" data-search-row="${esc(`${m.TITULO} ${m.VEHICULO_ID} ${m.ESTADO}`.toLowerCase())}"><td><strong>${esc(m.TITULO)}</strong><span class="muted">${esc(m.DESCRIPCION||'')}</span></td><td>${esc(m.VEHICULO_ID)}</td><td>${esc(m.TIPO)}</td><td>${fmtDate(m.FECHA_PROGRAMADA)}</td><td>$${number(m.COSTO)}</td><td>${status(m.ESTADO)}</td><td>${actions('maintenance',m.ID)}</td></tr>`;}
  function documentReviewState(d){
    const raw=String(d.ESTADO_REVISION||'').trim();
    if(raw)return raw;
    if(String(d.ESTADO||'').toLowerCase()==='rechazado')return 'Rechazado';
    if(String(d.ESTADO||'').toLowerCase().includes('pendiente'))return 'Pendiente de revisión';
    return 'Aprobado';
  }
  function documentReviewBadge(d){
    const review=documentReviewState(d),approved=/^aprobado$/i.test(review),rejected=/^rechazado$/i.test(review);
    return `<span class="document-review-badge ${approved?'approved':rejected?'rejected':'pending'}"><i>${approved?'✓':rejected?'×':'○'}</i>${esc(review)}</span>`;
  }
  function documentRowActions(d){
    const buttons=[],review=documentReviewState(d),pending=!/^aprobado$/i.test(review)&&!/^rechazado$/i.test(review);
    if(puedeRevisarDocumentos()&&pending&&hasPermission('DOCUMENTOS','APROBAR'))buttons.push(`<button class="btn primary small" type="button" data-approve-document="${esc(d.ID)}">✓ Aprobar</button>`);
    if(puedeRevisarDocumentos()&&pending&&hasPermission('DOCUMENTOS','RECHAZAR'))buttons.push(`<button class="btn danger small" type="button" data-reject-document="${esc(d.ID)}">Rechazar</button>`);
    const generic=actions('documents',d.ID);if(generic!=='—')buttons.push(generic);
    return buttons.length?`<div class="row-button-stack document-review-actions">${buttons.join('')}</div>`:'—';
  }
  function documentRows(d){
    const asociado=d.CORREO_ASOCIADO||d.ASOCIADO_ID||'Sin asociación',hasFile=Boolean(d.ARCHIVO_BUCKET&&d.ARCHIVO_RUTA||d.DIRECCION_ARCHIVO),legacy=/drive\.google\.com/i.test(String(d.DIRECCION_ARCHIVO||''));
    const attachment=hasFile?`<button class="btn soft small document-view-button" type="button" data-view-document="${esc(d.ID)}" ${legacy?'title="Archivo legado: edite y vuelva a cargar el adjunto"':''}>${legacy?'! Migrar adjunto':'▧ Ver adjunto'}</button>`:'<span class="muted">Sin adjunto</span>';
    const review=documentReviewState(d);
    return `<tr data-filter-date="${esc(d.FECHA_VENCIMIENTO||d.FECHA_EMISION||d.CREADO_EN||'')}" data-search-row="${esc(`${d.TIPO} ${d.IDENTIFICACION} ${d.ESTADO} ${review} ${d.CORREO_ASOCIADO||''}`.toLowerCase())}"><td><strong>${esc(d.TIPO)}</strong><span class="muted">${esc(d.ID)}</span></td><td><strong>${esc(d.ASOCIADO_TIPO||'Usuario')}</strong><small>${esc(asociado)}</small></td><td>${esc(d.IDENTIFICACION)}</td><td>${fmtDate(d.FECHA_VENCIMIENTO)}</td><td>${documentReviewBadge(d)}<small class="document-validity">${esc(d.ESTADO||'Sin vigencia')}</small></td><td>${attachment}</td><td>${documentRowActions(d)}</td></tr>`;
  }

  function tipoAsociacionDocumento(row={}){
    const alcance=String(row.ALCANCE_DOCUMENTO||'').toUpperCase();
    if(alcance==='VEHICULO_ASIGNADO')return'VEHICULO';
    const tipo=String(row.ASOCIADO_TIPO||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
    if(tipo.includes('VEHICULO')||row.VEHICULO_ASOCIADO_ID||row.VEHICULO_ID)return'VEHICULO';
    return'PERSONAL';
  }
  function datosExpedienteDocumento(row={}){
    const tipo=tipoAsociacionDocumento(row);
    if(tipo==='VEHICULO'){
      const id=String(row.VEHICULO_ASIGNADO_ID||row.VEHICULO_ASOCIADO_ID||row.VEHICULO_ID||row.ASOCIADO_ID||row.IDENTIFICACION||'SIN-VEHICULO');
      return{key:`VEHICULO:${id}`,tipo,id,titulo:`Vehículo ${row.VEHICULO_PATENTE||row.IDENTIFICACION||id}`,subtitulo:'Documentación del vehículo'};
    }
    const id=String(row.CONDUCTOR_ASOCIADO_ID||row.USUARIO_ASOCIADO_ID||row.CORREO_ASOCIADO||row.ASOCIADO_ID||currentUser?.ID||'SIN-CONDUCTOR');
    return{key:`PERSONAL:${id}`,tipo,id,titulo:currentUser?.ROL_ID==='ROL-CONDUCTOR'?'Mis documentos personales':`Expediente personal · ${row.CORREO_ASOCIADO||row.IDENTIFICACION||id}`,subtitulo:'Documentos personales digitalizados'};
  }
  function estadoExpediente(rows=[]){
    const hoy=Date.now(),vencidos=rows.filter(row=>{const fecha=new Date(row.FECHA_VENCIMIENTO||0).getTime();return String(row.ESTADO||'').toLowerCase()==='vencido'||fecha>0&&fecha<hoy;}).length;
    const pendientes=rows.filter(row=>!/^aprobado$/i.test(documentReviewState(row))).length;
    const adjuntos=rows.filter(row=>Boolean(row.DIRECCION_ARCHIVO||row.ARCHIVO_BUCKET&&row.ARCHIVO_RUTA)).length;
    return{vencidos,pendientes,adjuntos,completo:rows.length>0&&adjuntos===rows.length&&vencidos===0};
  }
  function tarjetaExpedienteDocumento(group){
    const state=estadoExpediente(group.rows),ultimo=group.rows.slice().sort((a,b)=>new Date(a.FECHA_VENCIMIENTO||0)-new Date(b.FECHA_VENCIMIENTO||0))[0];
    return `<article class="document-expedient-card ${state.completo?'complete':state.vencidos?'expired':'pending'}" data-document-expedient-card data-expedient-search="${esc(`${group.titulo} ${group.subtitulo} ${group.id}`.toLowerCase())}"><header><i>${group.tipo==='VEHICULO'?'🚐':'▤'}</i><div><span>${group.tipo==='VEHICULO'?'VEHÍCULO ASIGNADO':'EXPEDIENTE PERSONAL'}</span><h3>${esc(group.titulo)}</h3><p>${esc(group.subtitulo)}</p></div></header><div class="document-expedient-stats"><span><b>${number(group.rows.length)}</b> documentos</span><span class="${state.adjuntos===group.rows.length?'ok':'warning'}"><b>${number(state.adjuntos)}</b> digitalizados</span><span class="${state.vencidos?'danger':'ok'}"><b>${number(state.vencidos)}</b> vencidos</span><span class="${state.pendientes?'warning':'ok'}"><b>${number(state.pendientes)}</b> por revisar</span></div><p class="document-expedient-next">${ultimo?.FECHA_VENCIMIENTO?`Próximo vencimiento: ${esc(ultimo.TIPO||'Documento')} · ${fmtDate(ultimo.FECHA_VENCIMIENTO)}`:'Sin vencimientos registrados'}</p><button class="btn primary full" type="button" data-open-document-expedient="${esc(group.key)}">Ver expediente completo</button></article>`;
  }
  async function renderDocuments(){
    // Documentos del Conductor siempre solicita contexto fresco: la asignación
    // vehicular puede haber cambiado sin que el usuario abandone su sesión.
    actualizacionVehiculoAsignadoPendiente=false;
    api.invalidate({resources:['documents','vehicles']});
    const result=await solicitarListaPaginada('documents',{cache:false}),rows=result.rows||[];guardarListaFormulario('documents',rows);expedientesDocumentalesActuales.clear();
    const conductor=currentUser.ROL_ID==='ROL-CONDUCTOR',groups=[];
    if(conductor){
      const personal={key:`PERSONAL:${currentUser.ID}`,tipo:'PERSONAL',id:currentUser.ID,titulo:'Mis documentos personales',subtitulo:'Disponibles siempre en su cuenta',rows:rows.filter(row=>tipoAsociacionDocumento(row)==='PERSONAL')};
      const vehicleRows=rows.filter(row=>tipoAsociacionDocumento(row)==='VEHICULO'),vehicle=result.expediente?.VEHICULO_ASIGNADO||{},vehicleId=result.expediente?.VEHICULO_ASIGNADO_ID||vehicleRows[0]?.VEHICULO_ASIGNADO_ID||vehicleRows[0]?.ASOCIADO_ID||'';
      groups.push(personal);
      if(vehicleId)groups.push({key:`VEHICULO:${vehicleId}`,tipo:'VEHICULO',id:vehicleId,titulo:`Vehículo ${vehicle.PATENTE||vehicleRows[0]?.IDENTIFICACION||vehicleId}`,subtitulo:`${vehicle.MARCA||''} ${vehicle.MODELO||''}`.trim()||'Vehículo asignado en ruta u operación',rows:vehicleRows});
    }else{
      const map=new Map();rows.forEach(row=>{const info=datosExpedienteDocumento(row);if(!map.has(info.key))map.set(info.key,{...info,rows:[]});map.get(info.key).rows.push(row);});groups.push(...map.values());
    }
    groups.forEach(group=>expedientesDocumentalesActuales.set(group.key,group));
    const puedeCrear=conductor?hasPermission('DOCUMENTOS','CARGAR_PROPIO'):hasPermission('DOCUMENTOS','CREAR'),importar=hasPermission('DOCUMENTOS','IMPORTAR');
    const acciones=`<button class="btn soft" data-sync>↻ Actualizar</button>${importar?'<a class="btn soft" href="Plantilla_Importacion_Documentos.xlsx" download>⇩ Plantilla</a><button class="btn soft" data-bulk-import="documents">⇧ Importar</button>':''}${puedeCrear?`<button class="btn primary" data-add="documents">＋ ${conductor?'Cargar documentos personales':'Cargar documentos'}</button>`:''}`;
    const aviso=conductor?`<div class="tracking-notice active"><i>✓</i><div><b>Expediente privado del Conductor</b><span>Sus documentos personales permanecen visibles. Los documentos vehiculares corresponden exclusivamente al único vehículo asignado; si la asignación cambia, esta tarjeta también cambia.</span></div></div>`:`<div class="tracking-notice active"><i>◆</i><div><b>Consulta general de expedientes</b><span>Administración, Gerencia y Operador pueden consultar todos los documentos. Las acciones de aprobación, edición o eliminación continúan protegidas por permisos.</span></div></div>`;
    const emptyVehicle=conductor&&!groups.some(group=>group.tipo==='VEHICULO')?`<article class="document-expedient-card empty"><header><i>🚐</i><div><span>VEHÍCULO ASIGNADO</span><h3>Sin vehículo activo</h3><p>Al asignar una ruta, aparecerá aquí únicamente su documentación.</p></div></header></article>`:'';
    return heading('DOCUMENTACIÓN DIGITAL','Documentos','Expedientes en tarjetas para consultar fotografías y PDF de forma rápida y segura.',acciones)+aviso+`<article class="card document-expedient-toolbar"><label class="search-box"><span>⌕</span><input data-expedient-search-input placeholder="Buscar conductor, vehículo o identificación"></label>${puedeExportarFormato('csv')?'<button class="btn soft push" data-export="documents">Exportar CSV</button>':''}</article><div class="document-expedient-grid">${groups.map(tarjetaExpedienteDocumento).join('')}${emptyVehicle||(!groups.length?empty('▤','Sin expedientes','No existen documentos visibles para esta cuenta.'):'')}</div>`;
  }
  function abrirExpedienteDocumental(key){
    const group=expedientesDocumentalesActuales.get(String(key||''));if(!group)return;
    const rows=group.rows||[],state=estadoExpediente(rows);
    $('#modalEyebrow').textContent=group.tipo==='VEHICULO'?'DOCUMENTOS DEL VEHÍCULO ASIGNADO':'EXPEDIENTE PERSONAL';$('#modalTitle').textContent=group.titulo;
    const items=rows.map(row=>`<article class="document-expedient-item"><div><span>${documentReviewBadge(row)}</span><h4>${esc(row.TIPO||'Documento')}</h4><p>${esc(row.IDENTIFICACION||'Sin identificación')} · ${row.FECHA_VENCIMIENTO?`vence ${fmtDate(row.FECHA_VENCIMIENTO)}`:'sin vencimiento'}</p><small>${esc(row.ESTADO||'Sin estado')}</small></div>${row.DIRECCION_ARCHIVO||row.ARCHIVO_BUCKET&&row.ARCHIVO_RUTA?`<button class="btn soft small" type="button" data-view-document="${esc(row.ID)}">Abrir foto o PDF</button>`:'<span class="status warning">Sin archivo</span>'}</article>`).join('');
    $('#modalBody').innerHTML=`<div class="document-expedient-modal"><div class="document-expedient-modal-summary"><span><b>${number(rows.length)}</b> documentos</span><span><b>${number(state.adjuntos)}</b> digitalizados</span><span><b>${number(state.vencidos)}</b> vencidos</span></div><div class="document-expedient-list">${items||empty('▤','Expediente vacío','Todavía no existen documentos digitalizados.')}</div><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cerrar</button></div></div>`;openModal();
    $('[data-cancel-modal]',$('#modalBody')).onclick=closeModal;$$('[data-view-document]',$('#modalBody')).forEach(button=>button.onclick=()=>abrirVisorDocumento(button.dataset.viewDocument));
  }
  function abrirBaseDocumentosPrivados(){
    return new Promise((resolve,reject)=>{if(!window.indexedDB){reject(new Error('CACHE_NO_DISPONIBLE'));return;}const request=indexedDB.open('flotas_documentos_privados_v1',1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('archivos'))db.createObjectStore('archivos',{keyPath:'clave'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('CACHE_NO_DISPONIBLE'));});
  }
  function claveDocumentoPrivado(id){return `${String(currentUser?.ID||'sin-usuario')}:${String(id||'')}`;}
  async function guardarDocumentoPrivado(id,blob,nombre,mime){
    const db=await abrirBaseDocumentosPrivados();return new Promise((resolve,reject)=>{const tx=db.transaction('archivos','readwrite');tx.objectStore('archivos').put({clave:claveDocumentoPrivado(id),blob,nombre,mime,guardadoEn:Date.now()});tx.oncomplete=()=>{db.close();resolve(true);};tx.onerror=()=>{db.close();reject(tx.error);};});
  }
  async function leerDocumentoPrivado(id){
    const db=await abrirBaseDocumentosPrivados();return new Promise((resolve,reject)=>{const tx=db.transaction('archivos','readonly'),request=tx.objectStore('archivos').get(claveDocumentoPrivado(id));request.onsuccess=()=>{db.close();resolve(request.result||null);};request.onerror=()=>{db.close();reject(request.error);};});
  }
  async function abrirVisorDocumento(id){
    $('#modalEyebrow').textContent='ARCHIVO PRIVADO';$('#modalTitle').textContent='Visualizando documento';$('#modalBody').innerHTML=contenidoCargaModal('Solicitando acceso seguro al archivo…');openModal();
    try{
      let result=null,cached=null,blob=null,offline=false,directUrl='';
      try{result=await api.request('documentFile',{data:{DOCUMENTO_ID:id},cache:false});if(!result?.url)throw new Error('ARCHIVO_NO_ENCONTRADO');try{const response=await fetch(result.url,{cache:'no-store'});if(!response.ok)throw new Error('ARCHIVO_NO_ENCONTRADO');blob=await response.blob();guardarDocumentoPrivado(id,blob,result.nombre||'Documento',result.tipoMime||blob.type||'').catch(()=>{});}catch(_){directUrl=result.url;}}catch(networkError){cached=await leerDocumentoPrivado(id).catch(()=>null);if(!cached?.blob)throw networkError;blob=cached.blob;offline=true;}
      const name=result?.nombre||cached?.nombre||'Documento',mime=result?.tipoMime||cached?.mime||blob?.type||'',url=blob?URL.createObjectURL(blob):directUrl,esImagen=String(mime).startsWith('image/'),esPdf=String(mime)==='application/pdf'||/\.pdf$/i.test(name);
      const preview=esImagen?`<img class="document-secure-image" src="${esc(url)}" alt="${esc(name)}">`:esPdf?`<iframe class="document-secure-frame" src="${esc(url)}#toolbar=1&navpanes=0" title="${esc(name)}"></iframe>`:`<div class="document-secure-unknown"><i>▧</i><b>${esc(name)}</b><span>Este formato no puede mostrarse dentro del navegador.</span></div>`;
      $('#modalEyebrow').textContent=offline?'COPIA PRIVADA SIN CONEXIÓN':'ARCHIVO AUTORIZADO';$('#modalTitle').textContent=name;$('#modalBody').innerHTML=`<div class="document-secure-viewer" data-document-object-url="${esc(url)}">${preview}<div class="document-secure-meta"><span>${esc(mime||'Tipo no informado')}</span><span>${blob?.size?`${number(Math.ceil(blob.size/1024))} KB`:''}</span><small>${offline?'Disponible desde la copia privada guardada en este navegador':blob?'Copia privada actualizada para próximas consultas sin conexión':'Acceso seguro en línea; el navegador no permitió conservar la copia local'}</small></div><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cerrar</button><a class="btn primary" href="${esc(url)}" download="${esc(name)}">Descargar archivo</a></div></div>`;$('[data-cancel-modal]',$('#modalBody')).onclick=()=>{if(blob)URL.revokeObjectURL(url);closeModal();};
    }catch(error){$('#modalBody').innerHTML=`<div class="modal-error"><b>No se pudo visualizar el archivo</b><p>${esc(translateError(error))}</p><small>Abra el documento una vez con Internet para conservar su copia privada en este navegador.</small><button class="btn soft" type="button" data-cancel-modal>Cerrar</button></div>`;$('[data-cancel-modal]',$('#modalBody')).onclick=closeModal;}
  }
  function alertRows(a){return `<tr data-filter-date="${esc(a.FECHA_HORA||a.CREADO_EN||'')}" data-search-row="${esc(`${a.NIVEL} ${a.TITULO} ${a.MODULO}`.toLowerCase())}"><td>${status(a.NIVEL)}</td><td><strong>${esc(a.TITULO)}</strong><span class="muted">${esc(a.MENSAJE)}</span></td><td>${esc(a.MODULO||'—')}</td><td>${fmtDate(a.FECHA_HORA||a.CREADO_EN,true)}</td><td>${status(a.LEIDA||'NO')}</td><td>${actions('alerts',a.ID)}</td></tr>`;}
  function normalizarPermisosVisualesUsuario(user, campo='PERMISOS_PERSONALIZADOS') {
    let value=user?.[campo] || [];
    if(typeof value==='string'){try{value=JSON.parse(value||'[]');}catch(_){value=[];}}
    if(!Array.isArray(value))value=[];
    return [...new Set(value.map(item=>String(item||'').trim().toUpperCase()).filter(Boolean))].sort();
  }
  function normalizarMatrizPermisosUsuario(user, campo='MATRIZ_PERMISOS') {
    const salida={};
    permissionCatalog.forEach(([module])=>permissionActions.forEach(([action])=>{salida[`${module}:${action}`]=false;}));
    buttonPermissionCatalog.forEach(([module,action])=>{salida[`${module}:${action}`]=false;});
    let matriz=user?.[campo];
    if(typeof matriz==='string'){try{matriz=JSON.parse(matriz||'{}');}catch(_){matriz={};}}
    if(matriz&&typeof matriz==='object'&&!Array.isArray(matriz)){
      Object.entries(matriz).forEach(([clave,valor])=>{
        const normalizada=String(clave||'').trim().toUpperCase();
        if(Object.prototype.hasOwnProperty.call(salida,normalizada)) salida[normalizada]=valor===true||String(valor).toUpperCase()==='TRUE'||String(valor).toUpperCase()==='SI'||String(valor)==='1';
      });
      return salida;
    }
    const fallback=campo==='MATRIZ_PERMISOS_PERSONALIZADOS'?'PERMISOS_PERSONALIZADOS':'PERMISOS';
    normalizarPermisosVisualesUsuario(user,fallback).forEach(clave=>{if(Object.prototype.hasOwnProperty.call(salida,clave))salida[clave]=true;});
    return salida;
  }
  function aplicarMatrizCheckboxPermisos(form, matriz){
    if(!form)return;
    form.querySelectorAll('input[name="PERMISOS"]').forEach(input=>{
      const obligatorio=input.dataset.obligatorio==='1';
      input.checked=obligatorio||matriz?.[String(input.value||'').toUpperCase()]===true;
      input.dataset.valorBooleano=input.checked?'true':'false';
      input.setAttribute('aria-checked',input.checked?'true':'false');
    });
  }
  function userRows(u){
    const personalizados=normalizarPermisosVisualesUsuario(u);
    const admin=String(u.ROL_ID||u.ROL_NOMBRE||'').toUpperCase()==='ROL-ADMIN'||String(u.ROL_NOMBRE||'').toUpperCase()==='ADMINISTRADOR';
    const mode=admin?'Acceso completo':u.MODO_PERMISOS==='PERSONALIZADO'?`Personalizados (${personalizados.length})`:'Según rol';
    const permissionButton=hasPermission('USUARIOS','GESTIONAR_PERMISOS')?`<button data-user-permissions="${esc(u.ID)}" title="Configurar permisos" aria-label="Configurar permisos de ${esc(u.NOMBRE)}">⚿</button>`:'';
    const actionHtml=actions('users',u.ID),baseActions=actionHtml==='—'?(permissionButton?`<div class="row-actions">${permissionButton}</div>`:'—'):actionHtml.replace('</div>',permissionButton+'</div>');
    return `<tr class="user-row" data-filter-date="${esc(u.ULTIMO_ACCESO||u.ACTUALIZADO_EN||u.CREADO_EN||'')}" data-search-row="${esc(`${u.NOMBRE} ${u.CORREO} ${u.ROL_ID} ${mode}`.toLowerCase())}"><td data-label="Usuario" class="user-main-cell"><div class="entity"><span class="avatar">${initials(u.NOMBRE)}</span><strong>${esc(u.NOMBRE)}</strong></div></td><td data-label="Correo" class="user-email-cell">${esc(u.CORREO)}</td><td data-label="Rol">${esc(u.ROL_NOMBRE||u.ROL_ID)}</td><td data-label="Permisos" class="user-permission-cell"><span class="user-permission-summary ${admin?'full':'custom'}"><b>${esc(mode)}</b><small>${admin?'Todos los permisos activos':u.MODO_PERMISOS==='PERSONALIZADO'?`${personalizados.length} permiso(s) marcados`:'Permisos heredados del rol'}</small></span></td><td data-label="Último acceso">${fmtDate(u.ULTIMO_ACCESO,true)}</td><td data-label="Estado">${status(u.ESTADO)}</td><td data-label="Acciones" class="user-actions-cell">${baseActions}</td></tr>`;
  }
  function actions(resource,id){const module=resourcePermission[resource];const buttons=[];if(hasPermission(module,'ACTUALIZAR'))buttons.push(`<button data-edit="${resource}:${id}" title="Editar">✎</button>`);const canDelete=resource==='users'?hasPermission('USUARIOS','DESACTIVAR'):resource==='documents'?(puedeEliminarDocumentosPorRol()&&hasPermission('DOCUMENTOS','ELIMINAR')):hasPermission(module,'ELIMINAR');if(canDelete)buttons.push(`<button data-delete="${resource}:${id}" title="${resource==='users'?'Desactivar':resource==='documents'?'Eliminar documento':'Eliminar'}">×</button>`);return buttons.length?`<div class="row-actions">${buttons.join('')}</div>`:'—';}

  function puedeImprimirQrVehiculo(){return hasPermission('VEHICULOS','IMPRIMIR_QR');}
  function codigoQrVehiculo(vehicle){const patente=String(vehicle?.PATENTE||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');return String(vehicle?.QR_CODIGO||`VEH-${patente}`).trim().toUpperCase();}
  function accionesVehiculo(vehicle){
    const print=puedeImprimirQrVehiculo()?`<button class="btn soft small vehicle-qr-print" data-print-vehicle-qr="${esc(vehicle.ID)}" type="button" title="Vista previa e impresión de etiqueta QR 100 × 50 mm">▦ Imprimir QR</button>`:'';
    const standard=actions('vehicles',vehicle.ID);if(!print)return standard;if(standard==='—')return print;return `<div class="row-button-stack vehicle-row-actions">${print}${standard}</div>`;
  }
  function documentoEtiquetaQr(etiqueta,svg){
    const title=esc(etiqueta.TITULO||'CONTROL DE FLOTA'),code=esc(etiqueta.CODIGO||''),description=esc(etiqueta.DESCRIPCION||etiqueta.PATENTE||''),plate=esc(etiqueta.PATENTE||'');
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Etiqueta QR ${plate}</title><style>@page{size:100mm 50mm;margin:0}*{box-sizing:border-box}html,body{width:100mm;height:50mm;margin:0;padding:0;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif}.label{width:100mm;height:50mm;border:.45mm solid #000;overflow:hidden;display:grid;grid-template-rows:9mm 1fr}.title{display:flex;align-items:center;justify-content:center;border-bottom:.35mm solid #000;font-size:5.2mm;font-weight:900;letter-spacing:.35mm;line-height:1}.body{display:grid;grid-template-columns:40mm 1fr;gap:2.2mm;padding:1.7mm 2.2mm 1.5mm}.qr{width:36mm;height:36mm;display:flex;align-items:center;justify-content:center}.qr svg{display:block;width:36mm;height:36mm}.info{min-width:0;display:flex;flex-direction:column;justify-content:center}.code{font-size:6.2mm;font-weight:900;line-height:1.05;overflow-wrap:anywhere}.description{font-size:4.5mm;font-weight:800;line-height:1.1;margin-top:2mm;text-transform:uppercase}.plate{font-size:3.1mm;font-weight:700;margin-top:1.6mm}.hint{font-size:2.35mm;font-weight:700;margin-top:2.2mm;border-top:.25mm solid #000;padding-top:1.2mm;letter-spacing:.1mm}@media print{html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><main class="label"><div class="title">${title}</div><div class="body"><div class="qr">${svg}</div><div class="info"><div class="code">${code}</div><div class="description">${description}</div><div class="plate">PATENTE: ${plate}</div><div class="hint">ESCANEAR PARA IDENTIFICAR EL VEHÍCULO</div></div></div></main></body></html>`;
  }
  function imprimirEtiquetaQr(etiqueta,svg){
    const html=documentoEtiquetaQr(etiqueta,svg),job=`Etiqueta QR ${etiqueta.PATENTE||etiqueta.CODIGO||'vehículo'}`;
    if(window.AndroidConfig&&typeof window.AndroidConfig.imprimirEtiquetaQr==='function'){
      window.AndroidConfig.imprimirEtiquetaQr(html,job);toast('Impresión preparada','Android abrió el servicio de impresión para la etiqueta 100 × 50 mm.');return true;
    }
    const printWindow=window.open('','_blank','width=900,height=620,noopener=no');
    if(!printWindow){toast('Ventana de impresión bloqueada','Habilite las ventanas emergentes del sistema y vuelva a pulsar Imprimir QR.','warning');return false;}
    const browserHtml=html.replace('</body>',`<script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print();},180)});window.addEventListener('afterprint',function(){setTimeout(function(){window.close()},120)});<\/script></body>`);
    printWindow.document.open();printWindow.document.write(browserHtml);printWindow.document.close();return true;
  }
  async function openVehicleQrLabel(vehicleId){
    if(!puedeImprimirQrVehiculo())throw new Error('ETIQUETA_QR_ROL_NO_AUTORIZADO');
    if(!window.FlotasQr?.crearSvg)throw new Error('GENERADOR_QR_NO_DISPONIBLE');
    const result=await api.request('vehicleQrLabel',{id:vehicleId,VEHICULO_ID:vehicleId,cache:false}),vehicle=result.vehicle||result.vehiculo||{},raw=result.etiqueta||{};
    const etiqueta={CODIGO:raw.CODIGO||result.CODIGO||result.codigo||codigoQrVehiculo(vehicle),TITULO:raw.TITULO||result.titulo||'CONTROL DE FLOTA',DESCRIPCION:raw.DESCRIPCION||result.descripcion||[vehicle.MARCA,vehicle.MODELO].filter(Boolean).join(' ')||vehicle.PATENTE||'Vehículo',PATENTE:raw.PATENTE||result.patente||vehicle.PATENTE||'',VEHICULO_ID:raw.VEHICULO_ID||vehicle.ID||vehicleId};
    if(!etiqueta.CODIGO)throw new Error('QR_CODIGO_REQUERIDO');
    if(!window.FlotasQr?.crearSvg)throw new Error('GENERADOR_QR_NO_DISPONIBLE');
    const svg=window.FlotasQr.crearSvg(etiqueta.CODIGO,{nivel:'H',margen:4});
    $('#modalEyebrow').textContent='ETIQUETA VEHICULAR · 100 × 50 MM';$('#modalTitle').textContent=`QR ${etiqueta.PATENTE||''}`;
    $('#modalBody').innerHTML=`<div class="vehicle-qr-modal"><div class="tracking-notice active"><i>✓</i><div><b>QR creado y validado para los escaneos del sistema</b><span>Contenido: ${esc(etiqueta.CODIGO)} · acceso permitido para Administradores y Operadores.</span></div></div><div class="vehicle-label-preview" role="img" aria-label="Vista previa de etiqueta QR"><div class="vehicle-label-title">${esc(etiqueta.TITULO||'CONTROL DE FLOTA')}</div><div class="vehicle-label-body"><div class="vehicle-label-qr">${svg}</div><div class="vehicle-label-info"><b>${esc(etiqueta.CODIGO)}</b><strong>${esc(etiqueta.DESCRIPCION||etiqueta.PATENTE)}</strong><span>PATENTE: ${esc(etiqueta.PATENTE)}</span><small>ESCANEAR PARA IDENTIFICAR EL VEHÍCULO</small></div></div></div><div class="vehicle-qr-print-help"><b>Configuración de impresión</b><span>Tamaño de papel: 100 mm × 50 mm · orientación horizontal · escala 100 % · márgenes ninguno.</span></div><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn primary" type="button" data-confirm-print-vehicle-qr>▦ Imprimir etiqueta QR</button></div></div>`;
    openModal();const body=$('#modalBody');$('[data-cancel-modal]',body).onclick=closeModal;$('[data-confirm-print-vehicle-qr]',body).onclick=()=>{if(imprimirEtiquetaQr(etiqueta,svg))closeModal();};
    if(result.row)guardarRegistro('vehicles',result.row);
  }

  function parseCheckinItems(row) {
    try {
      const items=typeof row?.LISTA_CODIFICADA==='string'?JSON.parse(row.LISTA_CODIFICADA):row?.LISTA_CODIFICADA;
      return Array.isArray(items)?items:[];
    } catch (_) { return []; }
  }
  function crearSolicitudClienteCheckin() {
    const value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `CHK-CLIENTE-${value}`.slice(0, 120);
  }
  function guardarReciboCheckin(row, persistencia) {
    if (!row?.ID) return;
    const receipt = { id:row.ID, estado:row.ESTADO_REVISION || row.RESULTADO || 'Registrado', fecha:new Date().toISOString(), persistencia:persistencia || (api.isRemote() ? 'CENTRAL_CONFIRMADA' : 'LOCAL') };
    sessionStorage.setItem(checkinReceiptKey, JSON.stringify(receipt));
  }
  async function confirmarCheckinVisible(row) {
    if(!row?.ID)throw new Error('CHECKIN_RESPUESTA_SIN_IDENTIFICADOR');
    let confirmado=row;
    try{
      const verification=await api.request('get',{resource:'checkins',id:row.ID,force:true,cache:false});
      if(verification?.row)confirmado=verification.row;
    }catch(error){
      if(api.isRemote())throw new Error('CHECKIN_NO_CONFIRMADO_EN_BASE_CENTRAL');
    }
    guardarRegistro('checkins',confirmado);
    invalidarListasFormulario('checkins');
    guardarRegistro('checkins',confirmado);
    modulosSincronizadosSesion.add('checkin');
    ['checkin','checkinApprovals','checkinHistory','operations','dashboard'].forEach(section=>cacheVistasModulo.delete(section));
    await actualizarSeccionEnSegundoPlano('checkin');
    return confirmado;
  }

  function reciboCheckinMarkup() {
    let receipt=null;
    try { receipt=JSON.parse(sessionStorage.getItem(checkinReceiptKey) || 'null'); } catch (_) {}
    if (!receipt?.id) return '';
    const central=receipt.persistencia==='CENTRAL_CONFIRMADA';
    return `<div class="tracking-notice ${central?'active':'warning'} checkin-save-receipt"><i>${central?'✓':'!'}</i><div><b>${central?'Check-in guardado en la base central':'Check-in guardado solo en este dispositivo'}</b><span>Comprobante ${esc(receipt.id)} · ${esc(receipt.estado)} · ${fmtDate(receipt.fecha,true)}</span></div><button class="btn soft small" type="button" data-checkin-detail="${esc(receipt.id)}">Ver registro</button></div>`;
  }

  function checkinVisualState(row) {
    if(row.ESTADO_REVISION==='Aprobado'&&new Date(row.VIGENTE_HASTA||0).getTime()>Date.now())return 'Vigente 24 h';
    if(row.ESTADO_REVISION==='Aprobado'&&new Date(row.VIGENTE_HASTA||0).getTime()<=Date.now())return 'Expirado';
    return row.ESTADO_REVISION||row.RESULTADO||'Sin estado';
  }
  function checkinDetailAction(row) {
    return `<button class="btn soft small" data-checkin-detail="${esc(row.ID)}">Ver inspección</button>`;
  }
  async function checkinContext() {
    const [checkins,vehicles,drivers]=await Promise.all([
      solicitarListaPaginada('checkins',{cache:false}),
      solicitarListaPaginada('vehicles',{limit:1000}),
      solicitarListaPaginada('drivers',{limit:1000}),
    ]);
    guardarListaFormulario('checkins',checkins.rows||[]);guardarListaFormulario('vehicles',vehicles.rows||[]);guardarListaFormulario('drivers',drivers.rows||[]);
    return {rows:(checkins.rows||[]).sort((a,b)=>new Date(b.FECHA_HORA||0)-new Date(a.FECHA_HORA||0)),vehicles:vehicles.rows||[],drivers:drivers.rows||[]};
  }
  function checkinRow(row,vehicleMap,driverMap,withReview=false) {
    const vehicle=vehicleMap[row.VEHICULO_ID]?.PATENTE||row.VEHICULO_ID,driver=driverMap[row.CONDUCTOR_ID]?.NOMBRE||row.CONDUCTOR_ID,state=checkinVisualState(row);
    const review=withReview&&['Pendiente','Bloqueado'].includes(row.ESTADO_REVISION)?`<button class="btn primary small" data-review-checkin="${esc(row.ID)}">Revisar · aprobar/anular</button>`:'';
    return `<tr data-filter-date="${esc(row.FECHA_HORA||row.CREADO_EN||'')}" data-search-row="${esc(`${row.ID} ${vehicle} ${driver} ${row.RESULTADO} ${state}`.toLowerCase())}"><td><strong>${esc(row.ID)}</strong><span class="muted">${fmtDate(row.FECHA_HORA,true)}</span></td><td><strong>${esc(vehicle)}</strong></td><td>${esc(driver)}</td><td>${status(row.RESULTADO)}</td><td>${status(state)}</td><td><span class="checkin-count critical">${number(row.FALLAS_CRITICAS||0)} críticas</span><span class="checkin-count">${number(row.FALLAS_LEVES||0)} leves</span></td><td>${fmtDate(row.VIGENTE_HASTA,true)}</td><td><div class="row-button-stack">${review}${checkinDetailAction(row)}</div></td></tr>`;
  }
  let checkinQrVehiculoValidado=null;

  function checkinInlineItemsMarkup() {
    const groups={};
    checkinCatalog.forEach(item=>(groups[item.categoria]||(groups[item.categoria]=[])).push(item));
    let position=0;
    return Object.entries(groups).map(([category,items])=>`<fieldset class="checkin-group checkin-group-visible full"><legend>${esc(category)}</legend>${items.map(item=>{
      position+=1;
      return `<article class="checkin-control-card" data-checkin-control="${esc(item.id)}">
        <div class="checkin-control-head"><span class="checkin-control-number">${position}</span><div><b>${esc(item.item)}</b><small>${item.critico?'Control crítico: una falla bloquea la operación':'Control complementario'}</small></div><span class="checkin-control-state" data-checkin-state="${esc(item.id)}">Sin revisar</span></div>
        <div class="checkin-answer-options" role="radiogroup" aria-label="Resultado de ${esc(item.item)}">
          <label class="checkin-answer ok"><input type="radio" name="checkin_${esc(item.id)}" value="OK" required><span>✓ Conforme</span></label>
          <label class="checkin-answer fail"><input type="radio" name="checkin_${esc(item.id)}" value="FALLA" required><span>! No conforme</span></label>
          ${item.critico?'':`<label class="checkin-answer na"><input type="radio" name="checkin_${esc(item.id)}" value="NA" required><span>— No aplica</span></label>`}
        </div>
        <label class="field checkin-inline-note"><span>Observación ${item.critico?'del control':'opcional'}</span><input data-checkin-note="${esc(item.id)}" placeholder="Describa daños, ruidos o condiciones encontradas"></label>
      </article>`;
    }).join('')}</fieldset>`).join('');
  }

  function checkinInlineFormMarkup() {
    const pendienteRuta=leerJsonLocal(pendingRouteCheckinKey)||{};
    const driverProfile=String(currentUser?.ROL_ID||'').toUpperCase()==='ROL-CONDUCTOR',assignedVehicle=driverProfile?listaFormulario('vehicles')[0]:null,assignedDriverId=currentUser.CONDUCTOR_ID||'';
    const qrValido=driverProfile&&checkinQrVehiculoValidado?.AUTORIZACION_QR&&(!assignedVehicle||String(checkinQrVehiculoValidado.ID)===String(assignedVehicle.ID));
    const selectedVehicle=(qrValido?checkinQrVehiculoValidado.ID:assignedVehicle?.ID)||pendienteRuta.VEHICULO_ID||'',selectedDriver=driverProfile?assignedDriverId:(pendienteRuta.CONDUCTOR_ID||assignedDriverId);
    const vehicleSelector=selectorDinamico('vehicles','checkinVehicles','VEHICULO_ID',selectedVehicle,true),driverSelector=selectorDinamico('drivers','checkinDrivers','CONDUCTOR_ID',selectedDriver,true);
    if(driverProfile&&!qrValido){
      const patent=assignedVehicle?.PATENTE||assignedVehicle?.ID||'vehículo asignado';
      return `<article class="card checkin-visible-card checkin-qr-gate" id="checkinVisibleCard" data-checkin-qr-gate><div class="card-header checkin-visible-header"><div><span class="eyebrow">VALIDACIÓN OBLIGATORIA</span><h3>Escanee el QR del vehículo</h3><p>La lista de check-in permanecerá oculta hasta validar el código QR físico del vehículo que la empresa le asignó.</p></div>${status('QR requerido')}</div><div class="tracking-notice warning full"><i>▦</i><div><b>Vehículo esperado: ${esc(patent)}</b><span>Si escanea otro vehículo, el servidor rechazará el acceso a la inspección. La autorización QR dura 5 minutos y se consume al guardar el check-in.</span></div></div><div class="qr-gate-steps"><div><b>1</b><span>Ubique el QR pegado en el vehículo.</span></div><div><b>2</b><span>Escanéelo para validar la asignación.</span></div><div><b>3</b><span>Al coincidir, se desplegarán los ${checkinCatalog.length} controles.</span></div></div><div class="form-actions"><button class="btn primary" type="button" data-open-checkin-qr>▦ Escanear QR del vehículo</button></div></article>`;
    }
    if(!hasPermission('CHECKIN','CREAR')){
      return `<article class="card checkin-visible-card"><div class="card-header"><div><h3>Lista de chequeo vehicular</h3><p>Los controles están disponibles, pero su usuario no tiene permiso para registrar inspecciones.</p></div>${status('Solo lectura')}</div><div class="tracking-notice warning full"><i>!</i><div><b>Permiso requerido: CHECKIN · CREAR</b><span>Solicite al administrador activar este permiso en Usuarios → Configurar permisos.</span></div></div><div class="checkin-readonly-list">${checkinCatalog.map((item,index)=>`<div><span>${index+1}</span><p><b>${esc(item.item)}</b><small>${esc(item.categoria)} · ${item.critico?'Crítico':'Complementario'}</small></p></div>`).join('')}</div></article>`;
    }
    return `<article class="card checkin-visible-card" id="checkinVisibleCard">
      <div class="card-header checkin-visible-header"><div><span class="eyebrow">CHEQUEO ANTES DE SALIR</span><h3>Lista de chequeo vehicular</h3><p>Marque los ${checkinCatalog.length} controles. El avance se mostrará en verde hasta finalizar.</p></div><div class="checkin-progress-summary"><b data-checkin-progress-count>0 / ${checkinCatalog.length}</b><span>controles revisados</span></div></div>
      <div class="checkin-progress-track" aria-hidden="true"><i data-checkin-progress-bar></i></div>
      <form class="form-grid checkin-form checkin-inline-form" id="checkinInlineForm">
        <input type="hidden" name="AUTORIZACION_QR" value="${esc(qrValido?checkinQrVehiculoValidado.AUTORIZACION_QR:'')}">
        <div class="tracking-notice active full ${qrValido?'':'hidden'}" data-checkin-qr-notice><i>▦</i><div><b>Vehículo validado mediante QR</b><span>La patente escaneada quedó seleccionada para esta inspección.</span></div></div>
        <div class="checkin-basic-data full">
          <label class="field"><span>Vehículo ${driverProfile?'asignado':''}</span>${driverProfile?vehicleSelector.replace('name="VEHICULO_ID"','name="VEHICULO_ID_VISTA"').replace('<select ','<select disabled aria-readonly="true" ')+`<input type="hidden" name="VEHICULO_ID" value="${esc(selectedVehicle)}">`:vehicleSelector}${driverProfile?'<small>El conductor solo puede inspeccionar el vehículo que le asignó la empresa.</small>':''}</label>
          <label class="field"><span>Conductor</span>${driverProfile?driverSelector.replace('name="CONDUCTOR_ID"','name="CONDUCTOR_ID_VISTA"').replace('<select ','<select disabled aria-readonly="true" ')+`<input type="hidden" name="CONDUCTOR_ID" value="${esc(selectedDriver)}">`:driverSelector}</label>
          <label class="field"><span>Kilometraje actual</span><input name="KILOMETRAJE" type="number" min="0" required inputmode="numeric" placeholder="Ej. 125600"></label>
          <label class="field"><span>Nivel de combustible/carga</span><select name="NIVEL_COMBUSTIBLE" required><option value="">Seleccione</option><option>Vacío / crítico</option><option>1/4</option><option>1/2</option><option>3/4</option><option>Lleno</option><option>No aplica</option></select></label>
        </div>
        <div class="checkin-bulk-actions full"><button class="btn soft" type="button" data-checkin-all-ok>✓ Marcar todos conforme</button><button class="btn soft" type="button" data-checkin-clear>Limpiar respuestas</button><span>Las fallas deben incluir una observación.</span></div>
        ${checkinInlineItemsMarkup()}
        <label class="field full"><span>Observaciones generales</span><textarea name="OBSERVACIONES" placeholder="Indique testigos del tablero, daños, ruidos o cualquier condición adicional"></textarea></label>
        <label class="field full"><span>Nombre o firma del conductor</span><input name="FIRMA_CONDUCTOR" value="${esc(currentUser.NOMBRE||'')}" required></label>
        <label class="checkin-confirm full"><input type="checkbox" name="CONFIRMACION_CONDUCTOR" value="SI" required><span>Confirmo que revisé personalmente cada punto y que la información registrada es correcta.</span></label>
        <div class="form-actions checkin-submit-actions"><button class="btn primary" type="submit">Guardar y evaluar check-in</button></div>
      </form>
    </article>`;
  }

  async function renderCheckin() {
    const data=await checkinContext(),vehicleMap=Object.fromEntries(data.vehicles.map(v=>[v.ID,v])),driverMap=Object.fromEntries(data.drivers.map(d=>[d.ID,d]));
    const driverProfile=String(currentUser?.ROL_ID||'').toUpperCase()==='ROL-CONDUCTOR',controlProfile=puedeVerTrazabilidadRutas();
    const approved=data.rows.filter(row=>checkinVisualState(row)==='Aprobado').length,pending=data.rows.filter(row=>['Pendiente','Bloqueado'].includes(row.ESTADO_REVISION)).length,annulled=data.rows.filter(row=>row.ESTADO_REVISION==='Anulado'||row.ESTADO_REVISION==='Rechazado').length;
    const rows=controlProfile?data.rows.map(row=>checkinRow(row,vehicleMap,driverMap)).join(''):'';
    const create=driverProfile?(hasPermission('CHECKIN','CREAR')?'<button class="btn primary" data-open-checkin-qr>▦ Escanear QR del vehículo</button>':''):`${hasPermission('CHECKIN','ASIGNAR_VEHICULO')?'<button class="btn primary" data-assign-checkin-vehicle>＋ Asignar vehículo y alertar</button>':''}${hasPermission('CHECKIN','CREAR')?'<button class="btn soft" data-focus-checkin>↓ Abrir lista de chequeo</button>':''}`;
    const description=driverProfile?'Escanee primero el QR físico del vehículo asignado. Solo después de validar la patente se mostrará la lista de inspección.':'Operador, Administrador y Gerencia pueden visualizar las inspecciones y revisar cualquier resultado No conforme.';
    return heading('INSPECCIÓN PREOPERACIONAL','Check-in vehicular',description,`<button class="btn soft" data-sync>↻ Actualizar</button>${create}`)+
      reciboCheckinMarkup()+
      `<div class="checkin-process"><article><i>1</i><div><b>${driverProfile?'Escanear QR':'Vehículo asignado'}</b><span>${driverProfile?'Valida que sea exactamente el vehículo asignado.':'Confirme vehículo y conductor.'}</span></div></article><article><i>2</i><div><b>Completar ${checkinCatalog.length} controles</b><span>Todo No conforme quedará pendiente de decisión administrativa.</span></div></article><article><i>3</i><div><b>Revisión y continuidad</b><span>Operador, Administrador y Gerencia reciben la inspección; desde ella pueden ir directo a Asignación de Ruta.</span></div></article></div>`+
      checkinInlineFormMarkup()+
      (controlProfile?`<div class="live-strip">${liveStat('✓','Aprobados vigentes',approved,'online')}${liveStat('⌛','Pendientes de decisión',pending,pending?'warning':'')}${liveStat('⊘','Anulados',annulled,annulled?'warning':'')}${liveStat('▤','Inspecciones',data.rows.length)}</div><article class="card"><div class="card-header"><div><h3>Inspecciones registradas</h3><p>Vista desplegada para Operador, Administrador y Gerencia.</p></div></div><div class="toolbar"><label class="search-box"><span>⌕</span><input data-table-search placeholder="Buscar por patente, conductor o estado"></label><button class="btn soft push" data-nav="checkinHistory">Historial completo</button></div><div data-filter-table>${table(['Check-in','Vehículo','Conductor','Resultado','Estado','Fallas','Vigente hasta','Acciones'],rows,'No existen check-ins registrados.')}</div></article>`:'');
  }
  async function renderCheckinApprovals() {
    const data=await checkinContext(),vehicleMap=Object.fromEntries(data.vehicles.map(v=>[v.ID,v])),driverMap=Object.fromEntries(data.drivers.map(d=>[d.ID,d]));
    const pending=data.rows.filter(row=>['Pendiente','Bloqueado'].includes(row.ESTADO_REVISION)&&row.UTILIZADO!=='SI');
    const rows=pending.map(row=>checkinRow(row,vehicleMap,driverMap,true)).join('');
    return heading('CONTROL DE SEGURIDAD','Aprobación o anulación de check-ins','Toda inspección con al menos un No conforme debe ser decidida por Operador, Administrador o Gerencia.',`<button class="btn soft" data-sync>↻ Actualizar</button>`)+
      `<div class="operation-banner checkin-warning"><i>!</i><div><h3>Decisión obligatoria para No conforme</h3><p>El perfil autorizado puede Aprobar el check-in —dejando auditoría de la autorización— o Anularlo para exigir una nueva inspección.</p></div></div>`+
      `<div class="live-strip">${liveStat('⌛','Pendientes de decisión',pending.length,pending.length?'warning':'')}${liveStat('⊘','Anulados hoy',data.rows.filter(r=>['Anulado','Rechazado'].includes(r.ESTADO_REVISION)&&String(r.FECHA_REVISION||r.FECHA_HORA).slice(0,10)===new Date().toISOString().slice(0,10)).length,'warning')}${liveStat('✓','Aprobados hoy',data.rows.filter(r=>r.ESTADO_REVISION==='Aprobado'&&String(r.FECHA_REVISION||r.FECHA_HORA).slice(0,10)===new Date().toISOString().slice(0,10)).length,'online')}</div>`+
      `<article class="card"><div class="toolbar"><label class="search-box"><span>⌕</span><input data-table-search placeholder="Buscar check-in pendiente"></label><button class="btn soft push" data-nav="checkinHistory">Abrir historial</button></div><div data-filter-table>${table(['Check-in','Vehículo','Conductor','Resultado','Estado','Fallas','Vigente hasta','Acciones'],rows,'No hay check-ins pendientes de decisión.')}</div></article>`;
  }
  async function renderCheckinHistory() {
    const data=await checkinContext(),vehicleMap=Object.fromEntries(data.vehicles.map(v=>[v.ID,v])),driverMap=Object.fromEntries(data.drivers.map(d=>[d.ID,d]));
    const rows=data.rows.map(row=>checkinRow(row,vehicleMap,driverMap)).join('');
    return heading('TRAZABILIDAD','Historial de check-in','Consulte inspecciones, resultados, aprobaciones, bloqueos y operaciones relacionadas.',`<button class="btn soft" data-sync>↻ Actualizar</button>${puedeExportarFormato('csv')?'<button class="btn soft" data-export="checkins">Exportar CSV</button>':''}`)+
      `<article class="card"><div class="toolbar"><label class="search-box"><span>⌕</span><input data-table-search placeholder="Buscar en el historial"></label><button class="btn primary push" data-nav="checkin">Nuevo check-in</button></div><div data-filter-table>${table(['Check-in','Vehículo','Conductor','Resultado','Estado','Fallas','Vigente hasta','Acciones'],rows,'No existen inspecciones registradas.')}</div></article>`;
  }

  function numeroPuntoDispositivo(value){
    const number=Number(value);return Number.isFinite(number)?number:null;
  }
  function normalizarPuntoOperacionDispositivo(source={}){
    const point=source.point||source;
    const lat=numeroPuntoDispositivo(point.LATITUD??point.latitud??point.PUNTO_OPERACION_LATITUD);
    const lng=numeroPuntoDispositivo(point.LONGITUD??point.longitud??point.PUNTO_OPERACION_LONGITUD);
    if(lat===null||lng===null||lat<-90||lat>90||lng<-180||lng>180)return null;
    return{
      ID:source.row?.ID||source.ID||source.EMPRESA_ID||'',
      PUNTO_OPERACION_NOMBRE:point.NOMBRE||point.nombre||point.PUNTO_OPERACION_NOMBRE||'Base operacional',
      PUNTO_OPERACION_DIRECCION:point.DIRECCION||point.direccion||point.PUNTO_OPERACION_DIRECCION||source.DIRECCION||'Base operacional',
      PUNTO_OPERACION_LATITUD:lat,
      PUNTO_OPERACION_LONGITUD:lng,
      RADIO_INICIO_METROS:Math.max(10,Number(point.RADIO_INICIO_METROS??point.radioInicio??150)),
      RADIO_FIN_METROS:Math.max(10,Number(point.RADIO_FIN_METROS??point.radioFin??150)),
      PRECISION_GPS_MAXIMA_METROS:Math.max(10,Number(point.PRECISION_GPS_MAXIMA_METROS??point.precisionMaxima??120)),
      VALIDAR_UBICACION_OPERACION:'SI',RETORNO_BASE_OBLIGATORIO:'SI',
      PUNTO_OPERACION_CONFIRMADO:'SI',
      PUNTO_OPERACION_CONFIRMADO_EN:source.sincronizadoEn||source.PUNTO_OPERACION_CONFIRMADO_EN||new Date().toISOString(),
      PUNTO_OPERACION_ORIGEN:source.origen||source.PUNTO_OPERACION_ORIGEN||'SERVIDOR'
    };
  }
  function cargarPuntoOperacionDispositivo(){
    try{return normalizarPuntoOperacionDispositivo(JSON.parse(localStorage.getItem(operationalPointDeviceKey)||'null')||{});}catch(_){return null;}
  }
  function guardarPuntoOperacionDispositivo(source,origen='SERVIDOR'){
    const normalized=normalizarPuntoOperacionDispositivo({...source,origen});
    if(!normalized)return null;
    try{localStorage.setItem(operationalPointDeviceKey,JSON.stringify(normalized));window.dispatchEvent(new CustomEvent('flotas:punto-operacional-dispositivo',{detail:normalized}));}catch(_){}
    return normalized;
  }
  function empresaConPuntoDispositivo(company){
    const baseCompany=company&&typeof company==='object'?company:{};
    const cached=cargarPuntoOperacionDispositivo();
    if(cached)return{...baseCompany,...cached};
    return baseCompany;
  }
  async function sincronizarPuntoOperacionDispositivo({forzar=false,silencioso=true}={}){
    const cached=cargarPuntoOperacionDispositivo();
    if(cached)currentCompany={...(currentCompany||{}),...cached};
    try{
      const result=await api.request('getOperationalPoint',{cache:!forzar,force:forzar});
      if(result?.configurado&&result?.point){
        const stored=guardarPuntoOperacionDispositivo({...result,row:result.row||{}},'SERVIDOR');
        currentCompany={...(currentCompany||{}),...(result.row||{}),...(stored||{})};
        return configuracionPuntoOperacion(currentCompany);
      }
      return configuracionPuntoOperacion(currentCompany||{});
    }catch(error){
      if(!silencioso&&!cached)throw error;
      return configuracionPuntoOperacion(currentCompany||{});
    }
  }

  function seleccionarEmpresaPrincipal(rows=[]){
    return rows.slice().sort((a,b)=>{
      const activeA=String(a.ESTADO||'Activo')==='Activo'?1:0,activeB=String(b.ESTADO||'Activo')==='Activo'?1:0;
      if(activeA!==activeB)return activeB-activeA;
      return new Date(b.ACTUALIZADO_EN||b.CREADO_EN||0)-new Date(a.ACTUALIZADO_EN||a.CREADO_EN||0);
    })[0]||null;
  }
  function configuracionPuntoOperacion(company=currentCompany||{}){
    const effective=empresaConPuntoDispositivo(company||{}),latitudeText=String(effective.PUNTO_OPERACION_LATITUD??'').trim(),longitudeText=String(effective.PUNTO_OPERACION_LONGITUD??'').trim(),latitude=Number(latitudeText),longitude=Number(longitudeText);
    const configured=Boolean(latitudeText&&longitudeText)&&Number.isFinite(latitude)&&Number.isFinite(longitude)&&String(effective.VALIDAR_UBICACION_OPERACION||'SI')!=='NO';
    if(configured&&effective!==company)currentCompany={...(currentCompany||{}),...effective};
    return{configurada:configured,nombre:effective.PUNTO_OPERACION_NOMBRE||'Base operacional',direccion:effective.PUNTO_OPERACION_DIRECCION||effective.DIRECCION||'Sin dirección',latitud:latitude,longitud:longitude,radioInicio:Math.max(10,Number(effective.RADIO_INICIO_METROS||150)),radioFin:Math.max(10,Number(effective.RADIO_FIN_METROS||150)),precisionMaxima:Math.max(10,Number(effective.PRECISION_GPS_MAXIMA_METROS||120)),origen:effective.PUNTO_OPERACION_ORIGEN||'SERVIDOR',confirmadoEn:effective.PUNTO_OPERACION_CONFIRMADO_EN||''};
  }
  function ubicacionLocalConfiable(location={},maxAge=180000){
    const lat=Number(location.latitud),lng=Number(location.longitud),precision=Number(location.precision),fecha=Number(location.fecha||0);
    return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180&&!(Math.abs(lat)<0.000001&&Math.abs(lng)<0.000001)&&Number.isFinite(precision)&&precision>0&&precision<=Number(config.PRECISION_GPS_MAPA_MAXIMA_METROS||120)&&fecha>0&&Date.now()-fecha<=maxAge&&Date.now()-fecha>=-60000&&location.confiable!==false;
  }
  function guardarUltimaUbicacionDispositivo(location={}){
    const latitud=Number(location.latitud),longitud=Number(location.longitud),precision=Math.max(1,Number(location.precision||9999)),fecha=Number(location.fecha||Date.now());
    if(!Number.isFinite(latitud)||!Number.isFinite(longitud))return null;
    const direccion=String(location.direccion||ultimaPosicionConocida?.direccion||lastAddressLookup.address||'').trim();
    const clean={latitud,longitud,precision,fecha,fuente:location.fuente||'GPS del dispositivo',direccion,confiable:location.confiable!==false};
    ultimaPosicionConocida=clean;
    try{localStorage.setItem(ultimaUbicacionStorageKey(),JSON.stringify(clean));}catch(_){}
    return clean;
  }
  function cargarUltimaUbicacionDispositivo(){
    try{
      const row=JSON.parse(localStorage.getItem(ultimaUbicacionStorageKey())||'null');
      if(!row||!Number.isFinite(Number(row.latitud))||!Number.isFinite(Number(row.longitud)))return null;
      const clean={latitud:Number(row.latitud),longitud:Number(row.longitud),precision:Math.max(1,Number(row.precision||9999)),fecha:Number(row.fecha||0),fuente:row.fuente||'Última ubicación conocida',direccion:String(row.direccion||''),confiable:row.confiable!==false};
      return ubicacionLocalConfiable(clean,1800000)?clean:null;
    }catch(_){return null;}
  }
  function posicionNavegadorUnaVez({enableHighAccuracy=true,timeout=5000,maximumAge=15000}={}){
    if(!navigator.geolocation)return Promise.reject(new Error('UBICACION_OPERACION_REQUERIDA'));
    return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(position=>{
      const location=guardarUltimaUbicacionDispositivo({latitud:position.coords.latitude,longitud:position.coords.longitude,precision:position.coords.accuracy||9999,fecha:position.timestamp||Date.now(),fuente:enableHighAccuracy?'GPS actual':'Ubicación aproximada'});
      resolve(location);
    },error=>reject(error),{enableHighAccuracy,timeout,maximumAge}));
  }
  async function obtenerUbicacionNavegador({timeout=null,maximumAge=null,aceptarRespaldo=true,maximumAgeAproximada=null}={}){
    const cachedImmediate=ultimaPosicionConocida||cargarUltimaUbicacionDispositivo(),immediateAge=Number(config.ANTIGUEDAD_UBICACION_INMEDIATA_INICIO_MILISEGUNDOS||120000);
    if(aceptarRespaldo&&cachedImmediate&&Date.now()-Number(cachedImmediate.fecha||0)<=immediateAge)return{...cachedImmediate,fuente:'Ubicación reciente del dispositivo',desdeCache:true};
    if(!navigator.geolocation){
      const cached=cargarUltimaUbicacionDispositivo(),maxAge=Number(config.ANTIGUEDAD_UBICACION_INICIO_MILISEGUNDOS||1800000);
      if(aceptarRespaldo&&cached&&Date.now()-cached.fecha<=maxAge)return{...cached,fuente:'Última ubicación disponible',desdeCache:true};
      throw new Error('UBICACION_OPERACION_REQUERIDA');
    }
    const highTimeout=Number(timeout||config.TIEMPO_GPS_ALTA_PRECISION_INICIO_MILISEGUNDOS||5000);
    const highAge=maximumAge==null?15000:Number(maximumAge);
    try{return await posicionNavegadorUnaVez({enableHighAccuracy:true,timeout:highTimeout,maximumAge:highAge});}
    catch(firstError){
      try{return await posicionNavegadorUnaVez({enableHighAccuracy:false,timeout:Number(config.TIEMPO_GPS_RESPALDO_INICIO_MILISEGUNDOS||3000),maximumAge:maximumAgeAproximada==null?(aceptarRespaldo?300000:0):Number(maximumAgeAproximada)});}
      catch(secondError){
        const cached=ultimaPosicionConocida||cargarUltimaUbicacionDispositivo(),maxAge=Number(config.ANTIGUEDAD_UBICACION_INICIO_MILISEGUNDOS||1800000);
        if(aceptarRespaldo&&cached&&Date.now()-Number(cached.fecha||0)<=maxAge)return{...cached,fuente:'Última ubicación disponible',desdeCache:true};
        const error=secondError||firstError;
        if(error?.code===1)throw new Error('UBICACION_OPERACION_REQUERIDA');
        if(error?.code===3)throw new Error('TIEMPO_DE_ESPERA_AGOTADO');
        throw new Error('UBICACION_OPERACION_REQUERIDA');
      }
    }
  }
  function resumenValidacionLocalUbicacion(location,base,phase='INICIO'){
    const distance=distanciaMetros(location.latitud,location.longitud,base.latitud,base.longitud),radius=phase==='FIN'?base.radioFin:base.radioInicio,accuracy=Math.max(1,Number(location.precision||9999)),precisionValid=accuracy<=base.precisionMaxima;
    const tolerance=phase==='FIN'&&!precisionValid?Math.min(Math.max(0,accuracy),Number(config.TOLERANCIA_GPS_IMPRECISA_FIN_METROS||500)):0;
    const inside=distance<=radius+(phase==='FIN'?tolerance:0),valid=phase==='INICIO'?true:inside;
    return{...location,distancia:Math.round(distance),radio:radius,valida:valid,dentroPerimetro:inside,precisionValida:precisionValid,toleranciaPrecision:Math.round(tolerance),precisionBaja:!precisionValid};
  }
  function pintarEstadoUbicacionOperacion(container,result,phase='INICIO'){
    if(!container)return;
    if(phase==='INICIO'){
      const source=result.desdeCache?'Última ubicación disponible':(result.fuente||'GPS del dispositivo'),outside=!result.dentroPerimetro,low=!result.precisionValida;
      container.className=`operation-location-status valid ${low?'imprecise':''}`;
      container.innerHTML=`<i>✓</i><div><b>Ubicación capturada correctamente</b><span>${result.distancia} m de la base · precisión ±${Math.round(result.precision)} m · ${esc(source)}</span><small>${outside?'El inicio se permitirá desde esta ubicación y quedará registrado como fuera de la base.':low?'El inicio se permitirá y la precisión baja quedará registrada.':'Coordenadas listas para iniciar la operación.'}</small></div>`;
      return;
    }
    const low=Boolean(result.precisionBaja);container.className=`operation-location-status ${result.valida?'valid':'invalid'} ${low?'imprecise':''}`;container.innerHTML=`<i>${result.valida?'✓':'!'}</i><div><b>${result.valida?(low?'Cierre permitido con señal imprecisa':'Ubicación autorizada'):result.precisionValida?'Fuera del perímetro':'Señal GPS imprecisa'}</b><span>${result.distancia} m de la base · radio ${result.radio} m · precisión ±${Math.round(result.precision)} m${low&&result.valida?` · tolerancia aplicada ${result.toleranciaPrecision} m`:''}</span>${result.valida?(low?'<small>La baja precisión quedará registrada en la operación y auditoría.</small>':''):'<small>No se permitirá la finalización porque la ubicación no alcanza el perímetro autorizado.</small>'}</div>`;
  }
  async function capturarUbicacionFormularioOperacion(form,phase='INICIO'){
    const base=configuracionPuntoOperacion();if(!base.configurada)throw new Error('PUNTO_OPERACION_NO_CONFIGURADO');const statusNode=form.querySelector('[data-operation-location-status]');if(statusNode){statusNode.className='operation-location-status loading';statusNode.innerHTML=`<i>⌖</i><div><b>Capturando ubicación…</b><span>${phase==='INICIO'?'Se usará la ubicación actual o la última disponible sin bloquear el inicio.':'Mantenga el GPS activo y permanezca en el punto autorizado.'}</span></div>`;}
    const location=await obtenerUbicacionNavegador({aceptarRespaldo:phase==='INICIO'}),result=resumenValidacionLocalUbicacion(location,base,phase),prefix=phase==='FIN'?'FIN_':'INICIO_';form.elements[prefix+'LATITUD'].value=location.latitud;form.elements[prefix+'LONGITUD'].value=location.longitud;form.elements[prefix+'PRECISION'].value=Math.max(1,Number(location.precision||9999));pintarEstadoUbicacionOperacion(statusNode,result,phase);return result;
  }
  function rutasDisponiblesOperacion(form){const vehicle=form.elements.VEHICULO_ID?.value||'',driver=form.elements.CONDUCTOR_ID?.value||'',select=form.elements.RUTA_ID;if(!select)return;const routes=(cacheListasFormulario.get('routes')||[]).filter(route=>['Asignada','En curso'].includes(route.ESTADO)&&(!driver||route.CONDUCTOR_ID===driver)&&(!route.VEHICULO_ID||!vehicle||route.VEHICULO_ID===vehicle)&&!route.OPERACION_ID);const selected=select.value;select.innerHTML=`<option value="">Sin ruta asignada · salida y regreso a base</option>${routes.map(route=>`<option value="${esc(route.ID)}" ${route.ID===selected?'selected':''}>${esc(route.NOMBRE||route.ID)} · ${esc(route.DESTINO||'')}</option>`).join('')}`;actualizarDestinoOperacion(form);}
  function actualizarDestinoOperacion(form){const routeId=form.elements.RUTA_ID?.value||'',route=(cacheListasFormulario.get('routes')||[]).find(item=>item.ID===routeId),base=configuracionPuntoOperacion(),field=form.elements.DESTINO;if(field)field.value=route?.DESTINO||base.direccion;const type=form.querySelector('[data-operation-type]');if(type)type.textContent=route?'Ruta asignada con regreso obligatorio a la base':'Salida y regreso al mismo punto base';}
  function operationVerificationMarkup(op){
    const started=String(op.VALIDACION_INICIO||'').startsWith('CAPTURADA')||op.VALIDACION_INICIO==='VALIDADA';
    const checkin=Boolean(op.CHECKIN_ID),gpsStart=Number.isFinite(Number(op.INICIO_LATITUD))&&Number.isFinite(Number(op.INICIO_LONGITUD)),active=op.ESTADO==='Activa',finished=['Finalizada','Completada'].includes(String(op.ESTADO||'')),finishOk=['VALIDADA','VALIDADA_PRECISION_BAJA'].includes(String(op.VALIDACION_FIN||''));
    const steps=[['Check-in aprobado',checkin],['GPS de inicio capturado',started||gpsStart],['Operación activa y vinculada',active||finished],['Cierre verificado',finished?finishOk:null]];
    const completed=steps.filter(([,value])=>value===true).length,total=steps.filter(([,value])=>value!==null).length;
    return `<div class="operation-verification ${finished&&finishOk?'complete':''}"><div class="operation-verification-head"><span><i>${finished&&finishOk?'✓':'⌁'}</i><b>${finished&&finishOk?'Verificación completada':'Control de operación'}</b></span><em>${completed}/${total}</em></div><div class="operation-verification-steps">${steps.map(([label,value])=>value===null?'':`<span class="${value?'ok':'pending'}"><i>${value?'✓':'○'}</i>${esc(label)}</span>`).join('')}</div></div>`;
  }
  async function renderOperations() {
    const selectedLimit=limiteRegistrosActual();
    const summary=await api.request('operationsSummary',{limit:selectedLimit==='TODOS'?limiteRegistrosPredeterminado:Number(selectedLimit),cache:false});
    const allOperations=selectedLimit==='TODOS'?await solicitarListaPaginada('operations',{limit:'TODOS',cache:false}):null;
    const operationRows=allOperations?.rows||summary.operations||[],active=operationRows.filter(row=>row.ESTADO==='Activa');
    const vehicles=summary.vehicles||[],drivers=summary.drivers||[],routes=summary.routes||[];

    if(summary.company||summary.point){
      const pointData=summary.point?{
        PUNTO_OPERACION_NOMBRE:summary.point.NOMBRE,
        PUNTO_OPERACION_DIRECCION:summary.point.DIRECCION,
        PUNTO_OPERACION_LATITUD:summary.point.LATITUD,
        PUNTO_OPERACION_LONGITUD:summary.point.LONGITUD,
        RADIO_INICIO_METROS:summary.point.RADIO_INICIO_METROS,
        RADIO_FIN_METROS:summary.point.RADIO_FIN_METROS,
        PRECISION_GPS_MAXIMA_METROS:summary.point.PRECISION_GPS_MAXIMA_METROS,
        VALIDAR_UBICACION_OPERACION:'SI',
      }:{};
      const stored=summary.pointConfigured?guardarPuntoOperacionDispositivo({...summary.company,...pointData,sincronizadoEn:summary.generatedAt},'SERVIDOR'):null;
      currentCompany={...(currentCompany||{}),...(summary.company||{}),...(stored||{})};
    }

    guardarListaFormulario('operations',operationRows);
    guardarListaFormulario('vehicles',vehicles);
    guardarListaFormulario('drivers',drivers);
    guardarListaFormulario('routes',routes);

    const base=configuracionPuntoOperacion();
    const vehicleMap=Object.fromEntries(vehicles.map(v=>[v.ID,v]));
    const driverMap=Object.fromEntries(drivers.map(d=>[d.ID,d]));
    const routeMap=Object.fromEntries(routes.map(r=>[r.ID,r]));

    const activeHtml=active.map(op=>`<article class="operation-card"><header><div><h4>${esc(op.ID)} · ${esc(vehicleMap[op.VEHICULO_ID]?.PATENTE||op.VEHICULO_ID)}</h4><small>${esc(driverMap[op.CONDUCTOR_ID]?.NOMBRE||op.CONDUCTOR_ID)}</small></div>${status(op.ESTADO)}</header><div class="operation-route">${esc(op.ORIGEN||op.BASE_DIRECCION||'Base')} → ${esc(op.DESTINO||op.PUNTO_RETORNO||'Base')}</div><div class="operation-meta"><div><span>INICIO</span><b>${fmtDate(op.FECHA_INICIO,true)}</b></div><div><span>KM INICIAL</span><b>${op.KM_INICIO!==''&&op.KM_INICIO!=null?number(op.KM_INICIO):'Opcional'}</b></div><div><span>TIPO</span><b>${esc(op.TIPO_OPERACION||'Regreso a base')}</b></div><div><span>RUTA</span><b>${esc(routeMap[op.RUTA_ID]?.NOMBRE||op.RUTA_ID||'Sin ruta')}</b></div><div><span>INICIO VALIDADO</span><b>${String(op.VALIDACION_INICIO||'').startsWith('CAPTURADA')||op.VALIDACION_INICIO==='VALIDADA'?`${number(op.DISTANCIA_INICIO_BASE_METROS)} m de base · ${esc(String(op.VALIDACION_INICIO||'').replaceAll('_',' ').toLowerCase())}`:'Pendiente'}</b></div><div><span>CHECK-IN</span><b>${esc(op.CHECKIN_ID||'Sin registro')}</b></div><div><span>RETORNO</span><b>${esc(op.PUNTO_RETORNO||op.BASE_DIRECCION||'Base operacional')}</b></div></div>${operationVerificationMarkup(op)}<div class="operation-card-actions">${driverMap[op.CONDUCTOR_ID]?.TELEFONO?`<button class="btn whatsapp small" data-whatsapp-driver="${esc(op.CONDUCTOR_ID)}">◉ WhatsApp</button>`:''}${puedeReenviarAlertaAsignacion()?`<button class="btn soft small" data-resend-assignment="OPERACION:${esc(op.ID)}">🔔 Reenviar alerta</button>`:''}${hasPermission('OPERACIONES','EDITAR_ADMIN')?`<button class="btn soft small" data-edit-operation-admin="${op.ID}">Editar</button>`:''}${puedeFinalizarOperacion()?`<button class="btn danger small" data-finish-operation="${op.ID}">${currentUser.ROL_ID==='ROL-CONDUCTOR'?'Finalizar en punto base':'Finalizar operación'}</button>`:''}${hasPermission('OPERACIONES','ELIMINAR_ADMIN')?`<button class="btn danger small" data-delete-operation-admin="${op.ID}">Eliminar</button>`:''}</div></article>`).join('');

    const opRows=operationRows.map(op=>`<tr data-filter-date="${esc(op.FECHA_INICIO||op.CREADO_EN||'')}" data-search-row="${esc(`${op.ID} ${vehicleMap[op.VEHICULO_ID]?.PATENTE||op.VEHICULO_ID} ${driverMap[op.CONDUCTOR_ID]?.NOMBRE||op.CONDUCTOR_ID} ${op.TIPO_OPERACION||''} ${routeMap[op.RUTA_ID]?.NOMBRE||op.RUTA_ID||''} ${op.ESTADO||''}`.toLowerCase())}"><td><strong>${esc(op.ID)}</strong></td><td>${esc(vehicleMap[op.VEHICULO_ID]?.PATENTE||op.VEHICULO_ID)}</td><td>${esc(driverMap[op.CONDUCTOR_ID]?.NOMBRE||op.CONDUCTOR_ID)}</td><td>${esc(op.TIPO_OPERACION||'—')}</td><td>${esc(routeMap[op.RUTA_ID]?.NOMBRE||op.RUTA_ID||'Sin ruta')}</td><td>${fmtDate(op.FECHA_INICIO,true)}</td><td>${op.KM_INICIO!==''&&op.KM_INICIO!=null?number(op.KM_INICIO):'—'} / ${op.KM_FIN!==''&&op.KM_FIN!=null?number(op.KM_FIN):'—'}</td><td><span class="operation-verified-badge ${['Finalizada','Completada'].includes(String(op.ESTADO||''))&&['VALIDADA','VALIDADA_PRECISION_BAJA'].includes(String(op.VALIDACION_FIN||''))?'complete':'progress'}"><i>${String(op.VALIDACION_INICIO||'').startsWith('CAPTURADA')||op.VALIDACION_INICIO==='VALIDADA'?'✓':'○'}</i>${['Finalizada','Completada'].includes(String(op.ESTADO||''))?'Cierre '+(['VALIDADA','VALIDADA_PRECISION_BAJA'].includes(String(op.VALIDACION_FIN||''))?'verificado':'pendiente'):'Inicio verificado'}</span></td><td>${status(op.ESTADO)}</td><td>${puedeReenviarAlertaAsignacion()||hasPermission('OPERACIONES','EDITAR_ADMIN')||hasPermission('OPERACIONES','ELIMINAR_ADMIN')?`<div class="row-button-stack">${puedeReenviarAlertaAsignacion()?`<button class="btn soft small" data-resend-assignment="OPERACION:${esc(op.ID)}">🔔 Reenviar</button>`:''}${hasPermission('OPERACIONES','EDITAR_ADMIN')?`<button class="btn soft small" data-edit-operation-admin="${op.ID}">Editar</button>`:''}${hasPermission('OPERACIONES','ELIMINAR_ADMIN')?`<button class="btn danger small" data-delete-operation-admin="${op.ID}">Eliminar</button>`:''}</div>`:'—'}</td></tr>`).join('');

    const enabled=base.configurada,createActions=`<button class="btn soft" data-sync>↻ Actualizar</button>`+(hasPermission('OPERACIONES','INICIAR')&&enabled?(currentUser.ROL_ID==='ROL-CONDUCTOR'?'<button class="btn primary" data-open-qr>▦ Validar QR e iniciar</button>':'<button class="btn soft" data-open-qr>▦ Escanear QR</button><button class="btn primary" data-new-operation>＋ Nueva operación</button>'):'');
    const availability=`<div class="operation-availability"><span><b>${number(summary.availableVehicles??vehicles.filter(row=>row.ESTADO==='Disponible').length)}</b> vehículos disponibles</span><span><b>${number(summary.availableDrivers??drivers.filter(row=>row.ESTADO==='Disponible').length)}</b> conductores disponibles</span><span><b>${number(summary.availableRoutes??routes.filter(row=>['Asignada','En curso'].includes(row.ESTADO)).length)}</b> rutas vigentes</span><small>Respuesta preparada en ${number(summary.processingMilliseconds||0)} ms</small></div>`;
    const baseBanner=enabled?`<div class="operation-geofence-banner"><i>⌖</i><div><h3>${esc(base.nombre)}</h3><p>${esc(base.direccion)} · Inicio dentro de ${number(base.radioInicio)} m · Finalización dentro de ${number(base.radioFin)} m · Precisión máxima de inicio ±${number(base.precisionMaxima)} m. En el cierre, una señal imprecisa puede aceptarse con tolerancia controlada y registro de auditoría.</p></div>${puedeAdministrarPuntoOperacion()?'<button class="btn soft" data-nav="settings">Configurar punto</button>':''}</div>`:`<div class="operation-geofence-banner blocked"><i>!</i><div><h3>Punto operacional no configurado</h3><p>Nadie podrá iniciar o finalizar operaciones hasta que el Administrador defina la ubicación base en Configuración.</p></div>${puedeAdministrarPuntoOperacion()?'<div class="operation-banner-actions"><button class="btn soft" data-nav="settings">Configuración avanzada</button><button class="btn primary" data-quick-base-setup>⌖ Configurar con mi ubicación</button></div>':''}</div>`;
    const total=Number(summary.total??operationRows.length),shown=operationRows.length,historyNote=total>shown?`Mostrando ${shown} registros prioritarios de ${number(total)}. Las operaciones activas siempre se incluyen.`:`${shown} registros cargados.`;

    return heading('CONTROL DE VIAJES','Operaciones','Carga rápida: operaciones activas, catálogos disponibles y el historial reciente.',createActions)+baseBanner+availability+
      `<div class="operation-banner"><i>⚡</i><div><h3>Modo de carga rápida activo</h3><p>${esc(historyNote)} El historial completo permanece guardado en la base y en auditoría.</p></div></div>`+
      `<div class="operation-layout"><article class="card"><div class="card-header"><div><h3>Operaciones activas</h3><p>${active.length} recorridos en curso</p></div></div>${activeHtml||empty('⇄','No hay operaciones activas',enabled?'Cree una operación desde el punto base autorizado.':'Configure primero el punto base operacional.')}</article><article class="card"><div class="card-header"><div><h3>Reglas obligatorias</h3><p>Aplicadas en el servidor</p></div></div><div class="requirement-list"><div><i>1</i><span><b>Check-in aprobado</b><small>Se consulta solo al abrir el formulario de inicio.</small></span></div><div><i>2</i><span><b>Inicio dentro del perímetro</b><small>El GPS debe estar dentro de ${number(base.radioInicio)} m de la base.</small></span></div><div><i>3</i><span><b>Ruta opcional vinculada</b><small>La ruta define el destino, pero no elimina el regreso obligatorio.</small></span></div><div><i>4</i><span><b>Finalización en la base</b><small>El vehículo debe regresar al perímetro autorizado.</small></span></div></div></article></div>`+
      `<article class="card"><div class="card-header"><div><h3>Historial reciente de operaciones</h3><p>${esc(historyNote)}</p></div></div><div class="toolbar"><label class="search-box"><span>⌕</span><input data-table-search placeholder="Buscar operación, vehículo, conductor o estado"></label></div>${table(['Operación','Vehículo','Conductor','Tipo','Ruta','Inicio','KM inicio / final','Ubicación','Estado','Acciones'],opRows,'No existen operaciones registradas.')}</article>`;
  }


  async function solicitarListaSegura(resource,limit=limiteRegistrosActual()) {
    try {
      const result=await solicitarListaPaginada(resource,{limit,cache:false});
      guardarListaFormulario(resource,result.rows||[]);
      return {rows:result.rows||[],total:result.total??(result.rows||[]).length,error:null};
    } catch(error) {
      return {rows:[],total:0,error};
    }
  }

  const ESTADOS_RUTA_CANONICOS=['Asignada','En curso','Completada','Cancelada'];
  function claveEstadoRuta(value){
    const key=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
    return ({'asignado':'asignada','en ruta':'en curso','iniciada':'en curso','activa':'en curso','finalizada':'completada','cancelado':'cancelada'})[key]||key;
  }
  function estadosRutaFiltrables(routes=[]){
    const disponibles=new Map(ESTADOS_RUTA_CANONICOS.map(estado=>[claveEstadoRuta(estado),estado]));
    routes.forEach(route=>{const estado=String(route?.ESTADO||'').trim();if(estado&&!disponibles.has(claveEstadoRuta(estado)))disponibles.set(claveEstadoRuta(estado),estado);});
    return [...disponibles.values()];
  }
  function selectorEstadosRuta(routes=[]){
    const conteos=new Map();
    routes.forEach(route=>{const key=claveEstadoRuta(route?.ESTADO);if(key)conteos.set(key,(conteos.get(key)||0)+1);});
    const options=estadosRutaFiltrables(routes).map(estado=>{const key=claveEstadoRuta(estado),label=key==='en curso'?'En curso / En ruta':estado;return `<option value="${esc(key)}">${esc(label)} (${number(conteos.get(key)||0)})</option>`;}).join('');
    return `<label class="route-state-filter"><span>Estado de la ruta</span><select data-route-state-filter aria-label="Filtrar rutas por estado"><option value="">Todos los estados (${number(routes.length)})</option>${options}</select></label>`;
  }

  async function renderRoutes() {
    const [routesResult,driversResult,vehiclesResult]=await Promise.all([
      solicitarListaSegura('routes'),solicitarListaSegura('drivers',1000),solicitarListaSegura('vehicles',1000)
    ]);
    if(routesResult.error)throw routesResult.error;
    const driverMap=Object.fromEntries(driversResult.rows.map(row=>[row.ID,row]));
    const vehicleMap=Object.fromEntries(vehiclesResult.rows.map(row=>[row.ID,row]));
    const routes=routesResult.rows.map(route=>({...route,CONDUCTOR_NOMBRE:driverMap[route.CONDUCTOR_ID]?.NOMBRE||route.CONDUCTOR_ID||'',CONDUCTOR_TELEFONO:driverMap[route.CONDUCTOR_ID]?.TELEFONO||'',VEHICULO_PATENTE:vehicleMap[route.VEHICULO_ID]?.PATENTE||route.VEHICULO_ID||''}));
    guardarListaFormulario('routes',routes);
    const base=configuracionPuntoOperacion();
    const assigned=routes.filter(row=>row.ESTADO==='Asignada');
    const running=routes.filter(row=>row.ESTADO==='En curso');
    const completed=routes.filter(row=>row.ESTADO==='Completada');
    const cancelled=routes.filter(row=>row.ESTADO==='Cancelada');
    const active=[...running,...assigned];
    if(!active.some(row=>String(row.ID)===String(selectedActiveRouteId)))selectedActiveRouteId=String(active[0]?.ID||'');
    const selectedActive=active.find(row=>String(row.ID)===String(selectedActiveRouteId))||active[0]||null;
    const actions=`<button class="btn soft" data-sync>↻ Actualizar</button>${hasPermission('RUTAS','CREAR')?'<button class="btn primary" data-new-route>＋ Asignar ruta</button>':''}`;
    const prerequisites=[];
    if(!base.configurada)prerequisites.push(`<div class="module-diagnostic warning"><i>⌖</i><div><b>La ruta puede asignarse sin geocerca</b><span>Defina manualmente el origen y el destino. El punto operacional solo será obligatorio cuando se intente iniciar o finalizar una operación.</span></div>${puedeAdministrarPuntoOperacion()?'<button class="btn soft" data-nav="settings">Configurar punto para operaciones</button>':''}</div>`);
    if(hasPermission('RUTAS','CREAR')&&!driversResult.rows.length)prerequisites.push(`<div class="module-diagnostic warning"><i>♙</i><div><b>No existen conductores disponibles</b><span>Registre un conductor antes de crear la primera asignación.</span></div><button class="btn soft" data-nav="drivers">Abrir conductores</button></div>`);
    if(hasPermission('RUTAS','CREAR')&&!vehiclesResult.rows.length)prerequisites.push(`<div class="module-diagnostic warning"><i>▣</i><div><b>No existen vehículos registrados</b><span>Registre una unidad para asociarla a la ruta.</span></div><button class="btn soft" data-nav="vehicles">Abrir vehículos</button></div>`);

    const sorted=routes.slice().sort((a,b)=>new Date(b.FECHA_ASIGNACION||b.CREADO_EN||0)-new Date(a.FECHA_ASIGNACION||a.CREADO_EN||0));
    const traceRows=sorted.map(route=>{
      const asignada=routeTraceValue(route,'ASIGNADA','FECHA_ASIGNADA',route.FECHA_ASIGNACION||route.CREADO_EN);
      const aceptada=routeTraceValue(route,'ACEPTADA','FECHA_ACEPTADA','');
      const iniciada=routeTraceValue(route,'INICIADA','FECHA_INICIADA',route.FECHA_INICIO);
      const completada=routeTraceValue(route,'COMPLETADA','FECHA_COMPLETADA',String(route.ESTADO)==='Completada'?route.FECHA_FIN:'');
      const total=Number(route?.KPI_TRAZABILIDAD?.TIEMPO_TOTAL_CICLO_SEGUNDOS||route.TIEMPO_TRANSCURRIDO_SEGUNDOS||0);
      const actionButtons=[];
      if(['Asignada','En curso'].includes(route.ESTADO)&&hasPermission('RUTAS','NAVEGAR'))actionButtons.push(`<a class="btn soft small" href="${esc(navigationUrl(route))}" target="_blank" rel="noopener">Navegar</a>`);
      if(route.ESTADO==='Asignada'&&hasPermission('RUTAS','INICIAR'))actionButtons.push(`<button class="btn primary small" data-route-state="${esc(route.ID)}:En curso">Iniciar</button>`);
      if(['Asignada','En curso'].includes(route.ESTADO)&&hasPermission('RUTAS','COMPLETAR'))actionButtons.push(`<button class="btn primary small" data-route-state="${esc(route.ID)}:Completada" title="Disponible siempre. Un cierre antes del destino queda auditado y genera alertas.">Completar ruta</button>`);
      if(['Asignada','En curso'].includes(route.ESTADO)&&hasPermission('RUTAS','CANCELAR'))actionButtons.push(`<button class="btn danger small" data-route-state="${esc(route.ID)}:Cancelada">Anular</button>`);
      if(hasPermission('RUTAS','CARGAR_EVIDENCIA'))actionButtons.push(`<button class="btn soft small" data-route-evidence="${esc(route.ID)}">📷 Respaldo</button>`);
      actionButtons.push(`<button class="btn soft small" data-route-weather="${esc(route.ID)}">☁ Clima</button>`);
      if(puedeReenviarAlertaAsignacion())actionButtons.push(`<button class="btn soft small" data-resend-assignment="RUTA:${esc(route.ID)}">🔔 Reenviar</button>`);
      if(driverMap[route.CONDUCTOR_ID]?.TELEFONO)actionButtons.push(`<button class="btn whatsapp small" data-whatsapp-driver="${esc(route.CONDUCTOR_ID)}">WhatsApp</button>`);
      return `<tr data-route-filter-state="${esc(claveEstadoRuta(route.ESTADO))}" data-filter-date="${esc(route.FECHA_ASIGNACION||route.CREADO_EN||'')}" data-search-row="${esc(`${route.ID} ${route.NOMBRE} ${route.CONDUCTOR_NOMBRE} ${route.VEHICULO_PATENTE} ${route.DESTINO} ${route.ESTADO}`.toLowerCase())}"><td><strong>${esc(route.ID)}</strong><span class="muted">${esc(route.NOMBRE||'Ruta')}</span></td><td class="route-options-cell"><div class="row-button-stack route-actions-horizontal">${actionButtons.join('')}</div></td><td>${esc(route.CONDUCTOR_NOMBRE||'Sin conductor')}</td><td>${esc(route.VEHICULO_PATENTE||'Sin vehículo')}</td><td><b>${number(Number(route.DISTANCIA_PLANIFICADA_KM||0).toFixed(1))}</b><small>km esperados</small></td><td><b>${number(Number(route.DISTANCIA_REAL_KM||0).toFixed(1))}</b><small>km GPS</small></td><td><b>${Number(route.DESVIACION_DISTANCIA_KM||0)>=0?'+':''}${number(Number(route.DESVIACION_DISTANCIA_KM||0).toFixed(1))} km</b><small>${number(Number(route.DESVIACION_DISTANCIA_PCT||0).toFixed(1))}%</small></td><td><b>${number(Number(route.VELOCIDAD_MAXIMA_KMH||0).toFixed(1))}</b><small>km/h máx.</small></td><td><b>${number(route.EXCESOS_VELOCIDAD_100||0)} / ${number(route.EXCESOS_VELOCIDAD_120||0)}</b><small>&gt;100 / ≥120</small></td><td><b>${number(Number(route.CONSUMO_COMBUSTIBLE_LITROS||0).toFixed(2))} L</b><small>${number(Number(route.RENDIMIENTO_KM_L||0).toFixed(2))} km/L · ${number(Number(route.CONSUMO_L_100KM||0).toFixed(2))} L/100 km</small></td><td>${traceDateMarkup(asignada)}</td><td>${traceDateMarkup(aceptada)}</td><td>${traceDateMarkup(iniciada)}</td><td>${traceDateMarkup(completada)}</td><td><span class="route-trace-duration">${total?esc(formatRouteElapsed(total)):'—'}</span></td><td>${status(route.ESTADO)}</td></tr>`;
    }).join('');

    const activeMarkup=active.length
      ? `<div class="active-route-selector" aria-label="Rutas activas">${active.map(route=>activeRouteChip(route,String(route.ID)===String(selectedActive?.ID))).join('')}</div><div class="active-route-detail" data-active-route-detail>${selectedActive?routeCard(selectedActive):''}</div>`
      : empty('➜','Sin rutas activas','Asigne una ruta para comenzar la planificación.',hasPermission('RUTAS','CREAR')?'<button class="btn primary" data-new-route>Asignar primera ruta</button>':'');
    const traceTable=puedeVerTrazabilidadRutas()?`<article class="card route-trace-card"><div class="card-header"><div><h3>Trazabilidad de rutas</h3><p>Visible únicamente para Operador, Administrador y Gerencia. Fecha arriba y hora debajo.</p></div></div><div class="toolbar route-filter-toolbar"><label class="search-box"><span>⌕</span><input data-table-search placeholder="Buscar ruta, conductor o vehículo"></label>${selectorEstadosRuta(routes)}${puedeExportarFormato('csv')?'<button class="btn soft push" data-export="routes">Exportar CSV</button>':''}</div><div data-filter-table class="route-trace-table">${table(['Ruta','Opciones','Conductor','Vehículo','Km esperados','Km reales','Desvío','Vel. máxima','Alertas velocidad','Combustible / rendimiento','Asignada','Aceptada','Iniciada','Completada','Tiempo total','Estado'],traceRows,'No existen rutas registradas.')}</div></article>`:'';

    return heading('PLANIFICACIÓN OPERACIONAL','Asignación de rutas','Cree, supervise y cierre rutas vinculadas al conductor, vehículo y punto base.',actions)+
      prerequisites.join('')+
      `<div class="live-strip">${liveStat('➜','Asignadas',assigned.length,assigned.length?'warning':'')}${liveStat('●','En curso',running.length,running.length?'online':'')}${liveStat('✓','Completadas',completed.length,'online')}${liveStat('×','Canceladas',cancelled.length,cancelled.length?'warning':'')}</div>`+
      `<div class="route-dashboard"><article class="card active-routes-card"><div class="card-header"><div><h3>Rutas activas</h3><p>${active.length} asignaciones pendientes o en ejecución · seleccione una para desplegar el detalle</p></div></div>${activeMarkup}</article><article class="card"><div class="card-header"><div><h3>Flujo de la ruta</h3><p>Reglas coordinadas con Operaciones</p></div></div><div class="requirement-list"><div><i>1</i><span><b>Origen planificado</b><small>${esc(base.configurada?base.direccion:'Se define al asignar la ruta')}</small></span></div><div><i>2</i><span><b>Destino asignado</b><small>Se envía al conductor con Google Maps o Waze.</small></span></div><div><i>3</i><span><b>Check-in diario por conductor y vehículo</b><small>Al finalizar el check-in, Operador, Administración y Gerencia reciben acceso directo a Asignación de Ruta.</small></span></div><div><i>4</i><span><b>Aceptar inicia la ruta</b><small>Cuando el propio Conductor acepta la alerta, la ruta pasa a En curso, activa GPS y abre el navegador programado.</small></span></div></div></article></div>`+
      traceTable;
  }

  async function renderNotifications() {
    const [notificationsResult,driversResult,usersResult]=await Promise.all([
      solicitarListaSegura('notifications'),solicitarListaSegura('drivers',1000),solicitarListaSegura('users',1000)
    ]);
    if(notificationsResult.error)throw notificationsResult.error;
    const driverMap=Object.fromEntries(driversResult.rows.map(row=>[row.ID,row]));
    const userMap=Object.fromEntries(usersResult.rows.map(row=>[row.ID,row]));
    const notifications=notificationsResult.rows.slice().sort((a,b)=>new Date(b.FECHA_ENVIO||b.CREADO_EN||0)-new Date(a.FECHA_ENVIO||a.CREADO_EN||0));
    guardarListaFormulario('notifications',notifications);
    const unread=notifications.filter(row=>!['SI','TRUE','1'].includes(String(row.LEIDA??row.leida??'NO').trim().toUpperCase()));
    const urgent=unread.filter(row=>['Urgente','Alta'].includes(row.PRIORIDAD));
    const actions=`<button class="btn soft" data-sync>↻ Actualizar</button><button class="btn soft" data-speak-notifications>🔊 Leer pendientes</button><button class="btn soft" data-voice-command>🎙 Comando de voz</button>${hasPermission('NOTIFICACIONES','CREAR')?'<button class="btn primary" data-new-notification>＋ Nueva notificación</button>':''}`;
    const rows=notifications.map(item=>{const recipient=driverMap[item.DESTINATARIO_CONDUCTOR_ID]?.NOMBRE||userMap[item.DESTINATARIO_USUARIO_ID]?.NOMBRE||item.DESTINATARIO_CONDUCTOR_ID||item.DESTINATARIO_USUARIO_ID||'Sin destinatario';const etiqueta=esAdministrador()?'Aceptar como Administrador':puedeAceptarAsignacionesAjenas()?'Aceptar como Operador':'Aceptar';const accion=esNotificacionCheckinListaRuta(item)?`<button class="btn primary small notification-direct-action" data-checkin-route-notification="${esc(item.ID)}">▤ Ver inspección</button>`:item.LEIDA==='SI'?'—':esAvisoAsignacion(item)?`<button class="btn primary small" data-accept-assignment="${item.ID}">✓ ${etiqueta}</button>`:`<button class="btn soft small" data-read-notification="${item.ID}">Marcar leída</button>`;return `<tr data-filter-date="${esc(item.FECHA_ENVIO||item.CREADO_EN||'')}" data-search-row="${esc(`${item.TITULO} ${item.MENSAJE} ${recipient} ${item.PRIORIDAD} ${item.TIPO}`.toLowerCase())}"><td>${item.LEIDA==='SI'?'<span class="status">Leída</span>':'<span class="status warning">Pendiente</span>'}</td><td><strong>${esc(item.TITULO)}</strong><span class="muted">${esc(item.MENSAJE)}</span></td><td>${esc(recipient)}</td><td>${status(item.PRIORIDAD||'Normal')}</td><td>${esc(item.TIPO||'Información')}</td><td>${fmtDate(item.FECHA_ENVIO||item.CREADO_EN,true)}</td><td>${accion}</td></tr>`;}).join('');
    return heading('CENTRO DE COMUNICACIONES','Notificaciones','Mensajes dirigidos, lectura, dictado y comandos de voz desde una sola bandeja.',actions)+
      `<div class="voice-command-panel"><div><span class="eyebrow">CONTROL POR VOZ</span><h3>Comandos disponibles</h3><p id="voiceCommandStatus">Diga “leer notificaciones”, “marcar todas como leídas”, “crear notificación” o “detener lectura”.</p></div><div class="voice-command-actions"><button class="btn primary" data-voice-command>🎙 Escuchar comando</button><button class="btn soft" data-speak-notifications>🔊 Leer</button><button class="btn soft" data-stop-voice>■ Detener</button></div></div>`+
      `<div class="live-strip">${liveStat('🔔','Total',notifications.length)}${liveStat('●','Pendientes',unread.length,unread.length?'warning':'online')}${liveStat('!','Alta o urgente',urgent.length,urgent.length?'warning':'')}${liveStat('✓','Leídas',notifications.length-unread.length,'online')}</div>`+
      `<div class="notification-dashboard"><article class="card"><div class="card-header"><div><h3>Pendientes</h3><p>Mensajes que requieren atención</p></div>${unread.length?'<button class="link-button" data-read-all-notifications>Marcar todas como leídas</button>':''}</div><div class="notification-list">${unread.map(notificationCard).join('')||empty('✓','Bandeja al día','No existen mensajes pendientes.')}</div></article><article class="card"><div class="card-header"><div><h3>Estado del servicio</h3><p>Validaciones de comunicación</p></div></div><div class="requirement-list"><div><i>✓</i><span><b>Bandeja central</b><small>${api.isRemote()?'Sincronizada con la Base de Datos':'Activa en este dispositivo'}</small></span></div><div><i>🎙</i><span><b>Comando de voz</b><small>${reconocimientoDisponible()?'Disponible en este navegador':'Reconocimiento no disponible; lectura sí puede funcionar'}</small></span></div><div><i>♙</i><span><b>Destinatarios</b><small>${driversResult.rows.length} conductores disponibles para mensajería</small></span></div></div></article></div>`+
      `<article class="card"><div class="card-header"><div><h3>Historial de notificaciones</h3><p>Mensajes enviados y recibidos</p></div></div><div class="toolbar"><label class="search-box"><span>⌕</span><input data-table-search placeholder="Buscar título, mensaje o destinatario"></label>${puedeExportarFormato('csv')?'<button class="btn soft push" data-export="notifications">Exportar CSV</button>':''}</div><div data-filter-table>${table(['Estado','Mensaje','Destinatario','Prioridad','Tipo','Fecha','Acción'],rows,'No existen notificaciones registradas.')}</div></article>`;
  }

  async function renderAlerts() {
    const result=await solicitarListaSegura('alerts');
    if(result.error)throw result.error;
    const alerts=result.rows.slice().sort((a,b)=>new Date(b.FECHA_HORA||b.CREADO_EN||0)-new Date(a.FECHA_HORA||a.CREADO_EN||0));
    guardarListaFormulario('alerts',alerts);
    const unread=alerts.filter(row=>!['SI','TRUE','1'].includes(String(row.LEIDA??row.leida??'NO').trim().toUpperCase()));
    const critical=unread.filter(row=>String(row.NIVEL||'').toLowerCase().includes('cr'));
    const rows=alerts.map(row=>`<tr data-filter-date="${esc(row.FECHA_HORA||row.CREADO_EN||'')}" data-search-row="${esc(`${row.NIVEL} ${row.TITULO} ${row.MENSAJE} ${row.MODULO}`.toLowerCase())}"><td>${status(row.NIVEL||'Info')}</td><td><strong>${esc(row.TITULO||'Alerta')}</strong><span class="muted">${esc(row.MENSAJE||'')}</span></td><td>${esc(row.MODULO||'Sistema')}</td><td>${esc(row.REGISTRO_ID||'—')}</td><td>${fmtDate(row.FECHA_HORA||row.CREADO_EN,true)}</td><td>${row.LEIDA==='SI'?status('Cerrada'):(hasPermission('ALERTAS','CERRAR')?`<button class="btn soft small" data-read-alert="${row.ID}">Validar y cerrar</button>`:'<span class="status warning">Sin permiso de cierre</span>')}</td></tr>`).join('');
    return heading('CENTRO DE ATENCIÓN','Alertas','Eventos operacionales, fallas críticas y avisos generados por el sistema.',`<button class="btn soft" data-sync>↻ Actualizar</button><button class="btn soft" data-run-alert-engine>⚡ Revisar anomalías</button>${unread.length&&hasPermission('ALERTAS','CERRAR')?'<button class="btn soft" data-read-all-alerts>✓ Validar y cerrar todas</button>':''}${hasPermission('ALERTAS','ENVIAR')?'<button class="btn primary" data-add="alerts">＋ Crear alerta</button>':''}`)+
      `<div class="live-strip">${liveStat('!','Pendientes',unread.length,unread.length?'warning':'online')}${liveStat('⚠','Críticas',critical.length,critical.length?'warning':'')}${liveStat('✓','Atendidas',alerts.length-unread.length,'online')}${liveStat('▤','Total',alerts.length)}</div>`+
      `<div class="automatic-alert-banner"><i>⚡</i><div><b>Motor automático activo</b><span>Revisa cada 5 minutos y mantiene informados a los Administradores. Las alertas operacionales permanecen abiertas hasta su validación en terreno.</span></div></div>`+
      `<article class="card"><div class="toolbar"><label class="search-box"><span>⌕</span><input data-table-search placeholder="Buscar alerta, módulo o registro"></label>${puedeExportarFormato('csv')?'<button class="btn soft push" data-export="alerts">Exportar CSV</button>':''}</div><div data-filter-table>${table(['Nivel','Alerta','Módulo','Registro','Fecha','Acción'],rows,'No existen alertas registradas.')}</div></article>`;
  }


  function canSelectGpsVehicles() {
    return ['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'].includes(currentUser?.ROL_ID);
  }
  function gpsFilterPayload() {
    const estadoMap={all:'TODOS',online:'EN_LINEA',driving:'CONDUCIENDO',withoutGps:'SIN_GPS',offline:'INACTIVOS'};
    const payload={soloGps:'SI',vehiculos:'',estadoConexion:estadoMap[gpsConnectionFilter]||'TODOS'};
    if (canSelectGpsVehicles() && gpsTrackingMode === 'specific') payload.vehiculos=gpsSelectedVehicles.size ? [...gpsSelectedVehicles].join(',') : '__NINGUNO__';
    if(currentUser?.ROL_ID==='ROL-CONDUCTOR'){
      payload.vehiculos=String(gpsDriverFilters.VEHICULO_ID||'').trim();
      payload.conductorId=String(gpsDriverFilters.CONDUCTOR_ID||'').trim();
      payload.fechaDesde=String(gpsDriverFilters.FECHA_DESDE||'').trim();
      payload.fechaHasta=String(gpsDriverFilters.FECHA_HASTA||'').trim();
      payload.estadoGps=String(gpsDriverFilters.GPS_ESTADO||'TODOS');
      payload.limitePuntos=String(gpsDriverFilters.LIMITE_PUNTOS||'25');
    }
    return payload;
  }
  function saveGpsFilterPreference() {
    localStorage.setItem(gpsTrackingModeKey,gpsTrackingMode);
    localStorage.setItem(gpsSelectedVehiclesKey,JSON.stringify([...gpsSelectedVehicles]));
    localStorage.setItem(gpsConnectionFilterKey,gpsConnectionFilter);
  }
  function sameVehicleSelection(first,second) {
    if(first.size!==second.size)return false;
    for(const value of first)if(!second.has(value))return false;
    return true;
  }
  function gpsFilterHasChanges() {
    return gpsDraftTrackingMode!==gpsTrackingMode||gpsDraftConnectionFilter!==gpsConnectionFilter||!sameVehicleSelection(gpsDraftSelectedVehicles,gpsSelectedVehicles);
  }
  function selectedVehiclesLabel(count=gpsDraftSelectedVehicles.size) { return `${count} ${count===1?'seleccionado':'seleccionados'}`; }
  function gpsConnectionFilterLabel(value=gpsConnectionFilter) {
    return ({all:'Todos los estados',online:'En línea',driving:'Conduciendo',withoutGps:'Operación sin GPS',offline:'Inactivos'})[value]||'Todos los estados';
  }
  function appliedVehiclesLabel() {
    const vehicles=gpsTrackingMode==='all'?'Toda la flota':selectedVehiclesLabel(gpsSelectedVehicles.size);
    return `${vehicles} · ${gpsConnectionFilterLabel()}`;
  }
  function visibleVehiclesLabel(count) { return `${count} ${count===1?'vehículo visible':'vehículos visibles'}`; }
  function gpsVehicleOptions(realtime=ultimoResumenGps) {
    return (realtime.trackingVehicles||[]).map(vehicle=>{
      const driver=vehicle.CONDUCTOR_NOMBRE||'Sin conductor informado';
      const detail=[driver,vehicle.ESTADO||''].filter(Boolean).join(' · ');
      const search=`${vehicle.PATENTE||''} ${vehicle.MARCA||''} ${vehicle.MODELO||''} ${driver}`.toLowerCase();
      return `<label class="vehicle-tracking-option" data-vehicle-filter-text="${esc(search)}"><input type="checkbox" data-gps-vehicle="${esc(vehicle.ID)}" ${gpsDraftSelectedVehicles.has(String(vehicle.ID))?'checked':''}><span><b>${esc(vehicle.PATENTE||vehicle.ID)}</b><small>${esc(`${vehicle.MARCA||''} ${vehicle.MODELO||''}`.trim()||'Vehículo')}</small><em>${esc(detail)}</em></span></label>`;
    }).join('')||'<p class="muted">No hay vehículos disponibles para seleccionar.</p>';
  }
  function gpsFilterControls(realtime) {
    if(!canSelectGpsVehicles())return '';
    const selected=gpsDraftSelectedVehicles.size;
    const dirty=gpsFilterHasChanges();
    const statusButtons=[['all','Todos'],['online','En línea'],['driving','Conduciendo'],['withoutGps','Sin GPS'],['offline','Inactivos']].map(([value,label])=>`<button type="button" class="${gpsDraftConnectionFilter===value?'active':''}" data-gps-connection="${value}">${label}</button>`).join('');
    return `<article class="card tracking-filter-card"><div class="tracking-filter-header"><div><p class="tag">CONTROL DE ADMINISTRADOR / SUPERVISOR</p><h3>Filtros de seguimiento en tiempo real</h3><p>Filtre por vehículo y por estado de conexión sin detener la actualización del mapa.</p></div><span class="tracking-selection-summary" id="trackingSelectionSummary">${gpsDraftTrackingMode==='all'?'Toda la flota':selectedVehiclesLabel(selected)} · ${gpsConnectionFilterLabel(gpsDraftConnectionFilter)}</span></div><div class="tracking-filter-subtitle">Estado de conexión</div><div class="tracking-scope-buttons tracking-status-buttons">${statusButtons}</div><div class="tracking-filter-subtitle">Vehículos</div><div class="tracking-scope-buttons"><button type="button" class="${gpsDraftTrackingMode==='all'?'active':''}" data-gps-scope="all">Todos los vehículos</button><button type="button" class="${gpsDraftTrackingMode==='specific'?'active':''}" data-gps-scope="specific">Solo vehículos seleccionados</button></div><div class="vehicle-tracking-panel ${gpsDraftTrackingMode==='specific'?'open':''}" id="vehicleTrackingPanel"><div class="vehicle-tracking-actions"><label><span>Buscar vehículo o conductor</span><input type="search" data-gps-vehicle-search placeholder="Patente, marca, modelo o conductor"></label><div><button type="button" class="btn soft small" data-gps-select-all>Seleccionar todos</button><button type="button" class="btn soft small" data-gps-clear>Limpiar</button></div></div><div class="vehicle-tracking-list" id="vehicleTrackingList">${gpsVehicleOptions(realtime)}</div></div><div class="tracking-filter-footer"><div><b id="trackingAppliedSummary">Filtro aplicado: ${appliedVehiclesLabel()}</b><span id="trackingPendingText">${dirty?'Hay cambios pendientes por aplicar.':'El mapa ya está usando este filtro.'}</span></div><div><button type="button" class="btn soft small" data-gps-reset ${dirty?'':'disabled'}>Deshacer cambios</button><button type="button" class="btn primary small" data-gps-apply ${dirty?'':'disabled'}>Aplicar seguimiento</button></div></div></article>`;
  }

  function gpsSimpleOption(value,label,selected){return `<option value="${esc(value)}" ${String(value)===String(selected||'')?'selected':''}>${esc(label)}</option>`;}
  function gpsDriverFilterControls(realtime){
    // La sesión CONDUCTOR utiliza una vista privada sin filtros de terceros.
    return '';
  }
  function refreshGpsDriverFilterOptions(realtime){
    const form=$('#gpsDriverFilterForm');if(!form)return;
    const vehicle=form.elements.VEHICULO_ID,driver=form.elements.CONDUCTOR_ID;
    if(vehicle){const value=vehicle.value;vehicle.innerHTML=`<option value="">Todos mis vehículos</option>`+(realtime.trackingVehicles||[]).map(row=>gpsSimpleOption(row.ID,`${row.PATENTE||row.ID}${row.CONDUCTOR_NOMBRE?` · ${row.CONDUCTOR_NOMBRE}`:''}`,value||gpsDriverFilters.VEHICULO_ID)).join('');}
    if(driver){const value=driver.value;driver.innerHTML=`<option value="">Mi conductor asociado</option>`+(realtime.trackingDrivers||[]).map(row=>gpsSimpleOption(row.ID,row.NOMBRE||row.ID,value||gpsDriverFilters.CONDUCTOR_ID)).join('');}
  }
  async function applyGpsDriverFilters(form){
    const values=Object.fromEntries(new FormData(form).entries());
    gpsDriverFilters={...gpsDriverFiltersDefault,...values};
    try{localStorage.setItem(gpsDriverFiltersKey,JSON.stringify(gpsDriverFilters));}catch(_){}
    const result=await refreshLocations(false,true);
    if(result)toast('Filtros aplicados',`${result.locations?.length||0} puntos visibles en el mapa.`);
    return result;
  }
  async function resetGpsDriverFilters(){
    gpsDriverFilters={...gpsDriverFiltersDefault};
    try{localStorage.removeItem(gpsDriverFiltersKey);}catch(_){}
    await go('gps',{force:true});
  }

  function gpsUserMarkerKey(row={}) {
    const marker=String(row.MARCADOR_ID||'').trim();
    if(marker)return marker;
    const userId=String(row.USUARIO_ID||'').trim();
    if(userId)return `USUARIO-${userId}`;
    const driverId=String(row.CONDUCTOR_ID||'').trim();
    if(driverId)return `CONDUCTOR-${driverId}`;
    const vehicleId=String(row.VEHICULO_ID||'').trim();
    if(vehicleId)return `VEHICULO-${vehicleId}`;
    const deviceId=String(row.DISPOSITIVO_ID||row.CLAVE_SEGUIMIENTO||'').trim();
    if(deviceId)return `DISPOSITIVO-${deviceId}`;
    return `UBICACION-${String(row.ID||'SIN-ID')}`;
  }
  function deduplicateGpsLocations(rows=[]) {
    const latestByUser=new Map();
    (Array.isArray(rows)?rows:[]).forEach(row=>{
      const key=gpsUserMarkerKey(row),previous=latestByUser.get(key);
      const currentTime=new Date(row.FECHA_HORA||row.ACTUALIZADO_EN||row.CREADO_EN||0).getTime()||0;
      const previousTime=previous?(new Date(previous.FECHA_HORA||previous.ACTUALIZADO_EN||previous.CREADO_EN||0).getTime()||0):-1;
      const currentPrecision=Number(row.PRECISION_METROS||Number.MAX_SAFE_INTEGER);
      const previousPrecision=Number(previous?.PRECISION_METROS||Number.MAX_SAFE_INTEGER);
      if(!previous||currentTime>previousTime||(currentTime===previousTime&&currentPrecision<previousPrecision)){
        latestByUser.set(key,{...row,MARCADOR_ID:key});
      }
    });
    return [...latestByUser.values()].sort((a,b)=>(new Date(b.FECHA_HORA||0).getTime()||0)-(new Date(a.FECHA_HORA||0).getTime()||0));
  }
  function normalizeGpsSummary(result={}) {
    const rawLocations=Array.isArray(result.locations)?result.locations:Array.isArray(result.rows)?result.rows:[];
    const locations=deduplicateGpsLocations(rawLocations);
    const devices=Array.isArray(result.devices)?result.devices:[];
    const trackingVehicles=Array.isArray(result.trackingVehicles)?result.trackingVehicles:[];
    const trackingDrivers=Array.isArray(result.trackingDrivers)?result.trackingDrivers:[];
    return {...result,locations,rows:locations,devices,trackingVehicles,trackingDrivers,totals:{locations:locations.length,onlineDevices:0,drivingSessions:0,sessionsWithoutGps:0,...(result.totals||{})}};
  }
  function gpsRoleNotice(){
    if(currentUser?.ROL_ID==='ROL-CONDUCTOR')return `<div class="tracking-notice active"><i>✓</i><div><b>Vista privada del Conductor</b><span>El servidor entrega únicamente su propia ubicación, vehículo, operación, ruta y sesión asociada.</span></div></div>`;
    if(currentUser?.ROL_ID==='ROL-SUPERVISOR')return `<div class="tracking-notice active"><i>◉</i><div><b>Vista general del Operador</b><span>Puede visualizar toda la flota y aplicar filtros, sin controles administrativos delicados.</span></div></div>`;
    return `<div class="tracking-notice active"><i>◆</i><div><b>Control total del Administrador</b><span>Visualización completa de la flota, sesiones, filtros, precisión GPS y estados operacionales.</span></div></div>`;
  }
  async function renderGps() {
    const realtime=normalizeGpsSummary(ultimoResumenGps);
    ultimoResumenGps=realtime;
    api.request('realtimeSummary',{...gpsFilterPayload(),force:true})
      .then(result=>{ultimoResumenGps=normalizeGpsSummary(result);if(currentSection==='gps')paintGpsData(ultimoResumenGps,true);})
      .catch(error=>{if(currentSection==='gps'){setConnection(false,'Error GPS');const sync=$('#gpsLastSync');if(sync)sync.textContent=`No se pudo consultar: ${translateError(error)}`;}});
    const conductor=currentUser?.ROL_ID==='ROL-CONDUCTOR';
    if(conductor){
      const own=realtime.locations?.[0]||null;
      const active=gpsWatchId!==null;
      const controls=`<button class="btn soft" data-capture-gps title="Actualizar mi ubicación" aria-label="Actualizar mi ubicación">⌖</button><button class="btn ${active?'danger':'primary'}" data-toggle-tracking>${active?'Detener ubicación':'Activar ubicación'}</button>`;
      const status=own?`${direccionLegible(own.DIRECCION)?esc(own.DIRECCION):'Dirección en proceso'} · precisión ±${Math.round(Number(own.PRECISION_METROS||0))} m`:'Esperando la primera ubicación del dispositivo.';
      return heading('MI UBICACIÓN','Ubicación en tiempo real','Vista privada de la sesión del Conductor.',controls)+
        `<div class="tracking-notice ${active?'active':'inactive'}" data-tracking-notice><i data-tracking-icon>${active?'●':'○'}</i><div><b data-tracking-title>${active?'Ubicación continua activada':'Ubicación continua detenida'}</b><span data-tracking-detail>${esc(status)}</span></div></div>`+
        `<article class="card map-card gps-driver-private-map" id="mapCard"><div id="fleetMap" class="fleet-map"></div><div class="map-toolbar"><span class="gps-live"><i></i> Solo su ubicación autenticada</span><span class="muted" id="gpsLastSync">Actualización automática</span><span class="muted push">Mapa © OpenStreetMap, CARTO o Esri</span></div></article>`;
    }
    const locations={rows:realtime.locations,total:realtime.totals.locations||realtime.locations.length};
    const controls=`<button class="btn soft" data-refresh-locations>↻ Actualizar</button>`;
    return heading('MONITOREO','Ubicación en tiempo real','Posición confiable, dirección, velocidad y conexión de la flota autorizada.',controls)+
      gpsRoleNotice()+gpsFilterControls(realtime)+
      `<div class="live-strip"><article class="live-stat"><i>⌖</i><div><span>Ubicaciones visibles</span><b id="gpsVisibleCount">${locations.total}</b></div></article><article class="live-stat online"><i>●</i><div><span>Sesiones abiertas</span><b id="gpsOnlineCount">${realtime.totals.onlineDevices||0}</b></div></article><article class="live-stat online"><i>🚐</i><div><span>Conduciendo</span><b id="gpsDrivingCount">${realtime.totals.drivingSessions||0}</b></div></article><article class="live-stat ${(realtime.totals.sessionsWithoutGps||0)?'warning':''}"><i>!</i><div><span>Operación sin GPS</span><b id="gpsWithoutCount">${realtime.totals.sessionsWithoutGps||0}</b></div></article></div>`+
      `<div class="gps-layout"><article class="card map-card" id="mapCard"><div class="map-fullscreen-bar"><button class="btn soft small" type="button" data-map-fullscreen>⛶ Pantalla completa</button></div><div id="fleetMap" class="fleet-map"></div><div class="map-toolbar"><span class="gps-live"><i></i> Consulta rápida cada ${Math.round(config.INTERVALO_TIEMPO_REAL_MILISEGUNDOS/1000)} segundos</span><span class="map-status-legend"><b class="active"></b> Activo <b class="inactive"></b> Inactivo <b class="geofence"></b> Radio base </span><span class="muted" id="gpsLastSync">Datos iniciales cargados</span><span class="muted push">Mapa © OpenStreetMap, CARTO o Esri</span></div></article><article class="card"><div class="card-header"><div><h3>Últimas posiciones</h3><p id="locationCount">${visibleVehiclesLabel(locations.total)}</p></div></div><div class="driver-location-list" id="driverLocationList">${locationList(locations.rows)}</div><div class="card-header" style="margin-top:18px"><div><h3>Sesiones y conductores</h3><p>Usuario, actividad y sección abierta</p></div></div><div class="device-list" id="deviceList">${realtime.devices.map(deviceCard).join('')||empty('○','Sin sesiones','Esperando señales de los dispositivos.')}</div></article></div>`;
  }

  function connectionFilterPayload(){
    return {...filtrosConexiones,MODO_RAPIDO:'SI',INCLUIR_DIRECCIONES:'SI',LIMITE:Number(config.LIMITE_CONEXIONES_EN_LINEA||120)};
  }
  function numeroCoordenadaConexion(value){
    if(typeof value==='string')value=value.trim().replace(',', '.');
    const numero=Number(value);
    return Number.isFinite(numero)?numero:null;
  }
  function coordenadasConexionValidas(row){
    const lat=numeroCoordenadaConexion(row?.LATITUD??row?.latitud),lng=numeroCoordenadaConexion(row?.LONGITUD??row?.longitud),precision=numeroCoordenadaConexion(row?.PRECISION_METROS??row?.precision_metros);
    const trust=row?.UBICACION_CONFIABLE??row?.ubicacionConfiable??row?.UBICACION_VALIDA;
    if(trust===false||String(trust||'').toUpperCase()==='NO')return false;
    return lat!==null&&lng!==null&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180&&!(Math.abs(lat)<0.000001&&Math.abs(lng)<0.000001)&&precision!==null&&precision>0&&precision<=Number(config.PRECISION_GPS_MAPA_MAXIMA_METROS||120);
  }
  function normalizarFilaConexionMapa(row){
    const copia={...(row||{})};
    if(coordenadasConexionValidas(copia)){
      copia.LATITUD=numeroCoordenadaConexion(copia.LATITUD??copia.latitud);
      copia.LONGITUD=numeroCoordenadaConexion(copia.LONGITUD??copia.longitud);
    }else{
      copia.LATITUD='';copia.LONGITUD='';copia.PRECISION_METROS='';
    }
    return copia;
  }
  function resumenConexionesSeguro(result){
    const fuente=result&&typeof result==='object'?result:{};
    const opcionesFuente=fuente.opciones&&typeof fuente.opciones==='object'?fuente.opciones:{};
    const seguimientoFuente=fuente.seguimiento&&typeof fuente.seguimiento==='object'?fuente.seguimiento:{};
    const seguimiento={...seguimientoFuente};
    if(Object.prototype.hasOwnProperty.call(seguimientoFuente,'USUARIO_ID'))seguimiento.USUARIO_ID=String(seguimientoFuente.USUARIO_ID||'').trim();
    seguimiento.RASTRO=Array.isArray(seguimientoFuente.RASTRO)?seguimientoFuente.RASTRO.filter(punto=>punto&&typeof punto==='object').map(normalizarFilaConexionMapa).filter(coordenadasConexionValidas).slice(-40):[];
    return {
      ...fuente,
      equipos:Array.isArray(fuente.equipos)?fuente.equipos.filter(row=>row&&typeof row==='object').map(normalizarFilaConexionMapa):[],
      ubicaciones:Array.isArray(fuente.ubicaciones)?fuente.ubicaciones.filter(row=>row&&typeof row==='object').map(normalizarFilaConexionMapa).filter(coordenadasConexionValidas):[],
      totales:fuente.totales&&typeof fuente.totales==='object'?fuente.totales:{},
      opciones:{
        ...opcionesFuente,
        usuarios:Array.isArray(opcionesFuente.usuarios)?opcionesFuente.usuarios.filter(Boolean):[],
        conductores:Array.isArray(opcionesFuente.conductores)?opcionesFuente.conductores.filter(Boolean):[],
        vehiculos:Array.isArray(opcionesFuente.vehiculos)?opcionesFuente.vehiculos.filter(Boolean):[],
        dispositivos:Array.isArray(opcionesFuente.dispositivos)?opcionesFuente.dispositivos.filter(Boolean):[],
        redes:Array.isArray(opcionesFuente.redes)?opcionesFuente.redes.filter(Boolean):[],
        plataformas:Array.isArray(opcionesFuente.plataformas)?opcionesFuente.plataformas.filter(Boolean):[]
      },
      seguimiento,
      serverTime:fuente.serverTime||'',
      intervaloActivoSegundos:Number(fuente.intervaloActivoSegundos||90)
    };
  }
  function connectionTrackingStorageKey(){
    return `flotas_seguimiento_conexion_usuario_v1_${String(currentUser?.ID||'sin_usuario')}`;
  }
  function restaurarSeguimientoConexionLocal(){
    if(connectionTrackedUserId)return connectionTrackedUserId;
    try{connectionTrackedUserId=String(localStorage.getItem(connectionTrackingStorageKey())||'').trim();}
    catch(_){connectionTrackedUserId='';}
    return connectionTrackedUserId;
  }
  function guardarSeguimientoConexionLocal(){
    try{
      if(connectionTrackedUserId)localStorage.setItem(connectionTrackingStorageKey(),connectionTrackedUserId);
      else localStorage.removeItem(connectionTrackingStorageKey());
    }catch(_){}
  }
  function sincronizarSeguimientoConexionesDesdeResultado(result){
    restaurarSeguimientoConexionLocal();
    const seguimiento=result?.seguimiento;
    if(!seguimiento||!Object.prototype.hasOwnProperty.call(seguimiento,'USUARIO_ID')||connectionTrackingSavePending)return;
    const servidor=String(seguimiento.USUARIO_ID||'').trim();
    if(!connectionTrackingServerLoaded||servidor!==connectionTrackedUserId){
      connectionTrackedUserId=servidor;
      connectionTrackedPositionKey='';
      connectionTrackedVisibility=null;
      guardarSeguimientoConexionLocal();
    }
    connectionTrackingServerLoaded=true;
    if(connectionTrackedUserId)scheduleConnectionTrackingLive();
  }
  function filaSeguimientoConexion(rows){
    if(!connectionTrackedUserId)return null;
    return (rows||[]).filter(row=>
      String(row.USUARIO_ID||'')===connectionTrackedUserId&&
      coordenadasConexionValidas(row)
    ).sort((a,b)=>new Date(b.FECHA_GPS||b.ULTIMA_CONEXION||0)-new Date(a.FECHA_GPS||a.ULTIMA_CONEXION||0))[0]||null;
  }
  function detalleSeguimientoConexion(result,rows){
    const row=filaSeguimientoConexion(rows);
    const seguimientoSeguro=result?.seguimiento&&typeof result.seguimiento==='object'?result.seguimiento:null;
    const servidor=seguimientoSeguro&&String(seguimientoSeguro.USUARIO_ID||'')===connectionTrackedUserId?seguimientoSeguro:{};
    return {
      id:connectionTrackedUserId,
      row,
      visible:Boolean(row),
      nombre:row?.USUARIO_NOMBRE||servidor.USUARIO_NOMBRE||connectionTrackedUserId,
      correo:row?.USUARIO_CORREO||servidor.USUARIO_CORREO||'',
      direccion:row?direccionConexion(row):(servidor.DIRECCION||''),
      rastro:Array.isArray(servidor.RASTRO)?servidor.RASTRO.slice(-40):[]
    };
  }
  function panelSeguimientoConexion(result,rows){
    const seguimiento=detalleSeguimientoConexion(result,rows);
    if(!seguimiento.id)return `<section class="connections-tracking-panel" id="connectionsTrackingPanel"><div><i>◎</i><div><span>Seguimiento individual</span><b>Ningún usuario seleccionado</b><small>Marque “Seguir” en un registro con GPS válido para acompañar su movimiento.</small></div></div></section>`;
    const avisar=puedeEnviarAvisosConexiones()?`<button class="btn soft small" type="button" data-connection-notice="${esc(seguimiento.id)}">Avisar</button>`:'';
    if(!seguimiento.visible)return `<section class="connections-tracking-panel filtered" id="connectionsTrackingPanel"><div><i>!</i><div><span>Seguimiento pausado por filtros</span><b>${esc(seguimiento.nombre)}</b><small>El usuario seguido no coincide con los filtros actuales. Al ajustar los filtros, el seguimiento continuará automáticamente.</small></div></div><div class="connections-tracking-actions">${avisar}<button class="btn danger small" type="button" data-stop-connection-follow ${connectionTrackingSavePending?'disabled':''}>Detener seguimiento</button></div></section>`;
    return `<section class="connections-tracking-panel active" id="connectionsTrackingPanel"><div><i>⌖</i><div><span>Siguiendo en vivo</span><b>${esc(seguimiento.nombre)}${seguimiento.correo?` · ${esc(seguimiento.correo)}`:''}</b><small>${esc(seguimiento.direccion)} · ${seguimiento.rastro.length||1} posición(es) recientes · consulta liviana cada ${Math.max(1,Math.round(Number(config.INTERVALO_SEGUIMIENTO_CONEXION_MILISEGUNDOS||1500)/1000))} s</small></div></div><div class="connections-tracking-actions">${avisar}<button class="btn danger small" type="button" data-stop-connection-follow ${connectionTrackingSavePending?'disabled':''}>Detener seguimiento</button></div></section>`;
  }
  function puedeEnviarAvisosConexiones(){return hasPermission('CONEXIONES','ENVIAR_AVISO')&&(hasPermission('NOTIFICACIONES','ENVIAR')||hasPermission('ALERTAS','ENVIAR'));}
  function panelAvisosConexiones(){
    if(!puedeEnviarAvisosConexiones())return '';
    return `<section class="connections-notice-panel"><div><i>🔔</i><div><span>COMUNICACIÓN INMEDIATA</span><b>Notificaciones y alertas desde el mapa</b><small>Envíe a un usuario, a todos los conductores, a quienes están conectados o a todas las cuentas activas.</small></div></div><button class="btn primary" type="button" data-connection-notice="">＋ Crear aviso</button></section>`;
  }
  function enlazarSeguimientoConexiones(root=document){
    $$('[data-connection-follow]',root).forEach(input=>{
      if(input.dataset.followBound==='1')return;
      input.dataset.followBound='1';
      input.addEventListener('change',()=>{
        if(input.checked)cambiarSeguimientoConexion(input.dataset.connectionFollow);
        else if(String(input.dataset.connectionFollow||'')===connectionTrackedUserId)cambiarSeguimientoConexion('');
      });
    });
    $$('[data-stop-connection-follow]',root).forEach(button=>{
      if(button.dataset.followBound==='1')return;
      button.dataset.followBound='1';
      button.addEventListener('click',()=>conCargaBoton(button,'Deteniendo…',()=>cambiarSeguimientoConexion('')));
    });
  }
  function enlazarAvisosConexiones(root=document){
    $$('[data-connection-notice]',root).forEach(button=>{
      if(button.dataset.noticeBound==='1')return;
      button.dataset.noticeBound='1';
      button.addEventListener('click',()=>openConnectionsNoticeModal(button.dataset.connectionNotice||''));
    });
  }
  function enlazarDesconexionUsuariosConectados(root=document){
    $$('[data-disconnect-user]',root).forEach(button=>{
      if(button.dataset.disconnectBound==='1')return;
      button.dataset.disconnectBound='1';
      button.addEventListener('click',async()=>{
        if(!puedeDesconectarUsuariosConectados())return toast('Acceso restringido','Solo un Administrador puede desconectar usuarios.','error');
        const userId=String(button.dataset.disconnectUser||''),name=String(button.dataset.disconnectName||userId);
        const reason=prompt(`Indique el motivo para desconectar a ${name}:`,'')||'';
        if(reason.trim().length<5)return toast('Motivo requerido','Escriba un motivo de al menos 5 caracteres.','warning');
        if(!confirm(`Se cerrarán todas las sesiones activas de ${name} y se detendrá el envío GPS. ¿Desea continuar?`))return;
        await conCargaBoton(button,'Desconectando…',async()=>{
          try{
            const result=await api.request('disconnectConnectedUser',{data:{USUARIO_ID:userId,MOTIVO:reason,DISPOSITIVO_ID:button.dataset.disconnectDevice||''}});
            if(connectionTrackedUserId===userId)await cambiarSeguimientoConexion('');
            toast('Usuario desconectado',`${result.usuarioNombre||name} quedó desconectado. ${number(result.sesionesCerradas||0)} sesión(es) cerradas.`);
            await refreshConnectionsOnline(false,false);
          }catch(error){toast('No se pudo desconectar',translateError(error),'error');}
        });
      });
    });
  }
  async function cambiarSeguimientoConexion(usuarioId){
    const anterior=connectionTrackedUserId;
    const siguiente=String(usuarioId||'').trim();
    const generation=++connectionTrackingGeneration;
    connectionTrackingSavePending=true;
    connectionTrackedUserId=siguiente;
    connectionTrackedPositionKey='';
    connectionTrackedVisibility=null;
    guardarSeguimientoConexionLocal();
    scheduleConnectionTrackingLive(80);
    if(currentSection==='connections')paintConnectionsOnline(ultimoResumenConexiones,false);
    try{
      const result=await api.request('saveConnectionTracking',{data:{USUARIO_ID:siguiente}});
      if(generation!==connectionTrackingGeneration)return result;
      if(result?.seguimiento&&Object.prototype.hasOwnProperty.call(result.seguimiento,'USUARIO_ID')){
        connectionTrackedUserId=String(result.seguimiento.USUARIO_ID||'').trim();
        connectionTrackingServerLoaded=true;
        guardarSeguimientoConexionLocal();
      }
      connectionTrackingSavePending=false;
      if(connectionTrackedUserId)await refreshConnectionTrackingLive(true);
      else{
        if(connectionTrackingLiveTimer)clearTimeout(connectionTrackingLiveTimer);
        connectionTrackingLiveTimer=null;
        mapaFlota?.actualizarRastros?.([]);
      }
      refreshConnectionsOnline(false,false);
      toast(siguiente?'Seguimiento iniciado':'Seguimiento detenido',siguiente?'El mapa acompañará automáticamente la ubicación del usuario seleccionado.':'El mapa volvió al modo general de equipos.');
      return result;
    }catch(error){
      if(generation!==connectionTrackingGeneration)return null;
      connectionTrackingSavePending=false;
      connectionTrackedUserId=anterior;
      connectionTrackedPositionKey='';
      guardarSeguimientoConexionLocal();
      scheduleConnectionTrackingLive(150);
      if(currentSection==='connections')paintConnectionsOnline(ultimoResumenConexiones,false);
      toast('No se pudo guardar el seguimiento',translateError(error),'error');
      return null;
    }
  }
  function connectionOption(value,label,selected){return `<option value="${esc(value)}" ${String(selected||'')===String(value)?'selected':''}>${esc(label)}</option>`;}
  function fechaConexionFiltroCliente(value,endOfDay=false){
    if(!value)return null;
    const date=new Date(`${value}T${endOfDay?'23:59:59.999':'00:00:00.000'}`);
    return Number.isNaN(date.getTime())?null:date;
  }
  function conexionCoincideFiltros(row,f=filtrosConexiones){
    const desde=fechaConexionFiltroCliente(f.FECHA_DESDE,false),hasta=fechaConexionFiltroCliente(f.FECHA_HASTA,true);
    const fecha=new Date(row.ULTIMA_CONEXION||row.ACTUALIZADO_EN||row.FECHA_GPS||0);
    if(desde&&(!fecha||fecha<desde))return false;
    if(hasta&&(!fecha||fecha>hasta))return false;
    if(f.USUARIO_ID&&String(row.USUARIO_ID||'')!==String(f.USUARIO_ID))return false;
    if(f.CONDUCTOR_ID&&String(row.CONDUCTOR_ID||'')!==String(f.CONDUCTOR_ID))return false;
    if(f.VEHICULO_ID&&String(row.VEHICULO_ID||'')!==String(f.VEHICULO_ID))return false;
    if(f.DISPOSITIVO_ID&&String(row.DISPOSITIVO_ID||'')!==String(f.DISPOSITIVO_ID))return false;
    if(f.ESTADO==='ACTIVOS'&&!row.EN_LINEA)return false;
    if(f.ESTADO==='DESCONECTADOS'&&row.EN_LINEA)return false;
    if(f.ESTADO==='SEGUNDO_PLANO'&&row.PAGINA_VISIBLE!=='NO')return false;
    const gpsActivo=gpsConexionActivo(row);
    if(f.GPS==='ACTIVO'&&!gpsActivo)return false;
    if(f.GPS==='INACTIVO'&&gpsActivo)return false;
    if(f.GPS==='SIN_UBICACION'&&coordenadasConexionValidas(row))return false;
    if(f.TIPO_RED&&String(row.TIPO_RED||'')!==String(f.TIPO_RED))return false;
    if(f.PLATAFORMA&&!String(row.PLATAFORMA||'').toLowerCase().includes(String(f.PLATAFORMA).toLowerCase()))return false;
    if(Number(f.PRECISION_MAXIMA||0)>0&&Number(row.PRECISION_METROS||Number.MAX_SAFE_INTEGER)>Number(f.PRECISION_MAXIMA))return false;
    const buscar=String(f.BUSCAR||'').trim().toLowerCase();
    if(buscar){
      const texto=[row.USUARIO_NOMBRE,row.USUARIO_CORREO,row.CONDUCTOR_NOMBRE,row.VEHICULO_PATENTE,row.VEHICULO_NOMBRE,row.DISPOSITIVO_ID,row.PLATAFORMA,row.NAVEGADOR,row.IP_PUBLICA,row.SECCION_ACTUAL,row.ACTIVIDAD,row.TIPO_RED,row.DIRECCION].join(' ').toLowerCase();
      if(!texto.includes(buscar))return false;
    }
    return true;
  }
  function conexionesFiltradasCliente(result){return (result?.equipos||[]).filter(row=>conexionCoincideFiltros(row));}
  function totalesConexionesFiltradas(rows){
    const gpsActivo=row=>gpsConexionActivo(row);
    return {equipos:rows.length,activos:rows.filter(row=>row.EN_LINEA).length,desconectados:rows.filter(row=>!row.EN_LINEA).length,gpsActivos:rows.filter(gpsActivo).length,sinGps:rows.filter(row=>!gpsActivo(row)).length,segundoPlano:rows.filter(row=>row.PAGINA_VISIBLE==='NO').length};
  }
  function gpsConexionActivo(row){
    // Una coordenada válida demuestra que el dispositivo entregó GPS, incluso
    // cuando una versión anterior dejó GPS_ACTIVO en NO por desincronización.
    return coordenadasConexionValidas(row);
  }
  function nombreSeccionConexion(value){
    const original=String(value||'').trim(),clave=original.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[\s-]+/g,'_');
    if(!clave)return 'Conexión del dispositivo';
    if(clave==='connections'||clave==='conexiones'||clave.includes('conexion'))return 'Conexiones en línea';
    if(clave.includes('seguimiento')||clave.includes('gps'))return 'Seguimiento GPS';
    if(clave.includes('ruta'))return 'Asignación de ruta';
    if(clave.includes('operacion'))return 'Operaciones';
    if(clave.includes('combustible'))return 'Combustible';
    if(clave.includes('check'))return 'Check-in vehicular';
    return original.replaceAll('_',' ');
  }
  function actividadConexion(row){
    const original=String(row?.ACTIVIDAD||'').trim(),clave=original.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if(!clave||clave==='connections')return row?.EN_LINEA?'En línea':'Última conexión registrada';
    if(clave.includes('ubicacion')||clave.includes('gps'))return 'Ubicación GPS recibida';
    if(clave.includes('segundo plano'))return 'Seguimiento en segundo plano';
    return original.replaceAll('_',' ');
  }
  function direccionConexion(row){
    if(direccionLegible(row?.DIRECCION))return String(row.DIRECCION).trim();
    if(coordenadasConexionValidas(row))return `Dirección en proceso · ${Number(row.LATITUD).toFixed(6)}, ${Number(row.LONGITUD).toFixed(6)}`;
    return 'Esperando primera ubicación GPS';
  }
  function connectionFilterForm(result){
    result=resumenConexionesSeguro(result);
    const options=result.opciones||{},f=filtrosConexiones,rows=result.equipos||[];
    const usuariosFuente=(options.usuarios?.length?options.usuarios:[...new Map(rows.filter(r=>r.USUARIO_ID).map(r=>[String(r.USUARIO_ID),{ID:r.USUARIO_ID,NOMBRE:r.USUARIO_NOMBRE,CORREO:r.USUARIO_CORREO}])).values()]);
    const conductoresFuente=(options.conductores?.length?options.conductores:[...new Map(rows.filter(r=>r.CONDUCTOR_ID).map(r=>[String(r.CONDUCTOR_ID),{ID:r.CONDUCTOR_ID,NOMBRE:r.CONDUCTOR_NOMBRE||r.CONDUCTOR_ID}])).values()]);
    const vehiculosFuente=(options.vehiculos?.length?options.vehiculos:[...new Map(rows.filter(r=>r.VEHICULO_ID).map(r=>[String(r.VEHICULO_ID),{ID:r.VEHICULO_ID,PATENTE:r.VEHICULO_PATENTE,NOMBRE:r.VEHICULO_NOMBRE}])).values()]);
    const users=usuariosFuente.map(row=>connectionOption(row.ID,`${row.NOMBRE||row.ID}${row.CORREO?` · ${row.CORREO}`:''}`,f.USUARIO_ID)).join('');
    const drivers=conductoresFuente.map(row=>connectionOption(row.ID,row.NOMBRE||row.ID,f.CONDUCTOR_ID)).join('');
    const vehicles=vehiculosFuente.map(row=>connectionOption(row.ID,`${row.PATENTE||row.ID}${row.NOMBRE?` · ${row.NOMBRE}`:''}`,f.VEHICULO_ID)).join('');
    const devices=(options.dispositivos||[...new Set(rows.map(r=>r.DISPOSITIVO_ID).filter(Boolean))]).map(value=>connectionOption(value,value,f.DISPOSITIVO_ID)).join('');
    const networks=(options.redes||[...new Set(rows.map(r=>r.TIPO_RED).filter(Boolean))]).map(value=>connectionOption(value,value,f.TIPO_RED)).join('');
    const platforms=(options.plataformas||[...new Set(rows.map(r=>r.PLATAFORMA).filter(Boolean))]).map(value=>connectionOption(value,value,f.PLATAFORMA)).join('');
    return `<article class="card connections-filter-card"><div class="card-header"><div><h3>Filtros administrativos</h3><p>Los filtros se aplican simultáneamente a la lista, los totales y los marcadores del mapa.</p></div><span class="status-badge">Mapa sincronizado con filtros</span></div><form id="connectionsFilterForm" class="connections-filter-form"><label class="field"><span>Desde</span><input type="date" name="FECHA_DESDE" value="${esc(f.FECHA_DESDE)}"></label><label class="field"><span>Hasta</span><input type="date" name="FECHA_HASTA" value="${esc(f.FECHA_HASTA)}"></label><label class="field"><span>Usuario</span><select name="USUARIO_ID"><option value="">Todos los usuarios</option>${users}</select></label><label class="field"><span>Conductor</span><select name="CONDUCTOR_ID"><option value="">Todos los conductores</option>${drivers}</select></label><label class="field"><span>Estado</span><select name="ESTADO"><option value="TODOS" ${f.ESTADO==='TODOS'?'selected':''}>Todos</option><option value="ACTIVOS" ${f.ESTADO==='ACTIVOS'?'selected':''}>Activos</option><option value="DESCONECTADOS" ${f.ESTADO==='DESCONECTADOS'?'selected':''}>Desconectados</option><option value="SEGUNDO_PLANO" ${f.ESTADO==='SEGUNDO_PLANO'?'selected':''}>En segundo plano</option></select></label><label class="field"><span>GPS</span><select name="GPS"><option value="TODOS" ${f.GPS==='TODOS'?'selected':''}>Todos</option><option value="ACTIVO" ${f.GPS==='ACTIVO'?'selected':''}>GPS activo</option><option value="INACTIVO" ${f.GPS==='INACTIVO'?'selected':''}>GPS inactivo</option><option value="SIN_UBICACION" ${f.GPS==='SIN_UBICACION'?'selected':''}>Sin ubicación</option></select></label><label class="field"><span>Vehículo</span><select name="VEHICULO_ID"><option value="">Todos los vehículos</option>${vehicles}</select></label><label class="field"><span>Dispositivo</span><select name="DISPOSITIVO_ID"><option value="">Todos los equipos</option>${devices}</select></label><label class="field"><span>Tipo de red</span><select name="TIPO_RED"><option value="">Todas las redes</option>${networks}</select></label><label class="field"><span>Plataforma</span><select name="PLATAFORMA"><option value="">Todas las plataformas</option>${platforms}</select></label><label class="field"><span>Precisión máxima</span><select name="PRECISION_MAXIMA"><option value="" ${!f.PRECISION_MAXIMA?'selected':''}>Cualquier precisión</option><option value="25" ${String(f.PRECISION_MAXIMA)==='25'?'selected':''}>Hasta 25 m</option><option value="50" ${String(f.PRECISION_MAXIMA)==='50'?'selected':''}>Hasta 50 m</option><option value="100" ${String(f.PRECISION_MAXIMA)==='100'?'selected':''}>Hasta 100 m</option><option value="200" ${String(f.PRECISION_MAXIMA)==='200'?'selected':''}>Hasta 200 m</option><option value="250" ${String(f.PRECISION_MAXIMA)==='250'?'selected':''}>Hasta 250 m</option></select></label><label class="field connections-search-field"><span>Buscar en todos los campos</span><input type="search" name="BUSCAR" value="${esc(f.BUSCAR)}" placeholder="Nombre, correo, conductor, patente, dirección, IP o dispositivo…"></label><div class="form-actions"><button class="btn soft" type="button" data-connections-reset>Limpiar filtros</button><button class="btn primary" type="submit">Aplicar filtros al mapa</button></div></form></article>`;
  }
  function connectionRows(rows){
    const visibles=(rows||[]).slice(0,120);
    return visibles.map(row=>{
      const gpsValido=Boolean(row.USUARIO_ID)&&coordenadasConexionValidas(row);
      const gpsActivo=gpsConexionActivo(row);
      const retenida=row.UBICACION_RETENIDA===true||String(row.UBICACION_RETENIDA||'').toUpperCase()==='SI';
      const seguido=String(row.USUARIO_ID||'')===connectionTrackedUserId;
      const control=gpsValido?`<label class="connection-follow-control"><input type="checkbox" data-connection-follow="${esc(row.USUARIO_ID)}" ${seguido?'checked':''} ${connectionTrackingSavePending?'disabled':''}><span>${seguido?'Siguiendo':'Seguir usuario'}</span></label>`:`<span class="connection-follow-unavailable">Esperando ubicación GPS</span>`;
      const avisar=puedeEnviarAvisosConexiones()&&row.USUARIO_ID?`<button class="btn soft small" data-connection-notice="${esc(row.USUARIO_ID)}">Enviar notificación</button>`:'';
      const desconectar=puedeDesconectarUsuariosConectados()&&row.EN_LINEA&&row.USUARIO_ID&&String(row.USUARIO_ID)!==String(currentUser?.ID||'')?`<button class="btn danger small" data-disconnect-user="${esc(row.USUARIO_ID)}" data-disconnect-name="${esc(row.USUARIO_NOMBRE||row.USUARIO_CORREO||row.USUARIO_ID)}">Desconectar</button>`:'';
      const precision=Number(row.PRECISION_METROS)>0?`±${number(row.PRECISION_METROS)} m`:'Precisión pendiente';
      const gpsTexto=retenida?'Última ubicación confiable':gpsActivo?'GPS activo':coordenadasConexionValidas(row)?'GPS sin señal reciente':'Sin posición GPS';
      return `<tr class="connection-detail-row ${seguido?'followed':''}">
        <td class="connection-follow-cell" data-label="Seguimiento"><div class="connection-cell-stack">${control}</div></td>
        <td data-label="Estado"><div class="connection-cell-stack"><span class="connection-state ${row.EN_LINEA?'online':'offline'}"><i></i>${row.EN_LINEA?'En línea':'Desconectado'}</span><small>${esc(row.ESTADO_CONEXION||'')}</small></div></td>
        <td data-label="Usuario"><div class="connection-cell-stack"><strong>${esc(row.USUARIO_NOMBRE||row.USUARIO_ID||'Usuario')}</strong><small>${esc(row.USUARIO_CORREO||row.ROL_ID||'')}</small></div></td>
        <td data-label="Equipo"><div class="connection-cell-stack"><strong>${esc(row.DISPOSITIVO_ID||'Dispositivo sin identificar')}</strong><small>${esc(row.PLATAFORMA||'Plataforma no informada')}</small></div></td>
        <td data-label="Vehículo / conductor"><div class="connection-cell-stack"><strong>${esc(row.VEHICULO_PATENTE||'Sin vehículo asignado')}</strong><small>${esc(row.CONDUCTOR_NOMBRE||row.VEHICULO_NOMBRE||'Sin conductor asociado')}</small></div></td>
        <td data-label="Dirección"><div class="connection-cell-stack"><span class="connection-address">${esc(direccionConexion(row))}</span><small>${coordenadasConexionValidas(row)?`${Number(row.LATITUD).toFixed(6)}, ${Number(row.LONGITUD).toFixed(6)}`:'La posición aparecerá al recibir una lectura válida'}</small></div></td>
        <td data-label="GPS"><div class="connection-cell-stack">${status(gpsTexto)}<small>${esc(precision)}</small></div></td>
        <td data-label="Módulo / actividad"><div class="connection-cell-stack"><strong>${esc(nombreSeccionConexion(row.SECCION_ACTUAL))}</strong><small>${esc(actividadConexion(row))}</small></div></td>
        <td data-label="Red / batería"><div class="connection-cell-stack"><strong>${esc(row.TIPO_RED||'Red no informada')}</strong><small>${row.BATERIA_GPS!==''&&row.BATERIA_GPS!=null?`${esc(row.BATERIA_GPS)}% batería`:'Batería no informada'}</small></div></td>
        <td data-label="Última señal"><div class="connection-cell-stack"><span>${fmtDate(row.ULTIMA_CONEXION||row.FECHA_GPS,true)}</span><small>${row.FECHA_GPS?`GPS: ${fmtDate(row.FECHA_GPS,true)}`:'Sin fecha GPS'}</small></div></td>
        <td data-label="Mapa / acciones"><div class="row-button-stack">${gpsValido?`<button class="btn primary small" data-connection-focus="${row.LATITUD},${row.LONGITUD}">Ver en mapa</button>`:''}${avisar}${desconectar}${!gpsValido&&!avisar&&!desconectar?'—':''}</div></td>
      </tr>`;
    }).join('')||`<tr><td colspan="11">${empty('○','Sin equipos para los filtros aplicados','Cambie el período o quite filtros para ampliar la búsqueda.')}</td></tr>`;
  }
  function connectionQuickList(rows){return (rows||[]).slice(0,14).map(row=>{const seguido=String(row.USUARIO_ID||'')===connectionTrackedUserId;return `<button class="connection-quick-item ${row.EN_LINEA?'online':'offline'} ${seguido?'followed':''}" ${coordenadasConexionValidas(row)?`data-connection-focus="${row.LATITUD},${row.LONGITUD}"`:''}><i></i><span><b>${esc(row.USUARIO_NOMBRE||'Usuario')}</b><small>${esc(row.VEHICULO_PATENTE||row.DISPOSITIVO_ID||'Equipo')}</small><small class="connection-quick-address">${esc(direccionConexion(row))}</small></span><em>${seguido?'Siguiendo':(row.EN_LINEA?'Activo':'Desconectado')}</em></button>`;}).join('')||empty('○','Sin conexiones','Los equipos aparecerán cuando registren una señal.');}
  function firmaFilasConexiones(rows,limite=120){
    return `${connectionTrackedUserId}|${connectionTrackingSavePending?'1':'0'}|`+(rows||[]).slice(0,limite).map(row=>[
      row.ID||'',row.USUARIO_ID||'',row.USUARIO_NOMBRE||'',row.USUARIO_CORREO||'',row.DISPOSITIVO_ID||'',
      row.EN_LINEA?'1':'0',row.GPS_ACTIVO||'',row.GPS_RECIENTE?'1':'0',row.UBICACION_RETENIDA?'1':'0',row.LATITUD??'',row.LONGITUD??'',
      row.PRECISION_METROS??'',row.FECHA_GPS||'',row.ULTIMA_CONEXION||'',row.DIRECCION||'',
      row.CONDUCTOR_NOMBRE||'',row.VEHICULO_PATENTE||'',row.VEHICULO_NOMBRE||'',row.SECCION_ACTUAL||'',
      row.ACTIVIDAD||'',row.TIPO_RED||'',row.BATERIA_GPS??'',row.PLATAFORMA||''
    ].join('~')).join('|');
  }
  function enlazarFocoConexiones(root=document){
    $$('[data-connection-focus]',root).forEach(btn=>{
      if(btn.dataset.mapFocusBound==='1')return;
      btn.dataset.mapFocusBound='1';
      btn.addEventListener('click',()=>{
        const [lat,lng]=String(btn.dataset.connectionFocus||'').split(',').map(Number);
        if(Number.isFinite(lat)&&Number.isFinite(lng))mapaFlota?.establecerVista(lat,lng,17);
      });
    });
  }
  function connectionsResultsHtml(result){
    result=resumenConexionesSeguro(result);
    sincronizarSeguimientoConexionesDesdeResultado(result);
    const rows=conexionesFiltradasCliente(result),totals=totalesConexionesFiltradas(rows),visibleCount=Math.min(rows.length,120);
    const detailNote=rows.length>visibleCount?`Mostrando ${visibleCount} de ${rows.length} registros filtrados.`:`${rows.length} registro(s) en lista y mapa`;
    return `<div class="live-strip connections-live-strip"><article class="live-stat"><i>▣</i><div><span>Equipos visibles</span><b id="connectionsTotal">${totals.equipos||0}</b></div></article><article class="live-stat online"><i>●</i><div><span>Activos</span><b id="connectionsOnline">${totals.activos||0}</b></div></article><article class="live-stat warning"><i>●</i><div><span>Desconectados</span><b id="connectionsOffline">${totals.desconectados||0}</b></div></article><article class="live-stat online"><i>⌖</i><div><span>GPS activos</span><b id="connectionsGps">${totals.gpsActivos||0}</b></div></article><article class="live-stat ${(totals.sinGps||0)?'warning':''}"><i>!</i><div><span>Sin GPS</span><b id="connectionsNoGps">${totals.sinGps||0}</b></div></article></div><div class="connections-map-filter-summary"><b>Mapa filtrado</b><span id="connectionsMapFilterSummary">${rows.length} equipo(s) coinciden con los filtros actuales.</span></div>${panelSeguimientoConexion(result,rows)}${panelAvisosConexiones()}<div class="connections-dashboard-grid"><article class="card map-card" id="mapCard"><div class="card-header"><div><h3>Mapa de equipos filtrados</h3><p>Solo aparecen los mismos equipos visibles en la lista. Verde: activo · Rojo: desconectado · Rastro: usuario seguido.</p></div><button class="btn soft small" type="button" data-map-fullscreen>⛶ Pantalla completa</button></div><div class="fleet-map connections-map" id="connectionsMap"></div><small class="muted" id="connectionsLastSync">Última consulta: ${fmtDate(result.serverTime||new Date(),true)}</small></article><article class="card"><div class="card-header"><div><h3>Estado rápido</h3><p>Dirección, usuario y vehículo de los resultados filtrados.</p></div></div><div class="connections-quick-list" id="connectionsQuickList">${connectionQuickList(rows)}</div></article></div><article class="card connections-detail-card"><div class="card-header"><div><h3>Detalle de conexiones</h3><p>Marque “Seguir” para acompañar a un usuario. El Administrador también puede cerrar sus sesiones activas.</p></div><span class="status-badge" id="connectionsVisibleCount">${esc(detailNote)}</span></div><div class="table-wrap connections-table-wrap"><table><thead><tr><th>Seguimiento</th><th>Estado</th><th>Usuario</th><th>Equipo</th><th>Vehículo / conductor</th><th>Dirección</th><th>GPS</th><th>Módulo / actividad</th><th>Red / batería</th><th>Última señal</th><th>Mapa / acciones</th></tr></thead><tbody id="connectionsTableBody">${connectionRows(rows)}</tbody></table></div></article>`;
  }
  function connectionsPageHtml(result){
    result=resumenConexionesSeguro(result);
    return heading('ADMINISTRACIÓN','Conexiones en línea','Mapa rápido, seguimiento casi inmediato y comunicación central con usuarios y conductores.',`${puedeEnviarAvisosConexiones()?'<button class="btn primary" data-connection-notice="">🔔 Enviar aviso</button>':''}<button class="btn soft" data-connections-refresh>↻ Actualizar ahora</button>`)+`<div class="automatic-alert-banner"><i>⌖</i><div><b>Supervisión activa</b><span>El seguimiento usa una consulta liviana cada ${Math.max(1,Math.round(Number(config.INTERVALO_SEGUIMIENTO_CONEXION_MILISEGUNDOS||1500)/1000))} s; la tabla completa se sincroniza cada ${Math.max(1,Math.round(Number(config.INTERVALO_CONEXIONES_EN_LINEA_MILISEGUNDOS||5000)/1000))} s.</span></div></div>`+connectionFilterForm(result)+`<section id="connectionsResults" aria-live="polite">${connectionsResultsHtml(result)}</section>`;
  }
  function connectionsLoadingHtml(){
    const base={equipos:[],ubicaciones:[],totales:{equipos:0,activos:0,desconectados:0,gpsActivos:0,sinGps:0},opciones:{usuarios:[],conductores:[],vehiculos:[],dispositivos:[],redes:[],plataformas:[]},seguimiento:{RASTRO:[]},serverTime:'',intervaloActivoSegundos:90};
    return heading('ADMINISTRACIÓN','Conexiones en línea','El módulo está disponible. La consulta de usuarios, equipos y GPS se realiza en segundo plano.',`<button class="btn soft" data-connections-initial-retry>↻ Consultar ahora</button>`)+
      `<div class="automatic-alert-banner"><i>⌖</i><div><b>Vista abierta sin bloqueo</b><span>Puede navegar, aplicar filtros o salir del módulo aunque el servidor todavía esté procesando las conexiones.</span></div></div>`+
      `<section id="connectionsLoadNotice" aria-live="polite"><article class="card connections-opening-card"><div class="connections-opening-spinner"></div><div><h3>Consultando conexiones recientes</h3><p>La pantalla ya está abierta. Se mostrarán los resultados en cuanto responda la base central.</p><small>La consulta se cancela automáticamente si supera el tiempo máximo.</small></div></article></section>`+
      connectionFilterForm(base)+`<section id="connectionsResults" aria-live="polite">${connectionsResultsHtml(base)}</section>`;
  }
  function programarCargaInicialConexiones(){
    setTimeout(()=>cargarConexionesIniciales(),160);
  }
  function avisoCargaConexiones(texto,tipo=''){
    const state=$('#connectionsLoadNotice');
    if(!state)return;
    state.innerHTML=tipo==='error'
      ? `<article class="card connections-opening-card error"><i>!</i><div><h3>La consulta no pudo completarse</h3><p>${esc(texto)}</p><button class="btn primary" type="button" data-connections-initial-retry>Reintentar</button></div></article>`
      : `<article class="card connections-opening-card"><div class="connections-opening-spinner"></div><div><h3>Consultando conexiones</h3><p>${esc(texto)}</p><small>El módulo permanece operativo mientras espera.</small></div></article>`;
    bindSection();
  }
  async function renderConnectionsOnline(){
    if(!esAdministrador())throw new Error('SOLO_ADMINISTRADOR');
    if(!hasPermission('CONEXIONES','LEER'))throw new Error('ACCESO_CONEXIONES_NO_AUTORIZADO');
    const tieneDatos=Boolean(ultimoResumenConexiones?.serverTime)||Boolean((ultimoResumenConexiones?.equipos||[]).length);
    programarCargaInicialConexiones();
    return tieneDatos?connectionsPageHtml(ultimoResumenConexiones):connectionsLoadingHtml();
  }
  async function cargarConexionesIniciales(){
    if(currentSection!=='connections'||!esAdministrador()||!hasPermission('CONEXIONES','LEER'))return null;
    if(connectionsRefreshPending)return connectionsRefreshPending;
    const generation=++connectionsRequestGeneration;
    const slowTimer=setTimeout(()=>{
      if(currentSection==='connections'&&generation===connectionsRequestGeneration){
        avisoCargaConexiones('La base central está tardando más de lo esperado. Puede esperar o pulsar Reintentar después del mensaje de error.');
      }
    },7000);
    connectionsRefreshPending=(async()=>{
      try{
        const result=await api.request('connectionsOnline',{...connectionFilterPayload(),force:true,marcaTiempo:Date.now()});
        if(generation!==connectionsRequestGeneration)return result;
        connectionsFailureCount=0;
        ultimoResumenConexiones=result;
        if(currentSection!=='connections')return result;
        const decorated=decorarModuloConSincronizacion(connectionsPageHtml(result),'connections');
        $('#content').innerHTML=decorated;
        registrarSincronizacionSeccion('connections','SERVIDOR');
        bindSection();
        actualizarEstadoSincronizacionVisible(textoActualizacionSeccion('connections'));
        requestAnimationFrame(()=>setTimeout(initConnectionsMap,60));
        postParent({tipo:'flotas:modulo-listo',usuario:currentUser,seccion:'connections',actualizadoEn:estadoSincronizacionModulos.connections?.time||Date.now()});
        return result;
      }catch(error){
        if(generation!==connectionsRequestGeneration)return null;
        connectionsFailureCount++;
        if(currentSection==='connections')avisoCargaConexiones(translateError(error),'error');
        return null;
      }finally{
        clearTimeout(slowTimer);
        if(generation===connectionsRequestGeneration)connectionsRefreshPending=null;
        if(currentSection==='connections'&&ultimoResumenConexiones?.serverTime&&generation===connectionsRequestGeneration)scheduleConnectionsRefresh();
      }
    })();
    return connectionsRefreshPending;
  }
  function contextoOperativoMapa(row={}){
    if(row.RUTA_ID)return `<section class="mapa-contexto-operativo"><b>Ruta activa</b><span>${esc(row.RUTA_NOMBRE||row.RUTA_ID)}</span><span><strong>Desde:</strong> ${esc(row.RUTA_ORIGEN||'Origen no informado')}</span><span><strong>Hasta:</strong> ${esc(row.RUTA_DESTINO||'Destino no informado')}</span>${row.OPERACION_ID?`<small>Operación ${esc(row.OPERACION_ID)}</small>`:''}</section>`;
    if(row.OPERACION_ID)return `<section class="mapa-contexto-operativo"><b>Operación activa</b><span>${esc(row.OPERACION_ID)}</span><span><strong>Desde:</strong> ${esc(row.RUTA_ORIGEN||'Punto operacional')}</span><span><strong>Hasta:</strong> ${esc(row.RUTA_DESTINO||'Destino o regreso a base')}</span></section>`;
    return '<section class="mapa-contexto-operativo sin-asignacion"><b>Sin asignación activa</b><span>El usuario no tiene ruta ni operación activa.</span></section>';
  }
  function accionesUsuarioMapa(row={}){
    const follow=row.USUARIO_ID?`<button type="button" class="btn primary small" data-map-follow-user="${esc(row.USUARIO_ID)}">◎ Seguimiento</button>`:'';
    const phone=normalizarTelefonoWhatsApp(row.CONDUCTOR_TELEFONO||row.USUARIO_TELEFONO||'');
    const whatsapp=phone?`<a class="btn whatsapp small" href="https://wa.me/${esc(phone)}?text=${encodeURIComponent('Hola, este es un mensaje del Sistema de Gestión de Flotas.')}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`:'';
    return follow+whatsapp;
  }
  function enlazarAccionesUsuarioMapa(root=document){
    $$('[data-map-follow-user]',root).forEach(button=>{
      if(button.dataset.mapFollowBound==='1')return;
      button.dataset.mapFollowBound='1';
      button.addEventListener('click',event=>{
        event.stopPropagation();
        const userId=button.dataset.mapFollowUser;
        conCargaBoton(button,'Abriendo…',async()=>{await cambiarSeguimientoConexion(userId);if(currentSection!=='connections')await navigateSection('connections');});
      });
    });
  }
  function paintConnectionsOnline(result,adjust=false,ligero=false){
    ultimoResumenConexiones=resumenConexionesSeguro(result||ultimoResumenConexiones);
    sincronizarSeguimientoConexionesDesdeResultado(ultimoResumenConexiones);
    const rows=conexionesFiltradasCliente(ultimoResumenConexiones),totals=totalesConexionesFiltradas(rows);
    programarDireccionesConexiones(rows).catch(()=>{});
    const seguimiento=detalleSeguimientoConexion(ultimoResumenConexiones,rows);
    const visibilidadAnterior=connectionTrackedVisibility;
    const set=(id,value)=>{const node=$(id),texto=String(value);if(node&&node.textContent!==texto)node.textContent=texto;};
    if(!ligero){
      set('#connectionsTotal',totals.equipos||0);set('#connectionsOnline',totals.activos||0);set('#connectionsOffline',totals.desconectados||0);set('#connectionsGps',totals.gpsActivos||0);set('#connectionsNoGps',totals.sinGps||0);
      const visibleCount=Math.min(rows.length,120),count=$('#connectionsVisibleCount');if(count)count.textContent=rows.length>visibleCount?`Mostrando ${visibleCount} de ${rows.length} registros filtrados.`:`${rows.length} registro(s) en lista y mapa`;
      const summary=$('#connectionsMapFilterSummary'),summaryText=`${rows.length} equipo(s) coinciden con los filtros actuales y ${rows.filter(coordenadasConexionValidas).length} tienen ubicación visible.`;if(summary&&summary.textContent!==summaryText)summary.textContent=summaryText;
      const firmaFilas=firmaFilasConexiones(rows,120);
      const tbody=$('#connectionsTableBody');if(tbody&&tbody.dataset.renderKey!==firmaFilas){tbody.dataset.renderKey=firmaFilas;tbody.innerHTML=connectionRows(rows);}
      const firmaRapida=firmaFilasConexiones(rows,14);
      const quick=$('#connectionsQuickList');if(quick&&quick.dataset.renderKey!==firmaRapida){quick.dataset.renderKey=firmaRapida;quick.innerHTML=connectionQuickList(rows);}
    }
    const trackingKey=[seguimiento.id,seguimiento.visible?'1':'0',seguimiento.nombre,seguimiento.correo,seguimiento.direccion,seguimiento.rastro.length,connectionTrackingSavePending?'1':'0'].join('|');
    const trackingPanel=$('#connectionsTrackingPanel');if(trackingPanel&&trackingPanel.dataset.renderKey!==trackingKey){trackingPanel.outerHTML=panelSeguimientoConexion(ultimoResumenConexiones,rows);const nuevoPanel=$('#connectionsTrackingPanel');if(nuevoPanel)nuevoPanel.dataset.renderKey=trackingKey;}
    const sync=$('#connectionsLastSync');if(sync)sync.textContent=`${ligero?'Seguimiento en vivo':'Última consulta'}: ${fmtDate(ultimoResumenConexiones.serverTime||new Date(),true)}`;
    const markerRows=deduplicateGpsLocations(rows.filter(coordenadasConexionValidas)).slice(0,200);const markers=markerRows.map(row=>{const retenida=row.UBICACION_RETENIDA===true||String(row.UBICACION_RETENIDA||'').toUpperCase()==='SI';return{id:gpsUserMarkerKey(row),latitud:Number(row.LATITUD),longitud:Number(row.LONGITUD),nombre:`${row.USUARIO_NOMBRE||'Usuario'} · ${row.VEHICULO_PATENTE||row.DISPOSITIVO_ID||'Equipo'}`,activo:Boolean(row.EN_LINEA),seguido:String(row.USUARIO_ID||'')===connectionTrackedUserId,detalle:`<b>${esc(row.USUARIO_NOMBRE||'Usuario')}</b><span>${esc(row.CONDUCTOR_NOMBRE||'Sin conductor asociado')}</span><span>${esc(row.VEHICULO_PATENTE||row.DISPOSITIVO_ID||'Equipo')}</span><span><strong>Dirección:</strong> ${esc(direccionConexion(row))}</span><span><strong>IP:</strong> ${esc(row.IP_PUBLICA||'No disponible')}</span><span><strong>Dispositivo:</strong> ${esc(row.PLATAFORMA||row.DISPOSITIVO_ID||'No identificado')}</span><span><strong>Red:</strong> ${esc(row.TIPO_RED||'No identificada')}</span>${contextoOperativoMapa(row)}${retenida?'<span class="mapa-aviso-gps">Última ubicación confiable · señal temporalmente no disponible</span>':''}<span>Ubicación ${gpsConexionActivo(row)?'activa':'sin posición'} · precisión ${row.PRECISION_METROS!==''?`±${number(row.PRECISION_METROS)} m`:'sin dato'}${row.CALIDAD_GPS?` · calidad ${esc(row.CALIDAD_GPS)}`:''}</span><small>${String(row.USUARIO_ID||'')===connectionTrackedUserId?'Seguimiento activo · ':''}${row.EN_LINEA?'Activo':'Desconectado'} · ${fmtDate(row.FECHA_GPS||'',true)}</small>`,acciones:accionesUsuarioMapa(row)};});
    mapaFlota?.actualizarMarcadores(markers,adjust&&!seguimiento.visible);
    const puntosRastro=seguimiento.visible?seguimiento.rastro.map(punto=>({latitud:Number(punto.LATITUD),longitud:Number(punto.LONGITUD)})).filter(punto=>coordenadasConexionValidas({LATITUD:punto.latitud,LONGITUD:punto.longitud})).slice(-40):[];
    mapaFlota?.actualizarRastros?.(puntosRastro.length>1?[{id:seguimiento.id,clase:'seguimiento-individual',puntos:puntosRastro}]:[]);
    if(seguimiento.id){
      connectionTrackedVisibility=seguimiento.visible;
      if(visibilidadAnterior===false&&seguimiento.visible)connectionTrackedPositionKey='';
      if(visibilidadAnterior===true&&!seguimiento.visible)toast('Seguimiento pausado por filtros','El usuario seguido quedó fuera de los filtros. El seguimiento se reanudará al volver a mostrarlo.','warning');
      if(seguimiento.visible&&visibilidadAnterior===false)toast('Seguimiento reanudado',`${seguimiento.nombre} vuelve a estar visible en el mapa.`);
    }else connectionTrackedVisibility=null;
    if(seguimiento.visible&&seguimiento.row){
      const key=[seguimiento.row.LATITUD,seguimiento.row.LONGITUD,seguimiento.row.FECHA_GPS||seguimiento.row.ULTIMA_CONEXION||''].join('|');
      if(key!==connectionTrackedPositionKey){
        connectionTrackedPositionKey=key;
        mapaFlota?.establecerVista(Number(seguimiento.row.LATITUD),Number(seguimiento.row.LONGITUD),17);
      }
    }
    enlazarSeguimientoConexiones($('#connectionsResults')||document);
    enlazarFocoConexiones($('#connectionsResults')||document);
    enlazarAvisosConexiones($('#content')||document);
    enlazarDesconexionUsuariosConectados($('#connectionsResults')||document);
    enlazarAccionesUsuarioMapa($('#connectionsMap')||document);
  }
  function asegurarComponenteMapa(){
    if(window.MapaFlotas)return Promise.resolve(window.MapaFlotas);
    if(promesaComponenteMapa)return promesaComponenteMapa;
    promesaComponenteMapa=new Promise((resolve,reject)=>{
      const existente=[...document.scripts].find(script=>String(script.src||'').includes('/mapa.js')||String(script.src||'').endsWith('mapa.js'));
      const comprobar=()=>window.MapaFlotas?resolve(window.MapaFlotas):reject(new Error('COMPONENTE_MAPA_NO_CARGADO'));
      if(existente){
        if(window.MapaFlotas){resolve(window.MapaFlotas);return;}
        existente.addEventListener('load',comprobar,{once:true});
        existente.addEventListener('error',()=>reject(new Error('COMPONENTE_MAPA_NO_CARGADO')),{once:true});
        setTimeout(()=>{if(window.MapaFlotas)resolve(window.MapaFlotas);},120);
        return;
      }
      const script=document.createElement('script');
      script.src='mapa.js?v=4.2.50-ui11';
      script.async=true;
      script.dataset.mapaFlotas='dinamico';
      script.onload=comprobar;
      script.onerror=()=>reject(new Error('COMPONENTE_MAPA_NO_CARGADO'));
      document.head.appendChild(script);
    }).finally(()=>{if(!window.MapaFlotas)promesaComponenteMapa=null;});
    return promesaComponenteMapa;
  }

  function redibujarMapaAlHacerseVisible(){
    if(currentSection!=='gps'&&currentSection!=='connections')return;
    const contenedor=currentSection==='gps'?$('#fleetMap'):$('#connectionsMap');
    if(!contenedor?.isConnected)return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(mapaFlota){mapaFlota.redibujar?.();return;}
      if(currentSection==='gps')initMap();
      else initConnectionsMap();
    }));
  }

  async function initConnectionsMap(){
    const container=$('#connectionsMap');
    if(!container||currentSection!=='connections')return;
    if(promesaInicializacionMapaConexiones)return promesaInicializacionMapaConexiones;
    promesaInicializacionMapaConexiones=(async()=>{
      await asegurarComponenteMapa();
      const visible=await esperarTamanoMapa(container,60);
      if(!visible||currentSection!=='connections'||!container.isConnected){if(currentSection==='connections'&&container.isConnected)setTimeout(()=>initConnectionsMap(),250);return;}
      mapaFlota?.eliminar?.();
      mapaFlota=new window.MapaFlotas(container,{centro:config.CENTRO_MAPA,nivel:config.NIVEL_ACERCAMIENTO_MAPA});
      paintConnectionsOnline(ultimoResumenConexiones,true);
      requestAnimationFrame(()=>mapaFlota?.redibujar?.());
      setTimeout(()=>mapaFlota?.redibujar?.(),300);
      scheduleConnectionsRefresh();
      scheduleConnectionTrackingLive(100);
    })().catch(error=>{toast('Mapa no disponible',translateError(error),'error');}).finally(()=>{promesaInicializacionMapaConexiones=null;});
    return promesaInicializacionMapaConexiones;
  }
  function scheduleConnectionsRefresh(delay){
    if(connectionsRefreshTimer)clearTimeout(connectionsRefreshTimer);
    connectionsRefreshTimer=null;
    if(currentSection!=='connections'||!currentUser||!hasPermission('CONEXIONES','LEER'))return;
    const normal=Number(config.INTERVALO_CONEXIONES_EN_LINEA_MILISEGUNDOS||15000);
    const hidden=Number(config.INTERVALO_TIEMPO_REAL_OCULTO_MILISEGUNDOS||30000);
    const espera=Number(delay|| (document.hidden?hidden:normal));
    connectionsRefreshTimer=setTimeout(()=>refreshConnectionsOnline(false),Math.max(500,espera));
  }

  function scheduleConnectionTrackingLive(delay){
    if(connectionTrackingLiveTimer)clearTimeout(connectionTrackingLiveTimer);
    connectionTrackingLiveTimer=null;
    if(currentSection!=='connections'||!currentUser||!connectionTrackedUserId||document.hidden||!hasPermission('CONEXIONES','LEER'))return;
    const base=Number(config.INTERVALO_SEGUIMIENTO_CONEXION_MILISEGUNDOS||1500);
    const espera=Number(delay??Math.min(10000,base*Math.pow(2,Math.min(connectionTrackingLiveFailures,3))));
    connectionTrackingLiveTimer=setTimeout(()=>refreshConnectionTrackingLive(false),Math.max(500,espera));
  }
  function fusionarSeguimientoConexionTiempoReal(result){
    const fuente=result&&typeof result==='object'?result:{};
    const row=fuente.row&&typeof fuente.row==='object'?fuente.row:null;
    const usuarioId=String(fuente.seguimiento?.USUARIO_ID||connectionTrackedUserId||'').trim();
    let equipos=(ultimoResumenConexiones.equipos||[]).slice();
    if(fuente.sinConexion&&usuarioId)equipos=equipos.filter(item=>String(item.USUARIO_ID||'')!==usuarioId);
    if(row){
      const indice=equipos.findIndex(item=>
        (row.ID&&String(item.ID||'')===String(row.ID))||
        (row.DISPOSITIVO_ID&&String(item.DISPOSITIVO_ID||'')===String(row.DISPOSITIVO_ID))
      );
      if(indice>=0)equipos[indice]={...equipos[indice],...row};
      else equipos.unshift(row);
    }
    ultimoResumenConexiones=resumenConexionesSeguro({
      ...ultimoResumenConexiones,
      equipos,
      seguimiento:fuente.seguimiento||ultimoResumenConexiones.seguimiento||{},
      serverTime:fuente.serverTime||new Date().toISOString()
    });
    return ultimoResumenConexiones;
  }
  async function refreshConnectionTrackingLive(inmediato=false){
    if(connectionTrackingLivePending)return connectionTrackingLivePending;
    if(currentSection!=='connections'||!currentUser||!connectionTrackedUserId||document.hidden)return null;
    const usuarioSolicitado=connectionTrackedUserId;
    connectionTrackingLivePending=(async()=>{
      try{
        const result=await api.request('connectionTrackingLive',{USUARIO_ID:usuarioSolicitado,force:true,marcaTiempo:Date.now()});
        if(currentSection!=='connections'||usuarioSolicitado!==connectionTrackedUserId)return result;
        connectionTrackingLiveFailures=0;
        paintConnectionsOnline(fusionarSeguimientoConexionTiempoReal(result),false,true);
        return result;
      }catch(error){
        connectionTrackingLiveFailures+=1;
        const sync=$('#connectionsLastSync');
        if(sync&&connectionTrackingLiveFailures>=3)sync.textContent='Seguimiento: reconectando canal rápido…';
        return null;
      }finally{
        connectionTrackingLivePending=null;
        scheduleConnectionTrackingLive();
      }
    })();
    return connectionTrackingLivePending;
  }
  async function refreshConnectionsOnline(showToast=false,adjust=false){
    if(connectionsRefreshPending)return connectionsRefreshPending;
    const generation=++connectionsRequestGeneration;
    connectionsRefreshPending=(async()=>{
      try{
        const result=await api.request('connectionsOnline',{...connectionFilterPayload(),force:true,marcaTiempo:Date.now()});
        if(generation!==connectionsRequestGeneration||currentSection!=='connections')return result;
        connectionsFailureCount=0;
        ultimoResumenConexiones=result;
        paintConnectionsOnline(result,adjust);
        if(showToast){const totals=totalesConexionesFiltradas(conexionesFiltradasCliente(result));toast('Filtros aplicados al mapa',`${totals.equipos} equipos visibles: ${totals.activos} activos y ${totals.desconectados} desconectados.`);}
        return result;
      }catch(error){
        if(generation===connectionsRequestGeneration){
          connectionsFailureCount++;
          if(showToast||connectionsFailureCount>=2)toast('No se pudieron actualizar las conexiones',translateError(error),'error');
        }
        return null;
      }finally{
        if(generation===connectionsRequestGeneration)connectionsRefreshPending=null;
        if(currentSection==='connections'&&generation===connectionsRequestGeneration)scheduleConnectionsRefresh(connectionsFailureCount?30000:undefined);
      }
    })();
    return connectionsRefreshPending;
  }
  function applyConnectionsFilters(form,mostrarAviso=true){
    const values=Object.fromEntries(new FormData(form).entries());
    Object.keys(filtrosConexiones).forEach(key=>{filtrosConexiones[key]=String(values[key]||'').trim();});
    paintConnectionsOnline(ultimoResumenConexiones,true);
    return refreshConnectionsOnline(mostrarAviso,true);
  }
  function resetConnectionsFilters(){
    if(connectionsFilterTimer)clearTimeout(connectionsFilterTimer);
    connectionsFilterTimer=null;
    Object.keys(filtrosConexiones).forEach(key=>{filtrosConexiones[key]=['ESTADO','GPS'].includes(key)?'TODOS':'';});
    const form=$('#connectionsFilterForm');
    if(form)Object.keys(filtrosConexiones).forEach(key=>{if(form.elements[key])form.elements[key].value=filtrosConexiones[key];});
    paintConnectionsOnline(ultimoResumenConexiones,true);
    return refreshConnectionsOnline(true,true);
  }

  function locationList(rows){const validas=(Array.isArray(rows)?rows:[]).filter(coordenadasConexionValidas);return validas.length?validas.map(row=>{const active=row.EN_LINEA===true||String(row.EN_LINEA||'').toUpperCase()==='SI'||String(row.ESTADO_CONEXION||'').toLowerCase()==='activo',precision=Math.max(1,Number(row.PRECISION_METROS||9999)),calidad=precision<=25?'Alta':precision<=50?'Media':'Aceptable',device=row.PLATAFORMA||row.DISPOSITIVO_ID||'Dispositivo no identificado';return `<button class="driver-location ${active?'active':'inactive'}" data-focus-location="${row.LATITUD},${row.LONGITUD}"><i>●</i><div><b>${esc(row.CONDUCTOR_NOMBRE||row.USUARIO_NOMBRE||row.CONDUCTOR_ID||'Sin conductor')}</b><span>${esc(row.VEHICULO_PATENTE||row.VEHICULO_ID||'Sin vehículo')} · ${Number(row.VELOCIDAD_KMH||0).toFixed(0)} km/h · ${active?'En línea':'Desconectado'}</span><span class="address-line">${esc(row.DIRECCION||`${Number(row.LATITUD).toFixed(5)}, ${Number(row.LONGITUD).toFixed(5)}`)}</span><small>${esc(device)} · IP ${esc(row.IP_PUBLICA||'no disponible')}</small><small class="gps-quality ${calidad.toLowerCase()}">Precisión ${calidad} · margen ±${Math.round(precision)} m</small></div><time>${fmtDate(row.ULTIMA_CONEXION||row.FECHA_HORA,true)}</time></button>`;}).join(''):empty('⌖','Sin ubicación precisa','El sistema está esperando una señal GPS confiable. Las posiciones aproximadas no moverán el mapa.');}

  async function renderHistory(){
    const resources=['history','routes','notifications','alerts','checkins'];
    const results=await Promise.all(resources.map(solicitarListaSegura));
    const data=Object.fromEntries(resources.map((resource,index)=>[resource,results[index]]));
    if(data.history.error)throw data.history.error;
    const events=[];
    data.history.rows.forEach(row=>events.push({fecha:row.FECHA_HORA||row.CREADO_EN,tipo:'Operación',referencia:row.OPERACION_ID||row.ID,evento:row.EVENTO||'Evento',detalle:row.DETALLE||'',usuario:row.USUARIO_ID||'—'}));
    data.routes.rows.forEach(row=>events.push({fecha:row.FECHA_FIN||row.FECHA_INICIO||row.FECHA_ASIGNACION||row.CREADO_EN,tipo:'Ruta',referencia:row.ID,evento:row.ESTADO||'Asignada',detalle:`${row.ORIGEN||'Base'} → ${row.DESTINO||'Destino'}`,usuario:row.CREADO_POR||row.CONDUCTOR_ID||'—'}));
    data.notifications.rows.forEach(row=>events.push({fecha:row.FECHA_LECTURA||row.FECHA_ENVIO||row.CREADO_EN,tipo:'Notificación',referencia:row.ID,evento:row.LEIDA==='SI'?'Leída':'Enviada',detalle:`${row.TITULO||''}: ${row.MENSAJE||''}`,usuario:row.DESTINATARIO_USUARIO_ID||row.DESTINATARIO_CONDUCTOR_ID||'—'}));
    data.alerts.rows.forEach(row=>events.push({fecha:row.FECHA_HORA||row.CREADO_EN,tipo:'Alerta',referencia:row.ID,evento:row.NIVEL||'Info',detalle:`${row.TITULO||''}: ${row.MENSAJE||''}`,usuario:row.USUARIO_ID||'Sistema'}));
    data.checkins.rows.forEach(row=>events.push({fecha:row.FECHA_REVISION||row.FECHA_HORA||row.CREADO_EN,tipo:'Check-in',referencia:row.ID,evento:row.ESTADO_REVISION||row.RESULTADO||'Registrado',detalle:`Vehículo ${row.VEHICULO_ID||'—'} · Conductor ${row.CONDUCTOR_ID||'—'}`,usuario:row.REVISADO_POR||row.CREADO_POR||'—'}));
    events.sort((a,b)=>new Date(b.fecha||0)-new Date(a.fecha||0));
    const historyLimit=limiteRegistrosActual();
    if(historyLimit!=='TODOS'&&events.length>Number(historyLimit))events.splice(Number(historyLimit));
    const rows=events.map(item=>`<tr data-filter-date="${esc(item.fecha||'')}" data-search-row="${esc(`${item.tipo} ${item.referencia} ${item.evento} ${item.detalle} ${item.usuario}`.toLowerCase())}"><td>${fmtDate(item.fecha,true)}</td><td>${status(item.tipo)}</td><td><strong>${esc(item.evento)}</strong><span class="muted">${esc(item.detalle)}</span></td><td>${esc(item.referencia||'—')}</td><td>${esc(item.usuario||'—')}</td></tr>`).join('');
    return heading('TRAZABILIDAD CENTRAL','Historial','Línea de tiempo unificada de operaciones, rutas, check-ins, alertas y notificaciones.',`<button class="btn soft" data-sync>↻ Actualizar</button>${puedeExportarFormato('csv')?'<button class="btn soft" data-export="history">Exportar historial operativo</button>':''}`)+
      `<div class="live-strip">${liveStat('⇄','Operaciones',data.history.rows.length)}${liveStat('➜','Rutas',data.routes.rows.length)}${liveStat('✓','Check-ins',data.checkins.rows.length)}${liveStat('!','Alertas',data.alerts.rows.length,data.alerts.rows.some(row=>row.LEIDA!=='SI')?'warning':'')}</div>`+
      `<article class="card"><div class="toolbar"><label class="search-box"><span>⌕</span><input data-table-search placeholder="Buscar evento, referencia o usuario"></label><span class="muted push">${events.length} eventos visibles</span></div><div data-filter-table>${table(['Fecha','Origen','Evento y detalle','Referencia','Usuario'],rows,'Aún no existen eventos en el historial.')}</div></article>`;
  }
  function fechaInputIso(value){const date=value instanceof Date?value:new Date(value);if(Number.isNaN(date.getTime()))return '';const offset=date.getTimezoneOffset()*60000;return new Date(date.getTime()-offset).toISOString().slice(0,10);}
  function fechaInputVisual(value){return value?fmtDate(value,false):'';}
  function fechaFiltroVisual(value,fin=false){try{const iso=fechaVisualIso(value,false);return iso?new Date(`${iso}T${fin?'23:59:59.999':'00:00:00'}`):null;}catch(_){return null;}}
  function rangoFechaReportes(form){const startText=form?.elements.FECHA_DESDE?.value||'',endText=form?.elements.FECHA_HASTA?.value||'';return{desde:fechaFiltroVisual(startText,false),hasta:fechaFiltroVisual(endText,true)};}
  let ultimoResumenReportesKpi=null,ultimaRespuestaReportesKpi=null,secuenciaReportesKpi=0;
  function filtrosReportesKpi(paraExportar=false){const form=$('#kpiFilterForm'),exportarTodo=paraExportar&&form?.elements.ALCANCE_EXPORTACION?.value==='TODO',{desde,hasta}=rangoFechaReportes(form);return{DESDE:exportarTodo?'':desde?desde.toISOString():'',HASTA:exportarTodo?'':hasta?hasta.toISOString():'',CONDUCTOR_ID:exportarTodo?'':form?.elements.CONDUCTOR_ID?.value||'',VEHICULO_ID:exportarTodo?'':form?.elements.VEHICULO_ID?.value||'',EXPORTAR_TODO:exportarTodo?'SI':'NO'};}
  function textoEstadoKpi(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();}
  function distanciaOperacionKpi(row){const directa=Math.max(0,Number(row.DISTANCIA_KM||0));if(directa>0)return directa;return Math.max(0,Number(row.KM_FIN||0)-Number(row.KM_INICIO||0));}
  function rankingKpiMarkup(title,subtitle,rows){const normalized=(rows||[]).map(row=>({nombre:row.NOMBRE||row.nombre||row.ID||'Sin asignar',total:Number(row.TOTAL??row.total??0),km:Number(row.KM??row.km??0)})),max=Math.max(1,...normalized.map(row=>row.total));return `<article class="card kpi-ranking-card"><div class="card-header"><div><h3>${esc(title)}</h3><p>${esc(subtitle)}</p></div></div><div class="kpi-ranking-list">${normalized.map((row,index)=>`<div class="kpi-ranking-row"><span class="kpi-position">${index+1}</span><div><b>${esc(row.nombre)}</b><small>${number(row.total)} operaciones · ${number(row.km.toFixed(1))} km</small><i style="width:${Math.max(8,Math.round(row.total/max*100))}%"></i></div></div>`).join('')||empty('▥','Sin datos para el filtro','Amplíe las fechas o cambie los criterios seleccionados.')}</div></article>`;}
  function porcentajeReporte(valor,total){
    const base=Math.max(0,Number(total||0)),parte=Math.max(0,Number(valor||0));
    return base>0?Math.max(0,Math.min(100,Math.round(parte/base*100))):0;
  }
  function reporteGaugeMarkup(icono,titulo,valor,total,detalle){
    const pct=porcentajeReporte(valor,total),textoTotal=Number(total||0)>0?`${number(valor)} de ${number(total)}`:'Sin registros';
    return `<button type="button" class="report-gauge-card" data-report-detail="${esc(detalle)}" aria-label="${esc(`${titulo}: ${pct}%`)}"><span class="report-gauge-ring" style="--report-pct:${pct}"><i></i><strong>${pct}%</strong></span><span class="report-gauge-copy"><small>${esc(icono)}</small><b>${esc(titulo)}</b><em>${esc(textoTotal)}</em></span></button>`;
  }
  function reporteLineaTendencia(series=[]){
    const rows=(Array.isArray(series)?series:[]).slice(-12).map((item,index)=>({label:String(item.ETIQUETA||item.LABEL||`P${index+1}`),total:Number(item.TOTAL||0)}));
    if(!rows.length)return empty('↗','Sin tendencia disponible','Amplíe el período para visualizar la evolución operacional.');
    const width=660,height=230,padX=38,padY=30,max=Math.max(1,...rows.map(row=>row.total)),step=rows.length>1?(width-padX*2)/(rows.length-1):0;
    const points=rows.map((row,index)=>({x:padX+step*index,y:height-padY-(row.total/max)*(height-padY*2),...row}));
    const polyline=points.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),area=`${padX},${height-padY} ${polyline} ${points.at(-1)?.x||padX},${height-padY}`;
    return `<div class="report-line-chart" role="group" aria-label="Línea de tendencia operacional"><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="false"><defs><linearGradient id="reportTrendArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity=".24"/><stop offset="100%" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs><g class="report-line-grid"><line x1="${padX}" y1="${padY}" x2="${width-padX}" y2="${padY}"/><line x1="${padX}" y1="${height/2}" x2="${width-padX}" y2="${height/2}"/><line x1="${padX}" y1="${height-padY}" x2="${width-padX}" y2="${height-padY}"/></g><polygon class="report-line-area" points="${area}"/><polyline class="report-line-path" points="${polyline}" fill="none"/>${points.map((p,index)=>`<g class="report-line-point" tabindex="0" role="button" data-report-detail="${esc(`${p.label}: ${number(p.total)} operaciones`)}" aria-label="${esc(`${p.label}: ${number(p.total)} operaciones`)}"><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="7"/><text class="report-line-value" x="${p.x.toFixed(1)}" y="${Math.max(16,p.y-13).toFixed(1)}" text-anchor="middle">${number(p.total)}</text><text class="report-line-label" x="${p.x.toFixed(1)}" y="${height-8}" text-anchor="middle">${esc(p.label.slice(0,10))}</text></g>`).join('')}</svg></div>`;
  }
  function reporteDonutInteractivo(states=[]){
    const colors=['#0e9f91','#2e6fe8','#e8a128','#d65454','#8b67cc','#718393'],rows=(Array.isArray(states)?states:[]).filter(item=>Number(item.TOTAL||0)>=0),total=rows.reduce((sum,item)=>sum+Number(item.TOTAL||0),0);let offset=0;
    if(!rows.length||!total)return empty('◌','Sin distribución disponible','No hay estados operacionales para el filtro seleccionado.');
    const circles=rows.map((item,index)=>{const value=Number(item.TOTAL||0),pct=value/total*100,start=offset;offset+=pct;return `<circle class="report-donut-segment" cx="60" cy="60" r="44" pathLength="100" fill="none" stroke="${colors[index%colors.length]}" stroke-width="15" stroke-dasharray="${pct.toFixed(3)} ${(100-pct).toFixed(3)}" stroke-dashoffset="${(-start).toFixed(3)}" transform="rotate(-90 60 60)" tabindex="0" role="button" data-report-detail="${esc(`${item.ESTADO||'Sin estado'}: ${number(value)} · ${Math.round(pct)}%`)}" aria-label="${esc(`${item.ESTADO||'Sin estado'}: ${number(value)}`)}"/>`;}).join('');
    const legend=rows.map((item,index)=>{const value=Number(item.TOTAL||0),pct=Math.round(value/total*100);return `<button type="button" class="report-donut-legend" data-report-detail="${esc(`${item.ESTADO||'Sin estado'}: ${number(value)} · ${pct}%`)}"><i style="background:${colors[index%colors.length]}"></i><span>${esc(item.ESTADO||'Sin estado')}</span><b>${number(value)}</b></button>`;}).join('');
    return `<div class="report-donut-layout"><div class="report-donut-svg"><svg viewBox="0 0 120 120"><circle class="report-donut-base" cx="60" cy="60" r="44" fill="none" stroke-width="15"/>${circles}</svg><span><b>${number(total)}</b><small>operaciones</small></span></div><div class="report-donut-legends">${legend}</div></div>`;
  }
  function reporteBarrasVehiculos(vehicleKpis=[]){
    const rows=(Array.isArray(vehicleKpis)?vehicleKpis:[]).map(item=>({item,valor:Math.max(0,Number(item.RENDIMIENTO_KM_L||0))})).filter(row=>row.valor>0).sort((a,b)=>b.valor-a.valor).slice(0,8),max=Math.max(1,...rows.map(row=>row.valor));
    if(!rows.length)return empty('▥','Sin rendimiento disponible','No existen métricas de rendimiento por vehículo para este filtro.');
    return `<div class="report-bar-list">${rows.map(({item,valor},index)=>{const pct=Math.max(6,Math.round(valor/max*100)),patente=item.PATENTE||item.ID||`Vehículo ${index+1}`,detalle=`${patente}: ${valor.toFixed(2)} km/L · ${Number(item.KM_RECORRIDOS||0).toFixed(1)} km · ${Number(item.LITROS||0).toFixed(1)} L`;return `<button type="button" class="report-bar-row" data-report-detail="${esc(detalle)}"><span><b>${esc(patente)}</b><small>${esc(`${item.MARCA||''} ${item.MODELO||''}`.trim()||'Vehículo')}</small></span><i><em style="width:${pct}%"></em></i><strong>${valor.toFixed(2)} km/L</strong></button>`;}).join('')}</div>`;
  }
  function dashboardEjecutivoReportes(data,m,vehicleKpis,totalOperations){
    const opFinal=Number(m.OPERACIONES_FINALIZADAS||0),routes=Number(m.RUTAS_TOTAL||0),routesDone=Number(m.RUTAS_COMPLETADAS||0),checks=Number(m.CHECKINS_TOTAL||0),checksOk=Number(m.CHECKINS_APROBADOS||0),maint=Number(m.MANTENCIONES_TOTAL||0),maintOpen=Number(m.MANTENCIONES_ABIERTAS||0),docs=Number(m.DOCUMENTOS_TOTAL||0),docsExpired=Number(m.DOCUMENTOS_VENCIDOS||0);
    return `<section class="report-executive-dashboard" aria-label="Dashboard ejecutivo interactivo"><div class="report-dashboard-heading"><div><span class="eyebrow">DASHBOARD INTERACTIVO</span><h3>Visión ejecutiva del período</h3><p>Toque o haga clic en los gráficos para destacar un indicador y ver su detalle.</p></div><span class="status ok">Datos del reporte actual</span></div><div class="report-gauge-grid">${reporteGaugeMarkup('✓','Operaciones finalizadas',opFinal,totalOperations,`${number(opFinal)} operaciones finalizadas de ${number(totalOperations)} registradas`)}${reporteGaugeMarkup('➜','Cumplimiento de rutas',routesDone,routes,`${number(routesDone)} rutas completadas de ${number(routes)} rutas`)}${reporteGaugeMarkup('☑','Check-ins aprobados',checksOk,checks,`${number(checksOk)} check-ins aprobados de ${number(checks)} realizados`)}${reporteGaugeMarkup('⚙','Mantenciones al día',Math.max(0,maint-maintOpen),maint,`${number(Math.max(0,maint-maintOpen))} mantenciones cerradas/al día y ${number(maintOpen)} abiertas`)}${reporteGaugeMarkup('▤','Documentos vigentes',Math.max(0,docs-docsExpired),docs,`${number(Math.max(0,docs-docsExpired))} documentos vigentes y ${number(docsExpired)} vencidos`)}</div><div class="report-visual-grid"><article class="card report-chart-card report-chart-wide"><div class="card-header"><div><h3>Línea de tendencia operacional</h3><p>Evolución de las operaciones dentro del período seleccionado.</p></div><span class="report-chart-badge">↗ Tendencia</span></div>${reporteLineaTendencia(data.TENDENCIA_OPERACIONES||[])}</article><article class="card report-chart-card"><div class="card-header"><div><h3>Distribución por estado</h3><p>Participación de cada estado operacional.</p></div><span class="report-chart-badge">◌ Circular</span></div>${reporteDonutInteractivo(data.ESTADOS_OPERACIONES||[])}</article><article class="card report-chart-card"><div class="card-header"><div><h3>Rendimiento por vehículo</h3><p>Comparación interactiva de km/L para los vehículos con datos.</p></div><span class="report-chart-badge">▥ Barras</span></div>${reporteBarrasVehiculos(vehicleKpis)}</article></div><div class="report-chart-detail" data-report-chart-detail><i>◎</i><div><b>Detalle interactivo</b><span>Seleccione un anillo, segmento, barra o punto de tendencia.</span></div><button class="btn soft small" type="button" data-report-chart-reset>Restablecer</button></div></section><div class="report-dashboard-insert-anchor" aria-hidden="true"></div>`;
  }
  function bindReportDashboardInteractions(root){
    if(!root)return;const dashboard=$('.report-executive-dashboard',root),detail=$('[data-report-chart-detail]',root);if(!dashboard||!detail)return;const items=$$('[data-report-detail]',dashboard),reset=$('[data-report-chart-reset]',dashboard);
    const paint=item=>{if(!item)return;items.forEach(node=>node.classList.toggle('is-active',node===item));const text=String(item.dataset.reportDetail||'').trim(),icon=$('i',detail),title=$('b',detail),copy=$('span',detail);if(icon)icon.textContent='✓';if(title)title.textContent='Indicador seleccionado';if(copy)copy.textContent=text||'Detalle disponible.';};
    items.forEach(item=>{item.addEventListener('mouseenter',()=>{if(dashboard.dataset.reportPinned!=='1')paint(item);});item.addEventListener('focus',()=>{if(dashboard.dataset.reportPinned!=='1')paint(item);});item.addEventListener('click',event=>{event.preventDefault();dashboard.dataset.reportPinned='1';paint(item);});item.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();dashboard.dataset.reportPinned='1';paint(item);}});});
    reset?.addEventListener('click',()=>{dashboard.dataset.reportPinned='0';items.forEach(node=>node.classList.remove('is-active'));const icon=$('i',detail),title=$('b',detail),copy=$('span',detail);if(icon)icon.textContent='◎';if(title)title.textContent='Detalle interactivo';if(copy)copy.textContent='Seleccione un anillo, segmento, barra o punto de tendencia.';});
  }
  async function pintarKpisReportes(recargar=false){
    const target=$('#kpiReportResults');if(!target)return;
    if(recargar){const solicitud=++secuenciaReportesKpi;target.innerHTML='<article class="card loading-state"><span class="spinner"></span><b>Calculando indicadores en la Base de Datos…</b><small>La pantalla no está descargando el historial completo.</small></article>';try{const respuesta=await api.request('reportsKpiSummary',{data:filtrosReportesKpi(),cache:false});if(solicitud!==secuenciaReportesKpi||currentSection!=='reports')return;ultimaRespuestaReportesKpi=respuesta;ultimoResumenReportesKpi=respuesta?.resumen||{};}catch(error){if(solicitud!==secuenciaReportesKpi)return;target.innerHTML=`<article class="module-error"><b>No fue posible calcular los indicadores</b><span>${esc(translateError(error))}</span><button class="btn primary" data-kpi-retry>Reintentar</button></article>`;$('[data-kpi-retry]',target)?.addEventListener('click',()=>pintarKpisReportes(true));return;}}
    const data=ultimoResumenReportesKpi||{},m=data.METRICAS||{},operations=Array.isArray(data.DETALLE_OPERACIONES)?data.DETALLE_OPERACIONES:[],drivers=Array.isArray(data.CATALOGO_CONDUCTORES)?data.CATALOGO_CONDUCTORES:[],vehicles=Array.isArray(data.CATALOGO_VEHICULOS)?data.CATALOGO_VEHICULOS:[],driverMap=Object.fromEntries(drivers.map(row=>[String(row.ID),row])),vehicleMap=Object.fromEntries(vehicles.map(row=>[String(row.ID),row])),totalOperations=Number(m.OPERACIONES_TOTAL||0),totalKm=Number(m.KILOMETROS||0),liters=Number(m.COMBUSTIBLE_LITROS||0),kmLiter=liters>0?totalKm/liters:0;
    const vehicleKpis=Array.isArray(data.KPI_VEHICULOS)?data.KPI_VEHICULOS:[],routeTraceMetrics=data.KPI_TRAZABILIDAD_RUTAS||{},routeTraceRows=Array.isArray(data.DETALLE_TRAZABILIDAD_RUTAS)?data.DETALLE_TRAZABILIDAD_RUTAS:[];
    const rows=operations.map(row=>`<tr><td><strong>${esc(row.ID)}</strong></td><td>${esc(vehicleMap[String(row.VEHICULO_ID)]?.PATENTE||row.VEHICULO_ID||'—')}</td><td>${esc(driverMap[String(row.CONDUCTOR_ID)]?.NOMBRE||row.CONDUCTOR_ID||'—')}</td><td>${fmtDate(row.FECHA_INICIO,true)}</td><td>${number(distanciaOperacionKpi(row).toFixed(1))} km</td><td>${textoEstadoKpi(row.VALIDACION_FIN).includes('precision_baja')?status('GPS impreciso'):status(String(row.CIERRE_FUERA_BASE||'').toUpperCase()==='SI'?'Cierre excepcional':row.ESTADO)}</td></tr>`).join('');
    target.innerHTML=`<div class="module-diagnostic success"><i>✓</i><div><b>Cálculo agregado en la base de datos</b><span>${number(ultimaRespuestaReportesKpi?.filasTransferidas||operations.length)} filas transferidas para mostrar un resumen de ${number(totalOperations)} operaciones. El historial completo permanece en la Base de Datos.</span></div></div><div class="kpi-filter-summary"><span><b>${number(totalOperations)}</b> operaciones</span><span><b>${number(m.RUTAS_TOTAL||0)}</b> rutas</span><span><b>${number(m.CHECKINS_TOTAL||0)}</b> check-ins</span><span><b>${number(m.COMBUSTIBLE_TOTAL||0)}</b> cargas</span><span><b>${number(m.MANTENCIONES_TOTAL||0)}</b> mantenciones</span><span><b>${number(m.DOCUMENTOS_TOTAL||0)}</b> documentos</span></div><div class="kpi-grid kpi-grid-advanced">${metric('⇄','Operaciones',totalOperations,`${number(m.OPERACIONES_ACTIVAS||0)} activas`)}${metric('✓','Finalizadas',number(m.OPERACIONES_FINALIZADAS||0),totalOperations?`${Math.round(Number(m.OPERACIONES_FINALIZADAS||0)/totalOperations*100)}% del período`:'Sin actividad')}${metric('↗','Kilómetros',number(totalKm.toFixed(1)),'Distancia registrada')}${metric('◷','Duración promedio',`${Number(m.DURACION_PROMEDIO_HORAS||0).toFixed(1)} h`,'Operaciones finalizadas')}${metric('➜','Rutas',number(m.RUTAS_TOTAL||0),`${number(m.RUTAS_COMPLETADAS||0)} completadas`)}${metric('☑','Check-ins',number(m.CHECKINS_TOTAL||0),`${number(m.CHECKINS_APROBADOS||0)} aprobados · ${number(m.CHECKINS_BLOQUEADOS||0)} bloqueados`)}${metric('⛽','Combustible',`${number(liters.toFixed(1))} L`,`${number(m.COMBUSTIBLE_TOTAL||0)} cargas`)}${metric('$','Gasto combustible',clp(Number(m.COMBUSTIBLE_COSTO||0)),`${kmLiter.toFixed(1)} km/L estimados`)}${metric('⚙','Mantenciones abiertas',number(m.MANTENCIONES_ABIERTAS||0),`${number(m.MANTENCIONES_TOTAL||0)} registros`)}${metric('▤','Documentos vencidos',number(m.DOCUMENTOS_VENCIDOS||0),`${number(m.DOCUMENTOS_TOTAL||0)} documentos analizados`)}${metric('!','Alertas pendientes',number(m.ALERTAS_PENDIENTES||0),`${number(m.ALERTAS_TOTAL||0)} alertas del período`)}${metric('⌖','Riesgos de ubicación',number(m.RIESGOS_GPS||0),`${number(m.CIERRES_EXCEPCIONALES||0)} cierres excepcionales`)}</div>${dashboardEjecutivoReportes(data,m,vehicleKpis,totalOperations)}<div class="kpi-ranking-grid">${rankingKpiMarkup('Conductores con más operaciones','Ranking calculado dentro de la Base de Datos',data.RANKING_CONDUCTORES||[])}${rankingKpiMarkup('Vehículos con mayor actividad','Cantidad de operaciones y kilómetros',data.RANKING_VEHICULOS||[])}</div><article class="card"><div class="card-header"><div><h3>Detalle reciente</h3><p>Mostrando ${number(operations.length)} de ${number(totalOperations)} operaciones. La exportación completa se consulta solamente al solicitarla.</p></div>${['csv','xlsx','pdf'].some(puedeExportarFormato)?`<div class="report-format-actions">${puedeExportarFormato('csv')?'<button class="btn soft" data-export-kpi-format="csv">CSV</button>':''}${puedeExportarFormato('xlsx')?'<button class="btn soft" data-export-kpi-format="xlsx">Excel</button>':''}${puedeExportarFormato('pdf')?'<button class="btn primary" data-export-kpi-format="pdf">PDF</button>':''}</div>`:''}</div>${table(['Operación','Vehículo','Conductor','Inicio','Distancia','Resultado'],rows,'No existen operaciones para el filtro seleccionado.')}</article>`;
    if(Object.keys(routeTraceMetrics).length){const traceTable=routeTraceRows.map(item=>`<tr><td><strong>${esc(item.NOMBRE_RUTA||item.RUTA_ID)}</strong><span class="muted">${esc(item.ESTADO||'')}</span></td><td>${fmtDate(item.FECHA_ASIGNACION,true)}</td><td>${item.FECHA_ACEPTACION?fmtDate(item.FECHA_ACEPTACION,true):'Pendiente'}</td><td>${item.FECHA_INICIO?fmtDate(item.FECHA_INICIO,true):'Pendiente'}</td><td>${item.FECHA_COMPLETADA?fmtDate(item.FECHA_COMPLETADA,true):'Pendiente'}</td><td>${item.TIEMPO_INICIO_COMPLETADA_SEGUNDOS!=null?formatRouteElapsed(item.TIEMPO_INICIO_COMPLETADA_SEGUNDOS):'—'}</td><td>${item.TIEMPO_TOTAL_CICLO_SEGUNDOS!=null?formatRouteElapsed(item.TIEMPO_TOTAL_CICLO_SEGUNDOS):'—'}</td></tr>`).join(''),section=`<article class="card route-kpi-history"><div class="card-header"><div><h3>Historial KPI de rutas</h3><p>Tiempos consolidados entre asignación, aceptación, inicio y finalización.</p></div></div><div class="kpi-grid route-stage-kpis">${metric('✓','Rutas aceptadas',number(routeTraceMetrics.RUTAS_ACEPTADAS||0),`${number(routeTraceMetrics.RUTAS_TRAZADAS||0)} trazadas`)}${metric('◷','Asignación → aceptación',formatRouteElapsed(routeTraceMetrics.PROMEDIO_ASIGNACION_ACEPTACION_SEGUNDOS||0),'Promedio')}${metric('➜','Aceptación → inicio',formatRouteElapsed(routeTraceMetrics.PROMEDIO_ACEPTACION_INICIO_SEGUNDOS||0),'Promedio')}${metric('⌁','Tiempo en ruta',formatRouteElapsed(routeTraceMetrics.PROMEDIO_CONDUCCION_SEGUNDOS||0),'Promedio')}${metric('◎','Ciclo completo',formatRouteElapsed(routeTraceMetrics.PROMEDIO_CICLO_TOTAL_SEGUNDOS||0),`${number(routeTraceMetrics.RUTAS_COMPLETADAS||0)} completadas`)}</div>${table(['Ruta','Asignada','Aceptada','Iniciada','Completada','En ruta','Ciclo total'],traceTable,'Todavía no existen rutas con trazabilidad para el filtro seleccionado.')}</article>`;target.querySelector('.report-dashboard-insert-anchor')?.insertAdjacentHTML('beforebegin',section);}
    if(vehicleKpis.length){const vehicleRows=vehicleKpis.map(item=>`<tr><td><strong>${esc(item.PATENTE||item.ID)}</strong><span class="muted">${esc(`${item.MARCA||''} ${item.MODELO||''}`.trim())}</span></td><td>${number(Number(item.KM_RECORRIDOS||0).toFixed(1))} km</td><td>${number(Number(item.VELOCIDAD_ACTUAL_KMH||0).toFixed(1))} / ${number(Number(item.VELOCIDAD_MAXIMA_KMH||0).toFixed(1))} km/h</td><td>${number(Number(item.LITROS||0).toFixed(1))} L</td><td>${number(Number(item.CONSUMO_LITROS_DIA||0).toFixed(2))} L/día</td><td>${number(Number(item.RENDIMIENTO_KM_L||0).toFixed(2))} km/L</td><td>${clp(Number(item.PRECIO_PROMEDIO_LITRO||0))}</td><td>${clp(Number(item.COSTO_DIA||0))}</td></tr>`).join(''),section=`<article class="card vehicle-kpi-card"><div class="card-header"><div><h3>Rendimiento por vehículo</h3><p>Kilómetros, velocidad, precio y consumo diario. El conductor solo ve su vehículo asignado.</p></div></div>${table(['Vehículo','KM recorridos','Velocidad actual / máxima','Combustible','Consumo diario','Rendimiento','Precio por litro','Costo diario'],vehicleRows,'Sin métricas vehiculares para el período.')}</article>`;target.querySelector('.report-dashboard-insert-anchor')?.insertAdjacentHTML('beforebegin',section);}
    $$('[data-export-kpi-format]',target).forEach(button=>button.addEventListener('click',()=>conCargaBoton(button,'Exportando…',()=>exportarKpisFiltrados(button.dataset.exportKpiFormat))));
    bindReportDashboardInteractions(target);
  }
  async function exportarKpisFiltrados(formato='csv'){
    if(!puedeExportarFormato(formato))throw new Error('PERMISO_DENEGADO');
    const filters=filtrosReportesKpi(true),operations=[];let offset=0,hasMore=true,pages=0;
    while(hasMore){const page=await api.request('reportsKpiDetail',{data:{...filters,FORMATO:String(formato).toUpperCase(),DESDE_REGISTRO:offset,LIMITE:1000},cache:false}),rows=Array.isArray(page?.rows)?page.rows:[];operations.push(...rows);offset+=rows.length;hasMore=Boolean(page?.hasMore??page?.HAS_MORE);pages++;if(hasMore&&!rows.length)throw new Error('PAGINACION_SIN_AVANCE');if(pages>10000)throw new Error('PAGINACION_EXCESIVA');}
    if(!operations.length)return toast('Sin datos','No hay operaciones filtradas para exportar.','error');
    const exporter=window.ExportadorReportesFlotas;if(!exporter)throw new Error('EXPORTADOR_REPORTES_NO_DISPONIBLE');
    const form=$('#kpiFilterForm'),{desde,hasta}=rangoFechaReportes(form),drivers=ultimoResumenReportesKpi?.CATALOGO_CONDUCTORES||[],vehicles=ultimoResumenReportesKpi?.CATALOGO_VEHICULOS||[],driver=drivers.find(row=>String(row.ID)===String(filters.CONDUCTOR_ID)),vehicle=vehicles.find(row=>String(row.ID)===String(filters.VEHICULO_ID));
    await exporter.exportarFilas(operations,{formato,nombre:filters.EXPORTAR_TODO==='SI'?'KPI_Operaciones_Todo':'KPI_Operaciones',titulo:filters.EXPORTAR_TODO==='SI'?'Reporte completo de operaciones':'Reporte de operaciones filtradas',subtitulo:'Indicadores operacionales del Sistema de Gestión de Flotas',autor:currentUser?.NOMBRE||currentUser?.CORREO||'',hoja:'Operaciones',metadatos:{'Alcance':filters.EXPORTAR_TODO==='SI'?'Todo el historial autorizado':'Filtros actuales','Fecha desde':filters.EXPORTAR_TODO==='SI'?'Sin límite':desde?fmtDate(desde,false):'Sin límite','Fecha hasta':filters.EXPORTAR_TODO==='SI'?'Sin límite':hasta?fmtDate(hasta,false):'Sin límite','Conductor':filters.EXPORTAR_TODO==='SI'?'Todos':driver?.NOMBRE||'Todos','Vehículo':filters.EXPORTAR_TODO==='SI'?'Todos':vehicle?.PATENTE||'Todos','Total operaciones':operations.length}});
    toast('Reporte exportado',`${operations.length} operaciones incluidas en ${formato.toUpperCase()}.`);
  }
  async function renderReports(){
    const respuesta=await api.request('reportsKpiSummary',{data:{},cache:false});ultimaRespuestaReportesKpi=respuesta;ultimoResumenReportesKpi=respuesta?.resumen||{};
    const drivers=ultimoResumenReportesKpi.CATALOGO_CONDUCTORES||[],vehicles=ultimoResumenReportesKpi.CATALOGO_VEHICULOS||[],today='',start='',exportResources=[['vehicles','VEHICULOS'],['drivers','CONDUCTORES'],['operations','OPERACIONES'],['routes','RUTAS'],['checkins','CHECKIN'],['fuel','COMBUSTIBLE'],['maintenance','MANTENCIONES'],['documents','DOCUMENTOS'],['alerts','ALERTAS'],['gps','GPS']].filter(([,module])=>hasPermission(module,'LEER')).map(([resource])=>resource);
    return heading('INTELIGENCIA OPERACIONAL','KPIs y reportes','Analice todo el historial autorizado por período, conductor y vehículo sin descargarlo al abrir el tablero.',`<button class="btn soft" data-sync>↻ Actualizar</button>`)+`<article class="card kpi-filter-card"><div class="card-header"><div><h3>Filtros del análisis</h3><p>Los cálculos se ejecutan en la base de datos. Por defecto se analiza todo el historial; puede limitarlo a 30 días o indicar fechas.</p></div></div><form id="kpiFilterForm" class="kpi-filter-form"><label class="field"><span>Desde</span><input type="text" inputmode="numeric" name="FECHA_DESDE" value="${fechaInputVisual(start)}" placeholder="Sin límite" pattern="(?:\\d{2}/\\d{2}/\\d{4})?"></label><label class="field"><span>Hasta</span><input type="text" inputmode="numeric" name="FECHA_HASTA" value="${fechaInputVisual(today)}" placeholder="Sin límite" pattern="(?:\\d{2}/\\d{2}/\\d{4})?"></label><label class="field"><span>Conductor</span><select name="CONDUCTOR_ID"><option value="">Todos los conductores</option>${drivers.map(row=>`<option value="${esc(row.ID)}">${esc(row.NOMBRE||row.ID)}</option>`).join('')}</select></label><label class="field"><span>Vehículo</span><select name="VEHICULO_ID"><option value="">Todos los vehículos</option>${vehicles.map(row=>`<option value="${esc(row.ID)}">${esc(row.PATENTE||row.ID)} · ${esc(`${row.MARCA||''} ${row.MODELO||''}`.trim())}</option>`).join('')}</select></label><label class="field"><span>Alcance de la exportación</span><select name="ALCANCE_EXPORTACION"><option value="FILTROS">Exportar con los filtros actuales</option><option value="TODO">Exportar todo el historial autorizado</option></select><small>“Exportar todo” ignora fechas, conductor y vehículo solamente al generar el archivo.</small></label><div class="form-actions"><button class="btn soft" type="button" data-kpi-all>Todo el historial</button><button class="btn soft" type="button" data-kpi-reset>Últimos 30 días</button><button class="btn primary" type="button" data-kpi-apply>Aplicar filtros</button></div></form></article><section id="kpiReportResults" aria-live="polite"></section><article class="card"><div class="card-header"><div><h3>Exportaciones generales</h3><p>La base completa se recorre por páginas únicamente cuando se solicita una exportación.</p></div></div><div class="kpi-export-grid">${exportResources.map(resource=>`<article class="metric-card report-export-card"><i class="metric-icon">⇩</i><div><span>Exportar</span><b style="font-size:17px">${labels[resource]||resource}</b><small>Consulta completa bajo demanda</small>${botonesExportacion('data-export-resource',resource,true)}</div></article>`).join('')}</div></article>`;
  }
  async function renderAudit(){const result=await solicitarListaPaginada('audit',{cache:false});guardarListaFormulario('audit',result.rows||[]);const rows=(result.rows||[]).map(a=>`<tr><td>${fmtDate(a.FECHA_HORA||a.CREADO_EN,true)}</td><td>${esc(a.USUARIO_NOMBRE)}</td><td><strong>${esc(a.ACCION)}</strong></td><td>${esc(a.MODULO)}</td><td>${esc(a.IP_CLIENTE||a.IP_PUBLICA||'')}</td><td>${esc(a.DETALLE)}</td></tr>`).join('');return heading('BITÁCORA','Auditoría','Registro de las acciones realizadas en el sistema.',`<button class="btn soft" data-sync>↻ Actualizar</button>${puedeExportarFormato('csv')?'<button class="btn soft" data-export="audit">Exportar CSV</button>':''}`)+`<article class="card">${table(['Fecha','Usuario','Acción','Módulo','IP','Detalle'],rows)}</article>`;}
  async function refreshCompanyBranding(){
    try{const result=await api.request('list',{resource:'companies'});currentCompany=empresaConPuntoDispositivo(seleccionarEmpresaPrincipal(result.rows||[])||currentCompany||{});applyBranding(currentCompany);}catch(_){applyBranding(currentCompany);}
  }

  function applyBranding(company){
    if(company)currentCompany=company;
    const data=currentCompany||{};
    const name=data.NOMBRE_FANTASIA||data.RAZON_SOCIAL||'Sistema de Gestión de Flotas';
    const subtitle=data.GIRO||'Gestión integral';
    const logo=data.DIRECCION_LOGOTIPO||defaultLogo;
    ['authCompanyName','loginCompanyName','sidebarCompanyName'].forEach(id=>{const node=$('#'+id);if(node)node.textContent=name;});
    const sub=$('#sidebarCompanySubtitle');if(sub)sub.textContent=subtitle;
    ['authCompanyLogo','loginCompanyLogo','sidebarCompanyLogo'].forEach(id=>{const image=$('#'+id);if(image){image.src=logo;image.onerror=()=>{image.onerror=null;image.src=defaultLogo;};}});
    const tema=window.TemaFlotas?.aplicarEmpresa?.(data,{guardar:true})||null;
    postParent({tipo:'flotas:empresa',nombre:name,logo:logo,tema});
    document.title=`${name} | Sistema de Gestión de Flotas`;
  }

  function companyValue(company,key,fallback=''){return esc(company?.[key]??fallback);}

  async function renderCompany(){
    const result=await api.request('list',{resource:'companies'});const company=seleccionarEmpresaPrincipal(result.rows||[])||{};currentCompany=company;applyBranding(company);
    guardarListaFormulario('companies',result.rows||[]);
    const logo=company.DIRECCION_LOGOTIPO||defaultLogo;
    return heading('IDENTIDAD INSTITUCIONAL','Empresa','Administre el logotipo, los datos legales, la ubicación y las preferencias generales de la organización.',`<button class="btn soft" data-sync>↻ Actualizar</button><span class="status ok">Configuración permanente</span>`)+
    `<form id="companyForm" class="company-layout">
      <article class="card company-logo-card">
        <div class="card-header"><div><h3>Logotipo de la empresa</h3><p>Se mostrará en el acceso y en el menú principal</p></div></div>
        <div class="company-logo-preview"><img id="companyLogoPreview" src="${esc(logo)}" alt="Vista previa del logotipo"></div>
        <label class="field"><span>Cargar logotipo</span><input id="companyLogo" type="file" accept="image/png,image/jpeg,image/webp"></label>
        <p class="helper">Formatos permitidos: PNG, JPG o WebP. Tamaño recomendado: hasta 1,5 MB.</p>
        <input id="removeLogoValue" type="hidden" value="NO">
        <button class="btn soft full" data-remove-company-logo type="button">Quitar logotipo actual</button>
        <div class="brand-colors">
          <label class="field"><span>Color principal</span><input name="COLOR_PRINCIPAL" type="color" value="${companyValue(company,'COLOR_PRINCIPAL','#0b5f59')}"></label>
          <label class="field"><span>Color secundario</span><input name="COLOR_SECUNDARIO" type="color" value="${companyValue(company,'COLOR_SECUNDARIO','#074640')}"></label>
        </div>
      </article>
      <div class="company-form-column">
        <article class="card">
          <div class="card-header"><div><h3>Identificación de la empresa</h3><p>Datos comerciales y legales</p></div></div>
          <div class="form-grid">
            <label class="field"><span>RUT</span><input name="RUT" value="${companyValue(company,'RUT')}" placeholder="76.123.456-0"></label>
            <label class="field"><span>Razón social</span><input name="RAZON_SOCIAL" value="${companyValue(company,'RAZON_SOCIAL')}" required></label>
            <label class="field"><span>Nombre de fantasía</span><input name="NOMBRE_FANTASIA" value="${companyValue(company,'NOMBRE_FANTASIA')}" required></label>
            <label class="field"><span>Giro o actividad</span><input name="GIRO" value="${companyValue(company,'GIRO')}"></label>
            <label class="field"><span>Representante legal</span><input name="REPRESENTANTE_LEGAL" value="${companyValue(company,'REPRESENTANTE_LEGAL')}"></label>
            <label class="field"><span>RUT del representante</span><input name="RUT_REPRESENTANTE" value="${companyValue(company,'RUT_REPRESENTANTE')}"></label>
          </div>
        </article>
        <article class="card">
          <div class="card-header"><div><h3>Contacto y ubicación</h3><p>Información para documentos y comunicaciones</p></div></div>
          <div class="form-grid">
            <label class="field full"><span>Dirección</span><input name="DIRECCION" value="${companyValue(company,'DIRECCION')}" data-address-autocomplete placeholder="Comience a escribir una dirección"></label>
            <label class="field"><span>Comuna</span><input name="COMUNA" value="${companyValue(company,'COMUNA')}"></label>
            <label class="field"><span>Ciudad</span><input name="CIUDAD" value="${companyValue(company,'CIUDAD')}"></label>
            <label class="field"><span>Región</span><input name="REGION" value="${companyValue(company,'REGION')}"></label>
            <label class="field"><span>País</span><input name="PAIS" value="${companyValue(company,'PAIS','Chile')}"></label>
            <label class="field"><span>Teléfono principal</span><input name="TELEFONO_PRINCIPAL" value="${companyValue(company,'TELEFONO_PRINCIPAL')}"></label>
            <label class="field"><span>Teléfono secundario</span><input name="TELEFONO_SECUNDARIO" value="${companyValue(company,'TELEFONO_SECUNDARIO')}"></label>
            <label class="field"><span>Correo institucional</span><input name="CORREO" type="email" value="${companyValue(company,'CORREO')}"></label>
            <label class="field"><span>Sitio web</span><input name="SITIO_WEB" type="url" value="${companyValue(company,'SITIO_WEB')}" placeholder="https://..."></label>
          </div>
        </article>
        <article class="card">
          <div class="card-header"><div><h3>Preferencias generales</h3><p>Formato utilizado por el sistema</p></div></div>
          <div class="form-grid">
            <label class="field"><span>Zona horaria</span><select name="ZONA_HORARIA"><option ${company.ZONA_HORARIA==='America/Santiago'?'selected':''}>America/Santiago</option><option ${company.ZONA_HORARIA==='America/Sao_Paulo'?'selected':''}>America/Sao_Paulo</option><option ${company.ZONA_HORARIA==='UTC'?'selected':''}>UTC</option></select></label>
            <label class="field"><span>Moneda</span><select name="MONEDA"><option value="CLP" ${company.MONEDA==='CLP'?'selected':''}>Peso chileno</option><option value="USD" ${company.MONEDA==='USD'?'selected':''}>Dólar estadounidense</option><option value="EUR" ${company.MONEDA==='EUR'?'selected':''}>Euro</option></select></label>
            <label class="field"><span>Unidad de distancia</span><select name="UNIDAD_DISTANCIA"><option value="km" ${company.UNIDAD_DISTANCIA!=='mi'?'selected':''}>Kilómetros</option><option value="mi" ${company.UNIDAD_DISTANCIA==='mi'?'selected':''}>Millas</option></select></label>
            <label class="field"><span>Formato de fecha</span><select name="FORMATO_FECHA"><option value="DD-MM-AAAA" ${company.FORMATO_FECHA!=='AAAA-MM-DD'?'selected':''}>Día-Mes-Año</option><option value="AAAA-MM-DD" ${company.FORMATO_FECHA==='AAAA-MM-DD'?'selected':''}>Año-Mes-Día</option></select></label>
            <label class="field full"><span>Texto de pie institucional</span><textarea name="TEXTO_PIE" placeholder="Texto para reportes y documentos">${companyValue(company,'TEXTO_PIE')}</textarea></label>
            <label class="field"><span>Estado</span><select name="ESTADO"><option ${company.ESTADO!=='Inactivo'?'selected':''}>Activo</option><option ${company.ESTADO==='Inactivo'?'selected':''}>Inactivo</option></select></label>
          </div>
          <div class="form-actions"><button class="btn primary" type="submit">Guardar configuración de empresa</button></div>
        </article>
      </div>
    </form>`;
  }

  function readImageFile(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error('NO_SE_PUDO_LEER_LOGO'));reader.readAsDataURL(file);});}

  async function saveCompany(event){
    event.preventDefault();const form=event.currentTarget;const button=$('button[type="submit"]',form);
    await conCargaBoton(button,'Guardando…',async()=>{
      setSave('Guardando empresa…','saving');
      try{
        const formData=new FormData(form),data=Object.fromEntries(formData.entries());const file=$('#companyLogo')?.files?.[0];
        const payload={data,eliminarLogotipo:$('#removeLogoValue')?.value||'NO'};
        if(file){if(file.size>1572864)throw new Error('LOGOTIPO_DEMASIADO_GRANDE');payload.logotipoBase64=await readImageFile(file);payload.nombreLogotipo=file.name;payload.tipoLogotipo=file.type;}
        const result=await api.request('saveCompany',payload);currentCompany=result.row||data;invalidarListasFormulario('companies');cacheVistasModulo.delete('company');applyBranding(currentCompany);toast('Empresa guardada','La identidad y la información institucional fueron actualizadas.');setSave('Datos guardados');actualizarSeccionEnSegundoPlano('company');
      }catch(error){setSave('Error al guardar','error');toast('No se pudo guardar la empresa',translateError(error),'error');}
    });
  }

  function campoColorTema(nombre,etiqueta,valor,detalle=''){
    return `<label class="theme-color-control"><input type="color" name="${nombre}" value="${esc(valor)}" data-theme-color><span><b>${esc(etiqueta)}</b><small data-theme-code="${nombre}">${esc(valor)}</small>${detalle?`<em class="helper">${esc(detalle)}</em>`:''}</span></label>`;
  }
  function preajustesTemaMarkup(){
    const presets=window.TemaFlotas?.PREAJUSTES||{};
    return Object.entries(presets).map(([id,preset])=>{const v=preset.valores;return `<button class="theme-preset" type="button" data-theme-preset="${esc(id)}"><span class="theme-preset-swatches"><i style="background:${esc(v.COLOR_PRINCIPAL)}"></i><i style="background:${esc(v.COLOR_ACENTO)}"></i><i style="background:${esc(v.COLOR_MENU)}"></i></span><b>${esc(preset.nombre)}</b><small>Aplicar vista previa</small></button>`;}).join('');
  }
  function contrasteTemaMarkup(tema){
    const checks=[['Texto sobre fondo',tema.COLOR_TEXTO,tema.COLOR_FONDO],['Texto sobre tarjetas',tema.COLOR_TEXTO,tema.COLOR_SUPERFICIE],['Blanco sobre principal','#FFFFFF',tema.COLOR_PRINCIPAL],['Blanco sobre menú','#FFFFFF',tema.COLOR_MENU]];
    return checks.map(([label,a,b])=>{const ratio=window.TemaFlotas?.contraste?.(a,b)||0,ok=ratio>=4.5;return `<div class="theme-contrast-row"><span>${esc(label)}</span><b class="${ok?'ok':'warning'}">${ratio.toFixed(1)}:1 · ${ok?'Correcto':'Revisar'}</b></div>`;}).join('');
  }
  function datosTemaFormulario(form){return window.TemaFlotas?.normalizar?.(Object.fromEntries(new FormData(form).entries()))||Object.fromEntries(new FormData(form).entries());}
  function actualizarVistaPreviaTema(form){
    const tema=datosTemaFormulario(form);window.TemaFlotas?.aplicar?.(tema,{guardar:false});
    $$('[data-theme-color]',form).forEach(input=>{const code=form.querySelector(`[data-theme-code="${input.name}"]`);if(code)code.textContent=input.value.toUpperCase();});
    const contrasts=$('#themeContrastList');if(contrasts)contrasts.innerHTML=contrasteTemaMarkup(tema);
    postParent({tipo:'flotas:tema-colores',tema});
  }
  function aplicarValoresTemaFormulario(form,valores){
    const tema=window.TemaFlotas?.normalizar?.(valores)||valores;
    Object.entries(tema).forEach(([key,value])=>{const field=form.elements[key];if(field)field.value=value;});
    actualizarVistaPreviaTema(form);
  }
  async function saveTheme(event){
    event.preventDefault();const form=event.currentTarget,button=$('button[type="submit"]',form),data=datosTemaFormulario(form);
    await conCargaBoton(button,'Guardando tema…',async()=>{
      setSave('Guardando apariencia…','saving');
      try{
        const result=await api.request('saveCompany',{data});currentCompany=result.row||{...(currentCompany||{}),...data};
        invalidarListasFormulario('companies');cacheVistasModulo.delete('settings');cacheVistasModulo.delete('company');
        applyBranding(currentCompany);window.TemaFlotas?.aplicarEmpresa?.(currentCompany,{guardar:true});
        toast('Colores guardados','La nueva identidad visual se aplicó al acceso, menú principal y todos los módulos.');setSave('Apariencia guardada');
      }catch(error){setSave('Error al guardar','error');toast('No se pudieron guardar los colores',translateError(error),'error');}
    });
  }
  async function generarRespaldoGeneralXlsx(button){
    if(currentUser?.ROL_ID!=='ROL-ADMIN'||!hasPermission('CONFIGURACION','RESPALDO_GENERAL'))throw new Error('RESPALDO_GENERAL_SOLO_ADMINISTRADOR');
    const exporter=window.ExportadorReportesFlotas;if(!exporter?.exportarHojas)throw new Error('EXPORTADOR_XLSX_NO_DISPONIBLE');
    const statusNode=$('[data-backup-status]');
    const updateStatus=(text,mode='')=>{if(!statusNode)return;statusNode.className=`backup-status ${mode}`;statusNode.textContent=text;};
    updateStatus('Preparando catálogo de la Base de Datos…','working');
    const catalog=await api.request('backupCatalog',{cache:false});const sheets=[],available=(catalog.tables||[]).filter(item=>item.disponible);
    sheets.push({nombre:'RESUMEN',headers:['CAMPO','VALOR'],rows:[
      {CAMPO:'Sistema',VALOR:'Sistema de Gestión de Flotas'},{CAMPO:'Versión',VALOR:catalog.version||config.VERSION},{CAMPO:'Fecha del respaldo',VALOR:catalog.generadoEn||new Date().toISOString()},
      {CAMPO:'Generado por',VALOR:catalog.generadoPor||currentUser?.NOMBRE||currentUser?.CORREO||''},{CAMPO:'Tablas incluidas',VALOR:catalog.totalTablas||available.length},{CAMPO:'Registros incluidos',VALOR:catalog.totalRegistros||0},
      {CAMPO:'Protección',VALOR:'Contraseñas, sales, tokens, claves privadas y credenciales se reemplazan por [PROTEGIDO].'}
    ]});
    let completed=0;
    for(const table of available){
      const rows=[];let page=0,finished=false;
      while(!finished){const result=await api.request('backupTable',{data:{TABLA:table.resource,PAGINA:page,TAMANO:500},cache:false});rows.push(...(result.rows||[]));finished=Boolean(result.fin)||(result.rows||[]).length===0;page+=1;updateStatus(`Leyendo ${table.sheet}: ${rows.length} de ${result.total??table.total??0} registros…`,'working');}
      const headers=[...new Set(rows.flatMap(row=>Object.keys(row||{})))];sheets.push({nombre:String(table.sheet||table.table).slice(0,31),headers,rows});completed+=1;updateStatus(`Tabla ${completed} de ${available.length} preparada…`,'working');
    }
    const file=await exporter.exportarHojas(sheets,{formato:'xlsx',nombre:'Respaldo_General_Base_de_Datos',titulo:'Respaldo general de la Base de Datos',subtitulo:`${catalog.totalRegistros||0} registros`,autor:'Desarrollado por Alejandro Silva',fecha:catalog.generadoEn});
    updateStatus(`Respaldo generado correctamente: ${file}`,'ok');toast('Respaldo general descargado',`${catalog.totalTablas||available.length} tablas y ${catalog.totalRegistros||0} registros fueron incluidos.`);return file;
  }

  function datosFormularioConexiones(form){
    const data=Object.fromEntries(new FormData(form).entries());
    data.VALIDAR_ANTES='SI';
    return data;
  }
  function pintarResultadoPruebaConexiones(resultado){
    const node=$('[data-connection-config-status]');if(!node)return;
    const item=(nombre,info)=>`<div class="connection-test-item ${info?.ok?'ok':'error'}"><i>${info?.ok?'✓':'!'}</i><div><b>${esc(nombre)}</b><span>${esc(info?.ok?'Disponible':String(info?.codigo||'Sin respuesta').replaceAll('_',' '))}</span></div></div>`;
    node.innerHTML=item('Directorio de acceso',resultado?.directorio)+item('Servicio de actualizaciones',resultado?.actualizaciones)+item('Conexión de respaldo',resultado?.apiRespaldo);
    node.classList.toggle('ok',Boolean(resultado?.todoCorrecto));
    node.classList.toggle('error',!resultado?.todoCorrecto);
  }
  async function probarConfiguracionConexionesWeb(form,button){
    const data=datosFormularioConexiones(form),resultado=await api.request('testConnectionConfig',{data,cache:false});
    pintarResultadoPruebaConexiones(resultado);
    toast(resultado.todoCorrecto?'Conexiones disponibles':'Revise las conexiones',resultado.todoCorrecto?'Las tres comprobaciones terminaron correctamente.':'Al menos una dirección no respondió correctamente.',resultado.todoCorrecto?'success':'error');
    return resultado;
  }
  async function guardarConfiguracionConexionesWeb(form,button){
    const data=datosFormularioConexiones(form),resultado=await api.request('saveConnectionConfig',{data,cache:false});
    if(resultado?.configuracionCliente)api.aplicarConfiguracionConexionCliente?.(resultado.configuracionCliente,{forzar:true});
    pintarResultadoPruebaConexiones(resultado?.pruebas||{});
    ['settings'].forEach(section=>cacheVistasModulo.delete(section));
    toast('Configuración de conexión guardada',`Perfil v${resultado?.row?.VERSION_CONFIG||''} confirmado. Los nuevos inicios de sesión usarán esta configuración.`);
    setTimeout(()=>actualizarSeccionEnSegundoPlano('settings'),250);
    return resultado;
  }

  async function renderSettings(){
    await sincronizarPuntoOperacionDispositivo({silencioso:true});
    const remote=api.isRemote();let company=empresaConPuntoDispositivo(currentCompany||{});
    const empresaConexion=api.getEmpresaConexion?.()||{};
    const esAdminConexion=currentUser?.ROL_ID==='ROL-ADMIN';let perfilConexion=null;
    if(esAdminConexion){try{perfilConexion=(await api.request('getConnectionConfig',{cache:false,force:true}))?.row||null;}catch(error){perfilConexion={ERROR:translateError(error)};}}
    try{const result=await api.request('list',{resource:'companies'});company=seleccionarEmpresaPrincipal(result.rows||[])||company;currentCompany=company;applyBranding(company);}catch(_){ }
    const tema=window.TemaFlotas?.normalizar?.(company)||company;
    const cfgLocal=api.getConfiguracionConexionesLocal?.()||{};
    const perfil=perfilConexion||{};
    const connectionManager=esAdminConexion?`<section class="connection-manager-shell"><article class="card connection-manager-card"><div class="card-header"><div><span class="eyebrow">SOLO ADMINISTRADOR</span><h3>Configuración de Conexiones</h3><p>Cambie las direcciones del sistema sin editar código ni recompilar aplicaciones. La conexión principal continúa resolviéndose por RUT.</p></div><span class="status ${perfil.ERROR||perfil.REQUIERE_SQL?'warning':'ok'}">${perfil.ERROR?'Revisar':perfil.REQUIERE_SQL?'Instalar SQL':`Perfil v${esc(perfil.VERSION_CONFIG||cfgLocal.version||1)}`}</span></div>${perfil.ERROR?`<div class="connection-config-alert error">${esc(perfil.ERROR)}</div>`:''}${perfil.REQUIERE_SQL?'<div class="connection-config-alert warning">Ejecute SQL_MODULO_CONFIGURACION_CONEXIONES_4.3.16.sql antes de guardar cambios.</div>':''}<form id="connectionConfigForm" class="form-grid connection-config-form"><label class="field full"><span>Directorio de acceso / inicio de sesión</span><input name="DIRECTORIO_URL" type="url" required autocomplete="off" value="${esc(perfil.DIRECTORIO_URL||cfgLocal.directorioUrl||'')}" placeholder="https://.../exec"><small>Resuelve el RUT y obtiene internamente la conexión principal del sistema.</small></label><label class="field full"><span>Servicio de actualizaciones</span><input name="ACTUALIZACIONES_URL" type="url" required autocomplete="off" value="${esc(perfil.ACTUALIZACIONES_URL||'')}" placeholder="https://.../exec"><small>Dirección utilizada por el servidor para publicar y validar nuevas versiones móviles.</small></label><label class="field full"><span>Conexión principal de respaldo (opcional)</span><input name="API_RESPALDO_URL" type="url" autocomplete="off" value="${esc(perfil.API_RESPALDO_URL||cfgLocal.apiRespaldoUrl||'')}" placeholder="https://..."><small>Se conserva en los dispositivos como referencia de recuperación. No se usa automáticamente para escrituras.</small></label><input type="hidden" name="ESTADO" value="ACTIVA"><div class="connection-config-meta full"><span>Última actualización: <b>${perfil.ACTUALIZADO_EN?fmtDate(perfil.ACTUALIZADO_EN,true):'Sin cambios registrados'}</b></span><span>Directorio local de este navegador: <b>${cfgLocal.usaPredeterminado?'Respaldo incluido':'Sincronizado'}</b></span></div><div class="connection-config-test full" data-connection-config-status><div class="connection-test-placeholder">Pruebe las conexiones antes de guardar.</div></div><div class="form-actions full"><button class="btn soft" type="button" data-test-connection-config>Probar conexiones</button><button class="btn primary" type="submit" ${perfil.REQUIERE_SQL?'disabled':''}>Guardar y activar</button></div></form><p class="helper">Al guardar, Web y Android recibirán la nueva dirección del directorio después de iniciar sesión. Si el directorio deja de responder, cada dispositivo conserva la última configuración válida y dispone de recuperación local.</p></article></section>`:'';
    return heading('PARÁMETROS','Configuración administrativa','Administre los parámetros internos, el modo de visualización y la identidad del sistema.')+
    connectionManager+
    `${currentUser?.ROL_ID==='ROL-ADMIN'?`<section class="connection-admin-shell"><article class="card"><div class="card-header"><div><span class="eyebrow">EMPRESA ACTUAL</span><h3>Conexión empresarial del dispositivo</h3><p>La empresa se resuelve por RUT desde el directorio configurado. La conexión real de la base permanece oculta para usuarios finales.</p></div><span class="status ok">✓ Conexión establecida</span></div><div class="info-grid"><div class="info-item"><span>Empresa</span><b>${esc(empresaConexion.nombre||'Configurada')}</b></div><div class="info-item"><span>RUT</span><b>${esc(empresaConexion.rut||'Registrado internamente')}</b></div></div><div class="form-actions"><button class="btn primary" type="button" data-open-company-connection>Cambiar empresa por RUT</button></div><p class="helper">Al cambiar de empresa se cerrará la sesión actual y se solicitará el acceso correspondiente a la nueva base.</p></article></section>`:''}`+
    `<div class="settings-grid"><article class="card"><div class="card-header"><div><h3>Base de datos</h3><p>Estado de la información del sistema</p></div>${status(remote?'Central conectada':'Local activa')}</div><div class="info-grid"><div class="info-item"><span>Tipo</span><b>${remote?'Base de datos central':'Base de datos local'}</b></div><div class="info-item"><span>Sincronización</span><b>${remote?'Activa entre dispositivos':'Solo en este dispositivo'}</b></div></div></article><article class="card"><div class="card-header"><div><h3>Modo de pantalla</h3><p>Preferencia individual de este dispositivo</p></div></div><div class="setting-row"><div><b>Modo oscuro</b><span>Puede cambiarlo sin modificar la paleta guardada</span></div><label class="switch"><input id="darkSwitch" type="checkbox" ${document.body.classList.contains('dark')?'checked':''}><i></i></label></div><button class="btn soft" data-nav="company">Abrir datos de empresa</button></article></div>`+
    `<section class="system-health-shell"><article class="card system-health-card"><div class="card-header"><div><h3>Diagnóstico y reparación</h3><p>Comprueba tablas, campos, permisos y requisitos de los módulos críticos.</p></div><span class="status" id="systemHealthStatus">Sin ejecutar</span></div><div id="systemHealthResult" class="system-health-result"><div class="module-diagnostic"><i>✓</i><div><b>Herramienta de mantenimiento disponible</b><span>Ejecute el diagnóstico después de actualizar el servicio central. La reparación no elimina registros.</span></div></div></div><div class="form-actions">${hasPermission('OFICINA_VIRTUAL','DIAGNOSTICAR')?'<button class="btn soft" type="button" data-diagnose-system>Revisar sistema</button>':''}${hasPermission('OFICINA_VIRTUAL','REPARAR')?'<button class="btn primary" type="button" data-repair-system>Reparar estructura</button>':''}</div></article></section>`+
    `${currentUser?.ROL_ID==='ROL-ADMIN'&&hasPermission('CONFIGURACION','RESPALDO_GENERAL')?'<section class="backup-database-shell"><article class="card backup-database-card"><div class="card-header"><div><span class="eyebrow">RESPALDO GENERAL</span><h3>Descargar Base de Datos en XLSX</h3><p>Genera un libro Excel con una hoja por cada tabla y todos los registros disponibles hasta la fecha.</p></div><span class="status ok">Solo Administrador</span></div><div class="backup-feature-list"><span>✓ Incluye registros activos e históricos</span><span>✓ Protege contraseñas, tokens y credenciales</span><span>✓ Agrega resumen de tablas y totales</span></div><div class="backup-status" data-backup-status>Listo para generar el respaldo.</div><div class="form-actions"><button class="btn primary" type="button" data-backup-database>⬇ Descargar respaldo XLSX</button></div></article></section>':''}`+
    `<section class="theme-settings-shell"><article class="card theme-editor-card"><div class="theme-intro"><div><span class="eyebrow">IDENTIDAD VISUAL GLOBAL</span><h3>Colores del sistema</h3><p>Los colores se guardan en la base central y se aplican automáticamente al inicio de sesión, al menú principal y a cada módulo independiente.</p></div>${status('Vista previa automática')}</div><div class="theme-presets">${preajustesTemaMarkup()}</div><form id="themeForm"><div class="theme-mode-row"><label class="field"><span>Tema predeterminado para nuevos dispositivos</span><select name="TEMA_PREDETERMINADO"><option ${tema.TEMA_PREDETERMINADO==='Sistema'?'selected':''}>Sistema</option><option ${tema.TEMA_PREDETERMINADO==='Claro'?'selected':''}>Claro</option><option ${tema.TEMA_PREDETERMINADO==='Oscuro'?'selected':''}>Oscuro</option></select></label><p class="helper">Cada usuario puede alternar temporalmente entre claro y oscuro desde el botón superior.</p></div><div class="theme-config-layout"><div class="theme-color-sections"><section class="theme-color-group"><h4>Marca y acciones</h4><p>Botones, enlaces, indicadores y estados del sistema.</p><div class="theme-color-grid">${campoColorTema('COLOR_PRINCIPAL','Color principal',tema.COLOR_PRINCIPAL)}${campoColorTema('COLOR_SECUNDARIO','Color principal intenso',tema.COLOR_SECUNDARIO)}${campoColorTema('COLOR_ACENTO','Color de acento',tema.COLOR_ACENTO)}${campoColorTema('COLOR_EXITO','Éxito y conectado',tema.COLOR_EXITO)}${campoColorTema('COLOR_ADVERTENCIA','Advertencias',tema.COLOR_ADVERTENCIA)}${campoColorTema('COLOR_PELIGRO','Errores y bloqueos',tema.COLOR_PELIGRO)}</div></section><section class="theme-color-group"><h4>Modo claro</h4><p>Fondos, tarjetas, textos y bordes de la interfaz clara.</p><div class="theme-color-grid">${campoColorTema('COLOR_FONDO','Fondo general',tema.COLOR_FONDO)}${campoColorTema('COLOR_SUPERFICIE','Tarjetas y paneles',tema.COLOR_SUPERFICIE)}${campoColorTema('COLOR_TEXTO','Texto principal',tema.COLOR_TEXTO)}${campoColorTema('COLOR_TEXTO_SECUNDARIO','Texto secundario',tema.COLOR_TEXTO_SECUNDARIO)}${campoColorTema('COLOR_BORDE','Bordes',tema.COLOR_BORDE)}${campoColorTema('COLOR_MENU','Menú lateral',tema.COLOR_MENU)}${campoColorTema('COLOR_MENU_SECUNDARIO','Degradado del menú',tema.COLOR_MENU_SECUNDARIO)}</div></section><section class="theme-color-group"><h4>Modo oscuro</h4><p>Colores usados cuando el usuario activa el modo oscuro.</p><div class="theme-color-grid">${campoColorTema('COLOR_FONDO_OSCURO','Fondo oscuro',tema.COLOR_FONDO_OSCURO)}${campoColorTema('COLOR_SUPERFICIE_OSCURO','Tarjetas oscuras',tema.COLOR_SUPERFICIE_OSCURO)}${campoColorTema('COLOR_TEXTO_OSCURO','Texto oscuro',tema.COLOR_TEXTO_OSCURO)}${campoColorTema('COLOR_TEXTO_SECUNDARIO_OSCURO','Texto secundario oscuro',tema.COLOR_TEXTO_SECUNDARIO_OSCURO)}${campoColorTema('COLOR_BORDE_OSCURO','Bordes oscuros',tema.COLOR_BORDE_OSCURO)}</div></section></div><aside class="theme-preview-panel"><div class="theme-preview-window"><div class="theme-preview-top"><i></i><b>Vista previa del sistema</b></div><div class="theme-preview-body"><div class="theme-preview-menu"><span class="active"></span><span></span><span></span><span></span></div><div class="theme-preview-content"><h4>Panel principal</h4><div class="theme-preview-kpis"><div><b>24</b><small>Vehículos</small></div><div><b>18</b><small>En operación</small></div><div><b>6</b><small>Disponibles</small></div><div><b>2</b><small>Alertas</small></div></div><button class="theme-preview-button" type="button">Acción principal</button></div></div></div><article class="card"><div class="card-header"><div><h3>Contraste</h3><p>Lectura recomendada: 4.5:1 o superior</p></div></div><div class="theme-contrast-list" id="themeContrastList">${contrasteTemaMarkup(tema)}</div></article></aside></div><div class="theme-form-actions"><button class="btn soft" type="button" data-theme-discard>Descartar vista previa</button><button class="btn soft" type="button" data-theme-defaults>Restaurar colores originales</button><button class="btn primary" type="submit">Guardar colores del sistema</button></div></form></article></section>`+
    `<section class="operation-location-settings"><article class="card"><div class="card-header"><div><span class="eyebrow">CONTROL GEOGRÁFICO</span><h3>Punto de inicio y finalización</h3><p>Esta ubicación bloquea el inicio y el cierre fuera del perímetro autorizado.</p></div>${configuracionPuntoOperacion(company).configurada?status('Configurado'):status('Pendiente')}</div><form id="operationLocationForm" class="form-grid"><input type="hidden" name="VALIDAR_UBICACION_OPERACION" value="SI"><div class="operation-policy-fixed full"><i>🔒</i><div><b>Validación GPS obligatoria</b><span>Se aplica al inicio y al cierre. El inicio exige precisión suficiente; al finalizar, una señal imprecisa puede aceptarse con tolerancia limitada, dejando evidencia completa.</span></div></div><label class="field"><span>Nombre del punto base</span><input name="PUNTO_OPERACION_NOMBRE" value="${companyValue(company,'PUNTO_OPERACION_NOMBRE','Base operacional')}" required></label><label class="field full"><span>Dirección del punto base</span><input name="PUNTO_OPERACION_DIRECCION" value="${companyValue(company,'PUNTO_OPERACION_DIRECCION',company.DIRECCION||'')}" data-address-autocomplete data-lat-target="PUNTO_OPERACION_LATITUD" data-lng-target="PUNTO_OPERACION_LONGITUD" required placeholder="Seleccione una dirección exacta"></label><label class="field"><span>Latitud</span><input name="PUNTO_OPERACION_LATITUD" type="number" step="any" value="${companyValue(company,'PUNTO_OPERACION_LATITUD')}" required></label><label class="field"><span>Longitud</span><input name="PUNTO_OPERACION_LONGITUD" type="number" step="any" value="${companyValue(company,'PUNTO_OPERACION_LONGITUD')}" required></label><label class="field"><span>Radio para iniciar</span><div class="input-suffix"><input name="RADIO_INICIO_METROS" type="number" min="10" max="5000" value="${companyValue(company,'RADIO_INICIO_METROS','150')}" required><span>metros</span></div></label><label class="field"><span>Radio para finalizar</span><div class="input-suffix"><input name="RADIO_FIN_METROS" type="number" min="10" max="5000" value="${companyValue(company,'RADIO_FIN_METROS','150')}" required><span>metros</span></div></label><label class="field"><span>Precisión GPS máxima</span><div class="input-suffix"><input name="PRECISION_GPS_MAXIMA_METROS" type="number" min="10" max="5000" value="${companyValue(company,'PRECISION_GPS_MAXIMA_METROS','120')}" required><span>metros</span></div></label><input type="hidden" name="RETORNO_BASE_OBLIGATORIO" value="SI"><div class="operation-location-status full" data-settings-location-status><i>⌖</i><div><b>${configuracionPuntoOperacion(company).configurada?'Punto guardado':'Ubicación pendiente'}</b><span>${configuracionPuntoOperacion(company).configurada?`${esc(configuracionPuntoOperacion(company).direccion)} · ${number(configuracionPuntoOperacion(company).radioInicio)} m al iniciar · ${number(configuracionPuntoOperacion(company).radioFin)} m al finalizar · guardado en este dispositivo`:'Seleccione una dirección o capture la ubicación actual.'}</span></div></div><div class="form-actions"><button class="btn soft" type="button" data-capture-base-location>⌖ Usar mi ubicación actual</button><button class="btn primary" type="submit">Guardar punto operacional</button></div></form></article></section>`+
    `<div class="danger-zone" style="margin-top:18px"><h3>Limpiar datos operativos</h3><p>Elimina vehículos, conductores, operaciones, check-ins, GPS, rutas, conexiones, mantenciones, documentos, notificaciones, alertas, reportes y bitácora. Conserva usuarios, roles, empresa y colores.</p><button class="btn danger" data-clear-data>Limpiar datos operativos</button></div>`;
  }

  function seccionTareaOficinaVirtual(modulo){
    return ({DOCUMENTOS:'documents',RUTAS:'routes',CHECKIN:'checkin',CONDUCTORES:'drivers',GPS:'gps',CONFIGURACION:'settings',OPERACIONES:'operations'}[String(modulo||'').toUpperCase()]||'notifications');
  }

  function prioridadTareaOficinaVirtual(valor){
    const value=String(valor||'Normal').toLowerCase();
    return value==='urgente'?'critical':value==='alta'?'warning':'ok';
  }

  function markupTareasOficinaVirtual(tasks){
    return (tasks||[]).map(task=>{
      const section=seccionTareaOficinaVirtual(task.modulo);
      const canOpen=hasPermission(navPermission[section]||'NOTIFICACIONES','LEER');
      return `<article class="office-task ${prioridadTareaOficinaVirtual(task.prioridad)}"><i>${task.prioridad==='Urgente'?'!':'✓'}</i><div><span>${esc(task.tipo||'Tarea')} · ${esc(task.prioridad||'Normal')}</span><b>${esc(task.titulo||'Pendiente')}</b><p>${esc(task.detalle||'')}</p></div>${canOpen?`<button class="btn soft small" type="button" data-office-open="${esc(section)}">Resolver</button>`:''}</article>`;
    }).join('');
  }

  function formatoDocumentoNexo(doc){const raw=String(doc?.FORMATO||doc?.TIPO_MIME||doc?.NOMBRE_ARCHIVO||'ARCHIVO').toUpperCase();return raw.includes('PDF')?'PDF':raw.includes('IMAGE')||raw.includes('IMAGEN')?'IMAGEN':raw.replace(/^.*\//,'').slice(0,12)||'ARCHIVO';}
  function markupDocumentosNexo(documentos){
    if(!Array.isArray(documentos)||!documentos.length)return '';
    return `<div class="nexo-document-grid">${documentos.map(doc=>{const formato=formatoDocumentoNexo(doc),puede=Boolean(doc.PUEDE_ABRIR&&doc.TIENE_ARCHIVO);return `<article class="nexo-document-card"><div class="nexo-document-top"><span class="nexo-format">${esc(formato)}</span><span class="status ${String(doc.ESTADO_REVISION||doc.ESTADO||'').toLowerCase().includes('apro')?'ok':'warn'}">${esc(doc.ESTADO_REVISION||doc.ESTADO||'Registrado')}</span></div><b>${esc(doc.TIPO||doc.NOMBRE_ARCHIVO||'Documento')}</b><p>${esc([doc.ASOCIADO_TIPO,doc.IDENTIFICACION].filter(Boolean).join(' · ')||'Documento autorizado')}</p><small>${doc.FECHA_VENCIMIENTO?`Vence: ${fmtDate(doc.FECHA_VENCIMIENTO)}`:'Sin vencimiento informado'}${doc.NOMBRE_ARCHIVO?` · ${esc(doc.NOMBRE_ARCHIVO)}`:''}</small>${puede?`<button class="btn soft small" type="button" data-nexo-document="${esc(doc.ID)}">${formato==='PDF'?'Abrir PDF':formato==='IMAGEN'?'Ver imagen':'Abrir archivo'}</button>`:'<span class="nexo-document-lock">Archivo no disponible o sin permiso</span>'}</article>`;}).join('')}</div>`;
  }
  function markupActualizacionNexo(datos){const a=datos?.actualizacion||datos?.ACTUALIZACION;if(!a)return '';const url=a.URL_APK||a.url_apk||'';return `<article class="nexo-document-card"><div class="nexo-document-top"><span class="nexo-format">ANDROID</span><span class="status ${datos.disponible?'warn':'ok'}">${datos.disponible?'Disponible':'Actualizada'}</span></div><b>SGF Android ${esc(a.VERSION_NAME||a.version_name||'')}</b><p>${esc(a.NOTAS||a.notas||'Actualización de la aplicación')}</p>${url&&datos.disponible?`<a class="btn primary small" href="${esc(url)}" target="_blank" rel="noopener">Actualizar ahora</a>`:''}</article>`;}
  function markupConversacionOficinaVirtual(){
    return conversacionOficinaVirtual.map(message=>`<div class="office-message ${message.tipo==='usuario'?'user':'assistant'}"><i>${message.tipo==='usuario'?initials(currentUser.NOMBRE):'NX'}</i><div><b>${message.tipo==='usuario'?'Tú':'NEXO IA'}</b><p>${esc(message.texto||'')}</p>${message.tipo==='asistente'?markupDocumentosNexo(message.documentos)+markupActualizacionNexo(message.datos):''}</div></div>`).join('');
  }
  function enlazarDocumentosNexoChat(root=document){$$('[data-nexo-document]',root).forEach(btn=>{btn.onclick=()=>abrirVisorDocumento(btn.dataset.nexoDocument);});}
  function pintarConversacionOficinaVirtual(){
    const chat=$('#officeChat');if(!chat)return;
    chat.innerHTML=markupConversacionOficinaVirtual();enlazarDocumentosNexoChat(chat);
    requestAnimationFrame(()=>{chat.scrollTop=chat.scrollHeight;});
  }

  function pintarPendientesOficinaVirtual(data){
    const tasks=Array.isArray(data?.tareas)?data.tareas:[];
    const list=$('#officeTaskList'),count=$('#officeTaskCount'),total=$('#officeTotalTasks'),urgent=$('#officeUrgentTasks');
    if(list)list.innerHTML=markupTareasOficinaVirtual(tasks)||empty('✓','No tienes pendientes','No se detectaron documentos, licencias, rutas o revisiones pendientes para tu usuario.');
    if(count){count.textContent=String(tasks.length);count.className=`status ${tasks.length?'warn':'ok'}`;}
    if(total)total.textContent=String(Number(data?.totalTareas??tasks.length));
    if(urgent)urgent.textContent=String(Number(data?.tareasUrgentes??tasks.filter(item=>item.prioridad==='Urgente').length));
    $$('[data-office-open]',list||document).forEach(btn=>btn.addEventListener('click',()=>navigateSection(btn.dataset.officeOpen)));
  }

  async function cargarPendientesOficinaVirtual({force=false}={}){
    if(cargaPendientesOficinaVirtual&&!force)return cargaPendientesOficinaVirtual;
    const task=(async()=>{
      try{
        const data=await api.request('officeTasks',force?{force:true}:{});
        if(currentSection==='office'&&$('#officeTaskList'))pintarPendientesOficinaVirtual(data);
        return data;
      }catch(error){
        const list=$('#officeTaskList');
        if(list)list.innerHTML=empty('!','No se pudieron actualizar los pendientes',translateError(error),'<button class="btn soft" type="button" data-office-retry-tasks>Reintentar</button>');
        $('[data-office-retry-tasks]')?.addEventListener('click',()=>cargarPendientesOficinaVirtual({force:true}));
        return null;
      }finally{if(cargaPendientesOficinaVirtual===task)cargaPendientesOficinaVirtual=null;}
    })();
    cargaPendientesOficinaVirtual=task;
    return task;
  }

  function opcionesModulosOficinaVirtual(){
    const items=[['GENERAL','General'],['PANEL_PRINCIPAL','Panel principal'],['USUARIOS','Usuarios y permisos'],['VEHICULOS','Vehículos'],['CONDUCTORES','Conductores'],['OPERACIONES','Operaciones'],['CHECKIN','Check-in'],['GPS','GPS en tiempo real'],['CONEXIONES','Conexiones en línea'],['RUTAS','Rutas'],['COMBUSTIBLE','Combustible'],['DOCUMENTOS','Documentos del conductor'],['NOTIFICACIONES','Notificaciones'],['ALERTAS','Alertas'],['REPORTES','Reportes'],['CONFIGURACION','Configuración']];
    return items.map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
  }

  function markupIncidentesOficinaVirtual(rows){
    return (rows||[]).map(item=>`<article class="office-incident ${prioridadTareaOficinaVirtual(officeSeverityClass(item.SEVERIDAD))}"><div class="office-incident-icon">${String(item.SEVERIDAD||'').toLowerCase().includes('crít')?'!':'i'}</div><div><span>${esc(item.MODULO||'GENERAL')} · ${esc(item.SEVERIDAD||'Advertencia')}</span><b>${esc(item.TITULO||'Incidente')}</b><p>${esc(item.DESCRIPCION||'')}</p><small>${item.FECHA_ACTUALIZACION?fmtDate(item.FECHA_ACTUALIZACION,true):''}</small></div>${esAdministrador()?`<button type="button" class="btn soft small" data-office-resolve-incident="${esc(item.ID)}">Resolver</button>`:''}</article>`).join('');
  }
  function officeSeverityClass(value){const v=String(value||'').toLowerCase();return v.includes('crít')?'Urgente':v.includes('alta')?'Alta':'Normal';}

  async function renderOficinaVirtual(){
    const [data,incidentsResult]=await Promise.all([api.request('officeQuickStatus'),esAdministrador()?api.request('officeIncidents',{data:{ESTADO:'Abierto',LIMITE:30}}).catch(()=>({rows:[]})):Promise.resolve({rows:[]})]);
    if(!conversacionOficinaVirtual.length){
      conversacionOficinaVirtual=[{tipo:'asistente',texto:`Hola, ${currentUser.NOMBRE.split(' ')[0]}. Soy NEXO IA, tu Centro Inteligente de Gestión. Respondo según tu rol y permisos, puedo consultar datos reales del sistema y traer documentos autorizados directamente a este chat.`}];
    }
    const canConfigure=Boolean(data.puedeConfigurar)&&hasPermission('OFICINA_VIRTUAL','CONFIGURAR'),canUpload=hasPermission('DOCUMENTOS','CARGAR_PROPIO'),canReports=hasPermission('OFICINA_VIRTUAL','GENERAR_REPORTE');
    const state=String(data.estado||'PENDIENTE').toUpperCase();
    const stateLabel=state==='CRITICO'?'Requiere atención inmediata':state==='ATENCION'?'Hay aspectos por revisar':state==='PENDIENTE'?'Esperando primera revisión':'Sistema en orden';
    const suggestions=currentUser?.ROL_ID==='ROL-CONDUCTOR'?['¿Tengo vehículo asignado?','Muéstrame mi licencia de conducir','Muestrame los Documento del Vehiculo','Actualizar aplicación','¿Qué alertas tengo?','¿Qué tengo pendiente?']:['¿Tengo vehículo asignado?','Muéstrame mi licencia de conducir','Muestrame los Documento del Vehiculo','Actualizar aplicación','¿Qué alertas tengo?','¿Hay excesos de velocidad?'];
    const reviewLabel=currentUser?.ROL_ID==='ROL-CONDUCTOR'?'⚑ Solicitar revisión':'↻ Revisar servidor ahora';
    return heading('CENTRO INTELIGENTE DE GESTIÓN','NEXO IA','Inteligencia operacional personalizada por rol, documentos en el chat, alertas y datos reales del sistema.',`<button class="btn soft" type="button" data-office-review>${reviewLabel}</button>${canReports?'<button class="btn primary" type="button" data-office-generate-report>▤ Reporte de salud</button>':''}`)+
      `<section class="office-hero"><article class="card office-identity"><div class="nexo-core" aria-hidden="true"><span>NX</span><i></i><i></i></div><div><span>NEXO IA · CENTRO INTELIGENTE DE GESTIÓN</span><h3>${esc(stateLabel)}</h3><p>Última revisión: ${data.ultimaRevision?fmtDate(data.ultimaRevision,true):'pendiente'} · ${Number(data.avisosCreados||0)} aviso(s) generado(s).</p></div><span class="status ${state==='CORRECTO'?'ok':state==='CRITICO'?'bad':'warn'}">${esc(state)}</span></article><article class="card office-auto-card"><div><span>AUTONOMÍA CONTROLADA</span><h3>${data.modoAutomatico?'Activada':'Modo informativo'}</h3><p>${data.modoAutomatico?'Revisa el servidor y ejecuta únicamente reparaciones técnicas de bajo riesgo.':'Informa fallas y solicita autorización para cambios delicados.'}</p></div>${canConfigure?`<label class="switch office-auto-switch"><input type="checkbox" data-office-auto ${data.modoAutomatico?'checked':''}><i></i></label>`:'<span class="office-lock">Control Administrador</span>'}</article></section>`+
      `<div class="office-metrics"><article class="metric-card"><i class="metric-icon">✓</i><div><span>Pendientes</span><b id="officeTotalTasks">${Number(data.totalTareas||0)}</b><small><span id="officeUrgentTasks">${Number(data.tareasUrgentes||0)}</span> urgente(s)</small></div></article>${metric('!','Incidentes abiertos',Number(data.problemas||0),stateLabel)}${metric('⚒','Reparaciones seguras',Number(data.reparaciones||0),'Última revisión')}</div>`+
      `<section class="office-layout"><article class="card office-chat-card"><div class="card-header"><div><h3>Pregúntale a NEXO IA</h3><p>Consulta rutas, vehículos, personal, documentos, combustible, alertas y pendientes dentro de tus permisos.</p></div><span class="status ok">● NEXO IA EN LÍNEA</span></div><div class="office-chat" id="officeChat">${markupConversacionOficinaVirtual()}</div><div class="office-suggestions">${suggestions.map(text=>`<button type="button" data-office-suggestion="${esc(text)}">${esc(text)}</button>`).join('')}</div><form class="office-form" id="officeForm"><textarea name="MENSAJE" rows="2" maxlength="1200" required placeholder="Ejemplo: Muéstrame los documentos del vehículo ABCD12"></textarea><button class="btn primary" type="submit">Enviar</button></form><p class="helper">La IA trabaja con datos del propio sistema. No solicita contraseñas ni expone la clave administrativa.</p></article>`+
      `<article class="card office-tasks-card"><div class="card-header"><div><h3>Lo que tiene por hacer</h3><p>Documentos, avisos e incidencias vinculadas a su cuenta.</p></div><span class="status" id="officeTaskCount">…</span></div><div class="office-task-list" id="officeTaskList">${empty('↻','Actualizando pendientes','NEXO IA está consultando los datos necesarios.')}</div></article></section>`+
      `<section class="office-tools-grid">${canUpload?`<article class="card office-tool-card"><div class="card-header"><div><h3>Portal de documentos</h3><p>Cargue fotografías o PDF y registre el documento de forma segura en el sistema.</p></div><span class="status ok">Privado</span></div><form id="officeDocumentForm" class="form-grid"><label class="field"><span>Tipo de documento</span><input name="TIPO" maxlength="120" required placeholder="Licencia, padrón, contrato..."></label><label class="field"><span>Identificación</span><input name="IDENTIFICACION" maxlength="180" placeholder="Número o referencia"></label><label class="field"><span>Fecha de vencimiento</span><input name="FECHA_VENCIMIENTO" type="date"></label><label class="field full"><span>Fotografía o PDF</span><input name="ARCHIVO" type="file" accept="image/*,.pdf,application/pdf" required></label><label class="field full"><span>Observaciones</span><textarea name="OBSERVACIONES" maxlength="3000" placeholder="Información adicional para la revisión"></textarea></label><div class="form-actions"><button class="btn primary" type="submit">Cargar y registrar</button></div></form><p class="helper">Los Administradores recibirán una notificación para revisar el documento.</p></article>`:''}`+
      `<article class="card office-tool-card"><div class="card-header"><div><h3>Informar una falla</h3><p>NEXO IA registra el incidente y comunica a los Administradores.</p></div><span class="status warn">Auditado</span></div><form id="officeFailureForm" class="form-grid"><label class="field"><span>Módulo afectado</span><select name="MODULO">${opcionesModulosOficinaVirtual()}</select></label><label class="field"><span>Severidad</span><select name="SEVERIDAD"><option>Info</option><option selected>Advertencia</option><option>Alta</option><option>Crítica</option></select></label><label class="field full"><span>Título</span><input name="TITULO" maxlength="220" required placeholder="Ejemplo: El mapa no actualiza la ubicación"></label><label class="field full"><span>¿Qué ocurrió?</span><textarea name="DESCRIPCION" minlength="10" maxlength="5000" required placeholder="Describa los pasos, el mensaje mostrado y el resultado esperado"></textarea></label><div class="form-actions"><button class="btn primary" type="submit">Registrar e informar</button></div></form></article>`+
      `${canReports?`<article class="card office-tool-card office-report-card"><div class="card-header"><div><h3>Reportes inteligentes</h3><p>Resumen de servidor, sesiones, GPS, documentos e incidentes.</p></div><span class="status ok">Servidor</span></div><div id="officeReportResult" class="office-report-result">${empty('▤','Reporte disponible','Presione “Generar reporte” para obtener el estado actual del sistema.')}</div><div class="form-actions"><button class="btn primary" type="button" data-office-generate-report>Generar reporte</button></div></article>`:''}`+
      `${esAdministrador()?`<article class="card office-tool-card office-incidents-card"><div class="card-header"><div><h3>Incidentes del sistema</h3><p>Fallas detectadas por la IA o informadas por usuarios.</p></div><span class="status ${incidentsResult.rows?.length?'warn':'ok'}">${Number(incidentsResult.rows?.length||0)} abierto(s)</span></div><div class="office-incident-list" id="officeIncidentList">${markupIncidentesOficinaVirtual(incidentsResult.rows)||empty('✓','Sin incidentes abiertos','NEXO IA no mantiene fallas pendientes.')}</div></article>`:''}</section>`;
  }

  async function ejecutarRevisionOficinaVirtual(button){
    try{
      const result=await api.request('officeRun',{force:true});
      invalidarListasFormulario('notifications','alerts','documents','routes','checkins');
      api.invalidate({actions:['officeQuickStatus','officeTasks','officeStatus']});
      cacheVistasModulo.delete('dashboard');cacheVistasModulo.delete('notifications');
      if(result.solicitudAdministrador)toast('Administradores informados','La solicitud quedó pendiente para validación administrativa; el Conductor no ejecutó cambios.');
      else toast('Revisión iniciada','NEXO IA ya está revisando el sistema en segundo plano; puedes seguir trabajando.');
      cargarPendientesOficinaVirtual({force:true});
      setTimeout(()=>refreshNotificationBadge(),2500);
      return result;
    }catch(error){toast('No se pudo revisar',translateError(error),'error');}
  }

  async function repararConOficinaVirtual(button){
    if(!confirm('Se verificarán estructura, catálogos, cachés y activadores. No se eliminarán datos ni se modificarán operaciones. ¿Continuar?'))return;
    try{
      const result=await api.request('officeRepair',{});
      api.invalidate();invalidarListasFormulario();cacheVistasModulo.clear();
      toast('Reparación segura completada',`Estado posterior: ${result.diagnostico?.estado||'verificado'}.`);
      return go('office',{force:true});
    }catch(error){toast('No se pudo reparar',translateError(error),'error');}
  }

  async function configurarModoAutomaticoOficinaVirtual(input){
    const active=Boolean(input.checked);input.disabled=true;
    try{
      await api.request('officeAutoMode',{data:{ACTIVO:active?'SI':'NO'}});
      api.invalidate({actions:['officeQuickStatus','officeStatus']});
      toast(active?'Modo automático activado':'Modo automático desactivado',active?'NEXO IA revisará el sistema cada cinco minutos.':'Las reparaciones volverán a requerir autorización.');
      window.dispatchEvent(new CustomEvent('flotas:oficina-virtual-modo',{detail:{activo:active}}));
      postParent({tipo:'flotas:oficina-virtual-modo',activo:active});
    }catch(error){input.checked=!active;toast('No se pudo cambiar el modo',translateError(error),'error');}
    finally{input.disabled=false;}
  }

  async function enviarConsultaOficinaVirtual(text,button){
    const question=String(text||'').trim();if(!question)return;
    conversacionOficinaVirtual.push({tipo:'usuario',texto:question});
    pintarConversacionOficinaVirtual();
    const form=$('#officeForm');if(form)form.elements.MENSAJE.value='';
    try{
      const result=await api.request('officeAsk',{data:{MENSAJE:question}});
      conversacionOficinaVirtual.push({tipo:'asistente',texto:result.respuesta||'No pude generar una respuesta.',documentos:Array.isArray(result.documentos)?result.documentos:[],datos:result.datos||{}});
    }catch(error){conversacionOficinaVirtual.push({tipo:'asistente',texto:`No pude responder: ${translateError(error)}`});}
    pintarConversacionOficinaVirtual();
  }

  async function cargarDocumentoOficinaVirtual(event){
    event.preventDefault();const form=event.currentTarget,button=$('button[type="submit"]',form),file=form.elements.ARCHIVO.files?.[0];if(!file){toast('Seleccione un archivo','Debe adjuntar una fotografía o PDF.','error');return;}if(file.size>12582912){toast('Archivo demasiado grande','El tamaño máximo es 12 MB.','error');return;}
    await conCargaBoton(button,'Cargando documento…',async()=>{try{const dataUrl=await leerArchivoDataUrl(file);const data=Object.fromEntries(new FormData(form).entries());delete data.ARCHIVO;Object.assign(data,{NOMBRE_ARCHIVO:file.name,TIPO_MIME:file.type||'application/octet-stream',ARCHIVO_BASE64:dataUrl,VERSION_CLIENTE:window.CONFIGURACION_FLOTAS?.VERSION||''});const result=await api.request('officeUploadDocument',{data});invalidarListasFormulario('documents','notifications');cacheVistasModulo.delete('documents');form.reset();toast('Documento registrado',result.mensaje||'El archivo quedó disponible para revisión en todos los dispositivos.');setTimeout(()=>refreshNotificationBadge(),1000);cargarPendientesOficinaVirtual({force:true});}catch(error){toast('No se pudo cargar el documento',translateError(error),'error');}});
  }
  async function informarFallaOficinaVirtual(event){
    event.preventDefault();const form=event.currentTarget,button=$('button[type="submit"]',form),data=Object.fromEntries(new FormData(form).entries());data.VERSION_CLIENTE=window.CONFIGURACION_FLOTAS?.VERSION||'';
    await conCargaBoton(button,'Registrando falla…',async()=>{try{await api.request('officeReportFailure',{data});form.reset();toast('Falla registrada','NEXO IA informó a los Administradores y dejó trazabilidad en el servidor.');api.invalidate({actions:['officeQuickStatus','officeTasks','officeIncidents','officeStatus']});setTimeout(()=>go('office',{force:true}),400);}catch(error){toast('No se pudo registrar la falla',translateError(error),'error');}});
  }
  async function descargarReporteOficinaVirtual(report,formato='pdf',meta={}){
    if(!puedeExportarFormato(formato))throw new Error('PERMISO_DENEGADO');
    const exporter=window.ExportadorReportesFlotas;if(!exporter)throw new Error('EXPORTADOR_REPORTES_NO_DISPONIBLE');
    return exporter.exportarOficina(report,{formato,nombre:'Reporte_NEXO_IA',titulo:'Reporte de salud del Sistema de Gestión de Flotas',subtitulo:meta.resumen||'Diagnóstico generado por NEXO IA',resumen:meta.resumen||'',generadoPor:currentUser?.NOMBRE||currentUser?.CORREO||'',autor:currentUser?.NOMBRE||currentUser?.CORREO||'NEXO IA',version:config.VERSION});
  }
  async function generarReporteOficinaVirtual(button){
    await conCargaBoton(button,'Generando reporte…',async()=>{try{const result=await api.request('officeGenerateReport',{data:{TIPO:'SALUD_SISTEMA'}}),report=result.reporte||{},meta={resumen:result.resumen||'Reporte generado'};const node=$('#officeReportResult');if(node)node.innerHTML=`<div class="office-report-summary"><i>✓</i><div><b>${esc(meta.resumen)}</b><span>API ${esc(report.diagnostico?.estado||'verificada')} · Incidentes ${Number(report.estadoOficina?.problemas||0)} · Tareas ${Number(report.estadoOficina?.totalTareas||0)}</span></div>${puedeExportarFormato('csv')||puedeExportarFormato('xlsx')||puedeExportarFormato('pdf')?`<div class="report-format-actions">${puedeExportarFormato('csv')?'<button class="btn soft small" type="button" data-office-download-report="csv">CSV</button>':''}${puedeExportarFormato('xlsx')?'<button class="btn soft small" type="button" data-office-download-report="xlsx">Excel</button>':''}${puedeExportarFormato('pdf')?'<button class="btn primary small" type="button" data-office-download-report="pdf">PDF</button>':''}</div>`:''}</div>`;$$('[data-office-download-report]',node).forEach(downloadButton=>downloadButton.addEventListener('click',()=>conCargaBoton(downloadButton,'Generando…',async()=>{try{const formato=downloadButton.dataset.officeDownloadReport;await descargarReporteOficinaVirtual(report,formato,meta);toast('Reporte descargado',`Formato ${formato.toUpperCase()} generado correctamente.`);}catch(error){toast('No se pudo exportar',translateError(error),'error');}})));toast('Reporte generado','El reporte quedó registrado en el servidor y puede descargarse en CSV, Excel o PDF.');}catch(error){toast('No se pudo generar el reporte',translateError(error),'error');}});
  }
  async function resolverIncidenteOficinaVirtual(id,button){
    if(!confirm('¿Confirma que este incidente fue revisado y resuelto?'))return;await conCargaBoton(button,'Resolviendo…',async()=>{try{await api.request('officeResolveIncident',{data:{ID:id,COMENTARIO:'Resuelto desde el panel de NEXO IA'}});toast('Incidente resuelto','La acción quedó registrada en auditoría.');api.invalidate({actions:['officeQuickStatus','officeTasks','officeIncidents','officeStatus']});return go('office',{force:true});}catch(error){toast('No se pudo resolver',translateError(error),'error');}});
  }

  async function sincronizarSistema(button) {
    if (sincronizacionPendiente) return sincronizacionPendiente;
    if (hayEdicionUsuarioActiva()) {
      toast('Actualización pospuesta','Hay información en edición o una acción abierta. Guarde o cancele primero para no perder lo que está haciendo.','warning');
      return false;
    }
    const section = currentSection;
    const ejecutar = async () => {
      setSave(`Actualizando ${labels[section]||'módulo'}…`,'saving');
      actualizarEstadoSincronizacionVisible('Consultando únicamente los datos de este módulo…','syncing');
      // La actualización manual afecta solo al módulo abierto. No dispara cargas
      // globales ni invalida datos de las demás pantallas.
      modulosSincronizadosSesion.add(section);
      const dependencia = dependenciaSeccion(section);
      api.invalidate({ actions:dependencia.actions, resources:dependencia.resources });
      cacheVistasModulo.delete(section);
      dependencia.resources.forEach(resource => invalidarListasFormulario(resource));
      try {
        const completed = await go(section,{force:true,manualSync:true});
        if (completed === false) throw new Error('SINCRONIZACION_NO_COMPLETADA');
        if (section==='notifications'||section==='dashboard') await refreshNotificationBadge();
        setSave('Módulo actualizado');
        actualizarEstadoSincronizacionVisible(textoActualizacionSeccion(section));
        toast('Módulo actualizado',`${labels[section]||'La información'} fue actualizada sin cargar los demás módulos.`);
        return true;
      } catch (error) {
        modulosSincronizadosSesion.delete(section);
        setSave('Error al actualizar','error');
        actualizarEstadoSincronizacionVisible('No se pudo actualizar · pulse nuevamente para reintentar','error');
        toast('No se pudo actualizar',translateError(error),'error');
        return false;
      }
    };
    sincronizacionPendiente = conCargaBoton(button,'Actualizando…',ejecutar);
    try { return await sincronizacionPendiente; }
    finally { sincronizacionPendiente = null; }
  }
  function fuelName(resource,id,fallback='—'){
    const row=registroFormulario(resource,id)||listaFormulario(resource).find(item=>String(item.ID)===String(id||''));
    if(!row)return fallback;
    if(resource==='vehicles')return `${row.PATENTE||row.ID}${row.MARCA||row.MODELO?` · ${row.MARCA||''} ${row.MODELO||''}`:''}`.trim();
    if(resource==='drivers')return `${row.NOMBRE||row.ID}${row.RUT?` · ${row.RUT}`:''}`.trim();
    return row.NOMBRE||row.ID||fallback;
  }

  function fuelAuthorizationFor(chargeId,authorizations=[]){
    return (authorizations||[]).filter(row=>String(row.CARGA_ID||'')===String(chargeId||'')).sort((a,b)=>new Date(b.FECHA_SOLICITUD||b.CREADO_EN||0)-new Date(a.FECHA_SOLICITUD||a.CREADO_EN||0))[0]||null;
  }

  function fuelActionMarkup(row,authorization){
    const buttons=[];
    if(hasPermission('COMBUSTIBLE','EDITAR'))buttons.push(`<button class="btn soft small" type="button" data-edit-fuel="${esc(row.ID)}">Editar</button>`);
    if(hasPermission('COMBUSTIBLE','ELIMINAR')&&esAdministrador())buttons.push(`<button class="btn danger small" type="button" data-admin-delete-fuel="${esc(row.ID)}">Eliminar</button>`);
    else if(currentUser.ROL_ID==='ROL-SUPERVISOR'&&hasPermission('COMBUSTIBLE','SOLICITAR_ELIMINACION')){
      if(authorization?.ESTADO==='APROBADA'&&!authorization.FECHA_EJECUCION)buttons.push(`<button class="btn danger small" type="button" data-execute-fuel-delete="${esc(row.ID)}" data-authorization="${esc(authorization.ID)}">Eliminar autorizado</button>`);
      else if(!authorization||!['PENDIENTE','APROBADA'].includes(authorization.ESTADO))buttons.push(`<button class="btn soft small" type="button" data-request-fuel-delete="${esc(row.ID)}">Solicitar eliminación</button>`);
      else buttons.push(status(authorization.ESTADO));
    }
    if(row.COMPROBANTE_URL)buttons.push(`<a class="btn soft small" href="${esc(row.COMPROBANTE_URL)}" target="_blank" rel="noopener">Boleta</a>`);
    return buttons.join('')||'—';
  }

  async function asegurarContextoCombustible(){
    const resources=['fuel','vehicles','drivers','operations','routes'];
    if(currentUser.ROL_ID!=='ROL-CONDUCTOR')resources.push('fuelAuthorizations');
    await Promise.all(resources.map(resource=>cargarListaFormulario(resource,true)));
    return true;
  }

  function filasRespuestaLote(respuesta){
    if(Array.isArray(respuesta))return respuesta;
    if(Array.isArray(respuesta?.rows))return respuesta.rows;
    if(Array.isArray(respuesta?.data?.rows))return respuesta.data.rows;
    return [];
  }

  function resumenCombustibleDesdeFilas(rows=[]){
    const lista=Array.isArray(rows)?rows:[],sum=(items,field)=>items.reduce((total,row)=>total+Number(row?.[field]||0),0);
    const totalCargas=lista.length,totalLitros=sum(lista,'LITROS'),gastoTotal=sum(lista,'COSTO_TOTAL');
    const consumo=lista.filter(row=>Number(row?.DISTANCIA_DESDE_ULTIMA_CARGA_KM||0)>0&&Number(row?.LITROS||0)>0);
    const distancia=sum(consumo,'DISTANCIA_DESDE_ULTIMA_CARGA_KM'),litrosConsumo=sum(consumo,'LITROS');
    const inicioMes=new Date();inicioMes.setDate(1);inicioMes.setHours(0,0,0,0);
    const mes=lista.filter(row=>{const fecha=new Date(row?.FECHA_HORA||row?.CREADO_EN||0);return Number.isFinite(fecha.getTime())&&fecha>=inicioMes;});
    return{
      totalCargas,totalLitros,gastoTotal,
      precioPromedioLitro:totalLitros>0?gastoTotal/totalLitros:0,
      consumoPromedioKmL:distancia>0&&litrosConsumo>0?distancia/litrosConsumo:0,
      consumoPromedioL100Km:distancia>0&&litrosConsumo>0?litrosConsumo/distancia*100:0,
      mesActual:{cargas:mes.length,litros:sum(mes,'LITROS'),gasto:sum(mes,'COSTO_TOTAL')}
    };
  }

  function normalizarResumenCombustible(respuesta,rows=[]){
    const raw=respuesta?.data&&typeof respuesta.data==='object'?respuesta.data:(respuesta||{}),fallback=resumenCombustibleDesdeFilas(rows);
    const valor=(...values)=>{for(const value of values){const numberValue=Number(value);if(Number.isFinite(numberValue))return numberValue;}return 0;};
    const totalCargas=valor(raw.totalCargas,raw.total,raw.registros,fallback.totalCargas);
    const totalLitros=valor(raw.totalLitros,raw.litrosTotal,raw.litros,fallback.totalLitros);
    const gastoTotal=valor(raw.gastoTotal,raw.costoTotal,raw.totalCosto,fallback.gastoTotal);
    const precioPromedioLitro=valor(raw.precioPromedioLitro,raw.precioPromedio,totalLitros>0?gastoTotal/totalLitros:0,fallback.precioPromedioLitro);
    const consumoPromedioKmL=valor(raw.consumoPromedioKmL,raw.consumoPromedio,raw.rendimientoPromedio,fallback.consumoPromedioKmL);
    const consumoPromedioL100Km=valor(raw.consumoPromedioL100Km,consumoPromedioKmL>0?100/consumoPromedioKmL:0,fallback.consumoPromedioL100Km);
    const mesRaw=raw.mesActual||raw.mes||{};
    return{
      ...raw,totalCargas,totalLitros,gastoTotal,precioPromedioLitro,consumoPromedioKmL,consumoPromedioL100Km,
      mesActual:{cargas:valor(mesRaw.cargas,mesRaw.total,fallback.mesActual.cargas),litros:valor(mesRaw.litros,mesRaw.litrosTotal,fallback.mesActual.litros),gasto:valor(mesRaw.gasto,mesRaw.costoTotal,fallback.mesActual.gasto)}
    };
  }

  async function renderFuel(){
    const queries=[
      {key:'summary',action:'fuelSummary',payload:{limit:limiteRegistrosActual()==='TODOS'?1000:Number(limiteRegistrosActual())}},
      {key:'vehicles',action:'list',payload:{resource:'vehicles',limit:1000}},
      {key:'drivers',action:'list',payload:{resource:'drivers',limit:1000}},
      {key:'operations',action:'list',payload:{resource:'operations',limit:1000}},
      {key:'routes',action:'list',payload:{resource:'routes',limit:1000}},
    ];
    if(currentUser.ROL_ID!=='ROL-CONDUCTOR')queries.push({key:'authorizations',action:'list',payload:{resource:'fuelAuthorizations',limit:1000}});
    const [batch,loadsResult]=await Promise.all([api.requestBatch(queries,{force:true}),solicitarListaPaginada('fuel',{cache:false})]),loads=guardarListaFormulario('fuel',loadsResult.rows||[]),vehicles=guardarListaFormulario('vehicles',filasRespuestaLote(batch.vehicles)),drivers=guardarListaFormulario('drivers',filasRespuestaLote(batch.drivers)),operations=guardarListaFormulario('operations',filasRespuestaLote(batch.operations)),routes=guardarListaFormulario('routes',filasRespuestaLote(batch.routes)),authorizations=guardarListaFormulario('fuelAuthorizations',filasRespuestaLote(batch.authorizations)),summary=normalizarResumenCombustible(batch.summary,loads);
    const ordered=[...loads].sort((a,b)=>new Date(b.FECHA_HORA||b.CREADO_EN||0)-new Date(a.FECHA_HORA||a.CREADO_EN||0));
    const rows=ordered.map(row=>{
      const auth=fuelAuthorizationFor(row.ID,authorizations),consumption=Number(row.CONSUMO_KM_L||0)>0?`${decimal(row.CONSUMO_KM_L)} km/L`:'Sin cálculo';
      return `<tr data-filter-date="${esc(row.FECHA_HORA||row.CREADO_EN||'')}" data-search-row="${esc(`${row.ID} ${fuelName('vehicles',row.VEHICULO_ID)} ${fuelName('drivers',row.CONDUCTOR_ID)} ${row.ESTACION_SERVICIO||''} ${row.NUMERO_DOCUMENTO||''}`.toLowerCase())}"><td><strong>${fmtDate(row.FECHA_HORA,true)}</strong><small>${esc(row.ID)}</small></td><td>${esc(fuelName('vehicles',row.VEHICULO_ID))}</td><td>${esc(fuelName('drivers',row.CONDUCTOR_ID))}</td><td><strong>${decimal(row.LITROS,3)} L</strong><small>${esc(row.TIPO_COMBUSTIBLE||'')}</small></td><td>${clp(row.PRECIO_LITRO)}<small>por litro</small></td><td><strong>${clp(row.COSTO_TOTAL)}</strong></td><td>${number(row.KILOMETRAJE||0)} km<small>${Number(row.DISTANCIA_DESDE_ULTIMA_CARGA_KM||0)>0?`${decimal(row.DISTANCIA_DESDE_ULTIMA_CARGA_KM,1)} km recorridos`:'Primera referencia'}</small></td><td><strong>${consumption}</strong><small>${Number(row.CONSUMO_L_100KM||0)>0?`${decimal(row.CONSUMO_L_100KM)} L/100 km`:''}</small></td><td>${esc(row.ESTACION_SERVICIO||'—')}<small>${esc(row.MEDIO_PAGO||'')}</small></td><td><div class="fuel-actions">${fuelActionMarkup(row,auth)}</div></td></tr>`;
    }).join('');
    const pending=authorizations.filter(row=>row.ESTADO==='PENDIENTE');
    const approvals=hasPermission('COMBUSTIBLE','AUTORIZAR_ELIMINACION')&&pending.length?`<article class="card"><div class="card-header"><div><span class="eyebrow">AUTORIZACIONES</span><h3>Eliminaciones pendientes</h3><p>El Operador no puede eliminar hasta que un Administrador resuelva la solicitud.</p></div>${status(`${pending.length} pendiente${pending.length===1?'':'s'}`)}</div>${table(['Solicitud','Carga','Operador','Motivo','Fecha','Decisión'],pending.map(row=>`<tr><td><strong>${esc(row.ID)}</strong></td><td>${esc(row.CARGA_ID)}</td><td>${esc(row.SOLICITANTE_NOMBRE||row.SOLICITADO_POR)}</td><td>${esc(row.MOTIVO)}</td><td>${fmtDate(row.FECHA_SOLICITUD,true)}</td><td><div class="fuel-actions"><button class="btn primary small" type="button" data-approve-fuel-delete="${esc(row.ID)}">Aprobar</button><button class="btn soft small" type="button" data-reject-fuel-delete="${esc(row.ID)}">Rechazar</button></div></td></tr>`).join(''))}</article>`:'';
    const operadorRequests=currentUser.ROL_ID==='ROL-SUPERVISOR'&&authorizations.length?`<article class="card"><div class="card-header"><div><h3>Mis solicitudes de eliminación</h3><p>Seguimiento de autorizaciones administrativas.</p></div></div>${table(['Solicitud','Carga','Motivo','Estado','Respuesta','Fecha'],[...authorizations].sort((a,b)=>new Date(b.FECHA_SOLICITUD||0)-new Date(a.FECHA_SOLICITUD||0)).map(row=>`<tr><td><strong>${esc(row.ID)}</strong></td><td>${esc(row.CARGA_ID)}</td><td>${esc(row.MOTIVO)}</td><td>${status(row.ESTADO)}</td><td>${esc(row.COMENTARIO_AUTORIZACION||'—')}<small>${esc(row.AUTORIZADOR_NOMBRE||'')}</small></td><td>${fmtDate(row.FECHA_SOLICITUD,true)}</td></tr>`).join(''))}</article>`:'';
    const create=hasPermission('COMBUSTIBLE','REGISTRAR')?`${hasPermission('CHECKIN','VALIDAR_QR')?'<button class="btn soft" type="button" data-open-fuel-qr>▦ Escanear QR para carga</button>':''}<button class="btn primary" type="button" data-new-fuel>＋ Informar carga</button>`:'';
    return heading('CONTROL DE GASTOS','Carga de combustible',currentUser.ROL_ID==='ROL-CONDUCTOR'?'Consulte su historial e informe las cargas realizadas para su vehículo y asignación activa.':'Registre cargas, mida el rendimiento y mantenga trazabilidad completa por vehículo y conductor.',`${puedeExportarFormato('csv')?'<button class="btn soft" data-export="fuel">⇩ Exportar historial</button>':''}<button class="btn soft" data-sync>↻ Actualizar</button>${create}`)+
      `<div class="kpi-grid">${metric('⛽','Litros acumulados',`${decimal(summary.totalLitros||0,2)} L`,`${number(summary.totalCargas||0)} cargas`)}${metric('$','Gasto acumulado',clp(summary.gastoTotal||0),`Promedio ${clp(summary.precioPromedioLitro||0)}/L`)}${metric('↗','Rendimiento promedio',`${decimal(summary.consumoPromedioKmL||0)} km/L`,`${decimal(summary.consumoPromedioL100Km||0)} L/100 km`)}${metric('▦','Mes actual',clp(summary.mesActual?.gasto||0),`${decimal(summary.mesActual?.litros||0,2)} L · ${number(summary.mesActual?.cargas||0)} cargas`)}</div>`+
      approvals+operadorRequests+
      `<article class="card"><div class="card-header"><div><h3>Historial de cargas</h3><p>${currentUser.ROL_ID==='ROL-CONDUCTOR'?'Solo se muestran registros vinculados a su conductor.':'Creaciones, cambios y eliminaciones quedan registradas en auditoría.'}</p></div><label class="table-search"><span>⌕</span><input data-table-search placeholder="Buscar vehículo, conductor, estación o documento"></label></div>${table(['Fecha','Vehículo','Conductor','Litros','Precio/L','Costo','Kilometraje','Consumo','Estación','Acciones'],rows,'No existen cargas de combustible visibles.')}</article>`;
  }

  function fuelSelectOptions(rows,selected,labeler){return `<option value="">Seleccione</option>`+(rows||[]).map(row=>`<option value="${esc(row.ID)}" ${String(row.ID)===String(selected||'')?'selected':''}>${esc(labeler(row))}</option>`).join('');}

  function fuelAssignmentOptions(record=null){
    const vehicles=listaFormulario('vehicles'),drivers=listaFormulario('drivers'),operations=listaFormulario('operations'),routes=listaFormulario('routes');
    const items=[];
    operations.filter(row=>(row.ESTADO==='Activa'||String(row.ID)===String(record?.OPERACION_ID||''))&&row.VEHICULO_ID&&row.CONDUCTOR_ID).forEach(row=>items.push({key:`OPE:${row.ID}`,type:'operation',id:row.ID,operationId:row.ID,routeId:row.RUTA_ID||'',vehicleId:row.VEHICULO_ID,driverId:row.CONDUCTOR_ID,label:`Operación ${row.ID} · ${fuelName('vehicles',row.VEHICULO_ID)} · ${fuelName('drivers',row.CONDUCTOR_ID)}`}));
    routes.filter(row=>(['Asignada','En curso'].includes(row.ESTADO)||String(row.ID)===String(record?.RUTA_ID||''))&&row.VEHICULO_ID&&row.CONDUCTOR_ID).forEach(row=>{if(items.some(item=>item.routeId===row.ID&&item.operationId))return;items.push({key:`RUT:${row.ID}`,type:'route',id:row.ID,operationId:row.OPERACION_ID||'',routeId:row.ID,vehicleId:row.VEHICULO_ID,driverId:row.CONDUCTOR_ID,label:`Ruta ${row.ID} · ${fuelName('vehicles',row.VEHICULO_ID)} · ${fuelName('drivers',row.CONDUCTOR_ID)}`});});
    return {items,vehicles,drivers};
  }

  async function openFuelModal(record=null,qrVehicle=null){
    try {
      await asegurarContextoCombustible();
    } catch (error) {
      toast('No se pudo preparar el formulario',translateError(error),'error');
      return;
    }
    const {items,vehicles,drivers}=fuelAssignmentOptions(record),admin=esAdministrador();
    const qrObject=qrVehicle&&typeof qrVehicle==='object'?qrVehicle:null;
    if(qrObject)guardarRegistro('vehicles',qrObject);
    const qrAssignment=qrObject?items.find(item=>String(item.vehicleId)===String(qrObject.ID)):null;
    const selectedKey=record?.OPERACION_ID?`OPE:${record.OPERACION_ID}`:record?.RUTA_ID?`RUT:${record.RUTA_ID}`:qrAssignment?.key||(items.length===1&&!qrObject?items[0].key:'');
    const adminManualSelected=admin&&!selectedKey&&Boolean(record||qrObject);
    const assignmentOptions=`<option value="">Seleccione una asignación activa</option>${items.map(item=>`<option value="${esc(item.key)}" ${item.key===selectedKey?'selected':''}>${esc(item.label)}</option>`).join('')}${admin?`<option value="ADMIN" ${adminManualSelected?'selected':''}>Registro administrativo manual</option>`:''}`;
    const blocked=!admin&&!record&&(qrObject?!qrAssignment:!items.length);
    const initialVehicleId=record?.VEHICULO_ID||qrObject?.ID||'';
    $('#modalEyebrow').textContent='COMBUSTIBLE';$('#modalTitle').textContent=record?'Editar carga':'Registrar carga de combustible';
    $('#modalBody').innerHTML=`<form id="fuelForm" class="form-grid">${qrObject?`<div class="tracking-notice active full"><i>▦</i><div><b>QR validado: ${esc(qrObject.PATENTE||qrObject.ID)}</b><span>${esc([qrObject.MARCA,qrObject.MODELO].filter(Boolean).join(' ')||'Vehículo identificado para la carga')}</span></div></div><input type="hidden" name="AUTORIZACION_QR" value="${esc(qrObject.AUTORIZACION_QR||'')}">`:''}<div class="tracking-notice active full"><i>↔</i><div><b>Enlace automático con la asignación</b><span>El vehículo y el conductor se completan juntos desde la operación o ruta vigente.</span></div></div>${blocked?`<div class="module-diagnostic warning full"><i>!</i><div><b>${qrObject?'El vehículo escaneado no tiene una asignación activa':'No existe una asignación activa'}</b><span>Debe iniciar una operación o asignar una ruta para este vehículo antes de registrar combustible.</span></div></div>`:''}<label class="field full"><span>Operación o ruta asignada</span><select name="VINCULO_ASIGNACION" ${admin?'':'required'}>${assignmentOptions}</select></label><input type="hidden" name="VEHICULO_ID" value="${esc(initialVehicleId)}"><input type="hidden" name="CONDUCTOR_ID" value="${esc(record?.CONDUCTOR_ID||'')}"><input type="hidden" name="OPERACION_ID" value="${esc(record?.OPERACION_ID||'')}"><input type="hidden" name="RUTA_ID" value="${esc(record?.RUTA_ID||'')}"><div class="info-item"><span>Vehículo enlazado</span><b data-fuel-linked-vehicle>${esc(fuelName('vehicles',initialVehicleId,'Pendiente de selección'))}</b></div><div class="info-item"><span>Conductor enlazado</span><b data-fuel-linked-driver>${esc(fuelName('drivers',record?.CONDUCTOR_ID,'Pendiente de selección'))}</b></div>${admin?`<div class="form-grid full ${selectedKey?'hidden':''}" data-fuel-admin-manual><label class="field"><span>Vehículo administrativo</span><select name="VEHICULO_MANUAL_ID">${fuelSelectOptions(vehicles,initialVehicleId,row=>`${row.PATENTE||row.ID} · ${row.MARCA||''} ${row.MODELO||''}`)}</select></label><label class="field"><span>Conductor administrativo</span><select name="CONDUCTOR_MANUAL_ID">${fuelSelectOptions(drivers,record?.CONDUCTOR_ID,row=>row.NOMBRE||row.RUT||row.ID)}</select></label></div>`:''}<label class="field"><span>Fecha y hora</span><input name="FECHA_HORA" type="datetime-local" value="${esc(fechaInputLocal(record?.FECHA_HORA||new Date()))}" required></label><label class="field"><span>Tipo de combustible</span><select name="TIPO_COMBUSTIBLE">${['Diésel','Gasolina 93','Gasolina 95','Gasolina 97','Gas','Otro'].map(value=>`<option ${value===(record?.TIPO_COMBUSTIBLE||'Diésel')?'selected':''}>${value}</option>`).join('')}</select></label><label class="field"><span>Litros cargados</span><input name="LITROS" type="number" min="0.001" step="0.001" value="${esc(record?.LITROS??'')}" required></label><label class="field"><span>Precio por litro</span><input name="PRECIO_LITRO" type="number" min="0" step="0.01" value="${esc(record?.PRECIO_LITRO??'')}" required></label><label class="field"><span>Kilometraje</span><input name="KILOMETRAJE" type="number" min="0" step="0.1" value="${esc(record?.KILOMETRAJE??'')}" required></label><div class="info-item full" data-fuel-total><span>Costo calculado</span><b>${clp(record?.COSTO_TOTAL||0)}</b></div><label class="field"><span>Estación de servicio</span><input name="ESTACION_SERVICIO" value="${esc(record?.ESTACION_SERVICIO||'')}"></label><label class="field"><span>Número de boleta/factura</span><input name="NUMERO_DOCUMENTO" value="${esc(record?.NUMERO_DOCUMENTO||'')}"></label><label class="field"><span>Medio de pago</span><select name="MEDIO_PAGO">${['','Efectivo','Tarjeta empresa','Tarjeta crédito','Tarjeta débito','Transferencia','Convenio'].map(value=>`<option value="${esc(value)}" ${value===(record?.MEDIO_PAGO||'')?'selected':''}>${esc(value||'Seleccione')}</option>`).join('')}</select></label><label class="field"><span>Tanque lleno</span><select name="TANQUE_LLENO"><option value="SI" ${(record?.TANQUE_LLENO||'SI')==='SI'?'selected':''}>Sí</option><option value="NO" ${record?.TANQUE_LLENO==='NO'?'selected':''}>No</option></select></label><div class="field full"><span>Foto de la boleta</span>${markupCargaArchivo({campo:'COMPROBANTE_URL',url:record?.COMPROBANTE_URL||'',combustible:true})}</div><label class="field full"><span>Observaciones</span><textarea name="OBSERVACIONES">${esc(record?.OBSERVACIONES||'')}</textarea></label><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn primary" type="submit" ${blocked?'disabled':''}>Guardar carga</button></div></form>`;
    openModal();const form=$('#fuelForm'),assignment=form.elements.VINCULO_ASIGNACION,manual=$('[data-fuel-admin-manual]',form);enlazarCargaArchivo(form,'fuel');
    const campoFechaHora=form.elements.FECHA_HORA;if(campoFechaHora){campoFechaHora.type='text';campoFechaHora.inputMode='numeric';campoFechaHora.maxLength=16;campoFechaHora.pattern='\\d{2}/\\d{2}/\\d{4}:\\d{2}:\\d{2}';campoFechaHora.placeholder='DD/MM/AAAA:HH:MM';campoFechaHora.value=fmtDate(record?.FECHA_HORA||new Date(),true);}
    form.addEventListener('formdata',evento=>{if(campoFechaHora)evento.formData.set('FECHA_HORA',fechaVisualIso(campoFechaHora.value,true));});
    const applyLink=()=>{const value=assignment.value,item=items.find(row=>row.key===value);if(item){form.elements.VEHICULO_ID.value=item.vehicleId||'';form.elements.CONDUCTOR_ID.value=item.driverId||'';form.elements.OPERACION_ID.value=item.operationId||'';form.elements.RUTA_ID.value=item.routeId||'';manual?.classList.add('hidden');}else if(value==='ADMIN'&&admin){manual?.classList.remove('hidden');form.elements.OPERACION_ID.value='';form.elements.RUTA_ID.value='';form.elements.VEHICULO_ID.value=form.elements.VEHICULO_MANUAL_ID.value||'';form.elements.CONDUCTOR_ID.value=form.elements.CONDUCTOR_MANUAL_ID.value||'';}else{form.elements.VEHICULO_ID.value='';form.elements.CONDUCTOR_ID.value='';form.elements.OPERACION_ID.value='';form.elements.RUTA_ID.value='';manual?.classList.add('hidden');} $('[data-fuel-linked-vehicle]',form).textContent=fuelName('vehicles',form.elements.VEHICULO_ID.value,'Pendiente de selección');$('[data-fuel-linked-driver]',form).textContent=fuelName('drivers',form.elements.CONDUCTOR_ID.value,'Pendiente de selección');const vehicle=vehicles.find(row=>String(row.ID)===String(form.elements.VEHICULO_ID.value));if(vehicle&&form.elements.KILOMETRAJE&&!form.elements.KILOMETRAJE.value)form.elements.KILOMETRAJE.value=vehicle.KILOMETRAJE||'';};
    assignment.addEventListener('change',applyLink);if(admin){form.elements.VEHICULO_MANUAL_ID?.addEventListener('change',applyLink);form.elements.CONDUCTOR_MANUAL_ID?.addEventListener('change',applyLink);}applyLink();
    const paint=()=>{$('[data-fuel-total] b',form).textContent=clp(Number(form.elements.LITROS.value||0)*Number(form.elements.PRECIO_LITRO.value||0));};form.elements.LITROS.addEventListener('input',paint);form.elements.PRECIO_LITRO.addEventListener('input',paint);$('[data-cancel-modal]',form).addEventListener('click',closeModal);form.addEventListener('submit',event=>saveFuel(event,record?.ID||''));
  }

  async function saveFuel(event,id){
    event.preventDefault();const form=event.currentTarget,button=$('button[type="submit"]',form);
    await conCargaBoton(button,form._driveUploadPromise?'Esperando boleta…':'Guardando…',async()=>{try{await esperarCargaArchivo(form);const data=Object.fromEntries(new FormData(form).entries());Object.keys(data).forEach(key=>{if(data[key] instanceof File)delete data[key]});data.IP_PUBLICA=clientPublicIp;await api.request(id?'update':'create',{resource:'fuel',id,data});invalidarListasFormulario('fuel','fuelAuthorizations','vehicles');cacheVistasModulo.delete('fuel');cacheVistasModulo.delete('dashboard');closeModal();toast('Carga guardada','El consumo y el gasto fueron recalculados. Actualizando en segundo plano.');actualizarSeccionEnSegundoPlano('fuel');}catch(error){toast('No se pudo guardar',translateError(error),'error');}});
  }

  function openFuelReasonModal(chargeId,mode='request'){
    const admin=mode==='admin';$('#modalEyebrow').textContent=admin?'ELIMINACIÓN ADMINISTRATIVA':'SOLICITUD DE AUTORIZACIÓN';$('#modalTitle').textContent=admin?'Eliminar carga de combustible':'Solicitar eliminación';$('#modalBody').innerHTML=`<form id="fuelDeleteReasonForm" class="form-grid"><div class="operation-policy-fixed full"><i>!</i><div><b>${admin?'Esta acción eliminará el registro.':'Un Administrador deberá aprobar antes de que pueda eliminarse.'}</b><span>La identidad, fecha, motivo, IP y resultado quedarán en auditoría.</span></div></div><label class="field full"><span>${admin?'Motivo opcional':'Motivo'}</span><textarea name="MOTIVO" minlength="${admin?0:10}" ${admin?'':'required'} placeholder="Explique claramente por qué debe eliminarse esta carga"></textarea></label><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn danger" type="submit">${admin?'Eliminar registro':'Enviar solicitud'}</button></div></form>`;openModal();const form=$('#fuelDeleteReasonForm');$('[data-cancel-modal]',form).addEventListener('click',closeModal);form.addEventListener('submit',event=>{event.preventDefault();const button=$('button[type="submit"]',form),MOTIVO=form.elements.MOTIVO.value.trim();conCargaBoton(button,admin?'Eliminando…':'Enviando…',async()=>{try{await api.request(admin?'deleteFuel':'requestFuelDeletion',{data:{CARGA_ID:chargeId,MOTIVO,IP_PUBLICA:clientPublicIp}});invalidarListasFormulario('fuel','fuelAuthorizations','vehicles');cacheVistasModulo.delete('fuel');cacheVistasModulo.delete('dashboard');closeModal();toast(admin?'Carga eliminada':'Solicitud enviada',admin?'La eliminación quedó registrada en auditoría.':'El Administrador ya puede revisarla.');actualizarSeccionEnSegundoPlano('fuel');}catch(error){toast('No se completó la acción',translateError(error),'error');}});});
  }

  function openFuelDecisionModal(requestId,decision){
    const approve=decision==='APROBAR';$('#modalEyebrow').textContent='AUTORIZACIÓN ADMINISTRATIVA';$('#modalTitle').textContent=approve?'Aprobar eliminación':'Rechazar eliminación';$('#modalBody').innerHTML=`<form id="fuelDecisionForm" class="form-grid"><p class="helper full">${approve?'La aprobación permitirá al Operador solicitante ejecutar la eliminación.':'El registro de combustible se conservará.'}</p><label class="field full"><span>Comentario</span><textarea name="COMENTARIO" placeholder="Detalle de la decisión"></textarea></label><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn ${approve?'primary':'danger'}" type="submit">Confirmar ${approve?'aprobación':'rechazo'}</button></div></form>`;openModal();const form=$('#fuelDecisionForm');$('[data-cancel-modal]',form).addEventListener('click',closeModal);form.addEventListener('submit',event=>{event.preventDefault();const button=$('button[type="submit"]',form);conCargaBoton(button,'Resolviendo…',async()=>{try{await api.request('resolveFuelDeletion',{data:{SOLICITUD_ID:requestId,DECISION,COMENTARIO:form.elements.COMENTARIO.value.trim(),IP_PUBLICA:clientPublicIp}});invalidarListasFormulario('fuelAuthorizations');cacheVistasModulo.delete('fuel');closeModal();toast('Solicitud resuelta',approve?'El Operador ya puede ejecutar la eliminación.':'La eliminación fue rechazada.');actualizarSeccionEnSegundoPlano('fuel');}catch(error){toast('No se pudo resolver',translateError(error),'error');}});});
  }

  async function executeAuthorizedFuelDelete(chargeId,authorizationId,button){
    if(!confirm('¿Ejecutar la eliminación autorizada? El proceso quedará registrado en auditoría.'))return;
    await conCargaBoton(button,'Eliminando…',async()=>{try{await api.request('deleteFuel',{data:{CARGA_ID:chargeId,SOLICITUD_ID:authorizationId,IP_PUBLICA:clientPublicIp}});invalidarListasFormulario('fuel','fuelAuthorizations','vehicles');cacheVistasModulo.delete('fuel');cacheVistasModulo.delete('dashboard');toast('Carga eliminada','Se utilizó la autorización administrativa aprobada.');actualizarSeccionEnSegundoPlano('fuel');}catch(error){toast('No se pudo eliminar',translateError(error),'error');}});
  }

  function abrirCambioConexionEmpresa(){
    if(currentUser?.ROL_ID!=='ROL-ADMIN'){toast('Acceso restringido','Solo el Administrador puede cambiar la conexión empresarial.','error');return;}
    const actual=api.getEmpresaConexion?.()||{};
    $('#modalEyebrow').textContent='CONFIGURACIÓN PROTEGIDA';
    $('#modalTitle').textContent='Cambiar empresa conectada';
    $('#modalBody').innerHTML=`<form id="companyConnectionForm" class="form-grid"><div class="operation-policy-fixed full"><i>✓</i><div><b>${esc(actual.nombre||'Empresa configurada')}</b><span>${esc(actual.rut||'RUT registrado')} · La dirección del servicio permanece oculta.</span></div></div><label class="field full"><span>RUT de la nueva empresa</span><input name="RUT_EMPRESA" autocomplete="off" inputmode="text" required placeholder="76.123.456-0"></label><p class="helper full">El directorio comprobará la empresa y su servicio. Si la conexión es válida, esta sesión se cerrará para iniciar con las credenciales de la nueva empresa.</p><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn primary" type="submit">Buscar y conectar</button></div></form>`;
    openModal();
    const form=$('#companyConnectionForm');
    $('[data-cancel-modal]',form).addEventListener('click',closeModal);
    form.addEventListener('submit',event=>{
      event.preventDefault();
      const button=$('button[type="submit"]',form);
      conCargaBoton(button,'Comprobando…',async()=>{
        try{
          const empresa=await api.resolverConexionEmpresa(form.elements.RUT_EMPRESA.value);
          api.setAuth({});
          toast('Conexión establecida',`${empresa.nombre} quedó guardada en este navegador.`);
          setTimeout(()=>location.replace('index.html?sesion=cerrada'),450);
        }catch(error){toast('No se pudo cambiar la empresa',translateError(error),'error');}
      });
    });
  }

  function bindSection() {
    enlazarCalendarios($('#content')||document);
    const contentActual=$('#content');
    if(contentActual){
      if(contentActual.dataset.proteccionRefrescoEnlazada!=='1'){
        contentActual.addEventListener('input',marcarTrabajoUsuario);
        contentActual.addEventListener('change',marcarTrabajoUsuario);
        contentActual.dataset.proteccionRefrescoEnlazada='1';
      }
      $$('form',contentActual).forEach(form=>{
        form.addEventListener('reset',()=>setTimeout(()=>{delete form.dataset.trabajoUsuario;},0),{once:true});
      });
    }
    $('[data-record-limit]')?.addEventListener('change',async event=>{
      const select=event.currentTarget,value=select.value;
      guardarLimiteRegistros(currentSection,value);
      select.disabled=true;
      actualizarEstadoSincronizacionVisible(value==='TODOS'?'Cargando todos los registros por bloques…':`Consultando los ${value} registros más recientes…`,'syncing');
      try{await go(currentSection,{force:true});}
      finally{if(select.isConnected)select.disabled=false;}
    });
    $('[data-open-company-connection]')?.addEventListener('click',abrirCambioConexionEmpresa);
    $$('[data-nav]').forEach(btn=>btn.addEventListener('click',()=>navigateSection(btn.dataset.nav)));
    $('[data-office-review]')?.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Revisando…',()=>ejecutarRevisionOficinaVirtual(event.currentTarget)));
    $('[data-office-repair]')?.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Reparando…',()=>repararConOficinaVirtual(event.currentTarget)));
    $('[data-office-auto]')?.addEventListener('change',event=>configurarModoAutomaticoOficinaVirtual(event.currentTarget));
    $$('[data-office-open]').forEach(btn=>btn.addEventListener('click',()=>navigateSection(btn.dataset.officeOpen)));
    $$('[data-office-suggestion]').forEach(btn=>btn.addEventListener('click',()=>enviarConsultaOficinaVirtual(btn.dataset.officeSuggestion,btn)));
    const officeForm=$('#officeForm');if(officeForm)officeForm.addEventListener('submit',event=>{event.preventDefault();const button=$('button[type="submit"]',officeForm),message=officeForm.elements.MENSAJE.value;conCargaBoton(button,'Pensando…',()=>enviarConsultaOficinaVirtual(message,button));});
    const officeDocumentForm=$('#officeDocumentForm');if(officeDocumentForm)officeDocumentForm.addEventListener('submit',cargarDocumentoOficinaVirtual);
    const officeFailureForm=$('#officeFailureForm');if(officeFailureForm)officeFailureForm.addEventListener('submit',informarFallaOficinaVirtual);
    $$('[data-office-generate-report]').forEach(btn=>btn.addEventListener('click',()=>generarReporteOficinaVirtual(btn)));
    $$('[data-office-resolve-incident]').forEach(btn=>btn.addEventListener('click',()=>resolverIncidenteOficinaVirtual(btn.dataset.officeResolveIncident,btn)));
    if($('#officeTaskList'))setTimeout(()=>cargarPendientesOficinaVirtual(),0);
    $('[data-new-fuel]')?.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Preparando…',()=>openFuelModal()));
    $$('[data-edit-fuel]').forEach(btn=>btn.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Preparando…',()=>openFuelModal(registroFormulario('fuel',btn.dataset.editFuel)))));
    $$('[data-request-fuel-delete]').forEach(btn=>btn.addEventListener('click',()=>openFuelReasonModal(btn.dataset.requestFuelDelete,'request')));
    $$('[data-admin-delete-fuel]').forEach(btn=>btn.addEventListener('click',()=>openFuelReasonModal(btn.dataset.adminDeleteFuel,'admin')));
    $$('[data-execute-fuel-delete]').forEach(btn=>btn.addEventListener('click',()=>executeAuthorizedFuelDelete(btn.dataset.executeFuelDelete,btn.dataset.authorization,btn)));
    $$('[data-approve-fuel-delete]').forEach(btn=>btn.addEventListener('click',()=>openFuelDecisionModal(btn.dataset.approveFuelDelete,'APROBAR')));
    $$('[data-reject-fuel-delete]').forEach(btn=>btn.addEventListener('click',()=>openFuelDecisionModal(btn.dataset.rejectFuelDelete,'RECHAZAR')));
    $$('[data-add]').forEach(btn=>btn.addEventListener('click',()=>openResourceModal(btn.dataset.add)));
    $$('[data-open-document-expedient]').forEach(btn=>btn.addEventListener('click',()=>abrirExpedienteDocumental(btn.dataset.openDocumentExpedient)));
    $('[data-expedient-search-input]')?.addEventListener('input',event=>{const value=String(event.target.value||'').trim().toLowerCase();$$('[data-document-expedient-card]').forEach(card=>{card.hidden=Boolean(value&&!String(card.dataset.expedientSearch||'').includes(value));});});
    $$('[data-view-document]').forEach(btn=>btn.addEventListener('click',()=>abrirVisorDocumento(btn.dataset.viewDocument)));
    $$('[data-approve-document]').forEach(btn=>btn.addEventListener('click',()=>reviewDocument(btn.dataset.approveDocument,'APROBAR',btn)));
    $$('[data-reject-document]').forEach(btn=>btn.addEventListener('click',()=>reviewDocument(btn.dataset.rejectDocument,'RECHAZAR',btn)));
    $('[data-restore-role-permissions]')?.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Restaurando…',async()=>{try{const result=await api.request('restoreRolePermissions',{});invalidarListasFormulario('users');cacheVistasModulo.delete('users');toast('Permisos base restaurados',`${number(result.usuariosActualizados||0)} usuarios quedaron sincronizados con su rol.`);await actualizarSeccionEnSegundoPlano('users');}catch(error){toast('No se pudieron restaurar los permisos',translateError(error),'error');}}));
    $$('[data-bulk-import]').forEach(btn=>btn.addEventListener('click',()=>openBulkImportModal(btn.dataset.bulkImport)));
    $$('[data-print-vehicle-qr]').forEach(btn=>btn.addEventListener('click',()=>conCargaBoton(btn,'Preparando QR…',async()=>{try{await openVehicleQrLabel(btn.dataset.printVehicleQr);}catch(error){toast('No se pudo preparar la etiqueta',translateError(error),'error');}})));
    $$('[data-edit]').forEach(btn=>btn.addEventListener('click',()=>{const [resource,id]=btn.dataset.edit.split(':');openResourceModal(resource,registroFormulario(resource,id),id);}));
    $$('[data-delete]').forEach(btn=>btn.addEventListener('click',()=>deleteRecord(btn.dataset.delete,btn)));
    $$('[data-export]').forEach(btn=>btn.addEventListener('click',()=>conCargaBoton(btn,'Exportando…',()=>exportResource(btn.dataset.export,'csv'))));
    $$('[data-export-resource][data-export-format]').forEach(btn=>btn.addEventListener('click',()=>conCargaBoton(btn,'Exportando…',()=>exportResource(btn.dataset.exportResource,btn.dataset.exportFormat))));
    configurarFiltrosAvanzados();
    $$('[data-sync],[data-refresh],[data-retry]').forEach(btn=>{if(btn.dataset.syncBound==='1')return;btn.dataset.syncBound='1';btn.addEventListener('click',()=>sincronizarSistema(btn));});
    const appUpdateForm=$('#appUpdateForm');if(appUpdateForm){
      const fileInput=$('[data-app-apk-file]',appUpdateForm),progress=$('[data-app-upload-progress]',appUpdateForm),success=$('[data-app-upload-success]',appUpdateForm),bar=$('[data-app-upload-bar]',appUpdateForm),message=$('[data-app-upload-message]',appUpdateForm),percent=$('[data-app-upload-percent]',appUpdateForm),track=$('[role="progressbar"]',appUpdateForm);
      const mostrarProgreso=state=>{const value=Math.max(0,Math.min(100,Number(state?.percent||0)));progress.hidden=false;success.hidden=true;bar.style.width=`${value}%`;message.textContent=state?.message||'Procesando…';percent.textContent=`${Math.round(value)}%`;track?.setAttribute('aria-valuenow',String(Math.round(value)));};
      fileInput?.addEventListener('change',async()=>{const file=fileInput.files?.[0];success.hidden=true;if(!file)return;try{const meta=await window.SGFPublicadorAndroid.analyzeApk(file,mostrarProgreso);$('[data-app-apk-version]',appUpdateForm).textContent=meta.versionName;$('[data-app-apk-code]',appUpdateForm).textContent=String(meta.versionCode);$('[data-app-apk-size]',appUpdateForm).textContent=`${(meta.fileSize/1024/1024).toFixed(1)} MB`;$('[data-app-apk-sha]',appUpdateForm).textContent=meta.sha256;progress.hidden=true;}catch(error){fileInput.value='';progress.hidden=true;toast('APK no válida',translateError(error),'error');}});
      appUpdateForm.addEventListener('submit',event=>{event.preventDefault();const button=$('button[type="submit"]',appUpdateForm);conCargaBoton(button,'Publicando…',async()=>{try{const file=fileInput?.files?.[0];if(!file)throw new Error('APK_REQUERIDA');const result=await window.SGFPublicadorAndroid.publish({file,api,onProgress:mostrarProgreso,minimumVersionCode:Number(appUpdateForm.elements.VERSION_MINIMA_CODE?.value||0),priority:String(appUpdateForm.elements.OBLIGATORIA?.value||'NO'),notes:String(appUpdateForm.elements.NOTAS?.value||'')});success.hidden=false;progress.hidden=true;toast('Actualización publicada',`${number(result.usuariosObjetivo||0)} usuarios fueron incluidos y ${number(result.notificacionesCreadas||0)} notificaciones quedaron generadas.`);cacheVistasModulo.delete('appUpdates');setTimeout(()=>go('appUpdates',{force:true}),900);}catch(error){success.hidden=true;toast('No se pudo publicar la actualización',translateError(error),'error');throw error;}});});
    }
    $$('[data-resend-update]').forEach(btn=>btn.addEventListener('click',()=>conCargaBoton(btn,'Reenviando…',async()=>{try{const result=await api.request('reenviarAlertasActualizacionAndroid',{data:{ACTUALIZACION_ID:btn.dataset.resendUpdate}});toast('Alertas reenviadas',`${number(result.notificacionesCreadas||0)} usuarios pendientes fueron notificados nuevamente.`);cacheVistasModulo.delete('appUpdates');await go('appUpdates',{force:true});}catch(error){toast('No se pudieron reenviar las alertas',translateError(error),'error');throw error;}})));
    $$('[data-new-operation]').forEach(btn=>btn.addEventListener('click',()=>openOperationModal()));
    $$('[data-quick-base-setup]').forEach(btn=>btn.addEventListener('click',()=>configurarPuntoOperacionRapido(btn)));
    $$('[data-new-checkin]').forEach(btn=>btn.addEventListener('click',()=>openCheckinModal()));
    $$('[data-assign-checkin-vehicle]').forEach(btn=>btn.addEventListener('click',openAssignCheckinVehicleModal));
    $$('[data-open-fuel-qr]').forEach(btn=>btn.addEventListener('click',()=>openQr('combustible')));
    $$('[data-open-checkin-qr]').forEach(btn=>btn.addEventListener('click',()=>openQr('checkin')));
    $('[data-focus-checkin]')?.addEventListener('click',()=>$('#checkinVisibleCard')?.scrollIntoView({behavior:'smooth',block:'start'}));
    const inlineCheckin=$('#checkinInlineForm');if(inlineCheckin)bindInlineCheckinForm(inlineCheckin);
    $$('[data-review-checkin]').forEach(btn=>btn.addEventListener('click',()=>openCheckinReviewModal(btn.dataset.reviewCheckin)));
    $$('[data-checkin-detail]').forEach(btn=>btn.addEventListener('click',()=>openCheckinDetailModal(btn.dataset.checkinDetail)));
    $$('[data-active-route]').forEach(btn=>btn.addEventListener('click',()=>seleccionarRutaActiva(btn.dataset.activeRoute)));
    $$('[data-checkin-route-notification]').forEach(btn=>btn.addEventListener('click',()=>{const item=(cacheListasFormulario.get('notifications')||[]).find(row=>String(row.ID)===String(btn.dataset.checkinRouteNotification));conCargaBoton(btn,'Abriendo…',async()=>{if(!item?.CHECKIN_ID)throw new Error('CHECKIN_NO_ENCONTRADO');openCheckinDetailModal(item.CHECKIN_ID,{notificacion:item});});}));
    $$('[data-new-route]').forEach(btn=>btn.addEventListener('click',openRouteModal));
    if(currentSection==='routes')consumirPrefillRutaCheckin();
    $$('[data-route-state]').forEach(btn=>btn.addEventListener('click',()=>conCargaBoton(btn,'Actualizando…',()=>changeRouteState(btn.dataset.routeState))));
    $$('[data-route-evidence]').forEach(btn=>btn.addEventListener('click',()=>openRouteEvidenceModal(btn.dataset.routeEvidence)));
    $$('[data-route-weather]').forEach(btn=>btn.addEventListener('click',()=>openRouteWeatherModal(btn.dataset.routeWeather)));
    $$('[data-route-reassign]').forEach(btn=>btn.addEventListener('click',()=>openRouteReassignModal(btn.dataset.routeReassign,btn)));
    $$('[data-resend-assignment]').forEach(btn=>btn.addEventListener('click',()=>{const [tipo,id]=String(btn.dataset.resendAssignment||'').split(':');conCargaBoton(btn,'Reenviando…',()=>reenviarAlertaAsignacion(tipo,id,btn));}));
    enlazarVisoresRuta($('#content'));
    enlazarGaleriasRuta($('#content'));
    startRouteClocks();
    $$('[data-new-notification]').forEach(btn=>btn.addEventListener('click',openNotificationModal));
    $$('[data-read-notification]').forEach(btn=>btn.addEventListener('click',()=>conCargaBoton(btn,'Actualizando…',()=>readNotification(btn.dataset.readNotification))));
    $$('[data-accept-assignment]').forEach(btn=>btn.addEventListener('click',()=>conCargaBoton(btn,'Aceptando…',()=>responderAvisoAsignacionWeb({ID:btn.dataset.acceptAssignment},'ACEPTADA',btn))));
    $('[data-read-all-notifications]')?.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Actualizando…',marcarTodasNotificacionesLeidas));
    $$('[data-read-alert]').forEach(btn=>btn.addEventListener('click',()=>conCargaBoton(btn,'Actualizando…',()=>readAlert(btn.dataset.readAlert))));
    $('[data-read-all-alerts]')?.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Actualizando…',markAllAlertsRead));
    $('[data-run-alert-engine]')?.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Revisando…',()=>runAutomaticAlerts(event.currentTarget)));
    $('[data-diagnose-system]')?.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Revisando…',runSystemDiagnostic));
    $('[data-repair-system]')?.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Reparando…',repairSystem));
    $$('[data-user-permissions]').forEach(btn=>btn.addEventListener('click',()=>openUserPermissionsModal(btn.dataset.userPermissions)));
    $$('[data-whatsapp-driver]').forEach(btn=>btn.addEventListener('click',()=>openWhatsAppDriver(btn.dataset.whatsappDriver)));
    $$('[data-driver-occupation]').forEach(btn=>btn.addEventListener('click',()=>openDriverOccupationModal(btn.dataset.driverOccupation,btn)));
    $$('[data-driver-documents]').forEach(btn=>btn.addEventListener('click',()=>openDriverDocumentsModal(btn.dataset.driverDocuments,btn)));
    $$('[data-voice-command]').forEach(btn=>btn.addEventListener('click',iniciarComandoVoz));
    $$('[data-speak-notifications]').forEach(btn=>btn.addEventListener('click',()=>leerNotificacionesVoz()));
    $$('[data-stop-voice]').forEach(btn=>btn.addEventListener('click',detenerVoz));
    $$('[data-finish-operation]').forEach(btn=>btn.addEventListener('click',()=>finishOperation(btn.dataset.finishOperation,btn)));
    $$('[data-edit-operation-admin]').forEach(btn=>btn.addEventListener('click',()=>openAdminEditOperationModal(btn.dataset.editOperationAdmin)));
    $$('[data-delete-operation-admin]').forEach(btn=>btn.addEventListener('click',()=>openAdminDeleteOperationModal(btn.dataset.deleteOperationAdmin)));
    $$('[data-open-qr]').forEach(btn=>btn.addEventListener('click',()=>openQr('vehiculo-operacion')));
    $$('[data-refresh-locations]').forEach(btn=>btn.addEventListener('click',()=>conCargaBoton(btn,'Actualizando…',()=>refreshLocations(true,false))));
    $$('[data-capture-gps]').forEach(btn=>btn.addEventListener('click',()=>conCargaBoton(btn,'Obteniendo GPS…',captureGps)));
    $$('[data-toggle-tracking]').forEach(btn=>btn.addEventListener('click',()=>conCargaBoton(btn,gpsWatchId===null?'Activando…':'Deteniendo…',toggleTracking).then(updateTrackingUi)));
    $$('[data-gps-scope]').forEach(btn=>btn.addEventListener('click',()=>changeGpsTrackingScope(btn.dataset.gpsScope)));
    $$('[data-gps-connection]').forEach(btn=>btn.addEventListener('click',()=>changeGpsConnectionFilter(btn.dataset.gpsConnection)));
    $$('[data-gps-vehicle]').forEach(input=>input.addEventListener('change',()=>toggleGpsVehicle(input.dataset.gpsVehicle,input.checked)));
    $('[data-gps-select-all]')?.addEventListener('click',selectAllGpsVehicles);
    $('[data-gps-clear]')?.addEventListener('click',clearGpsVehicles);
    $('[data-gps-apply]')?.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Aplicando…',applyGpsVehicleFilter));
    $('[data-gps-reset]')?.addEventListener('click',resetGpsVehicleFilterDraft);
    $('[data-gps-vehicle-search]')?.addEventListener('input',event=>filterGpsVehicleOptions(event.target.value));
    const gpsDriverForm=$('#gpsDriverFilterForm');if(gpsDriverForm){gpsDriverForm.addEventListener('submit',event=>{event.preventDefault();const button=$('button[type="submit"]',gpsDriverForm);conCargaBoton(button,'Aplicando…',()=>applyGpsDriverFilters(gpsDriverForm));});$('[data-gps-driver-reset]',gpsDriverForm)?.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Limpiando…',resetGpsDriverFilters));}
    $$('[data-focus-location]').forEach(btn=>btn.addEventListener('click',()=>{const [lat,lng]=btn.dataset.focusLocation.split(',').map(Number);mapaFlota?.establecerVista(lat,lng,17);}));
    $('[data-map-fullscreen]')?.addEventListener('click',()=>toggleMapFullscreen());
    const connectionsRefreshButton=$('[data-connections-refresh]');if(connectionsRefreshButton&&connectionsRefreshButton.dataset.refreshBound!=='1'){connectionsRefreshButton.dataset.refreshBound='1';connectionsRefreshButton.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Actualizando…',()=>refreshConnectionsOnline(true,false)));}
    const connectionsRetryButton=$('[data-connections-initial-retry]');if(connectionsRetryButton&&connectionsRetryButton.dataset.refreshBound!=='1'){connectionsRetryButton.dataset.refreshBound='1';connectionsRetryButton.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Consultando…',()=>cargarConexionesIniciales()));}
    const connectionsForm=$('#connectionsFilterForm');if(connectionsForm&&connectionsForm.dataset.filterBound!=='1'){
      connectionsForm.dataset.filterBound='1';
      connectionsForm.addEventListener('submit',event=>{event.preventDefault();const button=$('button[type="submit"]',connectionsForm);conCargaBoton(button,'Aplicando…',()=>applyConnectionsFilters(connectionsForm));});
      $('[data-connections-reset]',connectionsForm)?.addEventListener('click',()=>resetConnectionsFilters());
      const search=connectionsForm.elements.BUSCAR;
      search?.addEventListener('input',()=>{
        filtrosConexiones.BUSCAR=String(search.value||'').trim();
        paintConnectionsOnline(ultimoResumenConexiones,true);
        if(connectionsFilterTimer)clearTimeout(connectionsFilterTimer);
        connectionsFilterTimer=setTimeout(()=>{connectionsFilterTimer=null;if(currentSection==='connections')refreshConnectionsOnline(false,true);},320);
      });
    }
    enlazarSeguimientoConexiones($('#connectionsResults')||document);
    enlazarFocoConexiones($('#connectionsResults')||document);
    enlazarAvisosConexiones($('#content')||document);
    enlazarDesconexionUsuariosConectados($('#connectionsResults')||document);
    const kpiForm=$('#kpiFilterForm');if(kpiForm){const recargar=()=>pintarKpisReportes(true);$('[data-kpi-apply]',kpiForm)?.addEventListener('click',recargar);$('[data-kpi-all]',kpiForm)?.addEventListener('click',()=>{kpiForm.elements.FECHA_DESDE.value='';kpiForm.elements.FECHA_HASTA.value='';kpiForm.elements.CONDUCTOR_ID.value='';kpiForm.elements.VEHICULO_ID.value='';recargar();});$('[data-kpi-reset]',kpiForm)?.addEventListener('click',()=>{const today=new Date(),start=new Date();start.setDate(today.getDate()-30);kpiForm.elements.FECHA_DESDE.value=fechaInputVisual(start);kpiForm.elements.FECHA_HASTA.value=fechaInputVisual(today);kpiForm.elements.CONDUCTOR_ID.value='';kpiForm.elements.VEHICULO_ID.value='';recargar();});pintarKpisReportes(false);}
    const connectionConfigForm=$('#connectionConfigForm');if(connectionConfigForm){
      $('[data-test-connection-config]',connectionConfigForm)?.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Probando…',async()=>{try{await probarConfiguracionConexionesWeb(connectionConfigForm,event.currentTarget);}catch(error){toast('No se pudo probar la conexión',translateError(error),'error');}}));
      connectionConfigForm.addEventListener('submit',event=>{event.preventDefault();const button=$('button[type="submit"]',connectionConfigForm);conCargaBoton(button,'Guardando…',async()=>{try{await guardarConfiguracionConexionesWeb(connectionConfigForm,button);}catch(error){toast('No se guardó la configuración',translateError(error),'error');}});});
    }
    const operationLocationForm=$('#operationLocationForm');if(operationLocationForm){
      bindAddressAutocomplete(operationLocationForm);
      $('[data-capture-base-location]',operationLocationForm)?.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Obteniendo GPS…',async()=>{try{const location=await obtenerUbicacionNavegador({aceptarRespaldo:false,maximumAgeAproximada:0});operationLocationForm.elements.PUNTO_OPERACION_LATITUD.value=location.latitud;operationLocationForm.elements.PUNTO_OPERACION_LONGITUD.value=location.longitud;const node=$('[data-settings-location-status]',operationLocationForm);if(node){node.className='operation-location-status valid';node.innerHTML=`<i>✓</i><div><b>Coordenadas capturadas</b><span>${location.latitud.toFixed(6)}, ${location.longitud.toFixed(6)} · precisión ±${Math.round(location.precision)} m</span></div>`;}toast('Ubicación capturada','Revise la dirección y guarde la configuración.');}catch(error){toast('No se obtuvo la ubicación',translateError(error),'error');}}));
      operationLocationForm.addEventListener('submit',event=>{event.preventDefault();const button=$('button[type="submit"]',operationLocationForm);conCargaBoton(button,'Guardando punto…',async()=>{try{const data=Object.fromEntries(new FormData(operationLocationForm).entries());data.VALIDAR_UBICACION_OPERACION='SI';data.IP_PUBLICA=clientPublicIp;const result=await api.request('saveOperationalPoint',{data});const devicePoint=guardarPuntoOperacionDispositivo({...result,row:result.row||data},'SERVIDOR');currentCompany={...(currentCompany||{}),...(result.row||data),...(devicePoint||{})};const savedBase=configuracionPuntoOperacion(currentCompany);if(!savedBase.configurada)throw new Error('PUNTO_OPERACION_NO_CONFIRMADO');invalidarListasFormulario('companies');['settings','operations','routes','gps'].forEach(section=>cacheVistasModulo.delete(section));toast('Punto operacional confirmado',`${savedBase.nombre} · ${savedBase.latitud.toFixed(6)}, ${savedBase.longitud.toFixed(6)} · radio de inicio ${savedBase.radioInicio} m.`);actualizarSeccionEnSegundoPlano('settings');}catch(error){toast('No se guardó el punto',translateError(error),'error');}});});
    }
    $('[data-backup-database]')?.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Generando respaldo…',async()=>{try{await generarRespaldoGeneralXlsx(event.currentTarget);}catch(error){const node=$('[data-backup-status]');if(node){node.className='backup-status error';node.textContent=translateError(error);}toast('No se pudo generar el respaldo',translateError(error),'error');}}));
    $('[data-clear-data]')?.addEventListener('click',event=>clearData(event.currentTarget));
    $('#darkSwitch')?.addEventListener('change',event=>setTheme(event.target.checked));
    const themeForm=$('#themeForm');if(themeForm){
      themeForm.addEventListener('submit',saveTheme);
      $$('[data-theme-color]',themeForm).forEach(input=>input.addEventListener('input',()=>actualizarVistaPreviaTema(themeForm)));
      themeForm.elements.TEMA_PREDETERMINADO?.addEventListener('change',()=>actualizarVistaPreviaTema(themeForm));
      $$('[data-theme-preset]').forEach(button=>button.addEventListener('click',()=>{const preset=window.TemaFlotas?.PREAJUSTES?.[button.dataset.themePreset];if(preset)aplicarValoresTemaFormulario(themeForm,preset.valores);}));
      $('[data-theme-defaults]')?.addEventListener('click',()=>aplicarValoresTemaFormulario(themeForm,window.TemaFlotas?.PREDETERMINADOS||{}));
      $('[data-theme-discard]')?.addEventListener('click',()=>aplicarValoresTemaFormulario(themeForm,currentCompany||window.TemaFlotas?.guardado?.()||{}));
    }
    $('#companyForm')?.addEventListener('submit',saveCompany);
    $('#companyLogo')?.addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;if(file.size>1572864){event.target.value='';return toast('Logotipo demasiado grande','El archivo debe pesar como máximo 1,5 MB.','error');}$('#companyLogoPreview').src=await readImageFile(file);$('#removeLogoValue').value='NO';});
    $('[data-remove-company-logo]')?.addEventListener('click',()=>{$('#companyLogoPreview').src=defaultLogo;$('#companyLogo').value='';$('#removeLogoValue').value='SI';});
    bindAddressAutocomplete($('#content'));
  }

  function opcionesListaDinamica(kind, rows, selected = '') {
    const selectedValue=String(selected||'');
    let values=[...(rows||[])],placeholder='Seleccione';
    if(kind==='users'){placeholder='Sin asociar';}
    if(kind==='routeDrivers'){values=values.filter(row=>row.ESTADO==='Disponible'||String(row.ID)===selectedValue);}
    if(kind==='routeVehicles'){placeholder='Por definir';values=values.filter(row=>row.ESTADO==='Disponible'||String(row.ID)===selectedValue);}
    if(kind==='notificationDrivers'){values=values.filter(row=>row.ESTADO!=='Inactivo');}
    if(['operationVehicles','checkinVehicles','checkinAssignVehicles'].includes(kind)){
      values=values.filter(row=>['DISPONIBLE','ACTIVO'].includes(String(row.ESTADO||'').toUpperCase())||String(row.ID)===selectedValue);
      const selectedRecord=registroFormulario('vehicles',selectedValue);
      if(selectedRecord&&!values.some(row=>String(row.ID)===selectedValue))values.unshift(selectedRecord);
    }
    if(['operationDrivers','checkinDrivers','checkinAssignDrivers'].includes(kind))values=values.filter(row=>['DISPONIBLE','ACTIVO'].includes(String(row.ESTADO||'').toUpperCase())||String(row.ID)===selectedValue);
    const label=row=>{
      if(kind==='users')return `${row.ID||'USR'} · ${row.NOMBRE||'Usuario'} · ${row.CORREO||''}`;
      if(['drivers','routeDrivers','notificationDrivers','operationDrivers','checkinDrivers','checkinAssignDrivers'].includes(kind))return `${row.ID||'CON'} · ${row.NOMBRE||'Conductor'} · ${row.RUT||row.CORREO||''}${kind==='checkinAssignDrivers'?` · ${row.USUARIO_ID?'Usuario vinculado':'Vinculación por correo al asignar'}`:''}`;
      return `${row.ID||'VEH'} · ${row.PATENTE||'Sin patente'} · ${row.MARCA||''} ${row.MODELO||''}`;
    };
    const emptyLabel=kind.toLowerCase().includes('driver')||kind==='drivers'?'No hay conductores disponibles':kind==='users'?'No hay usuarios disponibles':'No hay vehículos disponibles';
    return `<option value="">${values.length?placeholder:emptyLabel}</option>${values.map(row=>`<option value="${esc(row.ID)}" ${String(row.ID)===selectedValue?'selected':''}>${esc(label(row).trim())}</option>`).join('')}`;
  }

  function selectorDinamico(resource,kind,name,selected='',required=false) {
    const loaded=cacheListasFormulario.has(resource);
    const options=loaded?opcionesListaDinamica(kind,listaFormulario(resource),selected):'<option value="">Cargando opciones…</option>';
    return `<select name="${name}" data-list-resource="${resource}" data-list-kind="${kind}" data-selected="${esc(selected)}" ${required?'required':''} ${loaded?'':'disabled'}>${options}</select>`;
  }

  function actualizarSelectoresModal(token) {
    if(token!==secuenciaModal||!$('#modalBackdrop').classList.contains('open'))return;
    $$('select[data-list-resource]',$('#modalBody')).forEach(select=>{
      const resource=select.dataset.listResource;
      if(!cacheListasFormulario.has(resource))return;
      const selected=select.dataset.selected||select.value||'';
      select.innerHTML=opcionesListaDinamica(select.dataset.listKind,listaFormulario(resource),selected);
      select.disabled=false;
      if(selected)select.value=selected;
    });
  }

  function prepararListasModal(token, resources=[]) {
    const pending=[...new Set(resources)].filter(resource=>!cacheListasFormulario.has(resource));
    actualizarSelectoresModal(token);
    if(!pending.length)return;
    const submit=$('button[type="submit"]',$('#modalBody'));
    const finalizar=activarCargaBoton(submit,'Preparando opciones…');
    let loadError=null;
    Promise.all(pending.map(cargarListaFormulario))
      .then(()=>actualizarSelectoresModal(token))
      .catch(error=>{
        loadError=error;
        if(token===secuenciaModal)toast('No se pudieron cargar las opciones',translateError(error),'error');
      })
      .finally(()=>{
        finalizar?.();
        if(loadError&&token===secuenciaModal&&submit){
          const requeridosPendientes=$$('select[data-list-resource][required]:disabled',$('#modalBody')).length;
          if(requeridosPendientes){
            submit.disabled=true;
            submit.textContent='Opciones no disponibles';
          }
        }
      });
  }

  function contenidoCargaModal(text='Preparando información…') {
    return `<div class="modal-loading" role="status"><i></i><div><b>${esc(text)}</b><span>El formulario ya está abierto y se completará en un momento.</span></div></div>`;
  }

  function pintarModalRecurso(resource,record,token) {
    if(token!==secuenciaModal)return;
    const definition=resourceFields[resource];if(!definition)return;
    $('#modalEyebrow').textContent=definition.eyebrow;$('#modalTitle').textContent=`${record?'Editar':'Nuevo'} ${definition.title.toLowerCase()}`;
    const documentoPropio=resource==='documents'&&currentUser.ROL_ID==='ROL-CONDUCTOR';
    const documentoRequiereAprobacion=resource==='documents'&&!esAdministrador();
    const camposAsociacionDocumento=new Set(['ASOCIADO_TIPO','CONDUCTOR_ASOCIADO_ID','VEHICULO_SELECTOR_ID','USUARIO_ASOCIADO_ID','ASOCIADO_ID','CORREO_ASOCIADO']);
    const controls=definition.fields.map(([name,label,type,option])=>{
      if(documentoPropio&&camposAsociacionDocumento.has(name))return '';
      const required=option===true&&!(record&&name==='CONTRASENA');const current=record?.[name]??'';let control='';
      if(resource==='documents'&&name==='ESTADO_REVISION'){
        const review=record?documentReviewState(record):(esAdministrador()?'Aprobado':'Pendiente de revisión');
        control=`<input name="ESTADO_REVISION_VISIBLE" type="text" value="${esc(review)}" readonly class="document-review-readonly ${statusClass(review)}"><input name="ESTADO_REVISION" type="hidden" value="${esc(review)}">`;
      }else if(type==='select'){
        const options=Array.isArray(option)?option:[];control=`<select name="${name}" ${required?'required':''}><option value="">Seleccione</option>${options.map(item=>{const value=Array.isArray(item)?item[0]:item,text=Array.isArray(item)?item[1]:item;return `<option value="${esc(value)}" ${String(current)===String(value)?'selected':''}>${esc(text)}</option>`;}).join('')}</select>`;
      }else if(resource==='documents'&&name==='DIRECCION_ARCHIVO')control=markupCargaArchivo({campo:'DIRECCION_ARCHIVO',url:current,record:record||{}});
      else if(type==='userSelect')control=selectorDinamico('users','users',name,current,false);
      else if(type==='driverSelect')control=selectorDinamico('drivers','drivers',name,current,false);
      else if(type==='vehicleSelect')control=selectorDinamico('vehicles','vehicles',name,current,required);
      else if(type==='textarea')control=`<textarea name="${name}" ${required?'required':''}>${esc(current)}</textarea>`;
      else if(type==='date'){const value=current?fechaInputIso(current):'';control=`<input name="${name}" type="date" value="${esc(value)}" data-calendar-auto ${required?'required':''}>`;}
      else {const autoDoc=resource==='documents'&&['ASOCIADO_ID','CORREO_ASOCIADO'].includes(name);control=`<input name="${name}" type="${type}" value="${esc(current)}" ${required?'required':''} ${autoDoc?'readonly':''}>`; }
      const full=['DESCRIPCION','OBSERVACIONES','MENSAJE','DIRECCION_ARCHIVO'].includes(name)?'full':'';
      if(resource==='documents'&&name==='DIRECCION_ARCHIVO')return `<div class="field ${full}"><span>${label}</span>${control}</div>`;
      return `<label class="field ${full}"><span>${label}</span>${control}</label>`;
    }).join('');
    const avisoEstadoAutomatico=['drivers','vehicles'].includes(resource)?`<div class="tracking-notice active full"><i>⇄</i><div><b>Disponibilidad automática</b><span>Disponible, En ruta y En operación se calculan desde las rutas y operaciones activas. Puede editar los demás datos sin liberar manualmente al recurso.</span></div></div>`:'';
    const avisoDocumentoPropio=documentoPropio?`<div class="tracking-notice active full"><i>✓</i><div><b>Documento personal asociado automáticamente</b><span>Se vinculará con su cuenta ${esc(currentUser.CORREO||'')} y, cuando exista, con su registro de conductor. Quedará pendiente de aprobación administrativa.</span></div></div>`:'';
    const avisoOperador=resource==='documents'&&currentUser.ROL_ID==='ROL-SUPERVISOR'&&!record?`<div class="tracking-notice active full"><i>○</i><div><b>Revisión administrativa obligatoria</b><span>Los documentos cargados por Operadores quedan pendientes hasta que un Operador, Administrador o Gerencia los apruebe.</span></div></div>`:'';
    const avisoAdmin=resource==='documents'&&esAdministrador()&&!record?`<div class="tracking-notice active full document-auto-approved"><i>✓</i><div><b>Aprobación automática</b><span>Los documentos cargados por Administración o Gerencia quedan aprobados inmediatamente.</span></div></div>`:'';
    const reviewPanel=resource==='documents'&&record?`<div class="document-review-panel full ${statusClass(documentReviewState(record))}"><div class="document-review-icon">${/^aprobado$/i.test(documentReviewState(record))?'✓':/^rechazado$/i.test(documentReviewState(record))?'×':'○'}</div><div><b>${esc(documentReviewState(record))}</b><span>${record.FECHA_REVISION?`Revisado el ${fmtDate(record.FECHA_REVISION,true)}${record.REVISADO_POR_CORREO?` por ${esc(record.REVISADO_POR_CORREO)}`:''}`:'Aún no existe una decisión administrativa.'}</span>${record.OBSERVACION_REVISION?`<small>${esc(record.OBSERVACION_REVISION)}</small>`:''}</div></div>`:'';
    const approvalActions=resource==='documents'&&record&&puedeRevisarDocumentos()&&!/^aprobado$/i.test(documentReviewState(record))?`${hasPermission('DOCUMENTOS','APROBAR')?'<button class="btn primary" type="button" data-modal-approve-document>✓ Aprobar documento</button>':''}${hasPermission('DOCUMENTOS','RECHAZAR')?'<button class="btn danger" type="button" data-modal-reject-document>Rechazar</button>':''}`:'';
    $('#modalBody').innerHTML=`<form class="form-grid" id="resourceForm">${avisoEstadoAutomatico}${avisoDocumentoPropio}${avisoOperador}${avisoAdmin}${reviewPanel}${controls}<div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button>${approvalActions}<button class="btn primary" type="submit">Guardar registro</button></div></form>`;
    $('[data-cancel-modal]',$('#modalBody')).addEventListener('click',closeModal);
    const resourceForm=$('#resourceForm');enlazarCalendarios(resourceForm);resourceForm.addEventListener('submit',event=>saveResource(event,resource,record?.ID));if(resource==='documents'){enlazarCargaArchivo(resourceForm,'documents');const reviewValue=record?documentReviewState(record):(esAdministrador()?'Aprobado':'Pendiente de revisión');if(resourceForm.elements.ESTADO_REVISION)resourceForm.elements.ESTADO_REVISION.value=reviewValue;resourceForm.querySelector('[data-modal-approve-document]')?.addEventListener('click',()=>reviewDocument(record.ID,'APROBAR',resourceForm.querySelector('[data-modal-approve-document]')));resourceForm.querySelector('[data-modal-reject-document]')?.addEventListener('click',()=>reviewDocument(record.ID,'RECHAZAR',resourceForm.querySelector('[data-modal-reject-document]')));}
    if(resource==='documents'&&!documentoPropio){
      const aplicarAsociacion=()=>{
        const tipo=resourceForm.elements.ASOCIADO_TIPO?.value||'';
        const campoConductor=resourceForm.elements.CONDUCTOR_ASOCIADO_ID?.closest('.field');
        const campoVehiculo=resourceForm.elements.VEHICULO_SELECTOR_ID?.closest('.field');
        const campoUsuario=resourceForm.elements.USUARIO_ASOCIADO_ID?.closest('.field');
        const campoId=resourceForm.elements.ASOCIADO_ID?.closest('.field');
        campoConductor?.classList.toggle('hidden',tipo!=='Conductor');
        campoVehiculo?.classList.toggle('hidden',tipo!=='Vehículo');
        campoUsuario?.classList.toggle('hidden',tipo!=='Usuario');
        campoId?.classList.toggle('hidden',['Conductor','Usuario','Vehículo'].includes(tipo));
        if(tipo==='Conductor'){
          const driver=registroFormulario('drivers',resourceForm.elements.CONDUCTOR_ASOCIADO_ID?.value);
          if(driver){resourceForm.elements.ASOCIADO_ID.value=driver.ID;resourceForm.elements.CORREO_ASOCIADO.value=driver.CORREO||'';resourceForm.elements.IDENTIFICACION.value=driver.RUT||driver.CORREO||driver.ID;}
        }else if(tipo==='Vehículo'){
          const vehicle=registroFormulario('vehicles',resourceForm.elements.VEHICULO_SELECTOR_ID?.value);
          if(vehicle){resourceForm.elements.ASOCIADO_ID.value=vehicle.ID;resourceForm.elements.CORREO_ASOCIADO.value='';resourceForm.elements.IDENTIFICACION.value=vehicle.PATENTE||vehicle.ID;}
        }else if(tipo==='Usuario'){
          const user=registroFormulario('users',resourceForm.elements.USUARIO_ASOCIADO_ID?.value);
          if(user){resourceForm.elements.ASOCIADO_ID.value=user.ID;resourceForm.elements.CORREO_ASOCIADO.value=user.CORREO||'';resourceForm.elements.IDENTIFICACION.value=user.CORREO||user.ID;}
        }
      };
      resourceForm.elements.ASOCIADO_TIPO?.addEventListener('change',aplicarAsociacion);
      resourceForm.elements.CONDUCTOR_ASOCIADO_ID?.addEventListener('change',aplicarAsociacion);
      resourceForm.elements.VEHICULO_SELECTOR_ID?.addEventListener('change',aplicarAsociacion);
      resourceForm.elements.USUARIO_ASOCIADO_ID?.addEventListener('change',aplicarAsociacion);
      setTimeout(aplicarAsociacion,0);
    }
    // Cargar solamente las listas que realmente quedaron dibujadas en el modal.
    // En el portal del Conductor los selectores de usuarios y conductores se
    // ocultan porque la asociacion se realiza automaticamente. Intentar
    // consultarlos provocaba PERMISO_DENEGADO y deshabilitaba Guardar.
    const resources=[...new Set(
      $$('select[data-list-resource]',resourceForm)
        .map(select=>select.dataset.listResource)
        .filter(Boolean)
    )];
    prepararListasModal(token,resources);
  }


  function tiposDocumentoLote(){
    return ['SOAP','Revisión técnica','Permiso de circulación','Licencia de conducir','Certificado de gases','Seguro','Otro'];
  }

  function sugerirTipoDocumentoPorNombre(nombre=''){
    const n=String(nombre||'').toLowerCase();
    if(n.includes('soap'))return 'SOAP';
    if(n.includes('revision')||n.includes('revisión'))return 'Revisión técnica';
    if(n.includes('permiso')||n.includes('circulacion')||n.includes('circulación'))return 'Permiso de circulación';
    if(n.includes('licencia'))return 'Licencia de conducir';
    if(n.includes('gases')||n.includes('gas'))return 'Certificado de gases';
    if(n.includes('seguro'))return 'Seguro';
    return '';
  }

  function opcionesTipoDocumentoLote(seleccion=''){
    return `<option value="">Seleccione tipo</option>${tiposDocumentoLote().map(tipo=>`<option value="${esc(tipo)}" ${tipo===seleccion?'selected':''}>${esc(tipo)}</option>`).join('')}`;
  }

  function filaDocumentoLote(item,index){
    return `<article class="document-batch-row" data-doc-batch-row="${index}">
      <div class="document-batch-file"><i>▤</i><div><b>${esc(item.file.name)}</b><span>${esc(item.file.type||'Archivo')} · ${decimal(item.file.size/1048576,2)} MB</span></div><button type="button" class="btn soft small" data-doc-batch-remove="${index}">Quitar</button></div>
      <div class="document-batch-fields">
        <label class="field"><span>Tipo de documento *</span><select data-doc-batch-type required>${opcionesTipoDocumentoLote(item.tipo||'')}</select></label>
        <label class="field"><span>Fecha de emisión</span><input type="date" data-doc-batch-issue value="${esc(item.emision||'')}"></label>
        <label class="field"><span>Fecha de vencimiento *</span><input type="date" data-doc-batch-expiry value="${esc(item.vencimiento||'')}" required></label>
        <label class="field"><span>Vigencia</span><select data-doc-batch-state>${['Vigente','Por vencer','Vencido','Anulado'].map(v=>`<option ${v===(item.estado||'Vigente')?'selected':''}>${v}</option>`).join('')}</select></label>
      </div>
      <div class="document-batch-progress" data-doc-batch-progress><i>○</i><span>Pendiente de carga</span></div>
    </article>`;
  }

  function pintarArchivosDocumentoLote(form){
    const contenedor=$('[data-doc-batch-list]',form),resumen=$('[data-doc-batch-summary]',form),guardar=$('button[type="submit"]',form);
    if(!contenedor)return;
    const items=form._documentBatchFiles||[];
    contenedor.innerHTML=items.length?items.map(filaDocumentoLote).join(''):'<div class="document-batch-empty"><i>⇧</i><span>Seleccione varios PDF o imágenes para preparar la carga.</span></div>';
    if(resumen)resumen.textContent=items.length?`${number(items.length)} archivo(s) preparados. Cada archivo puede tener un tipo distinto.`:'Aún no hay archivos seleccionados.';
    if(guardar)guardar.disabled=!items.length;
    $$('[data-doc-batch-row]',contenedor).forEach(row=>{
      const index=Number(row.dataset.docBatchRow),item=items[index];if(!item)return;
      $('[data-doc-batch-type]',row)?.addEventListener('change',e=>item.tipo=e.target.value);
      $('[data-doc-batch-issue]',row)?.addEventListener('change',e=>item.emision=e.target.value);
      $('[data-doc-batch-expiry]',row)?.addEventListener('change',e=>item.vencimiento=e.target.value);
      $('[data-doc-batch-state]',row)?.addEventListener('change',e=>item.estado=e.target.value);
      $('[data-doc-batch-remove]',row)?.addEventListener('click',()=>{items.splice(index,1);pintarArchivosDocumentoLote(form);});
    });
  }

  function asociacionDocumentoLote(form){
    if(currentUser.ROL_ID==='ROL-CONDUCTOR'){
      const conductorId=String(currentUser.CONDUCTOR_ID||currentUser.conductorId||currentUser.ID||'');
      const driver=registroFormulario('drivers',conductorId)||{};
      return {ASOCIADO_TIPO:'Conductor',ASOCIADO_ID:conductorId,CONDUCTOR_ASOCIADO_ID:conductorId,USUARIO_ASOCIADO_ID:currentUser.ID||'',CORREO_ASOCIADO:currentUser.CORREO||'',IDENTIFICACION:driver.RUT||currentUser.CORREO||conductorId};
    }
    const tipo=form.elements.ASOCIADO_TIPO?.value||'';
    if(tipo==='Conductor'){
      const id=form.elements.CONDUCTOR_ASOCIADO_ID?.value||'',row=registroFormulario('drivers',id)||{};
      return {ASOCIADO_TIPO:tipo,ASOCIADO_ID:id,CONDUCTOR_ASOCIADO_ID:id,VEHICULO_SELECTOR_ID:'',USUARIO_ASOCIADO_ID:row.USUARIO_ID||'',CORREO_ASOCIADO:row.CORREO||'',IDENTIFICACION:row.RUT||row.CORREO||id};
    }
    if(tipo==='Vehículo'){
      const id=form.elements.VEHICULO_SELECTOR_ID?.value||'',row=registroFormulario('vehicles',id)||{};
      return {ASOCIADO_TIPO:tipo,ASOCIADO_ID:id,VEHICULO_SELECTOR_ID:id,CONDUCTOR_ASOCIADO_ID:'',USUARIO_ASOCIADO_ID:'',CORREO_ASOCIADO:'',IDENTIFICACION:row.PATENTE||id};
    }
    if(tipo==='Usuario'){
      const id=form.elements.USUARIO_ASOCIADO_ID?.value||'',row=registroFormulario('users',id)||{};
      return {ASOCIADO_TIPO:tipo,ASOCIADO_ID:id,CONDUCTOR_ASOCIADO_ID:'',VEHICULO_SELECTOR_ID:'',USUARIO_ASOCIADO_ID:id,CORREO_ASOCIADO:row.CORREO||'',IDENTIFICACION:row.CORREO||id};
    }
    if(tipo==='Empresa'){
      const id=String(form.elements.ASOCIADO_ID_EMPRESA?.value||currentCompany?.ID||currentCompany?.RUT||'').trim();
      return {ASOCIADO_TIPO:tipo,ASOCIADO_ID:id,CONDUCTOR_ASOCIADO_ID:'',VEHICULO_SELECTOR_ID:'',USUARIO_ASOCIADO_ID:'',CORREO_ASOCIADO:'',IDENTIFICACION:currentCompany?.RUT||id};
    }
    return {ASOCIADO_TIPO:tipo,ASOCIADO_ID:'',IDENTIFICACION:''};
  }

  async function guardarDocumentosLote(form,button){
    const items=form._documentBatchFiles||[];
    if(!items.length)throw new Error('ARCHIVO_REQUERIDO');
    const asociacion=asociacionDocumentoLote(form);
    if(!asociacion.ASOCIADO_TIPO||!asociacion.ASOCIADO_ID)throw new Error('ASOCIADO_NO_ENCONTRADO');
    items.forEach(item=>{
      if(!String(item.tipo||'').trim())throw new Error(`Seleccione el tipo de documento para ${item.file.name}.`);
      if(!String(item.vencimiento||'').trim())throw new Error(`Seleccione la fecha de vencimiento para ${item.file.name}.`);
    });
    let ok=0,fallos=0;
    for(let index=0;index<items.length;index++){
      const item=items[index],row=$(`[data-doc-batch-row="${index}"]`,form),progress=$('[data-doc-batch-progress]',row);
      try{
        if(progress){progress.className='document-batch-progress loading';progress.innerHTML=`<i></i><span>Cargando ${index+1} de ${items.length}…</span>`;}
        const isPdf=item.file.type==='application/pdf'||/\.pdf$/i.test(item.file.name||'');
        const file=await optimizarImagenArchivo(item.file),dataUrl=await leerArchivoDataUrl(file);
        const uploaded=await api.request('uploadDriveFile',{data:{DESTINO:isPdf?'DOCUMENTO_PDF':'DOCUMENTO_FOTO',NOMBRE_ARCHIVO:file.name,TIPO_MIME:file.type||(isPdf?'application/pdf':'image/jpeg'),ARCHIVO_BASE64:dataUrl,CONTEXTO:`${item.tipo} - ${asociacion.IDENTIFICACION||asociacion.ASOCIADO_ID}`,IP_PUBLICA:clientPublicIp}});
        const data={...asociacion,TIPO:item.tipo,FECHA_VENCIMIENTO:fechaVisualIso(item.vencimiento,false),ESTADO:item.estado||'Vigente',ESTADO_REVISION:esAdministrador()?'Aprobado':'Pendiente de revisión',DIRECCION_ARCHIVO:uploaded.url||uploaded.direccionArchivo||'',ARCHIVO_BUCKET:uploaded.bucket||'',ARCHIVO_RUTA:uploaded.path||'',NOMBRE_ARCHIVO:uploaded.nombre||file.name,TIPO_MIME:uploaded.tipoMime||file.type||'',TAMANO_BYTES:uploaded.tamanoBytes||file.size||0,OBSERVACIONES:String(form.elements.OBSERVACIONES_LOTE?.value||'').trim()};
        if(item.emision)data.FECHA_EMISION=fechaVisualIso(item.emision,false);
        const result=await api.request('create',{resource:'documents',data});
        if(result?.row?.ID)guardarRegistro('documents',result.row);
        item.guardado=true;ok++;
        if(progress){progress.className='document-batch-progress ready';progress.innerHTML='<i>✓</i><span>Documento cargado correctamente</span>';}
      }catch(error){
        fallos++;item.error=translateError(error);
        if(progress){progress.className='document-batch-progress error';progress.innerHTML=`<i>!</i><span>${esc(item.error)}</span>`;}
      }
    }
    invalidarListasFormulario('documents','notifications');cacheVistasModulo.delete('documents');
    if(fallos===0){closeModal();toast('Carga múltiple completada',`${ok} documento(s) quedaron registrados correctamente.`);await actualizarSeccionEnSegundoPlano('documents');setTimeout(()=>refreshNotificationBadge(),500);return;}
    toast('Carga múltiple finalizada',`${ok} documento(s) cargados · ${fallos} con error. Puede corregir y volver a intentar los pendientes.`,'warning');
    form._documentBatchFiles=items.filter(item=>!item.guardado);pintarArchivosDocumentoLote(form);
  }

  function pintarModalCargaDocumentosLote(prefill={},token){
    if(token!==secuenciaModal)return;
    $('#modalEyebrow').textContent='DOCUMENTACIÓN';$('#modalTitle').textContent='Carga múltiple de documentos';
    const conductor=currentUser.ROL_ID==='ROL-CONDUCTOR';
    const asociadoTipo=prefill.ASOCIADO_TIPO||(conductor?'Conductor':'');
    const conductorId=prefill.CONDUCTOR_ASOCIADO_ID||prefill.ASOCIADO_ID||'';
    const vehiculoId=prefill.VEHICULO_SELECTOR_ID||prefill.VEHICULO_ASOCIADO_ID||'';
    const usuarioId=prefill.USUARIO_ASOCIADO_ID||'';
    const association=conductor
      ? `<div class="tracking-notice active full"><i>✓</i><div><b>Documentos personales</b><span>Todos los archivos del lote se asociarán automáticamente a su cuenta y ficha de Conductor.</span></div></div>`
      : `<label class="field"><span>Asociado a *</span><select name="ASOCIADO_TIPO" required><option value="">Seleccione</option>${['Conductor','Vehículo','Usuario','Empresa'].map(v=>`<option ${v===asociadoTipo?'selected':''}>${v}</option>`).join('')}</select></label>
         <label class="field" data-doc-association-driver><span>Conductor</span>${selectorDinamico('drivers','drivers','CONDUCTOR_ASOCIADO_ID',conductorId,false)}</label>
         <label class="field hidden" data-doc-association-vehicle><span>Vehículo</span>${selectorDinamico('vehicles','vehicles','VEHICULO_SELECTOR_ID',vehiculoId,false)}</label>
         <label class="field hidden" data-doc-association-user><span>Usuario</span>${selectorDinamico('users','users','USUARIO_ASOCIADO_ID',usuarioId,false)}</label>
         <label class="field hidden" data-doc-association-company><span>ID / RUT empresa</span><input name="ASOCIADO_ID_EMPRESA" value="${esc(prefill.ASOCIADO_ID||currentCompany?.ID||currentCompany?.RUT||'')}" readonly></label>`;
    $('#modalBody').innerHTML=`<form id="documentBatchForm" class="form-grid document-batch-form">${association}
      <div class="field full"><span>Archivos *</span><label class="drive-file-picker document-batch-picker"><input type="file" data-doc-batch-file accept="image/*,application/pdf,.pdf" multiple><i>⇧</i><span><b>Elegir varios documentos</b><small>Seleccione PDF o imágenes. Máximo 12 MB por archivo. Si ya existe el mismo tipo para ese conductor o vehículo, el nuevo reemplazará al anterior.</small></span></label></div>
      <div class="document-batch-summary full" data-doc-batch-summary>Aún no hay archivos seleccionados.</div>
      <div class="document-batch-list full" data-doc-batch-list></div>
      <label class="field full"><span>Observación común del lote</span><textarea name="OBSERVACIONES_LOTE" maxlength="3000" placeholder="Opcional: comentario que se aplicará a todos los documentos de esta carga."></textarea></label>
      <div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn primary" type="submit" disabled>Guardar documentos</button></div>
    </form>`;
    const form=$('#documentBatchForm');form._documentBatchFiles=[];
    $('[data-cancel-modal]',form).addEventListener('click',closeModal);
    const input=$('[data-doc-batch-file]',form);
    input.addEventListener('change',()=>{
      const seleccion=[...(input.files||[])].slice(0,25),validos=[],rechazados=[];
      seleccion.forEach(file=>{const permitido=file.type.startsWith('image/')||file.type==='application/pdf'||/\.pdf$/i.test(file.name||'');if(!permitido||file.size>12582912)rechazados.push(file.name);else validos.push({file,tipo:sugerirTipoDocumentoPorNombre(file.name),emision:'',vencimiento:'',estado:'Vigente'});});
      form._documentBatchFiles=validos;pintarArchivosDocumentoLote(form);
      if(rechazados.length)toast('Algunos archivos no se agregaron',`${rechazados.length} archivo(s) no cumplen formato o tamaño máximo de 12 MB.`,'warning');
      if((input.files||[]).length>25)toast('Máximo por lote','Se prepararon los primeros 25 archivos.','warning');
    });
    const aplicarAsociacion=()=>{
      if(conductor)return;
      const tipo=form.elements.ASOCIADO_TIPO?.value||'';
      $('[data-doc-association-driver]',form)?.classList.toggle('hidden',tipo!=='Conductor');
      $('[data-doc-association-vehicle]',form)?.classList.toggle('hidden',tipo!=='Vehículo');
      $('[data-doc-association-user]',form)?.classList.toggle('hidden',tipo!=='Usuario');
      $('[data-doc-association-company]',form)?.classList.toggle('hidden',tipo!=='Empresa');
    };
    form.elements.ASOCIADO_TIPO?.addEventListener('change',aplicarAsociacion);aplicarAsociacion();
    form.addEventListener('submit',event=>{event.preventDefault();const button=$('button[type="submit"]',form);conCargaBoton(button,'Cargando documentos…',async()=>{try{await guardarDocumentosLote(form,button);}catch(error){toast('No se pudo iniciar la carga',translateError(error),'error');}});});
    const resources=conductor?['drivers']:['drivers','vehicles','users'];prepararListasModal(token,resources);
    pintarArchivosDocumentoLote(form);
  }

  function openResourceModal(resource,record=null,id='') {
    const definition=resourceFields[resource];if(!definition)return;
    $('#modalEyebrow').textContent=definition.eyebrow;
    $('#modalTitle').textContent=`${id||record?'Editar':'Nuevo'} ${definition.title.toLowerCase()}`;
    if(!record&&id)$('#modalBody').innerHTML=contenidoCargaModal('Cargando el registro…');
    const token=openModal();
    if(resource==='documents'&&!id&&!(record&&record.ID)){pintarModalCargaDocumentosLote(record||{},token);return;}
    if(record||!id){pintarModalRecurso(resource,record,token);return;}
    api.request('get',{resource,id})
      .then(result=>{
        const row=guardarRegistro(resource,result.row);
        if(!row)throw new Error('REGISTRO_NO_ENCONTRADO');
        pintarModalRecurso(resource,row,token);
      })
      .catch(error=>{
        if(token!==secuenciaModal)return;
        $('#modalBody').innerHTML=`<div class="modal-error"><b>No se pudo cargar el registro</b><p>${esc(translateError(error))}</p><button class="btn soft" type="button" data-cancel-modal>Cerrar</button></div>`;
        $('[data-cancel-modal]',$('#modalBody')).addEventListener('click',closeModal);
      });
  }


  async function openDriverDocumentsModal(id,button){
    if(!id)return;
    await conCargaBoton(button,'Cargando…',async()=>{
      try{
        const result=await api.request('documentosConductor',{data:{CONDUCTOR_ID:id}}),driver=result.conductor||registroFormulario('drivers',id)||{},rows=result.rows||[];
        const body=rows.length?rows.map(documentRows).join(''):`<tr><td colspan="7"><span class="muted">Este conductor aún no tiene documentos digitalizados.</span></td></tr>`;
        $('#modalEyebrow').textContent='EXPEDIENTE DIGITAL';$('#modalTitle').textContent=driver.NOMBRE?`Documentos de ${driver.NOMBRE}`:'Documentos del conductor';
        $('#modalBody').innerHTML=`<div class="form-grid"><div class="tracking-notice active full"><i>▤</i><div><b>${esc(driver.ID||id)} · ${esc(driver.NOMBRE||'Conductor')}</b><span>${esc(driver.RUT||driver.CORREO||'')} · ${number(rows.length)} documento(s) asociado(s)</span></div></div><div class="full">${table(['Documento','Asociación','Identificación','Vencimiento','Revisión','Adjunto','Acciones'],body,'Sin documentos digitalizados.')}</div><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cerrar</button>${hasPermission('DOCUMENTOS','CREAR')?'<button class="btn primary" type="button" data-driver-add-document>＋ Cargar documento</button>':''}</div></div>`;
        openModal();$('[data-cancel-modal]',$('#modalBody')).addEventListener('click',closeModal);
        $$('[data-view-document]',$('#modalBody')).forEach(btn=>btn.addEventListener('click',()=>abrirVisorDocumento(btn.dataset.viewDocument)));
        $$('[data-approve-document]',$('#modalBody')).forEach(btn=>btn.addEventListener('click',()=>reviewDocument(btn.dataset.approveDocument,'APROBAR',btn)));
        $$('[data-reject-document]',$('#modalBody')).forEach(btn=>btn.addEventListener('click',()=>reviewDocument(btn.dataset.rejectDocument,'RECHAZAR',btn)));
        $('[data-driver-add-document]',$('#modalBody'))?.addEventListener('click',()=>{closeModal();openResourceModal('documents',{ASOCIADO_TIPO:'Conductor',CONDUCTOR_ASOCIADO_ID:id,ASOCIADO_ID:id,IDENTIFICACION:driver.RUT||driver.CORREO||id,CORREO_ASOCIADO:driver.CORREO||''});});
      }catch(error){toast('No se pudieron abrir los documentos',translateError(error),'error');}
    });
  }

  async function openDriverOccupationModal(id,button){
    if(!id)return;
    await conCargaBoton(button,'Revisando…',async()=>{
      try{
        const result=await api.request('diagnoseAvailability',{data:{CONDUCTOR_ID:id}});
        const driver=result.conductor||registroFormulario('drivers',id)||{};
        const operations=result.operacionesActivas||[],routes=result.rutasActivas||[];
        const operationRows=operations.length?operations.map(op=>`<tr><td><strong>${esc(op.ID||'—')}</strong></td><td>${esc(op.ESTADO||'Activa')}</td><td>${esc(op.VEHICULO_ID||'—')}</td><td>${esc(op.RUTA_ID||'Sin ruta')}</td></tr>`).join(''):`<tr><td colspan="4"><span class="muted">No existen operaciones activas.</span></td></tr>`;
        const routeRows=routes.length?routes.map(route=>`<tr><td><strong>${esc(route.ID||'—')}</strong></td><td>${esc(route.ESTADO||'En curso')}</td><td>${esc(route.VEHICULO_ID||'—')}</td><td>${esc(route.OPERACION_ID||'Sin operación')}</td></tr>`).join(''):`<tr><td colspan="4"><span class="muted">No existen rutas activas.</span></td></tr>`;
        $('#modalEyebrow').textContent='DISPONIBILIDAD';
        $('#modalTitle').textContent=driver.NOMBRE?`Ocupación de ${driver.NOMBRE}`:'Ocupación del conductor';
        $('#modalBody').innerHTML=`<div class="form-grid"><div class="tracking-notice ${result.ocupado?'blocked':'active'} full"><i>${result.ocupado?'!':'✓'}</i><div><b>Estado calculado: ${esc(result.estadoCalculado||driver.ESTADO||'Disponible')}</b><span>${esc(result.mensaje||'')}</span></div></div><div class="full"><h3>Operaciones activas</h3>${table(['Operación','Estado','Vehículo','Ruta'],operationRows)}</div><div class="full"><h3>Rutas activas</h3>${table(['Ruta','Estado','Vehículo','Operación'],routeRows)}</div><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cerrar</button>${!result.ocupado?'<button class="btn primary" type="button" data-refresh-driver-state>✓ Actualizar conductor</button>':''}</div></div>`;
        openModal();
        $('[data-cancel-modal]',$('#modalBody')).addEventListener('click',closeModal);
        $('[data-refresh-driver-state]',$('#modalBody'))?.addEventListener('click',async()=>{invalidarListasFormulario('drivers');cacheVistasModulo.delete('drivers');closeModal();await actualizarSeccionEnSegundoPlano('drivers');toast('Estado actualizado','El conductor quedó sincronizado con sus rutas y operaciones actuales.');});
      }catch(error){toast('No se pudo revisar la ocupación',translateError(error),'error');}
    });
  }

  async function saveResource(event,resource,id){
    event.preventDefault();const form=event.currentTarget,button=$('button[type="submit"]',form);
    await conCargaBoton(button,form._driveUploadPromise?'Esperando archivo…':'Guardando…',async()=>{
      try{
        await esperarCargaArchivo(form);const data=Object.fromEntries(new FormData(form).entries());const fechas=new Set((resourceFields[resource]?.fields||[]).filter(field=>field[2]==='date').map(field=>field[0]));Object.keys(data).forEach(key=>{if(data[key]===''||data[key] instanceof File)delete data[key];else if(fechas.has(key))data[key]=fechaVisualIso(data[key],false)});
        setSave('Guardando…','saving');const result=await api.request(id?'update':'create',{resource,id,data});
        if(resource==='users'&&api.isRemote()&&(result?.persistenciaConfirmada!==true||!result?.row?.ID))throw new Error('USUARIO_NO_CONFIRMADO');
        if(result?.row?.ID)guardarRegistro(resource,result.row);
        invalidarListasFormulario(resource);cacheVistasModulo.delete(currentSection);closeModal();
        if(resource==='documents'&&!id&&esAdministrador())toast('Documento aprobado','Quedó guardado y aprobado automáticamente.');else if(resource==='documents'&&!id&&['ROL-CONDUCTOR','ROL-SUPERVISOR'].includes(currentUser.ROL_ID))toast('Documento enviado','Quedó pendiente de aprobación por Operador, Administración o Gerencia.');
        else if(resource==='users')toast(id?'Usuario actualizado':'Usuario creado',id?`${result.row.NOMBRE||result.row.CORREO||'La cuenta'} se actualizó correctamente.`:`${result.row.NOMBRE||result.row.CORREO||'La cuenta'} se creó correctamente.`);
        else toast('Registro guardado','La información quedó almacenada.');
        setSave('Datos guardados');await actualizarSeccionEnSegundoPlano(currentSection);
      }catch(error){setSave('Error al guardar','error');toast('No se pudo guardar',translateError(error),'error');}
    });
  }


  async function reviewDocument(id,decision,button){
    if(!id)return;
    const approve=decision==='APROBAR';
    let observation='';
    if(!approve){observation=prompt('Escriba el motivo del rechazo:','')||'';if(observation.trim().length<5){toast('Motivo requerido','Debe indicar por qué se rechaza el documento.','warning');return;}}
    if(approve&&!confirm('¿Aprobar este documento? El usuario será notificado.'))return;
    await conCargaBoton(button,approve?'Aprobando…':'Rechazando…',async()=>{
      try{
        const action=approve?'approveDocument':'rejectDocument';
        const result=await api.request(action,{data:{DOCUMENTO_ID:id,OBSERVACION_REVISION:observation}});
        if(result?.persistenciaConfirmada!==true||!result?.row?.ID)throw new Error('DOCUMENTO_REVISION_NO_CONFIRMADA');
        guardarRegistro('documents',result.row);invalidarListasFormulario('documents','notifications');cacheVistasModulo.delete('documents');closeModal();
        toast(approve?'Documento aprobado':'Documento rechazado',approve?'El documento quedó aprobado correctamente.':'La decisión quedó registrada y el usuario fue notificado.',approve?'success':'warning');
        await actualizarSeccionEnSegundoPlano('documents');setTimeout(()=>refreshNotificationBadge(),500);
      }catch(error){toast(approve?'No se pudo aprobar':'No se pudo rechazar',translateError(error),'error');}
    });
  }

  async function deleteRecord(value,button){
    const [resource,id]=value.split(':');
    if(resource==='documents'&&(!puedeEliminarDocumentosPorRol()||!hasPermission('DOCUMENTOS','ELIMINAR')))return toast('Acceso restringido','Este usuario no tiene permiso para eliminar documentos.','error');
    const pregunta=resource==='users'?'¿Desactivar este usuario? Se cerrarán sus sesiones y conservará la trazabilidad.':resource==='documents'?'¿Eliminar este documento? El registro quedará eliminado y, cuando corresponda, también se retirará su archivo privado del almacenamiento.':'¿Eliminar este registro? Quedará desactivado en la base de datos.';
    if(!confirm(pregunta))return;
    await conCargaBoton(button,'Eliminando…',async()=>{
      try{
        const result=await api.request('delete',{resource,id});
        if(resource==='users'&&api.isRemote()&&result?.persistenciaConfirmada!==true)throw new Error('USUARIO_NO_CONFIRMADO');
        invalidarListasFormulario(resource);cacheVistasModulo.delete(currentSection);
        toast(resource==='users'?'Usuario desactivado':resource==='documents'?'Documento eliminado':'Registro eliminado',resource==='users'?'La cuenta fue desactivada y sus sesiones quedaron cerradas.':resource==='documents'?'El documento fue retirado del expediente y la acción quedó registrada en auditoría.':'La eliminación lógica quedó confirmada.');
        await actualizarSeccionEnSegundoPlano(currentSection);
      }catch(error){toast('No se pudo eliminar',translateError(error),'error');}
    });
  }
  function textoCeldaFiltro(cell){return String(cell?.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();}
  function fechaFiltroTexto(value){
    const text=String(value||'').trim();if(!text)return NaN;
    const direct=new Date(text).getTime();if(Number.isFinite(direct))return direct;
    const match=text.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:[^\d]+(\d{1,2}):(\d{2}))?/);
    if(!match)return NaN;
    return new Date(Number(match[3]),Number(match[2])-1,Number(match[1]),Number(match[4]||0),Number(match[5]||0)).getTime();
  }
  function tablaRelacionadaFiltro(node){
    const card=node.closest('.card')||node.closest('section')||$('#content');
    return card?.querySelector('table')||null;
  }
  function aplicarFiltrosTabla(table){
    if(!table)return;
    const wrap=table.closest('.table-wrap'),panel=wrap?.previousElementSibling?.matches?.('[data-advanced-filter-panel]')?wrap.previousElementSibling:null;
    const card=table.closest('.card')||$('#content');
    const general=card?.querySelector('[data-table-search]')?.value.trim().toLowerCase()||'';
    const routeState=card?.querySelector('[data-route-state-filter]')?.value||'';
    const fieldIndex=Number(panel?.querySelector('[data-filter-column]')?.value??-1);
    const fieldValue=panel?.querySelector('[data-filter-value]')?.value.trim().toLowerCase()||'';
    const dateIndex=Number(panel?.querySelector('[data-filter-date-column]')?.value??-1);
    const fromValue=panel?.querySelector('[data-filter-from]')?.value||'';
    const toValue=panel?.querySelector('[data-filter-to]')?.value||'';
    const from=fromValue?new Date(fromValue+'T00:00:00').getTime():NaN;
    const to=toValue?new Date(toValue+'T23:59:59.999').getTime():NaN;
    const rows=[...table.querySelectorAll('tbody tr')].filter(row=>row.querySelectorAll('td').length>1||row.dataset.searchRow);
    let visible=0;
    rows.forEach(row=>{
      const cells=[...row.children];
      const searchable=(row.dataset.searchRow||textoCeldaFiltro(row));
      const matchGeneral=!general||searchable.includes(general);
      const matchField=!fieldValue||fieldIndex<0||textoCeldaFiltro(cells[fieldIndex]).includes(fieldValue);
      const matchRouteState=!routeState||String(row.dataset.routeFilterState||'')===routeState;
      let rowDate=fechaFiltroTexto(row.dataset.filterDate);
      if(!Number.isFinite(rowDate)&&dateIndex>=0)rowDate=fechaFiltroTexto(cells[dateIndex]?.textContent);
      if(!Number.isFinite(rowDate)){
        for(const cell of cells){rowDate=fechaFiltroTexto(cell.textContent);if(Number.isFinite(rowDate))break;}
      }
      const matchFrom=!Number.isFinite(from)||(Number.isFinite(rowDate)&&rowDate>=from);
      const matchTo=!Number.isFinite(to)||(Number.isFinite(rowDate)&&rowDate<=to);
      const show=matchGeneral&&matchField&&matchRouteState&&matchFrom&&matchTo;
      row.hidden=!show;row.style.display=show?'':'none';if(show)visible++;
    });
    const count=panel?.querySelector('[data-filter-count]');if(count)count.textContent=`${visible} de ${rows.length} registros`;
  }
  function limpiarFiltrosTabla(table){
    if(!table)return;const wrap=table.closest('.table-wrap'),panel=wrap?.previousElementSibling;
    const card=table.closest('.card')||$('#content');const general=card?.querySelector('[data-table-search]');if(general)general.value='';
    const routeState=card?.querySelector('[data-route-state-filter]');if(routeState)routeState.selectedIndex=0;
    panel?.querySelectorAll('input').forEach(input=>input.value='');panel?.querySelectorAll('select').forEach(select=>select.selectedIndex=0);aplicarFiltrosTabla(table);
  }
  function configurarFiltrosAvanzados(){
    $$('.table-wrap table',$('#content')).forEach(table=>{
      const wrap=table.closest('.table-wrap');if(!wrap||wrap.dataset.filtersReady==='1')return;wrap.dataset.filtersReady='1';
      const headers=[...table.querySelectorAll('thead th')].map(th=>String(th.textContent||'').replace(/\s+/g,' ').trim());
      const usable=headers.map((label,index)=>({label,index})).filter(item=>item.label&&!/acciones?|decisión|navegación/i.test(item.label));
      const dateColumns=usable.filter(item=>/fecha|inicio|fin|asignaci|vencimiento|vigente|último acceso|emisión|programada|realizada/i.test(item.label));
      const panel=document.createElement('div');panel.className='advanced-filter-panel';panel.dataset.advancedFilterPanel='1';
      panel.innerHTML=`<label><span>Campo específico</span><select data-filter-column><option value="-1">Todos los campos</option>${usable.map(item=>`<option value="${item.index}">${esc(item.label)}</option>`).join('')}</select></label><label><span>Valor a buscar</span><input data-filter-value placeholder="Escriba el valor del campo"></label><label><span>Campo de fecha</span><select data-filter-date-column><option value="-1">Fecha asociada</option>${dateColumns.map(item=>`<option value="${item.index}">${esc(item.label)}</option>`).join('')}</select></label><label><span>Fecha desde</span><input data-filter-from type="date"></label><label><span>Fecha hasta</span><input data-filter-to type="date"></label><button class="btn soft small" type="button" data-clear-table-filters>Limpiar filtros</button><small data-filter-count></small>`;
      wrap.before(panel);
      panel.querySelectorAll('input,select').forEach(control=>control.addEventListener(control.tagName==='SELECT'?'change':'input',()=>aplicarFiltrosTabla(table)));
      panel.querySelector('[data-clear-table-filters]').addEventListener('click',()=>limpiarFiltrosTabla(table));
      const card=table.closest('.card')||$('#content'),search=card?.querySelector('[data-table-search]');if(search&&!search.dataset.advancedBound){search.dataset.advancedBound='1';search.addEventListener('input',()=>aplicarFiltrosTabla(table));}
      const routeState=card?.querySelector('[data-route-state-filter]');if(routeState&&!routeState.dataset.advancedBound){routeState.dataset.advancedBound='1';routeState.addEventListener('change',()=>aplicarFiltrosTabla(table));}
      aplicarFiltrosTabla(table);
    });
  }
  function filterTable(input){aplicarFiltrosTabla(tablaRelacionadaFiltro(input));}

  function permissionMatrixMarkup(user){
    const admin=String(user.ROL_ID||user.ROL_NOMBRE||'').toUpperCase()==='ROL-ADMIN'||String(user.ROL_NOMBRE||'').toUpperCase()==='ADMINISTRADOR';
    const modo=String(user.MODO_PERMISOS||'ROL').toUpperCase()==='PERSONALIZADO'?'PERSONALIZADO':'ROL';
    const matrizActual=normalizarMatrizPermisosUsuario(user,'MATRIZ_PERMISOS');
    const mandatory=new Set(['PANEL_PRINCIPAL:LEER','CONEXIONES:CREAR','CONEXIONES:ACTUALIZAR']);
    return `<div class="permission-help"><b>${admin?'Administrador con acceso completo':'Permisos de '+esc(user.NOMBRE)}</b><span>${admin?'Los permisos del administrador no pueden reducirse para evitar perder el control del sistema. Todos sus checkbox permanecen marcados.':'Cada casilla es editable. Si modifica una casilla mientras está usando permisos del rol, el sistema cambia automáticamente a Personalizado. Marcada = permiso activo; vacía = sin permiso.'}</span></div><form id="userPermissionsForm" class="permission-form"><input type="hidden" name="USUARIO_ID" value="${esc(user.ID)}"><div class="permission-mode"><label><input type="radio" name="MODO_PERMISOS" value="ROL" ${modo==='ROL'||admin?'checked':''} ${admin?'disabled':''}><span>Usar permisos del rol</span></label><label><input type="radio" name="MODO_PERMISOS" value="PERSONALIZADO" ${modo==='PERSONALIZADO'&&!admin?'checked':''} ${admin?'disabled':''}><span>Personalizar permisos</span></label></div><div class="permission-boolean-legend"><span><i class="permission-legend-check">✓</i> Marcado = true</span><span><i class="permission-legend-empty"></i> Vacío = false</span></div><div class="permission-matrix ${!admin?'enabled':''}" data-permission-matrix><div class="permission-row permission-head"><b>Módulo</b>${permissionActions.map(([,label])=>`<b>${label}</b>`).join('')}</div>${permissionCatalog.map(([module,label])=>`<div class="permission-row"><span>${esc(label)}</span>${permissionActions.map(([action])=>{const value=`${module}:${action}`,required=mandatory.has(value),active=admin||required||matrizActual[value]===true;return `<label class="permission-cell" data-action-label="${esc(permissionActions.find(([clave])=>clave===action)?.[1]||action)}" title="${required?'Permiso técnico obligatorio':active?'Permiso activo (true)':'Sin permiso (false)'}"><input type="checkbox" name="PERMISOS" value="${value}" data-obligatorio="${required?'1':'0'}" data-valor-booleano="${active?'true':'false'}" aria-checked="${active?'true':'false'}" ${active?'checked':''} ${admin||required?'disabled':''}><i></i></label>`;}).join('')}</div>`).join('')}<div class="permission-button-section"><div class="permission-button-heading"><b>Botones y acciones específicas</b><span>Estos controles habilitan cada botón del sistema de forma independiente.</span></div><div class="permission-button-grid">${buttonPermissionCatalog.map(([module,action,label])=>{const value=`${module}:${action}`,active=admin||matrizActual[value]===true;return `<label class="permission-button-item" title="${active?'Botón habilitado':'Botón bloqueado'}"><input type="checkbox" name="PERMISOS" value="${value}" data-valor-booleano="${active?'true':'false'}" aria-checked="${active?'true':'false'}" ${active?'checked':''} ${admin?'disabled':''}><span><b>${esc(label)}</b><small>${esc(module.replaceAll('_',' '))}</small></span></label>`;}).join('')}</div></div></div><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn primary" type="submit" ${admin?'disabled':''}>Guardar permisos sin cerrar sesión</button></div></form>`;
  }

  async function openUserPermissionsModal(userId){
    let user=registroFormulario('users',userId);
    if(!user){toast('Usuario no disponible','Sincronice la lista e intente nuevamente.','error');return;}
    $('#modalEyebrow').textContent='CONTROL DE ACCESO';
    $('#modalTitle').textContent='Permisos del usuario';
    $('#modalBody').innerHTML='<div class="module-loading"><span></span><b>Cargando permisos guardados…</b><small>Consultando valores true y false directamente en la base.</small></div>';
    openModal();
    try{
      const fresh=await api.request('get',{resource:'users',id:userId,force:true,cache:false});
      if(fresh?.row){user=fresh.row;guardarRegistro('users',user);}
    }catch(error){
      closeModal();toast('No se pudieron leer los permisos',translateError(error),'error');return;
    }
    $('#modalBody').innerHTML=permissionMatrixMarkup(user);
    const form=$('#userPermissionsForm'),matrix=$('[data-permission-matrix]',form);$('[data-cancel-modal]',form).onclick=closeModal;
    const matrizRol=normalizarMatrizPermisosUsuario(user,'MATRIZ_PERMISOS_ROL');
    const matrizPersonalizada=normalizarMatrizPermisosUsuario(user,'MATRIZ_PERMISOS_PERSONALIZADOS');
    const modoOriginal=String(user.MODO_PERMISOS||'ROL').toUpperCase();
    const tienePersonalizados=normalizarPermisosVisualesUsuario(user).some(clave=>!['PANEL_PRINCIPAL:LEER','CONEXIONES:CREAR','CONEXIONES:ACTUALIZAR'].includes(clave));
    let personalizadoInicializado=modoOriginal==='PERSONALIZADO'&&tienePersonalizados;
    $$('input[name="MODO_PERMISOS"]',form).forEach(radio=>radio.addEventListener('change',()=>{
      const personalizado=radio.value==='PERSONALIZADO'&&radio.checked;
      matrix.classList.toggle('enabled',true);
      if(personalizado&&!personalizadoInicializado){aplicarMatrizCheckboxPermisos(form,matrizRol);personalizadoInicializado=true;toast('Modo personalizado activo','Partimos desde los permisos actuales del rol. Ahora cada casilla que cambie será guardada como personalizada.');}
      else aplicarMatrizCheckboxPermisos(form,personalizado?matrizPersonalizada:matrizRol);
    }));
    form.querySelectorAll('input[name="PERMISOS"]').forEach(input=>input.addEventListener('change',()=>{
      if(input.disabled)return;
      const radioPersonalizado=form.querySelector('input[name="MODO_PERMISOS"][value="PERSONALIZADO"]');
      if(radioPersonalizado&&!radioPersonalizado.checked){
        // El clic del usuario es la intención explícita de personalizar. No se
        // reconstruye la matriz aquí para no deshacer la casilla recién pulsada.
        radioPersonalizado.checked=true;personalizadoInicializado=true;matrix.classList.add('enabled');
      }
      input.dataset.valorBooleano=input.checked?'true':'false';input.setAttribute('aria-checked',input.checked?'true':'false');
    }));
    form.onsubmit=async event=>{
      event.preventDefault();
      const button=$('button[type="submit"]',form),mode=form.elements.MODO_PERMISOS.value;
      const permissions=[...form.querySelectorAll('input[name="PERMISOS"]:checked')].filter(input=>!input.disabled).map(input=>input.value);
      await conCargaBoton(button,'Guardando y verificando…',async()=>{
        try{
          const result=await api.request('saveUserPermissions',{data:{USUARIO_ID:userId,MODO_PERMISOS:mode,PERMISOS:permissions,INICIALIZAR_DESDE_ROL:'NO'}});
          if(api.isRemote()&&result.persistenciaConfirmada!==true)throw new Error('PERMISOS_USUARIO_NO_CONFIRMADOS');
          api.invalidate({actions:['me','dashboard'],resources:['users','audit']});
          // flotas-api ya releyó y comparó la fila dentro de la misma transacción lógica.
          // Evitamos una segunda consulta que podría fallar si el usuario se retiró
          // a sí mismo el permiso USUARIOS:LEER justo en este guardado.
          const confirmed=result.row;
          if(!confirmed?.ID||result?.verificacion?.coincide===false)throw new Error('PERMISOS_USUARIO_NO_CONFIRMADOS');
          const confirmedMode=String(confirmed.MODO_PERMISOS||'ROL').toUpperCase();
          const customSaved=new Set(Array.isArray(confirmed.PERMISOS_PERSONALIZADOS)?confirmed.PERMISOS_PERSONALIZADOS:[]);
          const expected=new Set(mode==='PERSONALIZADO'?permissions:[]);
          const exact=confirmedMode===mode&&expected.size===customSaved.size&&[...expected].every(key=>customSaved.has(key));
          if(!exact)throw new Error('PERMISOS_USUARIO_NO_PERSISTIERON');
          guardarRegistro('users',confirmed);cacheVistasModulo.delete('users');
          if(currentUser.ID===userId){currentUser=confirmed;const auth=api.getAuth();api.setAuth({...auth,user:confirmed});postParent({tipo:'flotas:modulo-listo',usuario:confirmed,seccion:currentSection});}
          $('#modalBody').innerHTML=permissionMatrixMarkup(confirmed);
          const total=mode==='PERSONALIZADO'?customSaved.size:Object.values(normalizarMatrizPermisosUsuario(confirmed,'MATRIZ_PERMISOS')).filter(Boolean).length;
          toast('Permisos confirmados en la base',`${total} permisos ${mode==='PERSONALIZADO'?'personalizados':'del rol'} activos. Versión ${number(confirmed.VERSION_PERMISOS||0)}.`);
          await actualizarSeccionEnSegundoPlano('users');setTimeout(()=>closeModal(),500);
        }catch(error){toast('Los permisos no quedaron confirmados',translateError(error),'error');}
      });
    };
  }


  function vozNativaDisponible(){
    try{return Boolean(window.AndroidConfig&&typeof window.AndroidConfig.esVozNativaDisponible==='function'&&window.AndroidConfig.esVozNativaDisponible());}
    catch(_){return false;}
  }
  function reconocimientoDisponible(){return vozNativaDisponible()?'ANDROID':(window.SpeechRecognition||window.webkitSpeechRecognition||null);}
  function actualizarEstadoVoz(texto){const element=$('#voiceCommandStatus');if(element)element.textContent=texto;}
  function hablar(texto){
    if(vozNativaDisponible()){
      try{window.AndroidConfig.hablarTexto(String(texto||''));return true;}catch(_){}
    }
    if(!('speechSynthesis'in window)){toast('Lectura de voz no disponible','Este dispositivo no permite reproducir notificaciones por voz.','error');return false;}
    window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(String(texto||''));utterance.lang='es-CL';utterance.rate=1;utterance.pitch=1;window.speechSynthesis.speak(utterance);return true;
  }
  function detenerVoz(){
    try{reconocimientoVoz?.stop();}catch(_){}
    try{window.AndroidConfig?.detenerVozNativa?.();}catch(_){}
    if('speechSynthesis'in window)window.speechSynthesis.cancel();
    if(dictadoNativoPendiente){dictadoNativoPendiente.boton.textContent=dictadoNativoPendiente.original;dictadoNativoPendiente.boton.classList.remove('listening');dictadoNativoPendiente=null;}
    vozEscuchando=false;actualizarEstadoVoz('Control de voz detenido.');
  }
  function notificacionesActuales(){return (cacheListasFormulario.get('notifications')||[]).slice().sort((a,b)=>new Date(b.FECHA_ENVIO||0)-new Date(a.FECHA_ENVIO||0));}
  function leerNotificacionesVoz(){const unread=deduplicarAvisos(notificacionesActuales().filter(item=>item.LEIDA!=='SI'),'notification');if(!unread.length){hablar('No tiene notificaciones pendientes.');actualizarEstadoVoz('No hay notificaciones pendientes.');return;}const limit=unread.slice(0,10),text=`Tiene ${unread.length} notificaciones pendientes. `+limit.map((item,index)=>`Notificación ${index+1}. ${item.TITULO}. ${item.MENSAJE}`).join('. ');hablar(text);actualizarEstadoVoz(`Leyendo ${limit.length} de ${unread.length} notificaciones pendientes.`);}
  async function marcarTodasNotificacionesLeidas(){const pendientes=notificacionesActuales().filter(item=>item.LEIDA!=='SI'),unread=pendientes.filter(item=>!esAvisoAsignacion(item));if(!unread.length){hablar(pendientes.length?'Las asignaciones pendientes deben aceptarse individualmente.':'No hay notificaciones pendientes.');if(pendientes.length)toast('Asignaciones protegidas','Las alertas de ruta u operación permanecen pendientes hasta presionar Aceptar.');return;}actualizarEstadoVoz('Marcando notificaciones como leídas…');for(const item of unread){await api.request('readNotification',{id:item.ID});}invalidarListasFormulario('notifications');cacheVistasModulo.delete('notifications');cacheVistasModulo.delete('dashboard');await refreshNotificationBadge();hablar(`${unread.length} notificaciones fueron marcadas como leídas.`);toast('Notificaciones actualizadas',`${unread.length} mensajes marcados como leídos.${pendientes.length>unread.length?' Las asignaciones siguen pendientes.':''}`);actualizarSeccionEnSegundoPlano('notifications');}
  async function ejecutarComandoVoz(transcript){const command=String(transcript||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();actualizarEstadoVoz(`Comando detectado: “${transcript}”`);if(/detener|parar|silencio/.test(command)){detenerVoz();return;}if(/leer.*(notificacion|pendiente)|notificacion.*leer/.test(command)){leerNotificacionesVoz();return;}if(/marcar.*todas.*leida/.test(command)){await marcarTodasNotificacionesLeidas();return;}if(/crear|nueva|enviar/.test(command)&&/notificacion|mensaje/.test(command)){openNotificationModal();hablar('Formulario de notificación abierto. Puede usar los micrófonos para dictar el título y el mensaje.');return;}hablar('Comando no reconocido. Diga leer notificaciones, marcar todas como leídas, crear notificación o detener lectura.');actualizarEstadoVoz('Comando no reconocido. Revise los ejemplos disponibles.');}
  function iniciarComandoVoz(){
    const Recognition=reconocimientoDisponible();
    if(!Recognition){toast('Reconocimiento de voz no disponible','El teléfono no tiene un servicio de reconocimiento de voz habilitado.','error');actualizarEstadoVoz('Reconocimiento de voz no disponible.');return;}
    detenerVoz();
    if(Recognition==='ANDROID'){
      vozEscuchando=true;actualizarEstadoVoz('Solicitando micrófono Android…');
      try{window.AndroidConfig.iniciarReconocimientoVoz('comando');}catch(error){vozEscuchando=false;toast('Comando de voz','No se pudo activar el micrófono.','error');}
      return;
    }
    reconocimientoVoz=new Recognition();reconocimientoVoz.lang='es-CL';reconocimientoVoz.interimResults=false;reconocimientoVoz.continuous=false;reconocimientoVoz.maxAlternatives=1;reconocimientoVoz.onstart=()=>{vozEscuchando=true;actualizarEstadoVoz('Escuchando… diga un comando.');};reconocimientoVoz.onresult=event=>ejecutarComandoVoz(event.results?.[0]?.[0]?.transcript||'');reconocimientoVoz.onerror=event=>{vozEscuchando=false;const message=event.error==='not-allowed'?'Permiso de micrófono bloqueado.':'No se pudo reconocer el comando.';actualizarEstadoVoz(message);toast('Comando de voz',message,'error');};reconocimientoVoz.onend=()=>{vozEscuchando=false;};try{reconocimientoVoz.start();}catch(error){toast('Comando de voz','No se pudo activar el micrófono.','error');}
  }
  function dictarEnCampo(campo,boton){
    const Recognition=reconocimientoDisponible();if(!Recognition){toast('Dictado no disponible','El teléfono no tiene reconocimiento de voz habilitado.','error');return;}
    const original=boton.textContent;boton.textContent='●';boton.classList.add('listening');
    if(Recognition==='ANDROID'){
      const contexto=`dictado:${Date.now()}`;dictadoNativoPendiente={campo,boton,original,contexto};
      try{window.AndroidConfig.iniciarReconocimientoVoz(contexto);}catch(_){boton.textContent=original;boton.classList.remove('listening');dictadoNativoPendiente=null;}
      return;
    }
    const recognition=new Recognition();recognition.lang='es-CL';recognition.interimResults=false;recognition.continuous=false;recognition.onresult=event=>{const text=event.results?.[0]?.[0]?.transcript||'';campo.value=(campo.value?campo.value.trim()+' ':'')+text;campo.dispatchEvent(new Event('input',{bubbles:true}));};recognition.onerror=()=>toast('Dictado','No se pudo reconocer la voz.','error');recognition.onend=()=>{boton.textContent=original;boton.classList.remove('listening');};try{recognition.start();}catch(_){boton.textContent=original;boton.classList.remove('listening');}
  }
  window.addEventListener('flotas:voz-nativa-estado',event=>{const detalle=event.detail||{};if(String(detalle.contexto||'')==='comando')actualizarEstadoVoz(detalle.mensaje||'Escuchando…');});
  window.addEventListener('flotas:voz-nativa-error',event=>{const detalle=event.detail||{};vozEscuchando=false;if(dictadoNativoPendiente&&detalle.contexto===dictadoNativoPendiente.contexto){dictadoNativoPendiente.boton.textContent=dictadoNativoPendiente.original;dictadoNativoPendiente.boton.classList.remove('listening');dictadoNativoPendiente=null;}const mensaje=detalle.mensaje||'No se pudo reconocer la voz.';actualizarEstadoVoz(mensaje);toast('Comando de voz',mensaje,'error');});
  window.addEventListener('flotas:voz-nativa-resultado',event=>{const detalle=event.detail||{},contexto=String(detalle.contexto||''),texto=String(detalle.texto||'').trim();vozEscuchando=false;if(contexto==='comando'){ejecutarComandoVoz(texto);return;}if(dictadoNativoPendiente&&contexto===dictadoNativoPendiente.contexto){const pendiente=dictadoNativoPendiente;pendiente.campo.value=(pendiente.campo.value?pendiente.campo.value.trim()+' ':'')+texto;pendiente.campo.dispatchEvent(new Event('input',{bubbles:true}));pendiente.boton.textContent=pendiente.original;pendiente.boton.classList.remove('listening');dictadoNativoPendiente=null;}});


  function toggleMapFullscreen(force){const card=$('#mapCard');if(!card)return;const active=typeof force==='boolean'?force:!card.classList.contains('map-fullscreen');card.classList.toggle('map-fullscreen',active);document.body.classList.toggle('mapa-pantalla-completa',active);const button=$('[data-map-fullscreen]',card);if(button)button.textContent=active?'↙ Volver al tamaño normal':'⛶ Pantalla completa';setTimeout(()=>mapaFlota?.redibujar?.(),120);}
  async function subirEvidenciaRutaArchivo(route,file,statusNode){if(!file?.type?.startsWith('image/'))throw new Error('FORMATO_ARCHIVO_DRIVE_INVALIDO');if(file.size>12582912)throw new Error('ARCHIVO_DRIVE_DEMASIADO_GRANDE');statusNode.innerHTML=`<i></i><span>Optimizando ${esc(file.name)}…</span>`;const optimized=await optimizarImagenArchivo(file),dataUrl=await leerArchivoDataUrl(optimized);statusNode.innerHTML=`<i></i><span>Subiendo ${esc(optimized.name)}…</span>`;return api.request('uploadDriveFile',{data:{DESTINO:'RUTA_EVIDENCIA',NOMBRE_ARCHIVO:optimized.name,TIPO_MIME:optimized.type||'image/jpeg',ARCHIVO_BASE64:dataUrl,CONTEXTO:`Ruta ${route.ID} - ${route.NOMBRE||''}`,IP_PUBLICA:clientPublicIp}});}
  function openRouteEvidenceModal(routeId){
    const route=registroFormulario('routes',routeId)||(cacheListasFormulario.get('routes')||[]).find(row=>String(row.ID)===String(routeId));
    if(!route)return toast('Ruta no disponible','Sincronice e intente nuevamente.','error');
    const existing=evidenciasRuta(route);
    $('#modalEyebrow').textContent='RESPALDO DE RUTA';
    $('#modalTitle').textContent=`Fotografías · ${route.NOMBRE||route.ID}`;
    $('#modalBody').innerHTML=`<form id="routeEvidenceForm" class="form-grid">
      <div class="route-evidence-existing full">
        <b>${existing.length} fotografía(s) guardadas</b>
        <div>${existing.length?botonGaleriaRuta(route,`Ver las ${existing.length} foto(s)`):'<span>Sin fotografías anteriores.</span>'}</div>
      </div>
      <div class="route-photo-actions full">
        <label class="file-drop route-photo-picker route-camera-picker">
          <input type="file" name="FOTO_CAMARA" accept="image/*" capture="environment">
          <i>📷</i><b>Tomar fotografía</b><span>Abre la cámara trasera del teléfono.</span>
        </label>
        <label class="file-drop route-photo-picker route-gallery-picker">
          <input type="file" name="FOTOS_GALERIA" accept="image/*" multiple>
          <i>▧</i><b>Elegir desde galería</b><span>Puede seleccionar varias imágenes.</span>
        </label>
      </div>
      <div class="route-upload-summary full" data-route-upload-summary>0 de 6 fotografías preparadas.</div>
      <div class="route-upload-list full" data-route-upload-list>
        <div class="drive-upload-status"><i>○</i><span>Tome una fotografía o seleccione imágenes.</span></div>
      </div>
      <label class="field full"><span>Observación del respaldo</span><textarea name="OBSERVACION" placeholder="Entrega realizada, novedad, estado de carga, firma visual u otra evidencia"></textarea></label>
      <div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn primary" type="submit" disabled>Guardar respaldo en la ruta</button></div>
    </form>`;
    openModal();
    const form=$('#routeEvidenceForm'),camera=form.elements.FOTO_CAMARA,gallery=form.elements.FOTOS_GALERIA,list=$('[data-route-upload-list]',form),summary=$('[data-route-upload-summary]',form),submit=$('button[type="submit"]',form);
    enlazarVisoresRuta(form);enlazarGaleriasRuta(form);
    let uploaded=[],sequence=0,processing=false;
    $('[data-cancel-modal]',form).onclick=closeModal;
    const updateSummary=()=>{summary.textContent=`${uploaded.length} de 6 fotografía(s) cargadas. ${processing?'Procesando…':''}`;submit.disabled=!uploaded.length||processing;};
    const processFiles=async selected=>{
      const available=Math.max(0,6-uploaded.length),files=[...(selected||[])].filter(file=>file?.type?.startsWith('image/')).slice(0,available);
      if(!files.length){if(available===0)toast('Límite alcanzado','Puede guardar hasta 6 fotografías por respaldo.','error');return;}
      if(!uploaded.length)list.innerHTML='';
      processing=true;updateSummary();
      for(const file of files){
        const id=sequence++,node=document.createElement('div');
        node.className='drive-upload-status loading';node.dataset.routeUpload=String(id);node.innerHTML=`<i></i><span>Preparando ${esc(file.name||'fotografía')}…</span>`;list.appendChild(node);
        try{
          const result=await subirEvidenciaRutaArchivo(route,file,node);
          uploaded.push({url:result.url,archivoId:result.path||'',nombre:result.nombre||file.name,tipoMime:result.tipoMime||file.type});
          node.className='drive-upload-status ready';node.innerHTML=`<i>✓</i><span>${esc(file.name||'Fotografía')} cargada</span>`;
        }catch(error){
          node.className='drive-upload-status error';node.innerHTML=`<i>!</i><span>${esc(translateError(error))}</span>`;
        }
        updateSummary();
      }
      processing=false;updateSummary();
      camera.value='';gallery.value='';
    };
    camera.addEventListener('change',()=>processFiles(camera.files));
    gallery.addEventListener('change',()=>processFiles(gallery.files));
    updateSummary();
    form.onsubmit=event=>{
      event.preventDefault();
      if(!uploaded.length||processing)return;
      conCargaBoton(submit,'Guardando respaldo…',async()=>{
        try{
          await api.request('registerRouteEvidence',{data:{RUTA_ID:route.ID,URLS:uploaded,OBSERVACION:form.elements.OBSERVACION.value.trim()}});
          invalidarListasFormulario('routes','notifications','audit');cacheVistasModulo.delete('routes');cacheVistasModulo.delete('dashboard');closeModal();
          toast('Respaldo guardado',`${uploaded.length} fotografía(s) quedaron vinculadas a la ruta.`);actualizarSeccionEnSegundoPlano(currentSection);
        }catch(error){toast('No se pudo guardar el respaldo',translateError(error),'error');}
      });
    };
  }
  async function openRouteReassignModal(routeId,sourceButton=null){
    if(!hasPermission('RUTAS','REASIGNAR'))return toast('Acceso restringido','Su cuenta no tiene permiso para reasignar rutas.','error');
    const route=registroFormulario('routes',routeId);if(!route)return toast('Ruta no encontrada','Actualice el módulo e intente nuevamente.','error');
    const original=sourceButton?.textContent||'';if(sourceButton){sourceButton.disabled=true;sourceButton.textContent='Cargando…';}
    try{
      const result=await api.request('list',{resource:'drivers',limit:1000,cache:false}),rows=Array.isArray(result.rows)?result.rows:[];
      const disponibles=rows.filter(d=>String(d.ID)!==String(route.CONDUCTOR_ID)&&String(d.ESTADO||'Disponible').toLowerCase()==='disponible');
      if(!disponibles.length)return toast('Sin conductores disponibles','No existe otro conductor disponible para esta contingencia.','warning');
      $('#modalEyebrow').textContent='CONTINGENCIA OPERACIONAL';$('#modalTitle').textContent='Reasignar la misma ruta';
      $('#modalBody').innerHTML=`<form class="form-grid" id="routeReassignForm"><div class="module-diagnostic warning full"><i>↻</i><div><b>${esc(route.NOMBRE||route.ID)}</b><span>${esc(route.ORIGEN||'')} → ${esc(route.DESTINO||'')}</span></div></div><p class="helper full">La ruta conservará vehículo, destinos e historial. Por esta reasignación autorizada no se exigirá un nuevo Check-in al conductor receptor.</p><label class="field full"><span>Nuevo conductor disponible</span><select name="CONDUCTOR_ID" required>${disponibles.map(d=>`<option value="${esc(d.ID)}">${esc(d.NOMBRE||d.ID)}${d.RUT?` · ${esc(d.RUT)}`:''}</option>`).join('')}</select></label><label class="field full"><span>Motivo de la reasignación</span><textarea name="MOTIVO" required minlength="4" placeholder="Ej. contingencia del conductor original"></textarea></label><div class="form-actions full"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn primary" type="submit">Confirmar reasignación</button></div></form>`;
      openModal();const form=$('#routeReassignForm');$('[data-cancel-modal]',form).onclick=closeModal;
      form.onsubmit=event=>{event.preventDefault();const button=$('button[type="submit"]',form);conCargaBoton(button,'Reasignando…',async()=>{try{const data=Object.fromEntries(new FormData(form).entries());data.RUTA_ID=route.ID;await api.request('reassignRoute',{id:route.ID,data});invalidarListasFormulario('routes','drivers','vehicles','notifications');['routes','dashboard','operations'].forEach(x=>cacheVistasModulo.delete(x));closeModal();toast('Ruta reasignada','El nuevo conductor fue notificado. La excepción de Check-in quedó auditada.');actualizarSeccionEnSegundoPlano('routes');}catch(error){toast('No se pudo reasignar',translateError(error),'error');throw error;}});};
    }catch(error){toast('No se pudo preparar la reasignación',translateError(error),'error');}
    finally{if(sourceButton){sourceButton.disabled=false;sourceButton.textContent=original;}}
  }

  async function openRouteWeatherModal(routeId){
    const route=registroFormulario('routes',routeId);if(!route)return;$('#modalEyebrow').textContent='CLIMA DE LA RUTA';$('#modalTitle').textContent=route.NOMBRE||'Condiciones meteorológicas';$('#modalBody').innerHTML='<div class="modal-loading"><i></i><span>Consultando origen y destino…</span></div>';openModal();
    try{const result=await api.request('routeWeather',{data:{RUTA_ID:routeId}}),card=point=>`<article class="weather-route-card ${point.DISPONIBLE?'':'unavailable'}"><span>${point.DISPONIBLE?'☁':'!'}</span><div><small>${esc(point.NOMBRE||'Punto de ruta')}</small><h3>${point.DISPONIBLE?`${number(point.TEMPERATURA_C)} °C`:'Sin datos'}</h3><b>${esc(point.DESCRIPCION||point.MENSAJE||'Condición no disponible')}</b>${point.DISPONIBLE?`<p>Sensación ${number(point.SENSACION_C)} °C · lluvia ${number(point.PRECIPITACION_MM)} mm · viento ${number(point.VIENTO_KMH)} km/h</p>`:''}</div></article>`;$('#modalBody').innerHTML=`<div class="weather-route-grid">${card(result.origen||{})}${card(result.destino||{})}</div><div class="tracking-notice active"><i>✓</i><div><b>Consulta actualizada</b><span>${fmtDate(result.consultadoEn,true)} · ${esc(result.proveedor||'servicio meteorológico')}</span></div></div><div class="form-actions"><button class="btn primary" type="button" data-cancel-modal>Cerrar</button></div>`;$('[data-cancel-modal]',$('#modalBody')).onclick=closeModal;}catch(error){$('#modalBody').innerHTML=`<div class="tracking-notice warning"><i>!</i><div><b>No se pudo consultar el clima</b><span>${esc(translateError(error))}</span></div></div><div class="form-actions"><button class="btn primary" type="button" data-cancel-modal>Cerrar</button></div>`;$('[data-cancel-modal]',$('#modalBody')).onclick=closeModal;}
  }
  async function runAutomaticAlerts(button){try{const result=await api.request('runAutomaticAlerts',{force:true});invalidarListasFormulario('alerts','notifications');cacheVistasModulo.delete('alerts');cacheVistasModulo.delete('dashboard');toast('Revisión automática completada',`${Number(result.creadas||0)} alerta(s) nueva(s) detectadas.`);if(currentSection==='alerts')actualizarSeccionEnSegundoPlano('alerts');}catch(error){toast('No se pudo revisar',translateError(error),'error');}}
  function openRouteModal(prefill={}){
    const routePrefill={...prefill};
    const base=configuracionPuntoOperacion();
    $('#modalEyebrow').textContent='PLANIFICACIÓN';$('#modalTitle').textContent='Asignar nueva ruta';
    const originDefault=base.configurada?base.direccion:'';
    const originLat=base.configurada?base.latitud:'';
    const originLng=base.configurada?base.longitud:'';
    const controlAlerta=['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'].includes(String(currentUser?.ROL_ID||'').toUpperCase())?`<label class="assignment-alert-switch full"><input type="checkbox" name="ENVIAR_ALERTA_ASIGNACION" value="SI" checked><i></i><span><b>Enviar alerta emergente</b><small>El conductor la recibirá individualmente. La voz respetará su preferencia personal.</small></span></label>`:'';
    $('#modalBody').innerHTML=`<form class="form-grid" id="routeForm">${routePrefill.CHECKIN_ID?`<div class="module-diagnostic success full"><i>✓</i><div><b>Check-in ${esc(routePrefill.CHECKIN_ID)} listo</b><span data-checkin-route-prefill-summary>Conductor y vehículo de esta inspección se cargarán automáticamente.</span></div></div><input type="hidden" name="CHECKIN_ID" value="${esc(routePrefill.CHECKIN_ID)}">`:''}<div class="operation-base-summary full"><i>➜</i><div><b>Asignación independiente del GPS</b><span>Puede crear la ruta desde cualquier lugar. La geocerca se validará únicamente cuando el conductor inicie o finalice una operación.</span></div></div><label class="field"><span>Conductor</span>${selectorDinamico('drivers','routeDrivers','CONDUCTOR_ID',routePrefill.CONDUCTOR_ID||'',true)}${routePrefill.CHECKIN_ID?'<small>Precargado desde la inspección; no necesita seleccionarlo nuevamente.</small>':''}</label><label class="field"><span>Vehículo</span>${selectorDinamico('vehicles','routeVehicles','VEHICULO_ID',routePrefill.VEHICULO_ID||'',true)}<small data-route-vehicle-auto>${routePrefill.CHECKIN_ID?'Precargado desde el vehículo inspeccionado.':'Al seleccionar conductor se cargará automáticamente su vehículo asignado.'}</small></label><div class="module-diagnostic warning full" data-route-checkin-status><i>!</i><div><b>Check-in pendiente de validación</b><span>Seleccione conductor y vehículo. El sistema comprobará automáticamente que exista un Check-in aprobado y vigente para ese vehículo exacto.</span></div></div><label class="field"><span>Nombre de la ruta</span><input name="NOMBRE" placeholder="Ej. Entrega sector norte"></label><label class="field"><span>Aplicación de navegación</span><select name="PROVEEDOR_NAVEGACION"><option>Google Maps</option><option>Waze</option></select></label><label class="field full"><span>Origen planificado</span><input name="ORIGEN" value="${esc(originDefault)}" required data-address-autocomplete data-lat-target="ORIGEN_LATITUD" data-lng-target="ORIGEN_LONGITUD" placeholder="Dirección de salida planificada"><small>${base.configurada?'Se completó con la base operacional, pero puede modificarlo para esta ruta.':'Ingrese el origen de esta asignación. Esto no configura la geocerca operacional.'}</small></label><label class="field"><span>Latitud origen</span><input name="ORIGEN_LATITUD" type="number" step="any" value="${esc(originLat)}" readonly placeholder="Opcional"></label><label class="field"><span>Longitud origen</span><input name="ORIGEN_LONGITUD" type="number" step="any" value="${esc(originLng)}" readonly placeholder="Opcional"></label><label class="field full"><span>Destino de la ruta</span><input name="DESTINO" required data-address-autocomplete data-lat-target="DESTINO_LATITUD" data-lng-target="DESTINO_LONGITUD" placeholder="Comience a escribir el destino"></label><label class="field"><span>Latitud destino</span><input name="DESTINO_LATITUD" type="number" step="any" readonly placeholder="Opcional"></label><label class="field"><span>Longitud destino</span><input name="DESTINO_LONGITUD" type="number" step="any" readonly placeholder="Opcional"></label><label class="assignment-alert-switch full"><input type="checkbox" name="MULTIPLES_RUTAS" value="SI" data-route-multi-toggle><i></i><span><b>Habilitar múltiples rutas / destinos</b><small>Agregue puntos con + o quítelos con −. El conductor y el vehículo se mantienen ocupados hasta el último destino.</small></span></label><div class="full route-multi-panel" data-route-multi-panel hidden><div data-route-multi-stops></div><button class="btn soft" type="button" data-route-add-stop>+ Agregar otro destino</button><label class="assignment-alert-switch"><input type="checkbox" name="ORDENAR_POR_CERCANIA" value="SI" checked><i></i><span><b>Ordenar por cercanía</b><small>NEXO ordena los puntos desde el origen y recalcula los pendientes después de cada llegada.</small></span></label><label class="assignment-alert-switch"><input type="checkbox" name="ORDEN_BLOQUEADO" value="SI"><i></i><span><b>Bloquear orden manual</b><small>Conserve exactamente el orden ingresado y no recalcule por cercanía.</small></span></label></div><label class="field"><span>Prioridad</span><select name="PRIORIDAD"><option>Normal</option><option selected>Alta</option><option>Urgente</option></select></label><label class="field full"><span>Instrucciones al conductor</span><textarea name="INSTRUCCIONES" placeholder="Indicaciones, horarios, contacto o restricciones"></textarea></label>${controlAlerta}<div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn primary" type="submit">Asignar y notificar</button></div></form>`;
    const token=openModal(),routeForm=$('#routeForm');bloqueoRefrescoVisualHasta=0;bindAddressAutocomplete(routeForm);$('[data-cancel-modal]',$('#modalBody')).onclick=closeModal;
    const routeSubmit=$('button[type="submit"]',routeForm),routeCheckinStatus=$('[data-route-checkin-status]',routeForm);let routeCheckinState={valid:false,driverId:'',vehicleId:'',checkinId:''},routeCheckinSeq=0;
    if(routeSubmit)routeSubmit.disabled=true;
    const setRouteCheckinStatus=(kind,title,detail)=>{if(!routeCheckinStatus)return;routeCheckinStatus.className=`module-diagnostic ${kind} full`;routeCheckinStatus.innerHTML=`<i>${kind==='success'?'✓':kind==='warning'?'!':'×'}</i><div><b>${esc(title)}</b><span>${esc(detail)}</span></div>`;};
    const validarCheckinRutaFormulario=async()=>{const driverId=String(routeForm.elements.CONDUCTOR_ID?.value||''),vehicleId=String(routeForm.elements.VEHICULO_ID?.value||''),seq=++routeCheckinSeq;routeCheckinState={valid:false,driverId,vehicleId,checkinId:''};if(routeSubmit)routeSubmit.disabled=true;if(!driverId||!vehicleId){setRouteCheckinStatus('warning','Check-in pendiente de validación','Seleccione conductor y vehículo para verificar la inspección vigente.');return false;}setRouteCheckinStatus('warning','Validando Check-in…','Consultando la asignación y la inspección vigente de las últimas 24 horas.');try{const result=await api.request('validateRouteCheckin',{data:{CONDUCTOR_ID:driverId,VEHICULO_ID:vehicleId,CHECKIN_ID:routeForm.elements.CHECKIN_ID?.value||''},cache:false});if(seq!==routeCheckinSeq||String(routeForm.elements.CONDUCTOR_ID?.value||'')!==driverId||String(routeForm.elements.VEHICULO_ID?.value||'')!==vehicleId)return false;if(result.VALIDO===true||result.valido===true){let hidden=routeForm.elements.CHECKIN_ID;if(!hidden){hidden=document.createElement('input');hidden.type='hidden';hidden.name='CHECKIN_ID';routeForm.append(hidden);}hidden.value=String(result.CHECKIN_ID||result.checkinId||'');routeCheckinState={valid:true,driverId,vehicleId,checkinId:hidden.value};const vencimiento=result.VIGENTE_HASTA||result.vigenteHasta||'';setRouteCheckinStatus('success','Check-in vigente: Sí',`${result.PATENTE||vehicleId} · ${hidden.value}${vencimiento?` · vigente hasta ${fmtDate(vencimiento,true)}`:''}`);if(routeSubmit)routeSubmit.disabled=false;return true;}const mensaje=result.MENSAJE||result.mensaje||'El conductor no posee un Check-in aprobado y vigente para el vehículo seleccionado.';setRouteCheckinStatus('danger','Check-in vigente: No',mensaje);return false;}catch(error){if(seq!==routeCheckinSeq)return false;setRouteCheckinStatus('danger','No se pudo validar el Check-in',translateError(error));return false;}};
    const multiToggle=$('[data-route-multi-toggle]',routeForm),multiPanel=$('[data-route-multi-panel]',routeForm),multiStops=$('[data-route-multi-stops]',routeForm),addStop=$('[data-route-add-stop]',routeForm);let multiStopSequence=1;
    const agregarParada=()=>{multiStopSequence+=1;const n=multiStopSequence,bloque=document.createElement('section');bloque.className='route-multi-stop';bloque.innerHTML=`<div class="route-multi-stop-head"><b>Destino ${n}</b><button type="button" class="link-button danger" data-route-remove-stop>− Quitar</button></div><label class="field full"><span>Dirección</span><input name="DESTINO_EXTRA_${n}" required data-address-autocomplete data-lat-target="DESTINO_EXTRA_LAT_${n}" data-lng-target="DESTINO_EXTRA_LNG_${n}" placeholder="Comience a escribir el destino ${n}"></label><input type="hidden" name="DESTINO_EXTRA_LAT_${n}"><input type="hidden" name="DESTINO_EXTRA_LNG_${n}">`;multiStops.append(bloque);bindAddressAutocomplete(bloque);$('[data-route-remove-stop]',bloque).onclick=()=>{if($$('.route-multi-stop',multiStops).length<=1){toast('Múltiples rutas','Debe mantener al menos dos destinos.','warning');return;}bloque.remove();};return bloque;};
    addStop.onclick=agregarParada;multiToggle.addEventListener('change',()=>{multiPanel.hidden=!multiToggle.checked;if(multiToggle.checked&&!$('.route-multi-stop',multiStops))agregarParada();});
    routeForm.onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=$('button[type="submit"]',form),driverId=String(form.elements.CONDUCTOR_ID?.value||''),vehicleId=String(form.elements.VEHICULO_ID?.value||'');if(!routeCheckinState.valid||routeCheckinState.driverId!==driverId||routeCheckinState.vehicleId!==vehicleId){toast('Check-in requerido','Debe existir un Check-in aprobado y vigente para este conductor y este vehículo antes de asignar la ruta.','error');await validarCheckinRutaFormulario();return;}const data=Object.fromEntries(new FormData(form).entries());data.ENVIAR_ALERTA_ASIGNACION=form.elements.ENVIAR_ALERTA_ASIGNACION?.checked?'SI':'NO';data.MULTIPLES_RUTAS=multiToggle.checked?'SI':'NO';data.ORDENAR_POR_CERCANIA=form.elements.ORDENAR_POR_CERCANIA?.checked?'SI':'NO';data.ORDEN_BLOQUEADO=form.elements.ORDEN_BLOQUEADO?.checked?'SI':'NO';if(multiToggle.checked){const paradas=[{PUNTO_ID:'PUNTO-1',ORDEN:1,DESTINO:String(form.elements.DESTINO.value||'').trim(),LATITUD:Number(form.elements.DESTINO_LATITUD.value),LONGITUD:Number(form.elements.DESTINO_LONGITUD.value),RADIO_LLEGADA_METROS:120}];for(const [index,bloque] of $$('.route-multi-stop',multiStops).entries()){const input=$('[data-address-autocomplete]',bloque),lat=form.elements[input.dataset.latTarget]?.value,lng=form.elements[input.dataset.lngTarget]?.value;if(!input.value.trim()||lat===''||lng===''||!Number.isFinite(Number(lat))||!Number.isFinite(Number(lng))){toast('Destino sin confirmar',`Confirme la dirección del destino ${index+2}.`,'error');return;}paradas.push({PUNTO_ID:`PUNTO-${index+2}`,ORDEN:index+2,DESTINO:input.value.trim(),LATITUD:Number(lat),LONGITUD:Number(lng),RADIO_LLEGADA_METROS:120});}if(paradas.length<2){toast('Múltiples rutas','Agregue al menos dos destinos.','error');return;}data.PARADAS_CODIFICADAS=paradas;}if(routePrefill.CHECKIN_ID){data.CHECKIN_ID=routePrefill.CHECKIN_ID;if(String(data.CONDUCTOR_ID||'')!==String(routePrefill.CONDUCTOR_ID||'')||String(data.VEHICULO_ID||'')!==String(routePrefill.VEHICULO_ID||'')){toast('Inspección no coincide','La ruta debe conservar el conductor y el vehículo del check-in abierto.','error');return;}}await conCargaBoton(button,'Asignando…',async()=>{try{const result=await api.request('assignRoute',{data});if(routePrefill.NOTIFICACION_ID){try{await api.request('readNotification',{id:routePrefill.NOTIFICACION_ID,data:{NOTIFICACION_ID:routePrefill.NOTIFICACION_ID}});}catch(_){}}invalidarListasFormulario('routes','vehicles','documents','notifications');cacheVistasModulo.delete('routes');cacheVistasModulo.delete('documents');cacheVistasModulo.delete('dashboard');closeModal();const docPendiente=result.documentacionPersonal&&result.documentacionPersonal.COMPLETO===false;toast(docPendiente?'Ruta asignada · documentación pendiente':'Ruta asignada',docPendiente?'La ruta quedó activa y se avisó a Administración y Gerencia que falta documentación personal digital vigente.':result.notificada?'El conductor recibirá la tarjeta emergente; la voz sonará si la mantiene activada.':'La ruta quedó asignada sin aviso emergente.',docPendiente?'warning':'success');actualizarSeccionEnSegundoPlano('routes');}catch(error){toast('No se pudo asignar',translateError(error),'error');}});};
    prepararListasModal(token,['drivers','vehicles','checkins']);
    Promise.all(['drivers','vehicles','checkins'].map(cargarListaFormulario)).then(()=>{if(token!==secuenciaModal)return;actualizarSelectoresModal(token);const driverSelect=routeForm.elements.CONDUCTOR_ID,vehicleSelect=routeForm.elements.VEHICULO_ID;const exactCheckin=routePrefill.CHECKIN_ID?listaFormulario('checkins').find(item=>String(item.ID)===String(routePrefill.CHECKIN_ID)):null;if(exactCheckin){routePrefill.CONDUCTOR_ID=String(exactCheckin.CONDUCTOR_ID||routePrefill.CONDUCTOR_ID||'');routePrefill.VEHICULO_ID=String(exactCheckin.VEHICULO_ID||routePrefill.VEHICULO_ID||'');}
      const lockPrefill=()=>{const driver=listaFormulario('drivers').find(item=>String(item.ID)===String(routePrefill.CONDUCTOR_ID)),vehicle=listaFormulario('vehicles').find(item=>String(item.ID)===String(routePrefill.VEHICULO_ID));if(!routePrefill.CONDUCTOR_ID||!routePrefill.VEHICULO_ID)return false;driverSelect.innerHTML=`<option value="${esc(routePrefill.CONDUCTOR_ID)}">${esc(driver?`${driver.ID} · ${driver.NOMBRE||'Conductor'} · ${driver.RUT||driver.CORREO||''}`:routePrefill.CONDUCTOR_ID)}</option>`;vehicleSelect.innerHTML=`<option value="${esc(routePrefill.VEHICULO_ID)}">${esc(vehicle?`${vehicle.ID} · ${vehicle.PATENTE||'Sin patente'} · ${vehicle.MARCA||''} ${vehicle.MODELO||''}`.trim():routePrefill.VEHICULO_ID)}</option>`;driverSelect.value=routePrefill.CONDUCTOR_ID;vehicleSelect.value=routePrefill.VEHICULO_ID;driverSelect.dataset.selected=routePrefill.CONDUCTOR_ID;vehicleSelect.dataset.selected=routePrefill.VEHICULO_ID;driverSelect.dataset.checkinLocked='1';vehicleSelect.dataset.checkinLocked='1';const summary=$('[data-checkin-route-prefill-summary]',routeForm);if(summary)summary.textContent=`${driver?.NOMBRE||routePrefill.CONDUCTOR_ID} · ${vehicle?.PATENTE||routePrefill.VEHICULO_ID} quedaron precargados desde esta inspección.`;return true;};
      if(routePrefill.CHECKIN_ID&&lockPrefill()){validarCheckinRutaFormulario();return;}
      let secuenciaPareja=0;
      const applyPair=async()=>{const request=++secuenciaPareja,driverId=String(driverSelect.value||''),hint=$('[data-route-vehicle-auto]',routeForm);vehicleSelect.disabled=false;if(!driverId){vehicleSelect.innerHTML='<option value="">Seleccione primero el conductor</option>';if(hint)hint.textContent='Al seleccionar conductor se cargará automáticamente su vehículo asignado.';validarCheckinRutaFormulario();return;}
        const checkinsValidos=listaFormulario('checkins').filter(item=>String(item.CONDUCTOR_ID||'')===driverId&&item.ESTADO_REVISION==='Aprobado'&&new Date(item.VIGENTE_HASTA||0)>new Date()),valid=new Set(checkinsValidos.map(item=>String(item.VEHICULO_ID||''))),vehicles=listaFormulario('vehicles');
        let asignadoId='';try{const result=await api.request('currentCheckinAssignment',{data:{CONDUCTOR_ID:driverId},cache:false});asignadoId=String(result?.vehiculo?.ID||result?.VEHICULO?.ID||result?.asignacion?.VEHICULO_ID||'');}catch(_){asignadoId='';}
        if(request!==secuenciaPareja||String(driverSelect.value||'')!==driverId)return;
        const asignado=vehicles.find(item=>String(item.ID)===asignadoId);
        if(asignado){vehicleSelect.innerHTML=`<option value="${esc(asignado.ID)}">${esc(`${asignado.ID} · ${asignado.PATENTE||'Sin patente'} · ${asignado.MARCA||''} ${asignado.MODELO||''}`.trim())}</option>`;vehicleSelect.value=String(asignado.ID);if(hint)hint.textContent=`Vehículo asignado cargado automáticamente: ${asignado.PATENTE||asignado.ID}.`;validarCheckinRutaFormulario();return;}
        vehicleSelect.innerHTML=`<option value="">${vehicles.length?'Seleccione el vehículo a validar':'No hay vehículos disponibles en el alcance actual'}</option>${vehicles.map(item=>`<option value="${esc(item.ID)}">${esc(`${item.ID} · ${item.PATENTE||'Sin patente'} · ${item.MARCA||''} ${item.MODELO||''}`.trim())}</option>`).join('')}`;if(vehicles.length===1){vehicleSelect.value=vehicles[0].ID;if(hint)hint.textContent=`Vehículo del check-in cargado automáticamente: ${vehicles[0].PATENTE||vehicles[0].ID}.`;}else if(hint)hint.textContent=vehicles.length?'Seleccione el vehículo. El servidor validará que el Check-in corresponda exactamente a este conductor y vehículo.':'No hay vehículos disponibles en el alcance actual.';validarCheckinRutaFormulario();};
      driverSelect.addEventListener('change',()=>{bloquearRefrescoVisualTemporal(5000);applyPair();});vehicleSelect.addEventListener('change',()=>{bloquearRefrescoVisualTemporal(3000);validarCheckinRutaFormulario();});if(routePrefill.CONDUCTOR_ID){driverSelect.value=String(routePrefill.CONDUCTOR_ID);applyPair().then(()=>{if(routePrefill.VEHICULO_ID)vehicleSelect.value=String(routePrefill.VEHICULO_ID);validarCheckinRutaFormulario();});}else if(driverSelect.options.length===2&&!driverSelect.value){driverSelect.selectedIndex=1;driverSelect.dispatchEvent(new Event('change'));}else applyPair();}).catch(error=>{if(routePrefill.CHECKIN_ID)toast('No se pudo precargar la inspección',translateError(error),'error');});
  }
  function guardarContextoSeguimientoRuta(contexto){routeTrackingContext=contexto&&contexto.activo!==false?{...contexto,USUARIO_ID:currentUser?.ID||contexto.USUARIO_ID||''}:null;try{if(routeTrackingContext)localStorage.setItem(routeTrackingKey,JSON.stringify(routeTrackingContext));else localStorage.removeItem(routeTrackingKey);}catch(_){}}
  function contextoSeguimientoRutaValido(){if(!routeTrackingContext||routeTrackingContext.activo===false)return false;const owner=String(routeTrackingContext.USUARIO_ID||'');if(owner&&currentUser?.ID&&owner!==String(currentUser.ID)){guardarContextoSeguimientoRuta(null);return false;}return Boolean(routeTrackingContext.RUTA_ID||routeTrackingContext.OPERACION_ID);}
  async function activarSeguimientoRutaCliente(contexto){guardarContextoSeguimientoRuta(contexto);try{if(window.AndroidConfig&&typeof AndroidConfig.iniciarSeguimientoRuta==='function'){AndroidConfig.iniciarSeguimientoRuta(JSON.stringify(contexto||{}));gpsWatchId='ANDROID';updateTrackingUi();return true;}}catch(_){}return startTracking({silent:true});}
  function detenerSeguimientoRutaCliente(routeId){guardarContextoSeguimientoRuta(null);try{if(window.AndroidConfig&&typeof AndroidConfig.finalizarSeguimientoRuta==='function')AndroidConfig.finalizarSeguimientoRuta(String(routeId||''));}catch(_){}if(!config.GPS_AUTOMATICO_OBLIGATORIO&&gpsWatchId!==null)stopTracking({remember:false,silent:true});}
  function esErrorAccionRutaNoDisponible(error){
    const codigo=String(error?.message||error||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]/gi,'').toUpperCase();
    return ['ACCIONNOENCONTRADA','ACCIONNORECONOCIDA','ACCIONDESCONOCIDA','ACTIONNOTFOUND','UNKNOWNACTION'].some(item=>codigo.includes(item));
  }
  async function solicitarAccionRutaCompatible(tipo,payload){
    const intentos=tipo==='COMPLETAR'
      ? [
          ['completeRoute',payload],
          ['updateRouteStatus',{...payload,ESTADO:'Completada',data:{...(payload.data||{}),RUTA_ID:payload.id||payload.RUTA_ID,ESTADO:'Completada'}}]
        ]
      : [
          ['startRoute',payload],
          ['updateRouteStatus',{...payload,ESTADO:'En curso',data:{...(payload.data||{}),RUTA_ID:payload.id||payload.RUTA_ID,ESTADO:'En curso'}}]
        ];
    let ultimoError=null;
    for(const [accion,carga] of intentos){
      try{return await api.request(accion,carga);}
      catch(error){
        ultimoError=error;
        if(!esErrorAccionRutaNoDisponible(error))throw error;
      }
    }
    throw ultimoError||new Error('ACCION_RUTA_NO_DISPONIBLE');
  }
  async function confirmarEstadoRutaServidor(id,estadoEsperado,result){
    let row=result?.row||{};
    if(!row.ID||String(row.ESTADO||'')!==estadoEsperado){
      const verification=await api.request('get',{resource:'routes',id,force:true,cache:false});
      if(verification?.row)row=verification.row;
    }
    if(String(row.ESTADO||'')!==estadoEsperado)throw new Error(estadoEsperado==='Completada'?'RUTA_NO_CONFIRMADA_COMPLETADA':'RUTA_NO_CONFIRMADA_EN_CURSO');
    guardarRegistro('routes',row);
    return {...(result||{}),row};
  }
  async function iniciarRutaConSeguimiento(id){
    const payload={id,RUTA_ID:id,ESTADO:'En curso',data:{RUTA_ID:id,ESTADO:'En curso'}};
    let result=await solicitarAccionRutaCompatible('INICIAR',payload);
    result=await confirmarEstadoRutaServidor(id,'En curso',result);
    const row=result.row||{};
    const seguimiento=result?.seguimiento||{
      activo:true,
      RUTA_ID:id,
      OPERACION_ID:row.OPERACION_ID||'',
      VEHICULO_ID:row.VEHICULO_ID||'',
      CONDUCTOR_ID:row.CONDUCTOR_ID||'',
      CHECKIN_ID:row.CHECKIN_ID||''
    };
    await activarSeguimientoRutaCliente(seguimiento);
    return {...result,row,seguimiento};
  }
  async function completarRutaConSeguimiento(id){
    const cierre=ultimaPosicionConocida&&Number.isFinite(Number(ultimaPosicionConocida.latitud))&&Number.isFinite(Number(ultimaPosicionConocida.longitud))?{
      CIERRE_LATITUD:Number(ultimaPosicionConocida.latitud),CIERRE_LONGITUD:Number(ultimaPosicionConocida.longitud),
      CIERRE_PRECISION:Number(ultimaPosicionConocida.precision||0),CIERRE_FECHA:ultimaPosicionConocida.fecha?new Date(ultimaPosicionConocida.fecha).toISOString():new Date().toISOString(),
      CIERRE_DIRECCION:ultimaPosicionConocida.direccion||'',CIERRE_FUENTE:ultimaPosicionConocida.fuente||'WEB'
    }:{};
    const payload={id,RUTA_ID:id,ESTADO:'Completada',data:{RUTA_ID:id,ESTADO:'Completada',...cierre}};
    let result=await solicitarAccionRutaCompatible('COMPLETAR',payload);
    result=await confirmarEstadoRutaServidor(id,'Completada',result);
    detenerSeguimientoRutaCliente(id);
    return result;
  }
  async function changeRouteState(value){
    const split=value.indexOf(':'),id=value.slice(0,split),state=value.slice(split+1);
    try{
      let result;
      if(state==='En curso')result=await iniciarRutaConSeguimiento(id);
      else if(['Completada','Completado','Finalizada','Finalizado'].includes(state))result=await completarRutaConSeguimiento(id);
      else{
        result=await api.request('updateRouteStatus',{id,RUTA_ID:id,ESTADO:state,data:{RUTA_ID:id,ESTADO:state}});
        if(state==='Cancelada')detenerSeguimientoRutaCliente(id);
      }
      try{localStorage.removeItem(pendingRouteCheckinKey);}catch(_){}
      invalidarListasFormulario('routes','notifications','checkins','operations');
      cacheVistasModulo.delete(currentSection);cacheVistasModulo.delete('dashboard');
      const completada=String(result?.row?.ESTADO||state)==='Completada';
      const cierreAnticipado=Boolean(result?.CIERRE_ANTICIPADO||result?.cierreAnticipado);
      toast(state==='En curso'?'Ruta iniciada':completada?(cierreAnticipado?'Ruta completada anticipadamente':'Ruta completada'):'Ruta actualizada',
        state==='En curso'
          ? `GPS en tiempo real activado · check-in ${result.seguimiento?.CHECKIN_ID||'vigente'}${result.operacionVinculada?' · operación vinculada':''}.`
          : completada?(cierreAnticipado?`La ruta fue cerrada antes de confirmar el destino. Quedó registrada en auditoría y se generaron ${number(result.ALERTAS_GENERADAS||result.alertasGeneradas||0)} alerta(s) para Administración, Gerencia y Operadores autorizados.${result.DISTANCIA_RESTANTE_METROS!==null&&result.DISTANCIA_RESTANTE_METROS!==undefined?` Distancia restante: ${number(result.DISTANCIA_RESTANTE_METROS)} m.`:''}`:'La ruta quedó completada, el seguimiento de esta ruta fue detenido y la notificación quedó programada.'):`Nuevo estado: ${state}.`);
      actualizarSeccionEnSegundoPlano(currentSection);
      if(state==='En curso')programarNavegacionRutaPlanificada(result.row||{ID:id});
    }catch(error){
      const code=String(error?.message||error||'');
      if(code.includes('CHECKIN_DIARIO_REQUERIDO')){
        const route=registroFormulario('routes',id)||(cacheListasFormulario.get('routes')||[]).find(row=>String(row.ID)===String(id))||{};
        try{localStorage.setItem(pendingRouteCheckinKey,JSON.stringify({RUTA_ID:id,VEHICULO_ID:route.VEHICULO_ID||'',CONDUCTOR_ID:route.CONDUCTOR_ID||''}));}catch(_){}
        toast('Check-in requerido','Realice el check-in de hoy para este vehículo y conductor. Al aprobarse podrá iniciar la ruta.','error');
        navigateSection('checkin');return;
      }
      toast('No se pudo completar la ruta',translateError(error),'error');
    }
  }
  function normalizarTelefonoWhatsApp(value=''){
    let digits=String(value||'').replace(/\D/g,'');
    if(digits.startsWith('00'))digits=digits.slice(2);
    if(digits.startsWith('0'))digits=digits.slice(1);
    if(digits.length===9&&digits.startsWith('9'))digits='56'+digits;
    return digits;
  }
  function openWhatsAppDriver(driverId){
    const driver=registroFormulario('drivers',driverId)||(cacheListasFormulario.get('drivers')||[]).find(row=>String(row.ID)===String(driverId));
    if(!driver)return toast('Conductor no disponible','Sincronice el módulo e intente nuevamente.','error');
    const phone=normalizarTelefonoWhatsApp(driver.TELEFONO);
    if(!phone)return toast('Teléfono no registrado',`${driver.NOMBRE||'El conductor'} no tiene un número disponible.`, 'error');
    $('#modalEyebrow').textContent='COMUNICACIÓN DIRECTA';
    $('#modalTitle').textContent=`WhatsApp a ${driver.NOMBRE||'conductor'}`;
    $('#modalBody').innerHTML=`<form class="form-grid whatsapp-form" id="whatsappDriverForm"><div class="whatsapp-contact full"><i>◉</i><div><b>${esc(driver.NOMBRE||'Conductor')}</b><span>${esc(driver.TELEFONO||phone)}</span></div></div><label class="field full"><span>Mensaje</span><textarea name="MENSAJE" rows="6" required>Hola ${esc(String(driver.NOMBRE||'').split(' ')[0])}, este es un mensaje del Sistema de Gestión de Flotas.</textarea></label><p class="helper full">El sistema abrirá WhatsApp con el mensaje preparado. Revise el texto y pulse enviar.</p><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn whatsapp" type="submit">Abrir WhatsApp</button></div></form>`;
    openModal();
    const form=$('#whatsappDriverForm');
    $('[data-cancel-modal]',form).onclick=closeModal;
    form.onsubmit=event=>{event.preventDefault();const message=String(form.elements.MENSAJE.value||'').trim();if(!message)return;const url=`https://wa.me/${phone}?text=${encodeURIComponent(message)}`;window.open(url,'_blank','noopener,noreferrer');closeModal();toast('WhatsApp preparado',`Se abrió la conversación con ${driver.NOMBRE||'el conductor'}.`);};
  }

  function openNotificationModal(){
    $('#modalEyebrow').textContent='COMUNICACIONES';$('#modalTitle').textContent='Enviar notificación';
    $('#modalBody').innerHTML=`<form class="form-grid" id="notificationForm"><label class="field full"><span>Conductor destinatario</span>${selectorDinamico('drivers','notificationDrivers','DESTINATARIO_CONDUCTOR_ID','',true)}</label><label class="field"><span>Tipo</span><select name="TIPO"><option>Información</option><option>Ruta</option><option>Operación</option><option>Seguridad</option><option>Documento</option></select></label><label class="field"><span>Prioridad</span><select name="PRIORIDAD"><option>Baja</option><option selected>Normal</option><option>Alta</option><option>Urgente</option></select></label><label class="field full"><span>Título</span><div class="voice-field"><input name="TITULO" required><button type="button" class="voice-field-button" data-dictate-field="TITULO" title="Dictar título">🎙</button></div></label><label class="field full"><span>Mensaje</span><div class="voice-field"><textarea name="MENSAJE" required></textarea><button type="button" class="voice-field-button" data-dictate-field="MENSAJE" title="Dictar mensaje">🎙</button></div></label><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn primary" type="submit">Enviar notificación</button></div></form>`;
    const token=openModal();$$('[data-dictate-field]',$('#modalBody')).forEach(button=>button.addEventListener('click',()=>dictarEnCampo($('#notificationForm').elements[button.dataset.dictateField],button)));$('[data-cancel-modal]',$('#modalBody')).onclick=closeModal;
    $('#notificationForm').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=$('button[type="submit"]',form),data=Object.fromEntries(new FormData(form).entries());data.SOLICITUD_CLIENTE_ID=crearSolicitudClienteCheckin();await conCargaBoton(button,'Enviando…',async()=>{try{await api.request('sendNotification',{data});invalidarListasFormulario('notifications');cacheVistasModulo.delete('notifications');cacheVistasModulo.delete('dashboard');closeModal();toast('Notificación enviada','El mensaje aparecerá una sola vez en la cuenta del conductor.');actualizarSeccionEnSegundoPlano('notifications');}catch(error){toast('No se pudo enviar',translateError(error),'error');}});};
    prepararListasModal(token,['drivers']);
  }
  function openConnectionsNoticeModal(usuarioPreseleccionado=''){
    if(!puedeEnviarAvisosConexiones())return toast('Acceso restringido','Su cuenta no tiene permiso para crear notificaciones ni alertas.','error');
    const preseleccion=String(usuarioPreseleccionado||'').trim();
    const opcionesServidor=ultimoResumenConexiones?.opciones?.usuarios||[];
    const opcionesEquipos=[...new Map((ultimoResumenConexiones?.equipos||[]).filter(row=>row.USUARIO_ID).map(row=>[String(row.USUARIO_ID),{ID:row.USUARIO_ID,NOMBRE:row.USUARIO_NOMBRE,CORREO:row.USUARIO_CORREO}])).values()];
    const usuarios=[...new Map([...opcionesServidor,...opcionesEquipos].filter(row=>row?.ID).map(row=>[String(row.ID),row])).values()].sort((a,b)=>String(a.NOMBRE||a.ID).localeCompare(String(b.NOMBRE||b.ID),'es'));
    const opcionesUsuarios=usuarios.map(row=>`<option value="${esc(row.ID)}" ${String(row.ID)===preseleccion?'selected':''}>${esc(row.NOMBRE||row.ID)}${row.CORREO?` · ${esc(row.CORREO)}`:''}</option>`).join('');
    const permiteNotificacion=hasPermission('NOTIFICACIONES','ENVIAR'),permiteAlerta=hasPermission('ALERTAS','ENVIAR');
    const tipoInicial=permiteNotificacion?'NOTIFICACION':'ALERTA';
    $('#modalEyebrow').textContent='CONEXIONES EN LÍNEA';
    $('#modalTitle').textContent=preseleccion?'Enviar aviso al usuario':'Enviar notificación o alerta';
    $('#modalBody').innerHTML=`<form class="form-grid connections-notice-form" id="connectionsNoticeForm">
      <div class="connections-notice-summary full"><i>🔔</i><div><b>Entrega central en línea</b><span>El destinatario verá el aviso en su centro de notificaciones o alertas. El envío quedará registrado en auditoría.</span></div></div>
      <label class="field"><span>Clase de aviso</span><select name="TIPO_AVISO">${permiteNotificacion?`<option value="NOTIFICACION" ${tipoInicial==='NOTIFICACION'?'selected':''}>Notificación</option>`:''}${permiteAlerta?`<option value="ALERTA" ${tipoInicial==='ALERTA'?'selected':''}>Alerta</option>`:''}</select></label>
      <label class="field"><span>Destinatarios</span><select name="ALCANCE"><option value="USUARIO" ${preseleccion?'selected':''}>Un usuario</option><option value="CONDUCTORES" ${!preseleccion?'selected':''}>Todos los conductores</option><option value="CONECTADOS">Usuarios conectados ahora</option><option value="TODOS">Todas las cuentas activas</option></select></label>
      <label class="field full" data-notice-user-field><span>Usuario destinatario</span><select name="USUARIO_ID"><option value="">Seleccione un usuario</option>${opcionesUsuarios}</select></label>
      <label class="field"><span>Categoría</span><select name="CATEGORIA"><option>Información</option><option selected>Operación</option><option>Seguridad</option><option>Sistema</option><option>Ruta</option></select></label>
      <label class="field" data-notice-priority-field><span>Prioridad</span><select name="PRIORIDAD"><option>Baja</option><option selected>Normal</option><option>Alta</option><option>Urgente</option></select></label>
      <label class="field" data-notice-level-field hidden><span>Nivel de alerta</span><select name="NIVEL"><option>Info</option><option selected>Advertencia</option><option>Crítica</option></select></label>
      <label class="field full"><span>Título</span><div class="voice-field"><input name="TITULO" maxlength="160" required placeholder="Ej.: Cambio urgente de ruta"><button type="button" class="voice-field-button" data-dictate-field="TITULO" title="Dictar título">🎙</button></div></label>
      <label class="field full"><span>Mensaje</span><div class="voice-field"><textarea name="MENSAJE" rows="5" maxlength="2000" required placeholder="Escriba instrucciones claras para los destinatarios."></textarea><button type="button" class="voice-field-button" data-dictate-field="MENSAJE" title="Dictar mensaje">🎙</button></div></label>
      <p class="helper full" data-notice-scope-help></p>
      <div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn primary" type="submit">Enviar aviso</button></div>
    </form>`;
    openModal();
    const form=$('#connectionsNoticeForm'),scopeField=$('[data-notice-user-field]',form),priorityField=$('[data-notice-priority-field]',form),levelField=$('[data-notice-level-field]',form),help=$('[data-notice-scope-help]',form);
    const actualizar=()=>{
      const individual=form.elements.ALCANCE.value==='USUARIO',alerta=form.elements.TIPO_AVISO.value==='ALERTA';
      scopeField.hidden=!individual;form.elements.USUARIO_ID.required=individual;
      priorityField.hidden=alerta;levelField.hidden=!alerta;
      help.textContent=individual?'Se enviará solamente a la cuenta seleccionada.':form.elements.ALCANCE.value==='CONDUCTORES'?'Se enviará a todas las cuentas activas de conductores.':form.elements.ALCANCE.value==='CONECTADOS'?'Se enviará a quienes mantienen una conexión activa en este momento.':'Se enviará a todas las cuentas activas del sistema.';
    };
    form.elements.ALCANCE.addEventListener('change',actualizar);form.elements.TIPO_AVISO.addEventListener('change',actualizar);actualizar();
    $$('[data-dictate-field]',form).forEach(button=>button.addEventListener('click',()=>dictarEnCampo(form.elements[button.dataset.dictateField],button)));
    $('[data-cancel-modal]',form).onclick=closeModal;
    form.onsubmit=async event=>{
      event.preventDefault();
      const button=$('button[type="submit"]',form),data=Object.fromEntries(new FormData(form).entries());
      data.SOLICITUD_CLIENTE_ID=crearSolicitudClienteCheckin();
      await conCargaBoton(button,'Enviando en línea…',async()=>{
        try{
          const result=await api.request('sendConnectionsNotice',{data});
          invalidarListasFormulario('notifications','alerts','audit');
          ['notifications','alerts','audit','dashboard'].forEach(section=>cacheVistasModulo.delete(section));
          closeModal();
          await refreshNotificationBadge().catch(()=>{});
          toast(data.TIPO_AVISO==='ALERTA'?'Alerta enviada':'Notificación enviada',`${result.enviados||0} de ${result.destinatarios||0} destinatario(s) recibieron el aviso${result.omitidos?` · ${result.omitidos} envío(s) ya existían`:''}.`);
          return result;
        }catch(error){toast('No se pudo enviar el aviso',translateError(error),'error');return null;}
      });
    };
  }
  async function readNotification(id){try{const result=await api.request('readNotification',{id});if(result&&!result.persistenciaConfirmada)throw new Error('LECTURA_NOTIFICACION_NO_CONFIRMADA');notificationCenterState.notifications=(notificationCenterState.notifications||[]).filter(row=>String(row.ID)!==String(id));knownNotificationIds.delete(String(id));invalidarListasFormulario('notifications');cacheVistasModulo.delete('notifications');cacheVistasModulo.delete('dashboard');closeModal();await refreshNotificationBadge();if(currentSection==='notifications'||currentSection==='dashboard')actualizarSeccionEnSegundoPlano(currentSection);toast('Notificación leída','El estado quedó confirmado en la base central.');}catch(error){toast('No se pudo actualizar',translateError(error),'error');}}
  async function readAlert(id){try{const result=await api.request('readAlert',{id});if(result&&!result.persistenciaConfirmada)throw new Error('LECTURA_ALERTA_NO_CONFIRMADA');notificationCenterState.alerts=(notificationCenterState.alerts||[]).filter(row=>String(row.ID)!==String(id));knownAlertIds.delete(String(id));invalidarListasFormulario('alerts');cacheVistasModulo.delete('alerts');cacheVistasModulo.delete('dashboard');closeModal();await refreshNotificationBadge();toast('Alerta validada y cerrada','La validación del Administrador quedó confirmada en la base central.');if(currentSection==='alerts'||currentSection==='dashboard')actualizarSeccionEnSegundoPlano(currentSection);}catch(error){toast('No se pudo cerrar la alerta',translateError(error),'error');}}
  async function markAllAlertsRead(){if(!hasPermission('ALERTAS','CERRAR'))throw new Error('PERMISO_DENEGADO');const rows=deduplicarAvisos((cacheListasFormulario.get('alerts')||[]).filter(row=>!['SI','TRUE','1'].includes(String(row.LEIDA??row.leida??'NO').trim().toUpperCase())),'alert');for(const row of rows)await api.request('readAlert',{id:row.ID});invalidarListasFormulario('alerts');cacheVistasModulo.delete('alerts');cacheVistasModulo.delete('dashboard');await refreshNotificationBadge();toast('Alertas cerradas',`${rows.length} alerta(s) validada(s) por el Administrador.`);actualizarSeccionEnSegundoPlano('alerts');}
  function systemDiagnosticMarkup(data){const modules=data?.modules||{};const entries=Object.entries(modules);const issues=entries.filter(([,item])=>item.estado!=='OK');return `<div class="system-health-summary ${issues.length?'warning':'ok'}"><i>${issues.length?'!':'✓'}</i><div><b>${issues.length?`${issues.length} elementos requieren atención`:'Estructura lista para operar'}</b><span>Versión ${esc(data?.version||'—')} · ${fmtDate(data?.fecha||new Date(),true)}</span></div></div><div class="system-health-grid">${entries.map(([key,item])=>`<article class="${item.estado==='OK'?'ok':'warning'}"><span>${esc(item.nombre||key)}</span><b>${esc(item.estado||'REVISAR')}</b><small>${esc(item.detalle||'')}</small></article>`).join('')}</div>`;}
  async function runSystemDiagnostic(){try{const result=await api.request('diagnoseSystem',{cache:false,force:true});const node=$('#systemHealthResult'),statusNode=$('#systemHealthStatus');if(node)node.innerHTML=systemDiagnosticMarkup(result);if(statusNode){const issues=Object.values(result.modules||{}).filter(item=>item.estado!=='OK').length;statusNode.textContent=issues?'Requiere atención':'Sistema correcto';statusNode.className=`status ${issues?'warning':'ok'}`;}toast('Diagnóstico completado',result.correcto?'Los módulos críticos están listos.':'Se encontraron elementos que pueden repararse desde esta pantalla.',result.correcto?'success':'error');return result;}catch(error){toast('No se pudo diagnosticar',translateError(error),'error');throw error;}}
  async function repairSystem(){try{const result=await api.request('repairSystem',{});api.invalidate();invalidarListasFormulario();cacheVistasModulo.clear();const node=$('#systemHealthResult'),statusNode=$('#systemHealthStatus');if(node)node.innerHTML=systemDiagnosticMarkup(result.diagnostico||result);if(statusNode){statusNode.textContent='Estructura reparada';statusNode.className='status ok';}toast('Sistema reparado','Se verificaron hojas, columnas, permisos y catálogos sin borrar información.');return result;}catch(error){toast('No se pudo reparar',translateError(error),'error');throw error;}}

  function updateInlineCheckinProgress(form) {
    const answered=checkinCatalog.filter(item=>form.querySelector(`input[name="checkin_${item.id}"]:checked`)).length;
    const count=$('[data-checkin-progress-count]');if(count)count.textContent=`${answered} / ${checkinCatalog.length}`;
    const bar=$('[data-checkin-progress-bar]');if(bar)bar.style.width=`${Math.round(answered/checkinCatalog.length*100)}%`;
    checkinCatalog.forEach(item=>{
      const selected=form.querySelector(`input[name="checkin_${item.id}"]:checked`),card=form.querySelector(`[data-checkin-control="${item.id}"]`),state=form.querySelector(`[data-checkin-state="${item.id}"]`);
      card?.classList.toggle('answered',Boolean(selected));card?.classList.toggle('failed',selected?.value==='FALLA');
      if(state){state.textContent=selected?.value==='OK'?'Conforme':selected?.value==='FALLA'?'Con falla':selected?.value==='NA'?'No aplica':'Sin revisar';state.className=`checkin-control-state ${selected?.value==='FALLA'?'failed':selected?'done':''}`;}
      const note=form.querySelector(`[data-checkin-note="${item.id}"]`);if(note)note.required=selected?.value==='FALLA';
    });
  }

  async function submitInlineCheckin(form) {
    const button=$('button[type="submit"]',form),data=Object.fromEntries(new FormData(form).entries());
    const incomplete=checkinCatalog.filter(item=>!form.querySelector(`input[name="checkin_${item.id}"]:checked`));
    if(incomplete.length){toast('Faltan controles por revisar',`Complete los ${incomplete.length} controles pendientes antes de guardar.`,'error');form.querySelector(`[data-checkin-control="${incomplete[0].id}"]`)?.scrollIntoView({behavior:'smooth',block:'center'});return;}
    const missingNotes=checkinCatalog.filter(item=>form.querySelector(`input[name="checkin_${item.id}"]:checked`)?.value==='FALLA'&&!form.querySelector(`[data-checkin-note="${item.id}"]`)?.value.trim());
    if(missingNotes.length){toast('Describa las fallas',`Agregue una observación en ${missingNotes.length} control(es) marcados con falla.`,'error');form.querySelector(`[data-checkin-control="${missingNotes[0].id}"]`)?.scrollIntoView({behavior:'smooth',block:'center'});return;}
    data.LISTA_CODIFICADA=JSON.stringify(checkinCatalog.map(item=>({id:item.id,item:item.item,categoria:item.categoria,critico:item.critico,respuesta:form.querySelector(`input[name="checkin_${item.id}"]:checked`)?.value||'',observacion:form.querySelector(`[data-checkin-note="${item.id}"]`)?.value||''})));
    if(String(currentUser?.ROL_ID||'').toUpperCase()==='ROL-CONDUCTOR'&&!data.AUTORIZACION_QR){toast('QR obligatorio','Escanee el código QR del vehículo asignado antes de abrir y guardar el check-in.','error');openQr('checkin');return;}
    data.SOLICITUD_CLIENTE_ID=form.dataset.solicitudClienteId||crearSolicitudClienteCheckin();
    form.dataset.solicitudClienteId=data.SOLICITUD_CLIENTE_ID;
    await conCargaBoton(button,'Guardando en la base…',async()=>{try{
      const result=await api.request('createVehicleCheckin',{data});
      if(!result.row?.ID)throw new Error('CHECKIN_RESPUESTA_SIN_IDENTIFICADOR');
      const persistencia=result.persistencia || (api.isRemote()?'CENTRAL_CONFIRMADA':'LOCAL');
      const confirmacionCentral=result.persistenciaConfirmada===true||result.persistencia==='CENTRAL_CONFIRMADA';if(api.isRemote()&&!confirmacionCentral)throw new Error('CHECKIN_NO_CONFIRMADO_EN_BASE_CENTRAL');
      guardarReciboCheckin(result.row,persistencia);
      const confirmado=await confirmarCheckinVisible(result.row);
      guardarReciboCheckin(confirmado,persistencia);
      const state=confirmado.ESTADO_REVISION||'Registrado',isCentral=persistencia==='CENTRAL_CONFIRMADA';
      toast(state==='Pendiente'?'Check-in enviado a revisión':'Check-in guardado y visible',`${isCentral?'Base central confirmada':'Almacenamiento local'} · ${confirmado.ID}. ${state==='Aprobado'?'La inspección quedó aprobada y vigente.':'Existe al menos un No conforme: Operador, Administrador o Gerencia debe aprobar o anular esta inspección.'}`,state==='Pendiente'?'warning':'success');
      form.dataset.solicitudClienteId='';checkinQrVehiculoValidado=null;
      const pendiente=leerJsonLocal(pendingRouteCheckinKey);if(state==='Aprobado'&&pendiente?.RUTA_ID&&String(pendiente.VEHICULO_ID||'')===String(confirmado?.VEHICULO_ID||'')&&String(pendiente.CONDUCTOR_ID||'')===String(confirmado?.CONDUCTOR_ID||'')){try{localStorage.removeItem(pendingRouteCheckinKey);}catch(_){}setTimeout(async()=>{navigateSection('routes');try{const inicio=await iniciarRutaConSeguimiento(pendiente.RUTA_ID);toast('Ruta iniciada','Check-in diario confirmado y GPS de ruta activado.');invalidarListasFormulario('routes','operations','checkins');cacheVistasModulo.delete('routes');programarNavegacionRutaPlanificada(inicio.row||{ID:pendiente.RUTA_ID});}catch(e){toast('Check-in guardado',translateError(e),'error');}},350);}
    }catch(error){
      const code=String(error?.message||error||'');
      const detail=code.includes('CHECKIN_NO_CONFIRMADO')?'El servidor respondió, pero no confirmó el registro del check-in. Recargue antes de intentar nuevamente para evitar duplicados.':translateError(error);
      toast('No se pudo confirmar el guardado',detail,'error');
    }});
  }

  function bindInlineCheckinForm(form) {
    form.addEventListener('change',()=>updateInlineCheckinProgress(form));
    const campoVehiculo=form.elements.namedItem('VEHICULO_ID');
    if(campoVehiculo&&typeof campoVehiculo.addEventListener==='function')campoVehiculo.addEventListener('change',()=>{if(form.dataset.qrVehicleId&&String(campoVehiculo.value)!==String(form.dataset.qrVehicleId)){form.dataset.qrVehicleId='';if(form.elements.AUTORIZACION_QR)form.elements.AUTORIZACION_QR.value='';$('[data-checkin-qr-notice]',form)?.classList.add('hidden');}});
    form.querySelector('[data-checkin-all-ok]')?.addEventListener('click',()=>{checkinCatalog.forEach(item=>{const input=form.querySelector(`input[name="checkin_${item.id}"][value="OK"]`);if(input)input.checked=true;});updateInlineCheckinProgress(form);});
    form.querySelector('[data-checkin-clear]')?.addEventListener('click',()=>{form.querySelectorAll('input[type="radio"]').forEach(input=>input.checked=false);form.querySelectorAll('[data-checkin-note]').forEach(input=>{input.value='';input.required=false;});updateInlineCheckinProgress(form);});
    form.addEventListener('submit',event=>{event.preventDefault();submitInlineCheckin(form);});
    updateInlineCheckinProgress(form);
  }

  function aplicarVehiculoQrCheckin(vehicle) {
    const driverProfile=String(currentUser?.ROL_ID||'').toUpperCase()==='ROL-CONDUCTOR';
    if(driverProfile){
      const asignado=listaFormulario('vehicles')[0];
      if(!asignado||String(asignado.ID)!==String(vehicle?.ID||'')){checkinQrVehiculoValidado=null;toast('QR no corresponde','El QR escaneado no pertenece al vehículo actualmente asignado a este conductor.','error');return;}
      if(!vehicle?.AUTORIZACION_QR){checkinQrVehiculoValidado=null;toast('QR no autorizado','El servidor no entregó autorización para abrir el check-in. Escanee nuevamente.','error');return;}
      checkinQrVehiculoValidado={...vehicle};guardarRegistro('vehicles',vehicle);
      const gate=$('[data-checkin-qr-gate]');if(gate){gate.outerHTML=checkinInlineFormMarkup();const nuevo=$('#checkinInlineForm');if(nuevo)bindInlineCheckinForm(nuevo);}
    }
    const form=$('#checkinInlineForm');
    if(!form){openCheckinModal(vehicle);return;}
    const select=form.querySelector('select[name="VEHICULO_ID"],select[name="VEHICULO_ID_VISTA"]'),campoEnvio=form.elements.namedItem('VEHICULO_ID');
    if(select&&!Array.from(select.options).some(option=>String(option.value)===String(vehicle.ID)))select.add(new Option(`${vehicle.PATENTE||vehicle.ID} · ${vehicle.MARCA||''} ${vehicle.MODELO||''}`.trim(),vehicle.ID));
    form.dataset.qrVehicleId=vehicle.ID;
    if(select){select.value=vehicle.ID;select.dataset.selected=vehicle.ID;select.dispatchEvent(new Event('change',{bubbles:true}));}
    if(campoEnvio&&'value' in campoEnvio)campoEnvio.value=vehicle.ID;
    if(form.elements.AUTORIZACION_QR)form.elements.AUTORIZACION_QR.value=vehicle.AUTORIZACION_QR||vehicle.autorizacionQr||'';
    if(form.elements.KILOMETRAJE&&!form.elements.KILOMETRAJE.value&&vehicle.KILOMETRAJE!==''&&vehicle.KILOMETRAJE!=null)form.elements.KILOMETRAJE.value=vehicle.KILOMETRAJE;
    const notice=$('[data-checkin-qr-notice]',form);if(notice){notice.classList.remove('hidden');notice.innerHTML=`<i>▦</i><div><b>QR validado: ${esc(vehicle.PATENTE||vehicle.ID)}</b><span>Vehículo correcto. La lista quedó habilitada durante 5 minutos para esta inspección.</span></div>`;}
    form.scrollIntoView({behavior:'smooth',block:'start'});toast('Vehículo validado',`${vehicle.PATENTE||vehicle.ID} coincide con la asignación del conductor. Ya puede completar el check-in.`);
  }
  function checkinItemsMarkup() {
    const groups={};checkinCatalog.forEach(item=>(groups[item.categoria]||(groups[item.categoria]=[])).push(item));
    return Object.entries(groups).map(([category,items])=>`<fieldset class="checkin-group full"><legend>${esc(category)}</legend>${items.map(item=>`<div class="checkin-item"><div class="checkin-item-copy"><b>${esc(item.item)}</b><span class="${item.critico?'critical-label':''}">${item.critico?'Crítico · requiere conformidad':'Control complementario'}</span></div><label><span>Resultado</span><select data-checkin-item="${esc(item.id)}" required><option value="">Seleccione</option><option value="OK">✓ Conforme</option><option value="FALLA">! No conforme</option></select></label><label class="checkin-observation"><span>Observación</span><input data-checkin-note="${esc(item.id)}" placeholder="Detalle opcional"></label></div>`).join('')}</fieldset>`).join('');
  }
  function openAssignCheckinVehicleModal(){
    if(!hasPermission('CHECKIN','ASIGNAR_VEHICULO'))return;invalidarListasFormulario('drivers','vehicles');$('#modalEyebrow').textContent='CHECK-IN';$('#modalTitle').textContent='Asignar vehículo al conductor';
    $('#modalBody').innerHTML=`<form class="form-grid" id="assignCheckinVehicleForm"><div class="tracking-notice active full"><i>🔔</i><div><b>Alerta emergente individual</b><span>El conductor recibirá el vehículo asignado, retiro de llave y obligación de completar el check-in.</span></div></div><label class="field"><span>Conductor</span>${selectorDinamico('drivers','checkinAssignDrivers','CONDUCTOR_ID','',true)}</label><label class="field"><span>Vehículo disponible</span>${selectorDinamico('vehicles','checkinAssignVehicles','VEHICULO_ID','',true)}</label><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn primary" type="submit">Asignar y enviar alerta</button></div></form>`;
    const token=openModal(),form=$('#assignCheckinVehicleForm');$('[data-cancel-modal]',$('#modalBody')).onclick=closeModal;form.onsubmit=event=>{event.preventDefault();const button=$('button[type="submit"]',form),data=Object.fromEntries(new FormData(form).entries());conCargaBoton(button,'Asignando…',async()=>{try{await api.request('assignCheckinVehicle',{data});invalidarListasFormulario('vehicles','drivers','notifications','checkins');cacheVistasModulo.delete('checkin');cacheVistasModulo.delete('dashboard');closeModal();toast('Vehículo asignado','La alerta emergente fue enviada únicamente al conductor seleccionado.');actualizarSeccionEnSegundoPlano('checkin');}catch(error){toast('No se pudo asignar el vehículo',translateError(error),'error');}});};prepararListasModal(token,['drivers','vehicles']);
  }
  function openCheckinModal(prefillVehicle=null) {
    const driverProfile=String(currentUser?.ROL_ID||'').toUpperCase()==='ROL-CONDUCTOR';if(driverProfile&&(!prefillVehicle?.AUTORIZACION_QR||String(prefillVehicle?.ID||'')!==String(listaFormulario('vehicles')[0]?.ID||''))){toast('QR obligatorio','El conductor debe escanear el QR físico de su vehículo asignado para mostrar la lista de check-in.','error');openQr('checkin');return;}
    const qrVehicle=prefillVehicle&&typeof prefillVehicle==='object'?prefillVehicle:null,selectedVehicle=qrVehicle?.ID||'';
    if(qrVehicle)guardarRegistro('vehicles',qrVehicle);
    $('#modalEyebrow').textContent='SEGURIDAD PREOPERACIONAL';$('#modalTitle').textContent='Realizar check-in vehicular';
    $('#modalBody').innerHTML=`<form class="form-grid checkin-form" id="checkinForm">${qrVehicle?`<div class="tracking-notice active full"><i>▦</i><div><b>QR validado: ${esc(qrVehicle.PATENTE||qrVehicle.ID)}</b><span>${esc([qrVehicle.MARCA,qrVehicle.MODELO].filter(Boolean).join(' ')||'Vehículo seleccionado para la revisión')}</span></div></div><input type="hidden" name="AUTORIZACION_QR" value="${esc(qrVehicle.AUTORIZACION_QR||'')}">`:''}<div class="tracking-notice active full"><i>✓</i><div><b>Inspección obligatoria antes de la operación</b><span>Complete los 18 controles. Cualquier opción No conforme requiere decisión de Operador, Administración o Gerencia antes de continuar.</span></div></div><label class="field"><span>Vehículo</span>${selectorDinamico('vehicles','checkinVehicles','VEHICULO_ID',selectedVehicle,true)}</label><label class="field"><span>Conductor</span>${selectorDinamico('drivers','checkinDrivers','CONDUCTOR_ID',currentUser.CONDUCTOR_ID||'',true)}</label><label class="field"><span>Kilometraje actual</span><input name="KILOMETRAJE" type="number" min="0" value="${esc(qrVehicle?.KILOMETRAJE??'')}" required inputmode="numeric"></label><label class="field"><span>Nivel de combustible/carga</span><select name="NIVEL_COMBUSTIBLE" required><option value="">Seleccione</option><option>Vacío / crítico</option><option>1/4</option><option>1/2</option><option>3/4</option><option>Lleno</option><option>No aplica</option></select></label>${checkinItemsMarkup()}<label class="field full"><span>Observaciones generales</span><textarea name="OBSERVACIONES" placeholder="Indique ruidos, daños, testigos del tablero u otras condiciones"></textarea></label><label class="field full"><span>Nombre o firma del conductor</span><input name="FIRMA_CONDUCTOR" value="${esc(currentUser.NOMBRE||'')}" required></label><label class="checkin-confirm full"><input type="checkbox" name="CONFIRMACION_CONDUCTOR" value="SI" required><span>Confirmo que realicé personalmente esta inspección y que la información es correcta.</span></label><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn primary" type="submit">Guardar y evaluar check-in</button></div></form>`;
    const token=openModal();$('[data-cancel-modal]',$('#modalBody')).onclick=closeModal;prepararListasModal(token,['vehicles','drivers']);
    $('#checkinForm').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=$('button[type="submit"]',form),data=Object.fromEntries(new FormData(form).entries());const list=checkinCatalog.map(item=>({id:item.id,item:item.item,categoria:item.categoria,critico:item.critico,respuesta:$(`[data-checkin-item="${item.id}"]`,form)?.value||'',observacion:$(`[data-checkin-note="${item.id}"]`,form)?.value||''}));data.LISTA_CODIFICADA=JSON.stringify(list);await conCargaBoton(button,'Evaluando…',async()=>{try{const result=await api.request('createVehicleCheckin',{data});const persistencia=result.persistencia||(api.isRemote()?'CENTRAL_CONFIRMADA':'LOCAL');guardarReciboCheckin(result.row,persistencia);const confirmado=await confirmarCheckinVisible(result.row);guardarReciboCheckin(confirmado,persistencia);closeModal();const state=confirmado?.ESTADO_REVISION||'Registrado';toast(state==='Aprobado'?'Check-in aprobado':'Check-in enviado a revisión',state==='Aprobado'?'La inspección quedó aprobada y lista para la continuidad operacional.':'Existe al menos una opción No conforme. Operador, Administración o Gerencia debe aprobar o anular la inspección.','success');const pendiente=leerJsonLocal(pendingRouteCheckinKey);if(state==='Aprobado'&&pendiente?.RUTA_ID&&String(pendiente.VEHICULO_ID||'')===String(confirmado?.VEHICULO_ID||'')&&String(pendiente.CONDUCTOR_ID||'')===String(confirmado?.CONDUCTOR_ID||'')){try{localStorage.removeItem(pendingRouteCheckinKey);}catch(_){}setTimeout(async()=>{navigateSection('routes');try{const inicio=await iniciarRutaConSeguimiento(pendiente.RUTA_ID);toast('Ruta iniciada','Check-in diario confirmado y GPS de ruta activado.');invalidarListasFormulario('routes','operations','checkins');cacheVistasModulo.delete('routes');programarNavegacionRutaPlanificada(inicio.row||{ID:pendiente.RUTA_ID});}catch(e){toast('Check-in guardado',translateError(e),'error');}},350);}}catch(error){toast('No se pudo guardar el check-in',translateError(error),'error');}});};
  }
  function checkinDetailMarkup(row) {
    const vehicle=registroFormulario('vehicles',row.VEHICULO_ID),driver=registroFormulario('drivers',row.CONDUCTOR_ID),items=parseCheckinItems(row),control=puedeVerTrazabilidadRutas(),state=String(row.ESTADO_REVISION||'');
    const pending=control&&['Pendiente','Bloqueado'].includes(state)&&row.UTILIZADO!=='SI',ready=control&&state==='Aprobado'&&new Date(row.VIGENTE_HASTA||0).getTime()>Date.now();
    const actions=`${pending?`<button class="btn danger" type="button" data-review-checkin-inspection="${esc(row.ID)}">Revisar · Aprobar o Anular</button>`:''}${ready?`<button class="btn primary" type="button" data-assign-route-from-checkin="${esc(row.ID)}">➜ Asignar ruta ahora</button>`:''}<button class="btn soft" type="button" data-cancel-modal>Cerrar</button>`;
    return `<div class="checkin-detail"><div class="info-grid"><div class="info-item"><span>Check-in</span><b>${esc(row.ID)}</b></div><div class="info-item"><span>Estado</span><b>${status(checkinVisualState(row))}</b></div><div class="info-item"><span>Vehículo</span><b>${esc(vehicle?.PATENTE||row.VEHICULO_ID)}</b></div><div class="info-item"><span>Conductor</span><b>${esc(driver?.NOMBRE||row.CONDUCTOR_ID)}</b></div><div class="info-item"><span>Fecha</span><b>${fmtDate(row.FECHA_HORA,true)}</b></div><div class="info-item"><span>Vigencia</span><b>${fmtDate(row.VIGENTE_HASTA,true)}</b></div><div class="info-item"><span>Kilometraje</span><b>${number(row.KILOMETRAJE)} km</b></div><div class="info-item"><span>Combustible/carga</span><b>${esc(row.NIVEL_COMBUSTIBLE||'—')}</b></div></div><div class="checkin-detail-list">${items.map(item=>`<article class="${item.respuesta==='FALLA'?'failed':''}"><i>${item.respuesta==='OK'?'✓':item.respuesta==='NA'?'—':'!'}</i><div><b>${esc(item.item)}</b><span>${esc(item.categoria)} · ${item.critico?'Crítico':'Complementario'}</span>${item.observacion?`<small>${esc(item.observacion)}</small>`:''}</div>${status(item.respuesta)}</article>`).join('')}</div>${row.OBSERVACIONES?`<div class="checkin-comment"><b>Observaciones generales</b><p>${esc(row.OBSERVACIONES)}</p></div>`:''}${row.COMENTARIO_REVISION?`<div class="checkin-comment"><b>Comentario de revisión</b><p>${esc(row.COMENTARIO_REVISION)}</p></div>`:''}<div class="form-actions">${actions}</div></div>`;
  }
  function openCheckinDetailModal(id,options={}) {
    const row=registroFormulario('checkins',id);$('#modalEyebrow').textContent='DETALLE DE INSPECCIÓN';$('#modalTitle').textContent=id;$('#modalBody').innerHTML=row?checkinDetailMarkup(row):contenidoCargaModal('Cargando check-in…');const token=openModal();
    const bind=current=>{const body=$('#modalBody'),close=$('[data-cancel-modal]',body);if(close)close.onclick=closeModal;$('[data-review-checkin-inspection]',body)?.addEventListener('click',()=>openCheckinReviewModal(current.ID,true,options));$('[data-assign-route-from-checkin]',body)?.addEventListener('click',()=>{const item={ID:options?.notificacion?.ID||'',CHECKIN_ID:current.ID,CONDUCTOR_ID:current.CONDUCTOR_ID,VEHICULO_ID:current.VEHICULO_ID};closeModal();abrirAsignacionDesdeCheckin(item);});};
    if(row){bind(row);return;}
    api.request('get',{resource:'checkins',id}).then(result=>{if(token!==secuenciaModal)return;guardarRegistro('checkins',result.row);$('#modalBody').innerHTML=checkinDetailMarkup(result.row);bind(result.row);}).catch(error=>{if(token!==secuenciaModal)return;$('#modalBody').innerHTML=`<div class="modal-error"><b>No se pudo cargar el check-in</b><p>${esc(translateError(error))}</p><button class="btn soft" data-cancel-modal>Cerrar</button></div>`;const close=$('[data-cancel-modal]',$('#modalBody'));if(close)close.onclick=closeModal;});
  }
  function openCheckinReviewModal(id,volverDetalle=false,options={}) {
    const row=registroFormulario('checkins',id);if(!row){openCheckinDetailModal(id);return;}
    $('#modalEyebrow').textContent='DECISIÓN DE SEGURIDAD';$('#modalTitle').textContent=`Revisar ${id}`;
    const noConforme=Number(row.FALLAS_CRITICAS||0)>0||Number(row.FALLAS_LEVES||0)>0;
    $('#modalBody').innerHTML=`<div class="checkin-review">${checkinDetailMarkup(row).replace(/<div class="form-actions">[\s\S]*?<\/div><\/div>$/,'')}</div>${noConforme?'<div class="tracking-notice warning full"><i>!</i><div><b>Check-in No conforme</b><span>Puede Aprobarlo bajo responsabilidad administrativa o Anularlo. La decisión, usuario, rol, fecha y comentario quedarán auditados.</span></div></div>':''}<label class="field"><span>Comentario obligatorio</span><textarea id="checkinReviewComment" required placeholder="Indique motivo, medidas y condiciones de la decisión"></textarea></label><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn danger" type="button" data-checkin-decision="ANULAR">Anular check-in</button><button class="btn primary" type="button" data-checkin-decision="APROBAR">${noConforme?'Aprobar No conforme':'Aprobar check-in'}</button></div></div>`;
    openModal();$('[data-cancel-modal]',$('#modalBody')).onclick=closeModal;$$('[data-checkin-decision]',$('#modalBody')).forEach(button=>button.onclick=()=>conCargaBoton(button,button.dataset.checkinDecision==='APROBAR'?'Aprobando…':'Anulando…',async()=>{const comment=$('#checkinReviewComment').value.trim();if(!comment){toast('Comentario requerido','Explique la decisión tomada.','error');return;}try{const result=await api.request('reviewVehicleCheckin',{id,data:{CHECKIN_ID:id,DECISION:button.dataset.checkinDecision,COMENTARIO_REVISION:comment}});if(result.row)guardarRegistro('checkins',result.row);if(options?.notificacion?.ID){try{await api.request('readNotification',{id:options.notificacion.ID});}catch(_){}}invalidarListasFormulario('checkins','notifications');['checkin','checkinApprovals','checkinHistory','operations','dashboard'].forEach(section=>cacheVistasModulo.delete(section));closeModal();toast('Check-in revisado',button.dataset.checkinDecision==='APROBAR'?'La inspección quedó aprobada. Desde el detalle puede ir directamente a Asignación de Ruta.':'El check-in fue anulado y el conductor deberá realizar una nueva inspección.',button.dataset.checkinDecision==='APROBAR'?'success':'warning');if(volverDetalle||result.row)setTimeout(()=>openCheckinDetailModal(id),80);else actualizarSeccionEnSegundoPlano(currentSection);}catch(error){toast('No se pudo revisar',translateError(error),'error');}}));
  }
  async function refreshOperationCheckins(form) {
    const vehicle=form.elements.VEHICULO_ID?.value||'',driver=form.elements.CONDUCTOR_ID?.value||'',select=form.elements.CHECKIN_ID;if(!select)return;
    if(!vehicle||!driver){select.innerHTML='<option value="">Seleccione primero vehículo y conductor</option>';select.disabled=true;return;}
    select.disabled=true;select.innerHTML='<option value="">Buscando check-ins aprobados…</option>';
    try{const result=await api.request('availableCheckins',{data:{VEHICULO_ID:vehicle,CONDUCTOR_ID:driver},cache:false});const rows=result.rows||[];select.innerHTML=`<option value="">${rows.length?'Seleccione check-in aprobado':'No hay check-in vigente para esta combinación'}</option>${rows.map(row=>`<option value="${esc(row.ID)}">${esc(row.ID)} · ${fmtDate(row.FECHA_HORA,true)} · vigente hasta ${fmtDate(row.VIGENTE_HASTA,true)}</option>`).join('')}`;select.disabled=false;}catch(error){select.innerHTML='<option value="">No fue posible consultar check-ins</option>';select.disabled=true;toast('No se pudieron consultar los check-ins',translateError(error),'error');}
  }

  async function configurarPuntoOperacionRapido(button=null,{reabrirOperacion=false,prefillVehicle=null}={}){
    if(!puedeAdministrarPuntoOperacion())throw new Error('PERMISO_DENEGADO');
    const execute=async()=>{
      const location=await obtenerUbicacionNavegador({timeout:30000,maximumAge:0,aceptarRespaldo:false,maximumAgeAproximada:0});
      const data={
        PUNTO_OPERACION_NOMBRE:currentCompany?.PUNTO_OPERACION_NOMBRE||'Base operacional',
        PUNTO_OPERACION_DIRECCION:currentCompany?.PUNTO_OPERACION_DIRECCION||currentCompany?.DIRECCION||`Coordenadas ${location.latitud.toFixed(6)}, ${location.longitud.toFixed(6)}`,
        PUNTO_OPERACION_LATITUD:location.latitud,
        PUNTO_OPERACION_LONGITUD:location.longitud,
        RADIO_INICIO_METROS:currentCompany?.RADIO_INICIO_METROS||150,
        RADIO_FIN_METROS:currentCompany?.RADIO_FIN_METROS||150,
        PRECISION_GPS_MAXIMA_METROS:Math.max(120,Math.ceil(Number(location.precision||0)+30)),
        VALIDAR_UBICACION_OPERACION:'SI',RETORNO_BASE_OBLIGATORIO:'SI'
      };
      data.IP_PUBLICA=clientPublicIp;const result=await api.request('saveOperationalPoint',{data});
      const devicePoint=guardarPuntoOperacionDispositivo({...result,row:result.row||data},'SERVIDOR');currentCompany={...(currentCompany||{}),...(result.row||data),...(devicePoint||{})};
      const base=configuracionPuntoOperacion(currentCompany);if(!result.confirmado||!base.configurada)throw new Error('PUNTO_OPERACION_NO_CONFIRMADO');
      invalidarListasFormulario('companies');['settings','operations','routes','gps','dashboard'].forEach(section=>cacheVistasModulo.delete(section));
      toast('Punto operacional listo',`${base.nombre} fue confirmado en la base central. Ya puede iniciar operaciones.`);
      if(reabrirOperacion){closeModal();setTimeout(()=>openOperationModal(prefillVehicle),50);}else actualizarSeccionEnSegundoPlano('operations');
      return result;
    };
    return button?conCargaBoton(button,'Configurando base…',execute):execute();
  }

  function openOperationModal(prefillVehicle=null) {
    const base=configuracionPuntoOperacion();
    if(!base.configurada){$('#modalEyebrow').textContent='CONFIGURACIÓN INICIAL';$('#modalTitle').textContent='Definir punto operacional';$('#modalBody').innerHTML=`<div class="modal-error operational-setup"><b>La base todavía no está confirmada</b><p>El punto operacional se utiliza únicamente para validar el inicio y el regreso. Un Administrador o Operador puede configurarlo ahora usando la ubicación actual del dispositivo.</p><div class="operation-policy-fixed"><i>⌖</i><div><b>Debe ejecutar este paso estando físicamente en la base</b><span>El sistema guardará las coordenadas y permitirá iniciar la operación inmediatamente.</span></div></div><div class="form-actions"><button class="btn soft" data-cancel-modal>Cerrar</button>${puedeAdministrarPuntoOperacion()?'<button class="btn soft" data-go-operation-settings>Configuración avanzada</button><button class="btn primary" data-setup-base-now>⌖ Usar ubicación actual y continuar</button>':''}</div></div>`;openModal();$('[data-cancel-modal]',$('#modalBody')).onclick=closeModal;$('[data-go-operation-settings]',$('#modalBody'))?.addEventListener('click',()=>{closeModal();navigateSection('settings');});$('[data-setup-base-now]',$('#modalBody'))?.addEventListener('click',event=>configurarPuntoOperacionRapido(event.currentTarget,{reabrirOperacion:true,prefillVehicle}).catch(error=>toast('No se configuró la base',translateError(error),'error')));return;}
    const prefillObject=typeof prefillVehicle==='object'&&prefillVehicle?prefillVehicle:null,prefillId=prefillObject?.ID||String(prefillVehicle||'');if(prefillObject)guardarRegistro('vehicles',prefillObject);
    const controlAlerta=['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'].includes(String(currentUser?.ROL_ID||'').toUpperCase())?`<label class="assignment-alert-switch full"><input type="checkbox" name="ENVIAR_ALERTA_ASIGNACION" value="SI" checked><i></i><span><b>Enviar alerta emergente</b><small>Administrador, Gerencia u Operador pueden omitirla; la voz depende de la preferencia del conductor.</small></span></label>`:'';
    $('#modalEyebrow').textContent='OPERACIÓN GEOVALIDADA';$('#modalTitle').textContent='Iniciar nueva operación';
    $('#modalBody').innerHTML=`<form class="form-grid" id="operationForm">${prefillObject?`<div class="tracking-notice active full"><i>✓</i><div><b>QR validado: ${esc(prefillObject.PATENTE)}</b><span>${esc(prefillObject.MARCA||'')} ${esc(prefillObject.MODELO||'')}</span></div></div><input type="hidden" name="AUTORIZACION_QR" value="${esc(prefillObject.AUTORIZACION_QR||'')}">`:''}<div class="operation-base-summary full"><i>⌖</i><div><b>${esc(base.nombre)}</b><span>${esc(base.direccion)} · inicio permitido en un radio de ${number(base.radioInicio)} m</span></div></div><div class="operation-checkin-required full"><i>✓</i><div><b>Check-in preoperacional obligatorio</b><span>Se reutiliza la inspección aprobada del día para el mismo vehículo y conductor.</span></div><button class="btn soft small" type="button" data-nav-checkin>Realizar check-in</button></div><label class="field"><span>Vehículo</span>${selectorDinamico('vehicles','operationVehicles','VEHICULO_ID',prefillId,true)}</label><label class="field"><span>Conductor</span>${selectorDinamico('drivers','operationDrivers','CONDUCTOR_ID',currentUser.CONDUCTOR_ID||'',true)}</label><label class="field full"><span>Check-in aprobado</span><select name="CHECKIN_ID" required disabled><option value="">Seleccione primero vehículo y conductor</option></select></label><label class="field full"><span>Ruta asignada</span><select name="RUTA_ID"><option value="">Sin ruta asignada · salida y regreso a base</option></select><small data-operation-type>Salida y regreso al mismo punto base</small></label><label class="field"><span>Origen obligatorio</span><input name="ORIGEN" value="${esc(base.direccion)}" readonly></label><label class="field"><span>Destino operacional</span><input name="DESTINO" value="${esc(base.direccion)}" readonly></label><label class="field"><span>KM inicial <small>(opcional)</small></span><input name="KM_INICIO" type="number" min="0" step="0.1" placeholder="Puede completarse después"><small>No bloquea el inicio ni la finalización.</small></label><label class="field full"><span>Observaciones</span><textarea name="OBSERVACIONES"></textarea></label>${controlAlerta}<input type="hidden" name="INICIO_LATITUD"><input type="hidden" name="INICIO_LONGITUD"><input type="hidden" name="INICIO_PRECISION"><div class="operation-location-status full" data-operation-location-status><i>⌖</i><div><b>Ubicación aún no validada</b><span>Pulse Capturar ubicación. El sistema registrará dónde se encuentra y permitirá iniciar.</span></div></div><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn soft" type="button" data-capture-operation-location>⌖ Capturar ubicación</button><button class="btn primary" type="submit">Iniciar operación</button></div></form>`;
    const token=openModal(),form=$('#operationForm');$('[data-cancel-modal]',$('#modalBody')).onclick=closeModal;$('[data-nav-checkin]',form).onclick=()=>{closeModal();navigateSection('checkin');};
    const updateDependencies=()=>{refreshOperationCheckins(form);rutasDisponiblesOperacion(form);};['VEHICULO_ID','CONDUCTOR_ID'].forEach(name=>form.elements[name]?.addEventListener('change',updateDependencies));form.elements.RUTA_ID?.addEventListener('change',()=>actualizarDestinoOperacion(form));
    $('[data-capture-operation-location]',form).onclick=event=>conCargaBoton(event.currentTarget,'Capturando ubicación…',async()=>{try{await capturarUbicacionFormularioOperacion(form,'INICIO');}catch(error){toast('No se pudo capturar la ubicación',translateError(error),'error');}});
    form.onsubmit=async event=>{event.preventDefault();const button=$('button[type="submit"]',form);await conCargaBoton(button,'Capturando e iniciando…',async()=>{try{let locationResult=null;if(!form.elements.INICIO_LATITUD.value)locationResult=await capturarUbicacionFormularioOperacion(form,'INICIO');else locationResult=resumenValidacionLocalUbicacion({latitud:Number(form.elements.INICIO_LATITUD.value),longitud:Number(form.elements.INICIO_LONGITUD.value),precision:Number(form.elements.INICIO_PRECISION.value),fuente:'Ubicación ya capturada'},base,'INICIO');const data=Object.fromEntries(new FormData(form).entries());data.ENVIAR_ALERTA_ASIGNACION=form.elements.ENVIAR_ALERTA_ASIGNACION?.checked?'SI':'NO';const result=await api.request('startOperation',{data});if(result.seguimiento?.activo)await activarSeguimientoRutaCliente(result.seguimiento);invalidarListasFormulario('operations','vehicles','drivers','history','checkins','routes');['operations','dashboard','checkin','checkinHistory','routes'].forEach(section=>cacheVistasModulo.delete(section));closeModal();const validation=result.locationValidation||{},outside=validation.DENTRO_PERIMETRO===false||locationResult.dentroPerimetro===false;toast('Operación iniciada',`${result.notificada?'Alerta emergente enviada al conductor; la voz respetará su preferencia. ':''}Ubicación capturada a ${Math.round(validation.DISTANCIA_METROS??locationResult.distancia)} m de la base${outside?' · inicio fuera de base registrado':''}.`,outside?'warning':'success');actualizarSeccionEnSegundoPlano('operations');}catch(error){toast('No se pudo iniciar',translateError(error),'error');}});};
    prepararListasModal(token,['vehicles','drivers','routes']);
    actualizarSelectoresModal(token);
    updateDependencies();
  }
  function openAdminEditOperationModal(id){
    if(!hasPermission('OPERACIONES','EDITAR_ADMIN'))return toast('Acceso restringido','No tiene permiso para editar operaciones administrativamente.','error');
    const operation=registroFormulario('operations',id)||(cacheListasFormulario.get('operations')||[]).find(row=>String(row.ID)===String(id));if(!operation)return toast('Operación no encontrada','Sincronice e intente nuevamente.','error');
    const vehicles=cacheListasFormulario.get('vehicles')||[],drivers=cacheListasFormulario.get('drivers')||[],routes=cacheListasFormulario.get('routes')||[];
    const vehicleOptions=vehicles.map(row=>`<option value="${esc(row.ID)}" ${row.ID===operation.VEHICULO_ID?'selected':''}>${esc(row.PATENTE||row.ID)} · ${esc(row.MARCA||'')} ${esc(row.MODELO||'')}</option>`).join('');
    const driverOptions=drivers.map(row=>`<option value="${esc(row.ID)}" ${row.ID===operation.CONDUCTOR_ID?'selected':''}>${esc(row.NOMBRE||row.ID)} · ${esc(row.RUT||'')}</option>`).join('');
    const routeOptions=`<option value="">Sin ruta</option>${routes.map(row=>`<option value="${esc(row.ID)}" ${row.ID===operation.RUTA_ID?'selected':''}>${esc(row.NOMBRE||row.ID)} · ${esc(row.ESTADO||'')}</option>`).join('')}`;
    $('#modalEyebrow').textContent='ADMINISTRACIÓN';$('#modalTitle').textContent=`Editar operación ${esc(operation.ID)}`;
    $('#modalBody').innerHTML=`<form class="form-grid" id="adminEditOperationForm"><div class="module-diagnostic warning full"><i>✎</i><div><b>Edición con trazabilidad completa</b><span>La ubicación GPS, validaciones y evidencias originales no se eliminan. Cada cambio queda en Historial y Auditoría.</span></div></div><label class="field"><span>Vehículo</span><select name="VEHICULO_ID" required>${vehicleOptions}</select></label><label class="field"><span>Conductor</span><select name="CONDUCTOR_ID" required>${driverOptions}</select></label><label class="field full"><span>Ruta vinculada</span><select name="RUTA_ID">${routeOptions}</select></label><label class="field"><span>Origen</span><input name="ORIGEN" value="${esc(operation.ORIGEN||'')}"></label><label class="field"><span>Destino</span><input name="DESTINO" value="${esc(operation.DESTINO||'')}"></label><label class="field"><span>Fecha y hora de inicio</span><input name="FECHA_INICIO" type="datetime-local" value="${esc(fechaInputLocal(operation.FECHA_INICIO))}"></label><label class="field"><span>Fecha y hora de finalización</span><input name="FECHA_FIN" type="datetime-local" value="${esc(fechaInputLocal(operation.FECHA_FIN))}" ${operation.ESTADO==='Activa'?'disabled':''}></label><label class="field"><span>KM inicial <small>(opcional)</small></span><input name="KM_INICIO" type="number" min="0" step="0.1" value="${operation.KM_INICIO!==''&&operation.KM_INICIO!=null?esc(operation.KM_INICIO):''}"></label><label class="field"><span>KM final <small>(opcional)</small></span><input name="KM_FIN" type="number" min="0" step="0.1" value="${operation.KM_FIN!==''&&operation.KM_FIN!=null?esc(operation.KM_FIN):''}"></label><label class="field full"><span>Observaciones</span><textarea name="OBSERVACIONES">${esc(operation.OBSERVACIONES||'')}</textarea></label><label class="field full"><span>Motivo de la edición <small>(opcional)</small></span><textarea name="MOTIVO_EDICION" placeholder="Puede indicar una corrección; si queda vacío se registrará como actualización administrativa"></textarea></label><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn primary" type="submit">Guardar cambios y auditar</button></div></form>`;
    openModal();const form=$('#adminEditOperationForm');$('[data-cancel-modal]',form).onclick=closeModal;form.onsubmit=async event=>{event.preventDefault();const button=$('button[type="submit"]',form);await conCargaBoton(button,'Guardando…',async()=>{try{const data=Object.fromEntries(new FormData(form).entries());data.IP_PUBLICA=clientPublicIp||await api.getClientIp?.().catch(()=> '')||'';await api.request('editOperationAdmin',{id,data});invalidarListasFormulario('operations','vehicles','drivers','routes','history','audit');['operations','dashboard','routes','history','audit'].forEach(section=>cacheVistasModulo.delete(section));closeModal();toast('Operación actualizada','Los cambios y valores anteriores quedaron registrados en auditoría.');actualizarSeccionEnSegundoPlano('operations');}catch(error){toast('No se pudo editar',translateError(error),'error');}});};
  }
  function openAdminDeleteOperationModal(id){
    if(!hasPermission('OPERACIONES','ELIMINAR_ADMIN'))return toast('Acceso restringido','No tiene permiso para eliminar operaciones administrativamente.','error');const operation=registroFormulario('operations',id)||(cacheListasFormulario.get('operations')||[]).find(row=>String(row.ID)===String(id));if(!operation)return toast('Operación no encontrada','Sincronice e intente nuevamente.','error');
    $('#modalEyebrow').textContent='ELIMINACIÓN ADMINISTRATIVA';$('#modalTitle').textContent=`Eliminar operación ${esc(operation.ID)}`;$('#modalBody').innerHTML=`<form class="form-grid" id="adminDeleteOperationForm"><div class="modal-error full"><b>La operación se ocultará del sistema operativo</b><p>No se borrarán la bitácora, el historial ni las evidencias GPS. Si está activa, el vehículo y conductor serán liberados.</p></div><label class="field full"><span>Motivo de eliminación</span><textarea name="MOTIVO_ELIMINACION" placeholder="Motivo administrativo o corrección de registro"></textarea></label><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn danger" type="submit">Eliminar y registrar auditoría</button></div></form>`;openModal();const form=$('#adminDeleteOperationForm');$('[data-cancel-modal]',form).onclick=closeModal;form.onsubmit=async event=>{event.preventDefault();const button=$('button[type="submit"]',form);await conCargaBoton(button,'Eliminando…',async()=>{try{const data=Object.fromEntries(new FormData(form).entries());data.IP_PUBLICA=clientPublicIp||await api.getClientIp?.().catch(()=> '')||'';await api.request('deleteOperationAdmin',{id,data});invalidarListasFormulario('operations','vehicles','drivers','routes','history','audit');['operations','dashboard','routes','history','audit'].forEach(section=>cacheVistasModulo.delete(section));closeModal();toast('Operación eliminada','El registro quedó eliminado lógicamente y respaldado en auditoría.','warning');actualizarSeccionEnSegundoPlano('operations');}catch(error){toast('No se pudo eliminar',translateError(error),'error');}});};
  }

  function openFinishOperationModal(id,button){
    const operation=registroFormulario('operations',id)||(cacheListasFormulario.get('operations')||[]).find(row=>row.ID===id);
    if(!operation)return toast('Operación no encontrada','Sincronice el módulo e inténtelo nuevamente.','error');
    const privileged=puedeCierreExcepcional();
    const driver=currentUser?.ROL_ID==='ROL-CONDUCTOR';
    const base=configuracionPuntoOperacion({...currentCompany,VALIDAR_UBICACION_OPERACION:'SI',PUNTO_OPERACION_NOMBRE:operation.BASE_NOMBRE||currentCompany?.PUNTO_OPERACION_NOMBRE,PUNTO_OPERACION_DIRECCION:operation.BASE_DIRECCION||operation.PUNTO_RETORNO||currentCompany?.PUNTO_OPERACION_DIRECCION,PUNTO_OPERACION_LATITUD:operation.BASE_LATITUD||currentCompany?.PUNTO_OPERACION_LATITUD,PUNTO_OPERACION_LONGITUD:operation.BASE_LONGITUD||currentCompany?.PUNTO_OPERACION_LONGITUD,RADIO_FIN_METROS:operation.RADIO_FIN_METROS||currentCompany?.RADIO_FIN_METROS,PRECISION_GPS_MAXIMA_METROS:operation.PRECISION_GPS_MAXIMA_METROS||currentCompany?.PRECISION_GPS_MAXIMA_METROS});
    $('#modalEyebrow').textContent=driver?'RETORNO OBLIGATORIO':'CIERRE CONTROLADO';
    $('#modalTitle').textContent=`Finalizar ${esc(id)}`;
    $('#modalBody').innerHTML=`<form class="form-grid" id="finishOperationForm">
      <div class="operation-base-summary full"><i>⌖</i><div><b>${driver?'El Conductor debe regresar a':'Punto de cierre normal:'} ${esc(base.nombre)}</b><span>${esc(base.direccion)} · radio permitido ${number(base.radioFin)} m</span></div></div>
      ${privileged?`<div class="exceptional-close-panel full"><label class="switch-line"><input type="checkbox" name="CIERRE_EXCEPCIONAL" value="SI" data-exceptional-close><span><b>Autorizar cierre excepcional fuera de la base</b><small>Solo Administrador o Operador. Se registrarán GPS, distancia, usuario, IP, fecha y motivo.</small></span></label><label class="field full" data-exceptional-reason hidden><span>Motivo obligatorio del cierre excepcional</span><textarea name="CIERRE_MOTIVO" minlength="10" placeholder="Explique por qué la operación debe cerrarse fuera de la base"></textarea></label></div>`:''}
      <label class="field"><span>KM final <small>(opcional)</small></span><input name="KM_FIN" type="number" min="0" step="0.1" placeholder="Ingrese el kilometraje si está disponible"><small>El cierre continuará aunque quede vacío o requiera revisión.</small></label>
      <label class="field full"><span>Observaciones de cierre</span><textarea name="OBSERVACIONES" placeholder="Novedades al finalizar"></textarea></label>
      <input type="hidden" name="FIN_LATITUD"><input type="hidden" name="FIN_LONGITUD"><input type="hidden" name="FIN_PRECISION">
      <div class="operation-location-status full" data-operation-location-status><i>⌖</i><div><b>Ubicación aún no validada</b><span>${driver?'Debe estar dentro de la base para finalizar.':'Valide el GPS. Fuera de la base deberá autorizar un cierre excepcional.'}</span></div></div>
      <div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn soft" type="button" data-capture-operation-location>⌖ Validar ubicación</button><button class="btn danger" type="submit">Finalizar operación</button></div>
    </form>`;
    openModal();
    const form=$('#finishOperationForm'),exceptionalBox=$('[data-exceptional-close]',form),reasonWrap=$('[data-exceptional-reason]',form);
    if(exceptionalBox)exceptionalBox.onchange=()=>{reasonWrap.hidden=!exceptionalBox.checked;const area=form.elements.CIERRE_MOTIVO;if(area)area.required=exceptionalBox.checked;};
    $('[data-cancel-modal]',form).onclick=closeModal;
    $('[data-capture-operation-location]',form).onclick=event=>conCargaBoton(event.currentTarget,'Validando GPS…',async()=>{try{await capturarUbicacionFormularioOperacion(form,'FIN');}catch(error){toast('No se validó la ubicación',translateError(error),'error');}});
    form.onsubmit=async event=>{event.preventDefault();const submit=$('button[type="submit"]',form);await conCargaBoton(submit,'Validando y finalizando…',async()=>{try{
      let locationResult=null;
      if(!form.elements.FIN_LATITUD.value)locationResult=await capturarUbicacionFormularioOperacion(form,'FIN');
      else locationResult=resumenValidacionLocalUbicacion({latitud:Number(form.elements.FIN_LATITUD.value),longitud:Number(form.elements.FIN_LONGITUD.value),precision:Number(form.elements.FIN_PRECISION.value)},base,'FIN');
      const outside=!locationResult.valida;
      if(outside&&driver)throw new Error('FUERA_DEL_PUNTO_DE_FINALIZACION');
      const exceptionalRequested=Boolean(exceptionalBox?.checked);
      if(outside&&privileged&&!exceptionalRequested)throw new Error('CIERRE_EXCEPCIONAL_CONFIRMACION_REQUERIDA');
      if(outside&&privileged&&String(form.elements.CIERRE_MOTIVO?.value||'').trim().length<10)throw new Error('CIERRE_EXCEPCIONAL_MOTIVO_REQUERIDO');
      if(!outside&&exceptionalBox)exceptionalBox.checked=false;
      const data=Object.fromEntries(new FormData(form).entries());
      data.CIERRE_EXCEPCIONAL=outside&&privileged?'SI':'NO';
      data.IP_PUBLICA=clientPublicIp||await api.getClientIp?.().catch(()=> '')||'';
      const result=await api.request('finishOperation',{id,data});
      if(result.seguimiento?.activo===false)detenerSeguimientoRutaCliente(result.seguimiento.RUTA_ID||'');
      invalidarListasFormulario('operations','vehicles','drivers','history','routes','alerts','audit');
      ['operations','dashboard','routes','history','alerts','audit'].forEach(section=>cacheVistasModulo.delete(section));
      closeModal();
      if(result.cierreExcepcional)toast('Cierre excepcional registrado',`Autorizado fuera de la base a ${Math.round(result.locationValidation?.DISTANCIA_METROS??locationResult.distancia)} m. La auditoría fue generada.`,'warning');
      else toast(result.locationValidation?.PRECISION_BAJA?'Operación finalizada con GPS impreciso':'Operación finalizada',`Retorno confirmado a ${Math.round(result.locationValidation?.DISTANCIA_METROS??locationResult.distancia)} m de la base${result.locationValidation?.PRECISION_BAJA?' · la precisión baja quedó registrada':''}.`,result.locationValidation?.PRECISION_BAJA?'warning':'success');
      actualizarSeccionEnSegundoPlano('operations');
      refreshNotificationBadge();
    }catch(error){toast('No se pudo finalizar',translateError(error),'error');}});};
  }
  async function finishOperation(id,button){openFinishOperationModal(id,button);}


  function antiguedadUbicacion(fecha) {
    const tiempo = new Date(fecha || 0).getTime();
    return Number.isFinite(tiempo) ? Date.now() - tiempo : Number.MAX_SAFE_INTEGER;
  }

  function distanciaMetros(lat1, lon1, lat2, lon2) {
    const radio = 6371000;
    const rad = valor => Number(valor) * Math.PI / 180;
    const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * radio * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function updateGpsFilterUi() {
    $$('[data-gps-scope]').forEach(button=>button.classList.toggle('active',button.dataset.gpsScope===gpsDraftTrackingMode));
    $$('[data-gps-connection]').forEach(button=>button.classList.toggle('active',button.dataset.gpsConnection===gpsDraftConnectionFilter));
    $('#vehicleTrackingPanel')?.classList.toggle('open',gpsDraftTrackingMode==='specific');
    const summary=$('#trackingSelectionSummary');if(summary)summary.textContent=`${gpsDraftTrackingMode==='all'?'Toda la flota':selectedVehiclesLabel()} · ${gpsConnectionFilterLabel(gpsDraftConnectionFilter)}`;
    $$('[data-gps-vehicle]').forEach(input=>{input.checked=gpsDraftSelectedVehicles.has(String(input.dataset.gpsVehicle));});
    const dirty=gpsFilterHasChanges();
    const pending=$('#trackingPendingText');if(pending)pending.textContent=dirty?'Hay cambios pendientes por aplicar.':'El mapa ya está usando este filtro.';
    const applied=$('#trackingAppliedSummary');if(applied)applied.textContent=`Filtro aplicado: ${appliedVehiclesLabel()}`;
    const apply=$('[data-gps-apply]');if(apply)apply.disabled=!dirty;
    const reset=$('[data-gps-reset]');if(reset)reset.disabled=!dirty;
  }
  function changeGpsTrackingScope(scope) {
    gpsDraftTrackingMode=scope==='specific'?'specific':'all';updateGpsFilterUi();
  }
  function changeGpsConnectionFilter(value) {
    gpsDraftConnectionFilter=estadosConexionGpsPermitidos.has(value)?value:'all';updateGpsFilterUi();
  }
  function toggleGpsVehicle(id,checked) {
    if(checked)gpsDraftSelectedVehicles.add(String(id));else gpsDraftSelectedVehicles.delete(String(id));
    gpsDraftTrackingMode='specific';updateGpsFilterUi();
  }
  function selectAllGpsVehicles() {
    (ultimoResumenGps.trackingVehicles||[]).forEach(vehicle=>gpsDraftSelectedVehicles.add(String(vehicle.ID)));
    gpsDraftTrackingMode='specific';updateGpsFilterUi();
  }
  function clearGpsVehicles() {
    gpsDraftSelectedVehicles.clear();gpsDraftTrackingMode='specific';updateGpsFilterUi();
  }
  function resetGpsVehicleFilterDraft() {
    gpsDraftTrackingMode=gpsTrackingMode;gpsDraftSelectedVehicles=new Set(gpsSelectedVehicles);gpsDraftConnectionFilter=gpsConnectionFilter;updateGpsFilterUi();
  }
  async function applyGpsVehicleFilter() {
    if(!canSelectGpsVehicles())return;
    gpsTrackingMode=gpsDraftTrackingMode;
    gpsSelectedVehicles=new Set(gpsDraftSelectedVehicles);
    gpsConnectionFilter=gpsDraftConnectionFilter;
    saveGpsFilterPreference();updateGpsFilterUi();
    const result=await refreshLocations(false,true);
    if(result)toast('Filtro de seguimiento aplicado',`${gpsTrackingMode==='all'?'Toda la flota':`${gpsSelectedVehicles.size} vehículos seleccionados`} · ${gpsConnectionFilterLabel()}.`);
  }
  function filterGpsVehicleOptions(value='') {
    const term=String(value).trim().toLowerCase();$$('[data-vehicle-filter-text]').forEach(node=>{node.hidden=Boolean(term)&&!node.dataset.vehicleFilterText.includes(term);});
  }
  function refreshGpsVehicleOptions(realtime) {
    const list=$('#vehicleTrackingList');if(!list)return;
    const key=(realtime.trackingVehicles||[]).map(vehicle=>`${vehicle.ID}:${vehicle.PATENTE}:${vehicle.MARCA}:${vehicle.MODELO}:${vehicle.ESTADO}:${vehicle.CONDUCTOR_NOMBRE||''}`).join('|');
    if(list.dataset.optionsKey!==key){list.dataset.optionsKey=key;list.innerHTML=gpsVehicleOptions(realtime);$$('[data-gps-vehicle]',list).forEach(input=>input.addEventListener('change',()=>toggleGpsVehicle(input.dataset.gpsVehicle,input.checked)));}
    updateGpsFilterUi();
  }
  function paintGpsData(result, ajustar=false) {
    ultimoResumenGps=normalizeGpsSummary(result||ultimoResumenGps);
    const filas=ultimoResumenGps.locations.filter(coordenadasConexionValidas);
    const vistaConductor=currentUser?.ROL_ID==='ROL-CONDUCTOR';
    const marcadores=filas.map(row=>{const latitud=Number(row.LATITUD),longitud=Number(row.LONGITUD),precision=Math.max(1,Number(row.PRECISION_METROS||9999));const enLinea=row.EN_LINEA===true||String(row.EN_LINEA||'').toUpperCase()==='SI'||String(row.ESTADO_CONEXION||'').toLowerCase()==='activo'||String(row.ESTADO_CONEXION||'').toLowerCase()==='en línea';const retenida=row.UBICACION_RETENIDA===true||String(row.UBICACION_RETENIDA||'').toUpperCase()==='SI';const nombre=row.CONDUCTOR_NOMBRE||row.USUARIO_NOMBRE||row.CONDUCTOR_ID||'Usuario',vehiculo=row.VEHICULO_PATENTE||row.VEHICULO_ID||'Sin vehículo',calidad=precision<=25?'Alta':precision<=50?'Media':'Aceptable';const direccion=direccionLegible(row.DIRECCION)?String(row.DIRECCION).trim():'Buscando dirección…',ip=String(row.IP_PUBLICA||'No disponible'),dispositivo=String(row.PLATAFORMA||row.DISPOSITIVO_NOMBRE||row.DISPOSITIVO_ID||'No identificado'),navegador=String(row.NAVEGADOR||''),red=String(row.TIPO_RED||'No identificada'),ultimaConexion=row.ULTIMA_CONEXION||row.FECHA_HORA;const estadoHtml=enLinea?'<span class="mapa-estado-linea en-linea"><i></i>En línea</span>':'<span class="mapa-estado-linea desconectado"><i></i>Desconectado</span>';const estadoGps=retenida?'<span class="mapa-aviso-gps">Última ubicación confiable · señal temporalmente no disponible</span>':'<span class="mapa-gps-actual">Ubicación actualizada</span>';const detalle=vistaConductor?`<b>Mi ubicación</b>${estadoHtml}${estadoGps}<span><strong>Dirección:</strong> ${esc(direccion)}</span><span>${Number(row.VELOCIDAD_KMH||0).toFixed(0)} km/h · precisión ${esc(calidad)} ±${Math.round(precision)} m</span><small>Actualizada: ${fmtDate(row.FECHA_HORA,true)}</small>`:`<b>${esc(vehiculo)}</b><span>${esc(nombre)}</span>${estadoHtml}${estadoGps}<span><strong>Dirección:</strong> ${esc(direccion)}</span><span><strong>IP:</strong> ${esc(ip)}</span><span><strong>Dispositivo:</strong> ${esc(dispositivo)}</span>${navegador?`<span><strong>Navegador:</strong> ${esc(navegador)}</span>`:''}<span><strong>Red:</strong> ${esc(red)}</span>${contextoOperativoMapa(row)}<span>${Number(row.VELOCIDAD_KMH||0).toFixed(0)} km/h · precisión ${esc(calidad)} ±${Math.round(precision)} m</span><small>Última conexión: ${fmtDate(ultimaConexion,true)} · última ubicación: ${fmtDate(row.FECHA_HORA,true)}</small>`;return{id:gpsUserMarkerKey(row),latitud,longitud,nombre:vistaConductor?'Mi ubicación':`${vehiculo} · ${nombre}`,direccion,activo:enLinea,estadoConexion:enLinea?'EN_LINEA':'DESCONECTADO',detalle,acciones:vistaConductor?'':accionesUsuarioMapa(row)};}).filter(Boolean);
    const base=vistaConductor?{configurada:false}:configuracionPuntoOperacion();if(base.configurada)marcadores.unshift({id:'PUNTO-OPERACIONAL',latitud:base.latitud,longitud:base.longitud,nombre:`Base · ${base.nombre}`,activo:true,detalle:`<b>${esc(base.nombre)}</b><span>${esc(base.direccion)}</span><span>Inicio ${number(base.radioInicio)} m · cierre ${number(base.radioFin)} m</span><small>Punto operacional configurado</small>`});
    const circulosBase=base.configurada?(base.radioInicio===base.radioFin?[{id:'BASE',latitud:base.latitud,longitud:base.longitud,radio:base.radioInicio,clase:'operacional',etiqueta:`Base autorizada · ${number(base.radioInicio)} m`}]:[{id:'BASE-INICIO',latitud:base.latitud,longitud:base.longitud,radio:base.radioInicio,clase:'inicio',etiqueta:`Inicio · ${number(base.radioInicio)} m`},{id:'BASE-FIN',latitud:base.latitud,longitud:base.longitud,radio:base.radioFin,clase:'fin',etiqueta:`Finalización · ${number(base.radioFin)} m`}]) : [];
    mapaFlota?.actualizarCirculos?.(circulosBase);
    mapaFlota?.actualizarMarcadores(marcadores,ajustar);
    enlazarAccionesUsuarioMapa($('#fleetMap')||document);
    programarDireccionesGps(filas).catch(()=>{});
    const locationKey=filas.map(row=>`${gpsUserMarkerKey(row)}:${row.FECHA_HORA||''}:${row.LATITUD||''}:${row.LONGITUD||''}:${row.VELOCIDAD_KMH||''}:${row.DIRECCION||''}:${row.PRECISION_METROS||''}:${row.EN_LINEA||''}:${row.ESTADO_CONEXION||''}:${row.ULTIMA_CONEXION||''}:${row.IP_PUBLICA||''}:${row.DISPOSITIVO_ID||''}:${row.PLATAFORMA||''}:${row.TIPO_RED||''}:${row.UBICACION_RETENIDA||''}`).join('|');
    const list=$('#driverLocationList');if(list&&locationKey!==gpsLocationsPaintKey){gpsLocationsPaintKey=locationKey;list.innerHTML=locationList(filas);const count=$('#locationCount');if(count)count.textContent=visibleVehiclesLabel(filas.length);$$('[data-focus-location]',list).forEach(btn=>btn.onclick=()=>{const[lat,lng]=btn.dataset.focusLocation.split(',').map(Number);mapaFlota?.establecerVista(lat,lng,18);});}
    const deviceRows=ultimoResumenGps.devices||[];const deviceKey=deviceRows.map(row=>`${row.ID||''}:${row.ULTIMA_CONEXION||''}:${row.ACTIVIDAD||''}:${row.VEHICULO_ID||''}:${row.GPS_ACTIVO||''}`).join('|');
    const devices=$('#deviceList');if(devices&&deviceKey!==gpsDevicesPaintKey){gpsDevicesPaintKey=deviceKey;devices.innerHTML=deviceRows.map(deviceCard).join('')||empty('○','Sin conexiones','Esperando señales de dispositivos.');}
    const totals=ultimoResumenGps.totals||{};const totalsKey=`${filas.length}:${totals.onlineDevices||0}:${totals.drivingSessions||0}:${totals.sessionsWithoutGps||0}`;if(totalsKey!==gpsTotalsPaintKey){gpsTotalsPaintKey=totalsKey;if($('#gpsVisibleCount'))$('#gpsVisibleCount').textContent=filas.length;if($('#gpsOnlineCount'))$('#gpsOnlineCount').textContent=totals.onlineDevices||0;if($('#gpsDrivingCount'))$('#gpsDrivingCount').textContent=totals.drivingSessions||0;if($('#gpsWithoutCount'))$('#gpsWithoutCount').textContent=totals.sessionsWithoutGps||0;}
    refreshGpsVehicleOptions(ultimoResumenGps);
    refreshGpsDriverFilterOptions(ultimoResumenGps);
    const sync=$('#gpsLastSync');if(sync)sync.textContent=`Última consulta precisa: ${fmtDate(new Date(),true)}`;
  }
  function gpsRefreshDelay() {
    const base=document.hidden?Number(config.INTERVALO_TIEMPO_REAL_OCULTO_MILISEGUNDOS||15000):Number(config.INTERVALO_TIEMPO_REAL_MILISEGUNDOS||3000);
    return Math.min(Number(config.RETARDO_REINTENTO_TIEMPO_REAL_MAXIMO_MILISEGUNDOS||30000),base*Math.pow(2,Math.min(gpsRefreshFailures,3)));
  }
  function scheduleGpsRefresh(delay=gpsRefreshDelay()) {
    if(gpsRefreshTimer)clearTimeout(gpsRefreshTimer);gpsRefreshTimer=null;
    if(currentSection!=='gps'||!currentUser)return;
    gpsRefreshTimer=setTimeout(()=>refreshLocations(false,false),Math.max(250,delay));
  }
  function esperarTamanoMapa(contenedor,intentos=24){
    return new Promise(resolve=>{
      const revisar=()=>{
        if(!contenedor?.isConnected){resolve(false);return;}
        if(contenedor.clientWidth>220&&contenedor.clientHeight>220){resolve(true);return;}
        if(intentos--<=0){resolve(false);return;}
        requestAnimationFrame(revisar);
      };
      revisar();
    });
  }
  async function initMap() {
    const contenedor=$('#fleetMap');
    if(!contenedor||currentSection!=='gps')return;
    if(promesaInicializacionMapaGps)return promesaInicializacionMapaGps;
    contenedor.classList.add('mapa-iniciando');
    promesaInicializacionMapaGps=(async()=>{
      await asegurarComponenteMapa();
      const visible=await esperarTamanoMapa(contenedor,60);
      if(!visible||currentSection!=='gps'||!contenedor.isConnected){contenedor.classList.remove('mapa-iniciando');if(currentSection==='gps'&&contenedor.isConnected)setTimeout(()=>initMap(),250);return;}
      mapaFlota?.eliminar?.();
      mapaFlota=new window.MapaFlotas(contenedor,{centro:config.CENTRO_MAPA,nivel:config.NIVEL_ACERCAMIENTO_MAPA});
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        mapaFlota?.redibujar?.();
        paintGpsData(ultimoResumenGps,true);
        contenedor.classList.remove('mapa-iniciando');
      }));
      setTimeout(()=>mapaFlota?.redibujar?.(),300);
      setTimeout(()=>mapaFlota?.redibujar?.(),900);
      scheduleGpsRefresh(120);
    })().catch(error=>{
      contenedor.classList.remove('mapa-iniciando');
      contenedor.innerHTML='<div class="mapa-error"><b>No se pudo mostrar el mapa</b><span>Pulse Sincronizar para volver a intentarlo.</span></div>';
      toast('Mapa no disponible',translateError(error),'error');
    }).finally(()=>{promesaInicializacionMapaGps=null;});
    return promesaInicializacionMapaGps;
  }
  async function refreshLocations(showToast=true,ajustar=false) {
    if(gpsRefreshPending){gpsRefreshQueued=true;return gpsRefreshPending;}
    gpsRefreshPending=(async()=>{try{const result=normalizeGpsSummary(await api.request('realtimeSummary',{...gpsFilterPayload(),marcaTiempo:Date.now(),force:true}));gpsRefreshFailures=0;paintGpsData(result,ajustar);if(showToast)toast('Mapa actualizado',`${result.locations.length} ubicaciones visibles.`);setConnection(true,api.isRemote()?'Base de datos conectada':'Base de datos local activa');return result;}catch(error){gpsRefreshFailures+=1;setConnection(false,'Error GPS');if(showToast)toast('No se pudo actualizar',translateError(error),'error');return null;}finally{gpsRefreshPending=null;const rerun=gpsRefreshQueued;gpsRefreshQueued=false;if(currentSection==='gps')scheduleGpsRefresh(rerun?300:gpsRefreshDelay());}})();
    return gpsRefreshPending;
  }

  function captureGps() {
    if(!navigator.geolocation){toast('GPS no compatible','Este navegador no ofrece geolocalización.','error');return Promise.resolve(false);}
    return new Promise(resolve=>{
      let mejor=null,finalizado=false,watchId=null;
      const objetivo=Number(config.PRECISION_GPS_OBJETIVO_METROS||25),maxima=Number(config.PRECISION_GPS_ENVIO_MAXIMA_METROS||60);
      const cerrar=async exito=>{if(finalizado)return;finalizado=true;if(watchId!==null)navigator.geolocation.clearWatch(watchId);clearTimeout(timer);if(exito&&mejor){geolocationPermissionState='granted';updateTrackingUi();await sendPosition(mejor,'GPS preciso',true);resolve(true);return;}toast('Señal GPS insuficiente',`No se obtuvo una precisión menor o igual a ${maxima} metros. Active ubicación precisa y espere unos segundos al aire libre.`,'error');resolve(false);};
      const timer=setTimeout(()=>cerrar(Boolean(mejor&&Number(mejor.coords?.accuracy)<=maxima)),18000);
      watchId=navigator.geolocation.watchPosition(position=>{const precision=Number(position.coords?.accuracy||Infinity);if(!Number.isFinite(precision)||precision<=0)return;if(!mejor||precision<Number(mejor.coords?.accuracy||Infinity))mejor=position;if(precision<=objetivo)cerrar(true);},error=>{if(error?.code===1){handleTrackingError(error,'No se obtuvo ubicación');cerrar(false);}}, {enableHighAccuracy:true,timeout:17000,maximumAge:0});
    });
  }

  function trackingPreferenceEnabled(){return localStorage.getItem(trackingPreferenceStorageKey())==='1';}
  function permissionLabel(state=geolocationPermissionState){
    return ({granted:'Concedido',prompt:'Pendiente de autorización',denied:'Bloqueado',desconocido:'No disponible'})[state]||'No disponible';
  }
  function nativeGpsAvailable(){
    try{return Boolean(window.AndroidConfig&&typeof window.AndroidConfig.esGpsPermanenteDisponible==='function'&&window.AndroidConfig.esGpsPermanenteDisponible());}
    catch(_){return false;}
  }
  function wakeLockLabel(){
    if(gpsWatchId==='ANDROID')return 'No requerida · servicio Android';
    if(!navigator.wakeLock)return 'No compatible';
    if(wakeLock&&!wakeLock.released)return 'Activa';
    return gpsWatchId===null?'No requerida':'En espera';
  }
  function trackingDetail(){
    if(gpsWatchId==='ANDROID')return 'El servicio nativo de Android seguirá enviando la ubicación con la pantalla apagada o la aplicación cerrada. Android mantendrá una notificación visible.';
    if(gpsWatchId!==null)return 'La preferencia quedó guardada y se reanudará cuando vuelva a abrir la sesión con el permiso concedido.';
    if(trackingPreferenceEnabled())return nativeGpsAvailable()?'La preferencia está guardada. Android reactivará el servicio permanente al iniciar la sesión.':'La preferencia está guardada. Se reactivará automáticamente cuando el navegador tenga permiso y la aplicación esté abierta.';
    return nativeGpsAvailable()?'Actívela una vez y conceda “Permitir todo el tiempo”. El servicio Android podrá continuar con la aplicación cerrada.':'Actívela una vez y acepte el permiso del teléfono.';
  }
  function updateTrackingUi(){
    const active=gpsWatchId!==null;
    $$('[data-tracking-notice]').forEach(node=>{node.classList.toggle('active',active);node.classList.toggle('inactive',!active);});
    $$('[data-tracking-icon]').forEach(node=>{node.textContent=active?'●':'○';});
    $$('[data-tracking-title]').forEach(node=>{node.textContent=active?'Ubicación continua activada':'Ubicación continua detenida';});
    $$('[data-tracking-detail]').forEach(node=>{node.textContent=trackingDetail();});
    $$('[data-tracking-permission]').forEach(node=>{node.textContent=permissionLabel();});
    $$('[data-tracking-preference]').forEach(node=>{node.textContent=trackingPreferenceEnabled()?'Activada':'Desactivada';});
    $$('[data-wake-lock]').forEach(node=>{node.textContent=wakeLockLabel();});
    $$('[data-toggle-tracking]').forEach(button=>{if(button.dataset.loading!=='1')button.textContent=active?(config.GPS_AUTOMATICO_OBLIGATORIO?'GPS obligatorio activo':'Detener ubicación continua'):'Activar GPS obligatorio';button.classList.toggle('primary',!active);button.classList.toggle('danger',active&&!config.GPS_AUTOMATICO_OBLIGATORIO);button.disabled=Boolean(active&&config.GPS_AUTOMATICO_OBLIGATORIO);});
  }
  async function monitorGeolocationPermission(){
    if(!navigator.permissions?.query){geolocationPermissionState='desconocido';updateTrackingUi();return geolocationPermissionState;}
    try{
      if(!geolocationPermissionHandle){
        geolocationPermissionHandle=await navigator.permissions.query({name:'geolocation'});
        geolocationPermissionHandle.addEventListener?.('change',()=>{
          geolocationPermissionState=geolocationPermissionHandle.state||'desconocido';
          if(geolocationPermissionState==='denied'&&gpsWatchId!==null)stopTracking({remember:false,silent:true});
          if(geolocationPermissionState==='granted'&&trackingPreferenceEnabled()&&currentUser&&gpsWatchId===null)startTracking({silent:true});
          updateTrackingUi();
        });
      }
      geolocationPermissionState=geolocationPermissionHandle.state||'desconocido';
    }catch(_){geolocationPermissionState='desconocido';}
    updateTrackingUi();return geolocationPermissionState;
  }
  async function requestWakeLock(){
    if(gpsWatchId==='ANDROID'||!navigator.wakeLock?.request||document.hidden||gpsWatchId===null)return;
    try{
      if(!wakeLock||wakeLock.released){
        wakeLock=await navigator.wakeLock.request('screen');
        wakeLock.addEventListener?.('release',()=>{wakeLock=null;updateTrackingUi();});
      }
    }catch(_){wakeLock=null;}
    updateTrackingUi();
  }
  async function releaseWakeLock(){
    const activeLock=wakeLock;wakeLock=null;
    try{await activeLock?.release?.();}catch(_){}
    updateTrackingUi();
  }
  function handleTrackingError(error,title='Seguimiento GPS'){
    const messages={1:'El permiso de ubicación está bloqueado. Habilítelo en la configuración del navegador.',2:'El teléfono no pudo determinar la ubicación. Revise el GPS y la señal.',3:'La ubicación tardó demasiado. El sistema seguirá intentando.'};
    if(error?.code===1){
      geolocationPermissionState='denied';
      if(gpsWatchId!==null&&navigator.geolocation)navigator.geolocation.clearWatch(gpsWatchId);
      gpsWatchId=null;releaseWakeLock();
    }
    updateTrackingUi();
    if(error?.code===2||error?.code===3)sendHeartbeat('GPS temporalmente sin señal');
    if(Date.now()-lastGpsErrorAt>8000){lastGpsErrorAt=Date.now();toast(title,messages[error?.code]||error?.message||'No fue posible obtener la ubicación.','error');}
  }
  async function startTracking({silent=false}={}){
    if(gpsWatchId!==null)return true;
    if(nativeGpsAvailable()){
      gpsWatchId='ANDROID';
      localStorage.setItem(trackingPreferenceStorageKey(),'1');
      try{window.AndroidConfig.activarGpsPermanente();}catch(_){}
      updateTrackingUi();sendHeartbeat();
      if(!silent)toast('Ubicación permanente solicitada','Android continuará el seguimiento con la pantalla apagada o la aplicación cerrada después de conceder los permisos.');
      return true;
    }
    if(!navigator.geolocation){if(!silent)toast('GPS no compatible','Este navegador no ofrece geolocalización.','error');return false;}
    await monitorGeolocationPermission();
    if(geolocationPermissionState==='denied'){if(!silent)toast('Permiso de ubicación bloqueado','Abra la configuración del navegador y cambie el permiso de ubicación a permitido.','error');return false;}
    try{
      gpsWatchId=navigator.geolocation.watchPosition(
        position=>{geolocationPermissionState='granted';updateTrackingUi();sendPosition(position,'Seguimiento continuo',false);},
        error=>handleTrackingError(error),
        {enableHighAccuracy:true,timeout:25000,maximumAge:3000}
      );
      localStorage.setItem(trackingPreferenceStorageKey(),'1');
      requestWakeLock();updateTrackingUi();sendHeartbeat();
      if(!silent)toast('Ubicación continua activada',`La posición se enviará aproximadamente cada ${Math.round(config.INTERVALO_GPS_MILISEGUNDOS/1000)} segundos mientras la aplicación pueda ejecutarse.`);
      return true;
    }catch(error){handleTrackingError(error);return false;}
  }
  function stopTracking({remember=true,silent=false}={}){
    if(gpsWatchId==='ANDROID'){try{window.AndroidConfig.detenerGpsPermanente();}catch(_){}}
    else if(gpsWatchId!==null&&navigator.geolocation)navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId=null;ultimaUbicacionEnviada=null;
    if(remember)localStorage.setItem(trackingPreferenceStorageKey(),'0');
    releaseWakeLock();updateTrackingUi();
    if(!silent)toast('Ubicación continua detenida');
  }
  async function resumeTrackingIfAllowed(){
    if(!currentUser||gpsWatchId!==null)return;
    if(nativeGpsAvailable()){
      try{const nativeState=JSON.parse(window.AndroidConfig.estadoGpsPermanente?.()||'{}');if(nativeState.habilitado)localStorage.setItem(trackingPreferenceStorageKey(),'1');}
      catch(_){}
      if(trackingPreferenceEnabled())await startTracking({silent:true});
      return;
    }
    if(!trackingPreferenceEnabled())return;
    const state=await monitorGeolocationPermission();
    if(state==='granted')await startTracking({silent:true});
  }
  async function toggleTracking() {
    if(gpsWatchId===null)await startTracking();
    else if(config.GPS_AUTOMATICO_OBLIGATORIO){toast('GPS obligatorio','La ubicación permanece activa durante toda la sesión web.');return;}
    else{stopTracking();sendHeartbeat();}
    if(currentSection!=='gps')navigateSection('gps');else updateTrackingUi();
  }

  function claveDireccion(latitude,longitude){return `${Number(latitude).toFixed(4)},${Number(longitude).toFixed(4)}`;}
  function esDireccionCoordenada(value){return /^-?\d{1,3}(?:[.,]\d+)?\s*,\s*-?\d{1,3}(?:[.,]\d+)?$/.test(String(value||'').trim());}
  function direccionLegible(value){
    const text=String(value||'').trim(),normal=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if(!text||text.length<=8||esDireccionCoordenada(text))return false;
    return !['coordenadas:','direccion en proceso','direccion pendiente','resolviendo direccion','sin ubicacion','esperando primera ubicacion'].some(prefijo=>normal.startsWith(prefijo));
  }
  async function resolveAddress(latitude,longitude){
    const fallback=`${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`,key=claveDireccion(latitude,longitude);
    if(!config.RESOLVER_DIRECCIONES)return fallback;
    const cached=addressLookupCache.get(key);if(cached&&Date.now()-cached.time<86400000)return cached.address;
    if(addressLookupPending.has(key))return addressLookupPending.get(key);
    const promise=(async()=>{
      const wait=Math.max(0,Number(config.INTERVALO_GEOCODIFICACION_MILISEGUNDOS||1050)-(Date.now()-lastAddressRequestAt));if(wait)await new Promise(resolve=>setTimeout(resolve,wait));lastAddressRequestAt=Date.now();
      try{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);const url=new URL(config.DIRECCION_GEOCODIFICACION_INVERSA);url.searchParams.set('format','jsonv2');url.searchParams.set('lat',latitude);url.searchParams.set('lon',longitude);url.searchParams.set('zoom','18');url.searchParams.set('addressdetails','1');url.searchParams.set('accept-language','es');const response=await fetch(url,{headers:{Accept:'application/json'},signal:controller.signal});clearTimeout(timer);if(!response.ok)throw new Error('GEOCODIFICACION_NO_DISPONIBLE');const data=await response.json(),address=String(data.display_name||fallback);addressLookupCache.set(key,{address,time:Date.now()});lastAddressLookup={address,time:Date.now(),latitude,longitude};return address;}catch(_){return fallback;}finally{addressLookupPending.delete(key);}
    })();addressLookupPending.set(key,promise);return promise;
  }
  async function programarDireccionesConexiones(rows){
    if(addressQueueRunning||currentSection!=='connections')return;const pending=(rows||[]).filter(row=>coordenadasConexionValidas(row)&&!direccionLegible(row.DIRECCION)).slice(0,Number(config.MAXIMO_DIRECCIONES_POR_CICLO||8));if(!pending.length)return;addressQueueRunning=true;
    try{for(const row of pending){if(currentSection!=='connections')break;const address=await resolveAddress(Number(row.LATITUD),Number(row.LONGITUD));if(!direccionLegible(address))continue;row.DIRECCION=address;try{await api.request('updateLocationAddress',{data:{CONEXION_ID:row.ID,DISPOSITIVO_ID:row.DISPOSITIVO_ID,LATITUD:row.LATITUD,LONGITUD:row.LONGITUD,DIRECCION:address}});}catch(_){}if(currentSection==='connections')paintConnectionsOnline(ultimoResumenConexiones,false,false);}}
    finally{addressQueueRunning=false;}
  }

  async function programarDireccionesGps(rows){
    if(gpsAddressQueueRunning||currentSection!=='gps'||!config.RESOLVER_DIRECCIONES)return;
    const unicos=new Map();
    (rows||[]).filter(row=>coordenadasConexionValidas(row)&&!direccionLegible(row.DIRECCION)).forEach(row=>{const key=gpsUserMarkerKey(row);if(!unicos.has(key))unicos.set(key,row);});
    const pending=[...unicos.values()].slice(0,Math.min(4,Number(config.MAXIMO_DIRECCIONES_POR_CICLO||8)));
    if(!pending.length)return;
    gpsAddressQueueRunning=true;let changed=false;
    try{
      for(const row of pending){
        if(currentSection!=='gps')break;
        const address=await resolveAddress(Number(row.LATITUD),Number(row.LONGITUD));
        if(!direccionLegible(address))continue;
        row.DIRECCION=address;changed=true;
        const markerKey=gpsUserMarkerKey(row);
        (ultimoResumenGps.locations||[]).forEach(item=>{if(gpsUserMarkerKey(item)===markerKey)item.DIRECCION=address;});
        try{await api.request('updateLocationAddress',{data:{GPS_ID:row.ID,DISPOSITIVO_ID:row.DISPOSITIVO_ID,LATITUD:row.LATITUD,LONGITUD:row.LONGITUD,DIRECCION:address}});}catch(_){}
      }
      if(changed&&currentSection==='gps')paintGpsData(ultimoResumenGps,false);
    }finally{gpsAddressQueueRunning=false;}
  }

  function validarPosicionNavegador(position){
    const c=position?.coords||{},lat=Number(c.latitude),lng=Number(c.longitude),precision=Number(c.accuracy||0);
    const fecha=Number(position?.timestamp||Date.now()),edad=Math.max(0,Math.round((Date.now()-fecha)/1000));
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180||(Math.abs(lat)<0.000001&&Math.abs(lng)<0.000001))throw new Error('COORDENADAS_INVALIDAS');
    if(!Number.isFinite(precision)||precision<=0)throw new Error('PRECISION_GPS_REQUERIDA');
    if(precision>Number(config.PRECISION_GPS_ENVIO_MAXIMA_METROS||60))throw new Error('UBICACION_GPS_IMPRECISA');
    if(edad>Number(config.EDAD_GPS_MAPA_MAXIMA_SEGUNDOS||180))throw new Error('UBICACION_GPS_ANTIGUA');
    if(fecha-Date.now()>60000)throw new Error('FECHA_GPS_FUTURA');
    const anterior=ultimaPosicionConfiableNavegador;
    if(anterior&&fecha>anterior.fecha&&fecha-anterior.fecha<=600000){
      const distancia=distanciaMetros(anterior.lat,anterior.lng,lat,lng),segundos=Math.max(1,(fecha-anterior.fecha)/1000),incertidumbre=Math.max(precision,anterior.precision||precision),velocidad=Math.max(0,distancia-incertidumbre*2)/segundos*3.6;
      if(distancia>Math.max(250,incertidumbre*4)&&velocidad>Number(config.VELOCIDAD_SALTO_GPS_MAXIMA_KMH||180))throw new Error('SALTO_GPS_IMPOSIBLE');
    }
    return{lat,lng,precision,fecha,edad};
  }
  async function procesarColaGps(position,source,forzar) {
    const c=position.coords,ahora=Date.now(),validacion=validarPosicionNavegador(position);
    if(!forzar&&ultimaUbicacionEnviada){const tiempo=ahora-ultimaUbicacionEnviada.tiempo,movimiento=distanciaMetros(ultimaUbicacionEnviada.latitud,ultimaUbicacionEnviada.longitud,validacion.lat,validacion.lng);if(tiempo<config.INTERVALO_GPS_MILISEGUNDOS&&movimiento<Number(config.DISTANCIA_MINIMA_ENVIO_GPS_METROS||6))return;}
    const fallback=`${validacion.lat.toFixed(6)}, ${validacion.lng.toFixed(6)}`;
    const cachedAddress=lastAddressLookup.address&&distanciaMetros(validacion.lat,validacion.lng,lastAddressLookup.latitude,lastAddressLookup.longitude)<50?lastAddressLookup.address:fallback;
    const contextoRuta=contextoSeguimientoRutaValido()?routeTrackingContext:null;
    const resultadoGps=await api.request('saveLocation',{data:{LATITUD:validacion.lat,LONGITUD:validacion.lng,PRECISION_METROS:validacion.precision,VELOCIDAD_KMH:c.speed==null?0:c.speed*3.6,RUMBO:c.heading||0,DIRECCION:cachedAddress,BATERIA_PORCENTAJE:batteryLevel,DISPOSITIVO_ID:deviceId,SESION_CLIENTE_ID:clientSessionId,SECCION_ACTUAL:currentSection,PAGINA_VISIBLE:document.hidden?'NO':'SI',TIPO_RED:connectionType(),PLATAFORMA:navigator.platform||'',NAVEGADOR:navigator.userAgent,FECHA_HORA:new Date(validacion.fecha).toISOString(),TIEMPO_CAPTURA_MS:validacion.fecha,EDAD_SEGUNDOS:validacion.edad,PROVEEDOR:'BROWSER_HIGH_ACCURACY',ES_SIMULADA:'NO',FUENTE:source,RUTA_ID:contextoRuta?.RUTA_ID||'',OPERACION_ID:contextoRuta?.OPERACION_ID||'',VEHICULO_ID:contextoRuta?.VEHICULO_ID||'',CONDUCTOR_ID:contextoRuta?.CONDUCTOR_ID||'',CONTEXTO_RUTA_EXPLICITO:contextoRuta?'SI':'NO'}});
    if(resultadoGps?.contextoRutaDepurado)guardarContextoSeguimientoRuta(null);
    if(resultadoGps?.aceptada===false)throw new Error(resultadoGps?.motivo||'UBICACION_GPS_RECHAZADA');
    ultimaPosicionConfiableNavegador={...validacion};
    guardarUltimaUbicacionDispositivo({latitud:validacion.lat,longitud:validacion.lng,precision:validacion.precision,fecha:validacion.fecha,fuente:source||'GPS del dispositivo',confiable:true});
    ultimaUbicacionEnviada={tiempo:ahora,latitud:validacion.lat,longitud:validacion.lng};setSave('Ubicación verificada y sincronizada');
    resolveAddress(validacion.lat,validacion.lng).then(address=>{if(!direccionLegible(address))return;ultimaPosicionConocida={...(ultimaPosicionConocida||{}),direccion:address};guardarUltimaUbicacionDispositivo({latitud:validacion.lat,longitud:validacion.lng,precision:validacion.precision,fecha:validacion.fecha,fuente:source||'GPS del dispositivo',direccion:address});api.request('updateLocationAddress',{data:{DISPOSITIVO_ID:deviceId,LATITUD:validacion.lat,LONGITUD:validacion.lng,DIRECCION:address}}).catch(()=>{});}).catch(()=>{});
    if(currentSection==='gps')refreshLocations(false,false);
    if(currentSection==='connections'){
      if(connectionTrackedUserId)refreshConnectionTrackingLive(false);
      else scheduleConnectionsRefresh(250);
    }
  }
  async function sendPosition(position,source,forzar=false) {
    gpsPendingPosition={position,source,forzar};
    if(gpsSendPending)return;
    gpsSendPending=true;
    try{while(gpsPendingPosition){const next=gpsPendingPosition;gpsPendingPosition=null;try{await procesarColaGps(next.position,next.source,next.forzar);}catch(error){setSave('Error GPS','error');if(Date.now()-lastGpsErrorAt>8000){lastGpsErrorAt=Date.now();toast('No se pudo enviar GPS',translateError(error),'error');}}}}
    finally{gpsSendPending=false;}
  }

  async function exportResource(resource,formato='csv'){
    try{
      if(!puedeExportarFormato(formato))throw new Error('PERMISO_DENEGADO');
      const result=await solicitarListaPaginada(resource,{limit:'TODOS',cache:false}),rows=result.rows||[];if(!rows.length)return toast('Sin datos','No hay registros para exportar.','error');
      const exporter=window.ExportadorReportesFlotas;if(!exporter)throw new Error('EXPORTADOR_REPORTES_NO_DISPONIBLE');
      await exporter.exportarFilas(rows,{formato,nombre:resource,titulo:`Reporte de ${labels[resource]||resource}`,subtitulo:'Sistema de Gestión de Flotas',autor:currentUser?.NOMBRE||currentUser?.CORREO||'',hoja:labels[resource]||resource,metadatos:{'Total de registros':rows.length,'Fecha de exportación':fmtDate(new Date(),true)}});
      toast('Reporte completo generado',`${rows.length} registros de todas las páginas fueron exportados en ${formato.toUpperCase()}.`);
    }catch(error){toast('No se pudo exportar',translateError(error),'error');}
  }

  async function clearData(button){
    const confirmation=prompt('Esta acción dejará vacíos los módulos operativos y eliminará sus archivos. Escriba exactamente LIMPIAR DATOS para continuar:','');if(confirmation===null)return;
    const confirmacionNormalizada=String(confirmation).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toUpperCase();
    if(confirmacionNormalizada!=='LIMPIAR DATOS'){toast('Confirmación incorrecta','Escriba LIMPIAR DATOS. Puede usar mayúsculas o minúsculas, pero deben ser esas dos palabras.','error');return;}
    if(!confirm('¿Confirma la limpieza total? Se conservarán únicamente usuarios, roles, permisos, empresa y configuración.'))return;
    await conCargaBoton(button,'Limpiando…',async()=>{try{const result=await api.request('clearOperationalData',{confirmacion:'LIMPIAR DATOS'});if(result.persistenciaConfirmada!==true)throw new Error('LIMPIEZA_NO_CONFIRMADA');invalidarListasFormulario();cacheVistasModulo.clear();const total=Object.values(result.tablas||{}).reduce((sum,value)=>sum+Number(value||0),0);toast('Sistema operativo limpiado',`${number(total)} registros fueron retirados. Usuarios, roles, permisos y empresa se conservaron.`);await actualizarSeccionEnSegundoPlano('settings');}catch(error){toast('No se pudo limpiar',translateError(error),'error');}});
  }
  function setTheme(dark){document.body.classList.toggle('dark',dark);document.documentElement.classList.toggle('tema-oscuro-inicial',dark);document.documentElement.style.colorScheme=dark?'dark':'light';localStorage.setItem('flotas_tema',dark?'dark':'light');window.TemaFlotas?.aplicarGuardado?.();}

  function openModal(){const token=++secuenciaModal;$('#modalBackdrop').classList.add('open');document.body.classList.add('modal-open');return token;}
  function closeModal(){
    secuenciaModal+=1;$('#modalBackdrop').classList.remove('open');document.body.classList.remove('modal-open');
    if(actualizacionVehiculoAsignadoPendiente&&currentSection==='documents'){
      actualizacionVehiculoAsignadoPendiente=false;
      api.invalidate({resources:['documents','vehicles']});cacheVistasModulo.delete('documents');
      setTimeout(()=>go('documents'),40);
    }
  }
  function openSidebar(){$('#sidebar').classList.add('open');$('#overlay').classList.add('open');}
  function closeSidebar(){$('#sidebar').classList.remove('open');$('#overlay').classList.remove('open');}

  function normalizarContextoQr(value){const context=String(value||'vehiculo-operacion').trim().toLowerCase();return['vehiculo-operacion','combustible','checkin'].includes(context)?context:'vehiculo-operacion';}
  function textoContextoQr(context){return context==='combustible'?'la carga de combustible':context==='checkin'?'el check-in vehicular':'la operación';}
  function prepararTextosQr(context){const header=$('#qrBackdrop .modal-header');if(!header)return;const eyebrow=$('.eyebrow',header),title=$('h3',header);if(eyebrow)eyebrow.textContent=context==='combustible'?'COMBUSTIBLE QR':context==='checkin'?'CHECK-IN QR':'OPERACIÓN QR';if(title)title.textContent=context==='combustible'?'Escanear vehículo para carga':context==='checkin'?'Escanear vehículo para revisión':'Escanear vehículo';}
  const QR_ANDROID_NATIVO_EXCLUSIVO=true;
  let qrNativoSolicitado=false;
  let ultimoQrNativoProcesado='';
  let ultimoQrNativoMomento=0;
  function lectorQrNativoDisponible(){try{return Boolean(window.AndroidConfig&&AndroidConfig.esLectorQrNativoDisponible&&AndroidConfig.esLectorQrNativoDisponible());}catch(_){return false;}}
  function liberarSolicitudQrNativo(){qrNativoSolicitado=false;}
  function iniciarQrNativo(contexto=qrContextoActual){
    if(!lectorQrNativoDisponible())return false;
    if(qrNativoSolicitado)return true;
    qrNativoSolicitado=true;
    try{
      stopCamera();
      AndroidConfig.iniciarEscaneoQr(normalizarContextoQr(contexto));
      setTimeout(()=>{qrNativoSolicitado=false;},120000);
      return true;
    }catch(error){
      qrNativoSolicitado=false;
      toast('No se pudo abrir el lector QR nativo',String(error?.message||error),'error');
      return false;
    }
  }
  function prepararModalQrManual(){
    openQrBackdrop();
    const empty=$('#cameraEmpty');
    if(empty){empty.classList.remove('hidden');empty.innerHTML=`<b>▦</b><span>El lector nativo no está disponible. Ingrese el código QR para ${textoContextoQr(qrContextoActual)}.</span>`;}
    $('#scannerStatus')?.classList.remove('active');
    if($('#scannerStatus span'))$('#scannerStatus span').textContent='Ingreso manual de QR';
    ['#qrVideo','.scan-frame','#cameraSelect','#switchCamera','#startCamera'].forEach(sel=>{const el=$(sel);if(el)el.hidden=true;});
  }
  async function openQr(contexto='vehiculo-operacion'){
    qrContextoActual=normalizarContextoQr(contexto);
    prepararTextosQr(qrContextoActual);
    if($('#manualQr'))$('#manualQr').value='';
    if(iniciarQrNativo(qrContextoActual))return;
    prepararModalQrManual();
  }
  function openQrBackdrop(){$('#qrBackdrop').classList.add('open');document.body.classList.add('modal-open');}
  function closeQr(){stopCamera();$('#qrBackdrop').classList.remove('open');if(!$('#modalBackdrop').classList.contains('open'))document.body.classList.remove('modal-open');}
  async function enumerateCameras(){return [];}
  async function startCamera(){
    if(iniciarQrNativo(qrContextoActual))return;
    prepararModalQrManual();
    toast('Lector QR nativo no disponible','Ingrese el código manualmente. La cámara web está desactivada dentro de Android.','error');
  }
  async function scanFrame(){return;}
  function stopCamera(){if(scanFrameId)cancelAnimationFrame(scanFrameId);scanFrameId=null;if(mediaStream)mediaStream.getTracks().forEach(track=>track.stop());mediaStream=null;barcodeDetector=null;if($('#qrVideo'))$('#qrVideo').srcObject=null;}
  async function processQr(code,contexto=qrContextoActual){
    const limpio=String(code||'').trim();
    if(!limpio)return toast('Código QR vacío','No se recibió información del lector.','error');
    const context=normalizarContextoQr(contexto);qrContextoActual=context;
    const ahora=Date.now();
    if(`${context}:${limpio}`===ultimoQrNativoProcesado&&ahora-ultimoQrNativoMomento<4000)return;
    ultimoQrNativoProcesado=`${context}:${limpio}`;
    ultimoQrNativoMomento=ahora;
    liberarSolicitudQrNativo();
    try{
      const result=await api.request('validateVehicleQr',{data:{CODIGO:limpio,CONTEXTO:context},codigo:limpio,contexto:context});const vehicle=result.row||result.vehicle||result.vehiculo||(result.ID?result:null);if(!vehicle)throw new Error('QR_NO_RECONOCIDO');
      vehicle.AUTORIZACION_QR=result.AUTORIZACION_QR||result.autorizacionQr||vehicle.AUTORIZACION_QR||'';closeQr();
      if(context==='combustible'){toast('Vehículo validado',`${vehicle.PATENTE} quedó asociado a la carga de combustible.`);openFuelModal(null,vehicle);}
      else if(context==='checkin'){toast('Vehículo validado',`${vehicle.PATENTE} quedó seleccionado para la revisión.`);aplicarVehiculoQrCheckin(vehicle);}
      else {toast('Vehículo validado',`${vehicle.PATENTE} quedó listo para asociarlo a la operación.`);openOperationModal(vehicle);}
    }catch(error){toast('No se pudo validar el QR',translateError(error),'error');}
  }
  window.FlotasQrNativoResultado=function(codigo,contexto){
    const limpio=String(codigo||'').trim();
    if(!limpio){liberarSolicitudQrNativo();toast('Lector QR','El código leído está vacío.','error');return false;}
    processQr(limpio,contexto||qrContextoActual);
    return true;
  };
  window.addEventListener('flotas:qr-nativo-resultado',event=>{window.FlotasQrNativoResultado(event?.detail?.codigo,event?.detail?.contexto||qrContextoActual);});
  window.addEventListener('flotas:qr-nativo-estado',event=>{const estado=String(event?.detail?.estado||'');if(estado==='cancelado'||estado==='cerrado')liberarSolicitudQrNativo();});
  window.addEventListener('flotas:qr-nativo-error',event=>{liberarSolicitudQrNativo();const mensaje=String(event?.detail?.mensaje||'No se pudo leer el código QR.');toast('Lector QR nativo',mensaje,'error');});

  function logout(){const cierre=api.request('logout',{data:{SESION_CLIENTE_ID:clientSessionId}}).catch(()=>{});forceLogout();return cierre;}
  function forceLogout(){limpiarAmbienteCumpleanos();cleanupSection();stopRealtimeServices();stopCamera();guardarContextoSeguimientoRuta(null);stopTracking({remember:false,silent:true});ultimaPosicionConocida=null;ultimaPosicionConfiableNavegador=null;ultimaUbicacionEnviada=null;gpsPendingPosition=null;currentUser=null;appInicializada=false;connectionTrackedUserId='';connectionTrackedPositionKey='';connectionTrackingServerLoaded=false;connectionTrackingSavePending=false;connectionTrackedVisibility=null;notificationSnapshotReady=false;knownNotificationIds=new Set();knownAlertIds=new Set();knownAssignmentAlertIds=new Set();assignmentAlertNode?.remove();assignmentAlertNode=null;assignmentAlertQueue=[];nexoSpeedAlertNode?.remove();nexoSpeedAlertNode=null;notificationCenterState={notifications:[],alerts:[]};precargaIniciada=false;modulosSincronizadosSesion.clear();actualizacionesModuloPendientes.clear();cacheVistasModulo.clear();invalidarListasFormulario();api.setAuth({});postParent({tipo:'flotas:sesion-cerrada'});$('#appShell').classList.add('hidden');if(embeddedMode)return;$('#authScreen').classList.remove('hidden');checkSystem();}
  let fotoPerfilTemporal='';
  function mostrarInicialesAvatarUsuario(){const avatar=$('#userAvatar');if(!avatar||!currentUser)return;fotoPerfilTemporal='';avatar.replaceChildren(document.createTextNode(initials(currentUser.NOMBRE||'U')));avatar.classList.remove('con-foto');}
  async function cargarFotoPerfilUsuario(forzar=false){
    const avatar=$('#userAvatar');if(!currentUser||!avatar)return'';
    if(!String(currentUser.FOTO_PERFIL_RUTA||'').trim()){mostrarInicialesAvatarUsuario();return'';}
    if(fotoPerfilTemporal&&!forzar){avatar.innerHTML=`<img src="${esc(fotoPerfilTemporal)}" alt="Foto de perfil">`;avatar.classList.add('con-foto');return fotoPerfilTemporal;}
    try{const result=await api.request('profilePhoto',{cache:false,force:true,data:{USUARIO_ID:currentUser.ID}});const url=String(result.url||result.URL||'').trim();if(!url)throw new Error('FOTO_PERFIL_NO_DISPONIBLE');fotoPerfilTemporal=url;avatar.innerHTML=`<img src="${esc(url)}" alt="Foto de perfil">`;avatar.classList.add('con-foto');return url;}catch(error){mostrarInicialesAvatarUsuario();throw error;}
  }
  async function showProfile(){
    $('#modalEyebrow').textContent='MI CUENTA';$('#modalTitle').textContent='Mi perfil';
    let foto='';try{foto=await cargarFotoPerfilUsuario();}catch(_){foto='';}
    $('#modalBody').innerHTML=`<form class="form-grid" id="profilePhotoForm"><div class="profile-photo-editor full"><div class="profile-photo-preview">${foto?`<img src="${esc(foto)}" alt="Foto de perfil">`:`<span>${esc(initials(currentUser.NOMBRE||'U'))}</span>`}</div><div><b>${esc(currentUser.NOMBRE||'Usuario')}</b><p>${esc(currentUser.CORREO||'')} · ${esc(currentUser.ROL_NOMBRE||currentUser.ROL_ID||'')}</p><small>JPG, PNG o WEBP · máximo 5 MB</small></div></div><div class="info-grid full"><div class="info-item"><span>Estado</span><b>${esc(currentUser.ESTADO||'—')}</b></div><div class="info-item"><span>Último acceso</span><b>${esc(fmtDate(currentUser.ULTIMO_ACCESO,true)||'—')}</b></div></div><label class="field full"><span>Cambiar foto de perfil</span><input name="FOTO" type="file" accept="image/jpeg,image/png,image/webp" required></label><div class="form-actions full"><button class="btn soft" type="button" data-cancel-modal>Cerrar</button><button class="btn primary" type="submit">Guardar foto</button></div></form>`;openModal();
    const form=$('#profilePhotoForm');$('[data-cancel-modal]',form).onclick=closeModal;form.onsubmit=event=>{event.preventDefault();const file=form.elements.FOTO.files?.[0],button=$('button[type="submit"]',form);if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type))return toast('Formato no válido','Use una imagen JPG, PNG o WEBP.','error');if(file.size>5*1024*1024)return toast('Imagen demasiado grande','La foto de perfil no puede superar 5 MB.','error');conCargaBoton(button,'Guardando…',async()=>{try{const dataUrl=await leerArchivoDataUrl(file),result=await api.request('updateProfilePhoto',{data:{NOMBRE_ARCHIVO:file.name,TIPO_MIME:file.type,ARCHIVO_BASE64:dataUrl}}),user=result.user||result.usuario;if(!result.persistenciaConfirmada&&!result.PERSISTENCIA_CONFIRMADA)throw new Error('FOTO_PERFIL_NO_CONFIRMADA');if(user){currentUser=user;const auth=api.getAuth();api.setAuth({...auth,user});postParent({tipo:'flotas:usuario-actualizado',usuario:user,seccion:currentSection});}const me=await api.request('me',{cache:false,force:true}),confirmado=me.user||me.usuario;if(!confirmado||String(confirmado.FOTO_PERFIL_RUTA||'')!==String(result.path||''))throw new Error('FOTO_PERFIL_NO_CONFIRMADA');currentUser=confirmado;api.setAuth({...api.getAuth(),user:confirmado});fotoPerfilTemporal=String(result.fotoUrlTemporal||result.FOTO_URL_TEMPORAL||result.url||'');await cargarFotoPerfilUsuario(true);closeModal();toast('Foto guardada y confirmada','La imagen quedó registrada en su cuenta y verificada por el servidor.');}catch(error){toast('No se pudo guardar la foto',translateError(error),'error');throw error;}});};
  }

  function openInfoModal(title,items){$('#modalEyebrow').textContent='INFORMACIÓN';$('#modalTitle').textContent=title;$('#modalBody').innerHTML=`<div class="info-grid">${items.map(([a,b])=>`<div class="info-item"><span>${a}</span><b>${esc(b||'—')}</b></div>`).join('')}</div>`;openModal();}
  function openPasswordModal(){$('#modalEyebrow').textContent='SEGURIDAD';$('#modalTitle').textContent='Cambiar contraseña';$('#modalBody').innerHTML=`<form class="form-grid" id="passwordForm"><label class="field full"><span>Contraseña actual</span><input name="contrasenaActual" type="password" required></label><label class="field full"><span>Nueva contraseña</span><input name="nuevaContrasena" type="password" required placeholder="Letras, números o símbolos"></label><p class="helper full">Puede elegir cualquier combinación. La contraseña distingue mayúsculas y minúsculas.</p><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn primary" type="submit">Cambiar contraseña</button></div></form>`;openModal();$('[data-cancel-modal]').onclick=closeModal;$('#passwordForm').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=$('button[type="submit"]',form);await conCargaBoton(button,'Actualizando…',async()=>{try{await api.request('changePassword',Object.fromEntries(new FormData(form).entries()));invalidarListasFormulario('users');closeModal();toast('Contraseña actualizada');}catch(error){toast('No se pudo cambiar',translateError(error),'error');}});};}

  function bindGlobal() {
    $('#setupForm').addEventListener('submit',handleSetup);$('#loginForm').addEventListener('submit',handleLogin);$('#showPassword').addEventListener('click',()=>{const input=$('#loginPassword');input.type=input.type==='password'?'text':'password';});
    $('#retryConnection').addEventListener('click',event=>conCargaBoton(event.currentTarget,'Conectando…',checkSystem));$('#recheckConnection').addEventListener('click',event=>conCargaBoton(event.currentTarget,'Conectando…',checkSystem));$('#useLocalMode').addEventListener('click',()=>{sessionStorage.setItem('flotas_forzar_local','1');location.reload();});
    $('#openSidebar').addEventListener('click',openSidebar);$('#closeSidebar').addEventListener('click',closeSidebar);$('#overlay').addEventListener('click',closeSidebar);$('#logoutButton').addEventListener('click',event=>conCargaBoton(event.currentTarget,'Cerrando…',logout));
    $('#notificationButton').addEventListener('click',()=>{if(currentUser&&(hasPermission('NOTIFICACIONES','LEER')||hasPermission('ALERTAS','LEER')))openNotificationCenter();});
    $('#themeButton').addEventListener('click',()=>setTheme(!document.body.classList.contains('dark')));$('#profileButton').addEventListener('click',()=>$('#profileMenu').classList.toggle('open'));
    $('#profileMenu').addEventListener('click',event=>{const action=event.target.dataset.profileAction;if(action==='profile')showProfile();if(action==='password')openPasswordModal();if(action==='logout')conCargaBoton(event.target,'Cerrando…',logout);$('#profileMenu').classList.remove('open');});
    $('#closeModal').addEventListener('click',closeModal);$('#modalBackdrop').addEventListener('click',event=>{if(event.target===$('#modalBackdrop'))closeModal();});
    $('#closeQr').addEventListener('click',closeQr);$('#qrBackdrop').addEventListener('click',event=>{if(event.target===$('#qrBackdrop'))closeQr();});$('#startCamera').addEventListener('click',event=>conCargaBoton(event.currentTarget,'Activando…',()=>startCamera($('#cameraSelect').value)));$('#cameraSelect').addEventListener('change',event=>startCamera(event.target.value));$('#switchCamera').addEventListener('click',event=>conCargaBoton(event.currentTarget,'Cambiando…',()=>{facingMode=facingMode==='environment'?'user':'environment';return startCamera();}));$('#validateQr').addEventListener('click',event=>conCargaBoton(event.currentTarget,'Validando…',()=>processQr($('#manualQr').value)));
    window.addEventListener('flotas:guardado-local',()=>{setSave('Datos guardados');refreshNotificationBadge();});
    window.addEventListener('flotas:cache-actualizada',event=>{
      const detail=event.detail||{};
      const dependency=dependenciaSeccion(currentSection);
      if((detail.resource&&dependency.resources.includes(detail.resource))||dependency.actions.includes(detail.action)){
        if(modulosSincronizadosSesion.has(currentSection)&&!estadoSincronizacionModulos[currentSection]?.time)registrarSincronizacionSeccion(currentSection,'SERVIDOR');
        actualizarEstadoSincronizacionVisible(textoActualizacionSeccion(currentSection));
      }
    });
    window.addEventListener('flotas:sesion-invalida',event=>{
      if(embeddedMode){postParent({tipo:'flotas:autenticacion-requerida',codigo:event.detail?.codigo||'SESION_INVALIDA'});return;}
      if(currentUser)forceLogout();
    });
    window.addEventListener('flotas:sesion-cambiada',event=>{if(!event.detail?.token&&currentUser)forceLogout();});
    window.addEventListener('storage',event=>{if(event.key===config.CLAVE_ALMACENAMIENTO_LOCAL&&!api.isRemote()){api.reloadLocal();if(currentUser)go(currentSection);}if(event.key===operationalPointDeviceKey){const cached=cargarPuntoOperacionDispositivo();if(cached){currentCompany={...(currentCompany||{}),...cached};['operations','settings','routes','gps'].forEach(section=>cacheVistasModulo.delete(section));}}});
    window.addEventListener('online',()=>{setConnection(true,'Conexión restablecida');sendHeartbeat();});window.addEventListener('offline',()=>setConnection(false,'Sin conexión a Internet'));
    document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeModal();closeQr();$('#profileMenu').classList.remove('open');}});
    window.addEventListener('message',event=>{
      if(!embeddedMode)return;
      if(event.source!==window.parent)return;
      if(event.origin!==location.origin&&event.origin!=='null')return;
      const data=event.data||{};
      if(data.tipo==='flotas:autenticacion'){
        const auth=data.auth||{};
        if(config.PRODUCCION_SEGURA===true&&String(data.seccionAutorizada||'')!==String(initialSection)){
          postParent({tipo:'flotas:autenticacion-requerida',codigo:'MODULO_NO_AUTORIZADO',seccion:initialSection});return;
        }
        if(!auth.token||!auth.user){postParent({tipo:'flotas:autenticacion-requerida',codigo:'AUTENTICACION_REQUERIDA',seccion:initialSection});return;}
        const versionAnterior=Number(currentUser?.VERSION_PERMISOS||0),rolAnterior=String(currentUser?.ROL_ID||'').toUpperCase(),modoAnterior=String(currentUser?.MODO_PERMISOS||'ROL').toUpperCase();
        api.setAuth(auth);
        currentUser=auth.user;
        showApp();
        const permisosCambiaron=versionAnterior!==Number(currentUser?.VERSION_PERMISOS||0)||rolAnterior!==String(currentUser?.ROL_ID||'').toUpperCase()||modoAnterior!==String(currentUser?.MODO_PERMISOS||'ROL').toUpperCase();
        if(permisosCambiaron&&appInicializada){
          buildNav();
          if(!hayInteraccionVisualActiva()){cacheVistasModulo.delete(currentSection);setTimeout(()=>go(currentSection),30);}
          else toast('Permisos actualizados','Los nuevos permisos ya están activos. Los controles se ajustarán al terminar la edición actual.','info');
        }
        return;
      }
      if(data.tipo==='flotas:vehiculo-asignado-actualizado'&&currentUser){
        api.invalidate({resources:['documents','vehicles','drivers','checkins']});
        cacheVistasModulo.delete('documents');cacheListasFormulario.delete('documents');
        if(currentSection==='documents'){
          if(hayInteraccionVisualActiva()){
            actualizacionVehiculoAsignadoPendiente=true;
            toast('Vehículo asignado actualizado','El expediente del nuevo vehículo se mostrará al cerrar la edición actual.','info');
          }else{
            actualizacionVehiculoAsignadoPendiente=false;
            setTimeout(()=>go('documents'),30);
          }
        }
        return;
      }
      if(data.tipo==='flotas:cerrar-sesion'&&currentUser)logout();
      if(data.tipo==='flotas:navegar'&&currentUser&&renderers[data.seccion])go(data.seccion);
      if(data.tipo==='flotas:sincronizar'&&currentUser)sincronizarSistema(null);
      if(data.tipo==='flotas:tema')setTheme(Boolean(data.oscuro));
      if(data.tipo==='flotas:modulo-visible'&&currentUser)redibujarMapaAlHacerseVisible();
    });
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('mapa-pantalla-completa'))toggleMapFullscreen(false);});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){if(assignmentAlertNode)hacerPersistenteAvisoAsignacion(assignmentAlertNode);if(connectionTrackingLiveTimer)clearTimeout(connectionTrackingLiveTimer);connectionTrackingLiveTimer=null;if(currentUser)sendHeartbeat('En segundo plano');releaseWakeLock();return;}if(currentUser){sendHeartbeat('En línea');resumeTrackingIfAllowed();if(gpsWatchId!==null)requestWakeLock();redibujarMapaAlHacerseVisible();if(currentSection==='gps')refreshLocations(false,false);if(currentSection==='connections'){refreshConnectionsOnline(false,false);scheduleConnectionTrackingLive(80);}}});
    window.addEventListener('pageshow',()=>setTimeout(redibujarMapaAlHacerseVisible,40));
    window.addEventListener('resize',()=>setTimeout(redibujarMapaAlHacerseVisible,80));
    window.addEventListener('orientationchange',()=>setTimeout(redibujarMapaAlHacerseVisible,180));
  }

  function init(){bindGlobal();setTheme(window.TemaFlotas?.modoOscuroInicial?.()??localStorage.getItem('flotas_tema')==='dark');checkSystem();}
  window.addEventListener('pagehide',()=>{cleanupSection();stopRealtimeServices();stopCamera();releaseWakeLock();});
  init();
})();
