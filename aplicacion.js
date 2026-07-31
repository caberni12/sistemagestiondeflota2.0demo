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
  const carpetasDrive = Object.freeze({
    documentosFotos:'https://drive.google.com/drive/folders/1lWKDp7E28XU2D45ihvZctIq29Ji_aoq9',
    documentosPdf:'https://drive.google.com/drive/folders/1_2TgmSkzhRzcOQvw0_-ZiHfLTdUuQD2M',
    boletasCombustible:'https://drive.google.com/drive/folders/1JE9_yNAo0gpCZ1CnAnXMN8bhNh6fZTPj',
    rutasFotos:'https://drive.google.com/drive/folders/1lWKDp7E28XU2D45ihvZctIq29Ji_aoq9'
  });

  const operationalPointDeviceKey = 'flotas_punto_operacional_dispositivo_v1';
  const lastKnownLocationDeviceKey = 'flotas_ultima_ubicacion_dispositivo_v1';
  let currentUser = null;
  let currentCompany = cargarPuntoOperacionDispositivo() || null;
  let reconocimientoVoz = null;
  let vozEscuchando = false;
  let dictadoNativoPendiente = null;
  let currentSection = initialSection;
  let mapaFlota = null;
  let promesaComponenteMapa = null;
  let promesaInicializacionMapa = null;
  let ultimaUbicacionEnviada = null;
  let ultimaPosicionConocida = cargarUltimaUbicacionDispositivo();
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
  let realtimeTimer = null;
  let heartbeatTimer = null;
  let notificationTimer = null;
  let notificationSnapshotReady = false;
  let notificationCenterState = { notifications:[], alerts:[] };
  let knownNotificationIds = new Set();
  let knownAlertIds = new Set();
  let gpsWatchId = null;
  let mediaStream = null;
  let barcodeDetector = null;
  let scanFrameId = null;
  let facingMode = 'environment';
  let qrContextoActual = 'vehiculo-operacion';
  let batteryLevel = '';
  let clientPublicIp = sessionStorage.getItem('flotas_ip_publica_v1') || '';
  let lastAddressLookup = { key:'', address:'', time:0 };
  let lastAddressSearchAt = 0;
  let addressSearchQueue = Promise.resolve();
  const addressSearchCache = new Map();
  const cacheVistasModulo = new Map();
  const cacheListasFormulario = new Map();
  const cacheRegistros = new Map();
  const listasFormularioPendientes = new Map();
  const claveEstadoSincronizacion = 'flotas_estado_sincronizacion_modulos_v1';
  const cargaManualModulos = config.CARGA_MANUAL_MODULOS !== false;
  const estadoSincronizacionModulos = {};
  const modulosSincronizadosSesion = new Set();
  const actualizacionesModuloPendientes = new Map();
  let conversacionOficinaVirtual = [];
  let cargaPendientesOficinaVirtual = null;
  try { localStorage.removeItem(claveEstadoSincronizacion); } catch (_) {}
  const dependenciasCacheSeccion = Object.freeze({
    dashboard:{ actions:['dashboard','realtimeSummary'], resources:['operations','routes','notifications','vehicles','drivers','connections'] },
    office:{ actions:['officeQuickStatus','officeTasks','officeStatus'], resources:['notifications','alerts','documents','routes','checkins'] },
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
    settings:{ actions:['status','diagnoseSystem','getOperationalPoint'], resources:['companies'] },
  });
  let secuenciaNavegacion = 0;
  let secuenciaModal = 0;
  let precargaIniciada = false;
  let sincronizacionPendiente = null;
  let geolocationPermissionState = 'desconocido';
  let geolocationPermissionHandle = null;
  let wakeLock = null;
  let lastGpsErrorAt = 0;
  const trackingPreferenceKey = 'flotas_ubicacion_continua_v1';
  const routeTrackingKey = 'flotas_ruta_seguimiento_activa_v1';
  const pendingRouteCheckinKey = 'flotas_ruta_checkin_pendiente_v1';
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

  const navGroups = [
    ['GENERAL', [
      ['dashboard','⌂','Panel principal'], ['office','◆','Oficina Virtual'], ['routes','➜','Rutas asignadas'], ['checkin','✓','Check-in vehicular'], ['operations','⇄','Operaciones'], ['gps','⌖','GPS en tiempo real'],
      ['notifications','🔔','Notificaciones']
    ]],
    ['GESTIÓN', [
      ['vehicles','▣','Vehículos'], ['drivers','♙','Conductores'], ['checkinApprovals','☑','Aprobar check-ins'], ['checkinHistory','▤','Historial de check-in'], ['maintenance','⚙','Mantenciones'], ['fuel','⛽','Combustible'],
      ['documents','▤','Documentos'], ['history','↻','Historial'], ['alerts','!','Alertas']
    ]],
    ['ADMINISTRACIÓN', [
      ['connections','◎','Conexiones en línea'], ['users','♚','Usuarios'], ['company','🏢','Empresa'], ['reports','▥','Reportes'], ['audit','☷','Auditoría'], ['settings','⚒','Configuración']
    ]]
  ];

  const resourceFields = {
    vehicles: {
      title:'Vehículo', eyebrow:'FLOTA', fields:[
        ['PATENTE','Patente','text',true],['MARCA','Marca','text',true],['MODELO','Modelo','text',true],['ANIO','Año','number',false],
        ['COLOR','Color','text',false],['COMBUSTIBLE','Combustible','select',['Diésel','Gasolina','Eléctrico','Híbrido','Gas']],
        ['VIN','VIN / chasis','text',false],['KILOMETRAJE','Kilometraje','number',false],
        ['ESTADO','Estado','select',['Disponible','En ruta','Mantención','Inactivo']],['PROXIMA_MANTENCION','Próxima mantención','date',false]
      ]
    },
    drivers: {
      title:'Conductor', eyebrow:'PERSONAL', fields:[
        ['NOMBRE','Nombre completo','text',true],['RUT','RUT','text',true],['TELEFONO','Teléfono','text',false],['CORREO','Correo','email',false],
        ['LICENCIA_CLASE','Clase de licencia','select',['A1','A2','A3','A4','A5','B','C','D','E','F']],
        ['LICENCIA_VENCIMIENTO','Vencimiento licencia','date',false],['ESTADO','Estado','select',['Disponible','En viaje','Licencia vencida','Inactivo']],
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
        ['USUARIO_ASOCIADO_ID','Cuenta asociada','userSelect',false],['ASOCIADO_ID','ID asociado','text',false],['CORREO_ASOCIADO','Correo asociado','email',false],['IDENTIFICACION','RUT, patente o identificación','text',true],
        ['FECHA_EMISION','Fecha emisión','date',false],['FECHA_VENCIMIENTO','Fecha vencimiento','date',true],['ESTADO','Estado','select',['Pendiente de revisión','Vigente','Por vencer','Vencido','Rechazado','Anulado']],
        ['DIRECCION_ARCHIVO','URL de archivo en Drive','url',false],['OBSERVACIONES','Observaciones','textarea',false]
      ]
    },
    users: {
      title:'Usuario', eyebrow:'SEGURIDAD', fields:[
        ['NOMBRE','Nombre completo','text',true],['CORREO','Correo','email',true],['CONTRASENA','Contraseña','password',true],
        ['ROL_ID','Rol','select',[['ROL-ADMIN','Administrador'],['ROL-SUPERVISOR','Supervisor'],['ROL-CONDUCTOR','Conductor']]],
        ['ESTADO','Estado','select',['Activo','Inactivo','Bloqueado']],['TELEFONO','Teléfono','text',false]
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
    vehicles:{title:'Vehículos',template:'Plantilla_Importacion_Vehiculos.xlsx',required:['PATENTE','MARCA','MODELO'],headers:['PATENTE','MARCA','MODELO','ANIO','COLOR','COMBUSTIBLE','VIN','KILOMETRAJE','ESTADO','PROXIMA_MANTENCION']},
    drivers:{title:'Conductores',template:'Plantilla_Importacion_Conductores.xlsx',required:['NOMBRE','RUT'],headers:['NOMBRE','RUT','TELEFONO','CORREO','LICENCIA_CLASE','LICENCIA_VENCIMIENTO','ESTADO','USUARIO_ID']},
    documents:{title:'Documentos',template:'Plantilla_Importacion_Documentos.xlsx',required:['TIPO','ASOCIADO_TIPO','IDENTIFICACION','FECHA_VENCIMIENTO'],headers:['TIPO','ASOCIADO_TIPO','IDENTIFICACION','ASOCIADO_ID','FECHA_EMISION','FECHA_VENCIMIENTO','ESTADO','DIRECCION_ARCHIVO','OBSERVACIONES']}
  });

  const labels = {
    dashboard:'Panel principal',office:'Oficina Virtual',routes:'Rutas asignadas',vehicles:'Vehículos',drivers:'Conductores',checkin:'Check-in vehicular',checkinApprovals:'Aprobación de check-ins',checkinHistory:'Historial de check-in',operations:'Operaciones',gps:'GPS en tiempo real',maintenance:'Mantenciones',fuel:'Combustible',
    notifications:'Notificaciones',documents:'Documentos',history:'Historial',alerts:'Alertas',connections:'Conexiones en línea',users:'Usuarios',reports:'Reportes',audit:'Auditoría',company:'Empresa',settings:'Configuración'
  };

  const navPermission = {
    dashboard:'PANEL_PRINCIPAL',office:'OFICINA_VIRTUAL',routes:'RUTAS',checkin:'CHECKIN',checkinApprovals:'CHECKIN_APROBACIONES',checkinHistory:'CHECKIN',operations:'OPERACIONES',gps:'GPS',notifications:'NOTIFICACIONES',
    vehicles:'VEHICULOS',drivers:'CONDUCTORES',maintenance:'MANTENCIONES',fuel:'COMBUSTIBLE',documents:'DOCUMENTOS',history:'HISTORIAL',
    alerts:'ALERTAS',connections:'CONEXIONES',users:'USUARIOS',company:'CONFIGURACION',reports:'REPORTES',audit:'BITACORA',settings:'CONFIGURACION'
  };
  const resourcePermission={vehicles:'VEHICULOS',drivers:'CONDUCTORES',maintenance:'MANTENCIONES',fuel:'COMBUSTIBLE',documents:'DOCUMENTOS',alerts:'ALERTAS',users:'USUARIOS'};
  const permissionCatalog = Object.freeze([
    ['PANEL_PRINCIPAL','Panel principal'],['OFICINA_VIRTUAL','Oficina Virtual'],['USUARIOS','Usuarios'],['VEHICULOS','Vehículos'],['CONDUCTORES','Conductores'],
    ['OPERACIONES','Operaciones'],['CHECKIN','Check-in'],['CHECKIN_APROBACIONES','Aprobar check-ins'],['GPS','Ubicación en tiempo real'],
    ['HISTORIAL','Historial'],['MANTENCIONES','Mantenciones'],['COMBUSTIBLE','Combustible'],['DOCUMENTOS','Documentos'],['ALERTAS','Alertas'],
    ['REPORTES','Reportes'],['BITACORA','Auditoría'],['CONFIGURACION','Configuración'],['QR','QR'],['RUTAS','Rutas'],
    ['NOTIFICACIONES','Notificaciones'],['CONEXIONES','Conexiones en línea · acceso delegado']
  ]);
  const permissionActions = Object.freeze([['LEER','Ver'],['CREAR','Crear'],['ACTUALIZAR','Editar'],['ELIMINAR','Eliminar']]);

  const checkinCatalog = Object.freeze([
    {id:'documentacion',categoria:'Documentación',item:'Documentos obligatorios vigentes y disponibles',critico:true},
    {id:'luces',categoria:'Exterior',item:'Luces, intermitentes y señalización',critico:true},
    {id:'frenos',categoria:'Seguridad',item:'Frenos de servicio y estacionamiento',critico:true},
    {id:'direccion',categoria:'Seguridad',item:'Dirección sin juego, trabas ni ruidos anormales',critico:true},
    {id:'neumaticos',categoria:'Exterior',item:'Neumáticos, presión, desgaste y rueda de repuesto',critico:true},
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
    return esAdministrador()||permissions.includes('*:*')||permissions.includes(`${module}:${action}`);
  }
  function puedeAdministrarPuntoOperacion(){return ['ROL-ADMIN','ROL-SUPERVISOR'].includes(String(currentUser?.ROL_ID||''));}
  function puedeCierreExcepcional(){return ['ROL-ADMIN','ROL-SUPERVISOR'].includes(String(currentUser?.ROL_ID||''));}
  function esAdministrador(){const rol=String(currentUser?.ROL_ID||currentUser?.ROL_NOMBRE||'').trim().toUpperCase();return rol==='ROL-ADMIN'||rol==='ADMINISTRADOR'||(Array.isArray(currentUser?.PERMISOS)&&currentUser.PERMISOS.includes('*:*'));}
  function claveAvisosEmergentes(){return `flotas_avisos_emergentes_admin_v1_${String(currentUser?.ID||currentUser?.USUARIO_ID||'sin_usuario')}`;}
  function avisosEmergentesActivos(){
    if(!esAdministrador())return true;
    try{return localStorage.getItem(claveAvisosEmergentes())!=='NO';}
    catch(_){return true;}
  }
  function puedeFinalizarOperacion(){return ['ROL-ADMIN','ROL-SUPERVISOR','ROL-CONDUCTOR'].includes(String(currentUser?.ROL_ID||''));}
  function postParent(message){
    if(!embeddedMode||window.parent===window)return;
    try{window.parent.postMessage(message,'*');}catch(_){}
  }
  function navigateSection(section){
    if(embeddedMode&&window.parent!==window){postParent({tipo:'flotas:navegar',seccion:section});return Promise.resolve(true);}
    return go(section);
  }

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const fmtDate = (value, time = false) => {
    if (!value) return '—';
    const date = new Date(value); if (Number.isNaN(date.getTime())) return esc(value);
    return new Intl.DateTimeFormat('es-CL', time ? { dateStyle:'short', timeStyle:'short' } : { dateStyle:'medium' }).format(date);
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
      CREDENCIALES_INVALIDAS:'Correo o contraseña incorrectos. El propietario puede ejecutar prepararAccesoAdministrador() en Apps Script.', CLAVE_INSTALACION_INVALIDA:'La clave de instalación no coincide con la generada por instalarSistema().',
      CLAVE_INSTALACION_REQUERIDA:'Ingrese una clave de instalación.', CONTRASENA_REQUERIDA:'Ingrese la contraseña elegida.',
      DATOS_DE_ADMINISTRADOR_INVALIDOS:'Complete los datos del administrador e ingrese una contraseña.',
      SISTEMA_YA_INICIALIZADO:'El sistema ya tiene usuarios registrados.', AUTENTICACION_REQUERIDA:'La sesión no está disponible.', SESION_INVALIDA:'La sesión dejó de ser válida.',
      SESION_EXPIRADA:'La sesión expiró.', PERMISO_DENEGADO:'Su rol no tiene permiso para realizar esta acción.', ULTIMO_ADMINISTRADOR_PROTEGIDO:'No se puede quitar o desactivar al último administrador activo.', CONTRASENAS_NO_COINCIDEN:'Las contraseñas no coinciden.', RECURSO_NO_ENCONTRADO:'El recurso solicitado no existe.',
      REGISTRO_NO_ENCONTRADO:'El registro no existe.', VEHICULO_NO_DISPONIBLE:'El vehículo no está disponible.', CONDUCTOR_NO_DISPONIBLE:'El conductor no está disponible.',
      OPERACION_NO_ACTIVA:'La operación ya no está activa.', CORREO_YA_EXISTE:'El correo ya está registrado.', DIRECCION_APLICACION_NO_CONFIGURADA:'Falta configurar la dirección de la aplicación en configuracion.js.',
      ID_HOJA_NO_CONFIGURADO:'La base de datos central no está configurada correctamente.', TIEMPO_DE_ESPERA_AGOTADO:'La base de datos tardó demasiado en responder.',
      CONTRASENA_ACTUAL_INVALIDA:'La contraseña actual no es correcta.', FORMATO_LOGOTIPO_INVALIDO:'El formato del logotipo no es válido.', LOGOTIPO_DEMASIADO_GRANDE:'El logotipo supera el tamaño máximo de 1,5 MB.',
      ID_HOJA_NO_CONFIGURADO:'La base de datos central no está configurada correctamente.', CONFIRMACION_REQUERIDA:'Debe escribir exactamente “LIMPIAR DATOS”.',
      CONDUCTOR_NO_ASOCIADO:'La cuenta no está asociada a un conductor.', CONDUCTOR_NO_ENCONTRADO:'El conductor seleccionado no existe.', VEHICULO_NO_ENCONTRADO:'El vehículo seleccionado no existe.',
      QR_NO_RECONOCIDO:'El código QR no corresponde a un vehículo registrado.', CODIGO_QR_REQUERIDO:'Ingrese o escanee un código QR.', ETIQUETA_QR_ROL_NO_AUTORIZADO:'Solo los Administradores y Supervisores pueden generar o imprimir etiquetas QR de vehículos.', GENERADOR_QR_NO_DISPONIBLE:'No se pudo cargar el generador QR local. Recargue la aplicación e inténtelo nuevamente.', VEHICULO_PATENTE_REQUERIDA:'El vehículo debe tener una patente válida para generar su QR.', VEHICULO_REQUERIDO:'Seleccione un vehículo para generar la etiqueta QR.', RUTA_NO_ENCONTRADA:'La ruta no existe.',
      ALERTA_OPERACIONAL_REQUIERE_ADMINISTRADOR:'Esta alerta operacional debe ser validada y cerrada por un Administrador real después de comprobar la situación en terreno.',
      ESTADO_RUTA_INVALIDO:'El estado solicitado para la ruta no es válido.', DESTINATARIO_REQUERIDO:'Seleccione un destinatario.', USUARIO_DESTINATARIO_NO_ENCONTRADO:'El usuario destinatario no existe o no está activo.', SIN_DESTINATARIOS_PARA_EL_ALCANCE:'No existen cuentas activas que coincidan con el grupo seleccionado.', TITULO_Y_MENSAJE_REQUERIDOS:'Complete el título y el mensaje.', TIPO_AVISO_INVALIDO:'Seleccione una clase de aviso válida.', ALCANCE_AVISO_INVALIDO:'Seleccione un grupo de destinatarios válido.', NOTIFICACION_NO_ENCONTRADA:'La notificación no existe.', ALERTA_NO_ENCONTRADA:'La alerta no existe.', LECTURA_NOTIFICACION_NO_CONFIRMADA:'La notificación no confirmó su estado leído en la base central.', LECTURA_ALERTA_NO_CONFIRMADA:'La alerta no confirmó su estado leído en la base central.',
      COORDENADAS_INVALIDAS:'Las coordenadas recibidas no son válidas.', AUTORIZACION_QR_INVALIDA:'Valide nuevamente el QR del vehículo. La autorización dura cinco minutos.',
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
      UBICACION_GPS_IMPRECISA:'La señal GPS es demasiado imprecisa. Salga a un lugar abierto y vuelva a intentarlo.', FUERA_DEL_PUNTO_DE_INICIO:'No puede iniciar la operación fuera del punto autorizado por el Administrador.',
      FUERA_DEL_PUNTO_DE_FINALIZACION:'No puede finalizar la operación hasta regresar al punto autorizado.', RADIO_OPERACION_INVALIDO:'Los radios y la precisión permitida deben estar entre 10 y 5.000 metros.',
      RUTA_NO_DISPONIBLE:'La ruta seleccionada ya no está disponible.', RUTA_NO_CONFIRMADA_EN_CURSO:'El servidor respondió, pero no confirmó la ruta en estado En curso. Publique nuevamente Codigo_Completo.gs.', RUTA_VEHICULO_REQUERIDO:'La ruta necesita un vehículo asignado o una operación activa con vehículo.', RUTA_VEHICULO_NO_COINCIDE_OPERACION:'La operación activa utiliza otro vehículo distinto al asignado en la ruta.', RUTA_NO_COINCIDE_CONDUCTOR:'La ruta no corresponde al conductor seleccionado.', RUTA_NO_COINCIDE_VEHICULO:'La ruta no corresponde al vehículo seleccionado.', RUTA_YA_VINCULADA:'La ruta ya está vinculada a otra operación activa.',
      PUNTO_OPERACION_ROL_NO_AUTORIZADO:'Solo un Administrador o Supervisor puede configurar o cambiar el punto base.', CIERRE_EXCEPCIONAL_NO_AUTORIZADO:'Solo un Administrador o Supervisor puede cerrar una operación fuera de la base.',
      CIERRE_EXCEPCIONAL_CONFIRMACION_REQUERIDA:'Active la opción de cierre excepcional para continuar fuera de la base.', CIERRE_EXCEPCIONAL_MOTIVO_REQUERIDO:'Explique el motivo del cierre excepcional con al menos 10 caracteres.',
      KILOMETRAJE_FINAL_INVALIDO:'El kilometraje será guardado para revisión, pero no impedirá finalizar.', SOLO_ADMINISTRADOR:'Solo un Administrador puede realizar esta acción.', ACCESO_CONEXIONES_NO_AUTORIZADO:'El Administrador no ha habilitado el acceso a Conexiones en línea para este usuario.', USUARIO_SEGUIMIENTO_NO_ENCONTRADO:'El usuario seleccionado para seguimiento ya no está disponible.', MOTIVO_EDICION_REQUERIDO:'Indique un motivo de al menos 5 caracteres para registrar la edición.', FECHA_OPERACION_INVALIDA:'La fecha indicada no es válida.', RECURSO_IMPORTACION_NO_PERMITIDO:'Este módulo no admite importación masiva.',
      COMBUSTIBLE_VEHICULO_REQUERIDO:'Seleccione el vehículo de la carga.', COMBUSTIBLE_CONDUCTOR_REQUERIDO:'Seleccione el conductor relacionado.',
      COMBUSTIBLE_LITROS_INVALIDO:'Ingrese una cantidad de litros mayor que cero.', COMBUSTIBLE_PRECIO_LITRO_INVALIDO:'Ingrese un precio por litro válido.', COMBUSTIBLE_KILOMETRAJE_INVALIDO:'Ingrese un kilometraje válido.',
      COMBUSTIBLE_FECHA_INVALIDA:'La fecha y hora de la carga no son válidas.', COMBUSTIBLE_OPERACION_NO_COINCIDE:'La operación seleccionada no corresponde al vehículo y conductor.',
      COMBUSTIBLE_RUTA_NO_COINCIDE:'La ruta seleccionada no corresponde al vehículo y conductor.', COMBUSTIBLE_ASIGNACION_ACTIVA_REQUERIDA:'Debe seleccionar una operación o ruta activa para registrar la carga.', COMBUSTIBLE_ASIGNACION_NO_VIGENTE:'La asignación seleccionada ya no está activa.',
      COMBUSTIBLE_MOTIVO_ELIMINACION_REQUERIDO:'Indique un motivo suficiente para eliminar el registro.', COMBUSTIBLE_SOLICITUD_YA_EXISTE:'Ya existe una solicitud pendiente o aprobada para esta carga.',
      COMBUSTIBLE_AUTORIZACION_ADMIN_REQUERIDA:'La eliminación requiere una autorización vigente de un Administrador.', COMBUSTIBLE_DECISION_INVALIDA:'Seleccione aprobar o rechazar la solicitud.',
      COMBUSTIBLE_SOLICITUD_NO_ENCONTRADA:'La solicitud de eliminación no existe.', COMBUSTIBLE_SOLICITUD_YA_RESUELTA:'La solicitud ya fue resuelta.', SOLO_SUPERVISOR_SOLICITA_ELIMINACION:'Solo el Supervisor puede solicitar esta autorización.',
      COMBUSTIBLE_OPERACION_NO_AUTORIZADA:'La operación seleccionada pertenece a otro conductor.', COMBUSTIBLE_RUTA_NO_AUTORIZADA:'La ruta seleccionada pertenece a otro conductor.', CONDUCTOR_NO_ASOCIADO_USUARIO:'Su cuenta todavía no está asociada a un registro de conductor.',
      DOCUMENTO_CONDUCTOR_NO_ENCONTRADO:'El conductor seleccionado no existe.', DOCUMENTO_USUARIO_NO_ENCONTRADO:'La cuenta seleccionada no existe.',
      IMPORTACION_SIN_FILAS:'La planilla no contiene filas para importar.', IMPORTACION_DEMASIADAS_FILAS:'La planilla supera el máximo de 1.500 filas por carga.', LECTOR_XLSX_NO_DISPONIBLE:'No se cargó el lector de Excel. Recargue la página con Ctrl + F5.', FORMATO_IMPORTACION_INVALIDO:'Use una plantilla XLSX o CSV válida.', PLANILLA_SIN_HOJA_DATOS:'La planilla no contiene la hoja de datos esperada.', ASOCIADO_NO_ENCONTRADO:'No se encontró el vehículo, conductor o empresa indicado en el documento.',
      ARCHIVO_REQUERIDO:'Seleccione un archivo para subir.', DESTINO_ARCHIVO_INVALIDO:'La carpeta de destino no es válida.', CARGA_DOCUMENTOS_BLOQUEADA_ADMIN:'El Administrador bloqueó temporalmente la carga de documentos para esta cuenta.', FORMATO_ARCHIVO_DRIVE_INVALIDO:'Use una imagen para fotos o un archivo PDF para documentos PDF.', ARCHIVO_BASE64_INVALIDO:'No se pudo procesar el archivo seleccionado.', ARCHIVO_DRIVE_DEMASIADO_GRANDE:'El archivo supera el máximo permitido de 12 MB.', CARPETA_DRIVE_NO_DISPONIBLE:'La cuenta que ejecuta Apps Script no tiene acceso a la carpeta de Google Drive.', DRIVE_REQUIERE_CONEXION_CENTRAL:'La carga a Google Drive requiere conexión con la aplicación de Apps Script.', EVIDENCIA_RUTA_NO_AUTORIZADA:'La fotografía no pertenece a esta ruta o no está autorizada.', EVIDENCIA_RUTA_NO_DISPONIBLE:'La fotografía no está disponible en Google Drive.', EVIDENCIA_RUTA_NO_ES_IMAGEN:'El respaldo seleccionado no es una imagen válida.', EVIDENCIA_RUTA_DEMASIADO_GRANDE:'La imagen es demasiado grande para mostrarse.'
    };
    if (messages[key]) return messages[key];
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
    const compact=button.matches('.row-actions button,.icon-button')||(button.classList.contains('topbar-sync')&&window.matchMedia?.('(max-width:760px)').matches);
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
    if (!button) return action();
    const finalizar = activarCargaBoton(button, text);
    if (!finalizar) return;
    try { return await action(); }
    finally { finalizar(); }
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
    const pending = api.request('list',{resource})
      .then(result => guardarListaFormulario(resource,result.rows||[]))
      .finally(() => {
        if (listasFormularioPendientes.get(resource) === pending) listasFormularioPendientes.delete(resource);
      });
    listasFormularioPendientes.set(resource,pending);
    return pending;
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
      const result=await api.request('heartbeat',{data:{DISPOSITIVO_ID:deviceId,SESION_CLIENTE_ID:clientSessionId,SECCION_ACTUAL:currentSection,GPS_ACTIVO:gpsWatchId===null?'NO':'SI',PAGINA_VISIBLE:document.hidden?'NO':'SI',ESTADO:state,PLATAFORMA:navigator.platform||'',NAVEGADOR:navigator.userAgent,TIPO_RED:connectionType(),BATERIA_PORCENTAJE:batteryLevel,IP_PUBLICA:clientPublicIp}});
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
  function showIncomingNotice(item,kind){
    if(embeddedMode||!avisosEmergentesActivos())return;
    const critical=kind==='alert'&&String(item.NIVEL||'').toLowerCase().includes('cr')||['Urgente','Alta'].includes(item.PRIORIDAD);
    toast(kind==='alert'?'Nueva alerta':'Nueva notificación',item.TITULO||item.MENSAJE||'Existe un nuevo aviso pendiente.',critical?'error':'success');
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

  async function refreshNotificationBadge(){
    if(!currentUser)return;
    if(embeddedMode){postParent({tipo:'flotas:actualizar-avisos'});return;}
    try{
      const canNotifications=hasPermission('NOTIFICACIONES','LEER'),canAlerts=hasPermission('ALERTAS','LEER');
      const [notificationResult,alertResult]=await Promise.all([
        canNotifications?api.request('list',{resource:'notifications',cache:false}):Promise.resolve({rows:[]}),
        canAlerts?api.request('list',{resource:'alerts',cache:false}):Promise.resolve({rows:[]})
      ]);
      const notifications=deduplicarAvisos((notificationResult.rows||[]).filter(row=>row.LEIDA!=='SI'),'notification').sort((a,b)=>alertItemDate(b)-alertItemDate(a));
      const alerts=deduplicarAvisos((alertResult.rows||[]).filter(row=>row.LEIDA!=='SI'),'alert').sort((a,b)=>alertItemDate(b)-alertItemDate(a));
      notificationCenterState={notifications,alerts};
      const newNotifications=notifications.filter(row=>!knownNotificationIds.has(String(row.ID)));
      const newAlerts=alerts.filter(row=>!knownAlertIds.has(String(row.ID)));
      if(notificationSnapshotReady&&avisosEmergentesActivos()){
        [...newAlerts,...newNotifications].sort((a,b)=>alertItemDate(a)-alertItemDate(b)).slice(-3).forEach(item=>showIncomingNotice(item,alerts.includes(item)?'alert':'notification'));
        const extra=newAlerts.length+newNotifications.length-3;if(extra>0&&!embeddedMode)toast('Nuevos avisos',`${extra} aviso${extra===1?'':'s'} adicional${extra===1?'':'es'} en el centro de notificaciones.`);
      }
      knownNotificationIds=new Set(notifications.map(row=>String(row.ID)));
      knownAlertIds=new Set(alerts.map(row=>String(row.ID)));
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
    const alertRows=alerts.slice(0,8).map(row=>`<article class="notification-card"><header><div><h4>${esc(row.TITULO||'Alerta')}</h4><p>${esc(row.MENSAJE||'')}</p></div>${status(row.NIVEL||'Alerta')}</header><div class="route-meta"><span>${fmtDate(row.FECHA_HORA||row.CREADO_EN,true)}</span><span>${esc(row.MODULO||'Sistema')}</span></div>${esAdministrador()?`<button class="link-button" data-read-alert="${row.ID}" type="button">Validar y cerrar</button>`:'<span class="status warning">Pendiente del Administrador</span>'}</article>`).join('');
    const notificationRows=notifications.slice(0,8).map(notificationCard).join('');
    $('#modalEyebrow').textContent='AVISOS AUTOMÁTICOS';$('#modalTitle').textContent='Centro de notificaciones';
    $('#modalBody').innerHTML=`<div class="notification-center-summary"><div class="info-item"><span>Notificaciones pendientes</span><b>${notifications.length}</b></div><div class="info-item"><span>Alertas pendientes</span><b>${alerts.length}</b></div></div><div class="notification-dashboard"><article class="card"><div class="card-header"><div><h3>Notificaciones</h3><p>Mensajes dirigidos a su usuario.</p></div></div><div class="notification-list">${notificationRows||empty('✓','Sin notificaciones','No hay mensajes pendientes.')}</div><button class="btn soft full" type="button" data-center-nav="notifications">Abrir notificaciones</button></article><article class="card"><div class="card-header"><div><h3>Alertas</h3><p>Eventos generados automáticamente por el sistema.</p></div></div><div class="notification-list">${alertRows||empty('✓','Sin alertas','No hay alertas pendientes.')}</div><button class="btn soft full" type="button" data-center-nav="alerts">Abrir alertas</button></article></div>`;
    openModal();$$('[data-center-nav]',$('#modalBody')).forEach(button=>button.addEventListener('click',()=>{closeModal();navigateSection(button.dataset.centerNav);}));$$('[data-read-notification]',$('#modalBody')).forEach(button=>button.addEventListener('click',()=>readNotification(button.dataset.readNotification)));$$('[data-read-alert]',$('#modalBody')).forEach(button=>button.addEventListener('click',()=>readAlert(button.dataset.readAlert)));
  }
  function stopRealtimeServices(){
    [heartbeatTimer,notificationTimer,realtimeTimer].forEach(timer=>{if(timer)clearInterval(timer);});
    heartbeatTimer=null;notificationTimer=null;realtimeTimer=null;
  }
  function startRealtimeServices(){
    stopRealtimeServices();updateBattery();
    api.getClientIp?.().then(ip=>{if(!ip)return;clientPublicIp=ip;api.registerConnectionIp?.({DISPOSITIVO_ID:deviceId,SESION_CLIENTE_ID:clientSessionId}).catch(()=>{});sendHeartbeat();}).catch(()=>{});
    sendHeartbeat();
    heartbeatTimer=setInterval(()=>sendHeartbeat(),config.INTERVALO_CONEXION_MILISEGUNDOS||20000);
    if(!embeddedMode){
      refreshNotificationBadge();
      notificationTimer=setInterval(refreshNotificationBadge,config.INTERVALO_NOTIFICACIONES_MILISEGUNDOS||10000);
    }
    resumeTrackingIfAllowed();
  }

  async function checkSystem() {
    const savedAuth = api.getAuth();
    hideAuthCards();

    // En modo iframe, main.html es el único validador de la sesión.
    // El módulo reutiliza el usuario guardado y comienza sin una segunda espera de red.
    if (embeddedMode) {
      if (!savedAuth.token || !savedAuth.user) {
        postParent({tipo:'flotas:autenticacion-requerida'});
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
        const loginData=Object.fromEntries(form.entries());const ipPromise=api.getClientIp?.().catch(()=> '')||Promise.resolve('');const fastIp=clientPublicIp||sessionStorage.getItem('flotas_ip_publica_v1')||'';if(fastIp)loginData.IP_PUBLICA=fastIp;const result = await api.request('login', loginData); api.setAuth({ token:result.token, sessionId:result.sessionId||'', user:result.user, expiresAt:result.expiresAt });
        currentUser = result.user; showApp(); toast('Bienvenido',`Sesión iniciada como ${currentUser.ROL_NOMBRE}.`);
      } catch (error) { toast('Acceso denegado',translateError(error),'error'); }
    });
  }

  function showApp() {
    $('#authScreen').classList.add('hidden'); $('#appShell').classList.remove('hidden');
    $('#userName').textContent=currentUser.NOMBRE; $('#userRole').textContent=currentUser.ROL_NOMBRE || currentUser.ROL_ID; $('#userAvatar').textContent=initials(currentUser.NOMBRE);
    $('#backendName').textContent=api.backendLabel(); $('#backendDetail').textContent=api.isRemote()?'Carga manual de módulos · conexión bajo demanda':'Información guardada en este dispositivo';
    if(currentCompany)applyBranding(currentCompany);
    setConnection(true, api.isRemote()?'Listo para sincronizar':'Base de datos local activa'); buildNav();
    go(initialSection).finally(() => {
      startRealtimeServices();
      if(config.GPS_AUTOMATICO_OBLIGATORIO){
        localStorage.setItem(trackingPreferenceKey,'1');
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
    if (cargaManualModulos) return;
    if (embeddedMode || precargaIniciada || !currentUser) return;
    precargaIniciada = true;
    const queries = consultasPrecarga();
    const ejecutar = () => api.prefetch(queries).then(result => {
      queries.forEach(query => {
        const rows = result?.[query.key]?.rows;
        if (Array.isArray(rows)) guardarListaFormulario(query.payload.resource,rows);
      });
      if (currentUser) setSave('Módulos preparados');
    });
    if ('requestIdleCallback' in window) window.requestIdleCallback(ejecutar, { timeout:1500 });
    else setTimeout(ejecutar, 350);
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
    if (!saved?.time) return 'Módulo vacío · pulse Sincronizar para consultar la base central';
    const date = new Date(saved.time);
    if (Number.isNaN(date.getTime())) return 'Módulo listo para sincronizar';
    return `Última sincronización: ${new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'short'}).format(date)} · datos vigentes en esta sesión`;
  }

  function decorarModuloConSincronizacion(html, section) {
    const hasSync = /data-sync|data-refresh-locations/.test(html);
    const button = hasSync ? '' : '<button class="btn soft small" type="button" data-sync>↻ Sincronizar</button>';
    return `<div class="module-cache-status" data-module-cache-status><div><i></i><span>${esc(textoActualizacionSeccion(section))}</span></div>${button}</div>${html}`;
  }

  function actualizarEstadoSincronizacionVisible(text, mode='') {
    const node=$('[data-module-cache-status]');
    if(!node)return;
    node.classList.toggle('syncing',mode==='syncing');
    node.classList.toggle('error',mode==='error');
    const span=$('span',node);if(span)span.textContent=text;
  }

  function moduloVacioSinSincronizar(section) {
    const title=labels[section]||'Módulo';
    return decorarModuloConSincronizacion(
      heading('CARGA MANUAL',title,'Este módulo inicia sin datos para que el sistema abra de inmediato.',`<button class="btn primary" type="button" data-sync>↻ Sincronizar ahora</button>`)+
      `<article class="card manual-load-empty">${empty('↻','Módulo listo para sincronizar','No se ha consultado Google Sheets. Pulse Sincronizar para cargar únicamente la información de este módulo.','<button class="btn primary" type="button" data-sync>Sincronizar datos</button>')}</article>`,section);
  }

  function esqueletoModulo() {
    return '<div class="module-skeleton" aria-label="Preparando módulo"><i></i><div><span></span><span></span><span></span></div><section><b></b><b></b><b></b><b></b></section></div>';
  }

  async function go(section, options = {}) {
    if(section==='connections'&&!hasPermission('CONEXIONES','LEER')){toast('Acceso restringido','El Administrador no ha habilitado este módulo para su cuenta.','error');return false;}
    if (!renderers[section]) section = 'dashboard';
    const sequence = ++secuenciaNavegacion;
    cleanupSection(); currentSection=section; buildNav();
    if (options.force) {
      invalidarCacheSeccion(section);
      precargaIniciada = false;
    }
    if (heartbeatTimer) sendHeartbeat();
    $('#pageTitle').textContent=labels[section]; $('#breadcrumb').textContent=`Sistema / ${labels[section]}`;
    closeSidebar();

    const cargaAutomaticaPermitida = section === 'gps' || section === 'connections' || section === 'office';
    if (cargaManualModulos && !cargaAutomaticaPermitida && !options.force && !modulosSincronizadosSesion.has(section)) {
      $('#content').innerHTML=moduloVacioSinSincronizar(section);
      bindSection();
      if(embeddedMode)postParent({tipo:'flotas:modulo-listo',usuario:currentUser,seccion:section,actualizadoEn:0,cargaManual:true});
      window.scrollTo({top:0,behavior:'auto'});
      return true;
    }

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

  function actualizarSeccionEnSegundoPlano(section) {
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

  const renderers = {
    async dashboard() {
      const batch=await api.requestBatch([
        { key:'dashboard', action:'dashboard' },
        { key:'realtime', action:'realtimeSummary' },
      ]);
      const data=batch.dashboard||{},realtime=batch.realtime||{},m=data.metrics || {};
      const operations=(data.recentOperations||[]).map(op=>`<tr><td><strong>${esc(op.ID)}</strong></td><td>${esc(op.VEHICULO_ID)}</td><td>${esc(op.CONDUCTOR_ID)}</td><td>${fmtDate(op.FECHA_INICIO,true)}</td><td>${status(op.ESTADO)}</td><td>${esc(op.ORIGEN||'')} → ${esc(op.DESTINO||'')}</td></tr>`).join('');
      const notifications=(data.notifications||[]).map(notificationCard).join('');
      const routes=(data.routes||[]).filter(r=>['Asignada','En curso'].includes(r.ESTADO));
      const headingActions=`<button class="btn soft" data-sync>↻ Sincronizar</button>${hasPermission('RUTAS','CREAR')?'<button class="btn primary" data-new-route>＋ Asignar ruta</button>':''}`;
      const driverHero=currentUser.ROL_ID==='ROL-CONDUCTOR'&&routes.length?`<div class="driver-home"><article class="card driver-route-hero"><div class="card-header"><div><h3>Próxima ruta asignada</h3><p>Lista para iniciar navegación</p></div>${status(routes[0].ESTADO)}</div>${routeCard(routes[0],true)}</article><article class="card"><div class="card-header"><div><h3>Mi conexión</h3><p>Estado del dispositivo</p></div></div><div class="tracking-notice ${gpsWatchId===null?'inactive':'active'}" data-tracking-notice><i data-tracking-icon>${gpsWatchId===null?'○':'●'}</i><div><b data-tracking-title>${gpsWatchId===null?'Ubicación continua detenida':'Ubicación continua activada'}</b><span data-tracking-detail>${trackingDetail()}</span></div></div><button class="btn ${gpsWatchId===null?'primary':'danger'} full" data-toggle-tracking>${gpsWatchId===null?'Activar ubicación continua':'Detener ubicación continua'}</button></article></div>`:'';
      return heading('RESUMEN OPERACIONAL',`Hola, ${esc(currentUser.NOMBRE.split(' ')[0])}`,'Información actualizada de flota, rutas, dispositivos y avisos según sus permisos.',headingActions)+
        driverHero+
        `<div class="kpi-grid">${metric('▣','Vehículos',m.vehicles||0,`${m.availableVehicles||0} disponibles`)}${metric('♙','Conductores',m.drivers||0,`${m.availableDrivers||0} disponibles`)}${metric('⇄','Operaciones activas',m.activeOperations||0,'Seguimiento en curso')}${metric('!','Alertas',m.unreadAlerts||0,`${m.expiredDocuments||0} documentos vencidos`)}${hasPermission('COMBUSTIBLE','LEER')?metric('⛽','Combustible del mes',`${decimal(m.fuelLitersMonth||0,1)} L`,clp(m.fuelCostMonth||0)):''}</div>`+
        `<div class="live-strip">${liveStat('⌖','Sesiones abiertas',realtime.totals?.onlineDevices??m.onlineDevices??0,'online')}${liveStat('🚐','Conduciendo',realtime.totals?.drivingSessions||0,'online')}${liveStat('✓','Check-ins aprobados',m.approvedCheckins||0,'online')}${liveStat('!','Check-ins por atender',(m.pendingCheckins||0)+(m.blockedCheckins||0),((m.pendingCheckins||0)+(m.blockedCheckins||0))?'warning':'')}</div>`+
        `<div class="dashboard-insights"><article class="card"><div class="card-header"><div><h3>Operaciones de los últimos 7 días</h3><p>Actividad diaria visible para su rol</p></div></div>${weeklyBars(data.charts?.operationsByDay||[])}</article><article class="card"><div class="card-header"><div><h3>Estado de la flota</h3><p>Distribución actual de vehículos</p></div></div>${stateDonut(data.charts?.vehicleStates||[])}</article><article class="card"><div class="card-header"><div><h3>Acciones rápidas</h3><p>Accesos según sus permisos</p></div></div>${quickActions()}</article></div>`+
        `${hasPermission('CONEXIONES','LEER')?`<article class="card session-control-card"><div class="card-header"><div><h3>Control de sesiones abiertas</h3><p>Usuario, conductor, módulo abierto, vehículo, operación, ruta y GPS por cada sesión.</p></div><button class="link-button" data-nav="gps">Abrir monitoreo</button></div><div class="device-list dashboard-session-list">${(realtime.devices||[]).slice(0,12).map(deviceCard).join('')||empty('○','Sin sesiones registradas','Las sesiones aparecerán cuando los usuarios ingresen al sistema.')}</div></article>`:''}`+
        `<div class="dashboard-grid"><article class="card"><div class="card-header"><div><h3>Operaciones recientes</h3><p>Movimientos creados en el sistema</p></div></div>${operations?table(['Operación','Vehículo','Conductor','Inicio','Estado','Ruta'],operations):empty('⇄','Aún no hay operaciones','No existen recorridos visibles para esta cuenta.',hasPermission('OPERACIONES','CREAR')?'<button class="btn primary" data-nav="operations">Crear operación</button>':'')}</article>`+
        `<article class="card"><div class="card-header"><div><h3>Notificaciones pendientes</h3><p>Mensajes dirigidos al usuario</p></div><button class="link-button" data-nav="notifications">Ver todas</button></div><div class="notification-list">${notifications||empty('✓','Sin notificaciones','No existen mensajes pendientes.')}</div></article></div>`;
    },
    async office(){return renderOficinaVirtual();},
    async vehicles(){return renderResourcePage('vehicles','FLOTA','Vehículos','Administre las unidades, patentes, kilometraje y códigos QR.',vehicleRows,['Vehículo','Patente','Año','Kilometraje','Estado','QR','']);},
    async drivers(){return renderResourcePage('drivers','PERSONAL','Conductores','Gestione licencias, disponibilidad y usuarios asociados.',driverRows,['Conductor','RUT','Licencia','Vencimiento','Estado','Usuario','']);},
    async maintenance(){return renderResourcePage('maintenance','PREVENCIÓN','Mantenciones','Programe trabajos preventivos y correctivos.',maintenanceRows,['Trabajo','Vehículo','Tipo','Fecha','Costo','Estado','']);},
    async fuel(){return renderFuel();},
    async documents(){return renderResourcePage('documents','VENCIMIENTOS','Documentos','Controle permisos, seguros, revisiones y licencias.',documentRows,['Documento','Asociado','Identificación','Vencimiento','Estado','Archivo','']);},
    async alerts(){return renderAlerts();},
    async users(){return renderResourcePage('users','SEGURIDAD','Usuarios','Administre accesos, roles, permisos personalizados y estado de las cuentas sin cerrar sus sesiones.',userRows,['Usuario','Correo','Rol','Permisos','Último acceso','Estado','']);},
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

  function metric(icon,label,value,detail){return `<article class="metric-card"><i class="metric-icon">${icon}</i><div><span>${label}</span><b>${value}</b><small>${detail}</small></div></article>`;}
  function liveStat(icon,label,value,mode=''){return `<article class="live-stat ${mode}"><i>${icon}</i><div><span>${label}</span><b>${number(value)}</b></div></article>`;}
  function navigationUrl(route){
    const latitude=Number(route.DESTINO_LATITUD),longitude=Number(route.DESTINO_LONGITUD);
    const destination=Number.isFinite(latitude)&&Number.isFinite(longitude)&&route.DESTINO_LATITUD!==''?`${latitude},${longitude}`:route.DESTINO;
    if(route.PROVEEDOR_NAVEGACION==='Waze')return `https://www.waze.com/ul?q=${encodeURIComponent(destination||'')}&navigate=yes`;
    const params=new URLSearchParams({api:'1',destination:destination||'',travelmode:'driving'});
    if(route.ORIGEN&&route.ORIGEN!=='Ubicación actual')params.set('origin',route.ORIGEN);
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }
  const cacheImagenesEvidenciaRuta=new Map();
  function extraerIdDriveCliente(value){const text=String(value||'').trim();if(/^[a-zA-Z0-9_-]{10,}$/.test(text))return text;const match=text.match(/(?:\/d\/|[?&]id=)([a-zA-Z0-9_-]{10,})/);return match?match[1]:'';}
  function normalizarEvidenciaRuta(item){const value=typeof item==='string'?{url:item}:(item||{});return {...value,url:String(value.url||''),archivoId:extraerIdDriveCliente(value.archivoId||value.id||value.url||'')};}
  function evidenciasRuta(route){let list=[];try{const parsed=JSON.parse(String(route?.EVIDENCIAS_FOTOS_CODIFICADAS||'[]'));if(Array.isArray(parsed))list=parsed;}catch(_){}if(!list.length&&route?.ULTIMA_EVIDENCIA_URL)list=[{url:route.ULTIMA_EVIDENCIA_URL,fecha:route.ULTIMA_EVIDENCIA_FECHA}];return list.map(normalizarEvidenciaRuta).filter(item=>item.url||item.archivoId);}
  function botonImagenRuta(route,item,label='Ver imagen'){const evidence=normalizarEvidenciaRuta(item);return `<button type="button" class="link-button" data-route-image-route-id="${esc(route?.ID||'')}" data-route-image-file-id="${esc(evidence.archivoId||'')}" data-route-image-url="${esc(evidence.url||'')}">${esc(label)}</button>`;}
  function botonGaleriaRuta(route,label='Ver fotografías'){const total=evidenciasRuta(route).length;return `<button type="button" class="link-button" data-route-gallery-id="${esc(route?.ID||'')}">${esc(label||`Ver ${total} foto(s)`)}</button>`;}
  async function cargarImagenEvidenciaRuta(routeId,evidence){const item=normalizarEvidenciaRuta(evidence),fileId=item.archivoId||extraerIdDriveCliente(item.url);if(!routeId||!fileId)throw new Error('EVIDENCIA_RUTA_NO_DISPONIBLE');const key=`${routeId}:${fileId}`;if(cacheImagenesEvidenciaRuta.has(key))return cacheImagenesEvidenciaRuta.get(key);const pending=api.request('routeEvidenceImage',{data:{RUTA_ID:routeId,ARCHIVO_ID:fileId},cache:false}).then(result=>{if(!result?.dataUrl)throw new Error('EVIDENCIA_RUTA_NO_DISPONIBLE');return result;}).catch(error=>{cacheImagenesEvidenciaRuta.delete(key);throw error;});cacheImagenesEvidenciaRuta.set(key,pending);return pending;}
  function obtenerVisorImagenRuta(){let viewer=$('#routeImageViewer');if(viewer)return viewer;viewer=document.createElement('div');viewer.id='routeImageViewer';viewer.className='route-image-viewer';viewer.hidden=true;viewer.innerHTML='<div class="route-image-viewer-backdrop" data-close-route-image></div><section><header><b data-route-image-title>Fotografía de respaldo</b><button type="button" aria-label="Cerrar" data-close-route-image>×</button></header><div class="route-image-viewer-content"><div class="route-image-loading" data-route-image-loading><i></i><span>Cargando fotografía…</span></div><img data-route-image-full alt="Respaldo fotográfico de la ruta"></div></section>';document.body.appendChild(viewer);$$('[data-close-route-image]',viewer).forEach(btn=>btn.addEventListener('click',()=>{viewer.hidden=true;document.body.classList.remove('visor-imagen-ruta-abierto');const img=$('[data-route-image-full]',viewer);if(img)img.removeAttribute('src');}));return viewer;}
  async function abrirImagenRutaSegura(routeId,evidence,titulo='Respaldo fotográfico de la ruta'){const item=normalizarEvidenciaRuta(evidence);if(!item.url&&!item.archivoId)return toast('Imagen no disponible','El respaldo no tiene un archivo válido.','error');try{if(window.AndroidConfig&&typeof window.AndroidConfig.abrirImagenRuta==='function'&&item.url){window.AndroidConfig.abrirImagenRuta(item.url,titulo);return;}}catch(_){}const viewer=obtenerVisorImagenRuta(),img=$('[data-route-image-full]',viewer),loading=$('[data-route-image-loading]',viewer),title=$('[data-route-image-title]',viewer);title.textContent=titulo;viewer.hidden=false;document.body.classList.add('visor-imagen-ruta-abierto');img.removeAttribute('src');img.style.display='none';loading.style.display='grid';try{const result=await cargarImagenEvidenciaRuta(routeId,item);img.src=result.dataUrl;img.style.display='block';loading.style.display='none';}catch(error){viewer.hidden=true;document.body.classList.remove('visor-imagen-ruta-abierto');toast('No se pudo mostrar la fotografía',translateError(error),'error');}}
  function enlazarVisoresRuta(root=document){$$('[data-route-image-file-id],[data-route-image-url]',root).forEach(btn=>{if(btn.dataset.routeImageBound==='1')return;btn.dataset.routeImageBound='1';btn.addEventListener('click',()=>abrirImagenRutaSegura(btn.dataset.routeImageRouteId,{archivoId:btn.dataset.routeImageFileId,url:btn.dataset.routeImageUrl},btn.dataset.routeImageTitle||'Respaldo fotográfico de la ruta'));});}
  function cargarMiniaturasGaleriaRuta(root,routeId){$$('[data-route-thumb-file-id]',root).forEach(img=>{const fileId=img.dataset.routeThumbFileId,url=img.dataset.routeThumbUrl||'',fallback=img.nextElementSibling;cargarImagenEvidenciaRuta(routeId,{archivoId:fileId,url}).then(result=>{img.src=result.dataUrl;img.style.display='block';if(fallback)fallback.style.display='none';}).catch(()=>{img.style.display='none';if(fallback)fallback.style.display='grid';});});}
  function abrirGaleriaRuta(routeId){const route=registroFormulario('routes',routeId)||(cacheListasFormulario.get('routes')||[]).find(row=>String(row.ID)===String(routeId));if(!route)return toast('Ruta no disponible','Sincronice e intente nuevamente.','error');const items=evidenciasRuta(route);if(!items.length)return toast('Sin fotografías','Esta ruta todavía no tiene respaldos fotográficos.','error');$('#modalEyebrow').textContent='GALERÍA DE RESPALDOS';$('#modalTitle').textContent=`${items.length} fotografía(s) · ${route.NOMBRE||route.ID}`;$('#modalBody').innerHTML=`<div class="route-evidence-gallery">${items.slice().reverse().map((item,index)=>{const numero=items.length-index,titulo=`Foto ${numero} de ${items.length}`;return `<article class="route-evidence-gallery-item"><button type="button" class="route-evidence-thumb" data-route-image-route-id="${esc(route.ID)}" data-route-image-file-id="${esc(item.archivoId||'')}" data-route-image-url="${esc(item.url||'')}" data-route-image-title="${esc(titulo)}"><img data-route-thumb-file-id="${esc(item.archivoId||'')}" data-route-thumb-url="${esc(item.url||'')}" alt="${esc(titulo)}" loading="lazy"><span class="route-evidence-thumb-fallback">📷</span></button><div><b>${esc(titulo)}</b><small>${fmtDate(item.fecha||route.ULTIMA_EVIDENCIA_FECHA,true)}</small>${item.usuarioNombre?`<small>Cargada por ${esc(item.usuarioNombre)}</small>`:''}${item.observacion?`<p>${esc(item.observacion)}</p>`:''}${botonImagenRuta(route,item,'Abrir fotografía')}</div></article>`;}).join('')}</div><div class="form-actions"><button class="btn primary" type="button" data-cancel-modal>Cerrar galería</button></div>`;openModal();const body=$('#modalBody');enlazarVisoresRuta(body);cargarMiniaturasGaleriaRuta(body,route.ID);$('[data-cancel-modal]',body).onclick=closeModal;}
  function enlazarGaleriasRuta(root=document){$$('[data-route-gallery-id]',root).forEach(btn=>{if(btn.dataset.routeGalleryBound==='1')return;btn.dataset.routeGalleryBound='1';btn.addEventListener('click',()=>abrirGaleriaRuta(btn.dataset.routeGalleryId));});}
  function evidenciaRutaResumen(route){const items=evidenciasRuta(route),ultima=items[items.length-1];return items.length?`<div class="route-evidence-summary"><i>▧</i><span><b>${items.length} fotografía(s) de respaldo</b><small>Última: ${fmtDate(ultima?.fecha||route.ULTIMA_EVIDENCIA_FECHA,true)}</small></span>${botonGaleriaRuta(route,`Ver ${items.length} foto(s)`)}</div>`:'';}
  function routeCard(route,hero=false){
    const canUpdate=hasPermission('RUTAS','ACTUALIZAR'),driver=currentUser?.ROL_ID==='ROL-CONDUCTOR';
    const actions=[`<a class="btn primary small" href="${esc(navigationUrl(route))}" target="_blank" rel="noopener">Navegar con ${esc(route.PROVEEDOR_NAVEGACION||'Google Maps')}</a>`];
    if(canUpdate&&route.ESTADO==='Asignada')actions.push(`<button class="btn soft small" data-route-state="${route.ID}:En curso">Iniciar ruta</button>`);
    if(canUpdate&&route.ESTADO==='En curso')actions.push(`<button class="btn soft small" data-route-state="${route.ID}:Completada">Completar</button>`);
    if(canUpdate)actions.push(`<button class="btn soft small" data-route-evidence="${route.ID}">📷 Cargar respaldo</button>`);
    if(canUpdate&&!driver&&!['Completada','Cancelada'].includes(route.ESTADO))actions.push(`<button class="btn danger small" data-route-state="${route.ID}:Cancelada">Cancelar</button>`);
    return `<div class="${hero?'':'route-card'}"><header><div><h4>${esc(route.NOMBRE||route.ID)}</h4><p>${esc(route.CONDUCTOR_NOMBRE||route.CONDUCTOR_ID||'Sin conductor')} · ${esc(route.VEHICULO_PATENTE||route.VEHICULO_ID||'Vehículo por definir')}</p></div>${status(route.ESTADO)}</header><div class="route-path"><i></i><span>${esc(route.ORIGEN||'Ubicación actual')}</span><i class="end"></i><span>${esc(route.DESTINO||'Sin destino')}</span></div>${route.INSTRUCCIONES?`<p>${esc(route.INSTRUCCIONES)}</p>`:''}<div class="route-meta"><span>Check-in: ${esc(route.CHECKIN_ID||'se validará al iniciar')}</span><span>GPS ruta: ${route.GPS_SEGUIMIENTO_ACTIVO==='SI'?'Activo':'Detenido'}</span>${route.OPERACION_ID?`<span>Operación: ${esc(route.OPERACION_ID)}</span>`:''}</div>${evidenciaRutaResumen(route)}<div class="route-actions">${actions.join('')}</div><div class="route-meta"><span>Asignada: ${fmtDate(route.FECHA_ASIGNACION,true)}</span><span>Proveedor: ${esc(route.PROVEEDOR_NAVEGACION||'Google Maps')}</span></div></div>`;
  }
  function notificationCard(item){
    const priority=String(item.PRIORIDAD||'Normal').toLowerCase();
    return `<article class="notification-card"><header><div><h4>${esc(item.TITULO)}</h4><p>${esc(item.MENSAJE)}</p></div><span class="priority ${esc(priority)}">${esc(item.PRIORIDAD||'Normal')}</span></header><div class="route-meta"><span>${fmtDate(item.FECHA_ENVIO||item.CREADO_EN,true)}</span><span>${esc(item.TIPO||'Información')}</span></div>${item.LEIDA!=='SI'?`<button class="link-button" data-read-notification="${item.ID}" type="button">Marcar como leída</button>`:''}</article>`;
  }
  function deviceCard(item){
    const activity=item.EN_LINEA?(item.ACTIVIDAD||'Conectado'):'Inactivo',sectionName=labels[item.SECCION_ACTUAL]||item.SECCION_ACTUAL||'Sin identificar';
    const sessionReference=String(item.SESION_CLIENTE_ID||item.SESION_ID||item.DISPOSITIVO_ID||'').slice(-10);
    return `<article class="device-card ${item.EN_LINEA?'online':'offline'} ${activity==='Conduciendo'?'driving':''}"><i class="device-dot"></i><div><div class="device-title"><b>${esc(item.USUARIO_NOMBRE||'Usuario')}</b>${status(activity)}</div><span><strong>Conductor:</strong> ${esc(item.CONDUCTOR_NOMBRE||'No asociado')}</span><div class="session-facts"><span><b>Sección</b>${esc(sectionName)}</span><span><b>Vehículo</b>${esc(item.VEHICULO_PATENTE||item.VEHICULO_ID||'Sin asignar')}</span><span><b>Operación</b>${esc(item.OPERACION_ID||'Sin operación')}</span><span><b>Ruta</b>${esc(item.RUTA_ID||'Sin ruta')}</span><span><b>GPS</b>${item.GPS_ACTIVO==='SI'?'Activo':'Inactivo'}</span><span><b>Visibilidad</b>${item.PAGINA_VISIBLE==='NO'?'Segundo plano':'Visible'}</span></div><small>Sesión ${esc(sessionReference||'sin referencia')} · IP ${esc(item.IP_PUBLICA||'no disponible')} · ${esc(item.PLATAFORMA||'Dispositivo')} · Última señal: ${fmtDate(item.ULTIMA_CONEXION,true)}${item.BATERIA_PORCENTAJE!==''?` · Batería ${number(item.BATERIA_PORCENTAJE)}%`:''}</small></div></article>`;
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
    if(hasPermission('OPERACIONES','CREAR'))actions.push(['operations','⇄','Iniciar operación']);
    if(hasPermission('NOTIFICACIONES','CREAR'))actions.push(['notifications','🔔','Enviar aviso']);
    if(hasPermission('VEHICULOS','CREAR'))actions.push(['vehicles','▣','Registrar vehículo']);
    if(hasPermission('COMBUSTIBLE','CREAR'))actions.push(['fuel','⛽','Registrar combustible']);
    return `<div class="quick-actions">${actions.map(([section,icon,label])=>`<button data-nav="${section}"><i>${icon}</i><span>${label}</span></button>`).join('')||'<p class="muted">No hay acciones rápidas habilitadas para este rol.</p>'}</div>`;
  }
  function searchAddresses(query){
    const normalized=String(query||'').trim().toLowerCase(),cached=addressSearchCache.get(normalized);
    if(cached)return Promise.resolve(cached);
    const task=addressSearchQueue.catch(()=>{}).then(async()=>{
      const wait=Math.max(0,1000-(Date.now()-lastAddressSearchAt));if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
      lastAddressSearchAt=Date.now();
      const url=new URL(config.DIRECCION_BUSQUEDA_DIRECCIONES);url.searchParams.set('format','jsonv2');url.searchParams.set('q',query);url.searchParams.set('limit','6');url.searchParams.set('addressdetails','1');url.searchParams.set('accept-language','es');
      if(config.PAIS_BUSQUEDA_DIRECCIONES)url.searchParams.set('countrycodes',config.PAIS_BUSQUEDA_DIRECCIONES);
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
      try{const response=await fetch(url,{headers:{Accept:'application/json'},signal:controller.signal});if(!response.ok)throw new Error('BUSQUEDA_DIRECCION_NO_DISPONIBLE');const result=await response.json();addressSearchCache.set(normalized,result);if(addressSearchCache.size>80)addressSearchCache.delete(addressSearchCache.keys().next().value);return result;}
      finally{clearTimeout(timer);}
    });
    addressSearchQueue=task;return task;
  }
  function bindAddressAutocomplete(root=document){
    $$('[data-address-autocomplete]',root).forEach(input=>{
      if(input.dataset.addressBound==='1')return;input.dataset.addressBound='1';input.setAttribute('autocomplete','off');input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');
      const suggestions=document.createElement('div');suggestions.className='address-suggestions';suggestions.setAttribute('role','listbox');suggestions.hidden=true;input.insertAdjacentElement('afterend',suggestions);
      let timer=null,sequence=0,activeIndex=-1,items=[];
      const close=()=>{suggestions.hidden=true;suggestions.innerHTML='';items=[];activeIndex=-1;input.setAttribute('aria-expanded','false');};
      const select=item=>{input.value=item.display_name||'';const form=input.closest('form')||root;const latName=input.dataset.latTarget,lngName=input.dataset.lngTarget;if(latName&&form.querySelector(`[name="${latName}"]`))form.querySelector(`[name="${latName}"]`).value=item.lat||'';if(lngName&&form.querySelector(`[name="${lngName}"]`))form.querySelector(`[name="${lngName}"]`).value=item.lon||'';input.dispatchEvent(new Event('direccion:seleccionada',{bubbles:true}));close();};
      const render=result=>{items=result||[];if(!items.length){suggestions.innerHTML='<p>No se encontraron coincidencias. Puede conservar la dirección escrita.</p>';suggestions.hidden=false;return;}suggestions.innerHTML=items.map((item,index)=>`<button type="button" role="option" data-address-index="${index}"><i>⌖</i><span><b>${esc(item.display_name||'Dirección')}</b><small>${esc(item.type||item.category||'Lugar')}</small></span></button>`).join('');suggestions.hidden=false;input.setAttribute('aria-expanded','true');$$('[data-address-index]',suggestions).forEach(button=>button.addEventListener('mousedown',event=>{event.preventDefault();select(items[Number(button.dataset.addressIndex)]);}));};
      input.addEventListener('input',()=>{
        const form=input.closest('form')||root;[input.dataset.latTarget,input.dataset.lngTarget].filter(Boolean).forEach(name=>{const field=form.querySelector(`[name="${name}"]`);if(field)field.value='';});
        clearTimeout(timer);const query=input.value.trim();sequence+=1;const ownSequence=sequence;if(query.length<(config.MINIMO_CARACTERES_DIRECCION||3))return close();
        timer=setTimeout(async()=>{suggestions.innerHTML='<p>Buscando direcciones…</p>';suggestions.hidden=false;try{const result=await searchAddresses(query);if(ownSequence===sequence)render(result);}catch(_){if(ownSequence===sequence){suggestions.innerHTML='<p>No fue posible consultar direcciones. Puede continuar escribiéndola manualmente.</p>';suggestions.hidden=false;}}},config.ESPERA_BUSQUEDA_DIRECCION_MILISEGUNDOS||450);
      });
      input.addEventListener('keydown',event=>{const buttons=$$('button',suggestions);if(!buttons.length)return;if(event.key==='ArrowDown'){event.preventDefault();activeIndex=(activeIndex+1)%buttons.length;}else if(event.key==='ArrowUp'){event.preventDefault();activeIndex=(activeIndex-1+buttons.length)%buttons.length;}else if(event.key==='Enter'&&activeIndex>=0){event.preventDefault();select(items[activeIndex]);return;}else if(event.key==='Escape')return close();else return;buttons.forEach((button,index)=>button.classList.toggle('active',index===activeIndex));buttons[activeIndex]?.scrollIntoView({block:'nearest'});});
      input.addEventListener('blur',()=>setTimeout(close,180));
    });
  }

  function normalizeImportHeader(value){return String(value||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');}
  function excelSerialToIso(value){const serial=Number(value);if(!Number.isFinite(serial))return value;const millis=Math.round((serial-25569)*86400000);const date=new Date(millis);return Number.isNaN(date.getTime())?value:date.toISOString().slice(0,10);}
  function parseCsvText(text){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const ch=text[i],next=text[i+1];if(ch==='"'){if(quoted&&next==='"'){cell+='"';i++;}else quoted=!quoted;}else if((ch===','||ch===';'||ch==='\t')&&!quoted){row.push(cell);cell='';}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(cell);if(row.some(value=>String(value).trim()!==''))rows.push(row);row=[];cell='';}else cell+=ch;}row.push(cell);if(row.some(value=>String(value).trim()!==''))rows.push(row);return rows;}
  function xmlText(node){return node?.textContent??'';}
  async function parseXlsxFile(file){
    if(typeof JSZip==='undefined')throw new Error('LECTOR_XLSX_NO_DISPONIBLE');
    const zip=await JSZip.loadAsync(await file.arrayBuffer());
    const shared=[];const sharedFile=zip.file('xl/sharedStrings.xml');
    if(sharedFile){const xml=new DOMParser().parseFromString(await sharedFile.async('string'),'application/xml');[...xml.getElementsByTagName('si')].forEach(item=>shared.push([...item.getElementsByTagName('t')].map(xmlText).join('')));}
    const dateStyles=new Set();const stylesFile=zip.file('xl/styles.xml');
    if(stylesFile){const xml=new DOMParser().parseFromString(await stylesFile.async('string'),'application/xml'),custom={};[...xml.getElementsByTagName('numFmt')].forEach(node=>custom[node.getAttribute('numFmtId')]=node.getAttribute('formatCode')||'');const cellXfs=xml.getElementsByTagName('cellXfs')[0];if(cellXfs)[...cellXfs.getElementsByTagName('xf')].forEach((node,index)=>{const id=Number(node.getAttribute('numFmtId')||0),fmt=custom[id]||'';if([14,15,16,17,18,19,20,21,22,45,46,47].includes(id)||/[dmy]/i.test(fmt.replace(/\[[^\]]*\]|"[^"]*"/g,'')))dateStyles.add(index);});}
    const workbookFile=zip.file('xl/workbook.xml'),relsFile=zip.file('xl/_rels/workbook.xml.rels');let sheetPath='xl/worksheets/sheet1.xml';
    if(workbookFile&&relsFile){const workbookXml=new DOMParser().parseFromString(await workbookFile.async('string'),'application/xml'),firstSheet=workbookXml.getElementsByTagName('sheet')[0],relId=firstSheet?.getAttribute('r:id')||firstSheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id'),relsXml=new DOMParser().parseFromString(await relsFile.async('string'),'application/xml'),rel=[...relsXml.getElementsByTagName('Relationship')].find(node=>node.getAttribute('Id')===relId),target=rel?.getAttribute('Target');if(target)sheetPath='xl/'+target.replace(/^\//,'').replace(/^xl\//,'');}
    const sheetFile=zip.file(sheetPath)||zip.file('xl/worksheets/sheet1.xml');if(!sheetFile)throw new Error('PLANILLA_SIN_HOJA_DATOS');
    const xml=new DOMParser().parseFromString(await sheetFile.async('string'),'application/xml'),matrix=[];
    [...xml.getElementsByTagName('row')].forEach(rowNode=>{const rowIndex=Math.max(0,Number(rowNode.getAttribute('r')||matrix.length+1)-1),row=matrix[rowIndex]||(matrix[rowIndex]=[]);[...rowNode.getElementsByTagName('c')].forEach(cellNode=>{const ref=cellNode.getAttribute('r')||'',letters=(ref.match(/[A-Z]+/i)||['A'])[0].toUpperCase();let col=0;for(const letter of letters)col=col*26+letter.charCodeAt(0)-64;col-=1;const type=cellNode.getAttribute('t')||'',style=Number(cellNode.getAttribute('s')||-1),valueNode=cellNode.getElementsByTagName('v')[0],inlineNode=cellNode.getElementsByTagName('is')[0];let value=type==='inlineStr'?[...inlineNode?.getElementsByTagName('t')||[]].map(xmlText).join(''):xmlText(valueNode);if(type==='s')value=shared[Number(value)]??'';else if(type==='b')value=value==='1'?'SI':'NO';else if(value!==''&&dateStyles.has(style))value=excelSerialToIso(value);row[col]=value;});});return matrix;
  }
  async function readImportFile(file){const extension=String(file.name||'').split('.').pop().toLowerCase();let matrix;if(extension==='csv'||extension==='txt')matrix=parseCsvText(await file.text());else if(extension==='xlsx')matrix=await parseXlsxFile(file);else throw new Error('FORMATO_IMPORTACION_INVALIDO');if(matrix.length<2)throw new Error('IMPORTACION_SIN_FILAS');const headers=(matrix.shift()||[]).map(normalizeImportHeader);return matrix.filter(row=>row.some(value=>String(value??'').trim()!=='')).map(row=>Object.fromEntries(headers.map((header,index)=>[header,row[index]??'']).filter(([header])=>header)));}
  function importPreviewTable(rows,definition){const headers=definition.headers.filter(header=>rows.some(row=>String(row[header]??'').trim()!==''));const visible=headers.slice(0,8);const body=rows.slice(0,8).map((row,index)=>`<tr><td>${index+2}</td>${visible.map(header=>`<td>${esc(row[header]??'')}</td>`).join('')}</tr>`).join('');return `<div class="import-preview"><div class="import-preview-summary"><b>${rows.length} filas listas</b><span>Vista previa de las primeras ${Math.min(8,rows.length)} filas</span></div>${table(['Fila',...visible],body)}</div>`;}
  function importResultMarkup(result){const errors=result.errores||[];return `<div class="import-result"><div class="kpi-grid compact">${metric('＋','Creados',result.creadas||0,'Nuevos registros')}${metric('↻','Actualizados',result.actualizadas||0,'Coincidencias encontradas')}${metric('—','Omitidos',result.omitidas||0,'Sin cambios')}${metric('!','Errores',errors.length,'Filas que requieren revisión')}</div>${errors.length?`<article class="import-errors"><h4>Filas con observaciones</h4>${errors.slice(0,40).map(item=>`<div><b>Fila ${number(item.fila)}</b><span>${esc(translateError({message:item.error}))}</span></div>`).join('')}${errors.length>40?`<p>Se muestran 40 de ${number(errors.length)} errores.</p>`:''}</article>`:'<div class="tracking-notice active"><i>✓</i><div><b>Importación completada sin errores</b><span>Los registros quedaron disponibles en el sistema.</span></div></div>'}<div class="form-actions"><button class="btn primary" type="button" data-cancel-modal>Cerrar</button></div></div>`;}
  function openBulkImportModal(resource){const definition=bulkImportDefinitions[resource];if(!definition)return;$('#modalEyebrow').textContent='CARGA RÁPIDA';$('#modalTitle').textContent=`Importar ${definition.title.toLowerCase()}`;$('#modalBody').innerHTML=`<form id="bulkImportForm" class="bulk-import-form"><div class="import-steps"><div><i>1</i><span><b>Descargue la plantilla</b><small>No cambie los nombres de las columnas.</small></span></div><div><i>2</i><span><b>Complete hasta 1.500 filas</b><small>Puede utilizar Excel o CSV.</small></span></div><div><i>3</i><span><b>Revise y confirme</b><small>La carga se envía en una sola operación.</small></span></div></div><div class="import-template-card"><div><b>Plantilla oficial de ${esc(definition.title)}</b><span>Incluye ejemplos, formatos y listas permitidas.</span></div><a class="btn soft" href="${esc(definition.template)}" download>⇩ Descargar plantilla</a></div><label class="file-drop"><input name="archivo" type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required><i>⇧</i><b>Seleccione o arrastre la planilla</b><span>Formatos permitidos: XLSX y CSV · máximo 1.500 filas</span></label><label class="import-update-option"><input name="actualizarExistentes" type="checkbox" value="SI" checked><span><b>Actualizar coincidencias existentes</b><small>Vehículos por patente, conductores por RUT y documentos por identificación/vencimiento.</small></span></label><div data-import-status class="import-status"><i>○</i><span>Seleccione un archivo para comenzar.</span></div><div data-import-preview></div><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn primary" type="submit" disabled>Importar registros</button></div></form>`;openModal();const form=$('#bulkImportForm'),fileInput=form.elements.archivo,submit=$('button[type="submit"]',form),statusNode=$('[data-import-status]',form),preview=$('[data-import-preview]',form);let rows=[];$('[data-cancel-modal]',form).onclick=closeModal;fileInput.addEventListener('change',async()=>{rows=[];submit.disabled=true;preview.innerHTML='';const file=fileInput.files?.[0];if(!file)return;statusNode.className='import-status loading';statusNode.innerHTML='<i></i><span>Leyendo y validando la planilla…</span>';try{rows=await readImportFile(file);const missing=definition.required.filter(field=>!rows.some(row=>String(row[field]??'').trim()!==''));if(missing.length)throw new Error(`COLUMNAS_REQUERIDAS_${missing.join('_')}`);statusNode.className='import-status ready';statusNode.innerHTML=`<i>✓</i><span>${number(rows.length)} filas preparadas para importar.</span>`;preview.innerHTML=importPreviewTable(rows,definition);submit.disabled=false;}catch(error){statusNode.className='import-status error';statusNode.innerHTML=`<i>!</i><span>${esc(translateError(error))}</span>`;}});form.addEventListener('submit',event=>{event.preventDefault();if(!rows.length)return;conCargaBoton(submit,'Importando…',async()=>{try{const result=await api.request('bulkImport',{resource,data:{filas:rows,actualizarExistentes:form.elements.actualizarExistentes.checked?'SI':'NO',IP_PUBLICA:clientPublicIp}});invalidarListasFormulario(resource);cacheVistasModulo.delete(resource);$('#modalEyebrow').textContent='RESULTADO DE IMPORTACIÓN';$('#modalTitle').textContent=`${definition.title} procesados`;$('#modalBody').innerHTML=importResultMarkup(result);$('[data-cancel-modal]',$('#modalBody')).onclick=()=>{closeModal();actualizarSeccionEnSegundoPlano(resource);};toast('Importación finalizada',`${number(result.creadas||0)} creados · ${number(result.actualizadas||0)} actualizados · ${number((result.errores||[]).length)} errores`,(result.errores||[]).length?'warning':'success');}catch(error){toast('No se pudo importar',translateError(error),'error');}});});}

  function leerArchivoDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error('ARCHIVO_BASE64_INVALIDO'));reader.readAsDataURL(file);});}
  async function optimizarImagenDrive(file){
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
  function markupCargaDrive({campo,url='',combustible=false}){
    const accept=combustible?'image/*':'image/*,application/pdf,.pdf',capture=combustible?' capture="environment"':'';
    const destinos=combustible
      ?`<a href="${esc(carpetasDrive.boletasCombustible)}" target="_blank" rel="noopener">Abrir carpeta de boletas</a>`
      :`<a href="${esc(carpetasDrive.documentosFotos)}" target="_blank" rel="noopener">Carpeta Fotos</a><a href="${esc(carpetasDrive.documentosPdf)}" target="_blank" rel="noopener">Carpeta PDF</a>`;
    const estado=url?`<div class="drive-upload-status ready" data-drive-upload-status><i>✓</i><span>Archivo enlazado · <a href="${esc(url)}" target="_blank" rel="noopener">abrir en Drive</a></span></div>`:`<div class="drive-upload-status" data-drive-upload-status><i>○</i><span>Sin archivo seleccionado.</span></div>`;
    return `<div class="drive-fast-upload" data-drive-upload="${combustible?'fuel':'documents'}"><label class="drive-file-picker"><input type="file" data-drive-file accept="${accept}"${capture}><i>⇧</i><span><b>${combustible?'Tomar foto o elegir boleta':'Elegir foto o PDF'}</b><small>La carga comienza inmediatamente y las fotos se optimizan automáticamente.</small></span></label>${estado}<div class="drive-folder-links">${destinos}</div><input name="${campo}" type="url" value="${esc(url)}" placeholder="El enlace de Drive aparecerá aquí" data-drive-url></div>`;
  }
  function contextoArchivoFormulario(form,tipo){
    if(tipo==='fuel')return [form.elements.NUMERO_DOCUMENTO?.value,form.elements.VEHICULO_ID?.value].filter(Boolean).join(' - ')||'Boleta combustible';
    return [form.elements.TIPO?.value,form.elements.IDENTIFICACION?.value].filter(Boolean).join(' - ')||'Documento';
  }
  function enlazarCargaDrive(form,tipo){
    const box=$('[data-drive-upload]',form),input=$('[data-drive-file]',box),statusNode=$('[data-drive-upload-status]',box),urlInput=$('[data-drive-url]',box);if(!input||!urlInput)return;
    input.addEventListener('change',()=>{
      const original=input.files?.[0];if(!original)return;const uploadSequence=Number(input.dataset.uploadSequence||0)+1;input.dataset.uploadSequence=String(uploadSequence);
      const isPdf=original.type==='application/pdf'||/\.pdf$/i.test(original.name||'');
      if(tipo==='fuel'&&isPdf){input.value='';statusNode.className='drive-upload-status error';statusNode.innerHTML='<i>!</i><span>Para la boleta seleccione o tome una foto.</span>';return;}
      if(original.size>12582912){input.value='';statusNode.className='drive-upload-status error';statusNode.innerHTML='<i>!</i><span>El archivo supera 12 MB.</span>';return;}
      const promise=(async()=>{
        statusNode.className='drive-upload-status loading';statusNode.innerHTML='<i></i><span>Optimizando y subiendo en segundo plano…</span>';
        const file=await optimizarImagenDrive(original),dataUrl=await leerArchivoDataUrl(file);
        const destino=tipo==='fuel'?'BOLETA_COMBUSTIBLE':(isPdf?'DOCUMENTO_PDF':'DOCUMENTO_FOTO');
        const result=await api.request('uploadDriveFile',{data:{DESTINO:destino,NOMBRE_ARCHIVO:file.name,TIPO_MIME:file.type||(isPdf?'application/pdf':'image/jpeg'),ARCHIVO_BASE64:dataUrl,CONTEXTO:contextoArchivoFormulario(form,tipo),IP_PUBLICA:clientPublicIp}});
        if(Number(input.dataset.uploadSequence)!==uploadSequence)return result;
        urlInput.value=result.url||'';urlInput.dispatchEvent(new Event('input',{bubbles:true}));
        statusNode.className='drive-upload-status ready';statusNode.innerHTML=`<i>✓</i><span>Archivo cargado · <a href="${esc(result.url||'')}" target="_blank" rel="noopener">abrir en Drive</a></span>`;
        return result;
      })().catch(error=>{if(Number(input.dataset.uploadSequence)===uploadSequence){statusNode.className='drive-upload-status error';statusNode.innerHTML=`<i>!</i><span>${esc(translateError(error))}</span>`;}throw error;});
      form._driveUploadPromise=promise;
    });
  }
  async function esperarCargaDrive(form){
    if(!form?._driveUploadPromise)return;
    await form._driveUploadPromise;
    form._driveUploadPromise=null;
  }

  async function renderResourcePage(resource,tag,title,description,rowRenderer,headers) {
    const result=await api.request('list',{resource}); const rows=result.rows||[];
    guardarListaFormulario(resource,rows);
    const puedeCrear=hasPermission(resourcePermission[resource],'CREAR');
    const createLabel=resource==='documents'&&currentUser.ROL_ID==='ROL-CONDUCTOR'?'＋ Cargar documento':'＋ Nuevo registro';
    const createButton=puedeCrear?`<button class="btn primary" data-add="${resource}">${createLabel}</button>`:'';
    const accesoBloqueado=resource==='documents'&&currentUser.ROL_ID==='ROL-CONDUCTOR'&&!puedeCrear?`<div class="tracking-notice blocked document-upload-blocked"><i>🔒</i><div><b>Carga de documentos bloqueada</b><span>El Administrador retiró temporalmente el permiso para cargar documentos. Puede seguir consultando sus documentos asociados.</span></div></div>`:'';
    const importDefinition=bulkImportDefinitions[resource];
    const importButtons=importDefinition&&hasPermission(resourcePermission[resource],'CREAR')&&currentUser.ROL_ID!=='ROL-CONDUCTOR'?`<a class="btn soft" href="${esc(importDefinition.template)}" download>⇩ Plantilla</a><button class="btn soft" data-bulk-import="${resource}">⇧ Importación masiva</button>`:'';
    const folderButtons=resource==='documents'&&currentUser.ROL_ID!=='ROL-CONDUCTOR'?`<a class="btn soft" href="${esc(carpetasDrive.documentosFotos)}" target="_blank" rel="noopener">▧ Fotos</a><a class="btn soft" href="${esc(carpetasDrive.documentosPdf)}" target="_blank" rel="noopener">▤ PDF</a>`:'';
    const rowHtml=rows.map(row=>rowRenderer(row)).join('');
    return heading(tag,title,description,`<button class="btn soft" data-sync>↻ Sincronizar</button>${folderButtons}${importButtons}${createButton}`)+accesoBloqueado+`<article class="card resource-card resource-${esc(resource)}"><div class="toolbar"><label class="search-box"><span>⌕</span><input data-table-search placeholder="Buscar en ${title.toLowerCase()}"></label><button class="btn soft push" data-export="${resource}">Exportar CSV</button></div><div data-filter-table class="resource-table resource-${esc(resource)}">${table(headers,rowHtml,`No hay ${title.toLowerCase()} registrados.`)}</div></article>`;
  }

  function vehicleRows(v){return `<tr data-filter-date="${esc(v.PROXIMA_MANTENCION||v.ACTUALIZADO_EN||v.CREADO_EN||'')}" data-search-row="${esc(`${v.PATENTE} ${v.MARCA} ${v.MODELO} ${v.ESTADO}`.toLowerCase())}"><td><div class="entity"><i class="entity-icon">🚐</i><div><strong>${esc(v.MARCA||'Sin marca')} ${esc(v.MODELO||'')}</strong><span class="muted">${esc(v.ID)}</span></div></div></td><td><strong>${esc(v.PATENTE)}</strong></td><td>${esc(v.ANIO||'—')}</td><td>${number(v.KILOMETRAJE)} km</td><td>${status(v.ESTADO)}</td><td><code class="vehicle-qr-code">${esc(codigoQrVehiculo(v))}</code></td><td>${accionesVehiculo(v)}</td></tr>`;}
  function driverRows(d){const whatsapp=d.TELEFONO?`<button class="btn whatsapp small" data-whatsapp-driver="${esc(d.ID)}" title="Enviar WhatsApp">◉ WhatsApp</button>`:'';return `<tr data-filter-date="${esc(d.LICENCIA_VENCIMIENTO||d.ACTUALIZADO_EN||d.CREADO_EN||'')}" data-search-row="${esc(`${d.NOMBRE} ${d.RUT} ${d.ESTADO} ${d.TELEFONO||''}`.toLowerCase())}"><td><div class="entity"><span class="avatar">${initials(d.NOMBRE)}</span><div><strong>${esc(d.NOMBRE)}</strong><span class="muted">${esc(d.TELEFONO||'Sin teléfono')}</span></div></div></td><td>${esc(d.RUT)}</td><td>${esc(d.LICENCIA_CLASE||'—')}</td><td>${fmtDate(d.LICENCIA_VENCIMIENTO)}</td><td>${status(d.ESTADO)}</td><td>${esc(d.USUARIO_ID||'Sin asociar')}</td><td><div class="row-button-stack">${whatsapp}${actions('drivers',d.ID)}</div></td></tr>`;}
  function maintenanceRows(m){return `<tr data-filter-date="${esc(m.FECHA_PROGRAMADA||m.FECHA_REALIZADA||m.CREADO_EN||'')}" data-search-row="${esc(`${m.TITULO} ${m.VEHICULO_ID} ${m.ESTADO}`.toLowerCase())}"><td><strong>${esc(m.TITULO)}</strong><span class="muted">${esc(m.DESCRIPCION||'')}</span></td><td>${esc(m.VEHICULO_ID)}</td><td>${esc(m.TIPO)}</td><td>${fmtDate(m.FECHA_PROGRAMADA)}</td><td>$${number(m.COSTO)}</td><td>${status(m.ESTADO)}</td><td>${actions('maintenance',m.ID)}</td></tr>`;}
  function documentRows(d){const asociado=d.CORREO_ASOCIADO||d.ASOCIADO_ID||'Sin asociación';return `<tr data-filter-date="${esc(d.FECHA_VENCIMIENTO||d.FECHA_EMISION||d.CREADO_EN||'')}" data-search-row="${esc(`${d.TIPO} ${d.IDENTIFICACION} ${d.ESTADO} ${d.CORREO_ASOCIADO||''}`.toLowerCase())}"><td><strong>${esc(d.TIPO)}</strong><span class="muted">${esc(d.ID)}</span></td><td><strong>${esc(d.ASOCIADO_TIPO||'Usuario')}</strong><small>${esc(asociado)}</small></td><td>${esc(d.IDENTIFICACION)}</td><td>${fmtDate(d.FECHA_VENCIMIENTO)}</td><td>${status(d.ESTADO)}</td><td>${d.DIRECCION_ARCHIVO?`<a class="link-button" href="${esc(d.DIRECCION_ARCHIVO)}" target="_blank" rel="noopener">Abrir</a>`:'—'}</td><td>${actions('documents',d.ID)}</td></tr>`;}
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
    const permissionButton=hasPermission('USUARIOS','ACTUALIZAR')?`<button data-user-permissions="${esc(u.ID)}" title="Configurar permisos" aria-label="Configurar permisos de ${esc(u.NOMBRE)}">⚿</button>`:'';
    const actionHtml=actions('users',u.ID),baseActions=actionHtml==='—'?(permissionButton?`<div class="row-actions">${permissionButton}</div>`:'—'):actionHtml.replace('</div>',permissionButton+'</div>');
    return `<tr class="user-row" data-filter-date="${esc(u.ULTIMO_ACCESO||u.ACTUALIZADO_EN||u.CREADO_EN||'')}" data-search-row="${esc(`${u.NOMBRE} ${u.CORREO} ${u.ROL_ID} ${mode}`.toLowerCase())}"><td data-label="Usuario" class="user-main-cell"><div class="entity"><span class="avatar">${initials(u.NOMBRE)}</span><strong>${esc(u.NOMBRE)}</strong></div></td><td data-label="Correo" class="user-email-cell">${esc(u.CORREO)}</td><td data-label="Rol">${esc(u.ROL_NOMBRE||u.ROL_ID)}</td><td data-label="Permisos" class="user-permission-cell"><span class="user-permission-summary ${admin?'full':'custom'}"><b>${esc(mode)}</b><small>${admin?'Todos los permisos activos':u.MODO_PERMISOS==='PERSONALIZADO'?`${personalizados.length} permiso(s) marcados`:'Permisos heredados del rol'}</small></span></td><td data-label="Último acceso">${fmtDate(u.ULTIMO_ACCESO,true)}</td><td data-label="Estado">${status(u.ESTADO)}</td><td data-label="Acciones" class="user-actions-cell">${baseActions}</td></tr>`;
  }
  function actions(resource,id){const module=resourcePermission[resource];const buttons=[];if(hasPermission(module,'ACTUALIZAR'))buttons.push(`<button data-edit="${resource}:${id}" title="Editar">✎</button>`);if(hasPermission(module,'ELIMINAR'))buttons.push(`<button data-delete="${resource}:${id}" title="Eliminar">×</button>`);return buttons.length?`<div class="row-actions">${buttons.join('')}</div>`:'—';}

  function puedeImprimirQrVehiculo(){return ['ROL-ADMIN','ROL-SUPERVISOR'].includes(String(currentUser?.ROL_ID||'').trim().toUpperCase());}
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
    $('#modalBody').innerHTML=`<div class="vehicle-qr-modal"><div class="tracking-notice active"><i>✓</i><div><b>QR creado y validado para los escaneos del sistema</b><span>Contenido: ${esc(etiqueta.CODIGO)} · acceso permitido para Administradores y Supervisores.</span></div></div><div class="vehicle-label-preview" role="img" aria-label="Vista previa de etiqueta QR"><div class="vehicle-label-title">${esc(etiqueta.TITULO||'CONTROL DE FLOTA')}</div><div class="vehicle-label-body"><div class="vehicle-label-qr">${svg}</div><div class="vehicle-label-info"><b>${esc(etiqueta.CODIGO)}</b><strong>${esc(etiqueta.DESCRIPCION||etiqueta.PATENTE)}</strong><span>PATENTE: ${esc(etiqueta.PATENTE)}</span><small>ESCANEAR PARA IDENTIFICAR EL VEHÍCULO</small></div></div></div><div class="vehicle-qr-print-help"><b>Configuración de impresión</b><span>Tamaño de papel: 100 mm × 50 mm · orientación horizontal · escala 100 % · márgenes ninguno.</span></div><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn primary" type="button" data-confirm-print-vehicle-qr>▦ Imprimir etiqueta QR</button></div></div>`;
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
    if(row.UTILIZADO==='SI')return 'Utilizado';
    if(row.ESTADO_REVISION==='Aprobado'&&new Date(row.VIGENTE_HASTA||0).getTime()<=Date.now())return 'Expirado';
    return row.ESTADO_REVISION||row.RESULTADO||'Sin estado';
  }
  function checkinDetailAction(row) {
    return `<button class="btn soft small" data-checkin-detail="${esc(row.ID)}">Ver inspección</button>`;
  }
  async function checkinContext() {
    const batch=await api.requestBatch([
      {key:'checkins',action:'list',payload:{resource:'checkins'}},
      {key:'vehicles',action:'list',payload:{resource:'vehicles'}},
      {key:'drivers',action:'list',payload:{resource:'drivers'}},
    ]),checkins=batch.checkins||{},vehicles=batch.vehicles||{},drivers=batch.drivers||{};
    guardarListaFormulario('checkins',checkins.rows||[]);guardarListaFormulario('vehicles',vehicles.rows||[]);guardarListaFormulario('drivers',drivers.rows||[]);
    return {rows:(checkins.rows||[]).sort((a,b)=>new Date(b.FECHA_HORA||0)-new Date(a.FECHA_HORA||0)),vehicles:vehicles.rows||[],drivers:drivers.rows||[]};
  }
  function checkinRow(row,vehicleMap,driverMap,withReview=false) {
    const vehicle=vehicleMap[row.VEHICULO_ID]?.PATENTE||row.VEHICULO_ID,driver=driverMap[row.CONDUCTOR_ID]?.NOMBRE||row.CONDUCTOR_ID,state=checkinVisualState(row);
    const review=withReview&&row.ESTADO_REVISION==='Pendiente'&&Number(row.FALLAS_CRITICAS||0)===0?`<button class="btn primary small" data-review-checkin="${esc(row.ID)}">Revisar</button>`:'';
    return `<tr data-filter-date="${esc(row.FECHA_HORA||row.CREADO_EN||'')}" data-search-row="${esc(`${row.ID} ${vehicle} ${driver} ${row.RESULTADO} ${state}`.toLowerCase())}"><td><strong>${esc(row.ID)}</strong><span class="muted">${fmtDate(row.FECHA_HORA,true)}</span></td><td><strong>${esc(vehicle)}</strong></td><td>${esc(driver)}</td><td>${status(row.RESULTADO)}</td><td>${status(state)}</td><td><span class="checkin-count critical">${number(row.FALLAS_CRITICAS||0)} críticas</span><span class="checkin-count">${number(row.FALLAS_LEVES||0)} leves</span></td><td>${fmtDate(row.VIGENTE_HASTA,true)}</td><td><div class="row-button-stack">${review}${checkinDetailAction(row)}</div></td></tr>`;
  }
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
          <label class="checkin-answer fail"><input type="radio" name="checkin_${esc(item.id)}" value="FALLA" required><span>! Presenta falla</span></label>
          ${item.critico?'':`<label class="checkin-answer na"><input type="radio" name="checkin_${esc(item.id)}" value="NA" required><span>— No aplica</span></label>`}
        </div>
        <label class="field checkin-inline-note"><span>Observación ${item.critico?'del control':'opcional'}</span><input data-checkin-note="${esc(item.id)}" placeholder="Describa daños, ruidos o condiciones encontradas"></label>
      </article>`;
    }).join('')}</fieldset>`).join('');
  }

  function checkinInlineFormMarkup() {
    const pendienteRuta=leerJsonLocal(pendingRouteCheckinKey)||{};
    if(!hasPermission('CHECKIN','CREAR')){
      return `<article class="card checkin-visible-card"><div class="card-header"><div><h3>Lista de chequeo vehicular</h3><p>Los controles están disponibles, pero su usuario no tiene permiso para registrar inspecciones.</p></div>${status('Solo lectura')}</div><div class="tracking-notice warning full"><i>!</i><div><b>Permiso requerido: CHECKIN · CREAR</b><span>Solicite al administrador activar este permiso en Usuarios → Configurar permisos.</span></div></div><div class="checkin-readonly-list">${checkinCatalog.map((item,index)=>`<div><span>${index+1}</span><p><b>${esc(item.item)}</b><small>${esc(item.categoria)} · ${item.critico?'Crítico':'Complementario'}</small></p></div>`).join('')}</div></article>`;
    }
    return `<article class="card checkin-visible-card" id="checkinVisibleCard">
      <div class="card-header checkin-visible-header"><div><span class="eyebrow">CHEQUEO ANTES DE SALIR</span><h3>Lista de chequeo vehicular</h3><p>Marque los 16 controles. El formulario permanece visible dentro del módulo.</p></div><div class="checkin-progress-summary"><b data-checkin-progress-count>0 / ${checkinCatalog.length}</b><span>controles revisados</span></div></div>
      <div class="checkin-progress-track" aria-hidden="true"><i data-checkin-progress-bar></i></div>
      <form class="form-grid checkin-form checkin-inline-form" id="checkinInlineForm">
        <input type="hidden" name="AUTORIZACION_QR">
        <div class="tracking-notice active full hidden" data-checkin-qr-notice><i>▦</i><div><b>Vehículo validado mediante QR</b><span>La patente escaneada quedó seleccionada para esta inspección.</span></div></div>
        <div class="checkin-basic-data full">
          <label class="field"><span>Vehículo</span>${selectorDinamico('vehicles','checkinVehicles','VEHICULO_ID',pendienteRuta.VEHICULO_ID||'',true)}</label>
          <label class="field"><span>Conductor</span>${selectorDinamico('drivers','checkinDrivers','CONDUCTOR_ID',pendienteRuta.CONDUCTOR_ID||currentUser.CONDUCTOR_ID||'',true)}</label>
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
    const approved=data.rows.filter(row=>checkinVisualState(row)==='Aprobado').length,pending=data.rows.filter(row=>row.ESTADO_REVISION==='Pendiente').length,blocked=data.rows.filter(row=>row.ESTADO_REVISION==='Bloqueado').length;
    const rows=data.rows.map(row=>checkinRow(row,vehicleMap,driverMap)).join('');
    const create=hasPermission('CHECKIN','CREAR')?`${hasPermission('QR','LEER')?'<button class="btn soft" data-open-checkin-qr>▦ Escanear QR para revisión</button>':''}<button class="btn primary" data-focus-checkin>↓ Ir a la lista de chequeo</button>`:'';
    return heading('INSPECCIÓN PREOPERACIONAL','Check-in vehicular','Revise el vehículo antes de iniciar cualquier operación. Los 16 controles aparecen directamente en esta pantalla.',`<button class="btn soft" data-sync>↻ Sincronizar</button>${create}`)+
      reciboCheckinMarkup()+
      `<div class="checkin-process"><article><i>1</i><div><b>Seleccionar vehículo</b><span>Confirme patente, conductor y kilometraje.</span></div></article><article><i>2</i><div><b>Completar 16 controles</b><span>Marque conforme, falla o no aplica cuando corresponda.</span></div></article><article><i>3</i><div><b>Guardar evaluación</b><span>La operación solo inicia con check-in aprobado y vigente.</span></div></article></div>`+
      checkinInlineFormMarkup()+
      `<div class="live-strip">${liveStat('✓','Aprobados vigentes',approved,'online')}${liveStat('⌛','Pendientes',pending,pending?'warning':'')}${liveStat('!','Bloqueados',blocked,blocked?'warning':'')}${liveStat('▤','Inspecciones',data.rows.length)}</div>`+
      `<article class="card"><div class="card-header"><div><h3>Inspecciones registradas</h3><p>Historial visible según el perfil del usuario</p></div></div><div class="toolbar"><label class="search-box"><span>⌕</span><input data-table-search placeholder="Buscar por patente, conductor o estado"></label><button class="btn soft push" data-nav="checkinHistory">Historial completo</button></div><div data-filter-table>${table(['Check-in','Vehículo','Conductor','Resultado','Estado','Fallas','Vigente hasta','Acciones'],rows,'No existen check-ins registrados.')}</div></article>`;
  }
  async function renderCheckinApprovals() {
    const data=await checkinContext(),vehicleMap=Object.fromEntries(data.vehicles.map(v=>[v.ID,v])),driverMap=Object.fromEntries(data.drivers.map(d=>[d.ID,d]));
    const pending=data.rows.filter(row=>['Pendiente','Bloqueado'].includes(row.ESTADO_REVISION)&&row.UTILIZADO!=='SI');
    const rows=pending.map(row=>checkinRow(row,vehicleMap,driverMap,true)).join('');
    return heading('CONTROL DE SEGURIDAD','Aprobación de check-ins','Revise observaciones leves. Las fallas críticas exigen corrección y una nueva inspección.',`<button class="btn soft" data-sync>↻ Sincronizar</button>`)+
      `<div class="operation-banner checkin-warning"><i>!</i><div><h3>Regla de bloqueo</h3><p>Un supervisor puede aprobar observaciones leves, pero nunca una inspección con fallas críticas.</p></div></div>`+
      `<div class="live-strip">${liveStat('⌛','Pendientes de revisión',pending.filter(r=>r.ESTADO_REVISION==='Pendiente').length,'warning')}${liveStat('!','Bloqueados críticos',pending.filter(r=>r.ESTADO_REVISION==='Bloqueado').length,'warning')}${liveStat('✓','Aprobados hoy',data.rows.filter(r=>r.ESTADO_REVISION==='Aprobado'&&String(r.FECHA_REVISION||r.FECHA_HORA).slice(0,10)===new Date().toISOString().slice(0,10)).length,'online')}</div>`+
      `<article class="card"><div class="toolbar"><label class="search-box"><span>⌕</span><input data-table-search placeholder="Buscar check-in pendiente"></label><button class="btn soft push" data-nav="checkinHistory">Abrir historial</button></div><div data-filter-table>${table(['Check-in','Vehículo','Conductor','Resultado','Estado','Fallas','Vigente hasta','Acciones'],rows,'No hay check-ins pendientes de revisión.')}</div></article>`;
  }
  async function renderCheckinHistory() {
    const data=await checkinContext(),vehicleMap=Object.fromEntries(data.vehicles.map(v=>[v.ID,v])),driverMap=Object.fromEntries(data.drivers.map(d=>[d.ID,d]));
    const rows=data.rows.map(row=>checkinRow(row,vehicleMap,driverMap)).join('');
    return heading('TRAZABILIDAD','Historial de check-in','Consulte inspecciones, resultados, aprobaciones, bloqueos y operaciones relacionadas.',`<button class="btn soft" data-sync>↻ Sincronizar</button><button class="btn soft" data-export="checkins">Exportar CSV</button>`)+
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
  function guardarUltimaUbicacionDispositivo(location={}){
    const latitud=Number(location.latitud),longitud=Number(location.longitud),precision=Math.max(1,Number(location.precision||9999)),fecha=Number(location.fecha||Date.now());
    if(!Number.isFinite(latitud)||!Number.isFinite(longitud))return null;
    const clean={latitud,longitud,precision,fecha,fuente:location.fuente||'GPS del dispositivo'};
    ultimaPosicionConocida=clean;
    try{localStorage.setItem(lastKnownLocationDeviceKey,JSON.stringify(clean));}catch(_){}
    return clean;
  }
  function cargarUltimaUbicacionDispositivo(){
    try{
      const row=JSON.parse(localStorage.getItem(lastKnownLocationDeviceKey)||'null');
      if(!row||!Number.isFinite(Number(row.latitud))||!Number.isFinite(Number(row.longitud)))return null;
      return{latitud:Number(row.latitud),longitud:Number(row.longitud),precision:Math.max(1,Number(row.precision||9999)),fecha:Number(row.fecha||0),fuente:row.fuente||'Última ubicación conocida'};
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
  async function renderOperations() {
    const summary=await api.request('operationsSummary',{limit:Number(config.MAXIMO_HISTORIAL_OPERACIONES_RAPIDO||80),cache:false});
    const operationRows=summary.operations||[],active=summary.activeOperations||operationRows.filter(row=>row.ESTADO==='Activa');
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

    const activeHtml=active.map(op=>`<article class="operation-card"><header><div><h4>${esc(op.ID)} · ${esc(vehicleMap[op.VEHICULO_ID]?.PATENTE||op.VEHICULO_ID)}</h4><small>${esc(driverMap[op.CONDUCTOR_ID]?.NOMBRE||op.CONDUCTOR_ID)}</small></div>${status(op.ESTADO)}</header><div class="operation-route">${esc(op.ORIGEN||op.BASE_DIRECCION||'Base')} → ${esc(op.DESTINO||op.PUNTO_RETORNO||'Base')}</div><div class="operation-meta"><div><span>INICIO</span><b>${fmtDate(op.FECHA_INICIO,true)}</b></div><div><span>KM INICIAL</span><b>${op.KM_INICIO!==''&&op.KM_INICIO!=null?number(op.KM_INICIO):'Opcional'}</b></div><div><span>TIPO</span><b>${esc(op.TIPO_OPERACION||'Regreso a base')}</b></div><div><span>RUTA</span><b>${esc(routeMap[op.RUTA_ID]?.NOMBRE||op.RUTA_ID||'Sin ruta')}</b></div><div><span>INICIO VALIDADO</span><b>${String(op.VALIDACION_INICIO||'').startsWith('CAPTURADA')||op.VALIDACION_INICIO==='VALIDADA'?`${number(op.DISTANCIA_INICIO_BASE_METROS)} m de base · ${esc(String(op.VALIDACION_INICIO||'').replaceAll('_',' ').toLowerCase())}`:'Pendiente'}</b></div><div><span>CHECK-IN</span><b>${esc(op.CHECKIN_ID||'Sin registro')}</b></div><div><span>RETORNO</span><b>${esc(op.PUNTO_RETORNO||op.BASE_DIRECCION||'Base operacional')}</b></div></div><div class="operation-card-actions">${driverMap[op.CONDUCTOR_ID]?.TELEFONO?`<button class="btn whatsapp small" data-whatsapp-driver="${esc(op.CONDUCTOR_ID)}">◉ WhatsApp</button>`:''}${esAdministrador()?`<button class="btn soft small" data-edit-operation-admin="${op.ID}">Editar</button>`:''}${puedeFinalizarOperacion()?`<button class="btn danger small" data-finish-operation="${op.ID}">${currentUser.ROL_ID==='ROL-CONDUCTOR'?'Finalizar en punto base':'Finalizar operación'}</button>`:''}${esAdministrador()?`<button class="btn danger small" data-delete-operation-admin="${op.ID}">Eliminar</button>`:''}</div></article>`).join('');

    const opRows=operationRows.map(op=>`<tr data-filter-date="${esc(op.FECHA_INICIO||op.CREADO_EN||'')}" data-search-row="${esc(`${op.ID} ${vehicleMap[op.VEHICULO_ID]?.PATENTE||op.VEHICULO_ID} ${driverMap[op.CONDUCTOR_ID]?.NOMBRE||op.CONDUCTOR_ID} ${op.TIPO_OPERACION||''} ${routeMap[op.RUTA_ID]?.NOMBRE||op.RUTA_ID||''} ${op.ESTADO||''}`.toLowerCase())}"><td><strong>${esc(op.ID)}</strong></td><td>${esc(vehicleMap[op.VEHICULO_ID]?.PATENTE||op.VEHICULO_ID)}</td><td>${esc(driverMap[op.CONDUCTOR_ID]?.NOMBRE||op.CONDUCTOR_ID)}</td><td>${esc(op.TIPO_OPERACION||'—')}</td><td>${esc(routeMap[op.RUTA_ID]?.NOMBRE||op.RUTA_ID||'Sin ruta')}</td><td>${fmtDate(op.FECHA_INICIO,true)}</td><td>${op.KM_INICIO!==''&&op.KM_INICIO!=null?number(op.KM_INICIO):'—'} / ${op.KM_FIN!==''&&op.KM_FIN!=null?number(op.KM_FIN):'—'}</td><td>${String(op.VALIDACION_INICIO||'').startsWith('CAPTURADA')||op.VALIDACION_INICIO==='VALIDADA'?'✓ Inicio':''}${op.VALIDACION_FIN==='VALIDADA'?' · ✓ Fin':op.VALIDACION_FIN==='VALIDADA_PRECISION_BAJA'?' · ⚠ Fin GPS impreciso':''}</td><td>${status(op.ESTADO)}</td><td>${esAdministrador()?`<div class="row-button-stack"><button class="btn soft small" data-edit-operation-admin="${op.ID}">Editar</button><button class="btn danger small" data-delete-operation-admin="${op.ID}">Eliminar</button></div>`:'—'}</td></tr>`).join('');

    const enabled=base.configurada,createActions=`<button class="btn soft" data-sync>↻ Sincronizar</button>`+(hasPermission('OPERACIONES','CREAR')&&enabled?(currentUser.ROL_ID==='ROL-CONDUCTOR'?'<button class="btn primary" data-open-qr>▦ Validar QR e iniciar</button>':'<button class="btn soft" data-open-qr>▦ Escanear QR</button><button class="btn primary" data-new-operation>＋ Nueva operación</button>'):'');
    const availability=`<div class="operation-availability"><span><b>${number(summary.availableVehicles??vehicles.filter(row=>row.ESTADO==='Disponible').length)}</b> vehículos disponibles</span><span><b>${number(summary.availableDrivers??drivers.filter(row=>row.ESTADO==='Disponible').length)}</b> conductores disponibles</span><span><b>${number(summary.availableRoutes??routes.filter(row=>['Asignada','En curso'].includes(row.ESTADO)).length)}</b> rutas vigentes</span><small>Respuesta preparada en ${number(summary.processingMilliseconds||0)} ms</small></div>`;
    const baseBanner=enabled?`<div class="operation-geofence-banner"><i>⌖</i><div><h3>${esc(base.nombre)}</h3><p>${esc(base.direccion)} · Inicio dentro de ${number(base.radioInicio)} m · Finalización dentro de ${number(base.radioFin)} m · Precisión máxima de inicio ±${number(base.precisionMaxima)} m. En el cierre, una señal imprecisa puede aceptarse con tolerancia controlada y registro de auditoría.</p></div>${puedeAdministrarPuntoOperacion()?'<button class="btn soft" data-nav="settings">Configurar punto</button>':''}</div>`:`<div class="operation-geofence-banner blocked"><i>!</i><div><h3>Punto operacional no configurado</h3><p>Nadie podrá iniciar o finalizar operaciones hasta que el Administrador defina la ubicación base en Configuración.</p></div>${puedeAdministrarPuntoOperacion()?'<div class="operation-banner-actions"><button class="btn soft" data-nav="settings">Configuración avanzada</button><button class="btn primary" data-quick-base-setup>⌖ Configurar con mi ubicación</button></div>':''}</div>`;
    const total=Number(summary.total??operationRows.length),shown=operationRows.length,historyNote=total>shown?`Mostrando ${shown} registros prioritarios de ${number(total)}. Las operaciones activas siempre se incluyen.`:`${shown} registros cargados.`;

    return heading('CONTROL DE VIAJES','Operaciones','Carga rápida: operaciones activas, catálogos disponibles y el historial reciente.',createActions)+baseBanner+availability+
      `<div class="operation-banner"><i>⚡</i><div><h3>Modo de carga rápida activo</h3><p>${esc(historyNote)} El historial completo permanece guardado en la base y en auditoría.</p></div></div>`+
      `<div class="operation-layout"><article class="card"><div class="card-header"><div><h3>Operaciones activas</h3><p>${active.length} recorridos en curso</p></div></div>${activeHtml||empty('⇄','No hay operaciones activas',enabled?'Cree una operación desde el punto base autorizado.':'Configure primero el punto base operacional.')}</article><article class="card"><div class="card-header"><div><h3>Reglas obligatorias</h3><p>Aplicadas en el servidor</p></div></div><div class="requirement-list"><div><i>1</i><span><b>Check-in aprobado</b><small>Se consulta solo al abrir el formulario de inicio.</small></span></div><div><i>2</i><span><b>Inicio dentro del perímetro</b><small>El GPS debe estar dentro de ${number(base.radioInicio)} m de la base.</small></span></div><div><i>3</i><span><b>Ruta opcional vinculada</b><small>La ruta define el destino, pero no elimina el regreso obligatorio.</small></span></div><div><i>4</i><span><b>Finalización en la base</b><small>El vehículo debe regresar al perímetro autorizado.</small></span></div></div></article></div>`+
      `<article class="card"><div class="card-header"><div><h3>Historial reciente de operaciones</h3><p>${esc(historyNote)}</p></div></div><div class="toolbar"><label class="search-box"><span>⌕</span><input data-table-search placeholder="Buscar operación, vehículo, conductor o estado"></label></div>${table(['Operación','Vehículo','Conductor','Tipo','Ruta','Inicio','KM inicio / final','Ubicación','Estado','Acciones'],opRows,'No existen operaciones registradas.')}</article>`;
  }


  async function solicitarListaSegura(resource) {
    try {
      const result=await api.request('list',{resource,cache:false});
      guardarListaFormulario(resource,result.rows||[]);
      return {rows:result.rows||[],total:result.total??(result.rows||[]).length,error:null};
    } catch(error) {
      return {rows:[],total:0,error};
    }
  }

  async function renderRoutes() {
    const [routesResult,driversResult,vehiclesResult]=await Promise.all([
      solicitarListaSegura('routes'),solicitarListaSegura('drivers'),solicitarListaSegura('vehicles')
    ]);
    if(routesResult.error)throw routesResult.error;
    const driverMap=Object.fromEntries(driversResult.rows.map(row=>[row.ID,row]));
    const vehicleMap=Object.fromEntries(vehiclesResult.rows.map(row=>[row.ID,row]));
    const routes=routesResult.rows.map(route=>({...route,CONDUCTOR_NOMBRE:driverMap[route.CONDUCTOR_ID]?.NOMBRE||route.CONDUCTOR_ID||'',VEHICULO_PATENTE:vehicleMap[route.VEHICULO_ID]?.PATENTE||route.VEHICULO_ID||''}));
    guardarListaFormulario('routes',routes);
    const base=configuracionPuntoOperacion();
    const assigned=routes.filter(row=>row.ESTADO==='Asignada');
    const running=routes.filter(row=>row.ESTADO==='En curso');
    const completed=routes.filter(row=>row.ESTADO==='Completada');
    const cancelled=routes.filter(row=>row.ESTADO==='Cancelada');
    const active=[...running,...assigned];
    const actions=`<button class="btn soft" data-sync>↻ Sincronizar</button>${hasPermission('RUTAS','CREAR')?'<button class="btn primary" data-new-route>＋ Asignar ruta</button>':''}`;
    const prerequisites=[];
    if(!base.configurada)prerequisites.push(`<div class="module-diagnostic warning"><i>⌖</i><div><b>La ruta puede asignarse sin geocerca</b><span>Defina manualmente el origen y el destino. El punto operacional solo será obligatorio cuando se intente iniciar o finalizar una operación.</span></div>${puedeAdministrarPuntoOperacion()?'<button class="btn soft" data-nav="settings">Configurar punto para operaciones</button>':''}</div>`);
    if(hasPermission('RUTAS','CREAR')&&!driversResult.rows.length)prerequisites.push(`<div class="module-diagnostic warning"><i>♙</i><div><b>No existen conductores disponibles</b><span>Registre un conductor antes de crear la primera asignación.</span></div><button class="btn soft" data-nav="drivers">Abrir conductores</button></div>`);
    if(hasPermission('RUTAS','CREAR')&&!vehiclesResult.rows.length)prerequisites.push(`<div class="module-diagnostic warning"><i>▣</i><div><b>No existen vehículos registrados</b><span>Registre una unidad para asociarla a la ruta.</span></div><button class="btn soft" data-nav="vehicles">Abrir vehículos</button></div>`);
    const routeRows=routes.slice().sort((a,b)=>new Date(b.FECHA_ASIGNACION||0)-new Date(a.FECHA_ASIGNACION||0)).map(route=>`<tr data-filter-date="${esc(route.FECHA_ASIGNACION||route.CREADO_EN||'')}" data-search-row="${esc(`${route.ID} ${route.NOMBRE} ${route.CONDUCTOR_NOMBRE} ${route.VEHICULO_PATENTE} ${route.DESTINO} ${route.ESTADO}`.toLowerCase())}"><td><strong>${esc(route.ID)}</strong><span class="muted">${esc(route.NOMBRE||'Ruta')}</span></td><td>${esc(route.CONDUCTOR_NOMBRE||'Sin conductor')}</td><td>${esc(route.VEHICULO_PATENTE||'Sin vehículo')}</td><td>${esc(route.ORIGEN||base.direccion)} → ${esc(route.DESTINO||'Sin destino')}</td><td>${fmtDate(route.FECHA_ASIGNACION,true)}</td><td>${status(route.ESTADO)}</td><td>${evidenciasRuta(route).length?botonGaleriaRuta(route,`Ver ${evidenciasRuta(route).length} foto(s)`):'Sin fotos'}</td><td><div class="row-button-stack"><a class="btn soft small" href="${esc(navigationUrl(route))}" target="_blank" rel="noopener">Navegar</a><button class="btn soft small" data-route-evidence="${route.ID}">📷 Respaldo</button>${driverMap[route.CONDUCTOR_ID]?.TELEFONO?`<button class="btn whatsapp small" data-whatsapp-driver="${esc(route.CONDUCTOR_ID)}">WhatsApp</button>`:''}</div></td></tr>`).join('');
    return heading('PLANIFICACIÓN OPERACIONAL','Asignación de rutas','Cree, supervise y cierre rutas vinculadas al conductor, vehículo y punto base.',actions)+
      prerequisites.join('')+
      `<div class="live-strip">${liveStat('➜','Asignadas',assigned.length,assigned.length?'warning':'')}${liveStat('●','En curso',running.length,running.length?'online':'')}${liveStat('✓','Completadas',completed.length,'online')}${liveStat('×','Canceladas',cancelled.length,cancelled.length?'warning':'')}</div>`+
      `<div class="route-dashboard"><article class="card"><div class="card-header"><div><h3>Rutas activas</h3><p>${active.length} asignaciones pendientes o en ejecución</p></div></div><div class="route-list">${active.map(route=>routeCard(route)).join('')||empty('➜','Sin rutas activas','Asigne una ruta para comenzar la planificación.',hasPermission('RUTAS','CREAR')?'<button class="btn primary" data-new-route>Asignar primera ruta</button>':'')}</div></article><article class="card"><div class="card-header"><div><h3>Flujo de la ruta</h3><p>Reglas coordinadas con Operaciones</p></div></div><div class="requirement-list"><div><i>1</i><span><b>Origen planificado</b><small>${esc(base.configurada?base.direccion:'Se define al asignar la ruta')}</small></span></div><div><i>2</i><span><b>Destino asignado</b><small>Se envía al conductor con Google Maps o Waze.</small></span></div><div><i>3</i><span><b>Check-in diario por conductor y vehículo</b><small>Se exige al iniciar la primera salida del día. Solo se reutiliza para el mismo conductor y el mismo vehículo.</small></span></div><div><i>4</i><span><b>GPS durante toda la ruta</b><small>Al iniciar se vincula con la operación activa y envía ubicación hasta completar o cancelar la ruta.</small></span></div></div></article></div>`+
      `<article class="card"><div class="card-header"><div><h3>Historial de rutas</h3><p>Todos los estados y destinos registrados</p></div></div><div class="toolbar"><label class="search-box"><span>⌕</span><input data-table-search placeholder="Buscar ruta, conductor, vehículo o destino"></label><button class="btn soft push" data-export="routes">Exportar CSV</button></div><div data-filter-table>${table(['Ruta','Conductor','Vehículo','Recorrido','Asignación','Estado','Evidencias','Acciones'],routeRows,'No existen rutas registradas.')}</div></article>`;
  }

  async function renderNotifications() {
    const [notificationsResult,driversResult,usersResult]=await Promise.all([
      solicitarListaSegura('notifications'),solicitarListaSegura('drivers'),solicitarListaSegura('users')
    ]);
    if(notificationsResult.error)throw notificationsResult.error;
    const driverMap=Object.fromEntries(driversResult.rows.map(row=>[row.ID,row]));
    const userMap=Object.fromEntries(usersResult.rows.map(row=>[row.ID,row]));
    const notifications=notificationsResult.rows.slice().sort((a,b)=>new Date(b.FECHA_ENVIO||b.CREADO_EN||0)-new Date(a.FECHA_ENVIO||a.CREADO_EN||0));
    guardarListaFormulario('notifications',notifications);
    const unread=notifications.filter(row=>row.LEIDA!=='SI');
    const urgent=unread.filter(row=>['Urgente','Alta'].includes(row.PRIORIDAD));
    const actions=`<button class="btn soft" data-sync>↻ Sincronizar</button><button class="btn soft" data-speak-notifications>🔊 Leer pendientes</button><button class="btn soft" data-voice-command>🎙 Comando de voz</button>${hasPermission('NOTIFICACIONES','CREAR')?'<button class="btn primary" data-new-notification>＋ Nueva notificación</button>':''}`;
    const rows=notifications.map(item=>{const recipient=driverMap[item.DESTINATARIO_CONDUCTOR_ID]?.NOMBRE||userMap[item.DESTINATARIO_USUARIO_ID]?.NOMBRE||item.DESTINATARIO_CONDUCTOR_ID||item.DESTINATARIO_USUARIO_ID||'Sin destinatario';return `<tr data-filter-date="${esc(item.FECHA_ENVIO||item.CREADO_EN||'')}" data-search-row="${esc(`${item.TITULO} ${item.MENSAJE} ${recipient} ${item.PRIORIDAD} ${item.TIPO}`.toLowerCase())}"><td>${item.LEIDA==='SI'?'<span class="status">Leída</span>':'<span class="status warning">Pendiente</span>'}</td><td><strong>${esc(item.TITULO)}</strong><span class="muted">${esc(item.MENSAJE)}</span></td><td>${esc(recipient)}</td><td>${status(item.PRIORIDAD||'Normal')}</td><td>${esc(item.TIPO||'Información')}</td><td>${fmtDate(item.FECHA_ENVIO||item.CREADO_EN,true)}</td><td>${item.LEIDA!=='SI'?`<button class="btn soft small" data-read-notification="${item.ID}">Marcar leída</button>`:'—'}</td></tr>`;}).join('');
    return heading('CENTRO DE COMUNICACIONES','Notificaciones','Mensajes dirigidos, lectura, dictado y comandos de voz desde una sola bandeja.',actions)+
      `<div class="voice-command-panel"><div><span class="eyebrow">CONTROL POR VOZ</span><h3>Comandos disponibles</h3><p id="voiceCommandStatus">Diga “leer notificaciones”, “marcar todas como leídas”, “crear notificación” o “detener lectura”.</p></div><div class="voice-command-actions"><button class="btn primary" data-voice-command>🎙 Escuchar comando</button><button class="btn soft" data-speak-notifications>🔊 Leer</button><button class="btn soft" data-stop-voice>■ Detener</button></div></div>`+
      `<div class="live-strip">${liveStat('🔔','Total',notifications.length)}${liveStat('●','Pendientes',unread.length,unread.length?'warning':'online')}${liveStat('!','Alta o urgente',urgent.length,urgent.length?'warning':'')}${liveStat('✓','Leídas',notifications.length-unread.length,'online')}</div>`+
      `<div class="notification-dashboard"><article class="card"><div class="card-header"><div><h3>Pendientes</h3><p>Mensajes que requieren atención</p></div>${unread.length?'<button class="link-button" data-read-all-notifications>Marcar todas como leídas</button>':''}</div><div class="notification-list">${unread.map(notificationCard).join('')||empty('✓','Bandeja al día','No existen mensajes pendientes.')}</div></article><article class="card"><div class="card-header"><div><h3>Estado del servicio</h3><p>Validaciones de comunicación</p></div></div><div class="requirement-list"><div><i>✓</i><span><b>Bandeja central</b><small>${api.isRemote()?'Sincronizada con Google Sheets':'Activa en este dispositivo'}</small></span></div><div><i>🎙</i><span><b>Comando de voz</b><small>${reconocimientoDisponible()?'Disponible en este navegador':'Reconocimiento no disponible; lectura sí puede funcionar'}</small></span></div><div><i>♙</i><span><b>Destinatarios</b><small>${driversResult.rows.length} conductores disponibles para mensajería</small></span></div></div></article></div>`+
      `<article class="card"><div class="card-header"><div><h3>Historial de notificaciones</h3><p>Mensajes enviados y recibidos</p></div></div><div class="toolbar"><label class="search-box"><span>⌕</span><input data-table-search placeholder="Buscar título, mensaje o destinatario"></label><button class="btn soft push" data-export="notifications">Exportar CSV</button></div><div data-filter-table>${table(['Estado','Mensaje','Destinatario','Prioridad','Tipo','Fecha','Acción'],rows,'No existen notificaciones registradas.')}</div></article>`;
  }

  async function renderAlerts() {
    const result=await solicitarListaSegura('alerts');
    if(result.error)throw result.error;
    const alerts=result.rows.slice().sort((a,b)=>new Date(b.FECHA_HORA||b.CREADO_EN||0)-new Date(a.FECHA_HORA||a.CREADO_EN||0));
    guardarListaFormulario('alerts',alerts);
    const unread=alerts.filter(row=>row.LEIDA!=='SI');
    const critical=unread.filter(row=>String(row.NIVEL||'').toLowerCase().includes('cr'));
    const rows=alerts.map(row=>`<tr data-filter-date="${esc(row.FECHA_HORA||row.CREADO_EN||'')}" data-search-row="${esc(`${row.NIVEL} ${row.TITULO} ${row.MENSAJE} ${row.MODULO}`.toLowerCase())}"><td>${status(row.NIVEL||'Info')}</td><td><strong>${esc(row.TITULO||'Alerta')}</strong><span class="muted">${esc(row.MENSAJE||'')}</span></td><td>${esc(row.MODULO||'Sistema')}</td><td>${esc(row.REGISTRO_ID||'—')}</td><td>${fmtDate(row.FECHA_HORA||row.CREADO_EN,true)}</td><td>${row.LEIDA==='SI'?status('Cerrada'):(esAdministrador()?`<button class="btn soft small" data-read-alert="${row.ID}">Validar y cerrar</button>`:'<span class="status warning">Requiere Administrador</span>')}</td></tr>`).join('');
    return heading('CENTRO DE ATENCIÓN','Alertas','Eventos operacionales, fallas críticas y avisos generados por el sistema.',`<button class="btn soft" data-sync>↻ Sincronizar</button><button class="btn soft" data-run-alert-engine>⚡ Revisar anomalías</button>${unread.length&&esAdministrador()?'<button class="btn soft" data-read-all-alerts>✓ Validar y cerrar todas</button>':''}${hasPermission('ALERTAS','CREAR')?'<button class="btn primary" data-add="alerts">＋ Crear alerta</button>':''}`)+
      `<div class="live-strip">${liveStat('!','Pendientes',unread.length,unread.length?'warning':'online')}${liveStat('⚠','Críticas',critical.length,critical.length?'warning':'')}${liveStat('✓','Atendidas',alerts.length-unread.length,'online')}${liveStat('▤','Total',alerts.length)}</div>`+
      `<div class="automatic-alert-banner"><i>⚡</i><div><b>Motor automático activo</b><span>Revisa cada 5 minutos y mantiene informados a los Administradores. Las alertas operacionales permanecen abiertas hasta su validación en terreno.</span></div></div>`+
      `<article class="card"><div class="toolbar"><label class="search-box"><span>⌕</span><input data-table-search placeholder="Buscar alerta, módulo o registro"></label><button class="btn soft push" data-export="alerts">Exportar CSV</button></div><div data-filter-table>${table(['Nivel','Alerta','Módulo','Registro','Fecha','Acción'],rows,'No existen alertas registradas.')}</div></article>`;
  }


  function canSelectGpsVehicles() {
    return ['ROL-ADMIN','ROL-SUPERVISOR'].includes(currentUser?.ROL_ID);
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
    if(currentUser?.ROL_ID!=='ROL-CONDUCTOR')return '';
    const f=gpsDriverFilters;
    const vehicles=(realtime.trackingVehicles||[]).map(row=>gpsSimpleOption(row.ID,`${row.PATENTE||row.ID}${row.CONDUCTOR_NOMBRE?` · ${row.CONDUCTOR_NOMBRE}`:''}`,f.VEHICULO_ID)).join('');
    const drivers=(realtime.trackingDrivers||[]).map(row=>gpsSimpleOption(row.ID,row.NOMBRE||row.ID,f.CONDUCTOR_ID)).join('');
    return `<article class="card gps-driver-filter-card"><div class="card-header"><div><p class="tag">VISTA DEL CONDUCTOR</p><h3>Filtros de ubicación</h3><p>Solo se muestran ubicaciones autorizadas para su propia cuenta, conductor y vehículos asociados.</p></div><span class="tracking-selection-summary">Máximo ${esc(f.LIMITE_PUNTOS||'25')} puntos</span></div><form id="gpsDriverFilterForm" class="gps-driver-filter-form"><label class="field"><span>Fecha desde</span><input name="FECHA_DESDE" type="date" value="${esc(f.FECHA_DESDE)}"></label><label class="field"><span>Fecha hasta</span><input name="FECHA_HASTA" type="date" value="${esc(f.FECHA_HASTA)}"></label><label class="field"><span>Vehículo</span><select name="VEHICULO_ID"><option value="">Todos mis vehículos</option>${vehicles}</select></label><label class="field"><span>Conductor</span><select name="CONDUCTOR_ID"><option value="">Mi conductor asociado</option>${drivers}</select></label><label class="field"><span>Estado GPS</span><select name="GPS_ESTADO"><option value="TODOS" ${f.GPS_ESTADO==='TODOS'?'selected':''}>Todos</option><option value="ACTIVO" ${f.GPS_ESTADO==='ACTIVO'?'selected':''}>GPS activo</option><option value="INACTIVO" ${f.GPS_ESTADO==='INACTIVO'?'selected':''}>GPS sin señal reciente</option></select></label><label class="field"><span>Máximo de puntos</span><select name="LIMITE_PUNTOS">${['10','25','50','100'].map(value=>gpsSimpleOption(value,value,f.LIMITE_PUNTOS)).join('')}</select></label><div class="form-actions"><button class="btn soft" type="button" data-gps-driver-reset>Limpiar filtros</button><button class="btn primary" type="submit">Aplicar filtros</button></div></form></article>`;
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

  async function renderGps() {
    const realtime=ultimoResumenGps&&Array.isArray(ultimoResumenGps.locations)
      ? ultimoResumenGps
      : {locations:[],devices:[],trackingVehicles:[],totals:{}};
    ultimoResumenGps=realtime;
    api.request('realtimeSummary',{...gpsFilterPayload(),force:true})
      .then(result=>{ultimoResumenGps=result;if(currentSection==='gps')paintGpsData(result,true);})
      .catch(()=>{});
    const locations={rows:realtime.locations||[],total:realtime.totals?.locations||0};
    return heading('MONITOREO','GPS en tiempo real','Posición, dirección escrita, velocidad y conexión de los teléfonos autorizados.',`<button class="btn soft" data-refresh-locations>↻ Sincronizar</button><button class="btn soft" data-capture-gps>⌖ Enviar ahora</button><button class="btn ${gpsWatchId===null?'primary':'danger'}" data-toggle-tracking>${gpsWatchId===null?'Activar ubicación continua':'Detener ubicación continua'}</button>`)+
      gpsDriverFilterControls(realtime)+
      gpsFilterControls(realtime)+
      `<div class="tracking-notice ${gpsWatchId===null?'inactive':'active'}" data-tracking-notice><i data-tracking-icon>${gpsWatchId===null?'○':'●'}</i><div><b data-tracking-title>${gpsWatchId===null?'Ubicación continua detenida':'Ubicación continua activada'}</b><span data-tracking-detail>${trackingDetail()}</span></div></div>`+
      `<div class="tracking-details"><div><span>Permiso del navegador</span><b data-tracking-permission>${permissionLabel()}</b></div><div><span>Reactivación automática</span><b data-tracking-preference>${trackingPreferenceEnabled()?'Activada':'Desactivada'}</b></div><div><span>Protección de pantalla activa</span><b data-wake-lock>${wakeLockLabel()}</b></div></div>`+
      `<div class="live-strip"><article class="live-stat"><i>⌖</i><div><span>Ubicaciones visibles</span><b id="gpsVisibleCount">${locations.total}</b></div></article><article class="live-stat online"><i>●</i><div><span>Sesiones abiertas</span><b id="gpsOnlineCount">${realtime.totals?.onlineDevices||0}</b></div></article><article class="live-stat online"><i>🚐</i><div><span>Conduciendo</span><b id="gpsDrivingCount">${realtime.totals?.drivingSessions||0}</b></div></article><article class="live-stat ${(realtime.totals?.sessionsWithoutGps||0)?'warning':''}"><i>!</i><div><span>Operación sin GPS</span><b id="gpsWithoutCount">${realtime.totals?.sessionsWithoutGps||0}</b></div></article></div>`+
      `<div class="gps-layout"><article class="card map-card" id="mapCard"><div class="map-fullscreen-bar"><button class="btn soft small" type="button" data-map-fullscreen>⛶ Pantalla completa</button></div><div id="fleetMap" class="fleet-map"></div><div class="map-toolbar"><span class="gps-live"><i></i> Consulta rápida cada ${Math.round(config.INTERVALO_TIEMPO_REAL_MILISEGUNDOS/1000)} segundos</span><span class="map-status-legend"><b class="active"></b> Activo <b class="inactive"></b> Inactivo <b class="geofence"></b> Radio base</span><span class="muted" id="gpsLastSync">Datos iniciales cargados</span><span class="muted push">Mapa © OpenStreetMap, CARTO o Esri</span></div></article><article class="card"><div class="card-header"><div><h3>Últimas posiciones</h3><p id="locationCount">${locations.total} vehículos visibles</p></div></div><div class="driver-location-list" id="driverLocationList">${locationList(locations.rows)}</div><div class="card-header" style="margin-top:18px"><div><h3>Sesiones y conductores</h3><p>Usuario, actividad y sección abierta</p></div></div><div class="device-list" id="deviceList">${(realtime.devices||[]).map(deviceCard).join('')||empty('○','Sin sesiones','Esperando señales de los dispositivos.')}</div></article></div>`;
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
    const lat=numeroCoordenadaConexion(row?.LATITUD??row?.latitud),lng=numeroCoordenadaConexion(row?.LONGITUD??row?.longitud);
    return lat!==null&&lng!==null&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180&&!(Math.abs(lat)<0.000001&&Math.abs(lng)<0.000001);
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
  function puedeEnviarAvisosConexiones(){return hasPermission('NOTIFICACIONES','CREAR')||hasPermission('ALERTAS','CREAR');}
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
    const gpsActivo=row.GPS_ACTIVO==='SI'&&Boolean(row.GPS_RECIENTE)&&coordenadasConexionValidas(row);
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
    const gpsActivo=row=>row.GPS_ACTIVO==='SI'&&Boolean(row.GPS_RECIENTE)&&coordenadasConexionValidas(row);
    return {equipos:rows.length,activos:rows.filter(row=>row.EN_LINEA).length,desconectados:rows.filter(row=>!row.EN_LINEA).length,gpsActivos:rows.filter(gpsActivo).length,sinGps:rows.filter(row=>!gpsActivo(row)).length,segundoPlano:rows.filter(row=>row.PAGINA_VISIBLE==='NO').length};
  }
  function direccionConexion(row){
    if(row.DIRECCION&&String(row.DIRECCION).trim())return String(row.DIRECCION).trim();
    if(coordenadasConexionValidas(row))return `${Number(row.LATITUD).toFixed(5)}, ${Number(row.LONGITUD).toFixed(5)}`;
    return 'Sin ubicación disponible';
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
    return `<article class="card connections-filter-card"><div class="card-header"><div><h3>Filtros administrativos</h3><p>Los filtros se aplican simultáneamente a la lista, los totales y los marcadores del mapa.</p></div><span class="status-badge">Mapa sincronizado con filtros</span></div><form id="connectionsFilterForm" class="connections-filter-form"><label class="field"><span>Desde</span><input type="date" name="FECHA_DESDE" value="${esc(f.FECHA_DESDE)}"></label><label class="field"><span>Hasta</span><input type="date" name="FECHA_HASTA" value="${esc(f.FECHA_HASTA)}"></label><label class="field"><span>Usuario</span><select name="USUARIO_ID"><option value="">Todos los usuarios</option>${users}</select></label><label class="field"><span>Conductor</span><select name="CONDUCTOR_ID"><option value="">Todos los conductores</option>${drivers}</select></label><label class="field"><span>Estado</span><select name="ESTADO"><option value="TODOS" ${f.ESTADO==='TODOS'?'selected':''}>Todos</option><option value="ACTIVOS" ${f.ESTADO==='ACTIVOS'?'selected':''}>Activos</option><option value="DESCONECTADOS" ${f.ESTADO==='DESCONECTADOS'?'selected':''}>Desconectados</option><option value="SEGUNDO_PLANO" ${f.ESTADO==='SEGUNDO_PLANO'?'selected':''}>En segundo plano</option></select></label><label class="field"><span>GPS</span><select name="GPS"><option value="TODOS" ${f.GPS==='TODOS'?'selected':''}>Todos</option><option value="ACTIVO" ${f.GPS==='ACTIVO'?'selected':''}>GPS activo</option><option value="INACTIVO" ${f.GPS==='INACTIVO'?'selected':''}>GPS inactivo</option><option value="SIN_UBICACION" ${f.GPS==='SIN_UBICACION'?'selected':''}>Sin ubicación</option></select></label><label class="field"><span>Vehículo</span><select name="VEHICULO_ID"><option value="">Todos los vehículos</option>${vehicles}</select></label><label class="field"><span>Dispositivo</span><select name="DISPOSITIVO_ID"><option value="">Todos los equipos</option>${devices}</select></label><label class="field"><span>Tipo de red</span><select name="TIPO_RED"><option value="">Todas las redes</option>${networks}</select></label><label class="field"><span>Plataforma</span><select name="PLATAFORMA"><option value="">Todas las plataformas</option>${platforms}</select></label><label class="field"><span>Precisión máxima</span><select name="PRECISION_MAXIMA"><option value="" ${!f.PRECISION_MAXIMA?'selected':''}>Cualquier precisión</option><option value="25" ${String(f.PRECISION_MAXIMA)==='25'?'selected':''}>Hasta 25 m</option><option value="50" ${String(f.PRECISION_MAXIMA)==='50'?'selected':''}>Hasta 50 m</option><option value="100" ${String(f.PRECISION_MAXIMA)==='100'?'selected':''}>Hasta 100 m</option><option value="200" ${String(f.PRECISION_MAXIMA)==='200'?'selected':''}>Hasta 200 m</option></select></label><label class="field connections-search-field"><span>Buscar en todos los campos</span><input type="search" name="BUSCAR" value="${esc(f.BUSCAR)}" placeholder="Nombre, correo, conductor, patente, dirección, IP o dispositivo…"></label><div class="form-actions"><button class="btn soft" type="button" data-connections-reset>Limpiar filtros</button><button class="btn primary" type="submit">Aplicar filtros al mapa</button></div></form></article>`;
  }
  function connectionRows(rows){
    const visibles=(rows||[]).slice(0,120);
    return visibles.map(row=>{
      const gpsValido=Boolean(row.USUARIO_ID)&&coordenadasConexionValidas(row);
      const seguido=String(row.USUARIO_ID||'')===connectionTrackedUserId;
      const control=gpsValido?`<label class="connection-follow-control"><input type="checkbox" data-connection-follow="${esc(row.USUARIO_ID)}" ${seguido?'checked':''} ${connectionTrackingSavePending?'disabled':''}><span>Seguir</span></label>`:`<span class="connection-follow-unavailable">Sin GPS válido</span>`;
      const avisar=puedeEnviarAvisosConexiones()&&row.USUARIO_ID?`<button class="btn soft small" data-connection-notice="${esc(row.USUARIO_ID)}">Avisar</button>`:'';
      return `<tr class="connection-detail-row ${seguido?'followed':''}"><td class="connection-follow-cell" data-label="Seguimiento">${control}</td><td data-label="Estado"><span class="connection-state ${row.EN_LINEA?'online':'offline'}"><i></i>${row.EN_LINEA?'Activo':'Desconectado'}</span></td><td data-label="Usuario"><strong>${esc(row.USUARIO_NOMBRE||row.USUARIO_ID)}</strong><span class="muted">${esc(row.USUARIO_CORREO||row.ROL_ID||'')}</span></td><td data-label="Equipo"><strong>${esc(row.DISPOSITIVO_ID||'Sin ID')}</strong><span class="muted">${esc(row.PLATAFORMA||'Plataforma no informada')}</span></td><td data-label="Vehículo / conductor">${esc(row.VEHICULO_PATENTE||'—')}<span class="muted">${esc(row.CONDUCTOR_NOMBRE||row.VEHICULO_NOMBRE||'')}</span></td><td data-label="Dirección"><span class="connection-address">${esc(direccionConexion(row))}</span></td><td data-label="GPS">${row.GPS_ACTIVO==='SI'&&row.GPS_RECIENTE?status('Activo'):status('Sin GPS')}<span class="muted">${row.PRECISION_METROS!==''?`±${number(row.PRECISION_METROS)} m`:'Sin posición'}</span></td><td data-label="Módulo / actividad">${esc(row.SECCION_ACTUAL||'—')}<span class="muted">${esc(row.ACTIVIDAD||'')}</span></td><td data-label="Red / batería">${esc(row.TIPO_RED||'—')}<span class="muted">${row.BATERIA_GPS!==''?`${esc(row.BATERIA_GPS)}% batería`:''}</span></td><td data-label="Última señal">${fmtDate(row.ULTIMA_CONEXION,true)}</td><td data-label="Mapa"><div class="row-button-stack">${gpsValido?`<button class="btn soft small" data-connection-focus="${row.LATITUD},${row.LONGITUD}">Ver mapa</button>`:''}${avisar||(!gpsValido?'—':'')}</div></td></tr>`;
    }).join('')||`<tr><td colspan="11">${empty('○','Sin equipos para los filtros aplicados','Cambie el período o quite filtros para ampliar la búsqueda.')}</td></tr>`;
  }
  function connectionQuickList(rows){return (rows||[]).slice(0,14).map(row=>{const seguido=String(row.USUARIO_ID||'')===connectionTrackedUserId;return `<button class="connection-quick-item ${row.EN_LINEA?'online':'offline'} ${seguido?'followed':''}" ${coordenadasConexionValidas(row)?`data-connection-focus="${row.LATITUD},${row.LONGITUD}"`:''}><i></i><span><b>${esc(row.USUARIO_NOMBRE||'Usuario')}</b><small>${esc(row.VEHICULO_PATENTE||row.DISPOSITIVO_ID||'Equipo')}</small><small class="connection-quick-address">${esc(direccionConexion(row))}</small></span><em>${seguido?'Siguiendo':(row.EN_LINEA?'Activo':'Desconectado')}</em></button>`;}).join('')||empty('○','Sin conexiones','Los equipos aparecerán cuando registren una señal.');}
  function firmaFilasConexiones(rows,limite=120){
    return `${connectionTrackedUserId}|${connectionTrackingSavePending?'1':'0'}|`+(rows||[]).slice(0,limite).map(row=>[
      row.ID||'',row.USUARIO_ID||'',row.USUARIO_NOMBRE||'',row.USUARIO_CORREO||'',row.DISPOSITIVO_ID||'',
      row.EN_LINEA?'1':'0',row.GPS_ACTIVO||'',row.GPS_RECIENTE?'1':'0',row.LATITUD??'',row.LONGITUD??'',
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
        if(Number.isFinite(lat)&&Number.isFinite(lng))mapaFlota?.establecerVista(lat,lng,16);
      });
    });
  }
  function connectionsResultsHtml(result){
    result=resumenConexionesSeguro(result);
    sincronizarSeguimientoConexionesDesdeResultado(result);
    const rows=conexionesFiltradasCliente(result),totals=totalesConexionesFiltradas(rows),visibleCount=Math.min(rows.length,120);
    const detailNote=rows.length>visibleCount?`Mostrando ${visibleCount} de ${rows.length} registros filtrados.`:`${rows.length} registro(s) en lista y mapa`;
    return `<div class="live-strip connections-live-strip"><article class="live-stat"><i>▣</i><div><span>Equipos visibles</span><b id="connectionsTotal">${totals.equipos||0}</b></div></article><article class="live-stat online"><i>●</i><div><span>Activos</span><b id="connectionsOnline">${totals.activos||0}</b></div></article><article class="live-stat warning"><i>●</i><div><span>Desconectados</span><b id="connectionsOffline">${totals.desconectados||0}</b></div></article><article class="live-stat online"><i>⌖</i><div><span>GPS activos</span><b id="connectionsGps">${totals.gpsActivos||0}</b></div></article><article class="live-stat ${(totals.sinGps||0)?'warning':''}"><i>!</i><div><span>Sin GPS</span><b id="connectionsNoGps">${totals.sinGps||0}</b></div></article></div><div class="connections-map-filter-summary"><b>Mapa filtrado</b><span id="connectionsMapFilterSummary">${rows.length} equipo(s) coinciden con los filtros actuales.</span></div>${panelSeguimientoConexion(result,rows)}${panelAvisosConexiones()}<div class="connections-dashboard-grid"><article class="card map-card" id="mapCard"><div class="card-header"><div><h3>Mapa de equipos filtrados</h3><p>Solo aparecen los mismos equipos visibles en la lista. Verde: activo · Rojo: desconectado · Rastro: usuario seguido.</p></div><button class="btn soft small" type="button" data-map-fullscreen>⛶ Pantalla completa</button></div><div class="fleet-map connections-map" id="connectionsMap"></div><small class="muted" id="connectionsLastSync">Última consulta: ${fmtDate(result.serverTime||new Date(),true)}</small></article><article class="card"><div class="card-header"><div><h3>Estado rápido</h3><p>Dirección, usuario y vehículo de los resultados filtrados.</p></div></div><div class="connections-quick-list" id="connectionsQuickList">${connectionQuickList(rows)}</div></article></div><article class="card connections-detail-card"><div class="card-header"><div><h3>Detalle de conexiones</h3><p>Marque “Seguir” para acompañar a un usuario con GPS válido o use “Avisar” para comunicarse.</p></div><span class="status-badge" id="connectionsVisibleCount">${esc(detailNote)}</span></div><div class="table-wrap connections-table-wrap"><table><thead><tr><th>Seguimiento</th><th>Estado</th><th>Usuario</th><th>Equipo</th><th>Vehículo / conductor</th><th>Dirección</th><th>GPS</th><th>Módulo / actividad</th><th>Red / batería</th><th>Última señal</th><th>Mapa / aviso</th></tr></thead><tbody id="connectionsTableBody">${connectionRows(rows)}</tbody></table></div></article>`;
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
    if(!hasPermission('CONEXIONES','LEER'))throw new Error('ACCESO_CONEXIONES_NO_AUTORIZADO');
    const tieneDatos=Boolean(ultimoResumenConexiones?.serverTime)||Boolean((ultimoResumenConexiones?.equipos||[]).length);
    programarCargaInicialConexiones();
    return tieneDatos?connectionsPageHtml(ultimoResumenConexiones):connectionsLoadingHtml();
  }
  async function cargarConexionesIniciales(){
    if(currentSection!=='connections'||!hasPermission('CONEXIONES','LEER'))return null;
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
  function paintConnectionsOnline(result,adjust=false,ligero=false){
    ultimoResumenConexiones=resumenConexionesSeguro(result||ultimoResumenConexiones);
    sincronizarSeguimientoConexionesDesdeResultado(ultimoResumenConexiones);
    const rows=conexionesFiltradasCliente(ultimoResumenConexiones),totals=totalesConexionesFiltradas(rows);
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
    const markers=rows.filter(coordenadasConexionValidas).slice(0,200).map(row=>({id:row.DISPOSITIVO_ID||row.ID,latitud:Number(row.LATITUD),longitud:Number(row.LONGITUD),nombre:`${row.USUARIO_NOMBRE||'Usuario'} · ${row.VEHICULO_PATENTE||row.DISPOSITIVO_ID||'Equipo'}`,activo:Boolean(row.EN_LINEA),seguido:String(row.USUARIO_ID||'')===connectionTrackedUserId,detalle:`<b>${esc(row.USUARIO_NOMBRE||'Usuario')}</b><span>${esc(row.CONDUCTOR_NOMBRE||'Sin conductor asociado')}</span><span>${esc(row.VEHICULO_PATENTE||row.DISPOSITIVO_ID||'Equipo')}</span><span>${esc(direccionConexion(row))}</span><span>${row.GPS_ACTIVO==='SI'?'GPS declarado activo':'GPS inactivo'} · precisión ${row.PRECISION_METROS!==''?`±${number(row.PRECISION_METROS)} m`:'sin dato'}${row.CALIDAD_GPS?` · calidad ${esc(row.CALIDAD_GPS)}`:''}</span><small>${String(row.USUARIO_ID||'')===connectionTrackedUserId?'Seguimiento activo · ':''}${row.EN_LINEA?'Activo':'Desconectado'} · ${fmtDate(row.FECHA_GPS||'',true)}</small>`}));
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
        mapaFlota?.establecerVista(Number(seguimiento.row.LATITUD),Number(seguimiento.row.LONGITUD),16);
      }
    }
    enlazarSeguimientoConexiones($('#connectionsResults')||document);
    enlazarFocoConexiones($('#connectionsResults')||document);
    enlazarAvisosConexiones($('#content')||document);
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
      script.src='mapa.js?v=4.0.6';
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
    if(promesaInicializacionMapa)return promesaInicializacionMapa;
    promesaInicializacionMapa=(async()=>{
      await asegurarComponenteMapa();
      const visible=await esperarTamanoMapa(container,60);
      if(!visible||currentSection!=='connections'||!container.isConnected)return;
      mapaFlota?.eliminar?.();
      mapaFlota=new window.MapaFlotas(container,{centro:config.CENTRO_MAPA,nivel:config.NIVEL_ACERCAMIENTO_MAPA});
      paintConnectionsOnline(ultimoResumenConexiones,true);
      requestAnimationFrame(()=>mapaFlota?.redibujar?.());
      setTimeout(()=>mapaFlota?.redibujar?.(),300);
      scheduleConnectionsRefresh();
      scheduleConnectionTrackingLive(100);
    })().catch(error=>{toast('Mapa no disponible',translateError(error),'error');}).finally(()=>{promesaInicializacionMapa=null;});
    return promesaInicializacionMapa;
  }
  function scheduleConnectionsRefresh(delay){
    if(connectionsRefreshTimer)clearTimeout(connectionsRefreshTimer);
    connectionsRefreshTimer=null;
    if(currentSection!=='connections'||!currentUser||!hasPermission('CONEXIONES','LEER'))return;
    const normal=Number(config.INTERVALO_CONEXIONES_EN_LINEA_MILISEGUNDOS||15000);
    const hidden=Number(config.INTERVALO_TIEMPO_REAL_OCULTO_MILISEGUNDOS||30000);
    const espera=Number(delay|| (document.hidden?hidden:normal));
    connectionsRefreshTimer=setTimeout(()=>refreshConnectionsOnline(false),Math.max(3000,espera));
  }

  function scheduleConnectionTrackingLive(delay){
    if(connectionTrackingLiveTimer)clearTimeout(connectionTrackingLiveTimer);
    connectionTrackingLiveTimer=null;
    if(currentSection!=='connections'||!currentUser||!connectionTrackedUserId||document.hidden||!hasPermission('CONEXIONES','LEER'))return;
    const base=Number(config.INTERVALO_SEGUIMIENTO_CONEXION_MILISEGUNDOS||1500);
    const espera=Number(delay??Math.min(10000,base*Math.pow(2,Math.min(connectionTrackingLiveFailures,3))));
    connectionTrackingLiveTimer=setTimeout(()=>refreshConnectionTrackingLive(false),Math.max(900,espera));
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

  function locationList(rows){return rows.length?rows.map(row=>{const active=antiguedadUbicacion(row.FECHA_HORA)<=config.ANTIGUEDAD_UBICACION_ACTIVA_MILISEGUNDOS;return `<button class="driver-location ${active?'active':'inactive'}" data-focus-location="${row.LATITUD},${row.LONGITUD}"><i>●</i><div><b>${esc(row.CONDUCTOR_NOMBRE||row.CONDUCTOR_ID||'Sin conductor')}</b><span>${esc(row.VEHICULO_PATENTE||row.VEHICULO_ID||'Sin vehículo')} · ${Number(row.VELOCIDAD_KMH||0).toFixed(0)} km/h · ${active?'Activo':'Inactivo'}</span><span class="address-line">${esc(row.DIRECCION||`${Number(row.LATITUD).toFixed(5)}, ${Number(row.LONGITUD).toFixed(5)}`)}</span></div><time>${fmtDate(row.FECHA_HORA,true)}</time></button>`;}).join(''):empty('⌖','Sin ubicaciones','Cuando un conductor autorice y envíe su GPS, aparecerá aquí.');}

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
    const rows=events.map(item=>`<tr data-filter-date="${esc(item.fecha||'')}" data-search-row="${esc(`${item.tipo} ${item.referencia} ${item.evento} ${item.detalle} ${item.usuario}`.toLowerCase())}"><td>${fmtDate(item.fecha,true)}</td><td>${status(item.tipo)}</td><td><strong>${esc(item.evento)}</strong><span class="muted">${esc(item.detalle)}</span></td><td>${esc(item.referencia||'—')}</td><td>${esc(item.usuario||'—')}</td></tr>`).join('');
    return heading('TRAZABILIDAD CENTRAL','Historial','Línea de tiempo unificada de operaciones, rutas, check-ins, alertas y notificaciones.',`<button class="btn soft" data-sync>↻ Sincronizar</button><button class="btn soft" data-export="history">Exportar historial operativo</button>`)+
      `<div class="live-strip">${liveStat('⇄','Operaciones',data.history.rows.length)}${liveStat('➜','Rutas',data.routes.rows.length)}${liveStat('✓','Check-ins',data.checkins.rows.length)}${liveStat('!','Alertas',data.alerts.rows.length,data.alerts.rows.some(row=>row.LEIDA!=='SI')?'warning':'')}</div>`+
      `<article class="card"><div class="toolbar"><label class="search-box"><span>⌕</span><input data-table-search placeholder="Buscar evento, referencia o usuario"></label><span class="muted push">${events.length} eventos visibles</span></div><div data-filter-table>${table(['Fecha','Origen','Evento y detalle','Referencia','Usuario'],rows,'Aún no existen eventos en el historial.')}</div></article>`;
  }
  function fechaInputIso(value){const date=value instanceof Date?value:new Date(value);if(Number.isNaN(date.getTime()))return '';const offset=date.getTimezoneOffset()*60000;return new Date(date.getTime()-offset).toISOString().slice(0,10);}
  function rangoFechaReportes(form){const startText=form?.elements.FECHA_DESDE?.value||'',endText=form?.elements.FECHA_HASTA?.value||'';return{desde:startText?new Date(`${startText}T00:00:00`):null,hasta:endText?new Date(`${endText}T23:59:59.999`):null};}
  function datosKpiFiltrados(){
    const form=$('#kpiFilterForm'),operations=cacheListasFormulario.get('operations')||[],drivers=cacheListasFormulario.get('drivers')||[],vehicles=cacheListasFormulario.get('vehicles')||[],checkins=cacheListasFormulario.get('checkins')||[],routes=cacheListasFormulario.get('routes')||[];
    const {desde,hasta}=rangoFechaReportes(form),driverId=form?.elements.CONDUCTOR_ID?.value||'',vehicleId=form?.elements.VEHICULO_ID?.value||'';
    const match=(row,dateField)=>{const date=new Date(row[dateField]||row.CREADO_EN||0);if(desde&&date<desde)return false;if(hasta&&date>hasta)return false;if(driverId&&String(row.CONDUCTOR_ID)!==String(driverId))return false;if(vehicleId&&String(row.VEHICULO_ID)!==String(vehicleId))return false;return true;};
    return{form,drivers,vehicles,operations:operations.filter(row=>match(row,'FECHA_INICIO')),checkins:checkins.filter(row=>match(row,'FECHA_HORA')),routes:routes.filter(row=>match(row,'FECHA_ASIGNACION')),driverId,vehicleId,desde,hasta};
  }
  function horasOperacion(row){const start=new Date(row.FECHA_INICIO||0),end=new Date(row.FECHA_FIN||0);if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<start)return 0;return (end-start)/3600000;}
  function rankingKpi(operations,key,map,labelField){const grouped=new Map();operations.forEach(row=>{const id=String(row[key]||'SIN-ASIGNAR'),item=grouped.get(id)||{id,total:0,km:0};item.total+=1;item.km+=Math.max(0,Number(row.DISTANCIA_KM||0));grouped.set(id,item);});return [...grouped.values()].map(item=>({...item,nombre:map[item.id]?.[labelField]||item.id})).sort((a,b)=>b.total-a.total||b.km-a.km).slice(0,6);}
  function rankingKpiMarkup(title,subtitle,rows){const max=Math.max(1,...rows.map(row=>row.total));return `<article class="card kpi-ranking-card"><div class="card-header"><div><h3>${esc(title)}</h3><p>${esc(subtitle)}</p></div></div><div class="kpi-ranking-list">${rows.map((row,index)=>`<div class="kpi-ranking-row"><span class="kpi-position">${index+1}</span><div><b>${esc(row.nombre)}</b><small>${number(row.total)} operaciones · ${number(row.km.toFixed(1))} km</small><i style="width:${Math.max(8,Math.round(row.total/max*100))}%"></i></div></div>`).join('')||empty('▥','Sin datos para el filtro','Amplíe las fechas o cambie los criterios seleccionados.')}</div></article>`;}
  function pintarKpisReportes(){
    const target=$('#kpiReportResults');if(!target)return;const data=datosKpiFiltrados(),operations=data.operations,completed=operations.filter(row=>row.ESTADO==='Finalizada'),active=operations.filter(row=>row.ESTADO==='Activa'),exceptional=completed.filter(row=>row.CIERRE_FUERA_BASE==='SI'),lowGps=completed.filter(row=>row.VALIDACION_FIN==='VALIDADA_PRECISION_BAJA'),totalKm=completed.reduce((sum,row)=>sum+Math.max(0,Number(row.DISTANCIA_KM||0)),0),durations=completed.map(horasOperacion).filter(value=>value>0),avgHours=durations.length?durations.reduce((a,b)=>a+b,0)/durations.length:0,blocked=data.checkins.filter(row=>row.ESTADO_REVISION==='Bloqueado').length;
    const driverMap=Object.fromEntries(data.drivers.map(row=>[String(row.ID),row])),vehicleMap=Object.fromEntries(data.vehicles.map(row=>[String(row.ID),row]));
    const driverRanking=rankingKpi(operations,'CONDUCTOR_ID',driverMap,'NOMBRE'),vehicleRanking=rankingKpi(operations,'VEHICULO_ID',vehicleMap,'PATENTE');
    const rows=operations.slice().sort((a,b)=>new Date(b.FECHA_INICIO||0)-new Date(a.FECHA_INICIO||0)).slice(0,30).map(row=>`<tr><td><strong>${esc(row.ID)}</strong></td><td>${esc(vehicleMap[String(row.VEHICULO_ID)]?.PATENTE||row.VEHICULO_ID||'—')}</td><td>${esc(driverMap[String(row.CONDUCTOR_ID)]?.NOMBRE||row.CONDUCTOR_ID||'—')}</td><td>${fmtDate(row.FECHA_INICIO,true)}</td><td>${number(Number(row.DISTANCIA_KM||0).toFixed(1))} km</td><td>${row.VALIDACION_FIN==='VALIDADA_PRECISION_BAJA'?status('GPS impreciso'):status(row.CIERRE_FUERA_BASE==='SI'?'Cierre excepcional':row.ESTADO)}</td></tr>`).join('');
    target.innerHTML=`<div class="kpi-filter-summary"><span><b>${number(operations.length)}</b> operaciones encontradas</span><span><b>${number(data.routes.length)}</b> rutas</span><span><b>${number(data.checkins.length)}</b> check-ins</span></div><div class="kpi-grid kpi-grid-advanced">${metric('⇄','Operaciones',operations.length,`${active.length} activas`)}${metric('✓','Finalizadas',completed.length,operations.length?`${Math.round(completed.length/operations.length*100)}% del período`:'Sin actividad')}${metric('↗','Kilómetros',number(totalKm.toFixed(1)),'Distancia registrada')}${metric('◷','Duración promedio',`${avgHours.toFixed(1)} h`,'Operaciones finalizadas')}${metric('!','Cierres excepcionales',exceptional.length,'Fuera de la base')}${metric('⌖','GPS impreciso',lowGps.length,'Cierres aceptados con trazabilidad')}${metric('☑','Check-ins bloqueados',blocked,'Requieren corrección')}${metric('➜','Rutas vinculadas',data.routes.length,'Asignaciones del período')}</div><div class="kpi-ranking-grid">${rankingKpiMarkup('Conductores con más operaciones','Ranking según el filtro actual',driverRanking)}${rankingKpiMarkup('Vehículos con mayor actividad','Cantidad de operaciones y kilómetros',vehicleRanking)}</div><article class="card"><div class="card-header"><div><h3>Detalle filtrado</h3><p>Últimas 30 operaciones que cumplen los criterios.</p></div><button class="btn soft" data-export-kpi>Exportar resultado</button></div>${table(['Operación','Vehículo','Conductor','Inicio','Distancia','Resultado'],rows,'No existen operaciones para el filtro seleccionado.')}</article>`;
    $('[data-export-kpi]',target)?.addEventListener('click',exportarKpisFiltrados);
  }
  function exportarKpisFiltrados(){const {operations}=datosKpiFiltrados();if(!operations.length)return toast('Sin datos','No hay operaciones filtradas para exportar.','error');const headers=[...new Set(operations.flatMap(Object.keys))],csv=[headers,...operations.map(row=>headers.map(key=>row[key]??''))].map(line=>line.map(value=>`"${String(value).replaceAll('"','""')}"`).join(';')).join('\n'),blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`kpi_operaciones_${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(url);toast('Reporte exportado',`${operations.length} operaciones incluidas.`);}
  async function renderReports(){
    const [operations,drivers,vehicles,checkins,routes]=await Promise.all(['operations','drivers','vehicles','checkins','routes'].map(solicitarListaSegura));if(operations.error)throw operations.error;
    guardarListaFormulario('operations',operations.rows);guardarListaFormulario('drivers',drivers.rows);guardarListaFormulario('vehicles',vehicles.rows);guardarListaFormulario('checkins',checkins.rows);guardarListaFormulario('routes',routes.rows);
    const today=new Date(),start=new Date();start.setDate(today.getDate()-30);
    return heading('INTELIGENCIA OPERACIONAL','KPIs y reportes','Analice el desempeño por período, conductor y vehículo.',`<button class="btn soft" data-sync>↻ Sincronizar</button>`)+`<article class="card kpi-filter-card"><div class="card-header"><div><h3>Filtros del análisis</h3><p>Los indicadores, rankings y exportación se actualizan al instante.</p></div></div><form id="kpiFilterForm" class="kpi-filter-form"><label class="field"><span>Desde</span><input type="date" name="FECHA_DESDE" value="${fechaInputIso(start)}"></label><label class="field"><span>Hasta</span><input type="date" name="FECHA_HASTA" value="${fechaInputIso(today)}"></label><label class="field"><span>Conductor</span><select name="CONDUCTOR_ID"><option value="">Todos los conductores</option>${drivers.rows.map(row=>`<option value="${esc(row.ID)}">${esc(row.NOMBRE||row.ID)}</option>`).join('')}</select></label><label class="field"><span>Vehículo</span><select name="VEHICULO_ID"><option value="">Todos los vehículos</option>${vehicles.rows.map(row=>`<option value="${esc(row.ID)}">${esc(row.PATENTE||row.ID)} · ${esc(`${row.MARCA||''} ${row.MODELO||''}`.trim())}</option>`).join('')}</select></label><div class="form-actions"><button class="btn soft" type="button" data-kpi-reset>Últimos 30 días</button><button class="btn primary" type="button" data-kpi-apply>Aplicar filtros</button></div></form></article><section id="kpiReportResults" aria-live="polite"></section><article class="card"><div class="card-header"><div><h3>Exportaciones generales</h3><p>Descargue las bases completas en CSV.</p></div></div><div class="kpi-export-grid">${['vehicles','drivers','operations','gps',...(hasPermission('COMBUSTIBLE','LEER')?['fuel']:[])].map(resource=>`<button class="metric-card" data-export="${resource}"><i class="metric-icon">⇩</i><div><span>Exportar</span><b style="font-size:17px">${labels[resource]||resource}</b><small>Archivo CSV completo</small></div></button>`).join('')}</div></article>`;
  }
  async function renderAudit(){const result=await api.request('list',{resource:'audit'});guardarListaFormulario('audit',result.rows||[]);const rows=(result.rows||[]).map(a=>`<tr><td>${fmtDate(a.FECHA_HORA||a.CREADO_EN,true)}</td><td>${esc(a.USUARIO_NOMBRE)}</td><td><strong>${esc(a.ACCION)}</strong></td><td>${esc(a.MODULO)}</td><td>${esc(a.IP_CLIENTE||a.IP_PUBLICA||'')}</td><td>${esc(a.DETALLE)}</td></tr>`).join('');return heading('BITÁCORA','Auditoría','Registro de las acciones realizadas en el sistema.',`<button class="btn soft" data-sync>↻ Sincronizar</button><button class="btn soft" data-export="audit">Exportar CSV</button>`)+`<article class="card">${table(['Fecha','Usuario','Acción','Módulo','IP','Detalle'],rows)}</article>`;}
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
    return heading('IDENTIDAD INSTITUCIONAL','Empresa','Administre el logotipo, los datos legales, la ubicación y las preferencias generales de la organización.',`<button class="btn soft" data-sync>↻ Sincronizar</button><span class="status ok">Configuración permanente</span>`)+
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
            <label class="field"><span>RUT</span><input name="RUT" value="${companyValue(company,'RUT')}" placeholder="76.123.456-7"></label>
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
  async function renderSettings(){
    await sincronizarPuntoOperacionDispositivo({silencioso:true});
    const remote=api.isRemote();let company=empresaConPuntoDispositivo(currentCompany||{});
    try{const result=await api.request('list',{resource:'companies'});company=seleccionarEmpresaPrincipal(result.rows||[])||company;currentCompany=company;applyBranding(company);}catch(_){ }
    const tema=window.TemaFlotas?.normalizar?.(company)||company;
    return heading('PARÁMETROS','Configuración','Defina la conexión, el modo de visualización y la identidad cromática de todo el sistema.')+
    `<div class="settings-grid"><article class="card"><div class="card-header"><div><h3>Base de datos</h3><p>Estado de la información del sistema</p></div>${status(remote?'Central conectada':'Local activa')}</div><div class="info-grid"><div class="info-item"><span>Tipo</span><b>${remote?'Base de datos central':'Base de datos local'}</b></div><div class="info-item"><span>Sincronización</span><b>${remote?'Activa entre dispositivos':'Solo en este dispositivo'}</b></div></div></article><article class="card"><div class="card-header"><div><h3>Modo de pantalla</h3><p>Preferencia individual de este dispositivo</p></div></div><div class="setting-row"><div><b>Modo oscuro</b><span>Puede cambiarlo sin modificar la paleta guardada</span></div><label class="switch"><input id="darkSwitch" type="checkbox" ${document.body.classList.contains('dark')?'checked':''}><i></i></label></div><button class="btn soft" data-nav="company">Abrir datos de empresa</button></article></div>`+
    `<section class="system-health-shell"><article class="card system-health-card"><div class="card-header"><div><h3>Diagnóstico y reparación</h3><p>Comprueba hojas, columnas, permisos y requisitos de los módulos críticos.</p></div><span class="status" id="systemHealthStatus">Sin ejecutar</span></div><div id="systemHealthResult" class="system-health-result"><div class="module-diagnostic"><i>✓</i><div><b>Herramienta de mantenimiento disponible</b><span>Ejecute el diagnóstico después de actualizar Google Apps Script. La reparación no elimina registros.</span></div></div></div><div class="form-actions"><button class="btn soft" type="button" data-diagnose-system>Revisar sistema</button>${esAdministrador()?'<button class="btn primary" type="button" data-repair-system>Reparar estructura</button>':''}</div></article></section>`+
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

  function markupConversacionOficinaVirtual(){
    return conversacionOficinaVirtual.map(message=>`<div class="office-message ${message.tipo==='usuario'?'user':'assistant'}"><i>${message.tipo==='usuario'?initials(currentUser.NOMBRE):'OV'}</i><div><b>${message.tipo==='usuario'?'Tú':'Oficina Virtual'}</b><p>${esc(message.texto||'')}</p></div></div>`).join('');
  }

  function pintarConversacionOficinaVirtual(){
    const chat=$('#officeChat');if(!chat)return;
    chat.innerHTML=markupConversacionOficinaVirtual();
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

  async function renderOficinaVirtual(){
    const data=await api.request('officeQuickStatus');
    if(!conversacionOficinaVirtual.length){
      conversacionOficinaVirtual=[{tipo:'asistente',texto:`Hola, ${currentUser.NOMBRE.split(' ')[0]}. Soy Oficina Virtual. Puedo explicarte el sistema, revisar tus pendientes y orientarte paso a paso.`}];
    }
    const canConfigure=Boolean(data.puedeConfigurar)&&esAdministrador();
    const state=String(data.estado||'PENDIENTE').toUpperCase();
    const stateLabel=state==='CRITICO'?'Requiere atención inmediata':state==='ATENCION'?'Hay aspectos por revisar':state==='PENDIENTE'?'Esperando primera revisión':'Sistema en orden';
    const suggestions=['¿Qué tengo pendiente?','¿Cómo funciona el GPS?','¿Cómo uso un QR?','Revisar estado del sistema'];
    const reviewLabel=currentUser?.ROL_ID==='ROL-CONDUCTOR'?'⚑ Informar revisión':'↻ Revisar ahora';
    return heading('ASISTENTE DEL SISTEMA','Oficina Virtual','Respuestas en español, pendientes personales, diagnóstico preventivo y reparaciones técnicas seguras.',`<button class="btn soft" type="button" data-office-review>${reviewLabel}</button>${canConfigure?'<button class="btn primary" type="button" data-office-repair>⚒ Reparación segura</button>':''}`)+
      `<section class="office-hero"><article class="card office-identity"><div class="office-avatar">OV</div><div><span>OFICINA VIRTUAL</span><h3>${esc(stateLabel)}</h3><p>Última revisión: ${data.ultimaRevision?fmtDate(data.ultimaRevision,true):'pendiente'} · ${Number(data.avisosCreados||0)} aviso(s) nuevo(s) en la última ejecución.</p></div><span class="status ${state==='CORRECTO'?'ok':state==='CRITICO'?'bad':'warn'}">${esc(state)}</span></article><article class="card office-auto-card"><div><span>MODO AUTOMÁTICO</span><h3>${data.modoAutomatico?'Activado':'Desactivado'}</h3><p>${data.modoAutomatico?'Revisa cada cinco minutos y aplica solo correcciones técnicas seguras.':'Diagnostica y alerta; las reparaciones esperan autorización.'}</p></div>${canConfigure?`<label class="switch office-auto-switch"><input type="checkbox" data-office-auto ${data.modoAutomatico?'checked':''}><i></i></label>`:'<span class="office-lock">Solo Administrador</span>'}</article></section>`+
      `<div class="office-metrics"><article class="metric-card"><i class="metric-icon">✓</i><div><span>Pendientes</span><b id="officeTotalTasks">${Number(data.totalTareas||0)}</b><small><span id="officeUrgentTasks">${Number(data.tareasUrgentes||0)}</span> urgente(s)</small></div></article>${metric('!','Problemas técnicos',Number(data.problemas||0),stateLabel)}${metric('⚒','Reparaciones',Number(data.reparaciones||0),'Última revisión')}</div>`+
      `<section class="office-layout"><article class="card office-chat-card"><div class="card-header"><div><h3>Pregúntale a Oficina Virtual</h3><p>Explica módulos y responde según tu rol y tus datos visibles.</p></div><span class="status ok">En línea</span></div><div class="office-chat" id="officeChat">${markupConversacionOficinaVirtual()}</div><div class="office-suggestions">${suggestions.map(text=>`<button type="button" data-office-suggestion="${esc(text)}">${esc(text)}</button>`).join('')}</div><form class="office-form" id="officeForm"><textarea name="MENSAJE" rows="2" maxlength="1200" required placeholder="Ejemplo: ¿Cómo hago el check-in del vehículo?"></textarea><button class="btn primary" type="submit">Enviar</button></form><p class="helper">Oficina Virtual no solicita contraseñas ni envía datos de la flota a servicios externos.</p></article>`+
      `<article class="card office-tasks-card"><div class="card-header"><div><h3>Lo que tienes por hacer</h3><p>Un solo aviso por tarea; si cambia su estado, se actualiza el mismo registro.</p></div><span class="status" id="officeTaskCount">…</span></div><div class="office-task-list" id="officeTaskList">${empty('↻','Actualizando pendientes','La pantalla ya está disponible mientras Oficina Virtual consulta únicamente los datos necesarios.')}</div></article></section>`;
  }

  async function ejecutarRevisionOficinaVirtual(button){
    try{
      const result=await api.request('officeRun',{force:true});
      invalidarListasFormulario('notifications','alerts','documents','routes','checkins');
      api.invalidate({actions:['officeQuickStatus','officeTasks','officeStatus']});
      cacheVistasModulo.delete('dashboard');cacheVistasModulo.delete('notifications');
      if(result.solicitudAdministrador)toast('Administradores informados','La solicitud quedó pendiente para validación administrativa; el Conductor no ejecutó cambios.');
      else toast('Revisión iniciada','Oficina Virtual ya está revisando el sistema en segundo plano; puedes seguir trabajando.');
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
      toast(active?'Modo automático activado':'Modo automático desactivado',active?'Oficina Virtual revisará el sistema cada cinco minutos.':'Las reparaciones volverán a requerir autorización.');
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
      conversacionOficinaVirtual.push({tipo:'asistente',texto:result.respuesta||'No pude generar una respuesta.'});
    }catch(error){conversacionOficinaVirtual.push({tipo:'asistente',texto:`No pude responder: ${translateError(error)}`});}
    pintarConversacionOficinaVirtual();
  }

  async function sincronizarSistema(button) {
    if (sincronizacionPendiente) return sincronizacionPendiente;
    const section = currentSection;
    const ejecutar = async () => {
      setSave(`Sincronizando ${labels[section]||'módulo'}…`,'saving');
      actualizarEstadoSincronizacionVisible('Consultando la base central…','syncing');
      // El primer clic debe consultar realmente el servidor. Se marca el módulo
      // como habilitado para carga y se elimina toda respuesta pendiente o cacheada
      // antes de renderizarlo, evitando que el primer clic solo prepare el estado.
      modulosSincronizadosSesion.add(section);
      api.invalidate();
      cacheVistasModulo.delete(section);
      const dependencia = dependenciaSeccion(section);
      dependencia.resources.forEach(resource => invalidarListasFormulario(resource));
      try {
        const completed = await go(section,{force:true,manualSync:true});
        if (completed === false) throw new Error('SINCRONIZACION_NO_COMPLETADA');
        if (section==='notifications'||section==='dashboard') await refreshNotificationBadge();
        setSave('Módulo sincronizado');
        actualizarEstadoSincronizacionVisible(textoActualizacionSeccion(section));
        toast('Módulo sincronizado',`${labels[section]||'La información'} fue actualizada desde la base central.`);
        return true;
      } catch (error) {
        modulosSincronizadosSesion.delete(section);
        setSave('Error al sincronizar','error');
        actualizarEstadoSincronizacionVisible('No se pudo sincronizar · pulse nuevamente para reintentar','error');
        toast('No se pudo sincronizar',translateError(error),'error');
        return false;
      }
    };
    sincronizacionPendiente = conCargaBoton(button,'Sincronizando…',ejecutar);
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
    if(hasPermission('COMBUSTIBLE','ACTUALIZAR')&&currentUser.ROL_ID!=='ROL-CONDUCTOR')buttons.push(`<button class="btn soft small" type="button" data-edit-fuel="${esc(row.ID)}">Editar</button>`);
    if(esAdministrador()&&hasPermission('COMBUSTIBLE','ELIMINAR'))buttons.push(`<button class="btn danger small" type="button" data-admin-delete-fuel="${esc(row.ID)}">Eliminar</button>`);
    else if(currentUser.ROL_ID==='ROL-SUPERVISOR'&&hasPermission('COMBUSTIBLE','ELIMINAR')){
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

  async function renderFuel(){
    const queries=[
      {key:'loads',action:'list',payload:{resource:'fuel'}},
      {key:'summary',action:'fuelSummary'},
      {key:'vehicles',action:'list',payload:{resource:'vehicles'}},
      {key:'drivers',action:'list',payload:{resource:'drivers'}},
      {key:'operations',action:'list',payload:{resource:'operations'}},
      {key:'routes',action:'list',payload:{resource:'routes'}},
    ];
    if(currentUser.ROL_ID!=='ROL-CONDUCTOR')queries.push({key:'authorizations',action:'list',payload:{resource:'fuelAuthorizations'}});
    const batch=await api.requestBatch(queries,{force:true}),loads=guardarListaFormulario('fuel',filasRespuestaLote(batch.loads)),vehicles=guardarListaFormulario('vehicles',filasRespuestaLote(batch.vehicles)),drivers=guardarListaFormulario('drivers',filasRespuestaLote(batch.drivers)),operations=guardarListaFormulario('operations',filasRespuestaLote(batch.operations)),routes=guardarListaFormulario('routes',filasRespuestaLote(batch.routes)),authorizations=guardarListaFormulario('fuelAuthorizations',filasRespuestaLote(batch.authorizations)),summary=batch.summary||{};
    const ordered=[...loads].sort((a,b)=>new Date(b.FECHA_HORA||b.CREADO_EN||0)-new Date(a.FECHA_HORA||a.CREADO_EN||0));
    const rows=ordered.map(row=>{
      const auth=fuelAuthorizationFor(row.ID,authorizations),consumption=Number(row.CONSUMO_KM_L||0)>0?`${decimal(row.CONSUMO_KM_L)} km/L`:'Sin cálculo';
      return `<tr data-filter-date="${esc(row.FECHA_HORA||row.CREADO_EN||'')}" data-search-row="${esc(`${row.ID} ${fuelName('vehicles',row.VEHICULO_ID)} ${fuelName('drivers',row.CONDUCTOR_ID)} ${row.ESTACION_SERVICIO||''} ${row.NUMERO_DOCUMENTO||''}`.toLowerCase())}"><td><strong>${fmtDate(row.FECHA_HORA,true)}</strong><small>${esc(row.ID)}</small></td><td>${esc(fuelName('vehicles',row.VEHICULO_ID))}</td><td>${esc(fuelName('drivers',row.CONDUCTOR_ID))}</td><td><strong>${decimal(row.LITROS,3)} L</strong><small>${esc(row.TIPO_COMBUSTIBLE||'')}</small></td><td>${clp(row.PRECIO_LITRO)}<small>por litro</small></td><td><strong>${clp(row.COSTO_TOTAL)}</strong></td><td>${number(row.KILOMETRAJE||0)} km<small>${Number(row.DISTANCIA_DESDE_ULTIMA_CARGA_KM||0)>0?`${decimal(row.DISTANCIA_DESDE_ULTIMA_CARGA_KM,1)} km recorridos`:'Primera referencia'}</small></td><td><strong>${consumption}</strong><small>${Number(row.CONSUMO_L_100KM||0)>0?`${decimal(row.CONSUMO_L_100KM)} L/100 km`:''}</small></td><td>${esc(row.ESTACION_SERVICIO||'—')}<small>${esc(row.MEDIO_PAGO||'')}</small></td><td><div class="fuel-actions">${fuelActionMarkup(row,auth)}</div></td></tr>`;
    }).join('');
    const pending=authorizations.filter(row=>row.ESTADO==='PENDIENTE');
    const approvals=esAdministrador()&&pending.length?`<article class="card"><div class="card-header"><div><span class="eyebrow">AUTORIZACIONES</span><h3>Eliminaciones pendientes</h3><p>El Supervisor no puede eliminar hasta que un Administrador resuelva la solicitud.</p></div>${status(`${pending.length} pendiente${pending.length===1?'':'s'}`)}</div>${table(['Solicitud','Carga','Supervisor','Motivo','Fecha','Decisión'],pending.map(row=>`<tr><td><strong>${esc(row.ID)}</strong></td><td>${esc(row.CARGA_ID)}</td><td>${esc(row.SOLICITANTE_NOMBRE||row.SOLICITADO_POR)}</td><td>${esc(row.MOTIVO)}</td><td>${fmtDate(row.FECHA_SOLICITUD,true)}</td><td><div class="fuel-actions"><button class="btn primary small" type="button" data-approve-fuel-delete="${esc(row.ID)}">Aprobar</button><button class="btn soft small" type="button" data-reject-fuel-delete="${esc(row.ID)}">Rechazar</button></div></td></tr>`).join(''))}</article>`:'';
    const supervisorRequests=currentUser.ROL_ID==='ROL-SUPERVISOR'&&authorizations.length?`<article class="card"><div class="card-header"><div><h3>Mis solicitudes de eliminación</h3><p>Seguimiento de autorizaciones administrativas.</p></div></div>${table(['Solicitud','Carga','Motivo','Estado','Respuesta','Fecha'],[...authorizations].sort((a,b)=>new Date(b.FECHA_SOLICITUD||0)-new Date(a.FECHA_SOLICITUD||0)).map(row=>`<tr><td><strong>${esc(row.ID)}</strong></td><td>${esc(row.CARGA_ID)}</td><td>${esc(row.MOTIVO)}</td><td>${status(row.ESTADO)}</td><td>${esc(row.COMENTARIO_AUTORIZACION||'—')}<small>${esc(row.AUTORIZADOR_NOMBRE||'')}</small></td><td>${fmtDate(row.FECHA_SOLICITUD,true)}</td></tr>`).join(''))}</article>`:'';
    const create=hasPermission('COMBUSTIBLE','CREAR')?`${hasPermission('QR','LEER')?'<button class="btn soft" type="button" data-open-fuel-qr>▦ Escanear QR para carga</button>':''}<button class="btn primary" type="button" data-new-fuel>＋ Informar carga</button>`:'';
    return heading('CONTROL DE GASTOS','Carga de combustible',currentUser.ROL_ID==='ROL-CONDUCTOR'?'Consulte su historial e informe las cargas realizadas para su vehículo y asignación activa.':'Registre cargas, mida el rendimiento y mantenga trazabilidad completa por vehículo y conductor.',`<a class="btn soft" href="${esc(carpetasDrive.boletasCombustible)}" target="_blank" rel="noopener">▧ Carpeta boletas</a><button class="btn soft" data-export="fuel">⇩ Exportar historial</button><button class="btn soft" data-sync>↻ Sincronizar</button>${create}`)+
      `<div class="kpi-grid">${metric('⛽','Litros acumulados',`${decimal(summary.totalLitros||0,2)} L`,`${number(summary.totalCargas||0)} cargas`)}${metric('$','Gasto acumulado',clp(summary.gastoTotal||0),`Promedio ${clp(summary.precioPromedioLitro||0)}/L`)}${metric('↗','Rendimiento promedio',`${decimal(summary.consumoPromedioKmL||0)} km/L`,`${decimal(summary.consumoPromedioL100Km||0)} L/100 km`)}${metric('▦','Mes actual',clp(summary.mesActual?.gasto||0),`${decimal(summary.mesActual?.litros||0,2)} L · ${number(summary.mesActual?.cargas||0)} cargas`)}</div>`+
      approvals+supervisorRequests+
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
    $('#modalBody').innerHTML=`<form id="fuelForm" class="form-grid">${qrObject?`<div class="tracking-notice active full"><i>▦</i><div><b>QR validado: ${esc(qrObject.PATENTE||qrObject.ID)}</b><span>${esc([qrObject.MARCA,qrObject.MODELO].filter(Boolean).join(' ')||'Vehículo identificado para la carga')}</span></div></div><input type="hidden" name="AUTORIZACION_QR" value="${esc(qrObject.AUTORIZACION_QR||'')}">`:''}<div class="tracking-notice active full"><i>↔</i><div><b>Enlace automático con la asignación</b><span>El vehículo y el conductor se completan juntos desde la operación o ruta vigente.</span></div></div>${blocked?`<div class="module-diagnostic warning full"><i>!</i><div><b>${qrObject?'El vehículo escaneado no tiene una asignación activa':'No existe una asignación activa'}</b><span>Debe iniciar una operación o asignar una ruta para este vehículo antes de registrar combustible.</span></div></div>`:''}<label class="field full"><span>Operación o ruta asignada</span><select name="VINCULO_ASIGNACION" ${admin?'':'required'}>${assignmentOptions}</select></label><input type="hidden" name="VEHICULO_ID" value="${esc(initialVehicleId)}"><input type="hidden" name="CONDUCTOR_ID" value="${esc(record?.CONDUCTOR_ID||'')}"><input type="hidden" name="OPERACION_ID" value="${esc(record?.OPERACION_ID||'')}"><input type="hidden" name="RUTA_ID" value="${esc(record?.RUTA_ID||'')}"><div class="info-item"><span>Vehículo enlazado</span><b data-fuel-linked-vehicle>${esc(fuelName('vehicles',initialVehicleId,'Pendiente de selección'))}</b></div><div class="info-item"><span>Conductor enlazado</span><b data-fuel-linked-driver>${esc(fuelName('drivers',record?.CONDUCTOR_ID,'Pendiente de selección'))}</b></div>${admin?`<div class="form-grid full ${selectedKey?'hidden':''}" data-fuel-admin-manual><label class="field"><span>Vehículo administrativo</span><select name="VEHICULO_MANUAL_ID">${fuelSelectOptions(vehicles,initialVehicleId,row=>`${row.PATENTE||row.ID} · ${row.MARCA||''} ${row.MODELO||''}`)}</select></label><label class="field"><span>Conductor administrativo</span><select name="CONDUCTOR_MANUAL_ID">${fuelSelectOptions(drivers,record?.CONDUCTOR_ID,row=>row.NOMBRE||row.RUT||row.ID)}</select></label></div>`:''}<label class="field"><span>Fecha y hora</span><input name="FECHA_HORA" type="datetime-local" value="${esc(fechaInputLocal(record?.FECHA_HORA||new Date()))}" required></label><label class="field"><span>Tipo de combustible</span><select name="TIPO_COMBUSTIBLE">${['Diésel','Gasolina 93','Gasolina 95','Gasolina 97','Gas','Otro'].map(value=>`<option ${value===(record?.TIPO_COMBUSTIBLE||'Diésel')?'selected':''}>${value}</option>`).join('')}</select></label><label class="field"><span>Litros cargados</span><input name="LITROS" type="number" min="0.001" step="0.001" value="${esc(record?.LITROS??'')}" required></label><label class="field"><span>Precio por litro</span><input name="PRECIO_LITRO" type="number" min="0" step="0.01" value="${esc(record?.PRECIO_LITRO??'')}" required></label><label class="field"><span>Kilometraje</span><input name="KILOMETRAJE" type="number" min="0" step="0.1" value="${esc(record?.KILOMETRAJE??'')}" required></label><div class="info-item full" data-fuel-total><span>Costo calculado</span><b>${clp(record?.COSTO_TOTAL||0)}</b></div><label class="field"><span>Estación de servicio</span><input name="ESTACION_SERVICIO" value="${esc(record?.ESTACION_SERVICIO||'')}"></label><label class="field"><span>Número de boleta/factura</span><input name="NUMERO_DOCUMENTO" value="${esc(record?.NUMERO_DOCUMENTO||'')}"></label><label class="field"><span>Medio de pago</span><select name="MEDIO_PAGO">${['','Efectivo','Tarjeta empresa','Tarjeta crédito','Tarjeta débito','Transferencia','Convenio'].map(value=>`<option value="${esc(value)}" ${value===(record?.MEDIO_PAGO||'')?'selected':''}>${esc(value||'Seleccione')}</option>`).join('')}</select></label><label class="field"><span>Tanque lleno</span><select name="TANQUE_LLENO"><option value="SI" ${(record?.TANQUE_LLENO||'SI')==='SI'?'selected':''}>Sí</option><option value="NO" ${record?.TANQUE_LLENO==='NO'?'selected':''}>No</option></select></label><div class="field full"><span>Foto de la boleta</span>${markupCargaDrive({campo:'COMPROBANTE_URL',url:record?.COMPROBANTE_URL||'',combustible:true})}</div><label class="field full"><span>Observaciones</span><textarea name="OBSERVACIONES">${esc(record?.OBSERVACIONES||'')}</textarea></label><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn primary" type="submit" ${blocked?'disabled':''}>Guardar carga</button></div></form>`;
    openModal();const form=$('#fuelForm'),assignment=form.elements.VINCULO_ASIGNACION,manual=$('[data-fuel-admin-manual]',form);enlazarCargaDrive(form,'fuel');
    const applyLink=()=>{const value=assignment.value,item=items.find(row=>row.key===value);if(item){form.elements.VEHICULO_ID.value=item.vehicleId||'';form.elements.CONDUCTOR_ID.value=item.driverId||'';form.elements.OPERACION_ID.value=item.operationId||'';form.elements.RUTA_ID.value=item.routeId||'';manual?.classList.add('hidden');}else if(value==='ADMIN'&&admin){manual?.classList.remove('hidden');form.elements.OPERACION_ID.value='';form.elements.RUTA_ID.value='';form.elements.VEHICULO_ID.value=form.elements.VEHICULO_MANUAL_ID.value||'';form.elements.CONDUCTOR_ID.value=form.elements.CONDUCTOR_MANUAL_ID.value||'';}else{form.elements.VEHICULO_ID.value='';form.elements.CONDUCTOR_ID.value='';form.elements.OPERACION_ID.value='';form.elements.RUTA_ID.value='';manual?.classList.add('hidden');} $('[data-fuel-linked-vehicle]',form).textContent=fuelName('vehicles',form.elements.VEHICULO_ID.value,'Pendiente de selección');$('[data-fuel-linked-driver]',form).textContent=fuelName('drivers',form.elements.CONDUCTOR_ID.value,'Pendiente de selección');const vehicle=vehicles.find(row=>String(row.ID)===String(form.elements.VEHICULO_ID.value));if(vehicle&&form.elements.KILOMETRAJE&&!form.elements.KILOMETRAJE.value)form.elements.KILOMETRAJE.value=vehicle.KILOMETRAJE||'';};
    assignment.addEventListener('change',applyLink);if(admin){form.elements.VEHICULO_MANUAL_ID?.addEventListener('change',applyLink);form.elements.CONDUCTOR_MANUAL_ID?.addEventListener('change',applyLink);}applyLink();
    const paint=()=>{$('[data-fuel-total] b',form).textContent=clp(Number(form.elements.LITROS.value||0)*Number(form.elements.PRECIO_LITRO.value||0));};form.elements.LITROS.addEventListener('input',paint);form.elements.PRECIO_LITRO.addEventListener('input',paint);$('[data-cancel-modal]',form).addEventListener('click',closeModal);form.addEventListener('submit',event=>saveFuel(event,record?.ID||''));
  }

  async function saveFuel(event,id){
    event.preventDefault();const form=event.currentTarget,button=$('button[type="submit"]',form);
    await conCargaBoton(button,form._driveUploadPromise?'Esperando boleta…':'Guardando…',async()=>{try{await esperarCargaDrive(form);const data=Object.fromEntries(new FormData(form).entries());Object.keys(data).forEach(key=>{if(data[key] instanceof File)delete data[key]});data.IP_PUBLICA=clientPublicIp;await api.request(id?'update':'create',{resource:'fuel',id,data});invalidarListasFormulario('fuel','fuelAuthorizations','vehicles');cacheVistasModulo.delete('fuel');cacheVistasModulo.delete('dashboard');closeModal();toast('Carga guardada','El consumo y el gasto fueron recalculados. Actualizando en segundo plano.');actualizarSeccionEnSegundoPlano('fuel');}catch(error){toast('No se pudo guardar',translateError(error),'error');}});
  }

  function openFuelReasonModal(chargeId,mode='request'){
    const admin=mode==='admin';$('#modalEyebrow').textContent=admin?'ELIMINACIÓN ADMINISTRATIVA':'SOLICITUD DE AUTORIZACIÓN';$('#modalTitle').textContent=admin?'Eliminar carga de combustible':'Solicitar eliminación';$('#modalBody').innerHTML=`<form id="fuelDeleteReasonForm" class="form-grid"><div class="operation-policy-fixed full"><i>!</i><div><b>${admin?'Esta acción eliminará el registro.':'Un Administrador deberá aprobar antes de que pueda eliminarse.'}</b><span>La identidad, fecha, motivo, IP y resultado quedarán en auditoría.</span></div></div><label class="field full"><span>${admin?'Motivo opcional':'Motivo'}</span><textarea name="MOTIVO" minlength="${admin?0:10}" ${admin?'':'required'} placeholder="Explique claramente por qué debe eliminarse esta carga"></textarea></label><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn danger" type="submit">${admin?'Eliminar registro':'Enviar solicitud'}</button></div></form>`;openModal();const form=$('#fuelDeleteReasonForm');$('[data-cancel-modal]',form).addEventListener('click',closeModal);form.addEventListener('submit',event=>{event.preventDefault();const button=$('button[type="submit"]',form),MOTIVO=form.elements.MOTIVO.value.trim();conCargaBoton(button,admin?'Eliminando…':'Enviando…',async()=>{try{await api.request(admin?'deleteFuel':'requestFuelDeletion',{data:{CARGA_ID:chargeId,MOTIVO,IP_PUBLICA:clientPublicIp}});invalidarListasFormulario('fuel','fuelAuthorizations','vehicles');cacheVistasModulo.delete('fuel');cacheVistasModulo.delete('dashboard');closeModal();toast(admin?'Carga eliminada':'Solicitud enviada',admin?'La eliminación quedó registrada en auditoría.':'El Administrador ya puede revisarla.');actualizarSeccionEnSegundoPlano('fuel');}catch(error){toast('No se completó la acción',translateError(error),'error');}});});
  }

  function openFuelDecisionModal(requestId,decision){
    const approve=decision==='APROBAR';$('#modalEyebrow').textContent='AUTORIZACIÓN ADMINISTRATIVA';$('#modalTitle').textContent=approve?'Aprobar eliminación':'Rechazar eliminación';$('#modalBody').innerHTML=`<form id="fuelDecisionForm" class="form-grid"><p class="helper full">${approve?'La aprobación permitirá al Supervisor solicitante ejecutar la eliminación.':'El registro de combustible se conservará.'}</p><label class="field full"><span>Comentario</span><textarea name="COMENTARIO" placeholder="Detalle de la decisión"></textarea></label><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn ${approve?'primary':'danger'}" type="submit">Confirmar ${approve?'aprobación':'rechazo'}</button></div></form>`;openModal();const form=$('#fuelDecisionForm');$('[data-cancel-modal]',form).addEventListener('click',closeModal);form.addEventListener('submit',event=>{event.preventDefault();const button=$('button[type="submit"]',form);conCargaBoton(button,'Resolviendo…',async()=>{try{await api.request('resolveFuelDeletion',{data:{SOLICITUD_ID:requestId,DECISION,COMENTARIO:form.elements.COMENTARIO.value.trim(),IP_PUBLICA:clientPublicIp}});invalidarListasFormulario('fuelAuthorizations');cacheVistasModulo.delete('fuel');closeModal();toast('Solicitud resuelta',approve?'El Supervisor ya puede ejecutar la eliminación.':'La eliminación fue rechazada.');actualizarSeccionEnSegundoPlano('fuel');}catch(error){toast('No se pudo resolver',translateError(error),'error');}});});
  }

  async function executeAuthorizedFuelDelete(chargeId,authorizationId,button){
    if(!confirm('¿Ejecutar la eliminación autorizada? El proceso quedará registrado en auditoría.'))return;
    await conCargaBoton(button,'Eliminando…',async()=>{try{await api.request('deleteFuel',{data:{CARGA_ID:chargeId,SOLICITUD_ID:authorizationId,IP_PUBLICA:clientPublicIp}});invalidarListasFormulario('fuel','fuelAuthorizations','vehicles');cacheVistasModulo.delete('fuel');cacheVistasModulo.delete('dashboard');toast('Carga eliminada','Se utilizó la autorización administrativa aprobada.');actualizarSeccionEnSegundoPlano('fuel');}catch(error){toast('No se pudo eliminar',translateError(error),'error');}});
  }

  function bindSection() {
    $$('[data-nav]').forEach(btn=>btn.addEventListener('click',()=>navigateSection(btn.dataset.nav)));
    $('[data-office-review]')?.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Revisando…',()=>ejecutarRevisionOficinaVirtual(event.currentTarget)));
    $('[data-office-repair]')?.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Reparando…',()=>repararConOficinaVirtual(event.currentTarget)));
    $('[data-office-auto]')?.addEventListener('change',event=>configurarModoAutomaticoOficinaVirtual(event.currentTarget));
    $$('[data-office-open]').forEach(btn=>btn.addEventListener('click',()=>navigateSection(btn.dataset.officeOpen)));
    $$('[data-office-suggestion]').forEach(btn=>btn.addEventListener('click',()=>enviarConsultaOficinaVirtual(btn.dataset.officeSuggestion,btn)));
    const officeForm=$('#officeForm');if(officeForm)officeForm.addEventListener('submit',event=>{event.preventDefault();const button=$('button[type="submit"]',officeForm),message=officeForm.elements.MENSAJE.value;conCargaBoton(button,'Pensando…',()=>enviarConsultaOficinaVirtual(message,button));});
    if($('#officeTaskList'))setTimeout(()=>cargarPendientesOficinaVirtual(),0);
    $('[data-new-fuel]')?.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Preparando…',()=>openFuelModal()));
    $$('[data-edit-fuel]').forEach(btn=>btn.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Preparando…',()=>openFuelModal(registroFormulario('fuel',btn.dataset.editFuel)))));
    $$('[data-request-fuel-delete]').forEach(btn=>btn.addEventListener('click',()=>openFuelReasonModal(btn.dataset.requestFuelDelete,'request')));
    $$('[data-admin-delete-fuel]').forEach(btn=>btn.addEventListener('click',()=>openFuelReasonModal(btn.dataset.adminDeleteFuel,'admin')));
    $$('[data-execute-fuel-delete]').forEach(btn=>btn.addEventListener('click',()=>executeAuthorizedFuelDelete(btn.dataset.executeFuelDelete,btn.dataset.authorization,btn)));
    $$('[data-approve-fuel-delete]').forEach(btn=>btn.addEventListener('click',()=>openFuelDecisionModal(btn.dataset.approveFuelDelete,'APROBAR')));
    $$('[data-reject-fuel-delete]').forEach(btn=>btn.addEventListener('click',()=>openFuelDecisionModal(btn.dataset.rejectFuelDelete,'RECHAZAR')));
    $$('[data-add]').forEach(btn=>btn.addEventListener('click',()=>openResourceModal(btn.dataset.add)));
    $$('[data-bulk-import]').forEach(btn=>btn.addEventListener('click',()=>openBulkImportModal(btn.dataset.bulkImport)));
    $$('[data-print-vehicle-qr]').forEach(btn=>btn.addEventListener('click',()=>conCargaBoton(btn,'Preparando QR…',async()=>{try{await openVehicleQrLabel(btn.dataset.printVehicleQr);}catch(error){toast('No se pudo preparar la etiqueta',translateError(error),'error');}})));
    $$('[data-edit]').forEach(btn=>btn.addEventListener('click',()=>{const [resource,id]=btn.dataset.edit.split(':');openResourceModal(resource,registroFormulario(resource,id),id);}));
    $$('[data-delete]').forEach(btn=>btn.addEventListener('click',()=>deleteRecord(btn.dataset.delete,btn)));
    $$('[data-export]').forEach(btn=>btn.addEventListener('click',()=>conCargaBoton(btn,'Exportando…',()=>exportResource(btn.dataset.export))));
    configurarFiltrosAvanzados();
    $$('[data-sync],[data-refresh],[data-retry]').forEach(btn=>{if(btn.dataset.syncBound==='1')return;btn.dataset.syncBound='1';btn.addEventListener('click',()=>sincronizarSistema(btn));});
    $$('[data-new-operation]').forEach(btn=>btn.addEventListener('click',()=>openOperationModal()));
    $$('[data-quick-base-setup]').forEach(btn=>btn.addEventListener('click',()=>configurarPuntoOperacionRapido(btn)));
    $$('[data-new-checkin]').forEach(btn=>btn.addEventListener('click',()=>openCheckinModal()));
    $$('[data-open-fuel-qr]').forEach(btn=>btn.addEventListener('click',()=>openQr('combustible')));
    $$('[data-open-checkin-qr]').forEach(btn=>btn.addEventListener('click',()=>openQr('checkin')));
    $('[data-focus-checkin]')?.addEventListener('click',()=>$('#checkinVisibleCard')?.scrollIntoView({behavior:'smooth',block:'start'}));
    const inlineCheckin=$('#checkinInlineForm');if(inlineCheckin)bindInlineCheckinForm(inlineCheckin);
    $$('[data-review-checkin]').forEach(btn=>btn.addEventListener('click',()=>openCheckinReviewModal(btn.dataset.reviewCheckin)));
    $$('[data-checkin-detail]').forEach(btn=>btn.addEventListener('click',()=>openCheckinDetailModal(btn.dataset.checkinDetail)));
    $$('[data-new-route]').forEach(btn=>btn.addEventListener('click',openRouteModal));
    $$('[data-route-state]').forEach(btn=>btn.addEventListener('click',()=>conCargaBoton(btn,'Actualizando…',()=>changeRouteState(btn.dataset.routeState))));
    $$('[data-route-evidence]').forEach(btn=>btn.addEventListener('click',()=>openRouteEvidenceModal(btn.dataset.routeEvidence)));
    enlazarVisoresRuta($('#content'));
    enlazarGaleriasRuta($('#content'));
    $$('[data-new-notification]').forEach(btn=>btn.addEventListener('click',openNotificationModal));
    $$('[data-read-notification]').forEach(btn=>btn.addEventListener('click',()=>conCargaBoton(btn,'Actualizando…',()=>readNotification(btn.dataset.readNotification))));
    $('[data-read-all-notifications]')?.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Actualizando…',marcarTodasNotificacionesLeidas));
    $$('[data-read-alert]').forEach(btn=>btn.addEventListener('click',()=>conCargaBoton(btn,'Actualizando…',()=>readAlert(btn.dataset.readAlert))));
    $('[data-read-all-alerts]')?.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Actualizando…',markAllAlertsRead));
    $('[data-run-alert-engine]')?.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Revisando…',()=>runAutomaticAlerts(event.currentTarget)));
    $('[data-diagnose-system]')?.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Revisando…',runSystemDiagnostic));
    $('[data-repair-system]')?.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Reparando…',repairSystem));
    $$('[data-user-permissions]').forEach(btn=>btn.addEventListener('click',()=>openUserPermissionsModal(btn.dataset.userPermissions)));
    $$('[data-whatsapp-driver]').forEach(btn=>btn.addEventListener('click',()=>openWhatsAppDriver(btn.dataset.whatsappDriver)));
    $$('[data-voice-command]').forEach(btn=>btn.addEventListener('click',iniciarComandoVoz));
    $$('[data-speak-notifications]').forEach(btn=>btn.addEventListener('click',()=>leerNotificacionesVoz()));
    $$('[data-stop-voice]').forEach(btn=>btn.addEventListener('click',detenerVoz));
    $$('[data-finish-operation]').forEach(btn=>btn.addEventListener('click',()=>finishOperation(btn.dataset.finishOperation,btn)));
    $$('[data-edit-operation-admin]').forEach(btn=>btn.addEventListener('click',()=>openAdminEditOperationModal(btn.dataset.editOperationAdmin)));
    $$('[data-delete-operation-admin]').forEach(btn=>btn.addEventListener('click',()=>openAdminDeleteOperationModal(btn.dataset.deleteOperationAdmin)));
    $$('[data-open-qr]').forEach(btn=>btn.addEventListener('click',()=>openQr('vehiculo-operacion')));
    $$('[data-refresh-locations]').forEach(btn=>btn.addEventListener('click',()=>conCargaBoton(btn,'Sincronizando…',()=>refreshLocations(true,false))));
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
    $$('[data-focus-location]').forEach(btn=>btn.addEventListener('click',()=>{const [lat,lng]=btn.dataset.focusLocation.split(',').map(Number);mapaFlota?.establecerVista(lat,lng,16);}));
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
    const kpiForm=$('#kpiFilterForm');if(kpiForm){const repaint=()=>pintarKpisReportes();kpiForm.addEventListener('change',repaint);$('[data-kpi-apply]',kpiForm)?.addEventListener('click',repaint);$('[data-kpi-reset]',kpiForm)?.addEventListener('click',()=>{const today=new Date(),start=new Date();start.setDate(today.getDate()-30);kpiForm.elements.FECHA_DESDE.value=fechaInputIso(start);kpiForm.elements.FECHA_HASTA.value=fechaInputIso(today);kpiForm.elements.CONDUCTOR_ID.value='';kpiForm.elements.VEHICULO_ID.value='';repaint();});pintarKpisReportes();}
    const operationLocationForm=$('#operationLocationForm');if(operationLocationForm){
      bindAddressAutocomplete(operationLocationForm);
      $('[data-capture-base-location]',operationLocationForm)?.addEventListener('click',event=>conCargaBoton(event.currentTarget,'Obteniendo GPS…',async()=>{try{const location=await obtenerUbicacionNavegador({aceptarRespaldo:false,maximumAgeAproximada:0});operationLocationForm.elements.PUNTO_OPERACION_LATITUD.value=location.latitud;operationLocationForm.elements.PUNTO_OPERACION_LONGITUD.value=location.longitud;const node=$('[data-settings-location-status]',operationLocationForm);if(node){node.className='operation-location-status valid';node.innerHTML=`<i>✓</i><div><b>Coordenadas capturadas</b><span>${location.latitud.toFixed(6)}, ${location.longitud.toFixed(6)} · precisión ±${Math.round(location.precision)} m</span></div>`;}toast('Ubicación capturada','Revise la dirección y guarde la configuración.');}catch(error){toast('No se obtuvo la ubicación',translateError(error),'error');}}));
      operationLocationForm.addEventListener('submit',event=>{event.preventDefault();const button=$('button[type="submit"]',operationLocationForm);conCargaBoton(button,'Guardando punto…',async()=>{try{const data=Object.fromEntries(new FormData(operationLocationForm).entries());data.VALIDAR_UBICACION_OPERACION='SI';data.IP_PUBLICA=clientPublicIp;const result=await api.request('saveOperationalPoint',{data});const devicePoint=guardarPuntoOperacionDispositivo({...result,row:result.row||data},'SERVIDOR');currentCompany={...(currentCompany||{}),...(result.row||data),...(devicePoint||{})};const savedBase=configuracionPuntoOperacion(currentCompany);if(!savedBase.configurada)throw new Error('PUNTO_OPERACION_NO_CONFIRMADO');invalidarListasFormulario('companies');['settings','operations','routes','gps'].forEach(section=>cacheVistasModulo.delete(section));toast('Punto operacional confirmado',`${savedBase.nombre} · ${savedBase.latitud.toFixed(6)}, ${savedBase.longitud.toFixed(6)} · radio de inicio ${savedBase.radioInicio} m.`);actualizarSeccionEnSegundoPlano('settings');}catch(error){toast('No se guardó el punto',translateError(error),'error');}});});
    }
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
    if(kind==='routeDrivers'){values=values.filter(row=>row.ESTADO!=='Inactivo');}
    if(kind==='routeVehicles'){placeholder='Por definir';values=values.filter(row=>row.ESTADO!=='Inactivo');}
    if(kind==='notificationDrivers'){values=values.filter(row=>row.ESTADO!=='Inactivo');}
    if(['operationVehicles','checkinVehicles'].includes(kind)){
      values=values.filter(row=>row.ESTADO==='Disponible'||String(row.ID)===selectedValue);
      const selectedRecord=registroFormulario('vehicles',selectedValue);
      if(selectedRecord&&!values.some(row=>String(row.ID)===selectedValue))values.unshift(selectedRecord);
    }
    if(['operationDrivers','checkinDrivers'].includes(kind))values=values.filter(row=>row.ESTADO==='Disponible'||String(row.ID)===selectedValue);
    const label=row=>{
      if(kind==='users')return `${row.NOMBRE||'Usuario'} · ${row.CORREO||''}`;
      if(['drivers','routeDrivers','notificationDrivers','operationDrivers','checkinDrivers'].includes(kind))return `${row.NOMBRE||'Conductor'} · ${row.RUT||''}`;
      return `${row.PATENTE||'Vehículo'} · ${row.MARCA||''} ${row.MODELO||''}`;
    };
    const emptyLabel=kind.includes('Driver')||kind==='drivers'?'No hay conductores disponibles':kind==='users'?'No hay usuarios disponibles':'No hay vehículos disponibles';
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
        if(loadError&&token===secuenciaModal&&submit){submit.disabled=true;submit.textContent='Opciones no disponibles';}
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
    const camposAsociacionDocumento=new Set(['ASOCIADO_TIPO','CONDUCTOR_ASOCIADO_ID','USUARIO_ASOCIADO_ID','ASOCIADO_ID','CORREO_ASOCIADO']);
    const controls=definition.fields.map(([name,label,type,option])=>{
      if(documentoPropio&&camposAsociacionDocumento.has(name))return '';
      const required=option===true&&!(record&&name==='CONTRASENA');const current=record?.[name]??'';let control='';
      if(type==='select'){
        const options=Array.isArray(option)?option:[];control=`<select name="${name}" ${required?'required':''}><option value="">Seleccione</option>${options.map(item=>{const value=Array.isArray(item)?item[0]:item,text=Array.isArray(item)?item[1]:item;return `<option value="${esc(value)}" ${String(current)===String(value)?'selected':''}>${esc(text)}</option>`;}).join('')}</select>`;
      }else if(resource==='documents'&&name==='DIRECCION_ARCHIVO')control=markupCargaDrive({campo:'DIRECCION_ARCHIVO',url:current});
      else if(type==='userSelect')control=selectorDinamico('users','users',name,current,false);
      else if(type==='driverSelect')control=selectorDinamico('drivers','drivers',name,current,false);
      else if(type==='vehicleSelect')control=selectorDinamico('vehicles','vehicles',name,current,true);
      else if(type==='textarea')control=`<textarea name="${name}" ${required?'required':''}>${esc(current)}</textarea>`;
      else{const value=(type==='date'&&current)?String(current).slice(0,10):current;control=`<input name="${name}" type="${type}" value="${esc(value)}" ${required?'required':''}>`;}
      const full=['DESCRIPCION','OBSERVACIONES','MENSAJE','DIRECCION_ARCHIVO'].includes(name)?'full':'';
      if(resource==='documents'&&name==='DIRECCION_ARCHIVO')return `<div class="field ${full}"><span>${label}</span>${control}</div>`;
      return `<label class="field ${full}"><span>${label}</span>${control}</label>`;
    }).join('');
    const avisoDocumentoPropio=documentoPropio?`<div class="tracking-notice active full"><i>✓</i><div><b>Documento personal asociado automáticamente</b><span>Se vinculará con su cuenta ${esc(currentUser.CORREO||'')} y, cuando exista, con su registro de conductor. Quedará pendiente de revisión y se notificará a los Administradores.</span></div></div>`:'';
    $('#modalBody').innerHTML=`<form class="form-grid" id="resourceForm">${avisoDocumentoPropio}${controls}<div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn primary" type="submit">Guardar registro</button></div></form>`;
    $('[data-cancel-modal]',$('#modalBody')).addEventListener('click',closeModal);
    const resourceForm=$('#resourceForm');resourceForm.addEventListener('submit',event=>saveResource(event,resource,record?.ID));if(resource==='documents'){enlazarCargaDrive(resourceForm,'documents');if(documentoPropio&&resourceForm.elements.ESTADO){resourceForm.elements.ESTADO.value='Pendiente de revisión';resourceForm.elements.ESTADO.disabled=true;const hidden=document.createElement('input');hidden.type='hidden';hidden.name='ESTADO';hidden.value='Pendiente de revisión';resourceForm.appendChild(hidden);}}
    if(resource==='documents'&&!documentoPropio){
      const aplicarAsociacion=()=>{
        const tipo=resourceForm.elements.ASOCIADO_TIPO?.value||'';
        const campoConductor=resourceForm.elements.CONDUCTOR_ASOCIADO_ID?.closest('.field');
        const campoUsuario=resourceForm.elements.USUARIO_ASOCIADO_ID?.closest('.field');
        const campoId=resourceForm.elements.ASOCIADO_ID?.closest('.field');
        campoConductor?.classList.toggle('hidden',tipo!=='Conductor');
        campoUsuario?.classList.toggle('hidden',tipo!=='Usuario');
        campoId?.classList.toggle('hidden',['Conductor','Usuario'].includes(tipo));
        if(tipo==='Conductor'){
          const driver=registroFormulario('drivers',resourceForm.elements.CONDUCTOR_ASOCIADO_ID?.value);
          if(driver){resourceForm.elements.ASOCIADO_ID.value=driver.ID;resourceForm.elements.CORREO_ASOCIADO.value=driver.CORREO||'';if(!resourceForm.elements.IDENTIFICACION.value)resourceForm.elements.IDENTIFICACION.value=driver.RUT||driver.CORREO||'';}
        }else if(tipo==='Usuario'){
          const user=registroFormulario('users',resourceForm.elements.USUARIO_ASOCIADO_ID?.value);
          if(user){resourceForm.elements.ASOCIADO_ID.value=user.ID;resourceForm.elements.CORREO_ASOCIADO.value=user.CORREO||'';if(!resourceForm.elements.IDENTIFICACION.value)resourceForm.elements.IDENTIFICACION.value=user.CORREO||user.ID;}
        }
      };
      resourceForm.elements.ASOCIADO_TIPO?.addEventListener('change',aplicarAsociacion);
      resourceForm.elements.CONDUCTOR_ASOCIADO_ID?.addEventListener('change',aplicarAsociacion);
      resourceForm.elements.USUARIO_ASOCIADO_ID?.addEventListener('change',aplicarAsociacion);
      setTimeout(aplicarAsociacion,0);
    }
    const resources=[];
    if(definition.fields.some(field=>field[2]==='userSelect'))resources.push('users');
    if(definition.fields.some(field=>field[2]==='driverSelect'))resources.push('drivers');
    if(definition.fields.some(field=>field[2]==='vehicleSelect'))resources.push('vehicles');
    prepararListasModal(token,resources);
  }

  function openResourceModal(resource,record=null,id='') {
    const definition=resourceFields[resource];if(!definition)return;
    $('#modalEyebrow').textContent=definition.eyebrow;
    $('#modalTitle').textContent=`${id||record?'Editar':'Nuevo'} ${definition.title.toLowerCase()}`;
    if(!record&&id)$('#modalBody').innerHTML=contenidoCargaModal('Cargando el registro…');
    const token=openModal();
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

  async function saveResource(event,resource,id){
    event.preventDefault();const form=event.currentTarget,button=$('button[type="submit"]',form);
    await conCargaBoton(button,form._driveUploadPromise?'Esperando archivo…':'Guardando…',async()=>{
      try{
        await esperarCargaDrive(form);const data=Object.fromEntries(new FormData(form).entries());Object.keys(data).forEach(key=>{if(data[key]===''||data[key] instanceof File)delete data[key]});
        setSave('Guardando…','saving');const result=await api.request(id?'update':'create',{resource,id,data});
        invalidarListasFormulario(resource);cacheVistasModulo.delete(currentSection);closeModal();
        if(resource==='documents'&&!id&&currentUser.ROL_ID==='ROL-CONDUCTOR')toast('Documento enviado','Quedó guardado y los Administradores fueron notificados para su revisión.');
        else toast('Registro guardado','La información quedó almacenada.');
        setSave('Datos guardados');actualizarSeccionEnSegundoPlano(currentSection);
      }catch(error){setSave('Error al guardar','error');toast('No se pudo guardar',translateError(error),'error');}
    });
  }

  async function deleteRecord(value,button){
    const [resource,id]=value.split(':');if(!confirm('¿Eliminar este registro? Quedará desactivado en la base de datos.'))return;
    await conCargaBoton(button,'Eliminando…',async()=>{
      try{await api.request('delete',{resource,id});invalidarListasFormulario(resource);cacheVistasModulo.delete(currentSection);toast('Registro eliminado');actualizarSeccionEnSegundoPlano(currentSection);}
      catch(error){toast('No se pudo eliminar',translateError(error),'error');}
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
      let rowDate=fechaFiltroTexto(row.dataset.filterDate);
      if(!Number.isFinite(rowDate)&&dateIndex>=0)rowDate=fechaFiltroTexto(cells[dateIndex]?.textContent);
      if(!Number.isFinite(rowDate)){
        for(const cell of cells){rowDate=fechaFiltroTexto(cell.textContent);if(Number.isFinite(rowDate))break;}
      }
      const matchFrom=!Number.isFinite(from)||(Number.isFinite(rowDate)&&rowDate>=from);
      const matchTo=!Number.isFinite(to)||(Number.isFinite(rowDate)&&rowDate<=to);
      const show=matchGeneral&&matchField&&matchFrom&&matchTo;
      row.hidden=!show;row.style.display=show?'':'none';if(show)visible++;
    });
    const count=panel?.querySelector('[data-filter-count]');if(count)count.textContent=`${visible} de ${rows.length} registros`;
  }
  function limpiarFiltrosTabla(table){
    if(!table)return;const wrap=table.closest('.table-wrap'),panel=wrap?.previousElementSibling;
    const card=table.closest('.card')||$('#content');const general=card?.querySelector('[data-table-search]');if(general)general.value='';
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
      aplicarFiltrosTabla(table);
    });
  }
  function filterTable(input){aplicarFiltrosTabla(tablaRelacionadaFiltro(input));}

  function permissionMatrixMarkup(user){
    const admin=String(user.ROL_ID||user.ROL_NOMBRE||'').toUpperCase()==='ROL-ADMIN'||String(user.ROL_NOMBRE||'').toUpperCase()==='ADMINISTRADOR';
    const modo=String(user.MODO_PERMISOS||'ROL').toUpperCase()==='PERSONALIZADO'?'PERSONALIZADO':'ROL';
    const matrizActual=normalizarMatrizPermisosUsuario(user,'MATRIZ_PERMISOS');
    const mandatory=new Set(['PANEL_PRINCIPAL:LEER','CONEXIONES:CREAR','CONEXIONES:ACTUALIZAR']);
    return `<div class="permission-help"><b>${admin?'Administrador con acceso completo':'Permisos de '+esc(user.NOMBRE)}</b><span>${admin?'Los permisos del administrador no pueden reducirse para evitar perder el control del sistema. Todos sus checkbox permanecen marcados.':'Cada casilla refleja el valor guardado en la base: marcada = true (permiso activo), vacía = false (sin permiso). La matriz se consulta nuevamente al servidor cada vez que se abre.'}</span></div><form id="userPermissionsForm" class="permission-form"><input type="hidden" name="USUARIO_ID" value="${esc(user.ID)}"><div class="permission-mode"><label><input type="radio" name="MODO_PERMISOS" value="ROL" ${modo==='ROL'||admin?'checked':''} ${admin?'disabled':''}><span>Usar permisos del rol</span></label><label><input type="radio" name="MODO_PERMISOS" value="PERSONALIZADO" ${modo==='PERSONALIZADO'&&!admin?'checked':''} ${admin?'disabled':''}><span>Personalizar permisos</span></label></div><div class="permission-boolean-legend"><span><i class="permission-legend-check">✓</i> Marcado = true</span><span><i class="permission-legend-empty"></i> Vacío = false</span></div><div class="permission-matrix ${modo==='PERSONALIZADO'&&!admin?'enabled':''}" data-permission-matrix><div class="permission-row permission-head"><b>Módulo</b>${permissionActions.map(([,label])=>`<b>${label}</b>`).join('')}</div>${permissionCatalog.map(([module,label])=>`<div class="permission-row"><span>${esc(label)}</span>${permissionActions.map(([action])=>{const value=`${module}:${action}`,required=mandatory.has(value),active=admin||required||matrizActual[value]===true;return `<label class="permission-cell" data-action-label="${esc(permissionActions.find(([clave])=>clave===action)?.[1]||action)}" title="${required?'Permiso técnico obligatorio':active?'Permiso activo (true)':'Sin permiso (false)'}"><input type="checkbox" name="PERMISOS" value="${value}" data-obligatorio="${required?'1':'0'}" data-valor-booleano="${active?'true':'false'}" aria-checked="${active?'true':'false'}" ${active?'checked':''} ${admin||required?'disabled':''}><i></i></label>`;}).join('')}</div>`).join('')}</div><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn primary" type="submit" ${admin?'disabled':''}>Guardar permisos sin cerrar sesión</button></div></form>`;
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
    $$('input[name="MODO_PERMISOS"]',form).forEach(radio=>radio.addEventListener('change',()=>{
      const personalizado=radio.value==='PERSONALIZADO'&&radio.checked;
      matrix.classList.toggle('enabled',personalizado);
      aplicarMatrizCheckboxPermisos(form,personalizado?matrizPersonalizada:matrizRol);
    }));
    form.querySelectorAll('input[name="PERMISOS"]').forEach(input=>input.addEventListener('change',()=>{
      input.dataset.valorBooleano=input.checked?'true':'false';input.setAttribute('aria-checked',input.checked?'true':'false');
    }));
    form.onsubmit=async event=>{event.preventDefault();const button=$('button[type="submit"]',form),mode=form.elements.MODO_PERMISOS.value,permissions=[...form.querySelectorAll('input[name="PERMISOS"]:checked')].map(input=>input.value);await conCargaBoton(button,'Guardando y verificando…',async()=>{try{const result=await api.request('saveUserPermissions',{data:{USUARIO_ID:userId,MODO_PERMISOS:mode,PERMISOS:permissions}});if(api.isRemote()&&result.persistenciaConfirmada!==true)throw new Error('PERMISOS_USUARIO_NO_CONFIRMADOS');api.invalidate({actions:['me','dashboard'],resources:['users','audit']});let confirmed=result.row;const verification=await api.request('get',{resource:'users',id:userId,force:true,cache:false});if(verification?.row)confirmed=verification.row;if(!confirmed?.ID)throw new Error('PERMISOS_USUARIO_NO_CONFIRMADOS');guardarRegistro('users',confirmed);cacheVistasModulo.delete('users');if(currentUser.ID===userId){currentUser=confirmed;const auth=api.getAuth();api.setAuth({...auth,user:confirmed});postParent({tipo:'flotas:modulo-listo',usuario:confirmed,seccion:currentSection});}$('#modalBody').innerHTML=permissionMatrixMarkup(confirmed);const total=Object.values(normalizarMatrizPermisosUsuario(confirmed,'MATRIZ_PERMISOS')).filter(Boolean).length;toast('Permisos guardados y visibles',`${total} checkbox activos (true). Los demás permanecen vacíos (false). Versión ${number(confirmed.VERSION_PERMISOS||0)}.`);await actualizarSeccionEnSegundoPlano('users');setTimeout(()=>closeModal(),450);}catch(error){toast('No se pudieron confirmar los permisos',translateError(error),'error');}});};
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
  async function marcarTodasNotificacionesLeidas(){const unread=notificacionesActuales().filter(item=>item.LEIDA!=='SI');if(!unread.length){hablar('No hay notificaciones pendientes.');return;}actualizarEstadoVoz('Marcando notificaciones como leídas…');for(const item of unread){await api.request('readNotification',{id:item.ID});}invalidarListasFormulario('notifications');cacheVistasModulo.delete('notifications');cacheVistasModulo.delete('dashboard');await refreshNotificationBadge();hablar(`${unread.length} notificaciones fueron marcadas como leídas.`);toast('Notificaciones actualizadas',`${unread.length} mensajes marcados como leídos.`);actualizarSeccionEnSegundoPlano('notifications');}
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
  async function subirEvidenciaRutaArchivo(route,file,statusNode){if(!file?.type?.startsWith('image/'))throw new Error('FORMATO_ARCHIVO_DRIVE_INVALIDO');if(file.size>12582912)throw new Error('ARCHIVO_DRIVE_DEMASIADO_GRANDE');statusNode.innerHTML=`<i></i><span>Optimizando ${esc(file.name)}…</span>`;const optimized=await optimizarImagenDrive(file),dataUrl=await leerArchivoDataUrl(optimized);statusNode.innerHTML=`<i></i><span>Subiendo ${esc(optimized.name)}…</span>`;return api.request('uploadDriveFile',{data:{DESTINO:'RUTA_EVIDENCIA',NOMBRE_ARCHIVO:optimized.name,TIPO_MIME:optimized.type||'image/jpeg',ARCHIVO_BASE64:dataUrl,CONTEXTO:`Ruta ${route.ID} - ${route.NOMBRE||''}`,IP_PUBLICA:clientPublicIp}});}
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
          uploaded.push({url:result.url,archivoId:result.id||extraerIdDriveCliente(result.url),nombre:result.nombre||file.name});
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
  async function runAutomaticAlerts(button){try{const result=await api.request('runAutomaticAlerts',{force:true});invalidarListasFormulario('alerts','notifications');cacheVistasModulo.delete('alerts');cacheVistasModulo.delete('dashboard');toast('Revisión automática completada',`${Number(result.creadas||0)} alerta(s) nueva(s) detectadas.`);if(currentSection==='alerts')actualizarSeccionEnSegundoPlano('alerts');}catch(error){toast('No se pudo revisar',translateError(error),'error');}}
  function openRouteModal(){
    const base=configuracionPuntoOperacion();
    $('#modalEyebrow').textContent='PLANIFICACIÓN';$('#modalTitle').textContent='Asignar nueva ruta';
    const originDefault=base.configurada?base.direccion:'';
    const originLat=base.configurada?base.latitud:'';
    const originLng=base.configurada?base.longitud:'';
    $('#modalBody').innerHTML=`<form class="form-grid" id="routeForm"><div class="operation-base-summary full"><i>➜</i><div><b>Asignación independiente del GPS</b><span>Puede crear la ruta desde cualquier lugar. La geocerca se validará únicamente cuando el conductor inicie o finalice una operación.</span></div></div><label class="field"><span>Conductor</span>${selectorDinamico('drivers','routeDrivers','CONDUCTOR_ID','',true)}</label><label class="field"><span>Vehículo</span>${selectorDinamico('vehicles','routeVehicles','VEHICULO_ID')}</label><label class="field"><span>Nombre de la ruta</span><input name="NOMBRE" placeholder="Ej. Entrega sector norte"></label><label class="field"><span>Aplicación de navegación</span><select name="PROVEEDOR_NAVEGACION"><option>Google Maps</option><option>Waze</option></select></label><label class="field full"><span>Origen planificado</span><input name="ORIGEN" value="${esc(originDefault)}" required data-address-autocomplete data-lat-target="ORIGEN_LATITUD" data-lng-target="ORIGEN_LONGITUD" placeholder="Dirección de salida planificada"><small>${base.configurada?'Se completó con la base operacional, pero puede modificarlo para esta ruta.':'Ingrese el origen de esta asignación. Esto no configura la geocerca operacional.'}</small></label><label class="field"><span>Latitud origen</span><input name="ORIGEN_LATITUD" type="number" step="any" value="${esc(originLat)}" readonly placeholder="Opcional"></label><label class="field"><span>Longitud origen</span><input name="ORIGEN_LONGITUD" type="number" step="any" value="${esc(originLng)}" readonly placeholder="Opcional"></label><label class="field full"><span>Destino de la ruta</span><input name="DESTINO" required data-address-autocomplete data-lat-target="DESTINO_LATITUD" data-lng-target="DESTINO_LONGITUD" placeholder="Comience a escribir el destino"></label><label class="field"><span>Latitud destino</span><input name="DESTINO_LATITUD" type="number" step="any" readonly placeholder="Opcional"></label><label class="field"><span>Longitud destino</span><input name="DESTINO_LONGITUD" type="number" step="any" readonly placeholder="Opcional"></label><label class="field"><span>Prioridad</span><select name="PRIORIDAD"><option>Normal</option><option selected>Alta</option><option>Urgente</option></select></label><label class="field full"><span>Instrucciones al conductor</span><textarea name="INSTRUCCIONES" placeholder="Indicaciones, horarios, contacto o restricciones"></textarea></label><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn primary" type="submit">Asignar y notificar</button></div></form>`;
    const token=openModal();bindAddressAutocomplete($('#routeForm'));$('[data-cancel-modal]',$('#modalBody')).onclick=closeModal;
    $('#routeForm').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=$('button[type="submit"]',form),data=Object.fromEntries(new FormData(form).entries());await conCargaBoton(button,'Asignando…',async()=>{try{await api.request('assignRoute',{data});invalidarListasFormulario('routes','notifications');cacheVistasModulo.delete('routes');cacheVistasModulo.delete('dashboard');closeModal();toast('Ruta asignada','La ruta fue creada sin exigir validación GPS. La geocerca se comprobará al iniciar la operación.');actualizarSeccionEnSegundoPlano('routes');}catch(error){toast('No se pudo asignar',translateError(error),'error');}});};
    prepararListasModal(token,['drivers','vehicles']);
  }
  function guardarContextoSeguimientoRuta(contexto){routeTrackingContext=contexto&&contexto.activo!==false?contexto:null;try{if(routeTrackingContext)localStorage.setItem(routeTrackingKey,JSON.stringify(routeTrackingContext));else localStorage.removeItem(routeTrackingKey);}catch(_){}}
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
    const payload={id,RUTA_ID:id,ESTADO:'Completada',data:{RUTA_ID:id,ESTADO:'Completada'}};
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
      toast(state==='En curso'?'Ruta iniciada':completada?'Ruta completada':'Ruta actualizada',
        state==='En curso'
          ? `GPS en tiempo real activado · check-in ${result.seguimiento?.CHECKIN_ID||'vigente'}${result.operacionVinculada?' · operación vinculada':''}.`
          : completada?'La ruta quedó completada, el seguimiento de esta ruta fue detenido y la notificación quedó programada.':`Nuevo estado: ${state}.`);
      actualizarSeccionEnSegundoPlano(currentSection);
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
    $('#notificationForm').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=$('button[type="submit"]',form),data=Object.fromEntries(new FormData(form).entries());await conCargaBoton(button,'Enviando…',async()=>{try{await api.request('sendNotification',{data});invalidarListasFormulario('notifications');cacheVistasModulo.delete('notifications');cacheVistasModulo.delete('dashboard');closeModal();toast('Notificación enviada','El mensaje aparecerá en la cuenta del conductor.');actualizarSeccionEnSegundoPlano('notifications');}catch(error){toast('No se pudo enviar',translateError(error),'error');}});};
    prepararListasModal(token,['drivers']);
  }
  function openConnectionsNoticeModal(usuarioPreseleccionado=''){
    if(!puedeEnviarAvisosConexiones())return toast('Acceso restringido','Su cuenta no tiene permiso para crear notificaciones ni alertas.','error');
    const preseleccion=String(usuarioPreseleccionado||'').trim();
    const opcionesServidor=ultimoResumenConexiones?.opciones?.usuarios||[];
    const opcionesEquipos=[...new Map((ultimoResumenConexiones?.equipos||[]).filter(row=>row.USUARIO_ID).map(row=>[String(row.USUARIO_ID),{ID:row.USUARIO_ID,NOMBRE:row.USUARIO_NOMBRE,CORREO:row.USUARIO_CORREO}])).values()];
    const usuarios=[...new Map([...opcionesServidor,...opcionesEquipos].filter(row=>row?.ID).map(row=>[String(row.ID),row])).values()].sort((a,b)=>String(a.NOMBRE||a.ID).localeCompare(String(b.NOMBRE||b.ID),'es'));
    const opcionesUsuarios=usuarios.map(row=>`<option value="${esc(row.ID)}" ${String(row.ID)===preseleccion?'selected':''}>${esc(row.NOMBRE||row.ID)}${row.CORREO?` · ${esc(row.CORREO)}`:''}</option>`).join('');
    const permiteNotificacion=hasPermission('NOTIFICACIONES','CREAR'),permiteAlerta=hasPermission('ALERTAS','CREAR');
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
  async function markAllAlertsRead(){if(!esAdministrador())throw new Error('SOLO_ADMINISTRADOR');const rows=deduplicarAvisos((cacheListasFormulario.get('alerts')||[]).filter(row=>row.LEIDA!=='SI'),'alert');for(const row of rows)await api.request('readAlert',{id:row.ID});invalidarListasFormulario('alerts');cacheVistasModulo.delete('alerts');cacheVistasModulo.delete('dashboard');await refreshNotificationBadge();toast('Alertas cerradas',`${rows.length} alerta(s) validada(s) por el Administrador.`);actualizarSeccionEnSegundoPlano('alerts');}
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
    data.LISTA_CODIFICADA=JSON.stringify(checkinCatalog.map(item=>({id:item.id,respuesta:form.querySelector(`input[name="checkin_${item.id}"]:checked`)?.value||'',observacion:form.querySelector(`[data-checkin-note="${item.id}"]`)?.value||''})));
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
      toast(state==='Bloqueado'?'Salida bloqueada':'Check-in guardado y visible',`${isCentral?'Base central confirmada':'Almacenamiento local'} · ${confirmado.ID}. ${state==='Aprobado'?'La inspección quedó aprobada y vigente durante el día para este vehículo y conductor.':state==='Pendiente'?'Un supervisor debe revisar las observaciones antes de iniciar.':'Se detectaron fallas críticas.'}`,state==='Bloqueado'?'error':'success');
      form.dataset.solicitudClienteId='';
      const pendiente=leerJsonLocal(pendingRouteCheckinKey);if(state==='Aprobado'&&pendiente?.RUTA_ID&&String(pendiente.VEHICULO_ID||'')===String(confirmado?.VEHICULO_ID||'')&&String(pendiente.CONDUCTOR_ID||'')===String(confirmado?.CONDUCTOR_ID||'')){try{localStorage.removeItem(pendingRouteCheckinKey);}catch(_){}setTimeout(async()=>{navigateSection('routes');try{await iniciarRutaConSeguimiento(pendiente.RUTA_ID);toast('Ruta iniciada','Check-in diario confirmado y GPS de ruta activado.');invalidarListasFormulario('routes','operations','checkins');cacheVistasModulo.delete('routes');}catch(e){toast('Check-in guardado',translateError(e),'error');}},350);}
    }catch(error){
      const code=String(error?.message||error||'');
      const detail=code.includes('CHECKIN_NO_CONFIRMADO')?'El servidor respondió, pero no confirmó el registro en la tabla CHECKINS de PostgreSQL. Recargue antes de intentar nuevamente para evitar duplicados.':translateError(error);
      toast('No se pudo confirmar el guardado',detail,'error');
    }});
  }

  function bindInlineCheckinForm(form) {
    form.addEventListener('change',()=>updateInlineCheckinProgress(form));
    form.elements.VEHICULO_ID?.addEventListener('change',()=>{if(form.dataset.qrVehicleId&&String(form.elements.VEHICULO_ID.value)!==String(form.dataset.qrVehicleId)){form.dataset.qrVehicleId='';if(form.elements.AUTORIZACION_QR)form.elements.AUTORIZACION_QR.value='';$('[data-checkin-qr-notice]',form)?.classList.add('hidden');}});
    form.querySelector('[data-checkin-all-ok]')?.addEventListener('click',()=>{checkinCatalog.forEach(item=>{const input=form.querySelector(`input[name="checkin_${item.id}"][value="OK"]`);if(input)input.checked=true;});updateInlineCheckinProgress(form);});
    form.querySelector('[data-checkin-clear]')?.addEventListener('click',()=>{form.querySelectorAll('input[type="radio"]').forEach(input=>input.checked=false);form.querySelectorAll('[data-checkin-note]').forEach(input=>{input.value='';input.required=false;});updateInlineCheckinProgress(form);});
    form.addEventListener('submit',event=>{event.preventDefault();submitInlineCheckin(form);});
    updateInlineCheckinProgress(form);
  }

  function aplicarVehiculoQrCheckin(vehicle) {
    const form=$('#checkinInlineForm');
    if(!form){openCheckinModal(vehicle);return;}
    const select=form.elements.VEHICULO_ID;
    if(select&&!Array.from(select.options).some(option=>String(option.value)===String(vehicle.ID))){
      select.add(new Option(`${vehicle.PATENTE||vehicle.ID} · ${vehicle.MARCA||''} ${vehicle.MODELO||''}`.trim(),vehicle.ID));
    }
    form.dataset.qrVehicleId=vehicle.ID;
    if(select){select.value=vehicle.ID;select.dataset.selected=vehicle.ID;select.dispatchEvent(new Event('change',{bubbles:true}));}
    if(form.elements.AUTORIZACION_QR)form.elements.AUTORIZACION_QR.value=vehicle.AUTORIZACION_QR||'';
    if(form.elements.KILOMETRAJE&&!form.elements.KILOMETRAJE.value&&vehicle.KILOMETRAJE!==''&&vehicle.KILOMETRAJE!=null)form.elements.KILOMETRAJE.value=vehicle.KILOMETRAJE;
    const notice=$('[data-checkin-qr-notice]',form);
    if(notice){notice.classList.remove('hidden');notice.innerHTML=`<i>▦</i><div><b>QR validado: ${esc(vehicle.PATENTE||vehicle.ID)}</b><span>${esc([vehicle.MARCA,vehicle.MODELO].filter(Boolean).join(' ')||'Vehículo seleccionado para la revisión')}</span></div>`;}
    form.scrollIntoView({behavior:'smooth',block:'start'});
    setTimeout(()=>form.elements.KILOMETRAJE?.focus(),350);
  }

  function checkinItemsMarkup() {
    const groups={};checkinCatalog.forEach(item=>(groups[item.categoria]||(groups[item.categoria]=[])).push(item));
    return Object.entries(groups).map(([category,items])=>`<fieldset class="checkin-group full"><legend>${esc(category)}</legend>${items.map(item=>`<div class="checkin-item"><div class="checkin-item-copy"><b>${esc(item.item)}</b><span class="${item.critico?'critical-label':''}">${item.critico?'Crítico · No admite N/A':'Control complementario'}</span></div><label><span>Resultado</span><select data-checkin-item="${esc(item.id)}" required><option value="">Seleccione</option><option value="OK">✓ Conforme</option><option value="FALLA">! Falla</option>${item.critico?'':'<option value="NA">— No aplica</option>'}</select></label><label class="checkin-observation"><span>Observación</span><input data-checkin-note="${esc(item.id)}" placeholder="Detalle opcional"></label></div>`).join('')}</fieldset>`).join('');
  }
  function openCheckinModal(prefillVehicle=null) {
    const qrVehicle=prefillVehicle&&typeof prefillVehicle==='object'?prefillVehicle:null,selectedVehicle=qrVehicle?.ID||'';
    if(qrVehicle)guardarRegistro('vehicles',qrVehicle);
    $('#modalEyebrow').textContent='SEGURIDAD PREOPERACIONAL';$('#modalTitle').textContent='Realizar check-in vehicular';
    $('#modalBody').innerHTML=`<form class="form-grid checkin-form" id="checkinForm">${qrVehicle?`<div class="tracking-notice active full"><i>▦</i><div><b>QR validado: ${esc(qrVehicle.PATENTE||qrVehicle.ID)}</b><span>${esc([qrVehicle.MARCA,qrVehicle.MODELO].filter(Boolean).join(' ')||'Vehículo seleccionado para la revisión')}</span></div></div><input type="hidden" name="AUTORIZACION_QR" value="${esc(qrVehicle.AUTORIZACION_QR||'')}">`:''}<div class="tracking-notice active full"><i>✓</i><div><b>Inspección obligatoria antes de la operación</b><span>Complete los 16 controles. Las fallas críticas bloquean el inicio.</span></div></div><label class="field"><span>Vehículo</span>${selectorDinamico('vehicles','checkinVehicles','VEHICULO_ID',selectedVehicle,true)}</label><label class="field"><span>Conductor</span>${selectorDinamico('drivers','checkinDrivers','CONDUCTOR_ID',currentUser.CONDUCTOR_ID||'',true)}</label><label class="field"><span>Kilometraje actual</span><input name="KILOMETRAJE" type="number" min="0" value="${esc(qrVehicle?.KILOMETRAJE??'')}" required inputmode="numeric"></label><label class="field"><span>Nivel de combustible/carga</span><select name="NIVEL_COMBUSTIBLE" required><option value="">Seleccione</option><option>Vacío / crítico</option><option>1/4</option><option>1/2</option><option>3/4</option><option>Lleno</option><option>No aplica</option></select></label>${checkinItemsMarkup()}<label class="field full"><span>Observaciones generales</span><textarea name="OBSERVACIONES" placeholder="Indique ruidos, daños, testigos del tablero u otras condiciones"></textarea></label><label class="field full"><span>Nombre o firma del conductor</span><input name="FIRMA_CONDUCTOR" value="${esc(currentUser.NOMBRE||'')}" required></label><label class="checkin-confirm full"><input type="checkbox" name="CONFIRMACION_CONDUCTOR" value="SI" required><span>Confirmo que realicé personalmente esta inspección y que la información es correcta.</span></label><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn primary" type="submit">Guardar y evaluar check-in</button></div></form>`;
    const token=openModal();$('[data-cancel-modal]',$('#modalBody')).onclick=closeModal;prepararListasModal(token,['vehicles','drivers']);
    $('#checkinForm').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=$('button[type="submit"]',form),data=Object.fromEntries(new FormData(form).entries());const list=checkinCatalog.map(item=>({id:item.id,respuesta:$(`[data-checkin-item="${item.id}"]`,form)?.value||'',observacion:$(`[data-checkin-note="${item.id}"]`,form)?.value||''}));data.LISTA_CODIFICADA=JSON.stringify(list);await conCargaBoton(button,'Evaluando…',async()=>{try{const result=await api.request('createVehicleCheckin',{data});const persistencia=result.persistencia||(api.isRemote()?'CENTRAL_CONFIRMADA':'LOCAL');guardarReciboCheckin(result.row,persistencia);const confirmado=await confirmarCheckinVisible(result.row);guardarReciboCheckin(confirmado,persistencia);closeModal();const state=confirmado?.ESTADO_REVISION||'Registrado';toast(state==='Bloqueado'?'Salida bloqueada':'Check-in guardado y visible',state==='Aprobado'?'La inspección quedó aprobada y vigente durante el día para este vehículo y conductor.':state==='Pendiente'?'Un supervisor debe revisar las observaciones antes de iniciar.':'Se detectaron fallas críticas. Corríjalas y realice un nuevo check-in.',state==='Bloqueado'?'error':'success');const pendiente=leerJsonLocal(pendingRouteCheckinKey);if(state==='Aprobado'&&pendiente?.RUTA_ID&&String(pendiente.VEHICULO_ID||'')===String(confirmado?.VEHICULO_ID||'')&&String(pendiente.CONDUCTOR_ID||'')===String(confirmado?.CONDUCTOR_ID||'')){try{localStorage.removeItem(pendingRouteCheckinKey);}catch(_){}setTimeout(async()=>{navigateSection('routes');try{await iniciarRutaConSeguimiento(pendiente.RUTA_ID);toast('Ruta iniciada','Check-in diario confirmado y GPS de ruta activado.');invalidarListasFormulario('routes','operations','checkins');cacheVistasModulo.delete('routes');}catch(e){toast('Check-in guardado',translateError(e),'error');}},350);}}catch(error){toast('No se pudo guardar el check-in',translateError(error),'error');}});};
  }
  function checkinDetailMarkup(row) {
    const vehicle=registroFormulario('vehicles',row.VEHICULO_ID),driver=registroFormulario('drivers',row.CONDUCTOR_ID),items=parseCheckinItems(row);
    return `<div class="checkin-detail"><div class="info-grid"><div class="info-item"><span>Check-in</span><b>${esc(row.ID)}</b></div><div class="info-item"><span>Estado</span><b>${status(checkinVisualState(row))}</b></div><div class="info-item"><span>Vehículo</span><b>${esc(vehicle?.PATENTE||row.VEHICULO_ID)}</b></div><div class="info-item"><span>Conductor</span><b>${esc(driver?.NOMBRE||row.CONDUCTOR_ID)}</b></div><div class="info-item"><span>Fecha</span><b>${fmtDate(row.FECHA_HORA,true)}</b></div><div class="info-item"><span>Vigencia</span><b>${fmtDate(row.VIGENTE_HASTA,true)}</b></div><div class="info-item"><span>Kilometraje</span><b>${number(row.KILOMETRAJE)} km</b></div><div class="info-item"><span>Combustible/carga</span><b>${esc(row.NIVEL_COMBUSTIBLE||'—')}</b></div></div><div class="checkin-detail-list">${items.map(item=>`<article class="${item.respuesta==='FALLA'?'failed':''}"><i>${item.respuesta==='OK'?'✓':item.respuesta==='NA'?'—':'!'}</i><div><b>${esc(item.item)}</b><span>${esc(item.categoria)} · ${item.critico?'Crítico':'Complementario'}</span>${item.observacion?`<small>${esc(item.observacion)}</small>`:''}</div>${status(item.respuesta)}</article>`).join('')}</div>${row.OBSERVACIONES?`<div class="checkin-comment"><b>Observaciones generales</b><p>${esc(row.OBSERVACIONES)}</p></div>`:''}${row.COMENTARIO_REVISION?`<div class="checkin-comment"><b>Comentario de revisión</b><p>${esc(row.COMENTARIO_REVISION)}</p></div>`:''}<div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cerrar</button></div></div>`;
  }
  function openCheckinDetailModal(id) {
    const row=registroFormulario('checkins',id);$('#modalEyebrow').textContent='DETALLE DE INSPECCIÓN';$('#modalTitle').textContent=id;$('#modalBody').innerHTML=row?checkinDetailMarkup(row):contenidoCargaModal('Cargando check-in…');const token=openModal();
    const bind=()=>{const close=$('[data-cancel-modal]',$('#modalBody'));if(close)close.onclick=closeModal;};
    if(row){bind();return;}
    api.request('get',{resource:'checkins',id}).then(result=>{if(token!==secuenciaModal)return;guardarRegistro('checkins',result.row);$('#modalBody').innerHTML=checkinDetailMarkup(result.row);bind();}).catch(error=>{if(token!==secuenciaModal)return;$('#modalBody').innerHTML=`<div class="modal-error"><b>No se pudo cargar el check-in</b><p>${esc(translateError(error))}</p><button class="btn soft" data-cancel-modal>Cerrar</button></div>`;bind();});
  }
  function openCheckinReviewModal(id) {
    const row=registroFormulario('checkins',id);if(!row){openCheckinDetailModal(id);return;}
    $('#modalEyebrow').textContent='APROBACIÓN DE SEGURIDAD';$('#modalTitle').textContent=`Revisar ${id}`;
    $('#modalBody').innerHTML=`<div class="checkin-review">${checkinDetailMarkup(row).replace(/<div class="form-actions">[\s\S]*?<\/div><\/div>$/,'')}</div><label class="field"><span>Comentario del supervisor</span><textarea id="checkinReviewComment" required placeholder="Indique la decisión y las medidas necesarias"></textarea></label><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn danger" type="button" data-checkin-decision="RECHAZAR">Rechazar</button>${Number(row.FALLAS_CRITICAS||0)===0?'<button class="btn primary" type="button" data-checkin-decision="APROBAR">Aprobar check-in</button>':''}</div></div>`;
    openModal();$('[data-cancel-modal]',$('#modalBody')).onclick=closeModal;$$('[data-checkin-decision]',$('#modalBody')).forEach(button=>button.onclick=()=>conCargaBoton(button,button.dataset.checkinDecision==='APROBAR'?'Aprobando…':'Rechazando…',async()=>{const comment=$('#checkinReviewComment').value.trim();if(!comment){toast('Comentario requerido','Explique la decisión tomada.','error');return;}try{await api.request('reviewVehicleCheckin',{id,data:{CHECKIN_ID:id,DECISION:button.dataset.checkinDecision,COMENTARIO_REVISION:comment}});invalidarListasFormulario('checkins','notifications');['checkin','checkinApprovals','checkinHistory','operations','dashboard'].forEach(section=>cacheVistasModulo.delete(section));closeModal();toast('Check-in revisado',button.dataset.checkinDecision==='APROBAR'?'La operación puede iniciarse mientras la inspección esté vigente.':'El conductor deberá corregir y realizar un check-in nuevo.');actualizarSeccionEnSegundoPlano(currentSection);}catch(error){toast('No se pudo revisar',translateError(error),'error');}}));
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
    if(!base.configurada){$('#modalEyebrow').textContent='CONFIGURACIÓN INICIAL';$('#modalTitle').textContent='Definir punto operacional';$('#modalBody').innerHTML=`<div class="modal-error operational-setup"><b>La base todavía no está confirmada</b><p>El punto operacional se utiliza únicamente para validar el inicio y el regreso. Un Administrador o Supervisor puede configurarlo ahora usando la ubicación actual del dispositivo.</p><div class="operation-policy-fixed"><i>⌖</i><div><b>Debe ejecutar este paso estando físicamente en la base</b><span>El sistema guardará las coordenadas y permitirá iniciar la operación inmediatamente.</span></div></div><div class="form-actions"><button class="btn soft" data-cancel-modal>Cerrar</button>${puedeAdministrarPuntoOperacion()?'<button class="btn soft" data-go-operation-settings>Configuración avanzada</button><button class="btn primary" data-setup-base-now>⌖ Usar ubicación actual y continuar</button>':''}</div></div>`;openModal();$('[data-cancel-modal]',$('#modalBody')).onclick=closeModal;$('[data-go-operation-settings]',$('#modalBody'))?.addEventListener('click',()=>{closeModal();navigateSection('settings');});$('[data-setup-base-now]',$('#modalBody'))?.addEventListener('click',event=>configurarPuntoOperacionRapido(event.currentTarget,{reabrirOperacion:true,prefillVehicle}).catch(error=>toast('No se configuró la base',translateError(error),'error')));return;}
    const prefillObject=typeof prefillVehicle==='object'&&prefillVehicle?prefillVehicle:null,prefillId=prefillObject?.ID||String(prefillVehicle||'');if(prefillObject)guardarRegistro('vehicles',prefillObject);
    $('#modalEyebrow').textContent='OPERACIÓN GEOVALIDADA';$('#modalTitle').textContent='Iniciar nueva operación';
    $('#modalBody').innerHTML=`<form class="form-grid" id="operationForm">${prefillObject?`<div class="tracking-notice active full"><i>✓</i><div><b>QR validado: ${esc(prefillObject.PATENTE)}</b><span>${esc(prefillObject.MARCA||'')} ${esc(prefillObject.MODELO||'')}</span></div></div><input type="hidden" name="AUTORIZACION_QR" value="${esc(prefillObject.AUTORIZACION_QR||'')}">`:''}<div class="operation-base-summary full"><i>⌖</i><div><b>${esc(base.nombre)}</b><span>${esc(base.direccion)} · inicio permitido en un radio de ${number(base.radioInicio)} m</span></div></div><div class="operation-checkin-required full"><i>✓</i><div><b>Check-in preoperacional obligatorio</b><span>Se reutiliza la inspección aprobada del día para el mismo vehículo y conductor.</span></div><button class="btn soft small" type="button" data-nav-checkin>Realizar check-in</button></div><label class="field"><span>Vehículo</span>${selectorDinamico('vehicles','operationVehicles','VEHICULO_ID',prefillId,true)}</label><label class="field"><span>Conductor</span>${selectorDinamico('drivers','operationDrivers','CONDUCTOR_ID',currentUser.CONDUCTOR_ID||'',true)}</label><label class="field full"><span>Check-in aprobado</span><select name="CHECKIN_ID" required disabled><option value="">Seleccione primero vehículo y conductor</option></select></label><label class="field full"><span>Ruta asignada</span><select name="RUTA_ID"><option value="">Sin ruta asignada · salida y regreso a base</option></select><small data-operation-type>Salida y regreso al mismo punto base</small></label><label class="field"><span>Origen obligatorio</span><input name="ORIGEN" value="${esc(base.direccion)}" readonly></label><label class="field"><span>Destino operacional</span><input name="DESTINO" value="${esc(base.direccion)}" readonly></label><label class="field"><span>KM inicial <small>(opcional)</small></span><input name="KM_INICIO" type="number" min="0" step="0.1" placeholder="Puede completarse después"><small>No bloquea el inicio ni la finalización.</small></label><label class="field full"><span>Observaciones</span><textarea name="OBSERVACIONES"></textarea></label><input type="hidden" name="INICIO_LATITUD"><input type="hidden" name="INICIO_LONGITUD"><input type="hidden" name="INICIO_PRECISION"><div class="operation-location-status full" data-operation-location-status><i>⌖</i><div><b>Ubicación aún no validada</b><span>Pulse Capturar ubicación. El sistema registrará dónde se encuentra y permitirá iniciar.</span></div></div><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn soft" type="button" data-capture-operation-location>⌖ Capturar ubicación</button><button class="btn primary" type="submit">Iniciar operación</button></div></form>`;
    const token=openModal(),form=$('#operationForm');$('[data-cancel-modal]',$('#modalBody')).onclick=closeModal;$('[data-nav-checkin]',form).onclick=()=>{closeModal();navigateSection('checkin');};
    const updateDependencies=()=>{refreshOperationCheckins(form);rutasDisponiblesOperacion(form);};['VEHICULO_ID','CONDUCTOR_ID'].forEach(name=>form.elements[name]?.addEventListener('change',updateDependencies));form.elements.RUTA_ID?.addEventListener('change',()=>actualizarDestinoOperacion(form));
    $('[data-capture-operation-location]',form).onclick=event=>conCargaBoton(event.currentTarget,'Capturando ubicación…',async()=>{try{await capturarUbicacionFormularioOperacion(form,'INICIO');}catch(error){toast('No se pudo capturar la ubicación',translateError(error),'error');}});
    form.onsubmit=async event=>{event.preventDefault();const button=$('button[type="submit"]',form);await conCargaBoton(button,'Capturando e iniciando…',async()=>{try{let locationResult=null;if(!form.elements.INICIO_LATITUD.value)locationResult=await capturarUbicacionFormularioOperacion(form,'INICIO');else locationResult=resumenValidacionLocalUbicacion({latitud:Number(form.elements.INICIO_LATITUD.value),longitud:Number(form.elements.INICIO_LONGITUD.value),precision:Number(form.elements.INICIO_PRECISION.value),fuente:'Ubicación ya capturada'},base,'INICIO');const data=Object.fromEntries(new FormData(form).entries()),result=await api.request('startOperation',{data});if(result.seguimiento?.activo)await activarSeguimientoRutaCliente(result.seguimiento);invalidarListasFormulario('operations','vehicles','drivers','history','checkins','routes');['operations','dashboard','checkin','checkinHistory','routes'].forEach(section=>cacheVistasModulo.delete(section));closeModal();const validation=result.locationValidation||{},outside=validation.DENTRO_PERIMETRO===false||locationResult.dentroPerimetro===false;toast('Operación iniciada',`Ubicación capturada a ${Math.round(validation.DISTANCIA_METROS??locationResult.distancia)} m de la base${outside?' · inicio fuera de base registrado':''}. Actualizando en segundo plano.`,outside?'warning':'success');actualizarSeccionEnSegundoPlano('operations');}catch(error){toast('No se pudo iniciar',translateError(error),'error');}});};
    prepararListasModal(token,['vehicles','drivers','routes']);
    actualizarSelectoresModal(token);
    updateDependencies();
  }
  function openAdminEditOperationModal(id){
    if(!esAdministrador())return toast('Acceso restringido','Solo el Administrador puede editar operaciones.','error');
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
    if(!esAdministrador())return toast('Acceso restringido','Solo el Administrador puede eliminar operaciones.','error');const operation=registroFormulario('operations',id)||(cacheListasFormulario.get('operations')||[]).find(row=>String(row.ID)===String(id));if(!operation)return toast('Operación no encontrada','Sincronice e intente nuevamente.','error');
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
      ${privileged?`<div class="exceptional-close-panel full"><label class="switch-line"><input type="checkbox" name="CIERRE_EXCEPCIONAL" value="SI" data-exceptional-close><span><b>Autorizar cierre excepcional fuera de la base</b><small>Solo Administrador o Supervisor. Se registrarán GPS, distancia, usuario, IP, fecha y motivo.</small></span></label><label class="field full" data-exceptional-reason hidden><span>Motivo obligatorio del cierre excepcional</span><textarea name="CIERRE_MOTIVO" minlength="10" placeholder="Explique por qué la operación debe cerrarse fuera de la base"></textarea></label></div>`:''}
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
      if(result.seguimiento&&result.seguimiento.RUTA_ID)detenerSeguimientoRutaCliente(result.seguimiento.RUTA_ID);
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
    ultimoResumenGps=result||ultimoResumenGps;
    const filas=ultimoResumenGps.locations||[];
    const marcadores=filas.map(row=>{const latitud=Number(row.LATITUD),longitud=Number(row.LONGITUD);if(!Number.isFinite(latitud)||!Number.isFinite(longitud))return null;const activo=antiguedadUbicacion(row.FECHA_HORA)<=config.ANTIGUEDAD_UBICACION_ACTIVA_MILISEGUNDOS;const nombre=row.CONDUCTOR_NOMBRE||row.CONDUCTOR_ID||'Conductor',vehiculo=row.VEHICULO_PATENTE||row.VEHICULO_ID||'Sin vehículo';return{id:row.VEHICULO_ID||row.CONDUCTOR_ID||row.ID,latitud,longitud,nombre:`${vehiculo} · ${nombre}`,activo,detalle:`<b>${esc(vehiculo)}</b><span>${esc(nombre)}</span><span>${esc(row.DIRECCION||`${latitud.toFixed(5)}, ${longitud.toFixed(5)}`)}</span><span>${Number(row.VELOCIDAD_KMH||0).toFixed(0)} km/h</span><small>${activo?'Activo · Ubicación reciente':'Inactivo · Sin actualización reciente'} · ${fmtDate(row.FECHA_HORA,true)}</small>`};}).filter(Boolean);
    const base=configuracionPuntoOperacion();if(base.configurada)marcadores.unshift({id:'PUNTO-OPERACIONAL',latitud:base.latitud,longitud:base.longitud,nombre:`Base · ${base.nombre}`,activo:true,detalle:`<b>${esc(base.nombre)}</b><span>${esc(base.direccion)}</span><span>Inicio ${number(base.radioInicio)} m · cierre ${number(base.radioFin)} m</span><small>Punto operacional configurado</small>`});
    const circulosBase=base.configurada?(base.radioInicio===base.radioFin?[{id:'BASE',latitud:base.latitud,longitud:base.longitud,radio:base.radioInicio,clase:'operacional',etiqueta:`Base autorizada · ${number(base.radioInicio)} m`}]:[{id:'BASE-INICIO',latitud:base.latitud,longitud:base.longitud,radio:base.radioInicio,clase:'inicio',etiqueta:`Inicio · ${number(base.radioInicio)} m`},{id:'BASE-FIN',latitud:base.latitud,longitud:base.longitud,radio:base.radioFin,clase:'fin',etiqueta:`Finalización · ${number(base.radioFin)} m`}]) : [];
    mapaFlota?.actualizarCirculos?.(circulosBase);
    mapaFlota?.actualizarMarcadores(marcadores,ajustar);
    const locationKey=filas.map(row=>`${row.ID||''}:${row.FECHA_HORA||''}:${row.LATITUD||''}:${row.LONGITUD||''}:${row.VELOCIDAD_KMH||''}:${row.DIRECCION||''}`).join('|');
    const list=$('#driverLocationList');if(list&&locationKey!==gpsLocationsPaintKey){gpsLocationsPaintKey=locationKey;list.innerHTML=locationList(filas);const count=$('#locationCount');if(count)count.textContent=visibleVehiclesLabel(filas.length);$$('[data-focus-location]',list).forEach(btn=>btn.onclick=()=>{const[lat,lng]=btn.dataset.focusLocation.split(',').map(Number);mapaFlota?.establecerVista(lat,lng,16);});}
    const deviceRows=ultimoResumenGps.devices||[];const deviceKey=deviceRows.map(row=>`${row.ID||''}:${row.ULTIMA_CONEXION||''}:${row.ACTIVIDAD||''}:${row.VEHICULO_ID||''}:${row.GPS_ACTIVO||''}`).join('|');
    const devices=$('#deviceList');if(devices&&deviceKey!==gpsDevicesPaintKey){gpsDevicesPaintKey=deviceKey;devices.innerHTML=deviceRows.map(deviceCard).join('')||empty('○','Sin conexiones','Esperando señales de dispositivos.');}
    const totals=ultimoResumenGps.totals||{};const totalsKey=`${filas.length}:${totals.onlineDevices||0}:${totals.drivingSessions||0}:${totals.sessionsWithoutGps||0}`;if(totalsKey!==gpsTotalsPaintKey){gpsTotalsPaintKey=totalsKey;if($('#gpsVisibleCount'))$('#gpsVisibleCount').textContent=filas.length;if($('#gpsOnlineCount'))$('#gpsOnlineCount').textContent=totals.onlineDevices||0;if($('#gpsDrivingCount'))$('#gpsDrivingCount').textContent=totals.drivingSessions||0;if($('#gpsWithoutCount'))$('#gpsWithoutCount').textContent=totals.sessionsWithoutGps||0;}
    refreshGpsVehicleOptions(ultimoResumenGps);
    refreshGpsDriverFilterOptions(ultimoResumenGps);
    const sync=$('#gpsLastSync');if(sync)sync.textContent=`Última consulta: ${new Intl.DateTimeFormat('es-CL',{timeStyle:'medium'}).format(new Date())}`;
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
    if(promesaInicializacionMapa)return promesaInicializacionMapa;
    contenedor.classList.add('mapa-iniciando');
    promesaInicializacionMapa=(async()=>{
      await asegurarComponenteMapa();
      const visible=await esperarTamanoMapa(contenedor,60);
      if(!visible||currentSection!=='gps'||!contenedor.isConnected)return;
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
    }).finally(()=>{promesaInicializacionMapa=null;});
    return promesaInicializacionMapa;
  }
  async function refreshLocations(showToast=true,ajustar=false) {
    if(gpsRefreshPending){gpsRefreshQueued=true;return gpsRefreshPending;}
    gpsRefreshPending=(async()=>{try{const result=await api.request('realtimeSummary',{...gpsFilterPayload(),marcaTiempo:Date.now(),force:true});gpsRefreshFailures=0;paintGpsData(result,ajustar);if(showToast)toast('Mapa actualizado',`${result.locations?.length||0} ubicaciones visibles.`);setConnection(true,api.isRemote()?'Base de datos conectada':'Base de datos local activa');return result;}catch(error){gpsRefreshFailures+=1;setConnection(false,'Error GPS');if(showToast)toast('No se pudo actualizar',translateError(error),'error');return null;}finally{gpsRefreshPending=null;const rerun=gpsRefreshQueued;gpsRefreshQueued=false;if(currentSection==='gps')scheduleGpsRefresh(rerun?300:gpsRefreshDelay());}})();
    return gpsRefreshPending;
  }

  function captureGps() {
    if (!navigator.geolocation) {toast('GPS no compatible','Este navegador no ofrece geolocalización.','error');return Promise.resolve(false);}
    return new Promise(resolve=>navigator.geolocation.getCurrentPosition(
      async position => {geolocationPermissionState='granted';updateTrackingUi();await sendPosition(position,'GPS real',true);resolve(true);},
      error => {handleTrackingError(error,'No se obtuvo ubicación');resolve(false);},
      {enableHighAccuracy:true,timeout:20000,maximumAge:3000}
    ));
  }

  function trackingPreferenceEnabled(){return localStorage.getItem(trackingPreferenceKey)==='1';}
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
    if(Date.now()-lastGpsErrorAt>8000){lastGpsErrorAt=Date.now();toast(title,messages[error?.code]||error?.message||'No fue posible obtener la ubicación.','error');}
  }
  async function startTracking({silent=false}={}){
    if(gpsWatchId!==null)return true;
    if(nativeGpsAvailable()){
      gpsWatchId='ANDROID';
      localStorage.setItem(trackingPreferenceKey,'1');
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
      localStorage.setItem(trackingPreferenceKey,'1');
      requestWakeLock();updateTrackingUi();sendHeartbeat();
      if(!silent)toast('Ubicación continua activada',`La posición se enviará aproximadamente cada ${Math.round(config.INTERVALO_GPS_MILISEGUNDOS/1000)} segundos mientras la aplicación pueda ejecutarse.`);
      return true;
    }catch(error){handleTrackingError(error);return false;}
  }
  function stopTracking({remember=true,silent=false}={}){
    if(gpsWatchId==='ANDROID'){try{window.AndroidConfig.detenerGpsPermanente();}catch(_){}}
    else if(gpsWatchId!==null&&navigator.geolocation)navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId=null;ultimaUbicacionEnviada=null;
    if(remember)localStorage.setItem(trackingPreferenceKey,'0');
    releaseWakeLock();updateTrackingUi();
    if(!silent)toast('Ubicación continua detenida');
  }
  async function resumeTrackingIfAllowed(){
    if(!currentUser||gpsWatchId!==null)return;
    if(nativeGpsAvailable()){
      try{const nativeState=JSON.parse(window.AndroidConfig.estadoGpsPermanente?.()||'{}');if(nativeState.habilitado)localStorage.setItem(trackingPreferenceKey,'1');}
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

  async function resolveAddress(latitude,longitude){
    const fallback=`${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;
    if(!config.RESOLVER_DIRECCIONES)return fallback;
    const now=Date.now(),sameArea=lastAddressLookup.address&&distanciaMetros(latitude,longitude,lastAddressLookup.latitude,lastAddressLookup.longitude)<35;
    if(sameArea&&now-lastAddressLookup.time<60000)return lastAddressLookup.address;
    if(now-lastAddressLookup.time<30000&&lastAddressLookup.address)return lastAddressLookup.address;
    try{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
      const url=new URL(config.DIRECCION_GEOCODIFICACION_INVERSA);url.searchParams.set('format','jsonv2');url.searchParams.set('lat',latitude);url.searchParams.set('lon',longitude);url.searchParams.set('zoom','18');url.searchParams.set('addressdetails','0');url.searchParams.set('accept-language','es');
      const response=await fetch(url,{headers:{Accept:'application/json'},signal:controller.signal});clearTimeout(timer);if(!response.ok)throw new Error('GEOCODIFICACION_NO_DISPONIBLE');
      const data=await response.json(),address=data.display_name||fallback;lastAddressLookup={address,time:now,latitude,longitude};return address;
    }catch(_){return fallback;}
  }

  function validarPosicionNavegador(position){
    const c=position?.coords||{},lat=Number(c.latitude),lng=Number(c.longitude),precision=Number(c.accuracy||0);
    const fecha=Number(position?.timestamp||Date.now()),edad=Math.max(0,Math.round((Date.now()-fecha)/1000));
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180||(Math.abs(lat)<0.000001&&Math.abs(lng)<0.000001))throw new Error('COORDENADAS_INVALIDAS');
    if(!Number.isFinite(precision)||precision<=0)throw new Error('PRECISION_GPS_REQUERIDA');
    if(precision>120)throw new Error('UBICACION_GPS_IMPRECISA');
    if(edad>180)throw new Error('UBICACION_GPS_ANTIGUA');
    return{lat,lng,precision,fecha,edad};
  }
  async function procesarColaGps(position,source,forzar) {
    const c=position.coords,ahora=Date.now(),validacion=validarPosicionNavegador(position);
    guardarUltimaUbicacionDispositivo({latitud:validacion.lat,longitud:validacion.lng,precision:validacion.precision,fecha:validacion.fecha,fuente:source||'GPS del dispositivo'});
    if(!forzar&&ultimaUbicacionEnviada){const tiempo=ahora-ultimaUbicacionEnviada.tiempo,movimiento=distanciaMetros(ultimaUbicacionEnviada.latitud,ultimaUbicacionEnviada.longitud,validacion.lat,validacion.lng);if(tiempo<config.INTERVALO_GPS_MILISEGUNDOS&&movimiento<Number(config.DISTANCIA_MINIMA_ENVIO_GPS_METROS||6))return;}
    const fallback=`${validacion.lat.toFixed(6)}, ${validacion.lng.toFixed(6)}`;
    const cachedAddress=lastAddressLookup.address&&distanciaMetros(validacion.lat,validacion.lng,lastAddressLookup.latitude,lastAddressLookup.longitude)<50?lastAddressLookup.address:fallback;
    await api.request('saveLocation',{data:{LATITUD:validacion.lat,LONGITUD:validacion.lng,PRECISION_METROS:validacion.precision,VELOCIDAD_KMH:c.speed==null?0:c.speed*3.6,RUMBO:c.heading||0,DIRECCION:cachedAddress,BATERIA_PORCENTAJE:batteryLevel,DISPOSITIVO_ID:deviceId,SESION_CLIENTE_ID:clientSessionId,SECCION_ACTUAL:currentSection,PAGINA_VISIBLE:document.hidden?'NO':'SI',TIPO_RED:connectionType(),PLATAFORMA:navigator.platform||'',NAVEGADOR:navigator.userAgent,FECHA_HORA:new Date(validacion.fecha).toISOString(),TIEMPO_CAPTURA_MS:validacion.fecha,EDAD_SEGUNDOS:validacion.edad,PROVEEDOR:'BROWSER_HIGH_ACCURACY',ES_SIMULADA:'NO',FUENTE:source,RUTA_ID:routeTrackingContext?.RUTA_ID||'',OPERACION_ID:routeTrackingContext?.OPERACION_ID||'',VEHICULO_ID:routeTrackingContext?.VEHICULO_ID||'',CONDUCTOR_ID:routeTrackingContext?.CONDUCTOR_ID||'',CONTEXTO_RUTA_EXPLICITO:'SI'}});
    ultimaUbicacionEnviada={tiempo:ahora,latitud:validacion.lat,longitud:validacion.lng};setSave('Ubicación sincronizada');
    resolveAddress(validacion.lat,validacion.lng).catch(()=>{});
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

  async function exportResource(resource){try{const result=await api.request('list',{resource});const rows=result.rows||[];if(!rows.length)return toast('Sin datos','No hay registros para exportar.','error');const headers=[...new Set(rows.flatMap(Object.keys))];const csv=[headers,...rows.map(row=>headers.map(h=>row[h]??''))].map(line=>line.map(value=>`"${String(value).replaceAll('"','""')}"`).join(';')).join('\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`${resource}_${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(url);toast('CSV generado',`${rows.length} registros exportados.`);}catch(error){toast('No se pudo exportar',translateError(error),'error');}}

  async function clearData(button){const confirmation=prompt('Escriba exactamente LIMPIAR DATOS para continuar:','');if(confirmation===null)return;await conCargaBoton(button,'Limpiando…',async()=>{try{await api.request('clearOperationalData',{confirmacion:confirmation});invalidarListasFormulario();cacheVistasModulo.clear();toast('Datos operativos eliminados','Se conservaron los usuarios, roles y la configuración de empresa.');actualizarSeccionEnSegundoPlano('settings');}catch(error){toast('No se pudo limpiar',translateError(error),'error');}});}
  function setTheme(dark){document.body.classList.toggle('dark',dark);localStorage.setItem('flotas_tema',dark?'dark':'light');window.TemaFlotas?.aplicarGuardado?.();}

  function openModal(){const token=++secuenciaModal;$('#modalBackdrop').classList.add('open');document.body.classList.add('modal-open');return token;}
  function closeModal(){secuenciaModal+=1;$('#modalBackdrop').classList.remove('open');document.body.classList.remove('modal-open');}
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
  function forceLogout(){cleanupSection();stopRealtimeServices();stopCamera();stopTracking({remember:false,silent:true});currentUser=null;connectionTrackedUserId='';connectionTrackedPositionKey='';connectionTrackingServerLoaded=false;connectionTrackingSavePending=false;connectionTrackedVisibility=null;notificationSnapshotReady=false;knownNotificationIds=new Set();knownAlertIds=new Set();notificationCenterState={notifications:[],alerts:[]};precargaIniciada=false;modulosSincronizadosSesion.clear();actualizacionesModuloPendientes.clear();cacheVistasModulo.clear();invalidarListasFormulario();api.setAuth({});postParent({tipo:'flotas:sesion-cerrada'});$('#appShell').classList.add('hidden');if(embeddedMode)return;$('#authScreen').classList.remove('hidden');checkSystem();}
  function showProfile(){openInfoModal('Mi perfil',[['Nombre',currentUser.NOMBRE],['Correo',currentUser.CORREO],['Rol',currentUser.ROL_NOMBRE],['Estado',currentUser.ESTADO],['Último acceso',fmtDate(currentUser.ULTIMO_ACCESO,true)]]);}
  function openInfoModal(title,items){$('#modalEyebrow').textContent='INFORMACIÓN';$('#modalTitle').textContent=title;$('#modalBody').innerHTML=`<div class="info-grid">${items.map(([a,b])=>`<div class="info-item"><span>${a}</span><b>${esc(b||'—')}</b></div>`).join('')}</div>`;openModal();}
  function openPasswordModal(){$('#modalEyebrow').textContent='SEGURIDAD';$('#modalTitle').textContent='Cambiar contraseña';$('#modalBody').innerHTML=`<form class="form-grid" id="passwordForm"><label class="field full"><span>Contraseña actual</span><input name="contrasenaActual" type="password" required></label><label class="field full"><span>Nueva contraseña</span><input name="nuevaContrasena" type="password" required placeholder="Letras, números o símbolos"></label><p class="helper full">Puede elegir cualquier combinación. La contraseña distingue mayúsculas y minúsculas.</p><div class="form-actions"><button class="btn soft" type="button" data-cancel-modal>Cancelar</button><button class="btn primary" type="submit">Cambiar contraseña</button></div></form>`;openModal();$('[data-cancel-modal]').onclick=closeModal;$('#passwordForm').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=$('button[type="submit"]',form);await conCargaBoton(button,'Actualizando…',async()=>{try{await api.request('changePassword',Object.fromEntries(new FormData(form).entries()));invalidarListasFormulario('users');closeModal();toast('Contraseña actualizada');}catch(error){toast('No se pudo cambiar',translateError(error),'error');}});};}

  function bindGlobal() {
    $('#setupForm').addEventListener('submit',handleSetup);$('#loginForm').addEventListener('submit',handleLogin);$('#showPassword').addEventListener('click',()=>{const input=$('#loginPassword');input.type=input.type==='password'?'text':'password';});
    $('#retryConnection').addEventListener('click',event=>conCargaBoton(event.currentTarget,'Conectando…',checkSystem));$('#recheckConnection').addEventListener('click',event=>conCargaBoton(event.currentTarget,'Conectando…',checkSystem));$('#useLocalMode').addEventListener('click',()=>{sessionStorage.setItem('flotas_forzar_local','1');location.reload();});
    $('#openSidebar').addEventListener('click',openSidebar);$('#closeSidebar').addEventListener('click',closeSidebar);$('#overlay').addEventListener('click',closeSidebar);$('#logoutButton').addEventListener('click',event=>conCargaBoton(event.currentTarget,'Cerrando…',logout));
    $('#syncButton').addEventListener('click',event=>sincronizarSistema(event.currentTarget));$('#sidebarSyncButton').addEventListener('click',event=>sincronizarSistema(event.currentTarget));
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
      if(event.origin!==location.origin&&event.origin!=='null')return;
      const data=event.data||{};
      if(data.tipo==='flotas:cerrar-sesion'&&currentUser)logout();
      if(data.tipo==='flotas:navegar'&&currentUser&&renderers[data.seccion])go(data.seccion);
      if(data.tipo==='flotas:sincronizar'&&currentUser)sincronizarSistema(null);
      if(data.tipo==='flotas:tema')setTheme(Boolean(data.oscuro));
      if(data.tipo==='flotas:modulo-visible'&&currentUser)redibujarMapaAlHacerseVisible();
    });
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('mapa-pantalla-completa'))toggleMapFullscreen(false);});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){if(connectionTrackingLiveTimer)clearTimeout(connectionTrackingLiveTimer);connectionTrackingLiveTimer=null;if(currentUser)sendHeartbeat('En segundo plano');releaseWakeLock();return;}if(currentUser){sendHeartbeat('En línea');resumeTrackingIfAllowed();if(gpsWatchId!==null)requestWakeLock();redibujarMapaAlHacerseVisible();if(currentSection==='gps')refreshLocations(false,false);if(currentSection==='connections'){refreshConnectionsOnline(false,false);scheduleConnectionTrackingLive(80);}}});
    window.addEventListener('pageshow',()=>setTimeout(redibujarMapaAlHacerseVisible,40));
    window.addEventListener('resize',()=>setTimeout(redibujarMapaAlHacerseVisible,80));
    window.addEventListener('orientationchange',()=>setTimeout(redibujarMapaAlHacerseVisible,180));
  }

  function init(){bindGlobal();setTheme(window.TemaFlotas?.modoOscuroInicial?.()??localStorage.getItem('flotas_tema')==='dark');checkSystem();}
  window.addEventListener('pagehide',()=>{cleanupSection();stopRealtimeServices();stopCamera();releaseWakeLock();});
  init();
})();
