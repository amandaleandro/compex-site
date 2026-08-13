let tasksCache = [];
let currentUser = null;
let directorsCache = [];

function authHeaders() {
  const token = sessionStorage.getItem('compex-token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` };
}

async function loadCurrentUser() {
  try {
    const res = await fetch('/api/auth/me', { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
    }
  } catch (e) {
    console.error('Erro ao carregar usuário logado:', e);
  }
}

async function loadDirectors() {
  try {
    const res = await fetch('/api/directors', { headers: authHeaders() });
    if (res.ok) {
      directorsCache = await res.json();
    } else {
      directorsCache = [];
    }
  } catch (e) {
    directorsCache = [];
  }
  populateOwnerDropdown();
}

function populateOwnerDropdown() {
  const ownerSelect = document.querySelector('#owner');
  if (!ownerSelect) return;
  const currentVal = ownerSelect.value;
  ownerSelect.innerHTML = '<option value="">Selecione o responsável...</option>';

  const names = new Set();
  if (currentUser && currentUser.name) names.add(currentUser.name);
  directorsCache.forEach(d => { if (d.name) names.add(d.name); });

  names.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    ownerSelect.appendChild(opt);
  });

  if (currentVal) {
    ownerSelect.value = currentVal;
  }
}

async function loadTasks() {
  const response = await fetch('/api/tasks', { headers: authHeaders() });
  if (!response.ok) return [];
  return response.json();
}

const TEAM_ROLES_MAP = {
  'Presidência': 'PRESIDENCIA',
  'Esportes': 'ESPORTES',
  'Financeiro': 'FINANCEIRO',
  'Eventos': 'EVENTOS',
  'Marketing': 'MARKETING',
  'Produtos': 'PRODUTOS',
  'Patrimônio': 'PATRIMONIO'
};

function getDepartmentDirector(teamName) {
  const targetRole = TEAM_ROLES_MAP[teamName];
  if (!targetRole) return null;
  // Procura usuário com rank DIRETOR do departamento
  let director = directorsCache.find(d => d.role === targetRole && (d.rank === 'DIRETOR' || !d.rank));
  if (!director) director = directorsCache.find(d => d.role === targetRole);
  if (!director && currentUser && currentUser.role === targetRole) director = currentUser;
  return director ? director.name : null;
}

const PRIORITY_MAP = {
  baixa: { label: '🟢 Baixa', bg: '#e5f6ec', color: '#0d8a4f' },
  media: { label: '🟡 Média', bg: '#fdf1de', color: '#b5730e' },
  alta: { label: '🔴 Alta / Urgente', bg: '#fbe9e6', color: '#c0392b' }
};

let filterMyTasksOnly = false;

function isOverdue(task) {
  if (!task.dueDate || task.status === 'done') return false;
  const todayStr = new Date().toISOString().slice(0, 10);
  const dueStr = task.dueDate.slice(0, 10);
  return dueStr < todayStr;
}

function updateKPIs(tasks) {
  const openCount = tasks.filter(t => t.status === 'todo').length;
  const doingCount = tasks.filter(t => t.status === 'doing').length;
  const overdueCount = tasks.filter(t => isOverdue(t)).length;
  const doneCount = tasks.filter(t => t.status === 'done').length;

  document.querySelector('#kpi-open').textContent = openCount;
  document.querySelector('#kpi-doing').textContent = doingCount;
  document.querySelector('#kpi-overdue').textContent = overdueCount;
  document.querySelector('#kpi-done').textContent = doneCount;
}

function card(t) {
  const due = t.dueDate ? new Date(t.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }) : 'Sem prazo';
  const ownerLabel = t.owner && t.owner !== '--' ? t.owner : 'Sem executante';
  const assignerLabel = t.assigner ? `<div class="task-assigner" style="font-size:11px;color:#475467;margin-top:4px">Solicitante: <strong>${t.assigner}</strong></div>` : '';

  const prio = PRIORITY_MAP[t.priority] || PRIORITY_MAP.media;
  const prioBadge = `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;background:${prio.bg};color:${prio.color};display:inline-block">${prio.label}</span>`;

  const overdue = isOverdue(t);
  const overdueBadge = overdue
    ? `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;background:#fbe9e6;color:#c0392b;display:inline-block;margin-left:4px">⚠️ Atrasado</span>`
    : '';

  const completedLabel = t.completedAt
    ? `<div style="font-size:11px;color:#0d8a4f;margin-top:4px">✅ Concluído em: <strong>${new Date(t.completedAt).toLocaleDateString('pt-BR')} ${new Date(t.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong></div>`
    : '';

  const directorName = getDepartmentDirector(t.team);
  const directorLabel = directorName
    ? `<div class="task-director" style="font-size:11px;color:#0f52c0;background:#eaf1fd;padding:3px 8px;border-radius:6px;margin-top:6px;display:inline-block">📢 Diretor responsável p/ cobrança: <strong>${directorName}</strong></div>`
    : '';

  const borderStyle = overdue ? 'border-left: 4px solid #c0392b;' : '';

  const chargePerson = ownerLabel !== 'Sem executante' ? ownerLabel : (directorName || 'Responsável');
  const waMessage = encodeURIComponent(`Olá ${chargePerson}, tudo bem?\nEstou passando para acompanhar a tarefa "${t.title}" (Equipe: ${t.team}).\nPrazo: ${due}.\nPodemos verificar o andamento?`);
  const waBtn = `<a href="https://wa.me/?text=${waMessage}" target="_blank" style="border:1px solid #25D366;background:#eefcf4;border-radius:6px;font-size:11px;padding:3px 8px;cursor:pointer;color:#075e54;text-decoration:none;display:inline-flex;align-items:center;gap:4px">💬 Cobrar</a>`;

  return `<article class="task" data-id="${t.id}" style="${borderStyle}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <b>${t.title}</b>
      <div>${prioBadge}${overdueBadge}</div>
    </div>
    <small style="${overdue ? 'color:#c0392b;font-weight:700' : ''}">Prazo: ${due}</small>
    ${completedLabel}
    <div class="task-bottom" style="margin-top:6px">
      <span class="task-team">${t.team}</span>
      <span class="task-owner">👤 Executante: <strong>${ownerLabel}</strong></span>
    </div>
    ${assignerLabel}
    ${directorLabel}
    <div style="display:flex;gap:6px;margin-top:10px;align-items:center;flex-wrap:wrap">
      ${nextButton(t)}
      ${waBtn}
      <button class="edit-task" data-id="${t.id}" style="border:1px solid #dfe0d8;background:#fff;border-radius:6px;font-size:11px;padding:3px 8px;cursor:pointer;color:#1769e8">✏️ Editar</button>
      <button class="remove-task" data-id="${t.id}" style="border:0;background:transparent;color:#c35d4b;font-size:11px;cursor:pointer;margin-left:auto">Excluir</button>
    </div>
  </article>`;
}

function nextButton(t) {
  if (t.status === 'todo') return `<button class="advance-task" data-id="${t.id}" data-next="doing" style="border:1px solid #dfe0d8;background:transparent;border-radius:6px;font-size:11px;padding:3px 8px;cursor:pointer">Iniciar →</button>`;
  if (t.status === 'doing') return `<button class="advance-task" data-id="${t.id}" data-next="done" style="border:1px solid #dfe0d8;background:transparent;border-radius:6px;font-size:11px;padding:3px 8px;cursor:pointer">Concluir →</button>`;
  return '';
}

function openModal(task = null) {
  const form = document.querySelector('#form');
  form.reset();
  populateOwnerDropdown();

  if (task) {
    document.querySelector('#modal-title').textContent = 'Editar tarefa';
    document.querySelector('#save-task-btn').textContent = 'Salvar alterações';
    document.querySelector('#task-id').value = task.id;
    document.querySelector('#title-task').value = task.title || '';
    document.querySelector('#team').value = task.team || 'Geral';
    document.querySelector('#owner').value = task.owner && task.owner !== '--' ? task.owner : '';
    document.querySelector('#assigner').value = task.assigner || (currentUser ? currentUser.name : '');
    document.querySelector('#priority').value = task.priority || 'media';
    document.querySelector('#due').value = task.dueDate ? task.dueDate.slice(0, 10) : '';
  } else {
    document.querySelector('#modal-title').textContent = 'Nova tarefa';
    document.querySelector('#save-task-btn').textContent = 'Criar';
    document.querySelector('#task-id').value = '';
    document.querySelector('#priority').value = 'media';
    document.querySelector('#assigner').value = currentUser ? currentUser.name : '';
  }
  document.querySelector('#modal').classList.add('open');
}

function closeModal() {
  document.querySelector('#modal').classList.remove('open');
  document.querySelector('#form').reset();
}

function applyFilters(tasks) {
  const search = (document.querySelector('#search-task')?.value || '').toLowerCase().trim();
  const team = document.querySelector('#filter-team')?.value || '';
  const priority = document.querySelector('#filter-priority')?.value || '';

  return tasks.filter(t => {
    if (search && !t.title.toLowerCase().includes(search)) return false;
    if (team && t.team !== team) return false;
    if (priority && t.priority !== priority) return false;
    if (filterMyTasksOnly && currentUser) {
      const isOwner = t.owner && t.owner.toLowerCase() === currentUser.name.toLowerCase();
      const isAssigner = t.assigner && t.assigner.toLowerCase() === currentUser.name.toLowerCase();
      if (!isOwner && !isAssigner) return false;
    }
    return true;
  });
}

async function render() {
  tasksCache = await loadTasks();
  updateKPIs(tasksCache);

  const filteredTasks = applyFilters(tasksCache);
  const groups = { todo: [], doing: [], done: [] };
  filteredTasks.forEach(t => groups[t.status]?.push(card(t)));
  Object.keys(groups).forEach(status => document.querySelector('#' + status).innerHTML = groups[status].join('') || '<small>Nenhuma tarefa aqui.</small>');

  document.querySelectorAll('.advance-task').forEach(btn => btn.onclick = async () => {
    await fetch('/api/tasks', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ id: btn.dataset.id, status: btn.dataset.next }) });
    render();
  });

  document.querySelectorAll('.edit-task').forEach(btn => btn.onclick = () => {
    const task = tasksCache.find(t => t.id === btn.dataset.id);
    if (task) openModal(task);
  });

  document.querySelectorAll('.remove-task').forEach(btn => btn.onclick = async () => {
    if (!confirm('Deseja realmente excluir esta tarefa?')) return;
    await fetch('/api/tasks', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ id: btn.dataset.id }) });
    render();
  });
}

// Filtros em tempo real
['#search-task', '#filter-team', '#filter-priority'].forEach(selector => {
  const el = document.querySelector(selector);
  if (el) {
    el.oninput = () => render();
    el.onchange = () => render();
  }
});

const myTasksBtn = document.querySelector('#btn-my-tasks');
if (myTasksBtn) {
  myTasksBtn.onclick = () => {
    filterMyTasksOnly = !filterMyTasksOnly;
    if (filterMyTasksOnly) {
      myTasksBtn.classList.remove('btn-ghost');
      myTasksBtn.classList.add('btn-primary');
    } else {
      myTasksBtn.classList.remove('btn-primary');
      myTasksBtn.classList.add('btn-ghost');
    }
    render();
  };
}

document.querySelector('#new-task').onclick = () => openModal();
document.querySelector('#close').onclick = closeModal;
document.querySelector('#form').onsubmit = async e => {
  e.preventDefault();
  const id = document.querySelector('#task-id').value;
  const payload = {
    id: id || undefined,
    title: document.querySelector('#title-task').value,
    team: document.querySelector('#team').value,
    owner: document.querySelector('#owner').value,
    assigner: document.querySelector('#assigner').value,
    priority: document.querySelector('#priority').value,
    dueDate: document.querySelector('#due').value || null
  };

  const method = id ? 'PUT' : 'POST';
  await fetch('/api/tasks', { method, headers: authHeaders(), body: JSON.stringify(payload) });
  closeModal();
  render();
};

document.addEventListener('admin-shell:user', (e) => {
  currentUser = e.detail;
});

async function init() {
  await loadCurrentUser();
  await loadDirectors();
  await render();
}

init();
