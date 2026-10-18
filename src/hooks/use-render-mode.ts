import { useEffect, useState } from "react";

export type RenderMode = {
  /** Falso na renderização inicial (SSR/hidratação): nesse momento sempre se usa a versão estática. */
  pronto: boolean;
  /** WebGL disponível e usuário não pediu redução de movimento. */
  usar3D: boolean;
  /** Tela estreita ou toque como entrada principal: cenas simplificadas ou substituídas por versão 2D. */
  leve: boolean;
};

const INICIAL: RenderMode = { pronto: false, usar3D: false, leve: true };

let webglCache: boolean | null = null;

function webglDisponivel(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    webglCache = gl !== null;
    // Libera o contexto de teste: navegadores limitam a quantidade de contextos ativos.
    (gl?.getExtension("WEBGL_lose_context") as { loseContext(): void } | null | undefined)?.loseContext();
  } catch {
    webglCache = false;
  }
  return webglCache;
}

export function useRenderMode(): RenderMode {
  const [modo, setModo] = useState<RenderMode>(INICIAL);

  useEffect(() => {
    const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)");
    const telaEstreita = window.matchMedia("(max-width: 767px)");
    const toque = window.matchMedia("(pointer: coarse)");
    const webgl = webglDisponivel();

    const atualizar = () =>
      setModo({ pronto: true, usar3D: webgl && !reduzirMovimento.matches, leve: telaEstreita.matches || toque.matches });

    atualizar();
    const consultas = [reduzirMovimento, telaEstreita, toque];
    consultas.forEach((c) => c.addEventListener("change", atualizar));
    return () => consultas.forEach((c) => c.removeEventListener("change", atualizar));
  }, []);

  return modo;
}
