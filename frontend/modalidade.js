const token = sessionStorage.getItem('compex-token');
const grid = document.querySelector('#team-grid');
const sportIcon = { Futsal: '◉', Vôlei: '♢', Peteca: '⚔', 'E-sports': '⌁' };

async function load() {
  try {
    const [teamsRes, enrollmentsRes] = await Promise.all([
      fetch('/api/teams'),
      fetch('/api/me/enrollments', { headers: { Authorization: `Bearer ${token}` } })
    ]);
    const teams = await teamsRes.json();
    const enrollments = enrollmentsRes.ok ? await enrollmentsRes.json() : [];
    const enrolledIds = new Set(enrollments.map(item => item.teamId));
    grid.innerHTML = teams.map(team => `
      <article class="team-card">
        <span class="icon purple" style="width:44px;height:44px;border-radius:10px;display:grid;place-items:center;font-size:20px;color:#fff">${sportIcon[team.sport] || '⚔'}</span>
        <h3>${team.name}</h3>
        <p>${team.description || ''}</p>
        <span class="schedule">${team.trainingDay || ''}</span>
        <button class="${enrolledIds.has(team.id) ? 'enrolled' : 'enroll'}" data-team="${team.id}" ${enrolledIds.has(team.id) ? 'disabled' : ''}>${enrolledIds.has(team.id) ? '✓ Inscrito' : 'Quero participar'}</button>
      </article>`).join('') || '<p class="empty-note">Nenhuma modalidade disponível no momento.</p>';
  } catch { grid.innerHTML = '<p class="empty-note">Não foi possível carregar as modalidades.</p>'; }
}

grid.addEventListener('click', async event => {
  const button = event.target.closest('button.enroll');
  if (!button) return;
  button.disabled = true;
  button.textContent = 'Enviando…';
  try {
    const response = await fetch(`/api/teams/${button.dataset.team}/enroll`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error();
    button.textContent = '✓ Inscrito';
    button.className = 'enrolled';
  } catch { button.disabled = false; button.textContent = 'Quero participar'; }
});

load();
