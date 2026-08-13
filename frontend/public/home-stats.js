const toDate=(date)=>date?new Date(date.includes('T')?date:`${date}T12:00:00`):null;
const monthLabel=(date)=>{const d=toDate(date);return d&&!isNaN(d)?d.toLocaleDateString('pt-BR',{month:'short'}).replace('.','').toUpperCase():'---';};
const dayLabel=(date)=>{const d=toDate(date);return d&&!isNaN(d)?d.getDate():'--';};

async function loadStats() {
  try {
    const res = await fetch('/api/public-stats');
    if (!res.ok) return;
    const { eventsCount, membersCount } = await res.json();
    const eventsEl = document.querySelector('#stat-events');
    const membersEl = document.querySelector('#stat-members');
    if (eventsEl) eventsEl.textContent = eventsCount;
    if (membersEl) membersEl.textContent = membersCount;
  } catch (e) { /* mantém o placeholder "—" se a API não responder */ }
}

async function loadHighlightAndUpcoming() {
  const highlightName = document.querySelector('#highlight-name');
  const highlightLocation = document.querySelector('#highlight-location');
  const highlightWhen = document.querySelector('#highlight-when');
  const highlightLink = document.querySelector('#highlight-link');
  const eventsList = document.querySelector('#home-events-list');
  if (!highlightName && !eventsList) return;

  let events = [];
  try {
    const res = await fetch('/api/events');
    if (res.ok) events = await res.json();
  } catch (e) { events = []; }

  const now = Date.now();
  const upcoming = events
    .filter(e => e.published !== false)
    .filter(e => { const d = toDate(e.date); return d && !isNaN(d) && d.getTime() >= now; })
    .sort((a, b) => toDate(a.date) - toDate(b.date));

  const featured = upcoming[0];
  if (highlightName) {
    if (featured) {
      highlightName.textContent = featured.name;
      highlightLocation.textContent = featured.location || 'Local a definir';
      highlightWhen.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>${dayLabel(featured.date)} ${monthLabel(featured.date)}${featured.time ? ' · ' + featured.time.toUpperCase() : ''}`;
      if (highlightLink) highlightLink.href = '/public/events-public.html';
    } else {
      highlightName.textContent = 'Nenhum evento em destaque no momento';
      highlightLocation.textContent = 'Volte em breve para conferir a agenda.';
      highlightWhen.innerHTML = '';
    }
  }

  if (eventsList) {
    eventsList.innerHTML = upcoming.slice(0, 2).map(e => `<div class="event-mini"><strong>${dayLabel(e.date)}<br><small>${monthLabel(e.date)}</small></strong><div><b>${e.name}</b><span>${e.type || 'Evento'}${e.time ? ' · ' + e.time : ''}</span><small>${e.location || 'Local a definir'}</small></div></div>`).join('') || '<p class="empty-events">Nenhum evento cadastrado no momento.</p>';
  }
}

const SPORT_ICONS = { Futsal: '⚽', 'Vôlei': '◉', Volei: '◉', Basquete: '●', Peteca: '⚔', 'E-sports': '⌁', Queimada: '◎' };
const iconFor = (sport) => SPORT_ICONS[sport] || '★';

async function loadModalities() {
  const list = document.querySelector('#home-modalities-list');
  if (!list) return;
  try {
    const res = await fetch('/api/teams');
    const teams = res.ok ? await res.json() : [];
    list.innerHTML = teams.length ? teams.slice(0, 5).map(t => `<span>${iconFor(t.sport)}<small>${t.name}</small></span>`).join('') : '<p class="empty-events">Nenhuma modalidade cadastrada ainda.</p>';
  } catch (e) {
    list.innerHTML = '<p class="empty-events">Não foi possível carregar as modalidades.</p>';
  }
}

async function loadPartners() {
  const list = document.querySelector('#home-partners-list');
  if (!list) return;
  const moreLink = list.querySelector('.partners-more');
  try {
    const res = await fetch('/api/benefits');
    const benefits = res.ok ? await res.json() : [];
    const items = benefits.slice(0, 3).map(b => `<b>${b.icon || ''} ${b.name}</b>`).join('');
    list.innerHTML = items || '<p class="empty-events">Nenhum parceiro cadastrado ainda.</p>';
    if (moreLink) list.appendChild(moreLink);
  } catch (e) {
    list.innerHTML = '<p class="empty-events">Não foi possível carregar os parceiros.</p>';
  }
}

const NEWS_ICONS = { Esportes: '🏐', Eventos: '🏆', Comunicado: '✦', Comunidade: '✦', Geral: '✦', Financeiro: 'R$' };

async function loadNews() {
  const box = document.querySelector('#home-news');
  if (!box) return;
  try {
    const res = await fetch('/api/news');
    const news = res.ok ? await res.json() : [];
    const latest = news[0];
    box.innerHTML = latest
      ? `<div class="news-row"><div class="news-image">${latest.imageUrl ? `<img src="${latest.imageUrl}" alt="${latest.title}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">` : (NEWS_ICONS[latest.category] || '✦')}</div><div><b>${latest.title}</b><p>${latest.text}</p><a href="/public/news.html">Ler notícia →</a></div></div>`
      : '<p class="empty-events">Nenhuma notícia publicada ainda.</p>';
  } catch (e) {
    box.innerHTML = '<p class="empty-events">Não foi possível carregar as notícias.</p>';
  }
}

async function loadResults() {
  const list = document.querySelector('#home-results');
  if (!list) return;
  try {
    const res = await fetch('/api/championships');
    const championships = res.ok ? await res.json() : [];
    const finished = championships.filter(c => c.status === 'FINALIZADO' && c.placement);
    list.innerHTML = finished.length
      ? finished.slice(0, 2).map(c => `<div><small>${c.name}${c.season ? ' ' + c.season : ''}</small><b>${c.placement}</b><span>${c.isTitle ? '🏆' : '🥈'}</span></div>`).join('')
      : '<p class="empty-events">Nenhum resultado cadastrado ainda.</p>';
  } catch (e) {
    list.innerHTML = '<p class="empty-events">Não foi possível carregar os resultados.</p>';
  }
}

loadStats();
loadHighlightAndUpcoming();
loadModalities();
loadPartners();
loadNews();
loadResults();
