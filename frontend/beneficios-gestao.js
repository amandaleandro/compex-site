function authHeaders() {
  const token = sessionStorage.getItem('compex-token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` };
}

const DEFAULT_BENEFITS = [
  { id: 'b1', name: 'Café Byte', category: 'Alimentação', discount: '10% OFF', description: 'Café, lanches e encontros para recarregar.', icon: '☕' },
  { id: 'b2', name: 'Arena Sport', category: 'Esporte', discount: '15% OFF', description: 'Equipamentos, acessórios e materiais esportivos.', icon: '👟' },
  { id: 'b3', name: 'Gráfica Exatas', category: 'Serviços', discount: '20% OFF', description: 'Impressões, encadernações e materiais acadêmicos.', icon: '▣' },
  { id: 'b4', name: 'Pizza da Quadra', category: 'Alimentação', discount: 'R$ 10 OFF', description: 'Delivery especial para dias de treino e jogo.', icon: '🍕' }
];

const DEFAULT_PLANS = [
  { id: 'p1', name: 'Plano Anual', price: '49,90', period: '/ano', slots: 1, icon: '☆', description: 'Carteirinha digital, benefícios e eventos durante 12 meses.' },
  { id: 'p2', name: 'Plano Semestral', price: '29,90', period: '/semestre', slots: 1, icon: '▦', description: 'Acesso completo por 6 meses com carteirinha digital.' }
];

// ==== GERENCIAMENTO DE ABAS (EXATAMENTE COMO PRODUTOS.JS) ====
const tabBtnBenefits = document.querySelector('#tab-btn-benefits');
const tabBtnPlans = document.querySelector('#tab-btn-plans');
const tabContentBenefits = document.querySelector('#tab-content-benefits');
const tabContentPlans = document.querySelector('#tab-content-plans');
const btnTopAction = document.querySelector('#btn-top-action');

let activeTab = 'benefits';

tabBtnBenefits.onclick = () => {
  activeTab = 'benefits';
  tabBtnBenefits.classList.add('active');
  tabBtnBenefits.style.color = '#2b6cb0';
  tabBtnBenefits.style.borderBottom = '3px solid #2b6cb0';

  tabBtnPlans.classList.remove('active');
  tabBtnPlans.style.color = '#718096';
  tabBtnPlans.style.borderBottom = 'none';

  tabContentBenefits.style.display = 'block';
  tabContentPlans.style.display = 'none';
  btnTopAction.textContent = '+ Novo benefício';
};

tabBtnPlans.onclick = () => {
  activeTab = 'plans';
  tabBtnPlans.classList.add('active');
  tabBtnPlans.style.color = '#2b6cb0';
  tabBtnPlans.style.borderBottom = '3px solid #2b6cb0';

  tabBtnBenefits.classList.remove('active');
  tabBtnBenefits.style.color = '#718096';
  tabBtnBenefits.style.borderBottom = 'none';

  tabContentPlans.style.display = 'block';
  tabContentBenefits.style.display = 'none';
  btnTopAction.textContent = '+ Novo plano';
};

btnTopAction.onclick = () => {
  if (activeTab === 'benefits') openBenefitModal();
  else openPlanModal();
};

// ==== ABA 1: PARCEIROS & BENEFÍCIOS ====
async function loadBenefits() {
  try {
    const response = await fetch('/api/benefits', { headers: authHeaders() });
    if (response.status === 401) { window.location.href = 'gestao-login.html'; return DEFAULT_BENEFITS; }
    if (!response.ok) return DEFAULT_BENEFITS;
    const data = await response.json();
    return Array.isArray(data) ? data : DEFAULT_BENEFITS;
  } catch {
    return DEFAULT_BENEFITS;
  }
}

async function renderBenefits() {
  const term = (document.querySelector('#search').value || '').toLowerCase();
  const currentBenefits = await loadBenefits();
  const benefits = currentBenefits.filter(b => b.name.toLowerCase().includes(term) || b.category.toLowerCase().includes(term));

  document.querySelector('#metric-total').textContent = currentBenefits.length;
  document.querySelector('#metric-food').textContent = currentBenefits.filter(b => b.category === 'Alimentação').length;

  document.querySelector('#list').innerHTML = benefits.map(b => {
    const photo = `<span class="file-icon" style="width:44px;height:44px;display:grid;place-items:center;background:#f7fafc;border-radius:8px;font-size:20px;border:1px solid #e2e8f0">${b.icon || '☕'}</span>`;
    const discountTag = `<span style="background:#e6fffa;color:#234e52;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">${b.discount}</span>`;

    return `
      <div class="product-row" style="display:flex;align-items:center;gap:14px;padding:12px 16px;border-bottom:1px solid #edf2f7">
        ${photo}
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px">
            <b style="font-size:15px;color:#1a202c">${b.name}</b>
            ${discountTag}
          </div>
          <small style="color:#718096;display:block;margin-top:2px">${b.category}${b.description ? ' · ' + b.description : ''}</small>
        </div>
        <button type="button" class="btn btn-ghost edit-benefit" data-id="${b.id}" style="padding:4px 10px;font-size:12px">Editar</button>
        <button type="button" class="remove-benefit" data-id="${b.id}" title="Remover" style="background:none;border:none;color:#e53e3e;font-size:20px;cursor:pointer;padding:0 8px">&times;</button>
      </div>`;
  }).join('') || '<p class="empty-state" style="padding:24px;text-align:center;color:#a0aec0">Nenhum benefício cadastrado ainda.</p>';

  document.querySelectorAll('.edit-benefit').forEach(btn => {
    btn.onclick = () => {
      const b = currentBenefits.find(x => x.id === btn.dataset.id);
      if (!b) return;
      document.querySelector('#modal-title').textContent = 'Editar benefício';
      document.querySelector('#benefit-id').value = b.id;
      document.querySelector('#name').value = b.name;
      document.querySelector('#category').value = b.category || 'Alimentação';
      document.querySelector('#icon').value = b.icon || '☕';
      document.querySelector('#discount').value = b.discount;
      document.querySelector('#description').value = b.description || '';
      document.querySelector('#modal').classList.add('open');
    };
  });

  document.querySelectorAll('.remove-benefit').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Deseja realmente remover este benefício?')) return;
      await fetch('/api/benefits', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ id: btn.dataset.id }) });
      renderBenefits();
    };
  });
}

const modal = document.querySelector('#modal');
const openBenefitModal = () => {
  document.querySelector('#form').reset();
  document.querySelector('#benefit-id').value = '';
  document.querySelector('#modal-title').textContent = 'Novo benefício';
  modal.classList.add('open');
};
const closeBenefitModal = () => modal.classList.remove('open');

document.querySelector('#close').onclick = closeBenefitModal;
document.querySelector('#search').oninput = renderBenefits;

document.querySelector('#form').onsubmit = async e => {
  e.preventDefault();
  const id = document.querySelector('#benefit-id').value;
  const payload = {
    id: id || undefined,
    name: document.querySelector('#name').value,
    category: document.querySelector('#category').value,
    icon: document.querySelector('#icon').value,
    discount: document.querySelector('#discount').value,
    description: document.querySelector('#description').value
  };

  const method = id ? 'PUT' : 'POST';
  await fetch('/api/benefits', { method, headers: authHeaders(), body: JSON.stringify(payload) });
  closeBenefitModal();
  renderBenefits();
};

// ==== ABA 2: PLANOS DO SÓCIO ====
async function loadPlans() {
  try {
    const response = await fetch('/api/plans', { headers: authHeaders() });
    if (!response.ok) return DEFAULT_PLANS;
    const data = await response.json();
    return Array.isArray(data) && data.length > 0 ? data : DEFAULT_PLANS;
  } catch {
    return DEFAULT_PLANS;
  }
}

async function renderPlans() {
  const term = (document.querySelector('#search-plans').value || '').toLowerCase();
  const currentPlans = await loadPlans();
  const plans = currentPlans.filter(p => p.name.toLowerCase().includes(term) || (p.description || '').toLowerCase().includes(term));

  document.querySelector('#metric-plans-total').textContent = currentPlans.length;
  document.querySelector('#metric-plans-active').textContent = currentPlans.length;

  document.querySelector('#plans-list').innerHTML = plans.map(p => {
    const photo = `<span class="file-icon" style="width:44px;height:44px;display:grid;place-items:center;background:#ebf8ff;border-radius:8px;font-size:20px;border:1px solid #bee3f8">${p.icon || '☆'}</span>`;
    const priceTag = `<span style="background:#e6fffa;color:#234e52;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">R$ ${p.price}${p.period || '/ano'}</span>`;

    return `
      <div class="product-row" style="display:flex;align-items:center;gap:14px;padding:12px 16px;border-bottom:1px solid #edf2f7">
        ${photo}
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px">
            <b style="font-size:15px;color:#1a202c">${p.name}</b>
            ${priceTag}
          </div>
          <small style="color:#718096;display:block;margin-top:2px">${p.description ? p.description + ' · ' : ''}${p.slots || 1} vaga(s) de esporte</small>
        </div>
        <strong style="font-size:15px;color:#2d3748">R$ ${p.price}</strong>
        <button type="button" class="btn btn-ghost edit-plan" data-id="${p.id}" style="padding:4px 10px;font-size:12px">Editar</button>
        <button type="button" class="remove-plan" data-id="${p.id}" title="Remover" style="background:none;border:none;color:#e53e3e;font-size:20px;cursor:pointer;padding:0 8px">&times;</button>
      </div>`;
  }).join('') || '<p class="empty-state" style="padding:24px;text-align:center;color:#a0aec0">Nenhum plano cadastrado ainda.</p>';

  document.querySelectorAll('.edit-plan').forEach(btn => {
    btn.onclick = () => {
      const p = currentPlans.find(x => x.id === btn.dataset.id);
      if (!p) return;
      document.querySelector('#plan-modal-title').textContent = 'Editar plano do sócio';
      document.querySelector('#plan-id').value = p.id;
      document.querySelector('#plan-name').value = p.name;
      document.querySelector('#plan-price').value = p.price;
      document.querySelector('#plan-period').value = p.period || '/ano';
      document.querySelector('#plan-slots').value = p.slots !== undefined ? p.slots : 1;
      document.querySelector('#plan-icon').value = p.icon || '☆';
      document.querySelector('#plan-description').value = p.description || '';
      document.querySelector('#plan-modal').classList.add('open');
    };
  });

  document.querySelectorAll('.remove-plan').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Deseja realmente remover este plano?')) return;
      await fetch('/api/plans', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ id: btn.dataset.id }) });
      renderPlans();
    };
  });
}

const planModal = document.querySelector('#plan-modal');
const openPlanModal = () => {
  document.querySelector('#plan-form').reset();
  document.querySelector('#plan-id').value = '';
  document.querySelector('#plan-modal-title').textContent = 'Novo plano do sócio';
  planModal.classList.add('open');
};
const closePlanModal = () => planModal.classList.remove('open');

document.querySelector('#plan-close').onclick = closePlanModal;
document.querySelector('#search-plans').oninput = renderPlans;

document.querySelector('#plan-form').onsubmit = async e => {
  e.preventDefault();
  const id = document.querySelector('#plan-id').value;
  const payload = {
    id: id || undefined,
    name: document.querySelector('#plan-name').value,
    price: document.querySelector('#plan-price').value,
    period: document.querySelector('#plan-period').value,
    slots: parseInt(document.querySelector('#plan-slots').value, 10) || 1,
    icon: document.querySelector('#plan-icon').value,
    description: document.querySelector('#plan-description').value
  };

  const method = id ? 'PUT' : 'POST';
  await fetch('/api/plans', { method, headers: authHeaders(), body: JSON.stringify(payload) });
  closePlanModal();
  renderPlans();
};

// Inicialização das duas abas
renderBenefits();
renderPlans();
