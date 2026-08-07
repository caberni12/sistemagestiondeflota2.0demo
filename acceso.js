(function(){
  'use strict';
  const $=(selector,root=document)=>root.querySelector(selector);
  const api=window.ConexionFlotas;
  const loginForm=$('#formularioAcceso');
  const setupForm=$('#formularioPreconfiguracion');
  const loginButton=$('#botonAcceso');
  const setupButton=$('#botonPreconfiguracion');
  const estado=$('#estadoConexion');
  const mensaje=$('#mensajeFormulario');
  const mensajeSetup=$('#mensajePreconfiguracion');

  const errores={
    CREDENCIALES_INVALIDAS:'Correo o contraseña incorrectos.',
    AUTENTICACION_REQUERIDA:'Debe iniciar sesión para continuar.',
    SESION_INVALIDA:'La sesión dejó de ser válida. Ingrese nuevamente.',
    SESION_EXPIRADA:'La sesión expiró. Ingrese nuevamente.',
    USUARIO_DESHABILITADO:'El usuario fue deshabilitado.',
    DIRECCION_APLICACION_NO_CONFIGURADA:'Configure la dirección /exec en configuracion.js.',
    TIEMPO_DE_ESPERA_AGOTADO:'El servicio tardó demasiado en responder.',
    SISTEMA_NO_INICIALIZADO:'El sistema requiere la preconfiguración inicial.',
    SISTEMA_YA_INICIALIZADO:'La preconfiguración ya fue completada por otro usuario.',
    CONTRASENAS_NO_COINCIDEN:'Las contraseñas no coinciden.',
    CONTRASENA_REQUERIDA:'Ingrese una contraseña.',
    ULTIMO_ADMINISTRADOR_PROTEGIDO:'Debe existir al menos un administrador activo.'
  };
  function textoError(error){const clave=api.authErrorCode?.(error)||String(error?.message||error||'ERROR');return errores[clave]||clave.replaceAll('_',' ').toLowerCase().replace(/^./,letra=>letra.toUpperCase());}
  function mostrarMensaje(texto,tipo='error',destino=mensaje){destino.textContent=texto;destino.className=`mensaje-formulario ${tipo==='exito'?'exito':''}`;}
  function ocultarMensaje(destino=mensaje){destino.className='mensaje-formulario oculto';destino.textContent='';}
  function cambiarEstado(texto,tipo=''){estado.className=`estado-conexion ${tipo}`;$('span',estado).textContent=texto;}
  function bloquear(boton,activo,texto,normal){boton.disabled=activo;boton.textContent=activo?texto:normal;}
  function aplicarEmpresa(empresa){if(!empresa)return;window.TemaFlotas?.aplicarEmpresa?.(empresa,{guardar:true});const nombre=empresa.NOMBRE_FANTASIA||empresa.RAZON_SOCIAL||empresa.NOMBRE||'';const logo=empresa.DIRECCION_LOGOTIPO||'';if(nombre)$('#nombreEmpresaAcceso').textContent=nombre;if(logo)$('#logoEmpresaAcceso').src=logo;}
  function entrar(){location.replace('main.html');}
  function mostrarPreconfiguracion(){loginForm.classList.add('oculto');setupForm.classList.remove('oculto');cambiarEstado('Preconfiguración requerida','preconfig');$('#detalleServicio').textContent='Sin usuarios registrados';setTimeout(()=>setupForm.elements.nombreEmpresa?.focus(),80);}
  function mostrarAcceso(){setupForm.classList.add('oculto');loginForm.classList.remove('oculto');}

  async function comprobar({redirigir=true}={}){
    ocultarMensaje();ocultarMensaje(mensajeSetup);
    const auth=api.getAuth();
    if(redirigir&&auth.token&&auth.user){cambiarEstado('Sesión guardada','conectado');entrar();return true;}
    cambiarEstado(`Conectando con ${api.backendLabel()}…`);
    try{
      const meResult=auth.token?await api.request('me',{cache:false}).then(value=>({value})).catch(error=>({error})):null;
      const usuarioSesion=meResult?.value?.user||meResult?.value?.usuario;if(usuarioSesion){api.setAuth({...auth,user:usuarioSesion});if(redirigir){entrar();return true;}}
      else if(meResult?.error&&api.isAuthError?.(meResult.error))api.setAuth({});
      const status=await api.request('status',{cache:false});
      aplicarEmpresa(status.company);$('#detalleServicio').textContent=`${api.backendLabel()} disponible`;
      if(status.needsSetup){mostrarPreconfiguracion();return false;}
      mostrarAcceso();cambiarEstado('Servicio conectado','conectado');return true;
    }catch(error){cambiarEstado('Conexión temporalmente inestable','error');$('#detalleServicio').textContent=api.backendLabel();mostrarMensaje(api.isAuthError?.(error)?textoError(error):'No fue posible comprobar el servicio. Puede reintentar sin perder su sesión.');return false;}
  }

  setupForm.addEventListener('submit',async event=>{
    event.preventDefault();ocultarMensaje(mensajeSetup);if(!setupForm.reportValidity())return;
    const datos=Object.fromEntries(new FormData(setupForm).entries());
    if(datos.contrasena!==datos.contrasenaConfirmacion){mostrarMensaje('Las contraseñas no coinciden.','error',mensajeSetup);setupForm.elements.contrasenaConfirmacion.focus();return;}
    bloquear(setupButton,true,'Configurando…','Configurar y entrar');
    try{
      await api.request('bootstrap',datos);
      const ipPromise=api.getClientIp?.().catch(()=> '')||Promise.resolve('');const resultado=await api.request('login',{correo:datos.correo,contrasena:datos.contrasena});
      api.setAuth({token:resultado.token,sessionId:resultado.sessionId||'',user:resultado.user,expiresAt:resultado.expiresAt||''});
      ipPromise.then(IP_PUBLICA=>api.registerConnectionIp?.({IP_PUBLICA})).catch(()=>{});
      cambiarEstado('Sistema configurado','conectado');mostrarMensaje('Preconfiguración terminada. Abriendo el panel principal…','exito',mensajeSetup);entrar();
    }catch(error){mostrarMensaje(textoError(error),'error',mensajeSetup);if(String(error?.message||'')==='SISTEMA_YA_INICIALIZADO')setTimeout(()=>comprobar({redirigir:false}),800);}
    finally{bloquear(setupButton,false,'Configurando…','Configurar y entrar');}
  });

  loginForm.addEventListener('submit',async event=>{
    event.preventDefault();ocultarMensaje();if(!loginForm.reportValidity())return;bloquear(loginButton,true,'Ingresando…','Ingresar');
    try{const datos=Object.fromEntries(new FormData(loginForm).entries());const ipPromise=api.getClientIp?.().catch(()=> '')||Promise.resolve('');const resultado=await api.request('login',datos);api.setAuth({token:resultado.token,sessionId:resultado.sessionId||'',user:resultado.user,expiresAt:resultado.expiresAt||''});ipPromise.then(IP_PUBLICA=>api.registerConnectionIp?.({IP_PUBLICA})).catch(()=>{});cambiarEstado('Acceso correcto','conectado');mostrarMensaje('Sesión iniciada. Abriendo el panel principal…','exito');entrar();}
    catch(error){mostrarMensaje(textoError(error));cambiarEstado('Acceso no autorizado','error');$('#contrasenaAcceso').select();}
    finally{bloquear(loginButton,false,'Ingresando…','Ingresar');}
  });
  function ocultarTecladoMovil(){
    const activo=document.activeElement;
    if(activo&&/^(INPUT|TEXTAREA|SELECT)$/.test(activo.tagName))activo.blur();
  }
  function mantenerControlVisible(control){
    if(!control)return;
    setTimeout(()=>control.scrollIntoView({block:'center',behavior:'smooth'}),120);
  }
  document.addEventListener('pointerdown',event=>{
    if(!event.target.closest('input,textarea,select,button'))ocultarTecladoMovil();
  },{passive:true});
  loginForm.querySelectorAll('input').forEach(input=>input.addEventListener('focus',()=>{
    document.body.classList.add('teclado-movil-activo');
    mantenerControlVisible(input.id==='contrasenaAcceso'?loginButton:input);
  }));
  loginForm.addEventListener('focusout',()=>setTimeout(()=>{
    if(!loginForm.contains(document.activeElement))document.body.classList.remove('teclado-movil-activo');
  },100));
  if(window.visualViewport){
    const ajustarVista=()=>{
      const reducido=window.visualViewport.height<window.innerHeight*0.78;
      document.body.classList.toggle('teclado-movil-activo',reducido);
      document.documentElement.style.setProperty('--alto-visible-login',`${Math.round(window.visualViewport.height)}px`);
    };
    window.visualViewport.addEventListener('resize',ajustarVista);
    window.visualViewport.addEventListener('scroll',ajustarVista);
    ajustarVista();
  }
  $('#mostrarContrasena').addEventListener('click',()=>{const input=$('#contrasenaAcceso');input.type=input.type==='password'?'text':'password';$('#mostrarContrasena').setAttribute('aria-label',input.type==='password'?'Mostrar contraseña':'Ocultar contraseña');});
  $('#reintentarConexion').addEventListener('click',()=>comprobar({redirigir:false}));
  const parametros=new URLSearchParams(location.search),avisoSesion=parametros.get('sesion');
  comprobar().then(()=>{if(avisoSesion==='cerrada')mostrarMensaje('La sesión fue cerrada correctamente.','exito');if(avisoSesion==='expirada')mostrarMensaje('La sesión realmente expiró o fue invalidada. Ingrese nuevamente.');});
})();
