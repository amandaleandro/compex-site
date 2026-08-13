(() => {
  const buttons = [...document.querySelectorAll('.filters button')];
  const cards = [...document.querySelectorAll('.event-list article')];
  buttons.forEach(button => button.addEventListener('click', () => {
    buttons.forEach(item => item.classList.toggle('active', item === button));
    const filter = button.textContent.trim().toLowerCase();
    cards.forEach(card => {
      const type = card.querySelector('em')?.textContent.trim().toLowerCase() || '';
      card.hidden = filter !== 'todos' && !type.includes(filter.replace('ções', 'ção').replace('treinos', 'treino').replace('encontros', 'encontro'));
    });
  }));
})();
