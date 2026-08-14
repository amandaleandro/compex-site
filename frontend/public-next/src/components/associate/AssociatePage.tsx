import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AssociatePage({ title, eyebrow, description, children }: { title: string; eyebrow: string; description?: string; children: React.ReactNode }) {
  return <div className="associate-page"><Link href="/associado" className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-blue-700"><ArrowLeft size={15} /> Voltar ao portal</Link><div className="associate-page-card"><span className="associate-eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p className="associate-muted">{description}</p>}{children}</div></div>;
}
