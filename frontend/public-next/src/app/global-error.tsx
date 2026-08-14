"use client";

import { RefreshCw } from "lucide-react";
import styles from "./error-pages.module.css";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="pt-BR"><body><section className={styles.page}><article className={styles.card}>
    <div className={styles.visual}><img className={styles.logo} src="/compex-logo.png" alt="Mascote da CompExatas" /><strong className={styles.code}>!</strong></div>
    <div className={styles.content}><p className={styles.kicker}>PAUSA INESPERADA</p><h1 className={styles.title}>O jogo parou<em>por um instante.</em></h1><p className={styles.text}>Tivemos uma falha inesperada ao carregar o portal. Tente iniciar novamente para voltar à CompExatas.</p><div className={styles.quote}>“A matilha pode até pausar, mas sempre encontra o caminho de volta.”</div><div className={styles.actions}><button className={styles.primary} type="button" onClick={reset}><RefreshCw size={15}/> Recarregar o portal</button><a className={styles.secondary} href="/">Voltar ao início</a></div><p className={styles.help}>Se precisar, envie uma mensagem para suporte@compexatas.com.br.</p></div>
  </article></section></body></html>;
}
