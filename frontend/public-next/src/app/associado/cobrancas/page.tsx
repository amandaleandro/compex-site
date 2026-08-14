import { ReceiptText } from "lucide-react";
import AssociatePage from "@/components/associate/AssociatePage";
export default function CobrancasPage(){return <AssociatePage eyebrow="FINANCEIRO" title="Minhas cobranças" description="Consulte documentos e comprovantes vinculados à sua associação."><div className="associate-list"><div className="associate-list-item"><div><b>Plano anual CompExatas 2026</b><small>Vencimento 05/02/2026 · R$ 79,90</small></div><span className="flex items-center gap-2 text-xs font-bold text-emerald-700"><ReceiptText size={17}/> Pago</span></div></div></AssociatePage>}
