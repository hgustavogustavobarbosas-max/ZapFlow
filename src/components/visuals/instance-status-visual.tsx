import { lazy, useState } from "react";
import { Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRenderMode } from "@/hooks/use-render-mode";
import { SceneCanvas } from "@/components/three/SceneCanvas";
import type { StatusConexao } from "@/integrations/supabase/types";

const InstanceStatusScene = lazy(() => import("@/components/three/InstanceStatusScene"));

const ESTILO_ESTATICO: Record<StatusConexao, string> = {
  conectado: "border-success/60 bg-success/10 text-success",
  aguardando_leitura: "border-warning/60 bg-warning/10 text-warning animate-pulse",
  desconectado: "border-border bg-muted text-muted-foreground",
};

/** Representação visual do estado real da instância. O texto de status continua na própria página. */
export function InstanceStatusVisual({ status }: { status: StatusConexao }) {
  const modo = useRenderMode();
  const [falha3D, setFalha3D] = useState(false);
  const mostrar3D = modo.pronto && modo.usar3D && !falha3D;

  return (
    <div className="relative mx-auto h-36 w-36">
      {mostrar3D ? (
        <SceneCanvas camera={{ position: [0, 0, 4.6], fov: 35 }} leve={modo.leve} frameloop="always" onFalha={() => setFalha3D(true)}>
          <InstanceStatusScene status={status} />
        </SceneCanvas>
      ) : (
        <div
          aria-hidden
          className={cn("flex h-full w-full items-center justify-center rounded-full border-2", ESTILO_ESTATICO[status])}
        >
          <Smartphone className="h-10 w-10" />
        </div>
      )}
    </div>
  );
}
