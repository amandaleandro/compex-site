const SPORT_ICONS = { Futsal: '⚽', 'Vôlei': '◉', Volei: '◉', Basquete: '●', Peteca: '⚔', 'E-sports': '⌁', Queimada: '◎' };
const iconFor = (sport) => SPORT_ICONS[sport] || '★';

async function loadModalities() {
  const grid = document.querySelector('#sports-grid');
  if (!grid) return;
  try {
    const res = await fetch('/api/teams');
    const teams = res.ok ? await res.json() : [];
    grid.innerHTML = teams.length ? teams.map((team, i) => `<article class="${i === 0 ? 'featured' : ''}"><div class="sport-icon">${iconFor(team.sport)}</div><h2>${team.name}</h2><p>${team.description || ''}</p><b>${team.active ? '• Time ativo' : '• Em breve'}</b><strong>→</strong></article>`).join('') : '<p class="empty-note">Nenhuma modalidade cadastrada ainda.</p>';
  } catch (e) {
    grid.innerHTML = '<p class="empty-note">Não foi possível carregar as modalidades.</p>';
  }
}

const toDate = (date) => date ? new Date(date) : null;
const dayLabel = (date) => { const d = toDate(date); return d && !isNaN(d) ? d.getDate() : '--'; };
const monthLabel = (date) => { const d = toDate(date); return d && !isNaN(d) ? d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase() : '---'; };
const timeLabel = (date) => { const d = toDate(date); return d && !isNaN(d) ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''; };

function renderSessions(container, sessions, type, emptyMessage) {
  if (!container) return;
  container.innerHTML = sessions.length ? sessions.map(s => `<a class="game" href="${type === 'JOGO' ? '/public/events-public.html' : '/public/login.html'}"><strong>${dayLabel(s.date)}<small>${monthLabel(s.date)}</small></strong><span class="game-icon">${iconFor(s.sport)}</span><div><b>${s.team}</b><span>⌖ ${s.location || 'Local a definir'} &nbsp;·&nbsp; ${timeLabel(s.date)}</span></div><em>${type}</em><i>→</i></a>`).join('') : `<p class="empty-note">${emptyMessage}</p>`;
}

async function loadAgenda() {
  const gamesEl = document.querySelector('#agenda-games');
  const trainingsEl = document.querySelector('#agenda-trainings');
  if (!gamesEl && !trainingsEl) return;
  try {
    const res = await fetch('/api/public-agenda');
    const { games, trainings } = res.ok ? await res.json() : { games: [], trainings: [] };
    renderSessions(gamesEl, games || [], 'JOGO', 'Nenhum jogo agendado no momento.');
    renderSessions(trainingsEl, trainings || [], 'TREINO', 'Nenhum treino agendado no momento.');
  } catch (e) {
    if (gamesEl) gamesEl.innerHTML = '<p class="empty-note">Não foi possível carregar a agenda.</p>';
    if (trainingsEl) trainingsEl.innerHTML = '<p class="empty-note">Não foi possível carregar a agenda.</p>';
  }
}

loadModalities();
loadAgenda();
