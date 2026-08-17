import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar } from "lucide-react";

type NewsItem = {
  id: string;
  title: string;
  category: string;
  content: string;
  imageUrl: string | null;
  authorName: string;
  publishAt: string | null;
  createdAt: string;
};

const BACKEND_URL = (process.env.COMPEX_BACKEND_URL || "http://127.0.0.1:3100").replace(/\/$/, "");

async function fetchNews(slug: string): Promise<NewsItem | null> {
  const response = await fetch(`${BACKEND_URL}/api/public-news/${slug}`, { cache: "no-store" });
  if (!response.ok) return null;
  return response.json();
}

export default async function NoticiaDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const news = await fetchNews(id);
  if (!news) notFound();

  const date = new Date(news.publishAt || news.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/noticias" className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-blue-700">
        <ArrowLeft size={15} /> Voltar para notícias
      </Link>
      <article className="compex-card p-8 sm:p-12">
        <span className="text-[10px] font-bold uppercase tracking-widest text-blue-700">{news.category}</span>
        <h1 className="mt-4 text-4xl font-black leading-tight text-slate-900">{news.title}</h1>
        <div className="mt-5 flex items-center gap-2 text-xs font-bold text-slate-400">
          <Calendar size={15} className="text-blue-700" /> {date} · {news.authorName}
        </div>
        {news.imageUrl && (
          <img src={news.imageUrl} alt={news.title} className="mt-8 w-full rounded-2xl object-cover" />
        )}
        <div className="mt-8 whitespace-pre-line border-t border-slate-100 pt-8 text-sm leading-7 text-slate-600">
          {news.content}
        </div>
      </article>
    </div>
  );
}
