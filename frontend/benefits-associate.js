let benefits=[
  {name:'Café Byte',category:'Alimentação',discount:'10% OFF',description:'Café, lanches e encontros para recarregar.',icon:'☕'},
  {name:'Arena Sport',category:'Esporte',discount:'15% OFF',description:'Equipamentos, acessórios e materiais esportivos.',icon:'👟'},
  {name:'Gráfica Exatas',category:'Serviços',discount:'20% OFF',description:'Impressões, encadernações e materiais acadêmicos.',icon:'▣'},
  {name:'Pizza da Quadra',category:'Alimentação',discount:'R$ 10 OFF',description:'Delivery especial para dias de treino e jogo.',icon:'🍕'}
];
const cards=document.querySelector('#cards');
let currentFilter = 'Todos';
const render=(filter='Todos')=>{
  currentFilter = filter;
  cards.innerHTML=benefits.filter(item=>filter==='Todos'||item.category===filter).map((item,index)=>`<article class="benefit"><span class="benefit-icon">${item.icon || '✦'}</span><small>${(item.category || '').toUpperCase()}</small><b>${item.name}</b><p>${item.description || ''}</p><button class="use" data-index="${index}">${item.discount} · Usar benefício</button></article>`).join('')
};
document.querySelectorAll('.filters button').forEach(button=>button.onclick=()=>{document.querySelectorAll('.filters button').forEach(item=>item.classList.remove('active'));button.classList.add('active');render(button.textContent)});
const modal=document.querySelector('#modal');const closeModal=()=>modal.classList.remove('open');document.querySelector('#close').onclick=closeModal;modal.addEventListener('click',event=>{if(event.target===modal)closeModal()});
cards.onclick=event=>{const button=event.target.closest('[data-index]');if(!button)return;const item=benefits[button.dataset.index];document.querySelector('#modal-icon').textContent=item.icon || '✦';document.querySelector('#modal-name').textContent=item.name;document.querySelector('#modal-discount').textContent=item.discount;modal.classList.add('open')};

(async function () {
  try {
    const bRes = await fetch('/api/benefits');
    if (bRes.ok) {
      const data = await bRes.json();
      if (Array.isArray(data) && data.length > 0) benefits = data;
    }
  } catch {}

  const token = sessionStorage.getItem('compex-token');
  try {
    const response = await fetch('/api/me/profile', { headers: { Authorization: `Bearer ${token || ''}` } });
    if (!response.ok) { render(currentFilter); return; }
    const profile = await response.json();
    if (profile.membershipKind === 'AVULSO') {
      document.querySelector('.filters').hidden = true;
      cards.innerHTML = '<p style="padding:24px;color:#718096">Benefícios de parceiros são exclusivos para sócios. Seu cadastro é avulso (paga por treino/jogo) — <a href="associate-signup.html">torne-se sócio</a> para desbloquear.</p>';
      return;
    }
    render(currentFilter);
  } catch { render(currentFilter); }
})();
