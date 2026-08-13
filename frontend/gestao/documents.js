function authHeaders() {
  const token = sessionStorage.getItem('compex-token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` };
}

async function loadDocuments() {
  const response = await fetch('/api/documents', { headers: authHeaders() });
  if (!response.ok) return [];
  return response.json();
}

async function renderDocs() {
  const term = document.querySelector('#search').value.toLowerCase();
  const docs = (await loadDocuments()).filter(d => d.name.toLowerCase().includes(term) || d.category.toLowerCase().includes(term));
  document.querySelector('#all-count').textContent = docs.length.toString().padStart(2, '0');
  document.querySelector('#list').innerHTML = docs.map(d => `<div class="document"><span class="file-icon">▤</span><div><b>${d.name}</b><small>${d.category} · ${new Date(d.createdAt).toLocaleDateString('pt-BR')}</small></div><span class="tag ${d.access}">${d.access === 'public' ? 'PÚBLICO' : 'DIRETORIA'}</span>${d.url ? `<a href="${d.url}" target="_blank" rel="noopener" title="Baixar">↗</a>` : ''}<button class="remove-doc" data-id="${d.id}" style="border:0;background:transparent;color:#c35d4b;cursor:pointer">×</button></div>`).join('') || '<p>Nenhum documento encontrado.</p>';
  document.querySelectorAll('.remove-doc').forEach(btn => btn.onclick = async () => {
    await fetch('/api/documents', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ id: btn.dataset.id }) });
    renderDocs();
  });
}

document.querySelector('#upload').onclick = () => document.querySelector('#modal').classList.add('open');
document.querySelector('#close').onclick = () => document.querySelector('#modal').classList.remove('open');
document.querySelector('#search').oninput = renderDocs;
document.querySelector('#form').onsubmit = async e => {
  e.preventDefault();
  const file = document.querySelector('#file').files[0];
  const formData = new FormData();
  formData.append('name', document.querySelector('#name').value);
  formData.append('category', document.querySelector('#category').value);
  formData.append('access', document.querySelector('#access').value);
  if (file) formData.append('file', file);
  const token = sessionStorage.getItem('compex-token');
  await fetch('/api/documents/upload', { method: 'POST', headers: { Authorization: `Bearer ${token || ''}` }, body: formData });
  e.target.reset();
  document.querySelector('#modal').classList.remove('open');
  renderDocs();
};

async function loadPolls() {
  const response = await fetch('/api/polls', { headers: authHeaders() });
  if (!response.ok) return [];
  return response.json();
}

function formatRemainingTime(expiresAtStr) {
  if (!expiresAtStr) return '';
  const now = new Date();
  const exp = new Date(expiresAtStr);
  const diffMs = exp - now;
  if (diffMs <= 0) return 'Expirada';
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  const remHours = diffHours % 24;
  
  if (diffDays > 0) {
    return `vence em ${diffDays}d ${remHours}h`;
  }
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (diffHours > 0) {
    return `vence em ${diffHours}h ${diffMins}m`;
  }
  return `vence em ${diffMins} min`;
}

async function renderPolls() {
  const polls = await loadPolls();
  const listEl = document.querySelector('#polls-list');
  if (!listEl) return;

  listEl.innerHTML = polls.map(poll => {
    const total = poll.totalVotes || 0;
    const isClosed = poll.closed;
    const isExpired = poll.isExpired || (poll.expiresAt && new Date(poll.expiresAt) <= new Date());
    const isInactive = isClosed || isExpired;

    let statusBadge = `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;background:#27ae60;color:#fff;text-transform:uppercase;">Ativa</span>`;
    if (isClosed) {
      statusBadge = `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;background:#7f8c8d;color:#fff;text-transform:uppercase;">Encerrada</span>`;
    } else if (isExpired) {
      statusBadge = `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;background:#e67e22;color:#fff;text-transform:uppercase;">Expirada</span>`;
    }

    let timeText = 'Sem prazo limite';
    if (poll.expiresAt) {
      const expDate = new Date(poll.expiresAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
      if (isExpired) {
        timeText = `Venceu em ${expDate}`;
      } else {
        const remaining = formatRemainingTime(poll.expiresAt);
        timeText = `Vencimento: ${expDate} (${remaining})`;
      }
    }

    const bars = poll.results.map((r, index) => {
      const pct = total ? Math.round((r.votes / total) * 100) : 0;
      const voted = poll.myVote === index;
      return `
        <div style="margin:10px 0">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;font-weight:${voted ? '700' : '400'}">
            <span>${r.option}${voted ? ' <b style="color:#27ae60">(Seu voto ✓)</b>' : ''}</span>
            <span>${r.votes} voto(s) · ${pct}%</span>
          </div>
          <div style="background:#eef1e9;border-radius:20px;height:10px;overflow:hidden">
            <div style="width:${pct}%;background:${voted ? '#27ae60' : '#c9f34a'};height:100%;transition:width 0.3s ease"></div>
          </div>
          ${!isInactive ? `
            <button class="vote-btn" data-poll="${poll.id}" data-option="${index}" style="margin-top:6px;font-size:11px;border:1px solid ${voted ? '#27ae60' : '#dfe0d8'};background:${voted ? '#e8f8f5' : 'transparent'};color:${voted ? '#1e8449' : 'inherit'};border-radius:6px;padding:4px 12px;cursor:pointer;font-weight:600">
              ${voted ? '✓ Opção Votada' : 'Votar nesta opção'}
            </button>
          ` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="document" style="display:block;padding:16px;margin-bottom:12px;border:1px solid #eee;border-radius:8px;background:#fff">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              ${statusBadge}
              <small style="color:#7f8c8d;font-size:11px">⏱️ ${timeText}</small>
            </div>
            <h3 style="margin:4px 0;font-size:15px;font-weight:700;color:#2c3e50">${poll.question}</h3>
            <small style="color:#899188;font-size:11px">Criada por ${poll.createdBy || 'Diretoria'} · Total: ${total} voto(s)</small>
          </div>
          <button class="delete-poll-btn" data-id="${poll.id}" title="Excluir enquete" style="border:0;background:transparent;color:#c35d4b;cursor:pointer;font-size:16px;padding:4px">🗑️</button>
        </div>
        ${bars}
        ${!isInactive ? `
          <div style="margin-top:12px;padding-top:8px;border-top:1px dashed #eee">
            <button class="close-poll" data-id="${poll.id}" style="font-size:11px;border:0;background:transparent;color:#c35d4b;cursor:pointer;font-weight:600">Encerrar e salvar resumo em Documentos</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('') || '<p style="color:#7f8c8d">Nenhuma enquete criada ainda.</p>';

  document.querySelectorAll('.vote-btn').forEach(btn => btn.onclick = async () => {
    const res = await fetch(`/api/polls/${btn.dataset.poll}/vote`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ optionIndex: Number(btn.dataset.option) }) });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Erro ao registrar voto');
    }
    renderPolls();
  });

  document.querySelectorAll('.close-poll').forEach(btn => btn.onclick = async () => {
    if (!confirm('Encerrar esta enquete? O resultado será finalizado e salvo em Documentos.')) return;
    await fetch(`/api/polls/${btn.dataset.id}/close`, { method: 'POST', headers: authHeaders() });
    renderPolls();
    renderDocs();
  });

  document.querySelectorAll('.delete-poll-btn').forEach(btn => btn.onclick = async () => {
    if (!confirm('Tem certeza que deseja excluir esta enquete permanentemente?')) return;
    await fetch(`/api/polls/${btn.dataset.id}`, { method: 'DELETE', headers: authHeaders() });
    renderPolls();
  });
}

/* ---------- Gestão Dinâmica do Form de Criar Enquete ---------- */
const pollModal = document.querySelector('#poll-modal');
const pollOptionsContainer = document.querySelector('#poll-options-container');
const durationSelect = document.querySelector('#poll-duration');
const customDateField = document.querySelector('#custom-date-field');

function createOptionRow(value = '') {
  const row = document.createElement('div');
  row.className = 'poll-option-row';
  row.style.cssText = 'display:flex;gap:8px;align-items:center';
  row.innerHTML = `
    <input class="poll-option-input" placeholder="Opção de resposta" value="${value}" style="flex:1;padding:8px;border:1px solid #ccc;border-radius:4px" required>
    <button type="button" class="remove-option-btn" style="border:0;background:transparent;color:#c35d4b;cursor:pointer;font-size:16px;padding:4px 8px" title="Remover opção">✕</button>
  `;
  row.querySelector('.remove-option-btn').onclick = () => {
    if (pollOptionsContainer.querySelectorAll('.poll-option-row').length <= 2) {
      alert('A enquete deve ter no mínimo 2 opções.');
      return;
    }
    row.remove();
  };
  return row;
}

function resetPollForm() {
  document.querySelector('#poll-form').reset();
  document.querySelector('#poll-error').textContent = '';
  pollOptionsContainer.innerHTML = '';
  pollOptionsContainer.appendChild(createOptionRow('Sim'));
  pollOptionsContainer.appendChild(createOptionRow('Não'));
  customDateField.style.display = 'none';
}

if (durationSelect) {
  durationSelect.onchange = () => {
    if (durationSelect.value === 'custom') {
      customDateField.style.display = 'block';
    } else {
      customDateField.style.display = 'none';
    }
  };
}

const addOptionBtn = document.querySelector('#add-option-btn');
if (addOptionBtn) {
  addOptionBtn.onclick = () => {
    pollOptionsContainer.appendChild(createOptionRow(''));
  };
}

if (document.querySelector('#new-poll')) {
  document.querySelector('#new-poll').onclick = () => {
    resetPollForm();
    pollModal.showModal();
  };
}

if (document.querySelector('#poll-cancel')) {
  document.querySelector('#poll-cancel').onclick = () => pollModal.close();
}

if (document.querySelector('#poll-form')) {
  document.querySelector('#poll-form').onsubmit = async e => {
    e.preventDefault();
    const errorEl = document.querySelector('#poll-error');
    errorEl.textContent = '';

    const question = document.querySelector('#poll-question').value.trim();
    const optionInputs = pollOptionsContainer.querySelectorAll('.poll-option-input');
    const options = Array.from(optionInputs).map(inp => inp.value.trim()).filter(Boolean);

    if (!question) {
      errorEl.textContent = 'Informe a pergunta da enquete.';
      return;
    }
    if (options.length < 2) {
      errorEl.textContent = 'Adicione pelo menos 2 opções válidas.';
      return;
    }

    let expiresAt = null;
    const duration = durationSelect.value;
    const now = new Date();

    if (duration === '24h') {
      expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    } else if (duration === '3d') {
      expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    } else if (duration === '7d') {
      expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (duration === 'custom') {
      const customVal = document.querySelector('#poll-custom-date').value;
      if (!customVal) {
        errorEl.textContent = 'Selecione a data e hora de encerramento.';
        return;
      }
      const customDate = new Date(customVal);
      if (customDate <= now) {
        errorEl.textContent = 'A data de encerramento deve ser no futuro.';
        return;
      }
      expiresAt = customDate.toISOString();
    }

    const response = await fetch('/api/polls', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ question, options, expiresAt })
    });
    const result = await response.json();
    if (!response.ok) {
      errorEl.textContent = result.error || 'Não foi possível criar a enquete.';
      return;
    }
    pollModal.close();
    renderPolls();
  };
}

renderDocs();
renderPolls();
