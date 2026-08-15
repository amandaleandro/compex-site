"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Plus, Trophy, Trash2 } from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

type Game = {
  id: string;
  championshipId: string;
  opponentName: string;
  date: string;
  location: string | null;
  status: "AGENDADO" | "REALIZADO";
  ourScore: number | null;
  opponentScore: number | null;
  notes: string | null;
};

type Championship = {
  id: string;
  name: string;
  sport: string;
  season: string | null;
  status: "EM_ANDAMENTO" | "FINALIZADO" | "PROXIMO";
  placement: string | null;
  isTitle: boolean;
  notes: string | null;
  games: Game[];
};

const statusLabel: Record<Championship["status"], string> = {
  EM_ANDAMENTO: "Em andamento",
  FINALIZADO: "Finalizado",
  PROXIMO: "Próximo",
};

const statusClass: Record<Championship["status"], string> = {
  EM_ANDAMENTO: "bg-blue-50 text-blue-700",
  FINALIZADO: "bg-slate-100 text-slate-600",
  PROXIMO: "bg-amber-50 text-amber-700",
};

const initialChampionship = {
  name: "",
  sport: "",
  season: "",
  status: "PROXIMO" as Championship["status"],
  placement: "",
  isTitle: false,
  notes: "",
};

const initialGame = {
  championshipId: "",
  opponentName: "",
  date: "",
  location: "",
  ourScore: "",
  opponentScore: "",
};

export default function CampeonatosPage() {
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialChampionship);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [gameForm, setGameForm] = useState(initialGame);
  const [gameFormError, setGameFormError] = useState("");
  const [savingGame, setSavingGame] = useState(false);

  const loadData = async () => {
    try {
      const list = await compexApi<Championship[]>("/championships");
      setChampionships(Array.isArray(list) ? list : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar os campeonatos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveChampionship = async () => {
    if (!form.name.trim() || !form.sport.trim()) {
      setFormError("Informe o nome e a modalidade do campeonato.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await compexApi("/championships", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          sport: form.sport.trim(),
          season: form.season.trim() || null,
          status: form.status,
          placement: form.placement.trim() || null,
          isTitle: form.isTitle,
          notes: form.notes.trim() || null,
        }),
      });
      setForm(initialChampionship);
      await loadData();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Não foi possível salvar o campeonato.");
    } finally {
      setSaving(false);
    }
  };

  const deleteChampionship = async (id: string) => {
    try {
      await compexApi("/championships", { method: "DELETE", body: JSON.stringify({ id }) });
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível excluir o campeonato.");
    }
  };

  const saveGame = async () => {
    if (!gameForm.championshipId || !gameForm.opponentName.trim() || !gameForm.date) {
      setGameFormError("Selecione o campeonato, o adversário e a data.");
      return;
    }
    setSavingGame(true);
    setGameFormError("");
    try {
      await compexApi("/championship-games", {
        method: "POST",
        body: JSON.stringify({
          championshipId: gameForm.championshipId,
          opponentName: gameForm.opponentName.trim(),
          date: gameForm.date,
          location: gameForm.location.trim() || null,
          status: "AGENDADO",
          ourScore: gameForm.ourScore || null,
          opponentScore: gameForm.opponentScore || null,
        }),
      });
      setGameForm(initialGame);
      await loadData();
    } catch (reason) {
      setGameFormError(reason instanceof Error ? reason.message : "Não foi possível salvar o jogo.");
    } finally {
      setSavingGame(false);
    }
  };

  const deleteGame = async (id: string) => {
    try {
      await compexApi("/championship-games", { method: "DELETE", body: JSON.stringify({ id }) });
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível excluir o jogo.");
    }
  };

  return (
    <GestaoGuard allow={["PRESIDENCIA", "ESPORTES"]}>
      <div className="mx-auto max-w-7xl px-6 py-7 sm:px-9">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Campeonatos</h1>
            <p className="text-sm text-slate-500">Competições, colocações e jogos das modalidades da atlética.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            <Trophy size={16} className="text-blue-700" />
            <span>{championships.length} campeonatos</span>
          </div>
        </header>

        <div className="mb-6 grid gap-4 xl:grid-cols-2">
          <div className="compex-card p-5">
            <h2 className="mb-4 text-lg font-black text-slate-900">Novo campeonato</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-bold text-slate-700">
                Nome
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
              </label>
              <label className="block text-sm font-bold text-slate-700">
                Modalidade
                <input value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
              </label>
              <label className="block text-sm font-bold text-slate-700">
                Temporada
                <input value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" placeholder="Ex.: 2026" />
              </label>
              <label className="block text-sm font-bold text-slate-700">
                Status
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Championship["status"] })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
                  <option value="PROXIMO">Próximo</option>
                  <option value="EM_ANDAMENTO">Em andamento</option>
                  <option value="FINALIZADO">Finalizado</option>
                </select>
              </label>
              <label className="block text-sm font-bold text-slate-700">
                Colocação
                <input value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" placeholder="Ex.: Campeão, 2º lugar..." />
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <input type="checkbox" checked={form.isTitle} onChange={(e) => setForm({ ...form, isTitle: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                Foi título
              </label>
              <label className="block text-sm font-bold text-slate-700 sm:col-span-2">
                Observações
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
              </label>
            </div>
            {formError && <p className="mt-3 text-sm font-medium text-red-600">{formError}</p>}
            <div className="mt-4 flex justify-end">
              <button type="button" disabled={saving} onClick={saveChampionship} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745] disabled:opacity-60">
                <Plus size={16} /> {saving ? "Salvando..." : "Cadastrar campeonato"}
              </button>
            </div>
          </div>

          <div className="compex-card p-5">
            <h2 className="mb-4 text-lg font-black text-slate-900">Novo jogo</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-bold text-slate-700 sm:col-span-2">
                Campeonato
                <select value={gameForm.championshipId} onChange={(e) => setGameForm({ ...gameForm, championshipId: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
                  <option value="">Selecione...</option>
                  {championships.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-bold text-slate-700">
                Adversário
                <input value={gameForm.opponentName} onChange={(e) => setGameForm({ ...gameForm, opponentName: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
              </label>
              <label className="block text-sm font-bold text-slate-700">
                Data
                <input type="date" value={gameForm.date} onChange={(e) => setGameForm({ ...gameForm, date: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
              </label>
              <label className="block text-sm font-bold text-slate-700">
                Local
                <input value={gameForm.location} onChange={(e) => setGameForm({ ...gameForm, location: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
              </label>
              <label className="block text-sm font-bold text-slate-700">
                Placar (nós)
                <input value={gameForm.ourScore} onChange={(e) => setGameForm({ ...gameForm, ourScore: e.target.value })} inputMode="numeric" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
              </label>
              <label className="block text-sm font-bold text-slate-700">
                Placar (adversário)
                <input value={gameForm.opponentScore} onChange={(e) => setGameForm({ ...gameForm, opponentScore: e.target.value })} inputMode="numeric" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
              </label>
            </div>
            {gameFormError && <p className="mt-3 text-sm font-medium text-red-600">{gameFormError}</p>}
            <div className="mt-4 flex justify-end">
              <button type="button" disabled={savingGame} onClick={saveGame} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745] disabled:opacity-60">
                <Plus size={16} /> {savingGame ? "Salvando..." : "Cadastrar jogo"}
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Carregando campeonatos...
          </div>
        ) : error ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center px-6 text-sm font-medium text-red-600">{error}</div>
        ) : championships.length === 0 ? (
          <div className="compex-card p-6 text-sm text-slate-500">Nenhum campeonato cadastrado.</div>
        ) : (
          <div className="space-y-4">
            {championships.map((c) => (
              <div key={c.id} className="compex-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">{c.sport}{c.season ? ` · ${c.season}` : ""}</div>
                    <h2 className="mt-1 flex items-center gap-2 text-xl font-black text-slate-900">
                      {c.name}
                      {c.isTitle && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Título</span>}
                    </h2>
                    {c.placement && <div className="text-sm text-slate-600">{c.placement}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClass[c.status]}`}>{statusLabel[c.status]}</span>
                    <button type="button" onClick={() => deleteChampionship(c.id)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100">
                      <Trash2 size={12} /> Excluir
                    </button>
                  </div>
                </div>

                {c.games.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {c.games.map((game) => (
                      <div key={game.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                        <div>
                          <div className="font-bold text-slate-900">vs. {game.opponentName}</div>
                          <div className="text-xs text-slate-500">{new Date(game.date).toLocaleDateString("pt-BR")} · {game.location || "Local a definir"}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          {(game.ourScore !== null || game.opponentScore !== null) && (
                            <span className="font-black text-slate-900">{game.ourScore ?? "-"} x {game.opponentScore ?? "-"}</span>
                          )}
                          <button type="button" onClick={() => deleteGame(game.id)} className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-700 hover:bg-red-100">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </GestaoGuard>
  );
}
