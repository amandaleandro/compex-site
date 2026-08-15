"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, LoaderCircle, PackageX, ShoppingBag } from "lucide-react";
import { compexApi } from "@/lib/compex-api";

type Product = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number;
  category: string;
  stock: number;
};

const formatPrice = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ProdutoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    compexApi<Product[]>("/products")
      .then((items) => {
        const found = (Array.isArray(items) ? items : []).find((p) => p.id === id);
        if (!found) { setError("Produto não encontrado ou indisponível."); return; }
        setProduct(found);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível carregar o produto."))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/loja" className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-blue-700"><ArrowLeft size={15} /> Voltar para loja</Link>

      {loading && (
        <div className="compex-card p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
          <LoaderCircle className="w-6 h-6 animate-spin" />
          <p className="text-xs font-bold">Carregando produto...</p>
        </div>
      )}

      {!loading && (error || !product) && (
        <div className="compex-card p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
          <PackageX className="w-6 h-6" />
          <p className="text-xs font-bold">{error || "Produto não encontrado."}</p>
        </div>
      )}

      {!loading && product && (
        <article className="compex-card grid gap-8 p-8 sm:grid-cols-[.8fr_1.2fr] sm:p-12">
          <div className="grid min-h-64 place-items-center rounded-2xl bg-slate-100 overflow-hidden">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-7xl">🛍️</span>
            )}
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-700">{product.category}</span>
            <h1 className="mt-4 text-3xl font-black text-slate-900">{product.name}</h1>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              {product.description || "Produto oficial da Atlética CompExatas. Consulte disponibilidade e reserve diretamente com a diretoria."}
            </p>
            <p className="mt-6 text-2xl font-black text-blue-700">{formatPrice(product.priceCents)}</p>
            <div className="mt-6 grid gap-3 text-sm text-slate-600">
              <span className="flex gap-2"><Check className="text-blue-700" size={18} /> Condição especial para associados</span>
              <span className="flex gap-2"><Check className="text-blue-700" size={18} /> Retirada em Uberlândia</span>
              {product.stock <= 0 && <span className="flex gap-2 text-red-600 font-bold"><PackageX size={18} /> Sem estoque no momento</span>}
            </div>
            <Link href="/cadastro" className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#0b1b3d] px-5 py-3 text-xs font-bold text-white">
              <ShoppingBag size={16} /> Fazer meu cadastro
            </Link>
          </div>
        </article>
      )}
    </div>
  );
}
