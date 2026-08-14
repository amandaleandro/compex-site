const { prisma } = require('../db');

const LEVELS = [
  { name: 'Calouro', min: 0, next: 300 },
  { name: 'Parte da Matilha', min: 300, next: 700 },
  { name: 'Destaque Compex', min: 700, next: 1500 },
  { name: 'Lenda Compex', min: 1500, next: null },
];

const REASON_LABELS = {
  MENSALIDADE_EM_DIA: 'Mensalidade em dia',
  EVENTO_PRESENCA: 'Presença em evento',
  TREINO_INSCRICAO: 'Inscrição em modalidade',
  TREINO_PRESENCA: 'Presença em treino',
  COMPRA_LOJA: 'Compra na loja',
  ENGAJAMENTO_SOCIAL: 'Engajamento com a comunidade',
  AJUSTE_ADMINISTRATIVO: 'Ajuste administrativo',
};

function levelFor(total) {
  return [...LEVELS].reverse().find(level => total >= level.min) || LEVELS[0];
}

async function awardPoints(memberId, reason, points, note) {
  if (!prisma || !memberId || !points || !note) return null;
  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { membershipKind: true } });
  if (!member || member.membershipKind !== 'SOCIO') return null;
  const existing = await prisma.pointsEntry.findFirst({ where: { memberId, reason, note } });
  if (existing) return existing;
  return prisma.pointsEntry.create({ data: { memberId, reason, points, note } });
}

async function gamificationFor(member) {
  const entries = await prisma.pointsEntry.findMany({ where: { memberId: member.id }, orderBy: { createdAt: 'desc' } });
  const total = entries.reduce((sum, entry) => sum + entry.points, 0);
  const grouped = await prisma.pointsEntry.groupBy({
    by: ['memberId'],
    where: { member: { membershipKind: 'SOCIO' } },
    _sum: { points: true },
    orderBy: { _sum: { points: 'desc' } },
  });
  const memberIds = grouped.slice(0, 10).map(item => item.memberId);
  const rankedMembers = await prisma.member.findMany({
    where: { id: { in: memberIds } },
    include: { user: true },
  });
  const byId = new Map(rankedMembers.map(item => [item.id, item]));
  const ranking = grouped.slice(0, 10).map((item, index) => {
    const ranked = byId.get(item.memberId);
    const name = ranked?.nickname || ranked?.socialName || ranked?.user.name.split(/\s+/).slice(0, 2).join(' ') || 'Sócio Compex';
    const points = item._sum.points || 0;
    return { position: index + 1, name, course: ranked?.course || 'Curso não informado', points, level: levelFor(points).name, isCurrent: item.memberId === member.id };
  });
  const position = grouped.findIndex(item => item.memberId === member.id) + 1;
  const level = levelFor(total);
  const progress = level.next ? Math.min(100, Math.max(0, ((total - level.min) / (level.next - level.min)) * 100)) : 100;
  const reasons = new Set(entries.map(entry => entry.reason));
  const achievements = [
    { id: 'first-points', name: 'Primeiros passos', description: 'Conquistou os primeiros pontos.', unlocked: total > 0 },
    { id: 'event', name: 'Presença confirmada', description: 'Fez check-in em um evento da CompExatas.', unlocked: reasons.has('EVENTO_PRESENCA') },
    { id: 'training', name: 'Firme no treino', description: 'Participou de um treino oficial.', unlocked: reasons.has('TREINO_PRESENCA') },
    { id: 'supporter', name: 'Fortalece a matilha', description: 'Chegou a 700 pontos.', unlocked: total >= 700 },
  ];
  return {
    total, position: position || null, level: level.name, nextLevel: LEVELS[LEVELS.indexOf(level) + 1]?.name || null,
    nextLevelAt: level.next, progress: Math.round(progress),
    history: entries.slice(0, 30).map(entry => ({ id: entry.id, reason: entry.reason, label: REASON_LABELS[entry.reason] || entry.reason, points: entry.points, note: entry.note, createdAt: entry.createdAt })),
    ranking, achievements,
  };
}

module.exports = { awardPoints, gamificationFor, LEVELS, REASON_LABELS };
