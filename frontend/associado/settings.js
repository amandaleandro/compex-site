(() => {
  const tabs = [...document.querySelectorAll('[data-tab]')];
  const panels = [...document.querySelectorAll('.tab-panel')];

  function selectTab(name, updateUrl = true) {
    const selected = tabs.find(tab => tab.dataset.tab === name) || tabs[0];
    tabs.forEach(tab => {
      const active = tab === selected;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    panels.forEach(panel => { panel.hidden = panel.id !== selected.dataset.tab; });
    if (updateUrl) history.replaceState(null, '', `#${selected.dataset.tab}`);
  }

  tabs.forEach(tab => tab.addEventListener('click', () => selectTab(tab.dataset.tab)));
  selectTab(location.hash.slice(1) || 'profile', false);

  document.querySelectorAll('.toggle').forEach(toggle => toggle.addEventListener('click', () => {
    const enabled = toggle.classList.toggle('on');
    toggle.setAttribute('aria-pressed', String(enabled));
  }));

  const storageKey = 'compex-associate-settings';
  const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
  const formGrid = document.querySelector('.form-grid');
  const associationDateLabel = document.createElement('label');
  associationDateLabel.textContent = 'Data de associação';
  const associationDate = document.createElement('input');
  associationDate.type = 'date';
  associationDate.name = 'associationDate';
  associationDate.value = saved.associationDate || '2024-08-01';
  associationDateLabel.appendChild(associationDate);
  formGrid.appendChild(associationDateLabel);
  const sexLabel = document.createElement('label');
  sexLabel.textContent = 'Sexo';
  const sexField = document.createElement('select');
  sexField.name = 'sex';
  sexField.innerHTML = '<option value="">Prefiro não informar</option><option value="FEMININO">Feminino</option><option value="MASCULINO">Masculino</option><option value="NAO_BINARIO">Não binário</option><option value="OUTRO">Outro</option>';
  sexField.value = saved.sex || '';
  sexLabel.appendChild(sexField);
  formGrid.appendChild(sexLabel);
  const birthDateLabel = document.createElement('label');
  birthDateLabel.textContent = 'Data de nascimento';
  const birthDateField = document.createElement('input');
  birthDateField.type = 'date';
  birthDateField.name = 'birthDate';
  birthDateField.value = saved.birthDate || '';
  birthDateLabel.appendChild(birthDateField);
  formGrid.appendChild(birthDateLabel);
  const nameField = document.querySelector('.form-grid [name="name"]');
  const socialNameLabel = document.createElement('label');
  socialNameLabel.textContent = 'Nome social (opcional)';
  const socialNameField = document.createElement('input');
  socialNameField.name = 'socialName';
  socialNameField.placeholder = 'Como você prefere ser chamado(a)';
  socialNameField.value = saved.socialName || '';
  socialNameLabel.appendChild(socialNameField);
  nameField.closest('label').after(socialNameLabel);
  const nicknameLabel = document.createElement('label');
  nicknameLabel.textContent = 'Apelido (opcional)';
  const nicknameField = document.createElement('input');
  nicknameField.name = 'nickname';
  nicknameField.placeholder = 'Como seus amigos chamam você';
  nicknameField.value = saved.nickname || '';
  nicknameLabel.appendChild(nicknameField);
  socialNameLabel.after(nicknameLabel);
  function renderAssociateName(name) {
    const displayName = socialNameField.value.trim() || nicknameField.value.trim() || name;
    if (!displayName) return;
    const profileName = document.querySelector('.profile-top b');
    if (profileName) profileName.textContent = displayName;
    const accountLink = document.querySelector('.profile-link');
    if (accountLink) accountLink.textContent = `♙  ${displayName} · Minha conta`;
  }
  if (saved.name && nameField) nameField.value = saved.name;
  renderAssociateName(nameField?.value);
  function renderAssociationDate(value) {
    if (!value) return;
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return;
    const formatted = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const dateText = document.querySelector('.profile-top small');
    if (dateText) dateText.textContent = `Associada desde ${formatted}`;
  }
  renderAssociationDate(associationDate.value);
  fetch('/api/me/profile', { headers: { Authorization: `Bearer ${sessionStorage.getItem('compex-token') || ''}` } })
    .then(response => response.ok ? response.json() : null)
    .then(profile => {
      if (!profile) return;
      if (profile.birthDate) birthDateField.value = profile.birthDate.slice(0, 10);
    }).catch(() => {});
  fetch('/api/me/subscription', { headers: { Authorization: `Bearer ${sessionStorage.getItem('compex-token') || ''}` } })
    .then(response => response.ok ? response.json() : null)
    .then(subscription => {
      if (!subscription) return;
      const labels = { ACTIVE: 'Associação ativa', PENDING: 'Associação pendente', EXPIRED: 'Associação expirada' };
      const status = document.querySelector('.profile-top .status');
      if (status) status.textContent = `● ${labels[subscription.status] || subscription.status}`;
      status?.classList.toggle('pending', subscription.status === 'PENDING');
      status?.classList.toggle('expired', subscription.status === 'EXPIRED');
    }).catch(() => {});
  document.querySelectorAll('.form-grid [name]').forEach(field => {
    if (saved[field.name] !== undefined) field.value = saved[field.name];
  });
  document.querySelectorAll('.toggle').forEach((toggle, index) => {
    if (saved.toggles?.[index] !== undefined) {
      toggle.classList.toggle('on', saved.toggles[index]);
      toggle.setAttribute('aria-pressed', String(saved.toggles[index]));
    }
  });
  const photo = document.querySelector('.photo');
  if (saved.photo) photo.style.backgroundImage = `url(${saved.photo})`;
  if (saved.photo) photo.childNodes[0].textContent = '';

  const save = document.querySelector('#save');
  save.addEventListener('click', () => {
    const settings = { toggles: [...document.querySelectorAll('.toggle')].map(toggle => toggle.classList.contains('on')) };
    document.querySelectorAll('.form-grid [name]').forEach(field => { settings[field.name] = field.value; });
    settings.photo = photo.dataset.photo || saved.photo || '';
    renderAssociateName(settings.name);
    renderAssociationDate(settings.associationDate);
    fetch('/api/me/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('compex-token') || ''}` }, body: JSON.stringify(settings) }).catch(() => {});
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch {
      save.disabled = false;
      save.textContent = 'Não foi possível salvar';
      setTimeout(() => { save.textContent = 'Salvar alterações'; }, 1800);
      return;
    }
    save.disabled = true;
    save.textContent = 'Alterações salvas ✓';
    setTimeout(() => { save.disabled = false; save.textContent = 'Salvar alterações'; }, 1600);
  });

  document.querySelector('#change-photo').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = event => {
        const image = new Image();
        image.onload = () => {
          const size = 800;
          const ratio = Math.min(1, size / Math.max(image.naturalWidth, image.naturalHeight));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(image.naturalWidth * ratio);
          canvas.height = Math.round(image.naturalHeight * ratio);
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/jpeg', .82);
          photo.style.backgroundImage = `url(${compressed})`;
          photo.dataset.photo = compressed;
          photo.childNodes[0].textContent = '';
          canvas.toBlob(blob => {
            if (!blob) return;
            const body = new FormData();
            body.append('photo', blob, 'profile.jpg');
            fetch('/api/me/photo', { method: 'POST', headers: { Authorization: `Bearer ${sessionStorage.getItem('compex-token') || ''}` }, body })
              .then(response => response.ok ? response.json() : null)
              .then(result => { if (result?.url) {
                photo.dataset.photo = result.url;
                photo.style.backgroundImage = `url(${result.url}?v=${Date.now()})`;
                const current = JSON.parse(localStorage.getItem(storageKey) || '{}');
                current.photo = result.url;
                localStorage.setItem(storageKey, JSON.stringify(current));
              } })
              .catch(() => {});
          }, 'image/jpeg', .82);
        };
        image.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
    input.click();
  });

  document.querySelector('#password-form').addEventListener('submit', event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = document.querySelector('#password-message');
    if (form.get('newPassword') !== form.get('confirmPassword')) {
      message.textContent = 'As novas senhas não coincidem.';
      message.className = 'form-message error';
      return;
    }
    message.textContent = 'Senha pronta para atualização. Clique em Salvar alterações para confirmar.';
    message.className = 'form-message success';
  });

  document.querySelector('#delete-account').addEventListener('click', event => {
    if (confirm('Tem certeza que deseja solicitar a exclusão da conta?')) {
      event.currentTarget.textContent = 'Solicitação enviada ✓';
      event.currentTarget.disabled = true;
    }
  });
})();
