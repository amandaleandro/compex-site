const key='compex-events';
const list=document.querySelector('#event-list');
const count=document.querySelector('#event-count');

function getPlatformLabel(platform) {
  switch (platform) {
    case 'SYMPLA': return 'Ir para o Sympla ↗';
    case 'ZEUS': return 'Ir para Zeus Ticket ↗';
    case 'CHEERS': return 'Ir para Cheers ↗';
    case 'OUTRA': return 'Comprar Ingressos ↗';
    case 'PRESENCIAL': return 'Venda Presencial / Na Porta';
    case 'BORAFEST':
    default: return 'Ir para o BoraFest ↗';
  }
}

const toDate=(date)=>date?new Date(date.includes('T')?date:`${date}T12:00:00`):null;
const month=(date)=>{const d=toDate(date);return d&&!isNaN(d)?d.toLocaleDateString('pt-BR',{month:'short'}).replace('.','').toUpperCase():'---';};
const day=(date)=>{const d=toDate(date);return d&&!isNaN(d)?d.getDate():'--';};
const normalize=(str)=>(str||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();

const filterButtons=document.querySelectorAll('.filters button');
const FILTER_KEYWORDS={todos:null,campeonatos:'campeonato',festas:'festa',reunioes:'reuniao'};
let allEvents=[];
let activeFilter='todos';

function render(events){
  count.textContent=`${events.length} cadastrado${events.length===1?'':'s'}`;
  list.innerHTML=events.length?events.map(event=>{
    const platform = event.platform || 'BORAFEST';
    const link = event.ticketUrl || event.link || event.boraFestUrl;
    const btnLabel = getPlatformLabel(platform);
    const linkHtml = link ? `<a class="event-link" href="${link}" target="_blank" rel="noopener">${btnLabel}</a>` : `<span class="event-link" style="opacity:0.75;cursor:default;">${btnLabel}</span>`;
    return `<article class="event-card"><div class="event-date"><b>${day(event.date)}</b><span>${month(event.date)}</span></div><div><p class="event-type">${event.type.toUpperCase()}</p><h3>${event.name}</h3><p>${event.location||'Local a definir'}${event.time?' · '+event.time:''}${event.description?' · '+event.description:''}</p></div>${linkHtml}</article>`;
  }).join(''):'<div class="empty">Nenhum evento encontrado para este filtro.</div>';
}

function applyFilter(){
  const keyword = FILTER_KEYWORDS[activeFilter];
  render(keyword ? allEvents.filter(e=>normalize(e.type).includes(keyword)) : allEvents);
}

filterButtons.forEach(btn=>{
  const key = normalize(btn.textContent).replace(/[^a-z]/g,'');
  btn.addEventListener('click',()=>{
    filterButtons.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = key;
    applyFilter();
  });
});

async function loadAndRenderEvents() {
  try {
    const res = await fetch('/api/events');
    if (res.ok) {
      allEvents = await res.json();
    }
  } catch (e) {
    allEvents = JSON.parse(localStorage.getItem(key)||'[]');
  }
  applyFilter();
}

loadAndRenderEvents();
