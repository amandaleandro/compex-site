const roleLabel = { PRESIDENCIA: 'Presidência', FINANCEIRO: 'Financeiro', ESPORTES: 'Esportes', EVENTOS: 'Eventos', MARKETING: 'Marketing', PRODUTOS: 'Produtos', PATRIMONIO: 'Patrimônio' };
const avatarClass = { PRESIDENCIA: 'gray', FINANCEIRO: 'orange', ESPORTES: 'blue', EVENTOS: 'pink', MARKETING: 'purple', PRODUTOS: 'lime', PATRIMONIO: 'orange' };
const initials = name => (name || '').split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();

// Presidência segue a mesma ideia de diretor/coordenador, com nomes e limites próprios:
// presidente (máx. 1) e vice-presidentes (máx. 2). Demais áreas: diretor (máx. 2) e coordenador (sem limite).
function rankMeta(role) {
  return role === 'PRESIDENCIA'
    ? { directorWord: 'Presidente', coordinatorWord: 'Vice-presidentes', directorMax: 1, coordinatorMax: 2 }
    : { directorWord: 'Diretores', coordinatorWord: 'Coordenadores', directorMax: 2, coordinatorMax: null };
}
function rankOptionLabel(role, rank) {
  const meta = rankMeta(role);
  if (rank === 'DIRETOR') return role === 'PRESIDENCIA' ? 'Presidente' : 'Diretor';
  return role === 'PRESIDENCIA' ? 'Vice-presidente' : 'Coordenador';
}

function authHeaders() {
  const token = sessionStorage.getItem('compex-token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` };
}

let me = null;

async function loadMe() {
  const response = await fetch('/api/auth/me', { headers: authHeaders() });
  if (!response.ok) return null;
  return (await response.json()).user;
}

async function loadDirectors() {
  const response = await fetch('/api/directors', { headers: authHeaders() });
  if (response.status === 403) { document.querySelector('#directors-list').innerHTML = '<p class="muted">Só a Presidência e diretores principais gerenciam acessos.</p>'; return []; }
  return response.json();
}

function directorRow(d, isPresidencia) {
  return `
    <div class="role" data-id="${d.id}">
      <div class="role-name"><span class="avatar ${avatarClass[d.role] || 'gray'}">${initials(d.name)}</span><div><b>${d.name}</b><small>${d.email}${d.birthDate ? ' · 🎂 ' + new Date(d.birthDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }) : ''}${d.member ? ` · 🎫 Sócio (${d.member.status === 'active' ? 'pago' : 'pendente'}) · ${d.member.course}` : ' · ainda não é sócio'}</small></div></div>
      <div class="checks">
        ${isPresidencia ? `<input type="date" class="birthdate-input" data-id="${d.id}" value="${d.birthDate ? d.birthDate.slice(0, 10) : ''}" title="Data de nascimento">` : ''}
        ${isPresidencia ? `<select class="rank-select" data-id="${d.id}" data-role="${d.role}"><option value="DIRETOR" ${d.rank === 'DIRETOR' ? 'selected' : ''}>${rankOptionLabel(d.role, 'DIRETOR')}</option><option value="COORDENADOR" ${d.rank === 'COORDENADOR' ? 'selected' : ''}>${rankOptionLabel(d.role, 'COORDENADOR')}</option></select>` : ''}
        ${isPresidencia ? `<select class="role-select" data-id="${d.id}">${Object.entries(roleLabel).map(([value, label]) => `<option value="${value}" ${value === d.role ? 'selected' : ''}>${label}</option>`).join('')}</select>` : ''}
        ${isPresidencia ? `<button type="button" class="edit-director" data-id="${d.id}" data-name="${d.name.replace(/"/g, '&quot;')}" data-email="${d.email}" style="background:transparent;border:1px solid var(--line);border-radius:6px;color:var(--blue);font-size:11px;cursor:pointer;padding:6px 10px">Editar</button>` : ''}
        ${isPresidencia || d.rank === 'COORDENADOR' ? `<button type="button" class="remove-director" data-id="${d.id}" style="background:transparent;border:0;color:#c35d4b;font-size:11px;cursor:pointer">Remover</button>` : ''}
      </div>
    </div>`;
}

function renderDirectors(directors) {
  const isPresidencia = me.role === 'PRESIDENCIA';
  document.querySelector('#count-label').textContent = `${directors.length} conta${directors.length === 1 ? '' : 's'}${isPresidencia ? ' de diretoria' : ' no seu departamento'}`;

  const groups = {};
  directors.forEach(d => { (groups[d.role] ||= []).push(d); });
  const roleOrder = isPresidencia ? Object.keys(roleLabel) : [me.role];

  const sections = roleOrder.filter(role => groups[role]?.length).map(role => {
    const list = groups[role];
    const meta = rankMeta(role);
    const diretores = list.filter(d => d.rank === 'DIRETOR');
    const coordenadores = list.filter(d => d.rank === 'COORDENADOR');
    // A própria conta logada não aparece na lista (não se autogerencia aqui), mas ainda ocupa uma vaga.
    const selfInRole = me.role === role;
    const directorCount = diretores.length + (selfInRole && me.rank === 'DIRETOR' ? 1 : 0);
    const coordinatorCount = coordenadores.length + (selfInRole && me.rank === 'COORDENADOR' ? 1 : 0);
    return `
      <div class="dept-group">
        ${isPresidencia ? `<p class="dept-heading">${roleLabel[role] || role}</p>` : ''}
        <p class="rank-heading">${meta.directorWord} <span class="count">${directorCount}/${meta.directorMax}</span></p>
        ${diretores.map(d => directorRow(d, isPresidencia)).join('') || `<p class="empty-state">Ninguém neste papel ainda.</p>`}
        <p class="rank-heading">${meta.coordinatorWord}${meta.coordinatorMax ? ` <span class="count">${coordinatorCount}/${meta.coordinatorMax}</span>` : ''}</p>
        ${coordenadores.map(d => directorRow(d, isPresidencia)).join('') || `<p class="empty-state">Ninguém neste papel ainda.</p>`}
      </div>`;
  }).join('');

  document.querySelector('#directors-list').innerHTML = sections || `<p class="muted">${isPresidencia ? 'Nenhuma conta de diretoria além da Presidência ainda.' : 'Nenhum coordenador cadastrado no seu departamento ainda.'}</p>`;

  document.querySelectorAll('.role-select').forEach(select => select.onchange = async () => {
    const response = await fetch('/api/directors', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ id: select.dataset.id, role: select.value }) });
    if (!response.ok) { const result = await response.json().catch(() => ({})); alert(result.error || 'Não foi possível alterar a área.'); }
    refresh();
  });
  document.querySelectorAll('.rank-select').forEach(select => select.onchange = async () => {
    const response = await fetch('/api/directors', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ id: select.dataset.id, rank: select.value }) });
    if (!response.ok) { const result = await response.json(); alert(result.error || 'Não foi possível alterar o nível.'); }
    refresh();
  });
  document.querySelectorAll('.birthdate-input').forEach(input => input.onchange = async () => {
    await fetch('/api/directors', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ id: input.dataset.id, birthDate: input.value || null }) });
    refresh();
  });
  document.querySelectorAll('.remove-director').forEach(button => button.onclick = async () => {
    if (!confirm('Remover esta conta? Isso também remove a carteirinha de sócio vinculada, se houver.')) return;
    const response = await fetch('/api/directors', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ id: button.dataset.id }) });
    if (!response.ok) { const result = await response.json().catch(() => ({})); alert(result.error || 'Não foi possível remover esta conta.'); return; }
    refresh();
  });
  document.querySelectorAll('.edit-director').forEach(button => button.onclick = () => {
    document.querySelector('#e-error').textContent = '';
    document.querySelector('#e-id').value = button.dataset.id;
    document.querySelector('#e-name').value = button.dataset.name;
    document.querySelector('#e-email').value = button.dataset.email;
    editModal.showModal();
  });
}

async function refresh() {
  renderDirectors(await loadDirectors());
}

const editModal = document.querySelector('#edit-modal');
document.querySelector('#e-cancel').onclick = () => editModal.close();
document.querySelector('#edit-form').onsubmit = async event => {
  event.preventDefault();
  const error = document.querySelector('#e-error');
  const payload = { id: document.querySelector('#e-id').value, name: document.querySelector('#e-name').value, email: document.querySelector('#e-email').value };
  const response = await fetch('/api/directors', { method: 'PUT', headers: authHeaders(), body: JSON.stringify(payload) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) { error.textContent = result.error || 'Não foi possível salvar.'; return; }
  editModal.close();
  refresh();
};

const modal = document.querySelector('#modal');
document.querySelector('#new-director').onclick = () => {
  document.querySelector('#director-form').reset();
  document.querySelector('#d-error').textContent = '';
  const isPresidencia = me.role === 'PRESIDENCIA';
  document.querySelector('#director-modal-title').textContent = isPresidencia ? 'Nova conta de diretoria' : 'Novo coordenador';
  document.querySelector('#d-role-field').style.display = isPresidencia ? 'block' : 'none';
  document.querySelector('#d-rank-field').style.display = isPresidencia ? 'block' : 'none';
  document.querySelector('#d-role').dispatchEvent(new Event('change'));
  modal.showModal();
};
document.querySelector('#d-role').onchange = event => {
  const role = event.target.value;
  const rankSelect = document.querySelector('#d-rank');
  rankSelect.options[0].text = rankOptionLabel(role, 'COORDENADOR');
  rankSelect.options[1].text = rankOptionLabel(role, 'DIRETOR');
};
document.querySelector('#d-cancel').onclick = () => modal.close();
document.querySelector('#director-form').onsubmit = async event => {
  event.preventDefault();
  const error = document.querySelector('#d-error');
  const payload = { name: document.querySelector('#d-name').value, email: document.querySelector('#d-email').value, password: document.querySelector('#d-password').value, role: document.querySelector('#d-role').value, rank: document.querySelector('#d-rank').value, birthDate: document.querySelector('#d-birthdate').value || null };
  const response = await fetch('/api/directors', { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
  const result = await response.json();
  if (!response.ok) { error.textContent = result.error || 'Não foi possível criar a conta.'; return; }
  modal.close();
  refresh();
};

(async function () {
  me = await loadMe();
  if (!me) { window.location.href = 'gestao-login.html'; return; }
  await refresh();
})();
