function authHeaders() {
  const token = sessionStorage.getItem('compex-token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` };
}

async function loadMessages() {
  const response = await fetch('/api/news', { headers: authHeaders() });
  if (!response.ok) return [];
  return response.json();
}

async function render() {
  const filter = document.querySelector('#filter').value;
  const all = await loadMessages();
  const messages = all.filter(m => filter === 'all' || m.category === filter);
  document.querySelector('#messages').innerHTML = messages.map(m => {
    let mediaHtml = '';
    if (m.imageUrl) {
      mediaHtml += `<div style="margin-top:10px;"><img src="${m.imageUrl}" alt="Mídia do comunicado" style="max-width:100%;max-height:280px;border-radius:8px;object-fit:cover;"></div>`;
    }
    if (m.videoUrl) {
      if (m.videoUrl.includes('youtube.com') || m.videoUrl.includes('youtu.be')) {
        const embedUrl = m.videoUrl.replace('watch?v=', 'embed/');
        mediaHtml += `<div style="margin-top:10px;"><iframe src="${embedUrl}" style="width:100%;height:220px;border:0;border-radius:8px;" allowfullscreen></iframe></div>`;
      } else {
        mediaHtml += `<div style="margin-top:10px;"><video src="${m.videoUrl}" controls style="max-width:100%;max-height:280px;border-radius:8px;"></video></div>`;
      }
    }

    return `<div class="message" style="flex-direction:column;align-items:stretch;gap:8px;padding:14px;border-bottom:1px solid rgba(255,255,255,0.08);">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="message-icon">✦</span>
          <div>
            <b style="font-size:15px;">${m.title}</b>
            <br><small style="opacity:0.75;">${m.category} · ${new Date(m.date).toLocaleDateString('pt-BR')}</small>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:11px;background:rgba(255,255,255,0.1);padding:3px 8px;border-radius:4px;">PUBLICADO</span>
          <button class="remove" data-id="${m.id}" style="border:0;background:transparent;color:#c35d4b;font-size:12px;cursor:pointer;">Excluir</button>
        </div>
      </div>
      ${m.text ? `<p style="margin:4px 0 0 0;font-size:14px;line-height:1.4;opacity:0.9;">${m.text}</p>` : ''}
      ${mediaHtml}
    </div>`;
  }).join('') || '<p style="padding:16px;">Nenhum comunicado encontrado.</p>';
  document.querySelector('#sent').textContent = all.length;
  document.querySelector('#drafts').textContent = '00';
  document.querySelectorAll('.remove').forEach(btn => btn.onclick = async () => {
    await fetch('/api/news', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ id: btn.dataset.id }) });
    render();
  });
}

async function uploadFile(fileInput) {
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) return null;
  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append('file', file);
  const token = sessionStorage.getItem('compex-token');
  const response = await fetch('/api/news/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token || ''}` },
    body: formData
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    alert(error.error || 'Falha ao enviar arquivo.');
    return null;
  }
  const result = await response.json();
  return result.url;
}

document.querySelector('#new-message').onclick = () => document.querySelector('#modal').classList.add('open');
document.querySelector('#close').onclick = () => document.querySelector('#modal').classList.remove('open');
document.querySelector('#filter').onchange = render;
document.querySelector('#form').onsubmit = async e => {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviando mídias...';

  try {
    let imageUrl = await uploadFile(document.querySelector('#imageFile'));
    let videoUrl = await uploadFile(document.querySelector('#videoFile'));
    
    // Se não enviou arquivo de vídeo, usa o link digitado
    if (!videoUrl) {
      videoUrl = document.querySelector('#videoUrl').value || null;
    }

    const payload = {
      title: document.querySelector('#subject').value,
      category: document.querySelector('#audience').value,
      text: document.querySelector('#body').value,
      imageUrl,
      videoUrl,
      published: true
    };
    await fetch('/api/news', { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
    e.target.reset();
    document.querySelector('#modal').classList.remove('open');
    render();
  } catch (err) {
    alert('Erro ao publicar comunicado.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
};

render();
