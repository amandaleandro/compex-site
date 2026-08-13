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

const month=(date)=>date?new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR',{month:'short'}).replace('.','').toUpperCase():'---';
const day=(date)=>date?new Date(`${date}T12:00:00`).getDate():'--';

async function loadAndRenderEvents() {
  let events = [];
  try {
    const res = await fetch('/api/events');
    if (res.ok) {
      events = await res.json();
    }
  } catch (e) {
    events = JSON.parse(localStorage.getItem(key)||'[]');
  }

  count.textContent=`${events.length} cadastrado${events.length===1?'':'s'}`;
  list.innerHTML=events.length?events.map(event=>{
    const platform = event.platform || 'BORAFEST';
    const link = event.ticketUrl || event.link || event.boraFestUrl;
    const btnLabel = getPlatformLabel(platform);
    const linkHtml = link ? `<a class="event-link" href="${link}" target="_blank" rel="noopener">${btnLabel}</a>` : `<span class="event-link" style="opacity:0.75;cursor:default;">${btnLabel}</span>`;
    return `<article class="event-card"><div class="event-date"><b>${day(event.date)}</b><span>${month(event.date)}</span></div><div><p class="event-type">${event.type.toUpperCase()}</p><h3>${event.name}</h3><p>${event.location||'Local a definir'}${event.time?' · '+event.time:''}${event.description?' · '+event.description:''}</p></div>${linkHtml}</article>`;
  }).join(''):'<div class="empty">Ainda não há eventos publicados. Volte em breve.</div>';
}

loadAndRenderEvents();
