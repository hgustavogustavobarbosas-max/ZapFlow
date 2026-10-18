import { lazy, useState } from "react";
import { cn } from "@/lib/utils";
import { useRenderMode } from "@/hooks/use-render-mode";
import { SceneCanvas } from "@/components/three/SceneCanvas";

const PipelineScene = lazy(() => import("@/components/three/PipelineScene"));

type Etapa = { titulo: string; descricao: string };

/** Etapas reais do processamento do webhook (veja o fluxo no README). */
const ETAPAS: ReadonlyArray<Etapa> = [
  { titulo: "Webhook", descricao: "Seu CRM, formulário ou n8n envia um POST com o lead." },
  { titulo: "Lead", descricao: "Nome e telefone são extraídos pelos campos que você mapeou." },
  { titulo: "Mensagem", descricao: "Template manual ou texto gerado por IA para cada lead." },
  { titulo: "WhatsApp", descricao: "O envio sai pela sua instância conectada." },
  { titulo: "Histórico", descricao: "Cada disparo vira um registro auditável, com sucesso ou erro." },
];

/**
 * Fluxo do produto, do webhook ao histórico. A lista de etapas é a versão completa e acessível;
 * a cena 3D (apenas desktop, sem redução de movimento) é um complemento visual da mesma lista.
 */
export function PipelineVisual() {
  const modo = useRenderMode();
  const [falha3D, setFalha3D] = useState(false);
  const [ativa, setAtiva] = useState(0);
  const mostrar3D = modo.pronto && modo.usar3D && !modo.leve && !falha3D;

  return (
    <div>
      {mostrar3D && (
        <div className="relative mb-6 h-[300px] overflow-hidden rounded-xl border border-border/60 bg-card/40 lg:h-[340px]">
          <SceneCanvas camera={{ position: [0, 2.4, 9], fov: 32 }} leve={false} frameloop="always" onFalha={() => setFalha3D(true)}>
            <PipelineScene quantidade={ETAPAS.length} ativa={ativa} onAtivar={setAtiva} />
          </SceneCanvas>
        </div>
      )}

      <ol className="grid gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60 text-left md:grid-cols-5">
        {ETAPAS.map((etapa, i) => (
          <li key={etapa.titulo} className="bg-card">
            <button
              type="button"
              aria-current={i === ativa ? "step" : undefined}
              onMouseEnter={() => setAtiva(i)}
              onFocus={() => setAtiva(i)}
              onClick={() => setAtiva(i)}
              className={cn(
                "flex h-full w-full flex-col gap-1.5 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                i === ativa ? "bg-primary/10" : "hover:bg-accent/50",
              )}
            >
              <span className="font-mono text-xs text-primary">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-semibold tracking-tight">{etapa.titulo}</span>
              <span className="text-sm leading-relaxed text-muted-foreground">{etapa.descricao}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
