const form = document.querySelector('#event-form');
const list = document.querySelector('#event-list');
const count = document.querySelector('#event-count');
const platformSelect = document.querySelector('#event-platform');
const linkLabel = document.querySelector('#event-link-label');
const linkInput = document.querySelector('#event-link');
const linkGroup = document.querySelector('#link-field-group');
const ownOrgCheckbox = document.querySelector('#event-own-org');
const financialFieldsGroup = document.querySelector('#financial-fields-group');

// Elementos das Abas
const tabPublish = document.querySelector('#tab-btn-publish');
const tabTimeline = document.querySelector('#tab-btn-timeline');
const tabControl = document.querySelector('#tab-btn-control');

const contentPublish = document.querySelector('#tab-content-publish');
const contentTimeline = document.querySelector('#tab-content-timeline');
const contentControl = document.querySelector('#tab-content-control');
const controlList = document.querySelector('#control-events-list');

const btnShareMarketing = document.querySelector('#btn-share-marketing');

// Métricas da Aba Controle
const metricRevenue = document.querySelector('#metric-events-revenue');
const metricExpenses = document.querySelector('#metric-events-expenses');
const metricProfit = document.querySelector('#metric-events-profit');

// Modal Financeiro
const modalFinance = document.querySelector('#modal-finance');
const formFinance = document.querySelector('#form-finance');
const closeFinance = document.querySelector('#close-finance');

const fields = ['name', 'type', 'date', 'location', 'description', 'platform', 'link'];
const formatDate = value => { if (!value) return ['--', '---']; const date = new Date(`${value.slice(0, 10)}T12:00:00`); return [String(date.getDate()).padStart(2, '0'), date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase()]; };
const formatMoney = val => Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function getPlatformLabel(platform) {
  switch (platform) {
    case 'SYMPLA': return 'Sympla ↗';
    case 'ZEUS': return 'Zeus Ticket ↗';
    case 'CHEERS': return 'Cheers ↗';
    case 'OUTRA': return 'Comprar Ingressos ↗';
    case 'PRESENCIAL': return 'Venda Presencial';
    case 'BORAFEST':
    default: return 'BoraFest ↗';
  }
}

// Controle de Visibilidade dos Campos no Form
function updatePlatformUi() {
  const val = platformSelect.value;
  if (val === 'PRESENCIAL') {
    linkGroup.style.display = 'none';
    linkInput.required = false;
  } else {
    linkGroup.style.display = 'block';
    linkInput.required = false;
    if (val === 'BORAFEST') {
      linkLabel.textContent = 'Link BoraFest';
      linkInput.placeholder = 'https://borafest.com.br/…';
    } else if (val === 'SYMPLA') {
      linkLabel.textContent = 'Link Sympla';
      linkInput.placeholder = 'https://sympla.com.br/…';
    } else if (val === 'ZEUS') {
      linkLabel.textContent = 'Link Zeus Ticket';
      linkInput.placeholder = 'https://zeusticket.com.br/…';
    } else if (val === 'CHEERS') {
      linkLabel.textContent = 'Link Cheers App';
      linkInput.placeholder = 'https://cheersapp.com.br/…';
    } else {
      linkLabel.textContent = 'Link da Plataforma / Ingressos';
      linkInput.placeholder = 'https://…';
    }
  }
}

function updateFinancialFieldsUi() {
  if (ownOrgCheckbox.checked) {
    financialFieldsGroup.style.display = 'grid';
  } else {
    financialFieldsGroup.style.display = 'none';
  }
}

platformSelect.addEventListener('change', updatePlatformUi);
ownOrgCheckbox.addEventListener('change', updateFinancialFieldsUi);

function resetTabs() {
  [tabPublish, tabTimeline, tabControl].forEach(tab => {
    if (tab) {
      tab.classList.remove('active');
      tab.style.borderBottom = 'none';
      tab.style.color = '#718096';
    }
  });
  [contentPublish, contentTimeline, contentControl].forEach(content => {
    if (content) content.style.display = 'none';
  });
}

tabPublish.addEventListener('click', () => {
  resetTabs();
  tabPublish.classList.add('active');
  tabPublish.style.borderBottom = '3px solid #1769e8';
  tabPublish.style.color = '#1769e8';
  contentPublish.style.display = 'block';
});

tabTimeline.addEventListener('click', () => {
  resetTabs();
  tabTimeline.classList.add('active');
  tabTimeline.style.borderBottom = '3px solid #1769e8';
  tabTimeline.style.color = '#1769e8';
  contentTimeline.style.display = 'block';
});

tabControl.addEventListener('click', () => {
  resetTabs();
  tabControl.classList.add('active');
  tabControl.style.borderBottom = '3px solid #1769e8';
  tabControl.style.color = '#1769e8';
  contentControl.style.display = 'block';
});

// COMPARTILHAR CRONOGRAMA INTEGRADO COM A DIRETORIA (EVENTOS, MARKETING, FINANCEIRO, PRESIDÊNCIA)
if (btnShareMarketing) {
  btnShareMarketing.addEventListener('click', async () => {
    if (!confirm('Deseja enviar todo o plano de demandas do evento para as equipes de Eventos, Marketing, Financeiro e Presidência no Quadro de Tarefas?')) return;
    
    const eventTasks = [
      // FASE 1 - IDEALIZAÇÃO (T-60)
      { title: '👑 [Evento T-60] Definir Tema, Público-Alvo e Data Oficial', team: 'Presidência', owner: 'Presidente / Vice', priority: 'alta' },
      { title: '🎨 [Evento T-60] Naming, Conceito e Identidade Visual Inicial', team: 'Marketing', owner: 'Design', priority: 'alta' },
      { title: '💰 [Evento T-60] Fechar Orçamento Máximo e Preço do Lote Promocional', team: 'Financeiro', owner: 'Diretor Financeiro', priority: 'alta' },

      // FASE 2 - PRÉ-LANÇAMENTO (T-45)
      { title: '🏛️ [Evento T-45] Cotação e Contrato de Local, Som e Gerador', team: 'Eventos', owner: 'Diretor de Eventos', priority: 'alta' },
      { title: '🎟️ [Evento T-45] Configurar Venda de Ingressos na Plataforma (BoraFest/Sympla)', team: 'Eventos', owner: 'Coordenador', priority: 'alta' },
      { title: '📣 [Evento T-45] Lançar Campanha Teaser / Save The Date nas Redes', team: 'Marketing', owner: 'Social Media', priority: 'media' },

      // FASE 3 - VENDAS & ENGAJAMENTO (T-30 A T-7)
      { title: '⭐ [Evento T-30] Divulgar Lote Promocional e Line-up Principal', team: 'Marketing', owner: 'Social Media', priority: 'alta' },
      { title: '🚨 [Evento T-20] Solicitar Alvará, Bombeiros, Segurança e Ambulância', team: 'Eventos', owner: 'Diretor de Eventos', priority: 'alta' },
      { title: '🍸 [Evento T-15] Fechar Fornecedores de Bebidas e Bar', team: 'Eventos', owner: 'Equipe de Eventos', priority: 'alta' },
      { title: '🤝 [Evento T-10] Ativar Influenciadores e Cupons de Promotores', team: 'Marketing', owner: 'Relacionamento', priority: 'media' },

      // FASE 4 - DIA DO EVENTO (T-0)
      { title: '📱 [Evento T-0] Testar Validação de QR Code dos Ingressos na Portaria', team: 'Eventos', owner: 'Equipe de Portaria', priority: 'alta' },
      { title: '📸 [Evento T-0] Cobertura em Tempo Real no Instagram (Stories e Reels)', team: 'Marketing', owner: 'Fotografia / Vídeo', priority: 'media' },
      { title: '💵 [Evento T-0] Sangria e Fechamento Parcial do Caixa de Bar', team: 'Financeiro', owner: 'Tesouraria', priority: 'alta' },

      // FASE 5 - PÓS-EVENTO (T+1 A T+7)
      { title: '🎬 [Evento T+1] Publicar Aftermovie e Galeria Oficial de Fotos', team: 'Marketing', owner: 'Audiovisual', priority: 'media' },
      { title: '📊 [Evento T+3] Fechar Balanço Financeiro (Receita x Custos) na Aba Financeira', team: 'Financeiro', owner: 'Diretor Financeiro', priority: 'alta' },
      { title: '📋 [Evento T+7] Reunião de Debriefing e Pontos de Melhoria', team: 'Presidência', owner: 'Toda a Diretoria', priority: 'baixa' }
    ];

    try {
      btnShareMarketing.disabled = true;
      btnShareMarketing.textContent = 'Enviando Demandas...';
      
      for (const t of eventTasks) {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ ...t, assigner: 'Gestão de Eventos', status: 'todo' })
        });
      }

      alert(' Timeline completa enviada com sucesso! As tarefas de Eventos, Marketing, Financeiro e Presidência já estão no Quadro de Tarefas.');
    } catch {
      alert('Erro ao enviar tarefas para a diretoria.');
    } finally {
      btnShareMarketing.disabled = false;
      btnShareMarketing.textContent = '📢 Distribuir Demandas com a Diretoria';
    }
  });
}

function authHeaders() {
  const token = sessionStorage.getItem('compex-token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` };
}

async function loadEvents() {
  const response = await fetch('/api/events', { headers: authHeaders() });
  if (!response.ok) return [];
  return response.json();
}

let cachedEvents = [];

async function render() {
  cachedEvents = await loadEvents();
  
  // RENDERIZAR ABA 1 (Publicados)
  count.textContent = `${cachedEvents.length} evento${cachedEvents.length === 1 ? '' : 's'} cadastrado${cachedEvents.length === 1 ? '' : 's'}`;
  list.innerHTML = cachedEvents.length ? cachedEvents.map(event => {
    const [day, month] = formatDate(event.date);
    const platform = event.platform || 'BORAFEST';
    const link = event.ticketUrl || event.link || event.boraFestUrl;
    const buttonHtml = link ? `<a href="${link}" target="_blank" rel="noopener">${getPlatformLabel(platform)}</a>` : `<span class="badge" style="font-size:12px;opacity:0.7">${getPlatformLabel(platform)}</span>`;
    const ownBadge = event.isOwnOrganization !== false ? `<span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:12px;background:#e3f2fd;color:#0d47a1;font-size:11px;font-weight:700">🏆 Da Atlética</span>` : '';
    
    return `<article class="published-event"><div class="published-date"><b>${day}</b><small>${month}</small></div><div><h3>${event.name}${ownBadge}</h3><p>${event.type} · ${event.location || 'Local a definir'}${event.time ? ' · ' + event.time : ''}</p></div><div>${buttonHtml}<button class="remove" data-id="${event.id}">Excluir</button></div></article>`;
  }).join('') : '<div class="empty">Nenhum novo evento cadastrado ainda.</div>';

  document.querySelectorAll('[data-id]').forEach(btn => btn.addEventListener('click', async () => {
    if (confirm('Tem certeza que deseja excluir este evento?')) {
      await fetch('/api/events', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ id: btn.dataset.id }) });
      render();
    }
  }));

  // RENDERIZAR ABA 2 (Controle Financeiro de Eventos Próprios)
  const ownEvents = cachedEvents.filter(e => e.isOwnOrganization !== false);
  
  let totalRev = 0;
  let totalExp = 0;

  ownEvents.forEach(e => {
    totalRev += Number(e.revenue || 0);
    totalExp += Number(e.expenses || 0);
  });

  const totalProfit = totalRev - totalExp;

  metricRevenue.textContent = formatMoney(totalRev);
  metricExpenses.textContent = formatMoney(totalExp);
  metricProfit.textContent = formatMoney(totalProfit);
  metricProfit.style.color = totalProfit >= 0 ? '#0d8a4f' : '#c0392b';

  if (!ownEvents.length) {
    controlList.innerHTML = `<div class="empty" style="padding:24px;text-align:center;color:#64748b">Nenhum evento próprio da atlética registrado para controle financeiro.</div>`;
  } else {
    controlList.innerHTML = `
      <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:13px">
        <thead>
          <tr style="border-bottom:2px solid #e2e8f0;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase">
            <th style="padding:10px">Data & Evento</th>
            <th style="padding:10px">Plataforma</th>
            <th style="padding:10px">Receita (Vendas)</th>
            <th style="padding:10px">Custos (Gastos)</th>
            <th style="padding:10px">Resultado (Lucro/Prejuízo)</th>
            <th style="padding:10px;text-align:right">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${ownEvents.map(event => {
            const rev = Number(event.revenue || 0);
            const exp = Number(event.expenses || 0);
            const prof = rev - exp;
            const profClass = prof >= 0 ? 'color:#0d8a4f;font-weight:700' : 'color:#c0392b;font-weight:700';
            const [day, month] = formatDate(event.date);

            return `
              <tr style="border-bottom:1px solid #f1f5f9">
                <td style="padding:12px 10px">
                  <strong>${event.name}</strong><br>
                  <small style="color:#64748b">${day} ${month} · ${event.type}</small>
                </td>
                <td style="padding:12px 10px">
                  <span style="background:#f1f5f9;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:600">${event.platform || 'BORAFEST'}</span>
                </td>
                <td style="padding:12px 10px;color:#0d8a4f;font-weight:600">${formatMoney(rev)}</td>
                <td style="padding:12px 10px;color:#c0392b;font-weight:600">${formatMoney(exp)}</td>
                <td style="padding:12px 10px;${profClass}">${formatMoney(prof)}</td>
                <td style="padding:12px 10px;text-align:right">
                  <button class="btn btn-ghost btn-sm btn-edit-finance" data-fin-id="${event.id}">✏️ Lançar / Editar Caixa</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    document.querySelectorAll('.btn-edit-finance').forEach(btn => {
      btn.addEventListener('click', () => {
        const ev = cachedEvents.find(e => e.id === btn.dataset.fin-id);
        if (ev) openFinanceModal(ev);
      });
    });
  }
}

function openFinanceModal(event) {
  document.querySelector('#finance-event-id').value = event.id;
  document.querySelector('#finance-event-name').value = event.name;
  document.querySelector('#finance-revenue').value = event.revenue || 0;
  document.querySelector('#finance-expenses').value = event.expenses || 0;
  document.querySelector('#finance-notes').value = event.financialNotes || '';
  modalFinance.classList.add('open');
}

function hideFinanceModal() {
  modalFinance.classList.remove('open');
}

if (closeFinance) closeFinance.addEventListener('click', hideFinanceModal);
const closeFinanceX = document.querySelector('#close-finance-x');
if (closeFinanceX) closeFinanceX.addEventListener('click', hideFinanceModal);

modalFinance.addEventListener('click', (e) => {
  if (e.target === modalFinance) hideFinanceModal();
});

formFinance.addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.querySelector('#finance-event-id').value;
  const revenue = Number(document.querySelector('#finance-revenue').value || 0);
  const expenses = Number(document.querySelector('#finance-expenses').value || 0);
  const financialNotes = document.querySelector('#finance-notes').value;

  const response = await fetch('/api/events', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ id, revenue, expenses, financialNotes })
  });

  if (!response.ok) {
    alert('Erro ao salvar informações financeiras do evento.');
    return;
  }

  hideFinanceModal();
  render();
  alert('Prestação de contas atualizada com sucesso!');
});

function preview() {
  document.querySelector('#preview-name').innerHTML = (document.querySelector('#event-name').value || 'Seu evento') + '<br><em>' + (document.querySelector('#event-type').value || 'aparecerá aqui.') + '</em>';
  document.querySelector('#preview-type').textContent = (document.querySelector('#event-type').value || 'EVENTO').toUpperCase();
  document.querySelector('#preview-description').textContent = document.querySelector('#event-description').value || 'Preencha o formulário para visualizar como a comunidade verá seu evento.';
  const [day, month] = formatDate(document.querySelector('#event-date').value);
  document.querySelector('#preview-date').textContent = `◷ ${day} ${month}`;
  document.querySelector('#preview-location').textContent = `⌖ ${document.querySelector('#event-location').value || 'Local a definir'}`;
}

fields.forEach(id => {
  const el = document.querySelector(`#event-${id}`);
  if (el) el.addEventListener('input', preview);
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  const platform = platformSelect.value;
  const link = document.querySelector('#event-link').value;
  const isOwn = ownOrgCheckbox.checked;
  const revenue = isOwn ? Number(document.querySelector('#event-revenue').value || 0) : 0;
  const expenses = isOwn ? Number(document.querySelector('#event-expenses').value || 0) : 0;

  const item = {
    name: document.querySelector('#event-name').value,
    type: document.querySelector('#event-type').value,
    platform: platform,
    ticketUrl: link,
    boraFestUrl: link,
    link: link,
    isOwnOrganization: isOwn,
    revenue: revenue,
    expenses: expenses,
    date: document.querySelector('#event-date').value,
    time: document.querySelector('#event-time').value,
    location: document.querySelector('#event-location').value,
    description: document.querySelector('#event-description').value
  };
  const response = await fetch('/api/events', { method: 'POST', headers: authHeaders(), body: JSON.stringify(item) });
  if (!response.ok) { alert('Não foi possível publicar o evento.'); return; }
  form.reset();
  ownOrgCheckbox.checked = true;
  updatePlatformUi();
  updateFinancialFieldsUi();
  preview();
  render();
  alert('Evento publicado com sucesso.');
});

updatePlatformUi();
updateFinancialFieldsUi();
render();
