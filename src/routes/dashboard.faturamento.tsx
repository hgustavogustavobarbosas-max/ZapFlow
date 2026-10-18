import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, CreditCard, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState, LoadingState } from "@/components/feedback";
import { mensagemDeErro } from "@/lib/functions";
import { buscarAssinatura, iniciarCheckout } from "@/services/assinatura";

export const Route = createFileRoute("/dashboard/faturamento")({
  validateSearch: (search: Record<string, unknown>): { checkout?: string } =>
    typeof search.checkout === "string" ? { checkout: search.checkout } : {},
  component: FaturamentoPage,
});

const PLANO = {
  nome: "ZapFlow Pro",
  // Apenas exibição: o valor cobrado é o do produto cadastrado na AbacatePay.
  preco: import.meta.env.VITE_PLANO_PRECO ?? "R$ 97",
  beneficios: [
    "Instância WhatsApp dedicada",
    "Webhooks ilimitados",
    "Mensagens com IA inclusas",
    "Histórico completo de envios",
    "Suporte prioritário",
  ],
};

const ROTULO_STATUS: Record<string, string> = {
  active: "Plano Ativo",
  pendente: "Aguardando confirmação do pagamento",
  inadimplente: "Pagamento em atraso",
  cancelada: "Assinatura cancelada",
};

function FaturamentoPage() {
  const { checkout } = Route.useSearch();
  const voltouDoCheckout = checkout === "ok";

  // Após voltar do checkout, o status muda quando o webhook da AbacatePay chega; consulta até lá.
  const { data: assin, error, isPending, refetch } = useQuery({
    queryKey: ["assinatura"],
    queryFn: buscarAssinatura,
    refetchInterval: (query) => {
      const status = query.state.data?.status_assinatura;
      return voltouDoCheckout && status !== "active" ? 4000 : false;
    },
  });

  const assinar = useMutation({
    mutationFn: iniciarCheckout,
    onSuccess: (url) => window.location.assign(url),
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  if (isPending) return <LoadingState />;
  if (error) {
    return <ErrorState message={mensagemDeErro(error, "Não foi possível carregar o faturamento.")} onRetry={() => refetch()} />;
  }

  const status = assin?.status_assinatura ?? "inativa";
  const ativa = status === "active";
  const podeAssinar = status === "inativa" || status === "pendente" || status === "cancelada";

  return (
    <div className="mx-auto max-w-2xl">
      {ativa ? (
        <div className="rounded-2xl border border-success/30 bg-card p-8 shadow-xl shadow-success/5">
          <div className="flex items-start justify-between">
            <div>
              <Badge className="bg-success text-success-foreground hover:bg-success">{ROTULO_STATUS.active}</Badge>
              <h2 className="mt-3 text-2xl font-semibold">{assin?.plano ?? PLANO.nome}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Próxima renovação:{" "}
                {assin?.proxima_renovacao ? new Date(assin.proxima_renovacao).toLocaleDateString("pt-BR") : "—"}
              </p>
            </div>
            <Sparkles className="h-6 w-6 text-primary" aria-hidden />
          </div>
          <div className="mt-6 space-y-2 border-t border-border/60 pt-6">
            {PLANO.beneficios.map((b) => (
              <div key={b} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary" aria-hidden /> {b}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-xl shadow-primary/5">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Mensal</Badge>
            {status !== "inativa" && (
              <Badge variant={status === "inadimplente" ? "destructive" : "outline"}>{ROTULO_STATUS[status]}</Badge>
            )}
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">{PLANO.nome}</h2>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-4xl font-bold">{PLANO.preco}</span>
            <span className="text-sm text-muted-foreground">/mês</span>
          </div>

          <div className="mt-6 space-y-2">
            {PLANO.beneficios.map((b) => (
              <div key={b} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary" aria-hidden /> {b}
              </div>
            ))}
          </div>

          {voltouDoCheckout && status === "pendente" && (
            <p role="status" className="mt-6 text-sm text-muted-foreground">
              Estamos aguardando a confirmação do pagamento. Esta página atualiza sozinha.
            </p>
          )}
          {status === "inadimplente" && (
            <p role="alert" className="mt-6 text-sm text-destructive">
              Houve falha na cobrança da sua assinatura. A AbacatePay fará novas tentativas automaticamente.
            </p>
          )}

          {podeAssinar && (
            <Button onClick={() => assinar.mutate()} disabled={assinar.isPending} size="lg" className="mt-8 w-full">
              <CreditCard className="mr-2 h-4 w-4" aria-hidden />
              {assinar.isPending ? "Abrindo checkout..." : "Assinar Agora"}
            </Button>
          )}
          <p className="mt-3 text-center text-xs text-muted-foreground">Pagamento processado pela AbacatePay</p>
        </div>
      )}
    </div>
  );
}
