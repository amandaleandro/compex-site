"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LoaderCircle, Package, PackageX, Pencil, Plus, QrCode, Trash2, Upload, X,
} from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi, sessionToken } from "@/lib/compex-api";

type Product = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  category: string;
  stock: number;
  type: "PRONTA_ENTREGA" | "ENCOMENDA";
  allowSize: boolean;
  allowCustomization: boolean;
  active: boolean;
};

type OrderItem = {
  id: string;
  productId: string;
  productName: string;
  productType: "PRONTA_ENTREGA" | "ENCOMENDA";
  quantity: number;
  size: string | null;
  customizationName: string | null;
  customizationNumber: string | null;
};

type Order = {
  id: string;
  memberName: string;
  memberEmail: string;
  memberRegistration: string;
  status: "PENDING" | "PAID" | "PREPARING" | "READY_FOR_PICKUP" | "DELIVERED" | "CANCELED";
  totalPrice: number;
  estimatedDelivery: string | null;
  deliveredAt: string | null;
  deliveredBy: string | null;
  items: OrderItem[];
};

const money = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const toBackendAsset = (url: string | null) => (url ? url.replace(/^\/uploads\//, "/backend-assets/uploads/") : null);

const STATUS_LABEL: Record<Order["status"], string> = {
  PENDING: "⏳ Pendente",
  PAID: "💰 Pago",
  PREPARING: "🚚 Em Produção",
  READY_FOR_PICKUP: "📦 Pronto p/ Retirada",
  DELIVERED: "✅ Entregue",
  CANCELED: "❌ Cancelado",
};
const STATUS_STYLE: Record<Order["status"], string> = {
  PENDING: "bg-slate-100 text-slate-600",
  PAID: "bg-blue-50 text-blue-700",
  PREPARING: "bg-orange-50 text-orange-700",
  READY_FOR_PICKUP: "bg-green-50 text-green-700",
  DELIVERED: "bg-slate-200 text-slate-700",
  CANCELED: "bg-red-50 text-red-700",
};

const emptyForm = {
  id: "", name: "", category: "", price: "", type: "PRONTA_ENTREGA" as Product["type"], stock: "0",
  allowSize: false, allowCustomization: false, description: "", imageUrl: "",
};

function ProdutosGestaoPage() {
  const [tab, setTab] = useState<"products" | "orders">("products");

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productError, setProductError] = useState("");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateModal, setDateModal] = useState<{ orderId: string; date: string } | null>(null);
  const [qrModal, setQrModal] = useState<Order | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [busyOrderId, setBusyOrderId] = useState("");

  const loadProducts = () => {
    setLoadingProducts(true);
    compexApi<Product[]>("/store-products")
      .then((items) => { setProducts(Array.isArray(items) ? items : []); setProductError(""); })
      .catch((reason) => setProductError(reason instanceof Error ? reason.message : "Não foi possível carregar os produtos."))
      .finally(() => setLoadingProducts(false));
  };

  const loadOrders = () => {
    setLoadingOrders(true);
    compexApi<Order[]>("/admin/orders")
      .then((items) => { setOrders(Array.isArray(items) ? items : []); setOrdersLoaded(true); })
      .catch(() => setOrders([]))
      .finally(() => setLoadingOrders(false));
  };

  useEffect(() => { loadProducts(); }, []);
  useEffect(() => { if (tab === "orders" && !ordersLoaded) loadOrders(); }, [tab, ordersLoaded]);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase())
  );

  const filteredOrders = orders.filter((o) => {
    const term = orderSearch.toLowerCase();
    const matchesTerm = o.memberName.toLowerCase().includes(term) || o.memberEmail.toLowerCase().includes(term) || o.items.some((i) => i.productName.toLowerCase().includes(term));
    const matchesStatus = statusFilter === "ALL" || o.status === statusFilter;
    return matchesTerm && matchesStatus;
  });

  const orderMetrics = useMemo(() => ({
    total: orders.length,
    preparing: orders.filter((o) => o.status === "PREPARING" || o.status === "PAID").length,
    ready: orders.filter((o) => o.status === "READY_FOR_PICKUP").length,
    delivered: orders.filter((o) => o.status === "DELIVERED").length,
  }), [orders]);

  const openNewProduct = () => { setForm(emptyForm); setModalOpen(true); };
  const openEditProduct = (p: Product) => {
    setForm({
      id: p.id, name: p.name, category: p.category, price: String(p.price), type: p.type, stock: String(p.stock),
      allowSize: p.allowSize, allowCustomization: p.allowCustomization, description: p.description || "", imageUrl: p.imageUrl || "",
    });
    setModalOpen(true);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = sessionToken();
      const response = await fetch("/api/backend/products/upload", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.error || "Erro ao enviar a foto");
      setForm((prev) => ({ ...prev, imageUrl: data.url }));
    } catch (reason) {
      alert(reason instanceof Error ? reason.message : "Erro ao enviar a foto.");
    } finally {
      setUploading(false);
    }
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const payload = {
      id: form.id || undefined,
      name: form.name,
      category: form.category,
      price: form.price,
      type: form.type,
      stock: form.stock,
      allowSize: form.allowSize,
      allowCustomization: form.allowCustomization,
      description: form.description,
      imageUrl: form.imageUrl || null,
    };
    try {
      await compexApi("/store-products", { method: form.id ? "PUT" : "POST", body: JSON.stringify(payload) });
      setModalOpen(false);
      loadProducts();
    } catch (reason) {
      alert(reason instanceof Error ? reason.message : "Erro ao salvar produto.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (product: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, active: !p.active } : p)));
    try {
      await compexApi("/store-products", { method: "PUT", body: JSON.stringify({ id: product.id, active: !product.active }) });
    } catch {
      loadProducts();
    }
  };

  const removeProduct = async (product: Product) => {
    if (!confirm(`Remover "${product.name}" da loja?`)) return;
    try {
      await compexApi("/store-products", { method: "DELETE", body: JSON.stringify({ id: product.id }) });
      loadProducts();
    } catch (reason) {
      alert(reason instanceof Error ? reason.message : "Erro ao remover produto.");
    }
  };

  const saveDeliveryDate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dateModal) return;
    try {
      await compexApi("/admin/orders/update-delivery", { method: "POST", body: JSON.stringify({ orderId: dateModal.orderId, estimatedDelivery: dateModal.date }) });
      setDateModal(null);
      loadOrders();
    } catch (reason) {
      alert(reason instanceof Error ? reason.message : "Erro ao salvar previsão.");
    }
  };

  const notify = async (order: Order) => {
    if (!confirm("Enviar notificação e e-mail avisando que o produto chegou e está disponível para retirada?")) return;
    setBusyOrderId(order.id);
    try {
      const result = await compexApi<{ emailSentTo: string }>("/admin/orders/notify", { method: "POST", body: JSON.stringify({ orderId: order.id }) });
      alert(`Notificação enviada com sucesso para ${result.emailSentTo}!`);
      loadOrders();
    } catch (reason) {
      alert(reason instanceof Error ? reason.message : "Erro ao enviar notificação.");
    } finally {
      setBusyOrderId("");
    }
  };

  const deliverOrder = async (forceDeliver = false) => {
    if (!qrModal) return;
    if (!manualCode && !forceDeliver) { alert("Digite a matrícula ou o código do associado."); return; }
    try {
      await compexApi("/admin/orders/deliver", { method: "POST", body: JSON.stringify({ orderId: qrModal.id, qrCode: manualCode, forceDeliver }) });
      alert(`Entrega realizada com sucesso para ${qrModal.memberName}!`);
      setQrModal(null);
      setManualCode("");
      loadOrders();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Erro ao validar entrega.";
      if (confirm(`${message}\n\nDeseja forçar a entrega manualmente mesmo sem validação?`)) deliverOrder(true);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-7 sm:px-9 lg:px-9">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-[11px] font-black uppercase tracking-widest text-blue-700">Loja</span>
          <h1 className="text-2xl font-black text-slate-900">Gestão de Produtos & Pedidos</h1>
          <p className="text-sm text-slate-500">Cadastro de produtos, encomendas, previsões de entrega e validação de retirada.</p>
        </div>
        <button onClick={openNewProduct} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#071745]">
          <Plus size={15} /> Novo produto
        </button>
      </header>

      <div className="mb-6 flex gap-2 border-b border-slate-200">
        <button onClick={() => setTab("products")} className={`border-b-2 px-4 py-2.5 text-sm font-bold ${tab === "products" ? "border-blue-700 text-blue-700" : "border-transparent text-slate-500"}`}>🛍️ Catálogo de Produtos</button>
        <button onClick={() => setTab("orders")} className={`border-b-2 px-4 py-2.5 text-sm font-bold ${tab === "orders" ? "border-blue-700 text-blue-700" : "border-transparent text-slate-500"}`}>📦 Pedidos & Encomendas</button>
      </div>

      {tab === "products" && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div className="compex-card p-4"><p className="text-xs text-slate-500">Total de produtos</p><strong className="text-2xl font-black text-slate-900">{products.length}</strong></div>
            <div className="compex-card p-4"><p className="text-xs text-slate-500">Ativos na loja</p><strong className="text-2xl font-black text-slate-900">{products.filter((p) => p.active).length}</strong></div>
          </div>

          <div className="compex-card p-4">
            <input type="search" placeholder="Buscar por nome ou categoria..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-navy focus:outline-none" />

            {loadingProducts && <div className="flex flex-col items-center gap-2 py-12 text-slate-500"><LoaderCircle className="w-5 h-5 animate-spin" /><span className="text-xs font-bold">Carregando produtos...</span></div>}
            {!loadingProducts && productError && <div className="flex flex-col items-center gap-2 py-12 text-slate-500"><PackageX className="w-5 h-5" /><span className="text-xs font-bold">{productError}</span></div>}
            {!loadingProducts && !productError && filteredProducts.length === 0 && <p className="py-12 text-center text-xs font-bold text-slate-400">Nenhum produto cadastrado ainda.</p>}

            {!loadingProducts && !productError && filteredProducts.map((p) => (
              <div key={p.id} className="flex items-center gap-4 border-b border-slate-100 py-3 last:border-0">
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 grid place-items-center text-lg">
                  {p.imageUrl ? <img src={toBackendAsset(p.imageUrl) || undefined} alt={p.name} className="h-full w-full object-cover" /> : "🛍️"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <b className="truncate text-sm text-slate-900">{p.name}</b>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${p.type === "ENCOMENDA" ? "bg-slate-100 text-slate-600" : "bg-teal-50 text-teal-800"}`}>
                      {p.type === "ENCOMENDA" ? "📦 Sob Encomenda" : `⚡ Pronta Entrega (${p.stock} un.)`}
                    </span>
                  </div>
                  <small className="text-slate-500">{p.category}{p.description ? ` · ${p.description}` : ""}</small>
                </div>
                <strong className="shrink-0 text-sm text-slate-700">{money(p.price)}</strong>
                <button onClick={() => openEditProduct(p)} className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label="Editar"><Pencil size={14} /></button>
                <label className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-slate-600">
                  <input type="checkbox" checked={p.active} onChange={() => toggleActive(p)} /> {p.active ? "Ativo" : "Inativo"}
                </label>
                <button onClick={() => removeProduct(p)} className="shrink-0 rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label="Remover"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "orders" && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="compex-card p-4"><p className="text-xs text-slate-500">Total de pedidos</p><strong className="text-2xl font-black text-slate-900">{orderMetrics.total}</strong></div>
            <div className="compex-card p-4"><p className="text-xs text-slate-500">Em produção</p><strong className="text-2xl font-black text-slate-900">{orderMetrics.preparing}</strong></div>
            <div className="compex-card p-4"><p className="text-xs text-slate-500">Prontos p/ retirada</p><strong className="text-2xl font-black text-slate-900">{orderMetrics.ready}</strong></div>
            <div className="compex-card p-4"><p className="text-xs text-slate-500">Entregues</p><strong className="text-2xl font-black text-slate-900">{orderMetrics.delivered}</strong></div>
          </div>

          <div className="compex-card p-4">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row">
              <input type="search" placeholder="Buscar por associado, e-mail ou produto..." value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-navy focus:outline-none" />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <option value="ALL">Todos os status</option>
                {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>

            {loadingOrders && <div className="flex flex-col items-center gap-2 py-12 text-slate-500"><LoaderCircle className="w-5 h-5 animate-spin" /><span className="text-xs font-bold">Carregando pedidos...</span></div>}
            {!loadingOrders && filteredOrders.length === 0 && <p className="py-12 text-center text-xs font-bold text-slate-400">Nenhum pedido encontrado.</p>}

            {!loadingOrders && filteredOrders.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 py-4 last:border-0">
                <div className="min-w-[240px] flex-1">
                  <div className="flex items-center gap-2">
                    <b className="text-sm text-slate-900">{o.memberName}</b>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                  </div>
                  <small className="block text-slate-500">{o.memberEmail} · Matrícula/ID: {o.memberRegistration}</small>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {o.items.map((i) => (
                      <span key={i.id} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-700">
                        {i.quantity}x {i.productName}{i.size ? ` · Tam ${i.size}` : ""}{i.customizationName ? ` · ✍️ ${i.customizationName}${i.customizationNumber ? ` #${i.customizationNumber}` : ""}` : ""}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="min-w-[160px] text-right">
                  <strong className="block text-sm text-slate-800">{money(o.totalPrice)}</strong>
                  <small className="block text-slate-500">Previsão: <b>{o.estimatedDelivery ? new Date(o.estimatedDelivery).toLocaleDateString("pt-BR") : "Sem data"}</b></small>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => setDateModal({ orderId: o.id, date: o.estimatedDelivery ? o.estimatedDelivery.slice(0, 10) : "" })} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50">📅 Previsão</button>
                  <button onClick={() => notify(o)} disabled={o.status === "DELIVERED" || busyOrderId === o.id} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-40">🔔 Notificar</button>
                  <button onClick={() => { setQrModal(o); setManualCode(""); }} disabled={o.status === "DELIVERED"} className="inline-flex items-center gap-1 rounded-lg bg-[#0b2265] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#071745] disabled:opacity-40">
                    {o.status === "DELIVERED" ? "✓ Entregue" : <><QrCode size={12} /> Validar</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <form onSubmit={submitForm} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">{form.id ? "Editar produto" : "Novo produto"}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">Nome do produto</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Tirante COMPEX 2026" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">Categoria</label>
                <input required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Vestuário, Acessórios..." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">Preço (R$)</label>
                <input required type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">Tipo de produto</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Product["type"] })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="PRONTA_ENTREGA">⚡ Pronta Entrega</option>
                  <option value="ENCOMENDA">📦 Sob Encomenda (Pedido)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">Quantidade em estoque</label>
                <input required type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="text-xs font-bold text-slate-600">Opções do produto</span>
              <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.allowSize} onChange={(e) => setForm({ ...form, allowSize: e.target.checked })} /> 👕 Permite escolher tamanho (PP, P, M, G, GG, XGG)</label>
              <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.allowCustomization} onChange={(e) => setForm({ ...form, allowCustomization: e.target.checked })} /> ✍️ Permite personalização (nome e número)</label>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">Foto do produto</label>
              <div className="flex items-center gap-3">
                <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 text-lg">
                  {form.imageUrl ? <img src={toBackendAsset(form.imageUrl) || undefined} alt="" className="h-full w-full object-cover" /> : <Package size={20} className="text-slate-400" />}
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                  {uploading ? <LoaderCircle size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploading ? "Enviando..." : "Escolher imagem"}
                  <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUpload(file); }} />
                </label>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">Descrição</label>
              <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalhes do produto..." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#0b2265] px-4 py-2 text-xs font-bold text-white hover:bg-[#071745] disabled:opacity-60">
                {saving && <LoaderCircle size={14} className="animate-spin" />} Salvar produto
              </button>
            </div>
          </form>
        </div>
      )}

      {dateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setDateModal(null); }}>
          <form onSubmit={saveDeliveryDate} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h2 className="text-lg font-black text-slate-900">Definir previsão de entrega</h2>
            <input required type="date" value={dateModal.date} onChange={(e) => setDateModal({ ...dateModal, date: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDateModal(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button type="submit" className="rounded-lg bg-[#0b2265] px-4 py-2 text-xs font-bold text-white hover:bg-[#071745]">Salvar previsão</button>
            </div>
          </form>
        </div>
      )}

      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setQrModal(null); }}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h2 className="text-lg font-black text-slate-900">Validar retirada</h2>
            <p className="text-xs text-slate-500">Pedido de <b>{qrModal.memberName}</b>. Digite o código/matrícula da carteirinha do associado para confirmar a entrega. (Leitura de QR por câmera ainda não foi portada para esta tela — use a página legada de produtos se precisar escanear.)</p>
            <input value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="Ex: COMPEX-AS-428" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setQrModal(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Fechar</button>
              <button type="button" onClick={() => deliverOrder(false)} className="rounded-lg bg-[#0b2265] px-4 py-2 text-xs font-bold text-white hover:bg-[#071745]">Confirmar retirada</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProdutosGestaoPageGuarded() {
  return <GestaoGuard allow={["PRESIDENCIA", "PRODUTOS"]}><ProdutosGestaoPage /></GestaoGuard>;
}
