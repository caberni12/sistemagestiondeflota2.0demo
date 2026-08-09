(function(){
  'use strict';
  const CLAVE='flotas_paleta_global_v1';
  /* Compatibilidad Web 4.2.50: fallbacks seguros para Safari/Firefox/Chromium. */
  if(!window.requestIdleCallback){window.requestIdleCallback=function(cb,opts){const inicio=Date.now();return setTimeout(function(){cb({didTimeout:false,timeRemaining:function(){return Math.max(0,50-(Date.now()-inicio));}});},Math.min(Number(opts&&opts.timeout)||1,50));};}
  if(!window.cancelIdleCallback){window.cancelIdleCallback=function(id){clearTimeout(id);};}
  if(!String.prototype.replaceAll){Object.defineProperty(String.prototype,'replaceAll',{configurable:true,writable:true,value:function(search,replacement){if(search instanceof RegExp){if(!search.global)throw new TypeError('replaceAll requiere una expresión regular global');return this.replace(search,replacement);}return this.split(String(search)).join(String(replacement));}});}

  const HEX=/^#[0-9A-F]{6}$/i;
  const CAMPOS=Object.freeze({
    principal:'COLOR_PRINCIPAL',secundario:'COLOR_SECUNDARIO',acento:'COLOR_ACENTO',
    fondo:'COLOR_FONDO',superficie:'COLOR_SUPERFICIE',texto:'COLOR_TEXTO',suave:'COLOR_TEXTO_SECUNDARIO',borde:'COLOR_BORDE',
    menu:'COLOR_MENU',menuSecundario:'COLOR_MENU_SECUNDARIO',exito:'COLOR_EXITO',advertencia:'COLOR_ADVERTENCIA',peligro:'COLOR_PELIGRO',
    fondoOscuro:'COLOR_FONDO_OSCURO',superficieOscura:'COLOR_SUPERFICIE_OSCURO',textoOscuro:'COLOR_TEXTO_OSCURO',suaveOscuro:'COLOR_TEXTO_SECUNDARIO_OSCURO',bordeOscuro:'COLOR_BORDE_OSCURO',
    modo:'TEMA_PREDETERMINADO'
  });
  const PREDETERMINADOS=Object.freeze({
    COLOR_PRINCIPAL:'#0E9F91',COLOR_SECUNDARIO:'#08746B',COLOR_ACENTO:'#3578E5',
    COLOR_FONDO:'#FFFFFF',COLOR_SUPERFICIE:'#FFFFFF',COLOR_TEXTO:'#111111',COLOR_TEXTO_SECUNDARIO:'#333333',COLOR_BORDE:'#D9DEE2',
    COLOR_MENU:'#071725',COLOR_MENU_SECUNDARIO:'#0D2638',COLOR_EXITO:'#0E9F91',COLOR_ADVERTENCIA:'#D89216',COLOR_PELIGRO:'#DC4D60',
    COLOR_FONDO_OSCURO:'#071725',COLOR_SUPERFICIE_OSCURO:'#0D2638',COLOR_TEXTO_OSCURO:'#E9F1F7',COLOR_TEXTO_SECUNDARIO_OSCURO:'#9EB0BF',COLOR_BORDE_OSCURO:'#214359',
    TEMA_PREDETERMINADO:'Sistema'
  });
  const PREAJUSTES=Object.freeze({
    verde:{nombre:'Verde profesional',valores:{...PREDETERMINADOS}},
    azul:{nombre:'Azul corporativo',valores:{...PREDETERMINADOS,COLOR_PRINCIPAL:'#2563EB',COLOR_SECUNDARIO:'#1D4ED8',COLOR_ACENTO:'#06B6D4',COLOR_MENU:'#0F172A',COLOR_MENU_SECUNDARIO:'#172554',COLOR_EXITO:'#059669'}},
    naranja:{nombre:'Naranja operativo',valores:{...PREDETERMINADOS,COLOR_PRINCIPAL:'#EA580C',COLOR_SECUNDARIO:'#C2410C',COLOR_ACENTO:'#2563EB',COLOR_MENU:'#2B160B',COLOR_MENU_SECUNDARIO:'#4A2511',COLOR_ADVERTENCIA:'#F59E0B'}},
    morado:{nombre:'Morado ejecutivo',valores:{...PREDETERMINADOS,COLOR_PRINCIPAL:'#7C3AED',COLOR_SECUNDARIO:'#5B21B6',COLOR_ACENTO:'#DB2777',COLOR_MENU:'#1E1533',COLOR_MENU_SECUNDARIO:'#312052',COLOR_EXITO:'#059669'}},
    neutro:{nombre:'Gris neutro',valores:{...PREDETERMINADOS,COLOR_PRINCIPAL:'#475569',COLOR_SECUNDARIO:'#334155',COLOR_ACENTO:'#0F766E',COLOR_MENU:'#111827',COLOR_MENU_SECUNDARIO:'#1F2937',COLOR_FONDO:'#FFFFFF',COLOR_SUPERFICIE:'#FFFFFF',COLOR_TEXTO:'#111111',COLOR_TEXTO_SECUNDARIO:'#333333',COLOR_BORDE:'#D9DEE2'}}
  });
  function valido(value){return HEX.test(String(value||''));}
  function hex(value,fallback){return valido(value)?String(value).toUpperCase():fallback;}
  function rgb(value){const h=hex(value,'#000000').slice(1);return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
  function aHex(values){return '#'+values.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('').toUpperCase();}
  function mezclar(a,b,peso=.5){const x=rgb(a),y=rgb(b);return aHex(x.map((v,i)=>v*(1-peso)+y[i]*peso));}
  function luminancia(value){return rgb(value).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);}
  function contraste(a,b){const l1=luminancia(a),l2=luminancia(b);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);}
  function normalizar(datos={}){
    const out={};
    Object.values(CAMPOS).forEach(campo=>{
      if(campo==='TEMA_PREDETERMINADO')return;
      out[campo]=hex(datos[campo],PREDETERMINADOS[campo]);
    });
    /* Migra automáticamente la antigua paleta gris predeterminada al nuevo tema claro blanco/negro. */
    const migracionesClaro={
      COLOR_FONDO:new Set(['#F3F7FA','#F3F7F8','#F1F5F9','#EEF5F4']),
      COLOR_TEXTO:new Set(['#173047','#17312F','#15312F']),
      COLOR_TEXTO_SECUNDARIO:new Set(['#65798B','#667B79','#667B78']),
      COLOR_BORDE:new Set(['#DCE6EC','#D9E5E4','#D8E5E3'])
    };
    if(migracionesClaro.COLOR_FONDO.has(out.COLOR_FONDO))out.COLOR_FONDO=PREDETERMINADOS.COLOR_FONDO;
    if(migracionesClaro.COLOR_TEXTO.has(out.COLOR_TEXTO))out.COLOR_TEXTO=PREDETERMINADOS.COLOR_TEXTO;
    if(migracionesClaro.COLOR_TEXTO_SECUNDARIO.has(out.COLOR_TEXTO_SECUNDARIO))out.COLOR_TEXTO_SECUNDARIO=PREDETERMINADOS.COLOR_TEXTO_SECUNDARIO;
    if(migracionesClaro.COLOR_BORDE.has(out.COLOR_BORDE))out.COLOR_BORDE=PREDETERMINADOS.COLOR_BORDE;
    const modo=String(datos.TEMA_PREDETERMINADO||PREDETERMINADOS.TEMA_PREDETERMINADO);
    out.TEMA_PREDETERMINADO=['Claro','Oscuro','Sistema'].includes(modo)?modo:'Sistema';
    return out;
  }
  function guardado(){try{return normalizar(JSON.parse(localStorage.getItem(CLAVE)||'{}'));}catch(_){return normalizar({});}}
  function establecer(variable,value,target=document.documentElement){target.style.setProperty(variable,value);}
  function aplicar(datos={},opciones={}){
    const tema=normalizar(datos),r=document.documentElement;
    const suavePrimario=mezclar(tema.COLOR_PRINCIPAL,tema.COLOR_SUPERFICIE,.88);
    const suaveAcento=mezclar(tema.COLOR_ACENTO,tema.COLOR_SUPERFICIE,.89);
    const suavePeligro=mezclar(tema.COLOR_PELIGRO,tema.COLOR_SUPERFICIE,.90);
    const suaveAdvertencia=mezclar(tema.COLOR_ADVERTENCIA,tema.COLOR_SUPERFICIE,.87);
    const superficie2=mezclar(tema.COLOR_SUPERFICIE,tema.COLOR_FONDO,.45);
    const superficie3=mezclar(tema.COLOR_SUPERFICIE,tema.COLOR_BORDE,.62);
    const superficieOscura2=mezclar(tema.COLOR_SUPERFICIE_OSCURO,tema.COLOR_FONDO_OSCURO,.35);
    const superficieOscura3=mezclar(tema.COLOR_SUPERFICIE_OSCURO,tema.COLOR_BORDE_OSCURO,.55);
    const vars={
      '--tema-principal':tema.COLOR_PRINCIPAL,'--tema-secundario':tema.COLOR_SECUNDARIO,'--tema-acento':tema.COLOR_ACENTO,
      '--tema-fondo':tema.COLOR_FONDO,'--tema-superficie':tema.COLOR_SUPERFICIE,'--tema-superficie-2':superficie2,'--tema-superficie-3':superficie3,
      '--tema-texto':tema.COLOR_TEXTO,'--tema-texto-suave':tema.COLOR_TEXTO_SECUNDARIO,'--tema-borde':tema.COLOR_BORDE,
      '--tema-menu':tema.COLOR_MENU,'--tema-menu-2':tema.COLOR_MENU_SECUNDARIO,'--tema-exito':tema.COLOR_EXITO,'--tema-advertencia':tema.COLOR_ADVERTENCIA,'--tema-peligro':tema.COLOR_PELIGRO,
      '--tema-fondo-oscuro':tema.COLOR_FONDO_OSCURO,'--tema-superficie-oscura':tema.COLOR_SUPERFICIE_OSCURO,'--tema-superficie-oscura-2':superficieOscura2,'--tema-superficie-oscura-3':superficieOscura3,
      '--tema-texto-oscuro':tema.COLOR_TEXTO_OSCURO,'--tema-texto-suave-oscuro':tema.COLOR_TEXTO_SECUNDARIO_OSCURO,'--tema-borde-oscuro':tema.COLOR_BORDE_OSCURO,
      '--primary':tema.COLOR_PRINCIPAL,'--primary-dark':tema.COLOR_SECUNDARIO,'--primary-soft':suavePrimario,'--blue':tema.COLOR_ACENTO,'--blue-soft':suaveAcento,
      '--bg':tema.COLOR_FONDO,'--surface':tema.COLOR_SUPERFICIE,'--surface-2':superficie2,'--surface-3':superficie3,'--surface-soft':superficie2,
      '--text':tema.COLOR_TEXTO,'--muted':tema.COLOR_TEXTO_SECUNDARIO,'--line':tema.COLOR_BORDE,'--border':tema.COLOR_BORDE,
      '--sidebar':tema.COLOR_MENU,'--sidebar-2':tema.COLOR_MENU_SECUNDARIO,'--active-green':tema.COLOR_EXITO,'--active-green-soft':mezclar(tema.COLOR_EXITO,tema.COLOR_SUPERFICIE,.88),
      '--amber':tema.COLOR_ADVERTENCIA,'--amber-soft':suaveAdvertencia,'--red':tema.COLOR_PELIGRO,'--red-soft':suavePeligro,'--danger':tema.COLOR_PELIGRO,'--inactive-red':tema.COLOR_PELIGRO,
      '--primario':tema.COLOR_PRINCIPAL,'--primario-fuerte':tema.COLOR_SECUNDARIO,'--fondo':tema.COLOR_FONDO,'--superficie':tema.COLOR_SUPERFICIE,'--superficie-suave':superficie2,
      '--texto':tema.COLOR_TEXTO,'--texto-suave':tema.COLOR_TEXTO_SECUNDARIO,'--suave':tema.COLOR_TEXTO_SECUNDARIO,'--borde':tema.COLOR_BORDE,'--error':tema.COLOR_PELIGRO,
      '--menu-fondo':tema.COLOR_MENU,'--menu-fondo-2':tema.COLOR_MENU_SECUNDARIO
    };
    Object.entries(vars).forEach(([k,v])=>establecer(k,v,r));
    const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=tema.COLOR_PRINCIPAL;
    if(opciones.guardar!==false){try{localStorage.setItem(CLAVE,JSON.stringify(tema));}catch(_){}}
    window.dispatchEvent(new CustomEvent('flotas:paleta-aplicada',{detail:tema}));
    return tema;
  }
  function aplicarEmpresa(empresa={},opciones={}){return aplicar(empresa,opciones);}
  function modoOscuroInicial(){
    const preferencia=localStorage.getItem('flotas_tema');
    if(preferencia==='dark'||preferencia==='light')return preferencia==='dark';
    const tema=guardado(),modo=tema.TEMA_PREDETERMINADO;
    if(modo==='Oscuro')return true;if(modo==='Claro')return false;
    return Boolean(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function aplicarGuardado(){return aplicar(guardado(),{guardar:false});}
  window.TemaFlotas=Object.freeze({CAMPOS,PREDETERMINADOS,PREAJUSTES,normalizar,guardado,aplicar,aplicarEmpresa,aplicarGuardado,modoOscuroInicial,contraste,mezclar,valido});
  const oscuroInicial=modoOscuroInicial();
  document.documentElement.classList.toggle('tema-oscuro-inicial',oscuroInicial);
  document.documentElement.style.colorScheme=oscuroInicial?'dark':'light';
  aplicarGuardado();
})();
