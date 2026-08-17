"use client";

import React, { useEffect, useState } from "react";
import { Check, ShieldCheck, Zap, Star } from "lucide-react";
import { motion } from "framer-motion";
import { compexApi } from "@/lib/compex-api";

type ApiPlan = {
  id: string;
  name: string;
  price: string;
  priceCents: number;
  period: string;
  description: string | null;
  benefits: string[] | null;
};

export default function BeneficiosPage() {
  const [plans, setPlans] = useState<ApiPlan[]>([]);

  useEffect(() => {
    compexApi<ApiPlan[]>("/plans").then(setPlans).catch(() => setPlans([]));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      
      {/* Top Banner */}
      <section className="bg-gradient-to-r from-[#071745] via-[#0b2265] to-[#0f2c7a] rounded-3xl p-8 sm:p-12 text-white shadow-lg relative overflow-hidden">
        <div className="space-y-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-200 block">
            VANTAGENS EXCLUSIVAS COMPEX UFU
          </span>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
            Parceiros & Planos <br />
            <span className="text-[#3b82f6]">de Associados</span>
          </h1>
          <p className="text-slate-300 text-sm max-w-xl">
            Seja um associado da Atlética, fortalece o esporte universitário e garanta vantagens exclusivas.
          </p>
        </div>
      </section>

      {/* Grid de Planos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.length === 0 && (
          <p className="text-xs text-slate-400 font-medium col-span-full">Nenhum plano disponível no momento.</p>
        )}
        {plans.map((plan) => (
          <motion.div
            key={plan.id}
            whileHover={{ y: -4 }}
            className="compex-card p-8 flex flex-col justify-between space-y-6 relative overflow-hidden"
          >
            <div className="space-y-4">
              <h3 className="text-2xl font-black text-slate-900">{plan.name}</h3>
              {plan.description && <p className="text-xs text-slate-500 font-medium leading-relaxed">{plan.description}</p>}

              <div className="pt-2">
                <span className="text-4xl font-black text-blue-600 tracking-tight">
                  {(plan.priceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
                <span className="text-xs text-slate-400 font-bold">{plan.period}</span>
              </div>

              {Array.isArray(plan.benefits) && plan.benefits.length > 0 && (
                <div className="pt-4 border-t border-slate-100 space-y-2.5">
                  {plan.benefits.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                      <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <a
              href="/cadastro"
              className="w-full py-3 rounded-xl text-center text-xs font-bold transition-all bg-slate-100 hover:bg-slate-200 text-slate-900"
            >
              Assinar Plano
            </a>
          </motion.div>
        ))}
      </div>

    </div>
  );
}
