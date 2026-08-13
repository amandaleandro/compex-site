(() => {
  let settings;
  try { settings = JSON.parse(localStorage.getItem('compex-associate-settings') || '{}'); } catch { settings = {}; }
  const displayName = (settings.socialName || settings.nickname || settings.name || '').trim();
  const applyName = name => {
    if (!name) return;
    document.querySelectorAll('.profile-link').forEach(link => {
      link.textContent = `♙  ${name} · Minha conta`;
    });
    const replaceNames = node => {
      if (node.nodeType === Node.TEXT_NODE) {
        node.nodeValue = node.nodeValue.replace(/Amanda L\. Carmo|Amanda Silva/g, name);
        return;
      }
      node.childNodes?.forEach(replaceNames);
    };
    replaceNames(document.body);
  };
  if (settings.photo) {
    document.querySelectorAll('.photo, .avatar, .member-photo').forEach(element => {
      const source = settings.photo.startsWith('/uploads/') ? `${settings.photo}?v=${Date.now()}` : settings.photo;
      element.style.backgroundImage = `url(${source})`;
      element.style.backgroundSize = 'cover';
      element.style.backgroundPosition = 'center';
      const initials = [...element.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
      if (initials) initials.nodeValue = '';
    });
  }
  applyName(displayName);
  fetch('/api/me/profile', { headers: { Authorization: `Bearer ${sessionStorage.getItem('compex-token') || ''}` } })
    .then(response => response.ok ? response.json() : null)
    .then(profile => applyName(profile && (profile.socialName || profile.nickname || profile.name)))
    .catch(() => {});
})();
