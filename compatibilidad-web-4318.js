(function(){
  'use strict';
  if(typeof window.formatDate==='function')return;
  window.formatDate=function(value,time){
    if(!value)return '—';
    var raw=String(value).trim(),onlyDate=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(onlyDate)return onlyDate[3]+'/'+onlyDate[2]+'/'+onlyDate[1];
    var date=value instanceof Date?value:new Date(value);
    if(Number.isNaN(date.getTime()))return String(value);
    var options={day:'2-digit',month:'2-digit',year:'numeric'};
    if(time){options.hour='2-digit';options.minute='2-digit';options.hourCycle='h23';}
    var parts=Object.fromEntries(new Intl.DateTimeFormat('es-CL',options).formatToParts(date).map(function(part){return [part.type,part.value];}));
    var base=parts.day+'/'+parts.month+'/'+parts.year;
    return time?base+':'+parts.hour+':'+parts.minute:base;
  };
})();
