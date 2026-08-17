"use client";

import { useEffect, useState } from "react";
import { compexApi } from "@/lib/compex-api";

type Popup = {
  id: string;
  title: string;
  message: string;
  link: string | null;
  priority: "BAIXA" | "NORMAL" | "ALTA" | "CRITICA";
  createdAt: string;
};

export default function PendencyPopup() {
  const [popup, setPopup] = useState<Popup | null>(null);

  useEffect(() => {
    let cancelled = false;
    compexApi<{ popup: Popup | null }>("/notifications")
      .then((result) => { if (!cancelled) setPopup(result.popup || null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!popup) return null;

  const dismiss = async () => {
    setPopup(null);
    try {
      await compexApi("/notifications", { method: "PUT", body: JSON.stringify({ ackPopupId: popup.id }) });
    } catch {
      // não bloqueia a navegação por causa disso
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) dismiss(); }}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-3">
        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${popup.priority === "CRITICA" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
          {popup.priority === "CRITICA" ? "Urgente" : "Nova pendência"}
        </span>
        <h2 className="text-base font-black text-slate-900">{popup.title}</h2>
        <p className="text-sm text-slate-600">{popup.message}</p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={dismiss} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
            Depois
          </button>
          {popup.link && (
            <a
              href={popup.link}
              onClick={dismiss}
              className="rounded-lg bg-[#0b2265] px-4 py-2 text-xs font-bold text-white hover:bg-[#071745]"
            >
              Ver agora
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
