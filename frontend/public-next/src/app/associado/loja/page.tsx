"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Minus, PackageX, Plus, ShoppingBag } from "lucide-react";
import AssociatePage from "@/components/associate/AssociatePage";
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

export default function LojaAssociadoPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  useEffect(() => {
    compexApi<Product[]>("/products")
      .then((items) => { setProducts(Array.isArray(items) ? items : []); setError(""); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível carregar a loja."))
      .finally(() => setLoading(false));
  }, []);

  const setQuantity = (productId: string, quantity: number) => {
    setCart((prev) => {
      const next = { ...prev };
      if (quantity <= 0) delete next[productId];
      else next[productId] = quantity;
      return next;
    });
  };

  const cartItems = useMemo(
    () => Object.entries(cart).map(([productId, quantity]) => ({ product: products.find((p) => p.id === productId), quantity })).filter((item) => item.product),
    [cart, products]
  );
  const totalCents = cartItems.reduce((sum, item) => sum + (item.product!.priceCents * item.quantity), 0);

  const handleCheckout = async () => {
    if (!cartItems.length) return;
    setCheckingOut(true);
    setCheckoutError("");
    try {
      const result = await compexApi<{ orderId: string; initPoint: string | null; warning?: string }>("/checkout/loja", {
        method: "POST",
        body: JSON.stringify({ items: cartItems.map((item) => ({ productId: item.product!.id, quantity: item.quantity })) }),
      });
      if (result.initPoint) {
        window.location.href = result.initPoint;
      } else {
        setCart({});
        setCheckoutError(result.warning || "Pedido criado com sucesso.");
      }
    } catch (reason) {
      setCheckoutError(reason instanceof Error ? reason.message : "Não foi possível concluir a compra.");
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <AssociatePage eyebrow="PRODUTOS OFICIAIS" title="Loja CompExatas" description="Produtos oficiais com condições especiais para associados.">
      {loading && (
        <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-xl bg-slate-50 p-10 text-slate-500">
          <LoaderCircle className="w-6 h-6 animate-spin" />
          <p className="text-xs font-bold">Carregando produtos...</p>
        </div>
      )}

      {!loading && error && (
        <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-xl bg-slate-50 p-10 text-slate-500">
          <PackageX className="w-6 h-6" />
          <p className="text-xs font-bold">{error}</p>
        </div>
      )}

      {!loading && !error && products.length === 0 && (
        <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-xl bg-slate-50 p-10 text-slate-500">
          <PackageX className="w-6 h-6" />
          <p className="text-xs font-bold">Nenhum produto disponível no momento.</p>
        </div>
      )}

      {!loading && !error && products.length > 0 && (
        <div className="associate-list mt-6">
          {products.map((product) => {
            const quantity = cart[product.id] || 0;
            return (
              <div className="associate-list-item" key={product.id}>
                <div>
                  <b>{product.name}</b>
                  <small>
                    {product.category} · <strong className="text-blue-700">{formatPrice(product.priceCents)}</strong>
                    {product.stock <= 0 && <span className="ml-2 font-bold text-red-600">Esgotado</span>}
                  </small>
                </div>
                {product.stock > 0 && (
                  quantity === 0 ? (
                    <button type="button" onClick={() => setQuantity(product.id, 1)} className="associate-link">Adicionar</button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setQuantity(product.id, quantity - 1)} className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"><Minus size={14} /></button>
                      <span className="w-5 text-center text-sm font-bold">{quantity}</span>
                      <button type="button" onClick={() => setQuantity(product.id, Math.min(quantity + 1, product.stock))} className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"><Plus size={14} /></button>
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      {cartItems.length > 0 && (
        <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-slate-700">{cartItems.reduce((sum, item) => sum + item.quantity, 0)} item(ns) no carrinho</span>
            <span className="text-lg font-black text-blue-800">{formatPrice(totalCents)}</span>
          </div>
          {checkoutError && <p className="text-xs font-bold text-slate-600">{checkoutError}</p>}
          <button
            type="button"
            onClick={handleCheckout}
            disabled={checkingOut}
            className="associate-button flex w-full items-center justify-center gap-2 disabled:opacity-60"
          >
            {checkingOut ? <LoaderCircle size={16} className="animate-spin" /> : <ShoppingBag size={16} />}
            {checkingOut ? "Processando..." : "Finalizar compra"}
          </button>
        </div>
      )}
    </AssociatePage>
  );
}
