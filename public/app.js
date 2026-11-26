
const $=s=>document.querySelector(s);
let bosses=[],tab='active',hours=1,editing=null;

const login=$('#login'),app=$('#app'),logout=$('#logout'),cards=$('#cards'),allPanel=$('#allPanel');

async function api(url,opts={}){
  const r=await fetch(url,{
    ...opts,
    credentials:'same-origin',
    headers:{
      'Content-Type':'application/json',
      ...(opts.headers||{})
    }
  });

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

function timeLeft(b){
  if(!b.last_killed)return null;
  return new Date(b.last_killed).getTime()+
    Number(b.respawn_hours)*3600000-Date.now();
}

function fmt(ms){
  if(ms===null)return 'Not killed yet';
  if(ms<=0)return 'Ready';

  let s=Math.floor(ms/1000);
  let h=Math.floor(s/3600);
  let m=Math.floor(s%3600/60);
  let sec=s%60;

  return `${h}h ${m}m ${sec}s`;
}

function esc(s){
  return String(s??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[c]));
}

async function load(){
  const data=await api('/api/bosses');
  bosses=data;
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

  if(tab==='active'){
    list=list.filter(b=>{
      const t=timeLeft(b);
      return t!==null&&t>0&&t<=4*3600000;
    });
  }

  if(tab==='upcoming'){
    list=list.filter(b=>{
      const t=timeLeft(b);
      const untilActive=t-4*3600000;

      return t!==null&&
        untilActive>0&&
        untilActive<=hours*3600000;
    });
  }

  if(tab!=='all'){
    cards.innerHTML=list
      .sort((a,b)=>{
        const ta=timeLeft(a)-(tab==='upcoming'?4*3600000:0);
        const tb=timeLeft(b)-(tab==='upcoming'?4*3600000:0);
        return ta-tb;
      })
      .map(b=>{
        const t=timeLeft(b);

        const displayTime=tab==='upcoming'
          ?t-4*3600000
          :t;

        const cls=tab==='upcoming'
          ?'red'
          :displayTime<3600000?'green':'yellow';

        return `<article class="boss-card ${cls}">
          <div class="boss-name">${esc(b.name)}<span class="dot"></span></div>
          <div class="meta">Level: ${b.level}</div>
          <div class="meta">Location: ${esc(b.location)}</div>
          <div class="meta">Last kill: ${b.last_killed?new Date(b.last_killed).toLocaleString():'Not killed yet'}</div>
          <div class="timer" data-timer="${b.id}">${fmt(displayTime)}</div>
          <button onclick="markKilled(${b.id})">Mark killed</button>
        </article>`;
      }).join('')||'<p>No bosses found.</p>';
  }

  renderTable();
}

function renderTable(){
  const q=$('#search').value.toLowerCase();
  const sort=$('#sort').value;
  const dir=$('#direction').value;

  let list=filtered().filter(b=>
    (b.name+' '+b.location).toLowerCase().includes(q)
  );

  list.sort((a,b)=>{
    let x=sort==='level'?a.level:
      sort==='respawn'?(timeLeft(a)??Infinity):a.name.toLowerCase();

    let y=sort==='level'?b.level:
      sort==='respawn'?(timeLeft(b)??Infinity):b.name.toLowerCase();

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

/* ОКНО ПОДТВЕРЖДЕНИЯ MARK KILLED */

function confirmKill(){
  return new Promise(resolve=>{
    const overlay=document.createElement('div');

    overlay.style.cssText=`
      position:fixed;
      inset:0;
      z-index:99999;
      background:rgba(0,0,0,.8);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
    `;

    const box=document.createElement('div');

    box.style.cssText=`
      width:100%;
      max-width:360px;
      background:#252528;
      border:2px solid #78A832;
      border-radius:14px;
      padding:28px 22px;
      text-align:center;
      box-shadow:0 0 20px rgba(120,168,50,.18);
      font-family:Arial,sans-serif;
      position:relative;
    `;

    box.innerHTML=`
      <div style="
        color:#78A832;
        font-size:27px;
        font-weight:bold;
        margin-bottom:18px;
      ">Дурак?</div>

      <div style="
        color:white;
        font-size:14px;
        line-height:1.5;
        margin-bottom:25px;
      ">Ты действительно хочешь отметить босса убитым?</div>

      <div style="
        display:flex;
        gap:12px;
      ">
        <button id="killYes" style="
          flex:1;
          background:#78A832;
          color:#111;
          border:0;
          border-radius:6px;
          padding:12px;
          font-size:15px;
          font-weight:bold;
          cursor:pointer;
        ">Да</button>

        <button id="killNo" style="
          flex:1;
          background:#444449;
          color:white;
          border:0;
          border-radius:6px;
          padding:12px;
          font-size:15px;
          font-weight:bold;
          cursor:pointer;
        ">Отмена</button>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    function close(result){
      document.removeEventListener('keydown',onKey);
      overlay.remove();
      resolve(result);
    }

    function onKey(e){
      if(e.key==='Escape'){
        close(false);
      }
    }

    document.addEventListener('keydown',onKey);

    overlay.addEventListener('click',e=>{
      if(e.target===overlay)close(false);
    });

    box.querySelector('#killYes').onclick=()=>close(true);
    box.querySelector('#killNo').onclick=()=>close(false);
  });
}

window.markKilled=async id=>{
  const confirmed=await confirmKill();

  if(!confirmed)return;

  try{
    await api(`/api/bosses/${id}/kill`,{method:'POST'});
    await load();
  }catch(e){
    alert(e.message);
  }
};

window.deleteBoss=async id=>{
  if(!confirm('Удалить этого РБ?'))return;

  try{
    await api(`/api/bosses/${id}`,{method:'DELETE'});
    await load();
  }catch(e){
    alert(e.message);
  }
};

window.editBoss=id=>{
  const b=bosses.find(x=>x.id===id);
  if(!b)return;

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

$('#closeModal').onclick=()=>{
  $('#modal').classList.add('hidden');
};

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

document.querySelectorAll('.tab').forEach(b=>{
  b.onclick=()=>{
    tab=b.dataset.tab;

    document.querySelectorAll('.tab').forEach(x=>
      x.classList.toggle('selected',x===b)
    );

    render();
  };
});

document.querySelectorAll('.hour').forEach(b=>{
  b.onclick=()=>{
    hours=Number(b.dataset.hours);

    document.querySelectorAll('.hour').forEach(x=>
      x.classList.toggle('selected',x===b)
    );

    render();
  };
});

['minLevel','maxLevel','search','sort','direction'].forEach(id=>{
  $('#'+id).addEventListener('input',render);
});

$('#loginForm').onsubmit=async e=>{
  e.preventDefault();

  const f=new FormData(e.target);
  const button=e.submitter;

  if(button)button.disabled=true;

  try{
    await api('/api/login',{
      method:'POST',
      body:JSON.stringify(Object.fromEntries(f))
    });

    await enter();
  }catch(err){
    $('#loginError').textContent=err.message;
  }finally{
    if(button)button.disabled=false;
  }
};

logout.onclick=async()=>{
  try{
    await api('/api/logout',{method:'POST'});
  }catch(e){
    console.error(e);
  }

  location.reload();
};

async function enter(){
  try{
    await load();

    login.classList.add('hidden');
    app.classList.remove('hidden');
    logout.classList.remove('hidden');
    $('#loginError').textContent='';

  }catch(e){
    login.classList.remove('hidden');
    app.classList.add('hidden');
    logout.classList.add('hidden');

    $('#loginError').textContent=e.message;
    throw e;
  }
}

(async()=>{
  try{
    const me=await api('/api/me');

    if(me.loggedIn){
      await enter();
    }
  }catch(e){
    console.error('Проверка авторизации:',e);
  }

  setInterval(()=>{
    document.querySelectorAll('[data-timer]').forEach(el=>{
      const b=bosses.find(x=>x.id===Number(el.dataset.timer));
      if(b)el.textContent=fmt(
        tab==='upcoming'?timeLeft(b)-4*3600000:timeLeft(b)
      );
    });

    if(tab==='all')renderTable();
  },1000);

  setInterval(()=>{
    if(!app.classList.contains('hidden')){
      load().catch(e=>console.error(e));
    }
  },5000);
})();
