(function () {
  'use strict';

  const config = window.CONFIGURACION_FLOTAS;
  const accionesAplicacion = Object.freeze({
    health:'salud', status:'estadoSistema', bootstrap:'instalacionInicial', login:'iniciarSesion',
    logout:'cerrarSesion', me:'miSesion', dashboard:'panelPrincipal', operationsSummary:'resumenOperaciones', reportsKpiSummary:'resumenReportesKpi', reportsKpiDetail:'detalleReportesKpi', list:'listar', get:'obtener',
    quickLoad:'cargaRapida',
    create:'crear', update:'actualizar', delete:'eliminar', startOperation:'iniciarOperacion',
    finishOperation:'finalizarOperacion', editOperationAdmin:'editarOperacionAdministrativa', deleteOperationAdmin:'eliminarOperacionAdministrativa', diagnoseAvailability:'diagnosticarDisponibilidad', saveLocation:'guardarUbicacion', latestLocations:'ultimasUbicaciones',
    changePassword:'cambiarContrasena', updateProfilePhoto:'actualizarFotoPerfil', profilePhoto:'obtenerFotoPerfil', saveUserPermissions:'actualizarPermisosUsuario', saveCompany:'guardarEmpresa', saveOperationalPoint:'guardarPuntoOperacion', getOperationalPoint:'obtenerPuntoOperacion', clearOperationalData:'limpiarDatosOperativos',
    routeSyncState:'estadoSincronizacionRutas', assignRoute:'asignarRuta', reassignRoute:'reasignarRuta', startRoute:'iniciarRuta', completeRoute:'completarRuta', updateRouteStatus:'actualizarEstadoRuta', registerRouteEvidence:'registrarEvidenciaRuta', routeEvidenceImage:'obtenerImagenEvidenciaRuta', routeWeather:'climaRuta', sendNotification:'enviarNotificacion',
    readNotification:'marcarNotificacionLeida', pendingNotices:'avisosPendientes', assignmentAlerts:'listarAvisosAsignacion', respondAssignmentAlert:'responderAvisoAsignacion', resendAssignmentAlert:'reenviarAvisoAsignacion', readAlert:'marcarAlertaLeida', heartbeat:'actualizarConexion', realtimeSummary:'resumenTiempoReal', connectionsOnline:'resumenConexionesAdministrador', saveConnectionTracking:'guardarSeguimientoConexionUsuario',
    connectionTrackingLive:'seguimientoConexionTiempoReal', sendConnectionsNotice:'enviarAvisoConexiones', disconnectConnectedUser:'desconectarUsuarioConectado',
    diagnoseSystem:'diagnosticoSistema', repairSystem:'repararSistema',
    connectionClientConfig:'configuracionConexionCliente', getConnectionConfig:'obtenerConfiguracionConexiones', saveConnectionConfig:'guardarConfiguracionConexiones', testConnectionConfig:'probarConfiguracionConexiones',
    officeQuickStatus:'estadoRapidoOficinaVirtual', officeTasks:'pendientesOficinaVirtual',
    officeStatus:'estadoOficinaVirtual', officeAsk:'consultarOficinaVirtual', officeAutoMode:'configurarModoOficinaVirtual',
    officeRun:'ejecutarRevisionOficinaVirtual', officeRepair:'repararOficinaVirtual', officeUploadDocument:'cargarDocumentoOficinaVirtual', officeReportFailure:'informarFallaOficinaVirtual', officeGenerateReport:'generarReporteOficinaVirtual', officeIncidents:'listarIncidentesOficinaVirtual', officeResolveIncident:'resolverIncidenteOficinaVirtual',
    validateVehicleQr:'validarQrVehiculo', vehicleQrLabel:'obtenerEtiquetaQrVehiculo', assignCheckinVehicle:'asignarVehiculoCheckin', currentCheckinAssignment:'asignacionCheckinActual', createVehicleCheckin:'crearCheckinVehicular',
    reviewVehicleCheckin:'revisarCheckinVehicular', availableCheckins:'checkinsDisponibles', validateRouteCheckin:'validarCheckinRuta',
    bulkImport:'importarMasivo', registerConnectionIp:'registrarIpConexion', fuelSummary:'resumenCombustible',
    requestFuelDeletion:'solicitarEliminacionCombustible', resolveFuelDeletion:'resolverSolicitudEliminacionCombustible', deleteFuel:'eliminarCargaCombustible', uploadDriveFile:'subirArchivoDrive', documentFile:'obtenerArchivoDocumento', approveDocument:'aprobarDocumento', rejectDocument:'rechazarDocumento', updateLocationAddress:'actualizarDireccionUbicacion', restoreRolePermissions:'restaurarPermisosRoles', backupCatalog:'catalogoRespaldoBaseDatos', backupTable:'obtenerTablaRespaldoBaseDatos', runAutomaticAlerts:'ejecutarAlertasAutomaticas'
  });
  const recursosAplicacion = Object.freeze({
    users:'usuarios', roles:'roles', permissions:'permisos', vehicles:'vehiculos', drivers:'conductores',
    operations:'operaciones', gps:'gps', history:'historial', maintenance:'mantenciones', documents:'documentos',
    alerts:'alertas', reports:'reportes', audit:'bitacora', parameters:'parametros', companies:'empresas', qr:'qr',
    routes:'rutas', notifications:'notificaciones', connections:'conexiones', checkins:'checkins',
    fuel:'combustible', fuelAuthorizations:'autorizacionesCombustible', routeHistory:'historialRutas'
  });

  const resourceMap = {
    users: 'users', roles: 'roles', permissions: 'permissions', vehicles: 'vehicles',
    drivers: 'drivers', operations: 'operations', gps: 'gps', history: 'history',
    maintenance: 'maintenance', documents: 'documents', alerts: 'alerts', reports: 'reports',
    audit: 'audit', parameters: 'parameters', companies: 'companies', qr: 'qr',
    routes: 'routes', notifications: 'notifications', connections: 'connections', checkins:'checkins',
    fuel:'fuel', fuelAuthorizations:'fuelAuthorizations', routeHistory:'routeHistory'
  };

  const emptyState = () => ({
    version: 2,
    users: [], roles: [], permissions: [], vehicles: [], drivers: [], operations: [], gps: [], gpsCurrent: [],
    history: [], maintenance: [], documents: [], alerts: [], reports: [], audit: [], parameters: [],
    companies: [], qr: [], routes: [], routeHistory: [], notifications: [], connections: [], checkins: [], checkinAssignments: [], fuel: [], fuelAuthorizations: [], sessions: []
  });

  function loadLocal() {
    try {
      const saved = JSON.parse(localStorage.getItem(config.CLAVE_ALMACENAMIENTO_LOCAL));
      return saved && Array.isArray(saved.users) ? { ...emptyState(), ...saved } : emptyState();
    } catch (_) {
      return emptyState();
    }
  }

  let localDb = loadLocal();
  let auth = loadAuth();
  let conexionEmpresa = cargarConexionEmpresa();
  const qrAuthorizations = new Map();
  const cacheRespuestas = new Map();
  const solicitudesPendientes = new Map();
  const accionesLectura = new Set(['status','me','dashboard','operationsSummary','reportsKpiSummary','reportsKpiDetail','list','assignmentAlerts','realtimeSummary','connectionsOnline','connectionTrackingLive','diagnoseSystem','officeQuickStatus','officeTasks','officeStatus','officeIncidents','getOperationalPoint','fuelSummary','connectionClientConfig','getConnectionConfig','testConnectionConfig','routeEvidenceImage','routeSyncState','backupCatalog','backupTable','profilePhoto']);
  const clientIpCacheKey = 'flotas_ip_publica_v1';
  const claveCachePersistente = config.CLAVE_CACHE_MODULOS_LOCAL || 'sistema_gestion_flotas_cache_modulos_v1';
  const accionesCachePersistente = new Set(['dashboard','operationsSummary','list','diagnoseSystem','officeQuickStatus','officeTasks','officeStatus','officeIncidents','getOperationalPoint']);
  let temporizadorPersistenciaCache = null;

  function entradaCachePersistible(entry) {
    return Boolean(entry && accionesCachePersistente.has(entry.action));
  }

  function cargarCachePersistente() {
    try {
      const saved = JSON.parse(localStorage.getItem(claveCachePersistente) || '{}');
      const maxAge = Number(config.CACHE_MAXIMA_ANTIGUEDAD_MILISEGUNDOS || 86400000);
      const now = Date.now();
      const entries = Array.isArray(saved.entries) ? saved.entries : [];
      entries.forEach(item => {
        if (!Array.isArray(item) || item.length !== 2) return;
        const [key, entry] = item;
        if (!entradaCachePersistible(entry)) return;
        if (!entry.time || now - Number(entry.time) > maxAge) return;
        cacheRespuestas.set(String(key), { ...entry, origin:'DISPOSITIVO' });
      });
    } catch (_) {
      try { localStorage.removeItem(claveCachePersistente); } catch (_) {}
    }
  }

  function persistirCacheAhora() {
    temporizadorPersistenciaCache = null;
    try {
      const maxEntries = Math.max(8, Number(config.CACHE_LOCAL_MAXIMO_ENTRADAS || 42));
      const maxBytes = Math.max(250000, Number(config.CACHE_LOCAL_MAXIMO_BYTES || 3500000));
      const candidates = [...cacheRespuestas.entries()]
        .filter(([, entry]) => entradaCachePersistible(entry))
        .sort((a,b) => Number(b[1].time || 0) - Number(a[1].time || 0))
        .slice(0, maxEntries);
      const selected = [];
      for (const candidate of candidates) {
        const attempt = { version:1, savedAt:Date.now(), entries:[...selected, candidate] };
        if (JSON.stringify(attempt).length > maxBytes) break;
        selected.push(candidate);
      }
      localStorage.setItem(claveCachePersistente, JSON.stringify({ version:1, savedAt:Date.now(), entries:selected }));
    } catch (_) {
      try { localStorage.removeItem(claveCachePersistente); } catch (_) {}
    }
  }

  function programarPersistenciaCache() {
    if (temporizadorPersistenciaCache) clearTimeout(temporizadorPersistenciaCache);
    temporizadorPersistenciaCache = setTimeout(persistirCacheAhora, 120);
  }

  if (config.CACHE_PERSISTENTE_MODULOS !== false && !config.CARGA_MANUAL_MODULOS) cargarCachePersistente();
  else { try { localStorage.removeItem(claveCachePersistente); } catch (_) {} }

  function loadAuth() {
    try { return JSON.parse(localStorage.getItem(config.CLAVE_SESION_LOCAL)) || {}; }
    catch (_) { return {}; }
  }

  function urlHttpsValida(valor) {
    try {
      const url = new URL(String(valor || '').trim());
      return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
    } catch (_) { return false; }
  }

  const claveConfiguracionConexionesLocal = config.CLAVE_CONFIGURACION_CONEXIONES_LOCAL || 'sistema_gestion_flotas_configuracion_conexiones_v1';
  function cargarConfiguracionConexionesLocal() {
    try {
      const guardada = JSON.parse(localStorage.getItem(claveConfiguracionConexionesLocal) || 'null');
      if (!guardada || typeof guardada !== 'object') return null;
      const directorioUrl = urlHttpsValida(guardada.directorioUrl) ? String(guardada.directorioUrl).trim() : '';
      const apiRespaldoUrl = urlHttpsValida(guardada.apiRespaldoUrl) ? String(guardada.apiRespaldoUrl).trim() : '';
      if (!directorioUrl && !apiRespaldoUrl) return null;
      return { directorioUrl, apiRespaldoUrl, version:Number(guardada.version || 0), guardadaEn:String(guardada.guardadaEn || '') };
    } catch (_) { return null; }
  }
  let configuracionConexionesLocal = cargarConfiguracionConexionesLocal();
  function direccionDirectorioActual() {
    if (configuracionConexionesLocal?.directorioUrl && urlHttpsValida(configuracionConexionesLocal.directorioUrl)) return configuracionConexionesLocal.directorioUrl;
    return String(config.DIRECTORIO_EMPRESAS_URL || '').trim();
  }
  function obtenerConfiguracionConexionesLocal() {
    return {
      directorioUrl: direccionDirectorioActual(),
      apiRespaldoUrl: configuracionConexionesLocal?.apiRespaldoUrl || '',
      version: Number(configuracionConexionesLocal?.version || 0),
      guardadaEn: configuracionConexionesLocal?.guardadaEn || '',
      usaPredeterminado: !(configuracionConexionesLocal?.directorioUrl && urlHttpsValida(configuracionConexionesLocal.directorioUrl))
    };
  }
  function aplicarConfiguracionConexionCliente(datos = {}, {forzar=false} = {}) {
    const cfg = datos.configuracion || datos.CONFIGURACION || datos;
    const directorioUrl = String(cfg.DIRECTORIO_URL || cfg.directorioUrl || '').trim();
    const apiRespaldoUrl = String(cfg.API_RESPALDO_URL || cfg.apiRespaldoUrl || '').trim();
    const version = Math.max(0, Number(cfg.VERSION_CONFIG || cfg.version || 0));
    if (!urlHttpsValida(directorioUrl)) throw new Error('DIRECTORIO_URL_HTTPS_REQUERIDA');
    if (apiRespaldoUrl && !urlHttpsValida(apiRespaldoUrl)) throw new Error('API_RESPALDO_URL_HTTPS_REQUERIDA');
    const actual = obtenerConfiguracionConexionesLocal();
    if (!forzar && actual.version > 0 && version > 0 && version < actual.version) return actual;
    configuracionConexionesLocal = { directorioUrl, apiRespaldoUrl, version, guardadaEn:new Date().toISOString() };
    localStorage.setItem(claveConfiguracionConexionesLocal, JSON.stringify(configuracionConexionesLocal));
    window.dispatchEvent(new CustomEvent('flotas:configuracion-conexion-cambiada', { detail:obtenerConfiguracionConexionesLocal() }));
    return obtenerConfiguracionConexionesLocal();
  }
  function guardarDirectorioConexionLocal(url, {apiRespaldoUrl='',version=0} = {}) {
    return aplicarConfiguracionConexionCliente({DIRECTORIO_URL:url,API_RESPALDO_URL:apiRespaldoUrl,VERSION_CONFIG:version},{forzar:true});
  }
  function restaurarDirectorioPredeterminado() {
    configuracionConexionesLocal = null;
    localStorage.removeItem(claveConfiguracionConexionesLocal);
    window.dispatchEvent(new CustomEvent('flotas:configuracion-conexion-cambiada', { detail:obtenerConfiguracionConexionesLocal() }));
    return obtenerConfiguracionConexionesLocal();
  }

  function cargarConexionEmpresa() {
    try {
      const guardada = JSON.parse(localStorage.getItem(config.CLAVE_CONEXION_EMPRESA) || 'null');
      return guardada && urlHttpsValida(guardada.url) && guardada.rut ? guardada : null;
    } catch (_) { return null; }
  }

  function direccionAplicacionActual() {
    if (conexionEmpresa && urlHttpsValida(conexionEmpresa.url)) return conexionEmpresa.url;
    if (config.DIRECTORIO_EMPRESAS_OBLIGATORIO !== false) return '';
    return String(config.DIRECCION_APLICACION || '').trim();
  }

  function directorioEmpresasConfigurado() {
    const direccion = direccionDirectorioActual();
    return urlHttpsValida(direccion) && !direccion.includes('REEMPLAZAR_');
  }

  function obtenerConexionEmpresa() {
    return conexionEmpresa ? {
      configurada: true,
      nombre: String(conexionEmpresa.nombre || '').trim(),
      rut: String(conexionEmpresa.rut || '').trim(),
      guardadaEn: conexionEmpresa.guardadaEn || ''
    } : { configurada:false, nombre:'', rut:'', guardadaEn:'' };
  }

  function normalizarRutEmpresa(valor) {
    return String(valor || '').toUpperCase().replace(/[^0-9K]/g, '');
  }

  function rutEmpresaValido(valor) {
    const rut = normalizarRutEmpresa(valor);
    if (!/^[0-9]{7,8}[0-9K]$/.test(rut)) return false;
    const cuerpo = rut.slice(0, -1);
    let suma = 0, multiplicador = 2;
    for (let indice = cuerpo.length - 1; indice >= 0; indice -= 1) {
      suma += Number(cuerpo[indice]) * multiplicador;
      multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
    }
    const resultado = 11 - (suma % 11);
    const esperado = resultado === 11 ? '0' : resultado === 10 ? 'K' : String(resultado);
    return rut.slice(-1) === esperado;
  }

  function cabecerasPublicasPara(urlServicio) {
    return {};
  }

  function solicitarDirectorioJsonp(rut) {
    if (!directorioEmpresasConfigurado()) return Promise.reject(new Error('DIRECTORIO_EMPRESAS_NO_CONFIGURADO'));
    return new Promise((resolve, reject) => {
      const callback = `flotasDirectorio${Date.now()}${Math.floor(Math.random() * 100000)}`;
      const script = document.createElement('script');
      const temporizador = setTimeout(() => finalizar(new Error('TIEMPO_DE_ESPERA_DIRECTORIO')), Number(config.TIEMPO_ESPERA_DIRECTORIO_MILISEGUNDOS || 18000));
      const finalizar = (error, datos) => {
        clearTimeout(temporizador);
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
        script.remove();
        if (error) reject(error); else resolve(datos);
      };
      window[callback] = datos => finalizar(null, datos);
      script.onerror = () => finalizar(new Error('DIRECTORIO_EMPRESAS_NO_DISPONIBLE'));
      const direccion = new URL(direccionDirectorioActual());
      direccion.searchParams.set('accion', 'resolverConexion');
      direccion.searchParams.set('rut', rut);
      direccion.searchParams.set('callback', callback);
      direccion.searchParams.set('_', String(Date.now()));
      script.src = direccion.toString();
      script.async = true;
      document.head.appendChild(script);
    });
  }

  async function comprobarServicioEmpresa(urlServicio) {
    if (!urlHttpsValida(urlServicio)) throw new Error('CONEXION_EMPRESA_INVALIDA');
    const controller = new AbortController();
    const temporizador = setTimeout(() => controller.abort(), Number(config.TIEMPO_ESPERA_DIRECTORIO_MILISEGUNDOS || 18000));
    try {
      const response = await fetch(urlServicio, {
        method:'POST',
        headers:{'Content-Type':'application/json;charset=utf-8','Accept':'application/json',...cabecerasPublicasPara(urlServicio)},
        body:JSON.stringify({accion:'salud', action:'salud', origen:'WEB'}),
        cache:'no-store', redirect:'follow', signal:controller.signal
      });
      const datos = await response.json();
      if (!response.ok || !datos || datos.ok !== true) throw new Error('CONEXION_EMPRESA_NO_DISPONIBLE');
      return true;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('TIEMPO_DE_ESPERA_DIRECTORIO');
      if (String(error?.message || '') === 'CONEXION_EMPRESA_NO_DISPONIBLE') throw error;
      throw new Error('CONEXION_EMPRESA_NO_DISPONIBLE');
    } finally { clearTimeout(temporizador); }
  }

  async function resolverConexionEmpresa(rutIngresado) {
    const rut = normalizarRutEmpresa(rutIngresado);
    if (!rutEmpresaValido(rut)) throw new Error('RUT_EMPRESA_INVALIDO');
    const respuesta = await solicitarDirectorioJsonp(rut);
    if (!respuesta || respuesta.ok !== true) throw new Error(String(respuesta?.error || 'EMPRESA_NO_REGISTRADA'));
    const nombre = String(respuesta.empresa?.nombre || '').trim();
    const rutFormateado = String(respuesta.empresa?.rut || rut).trim();
    const url = String(respuesta.conexion?.url || '').trim();
    if (!nombre || !urlHttpsValida(url)) throw new Error('RESPUESTA_DIRECTORIO_INVALIDA');
    await comprobarServicioEmpresa(url);
    conexionEmpresa = { nombre, rut:rutFormateado, url, guardadaEn:new Date().toISOString() };
    localStorage.setItem(config.CLAVE_CONEXION_EMPRESA, JSON.stringify(conexionEmpresa));
    // Configurar o cambiar la empresa nunca inicia sesión automáticamente.
    // Se elimina cualquier sesión anterior antes de habilitar el login real.
    setAuth({});
    limpiarCache();
    window.dispatchEvent(new CustomEvent('flotas:conexion-empresa-cambiada', {detail:obtenerConexionEmpresa()}));
    return obtenerConexionEmpresa();
  }

  async function validarEmpresaActivaParaAcceso() {
    if (!conexionEmpresa) throw new Error('CONEXION_EMPRESA_REQUERIDA');
    const rut = normalizarRutEmpresa(conexionEmpresa.rut);
    if (!rutEmpresaValido(rut)) throw new Error('RUT_EMPRESA_INVALIDO');
    const respuesta = await solicitarDirectorioJsonp(rut);
    if (!respuesta || respuesta.ok !== true) throw new Error(String(respuesta?.error || 'EMPRESA_NO_REGISTRADA'));
    const estado = String(respuesta.empresa?.estado || '').trim().toUpperCase();
    const nombre = String(respuesta.empresa?.nombre || '').trim();
    const rutFormateado = String(respuesta.empresa?.rut || rut).trim();
    const url = String(respuesta.conexion?.url || '').trim();
    if (estado !== 'ACTIVA') throw new Error('EMPRESA_BLOQUEADA');
    if (!nombre || !urlHttpsValida(url)) throw new Error('RESPUESTA_DIRECTORIO_INVALIDA');
    const cambioServicio = conexionEmpresa.url !== url;
    conexionEmpresa = {nombre, rut:rutFormateado, url, guardadaEn:conexionEmpresa.guardadaEn || new Date().toISOString()};
    localStorage.setItem(config.CLAVE_CONEXION_EMPRESA, JSON.stringify(conexionEmpresa));
    if (cambioServicio) {
      setAuth({});
      limpiarCache();
      window.dispatchEvent(new CustomEvent('flotas:conexion-empresa-cambiada', {detail:obtenerConexionEmpresa()}));
    }
    return obtenerConexionEmpresa();
  }

  async function sincronizarConexionEmpresa({forzar=false}={}) {
    if (!conexionEmpresa) throw new Error('CONEXION_EMPRESA_REQUERIDA');
    // Los módulos reutilizan la conexión guardada. La comprobación silenciosa
    // de ACTIVA/BLOQUEADA se realiza por separado al abrir el acceso y justo
    // antes de crear una nueva sesión.
    return obtenerConexionEmpresa();
  }

  async function sincronizarConfiguracionConexionServidor({silencioso=true}={}) {
    if (!auth?.token || !isRemote()) return obtenerConfiguracionConexionesLocal();
    try {
      const resultado = await request('connectionClientConfig',{cache:false,force:true});
      if (resultado?.configuracion) return aplicarConfiguracionConexionCliente(resultado.configuracion);
    } catch (error) {
      if (!silencioso) throw error;
    }
    return obtenerConfiguracionConexionesLocal();
  }

  function borrarConexionEmpresa() {
    conexionEmpresa = null;
    localStorage.removeItem(config.CLAVE_CONEXION_EMPRESA);
    setAuth({});
    limpiarCache();
    window.dispatchEvent(new CustomEvent('flotas:conexion-empresa-cambiada', {detail:obtenerConexionEmpresa()}));
  }

  function saveLocal() {
    localStorage.setItem(config.CLAVE_ALMACENAMIENTO_LOCAL, JSON.stringify(localDb));
    window.dispatchEvent(new CustomEvent('flotas:guardado-local'));
  }

  function setAuth(data) {
    const fichaAnterior = auth.token || '';
    auth = data || {};
    if (fichaAnterior !== (auth.token || '')) limpiarCache();
    if (auth.token) localStorage.setItem(config.CLAVE_SESION_LOCAL, JSON.stringify(auth));
    else localStorage.removeItem(config.CLAVE_SESION_LOCAL);
    window.dispatchEvent(new CustomEvent('flotas:sesion-cambiada', { detail: auth }));
  }

  function isRemote() {
    // Producción Web: la autoridad siempre es el servidor/API.
    // Nunca se acepta un cambio de modo desde DevTools/sessionStorage.
    if (config.PRODUCCION_SEGURA === true || config.PERMITIR_MODO_LOCAL === false) {
      return urlHttpsValida(direccionAplicacionActual());
    }
    if (sessionStorage.getItem('flotas_forzar_local') === '1') return false;
    if (config.MODO === 'local') return false;
    if (config.MODO === 'aplicacion_google') return urlHttpsValida(direccionAplicacionActual());
    return urlHttpsValida(direccionAplicacionActual());
  }

  function backendLabel() {
    const empresa = obtenerConexionEmpresa();
    return isRemote() ? (empresa.nombre ? `Base de datos de ${empresa.nombre}` : 'Base de datos central') : 'Base de datos local';
  }

  async function getClientIp({force=false}={}) {
    if (!force) {
      const cached=sessionStorage.getItem(clientIpCacheKey);
      if(cached)return cached;
    }
    const endpoints=['https://api64.ipify.org?format=json','https://api.ipify.org?format=json'];
    for(const endpoint of endpoints){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500);
      try{
        const response=await fetch(endpoint,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});
        if(!response.ok)continue;
        const data=await response.json();const ip=String(data.ip||'').trim();
        if(ip&&/^[0-9a-fA-F:.]+$/.test(ip)){sessionStorage.setItem(clientIpCacheKey,ip);return ip;}
      }catch(_){ }finally{clearTimeout(timer);}
    }
    return '';
  }

  async function registerConnectionIp(extra={}) {
    const ip=extra.IP_PUBLICA||await getClientIp();
    if(!ip||!auth.token)return {registrada:false};
    try{return await request('registerConnectionIp',{data:{...extra,IP_PUBLICA:ip}});}
    catch(_){return {registrada:false};}
  }

  const CODIGOS_ERROR_SESION = new Set(['SESION_INVALIDA','SESION_EXPIRADA','AUTENTICACION_REQUERIDA','USUARIO_DESHABILITADO']);
  function authErrorCode(error) {
    return String(error?.message || error || '').split(':')[0].trim();
  }
  function isAuthError(error) {
    return CODIGOS_ERROR_SESION.has(authErrorCode(error));
  }
  function notificarSesionInvalida(codigo) {
    window.dispatchEvent(new CustomEvent('flotas:sesion-invalida', { detail:{ codigo:codigo || 'SESION_INVALIDA' } }));
  }

  async function request(action, payload = {}) {
    if (isRemote()) {
      if (accionesLectura.has(action) && payload.cache !== false) return solicitarLecturaRemota(action, payload);
      const result = await remoteRequest(action, payload);
      invalidarDespuesDeEscritura(action, payload);
      return result;
    }
    if (config.PRODUCCION_SEGURA === true || config.PERMITIR_MODO_LOCAL === false) {
      throw new Error('CONEXION_EMPRESA_REQUERIDA');
    }
    return localRequest(action, payload);
  }

  function limpiarCache() {
    cacheRespuestas.clear();
    solicitudesPendientes.clear();
    if (temporizadorPersistenciaCache) clearTimeout(temporizadorPersistenciaCache);
    temporizadorPersistenciaCache = null;
    try { localStorage.removeItem(claveCachePersistente); } catch (_) {}
  }

  function normalizarParaClave(value) {
    if (Array.isArray(value)) return value.map(normalizarParaClave);
    if (!value || typeof value !== 'object') return value;
    return Object.keys(value).sort().reduce((output, key) => {
      if (['force','cache','marcaTiempo'].includes(key)) return output;
      output[key] = normalizarParaClave(value[key]);
      return output;
    }, {});
  }

  function claveCache(action, payload = {}) {
    const usuario = auth.user?.ID || auth.sessionId || (auth.token ? 'sesion' : 'publico');
    return `${usuario}|${action}|${JSON.stringify(normalizarParaClave(payload))}`;
  }

  function politicaCache(action) {
    if (action === 'connectionTrackingLive') {
      return {
        vigente:Number(config.CACHE_SEGUIMIENTO_CONEXION_MILISEGUNDOS || 350),
        maxima:Math.max(4000, Number(config.TIEMPO_ESPERA_SEGUIMIENTO_CONEXION_MILISEGUNDOS || 8000))
      };
    }
    if (action === 'realtimeSummary' || action === 'connectionsOnline') {
      return {
        vigente: Number(config.CACHE_TIEMPO_REAL_MILISEGUNDOS || 4000),
        maxima: Math.max(15000, Number(config.CACHE_MAXIMA_ANTIGUEDAD_MILISEGUNDOS || 300000)),
      };
    }
    if (action === 'me') return { vigente: 600000, maxima: 1800000 };
    return {
      vigente: Number(config.CACHE_MODULOS_MILISEGUNDOS || 60000),
      maxima: Number(config.CACHE_MAXIMA_ANTIGUEDAD_MILISEGUNDOS || 300000),
    };
  }

  function guardarEnCache(action, payload, data) {
    const key = claveCache(action, payload);
    const entry = {
      action,
      resource: payload.resource || '',
      payload: normalizarParaClave(payload),
      data,
      time: Date.now(),
      origin:'SERVIDOR',
    };
    cacheRespuestas.set(key, entry);
    if (cacheRespuestas.size > 80) cacheRespuestas.delete(cacheRespuestas.keys().next().value);
    if (entradaCachePersistible(entry)) programarPersistenciaCache();
    window.dispatchEvent(new CustomEvent('flotas:cache-actualizada', { detail:{ action, resource:entry.resource, time:entry.time } }));
    return data;
  }

  function invalidarCache(criteria = {}) {
    const actions = new Set(criteria.actions || []);
    const resources = new Set(criteria.resources || []);
    if (!actions.size && !resources.size) {
      limpiarCache();
      return;
    }
    let changed = false;
    cacheRespuestas.forEach((entry, key) => {
      if (actions.has(entry.action) || (entry.resource && resources.has(entry.resource))) {
        cacheRespuestas.delete(key);
        changed = true;
      }
    });
    if (changed) programarPersistenciaCache();
  }

  function invalidarDespuesDeEscritura(action, payload = {}) {
    if (accionesLectura.has(action) || ['health','login'].includes(action)) return;
    if (action === 'heartbeat') {
      invalidarCache({ actions:['realtimeSummary','connectionsOnline','connectionTrackingLive'] });
      return;
    }
    if (action === 'saveLocation') {
      invalidarCache({ actions:['realtimeSummary','connectionsOnline','connectionTrackingLive'], resources:['gps'] });
      return;
    }
    const impacts = {
      create: { actions:['dashboard','officeQuickStatus','officeTasks','officeStatus'], resources:[payload.resource,'audit'] },
      update: { actions:['dashboard','officeQuickStatus','officeTasks','officeStatus'], resources:[payload.resource,'audit'] },
      delete: { actions:['dashboard','officeQuickStatus','officeTasks','officeStatus'], resources:[payload.resource,'audit'] },
      startOperation: { actions:['dashboard','operationsSummary','realtimeSummary'], resources:['operations','vehicles','drivers','history','audit'] },
      finishOperation: { actions:['dashboard','operationsSummary','realtimeSummary'], resources:['operations','vehicles','drivers','history','audit'] },
      editOperationAdmin: { actions:['dashboard','operationsSummary','realtimeSummary'], resources:['operations','vehicles','drivers','routes','history','audit'] },
      deleteOperationAdmin: { actions:['dashboard','operationsSummary','realtimeSummary'], resources:['operations','vehicles','drivers','routes','history','audit'] },
      createVehicleCheckin: { actions:['dashboard','officeQuickStatus','officeTasks','officeStatus'], resources:['checkins','alerts','audit'] },
      reviewVehicleCheckin: { actions:['dashboard','officeQuickStatus','officeTasks','officeStatus'], resources:['checkins','notifications','audit'] },
      assignRoute: { actions:['dashboard','realtimeSummary','officeQuickStatus','officeTasks','officeStatus'], resources:['routes','vehicles','documents','notifications','audit'] },
      startRoute: { actions:['dashboard','realtimeSummary'], resources:['routes','checkins','operations','gps','connections','audit'] },
      completeRoute: { actions:['dashboard','realtimeSummary'], resources:['routes','gps','connections','notifications','audit'] },
      updateRouteStatus: { actions:['dashboard','realtimeSummary','officeQuickStatus','officeTasks','officeStatus'], resources:['routes','notifications','audit'] },
      sendNotification: { actions:['dashboard','realtimeSummary'], resources:['notifications','audit'] },
      sendConnectionsNotice: { actions:['dashboard','realtimeSummary'], resources:['notifications','alerts','audit'] },
      disconnectConnectedUser: { actions:['dashboard','realtimeSummary','connectionsOnline'], resources:['connections','notifications','audit'] },
      readNotification: { actions:['dashboard','realtimeSummary'], resources:['notifications'] },
      readAlert: { actions:['dashboard','realtimeSummary'], resources:['alerts'] },
      saveCompany: { actions:['status','getOperationalPoint'], resources:['companies','audit'] },
      saveOperationalPoint: { actions:['status','dashboard','operationsSummary','diagnoseSystem','getOperationalPoint'], resources:['companies','operations','routes','audit'] },
      changePassword: { actions:['me'], resources:['users','audit'] },
      saveUserPermissions: { actions:['me','dashboard'], resources:['users','audit'] },
      saveConnectionTracking: { actions:['connectionsOnline','connectionTrackingLive'], resources:['connections','gps','audit'] },
      repairSystem: { actions:['status','dashboard','realtimeSummary','diagnoseSystem','getOperationalPoint'], resources:['companies','users','vehicles','drivers','routes','operations','gps','notifications','alerts','history','checkins','audit'] },
      bulkImport: { actions:['dashboard'], resources:[payload.resource,'audit'] },
      registerConnectionIp: { actions:['realtimeSummary'], resources:['connections','audit'] },
      requestFuelDeletion: { actions:['fuelSummary'], resources:['fuelAuthorizations','audit'] },
      resolveFuelDeletion: { actions:['fuelSummary'], resources:['fuelAuthorizations','audit'] },
      deleteFuel: { actions:['dashboard','fuelSummary'], resources:['fuel','fuelAuthorizations','vehicles','audit'] },
      uploadDriveFile: { actions:[], resources:['audit'] },
      documentFile: { actions:[], resources:[] }, updateLocationAddress: { actions:['connectionsOnline','realtimeSummary'], resources:['connections','gps'] }, restoreRolePermissions: { actions:['me','dashboard'], resources:['users','roles','permissions','audit'] },
      officeAutoMode: { actions:['officeQuickStatus','officeStatus'], resources:['audit'] },
      officeRun: { actions:['officeQuickStatus','officeTasks','officeStatus','dashboard'], resources:['notifications','alerts','audit'] },
      officeRepair: { actions:['officeQuickStatus','officeTasks','officeStatus','diagnoseSystem','officeIncidents'], resources:['notifications','alerts','audit'] },
      officeUploadDocument: { actions:['officeQuickStatus','officeTasks','officeStatus'], resources:['documents','notifications','audit'] },
      officeReportFailure: { actions:['officeQuickStatus','officeTasks','officeStatus','officeIncidents'], resources:['notifications','alerts','audit'] },
      officeGenerateReport: { actions:['officeQuickStatus','officeStatus'], resources:['reports','audit'] },
      officeResolveIncident: { actions:['officeQuickStatus','officeTasks','officeStatus','officeIncidents'], resources:['notifications','alerts','audit'] },
    };
    if (action === 'logout' || action === 'clearOperationalData') return limpiarCache();
    const impact = impacts[action];
    if (impact) invalidarCache(impact);
  }

  function iniciarActualizacionLectura(action, payload, key) {
    if (solicitudesPendientes.has(key)) return solicitudesPendientes.get(key);
    const cleanPayload = { ...payload };
    delete cleanPayload.force;
    delete cleanPayload.cache;
    const pending = remoteRequest(action, cleanPayload)
      .then(data => guardarEnCache(action, cleanPayload, data))
      .finally(() => {
        if (solicitudesPendientes.get(key) === pending) solicitudesPendientes.delete(key);
      });
    solicitudesPendientes.set(key, pending);
    return pending;
  }

  async function solicitarLecturaRemota(action, payload = {}) {
    const key = claveCache(action, payload);
    const cached = cacheRespuestas.get(key);
    const policy = politicaCache(action);
    const age = cached ? Date.now() - cached.time : Infinity;
    if (!payload.force && cached && age <= policy.vigente) return cached.data;
    if (!payload.force && cached && age <= policy.maxima) {
      iniciarActualizacionLectura(action, payload, key).catch(() => {});
      return cached.data;
    }
    try {
      return await iniciarActualizacionLectura(action, payload, key);
    } catch (error) {
      if (cached) return cached.data;
      throw error;
    }
  }

  function informacionCache(action, payload = {}) {
    const entry = cacheRespuestas.get(claveCache(action, payload));
    if (!entry) return null;
    return { action:entry.action, resource:entry.resource, time:Number(entry.time || 0), age:Date.now()-Number(entry.time || 0), origin:entry.origin || 'MEMORIA' };
  }

  function ultimaActualizacionCache(resource = '') {
    let latest = null;
    cacheRespuestas.forEach(entry => {
      if (resource && entry.resource !== resource) return;
      if (!latest || Number(entry.time || 0) > Number(latest.time || 0)) latest = entry;
    });
    return latest ? { time:Number(latest.time || 0), origin:latest.origin || 'MEMORIA', resource:latest.resource || '', action:latest.action } : null;
  }

  function descriptorConsulta(query, index) {
    const action = query.action;
    const payload = query.payload || {};
    if (!accionesLectura.has(action)) throw new Error('CONSULTA_RAPIDA_NO_PERMITIDA');
    return {
      outputKey: query.key || query.clave || String(index),
      action,
      payload,
      cacheKey: claveCache(action, payload),
    };
  }

  async function ejecutarLoteRemoto(descriptors) {
    if (!descriptors.length) return [];
    const batchPromise = (async () => {
      const consultas = descriptors.map((descriptor, index) => ({
        clave: String(index),
        accion: accionesAplicacion[descriptor.action] || descriptor.action,
        recurso: descriptor.payload.resource ? (recursosAplicacion[descriptor.payload.resource] || descriptor.payload.resource) : undefined,
        filtros: descriptor.payload.filters,
        limite: descriptor.payload.limit,
        desde: descriptor.payload.offset,
        marcaTiempo: descriptor.payload.marcaTiempo,
      }));
      let values;
      try {
        const response = await remoteRequest('quickLoad', { data:{ consultas } });
        if (!response || typeof response.resultados !== 'object') throw new Error('RESPUESTA_LOTE_NO_COMPATIBLE');
        values = descriptors.map((_, index) => response.resultados?.[String(index)] || {});
      } catch (error) {
        const codigo = String(error?.message || error || '');
        if (!['ACCION_NO_ENCONTRADA','RESPUESTA_LOTE_NO_COMPATIBLE'].includes(codigo)) throw error;
        values = await Promise.all(descriptors.map(descriptor => remoteRequest(descriptor.action, descriptor.payload)));
      }
      values.forEach((data, index) => guardarEnCache(descriptors[index].action, descriptors[index].payload, data));
      return values;
    })();
    const itemPromises = descriptors.map((descriptor, index) => batchPromise.then(values => values[index]));
    descriptors.forEach((descriptor, index) => solicitudesPendientes.set(descriptor.cacheKey, itemPromises[index]));
    try {
      return await batchPromise;
    } finally {
      descriptors.forEach((descriptor, index) => {
        if (solicitudesPendientes.get(descriptor.cacheKey) === itemPromises[index]) solicitudesPendientes.delete(descriptor.cacheKey);
      });
    }
  }

  async function requestBatch(queries, options = {}) {
    if (!Array.isArray(queries) || !queries.length) return {};
    if (!isRemote()) {
      const values = await Promise.all(queries.map(query => request(query.action, query.payload || {})));
      return queries.reduce((output, query, index) => {
        output[query.key || query.clave || String(index)] = values[index];
        return output;
      }, {});
    }
    const maximo = Number(config.PRECARGA_MAXIMA_CONSULTAS || 16);
    const descriptors = queries.slice(0, maximo).map(descriptorConsulta);
    const output = {};
    const needed = [];
    const stale = [];
    const pending = [];
    descriptors.forEach(descriptor => {
      const cached = cacheRespuestas.get(descriptor.cacheKey);
      const policy = politicaCache(descriptor.action);
      const age = cached ? Date.now() - cached.time : Infinity;
      if (!options.force && cached && age <= policy.vigente) {
        output[descriptor.outputKey] = cached.data;
      } else if (!options.force && cached && age <= policy.maxima) {
        output[descriptor.outputKey] = cached.data;
        stale.push(descriptor);
      } else if (solicitudesPendientes.has(descriptor.cacheKey)) {
        pending.push(solicitudesPendientes.get(descriptor.cacheKey).then(data => {
          output[descriptor.outputKey] = data;
        }));
      } else {
        needed.push(descriptor);
      }
    });

    if (needed.length) {
      const batch = [...needed, ...stale.filter(item => !solicitudesPendientes.has(item.cacheKey))];
      const values = await ejecutarLoteRemoto(batch);
      batch.forEach((descriptor, index) => { output[descriptor.outputKey] = values[index]; });
    } else if (stale.length) {
      ejecutarLoteRemoto(stale.filter(item => !solicitudesPendientes.has(item.cacheKey))).catch(() => {});
    }
    if (pending.length) await Promise.all(pending);
    return output;
  }

  function prefetch(queries) {
    return requestBatch(queries).catch(() => ({}));
  }


  function prepararSolicitudRemota(accion, carga) {
    const solicitud = { ...carga };
    const accionRemota = accionesAplicacion[accion] || accion;
    solicitud.recurso = carga.resource ? (recursosAplicacion[carga.resource] || carga.resource) : undefined;
    solicitud.datos = carga.data;
    solicitud.filtros = carga.filters;
    solicitud.limite = carga.limit;
    solicitud.identificador = carga.id;
    solicitud.confirmacion = carga.confirmacion || carga.confirmation;
    solicitud.fichaSesion = auth.token || '';
    solicitud.agenteNavegador = navigator.userAgent;
    delete solicitud.resource; delete solicitud.data; delete solicitud.filters;
    delete solicitud.limit; delete solicitud.id; delete solicitud.token; delete solicitud.userAgent; delete solicitud.confirmation;
    delete solicitud.force; delete solicitud.cache;
    // Compatibilidad de nombres de acciones durante la migración a Supabase.
    solicitud.accion = accionRemota;
    solicitud.action = accionRemota;
    solicitud.ACCION = accionRemota;
    return solicitud;
  }


  function esErrorAccionConexionesNoReconocida(error) {
    const codigo = String(error?.message || error || '').trim().toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    return codigo.includes('ACCION_NO_ENCONTRADA')
      || codigo.includes('ACCION_NO_RECONOCIDA')
      || codigo.includes('ACCION_DESCONOCIDA')
      || codigo.includes('ACCION NO ENCONTRADA')
      || codigo.includes('ACCION NO RECONOCIDA')
      || codigo.includes('ACCION DESCONOCIDA');
  }
  function esErrorRecuperableConexiones(error) {
    const codigo=String(error?.message||error||'').trim().toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    return esErrorAccionConexionesNoReconocida(error)
      || codigo.includes('CONEXIONES_NO_DISPONIBLES')
      || codigo.includes('CONEXIONES_Y_GPS_NO_DISPONIBLES')
      || codigo.includes('GPS_RESUMEN_NO_DISPONIBLE')
      || codigo.includes('BASE_DATOS_PGRST204')
      || codigo.includes('BASE_DATOS_42703');
  }

  function coordenadaVisibleCompatibilidad(row) {
    const lat = Number(row?.LATITUD);
    const lng = Number(row?.LONGITUD);
    const precision = Number(row?.PRECISION_METROS || 0);
    return Number.isFinite(lat) && Number.isFinite(lng)
      && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
      && !(Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001)
      && Number.isFinite(precision) && precision > 0 && precision <= 250;
  }

  function adaptarResumenTiempoRealAConexiones(resumen = {}, payload = {}) {
    const ubicaciones = (resumen.locations || resumen.ubicaciones || []).filter(coordenadaVisibleCompatibilidad);
    const porDispositivo = new Map();
    const porVehiculo = new Map();
    const porConductor = new Map();
    const porUsuario = new Map();
    ubicaciones.forEach(row => {
      const fecha = new Date(row.FECHA_HORA || row.FECHA_GPS || row.ACTUALIZADO_EN || 0).getTime() || 0;
      const guardar = (mapa, clave) => {
        if (!clave) return;
        const actual = mapa.get(String(clave));
        const actualFecha = actual ? (new Date(actual.FECHA_HORA || actual.FECHA_GPS || actual.ACTUALIZADO_EN || 0).getTime() || 0) : -1;
        if (!actual || fecha > actualFecha) mapa.set(String(clave), row);
      };
      guardar(porDispositivo, row.DISPOSITIVO_ID);
      guardar(porVehiculo, row.VEHICULO_ID);
      guardar(porConductor, row.CONDUCTOR_ID);
      guardar(porUsuario, row.USUARIO_ID);
    });
    const equipos = (resumen.devices || resumen.equipos || []).map(row => {
      const gps = porDispositivo.get(String(row.DISPOSITIVO_ID || ''))
        || porUsuario.get(String(row.USUARIO_ID || ''))
        || porVehiculo.get(String(row.VEHICULO_ID || ''))
        || porConductor.get(String(row.CONDUCTOR_ID || ''))
        || {};
      const visible = coordenadaVisibleCompatibilidad(gps);
      return {
        ...row,
        LATITUD: visible ? Number(gps.LATITUD) : '',
        LONGITUD: visible ? Number(gps.LONGITUD) : '',
        PRECISION_METROS: visible ? Number(gps.PRECISION_METROS) : '',
        FECHA_GPS: gps.FECHA_HORA || gps.FECHA_GPS || '',
        DIRECCION: gps.DIRECCION || '',
        FUENTE_GPS: gps.FUENTE || '',
        GPS_RECIENTE: Boolean(gps.FECHA_HORA || gps.FECHA_GPS),
        GPS_ACTIVO: visible ? 'SI' : String(row.GPS_ACTIVO||'NO').toUpperCase(),
        USUARIO_CORREO: row.USUARIO_CORREO || '',
        ESTADO_CONEXION: row.EN_LINEA ? 'Activo' : 'Desconectado'
      };
    });
    return {
      equipos,
      ubicaciones,
      totales: {
        equipos: equipos.length,
        activos: equipos.filter(row => row.EN_LINEA).length,
        desconectados: equipos.filter(row => !row.EN_LINEA).length,
        gpsActivos: equipos.filter(row => row.GPS_ACTIVO === 'SI' && row.LATITUD !== '').length,
        sinGps: equipos.filter(row => !(row.GPS_ACTIVO === 'SI' && row.LATITUD !== '')).length,
        segundoPlano: equipos.filter(row => row.PAGINA_VISIBLE === 'NO').length
      },
      opciones: { usuarios:[], conductores:[], vehiculos:[], dispositivos:[], redes:[], plataformas:[] },
      filtros: { ...(payload || {}) },
      serverTime: resumen.serverTime || new Date().toISOString(),
      intervaloActivoSegundos: 90,
      modoCompatibilidad: true
    };
  }


  function fechaConexionCompatibilidad(row){
    return new Date(row?.ULTIMA_CONEXION||row?.FECHA_GPS||row?.FECHA_HORA||row?.ACTUALIZADO_EN||row?.CREADO_EN||0).getTime()||0;
  }

  function construirConexionesDesdeListados(listados = {}, payload = {}) {
    const conexiones=(listados.connections?.rows||[]).filter(row=>row&&row.ELIMINADO!=='SI');
    const gps=(listados.gps?.rows||[]).filter(row=>row&&row.ELIMINADO!=='SI'&&coordenadaVisibleCompatibilidad(row));
    const users=new Map((listados.users?.rows||[]).map(row=>[String(row.ID||''),row]));
    const drivers=new Map((listados.drivers?.rows||[]).map(row=>[String(row.ID||''),row]));
    const vehicles=new Map((listados.vehicles?.rows||[]).map(row=>[String(row.ID||''),row]));
    const latestConnection=new Map(), latestDeviceGps=new Map(), latestUserGps=new Map(), latestVehicleGps=new Map(), latestDriverGps=new Map();
    const keep=(map,key,row,dateField)=>{if(!key)return;const current=map.get(String(key));const rowDate=new Date(row?.[dateField]||row?.ACTUALIZADO_EN||row?.CREADO_EN||0).getTime()||0;const currentDate=current?(new Date(current?.[dateField]||current?.ACTUALIZADO_EN||current?.CREADO_EN||0).getTime()||0):-1;if(!current||rowDate>currentDate)map.set(String(key),row);};
    conexiones.forEach(row=>keep(latestConnection,row.DISPOSITIVO_ID||row.SESION_CLIENTE_ID||row.SESION_ID||row.ID,row,'ULTIMA_CONEXION'));
    gps.forEach(row=>{keep(latestDeviceGps,row.DISPOSITIVO_ID,row,'FECHA_HORA');keep(latestUserGps,row.USUARIO_ID,row,'FECHA_HORA');keep(latestVehicleGps,row.VEHICULO_ID,row,'FECHA_HORA');keep(latestDriverGps,row.CONDUCTOR_ID,row,'FECHA_HORA');});
    const activeLimit=Date.now()-90000,gpsLimit=Date.now()-180000;
    let equipos=[...latestConnection.values()].map(row=>{
      const user=users.get(String(row.USUARIO_ID||''))||{},driver=drivers.get(String(row.CONDUCTOR_ID||''))||{},vehicle=vehicles.get(String(row.VEHICULO_ID||''))||{};
      const location=coordenadaVisibleCompatibilidad(row)?row:(latestDeviceGps.get(String(row.DISPOSITIVO_ID||''))||latestUserGps.get(String(row.USUARIO_ID||''))||latestVehicleGps.get(String(row.VEHICULO_ID||''))||latestDriverGps.get(String(row.CONDUCTOR_ID||''))||{});
      const visible=coordenadaVisibleCompatibilidad(location),last=fechaConexionCompatibilidad(row),gpsDate=new Date(location.FECHA_HORA||location.FECHA_GPS||0).getTime()||0;
      const online=last>=activeLimit&&String(row.ESTADO||'').toLowerCase()!=='desconectado';
      return {...row,USUARIO_NOMBRE:user.NOMBRE||row.USUARIO_ID||'Usuario',USUARIO_CORREO:user.CORREO||'',ROL_ID:user.ROL_ID||'',CONDUCTOR_NOMBRE:driver.NOMBRE||'',VEHICULO_PATENTE:vehicle.PATENTE||'',VEHICULO_NOMBRE:[vehicle.MARCA,vehicle.MODELO].filter(Boolean).join(' '),EN_LINEA:online,COLOR_ESTADO:online?'VERDE':'ROJO',ESTADO_CONEXION:online?'Activo':'Desconectado',GPS_RECIENTE:gpsDate>=gpsLimit,GPS_ACTIVO:visible?'SI':String(row.GPS_ACTIVO||'NO').toUpperCase(),LATITUD:visible?Number(location.LATITUD):'',LONGITUD:visible?Number(location.LONGITUD):'',PRECISION_METROS:visible?Number(location.PRECISION_METROS):'',FECHA_GPS:location.FECHA_HORA||location.FECHA_GPS||'',DIRECCION:location.DIRECCION||'',FUENTE_GPS:location.FUENTE||location.FUENTE_GPS||'',PROVEEDOR_GPS:location.PROVEEDOR||location.PROVEEDOR_GPS||'',CALIDAD_GPS:location.CALIDAD_GPS||'',BATERIA_GPS:location.BATERIA_PORCENTAJE||row.BATERIA_PORCENTAJE||''};
    });
    const clavesRepresentadas=new Set();
    equipos.forEach(row=>[row.DISPOSITIVO_ID,row.VEHICULO_ID,row.CONDUCTOR_ID].filter(Boolean).forEach(value=>clavesRepresentadas.add(String(value))));
    gps.forEach(location=>{
      const claves=[location.DISPOSITIVO_ID,location.VEHICULO_ID,location.CONDUCTOR_ID].filter(Boolean).map(String);
      if(claves.some(clave=>clavesRepresentadas.has(clave)))return;
      const driver=drivers.get(String(location.CONDUCTOR_ID||''))||{},vehicle=vehicles.get(String(location.VEHICULO_ID||''))||{},user=users.get(String(driver.USUARIO_ID||location.USUARIO_ID||''))||{};
      const gpsDate=new Date(location.FECHA_HORA||location.FECHA_GPS||location.ACTUALIZADO_EN||0).getTime()||0,online=gpsDate>=activeLimit;
      equipos.push({...location,ID:`GPS-RESPALDO-${location.ID||location.DISPOSITIVO_ID||Date.now()}`,MARCADOR_ID:`CONEXION-RESPALDO-${user.ID||driver.ID||vehicle.ID||location.DISPOSITIVO_ID||location.ID}`,USUARIO_ID:user.ID||driver.USUARIO_ID||location.USUARIO_ID||'',USUARIO_NOMBRE:user.NOMBRE||driver.NOMBRE||'Usuario con GPS',USUARIO_CORREO:user.CORREO||'',ROL_ID:user.ROL_ID||'',CONDUCTOR_NOMBRE:driver.NOMBRE||'',VEHICULO_PATENTE:vehicle.PATENTE||'',VEHICULO_NOMBRE:[vehicle.MARCA,vehicle.MODELO].filter(Boolean).join(' '),DISPOSITIVO_ID:location.DISPOSITIVO_ID||location.CLAVE_SEGUIMIENTO||location.ID||'',SECCION_ACTUAL:'seguimiento_gps',ACTIVIDAD:'Ubicación recibida por GPS',GPS_ACTIVO:'SI',PAGINA_VISIBLE:'NO',ESTADO:online?'Activo':'Desconectado',ULTIMA_CONEXION:location.FECHA_HORA||location.FECHA_GPS||location.ACTUALIZADO_EN||'',EN_LINEA:online,COLOR_ESTADO:online?'VERDE':'ROJO',ESTADO_CONEXION:online?'Activo':'Desconectado',GPS_RECIENTE:gpsDate>=gpsLimit,UBICACION_RETENIDA:gpsDate<gpsLimit,LATITUD:Number(location.LATITUD),LONGITUD:Number(location.LONGITUD),PRECISION_METROS:Number(location.PRECISION_METROS),FECHA_GPS:location.FECHA_HORA||location.FECHA_GPS||'',DIRECCION:location.DIRECCION||'',FUENTE_GPS:location.FUENTE||location.FUENTE_GPS||'GPS_ACTUAL_RESPALDO',PROVEEDOR_GPS:location.PROVEEDOR||location.PROVEEDOR_GPS||'',CALIDAD_GPS:location.CALIDAD_GPS||'',BATERIA_GPS:location.BATERIA_PORCENTAJE||''});
      claves.forEach(clave=>clavesRepresentadas.add(clave));
    });
    const data=payload.data||payload||{},norm=value=>String(value||'').trim().toUpperCase(),search=String(data.BUSCAR||data.buscar||'').trim().toLowerCase();
    const userId=String(data.USUARIO_ID||data.usuarioId||''),driverId=String(data.CONDUCTOR_ID||data.conductorId||''),vehicleId=String(data.VEHICULO_ID||data.vehiculoId||''),deviceId=String(data.DISPOSITIVO_ID||data.dispositivoId||''),state=norm(data.ESTADO||data.estado||'TODOS'),gpsState=norm(data.GPS||data.gps||'TODOS'),network=String(data.TIPO_RED||data.tipoRed||''),platform=String(data.PLATAFORMA||data.plataforma||''),precisionMax=Number(data.PRECISION_MAXIMA||data.precisionMaxima||0);
    equipos=equipos.filter(row=>{if(userId&&String(row.USUARIO_ID)!==userId)return false;if(driverId&&String(row.CONDUCTOR_ID)!==driverId)return false;if(vehicleId&&String(row.VEHICULO_ID)!==vehicleId)return false;if(deviceId&&String(row.DISPOSITIVO_ID)!==deviceId)return false;if(state==='ACTIVOS'&&!row.EN_LINEA)return false;if(state==='DESCONECTADOS'&&row.EN_LINEA)return false;if(state==='SEGUNDO_PLANO'&&row.PAGINA_VISIBLE!=='NO')return false;if(gpsState==='ACTIVO'&&!(row.GPS_ACTIVO==='SI'&&row.GPS_RECIENTE))return false;if(gpsState==='INACTIVO'&&(row.GPS_ACTIVO==='SI'&&row.GPS_RECIENTE))return false;if(gpsState==='SIN_UBICACION'&&row.LATITUD!=='')return false;if(network&&String(row.TIPO_RED||'')!==network)return false;if(platform&&!String(row.PLATAFORMA||'').toLowerCase().includes(platform.toLowerCase()))return false;if(precisionMax>0&&Number(row.PRECISION_METROS||Number.MAX_SAFE_INTEGER)>precisionMax)return false;if(search&&!`${row.USUARIO_NOMBRE} ${row.USUARIO_CORREO} ${row.DISPOSITIVO_ID} ${row.VEHICULO_PATENTE} ${row.CONDUCTOR_NOMBRE} ${row.DIRECCION||''}`.toLowerCase().includes(search))return false;return true;}).sort((a,b)=>fechaConexionCompatibilidad(b)-fechaConexionCompatibilidad(a)).slice(0,120);
    const ubicaciones=equipos.filter(row=>coordenadaVisibleCompatibilidad(row));
    return{equipos,ubicaciones,totales:{equipos:equipos.length,activos:equipos.filter(row=>row.EN_LINEA).length,desconectados:equipos.filter(row=>!row.EN_LINEA).length,gpsActivos:equipos.filter(row=>row.GPS_ACTIVO==='SI'&&row.GPS_RECIENTE&&row.LATITUD!=='').length,sinGps:equipos.filter(row=>!(row.GPS_ACTIVO==='SI'&&row.GPS_RECIENTE&&row.LATITUD!=='')).length,segundoPlano:equipos.filter(row=>row.PAGINA_VISIBLE==='NO').length},opciones:{usuarios:[...users.values()].map(row=>({ID:row.ID,NOMBRE:row.NOMBRE,CORREO:row.CORREO})),conductores:[...drivers.values()].map(row=>({ID:row.ID,NOMBRE:row.NOMBRE})),vehiculos:[...vehicles.values()].map(row=>({ID:row.ID,PATENTE:row.PATENTE})),dispositivos:[...new Set(equipos.map(row=>row.DISPOSITIVO_ID).filter(Boolean))],redes:[...new Set(equipos.map(row=>row.TIPO_RED).filter(Boolean))],plataformas:[...new Set(equipos.map(row=>row.PLATAFORMA).filter(Boolean))]},filtros:{...data},serverTime:new Date().toISOString(),intervaloActivoSegundos:90,modoCompatibilidad:true,fuenteCompatibilidad:'LISTADOS_GENERICOS'};
  }

  async function fallbackConexionesGenerico(payload={}){
    const safe=async(resource,limit)=>{try{return await remoteRequest('list',{resource,limit,force:true,cache:false});}catch(_){return{rows:[]};}};
    const [connections,gps,users,drivers,vehicles]=await Promise.all([safe('connections',2000),safe('gps',2000),safe('users',500),safe('drivers',1000),safe('vehicles',1000)]);
    return construirConexionesDesdeListados({connections,gps,users,drivers,vehicles},payload);
  }

  async function remoteRequest(action, payload) {
    const direccionAplicacion = direccionAplicacionActual();
    if (!direccionAplicacion) throw new Error('CONEXION_EMPRESA_REQUERIDA');
    const controller = new AbortController();
    const timeoutOperaciones=new Set(['operationsSummary','startOperation','finishOperation','editOperationAdmin','deleteOperationAdmin','startRoute','completeRoute','updateRouteStatus','uploadDriveFile','routeEvidenceImage','bulkImport']);
    const timeoutPublicacionAndroid=new Set(['prepararCargaActualizacionAndroid','confirmarPublicacionActualizacionAndroid']);
    const timeout=action==='connectionTrackingLive'
      ? Number(config.TIEMPO_ESPERA_SEGUIMIENTO_CONEXION_MILISEGUNDOS||8000)
      : action==='connectionsOnline'
      ? Number(config.TIEMPO_ESPERA_CONEXIONES_MILISEGUNDOS||15000)
      : timeoutPublicacionAndroid.has(action)
        ? Number(config.TIEMPO_ESPERA_PUBLICACION_ANDROID_MILISEGUNDOS||180000)
      : action==='bulkImport'
        ? Number(config.TIEMPO_ESPERA_IMPORTACION_MILISEGUNDOS||120000)
        : timeoutOperaciones.has(action)
          ? Number(config.TIEMPO_ESPERA_OPERACIONES_MILISEGUNDOS||60000)
          : Number(config.TIEMPO_ESPERA_MILISEGUNDOS||30000);
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(direccionAplicacion, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=utf-8',
          'Accept': 'application/json',
          ...cabecerasPublicasPara(direccionAplicacion)
        },
        body: JSON.stringify(prepararSolicitudRemota(action, payload)),
        signal: controller.signal,
        redirect: 'follow',
        keepalive: action === 'logout'
      });
      const text = await response.text();
      let result;
      try { result = JSON.parse(text); }
      catch (_) { throw new Error('RESPUESTA_NO_VALIDA: ' + text.slice(0, 180)); }
      if (!result.ok) {
        const codigo = result.error || 'ERROR_SERVICIO';
        if (isAuthError(codigo)) notificarSesionInvalida(codigo);
        const errorServicio = new Error(codigo);
        if (action === 'connectionsOnline' && esErrorRecuperableConexiones(errorServicio)) {
          try {
            const resumenAnterior = await remoteRequest('realtimeSummary', { ...payload, estadoConexion:'TODOS', soloGps:true, force:true, cache:false });
            return adaptarResumenTiempoRealAConexiones(resumenAnterior, payload);
          } catch (compatibilidadError) {
            // Último respaldo: no depende de ninguna acción especial del servidor.
            return fallbackConexionesGenerico(payload);
          }
        }
        if (action === 'readAlert' && esErrorAccionConexionesNoReconocida(errorServicio)) {
          return remoteRequest('update',{resource:'alerts',id:payload.id,data:{LEIDA:'SI'}});
        }
        throw errorServicio;
      }
      return result.data || {};
    } catch (error) {
      // La compatibilidad con servidores antiguos se ejecuta únicamente cuando
      // el servidor confirma que no reconoce la acción. Un corte o tiempo
      // agotado no debe disparar cinco consultas adicionales.
      if (error.name === 'AbortError') throw new Error('TIEMPO_DE_ESPERA_AGOTADO');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function digest(value) {
    if (window.crypto && crypto.subtle) {
      const bytes = new TextEncoder().encode(String(value));
      const hash = await crypto.subtle.digest('SHA-256', bytes);
      return [...new Uint8Array(hash)].map(v => v.toString(16).padStart(2, '0')).join('');
    }
    return btoa(unescape(encodeURIComponent(String(value))));
  }

  function id(prefix) {
    return `${prefix}-${crypto.randomUUID ? crypto.randomUUID().split('-')[0].toUpperCase() : Date.now().toString(36).toUpperCase()}`;
  }
  const iso = () => new Date().toISOString();
  const activeRows = rows => rows.filter(row => row.ELIMINADO !== 'SI');
  const find = (resource, recordId) => activeRows(localDb[resource] || []).find(row => row.ID === recordId);

  function seedCatalogs() {
    const now = iso();
    const roles = [
      { ID:'ROL-ADMIN', NOMBRE:'Administrador', DESCRIPCION:'Acceso completo', ESTADO:'Activo', CREADO_EN:now, ACTUALIZADO_EN:now, ELIMINADO:'NO' },
      { ID:'ROL-GERENCIA', NOMBRE:'Gerencia', DESCRIPCION:'Control total ejecutivo y operacional', ESTADO:'Activo', CREADO_EN:now, ACTUALIZADO_EN:now, ELIMINADO:'NO' },
      { ID:'ROL-SUPERVISOR', NOMBRE:'Operador', DESCRIPCION:'Todos los módulos excepto Usuarios y Conexiones en línea', ESTADO:'Activo', CREADO_EN:now, ACTUALIZADO_EN:now, ELIMINADO:'NO' },
      { ID:'ROL-CONDUCTOR', NOMBRE:'Conductor', DESCRIPCION:'Vehículo, ruta, check-in, documentos y avisos propios', ESTADO:'Activo', CREADO_EN:now, ACTUALIZADO_EN:now, ELIMINADO:'NO' }
    ];
    roles.forEach(role => { if (!activeRows(localDb.roles).some(row => row.ID === role.ID)) localDb.roles.push(role); });
    const allModules=['PANEL_PRINCIPAL','OFICINA_VIRTUAL','USUARIOS','VEHICULOS','CONDUCTORES','OPERACIONES','CHECKIN','CHECKIN_APROBACIONES','GPS','HISTORIAL','MANTENCIONES','COMBUSTIBLE','DOCUMENTOS','ALERTAS','REPORTES','BITACORA','CONFIGURACION','QR','RUTAS','NOTIFICACIONES','CONEXIONES'];
    const actions=['LEER','CREAR','ACTUALIZAR','ELIMINAR'];
    const gerenteModules=new Set(allModules.filter(module=>module!=='CONFIGURACION'));
    const supervisorModules=new Set(allModules.filter(module=>!['USUARIOS','CONEXIONES'].includes(module)));
    const driverRules={
      PANEL_PRINCIPAL:['LEER'],VEHICULOS:['LEER'],CONDUCTORES:['LEER'],CHECKIN:['LEER','CREAR'],GPS:['CREAR'],COMBUSTIBLE:['LEER','CREAR'],DOCUMENTOS:['LEER','CREAR'],ALERTAS:['LEER','ACTUALIZAR'],
      OFICINA_VIRTUAL:['LEER','CREAR'],RUTAS:['LEER','ACTUALIZAR'],NOTIFICACIONES:['LEER','ACTUALIZAR']
    };
    const ensure=(role,module,action,allowed)=>{
      const existing=localDb.permissions.find(row=>row.ROL_ID===role&&row.MODULO===module&&row.ACCION===action);
      if(!existing){
        localDb.permissions.push({ID:id('PER'),ROL_ID:role,MODULO:module,ACCION:action,PERMITIDO:allowed?'SI':'NO',CREADO_EN:now,ACTUALIZADO_EN:now,ELIMINADO:'NO'});
      }else{
        existing.PERMITIDO=allowed?'SI':'NO';existing.ELIMINADO='NO';existing.ACTUALIZADO_EN=now;
      }
    };
    allModules.forEach(module=>actions.forEach(action=>ensure('ROL-ADMIN',module,action,true)));
    allModules.forEach(module=>actions.forEach(action=>ensure('ROL-GERENCIA',module,action,true)));
    allModules.forEach(module=>actions.forEach(action=>ensure('ROL-SUPERVISOR',module,action,supervisorModules.has(module)&&(module==='OFICINA_VIRTUAL'?['LEER','CREAR'].includes(action):(action!=='ELIMINAR'||module==='COMBUSTIBLE')))));
    allModules.forEach(module=>actions.forEach(action=>ensure('ROL-CONDUCTOR',module,action,(driverRules[module]||[]).includes(action))));
    const buttonDefaults={
      'USUARIOS:GESTIONAR_PERMISOS':['ROL-ADMIN'],'USUARIOS:DESACTIVAR':['ROL-ADMIN'],
      'VEHICULOS:IMPRIMIR_QR':['ROL-ADMIN','ROL-SUPERVISOR'],'VEHICULOS:IMPORTAR':['ROL-ADMIN','ROL-SUPERVISOR'],'CONDUCTORES:IMPORTAR':['ROL-ADMIN','ROL-SUPERVISOR'],
      'DOCUMENTOS:VER_ARCHIVO':['ROL-ADMIN','ROL-SUPERVISOR','ROL-CONDUCTOR'],'DOCUMENTOS:CARGAR_PROPIO':['ROL-ADMIN','ROL-SUPERVISOR','ROL-CONDUCTOR'],'DOCUMENTOS:IMPORTAR':['ROL-ADMIN','ROL-SUPERVISOR'],'DOCUMENTOS:APROBAR':['ROL-ADMIN'],'DOCUMENTOS:RECHAZAR':['ROL-ADMIN'],'DOCUMENTOS:APROBAR':['ROL-ADMIN'],'DOCUMENTOS:RECHAZAR':['ROL-ADMIN'],
      'OPERACIONES:INICIAR':['ROL-ADMIN','ROL-SUPERVISOR','ROL-CONDUCTOR'],'OPERACIONES:FINALIZAR':['ROL-ADMIN','ROL-SUPERVISOR','ROL-CONDUCTOR'],'OPERACIONES:CIERRE_EXCEPCIONAL':['ROL-ADMIN','ROL-SUPERVISOR'],'OPERACIONES:EDITAR_ADMIN':['ROL-ADMIN'],'OPERACIONES:ELIMINAR_ADMIN':['ROL-ADMIN'],
      'CONFIGURACION:GESTIONAR_PUNTO_BASE':['ROL-ADMIN','ROL-SUPERVISOR'],'CONFIGURACION:LIMPIAR_DATOS':['ROL-ADMIN'],
      'CHECKIN:VALIDAR_QR':['ROL-ADMIN','ROL-SUPERVISOR','ROL-CONDUCTOR'],'CHECKIN:ASIGNAR_VEHICULO':['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'],'CHECKIN_APROBACIONES:APROBAR':['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'],'CHECKIN_APROBACIONES:RECHAZAR':['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'],
      'RUTAS:NAVEGAR':['ROL-ADMIN','ROL-SUPERVISOR','ROL-CONDUCTOR'],'RUTAS:INICIAR':['ROL-ADMIN','ROL-SUPERVISOR','ROL-CONDUCTOR'],'RUTAS:COMPLETAR':['ROL-ADMIN','ROL-SUPERVISOR','ROL-CONDUCTOR'],'RUTAS:CANCELAR':['ROL-ADMIN','ROL-SUPERVISOR'],'RUTAS:REASIGNAR':['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'],'RUTAS:CARGAR_EVIDENCIA':['ROL-ADMIN','ROL-SUPERVISOR','ROL-CONDUCTOR'],
      'COMBUSTIBLE:REGISTRAR':['ROL-ADMIN','ROL-SUPERVISOR','ROL-CONDUCTOR'],'COMBUSTIBLE:EDITAR':['ROL-ADMIN','ROL-SUPERVISOR'],'COMBUSTIBLE:SOLICITAR_ELIMINACION':['ROL-SUPERVISOR'],'COMBUSTIBLE:AUTORIZAR_ELIMINACION':['ROL-ADMIN'],'COMBUSTIBLE:ELIMINAR':['ROL-ADMIN','ROL-SUPERVISOR'],
      'NOTIFICACIONES:ENVIAR':['ROL-ADMIN','ROL-SUPERVISOR'],'NOTIFICACIONES:MARCAR_LEIDA':['ROL-ADMIN','ROL-SUPERVISOR','ROL-CONDUCTOR'],'NOTIFICACIONES:ACEPTAR_ASIGNACIONES_AJENAS':[],'ALERTAS:ENVIAR':['ROL-ADMIN','ROL-SUPERVISOR'],'ALERTAS:CERRAR':['ROL-ADMIN'],
      'CONEXIONES:SEGUIR':['ROL-ADMIN'],'CONEXIONES:ENVIAR_AVISO':['ROL-ADMIN'],
      'REPORTES:EXPORTAR_CSV':['ROL-ADMIN','ROL-SUPERVISOR'],'REPORTES:EXPORTAR_XLSX':['ROL-ADMIN','ROL-SUPERVISOR'],'REPORTES:EXPORTAR_PDF':['ROL-ADMIN','ROL-SUPERVISOR'],
      'OFICINA_VIRTUAL:DIAGNOSTICAR':['ROL-ADMIN','ROL-SUPERVISOR'],'OFICINA_VIRTUAL:REPORTAR_FALLA':['ROL-ADMIN','ROL-SUPERVISOR','ROL-CONDUCTOR'],'OFICINA_VIRTUAL:GENERAR_REPORTE':['ROL-ADMIN','ROL-SUPERVISOR'],'OFICINA_VIRTUAL:REPARAR':['ROL-ADMIN'],'OFICINA_VIRTUAL:CONFIGURAR':['ROL-ADMIN']
    };
    Object.entries(buttonDefaults).forEach(([key,roles])=>{const [module,action]=key.split(':');['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR','ROL-CONDUCTOR'].forEach(role=>ensure(role,module,action,role==='ROL-GERENCIA'||roles.includes(role)));});
  }

  function audit(user, action, module, detail, recordId = '') {
    localDb.audit.unshift({
      ID:id('BIT'), USUARIO_ID:user?.ID || '', USUARIO_NOMBRE:user?.NOMBRE || 'Sistema', ACCION:action,
      MODULO:module, REGISTRO_ID:recordId, DETALLE:detail, IP_CLIENTE:'', FECHA_HORA:iso(), CREADO_EN:iso(), ELIMINADO:'NO'
    });
  }

  async function localRequest(action, payload) {
    await Promise.resolve();
    switch (action) {
      case 'health': return { service:'Base de datos local del Sistema de Gestión de Flotas', version:'4.2.48', now:iso() };
      case 'status': return {
        connected:true, needsSetup:activeRows(localDb.users).length === 0, spreadsheetName:'Base local del navegador',
        rows:{ users:activeRows(localDb.users).length, vehicles:activeRows(localDb.vehicles).length,
          drivers:activeRows(localDb.drivers).length, operations:activeRows(localDb.operations).length },
        company: cleanRow(localPrimaryCompany() || null)
      };
      case 'bootstrap': {
        if (activeRows(localDb.users).length) throw new Error('SISTEMA_YA_INICIALIZADO');
        if (!payload.nombre || !payload.correo || String(payload.contrasena ?? '').length === 0) throw new Error('DATOS_DE_ADMINISTRADOR_INVALIDOS');
        if (String(payload.contrasenaConfirmacion || payload.contrasena) !== String(payload.contrasena)) throw new Error('CONTRASENAS_NO_COINCIDEN');
        seedCatalogs();
        const salt = id('SALT');
        const user = {
          ID:id('USR'), NOMBRE:payload.nombre.trim(), CORREO:payload.correo.trim().toLowerCase(),
          SAL_CONTRASENA:salt, CONTRASENA_CIFRADA:await digest(payload.contrasena + ':' + salt), ROL_ID:'ROL-ADMIN',
          ESTADO:'Activo', TELEFONO:payload.telefono || '', ULTIMO_ACCESO:'', CREADO_EN:iso(), ACTUALIZADO_EN:iso(), ELIMINADO:'NO'
        };
        localDb.users.push(user);
        if(payload.nombreEmpresa){localDb.companies.push({ID:id('EMP'),RUT:payload.rutEmpresa||'',RAZON_SOCIAL:payload.nombreEmpresa,NOMBRE_FANTASIA:payload.nombreEmpresa,TELEFONO_PRINCIPAL:payload.telefonoEmpresa||payload.telefono||'',CORREO:payload.correo,PAIS:'Chile',ZONA_HORARIA:'America/Santiago',MONEDA:'CLP',UNIDAD_DISTANCIA:'km',COLOR_PRINCIPAL:'#0E9F91',COLOR_SECUNDARIO:'#08746B',COLOR_ACENTO:'#3578E5',COLOR_FONDO:'#F3F7FA',COLOR_SUPERFICIE:'#FFFFFF',COLOR_TEXTO:'#173047',COLOR_TEXTO_SECUNDARIO:'#65798B',COLOR_BORDE:'#DCE6EC',COLOR_MENU:'#071725',COLOR_MENU_SECUNDARIO:'#0D2638',COLOR_EXITO:'#0E9F91',COLOR_ADVERTENCIA:'#D89216',COLOR_PELIGRO:'#DC4D60',COLOR_FONDO_OSCURO:'#071725',COLOR_SUPERFICIE_OSCURO:'#0D2638',COLOR_TEXTO_OSCURO:'#E9F1F7',COLOR_TEXTO_SECUNDARIO_OSCURO:'#9EB0BF',COLOR_BORDE_OSCURO:'#214359',TEMA_PREDETERMINADO:'Sistema',ESTADO:'Activo',CREADO_EN:iso(),ACTUALIZADO_EN:iso(),ELIMINADO:'NO'});}
        audit(user,'INSTALACION_INICIAL','SEGURIDAD','Preconfiguración automática y administrador inicial creados',user.ID); saveLocal();
        return { initialized:true, user:publicUser(user), companyConfigured:Boolean(payload.nombreEmpresa) };
      }
      case 'login': {
        seedCatalogs();
        const email = String(payload.correo || '').trim().toLowerCase();
        const user = activeRows(localDb.users).find(row => row.CORREO === email && row.ESTADO === 'Activo');
        if (!user || user.CONTRASENA_CIFRADA !== await digest(String(payload.contrasena || '') + ':' + user.SAL_CONTRASENA)) throw new Error('CREDENCIALES_INVALIDAS');
        const association=localAssociateDriverByEmail(user,'INICIO_SESION');
        const token = id('TOKEN') + id('TOKEN');
        user.ULTIMO_ACCESO = iso(); user.ACTUALIZADO_EN = iso();
        const loginIp=String(payload.IP_PUBLICA||payload.ipPublica||'').trim();const sessionRow={ ID:id('SES'), USUARIO_ID:user.ID, FICHA_SESION_CIFRADA:await digest(token), FECHA_INICIO:iso(), FECHA_EXPIRACION:new Date(Date.now()+72*3600000).toISOString(), ACTIVA:'SI', IP_PUBLICA:loginIp, IP_VERSION:loginIp.includes(':')?'IPv6':loginIp?'IPv4':'', IP_CAPTURADA_EN:loginIp?iso():'' };
        localDb.sessions.push(sessionRow);
        audit(user,'INICIO_SESION','SEGURIDAD','Inicio de sesión correcto',user.ID); saveLocal();
        setAuth({ token, sessionId:sessionRow.ID, user:publicUser(user) });
        return { token, sessionId:sessionRow.ID, user:publicUser(user), asociacionConductor:{CONDUCTOR_ID:association.driver?.ID||'',ASOCIADO_AUTOMATICAMENTE:association.linked,MOTIVO:association.reason}, expiresAt:new Date(Date.now()+72*3600000).toISOString() };
      }
      case 'logout': {
        const user=currentLocalUser(),sessionId=auth.sessionId||'';if(user){audit(user,'CIERRE_SESION','SEGURIDAD','Cierre de sesión',user.ID);const session=find('sessions',sessionId);if(session){session.ACTIVA='NO';session.ULTIMO_USO=iso();}activeRows(localDb.connections).filter(row=>row.SESION_ID===sessionId).forEach(row=>{row.ESTADO='Desconectado';row.ACTIVIDAD='Inactivo';row.PAGINA_VISIBLE='NO';row.ULTIMA_CONEXION=iso();row.ACTUALIZADO_EN=iso();});}
        setAuth({}); saveLocal(); return { loggedOut:true };
      }
      case 'me': seedCatalogs(); return { user:publicUser(requireLocalUser()) };
      case 'dashboard': return panelPrincipalLocal();
      case 'operationsSummary': return localOperationsSummary(payload);
      case 'reportsKpiSummary': return localReportsKpiSummary(payload);
      case 'reportsKpiDetail': return localReportsKpiDetail(payload);
      case 'fuelSummary': return localFuelSummary();
      case 'list': return localList(payload);
      case 'get': {
        const user=requireLocalUser(),key=resourceMap[payload.resource];requireLocalPermission(user,moduleByResource[key],'LEER');const row = find(key, payload.id);
        if (!row) throw new Error('REGISTRO_NO_ENCONTRADO'); if(!localFilterRows(key,[row],user).length)throw new Error('PERMISO_DENEGADO');return { row:key==='users'?publicUser(row):cleanRow(row), total:1 };
      }
      case 'create': return localCreate(payload);
      case 'update': return localUpdate(payload);
      case 'delete': return localDelete(payload);
      case 'startOperation': return localStartOperation(payload);
      case 'finishOperation': return localFinishOperation(payload);
      case 'editOperationAdmin': return localEditOperationAdmin(payload);
      case 'deleteOperationAdmin': return localDeleteOperationAdmin(payload);
      case 'diagnoseAvailability': return localDiagnoseAvailability(payload);
      case 'assignCheckinVehicle': return localAssignCheckinVehicle(payload);
      case 'currentCheckinAssignment': return localCurrentCheckinAssignment(payload);
      case 'createVehicleCheckin': return localCreateVehicleCheckin(payload);
      case 'reviewVehicleCheckin': return localReviewVehicleCheckin(payload);
      case 'availableCheckins': return localAvailableCheckins(payload);
      case 'validateRouteCheckin': return localValidateRouteCheckin(payload);
      case 'validateVehicleQr': return localValidateVehicleQr(payload);
      case 'vehicleQrLabel': return localVehicleQrLabel(payload);
      case 'saveLocation': return localSaveLocation(payload);
      case 'latestLocations': return localLatestLocations(payload);
      case 'routeSyncState': return localRouteSyncState();
      case 'assignRoute': return localAssignRoute(payload);
      case 'startRoute': return localUpdateRouteStatus({...payload,ESTADO:'En curso'});
      case 'completeRoute': return localUpdateRouteStatus({...payload,ESTADO:'Completada'});
      case 'updateRouteStatus': return localUpdateRouteStatus(payload);
      case 'registerRouteEvidence': return localRegisterRouteEvidence(payload);
      case 'routeEvidenceImage': throw new Error('ARCHIVO_REQUIERE_CONEXION_CENTRAL');
      case 'routeWeather': throw new Error('CLIMA_REQUIERE_CONEXION_CENTRAL');
      case 'backupCatalog': return localBackupCatalog();
      case 'backupTable': return localBackupTable(payload);
      case 'sendNotification': return localSendNotification(payload);
      case 'readNotification': return localReadNotification(payload);
      case 'pendingNotices': return localPendingNotices(payload);
      case 'assignmentAlerts': return localAssignmentAlerts(payload);
      case 'respondAssignmentAlert': return localRespondAssignmentAlert(payload);
      case 'resendAssignmentAlert': return localResendAssignmentAlert(payload);
      case 'readAlert': return localReadAlert(payload);
      case 'heartbeat': return localHeartbeat(payload);
      case 'realtimeSummary': return localRealtimeSummary(payload);
      case 'connectionsOnline': return localConnectionsOnline(payload);
      case 'saveConnectionTracking': return localSaveConnectionTracking(payload);
      case 'connectionTrackingLive': return localConnectionTrackingLive(payload);
      case 'sendConnectionsNotice': return localSendConnectionsNotice(payload);
      case 'disconnectConnectedUser': return localDisconnectConnectedUser(payload);
      case 'diagnoseSystem': return localDiagnoseSystem();
      case 'repairSystem': return localRepairSystem();
      case 'officeQuickStatus': return localOfficeQuickStatus();
      case 'officeTasks': return localOfficeTasksResponse();
      case 'officeStatus': return localOfficeStatus();
      case 'officeAsk': return localOfficeAsk(payload);
      case 'officeAutoMode': return localOfficeAutoMode(payload);
      case 'officeRun': return localOfficeRun();
      case 'officeRepair': return localOfficeRepair();
      case 'officeUploadDocument': throw new Error('CARGA_DOCUMENTAL_REQUIERE_CONEXION_CENTRAL');
      case 'officeReportFailure': return localOfficeReportFailure(payload);
      case 'officeGenerateReport': return localOfficeGenerateReport(payload);
      case 'officeIncidents': return {rows:activeRows(localDb.alerts).filter(row=>row.TIPO==='NEXO IA'),total:activeRows(localDb.alerts).filter(row=>row.TIPO==='NEXO IA').length};
      case 'officeResolveIncident': return localOfficeResolveIncident(payload);
      case 'changePassword': return localChangePassword(payload);
      case 'saveUserPermissions': return localSaveUserPermissions(payload);
      case 'saveCompany': return localSaveCompany(payload);
      case 'saveOperationalPoint': return localSaveOperationalPoint(payload);
      case 'getOperationalPoint': return localGetOperationalPoint();
      case 'bulkImport': return localBulkImport(payload);
      case 'registerConnectionIp': return localRegisterConnectionIp(payload);
      case 'requestFuelDeletion': return localRequestFuelDeletion(payload);
      case 'resolveFuelDeletion': return localResolveFuelDeletion(payload);
      case 'deleteFuel': return localDeleteFuel(payload);
      case 'runAutomaticAlerts': return localRunAutomaticAlerts();
      case 'approveDocument': return localReviewDocument(payload,'APROBAR');
      case 'rejectDocument': return localReviewDocument(payload,'RECHAZAR');
      case 'uploadDriveFile': throw new Error('DRIVE_REQUIERE_CONEXION_CENTRAL');
      case 'clearOperationalData': return localClear(payload);
      default: throw new Error('ACCION_NO_ENCONTRADA');
    }
  }


  function localDisconnectConnectedUser(payload={}){
    const admin=requireLocalUser();if(!isAdmin(admin))throw new Error('SOLO_ADMINISTRADOR');requireLocalPermission(admin,'CONEXIONES','DESCONECTAR_USUARIO');
    const data=payload.data||payload,userId=String(data.USUARIO_ID||'').trim(),reason=String(data.MOTIVO||'').trim();
    if(!userId)throw new Error('USUARIO_REQUERIDO');if(userId===admin.ID)throw new Error('NO_PUEDE_DESCONECTAR_SU_PROPIA_SESION');if(reason.length<5)throw new Error('MOTIVO_DESCONEXION_REQUERIDO');
    const target=activeRows(localDb.users).find(row=>row.ID===userId);if(!target)throw new Error('USUARIO_NO_ENCONTRADO');
    let sessionsClosed=0,connectionsClosed=0;activeRows(localDb.sessions).filter(row=>row.USUARIO_ID===userId&&row.ACTIVA==='SI').forEach(row=>{row.ACTIVA='NO';row.ULTIMO_USO=iso();sessionsClosed++;});
    activeRows(localDb.connections).filter(row=>row.USUARIO_ID===userId).forEach(row=>{row.ESTADO='Desconectado';row.GPS_ACTIVO='NO';row.PAGINA_VISIBLE='NO';row.ACTIVIDAD='Sesión cerrada por Administrador';row.ULTIMA_CONEXION=iso();row.ACTUALIZADO_EN=iso();connectionsClosed++;});
    localDb.notifications.push({ID:id('NOT'),DESTINATARIO_USUARIO_ID:userId,TITULO:'Sesión cerrada por un Administrador',MENSAJE:`Motivo: ${reason}`,TIPO:'Seguridad',PRIORIDAD:'Alta',LEIDA:'NO',FECHA_ENVIO:iso(),CREADO_POR:admin.ID,CREADO_EN:iso(),ACTUALIZADO_EN:iso(),ELIMINADO:'NO'});
    audit(admin,'DESCONECTAR_USUARIO','CONEXIONES',`${target.NOMBRE||target.CORREO} · ${reason}`,userId);saveLocal();return{usuarioId:userId,usuarioNombre:target.NOMBRE||target.CORREO||userId,sesionesCerradas:sessionsClosed,conexionesCerradas:connectionsClosed,desconectadoEn:iso(),persistenciaConfirmada:true};
  }

  function localReviewDocument(payload={},decision='APROBAR'){
    const user=requireLocalUser();if(!['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'].includes(user.ROL_ID))throw new Error('PERMISO_DENEGADO');requireLocalPermission(user,'DOCUMENTOS',decision==='APROBAR'?'APROBAR':'RECHAZAR');const data=payload.data||payload,row=find('documents',data.DOCUMENTO_ID||data.ID||payload.id);if(!row)throw new Error('DOCUMENTO_NO_ENCONTRADO');const observation=String(data.OBSERVACION_REVISION||'').trim();if(decision==='RECHAZAR'&&observation.length<5)throw new Error('MOTIVO_RECHAZO_REQUERIDO');Object.assign(row,{ESTADO_REVISION:decision==='APROBAR'?'Aprobado':'Rechazado',REVISADO_POR_USUARIO_ID:user.ID,REVISADO_POR_CORREO:user.CORREO,FECHA_REVISION:iso(),OBSERVACION_REVISION:observation||(decision==='APROBAR'?'Documento aprobado por Administración o Gerencia.':''),ACTUALIZADO_EN:iso()});audit(user,decision==='APROBAR'?'APROBAR_DOCUMENTO':'RECHAZAR_DOCUMENTO','DOCUMENTOS',row.ESTADO_REVISION,row.ID);saveLocal();return{row:cleanRow(row),persistenciaConfirmada:true};
  }

  function localOfficeReportFailure(payload={}){const user=requireLocalUser(),d=payload.data||payload,now=iso(),row={ID:id('ALT'),TIPO:'NEXO IA',NIVEL:d.SEVERIDAD||'Advertencia',TITULO:d.TITULO||'Falla informada',MENSAJE:d.DESCRIPCION||d.MENSAJE||'',MODULO:d.MODULO||'GENERAL',REGISTRO_ID:user.ID,CLAVE_UNICA:id('OV-LOCAL'),LEIDA:'NO',USUARIO_ID:user.ID,FECHA_HORA:now,CREADO_EN:now,ACTUALIZADO_EN:now,ELIMINADO:'NO'};localDb.alerts.push(row);audit(user,'INFORMAR_FALLA','OFICINA_VIRTUAL',row.TITULO,row.ID);saveLocal();return{row,registrada:true,administradoresInformados:false};}
  function localOfficeGenerateReport(){const user=requireLocalUser(),report={tipo:'SALUD_SISTEMA',generadoEn:iso(),generadoPor:publicUser(user),diagnostico:localDiagnoseSystem(),estadoOficina:localOfficeQuickStatus(),incidentes:activeRows(localDb.alerts).filter(row=>row.TIPO==='NEXO IA')};return{row:{ID:id('OVR'),TITULO:'Reporte local de salud',FECHA_HORA:iso()},reporte:report,resumen:'Reporte generado en modo local.'};}
  function localOfficeResolveIncident(payload={}){const user=requireLocalUser();if(!isAdmin(user))throw new Error('SOLO_ADMINISTRADOR');const idValue=payload.data?.ID||payload.id,row=activeRows(localDb.alerts).find(item=>item.ID===idValue);if(!row)throw new Error('REGISTRO_NO_ENCONTRADO');row.LEIDA='SI';row.FECHA_LECTURA=iso();row.LEIDA_POR=user.ID;row.ACTUALIZADO_EN=iso();saveLocal();return{row:cleanRow(row)};}

  function currentLocalUser() {
    return auth.user?.ID ? activeRows(localDb.users).find(row => row.ID === auth.user.ID) : null;
  }
  function requireLocalUser() {
    const user = currentLocalUser(); if (!user) throw new Error('AUTENTICACION_REQUERIDA'); return user;
  }
  const moduleByResource={
    users:'USUARIOS',roles:'USUARIOS',permissions:'USUARIOS',vehicles:'VEHICULOS',drivers:'CONDUCTORES',
    operations:'OPERACIONES',gps:'GPS',history:'HISTORIAL',maintenance:'MANTENCIONES',documents:'DOCUMENTOS',
    alerts:'ALERTAS',reports:'REPORTES',audit:'BITACORA',parameters:'CONFIGURACION',companies:'CONFIGURACION',
    qr:'QR',routes:'RUTAS',notifications:'NOTIFICACIONES',connections:'CONEXIONES',checkins:'CHECKIN',fuel:'COMBUSTIBLE',fuelAuthorizations:'COMBUSTIBLE'
  };
  const mandatoryLocalPermissions=['PANEL_PRINCIPAL:LEER','CONEXIONES:CREAR','CONEXIONES:ACTUALIZAR'];
  const localButtonPermissions=["USUARIOS:GESTIONAR_PERMISOS", "USUARIOS:DESACTIVAR", "VEHICULOS:IMPRIMIR_QR", "VEHICULOS:IMPORTAR", "CONDUCTORES:IMPORTAR", "DOCUMENTOS:VER_ARCHIVO", "DOCUMENTOS:CARGAR_PROPIO", "DOCUMENTOS:IMPORTAR", "DOCUMENTOS:APROBAR", "DOCUMENTOS:RECHAZAR", "OPERACIONES:INICIAR", "OPERACIONES:FINALIZAR", "OPERACIONES:CIERRE_EXCEPCIONAL", "OPERACIONES:EDITAR_ADMIN", "OPERACIONES:ELIMINAR_ADMIN", "CONFIGURACION:GESTIONAR_PUNTO_BASE", "CONFIGURACION:LIMPIAR_DATOS", "CONFIGURACION:RESPALDO_GENERAL", "CHECKIN:VALIDAR_QR", "CHECKIN:ASIGNAR_VEHICULO", "CHECKIN_APROBACIONES:APROBAR", "CHECKIN_APROBACIONES:RECHAZAR", "RUTAS:NAVEGAR", "RUTAS:INICIAR", "RUTAS:COMPLETAR", "RUTAS:CANCELAR", "RUTAS:REASIGNAR", "RUTAS:CARGAR_EVIDENCIA", "COMBUSTIBLE:REGISTRAR", "COMBUSTIBLE:EDITAR", "COMBUSTIBLE:SOLICITAR_ELIMINACION", "COMBUSTIBLE:AUTORIZAR_ELIMINACION", "COMBUSTIBLE:ELIMINAR", "NOTIFICACIONES:ENVIAR", "NOTIFICACIONES:MARCAR_LEIDA", "NOTIFICACIONES:ACEPTAR_ASIGNACIONES_AJENAS", "ALERTAS:ENVIAR", "ALERTAS:CERRAR", "CONEXIONES:SEGUIR", "CONEXIONES:ENVIAR_AVISO", "CONEXIONES:DESCONECTAR_USUARIO", "REPORTES:EXPORTAR_CSV", "REPORTES:EXPORTAR_XLSX", "REPORTES:EXPORTAR_PDF", "OFICINA_VIRTUAL:DIAGNOSTICAR", "OFICINA_VIRTUAL:REPORTAR_FALLA", "OFICINA_VIRTUAL:GENERAR_REPORTE", "OFICINA_VIRTUAL:REPARAR", "OFICINA_VIRTUAL:CONFIGURAR"];
  function normalizeLocalPermissions(value){let list=value;if(typeof list==='string'){try{list=JSON.parse(list||'[]');}catch(_){list=[];}}if(!Array.isArray(list))list=[];return [...new Set(list.map(item=>String(item||'').trim().toUpperCase()).filter(item=>/^[A-Z_]+:[A-Z_]+$/.test(item)))].sort();}
  function effectiveLocalPermissions(user){if(!user)return[];if(user.ROL_ID==='ROL-ADMIN')return['*:*'];const role=activeRows(localDb.permissions).filter(row=>row.ROL_ID===user.ROL_ID&&row.PERMITIDO==='SI').map(row=>`${row.MODULO}:${row.ACCION}`),personalized=String(user.MODO_PERMISOS||'ROL').toUpperCase()==='PERSONALIZADO',custom=normalizeLocalPermissions(user.PERMISOS_PERSONALIZADOS),base=personalized?custom:role;return[...new Set([...base,...mandatoryLocalPermissions])].sort();}
  function hasLocalPermission(user,module,action) {
    if(user?.ROL_ID==='ROL-ADMIN')return true;
    if(user?.ROL_ID==='ROL-SUPERVISOR'&&['USUARIOS','CONEXIONES'].includes(String(module||'').toUpperCase()))return false;
    return effectiveLocalPermissions(user).includes(`${module}:${action}`);
  }
  function requireLocalPermission(user,module,action){if(!hasLocalPermission(user,module,action))throw new Error('PERMISO_DENEGADO');}
  function localDriver(user){const linked=activeRows(localDb.drivers).filter(row=>row.USUARIO_ID===user?.ID);return linked.length===1?linked[0]:null;}
  function localEmail(value){return String(value||'').trim().toLowerCase();}
  function localAssociateDriverByEmail(user,source='SESION'){
    if(!user?.ID)return{driver:null,linked:false,reason:'USUARIO_SIN_ID'};
    const linked=activeRows(localDb.drivers).filter(row=>String(row.USUARIO_ID||'')===String(user.ID));
    if(linked.length===1){if(!localEmail(linked[0].CORREO)&&localEmail(user.CORREO))linked[0].CORREO=localEmail(user.CORREO);return{driver:linked[0],linked:false,reason:'ASOCIACION_EXISTENTE'};}
    if(linked.length>1){if(source!=='SESION_ACTIVA')audit(user,'CONFLICTO_ASOCIACION_CONDUCTOR','CONDUCTORES',`El usuario ${user.CORREO||user.ID} tiene ${linked.length} conductores activos.`,user.ID);return{driver:null,linked:false,reason:'USUARIO_ASOCIADO_A_MULTIPLES_CONDUCTORES'};}
    const email=localEmail(user.CORREO);if(!email)return{driver:null,linked:false,reason:'USUARIO_SIN_CORREO'};
    if(String(user.ROL_ID||'').toUpperCase()!=='ROL-CONDUCTOR')return{driver:null,linked:false,reason:'ROL_NO_CONDUCTOR'};
    const matches=activeRows(localDb.drivers).filter(row=>localEmail(row.CORREO)===email);
    if(matches.length!==1){if(matches.length>1&&source!=='SESION_ACTIVA')audit(user,'CONFLICTO_CORREO_CONDUCTOR','CONDUCTORES',`El correo ${email} coincide con ${matches.length} conductores.`,user.ID);return{driver:null,linked:false,reason:matches.length?'CORREO_CONDUCTOR_AMBIGUO':'CONDUCTOR_NO_ENCONTRADO_POR_CORREO'};}
    const driver=matches[0],assigned=String(driver.USUARIO_ID||'');if(assigned&&assigned!==String(user.ID))return{driver:null,linked:false,reason:'CONDUCTOR_ASOCIADO_A_OTRO_USUARIO'};
    driver.USUARIO_ID=user.ID;driver.CORREO=driver.CORREO||email;driver.ACTUALIZADO_EN=iso();audit(user,'ASOCIAR_CONDUCTOR_POR_CORREO','CONDUCTORES',`Conductor ${driver.NOMBRE||driver.ID} asociado automáticamente a ${user.CORREO}. Origen: ${source}.`,driver.ID);return{driver,linked:true,reason:'ASOCIADO_POR_CORREO'};
  }
  function localEnsureCheckinDriverUser(driver,actor){
    if(String(driver?.USUARIO_ID||''))return{driver,linked:false,reason:'RELACION_EXISTENTE'};
    const email=localEmail(driver?.CORREO);if(!email)return{driver,linked:false,reason:'CONDUCTOR_SIN_CORREO'};
    const users=activeRows(localDb.users).filter(row=>localEmail(row.CORREO)===email&&row.ESTADO==='Activo'&&row.ROL_ID==='ROL-CONDUCTOR');
    if(users.length!==1)return{driver,linked:false,reason:users.length?'CORREO_USUARIO_AMBIGUO':'USUARIO_CONDUCTOR_NO_ENCONTRADO'};
    const relation=localAssociateDriverByEmail(users[0],'ASIGNACION_VEHICULO_CHECKIN');
    if(relation.driver?.ID!==driver.ID)return{driver,linked:false,reason:relation.reason};
    if(relation.linked)audit(actor,'RELACIONAR_USUARIO_CONDUCTOR_CHECKIN','CHECKIN',`Usuario ${users[0].CORREO} vinculado al conductor ${driver.NOMBRE||driver.ID}.`,driver.ID);
    return relation;
  }
  function localPrepareDriverAssociation(data,driverId=''){
    const result={...(data||{})},hasUser=Object.prototype.hasOwnProperty.call(result,'USUARIO_ID'),hasEmail=Object.prototype.hasOwnProperty.call(result,'CORREO');
    let userId=String(result.USUARIO_ID||'').trim(),email=localEmail(result.CORREO);
    if(userId){const user=activeRows(localDb.users).find(row=>row.ID===userId&&row.ESTADO==='Activo');if(!user)throw new Error('USUARIO_ID_NO_EXISTE');if(String(user.ROL_ID||'').toUpperCase()!=='ROL-CONDUCTOR')throw new Error('USUARIO_ASOCIADO_DEBE_SER_CONDUCTOR');const other=activeRows(localDb.drivers).find(row=>row.USUARIO_ID===userId&&String(row.ID)!==String(driverId));if(other)throw new Error('USUARIO_YA_ASOCIADO_A_OTRO_CONDUCTOR');result.USUARIO_ID=userId;if(!email)result.CORREO=localEmail(user.CORREO);return result;}
    if(hasUser&&!hasEmail)return result;if(!email)return result;
    const users=activeRows(localDb.users).filter(row=>localEmail(row.CORREO)===email&&row.ESTADO==='Activo'&&row.ROL_ID==='ROL-CONDUCTOR');if(users.length!==1)return result;userId=users[0].ID;
    const other=activeRows(localDb.drivers).find(row=>row.USUARIO_ID===userId&&String(row.ID)!==String(driverId));if(other)throw new Error('USUARIO_YA_ASOCIADO_A_OTRO_CONDUCTOR');result.USUARIO_ID=userId;result.CORREO=email;return result;
  }
  function localFilterRows(key,rows,user) {
    if(user.ROL_ID==='ROL-ADMIN')return rows;
    if(user.ROL_ID==='ROL-SUPERVISOR'){if(['users','connections'].includes(key))return[];if(key==='fuelAuthorizations')return rows.filter(row=>row.SOLICITADO_POR===user.ID);if(key==='notifications')return rows.filter(row=>!row.DESTINATARIO_USUARIO_ID||row.DESTINATARIO_USUARIO_ID===user.ID);if(key==='alerts')return hasLocalPermission(user,'ALERTAS','CERRAR')?rows:rows.filter(row=>!row.USUARIO_ID||row.USUARIO_ID===user.ID);return rows;}
    if(user.ROL_ID!=='ROL-CONDUCTOR')return rows;
    const driver=localDriver(user);
    if(key==='fuelAuthorizations')return [];
    if(key==='checkins')return rows.filter(row=>driver&&row.CONDUCTOR_ID===driver.ID);
    if(key==='notifications')return rows.filter(row=>row.DESTINATARIO_USUARIO_ID===user.ID||(driver&&row.DESTINATARIO_CONDUCTOR_ID===driver.ID));
    if(key==='connections')return rows.filter(row=>row.USUARIO_ID===user.ID);
    const activeOperations=driver?activeRows(localDb.operations).filter(row=>row.CONDUCTOR_ID===driver.ID&&['Activa','En curso'].includes(row.ESTADO)):[];
    const activeRoutes=driver?activeRows(localDb.routes).filter(row=>row.CONDUCTOR_ID===driver.ID&&['Asignada','En curso'].includes(row.ESTADO)):[];
    const activeAssignments=driver?activeRows(localDb.checkinAssignments||[]).filter(row=>row.CONDUCTOR_ID===driver.ID&&['ASIGNADO','CHECKIN_PENDIENTE','CHECKIN_LISTO','RUTA_ASIGNADA'].includes(row.ESTADO)):[];
    const vehicleCandidates=[
      ...activeRoutes.map(row=>({id:row.VEHICULO_ID,priority:row.ESTADO==='En curso'?400:250,date:row.FECHA_INICIO||row.FECHA_ASIGNACION||row.ACTUALIZADO_EN||row.CREADO_EN})),
      ...activeOperations.map(row=>({id:row.VEHICULO_ID,priority:350,date:row.FECHA_INICIO||row.ACTUALIZADO_EN||row.CREADO_EN})),
      ...activeAssignments.map(row=>({id:row.VEHICULO_ID,priority:row.ESTADO==='RUTA_ASIGNADA'?220:row.ESTADO==='CHECKIN_LISTO'?180:150,date:row.FECHA_ASIGNACION||row.ACTUALIZADO_EN||row.CREADO_EN}))
    ].filter(row=>row.id).sort((a,b)=>b.priority-a.priority||(new Date(b.date||0)-new Date(a.date||0)));
    // La vista Conductor expone un único vehículo actual, incluso si existen
    // asignaciones heredadas que todavía no fueron cerradas correctamente.
    const assignedVehicleIds=new Set(vehicleCandidates[0]?.id?[vehicleCandidates[0].id]:[]);
    if(key==='documents')return rows.filter(row=>{
      const associatedUser=String(row.USUARIO_ASOCIADO_ID||'')===String(user.ID)||
        (String(row.ASOCIADO_TIPO||'')==='Usuario'&&String(row.ASOCIADO_ID||'')===String(user.ID))||
        (String(row.CORREO_ASOCIADO||'').toLowerCase()===String(user.CORREO||'').toLowerCase());
      const associatedDriver=Boolean(driver)&&(
        String(row.CONDUCTOR_ASOCIADO_ID||'')===String(driver.ID)||
        (String(row.ASOCIADO_TIPO||'')==='Conductor'&&String(row.ASOCIADO_ID||'')===String(driver.ID))
      );
      const associatedVehicle=String(row.ASOCIADO_TIPO||'').toUpperCase().includes('VEHICULO')&&assignedVehicleIds.has(String(row.ASOCIADO_ID||''));
      return associatedUser||associatedDriver||associatedVehicle;
    });
    if(!driver&&['drivers','vehicles','operations','gps','routes','history','maintenance','checkins','fuel'].includes(key))return[];
    if(key==='drivers')return rows.filter(row=>row.ID===driver.ID);
    if(['operations','gps','routes','fuel'].includes(key))return rows.filter(row=>row.CONDUCTOR_ID===driver.ID);
    const ownOperations=activeOperations;
    const vehicleIds=assignedVehicleIds;
    if(key==='vehicles')return rows.filter(row=>vehicleIds.has(row.ID));
    if(key==='maintenance')return rows.filter(row=>vehicleIds.has(row.VEHICULO_ID));
    if(key==='history'){const operationIds=new Set(ownOperations.map(row=>row.ID));return rows.filter(row=>operationIds.has(row.OPERACION_ID));}
    if(key==='alerts')return rows.filter(row=>!row.USUARIO_ID||row.USUARIO_ID===user.ID);
    return rows;
  }
  function localPermissionKeys(){const modules=['PANEL_PRINCIPAL','OFICINA_VIRTUAL','USUARIOS','VEHICULOS','CONDUCTORES','OPERACIONES','CHECKIN','CHECKIN_APROBACIONES','GPS','HISTORIAL','MANTENCIONES','COMBUSTIBLE','DOCUMENTOS','ALERTAS','REPORTES','BITACORA','CONFIGURACION','QR','RUTAS','NOTIFICACIONES','CONEXIONES'],actions=['LEER','CREAR','ACTUALIZAR','ELIMINAR'];return[...modules.flatMap(module=>actions.map(action=>`${module}:${action}`)),...localButtonPermissions];}
  function localPermissionMatrix(list){const active=new Set(Array.isArray(list)?list:normalizeLocalPermissions(list)),all=active.has('*:*'),matrix={};localPermissionKeys().forEach(key=>{matrix[key]=all||active.has(key);});return matrix;}
  function localUserPermissionMatrices(user){const admin=user?.ROL_ID==='ROL-ADMIN',mode=admin?'ROL':String(user?.MODO_PERMISOS||'ROL').toUpperCase(),role=admin?['*:*']:activeRows(localDb.permissions).filter(row=>row.ROL_ID===user.ROL_ID&&row.PERMITIDO==='SI').map(row=>`${row.MODULO}:${row.ACCION}`),custom=admin?['*:*']:normalizeLocalPermissions(user.PERMISOS_PERSONALIZADOS),roleEffective=[...new Set([...role,...(admin?[]:mandatoryLocalPermissions)])],customEffective=[...new Set([...custom,...(admin?[]:mandatoryLocalPermissions)])],current=mode==='PERSONALIZADO'?customEffective:roleEffective;return{actual:localPermissionMatrix(current),rol:localPermissionMatrix(roleEffective),personalizados:localPermissionMatrix(customEffective)};}
  function publicUser(user) {
    const role = localDb.roles.find(row => row.ID === user.ROL_ID);
    const permissions=effectiveLocalPermissions(user),matrices=localUserPermissionMatrices(user);
    return { ID:user.ID,NOMBRE:user.NOMBRE,CORREO:user.CORREO,ROL_ID:user.ROL_ID,ROL_NOMBRE:role?.NOMBRE || user.ROL_ID,ESTADO:user.ESTADO,
      TELEFONO:user.TELEFONO || '',ULTIMO_ACCESO:user.ULTIMO_ACCESO || '',CONDUCTOR_ID:localDriver(user)?.ID||'',MODO_PERMISOS:String(user.MODO_PERMISOS||'ROL').toUpperCase(),PERMISOS_PERSONALIZADOS:normalizeLocalPermissions(user.PERMISOS_PERSONALIZADOS),VERSION_PERMISOS:Number(user.VERSION_PERMISOS||0),PERMISOS:permissions,MATRIZ_PERMISOS:matrices.actual,MATRIZ_PERMISOS_ROL:matrices.rol,MATRIZ_PERMISOS_PERSONALIZADOS:matrices.personalizados };
  }
  function cleanRow(row) {
    const out = { ...row }; delete out.CONTRASENA_CIFRADA; delete out.SAL_CONTRASENA; delete out.FICHA_SESION_CIFRADA; return out;
  }

  function localOperationalStatus(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();}
  function localOperationalUsage(driverId='',vehicleId=''){
    const operations=activeRows(localDb.operations).filter(row=>row.ESTADO==='Activa'&&(!driverId||row.CONDUCTOR_ID===driverId)&&(!vehicleId||row.VEHICULO_ID===vehicleId));
    const routes=activeRows(localDb.routes).filter(row=>row.ESTADO==='En curso'&&(!driverId||row.CONDUCTOR_ID===driverId)&&(!vehicleId||row.VEHICULO_ID===vehicleId));
    return{operations,routes};
  }
  function localReconcileAvailability(key,row){
    if(!row||!['drivers','vehicles'].includes(key))return false;
    const usage=key==='drivers'?localOperationalUsage(row.ID,''):localOperationalUsage('',row.ID);
    const op=usage.operations[0],route=usage.routes[0];
    const desired=op?(String(op.RUTA_ID||'')?'En ruta':'En operación'):(route?'En ruta':'Disponible');
    const automatic=new Set(key==='drivers'?['disponible','en ruta','en viaje','en operacion','ocupado']:['disponible','en ruta','en operacion','ocupado']);
    if((op||route||automatic.has(localOperationalStatus(row.ESTADO)))&&String(row.ESTADO||'')!==desired){
      row.ESTADO=desired;row.ACTUALIZADO_EN=iso();return true;
    }
    return false;
  }
  function localDiagnoseAvailability(payload){
    const user=requireLocalUser(),data=payload.data||payload,driverId=String(data.CONDUCTOR_ID||data.conductorId||''),vehicleId=String(data.VEHICULO_ID||data.vehiculoId||'');
    if(!driverId&&!vehicleId)throw new Error('RECURSO_DISPONIBILIDAD_REQUERIDO');
    if(driverId)requireLocalPermission(user,'CONDUCTORES','LEER');
    if(vehicleId)requireLocalPermission(user,'VEHICULOS','LEER');
    const driver=driverId?find('drivers',driverId):null,vehicle=vehicleId?find('vehicles',vehicleId):null;
    if(driverId&&!driver)throw new Error('CONDUCTOR_NO_ENCONTRADO');if(vehicleId&&!vehicle)throw new Error('VEHICULO_NO_ENCONTRADO');
    let changed=false;if(driver)changed=localReconcileAvailability('drivers',driver)||changed;if(vehicle)changed=localReconcileAvailability('vehicles',vehicle)||changed;if(changed)saveLocal();
    const usage=localOperationalUsage(driverId,vehicleId),occupied=Boolean(usage.operations.length||usage.routes.length);
    return{conductor:driver?cleanRow(driver):null,vehiculo:vehicle?cleanRow(vehicle):null,operacionesActivas:usage.operations.map(cleanRow),rutasActivas:usage.routes.map(cleanRow),ocupado:occupied,estadoCalculado:driver?.ESTADO||vehicle?.ESTADO||'Disponible',mensaje:occupied?'El recurso continúa ocupado porque existe una operación o ruta activa.':'No existen operaciones ni rutas activas. El estado fue reconciliado automáticamente a Disponible cuando correspondía.',serverTime:iso()};
  }

  function localList(payload) {
    const user=requireLocalUser(); const key = resourceMap[payload.resource]; if (!key) throw new Error('RECURSO_NO_ENCONTRADO');
    requireLocalPermission(user,moduleByResource[key],'LEER');
    const sourceRows=localFilterRows(key,activeRows(localDb[key] || []),user);
    let availabilityChanged=false;
    if(key==='drivers'||key==='vehicles')sourceRows.forEach(row=>{availabilityChanged=localReconcileAvailability(key,row)||availabilityChanged;});
    if(availabilityChanged)saveLocal();
    let rows = sourceRows.map(cleanRow);
    if(key==='users')rows=rows.map(publicUser);
    if(key==='routes'&&['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'].includes(user.ROL_ID))rows=rows.map(route=>{const trace=localRouteKpi(route);return{...route,LINEA_TIEMPO:trace.EVENTOS,KPI_TRAZABILIDAD:trace};});
    if(key==='companies')rows=rows.slice().sort((a,b)=>{const activeA=String(a.ESTADO||'Activo')==='Activo'?1:0,activeB=String(b.ESTADO||'Activo')==='Activo'?1:0;if(activeA!==activeB)return activeB-activeA;return new Date(b.ACTUALIZADO_EN||b.CREADO_EN||0)-new Date(a.ACTUALIZADO_EN||a.CREADO_EN||0);});
    const filters = payload.filters || {};
    rows = rows.filter(row => Object.entries(filters).every(([k,v]) => !v || String(row[k] || '').toLowerCase() === String(v).toLowerCase()));
    const camposFecha=['FECHA_HORA','FECHA_ENVIO','FECHA_INICIO','ULTIMA_CONEXION','ACTUALIZADO_EN','CREADO_EN'];
    rows=rows.slice().sort((a,b)=>{const campo=camposFecha.find(nombre=>a[nombre]||b[nombre]);return campo?(new Date(b[campo]||0)-new Date(a[campo]||0)):0;});
    const limite=Math.max(1,Number(payload.limit||payload.limite||150)),desde=Math.max(0,Number(payload.offset||payload.desde||0)),pagina=rows.slice(desde,desde+limite);
    return { rows:pagina, total:pagina.length, desde, limite, hasMore:desde+pagina.length<rows.length, orden:'MAS_RECIENTES_PRIMERO' };
  }
  function localNormalizeDocument(data,user,existing={}){
    const input={...(data||{})},driver=localDriver(user),admin=['ROL-ADMIN','ROL-GERENCIA'].includes(user.ROL_ID);
    let type=String(input.ASOCIADO_TIPO??existing.ASOCIADO_TIPO??'').trim();
    let associatedId=String(input.ASOCIADO_ID??existing.ASOCIADO_ID??'').trim();
    let driverId=String(input.CONDUCTOR_ASOCIADO_ID??existing.CONDUCTOR_ASOCIADO_ID??'').trim();
    let userId=String(input.USUARIO_ASOCIADO_ID??existing.USUARIO_ASOCIADO_ID??'').trim();
    let email=String(input.CORREO_ASOCIADO??existing.CORREO_ASOCIADO??'').trim().toLowerCase();
    if(user.ROL_ID==='ROL-CONDUCTOR'){
      userId=user.ID;email=String(user.CORREO||'').trim().toLowerCase();
      if(driver){type='Conductor';driverId=driver.ID;associatedId=driver.ID;input.IDENTIFICACION=input.IDENTIFICACION||driver.RUT||email;}
      else{type='Usuario';driverId='';associatedId=user.ID;input.IDENTIFICACION=input.IDENTIFICACION||email||user.ID;}
    }else if(!admin&&!type){
      type=driver?'Conductor':'Usuario';driverId=driver?driver.ID:'';userId=user.ID;associatedId=driver?driver.ID:user.ID;email=String(user.CORREO||'').trim().toLowerCase();
    }else if(type==='Conductor'){
      driverId=driverId||associatedId;const selected=find('drivers',driverId);if(!selected)throw new Error('DOCUMENTO_CONDUCTOR_NO_ENCONTRADO');
      associatedId=selected.ID;userId=selected.USUARIO_ID||userId;const selectedUser=userId?find('users',userId):null;email=String(selectedUser?.CORREO||selected.CORREO||email).trim().toLowerCase();input.IDENTIFICACION=input.IDENTIFICACION||selected.RUT||email;
    }else if(type==='Usuario'){
      userId=userId||associatedId||(!admin?user.ID:'');const selected=userId?find('users',userId):null;if(!selected)throw new Error('DOCUMENTO_USUARIO_NO_ENCONTRADO');
      associatedId=selected.ID;driverId='';email=String(selected.CORREO||email).trim().toLowerCase();input.IDENTIFICACION=input.IDENTIFICACION||email||selected.ID;
    }else{
      type=type||'Usuario';if(!associatedId&&!admin)associatedId=user.ID;
    }
    const isNew=!existing.ID,review=existing.ESTADO_REVISION||(admin?'Aprobado':'Pendiente de revisión');
    return {...input,ASOCIADO_TIPO:type,ASOCIADO_ID:associatedId,CONDUCTOR_ASOCIADO_ID:driverId,USUARIO_ASOCIADO_ID:userId,CORREO_ASOCIADO:email,
      CARGADO_POR_USUARIO_ID:existing.CARGADO_POR_USUARIO_ID||user.ID,CARGADO_POR_CORREO:existing.CARGADO_POR_CORREO||String(user.CORREO||'').trim().toLowerCase(),ORIGEN_CARGA_ROL:existing.ORIGEN_CARGA_ROL||user.ROL_ID,
      ESTADO_REVISION:review,REVISADO_POR_USUARIO_ID:existing.REVISADO_POR_USUARIO_ID||(isNew&&admin?user.ID:''),REVISADO_POR_CORREO:existing.REVISADO_POR_CORREO||(isNew&&admin?user.CORREO:''),FECHA_REVISION:existing.FECHA_REVISION||(isNew&&admin?iso():''),OBSERVACION_REVISION:existing.OBSERVACION_REVISION||(isNew&&admin?'Aprobación automática por carga de Administrador.':''),ESTADO:input.ESTADO||existing.ESTADO||'Vigente'};
  }

  function localBumpRolePermissionVersions(roleIds=[]){
    const roles=new Set((roleIds||[]).map(value=>String(value||'').trim().toUpperCase()).filter(Boolean));if(!roles.size)return 0;let total=0;
    activeRows(localDb.users).forEach(item=>{if(roles.has(String(item.ROL_ID||'').toUpperCase())&&String(item.MODO_PERMISOS||'ROL').toUpperCase()!=='PERSONALIZADO'){item.VERSION_PERMISOS=Number(item.VERSION_PERMISOS||0)+1;item.ACTUALIZADO_EN=iso();total++;}});return total;
  }

  async function localCreate(payload) {
    const user = requireLocalUser(); const key = resourceMap[payload.resource]; if (!key) throw new Error('RECURSO_NO_ENCONTRADO');
    requireLocalPermission(user,moduleByResource[key],'CREAR');
    if(key==='checkins')return localCreateVehicleCheckin(payload);
    if(key==='fuel')return localCreateFuel(payload);
    if(key==='fuelAuthorizations')throw new Error('ACCION_ESPECIAL_REQUERIDA');
    if(user.ROL_ID==='ROL-CONDUCTOR'){if(key==='operations')return localStartOperation(payload);if(key==='gps')return localSaveLocation(payload);if(key==='connections')throw new Error('ACCION_ESPECIAL_REQUERIDA');}
    let data = { ...(payload.data || {}) }; if(key==='documents')data=localNormalizeDocument(data,user,{}); const now = iso();
    const prefixes = {users:'USR',vehicles:'VEH',drivers:'CON',operations:'OPE',checkins:'CHK',gps:'GPS',history:'HIS',maintenance:'MAN',documents:'DOC',alerts:'ALT',reports:'REP',audit:'BIT',parameters:'PAR',companies:'EMP',qr:'QR',roles:'ROL',permissions:'PER',routes:'RUT',notifications:'NOT',connections:'CNX',fuel:'COM',fuelAuthorizations:'AUT-COM'};
    if (key === 'users') {
      if (String(data.CONTRASENA ?? '').length === 0) throw new Error('CONTRASENA_REQUERIDA');
      if (activeRows(localDb.users).some(row => row.CORREO === String(data.CORREO || '').toLowerCase())) throw new Error('CORREO_YA_EXISTE');
      const salt=id('SALT'); data.SAL_CONTRASENA=salt; data.CONTRASENA_CIFRADA=await digest(data.CONTRASENA+':'+salt); delete data.CONTRASENA;
      data.CORREO=String(data.CORREO || '').toLowerCase(); data.ESTADO=data.ESTADO || 'Activo'; data.ROL_ID=data.ROL_ID || 'ROL-CONDUCTOR'; data.MODO_PERMISOS=data.MODO_PERMISOS||'ROL';data.PERMISOS_PERSONALIZADOS=JSON.stringify(normalizeLocalPermissions(data.PERMISOS_PERSONALIZADOS));data.VERSION_PERMISOS=1;
    }
    if (key === 'vehicles') {
      data.PATENTE=String(data.PATENTE || '').toUpperCase(); data.ESTADO=data.ESTADO || 'Disponible';
      data.QR_CODIGO=data.QR_CODIGO || ('VEH-'+data.PATENTE.replace(/[^A-Z0-9]/g,''));
    }
    if (key === 'drivers') { data=localPrepareDriverAssociation(data); data.ESTADO=data.ESTADO || 'Disponible'; }
    if (key === 'documents') data.ESTADO=data.ESTADO || 'Vigente';
    const row={ ID:data.ID || id(prefixes[key] || 'ID'), ...data, CREADO_EN:now, ACTUALIZADO_EN:now, ELIMINADO:'NO' };
    localDb[key].push(row);const usuariosPermisosActualizados=key==='permissions'?localBumpRolePermissionVersions([row.ROL_ID]):0;let association=null;if(key==='users')association=localAssociateDriverByEmail(row,'CREACION_USUARIO');audit(user,'CREAR',key.toUpperCase(),`Registro creado. Datos: ${JSON.stringify(cleanRow(row))}`,row.ID); saveLocal(); return { row:key==='users'?publicUser(row):cleanRow(row), asociacionConductor:association?{CONDUCTOR_ID:association.driver?.ID||'',ASOCIADO_AUTOMATICAMENTE:association.linked,MOTIVO:association.reason}:undefined, usuariosPermisosActualizados };
  }
  async function localUpdate(payload) {
    const user=requireLocalUser(), key=resourceMap[payload.resource]; const row=find(key,payload.id); if(!row) throw new Error('REGISTRO_NO_ENCONTRADO');
    requireLocalPermission(user,moduleByResource[key],'ACTUALIZAR');if(!localFilterRows(key,[row],user).length)throw new Error('PERMISO_DENEGADO');
    let data={...(payload.data||{})};const before=cleanRow({...row});if(key==='drivers'&&(Object.prototype.hasOwnProperty.call(data,'USUARIO_ID')||Object.prototype.hasOwnProperty.call(data,'CORREO')))data=localPrepareDriverAssociation(data,row.ID);
    if(key==='checkins'||key==='fuelAuthorizations')throw new Error('ACCION_ESPECIAL_REQUERIDA');
    if(key==='fuel')return localUpdateFuel(payload);
    if(key==='documents')Object.assign(data,localNormalizeDocument(data,user,row));
    if(key==='drivers'||key==='vehicles'){
      localReconcileAvailability(key,row);
      if(Object.prototype.hasOwnProperty.call(data,'ESTADO')){
        const requested=localOperationalStatus(data.ESTADO);
        const automatic=new Set(key==='drivers'?['disponible','en ruta','en viaje','en operacion','ocupado']:['disponible','en ruta','en operacion','ocupado']);
        const usage=key==='drivers'?localOperationalUsage(row.ID,''):localOperationalUsage('',row.ID);
        if(automatic.has(requested))delete data.ESTADO;
        else if(usage.operations.length||usage.routes.length)throw new Error('ESTADO_ADMINISTRATIVO_CON_OCUPACION_ACTIVA');
      }
    }
    if(user.ROL_ID==='ROL-CONDUCTOR'){if(key==='routes')return localUpdateRouteStatus({id:payload.id,ESTADO:data.ESTADO});if(key==='notifications'){if(data.LEIDA!=='SI')throw new Error('PERMISO_DENEGADO');return localReadNotification({id:payload.id});}if(key==='alerts'&&Object.keys(data).some(field=>field!=='LEIDA'))throw new Error('PERMISO_DENEGADO');if(['operations','connections'].includes(key))throw new Error('ACCION_ESPECIAL_REQUERIDA');}
    if(key==='users'){
      const newRole=Object.prototype.hasOwnProperty.call(data,'ROL_ID')?data.ROL_ID:row.ROL_ID,newState=Object.prototype.hasOwnProperty.call(data,'ESTADO')?data.ESTADO:row.ESTADO;
      if(row.ROL_ID==='ROL-ADMIN'&&row.ESTADO==='Activo'&&(newRole!=='ROL-ADMIN'||newState!=='Activo')){const other=activeRows(localDb.users).some(item=>item.ID!==row.ID&&item.ROL_ID==='ROL-ADMIN'&&item.ESTADO==='Activo');if(!other)throw new Error('ULTIMO_ADMINISTRADOR_PROTEGIDO');}
      if(data.CONTRASENA){const salt=id('SALT');row.SAL_CONTRASENA=salt;row.CONTRASENA_CIFRADA=await digest(data.CONTRASENA+':'+salt);delete data.CONTRASENA;}
    }
    const rolPermisoAnterior=key==='permissions'?before.ROL_ID:'';Object.assign(row,data,{ACTUALIZADO_EN:iso()});const usuariosPermisosActualizados=key==='permissions'?localBumpRolePermissionVersions([rolPermisoAnterior,row.ROL_ID]):0;if(key==='drivers'||key==='vehicles')localReconcileAvailability(key,row);let association=null;if(key==='users'){const linked=activeRows(localDb.drivers).filter(driver=>driver.USUARIO_ID===row.ID);if(Object.prototype.hasOwnProperty.call(data,'CORREO')&&linked.length===1)linked[0].CORREO=localEmail(row.CORREO);association=localAssociateDriverByEmail(row,'ACTUALIZACION_USUARIO');}audit(user,'ACTUALIZAR',key.toUpperCase(),`Respaldo anterior: ${JSON.stringify(before)}. Datos posteriores: ${JSON.stringify(cleanRow(row))}`,row.ID);saveLocal();return{row:key==='users'?publicUser(row):cleanRow(row),asociacionConductor:association?{CONDUCTOR_ID:association.driver?.ID||'',ASOCIADO_AUTOMATICAMENTE:association.linked,MOTIVO:association.reason}:undefined,usuariosPermisosActualizados};
  }
  function localDelete(payload) {
    const user=requireLocalUser(), key=resourceMap[payload.resource], row=find(key,payload.id); if(!row) throw new Error('REGISTRO_NO_ENCONTRADO');
    requireLocalPermission(user,moduleByResource[key],'ELIMINAR');if(!localFilterRows(key,[row],user).length)throw new Error('PERMISO_DENEGADO');
    if(key==='fuel')return localDeleteFuel(payload);
    if(key==='fuelAuthorizations')throw new Error('ACCION_ESPECIAL_REQUERIDA');
    const respaldo=cleanRow({...row});row.ELIMINADO='SI';row.ACTUALIZADO_EN=iso();const usuariosPermisosActualizados=key==='permissions'?localBumpRolePermissionVersions([row.ROL_ID]):0;audit(user,'ELIMINAR',key.toUpperCase(),`Registro eliminado lógicamente. Respaldo íntegro previo: ${JSON.stringify(respaldo)}`,row.ID);saveLocal();return{id:row.ID,usuariosPermisosActualizados};
  }
  function localFuelNumber(value,field,allowZero=false){const parsed=Number(value);if(!Number.isFinite(parsed)||(allowZero?parsed<0:parsed<=0))throw new Error(`COMBUSTIBLE_${field}_INVALIDO`);return parsed;}
  function localFuelRound(value,decimals=2){const factor=10**decimals;return Math.round((Number(value)+Number.EPSILON)*factor)/factor;}
  function localValidateFuel(data,existing={},user=null,isCreate=false){
    const admin=user?.ROL_ID==='ROL-ADMIN',driverSession=user?.ROL_ID==='ROL-CONDUCTOR'?localDriver(user):null;
    if(user?.ROL_ID==='ROL-CONDUCTOR'&&!driverSession)throw new Error('CONDUCTOR_NO_ASOCIADO_USUARIO');
    let operationId=String(data.OPERACION_ID??existing.OPERACION_ID??'').trim(),routeId=String(data.RUTA_ID??existing.RUTA_ID??'').trim();
    let vehicleId=String(data.VEHICULO_ID??existing.VEHICULO_ID??'').trim(),driverId=String(data.CONDUCTOR_ID??existing.CONDUCTOR_ID??'').trim(),operation=null,route=null;
    if(operationId){operation=find('operations',operationId);if(!operation)throw new Error('OPERACION_NO_ENCONTRADA');if(!routeId&&operation.RUTA_ID)routeId=String(operation.RUTA_ID).trim();}
    if(routeId){route=find('routes',routeId);if(!route)throw new Error('RUTA_NO_ENCONTRADA');if(!operation&&route.OPERACION_ID){operationId=String(route.OPERACION_ID).trim();operation=find('operations',operationId);if(!operation)throw new Error('OPERACION_NO_ENCONTRADA');}}
    if(operation&&route){const routeOfOperation=String(operation.RUTA_ID||'').trim(),operationOfRoute=String(route.OPERACION_ID||'').trim();if((routeOfOperation&&routeOfOperation!==String(route.ID))||(operationOfRoute&&operationOfRoute!==String(operation.ID))||(!routeOfOperation&&!operationOfRoute))throw new Error('COMBUSTIBLE_RUTA_NO_COINCIDE');}
    if(operation){vehicleId=String(operation.VEHICULO_ID||'').trim();driverId=String(operation.CONDUCTOR_ID||'').trim();}else if(route){vehicleId=String(route.VEHICULO_ID||'').trim();driverId=String(route.CONDUCTOR_ID||'').trim();}
    if(driverSession){driverId=driverSession.ID;if(operation&&String(operation.CONDUCTOR_ID||'')!==String(driverSession.ID))throw new Error('COMBUSTIBLE_OPERACION_NO_AUTORIZADA');if(route&&String(route.CONDUCTOR_ID||'')!==String(driverSession.ID))throw new Error('COMBUSTIBLE_RUTA_NO_AUTORIZADA');}
    if(!admin&&isCreate){if(!operation&&!route)throw new Error('COMBUSTIBLE_ASIGNACION_ACTIVA_REQUERIDA');if(operation&&operation.ESTADO!=='Activa')throw new Error('COMBUSTIBLE_ASIGNACION_NO_VIGENTE');if(route&&!['Asignada','En curso'].includes(route.ESTADO))throw new Error('COMBUSTIBLE_ASIGNACION_NO_VIGENTE');}
    if(!vehicleId)throw new Error('COMBUSTIBLE_VEHICULO_REQUERIDO');if(!driverId)throw new Error('COMBUSTIBLE_CONDUCTOR_REQUERIDO');
    if(!find('vehicles',vehicleId))throw new Error('VEHICULO_NO_ENCONTRADO');if(!find('drivers',driverId))throw new Error('CONDUCTOR_NO_ENCONTRADO');if(operation&&(String(operation.VEHICULO_ID)!==vehicleId||String(operation.CONDUCTOR_ID)!==driverId))throw new Error('COMBUSTIBLE_OPERACION_NO_COINCIDE');if(route&&(String(route.VEHICULO_ID)!==vehicleId||String(route.CONDUCTOR_ID)!==driverId))throw new Error('COMBUSTIBLE_RUTA_NO_COINCIDE');
    const liters=localFuelNumber(data.LITROS??existing.LITROS,'LITROS'),price=localFuelNumber(data.PRECIO_LITRO??existing.PRECIO_LITRO,'PRECIO_LITRO',true),mileageRaw=data.KILOMETRAJE??existing.KILOMETRAJE??'',mileage=mileageRaw===''?'':localFuelNumber(mileageRaw,'KILOMETRAJE',true),date=new Date(data.FECHA_HORA??existing.FECHA_HORA??iso());
    if(Number.isNaN(date.getTime()))throw new Error('COMBUSTIBLE_FECHA_INVALIDA');
    return{VEHICULO_ID:vehicleId,CONDUCTOR_ID:driverId,OPERACION_ID:operationId,RUTA_ID:routeId,FECHA_HORA:date.toISOString(),TIPO_COMBUSTIBLE:String(data.TIPO_COMBUSTIBLE??existing.TIPO_COMBUSTIBLE??'Diésel').trim(),LITROS:localFuelRound(liters,3),PRECIO_LITRO:localFuelRound(price,2),COSTO_TOTAL:localFuelRound(liters*price,2),KILOMETRAJE:mileage===''?'':localFuelRound(mileage,1),ESTACION_SERVICIO:String(data.ESTACION_SERVICIO??existing.ESTACION_SERVICIO??'').trim(),NUMERO_DOCUMENTO:String(data.NUMERO_DOCUMENTO??existing.NUMERO_DOCUMENTO??'').trim(),MEDIO_PAGO:String(data.MEDIO_PAGO??existing.MEDIO_PAGO??'').trim(),TANQUE_LLENO:String(data.TANQUE_LLENO??existing.TANQUE_LLENO??'SI').toUpperCase()==='NO'?'NO':'SI',COMPROBANTE_URL:String(data.COMPROBANTE_URL??existing.COMPROBANTE_URL??'').trim(),OBSERVACIONES:String(data.OBSERVACIONES??existing.OBSERVACIONES??'').trim().slice(0,1500),ESTADO_REGISTRO:'Activo'};
  }
  function localRecalculateFuel(vehicleId){const rows=activeRows(localDb.fuel).filter(row=>row.VEHICULO_ID===vehicleId).sort((a,b)=>new Date(a.FECHA_HORA||a.CREADO_EN)-new Date(b.FECHA_HORA||b.CREADO_EN)||String(a.ID).localeCompare(String(b.ID)));let previous=null,maxMileage=0;rows.forEach(row=>{const mileage=row.KILOMETRAJE===''?null:Number(row.KILOMETRAJE),liters=Number(row.LITROS||0);let distance='',kmL='',l100='';if(mileage!==null&&Number.isFinite(mileage)&&previous!==null&&mileage>=previous){distance=localFuelRound(mileage-previous,1);if(distance>0&&liters>0){kmL=localFuelRound(distance/liters,2);l100=localFuelRound(liters/distance*100,2);}}row.KILOMETRAJE_ANTERIOR=distance===''?'':localFuelRound(mileage-distance,1);row.DISTANCIA_DESDE_ULTIMA_CARGA_KM=distance;row.CONSUMO_KM_L=kmL;row.CONSUMO_L_100KM=l100;if(mileage!==null&&Number.isFinite(mileage)){previous=mileage;maxMileage=Math.max(maxMileage,mileage);}});const vehicle=find('vehicles',vehicleId);if(vehicle&&maxMileage>Number(vehicle.KILOMETRAJE||0)){vehicle.KILOMETRAJE=maxMileage;vehicle.ACTUALIZADO_EN=iso();}}
  function localNotifyRoles(roleIds,data){const roles=Array.isArray(roleIds)?roleIds:[roleIds];return activeRows(localDb.users).filter(row=>roles.includes(row.ROL_ID)&&row.ESTADO!=='Inactivo').map(row=>localCreateNotification({...data,DESTINATARIO_USUARIO_ID:row.ID}));}
  function localCreateFuel(payload){const user=requireLocalUser(),data=payload.data||{};requireLocalPermission(user,'COMBUSTIBLE','REGISTRAR');const validadoPorQr=localConsumeVehicleQrAuthorization(data.AUTORIZACION_QR,user,data.VEHICULO_ID,'combustible',false),clean=localValidateFuel(data, {}, user, true),now=iso(),row={ID:id('COM'),...clean,CREADO_POR:user.ID,CREADO_EN:now,ACTUALIZADO_POR:user.ID,ACTUALIZADO_EN:now,ELIMINADO:'NO'};localDb.fuel.push(row);localRecalculateFuel(row.VEHICULO_ID);audit(user,'CREAR_CARGA','COMBUSTIBLE',`Carga registrada${validadoPorQr?' mediante QR':''}. Datos: ${JSON.stringify(row)}`,row.ID);if(user.ROL_ID==='ROL-CONDUCTOR'){const driver=localDriver(user)||{},vehicle=find('vehicles',row.VEHICULO_ID)||{};localNotifyRoles(['ROL-ADMIN'],{TITULO:'Combustible informado por conductor',MENSAJE:`${driver.NOMBRE||user.NOMBRE} (${user.CORREO||'sin correo'}) informó ${row.LITROS} L para ${vehicle.PATENTE||row.VEHICULO_ID}, costo ${row.COSTO_TOTAL}.`,TIPO:'Combustible',PRIORIDAD:'Alta',OPERACION_ID:row.OPERACION_ID,RUTA_ID:row.RUTA_ID,CREADO_POR:user.ID,CLAVE_UNICA:`COMBUSTIBLE-CONDUCTOR-${row.ID}`});}else if(user.ROL_ID==='ROL-SUPERVISOR')localNotifyRoles(['ROL-ADMIN'],{TITULO:'Nueva carga de combustible',MENSAJE:`${user.NOMBRE} registró ${row.LITROS} L para ${row.VEHICULO_ID}.`,TIPO:'Combustible',PRIORIDAD:'Normal',OPERACION_ID:row.OPERACION_ID,CREADO_POR:user.ID,CLAVE_UNICA:`COMBUSTIBLE-SUPERVISOR-${row.ID}`});saveLocal();return{row:cleanRow(row)};}
  function localUpdateFuel(payload){const user=requireLocalUser();requireLocalPermission(user,'COMBUSTIBLE','ACTUALIZAR');if(user.ROL_ID==='ROL-CONDUCTOR')throw new Error('PERMISO_DENEGADO');const row=find('fuel',payload.id);if(!row)throw new Error('REGISTRO_NO_ENCONTRADO');const before={...row},oldVehicle=row.VEHICULO_ID,clean=localValidateFuel(payload.data||{},row,user,false);Object.assign(row,clean,{ACTUALIZADO_POR:user.ID,ACTUALIZADO_EN:iso()});localRecalculateFuel(oldVehicle);if(oldVehicle!==row.VEHICULO_ID)localRecalculateFuel(row.VEHICULO_ID);audit(user,'ACTUALIZAR_CARGA','COMBUSTIBLE',`Respaldo anterior: ${JSON.stringify(before)}. Datos posteriores: ${JSON.stringify(row)}`,row.ID);saveLocal();return{row:cleanRow(row)};}
  function localOperationsSummary(payload={}) {
    const user=requireLocalUser();
    requireLocalPermission(user,'OPERACIONES','LEER');
    const requested=Number(payload.limit||payload.limite||config.MAXIMO_HISTORIAL_OPERACIONES_RAPIDO||250);
    const historyLimit=Math.min(500,Math.max(50,Math.round(Number.isFinite(requested)?requested:250)));
    const all=localFilterRows('operations',activeRows(localDb.operations),user).map(cleanRow);
    const time=row=>{const value=new Date(row.FECHA_INICIO||row.CREADO_EN||row.ACTUALIZADO_EN||0).getTime();return Number.isFinite(value)?value:0;};
    const ordered=all.slice().sort((a,b)=>time(b)-time(a));
    const active=ordered.filter(row=>row.ESTADO==='Activa');
    const recent=ordered.filter(row=>row.ESTADO!=='Activa').slice(0,historyLimit);
    const selected=[...new Map([...active,...recent].map(row=>[String(row.ID),row])).values()]
      .sort((a,b)=>a.ESTADO==='Activa'&&b.ESTADO!=='Activa'?-1:a.ESTADO!=='Activa'&&b.ESTADO==='Activa'?1:time(b)-time(a));
    const vehicleIds=new Set(selected.map(row=>String(row.VEHICULO_ID||'')).filter(Boolean));
    const driverIds=new Set(selected.map(row=>String(row.CONDUCTOR_ID||'')).filter(Boolean));
    const routeIds=new Set(selected.map(row=>String(row.RUTA_ID||'')).filter(Boolean));
    const vehicles=localFilterRows('vehicles',activeRows(localDb.vehicles),user).filter(row=>row.ESTADO==='Disponible'||vehicleIds.has(String(row.ID))).map(cleanRow);
    const drivers=localFilterRows('drivers',activeRows(localDb.drivers),user).filter(row=>row.ESTADO==='Disponible'||driverIds.has(String(row.ID))).map(cleanRow);
    const routes=localFilterRows('routes',activeRows(localDb.routes),user).filter(row=>['Asignada','En curso'].includes(row.ESTADO)||routeIds.has(String(row.ID))).map(cleanRow);
    const company=cleanRow(localPrimaryCompany()||{});
    const lat=Number(company.PUNTO_OPERACION_LATITUD),lng=Number(company.PUNTO_OPERACION_LONGITUD);
    const pointConfigured=Number.isFinite(lat)&&Number.isFinite(lng)&&String(company.VALIDAR_UBICACION_OPERACION||'SI')!=='NO';
    const point=pointConfigured?{
      NOMBRE:company.PUNTO_OPERACION_NOMBRE||'Base operacional',
      DIRECCION:company.PUNTO_OPERACION_DIRECCION||company.DIRECCION||'Base operacional',
      LATITUD:lat,LONGITUD:lng,
      RADIO_INICIO_METROS:Number(company.RADIO_INICIO_METROS||150),
      RADIO_FIN_METROS:Number(company.RADIO_FIN_METROS||150),
      PRECISION_GPS_MAXIMA_METROS:Number(company.PRECISION_GPS_MAXIMA_METROS||120)
    }:null;
    return{operations:selected,activeOperations:active,vehicles,drivers,routes,total:all.length,totalActive:active.length,historyShown:recent.length,historyLimit,pointConfigured,point,company,generatedAt:iso()};
  }

  function localReportsKpiContext(payload={}){
    const user=requireLocalUser();requireLocalPermission(user,'REPORTES','LEER');
    const data=payload.data||payload,desdeRaw=String(data.DESDE||data.FECHA_DESDE||'').trim(),hastaRaw=String(data.HASTA||data.FECHA_HASTA||'').trim();
    const desde=desdeRaw?new Date(desdeRaw):null,hasta=hastaRaw?new Date(hastaRaw):null;
    if((desde&&Number.isNaN(desde.getTime()))||(hasta&&Number.isNaN(hasta.getTime()))||(desde&&hasta&&desde>hasta))throw new Error('RANGO_FECHAS_INVALIDO');
    const permisos=new Set(effectiveLocalPermissions(user)),puede=modulo=>user.ROL_ID==='ROL-ADMIN'||permisos.has(`${modulo}:LEER`);
    const conductorId=String(data.CONDUCTOR_ID||'').trim(),vehiculoId=String(data.VEHICULO_ID||'').trim();
    const fechaFila=(fila,campo)=>new Date(fila[campo]||fila.FECHA_HORA||fila.FECHA_INICIO||fila.FECHA_ASIGNACION||fila.FECHA_PROGRAMADA||fila.FECHA_VENCIMIENTO||fila.CREADO_EN||0);
    const asociado=(fila,tipo)=>String(tipo==='conductor'?(fila.CONDUCTOR_ID||fila.CONDUCTOR_ASOCIADO_ID||(String(fila.ASOCIADO_TIPO||'').toUpperCase().includes('CONDUCTOR')?fila.ASOCIADO_ID:'')):(fila.VEHICULO_ID||fila.VEHICULO_ASOCIADO_ID||(String(fila.ASOCIADO_TIPO||'').toUpperCase().includes('VEHICULO')?fila.ASOCIADO_ID:''))||'');
    const filtrar=(recurso,modulo,campo)=>puede(modulo)?localFilterRows(recurso,activeRows(localDb[recurso]||[]),user).filter(fila=>{const fecha=fechaFila(fila,campo);if(desde&&(!Number.isFinite(fecha.getTime())||fecha<desde))return false;if(hasta&&(!Number.isFinite(fecha.getTime())||fecha>hasta))return false;if(conductorId&&asociado(fila,'conductor')!==conductorId)return false;if(vehiculoId&&asociado(fila,'vehiculo')!==vehiculoId)return false;return true;}).map(cleanRow):[];
    return{user,puede,desde,hasta,conductorId,vehiculoId,operations:filtrar('operations','OPERACIONES','FECHA_INICIO'),drivers:puede('CONDUCTORES')?localFilterRows('drivers',activeRows(localDb.drivers),user).map(cleanRow):[],vehicles:puede('VEHICULOS')?localFilterRows('vehicles',activeRows(localDb.vehicles),user).map(cleanRow):[],checkins:filtrar('checkins','CHECKIN','FECHA_HORA'),routes:filtrar('routes','RUTAS','FECHA_ASIGNACION'),fuel:filtrar('fuel','COMBUSTIBLE','FECHA_HORA'),maintenance:filtrar('maintenance','MANTENCIONES','FECHA_PROGRAMADA'),documents:filtrar('documents','DOCUMENTOS','FECHA_VENCIMIENTO'),alerts:filtrar('alerts','ALERTAS','FECHA_HORA')};
  }
  function localReportsDistance(row){const directa=Math.max(0,Number(row.DISTANCIA_KM||0));return directa>0?directa:Math.max(0,Number(row.KM_FIN||0)-Number(row.KM_INICIO||0));}
  function localReportsNormalized(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();}
  function localReportsKpiSummary(payload={}){
    const c=localReportsKpiContext(payload),operations=c.operations.slice().sort((a,b)=>new Date(b.FECHA_INICIO||b.CREADO_EN||0)-new Date(a.FECHA_INICIO||a.CREADO_EN||0));
    const completed=operations.filter(row=>/finaliz|complet|cerrad/.test(localReportsNormalized(row.ESTADO))),active=operations.filter(row=>/activ|curso|iniciad|en ruta/.test(localReportsNormalized(row.ESTADO)));
    const km=operations.reduce((sum,row)=>sum+localReportsDistance(row),0),durations=completed.map(row=>{const start=new Date(row.FECHA_INICIO||0),end=new Date(row.FECHA_FIN||0);return Number.isFinite(start.getTime())&&Number.isFinite(end.getTime())&&end>=start?(end-start)/3600000:0;}).filter(Boolean);
    const liters=c.fuel.reduce((sum,row)=>sum+Math.max(0,Number(row.LITROS||0)),0),fuelCost=c.fuel.reduce((sum,row)=>sum+Math.max(0,Number(row.COSTO_TOTAL||0)||Number(row.LITROS||0)*Number(row.PRECIO_LITRO||0)),0),stateMap=new Map(),monthMap=new Map();
    operations.forEach(row=>{const state=String(row.ESTADO||'Sin estado').trim()||'Sin estado';stateMap.set(state,(stateMap.get(state)||0)+1);const date=new Date(row.FECHA_INICIO||row.CREADO_EN||0);if(Number.isFinite(date.getTime())){const key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;monthMap.set(key,(monthMap.get(key)||0)+1);}});
    const ranking=key=>{const map=new Map();operations.forEach(row=>{const id=String(row[key]||'SIN-ASIGNAR'),item=map.get(id)||{ID:id,TOTAL:0,KM:0};item.TOTAL++;item.KM+=localReportsDistance(row);map.set(id,item);});return[...map.values()].sort((a,b)=>b.TOTAL-a.TOTAL||b.KM-a.KM).slice(0,6);};
    const driverMap=Object.fromEntries(c.drivers.map(row=>[String(row.ID),row.NOMBRE||row.ID])),vehicleMap=Object.fromEntries(c.vehicles.map(row=>[String(row.ID),row.PATENTE||row.ID]));
    const resumen={METRICAS:{OPERACIONES_TOTAL:operations.length,OPERACIONES_ACTIVAS:active.length,OPERACIONES_FINALIZADAS:completed.length,KILOMETROS:km,DURACION_PROMEDIO_HORAS:durations.length?durations.reduce((a,b)=>a+b,0)/durations.length:0,CIERRES_EXCEPCIONALES:completed.filter(row=>String(row.CIERRE_FUERA_BASE||'').toUpperCase()==='SI').length,RIESGOS_GPS:completed.filter(row=>localReportsNormalized(row.VALIDACION_FIN).includes('precision_baja')||localReportsNormalized(row.VALIDACION_FIN).includes('precision baja')).length,RUTAS_TOTAL:c.routes.length,RUTAS_COMPLETADAS:c.routes.filter(row=>/complet|finaliz|cerrad/.test(localReportsNormalized(row.ESTADO))).length,CHECKINS_TOTAL:c.checkins.length,CHECKINS_APROBADOS:c.checkins.filter(row=>localReportsNormalized(row.ESTADO_REVISION)==='aprobado').length,CHECKINS_BLOQUEADOS:c.checkins.filter(row=>/bloquead|rechazad/.test(localReportsNormalized(row.ESTADO_REVISION))).length,COMBUSTIBLE_TOTAL:c.fuel.length,COMBUSTIBLE_LITROS:liters,COMBUSTIBLE_COSTO:fuelCost,MANTENCIONES_TOTAL:c.maintenance.length,MANTENCIONES_ABIERTAS:c.maintenance.filter(row=>!/realiz|complet|cerrad|cancelad/.test(localReportsNormalized(row.ESTADO))).length,DOCUMENTOS_TOTAL:c.documents.length,DOCUMENTOS_VENCIDOS:c.documents.filter(row=>localReportsNormalized(row.ESTADO)==='vencido'||new Date(row.FECHA_VENCIMIENTO||0).getTime()<Date.now()).length,ALERTAS_TOTAL:c.alerts.length,ALERTAS_PENDIENTES:c.alerts.filter(row=>localReportsNormalized(row.LEIDA)!=='si'&&localReportsNormalized(row.CERRADA)!=='si').length},ESTADOS_OPERACIONES:[...stateMap].map(([ESTADO,TOTAL])=>({ESTADO,TOTAL})).sort((a,b)=>b.TOTAL-a.TOTAL),TENDENCIA_OPERACIONES:[...monthMap].sort(([a],[b])=>a.localeCompare(b)).slice(-12).map(([FECHA,TOTAL])=>({FECHA,ETIQUETA:`${FECHA.slice(5)}/${FECHA.slice(2,4)}`,TOTAL})),RANKING_CONDUCTORES:ranking('CONDUCTOR_ID').map(row=>({...row,NOMBRE:driverMap[row.ID]||row.ID})),RANKING_VEHICULOS:ranking('VEHICULO_ID').map(row=>({...row,NOMBRE:vehicleMap[row.ID]||row.ID})),DETALLE_OPERACIONES:operations.slice(0,150),CATALOGO_CONDUCTORES:c.drivers,CATALOGO_VEHICULOS:c.vehicles,GENERADO_EN:iso()};
    const routeTraces=c.routes.map(localRouteKpi).sort((a,b)=>new Date(b.FECHA_ASIGNACION||0)-new Date(a.FECHA_ASIGNACION||0)),average=field=>{const values=routeTraces.map(row=>row[field]).filter(value=>Number.isFinite(value));return values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):0;};
    resumen.KPI_TRAZABILIDAD_RUTAS={RUTAS_TRAZADAS:routeTraces.length,RUTAS_ACEPTADAS:routeTraces.filter(row=>row.FECHA_ACEPTACION).length,RUTAS_INICIADAS:routeTraces.filter(row=>row.FECHA_INICIO).length,RUTAS_COMPLETADAS:routeTraces.filter(row=>row.FECHA_COMPLETADA).length,PROMEDIO_ASIGNACION_ACEPTACION_SEGUNDOS:average('TIEMPO_ASIGNACION_ACEPTACION_SEGUNDOS'),PROMEDIO_ACEPTACION_INICIO_SEGUNDOS:average('TIEMPO_ACEPTACION_INICIO_SEGUNDOS'),PROMEDIO_CONDUCCION_SEGUNDOS:average('TIEMPO_INICIO_COMPLETADA_SEGUNDOS'),PROMEDIO_CICLO_TOTAL_SEGUNDOS:average('TIEMPO_TOTAL_CICLO_SEGUNDOS')};
    resumen.DETALLE_TRAZABILIDAD_RUTAS=routeTraces.slice(0,150);
    resumen.KPI_VEHICULOS=c.vehicles.map(vehicle=>{const vehicleOps=operations.filter(row=>row.VEHICULO_ID===vehicle.ID),vehicleFuel=c.fuel.filter(row=>row.VEHICULO_ID===vehicle.ID),gps=activeRows(localDb.gps).filter(row=>row.VEHICULO_ID===vehicle.ID),current=activeRows(localDb.gpsCurrent).filter(row=>row.VEHICULO_ID===vehicle.ID).sort((a,b)=>new Date(b.FECHA_HORA)-new Date(a.FECHA_HORA))[0]||{},kmVehicle=vehicleOps.reduce((sum,row)=>sum+localReportsDistance(row),0),fuelLiters=vehicleFuel.reduce((sum,row)=>sum+Number(row.LITROS||0),0),cost=vehicleFuel.reduce((sum,row)=>sum+Number(row.COSTO_TOTAL||Number(row.LITROS||0)*Number(row.PRECIO_LITRO||0)),0),days=Math.max(1,new Set(vehicleFuel.map(row=>String(row.FECHA_HORA||row.CREADO_EN||'').slice(0,10)).filter(Boolean)).size),speeds=gps.map(row=>Number(row.VELOCIDAD_KMH||0)).filter(value=>value>=0&&value<=220);return{ID:vehicle.ID,PATENTE:vehicle.PATENTE,MARCA:vehicle.MARCA,MODELO:vehicle.MODELO,KM_RECORRIDOS:kmVehicle,LITROS:fuelLiters,COSTO_TOTAL:cost,PRECIO_PROMEDIO_LITRO:vehicleFuel.length?vehicleFuel.reduce((sum,row)=>sum+Number(row.PRECIO_LITRO||0),0)/vehicleFuel.length:0,CONSUMO_LITROS_DIA:fuelLiters/days,COSTO_DIA:cost/days,RENDIMIENTO_KM_L:fuelLiters?kmVehicle/fuelLiters:0,CONSUMO_L_100KM:kmVehicle?fuelLiters*100/kmVehicle:0,VELOCIDAD_ACTUAL_KMH:Number(current.VELOCIDAD_KMH||0),VELOCIDAD_PROMEDIO_KMH:speeds.length?speeds.reduce((a,b)=>a+b,0)/speeds.length:0,VELOCIDAD_MAXIMA_KMH:speeds.length?Math.max(...speeds):0,ULTIMA_LECTURA:current.FECHA_HORA||''};});
    return{resumen,origen:'AGREGACION_LOCAL',serverTime:iso(),filasTransferidas:resumen.DETALLE_OPERACIONES.length+c.drivers.length+c.vehicles.length+resumen.DETALLE_TRAZABILIDAD_RUTAS.length};
  }
  function localReportsKpiDetail(payload={}){
    const c=localReportsKpiContext(payload),data=payload.data||payload,format=String(data.FORMATO||'CSV').toUpperCase(),action=format==='XLSX'?'EXPORTAR_XLSX':format==='PDF'?'EXPORTAR_PDF':'EXPORTAR_CSV';requireLocalPermission(c.user,'REPORTES',action);
    const offset=Math.max(0,Number(data.DESDE_REGISTRO||0)||0),limit=Math.min(2000,Math.max(1,Number(data.LIMITE||1000)||1000)),all=c.operations.slice().sort((a,b)=>new Date(b.FECHA_INICIO||b.CREADO_EN||0)-new Date(a.FECHA_INICIO||a.CREADO_EN||0)),rows=all.slice(offset,offset+limit);
    return{rows,total:all.length,desde:offset,limite:limit,hasMore:offset+rows.length<all.length,orden:'MAS_RECIENTES_PRIMERO'};
  }

  function localFuelSummary(){const user=requireLocalUser();requireLocalPermission(user,'COMBUSTIBLE','LEER');const rows=localFilterRows('fuel',activeRows(localDb.fuel),user),monthStart=new Date(new Date().getFullYear(),new Date().getMonth(),1),month=rows.filter(row=>new Date(row.FECHA_HORA||row.CREADO_EN)>=monthStart),sum=(list,field)=>list.reduce((total,row)=>total+Number(row[field]||0),0),distanceRows=rows.filter(row=>Number(row.DISTANCIA_DESDE_ULTIMA_CARGA_KM||0)>0&&Number(row.LITROS||0)>0),distance=sum(distanceRows,'DISTANCIA_DESDE_ULTIMA_CARGA_KM'),litersForConsumption=sum(distanceRows,'LITROS'),byVehicle={};rows.forEach(row=>{const key=row.VEHICULO_ID||'SIN-VEHICULO',item=byVehicle[key]||(byVehicle[key]={VEHICULO_ID:key,CARGAS:0,LITROS:0,COSTO_TOTAL:0,DISTANCIA_KM:0});item.CARGAS++;item.LITROS+=Number(row.LITROS||0);item.COSTO_TOTAL+=Number(row.COSTO_TOTAL||0);item.DISTANCIA_KM+=Number(row.DISTANCIA_DESDE_ULTIMA_CARGA_KM||0);});return{totalCargas:rows.length,totalLitros:localFuelRound(sum(rows,'LITROS'),2),gastoTotal:localFuelRound(sum(rows,'COSTO_TOTAL'),2),precioPromedioLitro:rows.length?localFuelRound(sum(rows,'COSTO_TOTAL')/Math.max(sum(rows,'LITROS'),.001),2):0,consumoPromedioKmL:distance&&litersForConsumption?localFuelRound(distance/litersForConsumption,2):0,consumoPromedioL100Km:distance&&litersForConsumption?localFuelRound(litersForConsumption/distance*100,2):0,mesActual:{cargas:month.length,litros:localFuelRound(sum(month,'LITROS'),2),gasto:localFuelRound(sum(month,'COSTO_TOTAL'),2)},porVehiculo:Object.values(byVehicle).sort((a,b)=>b.COSTO_TOTAL-a.COSTO_TOTAL)};}
  function localRequestFuelDeletion(payload){const user=requireLocalUser();requireLocalPermission(user,'COMBUSTIBLE','SOLICITAR_ELIMINACION');if(user.ROL_ID!=='ROL-SUPERVISOR')throw new Error('SOLO_SUPERVISOR_SOLICITA_ELIMINACION');const data=payload.data||payload,chargeId=String(data.CARGA_ID||payload.id||'').trim(),reason=String(data.MOTIVO||'').trim();if(reason.length<10)throw new Error('COMBUSTIBLE_MOTIVO_ELIMINACION_REQUERIDO');if(!find('fuel',chargeId))throw new Error('REGISTRO_NO_ENCONTRADO');if(activeRows(localDb.fuelAuthorizations).some(row=>row.CARGA_ID===chargeId&&row.SOLICITADO_POR===user.ID&&['PENDIENTE','APROBADA'].includes(row.ESTADO)))throw new Error('COMBUSTIBLE_SOLICITUD_YA_EXISTE');const now=iso(),row={ID:id('AUT-COM'),CARGA_ID:chargeId,SOLICITADO_POR:user.ID,SOLICITANTE_NOMBRE:user.NOMBRE,MOTIVO:reason,ESTADO:'PENDIENTE',AUTORIZADO_POR:'',AUTORIZADOR_NOMBRE:'',COMENTARIO_AUTORIZACION:'',FECHA_SOLICITUD:now,FECHA_AUTORIZACION:'',FECHA_EJECUCION:'',IP_SOLICITUD:String(data.IP_PUBLICA||''),IP_AUTORIZACION:'',EJECUTADO_POR:'',CREADO_EN:now,ACTUALIZADO_EN:now,ELIMINADO:'NO'};localDb.fuelAuthorizations.push(row);audit(user,'SOLICITAR_ELIMINACION','COMBUSTIBLE',`Solicitud ${row.ID}. Motivo: ${reason}`,chargeId);localNotifyRoles(['ROL-ADMIN'],{TITULO:'Autorización de eliminación pendiente',MENSAJE:`${user.NOMBRE} solicita eliminar la carga ${chargeId}. Motivo: ${reason}`,TIPO:'Combustible',PRIORIDAD:'Alta',CREADO_POR:user.ID});saveLocal();return{row:cleanRow(row)};}
  function localResolveFuelDeletion(payload){const user=requireLocalUser();if(user.ROL_ID!=='ROL-ADMIN')throw new Error('SOLO_ADMINISTRADOR');const data=payload.data||payload,requestId=String(data.SOLICITUD_ID||payload.id||''),decision=String(data.DECISION||'').toUpperCase();if(!['APROBAR','RECHAZAR'].includes(decision))throw new Error('COMBUSTIBLE_DECISION_INVALIDA');const row=find('fuelAuthorizations',requestId);if(!row)throw new Error('COMBUSTIBLE_SOLICITUD_NO_ENCONTRADA');if(row.ESTADO!=='PENDIENTE')throw new Error('COMBUSTIBLE_SOLICITUD_YA_RESUELTA');Object.assign(row,{ESTADO:decision==='APROBAR'?'APROBADA':'RECHAZADA',AUTORIZADO_POR:user.ID,AUTORIZADOR_NOMBRE:user.NOMBRE,COMENTARIO_AUTORIZACION:String(data.COMENTARIO||'').slice(0,1000),FECHA_AUTORIZACION:iso(),IP_AUTORIZACION:String(data.IP_PUBLICA||''),ACTUALIZADO_EN:iso()});audit(user,decision==='APROBAR'?'AUTORIZAR_ELIMINACION':'RECHAZAR_ELIMINACION','COMBUSTIBLE',`Solicitud ${requestId} ${row.ESTADO.toLowerCase()}`,row.CARGA_ID);localCreateNotification({DESTINATARIO_USUARIO_ID:row.SOLICITADO_POR,TITULO:decision==='APROBAR'?'Eliminación autorizada':'Eliminación rechazada',MENSAJE:`La solicitud ${requestId} fue ${row.ESTADO.toLowerCase()} por ${user.NOMBRE}.`,TIPO:'Combustible',PRIORIDAD:decision==='APROBAR'?'Alta':'Normal',CREADO_POR:user.ID});saveLocal();return{row:cleanRow(row)};}
  function localDeleteFuel(payload){const user=requireLocalUser();requireLocalPermission(user,'COMBUSTIBLE','ELIMINAR');if(user.ROL_ID==='ROL-CONDUCTOR')throw new Error('PERMISO_DENEGADO');const data=payload.data||payload,chargeId=String(data.CARGA_ID||payload.id||''),charge=find('fuel',chargeId);if(!charge)throw new Error('REGISTRO_NO_ENCONTRADO');const respaldo=cleanRow({...charge});let detail='';if(user.ROL_ID==='ROL-SUPERVISOR'){const authorization=find('fuelAuthorizations',String(data.SOLICITUD_ID||''));if(!authorization||authorization.CARGA_ID!==chargeId||authorization.SOLICITADO_POR!==user.ID||authorization.ESTADO!=='APROBADA'||authorization.FECHA_EJECUCION)throw new Error('COMBUSTIBLE_AUTORIZACION_ADMIN_REQUERIDA');Object.assign(authorization,{ESTADO:'EJECUTADA',FECHA_EJECUCION:iso(),EJECUTADO_POR:user.ID,ACTUALIZADO_EN:iso()});detail=`Autorización ${authorization.ID} de ${authorization.AUTORIZADOR_NOMBRE}.`;localCreateNotification({DESTINATARIO_USUARIO_ID:authorization.AUTORIZADO_POR,TITULO:'Eliminación ejecutada',MENSAJE:`${user.NOMBRE} ejecutó la eliminación autorizada de la carga ${chargeId}.`,TIPO:'Combustible',PRIORIDAD:'Normal',CREADO_POR:user.ID,CLAVE_UNICA:`RUTA-FINALIZADA-${route.ID}`});}else if(user.ROL_ID==='ROL-ADMIN'){const reason=String(data.MOTIVO||'').trim()||'Eliminación administrativa sin motivo adicional';detail=`Eliminación directa. Motivo: ${reason}.`;activeRows(localDb.fuelAuthorizations).filter(row=>row.CARGA_ID===chargeId&&['PENDIENTE','APROBADA'].includes(row.ESTADO)).forEach(row=>Object.assign(row,{ESTADO:'ANULADA',FECHA_EJECUCION:iso(),EJECUTADO_POR:user.ID,ACTUALIZADO_EN:iso()}));}else throw new Error('PERMISO_DENEGADO');charge.ELIMINADO='SI';charge.ACTUALIZADO_EN=iso();localRecalculateFuel(charge.VEHICULO_ID);audit(user,'ELIMINAR_CARGA','COMBUSTIBLE',`${detail} Respaldo íntegro previo: ${JSON.stringify(respaldo)}`,chargeId);saveLocal();return{id:chargeId};}

  function localSaveUserPermissions(payload){
    const actor=requireLocalUser();if(actor.ROL_ID!=='ROL-ADMIN')throw new Error('SOLO_ADMINISTRADOR');requireLocalPermission(actor,'USUARIOS','GESTIONAR_PERMISOS');const data=payload.data||payload,row=find('users',data.USUARIO_ID||payload.id);if(!row)throw new Error('REGISTRO_NO_ENCONTRADO');const before=cleanRow({...row}),accessBefore=effectiveLocalPermissions(row).includes('CONEXIONES:LEER');
    if(row.ROL_ID==='ROL-ADMIN'){row.MODO_PERMISOS='ROL';row.PERMISOS_PERSONALIZADOS='[]';}
    else{row.MODO_PERMISOS=String(data.MODO_PERMISOS||'ROL').toUpperCase()==='PERSONALIZADO'?'PERSONALIZADO':'ROL';row.PERMISOS_PERSONALIZADOS=JSON.stringify(row.MODO_PERMISOS==='PERSONALIZADO'?normalizeLocalPermissions(data.PERMISOS||data.PERMISOS_PERSONALIZADOS):[]);}
    row.VERSION_PERMISOS=Number(row.VERSION_PERMISOS||0)+1;row.ACTUALIZADO_EN=iso();const accessAfter=effectiveLocalPermissions(row).includes('CONEXIONES:LEER');audit(actor,'ACTUALIZAR_PERMISOS','USUARIOS',`Respaldo anterior: ${JSON.stringify(before)}. Datos posteriores: ${JSON.stringify(cleanRow(row))}`,row.ID);if(accessBefore!==accessAfter)audit(actor,accessAfter?'OTORGAR_ACCESO_CONEXIONES':'RETIRAR_ACCESO_CONEXIONES','CONEXIONES',`${accessAfter?'Acceso otorgado':'Acceso retirado'} a Conexiones en línea para ${row.NOMBRE||row.CORREO||row.ID}.`,row.ID);saveLocal();const confirmed=find('users',row.ID);if(!confirmed)throw new Error('PERMISOS_USUARIO_NO_CONFIRMADOS');return{row:publicUser(confirmed),sessionPreserved:true,persistenciaConfirmada:true,accesoConexiones:accessAfter};
  }
  function panelPrincipalLocal() {
    const user=requireLocalUser();requireLocalPermission(user,'PANEL_PRINCIPAL','LEER');const rows = key => hasLocalPermission(user,moduleByResource[key],'LEER')?localFilterRows(key,activeRows(localDb[key]),user):[];
    const onlineLimit=Date.now()-(config.ANTIGUEDAD_CONEXION_ACTIVA_MILISEGUNDOS||90000);
    const operations=rows('operations'),vehicles=rows('vehicles'),fuel=rows('fuel'),monthStart=new Date(new Date().getFullYear(),new Date().getMonth(),1),fuelMonth=fuel.filter(row=>new Date(row.FECHA_HORA||row.CREADO_EN)>=monthStart),operationCounts={};
    operations.forEach(row=>{const date=new Date(row.FECHA_INICIO||row.CREADO_EN);if(!Number.isNaN(date.getTime())){const key=date.toISOString().slice(0,10);operationCounts[key]=(operationCounts[key]||0)+1;}});
    const operationsByDay=Array.from({length:7},(_,index)=>{const date=new Date();date.setDate(date.getDate()-(6-index));const key=date.toISOString().slice(0,10);return{FECHA:key,ETIQUETA:new Intl.DateTimeFormat('es-CL',{weekday:'short'}).format(date).replace('.',''),TOTAL:operationCounts[key]||0};});
    const countStates=list=>Object.entries(list.reduce((acc,row)=>{const state=row.ESTADO||'Sin estado';acc[state]=(acc[state]||0)+1;return acc;},{})).map(([ESTADO,TOTAL])=>({ESTADO,TOTAL})).sort((a,b)=>b.TOTAL-a.TOTAL);
    const vehicleKpis=vehicles.map(vehicle=>{const vehicleOps=operations.filter(row=>row.VEHICULO_ID===vehicle.ID),vehicleFuel=fuel.filter(row=>row.VEHICULO_ID===vehicle.ID),gps=localFilterRows('gps',activeRows(localDb.gps),user).filter(row=>row.VEHICULO_ID===vehicle.ID),current=localFilterRows('gps',activeRows(localDb.gpsCurrent),user).filter(row=>row.VEHICULO_ID===vehicle.ID).sort((a,b)=>new Date(b.FECHA_HORA||0)-new Date(a.FECHA_HORA||0))[0]||{},km=vehicleOps.reduce((sum,row)=>sum+localReportsDistance(row),0),liters=vehicleFuel.reduce((sum,row)=>sum+Number(row.LITROS||0),0),cost=vehicleFuel.reduce((sum,row)=>sum+Number(row.COSTO_TOTAL||Number(row.LITROS||0)*Number(row.PRECIO_LITRO||0)),0),days=Math.max(1,new Set(vehicleFuel.map(row=>String(row.FECHA_HORA||row.CREADO_EN||'').slice(0,10)).filter(Boolean)).size),speeds=gps.map(row=>Number(row.VELOCIDAD_KMH||0)).filter(value=>value>=0&&value<=220);return{ID:vehicle.ID,PATENTE:vehicle.PATENTE,MARCA:vehicle.MARCA,MODELO:vehicle.MODELO,KM_RECORRIDOS:km,LITROS:liters,COSTO_TOTAL:cost,PRECIO_PROMEDIO_LITRO:vehicleFuel.length?vehicleFuel.reduce((sum,row)=>sum+Number(row.PRECIO_LITRO||0),0)/vehicleFuel.length:0,CONSUMO_LITROS_DIA:liters/days,COSTO_DIA:cost/days,RENDIMIENTO_KM_L:liters?km/liters:0,CONSUMO_L_100KM:km?liters*100/km:0,VELOCIDAD_ACTUAL_KMH:Number(current.VELOCIDAD_KMH||0),VELOCIDAD_PROMEDIO_KMH:speeds.length?speeds.reduce((a,b)=>a+b,0)/speeds.length:0,VELOCIDAD_MAXIMA_KMH:speeds.length?Math.max(...speeds):0,ULTIMA_LECTURA:current.FECHA_HORA||''};});
    return { metrics:{ vehicles:rows('vehicles').length,availableVehicles:rows('vehicles').filter(x=>x.ESTADO==='Disponible').length,drivers:rows('drivers').length,
      availableDrivers:rows('drivers').filter(x=>x.ESTADO==='Disponible').length,activeOperations:rows('operations').filter(x=>x.ESTADO==='Activa').length,
      openMaintenance:rows('maintenance').filter(x=>['Programada','En proceso','Atrasada'].includes(x.ESTADO)).length,fuelLoadsMonth:fuelMonth.length,fuelLitersMonth:fuelMonth.reduce((total,row)=>total+Number(row.LITROS||0),0),fuelCostMonth:fuelMonth.reduce((total,row)=>total+Number(row.COSTO_TOTAL||0),0),
      expiredDocuments:rows('documents').filter(x=>x.ESTADO==='Vencido').length,unreadAlerts:rows('alerts').filter(x=>x.LEIDA!=='SI').length,
      assignedRoutes:rows('routes').filter(x=>['Asignada','En curso'].includes(x.ESTADO)).length,
      unreadNotifications:rows('notifications').filter(x=>x.LEIDA!=='SI').length,
      onlineDevices:rows('connections').filter(x=>x.ESTADO!=='Desconectado'&&new Date(x.ULTIMA_CONEXION).getTime()>=onlineLimit).length,
      pendingCheckins:rows('checkins').filter(x=>x.ESTADO_REVISION==='Pendiente'&&x.UTILIZADO!=='SI').length,
      blockedCheckins:rows('checkins').filter(x=>x.ESTADO_REVISION==='Bloqueado'&&x.UTILIZADO!=='SI').length,
      approvedCheckins:rows('checkins').filter(x=>x.ESTADO_REVISION==='Aprobado'&&new Date(x.VIGENTE_HASTA||0).getTime()>Date.now()).length },
      recentOperations:rows('operations').slice(-10).reverse(), alerts:rows('alerts').filter(x=>x.LEIDA!=='SI').slice(-10).reverse(),
      notifications:rows('notifications').filter(x=>x.LEIDA!=='SI').slice(-10).reverse(),routes:rows('routes').slice(-10).reverse(),vehicleKpis,KPI_VEHICULOS:vehicleKpis,
      charts:{operationsByDay,vehicleStates:countStates(vehicles),routeStates:countStates(rows('routes'))} };
  }
  function localCheckinCatalog() {
    return [
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
    ];
  }
  function localNormalizeCheckinList(value){
    let received=value;
    if(typeof received==='string'){try{received=JSON.parse(received);}catch(_){throw new Error('CHECKIN_LISTA_INVALIDA');}}
    if(!Array.isArray(received))throw new Error('CHECKIN_LISTA_INVALIDA');
    const byId=Object.fromEntries(received.filter(Boolean).map(item=>[String(item.id||''),item]));
    return localCheckinCatalog().map(def=>{
      const input=byId[def.id]||{},rawAnswer=String(input.respuesta||'').trim().toUpperCase(),answer=rawAnswer==='CONFORME'?'OK':['NO CONFORME','NO_CONFORME'].includes(rawAnswer)?'FALLA':rawAnswer;
      if(!['OK','FALLA','NA'].includes(answer))throw new Error(`CHECKIN_ITEM_INCOMPLETO_${def.id.toUpperCase()}`);
      return {...def,respuesta:def.critico&&answer==='NA'?'FALLA':answer,observacion:String(input.observacion||'').slice(0,500)};
    });
  }
  function localAssignCheckinVehicle(payload){
    const user=requireLocalUser(),data=payload.data||payload,role=String(user.ROL_ID||'').toUpperCase();if(!['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'].includes(role))throw new Error('PERMISO_DENEGADO');requireLocalPermission(user,'CHECKIN','ASIGNAR_VEHICULO');
    let driver=find('drivers',String(data.CONDUCTOR_ID||''));const vehicle=find('vehicles',String(data.VEHICULO_ID||''));if(!driver)throw new Error('CONDUCTOR_NO_ENCONTRADO');if(!vehicle)throw new Error('VEHICULO_NO_ENCONTRADO');if(!['DISPONIBLE','ACTIVO'].includes(String(vehicle.ESTADO||'').toUpperCase())||!['DISPONIBLE','ACTIVO'].includes(String(driver.ESTADO||'').toUpperCase()))throw new Error('RECURSO_NO_DISPONIBLE');
    const relation=localEnsureCheckinDriverUser(driver,user);driver=relation.driver;
    const now=iso();
    // Si el vehículo cambia de conductor, los Check-in vigentes del conductor anterior dejan de servir inmediatamente.
    activeRows(localDb.checkins).filter(item=>item.VEHICULO_ID===vehicle.ID&&item.CONDUCTOR_ID!==driver.ID&&item.ESTADO_REVISION==='Aprobado'&&new Date(item.VIGENTE_HASTA||0).getTime()>Date.now()).forEach(item=>{item.VIGENTE_HASTA=now;item.ACTUALIZADO_EN=now;});
    activeRows(localDb.checkinAssignments).filter(row=>row.CONDUCTOR_ID===driver.ID&&['ASIGNADO','CHECKIN_PENDIENTE','CHECKIN_LISTO','RUTA_ASIGNADA'].includes(row.ESTADO)).forEach(row=>{row.ESTADO='REEMPLAZADO';row.ACTUALIZADO_EN=now;});
    const row={ID:id('AVC'),CONDUCTOR_ID:driver.ID,VEHICULO_ID:vehicle.ID,ESTADO:'ASIGNADO',ASIGNADO_POR:user.ID,ASIGNADO_POR_NOMBRE:user.NOMBRE,FECHA_ASIGNACION:now,CHECKIN_ID:'',FECHA_CHECKIN:'',CREADO_EN:now,ACTUALIZADO_EN:now,ELIMINADO:'NO'};localDb.checkinAssignments.push(row);
    const notice=localCreateNotification({DESTINATARIO_USUARIO_ID:driver.USUARIO_ID||'',DESTINATARIO_CONDUCTOR_ID:driver.ID,DESTINATARIO_NOMBRE:driver.NOMBRE,ASIGNADO_POR_NOMBRE:user.NOMBRE,TITULO:'Vehículo asignado',MENSAJE:`Se asignó el vehículo ${vehicle.PATENTE||vehicle.ID}. Retire la llave y complete el check-in antes de recibir una ruta.`,TIPO:'Check-in',PRIORIDAD:'Urgente',CATEGORIA_EMERGENTE:'VEHICULO_CHECKIN_ASIGNADO',NOMBRE_ASIGNACION:vehicle.PATENTE||vehicle.ID,ORIGEN:'Retiro de llave',DESTINO:'Completar check-in',ESTADO_RESPUESTA:'PENDIENTE',CREADO_POR:user.ID,CLAVE_UNICA:`VEHICULO-CHECKIN-${row.ID}`});audit(user,'ASIGNAR_VEHICULO_CHECKIN','CHECKIN',`${vehicle.PATENTE||vehicle.ID} asignado a ${driver.NOMBRE||driver.ID}. Relación usuario-conductor: ${relation.reason}`,row.ID);saveLocal();return{row,vehiculo:cleanRow(vehicle),conductor:cleanRow(driver),alerta:notice.row||notice,relacionUsuario:{VINCULADO:relation.linked,USUARIO_ID:driver.USUARIO_ID||'',MOTIVO:relation.reason}};
  }
  function localCurrentCheckinAssignment(payload={}){const user=requireLocalUser(),data=payload.data||payload,own=localDriver(user)||localAssociateDriverByEmail(user,'CONSULTA_ASIGNACION_CHECKIN').driver,driverId=String(data.CONDUCTOR_ID||own?.ID||'');if(!driverId)throw new Error('CONDUCTOR_NO_ASOCIADO');if(user.ROL_ID==='ROL-CONDUCTOR'&&driverId!==String(own?.ID||''))throw new Error('PERMISO_DENEGADO');const driver=find('drivers',driverId),row=activeRows(localDb.checkinAssignments).filter(item=>item.CONDUCTOR_ID===driverId&&['ASIGNADO','CHECKIN_PENDIENTE','CHECKIN_LISTO','RUTA_ASIGNADA'].includes(item.ESTADO)).sort((a,b)=>new Date(b.FECHA_ASIGNACION)-new Date(a.FECHA_ASIGNACION))[0];if(row)return{asignacion:row,vehiculo:cleanRow(find('vehicles',row.VEHICULO_ID)),conductor:cleanRow(driver),origenAsignacion:'CHECKIN'};const route=activeRows(localDb.routes).filter(item=>item.CONDUCTOR_ID===driverId&&['Asignada','En curso'].includes(item.ESTADO)).sort((a,b)=>new Date(b.FECHA_INICIO||b.FECHA_ASIGNACION||0)-new Date(a.FECHA_INICIO||a.FECHA_ASIGNACION||0))[0],operation=activeRows(localDb.operations).filter(item=>item.CONDUCTOR_ID===driverId&&['Activa','En curso'].includes(item.ESTADO)).sort((a,b)=>new Date(b.FECHA_INICIO||0)-new Date(a.FECHA_INICIO||0))[0],vehicleId=route?.VEHICULO_ID||operation?.VEHICULO_ID||'';return{asignacion:null,vehiculo:vehicleId?cleanRow(find('vehicles',vehicleId)):null,conductor:cleanRow(driver),origenAsignacion:vehicleId?'RUTA_OPERACION':null};}
  function localCreateVehicleCheckin(payload){
    const user=requireLocalUser(),data={...(payload.data||payload)};requireLocalPermission(user,'CHECKIN','CREAR');
    if(user.ROL_ID==='ROL-CONDUCTOR'){const own=localDriver(user);if(!own)throw new Error('CONDUCTOR_NO_ASOCIADO');data.CONDUCTOR_ID=own.ID;}
    if(!data.VEHICULO_ID||!data.CONDUCTOR_ID||data.KILOMETRAJE===''||!data.LISTA_CODIFICADA)throw new Error('CHECKIN_DATOS_REQUERIDOS');if(String(data.CONFIRMACION_CONDUCTOR||'')!=='SI')throw new Error('CHECKIN_CONFIRMACION_REQUERIDA');
    const vehicle=find('vehicles',data.VEHICULO_ID),driver=find('drivers',data.CONDUCTOR_ID);if(!vehicle)throw new Error('VEHICULO_NO_ENCONTRADO');if(!driver)throw new Error('CONDUCTOR_NO_ENCONTRADO');
    const requestId=String(data.SOLICITUD_CLIENTE_ID||'').slice(0,120),duplicate=requestId&&activeRows(localDb.checkins).find(item=>item.SOLICITUD_CLIENTE_ID===requestId&&item.CREADO_POR===user.ID);if(duplicate)return{row:cleanRow(duplicate),persistenciaConfirmada:true,persistencia:'LOCAL',duplicadoEvitado:true,advertencias:[]};
    if(user.ROL_ID==='ROL-CONDUCTOR'){
      const assigned=activeRows(localDb.checkinAssignments).some(item=>item.CONDUCTOR_ID===driver.ID&&item.VEHICULO_ID===vehicle.ID&&['ASIGNADO','CHECKIN_PENDIENTE','CHECKIN_LISTO','RUTA_ASIGNADA'].includes(item.ESTADO)),route=activeRows(localDb.routes).some(item=>item.CONDUCTOR_ID===driver.ID&&item.VEHICULO_ID===vehicle.ID&&['Asignada','En curso'].includes(item.ESTADO)),operation=activeRows(localDb.operations).some(item=>item.CONDUCTOR_ID===driver.ID&&item.VEHICULO_ID===vehicle.ID&&['Activa','En curso'].includes(item.ESTADO));if(!assigned&&!route&&!operation)throw new Error('VEHICULO_QR_NO_COINCIDE_ASIGNACION');
    }
    const validadoPorQr=localConsumeVehicleQrAuthorization(data.AUTORIZACION_QR,user,vehicle.ID,'checkin',user.ROL_ID==='ROL-CONDUCTOR');
    if(vehicle.ESTADO!=='Disponible'&&!activeRows(localDb.routes).some(item=>item.VEHICULO_ID===vehicle.ID&&['Asignada','En curso'].includes(item.ESTADO)))throw new Error('VEHICULO_NO_DISPONIBLE');if(driver.ESTADO!=='Disponible'&&!activeRows(localDb.routes).some(item=>item.CONDUCTOR_ID===driver.ID&&['Asignada','En curso'].includes(item.ESTADO)))throw new Error('CONDUCTOR_NO_DISPONIBLE');
    const list=localNormalizeCheckinList(data.LISTA_CODIFICADA),critical=list.filter(i=>i.respuesta==='FALLA'&&i.critico).length,minor=list.filter(i=>i.respuesta==='FALLA'&&!i.critico).length,hasFailure=critical+minor>0,now=iso(),state=hasFailure?'Pendiente':'Aprobado',result=hasFailure?'No conforme':'Conforme';
    const row={ID:id('CHK'),VEHICULO_ID:vehicle.ID,CONDUCTOR_ID:driver.ID,OPERACION_ID:'',FECHA_HORA:now,KILOMETRAJE:Number(data.KILOMETRAJE||vehicle.KILOMETRAJE||0),NIVEL_COMBUSTIBLE:data.NIVEL_COMBUSTIBLE||'No informado',LISTA_CODIFICADA:JSON.stringify(list),TOTAL_ITEMS:list.length,ITEMS_OK:list.filter(i=>i.respuesta==='OK').length,FALLAS_LEVES:minor,FALLAS_CRITICAS:critical,RESULTADO:result,ESTADO_REVISION:state,OBSERVACIONES:String(data.OBSERVACIONES||'').slice(0,1500),FIRMA_CONDUCTOR:String(data.FIRMA_CONDUCTOR||user.NOMBRE||driver.NOMBRE).slice(0,180),REVISADO_POR:state==='Aprobado'?user.ID:'',FECHA_REVISION:state==='Aprobado'?now:'',COMENTARIO_REVISION:state==='Aprobado'?'Aprobación automática: todos los controles conformes.':'',VIGENTE_HASTA:new Date(Date.now()+24*60*60*1000).toISOString(),UTILIZADO:'NO',CREADO_POR:user.ID,CREADO_EN:now,ACTUALIZADO_EN:now,ELIMINADO:'NO',SOLICITUD_CLIENTE_ID:requestId,FECHA_OPERATIVA:now.slice(0,10)};localDb.checkins.push(row);
    activeRows(localDb.checkinAssignments).filter(item=>item.CONDUCTOR_ID===driver.ID&&item.VEHICULO_ID===vehicle.ID&&['ASIGNADO','CHECKIN_PENDIENTE','CHECKIN_LISTO','RUTA_ASIGNADA'].includes(item.ESTADO)).forEach(item=>Object.assign(item,{ESTADO:state==='Aprobado'?'CHECKIN_LISTO':'CHECKIN_PENDIENTE',CHECKIN_ID:row.ID,FECHA_CHECKIN:now,ACTUALIZADO_EN:now}));
    localNotifyRoles(['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'],{TITULO:state==='Aprobado'?'Check-in hecho · listo para asignar ruta':'Check-in No conforme · requiere decisión',MENSAJE:`${driver.NOMBRE||user.NOMBRE} finalizó la inspección ${row.ID} del vehículo ${vehicle.PATENTE||vehicle.ID}. Abra la inspección para revisar el detalle${state==='Aprobado'?' y asignar una ruta inmediatamente':', aprobarla o anularla'}.`,TIPO:'Check-in',PRIORIDAD:hasFailure?'Urgente':'Alta',CHECKIN_ID:row.ID,CONDUCTOR_ID:driver.ID,VEHICULO_ID:vehicle.ID,CATEGORIA_EMERGENTE:state==='Aprobado'?'CHECKIN_LISTO_RUTA':'CHECKIN_REVISION',ACCION_DESTINO:'CHECKIN_DETALLE',ACCION_ETIQUETA:'Ver inspección',CREADO_POR:user.ID,CLAVE_UNICA:`CHECKIN-FINALIZADO-${row.ID}`});
    if(hasFailure)localDb.alerts.push({ID:id('ALT'),TIPO:'Check-in vehicular',NIVEL:critical?'Crítica':'Advertencia',TITULO:'Check-in No conforme pendiente de decisión',MENSAJE:`${vehicle.PATENTE}: ${critical} falla(s) crítica(s) y ${minor} observación(es). Operador, Administrador o Gerencia debe aprobar o anular.`,MODULO:'CHECKIN',REGISTRO_ID:row.ID,LEIDA:'NO',USUARIO_ID:'',FECHA_HORA:now,CREADO_EN:now,ACTUALIZADO_EN:now,ELIMINADO:'NO'});
    audit(user,'CREAR','CHECKIN',`${vehicle.PATENTE} · ${result}${validadoPorQr?' · QR validado':''}`,row.ID);saveLocal();const confirmed=find('checkins',row.ID);if(!confirmed)throw new Error('CHECKIN_NO_CONFIRMADO_EN_BASE_LOCAL');return{row:cleanRow(confirmed),catalogo:localCheckinCatalog(),persistenciaConfirmada:true,persistencia:'LOCAL',duplicadoEvitado:false,advertencias:[]};
  }
  function localReviewVehicleCheckin(payload){
    const user=requireLocalUser(),data=payload.data||payload,idValue=payload.id||data.CHECKIN_ID,row=find('checkins',idValue);if(!row)throw new Error('CHECKIN_NO_ENCONTRADO');
    const decision=String(data.DECISION||'').toUpperCase(),approve=['APROBAR','APROBADO'].includes(decision),annul=['ANULAR','ANULADO','RECHAZAR','BLOQUEAR','BLOQUEADO'].includes(decision);if(!approve&&!annul)throw new Error('CHECKIN_DECISION_INVALIDA');if(!['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'].includes(user.ROL_ID))throw new Error('PERMISO_DENEGADO');requireLocalPermission(user,'CHECKIN_APROBACIONES',approve?'APROBAR':'RECHAZAR');
    const comment=String(data.COMENTARIO_REVISION||data.COMENTARIO||'').trim().slice(0,1000);if(!comment)throw new Error('COMENTARIO_REVISION_REQUERIDO');const state=approve?'Aprobado':'Anulado',now=iso(),noConforme=Number(row.FALLAS_CRITICAS||0)>0||Number(row.FALLAS_LEVES||0)>0;Object.assign(row,{ESTADO_REVISION:state,RESULTADO:annul?'No conforme · anulado':approve&&noConforme?'Apto con autorización':row.RESULTADO,REVISADO_POR:user.ID,FECHA_REVISION:now,COMENTARIO_REVISION:comment,AUTORIZACION_NO_CONFORME:approve&&noConforme?'SI':'NO',AUTORIZADO_POR_ROL:approve&&noConforme?user.ROL_ID:'',AUTORIZADO_EN:approve&&noConforme?now:'',ACTUALIZADO_EN:now,VIGENTE_HASTA:approve?new Date(Date.now()+24*60*60*1000).toISOString():now});
    activeRows(localDb.checkinAssignments).filter(item=>item.CONDUCTOR_ID===row.CONDUCTOR_ID&&item.VEHICULO_ID===row.VEHICULO_ID&&['ASIGNADO','CHECKIN_PENDIENTE','CHECKIN_LISTO','RUTA_ASIGNADA'].includes(item.ESTADO)).forEach(item=>Object.assign(item,{ESTADO:approve?'CHECKIN_LISTO':'CHECKIN_PENDIENTE',CHECKIN_ID:row.ID,FECHA_CHECKIN:now,ACTUALIZADO_EN:now}));
    const driver=find('drivers',row.CONDUCTOR_ID);if(driver?.USUARIO_ID)localCreateNotification({DESTINATARIO_USUARIO_ID:driver.USUARIO_ID,DESTINATARIO_CONDUCTOR_ID:driver.ID,TITULO:approve?'Check-in aprobado':'Check-in anulado',MENSAJE:approve?`La inspección ${row.ID} fue aprobada por ${user.NOMBRE}. Puede continuar mientras esté vigente.`:`La inspección ${row.ID} fue anulada por ${user.NOMBRE}. Debe realizar un nuevo check-in. Motivo: ${comment}`,TIPO:'Seguridad',PRIORIDAD:approve?'Alta':'Urgente',CREADO_POR:user.ID,CLAVE_UNICA:`CHECKIN-REVISION-${row.ID}-${now}`});
    if(approve)localNotifyRoles(['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'],{TITULO:'Check-in aprobado · listo para asignar ruta',MENSAJE:`La inspección ${row.ID} quedó aprobada. Ábrala y pulse Asignar ruta para continuar.`,TIPO:'Check-in',PRIORIDAD:'Alta',CHECKIN_ID:row.ID,CONDUCTOR_ID:row.CONDUCTOR_ID,VEHICULO_ID:row.VEHICULO_ID,CATEGORIA_EMERGENTE:'CHECKIN_LISTO_RUTA',ACCION_DESTINO:'CHECKIN_DETALLE',ACCION_ETIQUETA:'Ver inspección',CREADO_POR:user.ID,CLAVE_UNICA:`CHECKIN-LISTO-RUTA-${row.ID}-${now}`});
    audit(user,approve&&noConforme?'AUTORIZAR_NO_CONFORME':approve?'APROBAR_CHECKIN':'ANULAR_CHECKIN','CHECKIN_APROBACIONES',comment,row.ID);saveLocal();return{row:cleanRow(row),autorizacionNoConforme:approve&&noConforme,listoParaRuta:approve,anulado:annul};
  }
  function localAvailableCheckins(payload){
    const user=requireLocalUser(),data=payload.data||payload;requireLocalPermission(user,'OPERACIONES','CREAR');let driverId=String(data.CONDUCTOR_ID||'');
    if(user.ROL_ID==='ROL-CONDUCTOR'){const own=localDriver(user);if(!own)throw new Error('CONDUCTOR_NO_ASOCIADO');driverId=own.ID;}
    const vehicleId=String(data.VEHICULO_ID||''),now=Date.now();let rows=activeRows(localDb.checkins).filter(row=>row.ESTADO_REVISION==='Aprobado'&&new Date(row.VIGENTE_HASTA||0).getTime()>now&&(!vehicleId||row.VEHICULO_ID===vehicleId)&&(!driverId||row.CONDUCTOR_ID===driverId));
    rows=localFilterRows('checkins',rows,user).sort((a,b)=>new Date(b.FECHA_HORA)-new Date(a.FECHA_HORA));return{rows:rows.slice(0,50).map(cleanRow),total:rows.length};
  }
  function localValidateRouteCheckin(payload){
    const user=requireLocalUser(),data=payload.data||payload;requireLocalPermission(user,'RUTAS','CREAR');
    const driverId=String(data.CONDUCTOR_ID||''),vehicleId=String(data.VEHICULO_ID||'');
    if(!driverId||!vehicleId)return{VALIDO:false,valido:false,CODIGO:'CHECKIN_PAREJA_REQUERIDA',MENSAJE:'Seleccione conductor y vehículo para validar el Check-in.'};
    const rows=activeRows(localDb.checkins).filter(row=>row.CONDUCTOR_ID===driverId&&row.VEHICULO_ID===vehicleId&&String(row.ESTADO_REVISION||'').toLowerCase()==='aprobado'&&new Date(row.VIGENTE_HASTA||0).getTime()>Date.now()).sort((a,b)=>new Date(b.FECHA_HORA||b.CREADO_EN||0)-new Date(a.FECHA_HORA||a.CREADO_EN||0));
    const checkin=rows[0];
    if(!checkin)return{VALIDO:false,valido:false,CODIGO:'CHECKIN_APROBADO_REQUERIDO',MENSAJE:'El conductor no posee un Check-in aprobado y vigente para el vehículo seleccionado.'};
    const vehicle=find('vehicles',vehicleId)||{};
    return{VALIDO:true,valido:true,CHECKIN_ID:checkin.ID,VIGENTE_HASTA:checkin.VIGENTE_HASTA,FECHA_CHECKIN:checkin.FECHA_HORA||checkin.CREADO_EN,PATENTE:vehicle.PATENTE||vehicleId,VEHICULO_ID:vehicleId,CONDUCTOR_ID:driverId,CHECKIN:cleanRow(checkin),MENSAJE:`Check-in vigente y aprobado para ${vehicle.PATENTE||vehicleId}.`};
  }
  function localValidateCheckinForOperation(checkinId,vehicleId,driverId){
    if(!checkinId)throw new Error('CHECKIN_REQUERIDO');const row=find('checkins',checkinId);if(!row)throw new Error('CHECKIN_NO_ENCONTRADO');
    if(row.VEHICULO_ID!==vehicleId||row.CONDUCTOR_ID!==driverId)throw new Error('CHECKIN_NO_COINCIDE');if(row.ESTADO_REVISION!=='Aprobado')throw new Error('CHECKIN_NO_APROBADO');if(new Date(row.VIGENTE_HASTA||0).getTime()<=Date.now())throw new Error('CHECKIN_EXPIRADO');return row;
  }
  function localPrimaryCompany(){
    return activeRows(localDb.companies).slice().sort((a,b)=>{
      const activeA=String(a.ESTADO||'Activo')==='Activo'?1:0,activeB=String(b.ESTADO||'Activo')==='Activo'?1:0;
      if(activeA!==activeB)return activeB-activeA;
      return new Date(b.ACTUALIZADO_EN||b.CREADO_EN||0)-new Date(a.ACTUALIZADO_EN||a.CREADO_EN||0);
    })[0]||null;
  }
  function localOperationalBase(){
    const company=localPrimaryCompany()||{};
    if(String(company.VALIDAR_UBICACION_OPERACION||'SI')==='NO')throw new Error('VALIDACION_UBICACION_DESACTIVADA');
    const latitudeText=String(company.PUNTO_OPERACION_LATITUD??'').trim(),longitudeText=String(company.PUNTO_OPERACION_LONGITUD??'').trim(),latitude=Number(latitudeText),longitude=Number(longitudeText);
    if(!latitudeText||!longitudeText||!Number.isFinite(latitude)||!Number.isFinite(longitude))throw new Error('PUNTO_OPERACION_NO_CONFIGURADO');
    return{NOMBRE:company.PUNTO_OPERACION_NOMBRE||'Base operacional',DIRECCION:company.PUNTO_OPERACION_DIRECCION||company.DIRECCION||'Base operacional',LATITUD:latitude,LONGITUD:longitude,RADIO_INICIO_METROS:Math.max(10,Number(company.RADIO_INICIO_METROS||150)),RADIO_FIN_METROS:Math.max(10,Number(company.RADIO_FIN_METROS||150)),PRECISION_GPS_MAXIMA_METROS:Math.max(10,Number(company.PRECISION_GPS_MAXIMA_METROS||120))};
  }
  function localDistanceMeters(lat1,lng1,lat2,lng2){const r=6371000,toRad=value=>Number(value)*Math.PI/180,dLat=toRad(lat2-lat1),dLng=toRad(lng2-lng1),a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;return 2*r*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
  function localEvaluateOperationLocation(data,base,phase){const prefix=phase==='FIN'?'FIN_':'INICIO_',lat=Number(data[prefix+'LATITUD']??data.LATITUD),lng=Number(data[prefix+'LONGITUD']??data.LONGITUD),accuracy=Number(data[prefix+'PRECISION']??data.PRECISION);if(!Number.isFinite(lat)||!Number.isFinite(lng))throw new Error('UBICACION_OPERACION_REQUERIDA');if(!Number.isFinite(accuracy)||accuracy<=0)throw new Error('PRECISION_GPS_REQUERIDA');const precisionValid=accuracy<=base.PRECISION_GPS_MAXIMA_METROS;const distance=localDistanceMeters(lat,lng,base.LATITUD,base.LONGITUD),radius=phase==='FIN'?base.RADIO_FIN_METROS:base.RADIO_INICIO_METROS,tolerance=phase==='FIN'&&!precisionValid?Math.min(accuracy,Number(config.TOLERANCIA_GPS_IMPRECISA_FIN_METROS||500)):0,inside=distance<=radius+tolerance;return{LATITUD:lat,LONGITUD:lng,PRECISION:Math.round(accuracy*10)/10,PRECISION_VALIDA:precisionValid,PRECISION_BAJA:inside&&!precisionValid,TOLERANCIA_PRECISION_METROS:Math.round(tolerance*10)/10,DISTANCIA_METROS:Math.round(distance*10)/10,RADIO_PERMITIDO:radius,DENTRO_PERIMETRO:inside,ESTADO:inside?(precisionValid?'VALIDADA':'VALIDADA_PRECISION_BAJA'):'FUERA_PERIMETRO'};}
  function localValidateOperationLocation(data,base,phase){const result=localEvaluateOperationLocation(data,base,phase);if(phase==='FIN'&&!result.DENTRO_PERIMETRO)throw new Error('FUERA_DEL_PUNTO_DE_FINALIZACION');return result;}
  function localRouteForOperation(data,vehicle,driver,user){if(!data.RUTA_ID)return null;const route=find('routes',data.RUTA_ID);if(!route)throw new Error('RUTA_NO_ENCONTRADA');if(!localFilterRows('routes',[route],user).length)throw new Error('PERMISO_DENEGADO');if(!['Asignada','En curso'].includes(route.ESTADO))throw new Error('RUTA_NO_DISPONIBLE');if(route.CONDUCTOR_ID!==driver.ID)throw new Error('RUTA_NO_COINCIDE_CONDUCTOR');if(route.VEHICULO_ID&&route.VEHICULO_ID!==vehicle.ID)throw new Error('RUTA_NO_COINCIDE_VEHICULO');if(route.OPERACION_ID){const linked=find('operations',route.OPERACION_ID);if(linked?.ESTADO==='Activa')throw new Error('RUTA_YA_VINCULADA');}return route;}
  function localOptionalKm(value){const text=String(value??'').trim().replace(',','.');if(!text)return'';const number=Number(text);return Number.isFinite(number)&&number>=0?Math.round(number*10)/10:'';}
  function localOperationSnapshot(row){return Object.fromEntries(['ID','VEHICULO_ID','CONDUCTOR_ID','RUTA_ID','ORIGEN','DESTINO','FECHA_INICIO','FECHA_FIN','ESTADO','KM_INICIO','KM_FIN','DISTANCIA_KM','OBSERVACIONES'].map(field=>[field,row?.[field]??'']));}
  function localRequireOperationAdmin(user){if(user?.ROL_ID!=='ROL-ADMIN')throw new Error('SOLO_ADMINISTRADOR');}

  function localStartOperation(payload) {
    const user=requireLocalUser(), data={...(payload.data||payload)};requireLocalPermission(user,'OPERACIONES','CREAR');
    if(user.ROL_ID==='ROL-CONDUCTOR'){const own=localDriver(user);if(!own)throw new Error('CONDUCTOR_NO_ASOCIADO');data.CONDUCTOR_ID=own.ID;localConsumeVehicleQrAuthorization(data.AUTORIZACION_QR,user,data.VEHICULO_ID,'vehiculo-operacion',true);}
    const vehicle=find('vehicles',data.VEHICULO_ID), driver=find('drivers',data.CONDUCTOR_ID);
    if(!vehicle||vehicle.ESTADO!=='Disponible')throw new Error('VEHICULO_NO_DISPONIBLE');if(!driver||driver.ESTADO!=='Disponible')throw new Error('CONDUCTOR_NO_DISPONIBLE');
    const checkin=localValidateCheckinForOperation(data.CHECKIN_ID,vehicle.ID,driver.ID),base=localOperationalBase(),start=localValidateOperationLocation(data,base,'INICIO'),route=localRouteForOperation(data,vehicle,driver,user),now=iso(),startOrigin=start.DENTRO_PERIMETRO?base.DIRECCION:`Ubicación capturada ${Number(start.LATITUD).toFixed(6)}, ${Number(start.LONGITUD).toFixed(6)}`,startValidation=start.DENTRO_PERIMETRO?(start.PRECISION_VALIDA?'CAPTURADA_EN_BASE':'CAPTURADA_EN_BASE_PRECISION_BAJA'):(start.PRECISION_VALIDA?'CAPTURADA_FUERA_BASE':'CAPTURADA_FUERA_BASE_PRECISION_BAJA');
    const row={ID:id('OPE'),VEHICULO_ID:vehicle.ID,CONDUCTOR_ID:driver.ID,ORIGEN:startOrigin,DESTINO:route?.DESTINO||base.DIRECCION,FECHA_INICIO:now,FECHA_FIN:'',ESTADO:'Activa',KM_INICIO:localOptionalKm(data.KM_INICIO)===''?localOptionalKm(vehicle.KILOMETRAJE):localOptionalKm(data.KM_INICIO),KM_FIN:'',DISTANCIA_KM:0,OBSERVACIONES:data.OBSERVACIONES||'',CREADO_POR:user.ID,CHECKIN_ID:checkin.ID,RUTA_ID:route?.ID||'',TIPO_OPERACION:route?'Ruta asignada con retorno a base':'Salida y regreso a base',PUNTO_RETORNO:base.DIRECCION,BASE_NOMBRE:base.NOMBRE,BASE_DIRECCION:base.DIRECCION,BASE_LATITUD:base.LATITUD,BASE_LONGITUD:base.LONGITUD,RADIO_INICIO_METROS:base.RADIO_INICIO_METROS,RADIO_FIN_METROS:base.RADIO_FIN_METROS,PRECISION_GPS_MAXIMA_METROS:base.PRECISION_GPS_MAXIMA_METROS,INICIO_LATITUD:start.LATITUD,INICIO_LONGITUD:start.LONGITUD,INICIO_PRECISION:start.PRECISION,DISTANCIA_INICIO_BASE_METROS:start.DISTANCIA_METROS,VALIDACION_INICIO:startValidation,CREADO_EN:now,ACTUALIZADO_EN:now,ELIMINADO:'NO'};
    localDb.operations.push(row);checkin.ACTUALIZADO_EN=now;vehicle.ESTADO='En ruta';driver.ESTADO='En viaje';if(route)Object.assign(route,{OPERACION_ID:row.ID,VEHICULO_ID:vehicle.ID,ORIGEN:startOrigin,ORIGEN_LATITUD:start.LATITUD,ORIGEN_LONGITUD:start.LONGITUD,ESTADO:'En curso',FECHA_INICIO:route.FECHA_INICIO||now,ACTUALIZADO_EN:now});localDb.history.push({ID:id('HIS'),OPERACION_ID:row.ID,EVENTO:'INICIO',DETALLE:`Operación iniciada con ubicación capturada a ${start.DISTANCIA_METROS} m de la base. Estado: ${startValidation}`,FECHA_HORA:now,USUARIO_ID:user.ID,CREADO_EN:now,ELIMINADO:'NO'});audit(user,'INICIAR','OPERACIONES',`Operación iniciada con ubicación capturada (${startValidation})`,row.ID);saveLocal();return{row,locationValidation:start,base};
  }
  function localFinishOperation(payload) {
    const user=requireLocalUser(),data=payload.data||payload,row=find('operations',payload.id||payload.OPERACION_ID||data.OPERACION_ID);
    if(!row||row.ESTADO!=='Activa')throw new Error('OPERACION_NO_ACTIVA');if(!localFilterRows('operations',[row],user).length)throw new Error('PERMISO_DENEGADO');
    if(!['ROL-ADMIN','ROL-SUPERVISOR','ROL-CONDUCTOR'].includes(user.ROL_ID))throw new Error('PERMISO_DENEGADO');
    if(user.ROL_ID==='ROL-CONDUCTOR'&&localDriver(user)?.ID!==row.CONDUCTOR_ID)throw new Error('PERMISO_DENEGADO');
    const currentBase=localOperationalBase(),hasSnapshot=String(row.BASE_LATITUD??'').trim()&&String(row.BASE_LONGITUD??'').trim(),base=hasSnapshot?{...currentBase,NOMBRE:row.BASE_NOMBRE||currentBase.NOMBRE,DIRECCION:row.BASE_DIRECCION||row.PUNTO_RETORNO||row.ORIGEN||currentBase.DIRECCION,LATITUD:Number(row.BASE_LATITUD),LONGITUD:Number(row.BASE_LONGITUD),RADIO_FIN_METROS:Number(row.RADIO_FIN_METROS||currentBase.RADIO_FIN_METROS),PRECISION_GPS_MAXIMA_METROS:Number(row.PRECISION_GPS_MAXIMA_METROS||currentBase.PRECISION_GPS_MAXIMA_METROS)}:currentBase;
    let finish,exceptional=false;const reason=String(data.CIERRE_MOTIVO||data.MOTIVO_CIERRE_EXCEPCIONAL||'').trim();
    try{finish=localValidateOperationLocation(data,base,'FIN');}
    catch(error){if(String(error.message)!=='FUERA_DEL_PUNTO_DE_FINALIZACION')throw error;if(user.ROL_ID==='ROL-CONDUCTOR')throw error;if(!['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'].includes(user.ROL_ID))throw new Error('CIERRE_EXCEPCIONAL_NO_AUTORIZADO');if(data.CIERRE_EXCEPCIONAL!=='SI')throw new Error('CIERRE_EXCEPCIONAL_CONFIRMACION_REQUERIDA');if(reason.length<10)throw new Error('CIERRE_EXCEPCIONAL_MOTIVO_REQUERIDO');finish=localEvaluateOperationLocation(data,base,'FIN');exceptional=true;}
    const kmEnd=localOptionalKm(data.KM_FIN),kmStart=localOptionalKm(row.KM_INICIO),kmConsistente=kmStart!==''&&kmEnd!==''&&kmEnd>=kmStart,kilometrajeAdvertencia=kmEnd===''?'Kilometraje final no informado.':(kmStart!==''&&kmEnd<kmStart?'Kilometraje final menor que el inicial; cierre permitido y dato marcado para revisión.':'');const now=iso(),ip=String(data.IP_PUBLICA||find('sessions',auth.sessionId)?.IP_PUBLICA||'');
    Object.assign(row,{FECHA_FIN:now,ESTADO:'Finalizada',KM_FIN:kmEnd,DISTANCIA_KM:kmConsistente?Math.round((kmEnd-kmStart)*10)/10:'',FIN_LATITUD:finish.LATITUD,FIN_LONGITUD:finish.LONGITUD,FIN_PRECISION:finish.PRECISION,DISTANCIA_FIN_BASE_METROS:finish.DISTANCIA_METROS,VALIDACION_FIN:exceptional?'EXCEPCIONAL_AUTORIZADA':(finish.PRECISION_BAJA?'VALIDADA_PRECISION_BAJA':'VALIDADA'),OBSERVACIONES:data.OBSERVACIONES||row.OBSERVACIONES||'',CIERRE_TIPO:exceptional?'Excepcional fuera de base':(finish.PRECISION_BAJA?'Normal en base con GPS impreciso':'Normal en base'),CIERRE_FUERA_BASE:exceptional?'SI':'NO',CIERRE_MOTIVO:exceptional?reason:'',CIERRE_AUTORIZADO_POR:user.ID,CIERRE_AUTORIZADO_ROL:user.ROL_ID,CIERRE_IP_PUBLICA:ip,CIERRE_FECHA_AUTORIZACION:now,ACTUALIZADO_EN:now});
    const vehicle=find('vehicles',row.VEHICULO_ID),driver=find('drivers',row.CONDUCTOR_ID);if(vehicle){vehicle.ESTADO='Disponible';if(kmEnd!==''&&(localOptionalKm(vehicle.KILOMETRAJE)===''||kmEnd>=Number(vehicle.KILOMETRAJE||0)))vehicle.KILOMETRAJE=kmEnd;}if(driver)driver.ESTADO='Disponible';if(row.RUTA_ID){const route=find('routes',row.RUTA_ID);if(route&&['Asignada','En curso'].includes(route.ESTADO))Object.assign(route,{ESTADO:'Completada',FECHA_FIN:now,OPERACION_ID:row.ID,ACTUALIZADO_EN:now});}
    const detail=exceptional?`Cierre excepcional autorizado fuera de base a ${finish.DISTANCIA_METROS} m. Motivo: ${reason}`:(finish.PRECISION_BAJA?`Operación finalizada en base con señal GPS imprecisa. Distancia ${finish.DISTANCIA_METROS} m · precisión ±${finish.PRECISION} m · tolerancia ${finish.TOLERANCIA_PRECISION_METROS} m.`:`Operación finalizada en punto autorizado a ${finish.DISTANCIA_METROS} m de la base`)+(kilometrajeAdvertencia?` ${kilometrajeAdvertencia}`:'');
    localDb.history.push({ID:id('HIS'),OPERACION_ID:row.ID,EVENTO:exceptional?'FIN_EXCEPCIONAL':(finish.PRECISION_BAJA?'FIN_GPS_IMPRECISO':'FIN'),DETALLE:detail,FECHA_HORA:now,USUARIO_ID:user.ID,CREADO_EN:now,ELIMINADO:'NO'});if(exceptional)localDb.alerts.push({ID:id('ALT'),TIPO:'Cierre excepcional',NIVEL:'Advertencia',TITULO:'Operación finalizada fuera de la base',MENSAJE:`${row.ID} fue cerrada por ${user.NOMBRE} a ${finish.DISTANCIA_METROS} m de la base. Motivo: ${reason}`,MODULO:'OPERACIONES',REGISTRO_ID:row.ID,LEIDA:'NO',USUARIO_ID:'',FECHA_HORA:now,CREADO_EN:now,ACTUALIZADO_EN:now,ELIMINADO:'NO'});else if(finish.PRECISION_BAJA)localDb.alerts.push({ID:id('ALT'),TIPO:'GPS impreciso',NIVEL:'Advertencia',TITULO:'Cierre aceptado con baja precisión GPS',MENSAJE:`${row.ID} finalizó con precisión ±${finish.PRECISION} m y distancia calculada ${finish.DISTANCIA_METROS} m.`,MODULO:'OPERACIONES',REGISTRO_ID:row.ID,LEIDA:'NO',USUARIO_ID:'',FECHA_HORA:now,CREADO_EN:now,ACTUALIZADO_EN:now,ELIMINADO:'NO'});audit(user,exceptional?'FINALIZAR_EXCEPCIONAL':(finish.PRECISION_BAJA?'FINALIZAR_GPS_IMPRECISO':'FINALIZAR'),'OPERACIONES',detail,row.ID);
    const senderIdentity=`${user.NOMBRE||user.ID} (${user.CORREO||'sin correo'}) · usuario ${user.ID}`;
    const vehicleLabel=vehicle?.PATENTE||row.VEHICULO_ID||'Sin vehículo',driverLabel=driver?.NOMBRE||row.CONDUCTOR_ID||'Sin conductor';
    localNotifyRoles(['ROL-ADMIN'],{TITULO:`Ruta/operación finalizada: ${row.ID}`,MENSAJE:`Enviado por: ${senderIdentity}. Conductor: ${driverLabel}. Vehículo: ${vehicleLabel}. Ruta: ${row.RUTA_ID||'Sin ruta asignada'}. Fecha y hora: ${now}. Cierre: ${row.CIERRE_TIPO}. Base: ${base.NOMBRE} (${base.DIRECCION}). Distancia: ${finish.DISTANCIA_METROS} m. Validación: ${row.VALIDACION_FIN}. Observaciones: ${row.OBSERVACIONES||'Sin observaciones'}.`,TIPO:'Operación finalizada',PRIORIDAD:exceptional||finish.PRECISION_BAJA?'Alta':'Normal',RUTA_ID:row.RUTA_ID||'',OPERACION_ID:row.ID,CREADO_POR:user.ID});
    saveLocal();return{row,locationValidation:finish,base,cierreExcepcional:exceptional,procesamientoSegundoPlano:false,notificacionAdministradores:true,autorizadoPor:{ID:user.ID,NOMBRE:user.NOMBRE,ROL_ID:user.ROL_ID}};
  }
  function localEditOperationAdmin(payload){
    const user=requireLocalUser();localRequireOperationAdmin(user);const data=payload.data||payload,row=find('operations',payload.id||payload.OPERACION_ID||data.OPERACION_ID);if(!row)throw new Error('REGISTRO_NO_ENCONTRADO');const reason=String(data.MOTIVO_EDICION||'').trim()||'Actualización administrativa sin motivo adicional.';
    const before=localOperationSnapshot(row),vehicleId=String(data.VEHICULO_ID||row.VEHICULO_ID||''),driverId=String(data.CONDUCTOR_ID||row.CONDUCTOR_ID||''),routeId=String(data.RUTA_ID??row.RUTA_ID??''),vehicle=find('vehicles',vehicleId),driver=find('drivers',driverId),active=row.ESTADO==='Activa';if(!vehicle)throw new Error('VEHICULO_NO_ENCONTRADO');if(!driver)throw new Error('CONDUCTOR_NO_ENCONTRADO');
    if(active&&vehicleId!==row.VEHICULO_ID&&vehicle.ESTADO!=='Disponible')throw new Error('VEHICULO_NO_DISPONIBLE');if(active&&driverId!==row.CONDUCTOR_ID&&driver.ESTADO!=='Disponible')throw new Error('CONDUCTOR_NO_DISPONIBLE');let route=null;if(routeId){route=find('routes',routeId);if(!route)throw new Error('RUTA_NO_ENCONTRADA');if(route.OPERACION_ID&&route.OPERACION_ID!==row.ID&&find('operations',route.OPERACION_ID)?.ESTADO==='Activa')throw new Error('RUTA_YA_VINCULADA');if(route.VEHICULO_ID&&route.VEHICULO_ID!==vehicleId)throw new Error('RUTA_NO_COINCIDE_VEHICULO');if(route.CONDUCTOR_ID&&route.CONDUCTOR_ID!==driverId)throw new Error('RUTA_NO_COINCIDE_CONDUCTOR');}
    if(active&&vehicleId!==row.VEHICULO_ID){const old=find('vehicles',row.VEHICULO_ID);if(old)old.ESTADO='Disponible';vehicle.ESTADO='En ruta';}if(active&&driverId!==row.CONDUCTOR_ID){const old=find('drivers',row.CONDUCTOR_ID);if(old)old.ESTADO='Disponible';driver.ESTADO='En viaje';}
    if(routeId!==String(row.RUTA_ID||'')&&row.RUTA_ID){const old=find('routes',row.RUTA_ID);if(old&&old.OPERACION_ID===row.ID)Object.assign(old,active?{OPERACION_ID:'',ESTADO:'Asignada',FECHA_INICIO:'',ACTUALIZADO_EN:iso()}:{OPERACION_ID:'',ACTUALIZADO_EN:iso()});}if(route)Object.assign(route,{OPERACION_ID:row.ID,VEHICULO_ID:vehicleId,CONDUCTOR_ID:driverId,ESTADO:active?'En curso':route.ESTADO,ACTUALIZADO_EN:iso()});
    const kmStart=localOptionalKm(data.KM_INICIO),kmEnd=localOptionalKm(data.KM_FIN);Object.assign(row,{VEHICULO_ID:vehicleId,CONDUCTOR_ID:driverId,RUTA_ID:routeId,ORIGEN:String(data.ORIGEN??row.ORIGEN??'').trim(),DESTINO:String(data.DESTINO??row.DESTINO??'').trim(),FECHA_INICIO:data.FECHA_INICIO?new Date(data.FECHA_INICIO).toISOString():row.FECHA_INICIO,FECHA_FIN:data.FECHA_FIN?new Date(data.FECHA_FIN).toISOString():row.FECHA_FIN,KM_INICIO:kmStart,KM_FIN:kmEnd,DISTANCIA_KM:kmStart!==''&&kmEnd!==''&&kmEnd>=kmStart?Math.round((kmEnd-kmStart)*10)/10:'',OBSERVACIONES:String(data.OBSERVACIONES??row.OBSERVACIONES??'').slice(0,3000),ACTUALIZADO_EN:iso()});
    const detail=`Edición administrativa. Motivo: ${reason}. Antes: ${JSON.stringify(before)}. Después: ${JSON.stringify(localOperationSnapshot(row))}`;localDb.history.push({ID:id('HIS'),OPERACION_ID:row.ID,EVENTO:'EDICION_ADMIN',DETALLE:detail,FECHA_HORA:iso(),USUARIO_ID:user.ID,CREADO_EN:iso(),ELIMINADO:'NO'});audit(user,'EDITAR_ADMIN','OPERACIONES',detail,row.ID);saveLocal();return{row:cleanRow(row),auditoriaRegistrada:true};
  }
  function localDeleteOperationAdmin(payload){
    const user=requireLocalUser();localRequireOperationAdmin(user);const data=payload.data||payload,row=find('operations',payload.id||payload.OPERACION_ID||data.OPERACION_ID);if(!row)throw new Error('REGISTRO_NO_ENCONTRADO');const reason=String(data.MOTIVO_ELIMINACION||'').trim()||'Eliminación administrativa solicitada por el Administrador.',snapshot=localOperationSnapshot(row),active=row.ESTADO==='Activa';if(active){const vehicle=find('vehicles',row.VEHICULO_ID),driver=find('drivers',row.CONDUCTOR_ID);if(vehicle)vehicle.ESTADO='Disponible';if(driver)driver.ESTADO='Disponible';}if(row.RUTA_ID){const route=find('routes',row.RUTA_ID);if(route&&route.OPERACION_ID===row.ID)Object.assign(route,active?{OPERACION_ID:'',ESTADO:'Asignada',FECHA_INICIO:'',ACTUALIZADO_EN:iso()}:{OPERACION_ID:'',ACTUALIZADO_EN:iso()});}const detail=`Operación eliminada lógicamente por Administrador. Motivo: ${reason}. Datos: ${JSON.stringify(snapshot)}`;localDb.history.push({ID:id('HIS'),OPERACION_ID:row.ID,EVENTO:'ELIMINACION_ADMIN',DETALLE:detail,FECHA_HORA:iso(),USUARIO_ID:user.ID,CREADO_EN:iso(),ELIMINADO:'NO'});row.ELIMINADO='SI';row.ACTUALIZADO_EN=iso();audit(user,'ELIMINAR_ADMIN','OPERACIONES',detail,row.ID);saveLocal();return{id:row.ID,eliminacionLogica:true,auditoriaRegistrada:true};
  }
  function localQrContext(value){const context=String(value||'vehiculo-operacion').trim().toLowerCase();return['vehiculo-operacion','combustible','checkin'].includes(context)?context:'vehiculo-operacion';}
  function localConsumeVehicleQrAuthorization(token,user,vehicleId,context,required=false){const key=String(token||'').trim();if(!key&&!required)return false;const authorization=key?qrAuthorizations.get(key):null;if(!authorization||authorization.USUARIO_ID!==user.ID||authorization.VEHICULO_ID!==vehicleId||localQrContext(authorization.CONTEXTO)!==localQrContext(context)||authorization.EXPIRA<Date.now())throw new Error('AUTORIZACION_QR_INVALIDA');qrAuthorizations.delete(key);return true;}
  function localVehicleQrLabel(payload){
    const user=requireLocalUser(),role=String(user.ROL_ID||'').toUpperCase();
    if(!['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'].includes(role))throw new Error('ETIQUETA_QR_ROL_NO_AUTORIZADO');
    requireLocalPermission(user,'VEHICULOS','LEER');
    const vehicleId=String(payload.id||payload.VEHICULO_ID||payload.vehiculoId||payload.identificador||'').trim();
    let vehicle=find('vehicles',vehicleId);
    if(!vehicle){const comparable=vehicleId.replace(/[^A-Z0-9]/gi,'').toUpperCase();vehicle=activeRows(localDb.vehicles).find(row=>[row.ID,row.PATENTE,row.QR_CODIGO].some(value=>String(value||'').replace(/[^A-Z0-9]/gi,'').toUpperCase()===comparable));}
    if(!vehicle)throw new Error('VEHICULO_NO_ENCONTRADO');
    const patente=String(vehicle.PATENTE||'').trim().toUpperCase();if(!patente)throw new Error('VEHICULO_PATENTE_REQUERIDA');
    const codigo=`VEH-${patente.replace(/[^A-Z0-9]/g,'')}`;vehicle.QR_CODIGO=codigo;vehicle.ACTUALIZADO_EN=iso();
    const descripcion=[vehicle.MARCA,vehicle.MODELO].filter(Boolean).join(' ').trim()||patente;
    audit(user,'GENERAR_ETIQUETA_QR','VEHICULOS',`Etiqueta QR 100 x 50 mm preparada para ${patente} · código ${codigo}`,vehicle.ID);saveLocal();
    return{etiqueta:{VEHICULO_ID:vehicle.ID,TITULO:'CONTROL DE FLOTA',CODIGO:codigo,PATENTE:patente,DESCRIPCION:descripcion,ANCHO_MM:100,ALTO_MM:50},row:cleanRow(vehicle)};
  }

  function localValidateVehicleQr(payload){
    const user=requireLocalUser(),context=localQrContext(payload.contexto||payload.CONTEXTO);requireLocalPermission(user,'QR','LEER');if(context==='combustible')requireLocalPermission(user,'COMBUSTIBLE','REGISTRAR');else if(context==='checkin')requireLocalPermission(user,'CHECKIN','CREAR');else requireLocalPermission(user,'OPERACIONES','CREAR');const normalized=String(payload.codigo||payload.CODIGO||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
    const vehicle=activeRows(localDb.vehicles).find(row=>String(row.QR_CODIGO||'').toUpperCase().replace(/[^A-Z0-9]/g,'')===normalized||String(row.PATENTE||'').toUpperCase().replace(/[^A-Z0-9]/g,'')===normalized);if(!vehicle)throw new Error('QR_NO_RECONOCIDO');
    if(context==='checkin'&&user.ROL_ID==='ROL-CONDUCTOR'){const driver=localDriver(user);if(!driver)throw new Error('CONDUCTOR_NO_ASOCIADO');const assignment=activeRows(localDb.checkinAssignments).some(item=>item.CONDUCTOR_ID===driver.ID&&item.VEHICULO_ID===vehicle.ID&&['ASIGNADO','CHECKIN_PENDIENTE','CHECKIN_LISTO','RUTA_ASIGNADA'].includes(item.ESTADO)),route=activeRows(localDb.routes).some(item=>item.CONDUCTOR_ID===driver.ID&&item.VEHICULO_ID===vehicle.ID&&['Asignada','En curso'].includes(item.ESTADO)),operation=activeRows(localDb.operations).some(item=>item.CONDUCTOR_ID===driver.ID&&item.VEHICULO_ID===vehicle.ID&&['Activa','En curso'].includes(item.ESTADO));if(!assignment&&!route&&!operation)throw new Error('VEHICULO_QR_NO_COINCIDE_ASIGNACION');}
    if(context==='combustible'){if(vehicle.ESTADO==='Inactivo')throw new Error('VEHICULO_NO_DISPONIBLE');if(user.ROL_ID!=='ROL-ADMIN'){const own=user.ROL_ID==='ROL-CONDUCTOR'?localDriver(user):null;if(user.ROL_ID==='ROL-CONDUCTOR'&&!own)throw new Error('CONDUCTOR_NO_ASOCIADO');const hasOperation=activeRows(localDb.operations).some(row=>row.VEHICULO_ID===vehicle.ID&&row.ESTADO==='Activa'&&(!own||row.CONDUCTOR_ID===own.ID)),hasRoute=activeRows(localDb.routes).some(row=>row.VEHICULO_ID===vehicle.ID&&['Asignada','En curso'].includes(row.ESTADO)&&(!own||row.CONDUCTOR_ID===own.ID));if(!hasOperation&&!hasRoute)throw new Error('COMBUSTIBLE_ASIGNACION_ACTIVA_REQUERIDA');}}
    else if(context!=='checkin'&&vehicle.ESTADO!=='Disponible')throw new Error('VEHICULO_NO_DISPONIBLE');
    const authorization=id('QR-AUT');qrAuthorizations.set(authorization,{USUARIO_ID:user.ID,VEHICULO_ID:vehicle.ID,CONTEXTO:context,EXPIRA:Date.now()+300000});const detail=context==='combustible'?'Vehículo validado para carga de combustible':context==='checkin'?'Vehículo correcto validado para check-in':'Vehículo validado para operación';audit(user,'VALIDAR','QR',`${detail}: ${vehicle.PATENTE}`,vehicle.ID);saveLocal();return{row:cleanRow(vehicle),AUTORIZACION_QR:authorization,autorizacionQr:authorization,validaPorSegundos:300,VALIDA_POR_SEGUNDOS:300,contexto:context,qrValidaVehiculoAsignado:context==='checkin'&&user.ROL_ID==='ROL-CONDUCTOR'};
  }
  function localVehicleFilter(payload={},user=null){if(user&&!['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'].includes(user.ROL_ID))return{activo:false,ids:new Set()};const raw=String(payload.vehiculos||payload.VEHICULOS||'').trim();if(!raw)return{activo:false,ids:new Set()};if(raw==='__NINGUNO__')return{activo:true,ids:new Set()};return{activo:true,ids:new Set(raw.split(',').map(value=>value.trim()).filter(Boolean))};}
  function localSaveLocation(payload) {
    const user=requireLocalUser(),data=payload.data||payload;requireLocalPermission(user,'GPS','CREAR');let driverId=data.CONDUCTOR_ID||'';if(user.ROL_ID==='ROL-CONDUCTOR')driverId=localDriver(user)?.ID||'';if(!driverId){const driver=activeRows(localDb.drivers).find(x=>x.USUARIO_ID===user.ID);if(driver)driverId=driver.ID;}
    let operationId=data.OPERACION_ID||'',vehicleId=data.VEHICULO_ID||'';const active=activeRows(localDb.operations).find(x=>x.CONDUCTOR_ID===driverId&&x.ESTADO==='Activa');if(active){operationId=operationId||active.ID;vehicleId=vehicleId||active.VEHICULO_ID;}
    const key=vehicleId||driverId||data.DISPOSITIVO_ID||id('GPS-KEY'),now=data.FECHA_HORA||iso();
    const values={USUARIO_ID:user.ID,OPERACION_ID:operationId,CONDUCTOR_ID:driverId,VEHICULO_ID:vehicleId,LATITUD:Number(data.LATITUD),LONGITUD:Number(data.LONGITUD),
      DIRECCION:data.DIRECCION||`${Number(data.LATITUD).toFixed(6)}, ${Number(data.LONGITUD).toFixed(6)}`,PRECISION_METROS:Number(data.PRECISION_METROS||0),
      VELOCIDAD_KMH:Number(data.VELOCIDAD_KMH||0),RUMBO:Number(data.RUMBO||0),BATERIA_PORCENTAJE:data.BATERIA_PORCENTAJE??'',DISPOSITIVO_ID:data.DISPOSITIVO_ID||'',
      FECHA_HORA:now,FUENTE:data.FUENTE||'GPS real',ACTUALIZADO_EN:iso(),ELIMINADO:'NO'};
    let current=activeRows(localDb.gpsCurrent||[]).find(row=>row.CLAVE_SEGUIMIENTO===key);
    const precisionNueva=Number(values.PRECISION_METROS||9999),precisionAnterior=Number(current?.PRECISION_METROS||9999),edadAnterior=current?Date.now()-new Date(current.FECHA_HORA||0).getTime():Number.MAX_SAFE_INTEGER,distanciaActual=current?Math.hypot((Number(current.LATITUD)-Number(values.LATITUD))*111320,(Number(current.LONGITUD)-Number(values.LONGITUD))*111320):0;
    const conservarAnterior=Boolean(current&&edadAnterior<600000&&precisionAnterior<=25&&precisionNueva>50&&distanciaActual<=Math.max(120,precisionNueva*2));
    if(!conservarAnterior){if(current)Object.assign(current,values);else if(precisionNueva<=80){current={ID:id('GPA'),CLAVE_SEGUIMIENTO:key,CREADO_EN:iso(),...values};localDb.gpsCurrent.push(current);}}
    const previous=[...activeRows(localDb.gps)].reverse().find(row=>(row.VEHICULO_ID||row.CONDUCTOR_ID||row.DISPOSITIVO_ID)===key);
    if(!previous||new Date(now).getTime()-new Date(previous.FECHA_HORA).getTime()>=60000)localDb.gps.push({ID:id('GPS'),CREADO_EN:iso(),...values});
    if(localDb.gps.length>5000)localDb.gps=localDb.gps.slice(-5000);const llegadaMultiruta=!conservarAnterior?localProcessMultiRouteArrival(user,driverId,Number(values.LATITUD),Number(values.LONGITUD),now):null;saveLocal();return{row:current,llegadaMultiruta,LLEGADA_MULTIRUTA:llegadaMultiruta};
  }
  function localLatestLocations(payload={}) {
    const user=requireLocalUser();requireLocalPermission(user,'GPS','LEER');let base=activeRows(localDb.gpsCurrent||[]);if(!base.length){const latest={};activeRows(localDb.gps).sort((a,b)=>new Date(b.FECHA_HORA)-new Date(a.FECHA_HORA)).forEach(row=>{const key=row.VEHICULO_ID||row.CONDUCTOR_ID||row.DISPOSITIVO_ID||row.ID;if(!latest[key])latest[key]=row;});base=Object.values(latest);}
    const filter=localVehicleFilter(payload,user);const enriched=localFilterRows('gps',base,user).map(row=>({...row,CONDUCTOR_NOMBRE:find('drivers',row.CONDUCTOR_ID)?.NOMBRE||'',VEHICULO_PATENTE:find('vehicles',row.VEHICULO_ID)?.PATENTE||'',UBICACION_VALIDA:Number.isFinite(Number(row.LATITUD))&&Number.isFinite(Number(row.LONGITUD))&&Number(row.PRECISION_METROS||9999)<=80,UBICACION_CONFIABLE:Number(row.PRECISION_METROS||9999)<=80,UBICACION_PRECISA:Number(row.PRECISION_METROS||9999)<=25,CALIDAD_MAPA:Number(row.PRECISION_METROS||9999)<=25?'Alta':Number(row.PRECISION_METROS||9999)<=50?'Media':'Aceptable'}));const latestByVehicle=new Map(enriched.filter(row=>row.VEHICULO_ID).map(row=>[row.VEHICULO_ID,row]));const rows=enriched.filter(row=>!filter.activo||filter.ids.has(row.VEHICULO_ID));
    const trackingVehicles=localFilterRows('vehicles',activeRows(localDb.vehicles),user).map(vehicle=>{const latest=latestByVehicle.get(vehicle.ID)||{};return{ID:vehicle.ID,PATENTE:vehicle.PATENTE||vehicle.ID,MARCA:vehicle.MARCA||'',MODELO:vehicle.MODELO||'',ESTADO:vehicle.ESTADO||'',CONDUCTOR_ID:latest.CONDUCTOR_ID||'',CONDUCTOR_NOMBRE:latest.CONDUCTOR_NOMBRE||'',ULTIMA_POSICION:latest.FECHA_HORA||''};});
    const trackingDrivers=localFilterRows('drivers',activeRows(localDb.drivers),user).map(driver=>({ID:driver.ID,NOMBRE:driver.NOMBRE||driver.ID,USUARIO_ID:driver.USUARIO_ID||'',ESTADO:driver.ESTADO||''}));
    if(user.ROL_ID==='ROL-CONDUCTOR'){
      const own=rows.filter(row=>!row.USUARIO_ID||String(row.USUARIO_ID)===String(user.ID)).sort((a,b)=>new Date(b.FECHA_HORA||0)-new Date(a.FECHA_HORA||0)).slice(0,1).map(row=>({...row,USUARIO_ID:user.ID,USUARIO_NOMBRE:user.NOMBRE||'Conductor',MARCADOR_ID:`USUARIO-${user.ID}`}));
      return{rows:own,locations:own,ubicaciones:own,total:own.length,devices:[],trackingVehicles:[],trackingDrivers:[],routes:[],notifications:[],totals:{locations:own.length,onlineDevices:own.length?1:0,drivingSessions:0,sessionsWithoutGps:0,activeRoutes:0,unreadNotifications:0},rolVista:user.ROL_ID,alcance:'PROPIO',controlTotal:false,vistaPrivada:true,serverTime:iso()};
    }
    return{rows,locations:rows,ubicaciones:rows,total:rows.length,trackingVehicles,trackingDrivers,rolVista:user.ROL_ID,alcance:user.ROL_ID==='ROL-SUPERVISOR'?'TODOS_VISUALIZACION':'CONTROL_TOTAL',controlTotal:user.ROL_ID==='ROL-ADMIN',serverTime:iso()};
  }
  function localFormatElapsed(value){const total=Math.max(0,Math.floor(Number(value)||0)),hours=Math.floor(total/3600),minutes=Math.floor((total%3600)/60),seconds=total%60;return[hours,minutes,seconds].map(v=>String(v).padStart(2,'0')).join(':');}
  function localRouteSeconds(route,endValue=''){const start=new Date(route.CRONOMETRO_INICIO||route.FECHA_ASIGNACION||route.CREADO_EN||0).getTime(),end=new Date(endValue||route.CRONOMETRO_FIN||route.FECHA_FIN||Date.now()).getTime();return start>0&&Number.isFinite(end)?Math.max(0,Math.floor((end-start)/1000)):Math.max(0,Number(route.TIEMPO_TRANSCURRIDO_SEGUNDOS)||0);}
  function localStageSeconds(start,end){const from=new Date(start||0).getTime(),to=new Date(end||0).getTime();return from>0&&to>0?Math.max(0,Math.floor((to-from)/1000)):null;}
  function localRouteKpi(route){
    const events=activeRows(localDb.routeHistory||[]).filter(row=>row.RUTA_ID===route.ID).slice().sort((a,b)=>new Date(a.FECHA_EVENTO||a.CREADO_EN||0)-new Date(b.FECHA_EVENTO||b.CREADO_EN||0)),first=name=>events.find(row=>row.EVENTO===name)||null;
    const assigned=first('ASIGNADA'),accepted=first('ACEPTADA'),started=first('INICIADA'),completed=first('COMPLETADA'),closed=completed||first('CANCELADA');
    const fechaAsignacion=assigned?.FECHA_EVENTO||route.FECHA_ASIGNACION||route.CREADO_EN||'',fechaAceptacion=accepted?.FECHA_EVENTO||'',fechaInicio=started?.FECHA_EVENTO||route.FECHA_INICIO||'',fechaCompletada=completed?.FECHA_EVENTO||(localReportsNormalized(route.ESTADO)==='completada'?route.FECHA_FIN:'')||'';
    return{ID:`KPI-RUTA-${route.ID}`,RUTA_ID:route.ID,CONDUCTOR_ID:route.CONDUCTOR_ID||'',VEHICULO_ID:route.VEHICULO_ID||'',NOMBRE_RUTA:route.NOMBRE||route.ID,ESTADO:route.ESTADO||'Asignada',FECHA_ASIGNACION:fechaAsignacion,FECHA_ACEPTACION:fechaAceptacion,FECHA_INICIO:fechaInicio,FECHA_COMPLETADA:fechaCompletada,FECHA_CIERRE:closed?.FECHA_EVENTO||route.FECHA_FIN||'',ASIGNADO_POR_NOMBRE:assigned?.USUARIO_NOMBRE||'',ACEPTADO_POR_NOMBRE:accepted?.USUARIO_NOMBRE||'',INICIADO_POR_NOMBRE:started?.USUARIO_NOMBRE||'',COMPLETADO_POR_NOMBRE:completed?.USUARIO_NOMBRE||'',TIEMPO_ASIGNACION_ACEPTACION_SEGUNDOS:localStageSeconds(fechaAsignacion,fechaAceptacion),TIEMPO_ACEPTACION_INICIO_SEGUNDOS:localStageSeconds(fechaAceptacion,fechaInicio),TIEMPO_ASIGNACION_INICIO_SEGUNDOS:localStageSeconds(fechaAsignacion,fechaInicio),TIEMPO_INICIO_COMPLETADA_SEGUNDOS:localStageSeconds(fechaInicio,fechaCompletada),TIEMPO_TOTAL_CICLO_SEGUNDOS:localStageSeconds(fechaAsignacion,fechaCompletada),EVENTOS:events};
  }
  function localRecordRouteHistory(route,event,user,detail=''){
    const now=iso(),name=String(event||'').toUpperCase(),canonical=['ASIGNADA','ACEPTADA','INICIADA','COMPLETADA','CANCELADA'];if(canonical.includes(name)&&activeRows(localDb.routeHistory).some(row=>row.RUTA_ID===route.ID&&row.EVENTO===name))return;
    const previous=activeRows(localDb.routeHistory).filter(row=>row.RUTA_ID===route.ID).slice().sort((a,b)=>new Date(b.FECHA_EVENTO||0)-new Date(a.FECHA_EVENTO||0))[0],assigned=activeRows(localDb.routeHistory).find(row=>row.RUTA_ID===route.ID&&row.EVENTO==='ASIGNADA'),stage=previous?localStageSeconds(previous.FECHA_EVENTO,now)||0:0,since=localStageSeconds(assigned?.FECHA_EVENTO||route.FECHA_ASIGNACION||route.CREADO_EN,now)||0;
    localDb.routeHistory.push({ID:id('HRU'),RUTA_ID:route.ID,EVENTO:name,ESTADO:route.ESTADO||'',FECHA_EVENTO:now,CRONOMETRO_INICIO:route.CRONOMETRO_INICIO||route.FECHA_ASIGNACION||'',CRONOMETRO_FIN:route.CRONOMETRO_FIN||route.FECHA_FIN||'',TIEMPO_TRANSCURRIDO_SEGUNDOS:localRouteSeconds(route),TIEMPO_TRANSCURRIDO_TEXTO:route.TIEMPO_TRANSCURRIDO_TEXTO||localFormatElapsed(localRouteSeconds(route)),DURACION_DESDE_ANTERIOR_SEGUNDOS:stage,DURACION_DESDE_ANTERIOR_TEXTO:localFormatElapsed(stage),TIEMPO_DESDE_ASIGNACION_SEGUNDOS:since,TIPO_KPI:canonical.includes(name)?'HITO_RUTA':'EVENTO_INFORMATIVO',USUARIO_ID:user.ID,USUARIO_NOMBRE:user.NOMBRE||user.CORREO||'',DETALLE:detail,CREADO_EN:now,ACTUALIZADO_EN:now,ELIMINADO:'NO'});
  }
  const localBackupCollections={users:'USUARIOS',roles:'ROLES',permissions:'PERMISOS',vehicles:'VEHICULOS',drivers:'CONDUCTORES',operations:'OPERACIONES',checkins:'CHECKINS',gps:'GPS',gpsCurrent:'GPS_ACTUAL',history:'HISTORIAL',maintenance:'MANTENCIONES',fuel:'CARGAS_COMBUSTIBLE',fuelAuthorizations:'AUTORIZACIONES_COMBUSTIBLE',documents:'DOCUMENTOS',alerts:'ALERTAS',reports:'REPORTES',audit:'BITACORA',parameters:'PARAMETROS',companies:'EMPRESAS',qr:'QR',routes:'RUTAS',routeHistory:'HISTORIAL_RUTAS',notifications:'NOTIFICACIONES',connections:'CONEXIONES',sessions:'SESIONES'};
  function localBackupSanitize(row){const out={};Object.entries(row||{}).forEach(([key,value])=>{out[key]=/(contrasena|password|secret|token|sal_contrasena|ficha_sesion|hash)/i.test(key)?'[PROTEGIDO]':value;});return out;}
  function localBackupCatalog(){const user=requireLocalUser();if(user.ROL_ID!=='ROL-ADMIN')throw new Error('RESPALDO_GENERAL_SOLO_ADMINISTRADOR');const tables=Object.entries(localBackupCollections).map(([resource,sheet])=>({resource,table:resource,sheet,module:'CONFIGURACION',total:(localDb[resource]||[]).length,disponible:true}));return{version:config.VERSION,generadoEn:iso(),generadoPor:user.NOMBRE||user.CORREO||user.ID,totalTablas:tables.length,totalRegistros:tables.reduce((n,t)=>n+t.total,0),tables};}
  function localBackupTable(payload={}){const user=requireLocalUser();if(user.ROL_ID!=='ROL-ADMIN')throw new Error('RESPALDO_GENERAL_SOLO_ADMINISTRADOR');const data=payload.data||payload,resource=String(data.TABLA||data.RESOURCE||''),rows=localDb[resource];if(!Array.isArray(rows)||!localBackupCollections[resource])throw new Error('TABLA_RESPALDO_NO_AUTORIZADA');const page=Math.max(0,Number(data.PAGINA)||0),size=Math.min(1000,Math.max(100,Number(data.TAMANO)||500)),slice=rows.slice(page*size,page*size+size).map(localBackupSanitize);return{tabla:resource,hoja:localBackupCollections[resource],resource,pagina:page,tamano:size,total:rows.length,rows:slice,fin:page*size+slice.length>=rows.length};}

  function localParseRouteStops(value){
    let raw=value;if(typeof raw==='string'){try{raw=JSON.parse(raw||'[]');}catch(_){raw=[];}}if(!Array.isArray(raw))return [];
    return raw.map((item,index)=>({PUNTO_ID:String(item?.PUNTO_ID||`P${index+1}`),ORDEN:Number(item?.ORDEN||index+1),DESTINO:String(item?.DESTINO||item?.destino||'').trim(),LATITUD:Number(item?.LATITUD??item?.latitud),LONGITUD:Number(item?.LONGITUD??item?.longitud),ESTADO:String(item?.ESTADO||'PENDIENTE').toUpperCase(),ORDENAR_POR_CERCANIA:String(item?.ORDENAR_POR_CERCANIA||'SI').toUpperCase()==='NO'?'NO':'SI',ORDEN_BLOQUEADO:String(item?.ORDEN_BLOQUEADO||'NO').toUpperCase()==='SI'?'SI':'NO',RADIO_LLEGADA_METROS:Math.max(50,Math.min(500,Number(item?.RADIO_LLEGADA_METROS||120))),LLEGADA_DETECTADA_EN:item?.LLEGADA_DETECTADA_EN||'',COMPLETADA_EN:item?.COMPLETADA_EN||''})).filter(item=>item.DESTINO&&Number.isFinite(item.LATITUD)&&Number.isFinite(item.LONGITUD));
  }
  function localRouteDistanceMeters(aLat,aLng,bLat,bLng){const r=6371000,toRad=value=>Number(value)*Math.PI/180,dLat=toRad(bLat-aLat),dLng=toRad(bLng-aLng),lat1=toRad(aLat),lat2=toRad(bLat),h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;return 2*r*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
  function localSortStopsByNearest(stops,startLat,startLng){const pending=stops.slice(),out=[];let lat=Number(startLat),lng=Number(startLng);while(pending.length){let best=0,bestDistance=Infinity;pending.forEach((stop,index)=>{const d=localRouteDistanceMeters(lat,lng,stop.LATITUD,stop.LONGITUD);if(d<bestDistance){best=index;bestDistance=d;}});const [chosen]=pending.splice(best,1);out.push(chosen);lat=chosen.LATITUD;lng=chosen.LONGITUD;}return out.map((stop,index)=>({...stop,ORDEN:index+1,PUNTO_ID:stop.PUNTO_ID||`P${index+1}`}));}
  function localPrepareRouteStops(data,originLat,originLng){
    const multiple=String(data.MULTIPLES_RUTAS||data.RUTAS_MULTIPLES||'NO').toUpperCase()==='SI';if(!multiple)return [];
    let stops=localParseRouteStops(data.PARADAS_CODIFICADAS);if(stops.length<2)throw new Error('RUTA_MULTIPLE_REQUIERE_DOS_DESTINOS');
    const auto=String(data.ORDENAR_POR_CERCANIA||'SI').toUpperCase()!=='NO',locked=String(data.ORDEN_BLOQUEADO||'NO').toUpperCase()==='SI';
    if(auto&&!locked&&Number.isFinite(Number(originLat))&&Number.isFinite(Number(originLng)))stops=localSortStopsByNearest(stops,Number(originLat),Number(originLng));
    return stops.map((stop,index)=>({...stop,ORDEN:index+1,ESTADO:index===0?'ACTIVA':'PENDIENTE',ORDENAR_POR_CERCANIA:auto?'SI':'NO',ORDEN_BLOQUEADO:locked?'SI':'NO'}));
  }
  function localProcessMultiRouteArrival(user,driverId,lat,lng,when){
    if(!driverId||!Number.isFinite(Number(lat))||!Number.isFinite(Number(lng)))return null;
    const route=activeRows(localDb.routes).filter(row=>String(row.CONDUCTOR_ID)===String(driverId)&&row.ESTADO==='En curso').sort((a,b)=>new Date(b.FECHA_INICIO||b.FECHA_ASIGNACION||0)-new Date(a.FECHA_INICIO||a.FECHA_ASIGNACION||0))[0];
    if(!route)return null;let stops=localParseRouteStops(route.PARADAS_CODIFICADAS);if(stops.length<2)return null;
    let activeIndex=stops.findIndex(stop=>['ACTIVA','LLEGADA_DETECTADA'].includes(stop.ESTADO));if(activeIndex<0)return null;const current=stops[activeIndex];if(current.ESTADO==='LLEGADA_DETECTADA')return null;
    const distance=localRouteDistanceMeters(Number(lat),Number(lng),current.LATITUD,current.LONGITUD);if(distance>Number(current.RADIO_LLEGADA_METROS||120))return null;
    current.ESTADO='LLEGADA_DETECTADA';current.LLEGADA_DETECTADA_EN=when;
    let remaining=stops.filter((_,index)=>index!==activeIndex&&_.ESTADO!=='COMPLETADA');const completed=stops.filter((_,index)=>index!==activeIndex&&_.ESTADO==='COMPLETADA');
    const auto=String(current.ORDENAR_POR_CERCANIA||stops[0]?.ORDENAR_POR_CERCANIA||'SI').toUpperCase()!=='NO',locked=String(current.ORDEN_BLOQUEADO||stops[0]?.ORDEN_BLOQUEADO||'NO').toUpperCase()==='SI';
    if(auto&&!locked&&remaining.length)remaining=localSortStopsByNearest(remaining,Number(lat),Number(lng));
    const rebuilt=[...completed,current,...remaining].map((stop,index)=>({...stop,ORDEN:index+1}));route.PARADAS_CODIFICADAS=JSON.stringify(rebuilt);route.ACTUALIZADO_EN=when;
    const next=remaining[0]||null;localRecordRouteHistory(route,next?'LLEGADA_PUNTO':'LLEGADA_DESTINO_FINAL',user,next?`Destino alcanzado: ${current.DESTINO}. Siguiente: ${next.DESTINO}`:`Destino final alcanzado: ${current.DESTINO}`);
    if(!next)return{route,final:true,destino:current.DESTINO};
    const distanceKm=localRouteDistanceMeters(Number(lat),Number(lng),next.LATITUD,next.LONGITUD)/1000,duration=Math.max(1,Math.round(distanceKm/35*60));
    const driver=find('drivers',driverId)||{};const notification=localCreateNotification({DESTINATARIO_USUARIO_ID:driver.USUARIO_ID||user.ID,DESTINATARIO_CONDUCTOR_ID:driverId,DESTINATARIO_NOMBRE:driver.NOMBRE||'',TITULO:'Llegaste al destino · siguiente ruta disponible',MENSAJE:`Punto ${current.ORDEN} alcanzado. Siguiente destino: ${next.DESTINO}. Presione Aceptar para continuar la navegación.`,TIPO:'Ruta',PRIORIDAD:'Urgente',RUTA_ID:route.ID,CATEGORIA_EMERGENTE:'RUTA_SIGUIENTE_DESTINO',NOMBRE_ASIGNACION:`Siguiente destino · ${next.DESTINO}`,ORIGEN:current.DESTINO,DESTINO:next.DESTINO,DISTANCIA_KM:Number(distanceKm.toFixed(2)),DURACION_MINUTOS:duration,PROVEEDOR_NAVEGACION:route.PROVEEDOR_NAVEGACION||'Google Maps',ESTADO_RESPUESTA:'PENDIENTE',ACCION_DESTINO:'CONTINUAR_RUTA',ACCION_ETIQUETA:'Aceptar y continuar',CREADO_POR:user.ID,CLAVE_UNICA:`RUTA-SIGUIENTE-${route.ID}-${current.PUNTO_ID}`});
    return{route,final:false,destino:current.DESTINO,siguiente:next,notification};
  }

  function localAssignRoute(payload){
    const user=requireLocalUser(),data=payload.data||payload;requireLocalPermission(user,'RUTAS','CREAR');
    const driver=find('drivers',data.CONDUCTOR_ID),vehicle=data.VEHICULO_ID?find('vehicles',data.VEHICULO_ID):null,company=localPrimaryCompany()||{};
    if(!driver)throw new Error('CONDUCTOR_NO_ENCONTRADO');if(data.VEHICULO_ID&&!vehicle)throw new Error('VEHICULO_NO_ENCONTRADO');if(!data.ORIGEN)throw new Error('CAMPO_REQUERIDO_ORIGEN');if(!data.DESTINO)throw new Error('CAMPO_REQUERIDO_DESTINO');
    const checkinId=String(data.CHECKIN_ID||'').trim(),validos=activeRows(localDb.checkins).filter(item=>item.CONDUCTOR_ID===driver.ID&&item.VEHICULO_ID===vehicle?.ID&&String(item.ESTADO_REVISION||'').toLowerCase()==='aprobado'&&new Date(item.VIGENTE_HASTA||0)>new Date()).sort((a,b)=>new Date(b.FECHA_HORA||b.CREADO_EN||0)-new Date(a.FECHA_HORA||a.CREADO_EN||0));let checkin=checkinId?validos.find(item=>String(item.ID)===checkinId):null;if(!checkin)checkin=validos[0];if(!checkin)throw new Error('CHECKIN_APROBADO_REQUERIDO');
    const baseLatText=String(company.PUNTO_OPERACION_LATITUD??'').trim(),baseLngText=String(company.PUNTO_OPERACION_LONGITUD??'').trim(),baseLat=Number(baseLatText),baseLng=Number(baseLngText),hasBase=Boolean(baseLatText&&baseLngText)&&Number.isFinite(baseLat)&&Number.isFinite(baseLng)&&baseLat>=-90&&baseLat<=90&&baseLng>=-180&&baseLng<=180,now=iso(),originLat=data.ORIGEN_LATITUD||(hasBase?baseLat:''),originLng=data.ORIGEN_LONGITUD||(hasBase?baseLng:''),stops=localPrepareRouteStops(data,originLat,originLng),multiple=stops.length>=2,firstStop=multiple?stops[0]:null,route={ID:id('RUT'),NOMBRE:data.NOMBRE||`Ruta a ${firstStop?.DESTINO||data.DESTINO}`,CONDUCTOR_ID:driver.ID,VEHICULO_ID:vehicle?.ID||'',OPERACION_ID:data.OPERACION_ID||'',
      ORIGEN:String(data.ORIGEN).trim(),ORIGEN_LATITUD:originLat,ORIGEN_LONGITUD:originLng,DESTINO:firstStop?.DESTINO||data.DESTINO,
      DESTINO_LATITUD:firstStop?.LATITUD??data.DESTINO_LATITUD??'',DESTINO_LONGITUD:firstStop?.LONGITUD??data.DESTINO_LONGITUD??'',PARADAS_CODIFICADAS:multiple?JSON.stringify(stops):(data.PARADAS_CODIFICADAS||''),MULTIPLES_RUTAS:multiple?'SI':'NO',ORDENAR_POR_CERCANIA:String(data.ORDENAR_POR_CERCANIA||'SI').toUpperCase()==='NO'?'NO':'SI',ORDEN_BLOQUEADO:String(data.ORDEN_BLOQUEADO||'NO').toUpperCase()==='SI'?'SI':'NO',
      PROVEEDOR_NAVEGACION:['Google Maps','Waze'].includes(data.PROVEEDOR_NAVEGACION)?data.PROVEEDOR_NAVEGACION:'Google Maps',ESTADO:'Asignada',
      INSTRUCCIONES:data.INSTRUCCIONES||'',FECHA_ASIGNACION:now,FECHA_INICIO:'',FECHA_FIN:'',CRONOMETRO_INICIO:now,CRONOMETRO_FIN:'',TIEMPO_TRANSCURRIDO_SEGUNDOS:0,TIEMPO_TRANSCURRIDO_TEXTO:'00:00:00',CREADO_POR:user.ID,CREADO_EN:now,ACTUALIZADO_EN:now,ELIMINADO:'NO'};
    localDb.routes.push(route);activeRows(localDb.checkinAssignments).filter(item=>item.CONDUCTOR_ID===driver.ID&&item.VEHICULO_ID===vehicle?.ID&&item.ESTADO==='CHECKIN_LISTO').forEach(item=>Object.assign(item,{ESTADO:'RUTA_ASIGNADA',ACTUALIZADO_EN:now}));localRecordRouteHistory(route,'ASIGNADA',user,`Ruta asignada a ${driver.NOMBRE}${multiple?` · ${stops.length} destinos`:''}`);const notification=localCreateNotification({DESTINATARIO_USUARIO_ID:driver.USUARIO_ID||'',DESTINATARIO_CONDUCTOR_ID:driver.ID,DESTINATARIO_NOMBRE:driver.NOMBRE,
      TITULO:'Nueva ruta asignada',MENSAJE:`${route.NOMBRE}: ${route.ORIGEN} → ${route.DESTINO}${multiple?` · ${stops.length} destinos en secuencia`:''}`,TIPO:'Ruta',PRIORIDAD:data.PRIORIDAD||'Alta',RUTA_ID:route.ID,OPERACION_ID:route.OPERACION_ID,CATEGORIA_EMERGENTE:'RUTA_ASIGNADA',NOMBRE_ASIGNACION:route.NOMBRE,ORIGEN:route.ORIGEN,DESTINO:route.DESTINO,PROVEEDOR_NAVEGACION:route.PROVEEDOR_NAVEGACION||'Google Maps',ESTADO_RESPUESTA:'PENDIENTE',CREADO_POR:user.ID});
    const personales=activeRows(localDb.documents).filter(row=>{
      const tipo=String(row.ASOCIADO_TIPO||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
      return !tipo.includes('VEHICULO')&&(row.CONDUCTOR_ASOCIADO_ID===driver.ID||row.ASOCIADO_ID===driver.ID||row.USUARIO_ASOCIADO_ID===driver.USUARIO_ID||String(row.CORREO_ASOCIADO||'').toLowerCase()===String(driver.CORREO||'').toLowerCase());
    }),digitalizados=personales.filter(row=>Boolean(row.DIRECCION_ARCHIVO||row.ARCHIVO_BUCKET&&row.ARCHIVO_RUTA)),vigentes=digitalizados.filter(row=>!['Vencido','Anulado','Rechazado'].includes(row.ESTADO)&&!String(row.ESTADO_REVISION||'').toLowerCase().includes('rechaz'));
    const documentacionPersonal={TOTAL:personales.length,DIGITALIZADOS:digitalizados.length,VIGENTES:vigentes.length,COMPLETO:Boolean(digitalizados.length&&vigentes.length)};
    if(!documentacionPersonal.COMPLETO)localNotifyRoles(['ROL-ADMIN','ROL-GERENCIA'],{TITULO:`Documentación personal pendiente: ${driver.NOMBRE}`,MENSAJE:`La ruta ${route.NOMBRE} fue asignada, pero el expediente personal no posee un documento digital vigente.`,TIPO:'Documento',PRIORIDAD:'Urgente',RUTA_ID:route.ID,CREADO_POR:user.ID,CLAVE_UNICA:`RUTA-DOCUMENTACION-PERSONAL-${route.ID}`});
    audit(user,'ASIGNAR','RUTAS',`Ruta asignada a ${driver.NOMBRE}${multiple?` · ${stops.length} destinos`:''}`,route.ID);saveLocal();return{row:route,notification,documentacionPersonal,multiplesRutas:multiple,totalDestinos:multiple?stops.length:1,paradas:stops};
  }
  function localRouteSyncState(){
    const user=requireLocalUser(),related=['RUTAS','OPERACIONES','VEHICULOS','CONDUCTORES','CHECKIN','COMBUSTIBLE','REPORTES','NOTIFICACIONES','HISTORIAL','PANEL_PRINCIPAL'];
    if(!related.some(module=>hasLocalPermission(user,module,'LEER')))throw new Error('PERMISO_DENEGADO');
    const canReadRoutes=hasLocalPermission(user,'RUTAS','LEER');
    const rows=localFilterRows('routes',activeRows(localDb.routes),user).slice().sort((a,b)=>new Date(b.ACTUALIZADO_EN||b.CREADO_EN||0)-new Date(a.ACTUALIZADO_EN||a.CREADO_EN||0)||String(b.ID||'').localeCompare(String(a.ID||''))).slice(0,8);
    const raw=rows.length?rows.map(row=>`${row.ID||''}@${row.ACTUALIZADO_EN||''}@${row.ESTADO||''}`).join('|'):'SIN_RUTAS';
    let h=2166136261;for(const ch of raw){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}const revision=(h>>>0).toString(36).toUpperCase(),latest=canReadRoutes?(rows[0]||{}):{};
    return{REVISION:revision,revision,ULTIMA_RUTA_ID:latest.ID||'',ULTIMO_ESTADO:latest.ESTADO||'',ACTUALIZADO_EN:latest.ACTUALIZADO_EN||'',serverTime:iso()};
  }

  function localUpdateRouteStatus(payload){
    const user=requireLocalUser(),route=find('routes',payload.id||payload.RUTA_ID||payload.data?.RUTA_ID);requireLocalPermission(user,'RUTAS','ACTUALIZAR');
    if(!route)throw new Error('RUTA_NO_ENCONTRADA');if(!localFilterRows('routes',[route],user).length)throw new Error('PERMISO_DENEGADO');
    const previousState=route.ESTADO,state=payload.ESTADO||payload.data?.ESTADO;if(!['Asignada','En curso','Completada','Cancelada'].includes(state))throw new Error('ESTADO_RUTA_INVALIDO');
    if(user.ROL_ID==='ROL-CONDUCTOR'&&!['En curso','Completada'].includes(state))throw new Error('PERMISO_DENEGADO');
    const now=iso();let cierreAnticipado=false,distanciaRestante=null,destinoProgramado=route.DESTINO||'Destino no informado',motivoCierre='';
    if(state==='Completada'){
      const cierreData=payload.data||payload,lat=Number(cierreData.CIERRE_LATITUD),lng=Number(cierreData.CIERRE_LONGITUD);let stops=localParseRouteStops(route.PARADAS_CODIFICADAS),pending=stops.filter(stop=>stop.ESTADO!=='COMPLETADA');
      const target=pending[0]||null;destinoProgramado=target?.DESTINO||route.DESTINO||'Destino no informado';const targetLat=Number(target?.LATITUD??route.DESTINO_LATITUD),targetLng=Number(target?.LONGITUD??route.DESTINO_LONGITUD),radio=Math.max(40,Number(target?.RADIO_LLEGADA_METROS||120));
      if(Number.isFinite(lat)&&Number.isFinite(lng)&&Number.isFinite(targetLat)&&Number.isFinite(targetLng))distanciaRestante=Math.round(localRouteDistanceMeters(lat,lng,targetLat,targetLng));
      if(previousState==='Asignada'){cierreAnticipado=true;motivoCierre='RUTA_NO_INICIADA';}
      if(stops.length>=2){const last=stops[stops.length-1],ultimaPendiente=pending.length===1&&pending[0].PUNTO_ID===last.PUNTO_ID,llegadaFinal=ultimaPendiente&&(pending[0].ESTADO==='LLEGADA_DETECTADA'||distanciaRestante!==null&&distanciaRestante<=radio);if(!pending.length){}else if(llegadaFinal){last.ESTADO='COMPLETADA';last.COMPLETADA_EN=now;route.PARADAS_CODIFICADAS=JSON.stringify(stops);}else{cierreAnticipado=true;motivoCierre=pending.length>1?'RUTA_MULTIPLE_DESTINOS_PENDIENTES':distanciaRestante===null?'LLEGADA_NO_CONFIRMADA':'FUERA_RADIO_DESTINO_FINAL';}}
      else if(!(distanciaRestante!==null&&distanciaRestante<=radio)){cierreAnticipado=true;motivoCierre=motivoCierre|| (distanciaRestante===null?'LLEGADA_NO_CONFIRMADA':'FUERA_RADIO_DESTINO');}
    }
    if(state==='En curso'){
      const driverId=route.CONDUCTOR_ID,operation=activeRows(localDb.operations).find(row=>row.CONDUCTOR_ID===driverId&&row.ESTADO==='Activa'&&(!route.VEHICULO_ID||row.VEHICULO_ID===route.VEHICULO_ID));
      const vehicleId=route.VEHICULO_ID||operation?.VEHICULO_ID||'';if(!vehicleId)throw new Error('RUTA_VEHICULO_REQUERIDO');
      const checkin=activeRows(localDb.checkins).filter(row=>row.VEHICULO_ID===vehicleId&&row.CONDUCTOR_ID===driverId&&row.ESTADO_REVISION==='Aprobado'&&new Date(row.VIGENTE_HASTA||0).getTime()>Date.now()).sort((a,b)=>new Date(b.FECHA_HORA||b.CREADO_EN)-new Date(a.FECHA_HORA||a.CREADO_EN))[0];
      if(!checkin)throw new Error('CHECKIN_APROBADO_REQUERIDO');Object.assign(route,{ESTADO:'En curso',FECHA_INICIO:route.FECHA_INICIO||now,VEHICULO_ID:vehicleId,OPERACION_ID:operation?.ID||route.OPERACION_ID||'',CHECKIN_ID:checkin.ID,GPS_SEGUIMIENTO_ACTIVO:'SI',ACTUALIZADO_EN:now});
      route.CRONOMETRO_INICIO=route.CRONOMETRO_INICIO||route.FECHA_ASIGNACION||now;localRecordRouteHistory(route,'INICIADA',user,`GPS activado · check-in ${checkin.ID}`);audit(user,'INICIAR_RUTA','RUTAS',`GPS activado · check-in ${checkin.ID}`,route.ID);saveLocal();return{row:route,seguimiento:{activo:true,RUTA_ID:route.ID,OPERACION_ID:route.OPERACION_ID||'',VEHICULO_ID:vehicleId,CONDUCTOR_ID:driverId,CHECKIN_ID:checkin.ID},operacionVinculada:Boolean(operation)};
    }
    route.ESTADO=state;if(['Completada','Cancelada'].includes(state)){route.FECHA_FIN=now;route.CRONOMETRO_INICIO=route.CRONOMETRO_INICIO||route.FECHA_ASIGNACION||route.CREADO_EN||now;route.CRONOMETRO_FIN=now;route.TIEMPO_TRANSCURRIDO_SEGUNDOS=localRouteSeconds(route,now);route.TIEMPO_TRANSCURRIDO_TEXTO=localFormatElapsed(route.TIEMPO_TRANSCURRIDO_SEGUNDOS);route.GPS_SEGUIMIENTO_ACTIVO='NO';const checkinRuta=find('checkins',route.CHECKIN_ID),fechaCheckin=new Date(checkinRuta?.FECHA_HORA||checkinRuta?.CREADO_EN||0).getTime(),checkinVigente=Boolean(checkinRuta&&checkinRuta.ESTADO_REVISION==='Aprobado'&&new Date(checkinRuta.VIGENTE_HASTA||0).getTime()>Date.now()&&!activeRows(localDb.checkinAssignments).some(a=>a.VEHICULO_ID===route.VEHICULO_ID&&a.CONDUCTOR_ID!==route.CONDUCTOR_ID&&new Date(a.FECHA_ASIGNACION||0).getTime()>fechaCheckin));activeRows(localDb.checkinAssignments).filter(a=>a.CONDUCTOR_ID===route.CONDUCTOR_ID&&a.VEHICULO_ID===route.VEHICULO_ID&&a.ESTADO==='RUTA_ASIGNADA').forEach(a=>Object.assign(a,{ESTADO:checkinVigente?'CHECKIN_LISTO':'ASIGNADO',CHECKIN_ID:checkinVigente?checkinRuta.ID:'',FECHA_CHECKIN:checkinVigente?(checkinRuta.FECHA_HORA||checkinRuta.CREADO_EN||now):'',ACTUALIZADO_EN:now}));localRecordRouteHistory(route,state==='Completada'?'COMPLETADA':'CANCELADA',user,cierreAnticipado?`Tiempo total: ${route.TIEMPO_TRANSCURRIDO_TEXTO} · FINALIZACIÓN ANTICIPADA · ${destinoProgramado} · ${distanciaRestante===null?'distancia no disponible':distanciaRestante+' m'} · ${motivoCierre}`:`Tiempo total: ${route.TIEMPO_TRANSCURRIDO_TEXTO}`);}route.ACTUALIZADO_EN=now;audit(user,state==='Completada'?(cierreAnticipado?'COMPLETAR_RUTA_ANTICIPADA':'COMPLETAR_RUTA'):'CAMBIAR_ESTADO','RUTAS',cierreAnticipado?`Finalización anticipada · destino ${destinoProgramado} · distancia restante ${distanciaRestante===null?'no disponible':distanciaRestante+' m'} · motivo ${motivoCierre}`:`Estado: ${state}${route.TIEMPO_TRANSCURRIDO_TEXTO?` · ${route.TIEMPO_TRANSCURRIDO_TEXTO}`:''}`,route.ID);
    let alertasGeneradas=0;if(state==='Completada'&&previousState!=='Completada'){const driver=find('drivers',route.CONDUCTOR_ID)||{},vehicle=find('vehicles',route.VEHICULO_ID)||{};localNotifyRoles(['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'],{TITULO:cierreAnticipado?`Ruta finalizada anticipadamente: ${route.NOMBRE||route.ID}`:`Ruta finalizada: ${route.NOMBRE||route.ID}`,MENSAJE:cierreAnticipado?`Conductor: ${driver.NOMBRE||route.CONDUCTOR_ID}. Vehículo: ${vehicle.PATENTE||route.VEHICULO_ID}. Destino programado: ${destinoProgramado}. Distancia restante: ${distanciaRestante===null?'no disponible':distanciaRestante+' m'}.`:`Conductor: ${driver.NOMBRE||route.CONDUCTOR_ID}. Vehículo: ${vehicle.PATENTE||route.VEHICULO_ID}.`,TIPO:cierreAnticipado?'Ruta finalizada anticipadamente':'Ruta finalizada',PRIORIDAD:cierreAnticipado?'Urgente':'Alta',RUTA_ID:route.ID,OPERACION_ID:route.OPERACION_ID||'',CREADO_POR:user.ID});if(cierreAnticipado){activeRows(localDb.users).filter(target=>['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'].includes(target.ROL_ID)&&hasLocalPermission(target,'ALERTAS','LEER')).forEach(target=>{localDb.alerts.push({ID:id('ALT'),TIPO:'Ruta finalizada anticipadamente',NIVEL:'Crítica',TITULO:`Ruta finalizada antes de destino · ${vehicle.PATENTE||route.VEHICULO_ID||route.ID}`,MENSAJE:`${driver.NOMBRE||route.CONDUCTOR_ID} finalizó ${route.NOMBRE||route.ID} antes del destino ${destinoProgramado}. Distancia restante: ${distanciaRestante===null?'no disponible':distanciaRestante+' m'}.`,MODULO:'RUTAS',REGISTRO_ID:route.ID,CATEGORIA:'RUTA_FINALIZADA_ANTICIPADA',RUTA_ID:route.ID,CONDUCTOR_ID:route.CONDUCTOR_ID,VEHICULO_ID:route.VEHICULO_ID,PATENTE:vehicle.PATENTE||'',LEIDA:'NO',USUARIO_ID:target.ID,FECHA_HORA:now,CREADO_EN:now,ACTUALIZADO_EN:now,ELIMINADO:'NO'});alertasGeneradas++;});}}
    saveLocal();return{row:route,seguimiento:{activo:false,RUTA_ID:route.ID,OPERACION_ID:route.OPERACION_ID||'',VEHICULO_ID:route.VEHICULO_ID||'',CONDUCTOR_ID:route.CONDUCTOR_ID||''},notificacionAdministradores:state==='Completada',CIERRE_ANTICIPADO:cierreAnticipado,cierreAnticipado,ALERTAS_GENERADAS:alertasGeneradas,alertasGeneradas,DISTANCIA_RESTANTE_METROS:distanciaRestante,DESTINO_PROGRAMADO:destinoProgramado,MOTIVO_CIERRE_ANTICIPADO:motivoCierre};
  }
  function localCreateNotification(data){
    const recipient=String(data.DESTINATARIO_USUARIO_ID||''),driverRecipient=String(data.DESTINATARIO_CONDUCTOR_ID||''),requestId=String(data.SOLICITUD_CLIENTE_ID||'').replace(/[^A-Za-z0-9_-]/g,'').slice(0,120),normal=value=>String(value??'').trim().toUpperCase().replace(/\s+/g,' '),fingerprint=value=>{let h=2166136261;for(const ch of normal(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0).toString(36).toUpperCase();},bucket=Math.floor(Date.now()/10000),unique=String(data.CLAVE_UNICA||'').trim()||(requestId?`NOT-REQ-${requestId}-${fingerprint(`${recipient}|${driverRecipient}`)}`:`NOT-AUTO-${fingerprint([recipient,driverRecipient,data.TIPO,data.CATEGORIA_EMERGENTE,data.RUTA_ID,data.OPERACION_ID,data.TITULO,data.MENSAJE].join('|'))}-${bucket}`);if(unique){const existing=activeRows(localDb.notifications).find(row=>String(row.CLAVE_UNICA||'')===unique&&String(row.DESTINATARIO_USUARIO_ID||'')===recipient);if(existing)return existing;}
    const now=iso(),row={ID:id('NOT'),DESTINATARIO_USUARIO_ID:recipient,DESTINATARIO_CONDUCTOR_ID:data.DESTINATARIO_CONDUCTOR_ID||'',TITULO:data.TITULO,MENSAJE:data.MENSAJE,TIPO:data.TIPO||'Información',PRIORIDAD:data.PRIORIDAD||'Normal',RUTA_ID:data.RUTA_ID||'',OPERACION_ID:data.OPERACION_ID||'',CHECKIN_ID:data.CHECKIN_ID||'',CONDUCTOR_ID:data.CONDUCTOR_ID||'',VEHICULO_ID:data.VEHICULO_ID||'',CLAVE_UNICA:unique,CATEGORIA_EMERGENTE:data.CATEGORIA_EMERGENTE||'',ACCION_DESTINO:data.ACCION_DESTINO||'',ACCION_ETIQUETA:data.ACCION_ETIQUETA||'',PROVEEDOR_NAVEGACION:data.PROVEEDOR_NAVEGACION||'',NOMBRE_ASIGNACION:data.NOMBRE_ASIGNACION||'',DESTINATARIO_NOMBRE:data.DESTINATARIO_NOMBRE||'',ASIGNADO_POR_NOMBRE:data.ASIGNADO_POR_NOMBRE||'',ORIGEN:data.ORIGEN||'',DESTINO:data.DESTINO||'',DISTANCIA_KM:data.DISTANCIA_KM??'',DURACION_MINUTOS:data.DURACION_MINUTOS??'',ESTADO_RESPUESTA:data.ESTADO_RESPUESTA||'',FECHA_RESPUESTA:'',RESPONDIDO_POR:'',LEIDA:'NO',FECHA_ENVIO:now,FECHA_LECTURA:'',LEIDA_POR:'',CREADO_POR:data.CREADO_POR||'',CREADO_EN:now,ACTUALIZADO_EN:now,ELIMINADO:'NO'};localDb.notifications.push(row);return row;
  }
  function localNotifyRoles(roleIds,data){
    const roles=Array.isArray(roleIds)?roleIds:[roleIds],sent=[];
    activeRows(localDb.users).filter(user=>roles.includes(user.ROL_ID)&&user.ESTADO!=='Inactivo').forEach(target=>{
      sent.push(localCreateNotification({...data,DESTINATARIO_USUARIO_ID:target.ID}));
    });
    return sent;
  }
  function localRegisterRouteEvidence(payload){const user=requireLocalUser(),data=payload.data||payload,row=find('routes',data.RUTA_ID||payload.id);requireLocalPermission(user,'RUTAS','ACTUALIZAR');if(!row||!localFilterRows('routes',[row],user).length)throw new Error('RUTA_NO_ENCONTRADA');let urls=data.URLS;if(typeof urls==='string'){try{urls=JSON.parse(urls);}catch(_){urls=[urls];}}if(!Array.isArray(urls)||!urls.length)throw new Error('EVIDENCIA_RUTA_REQUERIDA');let existing=[];try{existing=JSON.parse(row.EVIDENCIAS_FOTOS_CODIFICADAS||'[]');}catch(_){existing=[];}const additions=urls.map(item=>typeof item==='string'?{url:item,nombre:'Fotografía de ruta'}:item).map(item=>({...item,fecha:iso(),usuarioId:user.ID,usuarioNombre:user.NOMBRE,observacion:data.OBSERVACION||''}));const all=existing.concat(additions).slice(-30);Object.assign(row,{EVIDENCIAS_FOTOS_CODIFICADAS:JSON.stringify(all),ULTIMA_EVIDENCIA_URL:additions[additions.length-1]?.url||'',ULTIMA_EVIDENCIA_FECHA:iso(),ULTIMA_EVIDENCIA_POR:user.ID,ULTIMA_EVIDENCIA_OBSERVACION:data.OBSERVACION||'',ACTUALIZADO_EN:iso()});audit(user,'CARGAR_EVIDENCIA','RUTAS',`${additions.length} fotografía(s) asociadas`,row.ID);saveLocal();return{row:cleanRow(row),evidencias:all,agregadas:additions.length};}
  function localRunAutomaticAlerts(){return{creadas:0,revisadas:{modo:'local'}};}
  function localSendNotification(payload){
    const user=requireLocalUser(),data=payload.data||payload;requireLocalPermission(user,'NOTIFICACIONES','CREAR');if(!data.TITULO||!data.MENSAJE)throw new Error('DATOS_NOTIFICACION_REQUERIDOS');
    let driverId=data.DESTINATARIO_CONDUCTOR_ID||'',userId=data.DESTINATARIO_USUARIO_ID||'';if(driverId){const driver=find('drivers',driverId);if(!driver)throw new Error('CONDUCTOR_NO_ENCONTRADO');userId=userId||driver.USUARIO_ID||'';}
    if(!driverId&&!userId)throw new Error('DESTINATARIO_REQUERIDO');const row=localCreateNotification({...data,DESTINATARIO_CONDUCTOR_ID:driverId,DESTINATARIO_USUARIO_ID:userId,CREADO_POR:user.ID});
    audit(user,'ENVIAR','NOTIFICACIONES',row.TITULO,row.ID);saveLocal();return{row};
  }
  function localPendingNotices(){
    const user=requireLocalUser(),driver=activeRows(localDb.drivers).find(row=>String(row.USUARIO_ID||'')===String(user.ID||''));
    const normal=value=>String(value??'').trim().toUpperCase().replace(/\s+/g,' ');
    const fecha=item=>new Date(item.FECHA_HORA||item.FECHA_ENVIO||item.CREADO_EN||0).getTime()||0;
    const dedupe=(rows,tipo)=>{const mapa=new Map();rows.forEach(item=>{const unica=normal(item.CLAVE_UNICA);const receptor=normal(tipo==='A'?item.USUARIO_ID:item.DESTINATARIO_USUARIO_ID);const key=unica?`${tipo}|${receptor}|${unica}`:[tipo,receptor,normal(item.TIPO),normal(item.CATEGORIA||item.CATEGORIA_EMERGENTE),normal(item.MODULO),normal(item.REGISTRO_ID||item.RUTA_ID||item.OPERACION_ID),normal(item.TITULO),normal(item.MENSAJE)].join('|');const current=mapa.get(key);if(!current||fecha(item)>fecha(current))mapa.set(key,item);});return [...mapa.values()].sort((a,b)=>fecha(b)-fecha(a));};
    const notifications=dedupe(activeRows(localDb.notifications).filter(row=>!['SI','TRUE','1'].includes(String(row.LEIDA??'NO').trim().toUpperCase())).filter(row=>{const uid=String(row.DESTINATARIO_USUARIO_ID||'').trim(),did=String(row.DESTINATARIO_CONDUCTOR_ID||'').trim();return (!uid&&!did)||uid===String(user.ID)||Boolean(driver&&did===String(driver.ID));}),'N');
    const alerts=dedupe(activeRows(localDb.alerts).filter(row=>!['SI','TRUE','1'].includes(String(row.LEIDA??'NO').trim().toUpperCase())).filter(row=>{const uid=String(row.USUARIO_ID||'').trim();return !uid||uid===String(user.ID); }),'A');
    const permissionState={userId:String(user.ID||''),versionPermisos:Number(user.VERSION_PERMISOS||0),rolId:String(user.ROL_ID||''),modoPermisos:String(user.MODO_PERMISOS||'ROL').toUpperCase(),USUARIO_ID:String(user.ID||''),VERSION_PERMISOS:Number(user.VERSION_PERMISOS||0),ROL_ID:String(user.ROL_ID||''),MODO_PERMISOS:String(user.MODO_PERMISOS||'ROL').toUpperCase()};return {notifications,alerts,notificaciones:notifications,alertas:alerts,unreadNotifications:notifications.length,unreadAlerts:alerts.length,total:notifications.length+alerts.length,permissionState,estadoPermisos:permissionState,snapshotCompleto:true,SNAPSHOT_COMPLETO:true};
  }

  function localReadNotification(payload){
    const user=requireLocalUser(),row=find('notifications',payload.id||payload.NOTIFICACION_ID);requireLocalPermission(user,'NOTIFICACIONES','ACTUALIZAR');
    if(!row)throw new Error('NOTIFICACION_NO_ENCONTRADA');if(!localFilterRows('notifications',[row],user).length)throw new Error('PERMISO_DENEGADO');
    if(['RUTA_ASIGNADA','RUTA_SIGUIENTE_DESTINO','OPERACION_ASIGNADA','VEHICULO_CHECKIN_ASIGNADO'].includes(String(row.CATEGORIA_EMERGENTE||''))&&String(row.ESTADO_RESPUESTA||'PENDIENTE')==='PENDIENTE')throw new Error('ASIGNACION_REQUIERE_ACEPTACION');
    row.LEIDA='SI';row.FECHA_LECTURA=iso();row.LEIDA_POR=user.ID;row.ACTUALIZADO_EN=iso();saveLocal();return{row,persistenciaConfirmada:true};
  }
  function localAssignmentAlerts(payload={}){const user=requireLocalUser(),driver=localDriver(user),administrador=['ROL-ADMIN','ROL-GERENCIA'].includes(user.ROL_ID);if(!administrador)requireLocalPermission(user,'NOTIFICACIONES','MARCAR_LEIDA');const supervisorDelegado=user.ROL_ID==='ROL-SUPERVISOR'&&hasLocalPermission(user,'NOTIFICACIONES','ACEPTAR_ASIGNACIONES_AJENAS'),controlGlobal=administrador||supervisorDelegado,limite=Math.min(150,Math.max(1,Number(payload.limit||payload.LIMITE||(controlGlobal?150:20)))),rows=activeRows(localDb.notifications).filter(row=>['RUTA_ASIGNADA','RUTA_SIGUIENTE_DESTINO','OPERACION_ASIGNADA','VEHICULO_CHECKIN_ASIGNADO'].includes(String(row.CATEGORIA_EMERGENTE||''))&&String(row.ESTADO_RESPUESTA||'PENDIENTE')==='PENDIENTE'&&(controlGlobal||row.DESTINATARIO_USUARIO_ID===user.ID||(driver&&row.DESTINATARIO_CONDUCTOR_ID===driver.ID))).sort((a,b)=>new Date(b.FECHA_ENVIO)-new Date(a.FECHA_ENVIO)).slice(0,limite);return{rows,total:rows.length,alcance:administrador?'ADMINISTRADOR_TODAS_LAS_ASIGNACIONES':supervisorDelegado?'OPERADOR_DELEGADO_TODAS_LAS_ASIGNACIONES':'USUARIO_PROPIO',serverTime:iso()};}
  function localRespondAssignmentAlert(payload){
    const user=requireLocalUser(),data=payload.data||payload,idNotificacion=payload.id||data.NOTIFICACION_ID||data.ID,row=find('notifications',idNotificacion),driver=localDriver(user),respuesta=String(data.RESPUESTA||'CERRADA').toUpperCase(),administrador=['ROL-ADMIN','ROL-GERENCIA'].includes(user.ROL_ID);if(!administrador)requireLocalPermission(user,'NOTIFICACIONES','MARCAR_LEIDA');const operadorDelegado=user.ROL_ID==='ROL-SUPERVISOR'&&hasLocalPermission(user,'NOTIFICACIONES','ACEPTAR_ASIGNACIONES_AJENAS');if(!row||!['RUTA_ASIGNADA','RUTA_SIGUIENTE_DESTINO','OPERACION_ASIGNADA','VEHICULO_CHECKIN_ASIGNADO'].includes(String(row.CATEGORIA_EMERGENTE||'')))throw new Error('AVISO_ASIGNACION_NO_ENCONTRADO');const propio=row.DESTINATARIO_USUARIO_ID===user.ID||Boolean(driver&&row.DESTINATARIO_CONDUCTOR_ID===driver.ID);if(!propio&&!administrador&&!operadorDelegado)throw new Error('PERMISO_DENEGADO');if(!['ACEPTADA','CERRADA'].includes(respuesta))throw new Error('RESPUESTA_ASIGNACION_INVALIDA');
    if(row.CATEGORIA_EMERGENTE==='RUTA_SIGUIENTE_DESTINO'&&respuesta==='CERRADA'){
      row.ESTADO_RESPUESTA='PENDIENTE';row.LEIDA='NO';row.FECHA_RESPUESTA='';row.RESPONDIDO_POR='';row.ACTUALIZADO_EN=iso();audit(user,'POSPONER_SIGUIENTE_DESTINO','NOTIFICACIONES',row.NOMBRE_ASIGNACION||row.TITULO,row.ID);saveLocal();return{row,respuesta:'CERRADA',POSPUESTA:true,pospuesta:true,persistenciaConfirmada:true};
    }
    let rutaIniciada=false,rutaActualizada=null,seguimiento=null;
    if(respuesta==='ACEPTADA'&&row.CATEGORIA_EMERGENTE==='RUTA_SIGUIENTE_DESTINO'){
      const route=find('routes',row.RUTA_ID);if(!route)throw new Error('RUTA_NO_ENCONTRADA');let stops=localParseRouteStops(route.PARADAS_CODIFICADAS),currentIndex=stops.findIndex(stop=>stop.ESTADO==='LLEGADA_DETECTADA');if(currentIndex<0)throw new Error('RUTA_PUNTO_ACTUAL_NO_ENCONTRADO');
      stops[currentIndex].ESTADO='COMPLETADA';stops[currentIndex].COMPLETADA_EN=iso();let nextIndex=stops.findIndex((stop,index)=>index!==currentIndex&&stop.ESTADO==='PENDIENTE');if(nextIndex<0)throw new Error('RUTA_SIGUIENTE_DESTINO_NO_ENCONTRADO');stops[nextIndex].ESTADO='ACTIVA';stops=stops.sort((a,b)=>Number(a.ORDEN)-Number(b.ORDEN));const next=stops[nextIndex];Object.assign(route,{DESTINO:next.DESTINO,DESTINO_LATITUD:next.LATITUD,DESTINO_LONGITUD:next.LONGITUD,PARADAS_CODIFICADAS:JSON.stringify(stops),GPS_SEGUIMIENTO_ACTIVO:'SI',ACTUALIZADO_EN:iso()});localRecordRouteHistory(route,'SIGUIENTE_DESTINO',user,`Continuación aceptada: ${next.DESTINO}`);rutaIniciada=true;rutaActualizada=route;seguimiento={activo:true,RUTA_ID:route.ID,OPERACION_ID:route.OPERACION_ID||'',VEHICULO_ID:route.VEHICULO_ID||'',CONDUCTOR_ID:route.CONDUCTOR_ID||'',CHECKIN_ID:route.CHECKIN_ID||''};
    }
    if(respuesta==='ACEPTADA'&&row.CATEGORIA_EMERGENTE==='RUTA_ASIGNADA'){
      const route=find('routes',row.RUTA_ID),checkin=route&&activeRows(localDb.checkins).filter(item=>item.CONDUCTOR_ID===route.CONDUCTOR_ID&&item.VEHICULO_ID===route.VEHICULO_ID&&item.ESTADO_REVISION==='Aprobado'&&new Date(item.VIGENTE_HASTA||0)>new Date()).sort((a,b)=>new Date(b.FECHA_HORA||b.CREADO_EN||0)-new Date(a.FECHA_HORA||a.CREADO_EN||0))[0];if(!checkin)throw new Error('CHECKIN_APROBADO_REQUERIDO');if(route)localRecordRouteHistory(route,'ACEPTADA',user,'Asignación aceptada desde la alerta emergente');
      const esConductorPropietario=propio&&user.ROL_ID==='ROL-CONDUCTOR'&&driver&&route&&String(driver.ID)===String(route.CONDUCTOR_ID);
      if(esConductorPropietario&&route){const now=iso();Object.assign(route,{ESTADO:'En curso',FECHA_INICIO:route.FECHA_INICIO||now,CRONOMETRO_INICIO:route.CRONOMETRO_INICIO||route.FECHA_ASIGNACION||route.CREADO_EN||now,CHECKIN_ID:checkin.ID,GPS_SEGUIMIENTO_ACTIVO:'SI',SEGUIMIENTO_INICIADO_POR:user.ID,ULTIMA_UBICACION_EN:now,ACTUALIZADO_EN:now});localRecordRouteHistory(route,'INICIADA',user,'Ruta iniciada automáticamente al aceptar la asignación');const driverRow=find('drivers',route.CONDUCTOR_ID),vehicleRow=find('vehicles',route.VEHICULO_ID);if(driverRow)localReconcileAvailability('drivers',driverRow);if(vehicleRow)localReconcileAvailability('vehicles',vehicleRow);rutaIniciada=true;rutaActualizada=route;seguimiento={activo:true,RUTA_ID:route.ID,OPERACION_ID:route.OPERACION_ID||'',VEHICULO_ID:route.VEHICULO_ID,CONDUCTOR_ID:route.CONDUCTOR_ID,CHECKIN_ID:checkin.ID};}
      else rutaActualizada=route;
    }
    const fecha=iso();Object.assign(row,{ESTADO_RESPUESTA:respuesta,FECHA_RESPUESTA:fecha,RESPONDIDO_POR:user.ID,LEIDA:'SI',FECHA_LECTURA:fecha,LEIDA_POR:user.ID,ACTUALIZADO_EN:fecha});if(respuesta==='ACEPTADA'&&row.CATEGORIA_EMERGENTE==='VEHICULO_CHECKIN_ASIGNADO')activeRows(localDb.checkinAssignments).filter(item=>item.CONDUCTOR_ID===row.DESTINATARIO_CONDUCTOR_ID&&item.ESTADO==='ASIGNADO').forEach(item=>Object.assign(item,{ESTADO:'CHECKIN_PENDIENTE',ACTUALIZADO_EN:fecha}));const representacion=!propio?(administrador?` · como Administrador para ${row.DESTINATARIO_NOMBRE||'usuario subordinado'}`:` · como Operador autorizado para ${row.DESTINATARIO_NOMBRE||'otro usuario'}`):'';audit(user,respuesta==='ACEPTADA'?'ACEPTAR_ASIGNACION':'CERRAR_AVISO_ASIGNACION','NOTIFICACIONES',`${row.CATEGORIA_EMERGENTE}: ${row.NOMBRE_ASIGNACION||row.TITULO}${representacion}${rutaIniciada?' · ruta iniciada automáticamente':''}`,row.ID);saveLocal();return{row,respuesta,aceptadaPorAdministrador:administrador&&!propio,aceptadaPorOperador:operadorDelegado&&!propio,persistenciaConfirmada:true,RUTA_INICIADA:rutaIniciada,rutaIniciada,RUTA:rutaActualizada?rutaActualizada:null,ruta:rutaActualizada?rutaActualizada:null,SEGUIMIENTO:seguimiento,seguimiento};
  }
  function localResendAssignmentAlert(payload){const user=requireLocalUser();if(!['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'].includes(user.ROL_ID))throw new Error('ALERTA_ASIGNACION_NO_AUTORIZADA');const data=payload.data||payload,clase=String(data.CLASE||'').toUpperCase(),registroId=String(data.REGISTRO_ID||payload.id||''),registro=find(clase==='RUTA'?'routes':'operations',registroId);if(!['RUTA','OPERACION'].includes(clase)||!registro)throw new Error('ASIGNACION_REENVIO_INVALIDA');const driver=find('drivers',registro.CONDUCTOR_ID);if(!driver)throw new Error('CONDUCTOR_NO_ENCONTRADO');const fecha=iso(),anteriores=activeRows(localDb.notifications).filter(row=>row.DESTINATARIO_CONDUCTOR_ID===driver.ID&&row.CATEGORIA_EMERGENTE===`${clase}_ASIGNADA`&&String(row.ESTADO_RESPUESTA||'PENDIENTE')==='PENDIENTE'&&(clase==='RUTA'?row.RUTA_ID===registro.ID:row.OPERACION_ID===registro.ID));anteriores.forEach(row=>Object.assign(row,{ESTADO_RESPUESTA:'CERRADA',FECHA_RESPUESTA:fecha,RESPONDIDO_POR:user.ID,LEIDA:'SI',FECHA_LECTURA:fecha,LEIDA_POR:user.ID,ACTUALIZADO_EN:fecha}));const route=clase==='RUTA'?registro:(registro.RUTA_ID?find('routes',registro.RUTA_ID):null),nombre=clase==='RUTA'?(registro.NOMBRE||`Ruta ${registro.ID}`):(route?.NOMBRE||`Operación ${registro.ID}`),origen=registro.ORIGEN||registro.BASE_DIRECCION||route?.ORIGEN||'Origen no informado',destino=registro.DESTINO||registro.PUNTO_RETORNO||route?.DESTINO||'Destino no informado';const row=localCreateNotification({DESTINATARIO_USUARIO_ID:driver.USUARIO_ID||'',DESTINATARIO_CONDUCTOR_ID:driver.ID,DESTINATARIO_NOMBRE:driver.NOMBRE,TITULO:`Nueva ${clase==='RUTA'?'ruta':'operación'} asignada`,MENSAJE:`${nombre}: ${origen} → ${destino}`,TIPO:clase==='RUTA'?'Ruta':'Operación',PRIORIDAD:'Urgente',RUTA_ID:clase==='RUTA'?registro.ID:(registro.RUTA_ID||''),OPERACION_ID:clase==='OPERACION'?registro.ID:(registro.OPERACION_ID||''),CATEGORIA_EMERGENTE:`${clase}_ASIGNADA`,NOMBRE_ASIGNACION:nombre,ORIGEN:origen,DESTINO:destino,ESTADO_RESPUESTA:'PENDIENTE',CLAVE_UNICA:`REENVIO-${clase}-${registro.ID}-${Date.now()}`,CREADO_POR:user.ID});audit(user,'REENVIAR_ALERTA_ASIGNACION',clase==='RUTA'?'RUTAS':'OPERACIONES',`Alerta reenviada a ${driver.NOMBRE}`,registro.ID);saveLocal();return{row,reenviada:true,avisosAnterioresCerrados:anteriores.length};}
  function localReadAlert(payload){
    const user=requireLocalUser(),row=find('alerts',payload.id||payload.ALERTA_ID);requireLocalPermission(user,'ALERTAS','CERRAR');
    if(!row)throw new Error('ALERTA_NO_ENCONTRADA');if(!localFilterRows('alerts',[row],user).length)throw new Error('PERMISO_DENEGADO');
    if(!['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'].includes(user.ROL_ID))throw new Error('PERMISO_DENEGADO');
    row.LEIDA='SI';row.FECHA_LECTURA=iso();row.LEIDA_POR=user.ID;row.ACTUALIZADO_EN=iso();audit(user,'CERRAR_ALERTA','ALERTAS',`${row.TITULO||row.TIPO||'Alerta'}${user.ROL_ID==='ROL-SUPERVISOR'?' · Supervisor con permiso ALERTAS:CERRAR':''}`,row.ID);saveLocal();return{row,cerradaPorAdministrador:user.ROL_ID==='ROL-ADMIN',cerradaPorSupervisor:user.ROL_ID==='ROL-SUPERVISOR',persistenciaConfirmada:true};
  }
  function localHeartbeat(payload){
    const user=requireLocalUser(),data=payload.data||payload,deviceId=String(data.DISPOSITIVO_ID||'').slice(0,120);if(!deviceId)throw new Error('CAMPO_REQUERIDO_DISPOSITIVO_ID');
    const driver=localDriver(user),sessionId=auth.sessionId||String(data.SESION_CLIENTE_ID||''),clientSessionId=String(data.SESION_CLIENTE_ID||'').slice(0,120);
    const operation=driver?activeRows(localDb.operations).find(row=>row.CONDUCTOR_ID===driver.ID&&row.ESTADO==='Activa'):null;
    const route=driver?(activeRows(localDb.routes).find(row=>row.CONDUCTOR_ID===driver.ID&&row.ESTADO==='En curso')||activeRows(localDb.routes).find(row=>row.CONDUCTOR_ID===driver.ID&&row.ESTADO==='Asignada')):null;
    const gpsActive=data.GPS_ACTIVO==='SI',drivingAssignment=Boolean(operation||(route&&route.ESTADO==='En curso'));
    const activity=!driver?'Sesión administrativa':drivingAssignment&&gpsActive?'Conduciendo':drivingAssignment?'Operación activa sin GPS':'Conectado';
    const existing=activeRows(localDb.connections).find(row=>row.USUARIO_ID===user.ID&&row.DISPOSITIVO_ID===deviceId&&row.SESION_ID===sessionId&&String(row.SESION_CLIENTE_ID||'')===clientSessionId);
    requireLocalPermission(user,'CONEXIONES',existing?'ACTUALIZAR':'CREAR');const now=iso(),values={USUARIO_ID:user.ID,CONDUCTOR_ID:driver?.ID||'',DISPOSITIVO_ID:deviceId,
      SESION_ID:sessionId,SESION_CLIENTE_ID:clientSessionId,SECCION_ACTUAL:String(data.SECCION_ACTUAL||'dashboard').slice(0,80),ACTIVIDAD:activity,
      VEHICULO_ID:operation?.VEHICULO_ID||route?.VEHICULO_ID||'',OPERACION_ID:operation?.ID||'',RUTA_ID:route?.ID||'',GPS_ACTIVO:gpsActive?'SI':'NO',PAGINA_VISIBLE:data.PAGINA_VISIBLE==='NO'?'NO':'SI',
      ESTADO:data.ESTADO||'En línea',ULTIMA_CONEXION:now,PLATAFORMA:data.PLATAFORMA||navigator.platform||'',NAVEGADOR:data.NAVEGADOR||navigator.userAgent,
      TIPO_RED:data.TIPO_RED||'',BATERIA_PORCENTAJE:data.BATERIA_PORCENTAJE??'',IP_PUBLICA:data.IP_PUBLICA||find('sessions',auth.sessionId)?.IP_PUBLICA||'',IP_VERSION:String(data.IP_PUBLICA||find('sessions',auth.sessionId)?.IP_PUBLICA||'').includes(':')?'IPv6':(data.IP_PUBLICA||find('sessions',auth.sessionId)?.IP_PUBLICA)?'IPv4':'',IP_CAPTURADA_EN:(data.IP_PUBLICA||find('sessions',auth.sessionId)?.IP_PUBLICA)?now:'',ACTUALIZADO_EN:now,ELIMINADO:'NO'};
    const row=existing?Object.assign(existing,values):{ID:id('CNX'),...values,CREADO_EN:now};if(!existing)localDb.connections.push(row);saveLocal();return{row,serverTime:now,user:publicUser(user)};
  }
  function localRealtimeSummary(payload={}){
    const user=requireLocalUser();requireLocalPermission(user,'GPS','LEER');const locations=localLatestLocations(payload);const vehicleFilter=localVehicleFilter(payload,user);const onlyGps=String(payload.soloGps||payload.SOLO_GPS||'')==='SI';
    const connections=(user.ROL_ID==='ROL-CONDUCTOR'||hasLocalPermission(user,'CONEXIONES','LEER'))?localFilterRows('connections',activeRows(localDb.connections),user):[],latest={};connections.sort((a,b)=>new Date(b.ULTIMA_CONEXION)-new Date(a.ULTIMA_CONEXION)).forEach(row=>{const key=`${row.SESION_ID||row.USUARIO_ID}:${row.SESION_CLIENTE_ID||row.DISPOSITIVO_ID}`;if(!latest[key])latest[key]=row;});
    const limit=Date.now()-(config.ANTIGUEDAD_CONEXION_ACTIVA_MILISEGUNDOS||90000);const devices=Object.values(latest).map(row=>{const driver=find('drivers',row.CONDUCTOR_ID),operation=driver?activeRows(localDb.operations).find(item=>item.CONDUCTOR_ID===driver.ID&&item.ESTADO==='Activa'):null,route=driver?(activeRows(localDb.routes).find(item=>item.CONDUCTOR_ID===driver.ID&&item.ESTADO==='En curso')||activeRows(localDb.routes).find(item=>item.CONDUCTOR_ID===driver.ID&&item.ESTADO==='Asignada')):null,vehicleId=operation?.VEHICULO_ID||route?.VEHICULO_ID||row.VEHICULO_ID||'',vehicle=find('vehicles',vehicleId),online=new Date(row.ULTIMA_CONEXION).getTime()>=limit&&row.ESTADO!=='Desconectado',drivingAssignment=Boolean(operation||(route&&route.ESTADO==='En curso')),activity=!online?'Inactivo':!driver?'Sesión administrativa':drivingAssignment&&row.GPS_ACTIVO==='SI'?'Conduciendo':drivingAssignment?'Operación activa sin GPS':'Conectado';return{...row,USUARIO_NOMBRE:find('users',row.USUARIO_ID)?.NOMBRE||'',CONDUCTOR_NOMBRE:driver?.NOMBRE||'',VEHICULO_ID:vehicleId,VEHICULO_PATENTE:vehicle?.PATENTE||'',OPERACION_ID:operation?.ID||'',RUTA_ID:route?.ID||'',ACTIVIDAD:activity,EN_LINEA:online};});
    const connectionFilter=String(payload.estadoConexion||payload.ESTADO_CONEXION||'TODOS').toUpperCase();
    const matchConnection=row=>connectionFilter==='TODOS'||(connectionFilter==='EN_LINEA'&&row.EN_LINEA)||(connectionFilter==='CONDUCIENDO'&&row.EN_LINEA&&row.ACTIVIDAD==='Conduciendo')||(connectionFilter==='SIN_GPS'&&row.EN_LINEA&&row.ACTIVIDAD==='Operación activa sin GPS')||(connectionFilter==='INACTIVOS'&&!row.EN_LINEA);
    const filteredDevices=(vehicleFilter.activo?devices.filter(row=>vehicleFilter.ids.has(row.VEHICULO_ID)):devices).filter(matchConnection);
    const visibleVehicleIds=new Set(filteredDevices.map(row=>row.VEHICULO_ID).filter(Boolean));
    const visibleLocations=connectionFilter==='TODOS'?locations.rows:(locations.rows||[]).filter(row=>visibleVehicleIds.has(row.VEHICULO_ID));
    filteredDevices.sort((a,b)=>a.EN_LINEA!==b.EN_LINEA?(a.EN_LINEA?-1:1):new Date(b.ULTIMA_CONEXION)-new Date(a.ULTIMA_CONEXION));
    const routes=onlyGps?[]:(hasLocalPermission(user,'RUTAS','LEER')?localFilterRows('routes',activeRows(localDb.routes),user):[]).filter(row=>['Asignada','En curso'].includes(row.ESTADO));
    const notifications=onlyGps?[]:(hasLocalPermission(user,'NOTIFICACIONES','LEER')?localFilterRows('notifications',activeRows(localDb.notifications),user):[]).filter(row=>row.LEIDA!=='SI').slice(-50).reverse();
    return{locations:visibleLocations,rows:visibleLocations,ubicaciones:visibleLocations,trackingVehicles:locations.trackingVehicles||[],trackingDrivers:locations.trackingDrivers||[],devices:filteredDevices.slice(0,100),routes,notifications,totals:{locations:visibleLocations.length,onlineDevices:filteredDevices.filter(row=>row.EN_LINEA).length,drivingSessions:filteredDevices.filter(row=>row.EN_LINEA&&row.ACTIVIDAD==='Conduciendo').length,sessionsWithoutGps:filteredDevices.filter(row=>row.EN_LINEA&&row.ACTIVIDAD==='Operación activa sin GPS').length,activeRoutes:routes.length,unreadNotifications:notifications.length},rolVista:user.ROL_ID,alcance:user.ROL_ID==='ROL-CONDUCTOR'?'PROPIO':user.ROL_ID==='ROL-SUPERVISOR'?'TODOS_VISUALIZACION':'CONTROL_TOTAL',controlTotal:user.ROL_ID==='ROL-ADMIN',serverTime:iso()};
  }
  function localConnectionTrackingKey(user){return `flotas_seguimiento_conexion_servidor_v1_${String(user?.ID||'sin_usuario')}`;}
  function localSaveConnectionTracking(payload={}){
    const user=requireLocalUser();requireLocalPermission(user,'CONEXIONES','SEGUIR');
    const data=payload.data||payload||{},trackedUserId=String(data.USUARIO_ID||data.usuarioId||'').trim();
    if(trackedUserId&&!activeRows(localDb.users).some(row=>row.ID===trackedUserId))throw new Error('USUARIO_SEGUIMIENTO_NO_ENCONTRADO');
    if(trackedUserId)localStorage.setItem(localConnectionTrackingKey(user),trackedUserId);else localStorage.removeItem(localConnectionTrackingKey(user));
    audit(user,trackedUserId?'INICIAR_SEGUIMIENTO_USUARIO':'DETENER_SEGUIMIENTO_USUARIO','CONEXIONES',trackedUserId?`Seguimiento individual activado para ${trackedUserId}.`:'Seguimiento individual detenido.',trackedUserId);
    saveLocal();
    const target=trackedUserId?find('users',trackedUserId):null;
    return{seguimiento:{USUARIO_ID:trackedUserId,USUARIO_NOMBRE:target?.NOMBRE||'',USUARIO_CORREO:target?.CORREO||'',VISIBLE:false,RASTRO:[]},persistenciaConfirmada:true};
  }
  function localConnectionTrackingLive(payload={}){
    const user=requireLocalUser();requireLocalPermission(user,'CONEXIONES','SEGUIR');
    const data=payload.data||payload||{},trackedUserId=String(data.USUARIO_ID||data.usuarioId||localStorage.getItem(localConnectionTrackingKey(user))||'').trim();
    if(!trackedUserId)return{row:null,sinConexion:true,seguimiento:{USUARIO_ID:'',VISIBLE:false,RASTRO:[]},serverTime:iso()};
    const result=localConnectionsOnline({USUARIO_ID:trackedUserId,LIMITE:20});
    const row=(result.equipos||[]).filter(item=>item.LATITUD!==''&&item.LONGITUD!=='').sort((a,b)=>new Date(b.FECHA_GPS||b.ULTIMA_CONEXION||0)-new Date(a.FECHA_GPS||a.ULTIMA_CONEXION||0))[0]||(result.equipos||[])[0]||null;
    return{row,sinConexion:!row,seguimiento:result.seguimiento||{USUARIO_ID:trackedUserId,VISIBLE:false,RASTRO:[]},serverTime:result.serverTime||iso()};
  }
  function localSendConnectionsNotice(payload={}){
    const user=requireLocalUser(),data=payload.data||payload||{},tipoAviso=String(data.TIPO_AVISO||'NOTIFICACION').toUpperCase(),alcance=String(data.ALCANCE||'USUARIO').toUpperCase();
    if(!['NOTIFICACION','ALERTA'].includes(tipoAviso))throw new Error('TIPO_AVISO_INVALIDO');
    if(!['USUARIO','CONDUCTORES','CONECTADOS','TODOS'].includes(alcance))throw new Error('ALCANCE_AVISO_INVALIDO');
    requireLocalPermission(user,tipoAviso==='ALERTA'?'ALERTAS':'NOTIFICACIONES','CREAR');
    const titulo=String(data.TITULO||'').trim().slice(0,160),mensaje=String(data.MENSAJE||'').trim().slice(0,2000);
    if(!titulo||!mensaje)throw new Error('TITULO_Y_MENSAJE_REQUERIDOS');
    const users=activeRows(localDb.users).filter(row=>row.ESTADO==='Activo'),userMap=new Map(users.map(row=>[String(row.ID),row]));
    const drivers=activeRows(localDb.drivers).filter(row=>row.ESTADO!=='Inactivo'),driverByUser=new Map(drivers.filter(row=>row.USUARIO_ID).map(row=>[String(row.USUARIO_ID),row]));
    let targets=[];
    if(alcance==='USUARIO'){
      const target=userMap.get(String(data.USUARIO_ID||data.DESTINATARIO_USUARIO_ID||''));
      if(!target)throw new Error('USUARIO_DESTINATARIO_NO_ENCONTRADO');
      targets=[target];
    }else if(alcance==='CONDUCTORES'){
      targets=users.filter(row=>row.ROL_ID==='ROL-CONDUCTOR'||driverByUser.has(String(row.ID)));
    }else if(alcance==='CONECTADOS'){
      const limit=Date.now()-(config.ANTIGUEDAD_CONEXION_ACTIVA_MILISEGUNDOS||90000),ids=new Set(activeRows(localDb.connections).filter(row=>new Date(row.ULTIMA_CONEXION||0).getTime()>=limit&&row.ESTADO!=='Desconectado').map(row=>String(row.USUARIO_ID||'')).filter(Boolean));
      targets=users.filter(row=>ids.has(String(row.ID)));
    }else targets=users;
    targets=[...new Map(targets.map(row=>[String(row.ID),row])).values()].slice(0,500);
    if(!targets.length)throw new Error('SIN_DESTINATARIOS_PARA_EL_ALCANCE');
    const requestId=String(data.SOLICITUD_CLIENTE_ID||id('AVC')).replace(/[^A-Za-z0-9_-]/g,'').slice(0,120),category=String(data.CATEGORIA||(tipoAviso==='ALERTA'?'Operación':'Información')).slice(0,80);
    let sent=0,skipped=0;
    if(tipoAviso==='NOTIFICACION'){
      targets.forEach(target=>{
        const driver=driverByUser.get(String(target.ID)),key=`AVISO-CONEXIONES-${requestId}-${target.ID}`;
        if(activeRows(localDb.notifications).some(row=>row.CLAVE_UNICA===key&&row.DESTINATARIO_USUARIO_ID===target.ID)){skipped+=1;return;}
        localCreateNotification({DESTINATARIO_USUARIO_ID:target.ID,DESTINATARIO_CONDUCTOR_ID:driver?.ID||'',TITULO:titulo,MENSAJE:mensaje,TIPO:category,PRIORIDAD:['Baja','Normal','Alta','Urgente'].includes(data.PRIORIDAD)?data.PRIORIDAD:'Normal',CLAVE_UNICA:key,CREADO_POR:user.ID});sent+=1;
      });
    }else{
      targets.forEach(target=>{
        const key=`AVISO-CONEXIONES-${requestId}-${target.ID}`;
        if(activeRows(localDb.alerts).some(row=>row.CLAVE_UNICA===key)){skipped+=1;return;}
        const now=iso();localDb.alerts.push({ID:id('ALT'),TIPO:category,NIVEL:['Info','Advertencia','Crítica'].includes(data.NIVEL)?data.NIVEL:'Advertencia',TITULO:titulo,MENSAJE:mensaje,MODULO:'CONEXIONES',REGISTRO_ID:target.ID,CLAVE_UNICA:key,LEIDA:'NO',USUARIO_ID:target.ID,FECHA_HORA:now,CREADO_EN:now,ACTUALIZADO_EN:now,ELIMINADO:'NO'});sent+=1;
      });
    }
    audit(user,tipoAviso==='ALERTA'?'ENVIAR_ALERTA_CONEXIONES':'ENVIAR_NOTIFICACION_CONEXIONES','CONEXIONES',`Alcance: ${alcance}. Destinatarios: ${targets.length}. Enviados: ${sent}. Título: ${titulo}.`,requestId);
    saveLocal();return{tipoAviso,alcance,destinatarios:targets.length,enviados:sent,omitidos:skipped,solicitudId:requestId};
  }
  function localConnectionsOnline(payload={}){
    const user=requireLocalUser();
    if(user.ROL_ID!=='ROL-CONDUCTOR')requireLocalPermission(user,'CONEXIONES','LEER');
    const data=payload.data||payload||{};
    const parseDate=(value,end)=>{if(!value)return null;const text=String(value),date=new Date(/^\d{4}-\d{2}-\d{2}$/.test(text)?`${text}${end?'T23:59:59.999':'T00:00:00.000'}`:text);return Number.isNaN(date.getTime())?null:date;};
    const from=parseDate(data.FECHA_DESDE||data.fechaDesde,false),to=parseDate(data.FECHA_HASTA||data.fechaHasta,true);
    const userId=String(data.USUARIO_ID||data.usuarioId||''),driverId=String(data.CONDUCTOR_ID||data.conductorId||''),vehicleId=String(data.VEHICULO_ID||data.vehiculoId||''),deviceIdFilter=String(data.DISPOSITIVO_ID||data.dispositivoId||'');
    const state=String(data.ESTADO||data.estado||'TODOS').toUpperCase(),gpsFilter=String(data.GPS||data.gps||'TODOS').toUpperCase();
    const net=String(data.TIPO_RED||data.tipoRed||'').toLowerCase(),platform=String(data.PLATAFORMA||data.plataforma||'').toLowerCase(),search=String(data.BUSCAR||data.buscar||'').toLowerCase();
    const precisionMax=Number(data.PRECISION_MAXIMA||data.precisionMaxima||0),limit=Date.now()-(config.ANTIGUEDAD_CONEXION_ACTIVA_MILISEGUNDOS||90000),gpsLimit=Date.now()-120000;
    const trackedUserId=String(localStorage.getItem(localConnectionTrackingKey(user))||'').trim();
    const latest={};activeRows(localDb.connections).slice().sort((a,b)=>new Date(b.ULTIMA_CONEXION||0)-new Date(a.ULTIMA_CONEXION||0)).forEach(row=>{const key=String(row.DISPOSITIVO_ID||row.SESION_CLIENTE_ID||row.SESION_ID||row.ID);if(!latest[key])latest[key]=row;});
    const gpsRows=activeRows(localDb.gpsCurrent||[]).slice().sort((a,b)=>new Date(b.FECHA_HORA||b.ACTUALIZADO_EN||0)-new Date(a.FECHA_HORA||a.ACTUALIZADO_EN||0));
    const findGps=row=>gpsRows.find(g=>g.DISPOSITIVO_ID&&g.DISPOSITIVO_ID===row.DISPOSITIVO_ID)||gpsRows.find(g=>g.VEHICULO_ID&&g.VEHICULO_ID===row.VEHICULO_ID)||gpsRows.find(g=>g.CONDUCTOR_ID&&g.CONDUCTOR_ID===row.CONDUCTOR_ID)||{};
    let equipos=Object.values(latest).map(row=>{const account=find('users',row.USUARIO_ID)||{},driver=find('drivers',row.CONDUCTOR_ID)||{},vehicle=find('vehicles',row.VEHICULO_ID)||{},gps=findGps(row);const last=new Date(row.ULTIMA_CONEXION||row.ACTUALIZADO_EN||0).getTime(),gpsTime=new Date(gps.FECHA_HORA||gps.ACTUALIZADO_EN||0).getTime(),online=Number.isFinite(last)&&last>=limit&&row.ESTADO!=='Desconectado',gpsRecent=Number.isFinite(gpsTime)&&gpsTime>=gpsLimit,retained=Boolean(online&&!gpsRecent&&(Number.isFinite(Number(gps.LATITUD))&&Number.isFinite(Number(gps.LONGITUD))))||String(gps.CALIDAD_GPS||gps.FUENTE||row.ACTIVIDAD||'').toUpperCase().includes('RETENIDA');return{...cleanRow(row),USUARIO_NOMBRE:account.NOMBRE||row.USUARIO_ID||'Usuario',USUARIO_CORREO:account.CORREO||'',ROL_ID:account.ROL_ID||'',CONDUCTOR_NOMBRE:driver.NOMBRE||'',VEHICULO_PATENTE:vehicle.PATENTE||'',VEHICULO_NOMBRE:[vehicle.MARCA,vehicle.MODELO].filter(Boolean).join(' '),EN_LINEA:online,COLOR_ESTADO:online?'VERDE':'ROJO',ESTADO_CONEXION:online?'Activo':'Desconectado',GPS_RECIENTE:gpsRecent,UBICACION_RETENIDA:retained,LATITUD:Number.isFinite(Number(gps.LATITUD))?Number(gps.LATITUD):'',LONGITUD:Number.isFinite(Number(gps.LONGITUD))?Number(gps.LONGITUD):'',PRECISION_METROS:Number.isFinite(Number(gps.PRECISION_METROS))?Number(gps.PRECISION_METROS):'',VELOCIDAD_KMH:Number(gps.VELOCIDAD_KMH||0),DIRECCION:gps.DIRECCION||'',FECHA_GPS:gps.FECHA_HORA||gps.ACTUALIZADO_EN||'',BATERIA_GPS:gps.BATERIA_PORCENTAJE||row.BATERIA_PORCENTAJE||''};});
    if(user.ROL_ID==='ROL-CONDUCTOR')equipos=equipos.filter(row=>String(row.USUARIO_ID||'')===String(user.ID||''));
    const allTeams=equipos.slice();
    equipos=equipos.filter(row=>{const date=new Date(row.ULTIMA_CONEXION||row.ACTUALIZADO_EN||0);if(from&&date<from)return false;if(to&&date>to)return false;if(userId&&row.USUARIO_ID!==userId)return false;if(driverId&&row.CONDUCTOR_ID!==driverId)return false;if(vehicleId&&row.VEHICULO_ID!==vehicleId)return false;if(deviceIdFilter&&row.DISPOSITIVO_ID!==deviceIdFilter)return false;if(state==='ACTIVOS'&&!row.EN_LINEA)return false;if(state==='DESCONECTADOS'&&row.EN_LINEA)return false;if(state==='SEGUNDO_PLANO'&&row.PAGINA_VISIBLE!=='NO')return false;if(gpsFilter==='ACTIVO'&&!(row.GPS_ACTIVO==='SI'&&row.GPS_RECIENTE))return false;if(gpsFilter==='INACTIVO'&&row.GPS_ACTIVO==='SI'&&row.GPS_RECIENTE)return false;if(gpsFilter==='SIN_UBICACION'&&row.LATITUD!=='')return false;if(net&&String(row.TIPO_RED||'').toLowerCase()!==net)return false;if(platform&&!String(row.PLATAFORMA||'').toLowerCase().includes(platform))return false;if(precisionMax>0&&Number(row.PRECISION_METROS||Number.MAX_SAFE_INTEGER)>precisionMax)return false;if(search&&!`${row.USUARIO_NOMBRE} ${row.USUARIO_CORREO} ${row.CONDUCTOR_NOMBRE} ${row.VEHICULO_PATENTE} ${row.DISPOSITIVO_ID} ${row.PLATAFORMA} ${row.NAVEGADOR} ${row.IP_PUBLICA} ${row.SECCION_ACTUAL} ${row.ACTIVIDAD} ${row.DIRECCION}`.toLowerCase().includes(search))return false;return true;});
    equipos.sort((a,b)=>{const aTracked=trackedUserId&&a.USUARIO_ID===trackedUserId,bTracked=trackedUserId&&b.USUARIO_ID===trackedUserId;if(aTracked!==bTracked)return aTracked?-1:1;return a.EN_LINEA!==b.EN_LINEA?(a.EN_LINEA?-1:1):new Date(b.ULTIMA_CONEXION||0)-new Date(a.ULTIMA_CONEXION||0);});
    const followed=equipos.filter(row=>row.USUARIO_ID===trackedUserId&&row.LATITUD!==''&&row.LONGITUD!=='').sort((a,b)=>new Date(b.FECHA_GPS||0)-new Date(a.FECHA_GPS||0))[0]||null;
    const trackedTeams=allTeams.filter(row=>row.USUARIO_ID===trackedUserId),trackedDevices=new Set(trackedTeams.map(row=>row.DISPOSITIVO_ID).filter(Boolean)),trackedDrivers=new Set(trackedTeams.map(row=>row.CONDUCTOR_ID).filter(Boolean)),trackedVehicles=new Set(trackedTeams.map(row=>row.VEHICULO_ID).filter(Boolean));
    let trace=trackedUserId&&followed?activeRows(localDb.gps).filter(row=>trackedDevices.size?trackedDevices.has(row.DISPOSITIVO_ID):(trackedDrivers.has(row.CONDUCTOR_ID)||trackedVehicles.has(row.VEHICULO_ID))).sort((a,b)=>new Date(a.FECHA_HORA||0)-new Date(b.FECHA_HORA||0)).slice(-40).map(row=>({LATITUD:Number(row.LATITUD),LONGITUD:Number(row.LONGITUD),FECHA_HORA:row.FECHA_HORA||'',PRECISION_METROS:Number(row.PRECISION_METROS||0),VELOCIDAD_KMH:Number(row.VELOCIDAD_KMH||0)})).filter(row=>Number.isFinite(row.LATITUD)&&Number.isFinite(row.LONGITUD)):[];
    if(followed&&!trace.some(row=>String(row.FECHA_HORA||'')===String(followed.FECHA_GPS||'')))trace.push({LATITUD:Number(followed.LATITUD),LONGITUD:Number(followed.LONGITUD),FECHA_HORA:followed.FECHA_GPS||'',PRECISION_METROS:Number(followed.PRECISION_METROS||0),VELOCIDAD_KMH:Number(followed.VELOCIDAD_KMH||0)});
    trace=trace.slice(-40);
    const trackedAccount=trackedUserId?find('users',trackedUserId):null;
    const unique=field=>[...new Set(equipos.map(row=>String(row[field]||'').trim()).filter(Boolean))].sort();
    const ubicaciones=equipos.filter(row=>row.LATITUD!==''&&row.LONGITUD!=='').map(row=>({ID:row.ID,MARCADOR_ID:`USUARIO-${row.USUARIO_ID||row.ID}`,DISPOSITIVO_ID:row.DISPOSITIVO_ID,USUARIO_ID:row.USUARIO_ID,USUARIO_NOMBRE:row.USUARIO_NOMBRE,CONDUCTOR_NOMBRE:row.CONDUCTOR_NOMBRE,VEHICULO_ID:row.VEHICULO_ID,VEHICULO_PATENTE:row.VEHICULO_PATENTE,LATITUD:row.LATITUD,LONGITUD:row.LONGITUD,PRECISION_METROS:row.PRECISION_METROS,VELOCIDAD_KMH:row.VELOCIDAD_KMH,DIRECCION:row.DIRECCION,FECHA_GPS:row.FECHA_GPS,EN_LINEA:row.EN_LINEA,GPS_RECIENTE:row.GPS_RECIENTE,UBICACION_RETENIDA:row.UBICACION_RETENIDA,GPS_ACTIVO:row.GPS_ACTIVO,ESTADO_CONEXION:row.ESTADO_CONEXION}));
    return{equipos:equipos.slice(0,500),ubicaciones:ubicaciones.slice(0,500),totales:{equipos:equipos.length,activos:equipos.filter(r=>r.EN_LINEA).length,desconectados:equipos.filter(r=>!r.EN_LINEA).length,gpsActivos:equipos.filter(r=>r.GPS_ACTIVO==='SI'&&r.GPS_RECIENTE).length,sinGps:equipos.filter(r=>!(r.GPS_ACTIVO==='SI'&&r.GPS_RECIENTE)).length,segundoPlano:equipos.filter(r=>r.PAGINA_VISIBLE==='NO').length},opciones:{usuarios:(user.ROL_ID==='ROL-CONDUCTOR'?activeRows(localDb.users).filter(r=>r.ID===user.ID):activeRows(localDb.users).filter(r=>r.ESTADO==='Activo')).map(r=>({ID:r.ID,NOMBRE:r.NOMBRE,CORREO:r.CORREO})),conductores:(user.ROL_ID==='ROL-CONDUCTOR'?activeRows(localDb.drivers).filter(r=>r.USUARIO_ID===user.ID):activeRows(localDb.drivers).filter(r=>r.ESTADO!=='Inactivo')).map(r=>({ID:r.ID,NOMBRE:r.NOMBRE||r.ID})),vehiculos:(user.ROL_ID==='ROL-CONDUCTOR'?activeRows(localDb.vehicles).filter(r=>equipos.some(e=>e.VEHICULO_ID===r.ID)):activeRows(localDb.vehicles).filter(r=>r.ESTADO!=='Inactivo')).map(r=>({ID:r.ID,PATENTE:r.PATENTE,NOMBRE:[r.MARCA,r.MODELO].filter(Boolean).join(' ')})),dispositivos:unique('DISPOSITIVO_ID'),redes:unique('TIPO_RED'),plataformas:unique('PLATAFORMA')},seguimiento:{USUARIO_ID:trackedUserId,USUARIO_NOMBRE:trackedAccount?.NOMBRE||trackedUserId,USUARIO_CORREO:trackedAccount?.CORREO||'',VISIBLE:Boolean(followed),DIRECCION:followed?.DIRECCION||'',DISPOSITIVO_ID:followed?.DISPOSITIVO_ID||'',FECHA_GPS:followed?.FECHA_GPS||'',RASTRO:trace},serverTime:iso(),intervaloActivoSegundos:Math.round((config.ANTIGUEDAD_CONEXION_ACTIVA_MILISEGUNDOS||90000)/1000)};
  }

  function localSaveCompany(payload){
    const user=requireLocalUser();
    if(user.ROL_ID!=='ROL-ADMIN')throw new Error('PERMISO_DENEGADO');
    const data={...(payload.data||{})},empresaAnterior=cleanRow({...((localPrimaryCompany())||{})});
    ['PUNTO_OPERACION_LATITUD','PUNTO_OPERACION_LONGITUD'].forEach(field=>{if(field in data&&data[field]!==''&&!Number.isFinite(Number(data[field])))throw new Error('COORDENADAS_INVALIDAS');if(field in data&&data[field]!=='')data[field]=Number(data[field]);});
    ['RADIO_INICIO_METROS','RADIO_FIN_METROS','PRECISION_GPS_MAXIMA_METROS'].forEach(field=>{if(!(field in data)||data[field]==='')return;const value=Math.round(Number(data[field]));if(!Number.isFinite(value)||value<10||value>5000)throw new Error('RADIO_OPERACION_INVALIDO');data[field]=value;});
    if('VALIDAR_UBICACION_OPERACION' in data)data.VALIDAR_UBICACION_OPERACION=String(data.VALIDAR_UBICACION_OPERACION)==='NO'?'NO':'SI';
    if('RETORNO_BASE_OBLIGATORIO' in data)data.RETORNO_BASE_OBLIGATORIO=String(data.RETORNO_BASE_OBLIGATORIO)==='NO'?'NO':'SI';
    const colorFields=['COLOR_PRINCIPAL','COLOR_SECUNDARIO','COLOR_ACENTO','COLOR_FONDO','COLOR_SUPERFICIE','COLOR_TEXTO','COLOR_TEXTO_SECUNDARIO','COLOR_BORDE','COLOR_MENU','COLOR_MENU_SECUNDARIO','COLOR_EXITO','COLOR_ADVERTENCIA','COLOR_PELIGRO','COLOR_FONDO_OSCURO','COLOR_SUPERFICIE_OSCURO','COLOR_TEXTO_OSCURO','COLOR_TEXTO_SECUNDARIO_OSCURO','COLOR_BORDE_OSCURO'];
    colorFields.forEach(field=>{if(field in data&&data[field]!==''&&!/^#[0-9A-F]{6}$/i.test(String(data[field])))throw new Error('COLOR_TEMA_INVALIDO');if(field in data)data[field]=String(data[field]).toUpperCase();});
    if('TEMA_PREDETERMINADO' in data&&!['Claro','Oscuro','Sistema'].includes(String(data.TEMA_PREDETERMINADO)))throw new Error('TEMA_PREDETERMINADO_INVALIDO');
    let row=localPrimaryCompany();
    if(!row){
      row={ID:id('EMP'),CREADO_EN:iso(),ELIMINADO:'NO'};
      localDb.companies.push(row);
    }
    if(payload.logotipoBase64){
      data.DIRECCION_LOGOTIPO=String(payload.logotipoBase64);
      data.NOMBRE_ARCHIVO_LOGOTIPO=String(payload.nombreLogotipo||'logotipo');
      data.TIPO_ARCHIVO_LOGOTIPO=String(payload.tipoLogotipo||'image/png');
    }
    if(payload.eliminarLogotipo==='SI'){
      data.DIRECCION_LOGOTIPO='';data.NOMBRE_ARCHIVO_LOGOTIPO='';data.TIPO_ARCHIVO_LOGOTIPO='';data.ID_ARCHIVO_LOGOTIPO='';
    }
    Object.assign(row,data,{ESTADO:data.ESTADO||row.ESTADO||'Activo',ACTUALIZADO_EN:iso()});
    audit(user,'ACTUALIZAR','EMPRESA',`Respaldo anterior: ${JSON.stringify(empresaAnterior)}. Datos posteriores: ${JSON.stringify(cleanRow(row))}`,row.ID);
    saveLocal();
    return {row:cleanRow(row),confirmado:true};
  }

  function localGetOperationalPoint(){
    const user=requireLocalUser();
    if(!user)throw new Error('AUTENTICACION_REQUERIDA');
    const row=localPrimaryCompany();
    try{
      const point=localOperationalBase();
      return{configurado:true,confirmado:true,row:cleanRow(row||{}),point};
    }catch(error){
      if(String(error?.message||error)==='PUNTO_OPERACION_NO_CONFIGURADO')return{configurado:false,confirmado:false,row:cleanRow(row||{}),point:null};
      throw error;
    }
  }

  function localSaveOperationalPoint(payload){
    const user=requireLocalUser();if(!['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'].includes(user.ROL_ID))throw new Error('PUNTO_OPERACION_ROL_NO_AUTORIZADO');
    const data={...(payload.data||payload)};data.VALIDAR_UBICACION_OPERACION='SI';data.RETORNO_BASE_OBLIGATORIO='SI';
    const lat=Number(data.PUNTO_OPERACION_LATITUD),lng=Number(data.PUNTO_OPERACION_LONGITUD);
    if(!Number.isFinite(lat)||lat<-90||lat>90||!Number.isFinite(lng)||lng<-180||lng>180)throw new Error('COORDENADAS_INVALIDAS');
    data.PUNTO_OPERACION_LATITUD=lat;data.PUNTO_OPERACION_LONGITUD=lng;
    ['RADIO_INICIO_METROS','RADIO_FIN_METROS','PRECISION_GPS_MAXIMA_METROS'].forEach(field=>{const value=Math.round(Number(data[field]||({RADIO_INICIO_METROS:150,RADIO_FIN_METROS:150,PRECISION_GPS_MAXIMA_METROS:120}[field])));if(!Number.isFinite(value)||value<10||value>5000)throw new Error('RADIO_OPERACION_INVALIDO');data[field]=value;});
    if(!String(data.PUNTO_OPERACION_NOMBRE||'').trim())data.PUNTO_OPERACION_NOMBRE='Base operacional';
    if(!String(data.PUNTO_OPERACION_DIRECCION||'').trim())data.PUNTO_OPERACION_DIRECCION=localPrimaryCompany()?.DIRECCION||data.PUNTO_OPERACION_NOMBRE;
    let row=localPrimaryCompany();if(!row){row={ID:id('EMP'),NOMBRE_FANTASIA:data.PUNTO_OPERACION_NOMBRE,RAZON_SOCIAL:data.PUNTO_OPERACION_NOMBRE,ESTADO:'Activo',CREADO_EN:iso(),ELIMINADO:'NO'};localDb.companies.push(row);}
    const previous={lat:row.PUNTO_OPERACION_LATITUD,lng:row.PUNTO_OPERACION_LONGITUD};const changedAt=iso(),ip=String(data.IP_PUBLICA||find('sessions',auth.sessionId)?.IP_PUBLICA||'');Object.assign(row,data,{PUNTO_OPERACION_MODIFICADO_POR:user.ID,PUNTO_OPERACION_MODIFICADO_ROL:user.ROL_ID,PUNTO_OPERACION_MODIFICADO_IP:ip,PUNTO_OPERACION_MODIFICADO_EN:changedAt,ACTUALIZADO_EN:changedAt,ESTADO:row.ESTADO||'Activo'});audit(user,'CONFIGURAR_PUNTO','CONFIGURACION',`Punto operacional actualizado de ${previous.lat||'sin latitud'},${previous.lng||'sin longitud'} a ${lat},${lng}`,row.ID);saveLocal();
    const point=localOperationalBase();return{row:cleanRow(row),point,confirmado:true};
  }

  function localImportHeader(value){return String(value||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');}
  function localImportText(value,max=300){return String(value??'').trim().replace(/\s+/g,' ').slice(0,max);}
  function localImportNumber(value){if(value===''||value==null)return null;const normalized=String(value).trim().replace(/\s/g,'').replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.');const result=Number(normalized);return Number.isFinite(result)?result:null;}
  function localImportDate(value){const raw=localImportText(value,40),match=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);if(!match)return'';const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]),date=new Date(Date.UTC(year,month-1,day));return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?`${match[1]}-${match[2]}-${match[3]}`:'';}
  function localImportCanonical(value,allowed){const key=localImportText(value,80).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();return allowed.find(item=>item.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()===key)||'';}
  function localImportRutKey(value){return String(value||'').toUpperCase().replace(/[^0-9K]/g,'');}
  function localImportRutValid(value){const key=localImportRutKey(value);if(!/^\d{6,8}[0-9K]$/.test(key))return false;let sum=0,multiplier=2;for(let i=key.length-2;i>=0;i--){sum+=Number(key[i])*multiplier;multiplier=multiplier===7?2:multiplier+1;}const result=11-(sum%11),expected=result===11?'0':result===10?'K':String(result);return expected===key.slice(-1);}
  function localImportRutFormat(value){const key=localImportRutKey(value);if(key.length<2)return'';const body=key.slice(0,-1),dv=key.slice(-1),groups=[];for(let end=body.length;end>0;end-=3)groups.unshift(body.slice(Math.max(0,end-3),end));return`${groups.join('.')}-${dv}`;}
  function localImportKey(resource,row){if(resource==='vehicles')return `PATENTE:${String(row.PATENTE||'').replace(/[^A-Z0-9]/gi,'').toUpperCase()}`;if(resource==='drivers')return `RUT:${localImportRutKey(row.RUT)}`;return ['DOC',row.TIPO,row.ASOCIADO_TIPO,row.IDENTIFICACION,row.FECHA_VENCIMIENTO].map(value=>String(value||'').trim().toUpperCase()).join(':');}
  function localBulkImport(payload){
    const user=requireLocalUser(),resource=String(payload.resource||payload.recurso||''),key=resourceMap[resource],data=payload.data||payload,rows=Array.isArray(data.rows)?data.rows:Array.isArray(data.filas)?data.filas:[];
    if(!['vehicles','drivers','documents'].includes(resource)||!key)throw new Error('RECURSO_IMPORTACION_NO_PERMITIDO');
    if(!['ROL-ADMIN','ROL-GERENCIA','ROL-SUPERVISOR'].includes(String(user.ROL_ID||'').toUpperCase()))throw new Error('PERMISO_DENEGADO');
    requireLocalPermission(user,moduleByResource[key],'IMPORTAR');
    const update=String(data.actualizarExistentes??'SI').toUpperCase()!=='NO';
    if(!rows.length)throw new Error('IMPORTACION_SIN_FILAS');if(rows.length>1500)throw new Error('IMPORTACION_DEMASIADAS_FILAS');
    const errors=[],seen=new Set(),indexMap=new Map(activeRows(localDb[key]).map(row=>[localImportKey(resource,row),row]));let created=0,updated=0,skipped=0;
    const vehicleStates=['Disponible','En ruta','En mantención','Fuera de servicio'],fuels=['Diésel','Gasolina','Eléctrico','Híbrido','GLP','Otro'],driverStates=['Disponible','En viaje','Inactivo','Suspendido'],licenses=['A1','A2','A3','A4','A5','B','C','D','E','F'];
    rows.forEach((raw,i)=>{const line=Number(raw?.__FILA_ORIGEN||raw?._FILA_ORIGEN||i+2);try{
      const source={};Object.entries(raw||{}).forEach(([field,value])=>{const normalized=localImportHeader(field);if(normalized)source[normalized]=value;});
      const now=iso();let row={};
      if(resource==='vehicles'){
        const patent=String(source.PATENTE||'').replace(/[^A-Z0-9]/gi,'').toUpperCase(),brand=localImportText(source.MARCA,100),model=localImportText(source.MODELO,100);
        if(!patent)throw new Error('CAMPO_REQUERIDO_PATENTE');if(!brand)throw new Error('CAMPO_REQUERIDO_MARCA');if(!model)throw new Error('CAMPO_REQUERIDO_MODELO');if(!/^[A-Z0-9]{4,15}$/.test(patent))throw new Error('PATENTE_INVALIDA');
        row={PATENTE:patent,MARCA:brand,MODELO:model};
        if(source.ANIO!==''&&source.ANIO!=null){const year=localImportNumber(source.ANIO);if(year===null||!Number.isInteger(year)||year<1950||year>new Date().getFullYear()+2)throw new Error('ANIO_VEHICULO_INVALIDO');row.ANIO=year;}
        if(source.KILOMETRAJE!==''&&source.KILOMETRAJE!=null){const km=localImportNumber(source.KILOMETRAJE);if(km===null||km<0)throw new Error('KILOMETRAJE_VEHICULO_INVALIDO');row.KILOMETRAJE=km;}
        if(source.COMBUSTIBLE!==''&&source.COMBUSTIBLE!=null){const value=localImportCanonical(source.COMBUSTIBLE,fuels);if(!value)throw new Error('COMBUSTIBLE_INVALIDO');row.COMBUSTIBLE=value;}
        if(source.ESTADO!==''&&source.ESTADO!=null){const value=localImportCanonical(source.ESTADO,vehicleStates);if(!value)throw new Error('ESTADO_VEHICULO_INVALIDO');row.ESTADO=value;}
        if(source.PROXIMA_MANTENCION!==''&&source.PROXIMA_MANTENCION!=null){const value=localImportDate(source.PROXIMA_MANTENCION);if(!value)throw new Error('FECHA_MANTENCION_INVALIDA');row.PROXIMA_MANTENCION=value;}
        const color=localImportText(source.COLOR,60),vin=localImportText(source.VIN,50).toUpperCase(),qr=localImportText(source.QR_CODIGO,100);if(color)row.COLOR=color;if(vin)row.VIN=vin;if(qr)row.QR_CODIGO=qr;
      }else if(resource==='drivers'){
        const name=localImportText(source.NOMBRE,160),rutRaw=source.RUT;if(!name)throw new Error('CAMPO_REQUERIDO_NOMBRE');if(!localImportRutKey(rutRaw))throw new Error('CAMPO_REQUERIDO_RUT');if(!localImportRutValid(rutRaw))throw new Error('RUT_INVALIDO');
        row={NOMBRE:name,RUT:localImportRutFormat(rutRaw)};const email=localImportText(source.CORREO,200).toLowerCase(),phone=localImportText(source.TELEFONO,50),userId=localImportText(source.USUARIO_ID,100);if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('CORREO_INVALIDO');if(email)row.CORREO=email;if(phone)row.TELEFONO=phone;
        if(source.LICENCIA_CLASE!==''&&source.LICENCIA_CLASE!=null){const value=localImportCanonical(source.LICENCIA_CLASE,licenses);if(!value)throw new Error('LICENCIA_CLASE_INVALIDA');row.LICENCIA_CLASE=value;}
        if(source.LICENCIA_VENCIMIENTO!==''&&source.LICENCIA_VENCIMIENTO!=null){const value=localImportDate(source.LICENCIA_VENCIMIENTO);if(!value)throw new Error('LICENCIA_VENCIMIENTO_INVALIDA');row.LICENCIA_VENCIMIENTO=value;}
        if(source.ESTADO!==''&&source.ESTADO!=null){const value=localImportCanonical(source.ESTADO,driverStates);if(!value)throw new Error('ESTADO_CONDUCTOR_INVALIDO');row.ESTADO=value;}
        if(userId){if(!activeRows(localDb.users).some(item=>item.ID===userId&&item.ESTADO==='Activo'))throw new Error('USUARIO_ID_NO_EXISTE');const assigned=activeRows(localDb.drivers).find(driver=>driver.USUARIO_ID===userId&&localImportKey('drivers',driver)!==localImportKey('drivers',row));if(assigned)throw new Error('USUARIO_YA_ASOCIADO_A_OTRO_CONDUCTOR');row.USUARIO_ID=userId;}
      }else{
        row={...source};['TIPO','ASOCIADO_TIPO','IDENTIFICACION','FECHA_VENCIMIENTO'].forEach(field=>{if(!localImportText(row[field],500))throw new Error(`CAMPO_REQUERIDO_${field}`);});row.ASOCIADO_TIPO=localImportText(row.ASOCIADO_TIPO,80);row.IDENTIFICACION=localImportText(row.IDENTIFICACION,160).toUpperCase();row.ESTADO=localImportText(row.ESTADO,80)||'Vigente';if(!row.ASOCIADO_ID){if(row.ASOCIADO_TIPO==='Vehículo')row.ASOCIADO_ID=activeRows(localDb.vehicles).find(item=>String(item.PATENTE||'').replace(/[^A-Z0-9]/gi,'').toUpperCase()===row.IDENTIFICACION.replace(/[^A-Z0-9]/gi,''))?.ID||'';else if(row.ASOCIADO_TIPO==='Conductor')row.ASOCIADO_ID=activeRows(localDb.drivers).find(item=>localImportRutKey(item.RUT)===localImportRutKey(row.IDENTIFICACION))?.ID||'';else row.ASOCIADO_ID=localPrimaryCompany()?.ID||'';}if(!row.ASOCIADO_ID)throw new Error('ASOCIADO_NO_ENCONTRADO');
      }
      const importKey=localImportKey(resource,row);if(!importKey||seen.has(importKey))throw new Error('DUPLICADA_EN_ARCHIVO');seen.add(importKey);const existing=indexMap.get(importKey);
      if(existing){if(!update){skipped++;return;}Object.assign(existing,row,{ACTUALIZADO_EN:now,ELIMINADO:'NO'});if(resource==='vehicles'&&!existing.QR_CODIGO)existing.QR_CODIGO=`VEH-${existing.PATENTE}`;updated++;}
      else{const prefixes={vehicles:'VEH',drivers:'CON',documents:'DOC'},createdRow={ID:id(prefixes[resource]),...row,CREADO_EN:now,ACTUALIZADO_EN:now,ELIMINADO:'NO'};if(resource==='vehicles'){createdRow.ESTADO=createdRow.ESTADO||'Disponible';createdRow.COMBUSTIBLE=createdRow.COMBUSTIBLE||'Otro';createdRow.KILOMETRAJE=createdRow.KILOMETRAJE??0;createdRow.QR_CODIGO=createdRow.QR_CODIGO||`VEH-${createdRow.PATENTE}`;}if(resource==='drivers')createdRow.ESTADO=createdRow.ESTADO||'Disponible';localDb[key].push(createdRow);indexMap.set(importKey,createdRow);created++;}
    }catch(error){errors.push({fila:Number.isFinite(line)?line:i+2,error:String(error.message||error)});}});
    audit(user,'IMPORTAR_MASIVO',moduleByResource[key],`Importación masiva: ${created} creados, ${updated} actualizados, ${skipped} omitidos, ${errors.length} errores`);saveLocal();return{resource,totalRecibidas:rows.length,procesadas:created+updated,creadas:created,creados:created,actualizadas:updated,actualizados:updated,omitidas:skipped,omitidos:skipped,errores:errors,correcto:errors.length===0};
  }
  function localRegisterConnectionIp(payload){const user=requireLocalUser(),data=payload.data||payload,ip=String(data.IP_PUBLICA||'').trim();if(!ip)return{registrada:false};const session=find('sessions',auth.sessionId),now=iso();if(session)Object.assign(session,{IP_PUBLICA:ip,IP_VERSION:ip.includes(':')?'IPv6':'IPv4',IP_CAPTURADA_EN:now,ULTIMO_USO:now});activeRows(localDb.connections).filter(row=>row.SESION_ID===auth.sessionId).forEach(row=>Object.assign(row,{IP_PUBLICA:ip,IP_VERSION:ip.includes(':')?'IPv6':'IPv4',IP_CAPTURADA_EN:now,ACTUALIZADO_EN:now}));audit(user,'REGISTRAR_IP','SEGURIDAD','Dirección IP pública registrada al conectar',auth.sessionId);saveLocal();return{registrada:true,ipVersion:ip.includes(':')?'IPv6':'IPv4',fecha:now};}
  function localDiagnoseSystem(){
    const user=requireLocalUser();requireLocalPermission(user,'CONFIGURACION','LEER');
    const company=localPrimaryCompany()||{};
    const lat=Number(company.PUNTO_OPERACION_LATITUD),lng=Number(company.PUNTO_OPERACION_LONGITUD);
    const pointOk=Number.isFinite(lat)&&Number.isFinite(lng)&&String(company.VALIDAR_UBICACION_OPERACION||'SI')!=='NO';
    const modules={
      structure:{nombre:'Estructura local',estado:'OK',detalle:'Todas las colecciones internas están disponibles.'},
      routes:{nombre:'Asignación de rutas',estado:activeRows(localDb.drivers).length?'OK':'REVISAR',detalle:`${activeRows(localDb.routes).length} rutas · ${activeRows(localDb.drivers).length} conductores · ${activeRows(localDb.vehicles).length} vehículos`},
      operations:{nombre:'Operaciones',estado:pointOk?'OK':'REVISAR',detalle:pointOk?`Punto base ${lat.toFixed(6)}, ${lng.toFixed(6)}`:'Falta configurar el punto operacional.'},
      gps:{nombre:'Mapa en tiempo real',estado:'OK',detalle:`${activeRows(localDb.gpsCurrent).length} posiciones actuales · ${activeRows(localDb.connections).length} conexiones`},
      notifications:{nombre:'Notificaciones',estado:'OK',detalle:`${activeRows(localDb.notifications).length} registros`},
      alerts:{nombre:'Alertas',estado:'OK',detalle:`${activeRows(localDb.alerts).length} registros`},
      history:{nombre:'Historiales',estado:'OK',detalle:`${activeRows(localDb.history).length} eventos operativos · ${activeRows(localDb.checkins).length} check-ins`}
    };
    return{version:'4.2.48',fecha:iso(),correcto:Object.values(modules).every(item=>item.estado==='OK'),modules};
  }
  function localRepairSystem(){
    const user=requireLocalUser();requireLocalPermission(user,'CONFIGURACION','ACTUALIZAR');
    const defaults=emptyState();Object.keys(defaults).forEach(key=>{if(!Array.isArray(localDb[key]))localDb[key]=[];});
    seedCatalogs();audit(user,'REPARAR_SISTEMA','CONFIGURACION','Estructura local, catálogos y permisos verificados');saveLocal();
    return{repaired:true,diagnostico:localDiagnoseSystem()};
  }

  function localOfficeAutomaticMode(){return localStorage.getItem('flotas_oficina_virtual_modo_auto_v1')==='SI';}
  function localDaysUntil(value){if(!value)return null;const date=new Date(value);if(Number.isNaN(date.getTime()))return null;return Math.ceil((date.getTime()-Date.now())/86400000);}
  function localOfficeTasks(user){
    const driver=localDriver(user),driverId=driver?.ID||'',email=String(user.CORREO||'').toLowerCase(),admin=user.ROL_ID==='ROL-ADMIN',tasks=[];
    const documents=activeRows(localDb.documents);
    documents.forEach(row=>{
      const direct=String(row.USUARIO_ASOCIADO_ID||'')===String(user.ID)||(driverId&&String(row.CONDUCTOR_ASOCIADO_ID||'')===driverId)||(driverId&&String(row.ASOCIADO_TIPO||'')==='Conductor'&&String(row.ASOCIADO_ID||'')===driverId)||(String(row.ASOCIADO_TIPO||'')==='Usuario'&&String(row.ASOCIADO_ID||'')===String(user.ID))||(email&&String(row.CORREO_ASOCIADO||'').toLowerCase()===email);
      if(!direct&&!admin)return;
      const days=localDaysUntil(row.FECHA_VENCIMIENTO),base={id:`DOC-${row.ID}`,tipo:'Documento',modulo:'DOCUMENTOS',registroId:row.ID};
      if(admin&&row.ESTADO==='Pendiente de revisión')tasks.push({...base,prioridad:'Alta',titulo:'Revisar documento pendiente',detalle:`${row.TIPO||'Documento'} ${row.IDENTIFICACION||row.ID} requiere revisión.`});
      else if(!String(row.DIRECCION_ARCHIVO||'').trim())tasks.push({...base,prioridad:'Alta',titulo:'Adjuntar archivo faltante',detalle:`${row.TIPO||'Documento'} no tiene un archivo cargado.`});
      else if(days!==null&&days<0)tasks.push({...base,prioridad:'Urgente',titulo:'Renovar documento vencido',detalle:`${row.TIPO||'Documento'} está vencido desde hace ${Math.abs(days)} día(s).`});
      else if(days!==null&&days<=30)tasks.push({...base,prioridad:days<=7?'Alta':'Normal',titulo:'Renovar documento próximo a vencer',detalle:`${row.TIPO||'Documento'} vence en ${days} día(s).`});
    });
    if(admin){
      const requiredTypes=[['SOAP',['soap']],['REVISION-TECNICA',['revision tecnica']],['PERMISO-CIRCULACION',['permiso de circulacion']]];
      activeRows(localDb.vehicles).filter(row=>row.ESTADO!=='Inactivo').forEach(vehicle=>requiredTypes.forEach(([key,labels])=>{
        const exists=documents.some(document=>{const clean=value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');const associated=(clean(document.ASOCIADO_TIPO)==='vehiculo'&&String(document.ASOCIADO_ID||'')===String(vehicle.ID))||clean(document.IDENTIFICACION).replace(/[^a-z0-9]/g,'')===clean(vehicle.PATENTE).replace(/[^a-z0-9]/g,'');return associated&&labels.some(label=>clean(document.TIPO).includes(label));});
        if(!exists)tasks.push({id:`FALTA-${key}-${vehicle.ID}`,tipo:'Documento',prioridad:'Alta',titulo:'Documento obligatorio faltante',detalle:`${vehicle.PATENTE||vehicle.ID} no tiene registrado ${key.replaceAll('-',' ').toLowerCase()}.`,modulo:'DOCUMENTOS',registroId:vehicle.ID});
      }));
      activeRows(localDb.drivers).filter(row=>row.ESTADO!=='Inactivo').forEach(conductor=>{
        const exists=documents.some(document=>{const clean=value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');const associated=String(document.CONDUCTOR_ASOCIADO_ID||'')===String(conductor.ID)||(String(document.ASOCIADO_TIPO||'')==='Conductor'&&String(document.ASOCIADO_ID||'')===String(conductor.ID))||clean(document.IDENTIFICACION).replace(/[^a-z0-9]/g,'')===clean(conductor.RUT).replace(/[^a-z0-9]/g,'');return associated&&clean(document.TIPO).includes('licencia');});
        if(!exists)tasks.push({id:`FALTA-LICENCIA-${conductor.ID}`,tipo:'Licencia',prioridad:'Alta',titulo:'Licencia de conducir no cargada',detalle:`${conductor.NOMBRE||conductor.ID} no tiene un documento de licencia asociado.`,modulo:'DOCUMENTOS',registroId:conductor.ID});
      });
    }
    if(driver){
      const hasLicenseDocument=documents.some(row=>(String(row.CONDUCTOR_ASOCIADO_ID||'')===driverId||(String(row.ASOCIADO_TIPO||'')==='Conductor'&&String(row.ASOCIADO_ID||'')===driverId))&&String(row.TIPO||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes('licencia'));
      if(!hasLicenseDocument){
        const days=localDaysUntil(driver.LICENCIA_VENCIMIENTO),expired=days!==null&&days<0;
        tasks.push({id:`FALTA-LICENCIA-${driver.ID}`,tipo:'Licencia',prioridad:expired?'Urgente':'Alta',titulo:expired?'Licencia vencida y documento no cargado':'Licencia de conducir no cargada',detalle:expired?`Tu licencia venció hace ${Math.abs(days)} día(s) y falta cargar el documento renovado.`:(!driver.LICENCIA_VENCIMIENTO?'Falta cargar tu licencia y registrar su fecha de vencimiento.':'Falta cargar el documento de tu licencia de conducir.'),modulo:'DOCUMENTOS',registroId:driver.ID});
      }
      activeRows(localDb.routes).filter(row=>row.CONDUCTOR_ID===driver.ID&&row.ESTADO==='Asignada').forEach(row=>{
        tasks.push({id:`RUTA-${row.ID}`,tipo:'Ruta',prioridad:'Normal',titulo:'Ruta asignada pendiente',detalle:`${row.NOMBRE||row.ID}: ${row.ORIGEN||'Origen'} → ${row.DESTINO||'Destino'}.`,modulo:'RUTAS',registroId:row.ID,rutaId:row.ID});
        if(!row.CHECKIN_ID)tasks.push({id:`CHECKIN-RUTA-${row.ID}`,tipo:'Check-in',prioridad:'Alta',titulo:'Realizar check-in vehicular',detalle:`Completa la revisión antes de iniciar ${row.NOMBRE||row.ID}.`,modulo:'CHECKIN',registroId:row.ID,rutaId:row.ID});
      });
    }
    const unique=new Set();return tasks.filter(task=>{if(unique.has(task.id))return false;unique.add(task.id);return true;}).slice(0,100);
  }
  function localSyncOfficeTasks(user,tasks){
    const driver=localDriver(user),active=new Set(),now=iso();let created=0,updated=0,closed=0;
    tasks.filter(task=>task.tipo!=='Ruta').forEach(task=>{
      const key=`OV-TAREA-${task.id}-${user.ID}`,message=`${task.detalle} Abre ${task.modulo} para resolverlo.`;
      active.add(key);
      let row=activeRows(localDb.notifications).find(item=>item.CLAVE_UNICA===key&&item.DESTINATARIO_USUARIO_ID===user.ID);
      if(!row){row={ID:id('NOT'),DESTINATARIO_USUARIO_ID:user.ID,DESTINATARIO_CONDUCTOR_ID:driver?.ID||'',TITULO:task.titulo,MENSAJE:message,TIPO:'NEXO IA',PRIORIDAD:task.prioridad,RUTA_ID:task.rutaId||'',CLAVE_UNICA:key,LEIDA:'NO',FECHA_ENVIO:now,CREADO_POR:'SISTEMA',CREADO_EN:now,ACTUALIZADO_EN:now,ELIMINADO:'NO'};localDb.notifications.push(row);created++;return;}
      const changed=row.TITULO!==task.titulo||row.MENSAJE!==message||row.PRIORIDAD!==task.prioridad;
      if(changed){Object.assign(row,{TITULO:task.titulo,MENSAJE:message,PRIORIDAD:task.prioridad,LEIDA:'NO',FECHA_LECTURA:'',LEIDA_POR:'',ACTUALIZADO_EN:now});updated++;}
    });
    activeRows(localDb.notifications).filter(row=>row.CREADO_POR==='SISTEMA'&&row.TIPO==='NEXO IA'&&row.DESTINATARIO_USUARIO_ID===user.ID&&!active.has(row.CLAVE_UNICA)&&row.LEIDA!=='SI').forEach(row=>{Object.assign(row,{LEIDA:'SI',FECHA_LECTURA:now,LEIDA_POR:'SISTEMA',ACTUALIZADO_EN:now});closed++;});
    return{creados:created,actualizados:updated,cerrados:closed};
  }
  function localOfficeQuickStatus(){
    const user=requireLocalUser();requireLocalPermission(user,'OFICINA_VIRTUAL','LEER');
    let last={};try{last=JSON.parse(localStorage.getItem('flotas_oficina_virtual_ultimo_resultado_v1')||'{}');}catch(_){last={};}
    return{nombre:'NEXO IA',version:'4.2.48',modoAutomatico:localOfficeAutomaticMode(),puedeConfigurar:user.ROL_ID==='ROL-ADMIN',estado:last.estado||'PENDIENTE',ultimaRevision:last.fecha||'',problemas:Number(last.problemas||0),reparaciones:Number(last.reparaciones||0),avisosCreados:Number(last.avisosCreados||0),pendientesEnCache:false,totalTareas:Number(last.totalTareas||0),tareasUrgentes:Number(last.tareasUrgentes||0)};
  }
  function localOfficeTasksResponse(){
    const user=requireLocalUser();requireLocalPermission(user,'OFICINA_VIRTUAL','LEER');
    const tasks=localOfficeTasks(user);return{tareas:tasks,totalTareas:tasks.length,tareasUrgentes:tasks.filter(item=>item.prioridad==='Urgente').length,actualizadoEn:iso()};
  }
  function localOfficeStatus(){
    const user=requireLocalUser(),quick=localOfficeQuickStatus(),tasks=localOfficeTasks(user);
    return{...quick,tareas:tasks,totalTareas:tasks.length,tareasUrgentes:tasks.filter(item=>item.prioridad==='Urgente').length};
  }
  function localReportDriverOffice(user,question){
    if(user?.ROL_ID!=='ROL-CONDUCTOR')return null;
    const value=String(question||'').trim().slice(0,1200),text=value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const issue=/(falla|error|problema|no funciona|no puedo|se cae|lento|lentitud|trabado|bloqueado|riesgo|incidente)/.test(text);
    const instruction=/(cambia|cambiar|modifica|modificar|configura|configurar|activa|activar|desactiva|desactivar|repara|reparar|elimina|eliminar|instala|instalar|actualiza|actualizar).*(sistema|permiso|usuario|modo|configuracion|alerta|oficina)/.test(text);
    const explicitReview=/solicito una revision general del sistema/.test(text);if(!issue&&!instruction&&!explicitReview)return null;
    const day=new Date().toISOString().slice(0,10),key=`OV-REPORTE-${user.ID}-${day}-${text.replace(/[^a-z0-9]+/g,'-').slice(0,160)}`;
    let row=activeRows(localDb.alerts).find(item=>item.CLAVE_UNICA===key),created=false;
    if(!row){const now=iso();row={ID:id('ALT'),TIPO:'Reporte de conductor',NIVEL:issue?'Advertencia':'Info',TITULO:`NEXO IA: reporte de ${user.NOMBRE||user.ID}`,MENSAJE:`El Conductor informó: “${value}”. NEXO IA no ejecutó cambios. Un Administrador debe revisar y validar la situación.`,MODULO:'OFICINA_VIRTUAL',REGISTRO_ID:user.ID,CLAVE_UNICA:key,LEIDA:'NO',USUARIO_ID:'',FECHA_HORA:now,CREADO_EN:now,ACTUALIZADO_EN:now,ELIMINADO:'NO'};localDb.alerts.push(row);created=true;}
    return{creado:created,instruccion:instruction,alertaId:row.ID};
  }
  function localOfficeRun(){
    const user=requireLocalUser();requireLocalPermission(user,'OFICINA_VIRTUAL','LEER');
    if(user.ROL_ID==='ROL-CONDUCTOR'){const report=localReportDriverOffice(user,'Solicito una revisión general del sistema desde NEXO IA.');saveLocal();return{...localOfficeQuickStatus(),solicitudAdministrador:true,reporteCreado:Boolean(report?.creado),mensaje:'La solicitud quedó informada a los Administradores. No se ejecutó ningún cambio.'};}
    const tasks=localOfficeTasks(user),notices=localSyncOfficeTasks(user,tasks),diagnostic={fecha:iso(),estado:'CORRECTO',problemas:0,reparaciones:0,avisosCreados:notices.creados,tareas:tasks,totalTareas:tasks.length,tareasUrgentes:tasks.filter(item=>item.prioridad==='Urgente').length,modoAutomatico:localOfficeAutomaticMode()};
    localStorage.setItem('flotas_oficina_virtual_ultimo_resultado_v1',JSON.stringify(diagnostic));audit(user,'REVISION_AUTOMATICA','OFICINA_VIRTUAL',`Pendientes ${tasks.length} · avisos nuevos ${notices.creados}`);saveLocal();return diagnostic;
  }
  function localOfficeAutoMode(payload){
    const user=requireLocalUser();requireLocalPermission(user,'OFICINA_VIRTUAL','CONFIGURAR');if(user.ROL_ID!=='ROL-ADMIN')throw new Error('SOLO_ADMINISTRADOR');
    const data=payload.data||payload,active=data.ACTIVO===true||['SI','TRUE','1','ACTIVO'].includes(String(data.ACTIVO||data.activo||'').toUpperCase());
    localStorage.setItem('flotas_oficina_virtual_modo_auto_v1',active?'SI':'NO');audit(user,active?'ACTIVAR_MODO_AUTO':'DESACTIVAR_MODO_AUTO','OFICINA_VIRTUAL',`Modo automático ${active?'activado':'desactivado'}`);saveLocal();return{activo:active,modoAutomatico:active};
  }
  function localOfficeRepair(){
    const user=requireLocalUser();requireLocalPermission(user,'OFICINA_VIRTUAL','REPARAR');if(user.ROL_ID!=='ROL-ADMIN')throw new Error('SOLO_ADMINISTRADOR');
    const defaults=emptyState();Object.keys(defaults).forEach(key=>{if(!Array.isArray(localDb[key]))localDb[key]=[];});seedCatalogs();audit(user,'REPARAR_SEGURO','OFICINA_VIRTUAL','Estructura local y permisos verificados sin eliminar datos');saveLocal();return{reparacion:{aplicada:true},diagnostico:{estado:'CORRECTO',problemas:0,fecha:iso()}};
  }
  function localNexoText(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[.,;:!¡¿?\"'()_\/\-]+/g,' ').replace(/\s+/g,' ').trim();}
  function localNexoAssignedVehicle(user){const driver=localDriver(user);if(!driver)return null;const assignment=activeRows(localDb.checkinAssignments||[]).filter(row=>String(row.CONDUCTOR_ID)===String(driver.ID)&&['ASIGNADO','CHECKIN_PENDIENTE','CHECKIN_LISTO','RUTA_ASIGNADA'].includes(row.ESTADO)).sort((a,b)=>new Date(b.ACTUALIZADO_EN||b.FECHA_ASIGNACION||0)-new Date(a.ACTUALIZADO_EN||a.FECHA_ASIGNACION||0))[0],route=activeRows(localDb.routes).filter(row=>String(row.CONDUCTOR_ID)===String(driver.ID)&&['Asignada','En curso'].includes(row.ESTADO)).sort((a,b)=>new Date(b.ACTUALIZADO_EN||b.FECHA_INICIO||b.FECHA_ASIGNACION||0)-new Date(a.ACTUALIZADO_EN||a.FECHA_INICIO||a.FECHA_ASIGNACION||0))[0],operation=activeRows(localDb.operations).filter(row=>String(row.CONDUCTOR_ID)===String(driver.ID)&&['Activa','En curso'].includes(row.ESTADO)).sort((a,b)=>new Date(b.ACTUALIZADO_EN||b.FECHA_INICIO||0)-new Date(a.ACTUALIZADO_EN||a.FECHA_INICIO||0))[0],vehicleId=assignment?.VEHICULO_ID||route?.VEHICULO_ID||operation?.VEHICULO_ID||'';return vehicleId?find('vehicles',vehicleId):null;}
  function localNexoDocValid(row){if(['vencido','anulado','rechazado'].includes(localNexoText(row.ESTADO)))return false;if(localNexoText(row.ESTADO_REVISION).includes('rechaz'))return false;const expiry=row.FECHA_VENCIMIENTO?new Date(row.FECHA_VENCIMIENTO).getTime():0;return !expiry||Number.isNaN(expiry)||expiry>=Date.now();}
  function localNexoDocCard(row,user){const file=String(row.NOMBRE_ARCHIVO||row.ARCHIVO_NOMBRE||row.DIRECCION_ARCHIVO||row.ARCHIVO_RUTA||''),mime=String(row.TIPO_MIME||row.MIME_TYPE||''),format=mime.includes('pdf')||file.toLowerCase().endsWith('.pdf')?'PDF':mime.startsWith('image/')||/\.(png|jpe?g|webp|gif)$/i.test(file)?'IMAGEN':(file.split('.').pop()||'ARCHIVO').toUpperCase();return{...cleanRow(row),FORMATO:format,TIENE_ARCHIVO:Boolean(row.DIRECCION_ARCHIVO||(row.ARCHIVO_BUCKET&&row.ARCHIVO_RUTA)||row.ARCHIVO_URL),PUEDE_ABRIR:hasLocalPermission(user,'DOCUMENTOS','VER_ARCHIVO'),VIGENTE:localNexoDocValid(row)};}
  function localNexoDocuments(question,user){
    if(!hasLocalPermission(user,'DOCUMENTOS','LEER'))return{documentos:[],objetivo:'',entidadDetectada:false,descripcion:''};const text=localNexoText(question),driver=localDriver(user),assigned=localNexoAssignedVehicle(user);let docs=localFilterRows('documents',activeRows(localDb.documents),user),objective='',entity=false,description='';
    const wantsLicense=/licencia( de conducir)?/.test(text);const wantsAssignedVehicle=/vehiculo.*asignad|documento?s?.*(del|de mi).*vehiculo|muestra.*documento?s?.*vehiculo|trae.*documento?s?.*vehiculo|document.*mi vehiculo|mi vehiculo.*document/.test(text);if(wantsLicense){objective='LICENCIA_CONDUCIR';entity=true;docs=docs.filter(row=>{const driverMatch=driver&&(String(row.CONDUCTOR_ASOCIADO_ID||'')===String(driver.ID)||(localNexoText(row.ASOCIADO_TIPO).includes('conductor')&&String(row.ASOCIADO_ID||'')===String(driver.ID)));return driverMatch&&localNexoText(row.TIPO).includes('licencia');});description='licencia de conducir';}
    else if(wantsAssignedVehicle){objective='VEHICULO_ASIGNADO';entity=true;docs=assigned?docs.filter(row=>(localNexoText(row.ASOCIADO_TIPO).includes('vehiculo')&&String(row.ASOCIADO_ID||'')===String(assigned.ID))||String(row.VEHICULO_ASOCIADO_ID||'')===String(assigned.ID)||localNexoText(row.IDENTIFICACION).replace(/[^a-z0-9]/g,'')===localNexoText(assigned.PATENTE).replace(/[^a-z0-9]/g,'')):[];docs=docs.filter(localNexoDocValid);description=assigned?`vehículo asignado ${assigned.PATENTE||assigned.ID}`:'vehículo asignado';}
    else{
      const normPlate=value=>localNexoText(value).replace(/[^a-z0-9]/g,'');const vehicle=activeRows(localDb.vehicles).find(row=>{const plate=normPlate(row.PATENTE);return plate&&normPlate(question).includes(plate);});const words=new Set(text.split(/\s+/).filter(word=>word.length>=4)),driverMatches=activeRows(localDb.drivers).filter(row=>{const name=localNexoText(row.NOMBRE),tokens=name.split(/\s+/).filter(word=>word.length>=4);return (name.length>=3&&text.includes(name))||tokens.some(word=>words.has(word));}),conductor=driverMatches.length===1?driverMatches[0]:null;
      if(!vehicle&&driverMatches.length>1){entity=true;objective='CONDUCTOR_AMBIGUO';description=`${driverMatches.length} conductores coincidentes`;docs=[];}
      else if(vehicle){entity=true;objective='VEHICULO';description=`vehículo ${vehicle.PATENTE||vehicle.ID}`;docs=docs.filter(row=>(localNexoText(row.ASOCIADO_TIPO).includes('vehiculo')&&String(row.ASOCIADO_ID||'')===String(vehicle.ID))||String(row.VEHICULO_ASOCIADO_ID||'')===String(vehicle.ID)||normPlate(row.IDENTIFICACION)===normPlate(vehicle.PATENTE)).filter(localNexoDocValid);}
      else if(conductor){entity=true;objective='CONDUCTOR';description=`conductor ${conductor.NOMBRE||conductor.ID}`;docs=docs.filter(row=>String(row.CONDUCTOR_ASOCIADO_ID||'')===String(conductor.ID)||(localNexoText(row.ASOCIADO_TIPO).includes('conductor')&&String(row.ASOCIADO_ID||'')===String(conductor.ID))||localNexoText(row.IDENTIFICACION).replace(/[^a-z0-9]/g,'')===localNexoText(conductor.RUT).replace(/[^a-z0-9]/g,''));}
    }
    return{documentos:docs.map(row=>localNexoDocCard(row,user)),objetivo:objective,entidadDetectada:entity,descripcion};
  }
  function localOfficeAsk(payload){
    const user=requireLocalUser();requireLocalPermission(user,'OFICINA_VIRTUAL','CREAR');const data=payload.data||payload,question=String(data.MENSAJE||data.mensaje||data.PREGUNTA||'').trim();if(!question)throw new Error('CONSULTA_REQUERIDA');
    const text=localNexoText(question),report=localReportDriverOffice(user,question),nombre=String(user.NOMBRE||'Usuario').split(' ')[0]||'Usuario',assigned=localNexoAssignedVehicle(user),asksAssigned=/(tengo.*vehiculo.*asignado|vehiculo.*asignado|cual.*mi vehiculo|que vehiculo tengo)/.test(text)&&!/(document|archivo)/.test(text);let response='',documents=[];
    if(asksAssigned){response=assigned?`${nombre}, sí tienes un vehículo asignado: ${[assigned.MARCA,assigned.MODELO].filter(Boolean).join(' ')||assigned.NOMBRE||'Vehículo'}. Patente: ${assigned.PATENTE||'sin patente registrada'}.`:`${nombre}, actualmente no tienes un vehículo asignado vigente.`;}
    else{
      const docResult=localNexoDocuments(question,user);if(docResult.entidadDetectada){documents=docResult.documentos.filter(doc=>doc.TIENE_ARCHIVO);if(documents.length)response=`${nombre}, encontré ${documents.length} documento(s) de ${docResult.descripcion||'la consulta'} con archivo digital dentro de tus permisos. Puedes abrirlos desde estas tarjetas.`;else if(docResult.objetivo==='CONDUCTOR_AMBIGUO')response=`${nombre}, encontré más de un conductor con ese nombre. Escribe nombre y apellido, RUT o una referencia más específica.`;else if(docResult.objetivo==='LICENCIA_CONDUCIR')response=`${nombre}, no posee documento cargado de su licencia de conducir.`;else if(docResult.objetivo==='VEHICULO_ASIGNADO')response=assigned?`${nombre}, el vehículo asignado ${assigned.PATENTE||assigned.ID} no posee documentos vigentes cargados con archivo digital dentro de tu alcance.`:`${nombre}, actualmente no tienes un vehículo asignado, por lo que no hay documentos vehiculares que mostrar.`;else response=`${nombre}, encontré la referencia solicitada, pero no posee documentos con archivo digital cargado dentro de tus permisos.`;}
      else if(report?.instruccion)response='Tu cuenta de Conductor no puede ordenar ni ejecutar cambios en el sistema. Registré tu solicitud como un reporte para los Administradores; NEXO IA solo sirve de puente y no modificó ninguna configuración.';
      else if(/pendiente|por hacer|tarea|falta|vencid|document/.test(text)){const tasks=localOfficeTasks(user);response=tasks.length?`Encontré ${tasks.length} pendiente(s):\n${tasks.slice(0,8).map((task,index)=>`${index+1}. ${task.titulo}: ${task.detalle}`).join('\n')}`:'No tienes tareas ni documentos pendientes detectados.';}
      else if(/alerta|notificacion/.test(text)){const notices=localPendingNotices();response=`${nombre}, tienes ${notices.unreadAlerts||0} alerta(s) y ${notices.unreadNotifications||0} notificación(es) pendiente(s).`;}
      else if(/gps|mapa|ubicacion|seguimiento/.test(text))response='El GPS actualiza la posición y el mapa. En Conexiones en línea selecciona un usuario con coordenadas válidas y activa “Seguir” para acompañar su recorrido.';
      else if(/check.?in|revision|inspeccion/.test(text))response='El Check-in vehicular abre la revisión del vehículo. Las fallas críticas bloquean el uso hasta una nueva inspección o revisión autorizada.';
      else if(/combust|carga|litro|boleta/.test(text))response='Combustible registra litros, precio, kilometraje, estación y comprobante. El QR del vehículo puede abrir el formulario ya asociado.';
      else if(/qr|codigo|escan/.test(text))response='El lector QR identifica el vehículo y abre el flujo asociado de Operaciones, Combustible o Check-in.';
      else if(/modo automatic|automatico|auto/.test(text))response='El modo automático revisa problemas y pendientes. Solo un Administrador puede cambiarlo, y las reparaciones seguras no eliminan datos.';
      else response='Soy NEXO IA. Puedo consultar tu vehículo asignado, licencia de conducir, documentos autorizados por patente o nombre de conductor, rutas, operaciones, GPS, alertas y pendientes.';
    }
    if(report&&!report.instruccion)response+='\n\nTu reporte quedó informado a los Administradores y permanecerá pendiente hasta que uno de ellos lo valide. No se ejecutó ningún cambio.';
    audit(user,'CONSULTAR_ASISTENTE','OFICINA_VIRTUAL',`Consulta atendida: ${question.slice(0,180)}`);saveLocal();return{nombre:'NEXO IA',respuesta:response,documentos:documents,sugerencias:['¿Tengo vehículo asignado?','Muéstrame mi licencia de conducir','Muestrame los Documento del Vehiculo','¿Qué alertas tengo?','¿Qué tengo pendiente?'],generadoEn:iso()};
  }

  async function localChangePassword(payload){const user=requireLocalUser();if(user.CONTRASENA_CIFRADA!==await digest(payload.contrasenaActual+':'+user.SAL_CONTRASENA))throw new Error('CONTRASENA_ACTUAL_INVALIDA');if(String(payload.nuevaContrasena??'').length===0)throw new Error('CONTRASENA_REQUERIDA');const salt=id('SALT');user.SAL_CONTRASENA=salt;user.CONTRASENA_CIFRADA=await digest(String(payload.nuevaContrasena)+':'+salt);user.ACTUALIZADO_EN=iso();saveLocal();return{changed:true};}
  function localClear(payload){const user=requireLocalUser();if(user.ROL_ID!=='ROL-ADMIN')throw new Error('PERMISO_DENEGADO');if(payload.confirmacion!=='LIMPIAR DATOS')throw new Error('CONFIRMACION_REQUERIDA');['vehicles','drivers','operations','gps','gpsCurrent','history','maintenance','documents','alerts','reports','audit','qr','routes','notifications','connections','checkins','fuel','fuelAuthorizations'].forEach(key=>localDb[key]=[]);audit(user,'LIMPIAR','CONFIGURACION','Datos operativos eliminados; empresa y usuarios conservados');saveLocal();return{cleared:true};}

  window.ConexionFlotas = {
    request,
    requestBatch,
    prefetch,
    invalidate: invalidarCache,
    isRemote,
    backendLabel,
    authErrorCode,
    isAuthError,
    getAuth: () => ({ ...auth }),
    setAuth,
    getClientIp,
    registerConnectionIp,
    directorioEmpresasConfigurado,
    conexionEmpresaRequerida: () => config.DIRECTORIO_EMPRESAS_OBLIGATORIO !== false,
    getEmpresaConexion: obtenerConexionEmpresa,
    resolverConexionEmpresa,
    validarEmpresaActivaParaAcceso,
    sincronizarConexionEmpresa,
    sincronizarConfiguracionConexionServidor,
    getConfiguracionConexionesLocal: obtenerConfiguracionConexionesLocal,
    aplicarConfiguracionConexionCliente,
    guardarDirectorioConexionLocal,
    restaurarDirectorioPredeterminado,
    borrarConexionEmpresa,
    cacheInfo: informacionCache,
    latestCacheUpdate: ultimaActualizacionCache,
    persistCache: persistirCacheAhora,
    reloadLocal: () => { localDb = loadLocal(); },
  };
  })();
