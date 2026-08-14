import Link from "next/link";
import AssociatePage from "@/components/associate/AssociatePage";
const products=[["Camisa Oficial CompExatas 2026","R$ 55,90"],["Tirante Oficial + Porta Caneca","R$ 18,00"],["Caneca Alumínio 850ml","R$ 35,00"]];
export default function LojaAssociadoPage(){return <AssociatePage eyebrow="PRODUTOS OFICIAIS" title="Loja CompExatas" description="Produtos oficiais com preço especial para associados."><div className="associate-list">{products.map(([name,price],i)=><div className="associate-list-item" key={name}><div><b>{name}</b><small>Preço associado · <strong className="text-blue-700">{price}</strong></small></div><Link href={`/loja/${i+1}`} className="associate-link">Ver produto</Link></div>)}</div></AssociatePage>}
