"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, LoaderCircle, Plus, Search, Trash2 } from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

type TaskStatus = "todo" | "doing" | "done";
type TaskPriority = "baixa" | "media" | "alta";

type Task = {
  id: string;
  title: string;
  team: string;
  owner: string | null;
  assigner: string | null;
  priority: TaskPriority;
  dueDate: string | null;
  status: TaskStatus;
  completedAt: string | null;
};

const statusLabel: Record<TaskStatus, string> = {
  todo: "A fazer",
  doing: "Em andamento",
  done: "Concluído",
};

const priorityLabel: Record<TaskPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

const priorityClass: Record<TaskPriority, string> = {
  baixa: "bg-emerald-50 text-emerald-700",
  media: "bg-amber-50 text-amber-700",
  alta: "bg-red-50 text-red-700",
};

type TaskForm = {
  title: string;
  team: string;
  owner: string;
  assigner: string;
  priority: TaskPriority;
  dueDate: string;
  status: TaskStatus;
};

const emptyTask: TaskForm = {
  title: "",
  team: "Presidência",
  owner: "",
  assigner: "",
  priority: "media",
  dueDate: "",
  status: "todo",
};

const money = (value: number | null) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function TarefasPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskForm>(emptyTask);

  const loadTasks = async () => {
    try {
      const result = await compexApi<Task[]>("/tasks");
      setTasks(Array.isArray(result) ? result : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar as tarefas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (!q) return true;
      return [task.title, task.team, task.owner || "", task.assigner || ""].join(" ").toLowerCase().includes(q);
    });
  }, [tasks, query]);

  const stats = useMemo(() => ({
    todo: tasks.filter((task) => task.status === "todo").length,
    doing: tasks.filter((task) => task.status === "doing").length,
    done: tasks.filter((task) => task.status === "done").length,
  }), [tasks]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyTask);
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    setForm({
      title: task.title,
      team: task.team,
      owner: task.owner || "",
      assigner: task.assigner || "",
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
      status: task.status,
    });
  };

  const saveTask = async () => {
    if (!form.title.trim()) {
      setError("Informe um título para a tarefa.");
      return;
    }

    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        owner: form.owner.trim() || "--",
        assigner: form.assigner.trim() || null,
        dueDate: form.dueDate || null,
      };

      if (editing) {
        await compexApi("/tasks", { method: "PUT", body: JSON.stringify({ ...payload, id: editing.id }) });
      } else {
        await compexApi("/tasks", { method: "POST", body: JSON.stringify(payload) });
      }

      setError("");
      setEditing(null);
      setForm(emptyTask);
      await loadTasks();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar a tarefa.");
    }
  };

  const changeStatus = async (taskId: string, nextStatus: TaskStatus) => {
    try {
      await compexApi("/tasks", { method: "PUT", body: JSON.stringify({ id: taskId, status: nextStatus }) });
      await loadTasks();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar a tarefa.");
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await compexApi("/tasks", { method: "DELETE", body: JSON.stringify({ id: taskId }) });
      await loadTasks();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível excluir a tarefa.");
    }
  };

  return (
    <GestaoGuard allow={["PRESIDENCIA", "ESPORTES", "FINANCEIRO", "EVENTOS", "MARKETING", "PRODUTOS", "PATRIMONIO"]}>
      <div className="mx-auto max-w-7xl px-6 py-7 sm:px-9">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Tarefas</h1>
            <p className="text-sm text-slate-500">Acompanhamento das demandas por equipe, responsável e prazo.</p>
          </div>
          <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#071745]">
            <Plus size={16} /> Nova tarefa
          </button>
        </header>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="compex-card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">A fazer</p>
            <strong className="mt-2 block text-2xl font-black text-slate-900">{stats.todo}</strong>
          </div>
          <div className="compex-card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Em andamento</p>
            <strong className="mt-2 block text-2xl font-black text-slate-900">{stats.doing}</strong>
          </div>
          <div className="compex-card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Concluídas</p>
            <strong className="mt-2 block text-2xl font-black text-slate-900">{stats.done}</strong>
          </div>
        </div>

        <div className="compex-card mb-6 p-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar tarefa, responsável ou equipe"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Carregando tarefas...
          </div>
        ) : error ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center px-6 text-sm font-medium text-red-600">{error}</div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-3">
            {(["todo", "doing", "done"] as TaskStatus[]).map((status) => (
              <div key={status} className="compex-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-600">{statusLabel[status]}</h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                    {filtered.filter((task) => task.status === status).length}
                  </span>
                </div>
                <div className="space-y-3">
                  {filtered.filter((task) => task.status === status).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center text-sm text-slate-500">
                      Nenhuma tarefa aqui.
                    </div>
                  ) : (
                    filtered.filter((task) => task.status === status).map((task) => (
                      <div key={task.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900">{task.title}</p>
                            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-blue-700">{task.team}</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${priorityClass[task.priority]}`}>
                            {priorityLabel[task.priority]}
                          </span>
                        </div>

                        <div className="mt-3 space-y-1 text-xs text-slate-600">
                          <div>Responsável: <span className="font-bold text-slate-800">{task.owner || "Sem responsável"}</span></div>
                          {task.assigner && <div>Solicitante: <span className="font-bold text-slate-800">{task.assigner}</span></div>}
                          <div>Prazo: <span className="font-bold text-slate-800">{task.dueDate ? new Date(task.dueDate).toLocaleDateString("pt-BR") : "Sem prazo"}</span></div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {status !== "todo" && (
                            <button type="button" onClick={() => changeStatus(task.id, "todo")} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50">
                              Voltar
                            </button>
                          )}
                          {status !== "doing" && (
                            <button type="button" onClick={() => changeStatus(task.id, "doing")} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50">
                              Iniciar
                            </button>
                          )}
                          {status !== "done" && (
                            <button type="button" onClick={() => changeStatus(task.id, "done")} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700">
                              Concluir
                            </button>
                          )}
                          <button type="button" onClick={() => openEdit(task)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50">
                            Editar
                          </button>
                          <button type="button" onClick={() => deleteTask(task.id)} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100">
                            <Trash2 size={12} /> Excluir
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {editing !== null || !editing ? (
          <div className="mt-6 compex-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">{editing ? "Editar tarefa" : "Nova tarefa"}</h2>
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                <CheckCircle2 size={12} /> {editing ? "Altera registro" : "Cria registro"}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-bold text-slate-700">
                Título
                <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" placeholder="Ex.: Revisar campanha do mês" />
              </label>

              <label className="block text-sm font-bold text-slate-700">
                Equipe
                <select value={form.team} onChange={(event) => setForm({ ...form, team: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
                  {['Presidência', 'Financeiro', 'Esportes', 'Eventos', 'Marketing', 'Produtos', 'Patrimônio'].map((team) => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-bold text-slate-700">
                Responsável
                <input value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" placeholder="Quem executa a tarefa" />
              </label>

              <label className="block text-sm font-bold text-slate-700">
                Solicitante
                <input value={form.assigner} onChange={(event) => setForm({ ...form, assigner: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" placeholder="Quem pediu a tarefa" />
              </label>

              <label className="block text-sm font-bold text-slate-700">
                Prioridade
                <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as TaskPriority })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </select>
              </label>

              <label className="block text-sm font-bold text-slate-700">
                Prazo
                <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
              </label>

              <label className="block text-sm font-bold text-slate-700 md:col-span-2">
                Status
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as TaskStatus })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
                  <option value="todo">A fazer</option>
                  <option value="doing">Em andamento</option>
                  <option value="done">Concluído</option>
                </select>
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => { setEditing(null); setForm(emptyTask); setError(""); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
                Limpar
              </button>
              <button type="button" onClick={saveTask} className="rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745]">
                {editing ? "Salvar alterações" : "Criar tarefa"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </GestaoGuard>
  );
}
