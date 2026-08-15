"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, LoaderCircle, Plus, Trophy } from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

type Team = {
  id: string;
  name: string;
  sport: string;
  gender: "MASCULINO" | "FEMININO" | "MISTA";
  trainingDay: string | null;
  description: string | null;
  dropInPriceCents: number | null;
  sessionCount: number;
  enrollmentCount: number;
};

type TeamSession = {
  id: string;
  teamId: string;
  teamName: string;
  type: "TREINO" | "JOGO";
  date: string;
  location: string | null;
  coachName: string | null;
  coachCost: number | null;
  refereeName: string | null;
  refereeCost: number | null;
  notes: string | null;
};

const genderLabel: Record<Team["gender"], string> = {
  MASCULINO: "Masculino",
  FEMININO: "Feminino",
  MISTA: "Mista",
};

const money = (value: number | null) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const initialTeam = {
  name: "",
  sport: "",
  gender: "MISTA" as Team["gender"],
  trainingDay: "",
  description: "",
  dropInPrice: "",
};

const initialSession = {
  teamId: "",
  type: "TREINO" as TeamSession["type"],
  date: "",
  location: "",
  coachName: "",
};

export default function EsportesPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [sessionsByTeam, setSessionsByTeam] = useState<Record<string, TeamSession[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [teamForm, setTeamForm] = useState(initialTeam);
  const [teamFormError, setTeamFormError] = useState("");
  const [savingTeam, setSavingTeam] = useState(false);
  const [sessionForm, setSessionForm] = useState(initialSession);
  const [sessionFormError, setSessionFormError] = useState("");
  const [savingSession, setSavingSession] = useState(false);

  const loadData = async () => {
    try {
      const list = await compexApi<Team[]>("/modalities");
      setTeams(Array.isArray(list) ? list : []);

      const mapped = await Promise.all(
        (Array.isArray(list) ? list : []).map(async (team) => {
          const sessionList = await compexApi<TeamSession[]>(`/team-sessions?teamId=${team.id}`);
          return [team.id, Array.isArray(sessionList) ? sessionList : []] as const;
        }),
      );

      const byTeam = Object.fromEntries(mapped);
      setSessionsByTeam(byTeam);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar o módulo de esportes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveTeam = async () => {
    if (!teamForm.name.trim() || !teamForm.sport.trim()) {
      setTeamFormError("Informe o nome e a modalidade.");
      return;
    }

    setSavingTeam(true);
    setTeamFormError("");
    try {
      await compexApi("/modalities", {
        method: "POST",
        body: JSON.stringify({
          name: teamForm.name.trim(),
          sport: teamForm.sport.trim(),
          gender: teamForm.gender,
          trainingDay: teamForm.trainingDay.trim() || null,
          description: teamForm.description.trim() || null,
          dropInPrice: teamForm.dropInPrice ? Number(teamForm.dropInPrice.replace(",", ".")) : null,
        }),
      });
      setTeamForm(initialTeam);
      await loadData();
    } catch (reason) {
      setTeamFormError(reason instanceof Error ? reason.message : "Não foi possível salvar a modalidade.");
    } finally {
      setSavingTeam(false);
    }
  };

  const saveSession = async () => {
    if (!sessionForm.teamId || !sessionForm.date) {
      setSessionFormError("Selecione a modalidade e a data.");
      return;
    }

    setSavingSession(true);
    setSessionFormError("");
    try {
      await compexApi("/team-sessions", {
        method: "POST",
        body: JSON.stringify({
          teamId: sessionForm.teamId,
          type: sessionForm.type,
          date: sessionForm.date,
          location: sessionForm.location.trim() || null,
          coachName: sessionForm.coachName.trim() || null,
        }),
      });
      setSessionForm(initialSession);
      await loadData();
    } catch (reason) {
      setSessionFormError(reason instanceof Error ? reason.message : "Não foi possível salvar o treino/jogo.");
    } finally {
      setSavingSession(false);
    }
  };

  const totalSessions = useMemo(() => Object.values(sessionsByTeam).reduce((sum, list) => sum + list.length, 0), [sessionsByTeam]);
  const upcoming = useMemo(() => {
    const list = Object.values(sessionsByTeam).flat();
    return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 6);
  }, [sessionsByTeam]);

  return (
    <GestaoGuard allow={["PRESIDENCIA", "ESPORTES"]}>
      <div className="mx-auto max-w-7xl px-6 py-7 sm:px-9">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Esportes</h1>
            <p className="text-sm text-slate-500">Modalidades, treinos, jogos e calendário operacional da equipe esportiva.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            <Trophy size={16} className="text-blue-700" />
            <span>{teams.length} modalidades</span>
          </div>
        </header>

        <div className="mb-6 grid gap-4 xl:grid-cols-2">
          <div className="compex-card p-5">
            <h2 className="mb-4 text-lg font-black text-slate-900">Nova modalidade</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-bold text-slate-700">
                Nome
                <input value={teamForm.name} onChange={(event) => setTeamForm({ ...teamForm, name: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
              </label>
              <label className="block text-sm font-bold text-slate-700">
                Esporte
                <input value={teamForm.sport} onChange={(event) => setTeamForm({ ...teamForm, sport: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
              </label>
              <label className="block text-sm font-bold text-slate-700">
                Gênero
                <select value={teamForm.gender} onChange={(event) => setTeamForm({ ...teamForm, gender: event.target.value as Team["gender"] })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
                  <option value="MASCULINO">Masculino</option>
                  <option value="FEMININO">Feminino</option>
                  <option value="MISTA">Mista</option>
                </select>
              </label>
              <label className="block text-sm font-bold text-slate-700">
                Dia de treino
                <input value={teamForm.trainingDay} onChange={(event) => setTeamForm({ ...teamForm, trainingDay: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" placeholder="Ex.: Terças e quintas" />
              </label>
              <label className="block text-sm font-bold text-slate-700 sm:col-span-2">
                Valor do avulso (opcional)
                <input value={teamForm.dropInPrice} onChange={(event) => setTeamForm({ ...teamForm, dropInPrice: event.target.value })} inputMode="decimal" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" placeholder="0,00" />
              </label>
              <label className="block text-sm font-bold text-slate-700 sm:col-span-2">
                Descrição
                <textarea value={teamForm.description} onChange={(event) => setTeamForm({ ...teamForm, description: event.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
              </label>
            </div>
            {teamFormError && <p className="mt-3 text-sm font-medium text-red-600">{teamFormError}</p>}
            <div className="mt-4 flex justify-end">
              <button type="button" disabled={savingTeam} onClick={saveTeam} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745] disabled:opacity-60">
                <Plus size={16} /> {savingTeam ? "Salvando..." : "Cadastrar modalidade"}
              </button>
            </div>
          </div>

          <div className="compex-card p-5">
            <h2 className="mb-4 text-lg font-black text-slate-900">Novo treino/jogo</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-bold text-slate-700 sm:col-span-2">
                Modalidade
                <select value={sessionForm.teamId} onChange={(event) => setSessionForm({ ...sessionForm, teamId: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
                  <option value="">Selecione...</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-bold text-slate-700">
                Tipo
                <select value={sessionForm.type} onChange={(event) => setSessionForm({ ...sessionForm, type: event.target.value as TeamSession["type"] })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
                  <option value="TREINO">Treino</option>
                  <option value="JOGO">Jogo</option>
                </select>
              </label>
              <label className="block text-sm font-bold text-slate-700">
                Data
                <input type="date" value={sessionForm.date} onChange={(event) => setSessionForm({ ...sessionForm, date: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
              </label>
              <label className="block text-sm font-bold text-slate-700">
                Local
                <input value={sessionForm.location} onChange={(event) => setSessionForm({ ...sessionForm, location: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
              </label>
              <label className="block text-sm font-bold text-slate-700">
                Técnico/responsável
                <input value={sessionForm.coachName} onChange={(event) => setSessionForm({ ...sessionForm, coachName: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
              </label>
            </div>
            {sessionFormError && <p className="mt-3 text-sm font-medium text-red-600">{sessionFormError}</p>}
            <div className="mt-4 flex justify-end">
              <button type="button" disabled={savingSession} onClick={saveSession} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745] disabled:opacity-60">
                <Plus size={16} /> {savingSession ? "Salvando..." : "Cadastrar treino/jogo"}
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="compex-card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Modalidades</p>
            <strong className="mt-2 block text-2xl font-black text-slate-900">{teams.length}</strong>
          </div>
          <div className="compex-card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Treinos & jogos</p>
            <strong className="mt-2 block text-2xl font-black text-slate-900">{totalSessions}</strong>
          </div>
          <div className="compex-card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Atletas vinculados</p>
            <strong className="mt-2 block text-2xl font-black text-slate-900">{teams.reduce((sum, team) => sum + team.enrollmentCount, 0)}</strong>
          </div>
        </div>

        {loading ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Carregando modalidades...
          </div>
        ) : error ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center px-6 text-sm font-medium text-red-600">{error}</div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              {teams.length === 0 ? (
                <div className="compex-card p-6 text-sm text-slate-500">Nenhuma modalidade cadastrada no momento.</div>
              ) : (
                teams.map((team) => (
                  <div key={team.id} className="compex-card p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">{team.sport}</div>
                        <h2 className="mt-1 text-xl font-black text-slate-900">{team.name}</h2>
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-bold text-slate-600">
                          <span className="rounded-full bg-slate-100 px-2 py-1">{genderLabel[team.gender]}</span>
                          {team.trainingDay && <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">Treino: {team.trainingDay}</span>}
                          {team.dropInPriceCents && <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">Avulso: {money(team.dropInPriceCents / 100)}</span>}
                        </div>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <div>{team.enrollmentCount} inscritos</div>
                        <div>{team.sessionCount} eventos</div>
                      </div>
                    </div>

                    {team.description && <p className="mt-3 text-sm text-slate-600">{team.description}</p>}

                    <div className="mt-4 space-y-2">
                      {(sessionsByTeam[team.id] || []).slice(0, 3).length === 0 ? (
                        <p className="text-sm text-slate-500">Nenhum treino ou jogo cadastrado.</p>
                      ) : (
                        (sessionsByTeam[team.id] || []).slice(0, 3).map((session) => (
                          <div key={session.id} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 p-3">
                            <div>
                              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] ${session.type === "JOGO" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                                  {session.type}
                                </span>
                                {new Date(session.date).toLocaleDateString("pt-BR")}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {session.location || "Local a definir"}
                                {session.coachName ? ` · ${session.coachName}` : ""}
                              </div>
                            </div>
                            {session.coachCost && <span className="text-xs font-bold text-slate-600">{money(session.coachCost)}</span>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="compex-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <CalendarDays size={18} className="text-blue-700" />
                <h2 className="text-lg font-black text-slate-900">Próximos treinos e jogos</h2>
              </div>

              <div className="space-y-3">
                {upcoming.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum compromisso agendado.</p>
                ) : (
                  upcoming.map((session) => (
                    <div key={session.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${session.type === "JOGO" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {session.type}
                        </span>
                        <span className="text-[11px] text-slate-500">{new Date(session.date).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <div className="mt-2 font-bold text-slate-900">{session.teamName}</div>
                      <div className="text-xs text-slate-500">
                        {session.location || "Local a definir"}
                        {session.coachName ? ` · ${session.coachName}` : ""}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </GestaoGuard>
  );
}
