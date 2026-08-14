const modal = document.querySelector('#athlete-modal');
const open = document.querySelector('#open-athlete');
const close = document.querySelector('#close-athlete');
const form = document.querySelector('#athlete-form');
const list = document.querySelector('#athlete-list');
const count = document.querySelector('#athlete-count');
const colors = ['orange', 'blue', 'pink'];
const initials = name => name.split(' ').map(word => word[0]).slice(0, 2).join('').toUpperCase();

function authHeaders() {
  const token = sessionStorage.getItem('compex-token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` };
}

async function loadAthletes() {
  const response = await fetch('/api/athletes', { headers: authHeaders() });
  if (!response.ok) return [];
  return response.json();
}

async function render() {
  const athletes = await loadAthletes();
  count.textContent = `${athletes.length} atleta${athletes.length === 1 ? '' : 's'}`;
  list.innerHTML = athletes.map((athlete, index) => `<div class="athlete"><span class="athlete-avatar ${colors[index % colors.length]}">${initials(athlete.name)}</span><div><b>${athlete.name}</b><small>${athlete.course} · ${athlete.position} · ${athlete.sport}</small></div><button type="button" class="btn btn-ghost btn-sm edit-athlete" data-id="${athlete.id}" data-name="${athlete.name}" data-course="${athlete.course}" data-sport="${athlete.sport}" data-position="${athlete.position}">Editar</button><button class="remove" data-id="${athlete.id}">×</button></div>`).join('') || '<p>Nenhum atleta cadastrado ainda.</p>';
  document.querySelectorAll('.remove').forEach(button => button.onclick = async () => {
    if (!confirm('Remover este atleta?')) return;
    await fetch('/api/athletes', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ id: button.dataset.id }) });
    render();
  });
  document.querySelectorAll('.edit-athlete').forEach(button => button.onclick = () => {
    document.querySelector('#athlete-modal-title').textContent = 'Editar atleta';
    document.querySelector('#athlete-submit').textContent = 'Salvar';
    document.querySelector('#athlete-id').value = button.dataset.id;
    document.querySelector('#athlete-name').value = button.dataset.name;
    document.querySelector('#athlete-course').value = button.dataset.course;
    document.querySelector('#athlete-sport').value = button.dataset.sport;
    document.querySelector('#athlete-position').value = button.dataset.position;
    modal.classList.add('open');
  });
}

open.onclick = () => {
  form.reset();
  document.querySelector('#athlete-modal-title').textContent = 'Novo atleta';
  document.querySelector('#athlete-submit').textContent = 'Cadastrar';
  document.querySelector('#athlete-id').value = '';
  modal.classList.add('open');
};
close.onclick = () => modal.classList.remove('open');
modal.onclick = event => { if (event.target === modal) modal.classList.remove('open'); };
form.onsubmit = async event => {
  event.preventDefault();
  const id = document.querySelector('#athlete-id').value;
  const payload = { name: document.querySelector('#athlete-name').value, course: document.querySelector('#athlete-course').value, position: document.querySelector('#athlete-position').value, sport: document.querySelector('#athlete-sport').value };
  if (id) payload.id = id;
  await fetch('/api/athletes', { method: id ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
  form.reset();
  modal.classList.remove('open');
  render();
};

render();

/* ---------- Modalidades (masculino/feminino) + treinos e jogos ---------- */
const genderLabel = { MASCULINO: 'Masculina', FEMININO: 'Feminina', MISTA: 'Mista' };
const sessionTypeLabel = { TREINO: 'Treino', JOGO: 'Jogo' };
const money = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const modalityModal = document.querySelector('#modality-modal');
const modalityForm = document.querySelector('#modality-form');
const modalityList = document.querySelector('#modality-list');
const modalityCount = document.querySelector('#modality-count');
const sessionsModal = document.querySelector('#sessions-modal');
const sessionsForm = document.querySelector('#session-form');
const sessionsList = document.querySelector('#sessions-list');
let modalities = [];
let activeModalityId = null;

async function loadModalities() {
  const response = await fetch('/api/modalities', { headers: authHeaders() });
  if (!response.ok) return [];
  return response.json();
}

async function renderModalities() {
  modalities = await loadModalities();
  modalityCount.textContent = `${modalities.length} modalidade${modalities.length === 1 ? '' : 's'}`;
  modalityList.innerHTML = modalities.map(m => `
    <div class="modality-row">
      <div><b>${m.name}</b><small>${m.sport} · ${genderLabel[m.gender] || m.gender}${m.trainingDay ? ' · ' + m.trainingDay : ''}${m.dropInPriceCents ? ' · avulso: ' + money(m.dropInPriceCents / 100) : ''}</small></div>
      <span class="muted" style="font-size:11px">${m.sessionCount} treino/jogo · ${m.enrollmentCount} inscrito(s)</span>
      <button type="button" class="btn btn-ghost btn-sm open-team-athletes" data-id="${m.id}" data-name="${m.name}">Atletas</button>
      <button type="button" class="btn btn-ghost btn-sm open-sessions" data-id="${m.id}" data-name="${m.name}">Treinos &amp; jogos</button>
      <button type="button" class="btn btn-ghost btn-sm edit-modality" data-id="${m.id}">Editar</button>
      <button type="button" class="remove-modality" data-id="${m.id}">×</button>
    </div>`).join('') || '<p class="empty-state">Nenhuma modalidade cadastrada ainda.</p>';

  document.querySelectorAll('.remove-modality').forEach(btn => btn.onclick = async () => {
    if (!confirm('Remover esta modalidade? Treinos e jogos registrados também serão apagados.')) return;
    await fetch('/api/modalities', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ id: btn.dataset.id }) });
    renderModalities();
  });
  document.querySelectorAll('.open-sessions').forEach(btn => btn.onclick = () => openSessions(btn.dataset.id, btn.dataset.name));
  document.querySelectorAll('.open-team-athletes').forEach(btn => btn.onclick = () => openTeamAthletes(btn.dataset.id, btn.dataset.name));
  document.querySelectorAll('.edit-modality').forEach(btn => btn.onclick = () => {
    const m = modalities.find(x => x.id === btn.dataset.id);
    if (!m) return;
    document.querySelector('#modality-modal-title').textContent = 'Editar modalidade';
    document.querySelector('#modality-submit').textContent = 'Salvar';
    document.querySelector('#modality-id').value = m.id;
    document.querySelector('#modality-name').value = m.name;
    document.querySelector('#modality-sport').value = m.sport;
    document.querySelector('#modality-gender').value = m.gender;
    document.querySelector('#modality-training-day').value = m.trainingDay || '';
    document.querySelector('#modality-drop-in-price').value = m.dropInPriceCents ? m.dropInPriceCents / 100 : '';
    document.querySelector('#modality-description').value = m.description || '';
    modalityModal.classList.add('open');
  });

  const sportSelect = document.querySelector('#athlete-sport');
  if (sportSelect && sportSelect.tagName === 'SELECT') {
    const current = sportSelect.value;
    sportSelect.innerHTML = modalities.map(m => `<option value="${m.sport}">${m.name}</option>`).join('') || '<option value="">Cadastre uma modalidade primeiro</option>';
    if (current) sportSelect.value = current;
  }
  renderCoachTeamOptions();
}

document.querySelector('#new-modality').onclick = () => {
  modalityForm.reset();
  document.querySelector('#modality-modal-title').textContent = 'Nova modalidade';
  document.querySelector('#modality-submit').textContent = 'Cadastrar';
  document.querySelector('#modality-id').value = '';
  modalityModal.classList.add('open');
};
document.querySelector('#close-modality').onclick = () => modalityModal.classList.remove('open');
modalityModal.onclick = event => { if (event.target === modalityModal) modalityModal.classList.remove('open'); };
modalityForm.onsubmit = async event => {
  event.preventDefault();
  const id = document.querySelector('#modality-id').value;
  const payload = {
    name: document.querySelector('#modality-name').value,
    sport: document.querySelector('#modality-sport').value,
    gender: document.querySelector('#modality-gender').value,
    trainingDay: document.querySelector('#modality-training-day').value,
    dropInPrice: document.querySelector('#modality-drop-in-price').value,
    description: document.querySelector('#modality-description').value,
  };
  if (id) payload.id = id;
  await fetch('/api/modalities', { method: id ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
  modalityModal.classList.remove('open');
  renderModalities();
};

async function loadSessions(teamId) {
  const response = await fetch(`/api/team-sessions?teamId=${encodeURIComponent(teamId)}`, { headers: authHeaders() });
  if (!response.ok) return [];
  return response.json();
}

let sessionsCache = [];
async function renderSessions() {
  sessionsCache = await loadSessions(activeModalityId);
  const totalCoachCost = sessionsCache.reduce((sum, s) => sum + (s.coachCost || 0), 0);
  document.querySelector('#sessions-total-cost').textContent = money(totalCoachCost);
  sessionsList.innerHTML = sessionsCache.map(s => `
    <div class="session-row">
      <span class="badge ${s.type === 'JOGO' ? 'badge-warning' : 'badge-active'}">${sessionTypeLabel[s.type]}</span>
      <div>
        <b>${new Date(s.date).toLocaleDateString('pt-BR')}</b>
        <small>${s.location || 'Local a definir'}${s.coachName ? ' · treinador: ' + s.coachName : ''}${s.coachCost ? ' · ' + money(s.coachCost) : ''}${s.refereeCost ? ' · juiz: ' + money(s.refereeCost) : ''}</small>
      </div>
      <button type="button" class="btn btn-ghost btn-sm open-convocation" data-id="${s.id}" data-date="${new Date(s.date).toLocaleDateString('pt-BR')}" data-type="${sessionTypeLabel[s.type]}">Convocar</button>
      <button type="button" class="btn btn-ghost btn-sm edit-session" data-id="${s.id}">Editar</button>
      <button type="button" class="remove-session" data-id="${s.id}">×</button>
    </div>`).join('') || '<p class="empty-state">Nenhum treino ou jogo registrado ainda.</p>';

  document.querySelectorAll('.open-convocation').forEach(btn => btn.onclick = () => openConvocation(btn.dataset.id, btn.dataset.type, btn.dataset.date));
  document.querySelectorAll('.remove-session').forEach(btn => btn.onclick = async () => {
    await fetch('/api/team-sessions', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ id: btn.dataset.id }) });
    renderSessions();
    renderModalities();
  });
  document.querySelectorAll('.edit-session').forEach(btn => btn.onclick = () => {
    const s = sessionsCache.find(x => x.id === btn.dataset.id);
    if (!s) return;
    document.querySelector('#sessions-modal-title').textContent = 'Editar treino/jogo';
    document.querySelector('#session-submit').textContent = 'Salvar';
    document.querySelector('#session-id').value = s.id;
    document.querySelector('#session-type').value = s.type;
    document.querySelector('#session-date').value = new Date(s.date).toISOString().slice(0, 10);
    document.querySelector('#session-location').value = s.location || '';
    document.querySelector('#session-coach').value = s.coachName || '';
    document.querySelector('#session-cost').value = s.coachCost || '';
    document.querySelector('#session-referee-name').value = s.refereeName || '';
    document.querySelector('#session-referee-pix').value = s.refereePixKey || '';
    document.querySelector('#session-referee-cost').value = s.refereeCost || '';
    document.querySelector('#session-notes').value = s.notes || '';
    toggleRefereeFields();
  });
}

function toggleRefereeFields() {
  document.querySelector('#referee-fields').hidden = document.querySelector('#session-type').value !== 'JOGO';
}
document.querySelector('#session-type').onchange = toggleRefereeFields;

function openSessions(teamId, teamName) {
  activeModalityId = teamId;
  document.querySelector('#sessions-modal-title').textContent = `Treinos & jogos — ${teamName}`;
  document.querySelector('#session-submit').textContent = 'Registrar';
  sessionsForm.reset();
  document.querySelector('#session-id').value = '';
  document.querySelector('#coach-pix-hint').textContent = '';
  toggleRefereeFields();
  renderSessions();
  renderCoaches();
  sessionsModal.classList.add('open');
}
document.querySelector('#close-sessions').onclick = () => sessionsModal.classList.remove('open');
sessionsModal.onclick = event => { if (event.target === sessionsModal) sessionsModal.classList.remove('open'); };
sessionsForm.onsubmit = async event => {
  event.preventDefault();
  const id = document.querySelector('#session-id').value;
  const payload = {
    teamId: activeModalityId,
    type: document.querySelector('#session-type').value,
    date: document.querySelector('#session-date').value,
    location: document.querySelector('#session-location').value,
    coachName: document.querySelector('#session-coach').value,
    coachCost: document.querySelector('#session-cost').value,
    refereeName: document.querySelector('#session-referee-name').value,
    refereePixKey: document.querySelector('#session-referee-pix').value,
    refereeCost: document.querySelector('#session-referee-cost').value,
    notes: document.querySelector('#session-notes').value,
  };
  if (id) payload.id = id;
  await fetch('/api/team-sessions', { method: id ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
  sessionsForm.reset();
  document.querySelector('#session-id').value = '';
  document.querySelector('#sessions-modal-title').textContent = `Treinos & jogos`;
  document.querySelector('#session-submit').textContent = 'Registrar';
  toggleRefereeFields();
  renderSessions();
  renderModalities();
};

renderModalities();

/* ---------- Convocação (quem foi chamado para o treino/jogo) ---------- */
const convocationModal = document.querySelector('#convocation-modal');
const convocationSearch = document.querySelector('#convocation-search');
const convocationCandidates = document.querySelector('#convocation-candidates');
const convocationList = document.querySelector('#convocation-list');
const attendanceStatusLabel = { PENDING: 'Aguardando resposta', CONFIRMED: 'Confirmado', DECLINED: 'Recusou' };
const attendanceStatusBadge = { PENDING: 'badge-neutral', CONFIRMED: 'badge-active', DECLINED: 'badge-danger' };
let activeSessionId = null;

async function loadTeamAthletes() {
  const response = await fetch(`/api/member-athletes?teamId=${encodeURIComponent(activeModalityId)}`, { headers: authHeaders() });
  return response.ok ? response.json() : [];
}

async function loadConvocations() {
  const response = await fetch(`/api/session-attendances?sessionId=${encodeURIComponent(activeSessionId)}`, { headers: authHeaders() });
  return response.ok ? response.json() : [];
}

async function renderConvocation() {
  const [athletes, convocations] = await Promise.all([loadTeamAthletes(), loadConvocations()]);
  const convokedIds = new Set(convocations.map(c => c.memberId));
  const query = convocationSearch.value.trim().toLowerCase();
  const candidates = athletes.filter(m => !convokedIds.has(m.id) && (!query || m.name.toLowerCase().includes(query)));

  convocationCandidates.innerHTML = candidates.map(m => `
    <div class="modality-row">
      <div><b>${m.name}</b><small>${m.course}</small></div>
      <button type="button" class="btn btn-ghost btn-sm add-convocation" data-id="${m.id}">+ Convocar</button>
    </div>`).join('') || '<p class="empty-state">Nenhum atleta vinculado disponível.</p>';

  convocationList.innerHTML = convocations.map(c => `
    <div class="modality-row">
      <div><b>${c.memberName}</b></div>
      <span class="badge ${attendanceStatusBadge[c.status]}">${attendanceStatusLabel[c.status]}</span>
      <button type="button" class="remove-convocation" data-id="${c.id}">×</button>
    </div>`).join('') || '<p class="empty-state">Ninguém convocado ainda.</p>';

  document.querySelectorAll('.add-convocation').forEach(btn => btn.onclick = async () => {
    const response = await fetch('/api/session-attendances', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ sessionId: activeSessionId, memberId: btn.dataset.id }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { alert(result.error || 'Não foi possível convocar.'); return; }
    renderConvocation();
  });
  document.querySelectorAll('.remove-convocation').forEach(btn => btn.onclick = async () => {
    await fetch('/api/session-attendances', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ id: btn.dataset.id }) });
    renderConvocation();
  });
}
convocationSearch.oninput = renderConvocation;

function openConvocation(sessionId, typeLabel, dateLabel) {
  activeSessionId = sessionId;
  document.querySelector('#convocation-title').textContent = `Convocação — ${typeLabel} em ${dateLabel}`;
  convocationSearch.value = '';
  renderConvocation();
  convocationModal.classList.add('open');
}
document.querySelector('#close-convocation').onclick = () => convocationModal.classList.remove('open');
convocationModal.onclick = event => { if (event.target === convocationModal) convocationModal.classList.remove('open'); };

/* ---------- Atletas da modalidade (vínculo com sócios) ---------- */
const teamAthletesModal = document.querySelector('#team-athletes-modal');
const memberSearchInput = document.querySelector('#member-search');
const memberSearchResults = document.querySelector('#member-search-results');
const teamAthletesList = document.querySelector('#team-athletes-list');

function slotsBadge(m) {
  const full = m.usedSlots >= m.sportSlots;
  return `<span class="badge ${full ? 'badge-danger' : 'badge-neutral'}">${m.usedSlots}/${m.sportSlots} vagas</span>`;
}

async function searchMembers() {
  const q = memberSearchInput.value.trim();
  if (!q) { memberSearchResults.innerHTML = '<p class="empty-state">Digite ao menos uma letra para buscar.</p>'; return; }
  const response = await fetch(`/api/member-athletes?search=${encodeURIComponent(q)}`, { headers: authHeaders() });
  const members = response.ok ? await response.json() : [];
  memberSearchResults.innerHTML = members.map(m => {
    const alreadyLinked = m.teams.some(t => t.teamId === activeModalityId);
    return `<div class="modality-row">
      <div><b>${m.name}</b>${m.membershipKind === 'AVULSO' ? ' <span class="badge badge-warning">Avulso</span>' : ''}<small>${m.course}</small></div>
      ${slotsBadge(m)}
      <button type="button" class="btn btn-ghost btn-sm edit-slots" data-id="${m.id}" data-slots="${m.sportSlots}" title="Ajustar vagas de esporte">Vagas</button>
      <button type="button" class="btn btn-ghost btn-sm add-team-athlete" data-id="${m.id}" ${alreadyLinked ? 'disabled' : ''}>${alreadyLinked ? 'Já vinculado' : '+ Adicionar'}</button>
    </div>`;
  }).join('') || '<p class="empty-state">Nenhum sócio encontrado.</p>';

  document.querySelectorAll('.add-team-athlete').forEach(btn => btn.onclick = async () => {
    const response = await fetch('/api/team-enrollments', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ memberId: btn.dataset.id, teamId: activeModalityId }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { alert(result.error || 'Não foi possível vincular.'); return; }
    searchMembers();
    renderTeamAthletes();
    renderModalities();
  });
  document.querySelectorAll('.edit-slots').forEach(btn => btn.onclick = async () => {
    const value = prompt('Quantas vagas de esporte este sócio tem direito?', btn.dataset.slots);
    if (value === null) return;
    const slots = Number(value);
    if (!Number.isInteger(slots) || slots < 1) { alert('Informe um número inteiro maior que zero.'); return; }
    const response = await fetch('/api/members', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ id: btn.dataset.id, sportSlots: slots }) });
    if (!response.ok) { const result = await response.json().catch(() => ({})); alert(result.error || 'Não foi possível atualizar.'); return; }
    searchMembers();
  });
}
memberSearchInput.oninput = searchMembers;

async function renderTeamAthletes() {
  const response = await fetch(`/api/member-athletes?teamId=${encodeURIComponent(activeModalityId)}`, { headers: authHeaders() });
  const members = response.ok ? await response.json() : [];
  teamAthletesList.innerHTML = members.map(m => `
    <div class="modality-row">
      <div><b>${m.name}</b>${m.membershipKind === 'AVULSO' ? ' <span class="badge badge-warning">Avulso</span>' : ''}<small>${m.course}</small></div>
      ${slotsBadge(m)}
      <button type="button" class="remove-team-athlete" data-enrollment="${m.teams.find(t => t.teamId === activeModalityId)?.enrollmentId}">×</button>
    </div>`).join('') || '<p class="empty-state">Nenhum atleta vinculado ainda.</p>';

  document.querySelectorAll('.remove-team-athlete').forEach(btn => btn.onclick = async () => {
    await fetch('/api/team-enrollments', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ id: btn.dataset.enrollment }) });
    renderTeamAthletes();
    renderModalities();
  });
}

function openTeamAthletes(teamId, teamName) {
  activeModalityId = teamId;
  document.querySelector('#team-athletes-title').textContent = `Atletas — ${teamName}`;
  memberSearchInput.value = '';
  memberSearchResults.innerHTML = '';
  renderTeamAthletes();
  teamAthletesModal.classList.add('open');
}
document.querySelector('#close-team-athletes').onclick = () => teamAthletesModal.classList.remove('open');
teamAthletesModal.onclick = event => { if (event.target === teamAthletesModal) teamAthletesModal.classList.remove('open'); };

/* ---------- Técnicos ---------- */
const coachModal = document.querySelector('#coach-modal');
const coachForm = document.querySelector('#coach-form');
const coachList = document.querySelector('#coach-list');
let coaches = [];

async function loadCoaches() {
  const response = await fetch('/api/coaches', { headers: authHeaders() });
  return response.ok ? response.json() : [];
}

function renderCoachTeamOptions() {
  const select = document.querySelector('#coach-team');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Sem modalidade vinculada</option>' + modalities.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  if (current) select.value = current;
}

async function renderCoaches() {
  coaches = await loadCoaches();
  document.querySelector('#coach-count').textContent = `${coaches.length} técnico${coaches.length === 1 ? '' : 's'}`;
  coachList.innerHTML = coaches.map(c => `
    <div class="modality-row">
      <div><b>${c.name}</b><small>${c.teamName ? c.teamName + ' · ' : ''}${money(c.hourlyRate)}/hora${c.pixKey ? ' · PIX: ' + c.pixKey : ''}</small></div>
      <button type="button" class="btn btn-ghost btn-sm edit-coach" data-id="${c.id}">Editar</button>
      <button type="button" class="remove-coach" data-id="${c.id}">×</button>
    </div>`).join('') || '<p class="empty-state">Nenhum técnico cadastrado ainda.</p>';

  document.querySelectorAll('.remove-coach').forEach(btn => btn.onclick = async () => {
    if (!confirm('Remover este técnico?')) return;
    await fetch('/api/coaches', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ id: btn.dataset.id }) });
    renderCoaches();
  });
  document.querySelectorAll('.edit-coach').forEach(btn => btn.onclick = () => {
    const c = coaches.find(x => x.id === btn.dataset.id);
    if (!c) return;
    renderCoachTeamOptions();
    document.querySelector('#coach-modal-title').textContent = 'Editar técnico';
    document.querySelector('#coach-submit').textContent = 'Salvar';
    document.querySelector('#coach-id').value = c.id;
    document.querySelector('#coach-name').value = c.name;
    document.querySelector('#coach-team').value = c.teamId || '';
    document.querySelector('#coach-hourly-rate').value = c.hourlyRate;
    document.querySelector('#coach-pix').value = c.pixKey || '';
    document.querySelector('#coach-notes').value = c.notes || '';
    coachModal.classList.add('open');
  });

  const select = document.querySelector('#session-coach');
  const current = select.value;
  select.innerHTML = '<option value="">Sem treinador cadastrado</option>' + coaches.map(c => `<option value="${c.name}" data-rate="${c.hourlyRate}" data-pix="${c.pixKey || ''}">${c.name}</option>`).join('');
  if (current) select.value = current;
}

document.querySelector('#session-coach').onchange = event => {
  const option = event.target.selectedOptions[0];
  const rate = option?.dataset.rate;
  document.querySelector('#session-cost').value = rate || '';
  document.querySelector('#coach-pix-hint').textContent = option?.dataset.pix ? `Chave PIX do técnico: ${option.dataset.pix}` : '';
};

document.querySelector('#new-coach').onclick = () => {
  coachForm.reset();
  renderCoachTeamOptions();
  document.querySelector('#coach-modal-title').textContent = 'Novo técnico';
  document.querySelector('#coach-submit').textContent = 'Cadastrar';
  document.querySelector('#coach-id').value = '';
  coachModal.classList.add('open');
};
document.querySelector('#close-coach').onclick = () => coachModal.classList.remove('open');
coachModal.onclick = event => { if (event.target === coachModal) coachModal.classList.remove('open'); };
coachForm.onsubmit = async event => {
  event.preventDefault();
  const id = document.querySelector('#coach-id').value;
  const payload = {
    name: document.querySelector('#coach-name').value,
    teamId: document.querySelector('#coach-team').value,
    hourlyRate: document.querySelector('#coach-hourly-rate').value,
    pixKey: document.querySelector('#coach-pix').value,
    notes: document.querySelector('#coach-notes').value,
  };
  if (id) payload.id = id;
  await fetch('/api/coaches', { method: id ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
  coachModal.classList.remove('open');
  renderCoaches();
};

renderCoaches();
