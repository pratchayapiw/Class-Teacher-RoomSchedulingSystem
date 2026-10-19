/* ---------- summaries: per teacher / class / room ---------- */
const ENGT=()=>tSorted().filter(t=>/^ENG/i.test(t.name));
const isNativeT=u=>/^ENG/i.test(TU(u)?.name||'');
const baseCls=c=>(String(c).match(/^(\d+\/\d+)/)||[])[1]||'';
const actCls=a=>(String(a).match(/ม\.\s?(\d+\/\d+)/)||[])[1]||'';
function inClass(L,c){return L.type==='subj'?L.cls===c:!!actCls(L.act)&&actCls(L.act)===baseCls(c);}
const kindOf=L=>L.type==='act'?(/^ค้นคว้า/.test(L.act)?'is':'act'):(L.code==='Ind.Study'?'is':'teach');
const engShort=t=>t.name.split(' ')[0];
function summarize(Ls,self){
  const s={teach:0,act:0,is:0,eng:{},co:0,solo:0,slots:new Set(),cls:new Set(),bySubj:{},byAct:{}};
  const eng=ENGT();
  Ls.forEach(L=>{const k=kindOf(L);s[k]++;s.slots.add(L.d+'|'+L.p);
    if(L.type==='subj'){if(L.cls)s.cls.add(L.cls);
      eng.forEach(e=>{if(e.uid!==self&&L.tids.includes(e.uid))s.eng[e.uid]=(s.eng[e.uid]||0)+1;});
      L.tids.length>1?s.co++:s.solo++;
      const g=(s.bySubj[L.code+'|'+L.cls]??={code:L.code,cls:L.cls,n:0,k,rooms:new Set(),tids:new Set(),tc:{},eng:{}});
      g.n++;if(L.room)g.rooms.add(L.room);L.tids.forEach(u=>{g.tids.add(u);g.tc[u]=(g.tc[u]||0)+1;});
      eng.forEach(e=>{if(e.uid!==self&&L.tids.includes(e.uid))g.eng[e.uid]=(g.eng[e.uid]||0)+1;});}
    else{const g=(s.byAct[L.act]??={n:0,k});g.n++;}});
  return s;}
function tilesFor(ctx,s,self){
  const eng=ENGT().filter(e=>e.uid!==self),T=[];
  if(ctx==='room'){T.push(['คาบที่ใช้',s.slots.size,`${Math.round(s.slots.size/(NP*5)*100)}% ของ ${NP*5} คาบ`,'']);T.push(['ชั้นที่ใช้',s.cls.size,'ชั้น','']);}
  else T.push([ctx==='class'?'คาบเรียน':'คาบสอน',s.teach,'คาบ/สัปดาห์','k-en1']);
  if(ctx!=='room'){T.push(['คาบกิจกรรม',s.act,'รวมประชุม','k-act']);T.push(['ค้นคว้าอิสระ',s.is,'คาบ','k-is']);}
  if(self&&isNativeT(self)){T.push(['สอนร่วมครูไทย',s.co,'คาบ','k-nat']);T.push(['สอนเดี่ยว',s.solo,'คาบ','k-nat']);}
  eng.forEach(e=>T.push([`${ctx==='teacher'?'ร่วมกับ ':'มี '}${engShort(e)}`,s.eng[e.uid]||0,'คาบ','k-nat']));
  if(ctx==='teacher'){T.push(['รวมทั้งหมด',s.teach+s.act+s.is,'คาบ','']);}
  if(ctx==='class')T.push(['รายวิชา',new Set(Object.values(s.bySubj).map(g=>g.code)).size,'วิชา','']);
  return T;}
function sumData(ctx,key){
  const f=ctx==='teacher'?L=>L.tids.includes(key):ctx==='class'?L=>inClass(L,key):L=>L.type==='subj'&&L.room===key;
  const self=ctx==='teacher'?key:null,s=summarize(DB.lessons.filter(f),self);
  return{s,self,tiles:tilesFor(ctx,s,self)};}
function sumHTML(ctx,key){if(!key)return'';const {s,self,tiles}=sumData(ctx,key);
  const rows=Object.values(s.bySubj).sort((a,b)=>numSort(a.code,b.code)||sortCls(a.cls,b.cls));
  const who=g=>[...g.tids].filter(u=>u!==self).map(u=>tShort(TU(u))).join(' + ');
  const third=ctx==='class'?'ครูผู้สอน':'ชั้น';
  let h=`<div class="sum"><h3 class="sum-h">สรุป${ctx==='teacher'?'ตารางสอน':ctx==='class'?'ตารางเรียน':'การใช้ห้อง'}</h3>
    <div class="tiles">${tiles.map(([l,v,sub,k])=>`<div class="tile"><span>${k?`<i class="${k}"></i>`:''}${esc(l)}</span><b>${v}</b><small>${esc(sub)}</small></div>`).join('')}</div>`;
  if(rows.length)h+=`<div class="tt-wrap" style="border:0"><table class="dt sum-t"><thead><tr><th>รหัสวิชา</th><th>รายวิชา</th><th>${third}</th>${ctx==='room'?'<th>ครูผู้สอน</th>':'<th>ห้อง</th>'}<th class="num">คาบ/สัปดาห์</th><th>${ctx==='teacher'?'สอนร่วม':'หมายเหตุ'}</th></tr></thead><tbody>
    ${rows.map(g=>`<tr><td><b>${esc(codeLabel(g.code))}</b></td><td>${esc(subjTitle(g.code))}</td><td>${esc(ctx==='class'?who(g):g.cls)}</td><td>${esc(ctx==='room'?who(g):[...g.rooms].join(', '))}</td><td class="num"><b>${g.n}</b></td><td>${ctx==='teacher'?esc([...g.tids].filter(u=>u!==self).map(u=>`${tShort(TU(u))} ${g.tc[u]} คาบ`).join(', ')):''}${g.k==='is'?' <span class="pill tag-is">ค้นคว้า</span>':''}</td></tr>`).join('')}
    </tbody><tfoot><tr><th colspan="4">รวม</th><th class="num">${rows.reduce((a,g)=>a+g.n,0)}</th><th></th></tr></tfoot></table></div>`;
  const acts=Object.entries(s.byAct).sort((a,b)=>b[1].n-a[1].n);
  if(acts.length)h+=`<div class="acts"><span class="lbl">กิจกรรมและค้นคว้า</span>${acts.map(([a,g])=>`<span class="${g.k==='is'?'k-is':'k-act'}">${esc(a)} · ${g.n}</span>`).join('')}</div>`;
  return h+'</div>';}
function sumTSV(ctx,key){ctx=ctx||V.view;key=key||(ctx==='teacher'?V.t:ctx==='class'?V.c:V.r);if(!key)return'';
  const {s,self,tiles}=sumData(ctx,key),o=['สรุป',tiles.map(t=>t[0]).join('\t'),tiles.map(t=>t[1]).join('\t'),'','รหัสวิชา\tรายวิชา\tชั้น\tครูผู้สอน\tห้อง\tคาบ/สัปดาห์'];
  Object.values(s.bySubj).sort((a,b)=>numSort(a.code,b.code)||sortCls(a.cls,b.cls)).forEach(g=>o.push([codeLabel(g.code),subjTitle(g.code),g.cls,[...g.tids].map(u=>tShort(TU(u))).join(' + '),[...g.rooms].join(', '),g.n].join('\t')));
  Object.entries(s.byAct).forEach(([a,g])=>o.push([a,g.k==='is'?'ค้นคว้าอิสระ':'กิจกรรม','','','',g.n].join('\t')));
  return o.join('\n');}

/* --- summary page --- */
V.sumtab=V.sumtab||'teachers';
function sumPickerHTML(){return'<div class="subtabs">'+[['teachers','รายคน'],['classes','รายชั้น'],['rooms','รายห้อง']].map(([k,l])=>`<button class="chip" data-sumtab="${k}" aria-pressed="${k===V.sumtab}">${l}</button>`).join('')+'</div>';}
function sumTable(){const eng=ENGT();
  if(V.sumtab==='classes'){const rows=DB.classes.map(c=>({c,s:summarize(DB.lessons.filter(L=>inClass(L,c.id)))})).sort((a,b)=>sortCls(a.c.id,b.c.id));
    return{title:'สรุปรายชั้น',meta:'คาบเรียนของกลุ่มสาระฯ ต่อสัปดาห์ · ค้นคว้าอิสระนับจากกิจกรรมที่ระบุชั้น',
      head:['ชั้น','ห้องประจำ','คาบเรียน','ค้นคว้า',...eng.map(e=>'มี '+engShort(e)),'จำนวนวิชา'],num:[2,3,...eng.map((_,i)=>4+i),4+eng.length],
      rows:rows.map(({c,s})=>({open:`data-open-c="${esc(c.id)}"`,cells:[c.id,c.room||'–',s.teach,s.is,...eng.map(e=>s.eng[e.uid]||0),new Set(Object.values(s.bySubj).map(g=>g.code)).size]})),sum:[2,3,...eng.map((_,i)=>4+i)]};}
  if(V.sumtab==='rooms'){const rows=DB.rooms.map(r=>({r,s:summarize(DB.lessons.filter(L=>L.type==='subj'&&L.room===r.id))})).sort((a,b)=>numSort(a.r.id,b.r.id));
    return{title:'สรุปการใช้ห้อง',meta:`คาบที่กลุ่มสาระฯ ใช้ห้อง จาก ${NP*5} คาบต่อสัปดาห์`,
      head:['ห้อง','หมายเหตุ','คาบที่ใช้','% การใช้','ชั้นที่ใช้',...eng.map(e=>'มี '+engShort(e))],num:[2,3,4,...eng.map((_,i)=>5+i)],
      rows:rows.map(({r,s})=>({open:`data-open-r="${esc(r.id)}"`,cells:[r.id,r.note||'',s.slots.size,Math.round(s.slots.size/(NP*5)*100)+'%',[...s.cls].sort(sortCls).join(', '),...eng.map(e=>s.eng[e.uid]||0)]})),sum:[2,...eng.map((_,i)=>5+i)]};}
  const rows=tSorted().map(t=>({t,s:summarize(DB.lessons.filter(L=>L.tids.includes(t.uid)),t.uid)}));
  return{title:'สรุปรายคน',meta:'ต่อสัปดาห์ ไม่รวมโฮมรูมและ PLC · คาบสอนร่วมนับให้ครูทุกคนในคาบ · แถว ENG แสดงคาบที่สอนร่วมกับครูไทย (ไม่นับซ้ำในแถวรวม)',
    head:['รหัส','ชื่อ-นามสกุล','คาบสอน','กิจกรรม','ค้นคว้า',...eng.map(e=>'ร่วม '+engShort(e)),'รวม'],num:[2,3,4,...eng.map((_,i)=>5+i),5+eng.length],
    rows:rows.map(({t,s})=>({skip:isNativeT(t.uid)?eng.map((_,i)=>5+i):[],open:`data-open-t="${t.uid}"`,cells:[t.code,t.name,s.teach,s.act,s.is,...eng.map(e=>e.uid===t.uid?s.co:(s.eng[e.uid]||0)),s.teach+s.act+s.is]})),
    sum:[2,3,4,...eng.map((_,i)=>5+i),5+eng.length]};}
function sumPageHTML(){const T=sumTable(),tot=T.head.map((_,i)=>T.sum.includes(i)?T.rows.reduce((a,r)=>a+((r.skip||[]).includes(i)?0:(+r.cells[i]||0)),0):'');tot[0]='รวม';
  return`<div class="sheet"><div class="sheet-head"><div><h2>${T.title}</h2><div class="meta">${T.meta} · แตะแถวเพื่อเปิดตาราง</div></div><button class="btn sm" data-sumcopy="1">คัดลอกไปวางใน Excel</button></div>
    <div class="tt-wrap" style="border:0"><table class="dt"><thead><tr>${T.head.map((h,i)=>`<th class="${T.num.includes(i)?'num':''}">${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${T.rows.map(r=>`<tr class="click" ${r.open}>${r.cells.map((c,i)=>`<td class="${T.num.includes(i)?'num':''}">${i===2?`<b>${esc(c)}</b>`:esc(c===0?'–':c)}</td>`).join('')}</tr>`).join('')}</tbody>
    <tfoot><tr>${tot.map((c,i)=>`<th class="${T.num.includes(i)?'num':''}">${esc(c)}</th>`).join('')}</tr></tfoot></table></div></div>`;}
$('#picker').addEventListener('click',e=>{const b=e.target.closest('[data-sumtab]');if(!b)return;V.sumtab=b.dataset.sumtab;render();});
$('#view').addEventListener('click',e=>{const b=e.target.closest('[data-sumcopy]');if(!b)return;const T=sumTable();
  copyText([T.title+' ภาคเรียนที่ 2/2569',T.head.join('\t'),...T.rows.map(r=>r.cells.join('\t'))].join('\n'),'คัดลอกแล้ว วางใน Excel หรือ Google Sheets ได้เลย');});
