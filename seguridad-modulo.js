(function(){
'use strict';
var script=document.currentScript;
var seccion=String(script&&script.dataset?script.dataset.sgfSeccion||'':'');
var login='index.html?sesion=modulo_protegido';
function volver(){
  try{if(window.top&&window.top!==window){window.top.location.replace(login);return;}}catch(_){ }
  location.replace(login);
}
try{
  if(window.self===window.top){volver();return;}
  var params=new URLSearchParams(location.search);
  var recibido=String(params.get('__sgf')||'');
  var esperado=String(sessionStorage.getItem('sgf_shell_ticket_v1')||'');
  if(!recibido||!esperado||recibido!==esperado){volver();return;}
  var ref=document.referrer?new URL(document.referrer,location.href):null;
  if(location.protocol!=='file:'&&(!ref||ref.origin!==location.origin||!/\/main\.html$/i.test(ref.pathname))){volver();return;}
  window.__SGF_MODULO_SEGURO__=Object.freeze({valido:true,seccion:seccion,ticket:recibido});
}catch(_){volver();}
})();
