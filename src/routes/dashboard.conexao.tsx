import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, RefreshCw, QrCode, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState, LoadingState } from "@/components/feedback";
import { InstanceStatusVisual } from "@/components/visuals/instance-status-visual";
import { mensagemDeErro } from "@/lib/functions";
import {
  consultarStatusWhatsapp,
  desconectarWhatsapp,
  gerarQrCodeWhatsapp,
  type EstadoWhatsapp,
} from "@/services/whatsapp";

export const Route = createFileRoute("/dashboard/conexao")({
  component: ConexaoPage,
});

const CHAVE = ["whatsapp"] as const;
const INTERVALO_POLLING_MS = 4000;

function ConexaoPage() {
  const queryClient = useQueryClient();

  // O estado exibido é sempre o retornado pela Evolution API (via Edge Function).
  // Enquanto aguarda a leitura do QR, consulta periodicamente até conectar.
  const { data, error, isPending, refetch, isFetching } = useQuery({
    queryKey: CHAVE,
    queryFn: async (): Promise<EstadoWhatsapp> => {
      const atual = await consultarStatusWhatsapp();
      const anterior = queryClient.getQueryData<EstadoWhatsapp>(CHAVE);
      // O status não devolve a imagem do QR; preserva a que já foi gerada nesta sessão.
      return atual.status === "aguardando_leitura" ? { ...atual, qrcode: anterior?.qrcode ?? null } : atual;
    },
    refetchInterval: (query) => (query.state.data?.status === "aguardando_leitura" ? INTERVALO_POLLING_MS : false),
    retry: false,
  });

  const gerarQr = useMutation({
    mutationFn: gerarQrCodeWhatsapp,
    onSuccess: (estado) => {
      queryClient.setQueryData(CHAVE, estado);
      if (estado.aviso) toast.info(estado.aviso);
      else if (estado.status === "conectado") toast.success("WhatsApp já está conectado.");
      else toast.success("QR Code gerado. Escaneie pelo WhatsApp.");
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  const desconectar = useMutation({
    mutationFn: desconectarWhatsapp,
    onSuccess: (estado) => {
      queryClient.setQueryData(CHAVE, estado);
      toast.success("Instância desconectada.");
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  if (isPending) return <LoadingState label="Consultando status do WhatsApp..." />;
  if (error || !data) {
    return <ErrorState message={mensagemDeErro(error, "Não foi possível consultar o WhatsApp.")} onRetry={() => refetch()} />;
  }

  const conectado = data.status === "conectado";
  const aguardando = data.status === "aguardando_leitura";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-border/60 bg-card p-8 text-center ">
        <InstanceStatusVisual status={data.status} />
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Sua instância WhatsApp</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Instância: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{data.instancia}</code>
        </p>

        <div className="mt-6 flex justify-center" aria-live="polite">
          {conectado ? (
            <Badge className="gap-1.5 bg-success text-success-foreground hover:bg-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> WhatsApp Conectado com Sucesso
            </Badge>
          ) : (
            <Badge variant="outline" className="border-warning/40 text-warning">
              {aguardando ? "Aguardando leitura do QR" : "Desconectado"}
            </Badge>
          )}
        </div>

        {aguardando && data.qrcode && (
          <div className="mx-auto mt-6 w-fit rounded-xl border border-border bg-white p-3">
            <img src={data.qrcode} alt="QR Code para conectar o WhatsApp" width={240} height={240} />
          </div>
        )}
        {aguardando && !data.qrcode && (
          <p className="mt-6 text-sm text-muted-foreground">
            O QR Code anterior expirou ou foi gerado em outra sessão. Gere um novo para conectar.
          </p>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {conectado ? (
            <Button variant="destructive" onClick={() => desconectar.mutate()} disabled={desconectar.isPending}>
              <PowerOff className="mr-2 h-4 w-4" />
              {desconectar.isPending ? "Desconectando..." : "Desconectar Instância"}
            </Button>
          ) : (
            <>
              <Button onClick={() => gerarQr.mutate()} disabled={gerarQr.isPending}>
                <QrCode className="mr-2 h-4 w-4" />
                {gerarQr.isPending ? "Gerando..." : "Gerar QR Code"}
              </Button>
              <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Atualizar Status
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
