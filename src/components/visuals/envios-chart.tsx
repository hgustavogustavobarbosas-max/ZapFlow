import { lazy, useState } from "react";
import { ErrorState } from "@/components/feedback";
import { SceneCanvas } from "@/components/three/SceneCanvas";
import { useEnviosPorDia } from "@/hooks/use-envios-por-dia";
import { useRenderMode } from "@/hooks/use-render-mode";
import { cn } from "@/lib/utils";
import { mensagemDeErro } from "@/lib/functions";
import { LIMITE_AMOSTRA_GRAFICO } from "@/services/historico";
import type { EnvioDia } from "@/types/envios";
import { formatarDiaCurto, maiorContagemDiaria, totaisDoPeriodo } from "@/utils/envios";

const SendsBars = lazy(() => import("@/components/three/SendsBars"));

const DIAS_EXIBIDOS = 14;

type Selecao = { selecionado: number | null; onSelecionar: (i: number | null) => void };

/** Versão 2D equivalente (mobile, movimento reduzido ou sem WebGL): mesmos dados, navegável por teclado. */
function BarrasEstaticas({ dias, maximo, selecionado, onSelecionar }: Selecao & { dias: ReadonlyArray<EnvioDia>; maximo: number }) {
  return (
    <div className="flex h-full items-end gap-1 px-1" role="group" aria-label="Envios por dia">
      {dias.map((d, i) => (
        <button
          key={d.dia}
          type="button"
          aria-label={`${formatarDiaCurto(d.dia)}: ${d.sucesso} sucessos, ${d.erro} erros`}
          onMouseEnter={() => onSelecionar(i)}
          onMouseLeave={() => onSelecionar(null)}
          onFocus={() => onSelecionar(i)}
          onBlur={() => onSelecionar(null)}
          className={cn(
            "flex h-full min-w-0 flex-1 items-end justify-center gap-0.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            i === selecionado && "bg-accent/60",
          )}
        >
          {[
            { valor: d.sucesso, cor: "bg-success" },
            { valor: d.erro, cor: "bg-destructive" },
          ].map(({ valor, cor }) => (
            <span
              key={cor}
              className={cn("w-1/3 max-w-3 rounded-t-sm", cor)}
              style={{ height: `${maximo > 0 ? Math.max(2, (valor / maximo) * 100) : 2}%` }}
            />
          ))}
        </button>
      ))}
    </div>
  );
}

export function EnviosChart() {
  const modo = useRenderMode();
  const { data, error, isPending, refetch } = useEnviosPorDia(DIAS_EXIBIDOS);
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [falha3D, setFalha3D] = useState(false);

  if (error) {
    return <ErrorState message={mensagemDeErro(error, "Não foi possível carregar o gráfico de envios.")} onRetry={() => refetch()} />;
  }

  const dias = data?.dias ?? [];
  const maximo = maiorContagemDiaria(dias);
  const totais = totaisDoPeriodo(dias);
  const vazio = !isPending && totais.sucesso + totais.erro === 0;
  const mostrar3D = modo.pronto && modo.usar3D && !modo.leve && !falha3D;
  const detalhe = selecionado !== null ? dias[selecionado] : null;

  return (
    <section aria-labelledby="titulo-envios" className="rounded-xl border border-border/60 bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="titulo-envios" className="font-semibold">Envios nos últimos {DIAS_EXIBIDOS} dias</h2>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {detalhe
              ? `${formatarDiaCurto(detalhe.dia)}: ${detalhe.sucesso} sucesso(s), ${detalhe.erro} erro(s)`
              : `${totais.sucesso} sucesso(s) · ${totais.erro} erro(s) no período`}
          </p>
        </div>
        <ul className="flex gap-4 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-success" /> Sucesso</li>
          <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-destructive" /> Erro</li>
        </ul>
      </div>

      {isPending ? (
        <div role="status" className="mt-4 h-44 animate-pulse rounded-lg bg-muted/40 md:h-56">
          <span className="sr-only">Carregando gráfico...</span>
        </div>
      ) : vazio ? (
        <p className="mt-4 rounded-lg border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          Sem envios neste período. Os disparos recebidos pelo webhook aparecerão aqui.
        </p>
      ) : (
        <>
          <div className="relative mt-4 h-44 md:h-56">
            {mostrar3D ? (
              <SceneCanvas camera={{ position: [0, 3.4, 9], fov: 32 }} leve={false} frameloop="demand" onFalha={() => setFalha3D(true)}>
                <SendsBars dias={dias} maximo={maximo} selecionado={selecionado} onSelecionar={setSelecionado} />
              </SceneCanvas>
            ) : (
              <BarrasEstaticas dias={dias} maximo={maximo} selecionado={selecionado} onSelecionar={setSelecionado} />
            )}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{formatarDiaCurto(dias[0].dia)}</span>
            <span>{formatarDiaCurto(dias[dias.length - 1].dia)}</span>
          </div>
        </>
      )}

      {data?.amostraParcial && (
        <p className="mt-3 text-xs text-warning">
          Gráfico calculado sobre os {LIMITE_AMOSTRA_GRAFICO} envios mais recentes; os dias mais antigos podem estar incompletos.
        </p>
      )}

      {!vazio && !isPending && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver dados em tabela</summary>
          <table className="mt-2 w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th scope="col" className="py-1 font-medium">Dia</th>
                <th scope="col" className="py-1 font-medium">Sucesso</th>
                <th scope="col" className="py-1 font-medium">Erro</th>
              </tr>
            </thead>
            <tbody>
              {dias.map((d) => (
                <tr key={d.dia} className="border-t border-border/40">
                  <th scope="row" className="py-1 font-normal">{formatarDiaCurto(d.dia)}</th>
                  <td className="py-1">{d.sucesso}</td>
                  <td className="py-1">{d.erro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}
