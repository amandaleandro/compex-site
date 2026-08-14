function authHeaders() {
  const token = sessionStorage.getItem('compex-token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` };
}

const modeSelect = document.querySelector('#checkin-mode');
const trainingField = document.querySelector('#training-session-field');
const trainingSelect = document.querySelector('#training-session');
let activeContext = null;
let currentRole = null;

async function configureAccess() {
  const response = await fetch('/api/auth/session', { headers: authHeaders() });
  const data = response.ok ? await response.json() : null;
  currentRole = data?.user?.role || null;
  const eventOption = modeSelect.querySelector('option[value="event"]');
  const trainingOption = modeSelect.querySelector('option[value="training"]');
  if (currentRole === 'ESPORTES') { eventOption.disabled = true; modeSelect.value = 'training'; }
  if (currentRole === 'EVENTOS') { trainingOption.disabled = true; modeSelect.value = 'event'; }
  if (!['PRESIDENCIA', 'ESPORTES'].includes(currentRole)) trainingOption.disabled = true;
  trainingField.style.display = modeSelect.value === 'training' ? 'grid' : 'none';
}

async function loadCheckins() {
  if (modeSelect.value === 'training') {
    const query = trainingSelect.value ? `?sessionId=${encodeURIComponent(trainingSelect.value)}` : '';
    const response = await fetch(`/api/training-checkins${query}`, { headers: authHeaders() });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os treinos.');
    return data;
  }
  const response = await fetch('/api/checkins', { headers: authHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível carregar o evento.');
  return data;
}

function setTrainingOptions(sessions) {
  const previous = trainingSelect.value;
  trainingSelect.innerHTML = sessions.map(item => `<option value="${item.id}">${item.teamName} · ${new Date(item.date).toLocaleDateString('pt-BR')}${item.location ? ` · ${item.location}` : ''}</option>`).join('') || '<option value="">Nenhum treino cadastrado</option>';
  if (previous && sessions.some(item => item.id === previous)) trainingSelect.value = previous;
}

async function render() {
  const liveLabel = document.querySelector('.live');
  const eventTitle = document.querySelector('.event-info h2');
  const eventDate = document.querySelector('.event-info p:last-child');
  try {
    const data = await loadCheckins();
    if (modeSelect.value === 'training') {
      setTrainingOptions(data.sessions || []);
      activeContext = data.training;
      if (activeContext) {
        trainingSelect.value = activeContext.id;
        liveLabel.textContent = `● ${activeContext.name.toUpperCase()} · TREINO SELECIONADO`;
        eventTitle.textContent = activeContext.name;
        eventDate.textContent = `${new Date(activeContext.date).toLocaleDateString('pt-BR')}${activeContext.location ? ' · ' + activeContext.location : ''}`;
      } else {
        liveLabel.textContent = '● Nenhum treino cadastrado';
        eventTitle.textContent = 'Sem treino disponível';
        eventDate.textContent = 'Cadastre um treino em Esportes para liberar a leitura do QR Code.';
      }
    } else {
      activeContext = data.event;
      if (activeContext) {
        liveLabel.textContent = `● ${activeContext.name.toUpperCase()} · AO VIVO`;
        eventTitle.textContent = activeContext.name;
        eventDate.textContent = `${new Date(activeContext.date).toLocaleDateString('pt-BR')}${activeContext.location ? ' · ' + activeContext.location : ''}`;
      } else {
        liveLabel.textContent = '● Nenhum evento publicado';
        eventTitle.textContent = 'Sem evento ativo';
        eventDate.textContent = 'Publique um evento para liberar o check-in.';
      }
    }
    document.querySelector('#total').textContent = data.total ?? 0;
    document.querySelector('#confirmed').textContent = data.confirmed ?? '--';
    document.querySelector('#waiting').textContent = data.waiting ?? '--';
    document.querySelector('#recent-list').innerHTML = (data.recent || []).map(item => `<div><span class="avatar lime">${item.name.split(' ').map(word => word[0]).slice(0, 2).join('').toUpperCase()}</span><p><b>${item.name}</b><small>${item.course}${item.checkedBy ? ` · Validado por ${item.checkedBy}` : ''}</small></p><time>${new Date(item.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time></div>`).join('') || '<p>Nenhuma presença confirmada ainda.</p>';
  } catch (error) {
    activeContext = null;
    liveLabel.textContent = '● Acesso indisponível';
    eventTitle.textContent = 'Não foi possível abrir o check-in';
    eventDate.textContent = error.message;
  }
}

modeSelect.onchange = () => {
  trainingField.style.display = modeSelect.value === 'training' ? 'grid' : 'none';
  activeContext = null;
  render();
};
trainingSelect.onchange = () => render();

const video = document.querySelector('#video');
const placeholder = document.querySelector('#camera-placeholder');
const cameraStatus = document.querySelector('#camera-status');
let stream = null;
document.querySelector('#start-camera').onclick = async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    await video.play();
    video.classList.add('active');
    placeholder.style.display = 'none';
    cameraStatus.textContent = 'Câmera ativa';
    cameraStatus.style.color = '#78910c';
    scanning = true;
    requestAnimationFrame(scanLoop);
  } catch { cameraStatus.textContent = 'Câmera indisponível'; cameraStatus.style.color = '#b6664b'; }
};
document.querySelector('#stop-camera').onclick = () => {
  scanning = false;
  stream?.getTracks().forEach(track => track.stop());
  video.classList.remove('active');
  placeholder.style.display = 'grid';
  cameraStatus.textContent = 'Câmera pronta';
};

let validating = false;
async function validateCode(code) {
  const result = document.querySelector('#result');
  if (validating) return;
  if (!code) { result.innerHTML = '<span>!</span><div><b>Digite um código</b><small>Informe o QR Code da carteirinha.</small></div>'; return; }
  if (!activeContext) { result.innerHTML = '<span>!</span><div><b>Nenhuma atividade selecionada</b><small>Selecione um evento ou treino antes da leitura.</small></div>'; return; }
  validating = true;
  try {
    const trainingMode = modeSelect.value === 'training';
    const endpoint = trainingMode ? '/api/training-checkins' : '/api/checkins';
    const payload = trainingMode ? { sessionId: activeContext.id, code } : { eventId: activeContext.id, code };
    const response = await fetch(endpoint, { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { result.innerHTML = `<span>!</span><div><b>Presença não confirmada</b><small>${data.error || 'Confira a carteirinha e tente novamente.'}</small></div>`; return; }
    if (data.alreadyCheckedIn) { result.innerHTML = `<span>!</span><div><b>Já validado</b><small>${data.member.name} já teve a presença confirmada nesta atividade.</small></div>`; return; }
    const pointsText = trainingMode && data.pointsAwarded ? ' · +50 pontos' : '';
    result.innerHTML = `<span>✓</span><div><b>Presença confirmada</b><small>${data.member.name}${pointsText} · Agora</small></div>`;
    await render();
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

configureAccess().then(render);
