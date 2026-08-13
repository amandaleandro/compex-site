const toDate = (date) => date ? new Date(date.includes('T') ? date : `${date}T12:00:00`) : null;

const list = document.querySelector('#list');
let allNotifications = [];

async function loadEventNotifications() {
  try {
    const res = await fetch('/api/events');
    if (!res.ok) return;
    const events = await res.json();
    const now = Date.now();
    events
      .filter(e => e.published !== false)
      .filter(e => { const d = toDate(e.date); return d && !isNaN(d) && d.getTime() >= now; })
      .sort((a, b) => toDate(a.date) - toDate(b.date))
      .slice(0, 3)
      .forEach(e => {
        allNotifications.push({
          icon: e.type === 'Treino' ? '⚽' : '◷',
          title: e.name,
          text: `${e.location || 'Local a definir'}${e.time ? ' · ' + e.time : ''}`,
          time: toDate(e.date).toLocaleDateString('pt-BR'),
          type: 'Eventos',
          unread: false
        });
      });
  } catch {}
}

async function loadBenefitNotifications() {
  try {
    const res = await fetch('/api/benefits');
    if (!res.ok) return;
    const benefits = await res.json();
    benefits.slice(0, 2).forEach(b => {
      allNotifications.push({
        icon: b.icon || '✦',
        title: `Benefício disponível: ${b.name}`,
        text: b.description || 'Confira as condições na página de benefícios.',
        time: 'Disponível',
        type: 'Benefícios',
        unread: false
      });
    });
  } catch {}
}

async function loadOrdersNotifications() {
  const token = sessionStorage.getItem('compex-token');
  try {
    const res = await fetch('/api/me/orders', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const orders = await res.json();
      orders.forEach(o => {
        if (o.status === 'READY_FOR_PICKUP') {
          const itemNames = o.items.map(i => `${i.quantity}x ${i.product.name}`).join(', ');
          allNotifications.unshift({
            icon: '📦',
            title: 'Seu produto está pronto para retirada! 🎉',
            text: `Seu pedido (${itemNames}) já chegou. Apresente o QR Code da sua carteirinha ao diretor para retirar.`,
            time: o.notifiedAt ? new Date(o.notifiedAt).toLocaleDateString('pt-BR') : 'Hoje',
            type: 'Loja',
            unread: true
          });
        } else if (o.status === 'PREPARING' && o.estimatedDelivery) {
          const dateStr = new Date(o.estimatedDelivery).toLocaleDateString('pt-BR');
          const itemNames = o.items.map(i => i.product.name).join(', ');
          allNotifications.unshift({
            icon: '🚚',
            title: 'Encomenda em Produção',
            text: `Seu pedido (${itemNames}) está sendo preparado. Previsão de chegada: ${dateStr}.`,
            time: new Date(o.createdAt).toLocaleDateString('pt-BR'),
            type: 'Loja',
            unread: false
          });
        }
      });
    }
  } catch {}
  render();
}

function render(filter = 'all') {
  list.innerHTML = allNotifications.filter(n => filter === 'all' || (filter === 'unread' && n.unread) || n.type === filter).map(n => `
    <article class="notification ${n.unread ? 'unread' : 'read'}" data-type="${n.type}">
      <span class="notification-icon">${n.icon}</span>
      <div class="notification-body">
        <b>${n.title}</b>
        <small>${n.text}</small>
      </div>
      <time>${n.time}</time>
      <i class="dot"></i>
    </article>`).join('') || '<p class="empty-note" style="padding:20px;text-align:center;color:#a0aec0">Nenhuma notificação encontrada.</p>';
}

document.querySelectorAll('.filters button').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.filters button').forEach(item => item.classList.toggle('active', item === button));
  render(button.dataset.filter);
}));

document.querySelector('#read-all').addEventListener('click', () => {
  allNotifications.forEach(n => n.unread = false);
  render();
  document.querySelector('#read-all').textContent = 'Tudo lido ✓';
});

Promise.all([loadEventNotifications(), loadBenefitNotifications()]).then(() => loadOrdersNotifications());
