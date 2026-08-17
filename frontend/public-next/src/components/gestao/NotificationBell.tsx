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
  createdAt: string;
};

export default function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const result = await compexApi<{ items: Notification[]; unreadCount: number }>("/notifications");
      setItems(result.items || []);
      setUnreadCount(result.unreadCount || 0);
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
        {unreadCount > 0 && <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">{unreadCount}</span>}
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
              {items.map((n) => (
                <li key={n.id}>
                  <a
                    href={n.link || "#"}
                    className={`block rounded-lg px-2 py-2 text-xs ${n.read ? "text-slate-500" : "bg-blue-50 text-slate-800 font-bold"}`}
                  >
                    <p>{n.title}</p>
                    <p className="mt-0.5 font-normal text-slate-500">{n.message}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleString("pt-BR")}</p>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
