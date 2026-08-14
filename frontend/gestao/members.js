const initials = n => n.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase();
const statusLabel = { active: 'Ativo', pending: 'Pendente', expired: 'Vencido' };
const kindLabel = { SOCIO: 'Sócio', AVULSO: 'Avulso' };

function authHeaders() {
  const token = sessionStorage.getItem('compex-token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` };
}

let allMembers = [];

async function loadMembers() {
  const response = await fetch('/api/members', { headers: authHeaders() });
  if (response.status === 401) { window.location.href = '/login'; return []; }
  if (!response.ok) return [];
  return response.json();
}

function render(all) {
  const search = document.querySelector('#search').value.toLowerCase();
  const status = document.querySelector('#status').value;
  const members = all.filter(m => (m.name.toLowerCase().includes(search) || m.course.toLowerCase().includes(search)) && (status === 'all' || m.status === status));
  document.querySelector('#members-list').innerHTML = members.map((m, i) => `<tr>
    <td><span class="person link-detail" data-id="${m.id}" style="cursor:pointer"><span class="avatar ${i % 3 === 1 ? 'blue' : i % 3 === 2 ? 'pink' : ''}">${initials(m.name)}</span>${m.name}</span></td>
    <td>${m.course}</td>
    <td><span class="badge ${m.membershipKind === 'AVULSO' ? 'badge-warning' : 'badge-active'}">${kindLabel[m.membershipKind] || m.membershipKind}</span></td>
    <td>${m.teams?.length ? m.teams.join(', ') : '<span class="muted">—</span>'}${m.pendingCharges ? ` <span class="badge badge-danger">${m.pendingCharges} cobrança(s)</span>` : ''}</td>
    <td><span class="pill ${m.status}">● ${statusLabel[m.status]}</span></td>
    <td><button type="button" class="btn btn-ghost btn-sm edit-member" data-id="${m.id}">Editar</button></td>
  </tr>`).join('') || '<tr><td colspan="6">Nenhum associado encontrado.</td></tr>';
  document.querySelector('#active-count').textContent = all.filter(m => m.status === 'active').length;
  document.querySelector('#pending-count').textContent = all.filter(m => m.status === 'pending').length;
  document.querySelector('#expired-count').textContent = all.filter(m => m.status === 'expired').length;
  const now = new Date();
  document.querySelector('#new-count').textContent = all.filter(m => m.createdAt && new Date(m.createdAt).getMonth() === now.getMonth() && new Date(m.createdAt).getFullYear() === now.getFullYear()).length;

  document.querySelectorAll('.edit-member').forEach(btn => btn.onclick = () => openEdit(btn.dataset.id));
  document.querySelectorAll('.link-detail').forEach(el => el.onclick = () => openDetail(el.dataset.id));
}

async function refresh() { allMembers = await loadMembers(); render(allMembers); }

const modal = document.querySelector('#modal');
document.querySelector('#new-member').onclick = () => {
  document.querySelector('#member-form').reset();
  document.querySelector('#member-modal-title').textContent = 'Novo associado';
  document.querySelector('#member-modal-sub').textContent = 'Cria o cadastro e a conta de acesso do associado.';
  document.querySelector('#member-submit').textContent = 'Cadastrar';
  document.querySelector('#member-id').value = '';
  document.querySelector('#email').disabled = false;
  document.querySelector('#status-field').hidden = true;
  modal.classList.add('open');
};
document.querySelector('#close').onclick = () => modal.classList.remove('open');
document.querySelector('#search').oninput = () => render(allMembers);
document.querySelector('#status').onchange = () => render(allMembers);
document.querySelector('#member-form').onsubmit = async e => {
  e.preventDefault();
  const form = document.querySelector('#member-form');
  const id = document.querySelector('#member-id').value;
  const payload = { name: form.querySelector('#name').value, course: form.querySelector('#course').value, plan: form.querySelector('#plan').value, email: form.querySelector('#email').value };
  if (id) {
    payload.id = id;
    payload.status = form.querySelector('#member-status').value;
    await fetch('/api/members', { method: 'PUT', headers: authHeaders(), body: JSON.stringify(payload) });
  } else {
    payload.status = 'active';
    await fetch('/api/members', { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
  }
  e.target.reset();
  modal.classList.remove('open');
  refresh();
};

function openEdit(id) {
  const m = allMembers.find(x => x.id === id);
  if (!m) return;
  document.querySelector('#member-form').reset();
  document.querySelector('#member-modal-title').textContent = 'Editar associado';
  document.querySelector('#member-modal-sub').textContent = m.name;
  document.querySelector('#member-submit').textContent = 'Salvar';
  document.querySelector('#member-id').value = m.id;
  document.querySelector('#name').value = m.name;
  document.querySelector('#email').value = m.email;
  document.querySelector('#course').value = m.course;
  document.querySelector('#plan').value = m.plan;
  document.querySelector('#status-field').hidden = false;
  document.querySelector('#member-status').value = m.status;
  modal.classList.add('open');
}

const detailModal = document.querySelector('#detail-modal');
document.querySelector('#close-detail').onclick = () => detailModal.classList.remove('open');
detailModal.onclick = event => { if (event.target === detailModal) detailModal.classList.remove('open'); };

async function openDetail(id) {
  const response = await fetch(`/api/members?id=${encodeURIComponent(id)}`, { headers: authHeaders() });
  if (!response.ok) return;
  const m = await response.json();
  document.querySelector('#detail-name').textContent = m.name;
  document.querySelector('#detail-sub').textContent = `${m.email} · ${m.course} · ${kindLabel[m.membershipKind] || m.membershipKind} · ${statusLabel[m.status] || m.status}${m.membershipKind === 'SOCIO' ? ` · ${m.sportSlots} vaga(s) de esporte` : ''}`;
  document.querySelector('#detail-teams').innerHTML = m.teams.length
    ? m.teams.map(t => `<div style="padding:4px 0"><b>${t.teamName}</b></div>`).join('')
    : '<p class="muted" style="margin:0">Não vinculado a nenhuma modalidade.</p>';
  const money = c => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  document.querySelector('#detail-charges').innerHTML = m.charges.length
    ? m.charges.slice(0, 8).map(c => `<div style="padding:4px 0;font-size:12px"><b>${money(c.amountCents)}</b> · ${c.teamName} · <span class="badge ${c.status === 'paid' ? 'badge-active' : 'badge-warning'}">${c.status === 'paid' ? 'Pago' : 'Pendente'}</span></div>`).join('')
    : '<p class="muted" style="margin:0">Nenhuma cobrança de treino/jogo.</p>';
  detailModal.classList.add('open');
}

refresh();
