function authHeaders() {
  const token = sessionStorage.getItem('compex-token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` };
}
const money = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

let currentProducts = [];

async function loadProducts() {
  const response = await fetch('/api/store-products', { headers: authHeaders() });
  if (response.status === 401) { window.location.href = '/public/gestao-login.html'; return []; }
  if (!response.ok) return [];
  return response.json();
}

async function render() {
  const term = document.querySelector('#search').value.toLowerCase();
  currentProducts = await loadProducts();
  const products = currentProducts.filter(p => p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term));
  
  document.querySelector('#metric-total').textContent = currentProducts.length;
  document.querySelector('#metric-active').textContent = currentProducts.filter(p => p.active).length;

  document.querySelector('#list').innerHTML = products.map(p => {
    const isEncomenda = p.type === 'ENCOMENDA';
    const typeTag = isEncomenda
      ? `<span style="background:#edf2f7;color:#4a5568;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">📦 Sob Encomenda</span>`
      : `<span style="background:#e6fffa;color:#234e52;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">⚡ Pronta Entrega (${p.stock} un.)</span>`;
    
    const photo = p.imageUrl
      ? `<img src="${p.imageUrl}" alt="${p.name}" style="width:44px;height:44px;border-radius:8px;object-fit:cover;border:1px solid #e2e8f0">`
      : `<span class="file-icon" style="width:44px;height:44px;display:grid;place-items:center;background:#f7fafc;border-radius:8px;font-size:18px;border:1px solid #e2e8f0">🛍️</span>`;

    return `
      <div class="product-row" style="display:flex;align-items:center;gap:14px;padding:12px 16px;border-bottom:1px solid #edf2f7">
        ${photo}
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px">
            <b style="font-size:15px;color:#1a202c">${p.name}</b>
            ${typeTag}
          </div>
          <small style="color:#718096;display:block;margin-top:2px">${p.category}${p.description ? ' · ' + p.description : ''}</small>
        </div>
        <strong style="font-size:15px;color:#2d3748">${money(p.price)}</strong>
        <button type="button" class="btn btn-ghost edit-product" data-id="${p.id}" style="padding:4px 10px;font-size:12px">Editar</button>
        <label class="active-toggle" style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer">
          <input type="checkbox" class="toggle-active" data-id="${p.id}" ${p.active ? 'checked' : ''}>
          ${p.active ? 'Ativo' : 'Inativo'}
        </label>
        <button type="button" class="remove-product" data-id="${p.id}" title="Remover" style="background:none;border:none;color:#e53e3e;font-size:20px;cursor:pointer;padding:0 8px">&times;</button>
      </div>`;
  }).join('') || '<p class="empty-state" style="padding:24px;text-align:center;color:#a0aec0">Nenhum produto cadastrado ainda.</p>';

  document.querySelectorAll('.edit-product').forEach(btn => {
    btn.onclick = () => {
      const prod = currentProducts.find(p => p.id === btn.dataset.id);
      if (!prod) return;
      document.querySelector('#modal-title').textContent = 'Editar produto';
      document.querySelector('#product-id').value = prod.id;
      document.querySelector('#name').value = prod.name;
      document.querySelector('#category').value = prod.category;
      document.querySelector('#price').value = prod.price;
      document.querySelector('#type').value = prod.type || 'PRONTA_ENTREGA';
      document.querySelector('#stock').value = prod.stock || 0;
      document.querySelector('#allow-size').checked = !!prod.allowSize;
      document.querySelector('#allow-customization').checked = !!prod.allowCustomization;
      document.querySelector('#description').value = prod.description || '';
      document.querySelector('#image-url').value = prod.imageUrl || '';
      
      const preview = document.querySelector('#photo-preview');
      if (prod.imageUrl) preview.innerHTML = `<img src="${prod.imageUrl}" style="width:100%;height:100%;object-fit:cover">`;
      else preview.innerHTML = '📷';

      document.querySelector('#modal').classList.add('open');
    };
  });

  document.querySelectorAll('.remove-product').forEach(btn => btn.onclick = async () => {
    if (!confirm('Remover este produto da loja?')) return;
    await fetch('/api/store-products', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ id: btn.dataset.id }) });
    render();
  });

  document.querySelectorAll('.toggle-active').forEach(input => input.onchange = async () => {
    await fetch('/api/store-products', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ id: input.dataset.id, active: input.checked }) });
    render();
  });
}

// Upload de imagem do produto
const btnUpload = document.querySelector('#btn-upload-photo');
const photoInput = document.querySelector('#photo-input');
if (btnUpload && photoInput) {
  btnUpload.onclick = () => photoInput.click();

  photoInput.onchange = async () => {
    const file = photoInput.files[0];
    if (!file) return;
    btnUpload.disabled = true;
    btnUpload.textContent = 'Enviando...';
    const formData = new FormData();
    formData.append('file', file);
    try {
      const token = sessionStorage.getItem('compex-token');
      const res = await fetch('/api/products/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token || ''}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.url) {
        document.querySelector('#image-url').value = data.url;
        document.querySelector('#photo-preview').innerHTML = `<img src="${data.url}" style="width:100%;height:100%;object-fit:cover">`;
      } else {
        alert(data.error || 'Erro ao enviar a foto');
      }
    } catch {
      alert('Erro de conexão ao enviar imagem.');
    } finally {
      btnUpload.disabled = false;
      btnUpload.textContent = 'Escolher Imagem';
    }
  };
}

const btnNewProduct = document.querySelector('#new-product');
if (btnNewProduct) {
  btnNewProduct.onclick = () => {
    document.querySelector('#modal-title').textContent = 'Novo produto';
    document.querySelector('#product-id').value = '';
    document.querySelector('#form').reset();
    document.querySelector('#allow-size').checked = false;
    document.querySelector('#allow-customization').checked = false;
    document.querySelector('#image-url').value = '';
    document.querySelector('#photo-preview').innerHTML = '📷';
    document.querySelector('#modal').classList.add('open');
  };
}

if (document.querySelector('#close')) {
  document.querySelector('#close').onclick = () => document.querySelector('#modal').classList.remove('open');
}

if (document.querySelector('#search')) {
  document.querySelector('#search').oninput = render;
}

if (document.querySelector('#form')) {
  document.querySelector('#form').onsubmit = async e => {
    e.preventDefault();
    const id = document.querySelector('#product-id').value;
    const payload = {
      id: id || undefined,
      name: document.querySelector('#name').value,
      category: document.querySelector('#category').value,
      price: document.querySelector('#price').value,
      type: document.querySelector('#type').value,
      stock: document.querySelector('#stock').value,
      allowSize: document.querySelector('#allow-size').checked,
      allowCustomization: document.querySelector('#allow-customization').checked,
      description: document.querySelector('#description').value,
      imageUrl: document.querySelector('#image-url').value || null,
    };

    const method = id ? 'PUT' : 'POST';
    await fetch('/api/store-products', { method, headers: authHeaders(), body: JSON.stringify(payload) });
    e.target.reset();
    document.querySelector('#modal').classList.remove('open');
    render();
  };
}

// Lógica das Abas (Catálogo de Produtos vs Pedidos & Encomendas)
const tabProducts = document.querySelector('#tab-btn-products');
const tabOrders = document.querySelector('#tab-btn-orders');
const contentProducts = document.querySelector('#tab-content-products');
const contentOrders = document.querySelector('#tab-content-orders');

if (tabProducts && tabOrders) {
  tabProducts.onclick = () => {
    tabProducts.style.borderBottom = '3px solid #2b6cb0';
    tabProducts.style.color = '#2b6cb0';
    tabOrders.style.borderBottom = 'none';
    tabOrders.style.color = '#718096';
    contentProducts.style.display = 'block';
    contentOrders.style.display = 'none';
  };

  tabOrders.onclick = () => {
    tabOrders.style.borderBottom = '3px solid #2b6cb0';
    tabOrders.style.color = '#2b6cb0';
    tabProducts.style.borderBottom = 'none';
    tabProducts.style.color = '#718096';
    contentProducts.style.display = 'none';
    contentOrders.style.display = 'block';
    renderOrders();
  };
}

// Gestão de Pedidos e Encomendas dentro da Aba Pedidos
let allOrders = [];
let activeOrderForQr = null;

async function loadOrders() {
  const response = await fetch('/api/admin/orders', { headers: authHeaders() });
  if (response.status === 401) { window.location.href = '/public/gestao-login.html'; return []; }
  if (!response.ok) return [];
  return response.json();
}

async function renderOrders() {
  allOrders = await loadOrders();
  const searchInput = document.querySelector('#search-orders');
  const filterSelect = document.querySelector('#filter-status');
  const term = searchInput ? searchInput.value.toLowerCase() : '';
  const statusFilter = filterSelect ? filterSelect.value : 'ALL';

  const filtered = allOrders.filter(o => {
    const matchTerm = o.memberName.toLowerCase().includes(term) ||
      o.memberEmail.toLowerCase().includes(term) ||
      o.items.some(i => i.productName.toLowerCase().includes(term));
    const matchStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchTerm && matchStatus;
  });

  if (document.querySelector('#m-total')) {
    document.querySelector('#m-total').textContent = allOrders.length;
    document.querySelector('#m-preparing').textContent = allOrders.filter(o => o.status === 'PREPARING' || o.status === 'PAID').length;
    document.querySelector('#m-ready').textContent = allOrders.filter(o => o.status === 'READY_FOR_PICKUP').length;
    document.querySelector('#m-delivered').textContent = allOrders.filter(o => o.status === 'DELIVERED').length;
  }

  const statusBadge = {
    PENDING: '<span style="background:#edf2f7;color:#4a5568;padding:4px 8px;border-radius:12px;font-size:12px">⏳ Pendente</span>',
    PAID: '<span style="background:#ebf8ff;color:#2b6cb0;padding:4px 8px;border-radius:12px;font-size:12px">💰 Pago</span>',
    PREPARING: '<span style="background:#feebc8;color:#744210;padding:4px 8px;border-radius:12px;font-size:12px">🚚 Em Produção</span>',
    READY_FOR_PICKUP: '<span style="background:#c6f6d5;color:#22543d;padding:4px 8px;border-radius:12px;font-size:12px">📦 Pronto p/ Retirada</span>',
    DELIVERED: '<span style="background:#e2e8f0;color:#2d3748;padding:4px 8px;border-radius:12px;font-size:12px">✅ Entregue</span>',
    CANCELED: '<span style="background:#fed7d7;color:#9b2c2c;padding:4px 8px;border-radius:12px;font-size:12px">❌ Cancelado</span>',
  };

  const listEl = document.querySelector('#orders-list');
  if (listEl) {
    listEl.innerHTML = filtered.map(o => {
      const dateStr = o.estimatedDelivery ? new Date(o.estimatedDelivery).toLocaleDateString('pt-BR') : 'Sem data definida';
      const itemsHtml = o.items.map(i => {
        const sizeTag = i.size ? `<span style="background:#edf2f7;color:#2d3748;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:700">Tam: ${i.size}</span>` : '';
        const customTag = (i.customizationName || i.customizationNumber)
          ? `<span style="background:#feebc8;color:#744210;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:700">✍️ ${i.customizationName || ''} ${i.customizationNumber ? '#' + i.customizationNumber : ''}</span>`
          : '';

        return `
          <div style="display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap">
            <span style="background:#f7fafc;border:1px solid #e2e8f0;padding:2px 6px;border-radius:4px;font-size:11px">${i.quantity}x</span>
            <b style="font-size:13px">${i.productName}</b>
            ${i.productType === 'ENCOMENDA' ? '<span style="color:#805ad5;font-size:11px;font-weight:600">(Sob Encomenda)</span>' : '<span style="color:#319795;font-size:11px">(Pronta Entrega)</span>'}
            ${sizeTag}
            ${customTag}
          </div>
        `;
      }).join('');

      return `
        <div style="padding:16px;border-bottom:1px solid #edf2f7;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px">
          <div style="flex:1;min-width:260px">
            <div style="display:flex;align-items:center;gap:10px">
              <b style="font-size:16px;color:#1a202c">${o.memberName}</b>
              ${statusBadge[o.status] || o.status}
            </div>
            <small style="color:#718096;display:block;margin-top:2px">${o.memberEmail} · Matrícula/ID: ${o.memberRegistration}</small>
            <div style="margin-top:8px">${itemsHtml}</div>
          </div>

          <div style="text-align:right;min-width:180px">
            <strong style="font-size:16px;color:#2d3748;display:block">${money(o.totalPrice)}</strong>
            <small style="color:#718096;display:block;margin-top:2px">Previsão: <b>${dateStr}</b></small>
            ${o.deliveredAt ? `<small style="color:#38a169;display:block;margin-top:2px">Entregue por ${o.deliveredBy || 'Diretoria'} em ${new Date(o.deliveredAt).toLocaleDateString('pt-BR')}</small>` : ''}
          </div>

          <div style="display:flex;gap:8px;align-items:center">
            <button type="button" class="btn btn-ghost set-date-btn" data-id="${o.id}" data-date="${o.estimatedDelivery ? o.estimatedDelivery.slice(0, 10) : ''}" style="padding:6px 12px;font-size:12px">
              📅 Previsão
            </button>
            <button type="button" class="btn btn-ghost notify-btn" data-id="${o.id}" style="padding:6px 12px;font-size:12px;color:#2b6cb0" ${o.status === 'DELIVERED' ? 'disabled' : ''}>
              🔔 Notificar Chegada
            </button>
            <button type="button" class="btn btn-primary deliver-btn" data-id="${o.id}" style="padding:6px 12px;font-size:12px" ${o.status === 'DELIVERED' ? 'disabled style="opacity:0.5"' : ''}>
              ${o.status === 'DELIVERED' ? '✓ Entregue' : '📦 Validar QR / Entregar'}
            </button>
          </div>
        </div>
      `;
    }).join('') || '<p style="padding:24px;text-align:center;color:#a0aec0">Nenhum pedido encontrado.</p>';
  }

  // Event Listeners dos botões de pedidos
  document.querySelectorAll('.set-date-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelector('#date-order-id').value = btn.dataset.id;
      document.querySelector('#estimated-date').value = btn.dataset.date || '';
      document.querySelector('#modal-date').classList.add('open');
    };
  });

  document.querySelectorAll('.notify-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Enviar notificação e e-mail avisando que o produto chegou e está disponível para retirada?')) return;
      btn.disabled = true;
      btn.textContent = 'Enviando...';
      const res = await fetch('/api/admin/orders/notify', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ orderId: btn.dataset.id })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Notificação enviada com sucesso para ${data.emailSentTo}!`);
        renderOrders();
      } else {
        alert(data.error || 'Erro ao enviar notificação.');
      }
    };
  });

  document.querySelectorAll('.deliver-btn').forEach(btn => {
    btn.onclick = () => {
      if (btn.disabled) return;
      activeOrderForQr = allOrders.find(o => o.id === btn.dataset.id);
      document.querySelector('#modal-qr').classList.add('open');
      startQrScanner();
    };
  });
}

// Modal Data Prevista
if (document.querySelector('#close-date')) {
  document.querySelector('#close-date').onclick = () => document.querySelector('#modal-date').classList.remove('open');
  document.querySelector('#form-date').onsubmit = async e => {
    e.preventDefault();
    const orderId = document.querySelector('#date-order-id').value;
    const estimatedDelivery = document.querySelector('#estimated-date').value;
    
    await fetch('/api/admin/orders/update-delivery', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ orderId, estimatedDelivery })
    });

    document.querySelector('#modal-date').classList.remove('open');
    renderOrders();
  };
}

// Modal QR Code e Scanner
let videoStream = null;
let scanAnimation = null;

function startQrScanner() {
  const video = document.querySelector('#qr-video');
  const canvas = document.querySelector('#qr-canvas');
  if (!video || !canvas) return;
  const ctx = canvas.getContext('2d');

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(stream => {
      videoStream = stream;
      video.srcObject = stream;
      video.setAttribute('playsinline', true);
      video.play();
      
      const tick = () => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.height = video.videoHeight;
          canvas.width = video.videoWidth;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          if (window.jsQR) {
            const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
            if (code && code.data) {
              stopQrScanner();
              processDeliveryWithCode(code.data);
              return;
            }
          }
        }
        scanAnimation = requestAnimationFrame(tick);
      };
      scanAnimation = requestAnimationFrame(tick);
    }).catch(err => {
      console.warn('Câmera não disponível:', err);
    });
  }
}

function stopQrScanner() {
  if (scanAnimation) cancelAnimationFrame(scanAnimation);
  if (videoStream) {
    videoStream.getTracks().forEach(t => t.stop());
    videoStream = null;
  }
}

if (document.querySelector('#close-qr')) {
  document.querySelector('#close-qr').onclick = () => {
    stopQrScanner();
    document.querySelector('#modal-qr').classList.remove('open');
  };
}

if (document.querySelector('#btn-manual-deliver')) {
  document.querySelector('#btn-manual-deliver').onclick = () => {
    const code = document.querySelector('#manual-qr-input').value;
    if (!code) return alert('Digite a matrícula ou o código do associado.');
    processDeliveryWithCode(code);
  };
}

async function processDeliveryWithCode(qrCode) {
  if (!activeOrderForQr) return;
  const res = await fetch('/api/admin/orders/deliver', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ orderId: activeOrderForQr.id, qrCode })
  });

  const data = await res.json();
  if (res.ok) {
    alert(`Entrega realizada e vinculada com sucesso a ${activeOrderForQr.memberName}!`);
    stopQrScanner();
    document.querySelector('#modal-qr').classList.remove('open');
    renderOrders();
  } else {
    if (confirm(`${data.error}\n\nDeseja forçar a entrega manualmente mesmo sem validação de QR Code?`)) {
      const forceRes = await fetch('/api/admin/orders/deliver', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ orderId: activeOrderForQr.id, forceDeliver: true })
      });
      if (forceRes.ok) {
        alert('Entrega forçada com sucesso!');
        stopQrScanner();
        document.querySelector('#modal-qr').classList.remove('open');
        renderOrders();
      }
    }
  }
}

if (document.querySelector('#btn-scan-qr')) {
  document.querySelector('#btn-scan-qr').onclick = () => {
    activeOrderForQr = null;
    document.querySelector('#modal-qr').classList.add('open');
    startQrScanner();
  };
}

if (document.querySelector('#search-orders')) document.querySelector('#search-orders').oninput = renderOrders;
if (document.querySelector('#filter-status')) document.querySelector('#filter-status').onchange = renderOrders;
