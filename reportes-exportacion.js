(function(){
  'use strict';

  const VERSION='4.2.48';
  const MIME={
    csv:'text/csv;charset=utf-8',
    xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pdf:'application/pdf'
  };

  function texto(value){
    if(value===null||value===undefined)return '';
    if(value instanceof Date)return value.toISOString();
    if(typeof value==='object'){
      try{return JSON.stringify(value);}catch(_){return String(value);}
    }
    return String(value);
  }
  function nombreSeguro(value,fallback='reporte'){
    const clean=String(value||fallback).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'');
    return clean||fallback;
  }
  function fechaVisible(value){
    if(value===null||value===undefined||value==='')return '';
    const raw=String(value).trim(),onlyDate=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(onlyDate)return `${onlyDate[3]}/${onlyDate[2]}/${onlyDate[1]}`;
    const date=value instanceof Date?value:new Date(value);if(Number.isNaN(date.getTime()))return texto(value);
    const hasTime=value instanceof Date||/[T\s]\d{2}:\d{2}/.test(raw);
    const parts=Object.fromEntries(new Intl.DateTimeFormat('es-CL',{day:'2-digit',month:'2-digit',year:'numeric',hour:hasTime?'2-digit':undefined,minute:hasTime?'2-digit':undefined,hourCycle:'h23'}).formatToParts(date).map(part=>[part.type,part.value]));
    const base=`${parts.day}/${parts.month}/${parts.year}`;return hasTime?`${base}:${parts.hour}:${parts.minute}`:base;
  }
  function campoFecha(key){return /(^|_)(FECHA|CREADO|ACTUALIZADO|GENERADO|VIGENTE|VENCIMIENTO|EMISION|REVISION|LECTURA|CONEXION|ACCESO|EXPIRACION)(_|$)/i.test(String(key||''));}
  function normalizarFechasFila(row){if(!row||typeof row!=='object'||Array.isArray(row))return row;return Object.fromEntries(Object.entries(row).map(([key,value])=>[key,campoFecha(key)?fechaVisible(value):value]));}
  function fechaArchivo(){return new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');}
  function descargar(blob,nombre){
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=nombre;a.style.display='none';document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function xml(value){return texto(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
  function columnas(rows){return [...new Set((rows||[]).flatMap(row=>Object.keys(row||{})))];}
  function filasNormalizadas(rows){return (Array.isArray(rows)?rows:[]).map(row=>{
    if(row&&typeof row==='object'&&!Array.isArray(row))return row;
    return {VALOR:row};
  });}
  function limitarCelda(value,max=32000){const s=texto(value);return s.length>max?s.slice(0,max-1)+'…':s;}
  function hoja(nombre,rows){
    const normalized=filasNormalizadas(rows).map(normalizarFechasFila),headers=columnas(normalized);
    return {nombre:String(nombre||'Datos').slice(0,31),headers,rows:normalized};
  }
  function aplanar(obj,prefix='',out=[]){
    if(obj===null||obj===undefined){out.push({CAMPO:prefix||'VALOR',VALOR:''});return out;}
    if(Array.isArray(obj)){
      if(!obj.length)out.push({CAMPO:prefix||'LISTA',VALOR:'Sin registros'});
      else obj.forEach((item,index)=>aplanar(item,`${prefix}${prefix?'.':''}${index+1}`,out));
      return out;
    }
    if(typeof obj==='object'){
      const entries=Object.entries(obj);
      if(!entries.length)out.push({CAMPO:prefix||'OBJETO',VALOR:'Sin datos'});
      entries.forEach(([key,value])=>{
        const next=prefix?`${prefix}.${key}`:key;
        if(value&&typeof value==='object')aplanar(value,next,out);else out.push({CAMPO:next,VALOR:texto(value)});
      });
      return out;
    }
    out.push({CAMPO:prefix||'VALOR',VALOR:texto(obj)});return out;
  }
  function hojasOficina(report,meta={}){
    const estado=report?.estadoOficina||{},diagnostico=report?.diagnostico||{};
    const resumen=[
      {CAMPO:'Título',VALOR:meta.titulo||'Reporte de NEXO IA'},
      {CAMPO:'Fecha de generación',VALOR:fechaVisible(meta.fecha||report?.generadoEn||new Date())},
      {CAMPO:'Generado por',VALOR:meta.generadoPor||report?.generadoPor?.NOMBRE||report?.generadoPor?.CORREO||''},
      {CAMPO:'Resumen',VALOR:meta.resumen||''},
      {CAMPO:'Estado de la API',VALOR:diagnostico.estado||diagnostico.ESTADO||'Verificada'},
      {CAMPO:'Estado general',VALOR:estado.estado||estado.ESTADO||''},
      {CAMPO:'Incidentes',VALOR:estado.problemas??estado.PROBLEMAS??(report?.incidentes||[]).length},
      {CAMPO:'Tareas pendientes',VALOR:estado.totalTareas??estado.TOTAL_TAREAS??(report?.tareas||[]).length},
      {CAMPO:'Versión del sistema',VALOR:meta.version||VERSION}
    ];
    const result=[hoja('Resumen',resumen),hoja('Diagnóstico',aplanar(diagnostico))];
    if(estado&&Object.keys(estado).length)result.push(hoja('Estado Oficina',aplanar(estado)));
    if(Array.isArray(report?.incidentes))result.push(hoja('Incidentes',report.incidentes));
    if(Array.isArray(report?.tareas))result.push(hoja('Tareas',report.tareas));
    return result;
  }
  function hojasFilas(rows,meta={}){
    const result=[];
    const summary=[];
    Object.entries(meta.metadatos||{}).forEach(([CAMPO,VALOR])=>summary.push({CAMPO,VALOR}));
    if(summary.length)result.push(hoja('Resumen',summary));
    result.push(hoja(meta.hoja||'Datos',rows));
    return result;
  }
  function escaparCsv(value){return `"${limitarCelda(value,100000).replace(/"/g,'""')}"`;}
  function csvDeHojas(sheets){
    const lines=[];
    sheets.forEach((sheet,index)=>{
      if(index)lines.push('');
      lines.push(escaparCsv(`# ${sheet.nombre}`));
      if(sheet.headers.length){
        lines.push(sheet.headers.map(escaparCsv).join(';'));
        sheet.rows.forEach(row=>lines.push(sheet.headers.map(key=>escaparCsv(row?.[key]??'')).join(';')));
      }
    });
    return '\ufeff'+lines.join('\r\n');
  }
  function cargarScript(src,globalName){
    if(window[globalName])return Promise.resolve(window[globalName]);
    return new Promise((resolve,reject)=>{
      const existing=document.querySelector(`script[data-export-lib="${globalName}"]`);
      if(existing){existing.addEventListener('load',()=>resolve(window[globalName]),{once:true});existing.addEventListener('error',reject,{once:true});return;}
      const script=document.createElement('script');script.src=src;script.async=true;script.dataset.exportLib=globalName;
      script.onload=()=>window[globalName]?resolve(window[globalName]):reject(new Error(`${globalName}_NO_DISPONIBLE`));
      script.onerror=()=>reject(new Error(`${globalName}_NO_DISPONIBLE`));document.head.appendChild(script);
    });
  }
  function columnaExcel(index){let n=index+1,out='';while(n){const r=(n-1)%26;out=String.fromCharCode(65+r)+out;n=Math.floor((n-1)/26);}return out;}
  function celdaXlsx(value,ref,style=0){
    if(typeof value==='number'&&Number.isFinite(value))return `<c r="${ref}"${style?` s="${style}"`:''}><v>${value}</v></c>`;
    const safe=xml(limitarCelda(value));return `<c r="${ref}" t="inlineStr"${style?` s="${style}"`:''}><is><t xml:space="preserve">${safe}</t></is></c>`;
  }
  function worksheetXml(sheet){
    const all=[sheet.headers,...sheet.rows.map(row=>sheet.headers.map(key=>row?.[key]??''))];
    const widths=sheet.headers.map((header,index)=>Math.min(48,Math.max(10,...all.map(row=>texto(row[index]??'').length+2))));
    const cols=widths.map((width,index)=>`<col min="${index+1}" max="${index+1}" width="${width}" customWidth="1"/>`).join('');
    const rows=all.map((row,rIndex)=>`<row r="${rIndex+1}">${row.map((value,cIndex)=>celdaXlsx(value,`${columnaExcel(cIndex)}${rIndex+1}`,rIndex===0?1:0)).join('')}</row>`).join('');
    const lastCol=columnaExcel(Math.max(0,sheet.headers.length-1)),lastRow=Math.max(1,all.length);
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastCol}${lastRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${rows}</sheetData>${sheet.headers.length?`<autoFilter ref="A1:${lastCol}${lastRow}"/>`:''}</worksheet>`;
  }
  async function xlsxDeHojas(sheets){
    const JSZip=await cargarScript('jszip.min.js?v=4.2.50-ui11','JSZip'),zip=new JSZip();
    const safeSheets=sheets.map((s,index)=>({...s,nombre:(s.nombre||`Hoja ${index+1}`).replace(/[\\/*?:\[\]]/g,' ').slice(0,31)||`Hoja ${index+1}`}));
    zip.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${safeSheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
    zip.folder('_rels').file('.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
    zip.folder('docProps').file('core.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Desarrollado por Alejandro Silva</dc:creator><cp:lastModifiedBy>Sistema de Gestión de Flotas</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`);
    zip.folder('docProps').file('app.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Sistema de Gestión de Flotas</Application><AppVersion>${VERSION}</AppVersion></Properties>`);
    const xl=zip.folder('xl');
    xl.file('workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${safeSheets.map((s,i)=>`<sheet name="${xml(s.nombre)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`);
    xl.folder('_rels').file('workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${safeSheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${safeSheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
    xl.file('styles.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B5F59"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
    const worksheets=xl.folder('worksheets');safeSheets.forEach((sheet,index)=>worksheets.file(`sheet${index+1}.xml`,worksheetXml(sheet)));
    return zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6},mimeType:MIME.xlsx});
  }
  function cp1252Byte(char){
    const code=char.charCodeAt(0);if(code<=255)return code;
    const map={'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};
    return map[char]||63;
  }
  function pdfLiteral(value){
    let out='';for(const ch of texto(value)){const b=cp1252Byte(ch);if(b===40||b===41||b===92)out+='\\'+String.fromCharCode(b);else if(b<32||b>126)out+=`\\${b.toString(8).padStart(3,'0')}`;else out+=String.fromCharCode(b);}return out;
  }
  function envolver(value,max=92){
    const source=texto(value).replace(/\s+/g,' ').trim();if(!source)return [''];
    const words=source.split(' '),lines=[];let line='';
    words.forEach(word=>{if(word.length>max){if(line){lines.push(line);line='';}for(let i=0;i<word.length;i+=max)lines.push(word.slice(i,i+max));return;}const next=line?`${line} ${word}`:word;if(next.length>max){lines.push(line);line=word;}else line=next;});if(line)lines.push(line);return lines;
  }
  function lineasPdf(sheets,meta={}){
    const items=[{text:meta.titulo||'Reporte del Sistema de Gestión de Flotas',size:17,bold:true,gap:8}];
    if(meta.subtitulo)items.push({text:meta.subtitulo,size:10,bold:false,gap:8});
    if(meta.autor)items.push({text:`Generado por: ${meta.autor}`,size:9,bold:false});
    items.push({text:`Fecha: ${fechaVisible(meta.fecha||new Date())}`,size:9,bold:false,gap:10});
    sheets.forEach(sheet=>{
      items.push({text:sheet.nombre,size:12,bold:true,gap:5});
      if(!sheet.rows.length){items.push({text:'Sin registros.',size:9,bold:false,gap:8});return;}
      sheet.rows.forEach((row,index)=>{
        if(sheet.headers.length===2&&sheet.headers.includes('CAMPO')&&sheet.headers.includes('VALOR')){
          items.push({text:`${row.CAMPO}: ${limitarCelda(row.VALOR,700)}`,size:9,bold:false,gap:1});
        }else{
          items.push({text:`Registro ${index+1}`,size:9,bold:true,gap:1});
          sheet.headers.forEach(key=>{const val=limitarCelda(row?.[key]??'',500);if(val!=='')items.push({text:`${key}: ${val}`,size:8.5,bold:false,gap:0});});
          items.push({text:'',size:8,gap:3});
        }
      });
      items.push({text:'',size:8,gap:5});
    });return items;
  }
  function pdfDeHojas(sheets,meta={}){
    const width=595,height=842,margin=42,usable=height-margin*2,items=lineasPdf(sheets,meta),pages=[];let page=[],y=height-margin;
    function nueva(){if(page.length)pages.push(page);page=[];y=height-margin;}
    items.forEach(item=>{
      const size=Number(item.size||9),lineHeight=size+3,wrapped=envolver(item.text,item.bold?82:94);
      wrapped.forEach((line,idx)=>{if(y-lineHeight<margin+20)nueva();page.push({text:line,x:margin,y,size,bold:Boolean(item.bold)});y-=lineHeight;if(idx===wrapped.length-1)y-=Number(item.gap||0);});
    });nueva();
    pages.forEach((p,index)=>p.push({text:`Página ${index+1} de ${pages.length}`,x:width-margin-72,y:22,size:8,bold:false}));
    const objects=[];objects[1]='<< /Type /Catalog /Pages 2 0 R >>';objects[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';objects[4]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    const kids=[];let objectId=5;
    pages.forEach(lines=>{
      const content=lines.map(line=>`BT /F${line.bold?'B':'R'} ${line.size} Tf 1 0 0 1 ${line.x.toFixed(2)} ${line.y.toFixed(2)} Tm (${pdfLiteral(line.text)}) Tj ET`).join('\n');
      const contentId=objectId++,pageId=objectId++;objects[contentId]=`<< /Length ${content.length} >>\nstream\n${content}\nendstream`;objects[pageId]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /FR 3 0 R /FB 4 0 R >> >> /Contents ${contentId} 0 R >>`;kids.push(`${pageId} 0 R`);
    });objects[2]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
    let pdf='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n',offsets=[0];for(let i=1;i<objects.length;i++){offsets[i]=pdf.length;pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}
    const xref=pdf.length;pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let i=1;i<objects.length;i++)pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const bytes=new Uint8Array(pdf.length);for(let i=0;i<pdf.length;i++)bytes[i]=pdf.charCodeAt(i)&255;return new Blob([bytes],{type:MIME.pdf});
  }
  async function exportarHojas(sheets,options={}){
    const formato=String(options.formato||'csv').toLowerCase(),base=nombreSeguro(options.nombre||options.titulo||'reporte'),filename=`${base}_${fechaArchivo()}.${formato}`;
    if(formato==='csv'){descargar(new Blob([csvDeHojas(sheets)],{type:MIME.csv}),filename);return filename;}
    if(formato==='xlsx'){descargar(await xlsxDeHojas(sheets),filename);return filename;}
    if(formato==='pdf'){descargar(pdfDeHojas(sheets,{titulo:options.titulo,subtitulo:options.subtitulo,autor:options.autor,fecha:options.fecha}),filename);return filename;}
    throw new Error('FORMATO_REPORTE_NO_SOPORTADO');
  }
  async function exportarFilas(rows,options={}){return exportarHojas(hojasFilas(rows,options),options);}
  async function exportarOficina(report,options={}){return exportarHojas(hojasOficina(report,options),options);}

  window.ExportadorReportesFlotas=Object.freeze({VERSION,exportarFilas,exportarOficina,exportarHojas,hojasOficina,hojasFilas});
})();
