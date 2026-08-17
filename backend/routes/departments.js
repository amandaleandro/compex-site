const { prisma } = require('../db');
const { INTERNAL_ROLES } = require('../lib/constants');
const { send, body } = require('../lib/http');
const { resolveSession, bearerToken, canManageAccounts } = require('../lib/sessions');
const { logAudit } = require('../lib/audit');

const DEPARTMENTS = ['Presidência', 'Financeiro', 'Esportes', 'Eventos', 'Marketing', 'Produtos', 'Patrimônio'];
const mapPlan = p => ({ ...p, dueDate: p.dueDate ? p.dueDate.toISOString() : null, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() });

// GET /api/department-indicators — % de tarefas concluídas por departamento, calculado
// a partir do Task existente (sem duplicar dado num contador à parte).
async function handleDepartmentIndicators(url, req, res) {
  if (url.pathname !== '/api/department-indicators' || req.method !== 'GET') return false;
  if (!prisma) { send(res, 200, []); return true; }
  const session = resolveSession(bearerToken(req));
  if (!session || !INTERNAL_ROLES.has(session.role)) { send(res, 401, { error: 'Autenticação necessária' }); return true; }

  const tasks = await prisma.task.findMany();
  const indicators = DEPARTMENTS.map(department => {
    const deptTasks = tasks.filter(t => t.team === department);
    const done = deptTasks.filter(t => t.status === 'done').length;
    const overdue = deptTasks.filter(t => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date()).length;
    return { department, totalTasks: deptTasks.length, doneTasks: done, overdueTasks: overdue, progress: deptTasks.length ? Math.round((done / deptTasks.length) * 100) : 0 };
  });
  send(res, 200, indicators);
  return true;
}

async function handleDepartmentPlans(url, req, res) {
  if (url.pathname !== '/api/department-plans') return false;
  if (!prisma) { send(res, 200, req.method === 'GET' ? [] : { error: 'Indisponível' }); return true; }
  const session = resolveSession(bearerToken(req));
  if (!session || !INTERNAL_ROLES.has(session.role)) { send(res, 401, { error: 'Autenticação necessária' }); return true; }

  if (req.method === 'GET') {
    const department = new URL(req.url, 'http://internal').searchParams.get('department');
    const list = await prisma.departmentPlan.findMany({ where: department ? { department } : undefined, orderBy: { createdAt: 'desc' } });
    send(res, 200, list.map(mapPlan));
    return true;
  }

  if (req.method === 'POST') {
    try {
      const item = await body(req);
      if (!item.department || !item.objective || !item.semester) { send(res, 400, { error: 'Informe departamento, semestre e objetivo.' }); return true; }
      const created = await prisma.departmentPlan.create({
        data: {
          department: item.department, semester: item.semester, objective: item.objective,
          actions: Array.isArray(item.actions) ? item.actions : undefined, responsible: item.responsible || null,
          dueDate: item.dueDate ? new Date(item.dueDate) : null, createdByName: session.name,
        },
      });
      await logAudit({ session, action: 'department_plan.create', entity: 'DepartmentPlan', entityId: created.id, after: mapPlan(created) });
      send(res, 201, mapPlan(created));
    } catch (error) { console.error('[api]', error); send(res, 400, { error: 'Erro ao processar a solicitação.' }); }
    return true;
  }

  if (req.method === 'PUT') {
    if (!canManageAccounts(session)) { send(res, 403, { error: 'Somente diretor(a) do departamento ou presidência pode editar o planejamento.' }); return true; }
    try {
      const item = await body(req);
      const current = await prisma.departmentPlan.findUnique({ where: { id: item.id } });
      if (!current) { send(res, 404, { error: 'Planejamento não encontrado' }); return true; }
      const data = {};
      if (item.objective !== undefined) data.objective = item.objective;
      if (item.actions !== undefined) data.actions = item.actions;
      if (item.responsible !== undefined) data.responsible = item.responsible || null;
      if (item.dueDate !== undefined) data.dueDate = item.dueDate ? new Date(item.dueDate) : null;
      if (item.status !== undefined) data.status = item.status;
      const updated = await prisma.departmentPlan.update({ where: { id: item.id }, data });
      await logAudit({ session, action: 'department_plan.update', entity: 'DepartmentPlan', entityId: item.id, before: mapPlan(current), after: mapPlan(updated) });
      send(res, 200, mapPlan(updated));
    } catch (error) { console.error('[api]', error); send(res, 400, { error: 'Erro ao processar a solicitação.' }); }
    return true;
  }

  if (req.method === 'DELETE') {
    if (!canManageAccounts(session)) { send(res, 403, { error: 'Somente diretor(a) do departamento ou presidência pode excluir o planejamento.' }); return true; }
    try {
      const item = await body(req);
      const removed = await prisma.departmentPlan.delete({ where: { id: item.id } });
      await logAudit({ session, action: 'department_plan.delete', entity: 'DepartmentPlan', entityId: item.id, before: mapPlan(removed) });
      send(res, 200, { ok: true });
    } catch (error) { console.error('[api]', error); send(res, 400, { error: 'Informe o id do planejamento' }); }
    return true;
  }

  send(res, 405, { error: 'Método não permitido' });
  return true;
}

async function handleDepartmentRoutes(url, req, res) {
  if (await handleDepartmentIndicators(url, req, res)) return true;
  if (await handleDepartmentPlans(url, req, res)) return true;
  return false;
}

module.exports = { handleDepartmentRoutes };
