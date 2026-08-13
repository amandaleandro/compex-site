(() => {
  const token = sessionStorage.getItem('compex-token') || '';
  if (!token || sessionStorage.getItem(`birthday-${new Date().getFullYear()}`)) return;
  fetch('/api/me/profile', { headers: { Authorization: `Bearer ${token}` } })
    .then(response => response.ok ? response.json() : null)
    .then(profile => {
      if (!profile?.birthDate) return;
      const birthday = new Date(profile.birthDate);
      const today = new Date();
      if (birthday.getUTCMonth() !== today.getMonth() || birthday.getUTCDate() !== today.getDate()) return;
      const name = profile.socialName || profile.nickname || profile.name || 'associado';
      const overlay = document.createElement('div');
      overlay.className = 'birthday-overlay';
      overlay.innerHTML = `<div class="birthday-confetti"></div><div class="birthday-card"><button class="birthday-close" aria-label="Fechar">×</button><div class="birthday-balloons"><i>🎈</i><i>🎈</i><i>🎈</i></div><div class="birthday-cake">🎂</div><p class="eyebrow">HOJE É SEU DIA</p><h2>Feliz aniversário,<br><em>${name}!</em></h2><p>Que seu novo ciclo venha cheio de conquistas, encontros e momentos incríveis na COMPEX.</p><button class="birthday-action">Obrigado! ✨</button></div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('.birthday-close').onclick = () => overlay.remove();
      overlay.querySelector('.birthday-action').onclick = () => overlay.remove();
      sessionStorage.setItem(`birthday-${today.getFullYear()}`, 'shown');
    }).catch(() => {});
})();
