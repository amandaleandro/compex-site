const categoryIcon = { Esportes: '🏐', Eventos: '🏆', Comunicado: '✦', Comunidade: '✦', Geral: '✦', Financeiro: 'R$' };
document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/public/news-detail.css">');

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[character]));
}

function formatDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric'
  }).toUpperCase();
}

function mediaMarkup(news, detail = false) {
  if (news.videoUrl && detail) {
    return `<video class="news-detail-video" controls preload="metadata" src="${escapeHtml(news.videoUrl)}"></video>`;
  }
  if (news.imageUrl) {
    return `<img src="${escapeHtml(news.imageUrl)}" alt="${escapeHtml(news.title)}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
  }
  return categoryIcon[news.category] || '✦';
}

function cardMarkup(news) {
  const href = `/public/news.html?id=${encodeURIComponent(news.id)}`;
  return `<a class="news-card" href="${href}" aria-label="Ler notícia: ${escapeHtml(news.title)}">
    <div class="news-image">${mediaMarkup(news)}</div>
    <div><small>${escapeHtml((news.category || 'Comunicado').toUpperCase())} · ${formatDate(news.date)}</small><h3>${escapeHtml(news.title)}</h3><p>${escapeHtml(news.text)}</p><span class="read">Ler notícia →</span></div>
  </a>`;
}

function detailMarkup(news) {
  return `<article class="news-detail">
    <a class="news-back" href="/public/news.html">← Voltar para notícias</a>
    <small>${escapeHtml((news.category || 'Comunicado').toUpperCase())} · ${formatDate(news.date)}</small>
    <h2>${escapeHtml(news.title)}</h2>
    ${news.imageUrl || news.videoUrl ? `<div class="news-detail-media">${mediaMarkup(news, true)}</div>` : ''}
    <p class="news-detail-text">${escapeHtml(news.text).replace(/\n/g, '<br>')}</p>
  </article>`;
}

async function render() {
  const list = document.querySelector('#list');
  try {
    const response = await fetch('/api/news');
    const news = response.ok ? await response.json() : [];
    const selectedId = new URLSearchParams(window.location.search).get('id');
    const selected = news.find(item => String(item.id) === selectedId);

    if (selectedId && selected) {
      list.innerHTML = detailMarkup(selected);
      document.querySelector('.news-head').style.display = 'none';
      document.title = `${selected.title} — CompExatas`;
      return;
    }

    list.innerHTML = news.map(cardMarkup).join('') || '<p class="empty-note">Nenhuma notícia publicada ainda.</p>';
  } catch {
    list.innerHTML = '<p class="empty-note">Não foi possível carregar as notícias.</p>';
  }
}

render();
