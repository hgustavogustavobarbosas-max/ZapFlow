import { Suspense, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { DPR_MAXIMO } from "./config";
import { SceneBoundary } from "./SceneBoundary";

type Props = {
  children: ReactNode;
  camera: { position: [number, number, number]; fov: number };
  /** Telas leves: resolução 1x e sem antialiasing. */
  leve: boolean;
  /** "always" para cenas com animação contínua; "demand" renderiza apenas quando algo muda. */
  frameloop: "always" | "demand";
  onFalha: () => void;
};

/** Pausa o loop de renderização quando o canvas sai da tela. */
function useVisivel(ref: RefObject<HTMLElement | null>): boolean {
  const [visivel, setVisivel] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entrada]) => setVisivel(entrada.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return visivel;
}

/** Canvas WebGL padrão do projeto: decorativo (aria-hidden), preenche o contêiner e não captura o scroll vertical. */
export function SceneCanvas({ children, camera, leve, frameloop, onFalha }: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  const visivel = useVisivel(raiz);

  return (
    <div ref={raiz} className="absolute inset-0" aria-hidden>
      <SceneBoundary onFalha={onFalha}>
        <Canvas
          dpr={leve ? 1 : [1, DPR_MAXIMO]}
          frameloop={frameloop === "always" && !visivel ? "never" : frameloop}
          camera={camera}
          gl={{ antialias: !leve, alpha: true, powerPreference: "low-power" }}
          style={{ touchAction: "pan-y" }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener("webglcontextlost", (evento) => {
              evento.preventDefault();
              onFalha();
            });
          }}
        >
          <Suspense fallback={null}>{children}</Suspense>
        </Canvas>
      </SceneBoundary>
    </div>
  );
}
