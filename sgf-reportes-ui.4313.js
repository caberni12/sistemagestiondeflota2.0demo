(()=>{
  'use strict';
  if(window.__SGF_REPORTES_UI_4313__)return;
  window.__SGF_REPORTES_UI_4313__=true;
  document.body.classList.add('modulo-reportes');

  const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const whole=v=>{const m=String(v||'').match(/-?[\d.\s]+/);return m?Number(m[0].replace(/[^\d-]/g,''))||0:0;};
  const decimal=v=>{let x=String(v||'').replace(/[^\d,.-]/g,'').trim();if(!x)return 0;if(x.includes(',')&&x.includes('.'))x=x.replace(/\./g,'').replace(',','.');else if(x.includes(','))x=x.replace(',','.');const n=Number.parseFloat(x);return Number.isFinite(n)?n:0;};
  const pct=(a,b)=>b>0?Math.max(0,Math.min(100,Math.round(a/b*100))):0;

  function metricas(root){
    const out={};
    qa('.kpi-grid-advanced .metric-card',root).forEach(card=>{
      const label=q('div > span',card)?.textContent||'',value=q('div > b',card)?.textContent||'',detail=q('div > small',card)?.textContent||'';
      if(label)out[norm(label)]={label,value,detail,node:card};
    });
    return out;
  }
  function resumen(root){
    const out={};
    qa('.kpi-filter-summary > span',root).forEach(item=>{
      const b=q('b',item),value=whole(b?.textContent||'0'),label=norm(String(item.textContent||'').replace(b?.textContent||'',''));
      if(label)out[label]=value;
    });
    return out;
  }
  const firstMetric=(map,...keys)=>{for(const key of keys){const hit=Object.entries(map).find(([k])=>k.includes(norm(key)));if(hit)return hit[1];}return null;};
  const firstSummary=(map,...keys)=>{for(const key of keys){const hit=Object.entries(map).find(([k])=>k.includes(norm(key)));if(hit)return hit[1];}return 0;};
  const firstWhole=v=>whole(String(v||'').split('·')[0]);

  function trendSource(root){
    const chart=q('.dashboard-insights .weekly-chart',root);if(!chart)return [];
    return qa('.weekly-column',chart).map((col,i)=>({label:q('span',col)?.textContent?.trim()||`P${i+1}`,total:whole(q('b',col)?.textContent||'0')}));
  }
  function stateSource(root){
    const legend=q('.dashboard-insights .chart-legend',root);if(!legend)return [];
    return qa(':scope > div',legend).map(row=>({label:q('span',row)?.textContent?.trim()||'Sin estado',total:whole(q('b',row)?.textContent||'0')})).filter(x=>x.total>=0);
  }
  function vehicleSource(root){
    const table=q('.vehicle-kpi-card table',root);if(!table)return [];
    const headers=qa('thead th',table).map(th=>norm(th.textContent));let idx=headers.findIndex(h=>h.includes('rendimiento'));if(idx<0)idx=5;
    return qa('tbody tr',table).map((tr,i)=>{const cells=qa('td',tr),name=q('strong',cells[0])?.textContent?.trim()||cells[0]?.textContent?.trim()||`Vehículo ${i+1}`,value=decimal(cells[idx]?.textContent||'0');return{name,value,detail:`${name}: ${value.toFixed(2)} km/L · ${cells[1]?.textContent?.trim()||'sin distancia'} · ${cells[3]?.textContent?.trim()||'sin combustible'}`};}).filter(x=>x.value>0).sort((a,b)=>b.value-a.value).slice(0,8);
  }

  function gauge(icon,label,value,total,detail){
    const p=pct(value,total),count=total>0?`${value.toLocaleString('es-CL')} de ${total.toLocaleString('es-CL')}`:'Sin registros';
    return `<button type="button" class="report-gauge-card" data-report-detail="${esc(detail)}"><span class="report-gauge-ring" style="--report-pct:${p}"><i></i><strong>${p}%</strong></span><span class="report-gauge-copy"><small>${esc(icon)}</small><b>${esc(label)}</b><em>${esc(count)}</em></span></button>`;
  }
  function lineChart(rows){
    if(!rows.length)return '<div class="report-empty-visual">Sin tendencia disponible para este filtro.</div>';
    const width=660,height=230,padX=38,padY=30,max=Math.max(1,...rows.map(r=>r.total)),step=rows.length>1?(width-padX*2)/(rows.length-1):0,pts=rows.map((r,i)=>({x:padX+step*i,y:height-padY-(r.total/max)*(height-padY*2),...r})),poly=pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),area=`${padX},${height-padY} ${poly} ${pts[pts.length-1].x},${height-padY}`;
    return `<div class="report-line-chart"><svg viewBox="0 0 ${width} ${height}" aria-label="Línea de tendencia"><g class="report-line-grid"><line x1="${padX}" y1="${padY}" x2="${width-padX}" y2="${padY}"/><line x1="${padX}" y1="${height/2}" x2="${width-padX}" y2="${height/2}"/><line x1="${padX}" y1="${height-padY}" x2="${width-padX}" y2="${height-padY}"/></g><polygon class="report-line-area" points="${area}"/><polyline class="report-line-path" points="${poly}" fill="none"/>${pts.map(p=>`<g class="report-line-point" tabindex="0" role="button" data-report-detail="${esc(`${p.label}: ${p.total.toLocaleString('es-CL')} operaciones`)}"><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="7"/><text class="report-line-value" x="${p.x.toFixed(1)}" y="${Math.max(16,p.y-13).toFixed(1)}" text-anchor="middle">${p.total.toLocaleString('es-CL')}</text><text class="report-line-label" x="${p.x.toFixed(1)}" y="${height-8}" text-anchor="middle">${esc(p.label.slice(0,10))}</text></g>`).join('')}</svg></div>`;
  }
  function donut(rows){
    const colors=['#0e9f91','#2e6fe8','#e8a128','#d65454','#8b67cc','#718393'],total=rows.reduce((s,r)=>s+r.total,0);if(!rows.length||!total)return '<div class="report-empty-visual">Sin distribución de estados para este filtro.</div>';let offset=0;
    const seg=rows.map((r,i)=>{const p=r.total/total*100,start=offset;offset+=p;return `<circle class="report-donut-segment" cx="60" cy="60" r="44" pathLength="100" fill="none" stroke="${colors[i%colors.length]}" stroke-width="15" stroke-dasharray="${p.toFixed(3)} ${(100-p).toFixed(3)}" stroke-dashoffset="${(-start).toFixed(3)}" transform="rotate(-90 60 60)" tabindex="0" role="button" data-report-detail="${esc(`${r.label}: ${r.total.toLocaleString('es-CL')} · ${Math.round(p)}%`)}"/>`;}).join('');
    const leg=rows.map((r,i)=>`<button type="button" class="report-donut-legend" data-report-detail="${esc(`${r.label}: ${r.total.toLocaleString('es-CL')} · ${Math.round(r.total/total*100)}%`)}"><i style="background:${colors[i%colors.length]}"></i><span>${esc(r.label)}</span><b>${r.total.toLocaleString('es-CL')}</b></button>`).join('');
    return `<div class="report-donut-layout"><div class="report-donut-svg"><svg viewBox="0 0 120 120"><circle class="report-donut-base" cx="60" cy="60" r="44" fill="none" stroke-width="15"/>${seg}</svg><span><b>${total.toLocaleString('es-CL')}</b><small>operaciones</small></span></div><div class="report-donut-legends">${leg}</div></div>`;
  }
  function bars(rows){
    if(!rows.length)return '<div class="report-empty-visual">Sin rendimiento por vehículo para este filtro.</div>';const max=Math.max(...rows.map(r=>r.value),1);
    return `<div class="report-bar-list">${rows.map(r=>`<button type="button" class="report-bar-row" data-report-detail="${esc(r.detail)}"><span><b>${esc(r.name)}</b><small>Rendimiento</small></span><i><em style="width:${Math.max(6,Math.round(r.value/max*100))}%"></em></i><strong>${r.value.toFixed(2)} km/L</strong></button>`).join('')}</div>`;
  }

  function model(root){
    const m=metricas(root),s=resumen(root),trend=trendSource(root),states=stateSource(root),vehicles=vehicleSource(root);
    const opTotal=firstSummary(s,'operaciones')||whole(firstMetric(m,'operaciones')?.value),opFin=whole(firstMetric(m,'finalizadas')?.value),route=firstMetric(m,'rutas'),routeTotal=firstSummary(s,'rutas')||whole(route?.value),routeDone=firstWhole(route?.detail),check=firstMetric(m,'check-ins','checkins'),checkTotal=firstSummary(s,'check-ins','checkins')||whole(check?.value),checkOk=firstWhole(check?.detail),maintTotal=firstSummary(s,'mantenciones'),maintOpen=whole(firstMetric(m,'mantenciones abiertas')?.value),docsTotal=firstSummary(s,'documentos'),docsExpired=whole(firstMetric(m,'documentos vencidos')?.value);
    return{gauges:[['✓','Operaciones finalizadas',opFin,opTotal,`${opFin} operaciones finalizadas de ${opTotal} registradas`],['➜','Cumplimiento de rutas',routeDone,routeTotal,`${routeDone} rutas completadas de ${routeTotal} rutas`],['☑','Check-ins aprobados',checkOk,checkTotal,`${checkOk} check-ins aprobados de ${checkTotal} realizados`],['⚙','Mantenciones al día',Math.max(0,maintTotal-maintOpen),maintTotal,`${Math.max(0,maintTotal-maintOpen)} mantenciones al día y ${maintOpen} abiertas`],['▤','Documentos vigentes',Math.max(0,docsTotal-docsExpired),docsTotal,`${Math.max(0,docsTotal-docsExpired)} documentos vigentes y ${docsExpired} vencidos`]],trend,states,vehicles};
  }
  function signature(data){return JSON.stringify(data);}
  function bind(dash){
    const detail=q('[data-report-chart-detail]',dash),items=qa('[data-report-detail]',dash),reset=q('[data-report-chart-reset]',dash);if(!detail)return;
    const show=item=>{items.forEach(x=>x.classList.toggle('is-active',x===item));q('i',detail).textContent='✓';q('b',detail).textContent='Indicador seleccionado';q('span',detail).textContent=item.dataset.reportDetail||'Detalle disponible.';};
    items.forEach(item=>{item.addEventListener('mouseenter',()=>{if(dash.dataset.pinned!=='1')show(item)});item.addEventListener('focus',()=>{if(dash.dataset.pinned!=='1')show(item)});item.addEventListener('click',e=>{e.preventDefault();dash.dataset.pinned='1';show(item)});item.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();dash.dataset.pinned='1';show(item)}});});
    reset?.addEventListener('click',()=>{dash.dataset.pinned='0';items.forEach(x=>x.classList.remove('is-active'));q('i',detail).textContent='◎';q('b',detail).textContent='Detalle interactivo';q('span',detail).textContent='Seleccione un anillo, segmento, barra o punto de tendencia.';});
  }
  function enhance(){
    const root=q('#kpiReportResults');if(!root)return;const metricGrid=q('.kpi-grid-advanced',root);if(!metricGrid)return;const data=model(root),sig=signature(data),existing=q('[data-sgf-report-dashboard]',root);if(existing?.dataset.signature===sig)return;
    const source=q('.dashboard-insights',root);if(source)source.classList.add('sgf-report-source-charts');
    existing?.remove();
    const dash=document.createElement('section');dash.className='report-executive-dashboard';dash.dataset.sgfReportDashboard='1';dash.dataset.signature=sig;dash.innerHTML=`<div class="report-dashboard-heading"><div><span class="eyebrow">DASHBOARD INTERACTIVO</span><h3>Visión ejecutiva del período</h3><p>Toque o haga clic en los gráficos para destacar un indicador y consultar su detalle.</p></div><span class="status ok">Datos del reporte actual</span></div><div class="report-gauge-grid">${data.gauges.map(g=>gauge(...g)).join('')}</div><div class="report-visual-grid"><article class="card report-chart-card report-chart-wide"><div class="card-header"><div><h3>Línea de tendencia operacional</h3><p>Evolución con los datos que ya entrega el reporte.</p></div><span class="report-chart-badge">↗ Tendencia</span></div>${lineChart(data.trend)}</article><article class="card report-chart-card"><div class="card-header"><div><h3>Distribución por estado</h3><p>Participación de los estados operacionales.</p></div><span class="report-chart-badge">◌ Circular</span></div>${donut(data.states)}</article><article class="card report-chart-card"><div class="card-header"><div><h3>Rendimiento por vehículo</h3><p>Comparación visual de km/L.</p></div><span class="report-chart-badge">▥ Barras</span></div>${bars(data.vehicles)}</article></div><div class="report-chart-detail" data-report-chart-detail><i>◎</i><div><b>Detalle interactivo</b><span>Seleccione un anillo, segmento, barra o punto de tendencia.</span></div><button class="btn soft small" type="button" data-report-chart-reset>Restablecer</button></div>`;
    metricGrid.insertAdjacentElement('afterend',dash);bind(dash);
  }
  let timer=0;const schedule=()=>{clearTimeout(timer);timer=setTimeout(enhance,60)};
  const observer=new MutationObserver(mutations=>{if(mutations.some(m=>!m.target.closest?.('[data-sgf-report-dashboard]')))schedule();});
  const start=()=>{const content=q('#content')||document.body;observer.observe(content,{childList:true,subtree:true});schedule();};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
})();
