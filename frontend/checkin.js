function authHeaders() {
  const token = sessionStorage.getItem('compex-token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` };
}

let activeEvent = null;

async function loadCheckins() {
  const response = await fetch('/api/checkins', { headers: authHeaders() });
  if (!response.ok) return { event: null, total: 0, recent: [] };
  return response.json();
}

async function render() {
  const data = await loadCheckins();
  activeEvent = data.event;
  const liveLabel = document.querySelector('.live');
  const eventTitle = document.querySelector('.event-info h2');
  const eventDate = document.querySelector('.event-info p:last-child');
  if (activeEvent) {
    liveLabel.textContent = `● ${activeEvent.name.toUpperCase()} · AO VIVO`;
    eventTitle.innerHTML = activeEvent.name;
    eventDate.textContent = `${new Date(activeEvent.date).toLocaleDateString('pt-BR')}${activeEvent.location ? ' · ' + activeEvent.location : ''}`;
  } else {
    liveLabel.textContent = '● Nenhum evento publicado';
    eventTitle.textContent = 'Sem evento ativo';
    eventDate.textContent = 'Publique um evento em Eventos para liberar o check-in.';
  }
  document.querySelector('#total').textContent = data.total;
  document.querySelector('#confirmed').textContent = data.confirmed ?? '--';
  document.querySelector('#waiting').textContent = data.waiting ?? '--';
  document.querySelector('#recent-list').innerHTML = data.recent.map(r => `<div><span class="avatar lime">${r.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</span><p><b>${r.name}</b><small>Associado · ${r.course}</small></p><time>${new Date(r.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time></div>`).join('') || '<p>Nenhum check-in ainda.</p>';
}

const video = document.querySelector('#video');
const placeholder = document.querySelector('#camera-placeholder');
const status = document.querySelector('#camera-status');
let stream = null;
document.querySelector('#start-camera').onclick = async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    video.classList.add('active');
    placeholder.style.display = 'none';
    status.textContent = 'Câmera ativa';
    status.style.color = '#78910c';
    scanning = true;
    requestAnimationFrame(scanLoop);
  } catch { status.textContent = 'Câmera indisponível'; status.style.color = '#b6664b'; }
};
document.querySelector('#stop-camera').onclick = () => {
  scanning = false;
  stream?.getTracks().forEach(track => track.stop());
  video.classList.remove('active');
  placeholder.style.display = 'grid';
  status.textContent = 'Câmera pronta';
};

let validating = false;
async function validateCode(code) {
  const result = document.querySelector('#result');
  if (validating) return;
  if (!code) { result.innerHTML = '<span>!</span><div><b>Digite um código</b><small>Informe o QR Code do participante.</small></div>'; return; }
  if (!activeEvent) { result.innerHTML = '<span>!</span><div><b>Nenhum evento ativo</b><small>Publique um evento para liberar o check-in.</small></div>'; return; }
  validating = true;
  try {
    const response = await fetch('/api/checkins', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ eventId: activeEvent.id, code }) });
    const data = await response.json();
    if (!response.ok) { result.innerHTML = `<span>!</span><div><b>Código não encontrado</b><small>${data.error || 'Confira a carteirinha do associado.'}</small></div>`; return; }
    if (data.alreadyCheckedIn) { result.innerHTML = `<span>!</span><div><b>Já validado</b><small>${data.member.name} já entrou.</small></div>`; return; }
    result.innerHTML = `<span>✓</span><div><b>Entrada autorizada</b><small>${data.member.name} · Agora</small></div>`;
    render();
  } finally {
    document.querySelector('#code').value = '';
    setTimeout(() => { validating = false; }, 1500);
  }
}

document.querySelector('#validate').onclick = () => validateCode(document.querySelector('#code').value.trim());

const canvas = document.querySelector('#scan-canvas');
const canvasCtx = canvas.getContext('2d', { willReadFrequently: true });
let scanning = false;
function scanLoop() {
  if (!scanning) return;
  if (video.readyState === video.HAVE_ENOUGH_DATA && window.jsQR) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvasCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = canvasCtx.getImageData(0, 0, canvas.width, canvas.height);
    const qr = window.jsQR(frame.data, frame.width, frame.height);
    if (qr && qr.data && !validating) validateCode(qr.data.trim());
  }
  requestAnimationFrame(scanLoop);
}

render();
