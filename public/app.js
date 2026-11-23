
function render(){
  $('#upcomingHours').classList.toggle('hidden',tab!=='upcoming');
  allPanel.classList.toggle('hidden',tab!=='all');
  cards.classList.toggle('hidden',tab==='all');

  let list=filtered();

  if(tab==='active'){
    list=list.filter(b=>{
      const t=timeLeft(b);
      return t!==null && t>0 && t<=4*3600000;
    });
  }

  if(tab==='upcoming'){
    list=list.filter(b=>{
      const t=timeLeft(b);
      const untilActive=t-4*3600000;
      return t!==null &&
        untilActive>0 &&
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
          ? t-4*3600000
          : t;

        const cls=tab==='upcoming'
          ? 'red'
          : displayTime<3600000?'green':'yellow';

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
