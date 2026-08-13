const token = sessionStorage.getItem('compex-token');
const list = document.querySelector('#calls-list');
const typeLabel = { TREINO: 'Treino', JOGO: 'Jogo' };
const statusLabel = { pending: 'Aguardando confirmação', confirmed: 'Presença confirmada', declined: 'Você avisou que não vai' };

async function load() {
  try {
    const response = await fetch('/api/me/session-calls', { headers: { Authorization: `Bearer ${token || ''}` } });
    if (!response.ok) { list.innerHTML = '<p class="empty-note">Faça login para ver suas convocações.</p>'; return; }
    const calls = await response.json();
    list.innerHTML = calls.map(c => `
      <div class="status-card">
        <div>
          <span class="badge ${c.status === 'confirmed' ? '' : c.status === 'declined' ? 'off' : 'off'}">${statusLabel[c.status] || c.status}</span>
          <div class="meta" style="margin-top:12px">
            <span>MODALIDADE<b>${c.teamName}</b></span>
            <span>${typeLabel[c.sessionType] || c.sessionType}<b>${new Date(c.sessionDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</b></span>
            ${c.sessionLocation ? `<span>LOCAL<b>${c.sessionLocation}</b></span>` : ''}
          </div>
        </div>
        ${c.status === 'pending' ? `
          <div style="display:flex;gap:10px">
            <button class="primary confirm-call" data-id="${c.id}" style="border:0;cursor:pointer">Vou! ✓</button>
            <button class="decline-call" data-id="${c.id}" style="border:1px solid #dce1e8;background:#fff;border-radius:8px;padding:12px 18px;cursor:pointer">Não vou</button>
          </div>
        ` : ''}
      </div>`).join('') || '<p class="empty-note">Nenhuma convocação por enquanto. Elas aparecem aqui assim que um treino ou jogo for lançado na sua modalidade.</p>';

    document.querySelectorAll('.confirm-call').forEach(btn => btn.onclick = () => respond(btn.dataset.id, 'CONFIRMED'));
    document.querySelectorAll('.decline-call').forEach(btn => btn.onclick = () => respond(btn.dataset.id, 'DECLINED'));
  } catch { list.innerHTML = '<p class="empty-note">Não foi possível carregar suas convocações.</p>'; }
}

async function respond(id, status) {
  await fetch(`/api/me/session-calls/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` }, body: JSON.stringify({ status }) });
  load();
}

load();
