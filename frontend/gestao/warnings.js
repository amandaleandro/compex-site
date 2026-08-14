const roleLabel = { FINANCEIRO: 'Financeiro', ESPORTES: 'Esportes', EVENTOS: 'Eventos', MARKETING: 'Marketing', PRODUTOS: 'Produtos', PATRIMONIO: 'Patrimônio', PRESIDENCIA: 'Presidência' };
const typeLabel = { ADVERTENCIA: 'Advertência', SUSPENSAO: 'Suspensão', DESLIGAMENTO: 'Desligamento' };
const initials = name => (name || '').split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();

function authHeaders() {
  const token = sessionStorage.getItem('compex-token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` };
}

async function loadMe() {
  const response = await fetch('/api/auth/me', { headers: authHeaders() });
  if (!response.ok) return null;
  return (await response.json()).user;
}

async function loadDirectors() {
  const response = await fetch('/api/directors', { headers: authHeaders() });
  if (!response.ok) return [];
  return response.json();
}

async function loadWarnings() {
  const response = await fetch('/api/warnings', { headers: authHeaders() });
  if (response.status === 403) { document.querySelector('#warnings-list').innerHTML = '<p class="empty">Só a Presidência e diretores principais veem advertências.</p>'; return []; }
  if (!response.ok) return [];
  return response.json();
}

function render(warnings) {
  document.querySelector('#count-label').textContent = `${warnings.length} registro${warnings.length === 1 ? '' : 's'}`;
  document.querySelector('#count-advertencia').textContent = warnings.filter(w => w.type === 'ADVERTENCIA').length;
  document.querySelector('#count-suspensao').textContent = warnings.filter(w => w.type === 'SUSPENSAO').length;
  document.querySelector('#count-desligamento').textContent = warnings.filter(w => w.type === 'DESLIGAMENTO').length;

  document.querySelector('#warnings-list').innerHTML = warnings.map(w => `
    <div class="warning-card">
      <span class="avatar gray">${initials(w.userName)}</span>
      <div class="warning-body">
        <b>${w.userName}</b>
        <div class="who">${roleLabel[w.userRole] || w.userRole}</div>
        <p class="reason">${w.reason}</p>
      </div>
      <div class="warning-side">
        <span class="badge ${w.type}">${typeLabel[w.type]}</span>
        <time>${new Date(w.createdAt).toLocaleDateString('pt-BR')}</time>
        <button type="button" class="remove-warning" data-id="${w.id}">Excluir</button>
      </div>
    </div>`).join('') || '<p class="empty">Nenhuma advertência registrada.</p>';

  document.querySelectorAll('.remove-warning').forEach(button => button.onclick = async () => {
    if (!confirm('Excluir este registro?')) return;
    await fetch('/api/warnings', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ id: button.dataset.id }) });
    refresh();
  });
}

let directors = [];
async function refresh() { render(await loadWarnings()); }

const modal = document.querySelector('#warning-modal');
document.querySelector('#new-warning').onclick = async () => {
  document.querySelector('#warning-form').reset();
  document.querySelector('#w-error').textContent = '';
  document.querySelector('#w-user').innerHTML = directors.map(d => `<option value="${d.id}">${d.name} (${roleLabel[d.role] || d.role})</option>`).join('') || '<option disabled>Nenhuma conta disponível</option>';
  modal.showModal();
};
document.querySelector('#w-cancel').onclick = () => modal.close();
document.querySelector('#warning-form').onsubmit = async event => {
  event.preventDefault();
  const error = document.querySelector('#w-error');
  const payload = { userId: document.querySelector('#w-user').value, type: document.querySelector('#w-type').value, reason: document.querySelector('#w-reason').value };
  const response = await fetch('/api/warnings', { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
  const result = await response.json();
  if (!response.ok) { error.textContent = result.error || 'Não foi possível registrar.'; return; }
  modal.close();
  refresh();
};

(async function () {
  const me = await loadMe();
  if (!me) { window.location.href = '/login'; return; }
  directors = await loadDirectors();
  await refresh();
})();
