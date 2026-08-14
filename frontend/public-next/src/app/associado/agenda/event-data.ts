export type AgendaEvent = {
  id: string;
  name: string;
  type: string;
  date: string;
  time: string | null;
  location: string | null;
  description: string | null;
  ticketUrl?: string | null;
  boraFestUrl?: string | null;
  link?: string | null;
  published?: boolean;
};

export type AgendaFilter = "Todos" | "Competições" | "Treinos" | "Encontros";

export function eventCategory(event: AgendaEvent): Exclude<AgendaFilter, "Todos"> {
  const value = `${event.type || ""} ${event.name || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (value.includes("treino")) return "Treinos";
  if (["competicao", "campeonato", "jogo", "partida", "torneio"].some(term => value.includes(term))) return "Competições";
  return "Encontros";
}

export function eventDateParts(value: string) {
  const date = new Date(value);
  return {
    day: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: "UTC" }).format(date),
    month: new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(date).replace(".", "").toUpperCase(),
    full: new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(date),
  };
}

export function eventExternalLink(event: AgendaEvent) {
  return event.ticketUrl || event.boraFestUrl || event.link || "";
}
