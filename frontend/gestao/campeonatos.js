function authHeaders() {
  const token = sessionStorage.getItem('compex-token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` };
}

const statusLabel = { EM_ANDAMENTO: 'Em andamento', FINALIZADO: 'Finalizado', PROXIMO: 'Próximo' };
const statusBadge = { EM_ANDAMENTO: 'badge-warning', FINALIZADO: 'badge-active', PROXIMO: 'badge-neutral' };
const gameStatusLabel = { AGENDADO: 'Agendado', REALIZADO: 'Realizado' };

let allChampionships = [];
let expandedId = null;

async function loadChampionships() {
  const response = await fetch('/api/championships', { headers: authHeaders() });
  if (response.status === 401) { window.location.href = 'gestao-login.html'; return []; }
  if (!response.ok) return [];
  return response.json();
}

async function render() {
  const term = (document.querySelector('#search').value || '').toLowerCase();
  allChampionships = await loadChampionships();
  const filtered = allChampionships.filter(c => c.name.toLowerCase().includes(term) || c.sport.toLowerCase().includes(term));

  document.querySelector('#metric-total').textContent = allChampionships.length;
  document.querySelector('#metric-titles').textContent = allChampionships.filter(c => c.isTitle).length;
  document.querySelector('#metric-active').textContent = allChampionships.filter(c => c.status === 'EM_ANDAMENTO').length;

  document.querySelector('#list').innerHTML = filtered.map(c => {
    const games = c.games || [];
    const isOpen = expandedId === c.id;
    const gamesRows = games.map(g => {
      const logo = g.opponentLogoUrl
        ? `<img src="${g.opponentLogoUrl}" alt="${g.opponentName}" style="width:32px;height:32px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0">`
        : `<span style="width:32px;height:32px;display:grid;place-items:center;background:#f7fafc;border-radius:6px;font-size:14px;border:1px solid #e2e8f0">⚔️</span>`;
      const score = g.ourScore !== null && g.opponentScore !== null ? `<b>${g.ourScore} × ${g.opponentScore}</b>` : '<span class="muted">— × —</span>';
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid #edf2f7">
          ${logo}
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:8px"><b style="font-size:14px">COMPEX x ${g.opponentName}</b><span class="badge ${g.status === 'REALIZADO' ? 'badge-active' : 'badge-neutral'}" style="font-size:10px">${gameStatusLabel[g.status]}</span></div>
            <small style="color:#718096">${new Date(g.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}${g.location ? ' · ' + g.location : ''}</small>
          </div>
          ${score}
          <button type="button" class="btn btn-ghost btn-sm edit-game" data-id="${g.id}" data-champ="${c.id}" style="padding:4px 10px;font-size:12px">Editar</button>
          <button type="button" class="remove-game" data-id="${g.id}" title="Remover" style="background:none;border:none;color:#e53e3e;font-size:18px;cursor:pointer;padding:0 8px">&times;</button>
        </div>`;
    }).join('') || '<p class="empty-state" style="padding:16px;text-align:center;color:#a0aec0">Nenhum jogo cadastrado ainda.</p>';

    return `
      <div class="product-row" style="flex-direction:column;align-items:stretch;padding:0;border-bottom:1px solid #edf2f7">
        <div style="display:flex;align-items:center;gap:14px;padding:12px 16px">
          <span class="file-icon" style="width:44px;height:44px;display:grid;place-items:center;background:${c.isTitle ? '#fffaf0' : '#f7fafc'};border-radius:8px;font-size:20px;border:1px solid #e2e8f0">${c.isTitle ? '🏆' : '⚡'}</span>
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:8px">
              <b style="font-size:15px;color:#1a202c">${c.name}</b>
              <span class="badge ${statusBadge[c.status]}">${statusLabel[c.status]}</span>
              ${c.isTitle ? '<span class="badge badge-active">🏆 Título</span>' : ''}
            </div>
            <small style="color:#718096;display:block;margin-top:2px">${c.sport}${c.season ? ' · ' + c.season : ''}${c.placement ? ' · ' + c.placement : ''}</small>
          </div>
          <button type="button" class="btn btn-ghost toggle-games" data-id="${c.id}" style="padding:4px 10px;font-size:12px">${isOpen ? 'Ocultar jogos' : `Jogos (${games.length})`}</button>
          <button type="button" class="btn btn-ghost edit-championship" data-id="${c.id}" style="padding:4px 10px;font-size:12px">Editar</button>
          <button type="button" class="remove-championship" data-id="${c.id}" title="Remover" style="background:none;border:none;color:#e53e3e;font-size:20px;cursor:pointer;padding:0 8px">&times;</button>
        </div>
        ${isOpen ? `<div style="background:#fafbfc;padding:0 4px">
          ${gamesRows}
          <div style="padding:10px 16px"><button type="button" class="btn btn-ghost btn-sm add-game" data-champ="${c.id}">+ Adicionar jogo</button></div>
        </div>` : ''}
      </div>`;
  }).join('') || '<p class="empty-state" style="padding:24px;text-align:center;color:#a0aec0">Nenhum campeonato cadastrado ainda.</p>';

  document.querySelectorAll('.toggle-games').forEach(btn => btn.onclick = () => { expandedId = expandedId === btn.dataset.id ? null : btn.dataset.id; render(); });

  document.querySelectorAll('.edit-championship').forEach(btn => btn.onclick = () => {
    const c = allChampionships.find(x => x.id === btn.dataset.id);
    if (!c) return;
    document.querySelector('#modal-title').textContent = 'Editar campeonato';
    document.querySelector('#championship-id').value = c.id;
    document.querySelector('#name').value = c.name;
    document.querySelector('#sport').value = c.sport;
    document.querySelector('#season').value = c.season || '';
    document.querySelector('#status').value = c.status;
    document.querySelector('#placement').value = c.placement || '';
    document.querySelector('#isTitle').checked = !!c.isTitle;
    document.querySelector('#notes').value = c.notes || '';
    document.querySelector('#modal').classList.add('open');
  });

  document.querySelectorAll('.remove-championship').forEach(btn => btn.onclick = async () => {
    if (!confirm('Remover este campeonato e todos os seus jogos?')) return;
    await fetch('/api/championships', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ id: btn.dataset.id }) });
    render();
  });

  document.querySelectorAll('.add-game').forEach(btn => btn.onclick = () => openGameModal(btn.dataset.champ));

  document.querySelectorAll('.edit-game').forEach(btn => btn.onclick = () => {
    const c = allChampionships.find(x => x.id === btn.dataset.champ);
    const g = c?.games.find(x => x.id === btn.dataset.id);
    if (!g) return;
    openGameModal(btn.dataset.champ, g);
  });

  document.querySelectorAll('.remove-game').forEach(btn => btn.onclick = async () => {
    if (!confirm('Remover este jogo?')) return;
    await fetch('/api/championship-games', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ id: btn.dataset.id }) });
    render();
  });
}

const modal = document.querySelector('#modal');
document.querySelector('#new-championship').onclick = () => {
  document.querySelector('#form').reset();
  document.querySelector('#championship-id').value = '';
  document.querySelector('#modal-title').textContent = 'Novo campeonato';
  modal.classList.add('open');
};
document.querySelector('#close').onclick = () => modal.classList.remove('open');
document.querySelector('#search').oninput = render;

document.querySelector('#form').onsubmit = async e => {
  e.preventDefault();
  const id = document.querySelector('#championship-id').value;
  const payload = {
    id: id || undefined,
    name: document.querySelector('#name').value,
    sport: document.querySelector('#sport').value,
    season: document.querySelector('#season').value,
    status: document.querySelector('#status').value,
    placement: document.querySelector('#placement').value,
    isTitle: document.querySelector('#isTitle').checked,
    notes: document.querySelector('#notes').value,
  };
  const method = id ? 'PUT' : 'POST';
  await fetch('/api/championships', { method, headers: authHeaders(), body: JSON.stringify(payload) });
  modal.classList.remove('open');
  render();
};

// ---- Jogos ----
const gameModal = document.querySelector('#game-modal');

function openGameModal(championshipId, game) {
  document.querySelector('#game-form').reset();
  document.querySelector('#opponent-logo-preview').innerHTML = '';
  document.querySelector('#opponentLogoUrl').value = '';
  document.querySelector('#game-championship-id').value = championshipId;
  document.querySelector('#game-id').value = game ? game.id : '';
  document.querySelector('#game-modal-title').textContent = game ? 'Editar jogo' : 'Novo jogo';
  if (game) {
    document.querySelector('#opponentName').value = game.opponentName;
    document.querySelector('#opponentLogoUrl').value = game.opponentLogoUrl || '';
    if (game.opponentLogoUrl) document.querySelector('#opponent-logo-preview').innerHTML = `<img src="${game.opponentLogoUrl}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0">`;
    document.querySelector('#game-date').value = game.date.slice(0, 10);
    document.querySelector('#game-location').value = game.location || '';
    document.querySelector('#game-status').value = game.status;
    document.querySelector('#ourScore').value = game.ourScore ?? '';
    document.querySelector('#opponentScore').value = game.opponentScore ?? '';
    document.querySelector('#game-notes').value = game.notes || '';
  }
  gameModal.classList.add('open');
}

document.querySelector('#game-close').onclick = () => gameModal.classList.remove('open');

document.querySelector('#opponentLogoFile').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  const preview = document.querySelector('#opponent-logo-preview');
  preview.innerHTML = 'Enviando...';
  const formData = new FormData();
  formData.append('file', file);
  const token = sessionStorage.getItem('compex-token');
  try {
    const response = await fetch('/api/championships/upload-logo', { method: 'POST', headers: { Authorization: `Bearer ${token || ''}` }, body: formData });
    const result = await response.json();
    if (!response.ok) { preview.innerHTML = ''; alert(result.error || 'Falha ao enviar logo.'); return; }
    document.querySelector('#opponentLogoUrl').value = result.url;
    preview.innerHTML = `<img src="${result.url}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0">`;
  } catch {
    preview.innerHTML = '';
    alert('Falha ao enviar logo.');
  }
};

document.querySelector('#game-form').onsubmit = async e => {
  e.preventDefault();
  const id = document.querySelector('#game-id').value;
  const payload = {
    id: id || undefined,
    championshipId: document.querySelector('#game-championship-id').value,
    opponentName: document.querySelector('#opponentName').value,
    opponentLogoUrl: document.querySelector('#opponentLogoUrl').value || null,
    date: document.querySelector('#game-date').value,
    location: document.querySelector('#game-location').value,
    status: document.querySelector('#game-status').value,
    ourScore: document.querySelector('#ourScore').value,
    opponentScore: document.querySelector('#opponentScore').value,
    notes: document.querySelector('#game-notes').value,
  };
  const method = id ? 'PUT' : 'POST';
  await fetch('/api/championship-games', { method, headers: authHeaders(), body: JSON.stringify(payload) });
  gameModal.classList.remove('open');
  expandedId = payload.championshipId;
  render();
};

render();
