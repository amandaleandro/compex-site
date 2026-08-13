const token = sessionStorage.getItem('compex-token');
const list = document.querySelector('#charges-list');
const money = cents => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const statusLabel = { pending: 'Pendente', paid: 'Pago', failed: 'Falhou' };
const typeLabel = { TREINO: 'Treino', JOGO: 'Jogo' };

async function load() {
  try {
    const response = await fetch('/api/me/session-charges', { headers: { Authorization: `Bearer ${token || ''}` } });
    if (!response.ok) { list.innerHTML = '<p class="empty-note">Faça login para ver suas cobranças.</p>'; return; }
    const charges = await response.json();
    list.innerHTML = charges.map(c => `
      <div class="status-card" style="flex-wrap:wrap;gap:14px">
        <div>
          <span class="badge ${c.status === 'paid' ? '' : 'off'}">${statusLabel[c.status] || c.status}</span>
          <div class="meta" style="margin-top:12px">
            <span>MODALIDADE<b>${c.teamName}</b></span>
            <span>${typeLabel[c.sessionType] || c.sessionType}<b>${new Date(c.sessionDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</b></span>
            <span>VALOR<b>${money(c.amountCents)}</b></span>
            ${c.breakdown ? `<span>DETALHE<b>${c.breakdown}</b></span>` : ''}
          </div>
        </div>
        ${c.status === 'pending' && c.pixQrBase64 ? `
          <div style="text-align:center">
            <img src="data:image/png;base64,${c.pixQrBase64}" alt="QR Code PIX" style="width:140px;height:140px;border-radius:8px">
            <button class="copy-pix" data-code="${c.pixQrCode}" style="display:block;margin-top:8px;font-size:11px;border:1px solid #dce1e8;background:#fff;border-radius:6px;padding:6px 10px;cursor:pointer">Copiar código PIX</button>
          </div>
        ` : c.status === 'pending' ? '<p class="empty-note" style="margin:0">PIX ainda sendo gerado — atualize a página em instantes.</p>' : ''}
      </div>`).join('') || '<p class="empty-note">Nenhuma cobrança por enquanto. Elas aparecem aqui a cada treino ou jogo que você participar.</p>';

    document.querySelectorAll('.copy-pix').forEach(btn => btn.onclick = async () => {
      await navigator.clipboard?.writeText(btn.dataset.code);
      btn.textContent = 'Copiado ✓';
      setTimeout(() => { btn.textContent = 'Copiar código PIX'; }, 1500);
    });
  } catch { list.innerHTML = '<p class="empty-note">Não foi possível carregar suas cobranças.</p>'; }
}
load();
