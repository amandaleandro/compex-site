const staticNotifications = [
  { icon: '◷', title: 'Intercomp 2026 está chegando', text: 'Confira as informações do evento e acesse o BoraFest para participar.', time: 'Hoje', type: 'Eventos', unread: true },
  { icon: '⚽', title: 'Treino de futsal hoje', text: 'O treino acontece às 19h30 na Quadra 2. Não esqueça sua carteirinha.', time: 'Há 2 horas', type: 'Esportes', unread: true },
  { icon: '✦', title: 'Novo benefício disponível', text: 'Você ganhou 15% de desconto na Arena Sport. Aproveite seu código.', time: 'Ontem', type: 'Benefícios', unread: false }
];

const list = document.querySelector('#list');
let allNotifications = [...staticNotifications];

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

loadOrdersNotifications();
