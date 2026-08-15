"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type GestaoUser = { name: string; email: string; role: string; rank?: string };

const GestaoSessionContext = createContext<GestaoUser | null>(null);

function readSession(): GestaoUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("compex-session");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Restringe uma página da gestão a papéis internos específicos, redirecionando para o login caso contrário. */
export default function GestaoGuard({ allow, children }: { allow: string[]; children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<GestaoUser | null | "checking">("checking");

  useEffect(() => {
    const session = readSession();
    if (!session || !sessionStorage.getItem("compex-token") || !allow.includes(session.role)) {
      router.replace("/login");
      return;
    }
    setUser(session);
  }, [router, allow]);

  if (user === "checking" || !user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-500">
        <span className="text-xs font-bold">Verificando acesso...</span>
      </div>
    );
  }

  return <GestaoSessionContext.Provider value={user}>{children}</GestaoSessionContext.Provider>;
}

export function useGestaoSession() {
  const value = useContext(GestaoSessionContext);
  if (!value) throw new Error("useGestaoSession deve ser usado dentro de GestaoGuard");
  return value;
}
