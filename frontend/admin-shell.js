/* Shell único do portal administrativo: sidebar, topo do perfil, logout e troca de senha.
   Fonte única do menu — evita páginas internas divergindo em navegação/tema entre si. */
(function () {
  const NAV = [
    { page: 'inicio', href: 'portal.html', icon: '⌂', label: 'Início' },
    { page: 'dashboard', href: 'dashboard.html', icon: '▦', label: 'Dashboard' },
    { page: 'members', href: 'members.html', icon: '◎', label: 'Associados' },
    { page: 'finance', href: 'finance.html', icon: 'R$', label: 'Financeiro' },
    { page: 'sports', href: 'sports.html', icon: '⌁', label: 'Esportes' },
    { page: 'events', href: 'event-manager.html', icon: '◷', label: 'Eventos' },
    { page: 'sponsors', href: 'sponsors.html', icon: '◈', label: 'Patrocinadores' },
    { page: 'beneficios-gestao', href: 'beneficios-gestao.html', icon: '◇', label: 'Benefícios' },
    { page: 'produtos', href: 'produtos.html', icon: '⛁', label: 'Produtos & Pedidos' },
    { page: 'patrimonio', href: 'patrimonio.html', icon: '▨', label: 'Patrimônio' },
    { page: 'communication', href: 'communication.html', icon: '✦', label: 'Comunicação' },
    { page: 'tasks', href: 'tasks.html', icon: '✓', label: 'Tarefas' },
    { page: 'documents', href: 'documents.html', icon: '▤', label: 'Documentos' },
    { page: 'checkin', href: 'checkin.html', icon: '▣', label: 'Check-in' },
    { page: 'permissions', href: 'permissions.html', icon: '⚙', label: 'Permissões' },
    { page: 'warnings', href: 'warnings.html', icon: '⚠', label: 'Advertências' },
  ];

  const mount = document.getElementById('admin-shell');
  const activePage = mount ? mount.dataset.active : '';

  const navHtml = NAV.map(item => {
    const cls = item.page === activePage ? 'active' : '';
    return `<a class="${cls}" href="${item.href}"><span class="ic">${item.icon}</span><span>${item.label}</span></a>`;
  }).join('');

  const sidebar = document.createElement('aside');
  sidebar.className = 'shell-sidebar';
  sidebar.innerHTML = `
    <a class="shell-brand" href="portal.html">
      <img src="/public/assets/compex-logo.png?v=5" alt="COMPEX">
      <span class="shell-brand-text"><strong>COMPEX</strong><span>GESTÃO 2026</span></span>
    </a>
    <nav class="shell-nav">${navHtml}</nav>
    <div class="shell-bottom">
      <button type="button" id="shell-change-password"><span class="ic">⚿</span><span>Trocar senha</span></button>
      <button type="button" id="shell-logout"><span class="ic">⏻</span><span>Sair</span></button>
    </div>
  `;
  document.body.prepend(sidebar);
  if (mount) mount.remove();

  function initials(name) {
    if (!name) return '--';
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '--';
  }

  const ROLE_LABELS = {
    PRESIDENCIA: 'Presidência', FINANCEIRO: 'Financeiro', ESPORTES: 'Esportes',
    EVENTOS: 'Eventos', MARKETING: 'Marketing', PRODUTOS: 'Produtos', PATRIMONIO: 'Patrimônio', ASSOCIADO: 'Associado',
  };

  async function loadProfile() {
    const token = sessionStorage.getItem('compex-token');
    try {
      const response = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token || ''}` } });
      if (!response.ok) { window.location.href = 'gestao-login.html'; return; }
      const { user } = await response.json();
      document.querySelectorAll('[data-user-name]').forEach(el => { el.textContent = user.name; });
      document.querySelectorAll('[data-user-role]').forEach(el => { el.textContent = ROLE_LABELS[user.role] || user.role; });
      document.querySelectorAll('[data-user-avatar]').forEach(el => { el.textContent = initials(user.name); });
      document.dispatchEvent(new CustomEvent('admin-shell:user', { detail: user }));

      if (user.role !== 'ASSOCIADO' && (!user.member || user.member.status !== 'active') && document.getElementById('shell-become-member') === null) {
        const bottom = document.querySelector('.shell-bottom');
        const link = document.createElement('a');
        link.id = 'shell-become-member';
        if (!user.member) {
          link.href = 'associar-se.html';
          link.innerHTML = '<span class="ic">🎫</span><span>Tornar-se sócio</span>';
        } else {
          link.href = 'mensalidade.html';
          link.innerHTML = '<span class="ic">🎫</span><span>Pagar mensalidade</span>';
        }
        bottom.prepend(link);
      }
    } catch { /* mantém a página, chamadas de dados próprias tratam o erro */ }
  }
  loadProfile();

  document.getElementById('shell-logout').addEventListener('click', async () => {
    const token = sessionStorage.getItem('compex-token');
    try { await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token || ''}` } }); } catch {}
    sessionStorage.removeItem('compex-session');
    sessionStorage.removeItem('compex-token');
    window.location.href = 'gestao-login.html';
  });

  document.getElementById('shell-change-password').addEventListener('click', () => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal">
        <h2>Trocar senha</h2>
        <p class="modal-sub">Sua nova senha precisa ter pelo menos 8 caracteres.</p>
        <form id="shell-password-form">
          <div class="field"><label>Senha atual</label><input type="password" id="shell-current-password" required></div>
          <div class="field"><label>Nova senha</label><input type="password" id="shell-new-password" required minlength="8"></div>
          <p class="modal-error" id="shell-password-error"></p>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" id="shell-password-cancel">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(backdrop);
    const close = () => backdrop.remove();
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
    backdrop.querySelector('#shell-password-cancel').addEventListener('click', close);
    backdrop.querySelector('#shell-password-form').addEventListener('submit', async e => {
      e.preventDefault();
      const currentPassword = backdrop.querySelector('#shell-current-password').value;
      const newPassword = backdrop.querySelector('#shell-new-password').value;
      const token = sessionStorage.getItem('compex-token');
      const errorEl = backdrop.querySelector('#shell-password-error');
      try {
        const response = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const result = await response.json();
        if (!response.ok) { errorEl.textContent = result.error || 'Não foi possível trocar a senha.'; return; }
        close();
      } catch { errorEl.textContent = 'Erro de conexão.'; }
    });
  });
})();
