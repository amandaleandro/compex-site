"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { compexApi } from "@/lib/compex-api";

type Notification = {
  id: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  kind: "INFORMATIVA" | "ACIONAVEL";
  resolved: boolean;
  createdAt: string;
};

type DisplayEntry =
  | { type: "single"; item: Notification }
  | { type: "group"; key: string; title: string; link: string | null; items: Notification[] };

// Agrupa notificações informativas repetidas (mesmo título) em uma linha só quando há mais de
// 3 — evita a "cobrança em série" do tipo 5 mensagens iguais (seção 49). Acionáveis nunca são
// agrupadas: cada uma pode exigir uma ação/link diferente.
function groupForDisplay(items: Notification[]): DisplayEntry[] {
  const informativeByTitle = new Map<string, Notification[]>();
  for (const item of items) {
    if (item.kind !== "INFORMATIVA") continue;
    const list = informativeByTitle.get(item.title) || [];
    list.push(item);
    informativeByTitle.set(item.title, list);
  }
  const groupedIds = new Set<string>();
  const groups: DisplayEntry[] = [];
  for (const [title, list] of informativeByTitle) {
    if (list.length > 3) {
      list.forEach((n) => groupedIds.add(n.id));
      groups.push({ type: "group", key: `group-${title}`, title, link: list[0].link, items: list });
    }
  }
  const singles: DisplayEntry[] = items.filter((n) => !groupedIds.has(n.id)).map((item) => ({ type: "single", item }));
  return [...groups, ...singles];
}

export default function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingActionCount, setPendingActionCount] = useState(0);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const result = await compexApi<{ items: Notification[]; unreadCount: number; pendingActionCount: number }>("/notifications");
      setItems(result.items || []);
      setUnreadCount(result.unreadCount || 0);
      setPendingActionCount(result.pendingActionCount || 0);
    } catch {
      // silencioso — notificação não deve travar a navegação
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const markAllRead = async () => {
    try {
      await compexApi("/notifications", { method: "PUT", body: JSON.stringify({ markAll: true }) });
      await load();
    } catch {
      // ignora falha silenciosamente
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/10"
      >
        <Bell size={14} />
        <span>Notificações</span>
        {pendingActionCount > 0 ? (
          <span className="ml-auto rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-black text-white" title="Pendências que exigem ação">{pendingActionCount}</span>
        ) : unreadCount > 0 ? (
          <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">{unreadCount}</span>
        ) : null}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="text-xs font-black text-slate-700">Notificações</span>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} className="text-[11px] font-bold text-blue-700 hover:underline">Marcar todas como lidas</button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-slate-500">Nenhuma notificação.</p>
          ) : (
            <ul className="space-y-1">
              {groupForDisplay(items).map((entry) => {
                if (entry.type === "group") {
                  return (
                    <li key={entry.key}>
                      <a href={entry.link || "#"} className="block rounded-lg bg-blue-50 px-2 py-2 text-xs font-bold text-slate-800">
                        <p>Você tem {entry.items.length} notificações: {entry.title}</p>
                        <p className="mt-0.5 text-[10px] font-normal text-slate-400">Mais recente em {new Date(entry.items[0].createdAt).toLocaleString("pt-BR")}</p>
                      </a>
                    </li>
                  );
                }
                const n = entry.item;
                const isPending = n.kind === "ACIONAVEL" && !n.resolved;
                return (
                  <li key={n.id}>
                    <a
                      href={n.link || "#"}
                      className={`block rounded-lg px-2 py-2 text-xs ${
                        isPending ? "bg-orange-50 text-slate-800 font-bold" : n.read ? "text-slate-500" : "bg-blue-50 text-slate-800 font-bold"
                      }`}
                    >
                      <p>{isPending ? "⚠ " : ""}{n.title}</p>
                      <p className="mt-0.5 font-normal text-slate-500">{n.message}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleString("pt-BR")}</p>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
