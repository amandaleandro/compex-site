const form = document.querySelector('#signup-form');
const message = document.querySelector('#message');
const referralCode = new URLSearchParams(location.search).get('ref');
const birthLabel = document.createElement('label');
birthLabel.textContent = 'Data de nascimento (opcional)';
const birthInput = document.createElement('input');
birthInput.id = 'birthDate'; birthInput.type = 'date';
birthLabel.appendChild(birthInput);
document.querySelector('#registration').closest('.two').after(birthLabel);

const kindChoice = document.createElement('section');
kindChoice.className = 'membership-choice';
kindChoice.innerHTML = `<p class="eyebrow">TIPO DE PARTICIPAÇÃO</p><h3>Como você quer participar?</h3><div class="choice-plans"><label class="choice-plan selected"><input type="radio" name="membershipKind" value="SOCIO" checked><b>Sócio da atlética</b><small>Mensalidade, carteirinha, benefícios e participação nos esportes</small></label><label class="choice-plan"><input type="radio" name="membershipKind" value="AVULSO"><b>Só jogar avulso</b><small>Sem mensalidade e sem benefícios de sócio — você paga um PIX a cada treino/jogo que participar</small></label></div>`;
document.querySelector('#signup-form .card-title').after(kindChoice);

const choice = document.createElement('section');
choice.className = 'membership-choice';
choice.innerHTML = `<p class="eyebrow">SUA ASSOCIAÇÃO</p><h3>Escolha seu plano</h3><div class="choice-plans"><label class="choice-plan selected"><input type="radio" name="membershipPlan" value="TORCEDOR" data-type="TORCEDOR" data-limit="0" checked><b>Plano Torcedor</b><small>Eventos, benefícios e vida da comunidade</small></label><label class="choice-plan"><input type="radio" name="membershipPlan" value="ATLETA_1" data-type="ATLETA" data-limit="1"><b>Plano Atleta · 1 modalidade</b><small>Escolha uma modalidade esportiva</small></label><label class="choice-plan"><input type="radio" name="membershipPlan" value="ATLETA_2" data-type="ATLETA" data-limit="2"><b>Plano Atleta · 2 modalidades</b><small>Escolha até duas modalidades esportivas</small></label><label class="choice-plan"><input type="radio" name="membershipPlan" value="ATLETA_3_PLUS" data-type="ATLETA" data-limit="3"><b>Plano Atleta · 3 ou mais</b><small>Escolha no mínimo três modalidades esportivas</small></label></div><div class="plan-summary" aria-live="polite"></div><div class="sports-choice" hidden><b>Escolha suas modalidades</b><small class="sports-limit">Selecione de acordo com seu plano.</small><div class="sports-options"><label><input type="checkbox" value="Futsal"> Futsal</label><label><input type="checkbox" value="Vôlei"> Vôlei</label><label><input type="checkbox" value="Basquete"> Basquete</label><label><input type="checkbox" value="Peteca"> Peteca</label><label><input type="checkbox" value="Queimada"> Queimada</label><label><input type="checkbox" value="E-sports"> E-sports</label></div><p class="choice-error"></p></div>`;
document.querySelector('#signup-form .card-title').after(choice);

const updateChoice = () => {
  const selectedPlan = document.querySelector('[name="membershipPlan"]:checked');
  const type = selectedPlan.dataset.type;
  const plan = Number(selectedPlan.dataset.limit);
  document.querySelectorAll('.choice-plan').forEach(item => item.classList.toggle('selected', item.querySelector('input').checked));
  document.querySelector('.sports-choice').hidden = type !== 'ATLETA';
  document.querySelector('.plan-summary').textContent = type === 'TORCEDOR' ? 'Você está escolhendo o plano Torcedor.' : `Plano Atleta: escolha ${plan === 3 ? 'três ou mais' : `até ${plan}`} modalidade${plan > 1 ? 's' : ''}.`;
  document.querySelector('.sports-limit').textContent = plan === 3 ? 'Selecione três ou mais modalidades.' : `Selecione até ${plan} modalidade${plan > 1 ? 's' : ''}.`;
  document.querySelectorAll('.sports-options input').forEach(input => {
    input.disabled = type !== 'ATLETA';
    input.onchange = () => {
      const selected = document.querySelectorAll('.sports-options input:checked').length;
      if (plan < 3 && selected > plan) { input.checked = false; document.querySelector('.choice-error').textContent = `Este plano permite até ${plan} modalidade${plan > 1 ? 's' : ''}.`; }
      else document.querySelector('.choice-error').textContent = '';
    };
  });
};
document.querySelectorAll('[name="membershipPlan"]').forEach(input => input.onchange = updateChoice);
updateChoice();

const updateKind = () => {
  const isAvulso = document.querySelector('[name="membershipKind"]:checked').value === 'AVULSO';
  document.querySelectorAll('.choice-plan').forEach(item => {
    if (item.querySelector('[name="membershipKind"]')) item.classList.toggle('selected', item.querySelector('input').checked);
  });
  choice.hidden = isAvulso;
  document.querySelector('.plans').hidden = isAvulso;
  form.querySelector('button.primary').textContent = isAvulso ? 'Concluir cadastro avulso →' : 'Continuar para pagamento →';
};
document.querySelectorAll('[name="membershipKind"]').forEach(input => input.onchange = updateKind);
updateKind();
document.querySelector('#toggle-password')?.addEventListener('click', () => { const input = document.querySelector('#password'); input.type = input.type === 'password' ? 'text' : 'password'; });
document.querySelectorAll('.plan input').forEach(input => input.onchange = () => document.querySelectorAll('.plan').forEach(plan => plan.classList.toggle('selected', plan.querySelector('input').checked)));

(async function loadPublicPlans() {
  try {
    const res = await fetch('/api/plans');
    if (res.ok) {
      const plans = await res.json();
      if (Array.isArray(plans) && plans.length > 0) {
        const container = document.querySelector('.plans');
        if (container) {
          const plansTitle = container.querySelector('.plans-title');
          const included = container.querySelector('.included');
          const features = container.querySelector('.plan-features');
          const html = plans.map((p, idx) => `
            <label class="plan ${idx === 0 ? 'selected' : ''}">
              <input type="radio" name="plan" value="${p.name}" ${idx === 0 ? 'checked' : ''}>
              <span class="plan-icon">${p.icon || '☆'}</span>
              <span class="plan-copy"><b>${p.name}</b><small>${p.description || ''}</small></span>
              <strong>R$ ${p.price}<small>${p.period || ''}</small></strong>
            </label>
          `).join('');
          container.innerHTML = '';
          if (plansTitle) container.appendChild(plansTitle);
          const wrapper = document.createElement('div');
          wrapper.innerHTML = html;
          wrapper.childNodes.forEach(n => container.appendChild(n));
          if (included) container.appendChild(included);
          if (features) container.appendChild(features);
          
          document.querySelectorAll('.plan input').forEach(input => input.onchange = () => document.querySelectorAll('.plan').forEach(plan => plan.classList.toggle('selected', plan.querySelector('input').checked)));
        }
      }
    }
  } catch {}
})();

form.onsubmit = async event => {
  event.preventDefault();
  const membershipKind = document.querySelector('[name="membershipKind"]:checked').value;
  const isAvulso = membershipKind === 'AVULSO';
  const selectedPlan = document.querySelector('[name="membershipPlan"]:checked');
  const memberType = isAvulso ? 'TORCEDOR' : selectedPlan.dataset.type;
  const planLimit = Number(selectedPlan.dataset.limit);
  const selectedSports = isAvulso ? [] : [...document.querySelectorAll('.sports-options input:checked')].map(input => input.value);
  if (!isAvulso && memberType === 'ATLETA' && ((planLimit < 3 && (selectedSports.length < 1 || selectedSports.length > planLimit)) || (planLimit === 3 && selectedSports.length < 3))) { document.querySelector('.choice-error').textContent = 'Confira a quantidade de modalidades do seu plano.'; return; }
  message.textContent = isAvulso ? 'Cadastrando...' : 'Cadastro pronto. Encaminhando para o pagamento...';
  const plan = isAvulso ? 'Avulso' : selectedPlan.value;
  try {
    const response = await fetch('/api/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: document.querySelector('#name').value, email: document.querySelector('#email').value, password: document.querySelector('#password').value, course: document.querySelector('#course').value, registration: document.querySelector('#registration').value, birthDate: birthInput.value, plan, memberType, selectedSports, membershipKind, status: 'pending', referralCode }) });
    if (!response.ok) throw new Error('Não foi possível criar o cadastro.');
    const result = await response.json(); sessionStorage.setItem('compex-signup', JSON.stringify({ member: result, plan }));
    message.textContent = isAvulso ? 'Cadastro avulso concluído! Você já pode entrar. A gestão de Esportes vai te vincular à modalidade e você receberá um PIX a cada treino/jogo.' : 'Cadastro realizado. A integração de pagamento será aberta em seguida.';
  } catch (error) { message.textContent = error.message; }
};
