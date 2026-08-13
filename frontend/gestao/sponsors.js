function authHeaders() {
  const token = sessionStorage.getItem('compex-token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` };
}

let activeCategory = 'ALL';
let currentSponsors = [];

async function loadSponsors() {
  const response = await fetch('/api/sponsors', { headers: authHeaders() });
  if (!response.ok) return [];
  return response.json();
}

const money = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const parseValue = text => Number(String(text || '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')) || 0;
const formatDate = d => d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Indeterminado';

async function render() {
  const term = document.querySelector('#search').value.toLowerCase();
  currentSponsors = await loadSponsors();
  
  // Atualiza contadores
  const countAll = currentSponsors.length;
  const countPatrocinio = currentSponsors.filter(x => (x.category || 'PATROCINIO') === 'PATROCINIO').length;
  const countParceria = currentSponsors.filter(x => x.category === 'PARCERIA').length;
  
  if (document.querySelector('#count-all')) document.querySelector('#count-all').textContent = countAll;
  if (document.querySelector('#count-patrocinio')) document.querySelector('#count-patrocinio').textContent = countPatrocinio;
  if (document.querySelector('#count-parceria')) document.querySelector('#count-parceria').textContent = countParceria;

  const sponsors = currentSponsors.filter(x => {
    const matchCategory = activeCategory === 'ALL' || (x.category || 'PATROCINIO') === activeCategory;
    const matchTerm = x.company.toLowerCase().includes(term) || 
                      x.contact.toLowerCase().includes(term) || 
                      (x.responsibleName && x.responsibleName.toLowerCase().includes(term));
    return matchCategory && matchTerm;
  });

  const listEl = document.querySelector('#list');
  listEl.innerHTML = sponsors.map(x => {
    const isParceria = x.category === 'PARCERIA';
    const tagCategory = isParceria ? '<span style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:700; margin-left:6px;">PARCERIA</span>' : '<span style="background:#fef3c7; color:#92400e; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:700; margin-left:6px;">PATROCÍNIO</span>';
    const statusClass = x.status === 'Fechado' ? 'closed' : x.status === 'Negociando' ? 'negotiating' : 'prospecting';
    
    const respText = x.responsibleName ? `👤 Responsável: <b>${x.responsibleName}</b> ${x.responsibleEmail ? `(${x.responsibleEmail})` : ''}` : '👤 Responsável: <i>Não atribuído</i>';
    const datesText = (x.startDate || x.endDate) ? `📅 Vigência: ${formatDate(x.startDate)} até ${formatDate(x.endDate)}` : '';

    return `
      <div class="partner" style="flex-wrap:wrap; padding:14px; gap:12px; border-bottom:1px solid #eee;">
        <span class="logo">${x.company.slice(0, 2).toUpperCase()}</span>
        <div style="flex:1; min-width:200px;">
          <div><b>${x.company}</b> ${tagCategory}</div>
          <small><b>Contato:</b> ${x.contact}</small>
          <div class="partner-card-extra">
            <span>${respText}</span>
            ${datesText ? `<span>${datesText}</span>` : ''}
            ${x.notes ? `<span>📝 <i>"${x.notes}"</i></span>` : ''}
          </div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
          <span class="deal" style="font-weight:700;">${x.value || 'A definir'}</span>
          <span class="status ${statusClass}">${x.status}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px; width:100%; justify-content:flex-end; border-top:1px solid #fafafa; padding-top:6px; margin-top:4px;">
          <button class="doc-btn" data-id="${x.id}">📄 Gerar Documento</button>
          <button class="edit-sponsor btn btn-ghost" data-id="${x.id}" style="padding:4px 8px; font-size:12px;">✏️ Editar</button>
          <button class="remove-sponsor" data-id="${x.id}" style="border:0;background:transparent;color:#c35d4b;cursor:pointer; font-weight:bold; font-size:16px;">×</button>
        </div>
      </div>
    `;
  }).join('') || '<p style="padding:20px; color:#666;">Nenhum registro encontrado nesta categoria.</p>';

  // Eventos de remover, editar e gerar documento
  document.querySelectorAll('.remove-sponsor').forEach(btn => btn.onclick = async () => {
    if (!confirm('Deseja realmente remover este patrocinador/parceiro?')) return;
    await fetch('/api/sponsors', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ id: btn.dataset.id }) });
    render();
  });

  document.querySelectorAll('.edit-sponsor').forEach(btn => btn.onclick = () => {
    const item = currentSponsors.find(s => s.id === btn.dataset.id);
    if (!item) return;
    document.querySelector('#modal-title').textContent = 'Editar Parceiro / Patrocinador';
    document.querySelector('#sponsor-id').value = item.id;
    document.querySelector('#category').value = item.category || 'PATROCINIO';
    document.querySelector('#company').value = item.company;
    document.querySelector('#contact').value = item.contact;
    document.querySelector('#value').value = item.value || '';
    document.querySelector('#status').value = item.status || 'Negociando';
    document.querySelector('#delivery').value = item.delivery || '';
    document.querySelector('#responsibleName').value = item.responsibleName || '';
    document.querySelector('#responsibleEmail').value = item.responsibleEmail || '';
    document.querySelector('#startDate').value = item.startDate ? item.startDate.slice(0, 10) : '';
    document.querySelector('#endDate').value = item.endDate ? item.endDate.slice(0, 10) : '';
    document.querySelector('#notes').value = item.notes || '';

    document.querySelector('#modal').classList.add('open');
  });

  document.querySelectorAll('.doc-btn').forEach(btn => btn.onclick = () => {
    const item = currentSponsors.find(s => s.id === btn.dataset.id);
    if (!item) return;
    openDocModal(item);
  });

  // Métricas gerais
  const closed = currentSponsors.filter(x => x.status === 'Fechado');
  document.querySelector('#metric-active').textContent = closed.length;
  document.querySelector('#metric-revenue').textContent = money(closed.reduce((sum, x) => sum + parseValue(x.value), 0));
  document.querySelector('#metric-negotiating').textContent = currentSponsors.filter(x => x.status !== 'Fechado').length;
}

// Alternar abas
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCategory = btn.dataset.category;
    render();
  };
});

document.querySelector('#new-sponsor').onclick = () => {
  document.querySelector('#modal-title').textContent = 'Novo Parceiro / Patrocinador';
  document.querySelector('#form').reset();
  document.querySelector('#sponsor-id').value = '';
  document.querySelector('#modal').classList.add('open');
};

document.querySelector('#close').onclick = () => document.querySelector('#modal').classList.remove('open');
document.querySelector('#search').oninput = render;

document.querySelector('#form').onsubmit = async e => {
  e.preventDefault();
  const id = document.querySelector('#sponsor-id').value;
  const payload = {
    id: id || undefined,
    category: document.querySelector('#category').value,
    company: document.querySelector('#company').value,
    contact: document.querySelector('#contact').value,
    value: document.querySelector('#value').value || 'A definir',
    status: document.querySelector('#status').value,
    delivery: document.querySelector('#delivery').value || '—',
    responsibleName: document.querySelector('#responsibleName').value || null,
    responsibleEmail: document.querySelector('#responsibleEmail').value || null,
    startDate: document.querySelector('#startDate').value || null,
    endDate: document.querySelector('#endDate').value || null,
    notes: document.querySelector('#notes').value || null
  };

  const method = id ? 'PUT' : 'POST';
  await fetch('/api/sponsors', { method, headers: authHeaders(), body: JSON.stringify(payload) });
  e.target.reset();
  document.querySelector('#modal').classList.remove('open');
  render();
};

function openDocModal(item) {
  const isParceria = item.category === 'PARCERIA';
  const tipoTitulo = isParceria ? 'TERMO DE PARCERIA E CONVÊNIO INSTITUCIONAL' : 'CONTRATO DE PATROCÍNIO ESPORTIVO E MARCA';
  const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  const html = `
    <div style="text-align:center; border-bottom:2px solid #111; padding-bottom:12px; margin-bottom:20px;">
      <h2 style="margin:0; font-size:20px; font-weight:800; color:#111; text-transform:uppercase;">${tipoTitulo}</h2>
      <p style="margin:4px 0 0 0; font-size:13px; color:#666;">COMPEX — Associação Atlética / Gestão Acadêmica</p>
    </div>

    <div style="font-size:14px; line-height:1.6; color:#222;">
      <p><b>1. DAS PARTES</b></p>
      <p><b>CONTRATANTE / ASSOCIADA:</b> Associação Atlética COMPEX.</p>
      <p><b>CONTRATADA / PARCEIRA:</b> <b>${item.company.toUpperCase()}</b>, representada por seu contato cadastrado: <i>${item.contact}</i>.</p>

      <p style="margin-top:16px;"><b>2. DO OBJETO E CONTRAPARTIDAS</b></p>
      <p>O presente instrumento tem por objetivo formalizar o ajuste de ${isParceria ? 'parceria/convênio' : 'patrocínio esportivo'}, sob os seguintes termos:</p>
      <ul>
        <li><b>Valor / Benefício Acordado:</b> ${item.value || 'A definir'}</li>
        <li><b>Entregáveis / Exposição de Marca:</b> ${item.delivery || 'Conforme alinhamento interno'}</li>
      </ul>

      <p style="margin-top:16px;"><b>3. DA GESTÃO E RESPONSABILIDADE INTERNA</b></p>
      <p>Pela COMPEX, a gestão e acompanhamento do cumprimento deste acordo fica sob responsabilidade direta de:</p>
      <p style="background:#f8fafc; padding:8px 12px; border-left:4px solid #3b82f6; border-radius:4px;">
        👤 <b>Responsável da Diretoria:</b> ${item.responsibleName || 'Diretoria Executiva / Marketing'}<br>
        📧 <b>E-mail de Contato:</b> ${item.responsibleEmail || 'diretoria@compex.com.br'}
      </p>

      <p style="margin-top:16px;"><b>4. VIGÊNCIA E CONDIÇÕES</b></p>
      <p>Vigência do acordo: <b>${formatDate(item.startDate)}</b> até <b>${formatDate(item.endDate)}</b>.</p>
      ${item.notes ? `<p><b>Observações Adicionais:</b> ${item.notes}</p>` : ''}

      <div style="margin-top:40px; display:flex; justify-content:space-around; text-align:center; padding-top:20px;">
        <div style="border-top:1px solid #000; width:40%; padding-top:4px;">
          <small><b>COMPEX Atlética</b><br>${item.responsibleName || 'Diretoria'}</small>
        </div>
        <div style="border-top:1px solid #000; width:40%; padding-top:4px;">
          <small><b>${item.company}</b><br>${item.contact}</small>
        </div>
      </div>

      <p style="text-align:right; margin-top:30px; font-size:12px; color:#666;">Emitido via Gestão COMPEX em ${dataHoje}.</p>
    </div>
  `;

  document.querySelector('#printable-doc').innerHTML = html;
  document.querySelector('#doc-modal').classList.add('open');
}

document.querySelector('#close-doc-modal').onclick = () => document.querySelector('#doc-modal').classList.remove('open');
document.querySelector('#print-doc-btn').onclick = () => {
  window.print();
};

render();

