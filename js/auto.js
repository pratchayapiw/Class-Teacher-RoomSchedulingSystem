/* ---------- automatic scheduling ---------- */
const lvlOf=c=>(+String(c).split('/')[0]>=4?'upper':'lower');
const rk=o=>`${o.code}|${o.cls}|${o.room||''}|${[...o.tids].sort().join('+')}`;
let AU={sel:new Set(),mode:'all',res:null,pv:'',ct:'',pt:new Set(),busy:false};
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

function buildJob(){const sel=AU.sel,S=settings();
  const moving=AU.mode==='all'?DB.lessons.filter(L=>L.type==='subj'&&!L.lock&&L.tids.some(u=>sel.has(u))):[];
  const mv=new Set(moving.map(L=>L.id)),fixed=DB.lessons.filter(L=>!mv.has(L.id)),reqs={};
  const R=o=>{const k=rk(o);return reqs[k]??={key:k,code:o.code,cls:o.cls,room:o.room||'',tids:[...o.tids],n:0,dbl:false,old:[],pids:[]};};
  moving.forEach(L=>{const r=R(L);r.n++;r.old.push([L.d,L.p]);});
  Object.values(reqs).forEach(r=>{r.dbl=r.old.some(([d,p])=>r.old.some(([d2,p2])=>d2===d&&p2===p+1));});
  pend().filter(P=>P.tids.some(u=>sel.has(u))).forEach(P=>{const r=R(P);r.n+=P.n;if(P.dbl)r.dbl=true;r.pids.push(P.id);});
  return{fixed,moving,reqs:Object.values(reqs).filter(r=>r.n>0),S};}

function solve(job,seed){
  const S=job.S,rnd=mulberry(seed),N=5*NP,T={},C={},Rm={},arr=(m,k)=>m[k]||(m[k]=new Int32Array(N));
  const clsForAct=a=>{const b=actCls(a);return b?DB.classes.filter(c=>baseCls(c.id)===b).map(c=>c.id):[];};
  job.fixed.forEach(L=>{const i=L.d*NP+L.p;L.tids.forEach(u=>arr(T,u)[i]=-1);
    if(L.type==='subj'){if(L.cls)arr(C,L.cls)[i]=-1;if(L.room)arr(Rm,L.room)[i]=-1;}else clsForAct(L.act).forEach(c=>arr(C,c)[i]=-1);});
  const units=[];job.reqs.forEach(r=>{let n=r.n;if(r.dbl)while(n>=2){units.push({r,len:2});n-=2;}while(n-->0)units.push({r,len:1});});
  units.forEach((u,i)=>u.i=i+1);
  const rcount={};units.forEach(u=>rcount[u.r.key]=(rcount[u.r.key]||0)+1);
  const rd={},day=(r,d)=>(rd[r.key]||(rd[r.key]=[0,0,0,0,0]))[d],pos=new Array(units.length+1).fill(null);
  const off={};Object.keys(DB.tcons||{}).forEach(u=>off[u]=new Set(tcon(u).off));
  const tLoad=(u,d)=>{const a=T[u];if(!a)return 0;let n=0;for(let p=0;p<NP;p++)if(a[d*NP+p])n++;return n;};
  const run=(u,d,p,len)=>{const a=arr(T,u);let s=p,e=p+len-1;while(s>0&&a[d*NP+s-1])s--;while(e<NP-1&&a[d*NP+e+1])e++;return e-s+1;};
  function why(un,d,p){const r=un.r;
    for(let k=0;k<un.len;k++){const q=p+k;if(q>=NP)return'ช่วงเวลาไม่พอ';if(r.cls&&q===S.lunch[lvlOf(r.cls)])return'คาบพักกลางวัน';const i=d*NP+q;
      for(const u of r.tids){if(arr(T,u)[i])return'ครูไม่ว่าง';if(off[u]&&off[u].has(i))return'ครูกำหนดว่าไม่ว่าง';}
      if(r.cls&&arr(C,r.cls)[i])return'ชั้นเรียนไม่ว่าง';if(r.room&&arr(Rm,r.room)[i])return'ห้องไม่ว่าง';}
    for(const u of r.tids){const md=tcon(u).maxDay||S.maxDay;if(tLoad(u,d)+un.len>md)return'เกินคาบสูงสุดต่อวัน';if(run(u,d,p,un.len)>S.maxConsec)return'สอนติดกันเกินกำหนด';}
    if(S.spread&&rcount[r.key]<=5&&day(r,d)>0)return'วิชาเดียวกันซ้ำวัน';
    return'';}
  function set(un,d,p,v){for(let k=0;k<un.len;k++){const i=d*NP+p+k;un.r.tids.forEach(u=>arr(T,u)[i]=v);if(un.r.cls)arr(C,un.r.cls)[i]=v;if(un.r.room)arr(Rm,un.r.room)[i]=v;}
    day(un.r,d);rd[un.r.key][d]+=v?1:-1;pos[un.i]=v?[d,p]:null;}
  const oldAt={};job.reqs.forEach(r=>{oldAt[r.key]=new Set(r.old.map(([d,p])=>d*NP+p));});
  function cost(un,d,p){const r=un.r;let c=0;if(S.avoidLast&&p+un.len-1===NP-1)c+=4;
    if(S.keep){let k=0;for(let q=0;q<un.len;q++)if(oldAt[r.key].has(d*NP+p+q))k++;if(k===un.len)c-=12;}
    r.tids.forEach(u=>{c+=tLoad(u,d)*1.2;});
    if(r.cls){const a=arr(C,r.cls);let n=0;for(let q=0;q<NP;q++)if(a[d*NP+q])n++;c+=n*0.4;}
    if((d>0&&day(r,d-1))||(d<4&&day(r,d+1)))c+=1.5;
    return c+rnd()*1.5;}
  function slots(un){const o=[];for(let d=0;d<5;d++)for(let p=0;p<=NP-un.len;p++)if(!why(un,d,p))o.push([d,p]);return o;}
  function pick(un,skip){let best=null,bc=1e9;for(const [d,p] of slots(un)){if(skip&&skip[0]===d&&skip[1]===p)continue;const c=cost(un,d,p);if(c<bc){bc=c;best=[d,p];}}return best;}
  function repair(un){let tries=0;
    for(let d=0;d<5;d++)for(let p=0;p<=NP-un.len;p++){if(tries>60)return false;
      const bl=new Set();let hard=false;
      for(let k=0;k<un.len;k++){const i=d*NP+p+k;const cells=[...un.r.tids.map(u=>arr(T,u)[i]),un.r.cls?arr(C,un.r.cls)[i]:0,un.r.room?arr(Rm,un.r.room)[i]:0];
        cells.forEach(v=>{if(v<0)hard=true;else if(v>0)bl.add(v);});}
      if(hard||bl.size!==1)continue;tries++;
      const b=units[[...bl][0]-1],bp=pos[b.i];set(b,bp[0],bp[1],0);
      if(!why(un,d,p)){set(un,d,p,un.i);const nb=pick(b,bp);if(nb){set(b,nb[0],nb[1],b.i);return true;}set(un,d,p,0);}
      set(b,bp[0],bp[1],b.i);}
    return false;}
  const order=units.map(u=>({u,k:slots(u).length-(u.len-1)*20+rnd()*3})).sort((a,b)=>a.k-b.k).map(x=>x.u);
  const unplaced=[];let total=0;
  for(const un of order){const best=pick(un);if(best){total+=cost(un,best[0],best[1]);set(un,best[0],best[1],un.i);continue;}
    if(!repair(un))unplaced.push(un);}
  const reasons=unplaced.map(un=>{const tally={};for(let d=0;d<5;d++)for(let p=0;p<=NP-un.len;p++){const w=why(un,d,p);if(w&&w!=='ช่วงเวลาไม่พอ'&&w!=='คาบพักกลางวัน')tally[w]=(tally[w]||0)+1;}
    return Object.entries(tally).sort((a,b)=>b[1]-a[1]).slice(0,2).map(x=>x[0]).join(', ')||'ไม่มีช่วงเวลาที่ตรงกัน';});
  return{units,pos,unplaced,reasons,cost:total};}

function runAuto(){const job=buildJob();if(!job.reqs.length){toast('ไม่มีคาบที่ต้องจัด เลือกครู หรือเพิ่มภาระงานก่อน');return;}
  AU.busy=true;AU.res=null;render();
  setTimeout(()=>{const t0=performance.now();let best=null,tries=0;
    while(tries<8||(performance.now()-t0<1600&&tries<300)){const r=solve(job,(Date.now()^(tries*7919))|0);tries++;
      if(!best||r.unplaced.length<best.unplaced.length||(r.unplaced.length===best.unplaced.length&&r.cost<best.cost))best=r;
      if(!best.unplaced.length&&tries>=16)break;}
    const lessons=[];best.units.forEach(un=>{const ps=best.pos[un.i];if(!ps)return;for(let k=0;k<un.len;k++)lessons.push({id:uid(),type:'subj',code:un.r.code,cls:un.r.cls,room:un.r.room,tids:[...un.r.tids],d:ps[0],p:ps[1]+k});});
    const old=new Set(job.moving.map(L=>rk(L)+'@'+L.d+'|'+L.p));
    best.lessons=lessons;best.job=job;best.tries=tries;best.need=job.reqs.reduce((a,r)=>a+r.n,0);best.moved=lessons.filter(L=>!old.has(rk(L)+'@'+L.d+'|'+L.p)).length;best.old=old;
    const aff=new Set();job.reqs.forEach(r=>r.tids.forEach(u=>aff.add(u)));best.aff=tSorted().filter(t=>aff.has(t.uid)).map(t=>t.uid);
    if(!best.aff.includes(AU.pv))AU.pv=best.aff[0]||'';
    AU.busy=false;AU.res=best;render();},30);}
function applyAuto(){const res=AU.res;if(!res)return;const job=res.job;
  if(job.moving.some(L=>!LB(L.id))){toast('ตารางถูกแก้ไขระหว่างนี้ กด "จัดตาราง" ใหม่อีกครั้ง');AU.res=null;return render();}
  mutate(()=>{const mv=new Set(job.moving.map(L=>L.id));DB.lessons=DB.lessons.filter(L=>!mv.has(L.id)).concat(res.lessons);
    const pids=new Set(job.reqs.flatMap(r=>r.pids));DB.pending=pend().filter(P=>!pids.has(P.id));
    job.reqs.forEach(r=>{const placed=res.lessons.filter(L=>rk(L)===r.key).length;if(placed<r.n)DB.pending.push({id:uid('P'),code:r.code,cls:r.cls,room:r.room,tids:[...r.tids],n:r.n-placed,dbl:r.dbl});});
    res.lessons.forEach(L=>ensureCatalog(L));AU.res=null;
    return`ใช้ผลการจัดตารางแล้ว ${res.lessons.length} คาบ${res.unplaced.length?' · คาบที่จัดไม่ได้ย้ายไปอยู่ในภาระงานที่ยังไม่ลงตาราง':''}`;});}

function pvGrid(tid,res){const S=settings(),all=res.job.fixed.concat(res.lessons).filter(L=>L.tids.includes(tid)),fresh=new Set(res.lessons);
  let h='<div class="tt-wrap"><table class="tt pv"><thead><tr><th class="corner">วัน</th>'+TIMES.map((t,i)=>`<th>${i+1}<span>${t}</span></th>`).join('')+'</tr></thead><tbody>';
  for(let d=0;d<5;d++){h+=`<tr><th class="day">${DAYS[d]}</th>`;
    for(let p=0;p<NP;p++){const Ls=all.filter(L=>L.d===d&&L.p===p);
      h+=`<td class="pvc">${Ls.map(L=>{const isNew=fresh.has(L),chg=isNew&&!res.old.has(rk(L)+'@'+d+'|'+p);
        return`<div class="lz ${kind(L)}${chg?' chg':''}${!isNew&&L.type==='subj'?' fx':''}"><b>${esc(L.type==='act'?L.act.split(' ')[0]:codeLabel(L.code))}</b>${L.type==='subj'?`<span>${esc(L.cls)}</span>`:''}</div>`;}).join('')}</td>`;}
    h+='</tr>';}
  return h+'</tbody></table></div>';}

function autoHTML(){const S=settings(),job=buildJob();
  const lockedN=DB.lessons.filter(L=>L.type==='subj'&&L.lock&&L.tids.some(u=>AU.sel.has(u))).length;
  const need=job.reqs.reduce((a,r)=>a+r.n,0);
  let h=`<div class="sheet"><div class="sheet-head"><div><h2><span class="code">1</span>เลือกครูที่จะจัดตาราง</h2><div class="meta">เลือกคนเดียวหรือหลายคนก็ได้ · คาบกิจกรรมและคาบที่ล็อกไว้จะอยู่ที่เดิม</div></div>
    <div class="row"><button class="btn sm" data-au="all">เลือกทั้งหมด</button><button class="btn sm" data-au="none">ล้าง</button></div></div>
    <div class="chips">${tSorted().map(t=>`<button class="chip" data-au-t="${t.uid}" aria-pressed="${AU.sel.has(t.uid)}"><span class="code">${esc(t.code)}</span>${esc(tShort(t))}</button>`).join('')}</div>
    <div class="seg"><button type="button" data-aum="all" aria-pressed="${AU.mode==='all'}">จัดใหม่ทุกคาบที่ไม่ล็อก</button><button type="button" data-aum="pending" aria-pressed="${AU.mode==='pending'}">จัดเฉพาะภาระงานที่ยังไม่ลงตาราง</button></div>
    <div class="row"><div class="stats"><span><b>${AU.sel.size}</b>ครู</span><span><b>${need}</b>คาบที่จะจัด</span><span><b>${lockedN}</b>คาบล็อก (คงเดิม)</span></div>
    <span class="spacer"></span><button class="btn sm" data-au="lock" ${AU.sel.size?'':'disabled'}>ล็อกคาบปัจจุบันของครูที่เลือก</button><button class="btn sm" data-au="unlock" ${AU.sel.size?'':'disabled'}>ปลดล็อก</button></div></div>`;
  // pending
  const P=pend().slice().sort((a,b)=>numSort(a.code,b.code)||sortCls(a.cls,b.cls));
  h+=`<div class="sheet"><div class="sheet-head"><div><h2><span class="code">2</span>ภาระงานที่ยังไม่ลงตาราง</h2><div class="meta">วิชาใหม่หรือคาบที่ยังไม่มีเวลาเรียน ระบบจะหาเวลาให้เมื่อกดจัดตาราง</div></div><div class="stats"><span><b>${P.reduce((a,x)=>a+x.n,0)}</b>คาบ</span></div></div>
    ${P.length?`<div class="tt-wrap" style="border:0"><table class="dt"><thead><tr><th>รหัสวิชา</th><th>รายวิชา</th><th>ชั้น</th><th>ห้อง</th><th>ครู</th><th class="num">คาบ/สัปดาห์</th><th>คาบคู่</th><th></th></tr></thead><tbody>${P.map(x=>`<tr><td><b>${esc(x.code)}</b></td><td class="note">${esc(subjTitle(x.code))}</td><td>${esc(x.cls)}</td><td>${esc(x.room||'–')}</td><td>${esc(x.tids.map(u=>tShort(TU(u))).join(' + '))}</td><td class="num"><b>${x.n}</b></td><td>${x.dbl?'คาบคู่':''}</td><td class="act"><button class="btn sm danger" data-au-pdel="${x.id}">ลบ</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="note">ยังไม่มีรายการ</div>'}
    <div class="addrow"><div class="field"><label for="pCode">รหัสวิชา</label><input id="pCode" list="dlCode" autocomplete="off" placeholder="อ21104"></div>
      <div class="field"><label for="pCls">ชั้น</label><input id="pCls" list="dlCls" autocomplete="off" placeholder="1/9"></div>
      <div class="field"><label for="pRoom">ห้อง</label><input id="pRoom" list="dlRoom" autocomplete="off" placeholder="ห้องประจำชั้น"></div>
      <div class="field"><label for="pN">คาบ/สัปดาห์</label><input id="pN" type="number" min="1" max="20" value="2"></div>
      <label class="check"><input type="checkbox" id="pDbl"> คาบคู่ (2 คาบติดกัน)</label></div>
    <div class="field"><span class="lbl">ครูผู้สอน (เลือกได้หลายคน)</span><div class="tpick">${tSorted().map(t=>`<button type="button" data-au-pt="${t.uid}" aria-pressed="${AU.pt.has(t.uid)}"><span class="code">${esc(t.code)}</span>${esc(tShort(t))}</button>`).join('')}</div></div>
    <div class="row"><button class="btn primary" data-au="padd">เพิ่มภาระงาน</button></div>
    <details class="bulk"><summary>เพิ่มหลายรายการพร้อมกัน</summary><div class="note">บรรทัดละ 1 รายการ: <b>รหัสวิชา ชั้น ห้อง ครู คาบ/สัปดาห์ [คู่]</b> · ครูหลายคนคั่นด้วย + · เว้นห้องได้ด้วย -</div>
      <textarea class="ta" id="pBulk" placeholder="อ21104 1/9 433 0901+0921 3&#10;จ23202 3/9 - 0912 2 คู่"></textarea><div class="row"><button class="btn" data-au="pbulk">เพิ่มทั้งหมด</button></div></details></div>`;
  // conditions
  if(!TU(AU.ct))AU.ct=[...AU.sel][0]||tSorted()[0]?.uid||'';
  const tc=tcon(AU.ct),offS=new Set(tc.off);
  const popt=v=>TIMES.map((t,i)=>`<option value="${i}" ${i===v?'selected':''}>คาบ ${i+1} (${t})</option>`).join('');
  h+=`<div class="sheet"><div class="sheet-head"><div><h2><span class="code">3</span>เงื่อนไข</h2><div class="meta">ใช้กับทุกครู แล้วกำหนดเพิ่มรายบุคคลได้</div></div></div>
    <div class="cond">
      <div class="field"><label for="auLL">พักกลางวัน ม.ต้น</label><select class="sel" id="auLL">${popt(S.lunch.lower)}</select></div>
      <div class="field"><label for="auLU">พักกลางวัน ม.ปลาย</label><select class="sel" id="auLU">${popt(S.lunch.upper)}</select></div>
      <div class="field"><label for="auMD">ครูสอนไม่เกิน (คาบ/วัน)</label><input id="auMD" type="number" min="1" max="8" value="${S.maxDay}"></div>
      <div class="field"><label for="auMC">สอนติดกันไม่เกิน (คาบ)</label><input id="auMC" type="number" min="1" max="8" value="${S.maxConsec}"></div>
      <label class="check"><input type="checkbox" id="auSP" ${S.spread?'checked':''}> วิชาเดียวกันไม่เรียนซ้ำวัน (ยกเว้นคาบคู่)</label>
      <label class="check"><input type="checkbox" id="auAL" ${S.avoidLast?'checked':''}> หลีกเลี่ยงคาบ 8</label>
      <label class="check"><input type="checkbox" id="auKP" ${S.keep?'checked':''}> คงเวลาเดิมให้มากที่สุด (ย้ายเฉพาะคาบที่จำเป็น)</label></div>
    <div class="step"><h3>เงื่อนไขรายบุคคล</h3>
      <div class="row"><select class="sel" id="auCT" aria-label="ครู">${tSorted().map(t=>`<option value="${t.uid}" ${t.uid===AU.ct?'selected':''}>${esc(t.code+' '+tShort(t))}</option>`).join('')}</select>
        <div class="field" style="flex-direction:row;align-items:center;gap:8px"><label for="auTMD">สอนไม่เกิน</label><input id="auTMD" type="number" min="1" max="8" value="${tc.maxDay||''}" placeholder="${S.maxDay}" style="width:80px"><span class="note">คาบ/วัน</span></div></div>
      <div class="note">แตะช่องเพื่อกำหนดเวลาที่ครูไม่ว่าง (เช่น ประชุม งานพิเศษ) ระบบจะไม่จัดคาบสอนในช่องนั้น</div>
      <div class="slots"><table class="sg"><thead><tr><th></th>${TIMES.map((_,p)=>`<th>${p+1}</th>`).join('')}</tr></thead><tbody>${[0,1,2,3,4].map(d=>`<tr><th>${DAYS[d].slice(0,d===3?3:2)}</th>${TIMES.map((_,p)=>{const i=d*NP+p,o=offS.has(i),act=IDX[d][p].find(L=>L.type==='act'&&L.tids.includes(AU.ct));
        return`<td><button type="button" data-au-off="${i}" aria-pressed="${o}" class="${act&&!o?'busy':''}" title="${esc(DAYS[d]+' คาบ '+(p+1)+(act?' · '+act.act:''))}">${o?'ไม่ว่าง':act?'กิจกรรม':''}</button></td>`;}).join('')}</tr>`).join('')}</tbody></table></div></div></div>`;
  // run
  h+=`<div class="sheet"><div class="sheet-head"><div><h2><span class="code">4</span>จัดตาราง</h2><div class="meta">ระบบทดลองจัดหลายรอบแล้วเลือกผลที่ดีที่สุด ดูตัวอย่างก่อนกดใช้ได้</div></div>
    <button class="btn primary" data-au="run" ${need&&!AU.busy?'':'disabled'}>${AU.busy?'กำลังจัด…':'จัดตาราง'}</button></div>`;
  const r=AU.res;
  if(AU.busy)h+='<div class="note">กำลังจัดตาราง…</div>';
  else if(r){const placed=r.lessons.length;
    h+=`<div class="stats"><span><b>${placed}/${r.need}</b>คาบที่จัดได้</span><span><b>${r.moved}</b>คาบที่เปลี่ยนเวลา</span><span><b>${r.need-placed}</b>คาบที่จัดไม่ได้</span><span><b>${r.tries}</b>รอบที่ทดลอง</span></div>
      ${r.unplaced.length?`<div class="warn bad">${r.unplaced.map((un,i)=>`<span>⚠ ${esc(codeLabel(un.r.code))} ม.${esc(un.r.cls)} (${esc(un.r.tids.map(u=>tShort(TU(u))).join(' + '))}) ${un.len===2?'คาบคู่':'1 คาบ'} — ${esc(r.reasons[i])}</span>`).join('')}<span style="opacity:.85">ลองผ่อนเงื่อนไข หรือปลดล็อกคาบบางส่วน แล้วกดจัดตารางอีกครั้ง</span></div>`:'<div class="warn good">จัดได้ครบทุกคาบ ไม่ชนกับคาบอื่น</div>'}
      <div class="chips">${r.aff.map(u=>`<button class="chip" data-au-pv="${u}" aria-pressed="${u===AU.pv}">${esc(tShort(TU(u)))}</button>`).join('')}</div>
      ${AU.pv?pvGrid(AU.pv,r):''}
      <div class="legend"><span><i class="pvk-chg"></i>เวลาใหม่</span><span><i class="pvk-fx"></i>คาบเดิมที่ไม่ย้าย</span></div>
      <div class="row"><button class="btn primary" data-au="apply">ใช้ผลลัพธ์นี้</button><button class="btn" data-au="run">จัดใหม่อีกครั้ง</button><button class="btn ghost" data-au="discard">ยกเลิก</button></div>`;}
  return h+'</div>';}

function parsePendingLine(l){const tk=l.trim().split(/[\t,]|\s+/).filter(Boolean);if(tk.length<5)return null;
  const dbl=/^คู่$/.test(tk[tk.length-1]);if(dbl)tk.pop();const n=parseInt(tk.pop(),10),tids=resolveT(tk.pop());
  if(!n||n<1||!tids.length||tids.includes(null)||tk.length<2)return null;
  return{id:uid('P'),code:tk[0],cls:tk[1],room:tk[2]&&tk[2]!=='-'?tk[2]:(DB.classes.find(c=>c.id===tk[1])?.room||''),tids,n,dbl};}

$('#view').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||V.view!=='auto')return;const D=b.dataset;
  if(D.auT){AU.sel.has(D.auT)?AU.sel.delete(D.auT):AU.sel.add(D.auT);AU.res=null;return render();}
  if(D.aum){AU.mode=D.aum;AU.res=null;return render();}
  if(D.auPt){AU.pt.has(D.auPt)?AU.pt.delete(D.auPt):AU.pt.add(D.auPt);b.setAttribute('aria-pressed',AU.pt.has(D.auPt));return;}
  if(D.auPv){AU.pv=D.auPv;return render();}
  if(D.auPdel)return mutate(()=>{DB.pending=pend().filter(x=>x.id!==D.auPdel);return'ลบภาระงานแล้ว';});
  if(D.auOff!==undefined){const i=+D.auOff;return mutate(()=>{const c=tcon(AU.ct),s=new Set(c.off);s.has(i)?s.delete(i):s.add(i);c.off=[...s].sort((a,b)=>a-b);});}
  const a=D.au;if(!a)return;
  if(a==='all'){tSorted().forEach(t=>AU.sel.add(t.uid));AU.res=null;return render();}
  if(a==='none'){AU.sel.clear();AU.res=null;return render();}
  if(a==='run')return runAuto();
  if(a==='discard'){AU.res=null;return render();}
  if(a==='apply')return applyAuto();
  if(a==='lock'||a==='unlock'){const on=a==='lock';return mutate(()=>{let n=0;DB.lessons.forEach(L=>{if(L.type==='subj'&&L.tids.some(u=>AU.sel.has(u))&&!!L.lock!==on){L.lock=on||undefined;if(!on)delete L.lock;n++;}});return n?`${on?'ล็อก':'ปลดล็อก'} ${n} คาบ`:false;});}
  if(a==='padd'){const code=$('#pCode').value.trim(),cls=$('#pCls').value.trim(),n=parseInt($('#pN').value,10),tids=tSorted().map(t=>t.uid).filter(u=>AU.pt.has(u));
    if(!code||!cls||!n||!tids.length){toast('ใส่รหัสวิชา ชั้น จำนวนคาบ และเลือกครูให้ครบ');return;}
    const room=$('#pRoom').value.trim()||DB.classes.find(c=>c.id===cls)?.room||'',dbl=$('#pDbl').checked;AU.pt.clear();
    return mutate(()=>{pend().push({id:uid('P'),code,cls,room,tids,n,dbl});ensureCatalog({type:'subj',code,cls,room});tids.forEach(u=>AU.sel.add(u));return`เพิ่ม ${code} ม.${cls} ${n} คาบ`;});}
  if(a==='pbulk'){const lines=$('#pBulk').value.split(/\r?\n/).filter(s=>s.trim());const ok=[],bad=[];lines.forEach((l,i)=>{const x=parsePendingLine(l);x?ok.push(x):bad.push(i+1);});
    if(!ok.length){toast(bad.length?`รูปแบบไม่ถูกต้อง บรรทัด ${bad.join(', ')}`:'วางข้อมูลก่อน');return;}
    return mutate(()=>{ok.forEach(x=>{pend().push(x);ensureCatalog({type:'subj',code:x.code,cls:x.cls,room:x.room});x.tids.forEach(u=>AU.sel.add(u));});return`เพิ่ม ${ok.length} รายการ${bad.length?` · ข้ามบรรทัด ${bad.join(', ')}`:''}`;});}
});
$('#view').addEventListener('change',e=>{if(V.view!=='auto')return;const t=e.target,S=settings();
  const num=(v,lo,hi)=>Math.min(hi,Math.max(lo,parseInt(v,10)||lo));
  if(t.id==='auLL')return mutate(()=>{S.lunch={...S.lunch,lower:+t.value};AU.res=null;});
  if(t.id==='auLU')return mutate(()=>{S.lunch={...S.lunch,upper:+t.value};AU.res=null;});
  if(t.id==='auMD')return mutate(()=>{S.maxDay=num(t.value,1,8);AU.res=null;});
  if(t.id==='auMC')return mutate(()=>{S.maxConsec=num(t.value,1,8);AU.res=null;});
  if(t.id==='auSP')return mutate(()=>{S.spread=t.checked;AU.res=null;});
  if(t.id==='auAL')return mutate(()=>{S.avoidLast=t.checked;AU.res=null;});
  if(t.id==='auKP')return mutate(()=>{S.keep=t.checked;AU.res=null;});
  if(t.id==='auCT'){AU.ct=t.value;return render();}
  if(t.id==='auTMD')return mutate(()=>{tcon(AU.ct).maxDay=t.value?num(t.value,1,8):null;AU.res=null;});
});
