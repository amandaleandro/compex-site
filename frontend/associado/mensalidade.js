const token = sessionStorage.getItem('compex-token');
const statusBadge = document.querySelector('#status-badge');
const planLabel = document.querySelector('#plan-label');
const planUntil = document.querySelector('#plan-until');
const payButton = document.querySelector('#pay-button');
const payNote = document.querySelector('#pay-note');
let selectedPlan = 'anual';

document.querySelectorAll('.plan-card').forEach(card => card.addEventListener('click', () => {
  document.querySelectorAll('.plan-card').forEach(item => item.classList.remove('active'));
  card.classList.add('active');
  selectedPlan = card.dataset.plan;
}));

async function loadStatus() {
  try {
    const response = await fetch('/api/me/subscription', { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error();
    const data = await response.json();
    planLabel.textContent = data.plan || '—';
    planUntil.textContent = data.currentPeriodEnd ? new Date(data.currentPeriodEnd).toLocaleDateString('pt-BR') : '—';
    const isActive = data.status === 'ACTIVE' || data.status === 'active';
    statusBadge.className = `badge ${isActive ? 'ok' : 'pending'}`;
    statusBadge.textContent = isActive ? '● Associação ativa' : '● Pagamento pendente';
  } catch { statusBadge.textContent = 'Não foi possível carregar. Faça login novamente.'; }
}

payButton.addEventListener('click', async () => {
  payButton.disabled = true;
  payButton.textContent = 'Gerando link de pagamento…';
  try {
    const response = await fetch('/api/checkout/mensalidade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ planId: selectedPlan })
    });
    const data = await response.json();
    if (data.initPoint) return window.location.href = data.initPoint;
    payNote.style.display = 'block';
    payNote.textContent = data.warning || data.error || 'Não foi possível iniciar o pagamento.';
  } catch {
    payNote.style.display = 'block';
    payNote.textContent = 'Inicie o servidor da COMPEX para pagar sua mensalidade.';
  } finally {
    payButton.disabled = false;
    payButton.innerHTML = 'Pagar mensalidade <b>→</b>';
  }
});

loadStatus();
