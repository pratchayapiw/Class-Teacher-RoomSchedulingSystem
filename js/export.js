/* ---------- print & download ---------- */
document.body.insertAdjacentHTML('beforeend',`<div id="printArea" aria-hidden="true"></div>
<dialog id="dlgExp" class="wide"><div class="dlg">
  <div class="dlg-head"><div><h3>พิมพ์ / ดาวน์โหลด</h3><div class="sub">เลือกตาราง แล้วกดพิมพ์ (บันทึกเป็น PDF ได้) หรือดาวน์โหลดเป็น Excel</div></div><button type="button" class="x" data-exp="close" aria-label="ปิด">×</button></div>
  <div class="field"><span class="lbl">ตารางที่ต้องการ</span><div class="opts" id="expScope"></div></div>
  <div class="tpick" id="expPick"></div>
  <div class="row"><label class="check"><input type="checkbox" id="expSum" checked> สรุปท้ายตาราง</label><label class="check"><input type="checkbox" id="expSig" checked> ช่องลงนาม</label></div>
  <div class="note" id="expNote"></div>
  <div class="dlg-actions"><button type="button" class="btn" data-exp="json">สำรองข้อมูล (.json)</button><span class="spacer"></span><button type="button" class="btn" data-exp="xlsx">ดาวน์โหลด Excel</button><button type="button" class="btn primary" data-exp="print">พิมพ์ / PDF</button></div>
</div></dialog>`);
$('.bar-actions').insertAdjacentHTML('afterbegin','<button class="btn sm" id="btnExp" type="button"><span class="ico">⎙</span>พิมพ์ / ดาวน์โหลด</button>');

let EX={scope:'cur',pick:new Set()};
const GRIDV=['teacher','class','room'];
function curItem(){if(V.view==='teacher')return{ctx:'teacher',key:V.t};if(V.view==='class')return{ctx:'class',key:V.c};if(V.view==='room')return{ctx:'room',key:V.r};return null;}
function itemTitle(it){if(it.ctx==='teacher'){const t=TU(it.key);return`ตารางสอน ${t.code} ${t.name}`;}
  if(it.ctx==='class'){const c=DB.classes.find(x=>x.id===it.key);return`ตารางเรียน ชั้นมัธยมศึกษาปีที่ ${it.key}${c&&c.room?` · ห้องประจำ ${c.room}`:''}`;}
  const r=DB.rooms.find(x=>x.id===it.key);return`ตารางการใช้ห้อง ${it.key}${r&&r.note?` · ${r.note}`:''}`;}
function itemFilter(it){return it.ctx==='teacher'?L=>L.tids.includes(it.key):it.ctx==='class'?L=>inClass(L,it.key):L=>L.type==='subj'&&L.room===it.key;}
function cellLines(it,L){const who=L.tids.filter(u=>u!==it.key).map(u=>tShort(TU(u))).join(' + ');
  if(L.type==='act')return[L.act];
  if(it.ctx==='teacher')return[codeLabel(L.code),'ม.'+L.cls,'ห้อง '+L.room,...(who?['ร่วม '+who]:[])];
  if(it.ctx==='class')return[codeLabel(L.code),L.tids.map(u=>tShort(TU(u))).join(' + '),'ห้อง '+L.room];
  return[codeLabel(L.code),'ม.'+L.cls,L.tids.map(u=>tShort(TU(u))).join(' + ')];}
function itemsFor(scope){
  if(scope==='cur'){const c=curItem();return c&&c.key?[c]:[];}
  if(scope==='teachers')return tSorted().map(t=>({ctx:'teacher',key:t.uid}));
  if(scope==='classes')return DB.classes.map(c=>c.id).sort(sortCls).map(k=>({ctx:'class',key:k}));
  if(scope==='rooms')return DB.rooms.map(r=>r.id).sort(numSort).map(k=>({ctx:'room',key:k}));
  if(scope==='pickT')return tSorted().filter(t=>EX.pick.has(t.uid)).map(t=>({ctx:'teacher',key:t.uid}));
  if(scope==='pickC')return DB.classes.map(c=>c.id).sort(sortCls).filter(k=>EX.pick.has(k)).map(k=>({ctx:'class',key:k}));
  return[];}

/* --- print --- */
function pageHead(title){const S=settings();return`<header class="ph"><div class="ph-l"><b>${esc(S.school)}</b><span>${esc(S.group)}</span></div><div class="ph-t">${esc(title)}</div><div class="ph-r">${esc(S.term)}</div></header>`;}
function signBlock(roles){return`<div class="psig">${roles.map(([role,name])=>`<div><div class="ln">ลงชื่อ ....................................................</div><div>( ${esc(name||'....................................................')} )</div><div class="rl">${esc(role)}</div></div>`).join('')}</div>`;}
function pageHTML(it,opt){const S=settings(),f=itemFilter(it);
  let g=`<table class="pg"><thead><tr><th class="c0">วัน</th><th class="ch">โฮมรูม<small>08.20–08.50</small></th>${TIMES.map((t,i)=>`<th>คาบ ${i+1}<small>${t}</small></th>`).join('')}<th class="ch">คาบ 9<small>15.30–16.20</small></th></tr></thead><tbody>`;
  for(let d=0;d<5;d++){g+=`<tr><th class="c0">${DAYS[d]}</th><td class="ch mut">โฮมรูม</td>`;
    for(let p=0;p<NP;p++){const Ls=DB.lessons.filter(L=>f(L)&&L.d===d&&L.p===p);
      g+=`<td>${Ls.map(L=>`<div class="pe ${kind(L)}">${cellLines(it,L).map((x,i)=>i?`<span>${esc(x)}</span>`:`<b>${esc(x)}</b>`).join('')}</div>`).join('')}</td>`;}
    g+='<td class="ch mut">PLC</td></tr>';}
  g+='</tbody></table>';
  let sum='';
  if(opt.sum){const {s,tiles}=sumData(it.ctx,it.key),rows=Object.values(s.bySubj).sort((a,b)=>numSort(a.code,b.code)||sortCls(a.cls,b.cls));
    sum=`<div class="psum"><table class="pt1"><tr>${tiles.map(t=>`<th>${esc(t[0])}</th>`).join('')}</tr><tr>${tiles.map(t=>`<td>${t[1]}</td>`).join('')}</tr></table>
      ${rows.length?`<table class="pt2"><tr><th>รหัสวิชา</th><th>รายวิชา</th><th>${it.ctx==='class'?'ครูผู้สอน':'ชั้น'}</th><th>${it.ctx==='room'?'ครูผู้สอน':'ห้อง'}</th><th>คาบ</th></tr>${rows.map(r=>`<tr><td>${esc(codeLabel(r.code))}</td><td>${esc(subjTitle(r.code))}</td><td>${esc(it.ctx==='class'?[...r.tids].map(u=>tShort(TU(u))).join(' + '):r.cls)}</td><td>${esc(it.ctx==='room'?[...r.tids].map(u=>tShort(TU(u))).join(' + '):[...r.rooms].join(', '))}</td><td>${r.n}</td></tr>`).join('')}</table>`:''}</div>`;}
  const roles=[];if(it.ctx==='teacher')roles.push(['ครูผู้สอน',TU(it.key).name]);
  roles.push(['หัวหน้ากลุ่มสาระฯ',S.head],['รองผู้อำนวยการกลุ่มบริหารวิชาการ',S.deputy],['ผู้อำนวยการ'+S.school,S.director]);
  return pageHead(itemTitle(it))+g+sum+(opt.sig?signBlock(roles):'');}
function summaryPages(){const keep=V.sumtab,out=[];
  ['teachers','classes','rooms'].forEach(k=>{V.sumtab=k;const T=sumTable(),tot=T.head.map((_,i)=>T.sum.includes(i)?T.rows.reduce((a,r)=>a+((r.skip||[]).includes(i)?0:(+r.cells[i]||0)),0):'');tot[0]='รวม';
    out.push(pageHead(T.title)+`<table class="pt2 wide"><tr>${T.head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr>${T.rows.map(r=>`<tr>${r.cells.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}<tr class="tot">${tot.map(c=>`<td>${esc(c)}</td>`).join('')}</tr></table>`);});
  V.sumtab=keep;return out;}
function doPrint(pages){if(IS_ARTIFACT){toast('การพิมพ์ใช้ได้ในเวอร์ชันเว็บไซต์ (GitHub Pages)');return;}
  $('#printArea').innerHTML=pages.map(p=>`<section class="pp">${p}</section>`).join('');
  setTimeout(()=>window.print(),60);}
window.addEventListener('afterprint',()=>{$('#printArea').innerHTML='';});

/* --- excel --- */
function loadXLSX(){return window.XLSX?Promise.resolve():new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=ok;s.onerror=()=>no(new Error('load'));document.head.appendChild(s);});}
function sheetRows(it,opt){const S=settings(),f=itemFilter(it);
  const rows=[[`${S.school} · ${S.group}`],[`${itemTitle(it)} · ${S.term}`],[],['วัน','โฮมรูม 08.20–08.50',...TIMES.map((t,i)=>`คาบ ${i+1} (${t})`),'คาบ 9 (15.30–16.20)']];
  for(let d=0;d<5;d++)rows.push([DAYS[d],'โฮมรูม',...TIMES.map((_,p)=>DB.lessons.filter(L=>f(L)&&L.d===d&&L.p===p).map(L=>cellLines(it,L).join(' · ')).join(' | ')),'PLC']);
  if(opt.sum){const {s,tiles}=sumData(it.ctx,it.key);rows.push([],['สรุป'],tiles.map(t=>t[0]),tiles.map(t=>t[1]),[],['รหัสวิชา','รายวิชา','ชั้น','ครูผู้สอน','ห้อง','คาบ/สัปดาห์']);
    Object.values(s.bySubj).sort((a,b)=>numSort(a.code,b.code)||sortCls(a.cls,b.cls)).forEach(g=>rows.push([codeLabel(g.code),subjTitle(g.code),g.cls,[...g.tids].map(u=>tShort(TU(u))).join(' + '),[...g.rooms].join(', '),g.n]));
    Object.entries(s.byAct).forEach(([a,g])=>rows.push([a,g.k==='is'?'ค้นคว้าอิสระ':'กิจกรรม','','','',g.n]));}
  return rows;}
function addSheet(wb,rows,name,used,grid){const ws=XLSX.utils.aoa_to_sheet(rows);
  if(grid){ws['!cols']=[{wch:10},{wch:12},...TIMES.map(()=>({wch:24})),{wch:12}];ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:10}},{s:{r:1,c:0},e:{r:1,c:10}}];}
  else ws['!cols']=rows[1]?rows[1].map((_,i)=>({wch:i===1?30:14})):[];
  let n=String(name).replace(/[\\\/\?\*\[\]:]/g,'-').slice(0,31)||'Sheet',b=n,k=2;while(used.has(n)){n=(b.slice(0,28)+'-'+k++);}used.add(n);
  XLSX.utils.book_append_sheet(wb,ws,n);}
function sheetName(it){if(it.ctx==='teacher'){const t=TU(it.key);return`${t.code} ${tShort(t)}`;}return(it.ctx==='class'?'ม.':'ห้อง ')+it.key;}
async function doXLSX(scope,opt){
  if(IS_ARTIFACT){toast('การดาวน์โหลดใช้ได้ในเวอร์ชันเว็บไซต์ (GitHub Pages) · ใช้ปุ่มคัดลอกไปวางใน Excel แทนได้');return;}
  try{await loadXLSX();}catch(e){toast('โหลดเครื่องมือ Excel ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ต');return;}
  const wb=XLSX.utils.book_new(),used=new Set();
  if(scope==='summary'||(scope==='cur'&&V.view==='load')){const keep=V.sumtab;
    [['teachers','สรุปรายคน'],['classes','สรุปรายชั้น'],['rooms','สรุปรายห้อง']].forEach(([k,nm])=>{V.sumtab=k;const T=sumTable();addSheet(wb,[[T.title+' · '+settings().term],T.head,...T.rows.map(r=>r.cells)],nm,used,false);});V.sumtab=keep;}
  else{const its=itemsFor(scope);if(!its.length){toast('ยังไม่ได้เลือกตาราง');return;}its.forEach(it=>addSheet(wb,sheetRows(it,opt),sheetName(it),used,true));}
  const lbl={cur:'',teachers:'ครูทุกคน',classes:'ทุกชั้น',rooms:'ทุกห้อง',summary:'สรุปข้อมูล',pickT:'ครูที่เลือก',pickC:'ชั้นที่เลือก'}[scope];
  const one=scope==='cur'&&curItem();
  const buf=XLSX.write(wb,{bookType:'xlsx',type:'array'});
  downloadBlob(`ตาราง-${one?sheetName(one).replace(/[\\\/]/g,'-'):lbl||'ข้อมูล'}-${stamp()}.xlsx`,new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));toast('ดาวน์โหลดไฟล์ Excel แล้ว');}
function downloadJSON(){if(IS_ARTIFACT){toast('การดาวน์โหลดใช้ได้ในเวอร์ชันเว็บไซต์ · ใช้ "คัดลอกข้อมูลทั้งหมด" แทนได้');return;}
  downloadBlob(`timetable-backup-${stamp()}.json`,new Blob([JSON.stringify(DB)],{type:'application/json'}));toast('ดาวน์โหลดไฟล์สำรองแล้ว');}

/* --- dialog --- */
function renderExp(){const c=curItem(),opts=[];
  if(c&&c.key)opts.push(['cur',c.ctx==='teacher'?`ตารางของ${tShort(TU(c.key))}`:c.ctx==='class'?`ตารางเรียน ม.${c.key}`:`ตารางห้อง ${c.key}`]);
  else opts.push(['cur',V.view==='load'?'สรุปข้อมูล (หน้านี้)':'หน้านี้']);
  opts.push(['teachers',`ครูทุกคน (${DB.teachers.length})`],['classes',`ทุกชั้น (${DB.classes.length})`],['rooms',`ทุกห้อง (${DB.rooms.length})`],['summary','สรุปรายคน / ชั้น / ห้อง'],['pickT','เลือกครูเอง'],['pickC','เลือกชั้นเอง']);
  if(!opts.some(o=>o[0]===EX.scope))EX.scope='cur';
  $('#expScope').innerHTML=opts.map(([k,l])=>`<button type="button" class="opt" data-exs="${k}" aria-pressed="${k===EX.scope}">${esc(l)}</button>`).join('');
  const pk=EX.scope==='pickT'?tSorted().map(t=>[t.uid,t.code+' '+tShort(t)]):EX.scope==='pickC'?DB.classes.map(c=>c.id).sort(sortCls).map(k=>[k,'ม.'+k]):[];
  $('#expPick').hidden=!pk.length;
  $('#expPick').innerHTML=pk.length?`<button type="button" data-exa="1">เลือกทั้งหมด</button>`+pk.map(([k,l])=>`<button type="button" data-exk="${esc(k)}" aria-pressed="${EX.pick.has(k)}">${esc(l)}</button>`).join(''):'';
  const generic=EX.scope==='cur'&&!GRIDV.includes(V.view)&&V.view!=='load';
  $('#dlgExp [data-exp="xlsx"]').disabled=generic;
  const n=EX.scope==='summary'||(EX.scope==='cur'&&!c)?0:itemsFor(EX.scope).length;
  $('#expNote').textContent=(IS_ARTIFACT?'หน้านี้เป็นตัวอย่าง การพิมพ์และดาวน์โหลดใช้ได้เมื่อเปิดจากเว็บไซต์ของโรงเรียน (GitHub Pages) · ':'')+`กระดาษ A4 แนวนอน หน้าละ 1 ตาราง${n>1?` · ${n} หน้า`:''} · บันทึกเป็น PDF ได้โดยเลือกเครื่องพิมพ์ "บันทึกเป็น PDF"`+(generic?' · หน้านี้พิมพ์ได้อย่างเดียว':'');}
$('#btnExp').onclick=()=>{EX.scope='cur';EX.pick.clear();renderExp();$('#dlgExp').showModal();};
$('#dlgExp').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const D=b.dataset;
  if(D.exs){EX.scope=D.exs;EX.pick.clear();if(D.exs==='pickT'&&V.view==='teacher')EX.pick.add(V.t);if(D.exs==='pickC'&&V.view==='class')EX.pick.add(V.c);return renderExp();}
  if(D.exk){EX.pick.has(D.exk)?EX.pick.delete(D.exk):EX.pick.add(D.exk);return renderExp();}
  if(D.exa){(EX.scope==='pickT'?tSorted().map(t=>t.uid):DB.classes.map(c=>c.id)).forEach(k=>EX.pick.add(k));return renderExp();}
  const opt={sum:$('#expSum').checked,sig:$('#expSig').checked};
  if(D.exp==='close')return $('#dlgExp').close();
  if(D.exp==='json')return downloadJSON();
  if(D.exp==='xlsx')return doXLSX(EX.scope,opt);
  if(D.exp==='print'){let pages;
    if(EX.scope==='summary'||(EX.scope==='cur'&&V.view==='load'))pages=summaryPages();
    else if(EX.scope==='cur'&&!curItem())pages=[pageHead(TITLES[V.view])+`<div class="pgen">${$('#view').innerHTML}</div>`];
    else{const its=itemsFor(EX.scope);if(!its.length){toast('ยังไม่ได้เลือกตาราง');return;}pages=its.map(it=>pageHTML(it,opt));}
    $('#dlgExp').close();doPrint(pages);}
});

/* --- settings (data tab) --- */
function settingsHTML(){const S=settings(),f=(k,l,ph)=>`<div class="field"><label for="st_${k}">${l}</label><input id="st_${k}" data-set="${k}" value="${esc(S[k])}" placeholder="${esc(ph||'')}"></div>`;
  return`<div class="sheet"><div class="sheet-head"><div><h2>ตั้งค่าเอกสาร</h2><div class="meta">ใช้เป็นหัวกระดาษและช่องลงนามเมื่อพิมพ์หรือดาวน์โหลด</div></div></div>
    <div class="form-grid">${f('school','ชื่อโรงเรียน')}${f('group','กลุ่มสาระการเรียนรู้')}${f('term','ภาคเรียน / ปีการศึกษา')}${f('head','หัวหน้ากลุ่มสาระฯ','ชื่อ-นามสกุล')}${f('deputy','รองผู้อำนวยการกลุ่มบริหารวิชาการ','ชื่อ-นามสกุล')}${f('director','ผู้อำนวยการโรงเรียน','ชื่อ-นามสกุล')}</div></div>`;}
$('#view').addEventListener('change',e=>{const t=e.target;if(!t.dataset.set)return;const k=t.dataset.set,v=t.value.trim();if(settings()[k]===v)return;mutate(()=>{settings()[k]=v;return'บันทึกการตั้งค่าแล้ว';});});
$('#view').addEventListener('click',e=>{if(e.target.closest('#bkDl'))downloadJSON();});
