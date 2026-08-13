let type = 'income';
const money = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const monthLabel = key => new Date(`${key}-02`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();

function authHeaders() {
  const token = sessionStorage.getItem('compex-token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` };
}

let allEntries = [];
let allMonths = [];

async function loadOverview() {
  const response = await fetch('/api/finance-overview', { headers: authHeaders() });
  if (response.status === 401) { window.location.href = 'gestao-login.html'; return { entries: [], months: [] }; }
  if (!response.ok) return { entries: [], months: [] };
  return response.json();
}

function renderChart(months) {
  const max = Math.max(10, ...months.flatMap(m => [m.income, m.expense]));
  const step = Math.ceil(max / 4 / 5) * 5 || 5;
  const top = step * 4;
  document.querySelector('#chart-y-axis').innerHTML = [4, 3, 2, 1, 0].map(i => `<span>${i === 0 ? '0' : money(i * step).replace('R$', '').trim()}</span>`).join('');
  document.querySelector('#chart-x-axis').innerHTML = months.map(m => `<span>${monthLabel(m.month)}</span>`).join('');
  const n = months.length || 1;
  const point = (value, index) => {
    const x = n === 1 ? 0 : (index / (n - 1)) * 600;
    const y = 220 - Math.min(1, value / top) * 220;
    return [x, y];
  };
  const pathFor = key => months.map((m, i) => point(m[key], i)).map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  document.querySelector('#chart-line-income').setAttribute('d', pathFor('income'));
  document.querySelector('#chart-line-expense').setAttribute('d', pathFor('expense'));
  document.querySelector('#chart-area-income').setAttribute('d', `${pathFor('income')} L600 220 L0 220 Z`);
}

function render() {
  const typeFilter = document.querySelector('#filter').value;
  const sourceFilter = document.querySelector('#source-filter').value;
  const items = allEntries.filter(x => (typeFilter === 'all' || x.type === typeFilter) && (sourceFilter === 'all' || x.source === sourceFilter));
  document.querySelector('#list').innerHTML = items.map(x => `<div class="transaction">
    <span class="icon ${x.type === 'expense' ? 'out' : ''}">${x.type === 'income' ? '↑' : '↓'}</span>
    <div><b>${x.description}</b><small>${x.category} · ${new Date(x.date).toLocaleDateString('pt-BR')}${x.source === 'auto' ? ' · automático' : ''}</small></div>
    <strong class="${x.type === 'income' ? 'plus' : 'minus'}">${x.type === 'income' ? '+' : '-'} ${money(x.amount)}</strong>
    ${x.source === 'manual' ? `<button type="button" class="btn btn-ghost btn-sm edit-transaction" data-id="${x.id}">Editar</button><button type="button" class="remove-transaction" data-id="${x.id}">×</button>` : ''}
  </div>`).join('') || '<p class="empty-state">Nenhuma movimentação encontrada.</p>';

  const inc = allEntries.filter(x => x.type === 'income').reduce((s, x) => s + Number(x.amount), 0);
  const out = allEntries.filter(x => x.type === 'expense').reduce((s, x) => s + Number(x.amount), 0);
  document.querySelector('#income').textContent = money(inc);
  document.querySelector('#expense').textContent = money(out);
  document.querySelector('#result').textContent = `${inc >= out ? '+' : ''} ${money(inc - out)}`;
  document.querySelector('#balance').textContent = money(inc - out);

  document.querySelectorAll('.edit-transaction').forEach(btn => btn.onclick = () => openEdit(btn.dataset.id));
  document.querySelectorAll('.remove-transaction').forEach(btn => btn.onclick = async () => {
    if (!confirm('Remover esta movimentação?')) return;
    await fetch('/api/transactions', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ id: btn.dataset.id }) });
    refresh();
  });
}

async function refresh() {
  const overview = await loadOverview();
  allEntries = overview.entries;
  allMonths = overview.months;
  const n = Number(document.querySelector('#filter-months').value || 6);
  renderChart(allMonths.slice(-n));
  render();
}

const modal = document.querySelector('#modal');
function setType(next) {
  type = next;
  document.querySelectorAll('[data-type]').forEach(x => x.classList.toggle('active', x.dataset.type === next));
}

document.querySelector('#new').onclick = () => {
  document.querySelector('form').reset();
  document.querySelector('#modal-title').textContent = 'Nova movimentação';
  document.querySelector('#transaction-submit').textContent = 'Salvar';
  document.querySelector('#transaction-id').value = '';
  setType('income');
  modal.classList.add('open');
};
document.querySelector('#close').onclick = () => modal.classList.remove('open');
document.querySelectorAll('[data-type]').forEach(b => b.onclick = () => setType(b.dataset.type));
document.querySelector('#filter').onchange = render;
document.querySelector('#source-filter').onchange = render;
document.querySelector('#filter-months').onchange = () => {
  const n = Number(document.querySelector('#filter-months').value || 6);
  renderChart(allMonths.slice(-n));
};
document.querySelector('form').onsubmit = async e => {
  e.preventDefault();
  const id = document.querySelector('#transaction-id').value;
  const payload = { description: description.value, amount: Number(amount.value), category: category.value, type };
  if (id) payload.id = id;
  await fetch('/api/transactions', { method: id ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
  e.target.reset();
  modal.classList.remove('open');
  refresh();
};

function openEdit(id) {
  const entry = allEntries.find(x => x.id === id);
  if (!entry) return;
  document.querySelector('form').reset();
  document.querySelector('#modal-title').textContent = 'Editar movimentação';
  document.querySelector('#transaction-submit').textContent = 'Salvar';
  document.querySelector('#transaction-id').value = entry.id;
  document.querySelector('#description').value = entry.description;
  document.querySelector('#amount').value = entry.amount;
  document.querySelector('#category').value = entry.category;
  setType(entry.type);
  modal.classList.add('open');
}

refresh();
