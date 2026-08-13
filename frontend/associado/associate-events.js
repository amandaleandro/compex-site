(() => {
  const toDate = (date) => date ? new Date(date.includes('T') ? date : `${date}T12:00:00`) : null;
  const monthLabel = (date) => { const d = toDate(date); return d && !isNaN(d) ? d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase() : '---'; };
  const dayLabel = (date) => { const d = toDate(date); return d && !isNaN(d) ? d.getDate() : '--'; };

  const list = document.querySelector('.event-list');
  const buttons = [...document.querySelectorAll('.filters button')];
  if (!list) return;

  function applyFilter(filter) {
    const cards = [...list.querySelectorAll('article')];
    cards.forEach(card => {
      const type = card.querySelector('em')?.textContent.trim().toLowerCase() || '';
      card.hidden = filter !== 'todos' && !type.includes(filter.replace('ções', 'ção').replace('treinos', 'treino').replace('encontros', 'encontro'));
    });
  }

  buttons.forEach(button => button.addEventListener('click', () => {
    buttons.forEach(item => item.classList.toggle('active', item === button));
    applyFilter(button.textContent.trim().toLowerCase());
  }));

  async function loadEvents() {
    let events = [];
    try {
      const res = await fetch('/api/events');
      if (res.ok) events = await res.json();
    } catch (e) { events = []; }

    const now = Date.now();
    const upcoming = events
      .filter(e => e.published !== false)
      .filter(e => { const d = toDate(e.date); return d && !isNaN(d) && d.getTime() >= now; })
      .sort((a, b) => toDate(a.date) - toDate(b.date));

    list.innerHTML = upcoming.length ? upcoming.map(e => `
      <article${e.type === 'Treino' ? ' class="training-row"' : ''}>
        <strong>${dayLabel(e.date)}<small>${monthLabel(e.date)}</small></strong>
        <div><b>${e.name}</b><span>◷ &nbsp; ${e.description || 'Confira os detalhes'}${e.time ? ' · ' + e.time : ''}</span><small>⌖ &nbsp; ${e.location || 'Local a definir'}</small></div>
        <em${e.type === 'Treino' ? ' class="training"' : ''}>${(e.type || 'Evento').toUpperCase()}</em>
        <a href="/public/events-public.html">Detalhes <span>→</span></a>
      </article>`).join('') : '<p class="empty-note" style="padding:20px;text-align:center;color:#a0aec0">Nenhum evento cadastrado no momento.</p>';

    applyFilter('todos');
  }

  loadEvents();
})();
