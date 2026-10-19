/* ---------- shared helpers & settings ---------- */
window.AFTER=window.AFTER||[];
const IS_ARTIFACT=window.APP_ENV==='artifact';
function settings(){const s=DB.settings||(DB.settings={});
  s.school??='โรงเรียนวรราชาทินัดดามาตุวิทยา'; s.group??='กลุ่มสาระการเรียนรู้ภาษาต่างประเทศ'; s.term??='ภาคเรียนที่ 2 ปีการศึกษา 2569';
  s.head??=''; s.deputy??=''; s.director??='';
  s.lunch??={lower:3,upper:4}; s.maxDay??=6; s.maxConsec??=4; s.spread??=true; s.avoidLast??=true; s.keep??=true;
  return s;}
{const base=render;let busy=false,again=false;render=function(){if(busy){again=true;return;}busy=true;try{base();}finally{busy=false;}if(again){again=false;render();}};}
const pend=()=>DB.pending||(DB.pending=[]);
const tcon=u=>{const c=DB.tcons||(DB.tcons={});return c[u]||(c[u]={off:[],maxDay:null});};
function downloadBlob(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1500);}
const stamp=()=>{const t=new Date();return`${t.getFullYear()}${String(t.getMonth()+1).padStart(2,'0')}${String(t.getDate()).padStart(2,'0')}-${String(t.getHours()).padStart(2,'0')}${String(t.getMinutes()).padStart(2,'0')}`;};
