"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { compexApi, sessionToken } from "@/lib/compex-api";

export type AssociateProfile = {
  id: string;
  name: string;
  email: string;
  socialName: string | null;
  nickname: string | null;
  sex: string | null;
  birthDate: string | null;
  photoUrl: string | null;
  course: string;
  registration: string | null;
  instagram: string | null;
  phone: string | null;
  shift: string | null;
  plan: string;
  status: string;
  membershipKind: "SOCIO" | "AVULSO";
  createdAt: string;
  sports: string[];
};

export type AssociateSubscription = {
  plan: string;
  status: string;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
};

type AssociateSessionValue = {
  profile: AssociateProfile;
  subscription: AssociateSubscription;
  refresh: () => Promise<void>;
};

const AssociateSessionContext = createContext<AssociateSessionValue | null>(null);

export function AssociateSessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<AssociateProfile | null>(null);
  const [subscription, setSubscription] = useState<AssociateSubscription | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    if (!sessionToken()) {
      router.replace("/login");
      return;
    }
    try {
      const [currentProfile, currentSubscription] = await Promise.all([
        compexApi<AssociateProfile>("/me/profile"),
        compexApi<AssociateSubscription>("/me/subscription"),
      ]);
      setProfile({ ...currentProfile, sports: Array.isArray(currentProfile.sports) ? currentProfile.sports : [] });
      setSubscription(currentSubscription);
      setError("");
    } catch (reason) {
      sessionStorage.removeItem("compex-token");
      sessionStorage.removeItem("compex-session");
      setError(reason instanceof Error ? reason.message : "Sua sessão não pôde ser validada.");
      window.setTimeout(() => router.replace("/login"), 900);
    }
  };

  useEffect(() => { void load(); }, [pathname]);

  useEffect(() => {
    const reloadOnFocus = () => { void load(); };
    window.addEventListener("focus", reloadOnFocus);
    return () => window.removeEventListener("focus", reloadOnFocus);
  }, []);

  const value = useMemo(() => profile && subscription ? { profile, subscription, refresh: load } : null, [profile, subscription]);

  if (!value) return <div className="associate-session-loading"><img src="/compex-logo.png" alt="CompExatas" /><b>{error || "Carregando seu portal..."}</b><span>{error ? "Você será direcionado para o login." : "Validando sua associação com segurança."}</span></div>;
  return <AssociateSessionContext.Provider value={value}>{children}</AssociateSessionContext.Provider>;
}

export function useAssociateSession() {
  const value = useContext(AssociateSessionContext);
  if (!value) throw new Error("useAssociateSession deve ser usado dentro de AssociateSessionProvider");
  return value;
}
