const { prisma } = require('../db');
const { INTERNAL_ROLES } = require('../lib/constants');
const { send, body } = require('../lib/http');
const { resolveSession, bearerToken } = require('../lib/sessions');

const WEEKDAY_LABEL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function isValidTime(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

const mapSlot = s => ({ id: s.id, userEmail: s.userEmail, weekday: s.weekday, weekdayLabel: WEEKDAY_LABEL[s.weekday], startTime: s.startTime, endTime: s.endTime });

// Cada membro cadastra sua própria disponibilidade recorrente semanal — usada só para
// sugerir horário de reunião, nunca para marcar nada automaticamente.
async function handleAvailabilityRoutes(url, req, res) {
  if (url.pathname !== '/api/availability') return false;
  if (!prisma) { send(res, 200, req.method === 'GET' ? [] : { error: 'Indisponível' }); return true; }
  const session = resolveSession(bearerToken(req));
  if (!session || !INTERNAL_ROLES.has(session.role)) { send(res, 401, { error: 'Autenticação necessária' }); return true; }

  if (req.method === 'GET') {
    // ?userEmail=... permite consultar a disponibilidade de outra pessoa (para montar reunião);
    // sem parâmetro, retorna a disponibilidade do próprio usuário.
    const userEmail = url.searchParams.get('userEmail') || session.email;
    const list = await prisma.memberAvailability.findMany({ where: { userEmail }, orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] });
    send(res, 200, list.map(mapSlot));
    return true;
  }

  if (req.method === 'POST') {
    try {
      const item = await body(req);
      const weekday = Number(item.weekday);
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) { send(res, 400, { error: 'Dia da semana inválido.' }); return true; }
      if (!isValidTime(item.startTime) || !isValidTime(item.endTime) || item.startTime >= item.endTime) {
        send(res, 400, { error: 'Informe um intervalo de horário válido (início antes do fim).' });
        return true;
      }
      const created = await prisma.memberAvailability.create({ data: { userEmail: session.email, weekday, startTime: item.startTime, endTime: item.endTime } });
      send(res, 201, mapSlot(created));
    } catch (error) { console.error('[api]', error); send(res, 400, { error: 'Erro ao processar a solicitação.' }); }
    return true;
  }

  if (req.method === 'DELETE') {
    try {
      const item = await body(req);
      await prisma.memberAvailability.deleteMany({ where: { id: item.id, userEmail: session.email } });
      send(res, 200, { ok: true });
    } catch (error) { console.error('[api]', error); send(res, 400, { error: 'Informe o id do horário.' }); }
    return true;
  }

  send(res, 405, { error: 'Método não permitido' });
  return true;
}

module.exports = { handleAvailabilityRoutes, WEEKDAY_LABEL };
