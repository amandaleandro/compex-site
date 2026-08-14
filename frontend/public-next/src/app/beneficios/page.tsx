"use client";

import React from "react";
import { Check, ShieldCheck, Zap, Star } from "lucide-react";
import { motion } from "framer-motion";

const plans = [
  {
    name: "Sócio Calouro",
    price: "R$ 29,90",
    period: "/semestre",
    desc: "Acesso aos treinos e descontos em festas acadêmicas.",
    features: [
      "Acesso a todos os treinos oficiais",
      "Desconto em festas e cervejadas",
      "Carteirinha digital COMPEX UFU"
    ]
  },
  {
    name: "Sócio Atleta / Exatas",
    price: "R$ 49,90",
    period: "/semestre",
    desc: "O plano oficial mais popular para os alunos da Computação e Exatas.",
    popular: true,
    features: [
      "Todos os benefícios do plano Calouro",
      "Kit Oficial (Tirante + Caneca 850ml)",
      "Desconto na Loja Oficial COMPEX",
      "Prioridade no lote do Intercomp 2026"
    ]
  },
  {
    name: "Sócio Ouro (Anual)",
    price: "R$ 79,90",
    period: "/ano",
    desc: "Validade por 1 ano completo com camisa de treino inclusa.",
    features: [
      "Validade por 2 semestres letivos",
      "Camisa Oficial de Treino grátis",
      "Entrada VIP sem fila nos eventos",
      "Votação nas assembleias da Atlética"
    ]
  }
];

export default function BeneficiosPage() {
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
        {plans.map((plan, i) => (
          <motion.div
            key={i}
            whileHover={{ y: -4 }}
            className={`compex-card p-8 flex flex-col justify-between space-y-6 relative overflow-hidden ${
              plan.popular ? "border-2 border-blue-600 shadow-md" : ""
            }`}
          >
            {plan.popular && (
              <div className="absolute top-0 right-0 bg-slate-100 text-slate-700 border-b border-l border-slate-200 text-[10px] font-black px-4 py-1 rounded-bl-xl uppercase tracking-wider">
                Mais Popular
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-2xl font-black text-slate-900">{plan.name}</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">{plan.desc}</p>

              <div className="pt-2">
                <span className="text-4xl font-black text-blue-600 tracking-tight">{plan.price}</span>
                <span className="text-xs text-slate-400 font-bold">{plan.period}</span>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2.5">
                {plan.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                    <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <a
              href="/cadastro"
              className={`w-full py-3 rounded-xl text-center text-xs font-bold transition-all ${
                plan.popular
                  ? "bg-[#0b2265] hover:bg-[#071745] text-white shadow-sm"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-900"
              }`}
            >
              Assinar Plano
            </a>
          </motion.div>
        ))}
      </div>

    </div>
  );
}
