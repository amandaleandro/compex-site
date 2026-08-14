"use client";

import Link from "next/link";
import { Home, RefreshCw } from "lucide-react";
import styles from "./error-pages.module.css";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className={styles.page}><article className={styles.card}>
    <div className={styles.visual}><img className={styles.logo} src="/compex-logo.png" alt="Mascote da CompExatas" /><strong className={styles.code}>OPS</strong></div>
    <div className={styles.content}><p className={styles.kicker}>TEMPO TÉCNICO</p><h1 className={styles.title}>Algo saiu<em>do nosso plano.</em></h1><p className={styles.text}>Não conseguimos concluir esta jogada agora. Seus dados continuam protegidos e você pode tentar novamente.</p><div className={styles.quote}>“Até o melhor time pede tempo. Respirar, ajustar e voltar faz parte.”</div><div className={styles.actions}><button className={styles.primary} type="button" onClick={reset}><RefreshCw size={15}/> Tentar novamente</button><Link className={styles.secondary} href="/"><Home size={15}/> Ir para o início</Link></div><p className={styles.help}>Se o problema continuar, fale com a gente: suporte@compexatas.com.br</p></div>
  </article></section>;
}
