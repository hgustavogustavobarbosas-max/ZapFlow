import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/feedback";
import { EnviosChart } from "@/components/visuals/envios-chart";
import { mensagemDeErro } from "@/lib/functions";
import { listarLogs, TAMANHO_PAGINA, type OrdemHistorico } from "@/services/historico";

export const Route = createFileRoute("/dashboard/historico")({
  component: HistoricoPage,
});

function HistoricoPage() {
  const [pagina, setPagina] = useState(0);
  const [ordem, setOrdem] = useState<OrdemHistorico>("recentes");

  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: ["historico", pagina, ordem],
    queryFn: () => listarLogs({ pagina, ordem }),
    placeholderData: keepPreviousData,
  });

  if (isPending) return <LoadingState />;
  if (error || !data) {
    return <ErrorState message={mensagemDeErro(error, "Não foi possível carregar o histórico.")} onRetry={() => refetch()} />;
  }

  const { logs, total } = data;
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANHO_PAGINA));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <EnviosChart />
      <div className="rounded-xl border border-border/60 bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 p-5">
          <div>
            <h2 className="font-semibold">Histórico de envios</h2>
            <p className="text-sm text-muted-foreground">Disparos recebidos via webhook ({total} no total).</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setOrdem((o) => (o === "recentes" ? "antigos" : "recentes"));
              setPagina(0);
            }}
          >
            {ordem === "recentes" ? <ArrowDown className="mr-2 h-4 w-4" /> : <ArrowUp className="mr-2 h-4 w-4" />}
            {ordem === "recentes" ? "Mais recentes" : "Mais antigos"}
          </Button>
        </div>

        {logs.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhum envio ainda. Configure seu webhook em <strong>Automação</strong> para começar.
          </div>
        ) : (
          <div className={`overflow-x-auto ${isFetching ? "opacity-70" : ""}`}>
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">Data/Hora</th>
                  <th scope="col" className="px-5 py-3 font-medium">Lead</th>
                  <th scope="col" className="px-5 py-3 font-medium">Mensagem</th>
                  <th scope="col" className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border/40 last:border-b-0 hover:bg-accent/40">
                    <td className="px-5 py-3 whitespace-nowrap text-muted-foreground">
                      {new Date(log.criado_em).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-5 py-3 font-medium">{log.lead_nome ?? "—"}</td>
                    <td
                      className="px-5 py-3 max-w-md truncate text-muted-foreground"
                      title={log.mensagem_gerada ?? log.erro_mensagem ?? ""}
                    >
                      {log.status === "erro" ? log.erro_mensagem : log.mensagem_gerada}
                    </td>
                    <td className="px-5 py-3">
                      {log.status === "sucesso" ? (
                        <Badge className="bg-success text-success-foreground hover:bg-success">Sucesso</Badge>
                      ) : (
                        <Badge variant="destructive">Erro</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > TAMANHO_PAGINA && (
          <div className="flex items-center justify-between border-t border-border/60 p-4 text-sm">
            <span className="text-muted-foreground">Página {pagina + 1} de {totalPaginas}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPagina((p) => p - 1)} disabled={pagina === 0}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPagina((p) => p + 1)} disabled={pagina + 1 >= totalPaginas}>
                Próxima <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
