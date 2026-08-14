"use client";

import React, { useState } from "react";
import { 
  Trophy, 
  Award, 
  Flame, 
  Star, 
  CheckCircle2, 
  Activity, 
  PartyPopper, 
  ShoppingBag, 
  CreditCard, 
  Store, 
  Eye, 
  Medal, 
  Zap, 
  ArrowRight,
  Sparkles
} from "lucide-react";
import { motion } from "framer-motion";

const rules = [
  {
    title: "Presença em Treinos",
    points: "+50 Pts",
    desc: "Compareça aos treinos oficiais das equipes da COMPEX.",
    icon: Activity,
    color: "bg-blue-50 text-blue-600 border-blue-200"
  },
  {
    title: "Atleta em Jogo Oficial",
    points: "+100 Pts",
    desc: "Represente a Atlética em partidas de campeonatos.",
    icon: Trophy,
    color: "bg-indigo-50 text-indigo-600 border-indigo-200"
  },
  {
    title: "Estatística no Jogo (Gol, Cesta, Ponto)",
    points: "+30 Pts",
    desc: "Pontue ou marque gols durante as partidas oficiais.",
    icon: Zap,
    color: "bg-amber-50 text-amber-600 border-amber-200"
  },
  {
    title: "Destaque da Partida (MVP)",
    points: "+150 Pts",
    desc: "Eleito o melhor jogador ou destaque do jogo.",
    icon: Star,
    color: "bg-purple-50 text-purple-600 border-purple-200"
  },
  {
    title: "Torcida na Arquibancada",
    points: "+40 Pts",
    desc: "Vá assistir aos jogos e apoiar nossos atletas.",
    icon: Eye,
    color: "bg-cyan-50 text-cyan-600 border-cyan-200"
  },
  {
    title: "Festas COMPEX & Parceiras",
    points: "+80 Pts",
    desc: "Marque presença em festas oficiais ou onde a COMPEX vendeu/divulgou ingressos.",
    icon: PartyPopper,
    color: "bg-pink-50 text-pink-600 border-pink-200"
  },
  {
    title: "Compra de Ingressos",
    points: "+60 Pts",
    desc: "Adquira ingressos oficiais de eventos e cervejadas.",
    icon: ShoppingBag,
    color: "bg-emerald-50 text-emerald-600 border-emerald-200"
  },
  {
    title: "Uso de Parceiros Cadastrados",
    points: "+50 Pts",
    desc: "Consuma em bares, academias ou estabelecimentos parceiros.",
    icon: Store,
    color: "bg-orange-50 text-orange-600 border-orange-200"
  },
  {
    title: "Mensalidade em Dia",
    points: "+100 Pts / mês",
    desc: "Mantenha a mensalidade do plano de sócio em dia.",
    icon: CreditCard,
    color: "bg-teal-50 text-teal-600 border-teal-200"
  }
];

const rankingMock = [
  { position: 1, name: "Lucas 'Cyber' Silva", course: "Ciência da Computação", points: 1480, avatar: "🥇", badge: "Lenda COMPEX" },
  { position: 2, name: "Beatriz Mello", course: "Engenharia de Software", points: 1250, avatar: "🥈", badge: "MVP Quadras" },
  { position: 3, name: "Gabriel Andrade", course: "Sistemas de Informação", points: 1100, avatar: "🥉", badge: "Super Torcedor" },
  { position: 4, name: "Mariana Costa", course: "Matemática Aplicada", points: 940, avatar: "🏅", badge: "Sócio Ouro" },
  { position: 5, name: "Rafael Torres", course: "Física Médica", points: 820, avatar: "🏅", badge: "Atleta Futsal" },
];

const rewardsMock = [
  { name: "Caneca Alumínio 850ml UFU", cost: "800 Pts", icon: "🍺" },
  { name: "Ingresso VIP para a próxima Festa", cost: "1.200 Pts", icon: "🎟️" },
  { name: "Camisa Oficial de Treino COMPEX", cost: "2.000 Pts", icon: "👕" },
];

export default function GamificacaoPage() {
  const [activeTab, setActiveTab] = useState("regras");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      
      {/* Hero Banner de Gamificação */}
      <section className="bg-gradient-to-r from-[#071745] via-[#0b2265] to-[#0f2c7a] rounded-3xl p-8 sm:p-12 text-white shadow-lg relative overflow-hidden">
        <div className="space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-slate-300 bg-slate-100 text-slate-900 text-xs font-black uppercase tracking-wider">
            <Flame className="w-4 h-4 fill-slate-950" />
            SISTEMA DE PONTOS & RECOMPENSAS COMPEX
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
            Viva a Atlética, acumule pontos <br />
            <span className="text-[#3b82f6]">e troque por prêmios!</span>
          </h1>
          <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
            Aqui tudo vale pontos: ir ao treino, fazer gol ou cesta, torcer na arquibancada, ir às festas, comprar na loja, consumir nos parceiros e manter a mensalidade em dia.
          </p>
        </div>
      </section>

      {/* Tabs da Gamificação */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
        {[
          { id: "regras", name: "Como Ganhar Pontos" },
          { id: "ranking", name: "Ranking dos Sócios" },
          { id: "recompensas", name: "Resgate de Prêmios" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-[#0b2265] text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* Conteúdo 1: Como Ganhar Pontos (Grid de Regras) */}
      {activeTab === "regras" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rules.map((rule, idx) => {
              const Icon = rule.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="compex-card p-6 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${rule.color}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-xl border border-blue-100">
                        {rule.points}
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-slate-900 leading-snug">
                      {rule.title}
                    </h3>

                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      {rule.desc}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Pontuação creditada automaticamente
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Conteúdo 2: Ranking de Sócios */}
      {activeTab === "ranking" && (
        <div className="compex-card p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900">Leaderboard de Pontuação</h3>
              <p className="text-xs text-slate-500">Os membros mais engajados do semestre na COMPEX UFU</p>
            </div>
            <span className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl">
              Temporada 2026.1
            </span>
          </div>

          <div className="space-y-3">
            {rankingMock.map((user) => (
              <div
                key={user.position}
                className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="text-xl font-black text-slate-700 w-8 text-center">
                    {user.avatar}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-slate-900 text-sm">{user.name}</h4>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                        {user.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{user.course}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-base font-black text-blue-600 block">{user.points} Pts</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Acumulados</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conteúdo 3: Resgate de Prêmios */}
      {activeTab === "recompensas" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {rewardsMock.map((reward, idx) => (
            <div key={idx} className="compex-card p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-3xl">
                  {reward.icon}
                </div>
                <h3 className="text-base font-black text-slate-900">{reward.name}</h3>
                <span className="inline-block text-xs font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-xl">
                  {reward.cost}
                </span>
              </div>

              <button
                onClick={() => alert(`Resgate solicitado para "${reward.name}". Verifique seus pontos na Área do Associado!`)}
                className="w-full py-2.5 rounded-xl bg-[#0b2265] hover:bg-[#071745] text-white font-bold text-xs shadow-sm transition-colors text-center"
              >
                Resgatar Prêmio
              </button>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
