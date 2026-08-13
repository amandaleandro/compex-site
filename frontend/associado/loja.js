const token = sessionStorage.getItem('compex-token');
const grid = document.querySelector('#product-grid');
const cartBar = document.querySelector('#cart-bar');
const cartSummary = document.querySelector('#cart-summary');
const checkoutButton = document.querySelector('#checkout-button');
const checkoutNote = document.querySelector('#checkout-note');
const cart = {};
const money = cents => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const productIcon = { 'Vestuário': '▤', 'Eventos': '▣' };

function renderCart() {
  const quantity = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
  cartBar.hidden = quantity === 0;
  cartSummary.textContent = `${quantity} ite${quantity === 1 ? 'm' : 'ns'} no carrinho`;
}

let fetchedProducts = [];
let pendingProductForOptions = null;

async function load() {
  try {
    const response = await fetch('/api/products');
    fetchedProducts = await response.json();
    grid.innerHTML = fetchedProducts.map(product => {
      const isEncomenda = product.type === 'ENCOMENDA';
      const outOfStock = !isEncomenda && product.stock <= 0;
      
      const badge = isEncomenda
        ? `<span style="background:#e2e8f0;color:#4a5568;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700">Sob Encomenda</span>`
        : (outOfStock 
            ? `<span style="background:#fed7d7;color:#9b2c2c;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700">Esgotado</span>` 
            : `<span style="background:#c6f6d5;color:#22543d;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700">Pronta Entrega (${product.stock} un.)</span>`);

      const media = product.imageUrl
        ? `<img src="${product.imageUrl}" alt="${product.name}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`
        : `<div class="thumb" style="width:100%;height:100%;display:grid;place-items:center;font-size:36px;background:#edf2f7;border-radius:8px">${productIcon[product.category] || '🛍️'}</div>`;

      const optionsBadge = (product.allowSize || product.allowCustomization)
        ? `<small style="color:#2b6cb0;font-weight:600;display:block">✨ Personalização / Tamanho disponível</small>`
        : '';

      return `
        <article class="product-card" style="display:flex;flex-direction:column;gap:8px">
          <div style="height:160px;width:100%;position:relative;overflow:hidden">
            ${media}
            <div style="position:absolute;top:8px;left:8px;z-index:2">
              ${badge}
            </div>
          </div>
          <b style="font-size:15px;margin-top:4px">${product.name}</b>
          ${optionsBadge}
          <p style="color:#718096;font-size:12px;margin:0;flex:1">${product.description || ''}</p>
          <span class="price" style="font-weight:800;font-size:16px;color:#2d3748">${money(product.priceCents)}</span>
          <button data-id="${product.id}" data-name="${product.name}" data-price="${product.priceCents}" ${outOfStock ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
            ${outOfStock ? 'Indisponível' : 'Adicionar ao carrinho'}
          </button>
        </article>`;
    }).join('') || '<p class="empty-note">Nenhum produto disponível no momento.</p>';
  } catch { grid.innerHTML = '<p class="empty-note">Não foi possível carregar a loja.</p>'; }
}

grid.addEventListener('click', event => {
  const button = event.target.closest('button[data-id]');
  if (!button) return;
  const { id } = button.dataset;
  const product = fetchedProducts.find(p => p.id === id);
  if (!product) return;

  if (product.allowSize || product.allowCustomization) {
    pendingProductForOptions = product;
    document.querySelector('#opt-product-title').textContent = `Opções: ${product.name}`;
    document.querySelector('#opt-product-id').value = product.id;

    const sizeContainer = document.querySelector('#field-size-container');
    const customContainer = document.querySelector('#field-customization-container');

    sizeContainer.style.display = product.allowSize ? 'block' : 'none';
    customContainer.style.display = product.allowCustomization ? 'block' : 'none';

    document.querySelector('#opt-custom-name').value = '';
    document.querySelector('#opt-custom-number').value = '';

    document.querySelector('#modal-product-options').classList.add('open');
  } else {
    addToCart(id, null, null, null);
    button.textContent = `✓ Adicionado (${cart[id].quantity})`;
    setTimeout(() => { if (document.body.contains(button)) button.textContent = 'Adicionar ao carrinho'; }, 1200);
  }
});

function addToCart(productId, size, customizationName, customizationNumber) {
  const key = `${productId}_${size || 'def'}_${customizationName || ''}_${customizationNumber || ''}`;
  if (cart[key]) {
    cart[key].quantity += 1;
  } else {
    cart[key] = {
      productId,
      quantity: 1,
      size: size || null,
      customizationName: customizationName || null,
      customizationNumber: customizationNumber || null
    };
  }
  renderCart();
}

if (document.querySelector('#close-options')) {
  document.querySelector('#close-options').onclick = () => document.querySelector('#modal-product-options').classList.remove('open');
}

if (document.querySelector('#form-product-options')) {
  document.querySelector('#form-product-options').onsubmit = e => {
    e.preventDefault();
    if (!pendingProductForOptions) return;
    const productId = pendingProductForOptions.id;
    const size = pendingProductForOptions.allowSize ? document.querySelector('#opt-size').value : null;
    const customName = pendingProductForOptions.allowCustomization ? document.querySelector('#opt-custom-name').value.trim() : null;
    const customNumber = pendingProductForOptions.allowCustomization ? document.querySelector('#opt-custom-number').value.trim() : null;

    addToCart(productId, size, customName, customNumber);
    document.querySelector('#modal-product-options').classList.remove('open');
    pendingProductForOptions = null;
  };
}

checkoutButton.addEventListener('click', async () => {
  checkoutButton.disabled = true;
  checkoutButton.textContent = 'Gerando link de pagamento…';
  try {
    const response = await fetch('/api/checkout/loja', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ items: Object.values(cart) })
    });
    const data = await response.json();
    if (data.initPoint) return window.location.href = data.initPoint;
    checkoutNote.style.display = 'block';
    checkoutNote.textContent = data.warning || data.error || 'Não foi possível finalizar o pedido.';
  } catch {
    checkoutNote.style.display = 'block';
    checkoutNote.textContent = 'Inicie o servidor da COMPEX para finalizar sua compra.';
  } finally {
    checkoutButton.disabled = false;
    checkoutButton.textContent = 'Finalizar pedido →';
  }
});

  loadMyOrders();
}

async function loadMyOrders() {
  const container = document.querySelector('#my-orders-list');
  if (!container) return;
  try {
    const res = await fetch('/api/me/orders', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return container.innerHTML = '<p class="empty-note">Não foi possível carregar seus pedidos.</p>';
    const orders = await res.json();
    if (!orders.length) return container.innerHTML = '<p class="empty-note">Você ainda não realizou nenhum pedido.</p>';
    
    const statusText = {
      PENDING: '⏳ Pagamento Pendente',
      PAID: '💰 Pago',
      PREPARING: '🚚 Em Produção / Aguardando',
      READY_FOR_PICKUP: '📦 Disponível para Retirada!',
      DELIVERED: '✅ Entregue',
      CANCELED: '❌ Cancelado'
    };

    container.innerHTML = orders.map(o => {
      const items = o.items.map(i => {
        let details = `${i.quantity}x ${i.product.name}`;
        if (i.size) details += ` (Tam: ${i.size})`;
        if (i.customizationName || i.customizationNumber) {
          details += ` [✍️ ${i.customizationName || ''} ${i.customizationNumber ? '#' + i.customizationNumber : ''}]`;
        }
        return details;
      }).join(', ');
      const dateStr = o.estimatedDelivery ? new Date(o.estimatedDelivery).toLocaleDateString('pt-BR') : 'A definir';
      return `
        <div style="background:#fff;border:1px solid #e2e8f0;padding:12px 16px;border-radius:8px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
          <div>
            <b style="font-size:14px">${items}</b>
            <small style="display:block;color:#718096;margin-top:2px">Realizado em ${new Date(o.createdAt).toLocaleDateString('pt-BR')} · Total: ${money(o.totalCents)}</small>
            ${o.status === 'READY_FOR_PICKUP' ? '<p style="color:#276749;font-weight:700;font-size:12px;margin:4px 0 0">🎉 Apresente seu QR Code na carteirinha digital para retirar!</p>' : ''}
          </div>
          <div style="text-align:right">
            <span style="font-weight:700;font-size:13px;display:block">${statusText[o.status] || o.status}</span>
            <small style="color:#718096;display:block;margin-top:2px">Previsão: <b>${dateStr}</b></small>
          </div>
        </div>
      `;
    }).join('');
  } catch {
    container.innerHTML = '<p class="empty-note">Erro ao carregar pedidos.</p>';
  }
}

load();
