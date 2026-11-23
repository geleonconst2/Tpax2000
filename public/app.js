
const $=s=>document.querySelector(s);
let bosses=[],tab='active',hours=1,editing=null;

const login=$('#login'),app=$('#app'),logout=$('#logout'),cards=$('#cards'),allPanel=$('#allPanel');

async function api(url,opts={}){
  const r=await fetch(url,{headers:{'Content-Type':'application/json'},...opts});
  let d={};
  try{d=await r.json()}catch{}
  if(!r.ok)throw Error(d.error||'Ошибка запроса');
  return d;
}

function toLocalDateTime(value){
  if(!value)return '';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return '';
  const offset=d.getTimezoneOffset()*60000;
  return new Date(d.getTime()-offset).toISOString().slice(0,16);
}

// Расчёт времени респауна с вычитанием 4 часов
function timeLeft(b){
  if(!b.last_killed)return null;
  return new Date(b.last_killed).getTime()
    +Number(b.respawn_hours)*3600000
    -4*3600000
    -Date.now();
}

function fmt(ms){
  if(ms===null)return '—';
  if(ms<=0)return 'Ready';
  let s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;
  return `${h}h ${m}m ${sec}s`;
}

function esc(s){
  return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function load(){
  bosses=await api('/api/bosses');
  render();
}

function filtered(){
  const min=Number($('#minLevel').value)||1;
  const max=Number($('#maxLevel').value)||99;
  return bosses.filter(b=>b.level>=min&&b.level<=max);
}

function render(){
  $('#upcomingHours').classList.toggle('hidden',tab!=='upcoming');
  allPanel.classList.toggle('hidden',tab!=='all');
  cards.classList.toggle('hidden',tab==='all');

  let list=filtered();

  // Active Respawn: боссы, которым осталось от 0 до 4 часов
  if(tab==='active'){
    list=list.filter(b=>{
      const t=timeLeft(b);
      return t!==null&&t>0&&t<=4*3600000;
    });
  }

  // Upcoming Respawn: боссы, которым осталось больше 4 часов
  if(tab==='upcoming'){
    list=list.filter(b=>{
      const t=timeLeft(b);
      return t!==null&&t>4*3600000&&t<=hours*3600000;
    });
  }

  if(tab!=='all'){
    cards.innerHTML=list.sort((a,b)=>timeLeft(a)-timeLeft(b)).map(b=>{
      let t=timeLeft(b);
      let cls=tab==='upcoming'?'red':t<3600000?'green':'yellow';

      return `<article class="boss-card ${cls}">
        <div class="boss-name">${esc(b.name)}<span class="dot"></span></div>
        <div class="meta">Level: ${b.level}</div>
        <div class="meta">Location: ${esc(b.location)}</div>
        <div class="meta">Last kill: ${b.last_killed?new Date(b.last_killed).toLocaleString():'Not killed yet'}</div>
        <div class="timer" data-timer="${b.id}">${fmt(t)}</div>
        <button onclick="markKilled(${b.id})">Mark killed</button>
      </article>`;
    }).join('')||'<p>No bosses found.</p>';
  }

  renderTable();
}

function renderTable(){
  const q=$('#search').value.toLowerCase(),sort=$('#sort').value,dir=$('#direction').value;
  let list=filtered().filter(b=>(b.name+' '+b.location).toLowerCase().includes(q));

  list.sort((a,b)=>{
    let x=sort==='level'?a.level:sort==='respawn'?(timeLeft(a)??Infinity):a.name.toLowerCase();
    let y=sort==='level'?b.level:sort==='respawn'?(timeLeft(b)??Infinity):b.name.toLowerCase();
    return (x>y?1:x<y?-1:0)*(dir==='asc'?1:-1);
  });

  $('#bossRows').innerHTML=list.map(b=>`<tr>
    <td>${esc(b.name)}</td>
    <td>${b.level}</td>
    <td>${esc(b.location)}</td>
    <td>${b.respawn_hours}h</td>
    <td>${b.last_killed?new Date(b.last_killed).toLocaleString():'—'}</td>
    <td>${esc(b.killed_by||'—')}</td>
    <td><span class="status-dot"></span></td>
    <td>${timeLeft(b)===null?'—':fmt(timeLeft(b))}</td>
    <td><div class="actions">
      <button class="edit" onclick="editBoss(${b.id})">Edit</button>
      <button class="kill" onclick="markKilled(${b.id})">Mark killed</button>
      <button class="delete" onclick="deleteBoss(${b.id})">Delete</button>
    </div></td>
  </tr>`).join('');
}

window.markKilled=async id=>{
  try{
    await api(`/api/bosses/${id}/kill`,{method:'POST'});
    await load();
  }catch(e){alert(e.message)}
};

window.deleteBoss=async id=>{
  if(!confirm('Удалить этого РБ?'))return;
  try{
    await api(`/api/bosses/${id}`,{method:'DELETE'});
    await load();
  }catch(e){alert(e.message)}
};

window.editBoss=id=>{
  const b=bosses.find(x=>x.id===id);
  editing=id;
  $('#modalTitle').textContent='Edit Boss';

  const f=$('#bossForm');
  f.elements.name.value=b.name;
  f.elements.level.value=b.level;
  f.elements.location.value=b.location;
  f.elements.respawn_hours.value=b.respawn_hours;
  f.elements.last_killed.value=toLocalDateTime(b.last_killed);

  $('#formError').textContent='';
  $('#modal').classList.remove('hidden');
};

$('#addBoss').onclick=()=>{
  editing=null;
  $('#modalTitle').textContent='Add New Boss';
  $('#bossForm').reset();
  $('#formError').textContent='';
  $('#modal').classList.remove('hidden');
};

$('#closeModal').onclick=()=>$('#modal').classList.add('hidden');

$('#bossForm').onsubmit=async e=>{
  e.preventDefault();

  const body=Object.fromEntries(new FormData(e.target));

  if(body.last_killed){
    const date=new Date(body.last_killed);
    if(Number.isNaN(date.getTime())){
      $('#formError').textContent='Неправильная дата';
      return;
    }
    body.last_killed=date.toISOString();
  }else{
    body.last_killed=null;
  }

  try{
    await api(editing?`/api/bosses/${editing}`:'/api/bosses',{
      method:editing?'PUT':'POST',
      body:JSON.stringify(body)
    });

    $('#modal').classList.add('hidden');
    await load();
  }catch(err){
    $('#formError').textContent=err.message;
  }
};

document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
  tab=b.dataset.tab;
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('selected',x===b));
  render();
});

document.querySelectorAll('.hour').forEach(b=>b.onclick=()=>{
  hours=Number(b.dataset.hours);
  document.querySelectorAll('.hour').forEach(x=>x.classList.toggle('selected',x===b));
  render();
});

['minLevel','maxLevel','search','sort','direction'].forEach(id=>$('#'+id).addEventListener('input',render));

$('#loginForm').onsubmit=async e=>{
  e.preventDefault();
  const f=new FormData(e.target);
  try{
    await api('/api/login',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});
    $('#loginError').textContent='';
    await enter();
  }catch(err){$('#loginError').textContent=err.message}
};

logout.onclick=async()=>{
  await api('/api/logout',{method:'POST'});
  location.reload();
};

async function enter(){
  login.classList.add('hidden');
  app.classList.remove('hidden');
  logout.classList.remove('hidden');
  await load();
}

(async()=>{
  try{
    const me=await api('/api/me');
    if(me.loggedIn)await enter();
  }catch{}

  setInterval(()=>{
    if(tab==='all'){
      renderTable();
    }else{
      render();
    }
  },1000);

  setInterval(()=>{
    if(!app.classList.contains('hidden'))load().catch(()=>{});
  },5000);
})();
