const LS2='wr-ftt-2569-2-v2', LS1='wr-ftt-2569-2';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let DB=null, V={view:'teacher',t:'t0905',c:'',r:'',day:Math.min(4,Math.max(0,new Date().getDay()-1)),fd:0,fp:0,dtab:'teachers'};
try{const r=localStorage.getItem(LS2); if(r){const o=JSON.parse(r); if(o.db&&Array.isArray(o.db.lessons))DB=o.db; if(o.v)Object.assign(V,o.v);}
  else{const r1=localStorage.getItem(LS1); if(r1){const o=JSON.parse(r1); if(Array.isArray(o.teachers)&&o.teachers[0]?.slots)DB=fromTeacherSlots(o.teachers);}}}catch(e){}
if(!DB)DB=seedDB();
let UNDO=[],REDO=[],IDX=null,C={list:[],flag:new Set()},MOVE=null,DRAG=null,IMP=null;
function persist(){try{localStorage.setItem(LS2,JSON.stringify({db:DB,v:V}));}catch(e){}}

/* ---------- helpers ---------- */
const TU=u=>DB.teachers.find(t=>t.uid===u);
const LB=id=>DB.lessons.find(L=>L.id===id);
const tShort=t=>!t?'?':/^(นางสาว|นาย|นาง)/.test(t.name)?'ครู'+t.name.replace(/^(นางสาว|นาย|นาง)/,'').split(' ')[0]:t.name.split(' ')[0];
const tSorted=()=>[...DB.teachers].sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true}));
const subjOf=c=>DB.subjects.find(s=>s.code===c);
function subjInfo(code){
  const g={'อ':'ภาษาอังกฤษ','จ':'ภาษาจีน','ญ':'ภาษาญี่ปุ่น','ส':'สังคมศึกษาฯ','ฝ':'ภาษาฝรั่งเศส','ก':'ภาษาเกาหลี'}[code?.[0]];
  const m=String(code||'').match(/^\D(\d)(\d)(\d)\d\d$/);
  if(isNative(code))return'สอนโดยครูต่างชาติ';
  if(!g||!m)return'';
  const lv=m[1]==='2'?+m[2]:m[1]==='3'?+m[2]+3:0;
  return `${g} · ${m[3]==='1'?'พื้นฐาน':'เพิ่มเติม'}${lv?' · ม.'+lv:''}`;
}
const subjTitle=c=>{const s=subjOf(c);return (s&&s.name)||subjInfo(c)||'';};
function kind(L){if(L.type==='act')return /^ค้นคว้า/.test(L.act)?'k-is':'k-act';const c=L.code||'';
  if(isNative(c))return'k-nat'; const m=c.match(/^\D\d\d(\d)/);
  if(c[0]==='อ')return m&&m[1]==='2'?'k-en2':'k-en1'; if(c[0]==='จ')return'k-zh'; if(c[0]==='ญ')return'k-ja'; if(c[0]==='ส')return'k-so'; return'k-act';}
const codeLabel=c=>c==='Ind.Study'?'Ind. Study':c;
const lLabel=L=>L.type==='act'?L.act:`${codeLabel(L.code)} ${L.cls}`;
function clsKey(c){const m=String(c).match(/^(\d+)\/(\d+)(.*)$/);return m?[+m[1],+m[2],m[3]]:[99,99,String(c)];}
const sortCls=(a,b)=>{const x=clsKey(a),y=clsKey(b);return x[0]-y[0]||x[1]-y[1]||x[2].localeCompare(y[2]);};
const numSort=(a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true});
function buildIdx(){IDX=Array.from({length:5},()=>Array.from({length:NP},()=>[]));DB.lessons.forEach(L=>{if(IDX[L.d]&&IDX[L.d][L.p])IDX[L.d][L.p].push(L);});}

function toast(msg,undoable){document.querySelectorAll('.toast').forEach(x=>x.remove());
  const el=document.createElement('div');el.className='toast'+(undoable?'':' plain');el.innerHTML=`<span>${esc(msg)}</span>`;
  if(undoable){const b=document.createElement('button');b.textContent='เลิกทำ';b.onclick=()=>{undo();el.remove();};el.appendChild(b);}
  document.body.appendChild(el);setTimeout(()=>el.remove(),undoable?5000:2400);}
function copyText(t,ok){const done=()=>toast(ok||'คัดลอกแล้ว');
  try{navigator.clipboard.writeText(t).then(done,()=>fallback());}catch(e){fallback();}
  function fallback(){const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();let s=false;try{s=document.execCommand('copy');}catch(e){}ta.remove();toast(s?(ok||'คัดลอกแล้ว'):'คัดลอกไม่ได้ในหน้านี้');}}

/* ---------- mutations ---------- */
function mutate(fn){if(window.canEdit&&!canEdit()){toast('เข้าสู่ระบบด้วยบัญชีผู้แก้ไขก่อน จึงจะแก้ไขได้');return;}const snap=JSON.stringify(DB);const msg=fn();if(msg===false)return;
  UNDO.push(snap);if(UNDO.length>80)UNDO.shift();REDO=[];render();if(msg)toast(msg,true);window.onDBChange&&onDBChange();}
function undo(){if(!UNDO.length||(window.canEdit&&!canEdit()))return;REDO.push(JSON.stringify(DB));DB=JSON.parse(UNDO.pop());render();window.onDBChange&&onDBChange();}
function redo(){if(!REDO.length||(window.canEdit&&!canEdit()))return;UNDO.push(JSON.stringify(DB));DB=JSON.parse(REDO.pop());render();toast('ทำซ้ำแล้ว');window.onDBChange&&onDBChange();}
function ensureCatalog(o){
  if(o.type!=='subj')return;
  if(o.code&&!subjOf(o.code))DB.subjects.push({code:o.code,name:''});
  if(o.room&&!DB.rooms.some(r=>r.id===o.room))DB.rooms.push({id:o.room,note:''});
  if(o.cls&&!DB.classes.some(c=>c.id===o.cls))DB.classes.push({id:o.cls,room:o.room||''});
}
function viewFilter(rowTid){
  if(V.view==='teacher')return L=>L.tids.includes(V.t);
  if(V.view==='class')return L=>inClass(L,V.c);
  if(V.view==='room')return L=>L.type==='subj'&&L.room===V.r;
  if(V.view==='day'&&rowTid)return L=>L.tids.includes(rowTid);
  return null;
}
function doMove(lid,fromTid,d,p,toTid){
  const L=LB(lid);if(!L)return;
  const reassign=toTid&&fromTid&&toTid!==fromTid;
  if(L.d===d&&L.p===p&&!reassign)return;
  mutate(()=>{const sd=L.d,sp=L.p;
    const f=reassign?null:viewFilter(toTid);
    const sw=f?DB.lessons.filter(x=>x!==L&&x.d===d&&x.p===p&&f(x)):[];
    sw.forEach(x=>{x.d=sd;x.p=sp;});
    L.d=d;L.p=p;
    if(reassign)L.tids=[...new Set(L.tids.map(x=>x===fromTid?toTid:x))];
    return sw.length?`สลับ ${lLabel(L)} กับ ${sw.map(lLabel).join(', ')}`:reassign?`ย้าย ${lLabel(L)} ไปให้${tShort(TU(toTid))} · วัน${DAYS[d]} คาบ ${p+1}`:`ย้าย ${lLabel(L)} ไปวัน${DAYS[d]} คาบ ${p+1}`;});
}

/* ---------- grid ---------- */
function chipHTML(L,mode,rowTid){
  const bad=C.flag.has(L.id)?' bad':'', src=MOVE&&MOVE.lid===L.id?' src':'';
  const attrs=`class="lz ${kind(L)}${bad}${src}${L.type==='act'?' act-t':''}${L.lock?' locked':''}" draggable="true" tabindex="0" data-lid="${L.id}"${rowTid?` data-row="${rowTid}"`:''} title="${esc(L.type==='act'?L.act+' · '+L.tids.map(u=>tShort(TU(u))).join(', '):subjTitle(L.code)+' · '+L.tids.map(u=>tShort(TU(u))).join(' + '))}"`;
  if(L.type==='act'){
    if(mode==='mini')return`<div ${attrs}><b>${esc(L.act.split(' ')[0])}</b></div>`;
    return`<div ${attrs}><span>${esc(L.act)}</span>${mode==='teacher'&&L.tids.length>1?`<span class="with">+${L.tids.length-1} คน</span>`:''}</div>`;}
  const names=u=>u.map(x=>tShort(TU(x))).join(' + ');
  if(mode==='mini')return`<div ${attrs}><b>${esc(L.cls)}</b></div>`;
  if(mode==='teacher'){const others=L.tids.filter(x=>x!==V.t);
    return`<div ${attrs}><b>${esc(codeLabel(L.code))}</b><span>${esc(L.cls)}</span><i>${esc(L.room)}</i>${others.length?`<span class="with">ร่วม ${esc(names(others))}</span>`:''}</div>`;}
  if(mode==='class')return`<div ${attrs}><b>${esc(codeLabel(L.code))}</b><span>${esc(names(L.tids))}</span><i>ห้อง ${esc(L.room)}</i></div>`;
  return`<div ${attrs}><b>${esc(codeLabel(L.code))}</b><span>ม.${esc(L.cls)}</span><i>${esc(names(L.tids))}</i></div>`;
}
function grid(filter,mode){
  let h='<div class="tt-wrap"><table class="tt"><thead><tr><th class="corner">ชั่วโมงที่</th><th class="hr">โฮมรูม<span>08.20–08.50</span></th>';
  TIMES.forEach((t,i)=>h+=`<th>${i+1}<span>${t}</span></th>`);
  h+='<th class="plc">9<span>15.30–16.20</span></th></tr></thead><tbody>';
  for(let d=0;d<5;d++){h+=`<tr><th class="day">${DAYS[d]}<small>${DAYS_EN[d]}</small></th><td class="hr">โฮมรูม</td>`;
    for(let p=0;p<NP;p++){const Ls=IDX[d][p].filter(filter);
      h+=`<td class="cell${Ls.length?'':' empty'}" data-d="${d}" data-p="${p}" tabindex="0" aria-label="${DAYS[d]} คาบ ${p+1}">${Ls.length?'<div class="stack">'+Ls.map(L=>chipHTML(L,mode)).join('')+'</div>':'<span class="plus">+</span>'}</td>`;}
    h+='<td class="plc">PLC</td></tr>';}
  return h+'</tbody></table></div>';
}
function gridTSV(title,filter,txt){
  const rows=[[title],['วัน',...TIMES.map((t,i)=>`คาบ ${i+1} (${t})`),'คาบ 9']];
  for(let d=0;d<5;d++)rows.push([DAYS[d],...IDX[d].map(Ls=>Ls.filter(filter).map(txt).join(' / ')),'PLC']);
  return rows.map(r=>r.join('\t')).join('\n');
}

/* ---------- views ---------- */
const TITLES={teacher:'ตารางสอนรายบุคคล',class:'ตารางเรียนรายชั้น',room:'ตารางการใช้ห้อง',day:'ภาพรวมรายวัน',load:'สรุปข้อมูล',sub:'สอนแทนและแลกคาบ',auto:'จัดตารางอัตโนมัติ',data:'จัดการข้อมูล'};
function render(){
  buildIdx(); C=findConflicts(DB); persist();
  document.querySelectorAll('#nav button').forEach(b=>b.setAttribute('aria-current',b.dataset.view===V.view));
  $('#viewTitle').innerHTML=esc(TITLES[V.view])+'<small>'+esc(settings().term)+'</small>';
  $('#btnUndo').disabled=!UNDO.length; $('#btnRedo').disabled=!REDO.length;
  const b=$('#conflictBadge'),n=C.list.length; b.className='badge '+(n?'bad':'ok'); b.textContent=n?`พบคาบชน ${n} จุด`:'✓ ไม่มีคาบชน';
  $('#moveBanner').hidden=!MOVE; document.body.classList.toggle('moving-on',!!MOVE);
  if(MOVE){const L=LB(MOVE.lid);$('#moveText').textContent=L?`กำลังย้าย "${lLabel(L)}" — แตะช่องปลายทางในตาราง`:'';}
  $('#btnNew').hidden=['data','load','sub','auto'].includes(V.view);
  renderPicker(); renderView(); refreshLists(); (window.AFTER||[]).forEach(f=>f());
}
function renderPicker(){
  const pk=$('#picker');
  if(V.view==='teacher'){if(!TU(V.t))V.t=tSorted()[0]?.uid||'';
    pk.innerHTML='<div class="chips">'+tSorted().map(t=>`<button class="chip" data-pick-t="${t.uid}" aria-pressed="${t.uid===V.t}"><span class="code">${esc(t.code)}</span>${esc(tShort(t))}</button>`).join('')+'</div>';}
  else if(V.view==='class'){const cs=DB.classes.map(c=>c.id).sort(sortCls);if(!cs.includes(V.c))V.c=cs[0]||'';
    const lv={};cs.forEach(c=>(lv[clsKey(c)[0]]??=[]).push(c));
    pk.innerHTML=Object.entries(lv).map(([l,a])=>`<div class="chips"><span class="lvl">${l<99?'ม.'+l:'อื่น ๆ'}</span>${a.map(c=>`<button class="chip" data-pick-c="${esc(c)}" aria-pressed="${c===V.c}">${esc(c)}</button>`).join('')}</div>`).join('');}
  else if(V.view==='room'){const rs=DB.rooms.map(r=>r.id).sort(numSort);if(!rs.includes(V.r))V.r=rs[0]||'';
    pk.innerHTML='<div class="chips">'+rs.map(r=>`<button class="chip" data-pick-r="${esc(r)}" aria-pressed="${r===V.r}">${esc(r)}</button>`).join('')+'</div>';}
  else if(V.view==='day')pk.innerHTML='<div class="chips">'+DAYS.map((d,i)=>`<button class="chip" data-pick-d="${i}" aria-pressed="${i===V.day}">${d}</button>`).join('')+'</div>';
  else if(V.view==='sub')pk.innerHTML=subPickerHTML();
  else if(V.view==='load')pk.innerHTML=sumPickerHTML();
  else if(V.view==='data')pk.innerHTML='<div class="subtabs">'+[['teachers','ครู'],['subjects','รายวิชา'],['classes','ชั้นเรียน'],['rooms','ห้องเรียน'],['import','เพิ่มคาบจำนวนมาก'],['backup','สำรอง / กู้คืน'],['settings','ตั้งค่าเอกสาร']].map(([k,l])=>`<button class="chip" data-dtab="${k}" aria-pressed="${k===V.dtab}">${l}</button>`).join('')+'</div>';
  else pk.innerHTML='';
}
function countFor(filter){let n=0,a=0;DB.lessons.forEach(L=>{if(filter(L)){L.type==='act'?a++:n++;}});return{n,a};}
function renderView(){
  const m=$('#view');
  if(V.view==='teacher'){const t=TU(V.t);if(!t){m.innerHTML='<div class="sheet"><p class="note">ยังไม่มีครูในระบบ เพิ่มได้ที่ "จัดการข้อมูล"</p></div>';return;}
    const f=L=>L.tids.includes(t.uid),{n,a}=countFor(f);
    const subs=[...new Set(DB.lessons.filter(L=>f(L)&&L.type==='subj').map(L=>L.code))].sort();
    const used=new Set(DB.lessons.filter(f).map(L=>L.d+'|'+L.p)).size;
    m.innerHTML=`<div class="sheet"><div class="sheet-head"><div><h2><span class="code">${esc(t.code)}</span>${esc(t.name)}</h2>
      <div class="meta">รายวิชา: ${subs.map(esc).join(', ')||'—'}</div></div>
      <div class="row"><div class="stats"><span><b>${n}</b>คาบสอน</span><span><b>${a}</b>กิจกรรม/ค้นคว้า</span></div>
      <button class="btn sm" data-copy="grid">คัดลอกไปวางใน Excel</button></div></div>
      ${grid(f,'teacher')}${sumHTML('teacher',t.uid)}
      <div class="note">ลากคาบไปช่องว่างเพื่อย้าย · วางทับคาบอื่นเพื่อสลับ · แตะคาบเพื่อแก้ไข · แตะช่องว่างเพื่อเพิ่ม</div>${subNoticeHTML(t.uid)}</div>`;}
  else if(V.view==='class'||V.view==='room'){const isC=V.view==='class',key=isC?V.c:V.r;
    if(!key){m.innerHTML='<div class="sheet"><p class="note">ยังไม่มีข้อมูล เพิ่มได้ที่ "จัดการข้อมูล"</p></div>';return;}
    const f=viewFilter(),{n}=countFor(f),cl=isC?DB.classes.find(c=>c.id===key):null,rm=!isC?DB.rooms.find(r=>r.id===key):null;
    m.innerHTML=`<div class="sheet"><div class="sheet-head"><div><h2>${isC?'ชั้น ม.'+esc(key):'ห้อง '+esc(key)}</h2>
      <div class="meta">${isC?'ห้องประจำ '+esc(cl?.room||'—'):esc(rm?.note||'')} · เฉพาะรายวิชาของกลุ่มสาระฯ</div></div>
      <div class="row"><div class="stats"><span><b>${n}</b>คาบ/สัปดาห์</span></div><button class="btn sm" data-copy="grid">คัดลอกไปวางใน Excel</button></div></div>
      ${grid(f,isC?'class':'room')}${sumHTML(V.view,key)}
      <div class="note">ลากเพื่อย้ายหรือสลับคาบ · แตะช่องว่างเพื่อเพิ่มคาบให้${isC?'ชั้นนี้':'ห้องนี้'}</div></div>`;}
  else if(V.view==='day')m.innerHTML=dayHTML();
  else if(V.view==='load')m.innerHTML=sumPageHTML();
  else if(V.view==='sub')m.innerHTML=subHTML();
  else if(V.view==='auto')m.innerHTML=autoHTML();
  else m.innerHTML=dataHTML();
}
function dayHTML(){const d=V.day;
  let h=`<div class="sheet"><div class="sheet-head"><div><h2>วัน${DAYS[d]}</h2><div class="meta">ครูทุกคน × คาบ 1–8 · ลากคาบไปแถวครูคนอื่นเพื่อเปลี่ยนผู้สอน</div></div></div>
    <div class="tt-wrap"><table class="tt ov"><thead><tr><th class="corner">ครู</th>${TIMES.map((t,p)=>`<th>${p+1}<span>${t}</span></th>`).join('')}</tr></thead><tbody>`;
  tSorted().forEach(t=>{h+=`<tr><th title="${esc(t.name)}"><span class="code">${esc(t.code)}</span>${esc(tShort(t))}</th>`;
    for(let p=0;p<NP;p++){const Ls=IDX[d][p].filter(L=>L.tids.includes(t.uid));
      h+=`<td class="cell${Ls.length?'':' empty'}" data-d="${d}" data-p="${p}" data-row="${t.uid}" tabindex="0">${Ls.length?'<div class="stack">'+Ls.map(L=>chipHTML(L,'mini',t.uid)).join('')+'</div>':'<span class="plus">+</span>'}</td>`;}
    h+='</tr>';});
  h+=`</tbody><tfoot><tr><th>ครูว่าง (คน)</th>${TIMES.map((_,p)=>`<td>${DB.teachers.filter(t=>!IDX[d][p].some(L=>L.tids.includes(t.uid))).length}</td>`).join('')}</tr></tfoot></table></div></div>`;
  const fd=V.fd,fp=V.fp,free=tSorted().filter(t=>!IDX[fd][fp].some(L=>L.tids.includes(t.uid))).map(t=>({t,n:IDX[fd].filter(Ls=>Ls.some(L=>L.tids.includes(t.uid))).length})).sort((a,b)=>a.n-b.n);
  h+=`<div class="sheet"><div class="sheet-head"><div><h2>หาครูสอนแทน</h2><div class="meta">ครูที่ว่างในคาบที่เลือก เรียงจากคนที่มีคาบน้อยที่สุดในวันนั้น · แตะชื่อเพื่อจัดคาบ</div></div></div>
    <div class="row"><label for="fDay">วัน</label><select class="sel" id="fDay">${DAYS.map((x,i)=>`<option value="${i}" ${i===fd?'selected':''}>${x}</option>`).join('')}</select>
    <label for="fPer">คาบ</label><select class="sel" id="fPer">${TIMES.map((x,i)=>`<option value="${i}" ${i===fp?'selected':''}>คาบ ${i+1} (${x})</option>`).join('')}</select></div>
    <div class="free-list">${free.map(x=>`<button data-free="${x.t.uid}">${esc(tShort(x.t))}<small>${x.n} คาบในวัน${DAYS[fd]}</small></button>`).join('')||'<span class="note">ไม่มีครูว่างในคาบนี้</span>'}</div></div>`;
  return h;}
function loadHTML(){
  const rows=tSorted().map(t=>{const f=L=>L.tids.includes(t.uid),c=countFor(f);return{t,...c,co:DB.lessons.filter(L=>f(L)&&L.type==='subj'&&L.tids.length>1).length,days:[0,1,2,3,4].map(d=>IDX[d].filter(Ls=>Ls.some(L=>L.type==='subj'&&f(L))).length)};}).sort((a,b)=>b.n-a.n);
  const max=Math.max(1,...rows.map(r=>r.n)),sum=rows.reduce((s,r)=>s+r.n,0);
  return`<div class="sheet"><div class="sheet-head"><div><h2>ภาระงานสอนต่อสัปดาห์</h2><div class="meta">นับคาบสอนรายวิชา ไม่รวมโฮมรูมและ PLC · คาบสอนร่วมนับให้ครูทุกคนในคาบ</div></div>
    <div class="stats"><span><b>${DB.teachers.length}</b>ครู</span><span><b>${(sum/Math.max(1,rows.length)).toFixed(1)}</b>คาบเฉลี่ย/คน</span></div></div>
    <div class="tt-wrap" style="border:0"><table class="dt"><thead><tr><th>รหัส</th><th>ชื่อ</th><th class="num">คาบสอน</th><th>สัดส่วน</th><th class="num">สอนร่วม</th><th class="num">กิจกรรม</th><th>จ อ พ พฤ ศ</th></tr></thead><tbody>
    ${rows.map(r=>`<tr class="click" data-open-t="${r.t.uid}"><td>${esc(r.t.code)}</td><td>${esc(r.t.name)}</td><td class="num"><b>${r.n}</b></td><td><div class="bar-m"><i style="width:${r.n/max*100}%"></i></div></td><td class="num">${r.co}</td><td class="num">${r.a}</td><td><div class="days">${r.days.map(x=>`<i>${x}</i>`).join('')}</div></td></tr>`).join('')}
    </tbody></table></div></div>`;}

/* ---------- data management ---------- */
const BULK={teachers:['รหัส ชื่อ-นามสกุล','0916 นางสาวสมใจ ใจดี\n0917 นายวิชัย รักเรียน'],subjects:['รหัสวิชา ชื่อวิชา','อ21104 ภาษาอังกฤษ 4\nอ22202 การอ่านภาษาอังกฤษ'],classes:['ชั้น ห้องประจำ','1/9 433\n2/9 449'],rooms:['ห้อง หมายเหตุ','450 ห้องปฏิบัติการทางภาษา\n451']};
function dataHTML(){const k=V.dtab;
  if(k==='import')return importHTML(); if(k==='backup')return backupHTML(); if(k==='settings')return settingsHTML();
  let rows='',head='',title='';
  if(k==='teachers'){title='ครูผู้สอน';head='<th style="width:110px">รหัส</th><th>ชื่อ-นามสกุล</th><th class="num">คาบ</th><th></th>';
    rows=tSorted().map(t=>`<tr><td><input data-ent="t" data-key="${t.uid}" data-f="code" value="${esc(t.code)}" aria-label="รหัสครู"></td><td><input data-ent="t" data-key="${t.uid}" data-f="name" value="${esc(t.name)}" aria-label="ชื่อครู"></td><td class="num">${DB.lessons.filter(L=>L.tids.includes(t.uid)).length}</td><td class="act"><button class="btn sm" data-open-t="${t.uid}">ตาราง</button> <button class="btn sm danger" data-del="t" data-key="${t.uid}">ลบ</button></td></tr>`).join('');}
  if(k==='subjects'){title='รายวิชา';head='<th style="width:130px">รหัสวิชา</th><th>ชื่อวิชา</th><th>ประเภท</th><th class="num">คาบ</th><th></th>';
    rows=[...DB.subjects].sort((a,b)=>numSort(a.code,b.code)).map(s=>`<tr><td><input data-ent="s" data-key="${esc(s.code)}" data-f="code" value="${esc(s.code)}" aria-label="รหัสวิชา"></td><td><input data-ent="s" data-key="${esc(s.code)}" data-f="name" value="${esc(s.name)}" placeholder="ระบุชื่อวิชา" aria-label="ชื่อวิชา"></td><td class="note">${esc(subjInfo(s.code))}</td><td class="num">${DB.lessons.filter(L=>L.code===s.code).length}</td><td class="act"><button class="btn sm danger" data-del="s" data-key="${esc(s.code)}">ลบ</button></td></tr>`).join('');}
  if(k==='classes'){title='ชั้นเรียน';head='<th style="width:130px">ชั้น/ห้อง</th><th>ห้องประจำ (เติมให้อัตโนมัติเมื่อจัดคาบ)</th><th class="num">คาบ</th><th></th>';
    rows=[...DB.classes].sort((a,b)=>sortCls(a.id,b.id)).map(c=>`<tr><td><input data-ent="c" data-key="${esc(c.id)}" data-f="id" value="${esc(c.id)}" aria-label="ชั้น"></td><td><input data-ent="c" data-key="${esc(c.id)}" data-f="room" value="${esc(c.room)}" list="dlRoom" aria-label="ห้องประจำ"></td><td class="num">${DB.lessons.filter(L=>L.cls===c.id).length}</td><td class="act"><button class="btn sm" data-open-c="${esc(c.id)}">ตาราง</button> <button class="btn sm danger" data-del="c" data-key="${esc(c.id)}">ลบ</button></td></tr>`).join('');}
  if(k==='rooms'){title='ห้องเรียน';head='<th style="width:130px">ห้อง</th><th>หมายเหตุ</th><th class="num">คาบ</th><th></th>';
    rows=[...DB.rooms].sort((a,b)=>numSort(a.id,b.id)).map(r=>`<tr><td><input data-ent="r" data-key="${esc(r.id)}" data-f="id" value="${esc(r.id)}" aria-label="ห้อง"></td><td><input data-ent="r" data-key="${esc(r.id)}" data-f="note" value="${esc(r.note)}" placeholder="เช่น ห้อง Sound Lab" aria-label="หมายเหตุ"></td><td class="num">${DB.lessons.filter(L=>L.room===r.id).length}</td><td class="act"><button class="btn sm" data-open-r="${esc(r.id)}">ตาราง</button> <button class="btn sm danger" data-del="r" data-key="${esc(r.id)}">ลบ</button></td></tr>`).join('');}
  return`<div class="two"><div class="sheet"><div class="sheet-head"><div><h2>${title}</h2><div class="meta">แก้ไขในช่องได้ทันที การเปลี่ยนรหัสจะอัปเดตทุกคาบที่เกี่ยวข้อง</div></div></div>
    <div class="tt-wrap" style="border:0"><table class="dt"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div></div>
    <div class="sheet"><div class="sheet-head"><div><h2>เพิ่มหลายรายการ</h2><div class="meta">บรรทัดละ 1 รายการ: ${BULK[k][0]}</div></div></div>
    <textarea class="ta" id="bulkTa" placeholder="${esc(BULK[k][1])}"></textarea>
    <div class="row"><button class="btn primary" data-bulk="${k}">เพิ่มทั้งหมด</button><span class="note">รายการที่ซ้ำกับของเดิมจะถูกข้าม</span></div></div></div>`;}
function importHTML(){
  let pv='';
  if(IMP){pv=`<div class="tt-wrap" style="border:0"><table class="dt"><thead><tr><th>บรรทัด</th><th>วัน</th><th>คาบ</th><th>รายการ</th><th>ครู</th><th>สถานะ</th></tr></thead><tbody>${IMP.rows.map(r=>`<tr><td>${r.line}</td><td>${r.ok?DAYS[r.d]:''}</td><td>${r.ok?r.p+1:''}</td><td>${r.ok?esc(r.type==='act'?r.act:r.code+' '+r.cls+' ห้อง '+r.room):esc(r.src)}</td><td>${r.ok?esc(r.tids.map(u=>tShort(TU(u))).join(' + ')):''}</td><td>${r.ok?'<span class="pill ok">พร้อม</span>':`<span class="pill bad">${esc(r.err)}</span>`}</td></tr>`).join('')}</tbody></table></div>
    <div class="row"><button class="btn primary" id="impGo" ${IMP.rows.some(r=>r.ok)?'':'disabled'}>เพิ่ม ${IMP.rows.filter(r=>r.ok).length} คาบ</button><span class="note">บรรทัดที่มีปัญหาจะถูกข้าม</span></div>`;}
  return`<div class="sheet"><div class="sheet-head"><div><h2>เพิ่มคาบจำนวนมาก</h2><div class="meta">วางข้อมูลบรรทัดละ 1 คาบ คั่นด้วยช่องว่าง จุลภาค หรือแท็บ (คัดลอกจาก Excel ได้)</div></div></div>
    <div class="note">รูปแบบ: <b>วัน คาบ รหัสวิชา ชั้น ห้อง ครู</b> · วันใช้ จ อ พ พฤ ศ หรือ 1–5 · คาบใส่ช่วงได้ เช่น 3-4 · ครูหลายคนคั่นด้วย + เช่น 0905+0921<br>กิจกรรม: <b>วัน คาบ !ชื่อกิจกรรม ครู</b> เช่น พ 8 !ชุมนุม 0901+0902</div>
    <textarea class="ta" id="impTa" placeholder="จ 3 อ23102 3/4 443 0905+0921&#10;พฤ 6-7 อ32202 5/5Eng 135 0905&#10;อ 8 !ชุมนุม 0905">${esc(IMP?.text||'')}</textarea>
    <div class="row"><button class="btn" id="impCheck">ตรวจสอบข้อมูล</button></div>${pv}</div>`;}
function backupHTML(){
  return`<div class="two"><div class="sheet"><div class="sheet-head"><div><h2>สำรองข้อมูล</h2><div class="meta">ข้อมูลเก็บไว้ในเบราว์เซอร์นี้ คัดลอกเก็บไว้หรือนำไปเปิดในเครื่องอื่น</div></div></div>
    <div class="row"><button class="btn primary" id="bkDl">ดาวน์โหลดไฟล์ .json</button><button class="btn" id="bkCopy">คัดลอกข้อมูลทั้งหมด</button><button class="btn" id="bkAll">คัดลอกตารางครูทุกคน (Excel)</button></div>
    <div class="note">${DB.teachers.length} ครู · ${DB.subjects.length} รายวิชา · ${DB.classes.length} ชั้น · ${DB.rooms.length} ห้อง · ${DB.lessons.length} คาบ</div></div>
    <div class="sheet"><div class="sheet-head"><div><h2>กู้คืน</h2><div class="meta">วางข้อมูลที่คัดลอกไว้ หรือเลือกไฟล์ .json</div></div></div>
    <textarea class="ta" id="bkTa" placeholder='{"v":2,"teachers":[…]}'></textarea>
    <input type="file" id="bkFile" accept=".json,application/json">
    <div class="row"><button class="btn primary" id="bkLoad">กู้คืนข้อมูล</button><button class="btn danger" id="bkReset">คืนค่าตาม PDF ต้นฉบับ</button></div></div></div>`;}

const DAYMAP={'จ':0,'จันทร์':0,'mon':0,'1':0,'อ':1,'อังคาร':1,'tue':1,'2':1,'พ':2,'พุธ':2,'wed':2,'3':2,'พฤ':3,'พฤหัส':3,'พฤหัสฯ':3,'พฤหัสบดี':3,'thu':3,'4':3,'ศ':4,'ศุกร์':4,'fri':4,'5':4};
function resolveT(tok){return tok.split(/[+]/).map(s=>s.trim()).filter(Boolean).map(s=>{const t=DB.teachers.find(t=>t.code===s)||DB.teachers.find(t=>tShort(t)===s||tShort(t)==='ครู'+s||t.name===s);return t?t.uid:null;});}
function parseImport(text){
  const rows=[];text.split(/\r?\n/).forEach((raw,i)=>{const line=raw.trim();if(!line)return;
    const tk=/[\t,]/.test(line)?line.split(/[\t,]/).map(s=>s.trim()).filter(Boolean):line.split(/\s+/);
    const r={line:i+1,src:line,ok:false};rows.push(r);
    const d=DAYMAP[(tk[0]||'').toLowerCase()];if(d===undefined){r.err='วันไม่ถูกต้อง';return;}
    const pm=(tk[1]||'').match(/^(\d)(?:-(\d))?$/);if(!pm){r.err='คาบไม่ถูกต้อง';return;}
    const p1=+pm[1],p2=pm[2]?+pm[2]:p1;if(p1<1||p2>8||p2<p1){r.err='คาบต้องอยู่ระหว่าง 1–8';return;}
    let base;
    if((tk[2]||'')[0]==='!'){if(tk.length<4){r.err='ข้อมูลไม่ครบ';return;}base={type:'act',act:tk.slice(2,-1).join(' ').slice(1)};}
    else{if(tk.length<6){r.err='ข้อมูลไม่ครบ 6 ช่อง';return;}base={type:'subj',code:tk[2],cls:tk[3],room:tk[4]};}
    const tids=resolveT(tk[tk.length-1]);if(!tids.length||tids.includes(null)){r.err='ไม่พบรหัสครู';return;}
    rows.pop();for(let p=p1;p<=p2;p++)rows.push({...r,...base,d,p:p-1,tids,ok:true});});
  return rows;}

function applyEdit(ent,key,f,val){val=val.trim();
  if(ent==='t'){const t=TU(key);if(!t)return;
    if(f==='code'){if(!val||DB.teachers.some(x=>x!==t&&x.code===val)){toast('รหัสครูว่างหรือซ้ำ');return render();}}
    if(!val){toast('ช่องนี้ต้องไม่ว่าง');return render();}
    return mutate(()=>{t[f]=val;return'บันทึกข้อมูลครูแล้ว';});}
  if(ent==='s'){const s=subjOf(key);if(!s)return;
    if(f==='code'){if(!val||(val!==key&&subjOf(val))){toast('รหัสวิชาว่างหรือซ้ำ');return render();}
      return mutate(()=>{DB.lessons.forEach(L=>{if(L.code===key)L.code=val;});s.code=val;return`เปลี่ยนรหัส ${key} เป็น ${val} แล้ว`;});}
    return mutate(()=>{s.name=val;return'บันทึกชื่อวิชาแล้ว';});}
  if(ent==='c'){const c=DB.classes.find(x=>x.id===key);if(!c)return;
    if(f==='id'){if(!val||(val!==key&&DB.classes.some(x=>x.id===val))){toast('ชั้นว่างหรือซ้ำ');return render();}
      return mutate(()=>{DB.lessons.forEach(L=>{if(L.cls===key)L.cls=val;});c.id=val;if(V.c===key)V.c=val;return`เปลี่ยนชั้น ${key} เป็น ${val} แล้ว`;});}
    return mutate(()=>{c.room=val;ensureCatalog({type:'subj',room:val});return'บันทึกห้องประจำแล้ว';});}
  if(ent==='r'){const r=DB.rooms.find(x=>x.id===key);if(!r)return;
    if(f==='id'){if(!val||(val!==key&&DB.rooms.some(x=>x.id===val))){toast('เลขห้องว่างหรือซ้ำ');return render();}
      return mutate(()=>{DB.lessons.forEach(L=>{if(L.room===key)L.room=val;});DB.classes.forEach(c=>{if(c.room===key)c.room=val;});r.id=val;if(V.r===key)V.r=val;return`เปลี่ยนห้อง ${key} เป็น ${val} แล้ว`;});}
    return mutate(()=>{r.note=val;return'บันทึกแล้ว';});}
}
function delEntity(ent,key){
  if(ent==='t'){const t=TU(key),n=DB.lessons.filter(L=>L.tids.includes(key)).length;
    ask(`ลบ ${t.name}?`,`ครูคนนี้จะถูกนำออกจาก ${n} คาบ คาบที่ไม่มีครูเหลือจะถูกลบไปด้วย (เลิกทำได้)`,()=>mutate(()=>{
      DB.lessons.forEach(L=>L.tids=L.tids.filter(x=>x!==key));DB.lessons=DB.lessons.filter(L=>L.tids.length);DB.subs=DB.subs.filter(s=>s.from!==key&&s.to!==key);DB.absences=DB.absences.filter(a=>a.tid!==key);DB.teachers=DB.teachers.filter(x=>x!==t);return'ลบครูแล้ว';}));}
  if(ent==='s'){const n=DB.lessons.filter(L=>L.code===key).length;
    ask(`ลบรายวิชา ${key}?`,n?`คาบสอน ${n} คาบที่ใช้รหัสนี้จะถูกลบด้วย (เลิกทำได้)`:'รายวิชานี้ยังไม่ถูกใช้ในตาราง',()=>mutate(()=>{DB.lessons=DB.lessons.filter(L=>L.code!==key);DB.subjects=DB.subjects.filter(s=>s.code!==key);return'ลบรายวิชาแล้ว';}));}
  if(ent==='c'){const n=DB.lessons.filter(L=>L.cls===key).length;
    ask(`ลบชั้น ${key}?`,n?`คาบเรียน ${n} คาบของชั้นนี้จะถูกลบด้วย (เลิกทำได้)`:'ชั้นนี้ยังไม่มีคาบเรียน',()=>mutate(()=>{DB.lessons=DB.lessons.filter(L=>L.cls!==key);DB.classes=DB.classes.filter(c=>c.id!==key);return'ลบชั้นแล้ว';}));}
  if(ent==='r'){const n=DB.lessons.filter(L=>L.room===key).length;
    ask(`ลบห้อง ${key}?`,n?`คาบ ${n} คาบที่ใช้ห้องนี้จะยังอยู่ แต่จะไม่มีห้องเรียนระบุ`:'ห้องนี้ยังไม่ถูกใช้',()=>mutate(()=>{DB.lessons.forEach(L=>{if(L.room===key)L.room='';});DB.classes.forEach(c=>{if(c.room===key)c.room='';});DB.rooms=DB.rooms.filter(r=>r.id!==key);return'ลบห้องแล้ว';}));}
}
function bulkAdd(k){const lines=$('#bulkTa').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(!lines.length){toast('วางข้อมูลก่อน บรรทัดละ 1 รายการ');return;}
  let add=0,skip=0;
  mutate(()=>{lines.forEach(l=>{const [a,...rest]=l.split(/[\t,]|\s+/).filter(Boolean),b=rest.join(' ');
    if(k==='teachers'){if(!b||DB.teachers.some(t=>t.code===a)){skip++;return;}DB.teachers.push({uid:uid('t'),code:a,name:b});add++;}
    if(k==='subjects'){if(subjOf(a)){skip++;return;}DB.subjects.push({code:a,name:b});add++;}
    if(k==='classes'){if(DB.classes.some(c=>c.id===a)){skip++;return;}DB.classes.push({id:a,room:rest[0]||''});if(rest[0])ensureCatalog({type:'subj',room:rest[0]});add++;}
    if(k==='rooms'){if(DB.rooms.some(r=>r.id===a)){skip++;return;}DB.rooms.push({id:a,note:b});add++;}});
    if(!add)return false;return`เพิ่ม ${add} รายการ${skip?` · ข้าม ${skip} รายการที่ซ้ำ`:''}`;});
  if(!add)toast(skip?'ทุกรายการซ้ำกับของเดิม':'ไม่พบข้อมูลที่ใช้ได้');}

function refreshLists(){
  $('#dlCode').innerHTML=[...DB.subjects].sort((a,b)=>numSort(a.code,b.code)).map(s=>`<option value="${esc(s.code)}">${esc(subjTitle(s.code))}</option>`).join('');
  $('#dlCls').innerHTML=[...DB.classes].sort((a,b)=>sortCls(a.id,b.id)).map(c=>`<option value="${esc(c.id)}">ห้องประจำ ${esc(c.room)}</option>`).join('');
  $('#dlRoom').innerHTML=[...DB.rooms].sort((a,b)=>numSort(a.id,b.id)).map(r=>`<option value="${esc(r.id)}">${esc(r.note)}</option>`).join('');
  const acts=new Set(['ชุมนุม','ลูกเสือ','ติว ONET ม.3','ประชุมวิชาการ','ประชุมหน.ระดับ','ซ่อมเสริม']);DB.lessons.forEach(L=>{if(L.type==='act')acts.add(L.act);});
  $('#dlAct').innerHTML=[...acts].sort().map(a=>`<option value="${esc(a)}">`).join('');
}

/* ---------- editor ---------- */
let ED=null;
function openEditor(o){
  const L=o.id?LB(o.id):null;
  ED={id:L?L.id:null,type:L?L.type:(o.type||'subj'),tids:new Set(L?L.tids:(o.tids||[])),slots:new Set(L?[L.d+'|'+L.p]:(o.slots||[])),row:o.row||null};
  $('#edTitle').textContent=L?'แก้ไขคาบ':o.dup?'ทำสำเนาคาบ':'เพิ่มคาบ';
  $('#edSub').textContent=L?`วัน${DAYS[L.d]} คาบ ${L.p+1} · เลือกช่องอื่นในตารางด้านล่างเพื่อย้าย`:'เลือกได้หลายช่องเพื่อเพิ่มหลายคาบพร้อมกัน';
  const src=L||o;
  $('#edCode').value=src.code||''; $('#edCls').value=src.cls||''; $('#edRoom').value=src.room||''; $('#edAct').value=src.act||'';
  $('#edDel').hidden=$('#edDup').hidden=$('#edMove').hidden=!L;$('#edLock').checked=!!(L&&L.lock);
  setType(ED.type); if(!$('#dlgEd').open)$('#dlgEd').showModal();
}
function setType(t){ED.type=t;$('#edTSubj').setAttribute('aria-pressed',t==='subj');$('#edTAct').setAttribute('aria-pressed',t==='act');$('#edSubjF').hidden=t!=='subj';$('#edActF').hidden=t!=='act';edRefresh();}
function edVals(){return{code:$('#edCode').value.trim(),cls:$('#edCls').value.trim(),room:$('#edRoom').value.trim(),act:$('#edAct').value.trim()};}
function slotIssues(d,p,v){const out=[];
  IDX[d][p].forEach(L=>{if(L.id===ED.id)return;
    const tb=L.tids.filter(u=>ED.tids.has(u));if(tb.length)out.push(`${tb.map(u=>tShort(TU(u))).join(', ')} มี "${lLabel(L)}" อยู่แล้ว`);
    if(ED.type==='subj'&&L.type==='subj'){if(v.cls&&L.cls===v.cls)out.push(`ชั้น ${v.cls} เรียน ${codeLabel(L.code)} อยู่แล้ว`);
      if(v.room&&L.room===v.room&&L.cls!==v.cls)out.push(`ห้อง ${v.room} ใช้สอน ${L.cls} อยู่แล้ว`);}});
  return out;}
function edRefresh(){if(!ED)return;const v=edVals();
  $('#edCodeHint').textContent=v.code?(subjTitle(v.code)||'รหัสใหม่ จะถูกเพิ่มในรายวิชา'):'';
  const busyT=u=>[...ED.slots].some(k=>{const [d,p]=k.split('|').map(Number);return IDX[d][p].some(L=>L.id!==ED.id&&L.tids.includes(u));});
  $('#edTeachers').innerHTML=tSorted().map(t=>{const b=busyT(t.uid);return`<button type="button" data-et="${t.uid}" aria-pressed="${ED.tids.has(t.uid)}" class="${b?'busy':''}"><span class="code">${esc(t.code)}</span>${esc(tShort(t))}${b?'<span class="tag">ไม่ว่าง</span>':''}</button>`;}).join('');
  let sg='<table class="sg"><thead><tr><th></th>'+TIMES.map((_,p)=>`<th>${p+1}</th>`).join('')+'</tr></thead><tbody>';
  for(let d=0;d<5;d++){sg+=`<tr><th>${DAYS[d].slice(0,d===3?3:2)}</th>`;
    for(let p=0;p<NP;p++){const k=d+'|'+p,iss=slotIssues(d,p,v),on=ED.slots.has(k);
      sg+=`<td><button type="button" data-es="${k}" aria-pressed="${on}" class="${iss.length?'busy':''}" title="${esc(DAYS[d]+' คาบ '+(p+1)+(iss.length?' — '+iss.join(' / '):' — ว่าง'))}">${iss.length?'ไม่ว่าง':on?'✓':''}</button></td>`;}
    sg+='</tr>';}
  $('#edSlots').innerHTML=sg+'</tbody></table>';
  $('#edSlotLbl').textContent=ED.id?'วันและคาบ (เลือก 1 ช่อง)':`วันและคาบ · เลือกแล้ว ${ED.slots.size} ช่อง`;
  const w=[];[...ED.slots].forEach(k=>{const [d,p]=k.split('|').map(Number);slotIssues(d,p,v).forEach(s=>w.push(`วัน${DAYS[d]} คาบ ${p+1}: ${s}`));});
  $('#edWarn').innerHTML=w.length?`<div class="warn bad">${w.slice(0,6).map(s=>'<span>⚠ '+esc(s)+'</span>').join('')}${w.length>6?`<span>และอีก ${w.length-6} รายการ</span>`:''}<span style="opacity:.8">บันทึกได้ แต่ระบบจะแสดงเป็นคาบชน</span></div>`:(ED.slots.size?'<div class="warn good">ไม่ชนกับคาบอื่น</div>':'');
  $('#edSave').textContent=ED.id?'บันทึก':ED.slots.size>1?`เพิ่ม ${ED.slots.size} คาบ`:'เพิ่มคาบ';
}
$('#edTeachers').addEventListener('click',e=>{const b=e.target.closest('[data-et]');if(!b)return;const u=b.dataset.et;ED.tids.has(u)?ED.tids.delete(u):ED.tids.add(u);edRefresh();});
$('#edSlots').addEventListener('click',e=>{const b=e.target.closest('[data-es]');if(!b)return;const k=b.dataset.es;
  if(ED.id){ED.slots=new Set([k]);}else{ED.slots.has(k)?ED.slots.delete(k):ED.slots.add(k);}edRefresh();});
['#edCode','#edRoom','#edAct'].forEach(s=>$(s).addEventListener('input',edRefresh));
let lastCls='';
$('#edCls').addEventListener('focus',()=>{lastCls=$('#edCls').value.trim();});
$('#edCls').addEventListener('input',()=>{const v=$('#edCls').value.trim(),c=DB.classes.find(x=>x.id===v),prev=DB.classes.find(x=>x.id===lastCls);
  if(c&&c.room&&(!$('#edRoom').value.trim()||(prev&&$('#edRoom').value.trim()===prev.room)))$('#edRoom').value=c.room;lastCls=v;edRefresh();});
$('#edTSubj').onclick=()=>setType('subj');$('#edTAct').onclick=()=>setType('act');
$('#edX').onclick=$('#edCancel').onclick=()=>$('#dlgEd').close();
$('#edForm').addEventListener('submit',e=>{e.preventDefault();const v=edVals(),err=[];
  if(ED.type==='subj'){if(!v.code)err.push('ใส่รหัสวิชา');if(!v.cls)err.push('ใส่ชั้น/ห้อง');}else if(!v.act)err.push('ใส่ชื่อกิจกรรม');
  if(!ED.tids.size)err.push('เลือกครูอย่างน้อย 1 คน');if(!ED.slots.size)err.push('เลือกวันและคาบอย่างน้อย 1 ช่อง');
  if(err.length){$('#edWarn').innerHTML=`<div class="warn bad">${err.map(s=>'<span>'+esc(s)+'</span>').join('')}</div>`;return;}
  const fields=ED.type==='subj'?{type:'subj',code:v.code,cls:v.cls,room:v.room}:{type:'act',act:v.act};if(ED.type==='subj'&&$('#edLock').checked)fields.lock=true;
  const tids=tSorted().map(t=>t.uid).filter(u=>ED.tids.has(u)), slots=[...ED.slots].map(k=>k.split('|').map(Number)).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const id=ED.id;$('#dlgEd').close();
  mutate(()=>{ensureCatalog(fields);
    if(id){const i=DB.lessons.findIndex(L=>L.id===id);DB.lessons[i]={id,...fields,tids,d:slots[0][0],p:slots[0][1]};return'บันทึกการแก้ไขแล้ว';}
    slots.forEach(([d,p])=>DB.lessons.push({id:uid(),...fields,tids,d,p}));return slots.length>1?`เพิ่ม ${slots.length} คาบแล้ว`:'เพิ่มคาบแล้ว';});});
$('#edDel').onclick=()=>{const id=ED.id,L=LB(id);$('#dlgEd').close();mutate(()=>{DB.lessons=DB.lessons.filter(x=>x.id!==id);return`ลบ ${lLabel(L)} แล้ว`;});};
$('#edDup').onclick=()=>{const L=LB(ED.id),v=edVals();openEditor({dup:1,type:ED.type,...v,tids:[...ED.tids],slots:[]});};
$('#edMove').onclick=()=>{MOVE={lid:ED.id,from:ED.row};$('#dlgEd').close();render();};

/* ---------- confirm & conflicts ---------- */
function ask(title,body,yes){$('#cTitle').textContent=title;$('#cBody').textContent=body;$('#cYes').onclick=()=>{$('#dlgConfirm').close();yes();};$('#dlgConfirm').showModal();}
$('#cNo').onclick=()=>$('#dlgConfirm').close();
const CT={teacher:'ครูสอนซ้อน',class:'ชั้นเรียนซ้อน',room:'ห้องถูกใช้ซ้อน'};
$('#conflictBadge').onclick=()=>{
  $('#confList').innerHTML=C.list.length?C.list.map(c=>`<button data-cid="${c.ids[0]}"><b>วัน${DAYS[c.d]} คาบ ${c.p+1}</b> · ${CT[c.type]} ${esc(c.type==='teacher'?tShort(TU(c.key)):c.key)}<br><span class="note">${c.ids.map(id=>esc(lLabel(LB(id)))).join(' / ')}</span></button>`).join(''):'<div class="warn good">ไม่พบคาบชน ตารางทั้งหมดใช้ได้</div>';
  $('#dlgConf').showModal();};
$('#confList').onclick=e=>{const b=e.target.closest('[data-cid]');if(!b)return;$('#dlgConf').close();openEditor({id:b.dataset.cid});};
$('#confX').onclick=()=>$('#dlgConf').close();

/* ---------- interactions ---------- */
$('#nav').onclick=e=>{const b=e.target.closest('[data-view]');if(!b)return;V.view=b.dataset.view;render();};
$('#btnUndo').onclick=undo;$('#btnRedo').onclick=redo;
$('#moveCancel').onclick=()=>{MOVE=null;render();};
$('#btnNew').onclick=()=>openEditor(newCtx(null,null,null));
function newCtx(d,p,row){const o={slots:d==null?[]:[d+'|'+p]};
  if(V.view==='teacher')o.tids=[V.t];
  if(V.view==='class'){o.cls=V.c;o.room=DB.classes.find(c=>c.id===V.c)?.room||'';}
  if(V.view==='room')o.room=V.r;
  if(row)o.tids=[row];
  return o;}
$('#picker').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.pickT)V.t=b.dataset.pickT;else if(b.dataset.pickC)V.c=b.dataset.pickC;else if(b.dataset.pickR)V.r=b.dataset.pickR;
  else if(b.dataset.pickD){V.day=+b.dataset.pickD;V.fd=V.day;}else if(b.dataset.dtab){V.dtab=b.dataset.dtab;}else return;render();});
function cellAct(td,chip){const d=+td.dataset.d,p=+td.dataset.p,row=td.dataset.row||null;
  if(MOVE){const m=MOVE;MOVE=null;doMove(m.lid,m.from,d,p,row);render();return;}
  if(chip)return openEditor({id:chip.dataset.lid,row});
  openEditor(newCtx(d,p,row));}
$('#view').addEventListener('click',e=>{const t=e.target;
  const td=t.closest('td.cell');if(td)return cellAct(td,t.closest('.lz'));
  const b=t.closest('button,[data-open-t],[data-open-c],[data-open-r]');if(!b)return;
  if(b.dataset.openT){V.view='teacher';V.t=b.dataset.openT;return render();}
  if(b.dataset.openC){V.view='class';V.c=b.dataset.openC;return render();}
  if(b.dataset.openR){V.view='room';V.r=b.dataset.openR;return render();}
  if(b.dataset.free)return openEditor({tids:[b.dataset.free],slots:[V.fd+'|'+V.fp]});
  if(b.dataset.del)return delEntity(b.dataset.del,b.dataset.key);
  if(b.dataset.bulk)return bulkAdd(b.dataset.bulk);
  if(b.dataset.copy==='grid'){const f=viewFilter(),title=V.view==='teacher'?`ตารางสอน ${TU(V.t).code} ${TU(V.t).name} ภาคเรียนที่ 2/2569`:V.view==='class'?`ตารางเรียน ม.${V.c}`:`ตารางห้อง ${V.r}`;
    return copyText(gridTSV(title,f,L=>L.type==='act'?L.act:`${codeLabel(L.code)} ${V.view==='class'?L.tids.map(u=>tShort(TU(u))).join('+'):L.cls} ${V.view==='room'?L.tids.map(u=>tShort(TU(u))).join('+'):L.room}`)+'\n\n'+sumTSV(),'คัดลอกแล้ว วางใน Excel หรือ Google Sheets ได้เลย');}
  if(b.id==='impCheck'){const tx=$('#impTa').value;IMP={text:tx,rows:parseImport(tx)};return render();}
  if(b.id==='impGo'){const ok=IMP.rows.filter(r=>r.ok);IMP=null;return mutate(()=>{ok.forEach(r=>{const f=r.type==='act'?{type:'act',act:r.act}:{type:'subj',code:r.code,cls:r.cls,room:r.room};ensureCatalog(f);DB.lessons.push({id:uid(),...f,tids:r.tids,d:r.d,p:r.p});});return`เพิ่ม ${ok.length} คาบแล้ว`;});}
  if(b.id==='bkCopy')return copyText(JSON.stringify(DB),'คัดลอกข้อมูลแล้ว เก็บไว้ในโน้ตหรืออีเมล');
  if(b.id==='bkAll'){const out=tSorted().map(t=>gridTSV(`ตารางสอน ${t.code} ${t.name}`,L=>L.tids.includes(t.uid),L=>L.type==='act'?L.act:`${codeLabel(L.code)} ${L.cls} ${L.room}`)+'\n\n'+sumTSV('teacher',t.uid)).join('\n\n\n');return copyText(out,'คัดลอกตารางครูทุกคนแล้ว');}
  if(b.id==='bkLoad'){try{const o=JSON.parse($('#bkTa').value);let nd;
      if(o&&Array.isArray(o.lessons)&&Array.isArray(o.teachers))nd=finishDB(o);
      else if(o&&Array.isArray(o.teachers)&&o.teachers[0]?.slots)nd=fromTeacherSlots(o.teachers);else throw 0;
      return mutate(()=>{DB=nd;return'กู้คืนข้อมูลแล้ว';});}catch(err){return toast('ข้อมูลไม่ถูกต้อง ตรวจสอบว่าคัดลอกมาครบ');}}
  if(b.id==='bkReset')return ask('คืนค่าตาม PDF ต้นฉบับ?','ตารางจะกลับเป็นข้อมูลภาคเรียนที่ 2/2569 จากไฟล์ PDF (เลิกทำได้ทันทีหลังคืนค่า)',()=>mutate(()=>{DB=seedDB();return'คืนค่าแล้ว';}));
});
$('#view').addEventListener('change',e=>{const t=e.target;
  if(t.dataset.ent)return applyEdit(t.dataset.ent,t.dataset.key,t.dataset.f,t.value);
  if(t.id==='fDay'){V.fd=+t.value;render();}if(t.id==='fPer'){V.fp=+t.value;render();}
  if(t.id==='bkFile'&&t.files[0]){const r=new FileReader();r.onload=()=>{$('#bkTa').value=r.result;};r.readAsText(t.files[0]);}});
$('#view').addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const t=e.target;
  if(t.matches('.lz')){e.preventDefault();cellAct(t.closest('td.cell'),t);}else if(t.matches('td.cell')){e.preventDefault();cellAct(t,null);}});
/* drag & drop */
$('#view').addEventListener('dragstart',e=>{const c=e.target.closest&&e.target.closest('.lz');if(!c)return;
  DRAG={lid:c.dataset.lid,from:c.dataset.row||null};e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',c.dataset.lid);}catch(x){}c.classList.add('src');});
$('#view').addEventListener('dragover',e=>{if(!DRAG)return;const td=e.target.closest('td.cell');if(!td)return;e.preventDefault();
  document.querySelectorAll('td.over').forEach(x=>x!==td&&x.classList.remove('over'));td.classList.add('over');});
$('#view').addEventListener('dragleave',e=>{const td=e.target.closest('td.cell');if(td&&!td.contains(e.relatedTarget))td.classList.remove('over');});
$('#view').addEventListener('drop',e=>{const td=e.target.closest('td.cell');if(!td||!DRAG)return;e.preventDefault();const g=DRAG;DRAG=null;
  doMove(g.lid,g.from,+td.dataset.d,+td.dataset.p,td.dataset.row||null);render();});
$('#view').addEventListener('dragend',()=>{DRAG=null;document.querySelectorAll('.over,.lz.src').forEach(x=>x.classList.remove('over','src'));});
document.addEventListener('keydown',e=>{const mod=e.ctrlKey||e.metaKey;if(e.target.matches('input,textarea'))return;
  if(mod&&e.key.toLowerCase()==='z'&&!e.shiftKey){e.preventDefault();undo();}
  else if(mod&&(e.key.toLowerCase()==='y'||(e.key.toLowerCase()==='z'&&e.shiftKey))){e.preventDefault();redo();}
  else if(e.key==='Escape'&&MOVE){MOVE=null;render();}});
