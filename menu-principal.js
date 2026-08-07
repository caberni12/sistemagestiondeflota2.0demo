(function(){
  'use strict';
  const $=(selector,root=document)=>root.querySelector(selector);
  const api=window.ConexionFlotas;
  const VERSION='4.2.39';
  const grupos=[
    ['GENERAL',[
      ['dashboard','⌂','Panel principal','panel-principal.html','PANEL_PRINCIPAL'],
      ['office','◆','Oficina Virtual','oficina-virtual.html','OFICINA_VIRTUAL'],
      ['routes','➜','Rutas asignadas','rutas.html','RUTAS'],
      ['checkin','✓','Check-in vehicular','checkin-vehicular.html','CHECKIN'],
      ['operations','⇄','Operaciones','operaciones.html','OPERACIONES'],
      ['gps','⌖','Ubicación en tiempo real','ubicacion-tiempo-real.html','GPS'],
      ['notifications','🔔','Notificaciones','notificaciones.html','NOTIFICACIONES']
    ]],
    ['GESTIÓN',[
      ['vehicles','▣','Vehículos','vehiculos.html','VEHICULOS'],
      ['drivers','♙','Conductores','conductores.html','CONDUCTORES'],
      ['checkinApprovals','☑','Aprobar check-ins','checkin-aprobaciones.html','CHECKIN_APROBACIONES'],
      ['checkinHistory','▤','Historial de check-in','checkin-historial.html','CHECKIN'],
      ['maintenance','⚙','Mantenciones','mantenciones.html','MANTENCIONES'],
      ['fuel','⛽','Combustible','combustible.html','COMBUSTIBLE'],
      ['documents','▤','Documentos del conductor','documentos.html','DOCUMENTOS'],
      ['history','↻','Historial','historial.html','HISTORIAL'],
      ['alerts','!','Alertas','alertas.html','ALERTAS']
    ]],
    ['ADMINISTRACIÓN',[
      ['connections','◎','Conexiones en línea','conexiones-en-linea.html','CONEXIONES'],
      ['users','♚','Usuarios','usuarios.html','USUARIOS'],
      ['company','🏢','Empresa','empresa.html','CONFIGURACION'],
      ['reports','▥','Reportes','reportes.html','REPORTES'],
      ['audit','☷','Auditoría','auditoria.html','BITACORA'],
      ['settings','⚒','Configuración','configuracion.html','CONFIGURACION']
    ]]
  ];
  const modulos=new Map(grupos.flatMap(([,items])=>items.map(item=>[item[0],item])));
  const marco=$('#marcoModulo');
  let usuario=null;
  let panelInicializado=false;
  let validacionPendiente=null;
  let seccionActual=localStorage.getItem('flotas_modulo_actual_v1')||'dashboard';
  let oscuro=window.TemaFlotas?.modoOscuroInicial?.()??localStorage.getItem('flotas_tema')==='dark';
  let cerrandoSesion=false;
  let redireccionando=false;
  let marcoListo=false;
  let moduloIframeActual='';
  let secuenciaCambioModulo=0;
  let temporizadorAvisos=null;
  let avisosInicializados=false;
  let idsNotificacionesConocidas=new Set();
  let idsAlertasConocidas=new Set();
  let estadoAvisos={notifications:[],alerts:[]};
  let cargandoModoOficina=false;
  let consultaAvisosPendiente=null;
  let firmaAvisosRenderizada='';
  let consultaOficinaPendiente=null;
  let oficinaConsultadaEn=0;
  let oficinaUsuarioConsultado='';
  let temporizadorRevisionOficina=null;
  let revisionOficinaPendiente=false;

  function iniciales(nombre='Usuario'){
    return String(nombre).trim().split(/\s+/).slice(0,2).map(parte=>parte[0]||'').join('').toUpperCase()||'US';
  }
  function esperar(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
  function irAcceso(motivo='expirada'){
    if(redireccionando)return;
    redireccionando=true;
    try{marco.src='about:blank';}catch(_){ }
    location.replace(`index.html?sesion=${encodeURIComponent(motivo)}`);
  }
  function permitido(modulo){
    if(!usuario)return false;
    const permisos=Array.isArray(usuario.PERMISOS)?usuario.PERMISOS:[];
    const rol=String(usuario.ROL_ID||usuario.ROL_NOMBRE||'').trim().toUpperCase();
    const administrador=rol==='ROL-ADMIN'||rol==='ADMINISTRADOR';
    if(administrador)return true;
    if((modulo==='GPS'||modulo==='CONEXIONES')&&rol!=='ROL-SUPERVISOR')return false;
    return permisos.includes('*:*')||permisos.includes(`${modulo}:LEER`);
  }
  function construirMenu(){
    let html='';
    grupos.forEach(([grupo,items])=>{
      const visibles=items.filter(item=>permitido(item[4])&&(!item[5]||usuario.ROL_ID===item[5]));
      if(!visibles.length)return;
      html+=`<p class="etiqueta-menu">${grupo}</p>`+visibles.map(([id,icono,etiqueta])=>`<button class="boton-modulo ${id===seccionActual?'activo':''}" type="button" data-modulo="${id}"><i>${icono}</i><span>${etiqueta}</span></button>`).join('');
    });
    $('#navegacionModular').innerHTML=html;
    document.querySelectorAll('[data-modulo]').forEach(boton=>boton.addEventListener('click',()=>abrirModulo(boton.dataset.modulo)));
  }
  function cambiarEstado(texto,modo=''){
    const estado=$('#estadoModulo');
    estado.className=`estado-modular ${modo}`;
    $('span',estado).textContent=texto;
  }
  function abrirMenu(){
    $('#menuLateral').classList.add('abierto');
    $('#menuLateral').setAttribute('aria-hidden','false');
    $('#capaMenu').classList.add('abierta');
    document.body.classList.add('menu-abierto');
  }
  function cerrarMenu(){
    $('#menuLateral').classList.remove('abierto');
    $('#menuLateral').setAttribute('aria-hidden','true');
    $('#capaMenu').classList.remove('abierta');
    document.body.classList.remove('menu-abierto');
  }
  function abrirModulo(id,{forzar=false}={}){
    const modulo=modulos.get(id)||modulos.get('dashboard');
    if(!usuario||!permitido(modulo[4]))return;
    if((modulo[0]==='gps'||modulo[0]==='connections')&&window.AndroidConfig&&typeof window.AndroidConfig.abrirModuloNativo==='function'){
      try{window.AndroidConfig.abrirModuloNativo(modulo[0]);cerrarMenu();cambiarEstado('Módulo Android nativo abierto','listo');return;}
      catch(error){console.error('No fue posible abrir el módulo nativo',error);}
    }
    if(modulo[0]===seccionActual&&!forzar&&marcoListo){cerrarMenu();return;}
    seccionActual=modulo[0];
    localStorage.setItem('flotas_modulo_actual_v1',seccionActual);
    $('#tituloModulo').textContent=modulo[2];
    construirMenu();
    cerrarMenu();
    $('#cargandoModulo').classList.remove('oculto');
    cambiarEstado(marcoListo?'Cargando desde memoria local':'Abriendo módulo');
    const cambio=++secuenciaCambioModulo;

    if(marcoListo&&marco.contentWindow&&!forzar){
      enviar({tipo:'flotas:navegar',seccion:modulo[0]});
      // Conexiones en línea debe liberar el contenedor de inmediato. Los datos
      // se consultan dentro del módulo y no deben bloquear la navegación.
      if(modulo[0]==='connections'){
        setTimeout(()=>{
          if(cambio!==secuenciaCambioModulo||seccionActual!=='connections')return;
          $('#cargandoModulo').classList.add('oculto');
          cambiarEstado('Módulo abierto · consultando conexiones','listo');
          enviar({tipo:'flotas:modulo-visible',seccion:'connections'});
        },650);
      }
      setTimeout(()=>{
        if(cambio!==secuenciaCambioModulo||marcoListo===false)return;
        const titulo=$('#tituloModulo')?.textContent||'';
        if(titulo===modulo[2]&&!$('#cargandoModulo').classList.contains('oculto')){
          if(modulo[0]==='connections'){
            $('#cargandoModulo').classList.add('oculto');
            cambiarEstado('Módulo abierto · datos en segundo plano','listo');
            return;
          }
          marcoListo=false;
          moduloIframeActual=modulo[0];
          marco.src=`${modulo[3]}?v=${VERSION}&recuperar=${Date.now()}`;
        }
      },7000);
      return;
    }

    marcoListo=false;
    moduloIframeActual=modulo[0];
    const recarga=forzar?`&actualizar=${Date.now()}`:'';
    marco.src=`${modulo[3]}?v=${VERSION}${recarga}`;
  }

  function aplicarUsuario(nuevoUsuario){
    usuario=nuevoUsuario||null;
    if(!usuario)return;
    $('#nombreUsuarioMenu').textContent=usuario.NOMBRE||'Usuario';
    $('#rolUsuarioMenu').textContent=usuario.ROL_NOMBRE||usuario.ROL_ID||'Usuario';
    $('#avatarMenu').textContent=iniciales(usuario.NOMBRE);
    construirMenu();
    programarInterruptorOficinaVirtual();
    actualizarInterruptorAvisosEmergentes();
    programarRevisionAutomaticaOficina(1800);
  }
  function esAdministradorMenu(){const rol=String(usuario?.ROL_ID||usuario?.ROL_NOMBRE||'').trim().toUpperCase();return rol==='ROL-ADMIN'||rol==='ADMINISTRADOR';}
  function claveAvisosEmergentesMenu(){return `flotas_avisos_emergentes_admin_v1_${String(usuario?.ID||usuario?.USUARIO_ID||'sin_usuario')}`;}
  function avisosEmergentesActivosMenu(){
    if(!esAdministradorMenu())return true;
    try{return localStorage.getItem(claveAvisosEmergentesMenu())!=='NO';}
    catch(_){return true;}
  }
  function actualizarInterruptorAvisosEmergentes(){
    const contenedor=$('#avisosEmergentesMenu'),input=$('#interruptorAvisosEmergentes');
    if(!contenedor||!input||!usuario)return;
    contenedor.hidden=!esAdministradorMenu();
    if(!contenedor.hidden)input.checked=avisosEmergentesActivosMenu();
  }
  function cambiarAvisosEmergentes(){
    const input=$('#interruptorAvisosEmergentes');
    if(!input||!esAdministradorMenu())return;
    const activo=input.checked;
    try{localStorage.setItem(claveAvisosEmergentesMenu(),activo?'SI':'NO');}
    catch(_){input.checked=!activo;cambiarEstado('No se pudo guardar la preferencia','advertencia');return;}
    if(!activo)document.querySelectorAll('.toast-aviso-menu').forEach(nodo=>nodo.remove());
    cambiarEstado(activo?'Avisos emergentes activados':'Avisos emergentes silenciados · pendientes en el icono','listo');
    window.dispatchEvent(new CustomEvent('flotas:avisos-emergentes',{detail:{activo}}));
  }
  function programarInterruptorOficinaVirtual(){
    const contenedor=$('#modoAutoOficinaMenu'),input=$('#interruptorModoAutoOficina');
    if(!contenedor||!input||!usuario)return;
    contenedor.hidden=!esAdministradorMenu();
    if(contenedor.hidden)return;
    const ejecutar=()=>actualizarInterruptorOficinaVirtual();
    if('requestIdleCallback' in window)window.requestIdleCallback(ejecutar,{timeout:1200});
    else setTimeout(ejecutar,700);
  }
  async function actualizarInterruptorOficinaVirtual(){
    const contenedor=$('#modoAutoOficinaMenu'),input=$('#interruptorModoAutoOficina');
    if(!contenedor||!input||!usuario||!esAdministradorMenu())return;
    const usuarioId=String(usuario.ID||usuario.USUARIO_ID||'sin_usuario');
    if(oficinaUsuarioConsultado!==usuarioId){oficinaUsuarioConsultado=usuarioId;oficinaConsultadaEn=0;consultaOficinaPendiente=null;}
    if(Date.now()-oficinaConsultadaEn<60000)return;
    if(!consultaOficinaPendiente)consultaOficinaPendiente=api.request('officeQuickStatus');
    try{
      const result=await consultaOficinaPendiente;
      input.checked=Boolean(result.modoAutomatico);
      oficinaConsultadaEn=Date.now();
    }catch(_){input.checked=false;}
    finally{consultaOficinaPendiente=null;}
  }
  async function cambiarModoOficinaVirtual(){
    const input=$('#interruptorModoAutoOficina');if(!input||cargandoModoOficina||!esAdministradorMenu())return;
    cargandoModoOficina=true;input.disabled=true;const active=input.checked;
    try{
      await api.request('officeAutoMode',{data:{ACTIVO:active?'SI':'NO'}});
      oficinaConsultadaEn=Date.now();
      cambiarEstado(active?'Oficina Virtual automática':'Oficina Virtual manual','listo');
      if(seccionActual==='office')abrirModulo('office',{forzar:true});
    }catch(_){input.checked=!active;cambiarEstado('No se pudo cambiar Oficina Virtual','advertencia');}
    finally{input.disabled=false;cargandoModoOficina=false;}
  }
  function escapar(texto){return String(texto??'').replace(/[&<>'"]/g,caracter=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[caracter]));}
  function fechaAviso(item){const fecha=new Date(item.FECHA_ENVIO||item.FECHA_HORA||item.CREADO_EN||0);return Number.isNaN(fecha.getTime())?'Sin fecha':new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'short'}).format(fecha);}
  function puedeAvisos(modulo){if(!usuario)return false;const permisos=Array.isArray(usuario.PERMISOS)?usuario.PERMISOS:[];const rol=String(usuario.ROL_ID||usuario.ROL_NOMBRE||'').trim().toUpperCase();return rol==='ROL-ADMIN'||rol==='ADMINISTRADOR'||permisos.includes('*:*')||permisos.includes(`${modulo}:LEER`);}
  function fechaOrdenAviso(item){return new Date(item.FECHA_ENVIO||item.FECHA_HORA||item.CREADO_EN||0).getTime();}
  function mostrarToastAviso(item,tipo){if(!avisosEmergentesActivosMenu())return;const contenedor=$('#toastAvisosMenu'),nodo=document.createElement('article');nodo.className=`toast-aviso-menu ${tipo}`;nodo.innerHTML=`<i>${tipo==='alerta'?'!':'🔔'}</i><div><b>${escapar(tipo==='alerta'?'Nueva alerta':'Nueva notificación')}</b><small>${escapar(item.TITULO||item.MENSAJE||'Existe un nuevo aviso pendiente.')}</small></div><button type="button" aria-label="Cerrar">×</button>`;contenedor.append(nodo);nodo.querySelector('button').addEventListener('click',()=>nodo.remove());setTimeout(()=>nodo.remove(),5200);}
  function renderizarAvisos(){const notifications=estadoAvisos.notifications||[],alerts=estadoAvisos.alerts||[],mezclados=[...alerts.map(item=>({item,tipo:'alerta'})),...notifications.map(item=>({item,tipo:'notificacion'}))].sort((a,b)=>fechaOrdenAviso(b.item)-fechaOrdenAviso(a.item)).slice(0,14);$('#totalNotificacionesMenu').textContent=notifications.length;$('#totalAlertasMenu').textContent=alerts.length;$('#listaAvisosMenu').innerHTML=mezclados.length?mezclados.map(({item,tipo})=>`<article class="aviso-menu-item ${tipo}" data-modulo-aviso="${tipo==='alerta'?'alerts':'notifications'}"><i>${tipo==='alerta'?'!':'🔔'}</i><div><b>${escapar(item.TITULO|| (tipo==='alerta'?'Alerta':'Notificación'))}</b><span>${escapar(item.MENSAJE||'')}</span><small>${escapar(fechaAviso(item))}</small></div></article>`).join(''):'<p class="sin-avisos-menu">No existen avisos pendientes.</p>';document.querySelectorAll('[data-modulo-aviso]').forEach(item=>item.addEventListener('click',()=>{cerrarPanelAvisos();abrirModulo(item.dataset.moduloAviso);}));}
  function firmaColeccionAvisos(rows){return rows.map(item=>`${item.ID}:${item.ACTUALIZADO_EN||item.FECHA_LECTURA||item.FECHA_ENVIO||item.FECHA_HORA||''}`).join('|');}
  async function actualizarAvisos(){
    if(!usuario)return;
    if(consultaAvisosPendiente)return consultaAvisosPendiente;
    consultaAvisosPendiente=(async()=>{
      const consultas=[];
      if(puedeAvisos('NOTIFICACIONES'))consultas.push({key:'notifications',action:'list',payload:{resource:'notifications',cache:false}});
      if(puedeAvisos('ALERTAS'))consultas.push({key:'alerts',action:'list',payload:{resource:'alerts',cache:false}});
      const lote=consultas.length?await api.requestBatch(consultas,{force:true}):{};
      const notifications=(lote.notifications?.rows||[]).filter(item=>item.LEIDA!=='SI');
      const alerts=(lote.alerts?.rows||[]).filter(item=>item.LEIDA!=='SI');
      const nuevasNotificaciones=notifications.filter(item=>!idsNotificacionesConocidas.has(String(item.ID)));
      const nuevasAlertas=alerts.filter(item=>!idsAlertasConocidas.has(String(item.ID)));
      if(avisosInicializados){
        [...nuevasAlertas.map(item=>({item,tipo:'alerta'})),...nuevasNotificaciones.map(item=>({item,tipo:'notificacion'}))]
          .sort((a,b)=>fechaOrdenAviso(a.item)-fechaOrdenAviso(b.item)).slice(-3)
          .forEach(({item,tipo})=>mostrarToastAviso(item,tipo));
      }
      idsNotificacionesConocidas=new Set(notifications.map(item=>String(item.ID)));
      idsAlertasConocidas=new Set(alerts.map(item=>String(item.ID)));
      estadoAvisos={notifications,alerts};
      avisosInicializados=true;
      const firma=`N:${firmaColeccionAvisos(notifications)}|A:${firmaColeccionAvisos(alerts)}`;
      if(firma===firmaAvisosRenderizada)return;
      firmaAvisosRenderizada=firma;
      const total=notifications.length+alerts.length,contador=$('#contadorAvisosMenu');
      contador.textContent=total>99?'99+':String(total);
      contador.hidden=total===0;
      $('#notificacionesMenu').setAttribute('aria-label',total?`Abrir ${total} avisos pendientes`:'Abrir centro de notificaciones');
      renderizarAvisos();
    })().catch(()=>{}).finally(()=>{consultaAvisosPendiente=null;});
    return consultaAvisosPendiente;
  }
  function programarAvisos(retraso){
    if(temporizadorAvisos)clearTimeout(temporizadorAvisos);
    temporizadorAvisos=setTimeout(async()=>{
      temporizadorAvisos=null;
      await actualizarAvisos();
      if(!cerrandoSesion&&usuario)programarAvisos(document.hidden?30000:(window.CONFIGURACION_FLOTAS.INTERVALO_NOTIFICACIONES_MILISEGUNDOS||10000));
    },Math.max(100,Number(retraso||0)));
  }
  function iniciarAvisos(){if(temporizadorAvisos||consultaAvisosPendiente)return;programarAvisos(900);}
  function programarRevisionAutomaticaOficina(retraso){
    if(temporizadorRevisionOficina)clearTimeout(temporizadorRevisionOficina);
    if(!usuario||!esAdministradorMenu()||cerrandoSesion)return;
    temporizadorRevisionOficina=setTimeout(async()=>{
      temporizadorRevisionOficina=null;
      if(revisionOficinaPendiente||document.hidden){programarRevisionAutomaticaOficina(60000);return;}
      revisionOficinaPendiente=true;
      try{const status=await api.request('officeQuickStatus',{cache:false});if(status.modoAutomatico){await api.request('officeRun',{data:{ORIGEN:'MENU_AUTOMATICO'}});actualizarAvisos();}}
      catch(_){ }
      finally{revisionOficinaPendiente=false;programarRevisionAutomaticaOficina(window.CONFIGURACION_FLOTAS.INTERVALO_OFICINA_VIRTUAL_MILISEGUNDOS||300000);}
    },Math.max(500,Number(retraso||0)));
  }
  function abrirPanelAvisos(){$('#panelAvisosMenu').classList.add('abierto');$('#panelAvisosMenu').setAttribute('aria-hidden','false');actualizarAvisos();}
  function cerrarPanelAvisos(){$('#panelAvisosMenu').classList.remove('abierto');$('#panelAvisosMenu').setAttribute('aria-hidden','true');}
  function alternarPanelAvisos(){if($('#panelAvisosMenu').classList.contains('abierto'))cerrarPanelAvisos();else abrirPanelAvisos();}
  function iniciarPanel(nuevoUsuario){
    aplicarUsuario(nuevoUsuario);
    document.body.classList.remove('verificando-sesion');
    $('#verificadorSesion').classList.add('oculto');
    aplicarTema();
    if(panelInicializado)return;
    panelInicializado=true;
    const modulo=modulos.get(seccionActual);
    if(!modulo||!permitido(modulo[4]))seccionActual='dashboard';
    abrirModulo(seccionActual,{forzar:true});
    iniciarAvisos();
  }
  function enviar(mensaje){
    try{marco.contentWindow?.postMessage(mensaje,'*');}catch(_){ }
  }
  function enviarAutenticacionModulo(){
    const auth=api?.getAuth?.()||{};
    if(!auth.token||!auth.user)return false;
    enviar({tipo:'flotas:autenticacion',auth:{token:auth.token,sessionId:auth.sessionId||'',user:auth.user,expiresAt:auth.expiresAt||''}});
    return true;
  }
  function confirmarModuloVisiblePorContenido(){
    if(marcoListo)return true;
    try{
      const shell=marco.contentDocument?.querySelector('#appShell');
      const content=marco.contentDocument?.querySelector('#content');
      if(shell&&!shell.classList.contains('hidden')&&content){
        marcoListo=true;
        $('#cargandoModulo').classList.add('oculto');
        cambiarEstado('Módulo activo','listo');
        return true;
      }
    }catch(_){ }
    return false;
  }
  function aplicarTema(){
    window.TemaFlotas?.aplicarGuardado?.();
    document.body.classList.toggle('oscuro',oscuro);
    $('#cambiarTemaMenu').textContent=oscuro?'☀':'☾';
    enviar({tipo:'flotas:tema',oscuro});
  }
  async function cerrarSesion(){
    if(cerrandoSesion)return;
    cerrandoSesion=true;
    if(temporizadorAvisos)clearInterval(temporizadorAvisos);
    if(temporizadorRevisionOficina)clearTimeout(temporizadorRevisionOficina);
    const boton=$('#cerrarSesionMenu');
    boton.disabled=true;
    boton.textContent='Cerrando sesión…';
    const cierre=api.request('logout',{data:{}}).catch(()=>{});
    api.setAuth({});
    irAcceso('cerrada');
    void cierre;
  }
  async function confirmarInvalidezSesion(){
    await esperar(800);
    try{
      const resultado=await api.request('me',{cache:false});
      const usuarioSesion=resultado?.user||resultado?.usuario;
      if(usuarioSesion){
        const auth=api.getAuth();
        api.setAuth({...auth,user:usuarioSesion});
        iniciarPanel(usuarioSesion);
        cambiarEstado('Sesión activa','listo');
        return false;
      }
      return true;
    }catch(error){
      if(api.isAuthError?.(error))return true;
      cambiarEstado('Conexión inestable · sesión conservada','advertencia');
      return false;
    }
  }
  async function validarSesion({desdeModulo=false}={}){
    if(validacionPendiente)return validacionPendiente;
    validacionPendiente=(async()=>{
      const auth=api?.getAuth?.()||{};
      if(!auth.token){irAcceso('expirada');return false;}

      // Se muestra el panel inmediatamente con el usuario guardado.
      // Una caída temporal del servicio nunca devuelve al login.
      if(auth.user)iniciarPanel(auth.user);
      if(desdeModulo)cambiarEstado('Comprobando sesión');

      try{
        if(auth.user&&!desdeModulo)await esperar(350);
        const resultado=await api.request('me',{cache:false});
        const usuarioSesion=resultado?.user||resultado?.usuario;
        if(!usuarioSesion)throw new Error('SESION_INVALIDA');
        api.setAuth({...auth,user:usuarioSesion});
        iniciarPanel(usuarioSesion);
        cambiarEstado('Módulo activo','listo');
        return true;
      }catch(error){
        if(api.isAuthError?.(error)){
          const invalida=await confirmarInvalidezSesion();
          if(invalida){api.setAuth({});irAcceso('expirada');return false;}
          return true;
        }
        if(auth.user){
          iniciarPanel(auth.user);
          cambiarEstado('Conexión lenta · sesión conservada','advertencia');
          return true;
        }
        cambiarEstado('No fue posible validar · reintentando','advertencia');
        setTimeout(()=>validarSesion(),5000);
        return false;
      }
    })().finally(()=>{validacionPendiente=null;});
    return validacionPendiente;
  }

  window.addEventListener('message',event=>{
    if(event.origin!==location.origin&&event.origin!=='null')return;
    const data=event.data||{};
    if(data.tipo==='flotas:modulo-listo'){
      marcoListo=true;
      moduloIframeActual=data.seccion||seccionActual;
      if(data.usuario)aplicarUsuario(data.usuario);
      $('#cargandoModulo').classList.add('oculto');
      cambiarEstado(data.actualizadoEn?'Módulo activo · memoria local':'Módulo activo','listo');
      aplicarTema();
      requestAnimationFrame(()=>requestAnimationFrame(()=>enviar({tipo:'flotas:modulo-visible',seccion:seccionActual})));
    }
    if(data.tipo==='flotas:usuario-actualizado'&&data.usuario){
      aplicarUsuario(data.usuario);
      const moduloActual=modulos.get(seccionActual);
      if(!moduloActual||!permitido(moduloActual[4])){
        seccionActual='dashboard';
        localStorage.setItem('flotas_modulo_actual_v1',seccionActual);
        abrirModulo('dashboard',{forzar:true});
      }
    }
    if(data.tipo==='flotas:navegar'&&modulos.has(data.seccion))abrirModulo(data.seccion);
    if(data.tipo==='flotas:actualizar-avisos')actualizarAvisos();
    if(data.tipo==='flotas:sesion-cerrada'){api.setAuth({});irAcceso('cerrada');}
    if(data.tipo==='flotas:autenticacion-requerida'){
      if(enviarAutenticacionModulo())return;
      validarSesion({desdeModulo:true}).then(valida=>{if(valida)enviarAutenticacionModulo();});
    }
    if(data.tipo==='flotas:error-modulo')cambiarEstado(data.mensaje||'Error del módulo','error');
    if(data.tipo==='flotas:empresa'){
      if(data.nombre)$('#nombreEmpresaMenu').textContent=data.nombre;
      if(data.logo){
        const logo=String(data.logo).startsWith('../')?String(data.logo).slice(3):data.logo;
        $('#logoEmpresaMenu').src=logo;
      }
      if(data.tema)window.TemaFlotas?.aplicar?.(data.tema,{guardar:true});
    }
    if(data.tipo==='flotas:tema-colores'&&data.tema)window.TemaFlotas?.aplicar?.(data.tema,{guardar:false});
    if(data.tipo==='flotas:oficina-virtual-modo'){
      const input=$('#interruptorModoAutoOficina');
      if(input)input.checked=Boolean(data.activo);
    }
  });
  window.addEventListener('flotas:sesion-invalida',()=>validarSesion({desdeModulo:true}));
  marco.addEventListener('load',()=>{
    marcoListo=false;
    // Cuando la Web se abre directamente desde Windows (file://), cada HTML
    // puede tener un almacenamiento local distinto. El panel entrega la sesión
    // al módulo mediante postMessage para que el iframe no quede esperando.
    setTimeout(enviarAutenticacionModulo,30);
    setTimeout(enviarAutenticacionModulo,250);
    setTimeout(()=>{if(!marcoListo){enviarAutenticacionModulo();confirmarModuloVisiblePorContenido();}},900);
    setTimeout(()=>{
      if(marcoListo||confirmarModuloVisiblePorContenido())return;
      cambiarEstado('El módulo no confirmó la apertura · reintentando','advertencia');
      enviarAutenticacionModulo();
    },3500);
    if(seccionActual==='connections'){
      setTimeout(()=>{
        if(seccionActual!=='connections'||marcoListo)return;
        // Respaldo para WebView y navegadores que retrasan postMessage.
        marcoListo=true;
        $('#cargandoModulo').classList.add('oculto');
        cambiarEstado('Módulo abierto · consultando conexiones','listo');
        enviar({tipo:'flotas:modulo-visible',seccion:'connections'});
      },900);
    }
    setTimeout(()=>{if(!marcoListo&&seccionActual!=='connections')cambiarEstado('Preparando módulo…');},350);
  });
  marco.addEventListener('error',()=>cambiarEstado('No se pudo abrir el módulo','error'));
  $('#abrirMenu').addEventListener('click',abrirMenu);
  $('#cerrarMenu').addEventListener('click',cerrarMenu);
  $('#capaMenu').addEventListener('click',cerrarMenu);
  $('#interruptorModoAutoOficina').addEventListener('change',cambiarModoOficinaVirtual);
  $('#interruptorAvisosEmergentes').addEventListener('change',cambiarAvisosEmergentes);
  $('#cerrarSesionMenu').addEventListener('click',cerrarSesion);
  $('#notificacionesMenu').addEventListener('click',alternarPanelAvisos);
  $('#cerrarAvisosMenu').addEventListener('click',cerrarPanelAvisos);
  document.querySelectorAll('[data-abrir-avisos]').forEach(button=>button.addEventListener('click',()=>{cerrarPanelAvisos();abrirModulo(button.dataset.abrirAvisos);}));
  $('#cambiarTemaMenu').addEventListener('click',()=>{oscuro=!oscuro;localStorage.setItem('flotas_tema',oscuro?'dark':'light');aplicarTema();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){cerrarMenu();cerrarPanelAvisos();}});
  document.addEventListener('click',event=>{if(!$('#panelAvisosMenu').contains(event.target)&&!$('#notificacionesMenu').contains(event.target))cerrarPanelAvisos();});
  document.addEventListener('visibilitychange',()=>{if(usuario&&!cerrandoSesion)programarAvisos(document.hidden?30000:150);});
  window.addEventListener('storage',event=>{
    if(event.key===window.CONFIGURACION_FLOTAS.CLAVE_SESION_LOCAL&&!event.newValue)irAcceso('cerrada');
  });

  validarSesion();
})();
