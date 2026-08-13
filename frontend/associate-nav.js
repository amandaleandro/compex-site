/* Mantém o conjunto de telas do associado separado da gestão. */
document.querySelectorAll('a[href="portal.html"]').forEach(link => { link.href = 'associate-portal.html'; });
if (document.querySelector('.member-topbar')) document.querySelectorAll('a[href="beneficios.html"]').forEach(link => { link.href = 'beneficios-associado.html'; });

// Atletas avulsos (sem mensalidade de sócio) ganham um link extra pras cobranças PIX por treino/jogo.
(async function () {
  const nav = document.querySelector('.member-topbar nav');
  if (!nav) return;
  const token = sessionStorage.getItem('compex-token');
  try {
    const response = await fetch('/api/me/profile', { headers: { Authorization: `Bearer ${token || ''}` } });
    if (!response.ok) return;
    const profile = await response.json();
    if (profile.membershipKind === 'AVULSO' && !nav.querySelector('a[href="cobrancas.html"]')) {
      const link = document.createElement('a');
      link.href = 'cobrancas.html';
      link.textContent = 'Cobranças';
      if (location.pathname.endsWith('cobrancas.html')) link.className = 'active';
      nav.appendChild(link);
    }

    // Quem está inscrito em alguma modalidade recebe convocações de treino/jogo pra confirmar presença.
    const enrollmentsResponse = await fetch('/api/me/enrollments', { headers: { Authorization: `Bearer ${token || ''}` } });
    if (enrollmentsResponse.ok) {
      const enrollments = await enrollmentsResponse.json();
      if (enrollments.length && !nav.querySelector('a[href="convocacoes.html"]')) {
        const link = document.createElement('a');
        link.href = 'convocacoes.html';
        link.textContent = 'Convocações';
        if (location.pathname.endsWith('convocacoes.html')) link.className = 'active';
        nav.appendChild(link);
      }
    }
  } catch { /* silencioso — link só é um extra de navegação */ }
})();
