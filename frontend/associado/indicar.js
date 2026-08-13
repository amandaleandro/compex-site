const token = sessionStorage.getItem('compex-token');
const codeEl = document.querySelector('#referral-code');
const totalEl = document.querySelector('#referral-total');
const copyButton = document.querySelector('#copy-button');
let code = '';

async function load() {
  try {
    const response = await fetch('/api/me/referral', { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error();
    const data = await response.json();
    code = data.code;
    codeEl.textContent = code;
    totalEl.textContent = data.referrals;
  } catch { codeEl.textContent = 'Faça login novamente'; }
}

copyButton.addEventListener('click', async () => {
  if (!code) return;
  await navigator.clipboard?.writeText(`${location.origin}/public/associate-signup.html?ref=${code}`);
  copyButton.textContent = 'Link copiado ✓';
  setTimeout(() => copyButton.textContent = 'Copiar código', 1600);
});

load();
