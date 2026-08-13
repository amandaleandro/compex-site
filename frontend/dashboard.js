const roleLabel = { PRESIDENCIA: 'Presidência', FINANCEIRO: 'Financeiro', ESPORTES: 'Esportes', EVENTOS: 'Eventos', MARKETING: 'Marketing', PRODUTOS: 'Produtos', PATRIMONIO: 'Patrimônio', ASSOCIADO: 'Associado' };
const money = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const initials = name => (name || '').split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();
const todayLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date());
let allMonths = [];
const dateLabel = document.querySelector('.dash-header .eyebrow');
if (dateLabel) dateLabel.textContent = todayLabel.toUpperCase();

function authHeaders() {
  const token = sessionStorage.getItem('compex-token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` };
}
async function api(path) {
  const response = await fetch(path, { headers: authHeaders() });
  if (!response.ok) throw new Error(`Erro ${response.status} em ${path}`);
  return response.json();
}

async function renderBoard(type, listId) {
  const list = document.querySelector(listId);
  try {
    const posts = await api(`/api/board?type=${type}`);
    list.innerHTML = posts.map(p => `<div class="task"><span class="check checked">${type === 'ELOGIO' ? '★' : '✉'}</span><div><strong>${p.message}</strong><small>${p.authorName} · ${new Date(p.createdAt).toLocaleDateString('pt-BR')}</small></div></div>`).join('') || '<p class="muted">Nada por aqui ainda.</p>';
  } catch { list.innerHTML = '<p class="muted">Não foi possível carregar.</p>'; }
}
const boardModal = document.querySelector('#board-modal');
const boardForm = document.querySelector('#board-form');
function wireBoardForm(buttonId, type, listId) {
  document.querySelector(buttonId).onclick = () => {
    boardForm.reset();
    document.querySelector('#board-error').textContent = '';
    document.querySelector('#board-modal-title').textContent = type === 'ELOGIO' ? 'Novo elogio' : 'Novo recado';
    boardForm.dataset.type = type;
    boardForm.dataset.listId = listId;
    boardModal.showModal();
  };
}
document.querySelector('#board-cancel').onclick = () => boardModal.close();
boardForm.onsubmit = async event => {
  event.preventDefault();
  const message = document.querySelector('#board-message').value.trim();
  const error = document.querySelector('#board-error');
  if (!message) { error.textContent = 'Escreva uma mensagem.'; return; }
  const response = await fetch('/api/board', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ type: boardForm.dataset.type, message }) });
  if (!response.ok) { error.textContent = 'Não foi possível publicar.'; return; }
  boardModal.close();
  renderBoard(boardForm.dataset.type, boardForm.dataset.listId);
};

(async function () {
  try {
    const { user } = await api('/api/auth/me');
    document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = user.name);
    document.querySelectorAll('[data-user-role]').forEach(el => el.textContent = roleLabel[user.role] || user.role);
    const avatar = document.querySelector('#profile-avatar');
    if (avatar) avatar.textContent = initials(user.name);

    if (user.role === 'PRESIDENCIA') {
      const panel = document.querySelector('#presidencia');
      panel.hidden = false;
      const directors = await api('/api/directors');
      panel.querySelector('#directors-list').innerHTML = directors.map(d =>
        `<div class="role-row"><div><b>${d.name}</b> · ${d.email}</div><span class="count">${roleLabel[d.role] || d.role}</span></div>`
      ).join('') || '<p class="muted">Nenhuma outra conta de diretoria cadastrada.</p>';
    }

    const canSeeFinance = user.role === 'PRESIDENCIA' || user.role === 'FINANCEIRO';
    if (canSeeFinance) {
      document.querySelector('#financeiro').hidden = false;
      document.querySelector('#metric-balance').hidden = false;
    } else {
      document.querySelector('#financeiro').closest('.grid').style.gridTemplateColumns = '1fr';
      document.querySelector('#metric-balance').closest('.grid').style.gridTemplateColumns = 'repeat(3, 1fr)';
    }
  } catch {
    window.location.href = 'gestao-login.html';
    return;
  }

  try {
    const stats = await api('/api/stats');
    document.querySelector('#stat-members').textContent = stats.members;
    document.querySelector('#stat-balance').textContent = money(stats.balance);
    document.querySelector('#stat-events').textContent = String(stats.events).padStart(2, '0');
    document.querySelector('#stat-athletes').textContent = stats.athletes;
    allMonths = stats.months || [];
    const monthsSelect = document.querySelector('#filter-months');
    const n = Number(monthsSelect?.value || 6);
    renderFinanceChart(allMonths.slice(-n));
    if (monthsSelect) monthsSelect.onchange = () => renderFinanceChart(allMonths.slice(-Number(monthsSelect.value || 6)));
  } catch {}

  wireBoardForm('#new-recado', 'RECADO', '#recados-list');
  wireBoardForm('#new-elogio', 'ELOGIO', '#elogios-list');
  renderBoard('RECADO', '#recados-list');
  renderBoard('ELOGIO', '#elogios-list');

  renderUpcomingEvents();
  renderDashboardExtra();
  renderDashboardPolls();
})();

/* ---------- Próximos eventos (dinâmico) ---------- */
async function renderUpcomingEvents() {
  const list = document.querySelector('#eventos-list');
  try {
    const events = await api('/api/events');
    const upcoming = events.filter(e => e.published !== false && new Date(e.date) >= new Date(new Date().toDateString())).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 3);
    list.innerHTML = upcoming.map(e => {
      const date = new Date(e.date);
      const day = String(date.getUTCDate()).padStart(2, '0');
      const month = date.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '').toUpperCase();
      return `<div class="agenda-item"><div class="date-box"><b>${day}</b><span>${month}</span></div><div><strong>${e.name}</strong><p>${e.type || 'Evento'}${e.location ? ' · ' + e.location : ''}</p></div><span class="badge badge-active">Publicado</span></div>`;
    }).join('') || '<p class="empty-state">Nenhum evento publicado no momento.</p>';
  } catch { list.innerHTML = '<p class="empty-state">Não foi possível carregar.</p>'; }
}

/* ---------- Aniversariantes, destaque do mês, jogos, treinos, demandas do dia ---------- */
async function renderDashboardExtra() {
  const birthdaysEl = document.querySelector('#birthdays-list');
  const spotlightEl = document.querySelector('#spotlight');
  const gamesEl = document.querySelector('#games-list');
  const trainingsEl = document.querySelector('#trainings-list');
  const todayTasksEl = document.querySelector('#today-tasks-list');
  try {
    const data = await api('/api/dashboard-extra');

    birthdaysEl.innerHTML = data.birthdays.map(b => `<div class="birthday-row"><span class="day-chip">${String(b.day).padStart(2, '0')}</span><div><b>${b.name}</b><small>${b.role}</small></div></div>`).join('') || '<p class="empty-state">Nenhum aniversariante este mês.</p>';

    if (data.spotlight) {
      spotlightEl.innerHTML = `<div class="spotlight-card"><div class="avatar">${initials(data.spotlight.name)}</div><div><h3>${data.spotlight.name} ✦</h3><p>${data.spotlight.role ? data.spotlight.role + ' · ' : ''}${data.spotlight.count} tarefa${data.spotlight.count === 1 ? '' : 's'} concluída${data.spotlight.count === 1 ? '' : 's'} este mês</p></div></div>`;
    } else {
      spotlightEl.innerHTML = '<p class="empty-state">Ainda sem destaque este mês — conclua tarefas em Tarefas para aparecer aqui.</p>';
    }

    const sessionRow = s => `<div class="agenda-item"><div class="date-box"><b>${String(new Date(s.date).getUTCDate()).padStart(2, '0')}</b><span>${new Date(s.date).toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '').toUpperCase()}</span></div><div><strong>${s.teamName}</strong><p>${s.location || 'Local a definir'}${s.coachName ? ' · ' + s.coachName : ''}</p></div></div>`;
    gamesEl.innerHTML = data.upcomingGames.map(sessionRow).join('') || '<p class="empty-state">Nenhum jogo agendado.</p>';
    trainingsEl.innerHTML = data.upcomingTrainings.map(sessionRow).join('') || '<p class="empty-state">Nenhum treino agendado.</p>';

    todayTasksEl.innerHTML = data.todayTasks.map(t => `<div class="task-row"><span class="task-check complete-task" data-id="${t.id}" title="Marcar como concluída"></span><div><strong>${t.title}</strong><small>${t.team}${t.owner ? ' · ' + t.owner : ''}</small></div></div>`).join('') || '<p class="empty-state">Nenhuma demanda com prazo para hoje.</p>';
    todayTasksEl.querySelectorAll('.complete-task').forEach(check => check.onclick = async () => {
      check.classList.add('checked');
      check.textContent = '✓';
      await fetch('/api/tasks', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ id: check.dataset.id, status: 'done' }) });
      setTimeout(renderDashboardExtra, 500);
    });
  } catch {
    birthdaysEl.innerHTML = spotlightEl.innerHTML = gamesEl.innerHTML = trainingsEl.innerHTML = todayTasksEl.innerHTML = '<p class="empty-state">Não foi possível carregar.</p>';
  }
}

/* ---------- Enquetes para votar ---------- */
async function renderDashboardPolls() {
  const list = document.querySelector('#polls-list');
  if (!list) return;
  try {
    const allPolls = await api('/api/polls');
    const polls = allPolls.filter(p => !p.effectiveClosed && !p.closed && !p.isExpired);
    
    list.innerHTML = polls.map(poll => {
      const total = poll.totalVotes || 0;
      let expInfo = '';
      if (poll.expiresAt) {
        const expDate = new Date(poll.expiresAt);
        expInfo = `<small style="display:block;margin-top:2px;color:var(--text-muted, #7f8c8d);font-size:11px">⏱️ Vence dia ${expDate.toLocaleDateString('pt-BR')} às ${expDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>`;
      }
      const bars = poll.results.map((r, index) => {
        const pct = total ? Math.round((r.votes / total) * 100) : 0;
        const voted = poll.myVote === index;
        return `<div class="poll-bar-row"><div class="poll-bar-head"><span>${r.option}${voted ? ' <b style="color:var(--success, #27ae60)">(Seu voto ✓)</b>' : ''}</span><span>${r.votes} voto(s) · ${pct}%</span></div><div class="poll-bar-track"><div class="poll-bar-fill" style="width:${pct}%;background:${voted ? 'var(--success, #27ae60)' : 'var(--blue, #3498db)'}"></div></div><button type="button" class="poll-vote-btn ${voted ? 'voted' : ''}" data-poll="${poll.id}" data-option="${index}">${voted ? '✓ Opção Votada' : 'Votar'}</button></div>`;
      }).join('');
      return `<div class="poll-card" style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #f0f0f0"><b style="font-size:14px;color:var(--heading, #2c3e50)">${poll.question}</b>${expInfo}${bars}</div>`;
    }).join('') || '<p class="empty-state">Nenhuma enquete aberta no momento.</p>';

    document.querySelectorAll('.poll-vote-btn').forEach(btn => btn.onclick = async () => {
      const res = await fetch(`/api/polls/${btn.dataset.poll}/vote`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ optionIndex: Number(btn.dataset.option) }) });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Erro ao registrar voto');
      }
      renderDashboardPolls();
    });
  } catch { list.innerHTML = '<p class="empty-state">Não foi possível carregar.</p>'; }
}

/* ---------- Receitas x despesas (mesmo cálculo do Financeiro) ---------- */
function renderFinanceChart(months) {
  const monthLabel = key => new Date(`${key}-02`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
  const yAxis = document.querySelector('#chart-y-axis');
  const xAxis = document.querySelector('#chart-x-axis');
  if (!yAxis || !xAxis) return;
  if (!months.length) {
    yAxis.innerHTML = '<span>0</span>';
    xAxis.innerHTML = '';
    document.querySelector('#chart-area-income')?.setAttribute('d', '');
    document.querySelector('#chart-line-income')?.setAttribute('d', '');
    document.querySelector('#chart-line-expense')?.setAttribute('d', '');
    return;
  }
  const max = Math.max(10, ...months.flatMap(m => [m.income, m.expense]));
  const step = Math.ceil(max / 4 / 5) * 5 || 5;
  const top = step * 4;
  yAxis.innerHTML = [4, 3, 2, 1, 0].map(i => `<span>${i === 0 ? '0' : money(i * step).replace('R$', '').trim()}</span>`).join('');
  xAxis.innerHTML = months.map(m => `<span>${monthLabel(m.month)}</span>`).join('');
  const n = months.length || 1;
  const point = (value, index) => {
    const x = n === 1 ? 0 : (index / (n - 1)) * 600;
    const y = 220 - Math.min(1, value / top) * 220;
    return [x, y];
  };
  const pathFor = key => months.map((m, i) => point(m[key], i)).map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  document.querySelector('#chart-line-income').setAttribute('d', pathFor('income'));
  document.querySelector('#chart-line-expense').setAttribute('d', pathFor('expense'));
  document.querySelector('#chart-area-income').setAttribute('d', `${pathFor('income')} L600 220 L0 220 Z`);
}
