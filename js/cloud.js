/* ---------- Supabase sync, sign-in, version history ---------- */
const CFG=window.APP_CONFIG||{},TERM=CFG.termId||'2569-2';
let SB=null;
const CL={on:false,user:null,editor:false,ver:0,dirty:false,saving:false,st:'local',msg:''};
function canEdit(){return !CL.on||(!!CL.user&&CL.editor);}
document.body.insertAdjacentHTML('beforeend',`<dialog id="dlgAcc"><div class="dlg" id="accBody"></div></dialog>`);
$('.bar-actions').insertAdjacentHTML('afterbegin','<button class="cchip" id="cloudChip" type="button" hidden></button>');
const ST={
  local:['','เก็บในเครื่องนี้'],ro:['ro','ดูอย่างเดียว · เข้าสู่ระบบ'],noperm:['ro','บัญชีนี้ยังไม่มีสิทธิ์แก้ไข'],
  loading:['wait','กำลังโหลด…'],saved:['ok','ออนไลน์ · บันทึกแล้ว'],pending:['wait','รอบันทึก…'],saving:['wait','กำลังบันทึก…'],
  offline:['bad','ออฟไลน์ · ยังไม่ได้บันทึก'],conflict:['bad','มีการแก้ไขจากเครื่องอื่น'],error:['bad','บันทึกไม่สำเร็จ']};
function setSt(s,msg){CL.st=s;CL.msg=msg||'';paintChip();}
function paintChip(){const b=$('#cloudChip');if(!b)return;const [k,l]=ST[CL.st]||ST.local;b.hidden=IS_ARTIFACT;b.className='cchip '+k;b.textContent=l;b.title=CL.msg||l;}
AFTER.push(paintChip);

async function cloudInit(){
  if(!CFG.supabaseUrl||!CFG.supabaseAnonKey||!window.supabase){setSt('local');return;}
  SB=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey);CL.on=true;setSt('loading');
  try{const {data}=await SB.auth.getSession();await setUser(data.session?.user||null,true);}catch(e){}
  SB.auth.onAuthStateChange((_e,s)=>{const u=s?.user||null;if((u&&u.id)!==(CL.user&&CL.user.id))setUser(u);});
  await pull();
  SB.channel('tt-'+TERM).on('postgres_changes',{event:'*',schema:'public',table:'timetables',filter:`id=eq.${TERM}`},p=>{
    const v=p.new&&p.new.version;if(!v||v<=CL.ver||CL.saving)return;
    if(CL.dirty)setSt('conflict','มีผู้อื่นบันทึกข้อมูลใหม่กว่า');else pull(true);}).subscribe();
  window.addEventListener('online',()=>{if(CL.dirty)save();});
}
async function setUser(u,quiet){CL.user=u;CL.editor=false;
  if(u){try{const {data}=await SB.from('editors').select('email').eq('email',u.email).maybeSingle();CL.editor=!!data;}catch(e){}}
  if(!quiet){setSt(stIdle());render();if(CL.editor&&CL.ver===0&&!CL.saving){CL.dirty=true;save();}}}
const stIdle=()=>!CL.user?'ro':!CL.editor?'noperm':CL.dirty?'pending':'saved';
async function pull(remote){const {data,error}=await SB.from('timetables').select('data,version,updated_at,updated_by_email').eq('id',TERM).maybeSingle();
  if(error){setSt('error',error.message);return;}
  if(!data){CL.ver=0;setSt(stIdle());if(CL.editor){CL.dirty=true;save();}return;}
  DB=finishDB(data.data);CL.ver=data.version;CL.dirty=false;CL.meta=data;UNDO=[];REDO=[];render();setSt(stIdle());
  if(remote)toast(`ตารางอัปเดตแล้ว${data.updated_by_email?' โดย '+data.updated_by_email:''}`);}
let saveT=null;
function onDBChange(){if(!CL.on||!canEdit())return;CL.dirty=true;setSt('pending');clearTimeout(saveT);saveT=setTimeout(save,700);}
async function save(force){if(!CL.on||!CL.editor||CL.saving)return;
  if(!navigator.onLine){setSt('offline');return;}
  CL.saving=true;setSt('saving');
  const {data,error}=await SB.rpc('save_timetable',{p_id:TERM,p_data:DB,p_base:CL.ver});
  CL.saving=false;
  if(error){if(/conflict/i.test(error.message)){setSt('conflict','มีผู้อื่นบันทึกข้อมูลก่อน');}else setSt(navigator.onLine?'error':'offline',error.message);return;}
  CL.ver=data;CL.dirty=false;setSt('saved');}
async function overwrite(){const {data}=await SB.from('timetables').select('version').eq('id',TERM).maybeSingle();CL.ver=data?data.version:0;CL.dirty=true;await save();}

/* --- account dialog --- */
async function openAcc(){const box=$('#accBody'),close='<button type="button" class="x" data-acc="close" aria-label="ปิด">×</button>';
  if(!CL.on){box.innerHTML=`<div class="dlg-head"><div><h3>บันทึกข้อมูลในเครื่องนี้</h3><div class="sub">ยังไม่ได้เชื่อมต่อฐานข้อมูลออนไลน์ ข้อมูลจึงอยู่ในเบราว์เซอร์นี้เท่านั้น</div></div>${close}</div><div class="note">ผู้ดูแลระบบใส่ค่า Supabase ในไฟล์ config.js เพื่อให้ครูทุกคนใช้ข้อมูลชุดเดียวกัน (ดู README)</div>`;return $('#dlgAcc').showModal();}
  let h='';
  if(CL.st==='conflict')h+=`<div class="warn bad"><span>มีผู้อื่นบันทึกตารางในระหว่างที่คุณแก้ไข</span><span>เลือกว่าจะใช้ข้อมูลชุดไหน</span></div><div class="row"><button class="btn primary" data-acc="pull">โหลดข้อมูลล่าสุด (ทิ้งการแก้ไขของฉัน)</button><button class="btn danger" data-acc="force">บันทึกทับด้วยข้อมูลของฉัน</button></div>`;
  if(CL.st==='error'||CL.st==='offline')h+=`<div class="warn bad"><span>${esc(CL.msg||'บันทึกไม่สำเร็จ')}</span></div><div class="row"><button class="btn primary" data-acc="retry">ลองบันทึกอีกครั้ง</button></div>`;
  if(!CL.user){h+=`<form class="dlg" id="loginForm" style="padding:0"><div class="field"><label for="lgEmail">อีเมล</label><input id="lgEmail" type="email" autocomplete="username" required></div>
    <div class="field"><label for="lgPass">รหัสผ่าน</label><input id="lgPass" type="password" autocomplete="current-password" required></div><div id="lgMsg"></div>
    <div class="dlg-actions"><button class="btn primary" type="submit">เข้าสู่ระบบ</button></div><div class="note">ทุกคนเปิดดูตารางได้ ส่วนการแก้ไขต้องใช้บัญชีที่ผู้ดูแลระบบเพิ่มให้</div></form>`;
    box.innerHTML=`<div class="dlg-head"><div><h3>เข้าสู่ระบบเพื่อแก้ไข</h3></div>${close}</div>`+h;}
  else{box.innerHTML=`<div class="dlg-head"><div><h3>บัญชีของฉัน</h3><div class="sub">${esc(CL.user.email)} · ${CL.editor?'แก้ไขได้':'ดูอย่างเดียว (ยังไม่อยู่ในรายชื่อผู้แก้ไข)'}</div></div>${close}</div>${h}
    <div class="note">${CL.meta&&CL.meta.updated_at?`บันทึกล่าสุด ${new Date(CL.meta.updated_at).toLocaleString('th-TH')} ${CL.meta.updated_by_email?'โดย '+esc(CL.meta.updated_by_email):''} · `:''}เวอร์ชัน ${CL.ver}</div>
    <div class="step"><h3>ประวัติการแก้ไข</h3><div id="histList" class="conf-list"><span class="note">กำลังโหลด…</span></div></div>
    <div class="dlg-actions"><button class="btn" data-acc="logout">ออกจากระบบ</button></div>`;
    loadHist();}
  if(!$('#dlgAcc').open)$('#dlgAcc').showModal();}
async function loadHist(){const el=$('#histList');if(!el)return;
  const {data,error}=await SB.from('timetable_history').select('hid,version,saved_at,saved_by_email').eq('id',TERM).order('hid',{ascending:false}).limit(30);
  if(error){el.innerHTML=`<span class="note">${esc(error.message)}</span>`;return;}
  el.innerHTML=data.length?data.map(r=>`<div class="ab"><div><b>เวอร์ชัน ${r.version}</b><div class="note">${new Date(r.saved_at).toLocaleString('th-TH')} · ${esc(r.saved_by_email||'')}</div></div>${CL.editor?`<button class="btn sm" data-acc-h="${r.hid}">กู้คืน</button>`:''}</div>`).join(''):'<span class="note">ยังไม่มีประวัติ</span>';}
$('#cloudChip').onclick=openAcc;
$('#dlgAcc').addEventListener('submit',async e=>{if(e.target.id!=='loginForm')return;e.preventDefault();$('#lgMsg').innerHTML='<span class="note">กำลังเข้าสู่ระบบ…</span>';
  const {data,error}=await SB.auth.signInWithPassword({email:$('#lgEmail').value.trim(),password:$('#lgPass').value});
  if(error){$('#lgMsg').innerHTML='<div class="warn bad">อีเมลหรือรหัสผ่านไม่ถูกต้อง</div>';return;}
  await setUser(data.user);await pull();openAcc();toast(CL.editor?'เข้าสู่ระบบแล้ว แก้ไขตารางได้':'เข้าสู่ระบบแล้ว แต่บัญชีนี้ยังไม่มีสิทธิ์แก้ไข');});
$('#dlgAcc').addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;const a=b.dataset.acc;
  if(a==='close')return $('#dlgAcc').close();
  if(a==='logout'){await SB.auth.signOut();await setUser(null);$('#dlgAcc').close();return toast('ออกจากระบบแล้ว');}
  if(a==='pull'){await pull();$('#dlgAcc').close();return toast('โหลดข้อมูลล่าสุดแล้ว');}
  if(a==='force'){await overwrite();$('#dlgAcc').close();return;}
  if(a==='retry'){await save();return openAcc();}
  if(b.dataset.accH){const {data,error}=await SB.from('timetable_history').select('data,version').eq('hid',+b.dataset.accH).single();
    if(error)return toast('โหลดเวอร์ชันนี้ไม่สำเร็จ');$('#dlgAcc').close();mutate(()=>{DB=finishDB(data.data);return`กู้คืนเวอร์ชัน ${data.version} แล้ว`;});}
});
