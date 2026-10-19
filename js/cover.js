/* ---------- substitution & period exchange ---------- */
const TH_M=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const WD=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'],WDS=['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];
const REASONS=['ลาป่วย','ลากิจ','ไปราชการ','อบรม / สัมมนา','พานักเรียนไปกิจกรรม','อื่น ๆ'];
const KIND={sub:'สอนแทน',swap:'แลกคาบ',repay:'ตอบแทนคาบ'};
const ymd=t=>`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
const pd=s=>{const [y,m,d]=String(s).split('-').map(Number);return new Date(y,(m||1)-1,d||1);};
const dIdx=s=>{const w=pd(s).getDay();return w>=1&&w<=5?w-1:-1;};
function thDate(s,short){const t=pd(s),w=t.getDay();return short?`${WDS[w]} ${t.getDate()} ${TH_M[t.getMonth()]}`:`วัน${WD[w]}ที่ ${t.getDate()} ${TH_M[t.getMonth()]} ${t.getFullYear()+543}`;}
function shiftDay(s,dir){const t=pd(s);do{t.setDate(t.getDate()+dir);}while(t.getDay()===0||t.getDay()===6);return ymd(t);}
function schoolToday(){const t=new Date();while(t.getDay()===0||t.getDay()===6)t.setDate(t.getDate()+1);return ymd(t);}
const TODAY=ymd(new Date());
DB.absences=DB.absences||[];DB.subs=DB.subs||[];
V.stab=V.stab||'day';if(!V.sdate)V.sdate=schoolToday();V.hT=V.hT||'';
let AB={tid:'',reason:REASONS[0],periods:null};
let SW={a:'',date1:'',lid1:'',b:'',mode:'now',date2:'',lid2:''};
let RP=null;

const pLabel=p=>`คาบ ${p+1} (${TIMES[p]})`;
const nm=u=>tShort(TU(u));
const handedOff=(L,tid,date)=>DB.subs.some(s=>s.date===date&&s.lid===L.id&&s.from===tid);
const absentAt=(tid,date,p)=>DB.absences.some(a=>a.date===date&&a.tid===tid&&(!a.periods||a.periods.includes(p)));
function busyWhy(tid,date,p,ignore){const d=dIdx(date);if(d<0)return'วันหยุด';
  if(absentAt(tid,date,p))return'ลา';
  const s=DB.subs.find(s=>s.id!==ignore&&s.date===date&&s.p===p&&s.to===tid);if(s)return'สอนแทน '+s.lab;
  const L=IDX[d][p].find(L=>L.tids.includes(tid)&&!handedOff(L,tid,date));return L?lLabel(L):'';}
const subCount=tid=>DB.subs.filter(s=>s.to===tid&&s.kind==='sub').length;
const dayLoad=(tid,date)=>{let n=0;for(let p=0;p<NP;p++)if(busyWhy(tid,date,p))n++;return n;};
const teachesCls=(tid,cls)=>!!cls&&DB.lessons.some(L=>L.cls===cls&&L.tids.includes(tid));
function candidates(date,p,L,excl,ignore){
  return tSorted().filter(t=>!excl.includes(t.uid)&&!L.tids.includes(t.uid)&&!busyWhy(t.uid,date,p,ignore))
    .map(t=>({t,n:subCount(t.uid),load:dayLoad(t.uid,date),same:teachesCls(t.uid,L.cls)}))
    .sort((a,b)=>a.n-b.n||a.load-b.load||(b.same-a.same));}
function lessonsOn(tid,date){const d=dIdx(date);if(d<0)return[];const o=[];
  for(let p=0;p<NP;p++)IDX[d][p].forEach(L=>{if(L.tids.includes(tid)&&!handedOff(L,tid,date)&&!absentAt(tid,date,p))o.push({L,p});});return o;}
function dayRows(date){const d=dIdx(date);if(d<0)return[];const rows=[];
  DB.absences.filter(a=>a.date===date).forEach(a=>{for(let p=0;p<NP;p++){if(a.periods&&!a.periods.includes(p))continue;
    IDX[d][p].filter(L=>L.tids.includes(a.tid)).forEach(L=>{
      rows.push({a,p,L,rec:DB.subs.find(s=>s.date===date&&s.lid===L.id&&s.from===a.tid),co:L.tids.filter(u=>u!==a.tid&&!absentAt(u,date,p))});});}});
  return rows.sort((x,y)=>x.p-y.p);}
const mkRec=(o,L)=>({id:uid('S'),date:o.date,p:o.p,lid:L.id,from:o.from,to:o.to,kind:o.kind,owed:!!o.owed,link:o.link||null,
  lab:L.type==='act'?L.act:`${codeLabel(L.code)} ม.${L.cls} ห้อง ${L.room}`,cls:L.cls||''});
const isOpen=s=>s.owed&&!DB.subs.some(r=>r.kind==='repay'&&r.link===s.id);
function dropSubs(pred){const gone=new Set(DB.subs.filter(pred).map(s=>s.id));DB.subs=DB.subs.filter(s=>!gone.has(s.id)&&!(s.kind==='repay'&&gone.has(s.link)));}
const lessonOpt=(x,attr,on)=>`<button class="opt" ${attr} aria-pressed="${!!on}">คาบ ${x.p+1} · ${esc(lLabel(x.L))}<small>${TIMES[x.p]}${x.L.type==='subj'?' · ห้อง '+esc(x.L.room):''}</small></button>`;
function dateBar(id,val,nav){return`<div class="datebar">${nav?'<button class="btn sm" data-sact="prev" aria-label="วันทำการก่อนหน้า">‹</button>':''}<input type="date" id="${id}" value="${esc(val)}" aria-label="วันที่">${nav?'<button class="btn sm" data-sact="next" aria-label="วันทำการถัดไป">›</button><button class="btn sm" data-sact="today">วันนี้</button>':''}</div>`;}

function subPickerHTML(){const n=DB.subs.filter(isOpen).length;
  return'<div class="subtabs">'+[['day','จัดสอนแทนรายวัน'],['swap','แลกคาบ'],['ledger',`ตอบแทนคาบและสถิติ${n?` · ค้าง ${n}`:''}`]].map(([k,l])=>`<button class="chip" data-stab="${k}" aria-pressed="${k===V.stab}">${l}</button>`).join('')+'</div>';}
function subHTML(){return V.stab==='swap'?swapHTML():V.stab==='ledger'?ledgerHTML():subDayHTML();}

/* --- daily cover --- */
function subDayHTML(){const date=V.sdate,d=dIdx(date);
  let h=`<div class="sheet"><div class="sheet-head"><div><h2>${esc(thDate(date))}</h2><div class="meta">บันทึกครูที่ไม่อยู่ แล้วเลือกผู้สอนแทนทีละคาบ รายชื่อแสดงเฉพาะครูที่ว่าง เรียงคนที่สอนแทนน้อยที่สุดไว้ก่อน</div></div>${dateBar('sDate',date,true)}</div>`;
  if(d<0)return h+'<div class="warn bad">วันที่เลือกเป็นวันเสาร์หรืออาทิตย์ เลือกวันจันทร์–ศุกร์</div></div>';
  const abs=DB.absences.filter(a=>a.date===date),avail=tSorted().filter(t=>!abs.some(a=>a.tid===t.uid));
  if(!avail.some(t=>t.uid===AB.tid))AB.tid=avail[0]?.uid||'';
  h+=`<div class="ab-list">${abs.map(a=>`<div class="ab"><div><b>${esc(nm(a.tid))}</b> · ${esc(a.reason)} <span class="note">${a.periods?'คาบ '+a.periods.map(p=>p+1).join(', '):'ทั้งวัน'}</span></div><button class="btn sm danger" data-sdelab="${a.id}">ยกเลิกการลา</button></div>`).join('')||'<div class="note">ยังไม่มีครูลาในวันนี้</div>'}</div>
    <div class="row" style="align-items:flex-end">
      <div class="field"><label for="abT">ครูที่ไม่อยู่</label><select class="sel" id="abT">${avail.map(t=>`<option value="${t.uid}" ${t.uid===AB.tid?'selected':''}>${esc(t.code+' '+tShort(t))}</option>`).join('')}</select></div>
      <div class="field"><label for="abR">เหตุผล</label><select class="sel" id="abR">${REASONS.map(r=>`<option ${r===AB.reason?'selected':''}>${r}</option>`).join('')}</select></div>
      <div class="field"><span class="lbl">ช่วงเวลา</span><div class="pgrid"><button type="button" class="wide" data-abp="all" aria-pressed="${!AB.periods}">ทั้งวัน</button>${TIMES.map((_,p)=>`<button type="button" data-abp="${p}" aria-pressed="${!!AB.periods&&AB.periods.includes(p)}" title="${TIMES[p]}">${p+1}</button>`).join('')}</div></div>
      <button class="btn primary" data-sact="addab" ${avail.length?'':'disabled'}>บันทึกการลา</button></div></div>`;
  const rows=dayRows(date),done=rows.filter(r=>r.rec).length,miss=rows.filter(r=>!r.rec&&!r.co.length).length;
  h+=`<div class="cover-grid"><div class="sheet"><div class="sheet-head"><div><h2>คาบที่ต้องจัดสอนแทน</h2><div class="meta">ติ๊ก "ตอบแทน" ถ้าครูที่ลาต้องสอนคืนให้ผู้สอนแทนภายหลัง</div></div>
    <div class="row"><div class="stats"><span><b>${rows.length}</b>คาบ</span><span><b>${done}</b>จัดแล้ว</span><span><b>${miss}</b>ยังขาด</span></div>
    <button class="btn sm primary" data-sact="auto" ${miss?'':'disabled'}>จัดอัตโนมัติ</button></div></div>`;
  if(!rows.length)h+='<div class="note">เมื่อบันทึกครูที่ไม่อยู่ คาบของครูคนนั้นในวันนี้จะแสดงที่นี่</div>';
  else h+=`<div class="tt-wrap" style="border:0"><table class="dt"><thead><tr><th>คาบ</th><th>รายวิชา / กิจกรรม</th><th>ครูที่ลา</th><th>ผู้สอนแทน</th><th>ตอบแทน</th><th>สถานะ</th></tr></thead><tbody>${rows.map(r=>{
      const cur=r.rec?.to||'',locked=r.rec&&r.rec.kind!=='sub';
      let sel='';
      if(!locked){const cs=candidates(date,r.p,r.L,[r.a.tid],r.rec?.id);
        sel=`<select data-ssel="${r.L.id}" data-from="${r.a.tid}" data-p="${r.p}" aria-label="ผู้สอนแทนคาบ ${r.p+1}"><option value="">${r.co.length?'— ครูร่วมสอนดูแล —':'— เลือกผู้สอนแทน —'}</option>${r.rec&&!cs.some(c=>c.t.uid===cur)?`<option value="${cur}" selected>${esc(nm(cur))}</option>`:''}${cs.map(c=>`<option value="${c.t.uid}" ${c.t.uid===cur?'selected':''}>${esc(tShort(c.t))} · แทนแล้ว ${c.n} · วันนี้ ${c.load} คาบ${c.same?' · สอนชั้นนี้':''}</option>`).join('')}</select>`;}
      const st=r.rec?`<span class="pill ok">${KIND[r.rec.kind]}</span>`:r.co.length?`<span class="pill info">${esc(r.co.map(nm).join(', '))} ดูแล</span>`:'<span class="pill bad">ยังไม่มีผู้สอน</span>';
      return`<tr><td><b>${r.p+1}</b><div class="note">${TIMES[r.p]}</div></td><td>${esc(r.L.type==='act'?r.L.act:codeLabel(r.L.code)+' ม.'+r.L.cls)}<div class="note">${r.L.type==='act'?'กิจกรรม':'ห้อง '+esc(r.L.room)}</div></td><td>${esc(nm(r.a.tid))}</td>
        <td>${locked?esc(nm(cur))+'<div class="note">จัดจากหน้าแลกคาบ</div>':sel}</td>
        <td>${r.rec&&r.rec.kind==='sub'?`<input type="checkbox" data-sowe="${r.rec.id}" ${r.rec.owed?'checked':''} aria-label="ให้ตอบแทนคาบ">`:''}</td><td>${st}</td></tr>`;}).join('')}</tbody></table></div>`;
  h+=`</div><div class="sheet"><div class="sheet-head"><div><h2>ใบแจ้งสอนแทน</h2><div class="meta">คัดลอกไปส่งในกลุ่ม LINE</div></div><button class="btn sm" data-sact="copyslip">คัดลอกข้อความ</button></div><div class="slip">${esc(slipText(date))}</div></div></div>`;
  return h;}
function slipText(date){const abs=DB.absences.filter(a=>a.date===date),recs=DB.subs.filter(s=>s.date===date).sort((a,b)=>a.p-b.p),miss=dayRows(date).filter(r=>!r.rec&&!r.co.length);
  const o=[`ตารางสอนแทน ${thDate(date)}`];
  if(abs.length)o.push('ครูที่ไม่อยู่: '+abs.map(a=>`${nm(a.tid)} (${a.reason}${a.periods?' คาบ '+a.periods.map(p=>p+1).join(','):''})`).join(', '));
  if(recs.length){o.push('');recs.forEach(s=>o.push(`${pLabel(s.p)} ${s.lab}\n   ${nm(s.from)} → ${nm(s.to)} [${KIND[s.kind]}]`));}
  if(miss.length){o.push('','ยังไม่มีผู้สอนแทน:');miss.forEach(r=>o.push(`${pLabel(r.p)} ${r.L.type==='act'?r.L.act:codeLabel(r.L.code)+' ม.'+r.L.cls} (${nm(r.a.tid)})`));}
  if(!abs.length&&!recs.length)o.push('ไม่มีการเปลี่ยนแปลง');
  return o.join('\n');}

/* --- exchange --- */
function swapHTML(){
  if(!SW.date1)SW.date1=V.sdate; if(!SW.date2)SW.date2=SW.date1; if(!TU(SW.a))SW.a=TU(V.t)?V.t:(tSorted()[0]?.uid||'');
  const d1=dIdx(SW.date1);
  let h=`<div class="cover-grid"><div class="sheet"><div class="sheet-head"><div><h2>แลกคาบ</h2><div class="meta">ครูที่ติดธุระให้เพื่อนสอนแทน แล้วสอนคืนในคาบที่กำหนด หรือติดไว้ตอบแทนภายหลัง</div></div></div>
    <div class="step"><h3><span>1</span>ครูที่ขอแลกและคาบที่ต้องการให้สอนแทน</h3><div class="row"><select class="sel" id="swA" aria-label="ครูที่ขอแลก">${tSorted().map(t=>`<option value="${t.uid}" ${t.uid===SW.a?'selected':''}>${esc(t.code+' '+tShort(t))}</option>`).join('')}</select>${dateBar('swD1',SW.date1)}</div>`;
  if(d1<0){h+='<div class="warn bad">เลือกวันจันทร์–ศุกร์</div>';SW.lid1='';}
  else{const ls=lessonsOn(SW.a,SW.date1);if(!ls.some(x=>x.L.id===SW.lid1))SW.lid1='';
    h+=ls.length?`<div class="opts">${ls.map(x=>lessonOpt(x,`data-swl1="${x.L.id}"`,x.L.id===SW.lid1)).join('')}</div>`:'<div class="note">ไม่มีคาบสอนในวันนี้</div>';}
  h+='</div>';
  const L1=SW.lid1&&LB(SW.lid1);
  if(L1){const cs=candidates(SW.date1,L1.p,L1,[SW.a]);if(!cs.some(c=>c.t.uid===SW.b))SW.b='';
    h+=`<div class="step"><h3><span>2</span>ครูที่รับสอนแทน (ว่างในคาบนี้)</h3><div class="opts">${cs.map(c=>`<button class="opt" data-swb="${c.t.uid}" aria-pressed="${c.t.uid===SW.b}">${esc(tShort(c.t))}<small>วันนั้น ${c.load} คาบ${c.same?' · สอนชั้นนี้':''}</small></button>`).join('')||'<span class="note">ไม่มีครูว่างในคาบนี้</span>'}</div></div>`;}
  if(L1&&SW.b){
    h+=`<div class="step"><h3><span>3</span>การตอบแทน</h3><div class="seg"><button type="button" data-swm="now" aria-pressed="${SW.mode==='now'}">สอนคืนในคาบที่กำหนด</button><button type="button" data-swm="later" aria-pressed="${SW.mode==='later'}">ติดไว้ ตอบแทนภายหลัง</button></div>`;
    if(SW.mode==='now'){h+=dateBar('swD2',SW.date2);
      if(dIdx(SW.date2)<0){h+='<div class="warn bad">เลือกวันจันทร์–ศุกร์</div>';SW.lid2='';}
      else{const ls=lessonsOn(SW.b,SW.date2).filter(x=>!busyWhy(SW.a,SW.date2,x.p));if(!ls.some(x=>x.L.id===SW.lid2))SW.lid2='';
        h+=ls.length?`<div class="note">คาบของ${esc(nm(SW.b))}ที่${esc(nm(SW.a))}ว่างสอนคืนได้</div><div class="opts">${ls.map(x=>lessonOpt(x,`data-swl2="${x.L.id}"`,x.L.id===SW.lid2)).join('')}</div>`:'<div class="note">วันนี้ไม่มีคาบที่ว่างตรงกัน ลองเลือกวันอื่น</div>';}}
    h+='</div>';}
  if(L1&&SW.b&&(SW.mode==='later'||SW.lid2)){const L2=SW.mode==='now'&&LB(SW.lid2);
    h+=`<div class="summary"><span><b>${esc(thDate(SW.date1,1))} คาบ ${L1.p+1}</b> · ${esc(nm(SW.b))} สอน ${esc(lLabel(L1))} แทน${esc(nm(SW.a))}</span>${L2?`<span><b>${esc(thDate(SW.date2,1))} คาบ ${L2.p+1}</b> · ${esc(nm(SW.a))} สอน ${esc(lLabel(L2))} คืนให้${esc(nm(SW.b))}</span>`:`<span>${esc(nm(SW.a))} ค้างตอบแทน${esc(nm(SW.b))} 1 คาบ ติดตามได้ที่ "ตอบแทนคาบและสถิติ"</span>`}</div>
      <div class="row"><button class="btn primary" data-sact="swapgo">บันทึกการแลกคาบ</button></div>`;}
  h+='</div>';
  const rec=DB.subs.filter(s=>s.kind!=='sub').sort((a,b)=>b.date.localeCompare(a.date)||a.p-b.p).slice(0,12);
  h+=`<div class="sheet"><div class="sheet-head"><div><h2>การแลกคาบล่าสุด</h2></div></div>${rec.length?`<div class="ab-list">${rec.map(recCard).join('')}</div>`:'<div class="note">ยังไม่มีการแลกคาบ</div>'}</div></div>`;
  return h;}
function recCard(s){return`<div class="ab"><div><b>${esc(thDate(s.date,1))} คาบ ${s.p+1}</b> <span class="pill ${s.kind==='sub'?'info':'ok'}">${KIND[s.kind]}</span>${isOpen(s)?' <span class="pill wait">ค้างตอบแทน</span>':''}<div class="note">${esc(s.lab)} · ${esc(nm(s.from))} → ${esc(nm(s.to))}</div></div><button class="btn sm danger" data-sdel="${s.id}">ลบ</button></div>`;}

/* --- ledger & stats --- */
function ledgerHTML(){let h='';
  if(RP){const o=DB.subs.find(s=>s.id===RP.id);if(!o||!isOpen(o))RP=null;}
  if(RP){const o=DB.subs.find(s=>s.id===RP.id),A=o.from,B=o.to,d=dIdx(RP.date),ls=d<0?[]:lessonsOn(B,RP.date).filter(x=>!busyWhy(A,RP.date,x.p));
    h+=`<div class="sheet rp"><div class="sheet-head"><div><h2>บันทึกการตอบแทน</h2><div class="meta">${esc(nm(A))} สอนคาบของ${esc(nm(B))}คืน 1 คาบ · ค้างจาก ${esc(thDate(o.date,1))} คาบ ${o.p+1} ${esc(o.lab)}</div></div><button class="btn sm" data-sact="rpcancel">ยกเลิก</button></div>
      ${dateBar('rpD',RP.date)}${d<0?'<div class="warn bad">เลือกวันจันทร์–ศุกร์</div>':ls.length?`<div class="note">เลือกคาบของ${esc(nm(B))}ที่${esc(nm(A))}ว่าง</div><div class="opts">${ls.map(x=>lessonOpt(x,`data-rpl="${x.L.id}"`,false)).join('')}</div>`:'<div class="note">วันนี้ไม่มีคาบที่ว่างตรงกัน ลองเลือกวันอื่น</div>'}</div>`;}
  const open=DB.subs.filter(isOpen),pairs={};open.forEach(s=>(pairs[s.from+'>'+s.to]??=[]).push(s));
  h+=`<div class="cover-grid"><div class="sheet"><div class="sheet-head"><div><h2>คาบที่ค้างตอบแทน</h2><div class="meta">มาจากการแลกคาบแบบติดไว้ และการสอนแทนที่ติ๊ก "ตอบแทน"</div></div><div class="stats"><span><b>${open.length}</b>คาบ</span></div></div>
    ${Object.entries(pairs).map(([k,xs])=>{const [a,b]=k.split('>');return`<div class="debt"><div class="debt-h"><b>${esc(nm(a))} ค้าง ${esc(nm(b))}</b><span class="pill wait">${xs.length} คาบ</span></div>${xs.sort((x,y)=>x.date.localeCompare(y.date)||x.p-y.p).map(s=>`<div class="debt-i"><span>${esc(thDate(s.date,1))} คาบ ${s.p+1} · ${esc(s.lab)}</span><span class="row" style="gap:6px"><button class="btn sm primary" data-srp="${s.id}">บันทึกการตอบแทน</button><button class="btn sm ghost" data-sclear="${s.id}">ไม่ต้องตอบแทน</button></span></div>`).join('')}</div>`;}).join('')||'<div class="warn good">ไม่มีคาบค้างตอบแทน</div>'}</div>`;
  const rows=tSorted().map(t=>{const u=t.uid;return{t,taught:DB.subs.filter(s=>s.to===u&&s.kind==='sub').length,covered:DB.subs.filter(s=>s.from===u&&s.kind==='sub').length,sw:DB.subs.filter(s=>s.to===u&&s.kind!=='sub').length,owe:open.filter(s=>s.from===u).length,due:open.filter(s=>s.to===u).length};});
  h+=`<div class="sheet"><div class="sheet-head"><div><h2>สถิติรายบุคคล</h2><div class="meta">ใช้ดูความเป็นธรรมในการจัดสอนแทน</div></div></div><div class="tt-wrap" style="border:0"><table class="dt" style="min-width:480px"><thead><tr><th>ครู</th><th class="num">สอนแทนผู้อื่น</th><th class="num">มีผู้สอนแทน</th><th class="num">แลก/ตอบแทน</th><th class="num">ค้างผู้อื่น</th><th class="num">ผู้อื่นค้าง</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(tShort(r.t))}</td><td class="num"><b>${r.taught}</b></td><td class="num">${r.covered}</td><td class="num">${r.sw}</td><td class="num">${r.owe||'–'}</td><td class="num">${r.due||'–'}</td></tr>`).join('')}</tbody></table></div></div></div>`;
  const hs=DB.subs.filter(s=>!V.hT||s.from===V.hT||s.to===V.hT).sort((a,b)=>b.date.localeCompare(a.date)||a.p-b.p);
  h+=`<div class="sheet"><div class="sheet-head"><div><h2>ประวัติทั้งหมด</h2><div class="meta">${hs.length} รายการ</div></div><select class="sel" id="hT" aria-label="กรองตามครู"><option value="">ครูทุกคน</option>${tSorted().map(t=>`<option value="${t.uid}" ${t.uid===V.hT?'selected':''}>${esc(t.code+' '+tShort(t))}</option>`).join('')}</select></div>
    ${hs.length?`<div class="tt-wrap" style="border:0"><table class="dt"><thead><tr><th>วันที่</th><th>คาบ</th><th>รายการ</th><th>เจ้าของคาบ → ผู้สอน</th><th>ประเภท</th><th></th></tr></thead><tbody>${hs.slice(0,300).map(s=>`<tr><td>${esc(thDate(s.date,1))} ${pd(s.date).getFullYear()+543}</td><td>${s.p+1}</td><td>${esc(s.lab)}</td><td>${esc(nm(s.from))} → ${esc(nm(s.to))}</td><td><span class="pill ${s.kind==='sub'?'info':'ok'}">${KIND[s.kind]}</span>${isOpen(s)?' <span class="pill wait">ค้าง</span>':''}</td><td class="act"><button class="btn sm danger" data-sdel="${s.id}">ลบ</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="note">ยังไม่มีรายการ</div>'}</div>`;
  return h;}

function subNoticeHTML(tid){
  const up=DB.subs.filter(s=>s.date>=TODAY&&(s.from===tid||s.to===tid)).sort((a,b)=>a.date.localeCompare(b.date)||a.p-b.p);
  const ab=DB.absences.filter(a=>a.date>=TODAY&&a.tid===tid),owe=DB.subs.filter(s=>isOpen(s)&&s.from===tid).length,due=DB.subs.filter(s=>isOpen(s)&&s.to===tid).length;
  if(!up.length&&!ab.length&&!owe&&!due)return'';
  return`<div class="cover-note"><b>สอนแทน / แลกคาบที่กำลังจะถึง</b>${ab.map(a=>`<span>${esc(thDate(a.date,1))} · ${esc(a.reason)}</span>`).join('')}${up.slice(0,8).map(s=>`<span>${esc(thDate(s.date,1))} คาบ ${s.p+1} · ${s.to===tid?`สอน ${esc(s.lab)} แทน${esc(nm(s.from))}`:`${esc(nm(s.to))} สอน ${esc(s.lab)} แทนเรา`} <i>${KIND[s.kind]}</i></span>`).join('')}${owe?`<span>ค้างตอบแทนผู้อื่น ${owe} คาบ</span>`:''}${due?`<span>ผู้อื่นค้างตอบแทน ${due} คาบ</span>`:''}<button class="btn sm" data-gosub="1">เปิดหน้าสอนแทน</button></div>`;}

/* --- events --- */
$('#picker').addEventListener('click',e=>{const b=e.target.closest('[data-stab]');if(!b)return;V.stab=b.dataset.stab;RP=null;render();});
$('#view').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const D=b.dataset;
  if(D.gosub){V.view='sub';V.stab='day';return render();}
  if(D.abp){if(D.abp==='all')AB.periods=null;else{const p=+D.abp,s=new Set(AB.periods||[]);s.has(p)?s.delete(p):s.add(p);AB.periods=s.size?[...s].sort((a,b)=>a-b):null;}return render();}
  if(D.sdelab){const a=DB.absences.find(x=>x.id===D.sdelab);if(!a)return;
    return mutate(()=>{dropSubs(s=>s.date===a.date&&s.from===a.tid&&s.kind==='sub');DB.absences=DB.absences.filter(x=>x!==a);return`ยกเลิกการลาของ${nm(a.tid)}แล้ว`;});}
  if(D.sdel){const s=DB.subs.find(x=>x.id===D.sdel);if(!s)return;
    return mutate(()=>{dropSubs(x=>x===s||(s.kind==='swap'&&s.link&&x.kind==='swap'&&x.link===s.link));return`ลบรายการ${KIND[s.kind]}แล้ว`;});}
  if(D.srp){const s=DB.subs.find(x=>x.id===D.srp);RP={id:s.id,date:s.date>=TODAY?shiftDay(s.date,1):schoolToday()};render();window.scrollTo({top:0,behavior:'smooth'});return;}
  if(D.sclear)return mutate(()=>{DB.subs.find(x=>x.id===D.sclear).owed=false;return'ยกเลิกการค้างตอบแทนแล้ว';});
  if(D.rpl){const o=DB.subs.find(x=>x.id===RP.id),L=LB(D.rpl),date=RP.date;RP=null;
    return mutate(()=>{DB.subs.push(mkRec({date,p:L.p,from:o.to,to:o.from,kind:'repay',link:o.id},L));return`${nm(o.from)} ตอบแทน${nm(o.to)} ${thDate(date,1)} คาบ ${L.p+1}`;});}
  if(D.swl1){SW.lid1=D.swl1;SW.b='';SW.lid2='';return render();}
  if(D.swb){SW.b=D.swb;SW.lid2='';return render();}
  if(D.swm){SW.mode=D.swm;return render();}
  if(D.swl2){SW.lid2=D.swl2;return render();}
  const a=D.sact;if(!a)return;
  if(a==='prev'||a==='next'){V.sdate=shiftDay(V.sdate,a==='prev'?-1:1);return render();}
  if(a==='today'){V.sdate=schoolToday();return render();}
  if(a==='addab'){if(!AB.tid)return;const o={id:uid('A'),date:V.sdate,tid:AB.tid,reason:AB.reason,periods:AB.periods};AB.periods=null;
    return mutate(()=>{DB.absences.push(o);return`บันทึกการลาของ${nm(o.tid)}แล้ว`;});}
  if(a==='auto'){let n=0,left=0;mutate(()=>{dayRows(V.sdate).forEach(r=>{if(r.rec||r.co.length)return;const c=candidates(V.sdate,r.p,r.L,[r.a.tid])[0];
      if(c){DB.subs.push(mkRec({date:V.sdate,p:r.p,from:r.a.tid,to:c.t.uid,kind:'sub'},r.L));n++;}else left++;});
      return n?`จัดผู้สอนแทน ${n} คาบ${left?` · อีก ${left} คาบไม่มีครูว่าง`:''}`:false;});
    if(!n)toast('ไม่มีครูว่างในคาบที่เหลือ');return;}
  if(a==='copyslip')return copyText(slipText(V.sdate),'คัดลอกข้อความแล้ว วางในกลุ่ม LINE ได้เลย');
  if(a==='swapgo'){const L1=LB(SW.lid1),L2=SW.mode==='now'?LB(SW.lid2):null;if(!L1||!SW.b||(SW.mode==='now'&&!L2))return;
    const link=uid('K'),s={...SW};SW.lid1=SW.b=SW.lid2='';
    return mutate(()=>{DB.subs.push(mkRec({date:s.date1,p:L1.p,from:s.a,to:s.b,kind:'swap',owed:s.mode==='later',link:L2?link:null},L1));
      if(L2)DB.subs.push(mkRec({date:s.date2,p:L2.p,from:s.b,to:s.a,kind:'swap',link},L2));return'บันทึกการแลกคาบแล้ว';});}
  if(a==='rpcancel'){RP=null;return render();}
});
$('#view').addEventListener('change',e=>{const t=e.target;
  if(t.dataset.ssel){const L=LB(t.dataset.ssel),from=t.dataset.from,p=+t.dataset.p,to=t.value,date=V.sdate;if(!L)return;
    return mutate(()=>{const ex=DB.subs.find(s=>s.date===date&&s.lid===L.id&&s.from===from);
      if(!to){if(!ex)return false;dropSubs(s=>s===ex);return'ยกเลิกผู้สอนแทนแล้ว';}
      if(ex)ex.to=to;else DB.subs.push(mkRec({date,p,from,to,kind:'sub'},L));return`${nm(to)} สอนแทนคาบ ${p+1}`;});}
  if(t.dataset.sowe)return mutate(()=>{DB.subs.find(s=>s.id===t.dataset.sowe).owed=t.checked;return t.checked?'บันทึกเป็นคาบที่ต้องตอบแทน':'ยกเลิกการตอบแทน';});
  if(t.id==='sDate'&&t.value){V.sdate=t.value;return render();}
  if(t.id==='abT'){AB.tid=t.value;return;} if(t.id==='abR'){AB.reason=t.value;return;}
  if(t.id==='swA'){SW.a=t.value;SW.lid1=SW.b=SW.lid2='';return render();}
  if(t.id==='swD1'&&t.value){SW.date1=SW.date2=t.value;SW.lid1=SW.b=SW.lid2='';return render();}
  if(t.id==='swD2'&&t.value){SW.date2=t.value;SW.lid2='';return render();}
  if(t.id==='rpD'&&t.value&&RP){RP.date=t.value;return render();}
  if(t.id==='hT'){V.hT=t.value;return render();}
});
