function authHeaders() {
  const token = sessionStorage.getItem('compex-token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` };
}

(async function () {
  const response = await fetch('/api/auth/me', { headers: authHeaders() });
  if (!response.ok) { window.location.href = '/public/gestao-login.html'; return; }
  const { user } = await response.json();
  document.querySelectorAll('[data-user-name]').forEach(el => { el.textContent = user.name; });
  if (user.member) {
    document.querySelector('#already-member').hidden = false;
    document.querySelector('#become-form').hidden = true;
    document.querySelector('#member-status').textContent = user.member.status === 'active' ? 'ativa' : 'pendente de pagamento';
    if (user.member.status !== 'active') document.querySelector('#go-pay').hidden = false;
  }
})();

document.querySelector('#become-form').onsubmit = async e => {
  e.preventDefault();
  const error = document.querySelector('#error');
  const payload = {
    course: document.querySelector('#course').value,
    plan: document.querySelector('#plan').value,
    socialName: document.querySelector('#social-name').value,
    nickname: document.querySelector('#nickname').value,
    sex: document.querySelector('#sex').value,
    shirtSize: document.querySelector('#shirt-size').value,
    instagram: document.querySelector('#instagram').value,
  };
  const response = await fetch('/api/me/become-member', { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
  const result = await response.json();
  if (!response.ok) { error.textContent = result.error || 'Não foi possível cadastrar.'; return; }
  window.location.href = '/associado/mensalidade.html';
};
