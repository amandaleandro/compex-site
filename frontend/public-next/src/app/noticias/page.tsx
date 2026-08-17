"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Newspaper, Calendar, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { compexApi } from "@/lib/compex-api";

type NewsItem = {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string | null;
  content: string;
  imageUrl: string | null;
  highlighted: boolean;
  publishAt: string | null;
  createdAt: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
}

export default function NoticiasPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    compexApi<NewsItem[]>("/public-news?channel=HOME")
      .then(setNews)
      .catch(() => setNews([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      <section className="bg-gradient-to-r from-[#071745] via-[#0b2265] to-[#0f2c7a] rounded-3xl p-8 sm:p-12 text-white shadow-lg relative overflow-hidden">
        <div className="space-y-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 block">
            COMUNICAÇÃO & NOTÍCIAS COMPEX
          </span>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
            Fique por Dentro <br />
            <span className="text-[#3b82f6]">das Novidades da UFU</span>
          </h1>
          <p className="text-slate-300 text-sm max-w-xl">
            Acompanhe os resultados das competições, anúncios da diretoria e comunicados oficiais.
          </p>
        </div>
      </section>

      {!loading && news.length === 0 && (
        <div className="compex-card flex flex-col items-center gap-2 py-16 text-center">
          <Newspaper className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-bold text-slate-500">Nenhuma notícia publicada no momento.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {news.map((n) => (
          <motion.div
            key={n.id}
            whileHover={{ y: -4 }}
            className="compex-card p-6 flex flex-col justify-between space-y-5"
          >
            <div className="space-y-4">
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2.5 py-1 rounded-lg">
                {n.category}
              </span>
              <h3 className="text-lg font-bold text-slate-900 leading-snug">
                {n.title}
              </h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {n.summary || n.content.slice(0, 140)}
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-400 pt-2 border-t border-slate-100 font-bold">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>{formatDate(n.publishAt || n.createdAt)}</span>
              </div>
            </div>

            <Link href={`/noticias/${n.slug}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline pt-2"
            >
              Ler matéria <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
