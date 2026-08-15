"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, QrCode, Users } from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

type EventCheckins = {
  event: { id: string; name: string; date: string; location: string | null } | null;
  total: number;
  confirmed: number;
  waiting: number;
  recent: { name: string; course: string; createdAt: string }[];
};

type TrainingSession = { id: string; teamId: string; teamName: string; date: string; location: string | null };

type TrainingCheckins = {
  sessions: TrainingSession[];
  training: { id: string; teamId: string; name: string; date: string; location: string | null } | null;
  total: number;
  confirmed: number;
  waiting: number;
  recent: { name: string; course: string; createdAt: string; checkedBy: string | null }[];
};

export default function CheckinPage() {
  const [tab, setTab] = useState<"event" | "training">("event");

  const [eventData, setEventData] = useState<EventCheckins | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState("");
  const [eventCode, setEventCode] = useState("");
  const [eventFeedback, setEventFeedback] = useState("");
  const [eventSubmitting, setEventSubmitting] = useState(false);

  const [trainingData, setTrainingData] = useState<TrainingCheckins | null>(null);
  const [trainingLoading, setTrainingLoading] = useState(true);
  const [trainingError, setTrainingError] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [trainingCode, setTrainingCode] = useState("");
  const [trainingFeedback, setTrainingFeedback] = useState("");
  const [trainingSubmitting, setTrainingSubmitting] = useState(false);

  const loadEvent = async () => {
    try {
      const data = await compexApi<EventCheckins>("/checkins");
      setEventData(data);
    } catch (reason) {
      setEventError(reason instanceof Error ? reason.message : "Não foi possível carregar o check-in do evento.");
    } finally {
      setEventLoading(false);
    }
  };

  const loadTraining = async (sessionId?: string) => {
    try {
      const query = sessionId ? `?sessionId=${sessionId}` : "";
      const data = await compexApi<TrainingCheckins>(`/training-checkins${query}`);
      setTrainingData(data);
      if (data.training) setSelectedSessionId(data.training.id);
    } catch (reason) {
      setTrainingError(reason instanceof Error ? reason.message : "Não foi possível carregar o check-in de treino.");
    } finally {
      setTrainingLoading(false);
    }
  };

  useEffect(() => {
    loadEvent();
    loadTraining();
  }, []);

  const submitEventCheckin = async () => {
    if (!eventData?.event || !eventCode.trim()) return;
    setEventSubmitting(true);
    setEventFeedback("");
    try {
      const result = await compexApi<{ alreadyCheckedIn: boolean; member: { name: string; course: string } }>("/checkins", {
        method: "POST",
        body: JSON.stringify({ eventId: eventData.event.id, code: eventCode.trim() }),
      });
      setEventFeedback(result.alreadyCheckedIn ? `${result.member.name} já tinha feito check-in.` : `Check-in confirmado para ${result.member.name}.`);
      setEventCode("");
      await loadEvent();
    } catch (reason) {
      setEventFeedback(reason instanceof Error ? reason.message : "Não foi possível confirmar o check-in.");
    } finally {
      setEventSubmitting(false);
    }
  };

  const submitTrainingCheckin = async () => {
    if (!selectedSessionId || !trainingCode.trim()) return;
    setTrainingSubmitting(true);
    setTrainingFeedback("");
    try {
      const result = await compexApi<{ alreadyCheckedIn: boolean; member: { name: string; course: string } }>("/training-checkins", {
        method: "POST",
        body: JSON.stringify({ sessionId: selectedSessionId, code: trainingCode.trim() }),
      });
      setTrainingFeedback(result.alreadyCheckedIn ? `${result.member.name} já tinha feito check-in.` : `Presença confirmada para ${result.member.name}.`);
      setTrainingCode("");
      await loadTraining(selectedSessionId);
    } catch (reason) {
      setTrainingFeedback(reason instanceof Error ? reason.message : "Não foi possível confirmar a presença.");
    } finally {
      setTrainingSubmitting(false);
    }
  };

  return (
    <GestaoGuard allow={["PRESIDENCIA", "EVENTOS", "ESPORTES"]}>
      <div className="mx-auto max-w-5xl px-6 py-7 sm:px-9">
        <header className="mb-6">
          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
          <h1 className="mt-1 text-2xl font-black text-slate-900">Check-in</h1>
          <p className="text-sm text-slate-500">Confirme a presença de associados em eventos e treinos pelo código da carteirinha.</p>
        </header>

        <div className="mb-6 flex gap-2">
          <button type="button" onClick={() => setTab("event")} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "event" ? "bg-[#0b2265] text-white" : "bg-slate-100 text-slate-600"}`}>
            Evento
          </button>
          <button type="button" onClick={() => setTab("training")} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "training" ? "bg-[#0b2265] text-white" : "bg-slate-100 text-slate-600"}`}>
            Treino
          </button>
        </div>

        {tab === "event" ? (
          eventLoading ? (
            <div className="compex-card flex min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : eventError ? (
            <div className="compex-card flex min-h-[220px] items-center justify-center px-6 text-sm font-medium text-red-600">{eventError}</div>
          ) : !eventData?.event ? (
            <div className="compex-card p-6 text-sm text-slate-500">Nenhum evento publicado no momento para check-in.</div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="compex-card p-5">
                <h2 className="text-lg font-black text-slate-900">{eventData.event.name}</h2>
                <p className="text-sm text-slate-500">{new Date(eventData.event.date).toLocaleDateString("pt-BR")} · {eventData.event.location || "Local a definir"}</p>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xl font-black text-slate-900">{eventData.total}</div>
                    <div className="text-[10px] font-bold uppercase text-slate-500">Check-ins</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xl font-black text-slate-900">{eventData.confirmed}</div>
                    <div className="text-[10px] font-bold uppercase text-slate-500">Confirmados</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xl font-black text-slate-900">{eventData.waiting}</div>
                    <div className="text-[10px] font-bold uppercase text-slate-500">Faltam</div>
                  </div>
                </div>

                <div className="mt-5">
                  <label className="block text-sm font-bold text-slate-700">
                    Código da carteirinha
                    <div className="mt-1 flex gap-2">
                      <input
                        value={eventCode}
                        onChange={(event) => setEventCode(event.target.value)}
                        onKeyDown={(event) => event.key === "Enter" && submitEventCheckin()}
                        placeholder="Matrícula ou código do QR"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                      />
                      <button type="button" disabled={eventSubmitting} onClick={submitEventCheckin} className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745] disabled:opacity-60">
                        <QrCode size={16} /> Confirmar
                      </button>
                    </div>
                  </label>
                  {eventFeedback && <p className="mt-2 text-sm font-medium text-slate-700">{eventFeedback}</p>}
                </div>
              </div>

              <div className="compex-card p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Users size={16} className="text-blue-700" />
                  <h2 className="text-lg font-black text-slate-900">Últimos check-ins</h2>
                </div>
                <div className="space-y-2">
                  {eventData.recent.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhum check-in registrado ainda.</p>
                  ) : (
                    eventData.recent.map((entry, index) => (
                      <div key={index} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                        <div>
                          <div className="font-bold text-slate-900">{entry.name}</div>
                          <div className="text-xs text-slate-500">{entry.course}</div>
                        </div>
                        <span className="text-[11px] text-slate-500">{new Date(entry.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )
        ) : trainingLoading ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : trainingError ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center px-6 text-sm font-medium text-red-600">{trainingError}</div>
        ) : !trainingData || trainingData.sessions.length === 0 ? (
          <div className="compex-card p-6 text-sm text-slate-500">Nenhum treino cadastrado.</div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="compex-card p-5">
              <label className="block text-sm font-bold text-slate-700">
                Treino
                <select
                  value={selectedSessionId}
                  onChange={(event) => { setSelectedSessionId(event.target.value); loadTraining(event.target.value); }}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                >
                  {trainingData.sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.teamName} · {new Date(session.date).toLocaleDateString("pt-BR")}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-xl font-black text-slate-900">{trainingData.total}</div>
                  <div className="text-[10px] font-bold uppercase text-slate-500">Check-ins</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-xl font-black text-slate-900">{trainingData.confirmed}</div>
                  <div className="text-[10px] font-bold uppercase text-slate-500">Inscritos</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-xl font-black text-slate-900">{trainingData.waiting}</div>
                  <div className="text-[10px] font-bold uppercase text-slate-500">Faltam</div>
                </div>
              </div>

              <div className="mt-5">
                <label className="block text-sm font-bold text-slate-700">
                  Código da carteirinha
                  <div className="mt-1 flex gap-2">
                    <input
                      value={trainingCode}
                      onChange={(event) => setTrainingCode(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && submitTrainingCheckin()}
                      placeholder="Matrícula ou código do QR"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                    />
                    <button type="button" disabled={trainingSubmitting} onClick={submitTrainingCheckin} className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745] disabled:opacity-60">
                      <QrCode size={16} /> Confirmar
                    </button>
                  </div>
                </label>
                {trainingFeedback && <p className="mt-2 text-sm font-medium text-slate-700">{trainingFeedback}</p>}
              </div>
            </div>

            <div className="compex-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <Users size={16} className="text-blue-700" />
                <h2 className="text-lg font-black text-slate-900">Últimos check-ins</h2>
              </div>
              <div className="space-y-2">
                {trainingData.recent.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum check-in registrado ainda.</p>
                ) : (
                  trainingData.recent.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                      <div>
                        <div className="font-bold text-slate-900">{entry.name}</div>
                        <div className="text-xs text-slate-500">{entry.course}</div>
                      </div>
                      <span className="text-[11px] text-slate-500">{new Date(entry.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
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
