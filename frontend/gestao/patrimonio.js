function authHeaders() {
  const token = sessionStorage.getItem('compex-token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` };
}
const conditionLabel = { OTIMO: 'Ótimo', BOM: 'Bom', REGULAR: 'Regular', RUIM: 'Ruim' };
const genderLabel = { MASCULINO: 'Masculino', FEMININO: 'Feminino', MISTA: 'Misto' };

let currentAssets = [];
let currentLoans = [];
let isDrawing = false;
let canvas, ctx;

async function loadAssets() {
  try {
    const response = await fetch('/api/assets', { headers: authHeaders() });
    if (response.status === 401) { window.location.href = '/public/gestao-login.html'; return []; }
    if (!response.ok) return [];
    return await response.json();
  } catch (err) {
    console.error('Erro ao carregar patrimônio:', err);
    return [];
  }
}

async function loadLoans() {
  try {
    const response = await fetch('/api/asset-loans', { headers: authHeaders() });
    if (!response.ok) return [];
    return await response.json();
  } catch (err) {
    console.error('Erro ao carregar empréstimos:', err);
    return [];
  }
}

async function render() {
  const term = document.querySelector('#search').value.toLowerCase().trim();
  currentAssets = await loadAssets();
  const assets = currentAssets.filter(a =>
    (a.name || '').toLowerCase().includes(term) ||
    (a.category || '').toLowerCase().includes(term) ||
    (a.sport || '').toLowerCase().includes(term) ||
    (a.location || '').toLowerCase().includes(term)
  );

  document.querySelector('#metric-total').textContent = currentAssets.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
  document.querySelector('#metric-items').textContent = currentAssets.length;
  document.querySelector('#metric-attention').textContent = currentAssets.filter(a => a.condition === 'REGULAR' || a.condition === 'RUIM').length;

  const listEl = document.querySelector('#list');
  if (assets.length === 0) {
    listEl.innerHTML = '<p class="empty-state">Nenhum item cadastrado ainda.</p>';
  } else {
    listEl.innerHTML = assets.map(a => {
      const sportGenderInfo = [a.sport, genderLabel[a.gender] || a.gender].filter(Boolean).join(' · ');
      const subtitleParts = [a.category, sportGenderInfo, a.location, a.notes].filter(Boolean).join(' · ');
      return `
      <div class="asset-row">
        <span class="file-icon">▨</span>
        <div>
          <b>${escapeHtml(a.name)}</b>
          <small>${escapeHtml(subtitleParts)}</small>
        </div>
        <span class="badge ${a.condition === 'OTIMO' ? 'badge-active' : a.condition === 'BOM' ? 'badge-neutral' : a.condition === 'REGULAR' ? 'badge-warning' : 'badge-danger'}">
          ${conditionLabel[a.condition] || a.condition}
        </span>
        <strong>${a.quantity}×</strong>
        <div class="asset-actions">
          <button type="button" class="edit-asset" data-id="${a.id}" title="Editar item">✎</button>
          <button type="button" class="remove-asset" data-id="${a.id}" title="Remover item">×</button>
        </div>
      </div>`;
    }).join('');
  }

  document.querySelectorAll('.edit-asset').forEach(btn => {
    btn.onclick = () => openEditModal(btn.dataset.id);
  });

  document.querySelectorAll('.remove-asset').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Remover este item do patrimônio?')) return;
      const res = await fetch('/api/assets', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ id: btn.dataset.id }) });
      if (res.ok) render();
      else alert('Erro ao remover o item.');
    };
  });

  renderLoans();
}

async function renderLoans() {
  const term = (document.querySelector('#search-loans')?.value || '').toLowerCase().trim();
  currentLoans = await loadLoans();
  const loans = currentLoans.filter(l =>
    (l.borrowerName || '').toLowerCase().includes(term) ||
    (l.asset?.name || '').toLowerCase().includes(term) ||
    (l.status || '').toLowerCase().includes(term)
  );

  const listEl = document.querySelector('#loans-list');
  if (!listEl) return;

  if (loans.length === 0) {
    listEl.innerHTML = '<p class="empty-state">Nenhum empréstimo ou termo registrado.</p>';
    return;
  }

  listEl.innerHTML = loans.map(l => {
    const isPending = l.status === 'EMPRESTADO';
    const loanDateStr = new Date(l.loanDate).toLocaleDateString('pt-BR');
    const returnDateStr = l.expectedReturn ? new Date(l.expectedReturn).toLocaleDateString('pt-BR') : 'Sem data';
    return `
    <div class="asset-row" style="align-items:flex-start">
      <span class="file-icon" style="color:var(--blue)">📄</span>
      <div>
        <b>${escapeHtml(l.borrowerName)} (${l.quantity}× ${escapeHtml(l.asset?.name || 'Item')})</b>
        <small>Saída: ${loanDateStr} · Previsão devolução: ${returnDateStr} ${l.borrowerPhone ? ' · ' + escapeHtml(l.borrowerPhone) : ''}</small>
        ${l.termDocumentUrl ? `<div style="margin-top:4px"><a href="${l.termDocumentUrl}" target="_blank" style="color:var(--blue);font-size:11px;font-weight:600;text-decoration:none">Ver Termo Salvo (JSON/Doc) ↗</a></div>` : ''}
      </div>
      <span class="badge ${isPending ? 'badge-warning' : 'badge-active'}">
        ${isPending ? 'Emprestado' : 'Devolvido'}
      </span>
      <div class="asset-actions">
        ${isPending ? `<button type="button" class="btn btn-ghost btn-sm return-loan" data-id="${l.id}">Devolver</button>` : `<span style="font-size:11px;color:var(--muted)">Concluído</span>`}
      </div>
    </div>`;
  }).join('');

  document.querySelectorAll('.return-loan').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Marcar este item como devolvido?')) return;
      const res = await fetch('/api/asset-loans', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ id: btn.dataset.id, status: 'DEVOLVIDO' })
      });
      if (res.ok) renderLoans();
      else alert('Erro ao registrar devolução.');
    };
  });
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// Alternar abas
document.querySelector('#tab-inventory').onclick = () => {
  document.querySelector('#tab-inventory').classList.add('active');
  document.querySelector('#tab-inventory').style.color = 'var(--ink)';
  document.querySelector('#tab-loans').classList.remove('active');
  document.querySelector('#tab-loans').style.color = 'var(--muted)';
  document.querySelector('#section-inventory').style.display = 'block';
  document.querySelector('#section-loans').style.display = 'none';
};

document.querySelector('#tab-loans').onclick = () => {
  document.querySelector('#tab-loans').classList.add('active');
  document.querySelector('#tab-loans').style.color = 'var(--ink)';
  document.querySelector('#tab-inventory').classList.remove('active');
  document.querySelector('#tab-inventory').style.color = 'var(--muted)';
  document.querySelector('#section-loans').style.display = 'block';
  document.querySelector('#section-inventory').style.display = 'none';
  renderLoans();
};

// Modais Inventário
function openNewModal() {
  document.querySelector('#asset-id').value = '';
  document.querySelector('#modal-title').textContent = 'Novo item';
  document.querySelector('#submit-btn').textContent = 'Cadastrar';
  document.querySelector('#form').reset();
  document.querySelector('#quantity').value = '1';
  document.querySelector('#condition').value = 'BOM';
  document.querySelector('#sport').value = '';
  document.querySelector('#gender').value = '';
  document.querySelector('#modal').classList.add('open');
}

function openEditModal(id) {
  const asset = currentAssets.find(a => a.id === id);
  if (!asset) return;

  document.querySelector('#asset-id').value = asset.id;
  document.querySelector('#modal-title').textContent = 'Editar item';
  document.querySelector('#submit-btn').textContent = 'Salvar alterações';
  document.querySelector('#name').value = asset.name || '';
  document.querySelector('#category').value = asset.category || '';
  document.querySelector('#quantity').value = asset.quantity || 1;
  document.querySelector('#sport').value = asset.sport || '';
  document.querySelector('#gender').value = asset.gender || '';
  document.querySelector('#condition').value = asset.condition || 'BOM';
  document.querySelector('#location').value = asset.location || '';
  document.querySelector('#notes').value = asset.notes || '';
  document.querySelector('#modal').classList.add('open');
}

function closeModal() {
  document.querySelector('#modal').classList.remove('open');
}

document.querySelector('#new-asset').onclick = openNewModal;
document.querySelector('#close').onclick = closeModal;
document.querySelector('#search').oninput = render;

document.querySelector('#form').onsubmit = async e => {
  e.preventDefault();
  const id = document.querySelector('#asset-id').value;
  const payload = {
    id: id || undefined,
    name: document.querySelector('#name').value.trim(),
    category: document.querySelector('#category').value.trim(),
    quantity: Number(document.querySelector('#quantity').value) || 1,
    sport: document.querySelector('#sport').value || null,
    gender: document.querySelector('#gender').value || null,
    condition: document.querySelector('#condition').value,
    location: document.querySelector('#location').value.trim(),
    notes: document.querySelector('#notes').value.trim(),
  };

  const method = id ? 'PUT' : 'POST';
  const response = await fetch('/api/assets', { method, headers: authHeaders(), body: JSON.stringify(payload) });

  if (response.ok) {
    closeModal();
    render();
  } else {
    const errData = await response.json().catch(() => ({}));
    alert(errData.error || 'Erro ao salvar o item.');
  }
};

// Modal de Empréstimos & Assinatura Canvas
function setupSignaturePad() {
  canvas = document.querySelector('#signature-pad');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#0b1220';
  ctx.lineWidth = 2;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  canvas.onmousedown = canvas.ontouchstart = e => {
    isDrawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  canvas.onmousemove = canvas.ontouchmove = e => {
    if (!isDrawing) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  canvas.onmouseup = canvas.ontouchend = () => { isDrawing = false; };

  document.querySelector('#clear-signature').onclick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
}

function openLoanModal() {
  const select = document.querySelector('#loan-asset-id');
  select.innerHTML = currentAssets.map(a => `<option value="${a.id}">${escapeHtml(a.name)} (Disponível: ${a.quantity})</option>`).join('');
  if (currentAssets.length === 0) {
    alert('Nenhum item cadastrado no patrimônio.');
    return;
  }
  document.querySelector('#loan-form').reset();
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  document.querySelector('#loan-modal').classList.add('open');
}

document.querySelector('#btn-new-loan').onclick = openLoanModal;
document.querySelector('#close-loan-modal').onclick = () => document.querySelector('#loan-modal').classList.remove('open');
document.querySelector('#search-loans').oninput = renderLoans;

document.querySelector('#loan-form').onsubmit = async e => {
  e.preventDefault();
  const signatureData = canvas.toDataURL('image/png');
  const payload = {
    assetId: document.querySelector('#loan-asset-id').value,
    borrowerName: document.querySelector('#borrower-name').value.trim(),
    borrowerDocument: document.querySelector('#borrower-doc').value.trim(),
    borrowerPhone: document.querySelector('#borrower-phone').value.trim(),
    quantity: Number(document.querySelector('#loan-quantity').value) || 1,
    expectedReturn: document.querySelector('#loan-expected-return').value || null,
    signatureData
  };

  const response = await fetch('/api/asset-loans', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });

  if (response.ok) {
    document.querySelector('#loan-modal').classList.remove('open');
    renderLoans();
  } else {
    const errData = await response.json().catch(() => ({}));
    alert(errData.error || 'Erro ao registrar empréstimo.');
  }
};

document.querySelector('#close-x').onclick = closeModal;
document.querySelector('#close-loan-x').onclick = () => document.querySelector('#loan-modal').classList.remove('open');

// Fechar ao clicar fora do conteúdo do modal (no backdrop)
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.onclick = e => {
    if (e.target === backdrop) backdrop.classList.remove('open');
  };
});

// Fechar ao pressionar a tecla ESC
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-backdrop.open').forEach(b => b.classList.remove('open'));
  }
});

setupSignaturePad();
render();

