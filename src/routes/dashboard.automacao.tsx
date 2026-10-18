import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Copy, RefreshCw, Save, Sparkles, Type, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState, LoadingState } from "@/components/feedback";
import { mensagemDeErro } from "@/lib/functions";
import { buscarAutomacao, rotacionarWebhookSlug, salvarAutomacao, urlDoWebhook, type Automacao } from "@/services/automacao";
// Mesma lógica usada pelo backend, para que o teste na tela reflita exatamente o envio real.
import { getByPath, listLeafPaths, toScalarString } from "../../supabase/functions/_shared/json-path";
import { normalizePhone } from "../../supabase/functions/_shared/phone";
import { renderTemplate } from "../../supabase/functions/_shared/template";

export const Route = createFileRoute("/dashboard/automacao")({
  component: AutomacaoPage,
});

const CHAVE = ["automacao"] as const;
const TONS = ["Profissional", "Amigável", "Direto", "Empático", "Divertido", "Consultivo"];
const JSON_EXEMPLO = '{\n  "nome": "Maria Silva",\n  "telefone": "+5511999998888",\n  "origem": "Instagram"\n}';

const esquema = z
  .object({
    modo_mensagem: z.enum(["manual", "ia"]),
    mensagem_manual_template: z.string().max(1000, "O template aceita até 1000 caracteres").nullable(),
    ia_prompt_instrucao: z.string().max(2000, "A instrução da IA aceita até 2000 caracteres").nullable(),
    ia_tom_voz: z.string().max(50).nullable(),
    path_nome_lead: z.string().trim().min(1, "Defina o campo do nome").max(200),
    path_telefone_lead: z.string().trim().min(1, "Defina o campo do telefone").max(200),
    ativa: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.modo_mensagem === "manual" && !v.mensagem_manual_template?.trim()) {
      ctx.addIssue({ code: "custom", path: ["mensagem_manual_template"], message: "Escreva o template da mensagem" });
    }
    if (v.modo_mensagem === "ia" && !v.ia_prompt_instrucao?.trim()) {
      ctx.addIssue({ code: "custom", path: ["ia_prompt_instrucao"], message: "Descreva o objetivo para a IA" });
    }
  });

type Rascunho = z.infer<typeof esquema>;

const paraRascunho = (a: Automacao): Rascunho => ({
  modo_mensagem: a.modo_mensagem,
  mensagem_manual_template: a.mensagem_manual_template,
  ia_prompt_instrucao: a.ia_prompt_instrucao,
  ia_tom_voz: a.ia_tom_voz,
  path_nome_lead: a.path_nome_lead,
  path_telefone_lead: a.path_telefone_lead,
  ativa: a.ativa,
});

function AutomacaoPage() {
  const queryClient = useQueryClient();
  const { data, error, isPending, refetch } = useQuery({ queryKey: CHAVE, queryFn: buscarAutomacao });
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [jsonTeste, setJsonTeste] = useState(JSON_EXEMPLO);

  useEffect(() => {
    if (data) setRascunho((atual) => atual ?? paraRascunho(data));
  }, [data]);

  const salvar = useMutation({
    mutationFn: (campos: Rascunho) => salvarAutomacao(data!.id, campos),
    onSuccess: (salvo) => {
      queryClient.setQueryData(CHAVE, salvo);
      setRascunho(paraRascunho(salvo));
      toast.success("Configuração salva!");
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  const rotacionar = useMutation({
    mutationFn: rotacionarWebhookSlug,
    onSuccess: (slug) => {
      queryClient.setQueryData<Automacao>(CHAVE, (atual) => (atual ? { ...atual, webhook_slug: slug } : atual));
      toast.success("Nova URL gerada. Atualize-a nas suas integrações.");
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  const jsonAnalisado = useMemo(() => {
    try {
      const valor: unknown = JSON.parse(jsonTeste);
      return valor !== null && typeof valor === "object" && !Array.isArray(valor) ? valor : null;
    } catch {
      return null;
    }
  }, [jsonTeste]);
  const chavesJson = useMemo(() => (jsonAnalisado ? listLeafPaths(jsonAnalisado) : []), [jsonAnalisado]);

  if (isPending) return <LoadingState />;
  if (error || !data || !rascunho) {
    return <ErrorState message={mensagemDeErro(error, "Não foi possível carregar a automação.")} onRetry={() => refetch()} />;
  }

  function patch<K extends keyof Rascunho>(chave: K, valor: Rascunho[K]) {
    setRascunho((r) => (r ? { ...r, [chave]: valor } : r));
  }

  function aoSalvar() {
    const validado = esquema.safeParse(rascunho);
    if (!validado.success) return toast.error(validado.error.issues[0].message);
    salvar.mutate(validado.data);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(urlDoWebhook(data!.webhook_slug));
      toast.success("URL copiada!");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  }

  // Opções do select: chaves do JSON de teste + valor atualmente salvo (para não aparecer em branco).
  const opcoes = (atual: string) => Array.from(new Set([...chavesJson, atual].filter(Boolean)));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Toggle ativar */}
      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-5">
        <div>
          <h3 className="font-semibold">Automação ativa</h3>
          <p className="text-sm text-muted-foreground">Quando desativada, novos webhooks são ignorados.</p>
        </div>
        <Switch aria-label="Automação ativa" checked={rascunho.ativa} onCheckedChange={(v) => patch("ativa", v)} />
      </div>

      {/* Webhook URL */}
      <div className="rounded-xl border border-border/60 bg-card p-5">
        <h3 className="font-semibold">URL do Webhook</h3>
        <p className="text-sm text-muted-foreground">Use esta URL na sua origem de leads (Typebot, n8n, formulários, CRM). Envie um POST com JSON.</p>
        <div className="mt-3 flex gap-2">
          <Input readOnly aria-label="URL do webhook" value={urlDoWebhook(data.webhook_slug)} className="font-mono text-xs" />
          <Button variant="outline" onClick={copiar} aria-label="Copiar URL do webhook"><Copy className="h-4 w-4" /></Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Quem tem esta URL pode disparar mensagens. Não a compartilhe publicamente.</p>
          <Button
            variant="ghost"
            size="sm"
            disabled={rotacionar.isPending}
            onClick={() => {
              if (window.confirm("Gerar uma nova URL? A atual deixará de funcionar imediatamente.")) rotacionar.mutate();
            }}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${rotacionar.isPending ? "animate-spin" : ""}`} /> Gerar nova URL
          </Button>
        </div>
      </div>

      {/* Mapeador */}
      <div className="rounded-xl border border-border/60 bg-card p-5">
        <h3 className="font-semibold">Mapeador de Leads</h3>
        <p className="text-sm text-muted-foreground">Cole um JSON de exemplo e escolha quais chaves contêm o nome e o telefone.</p>
        <div className="mt-3">
          <Label htmlFor="json-teste" className="text-xs">JSON de teste</Label>
          <Textarea
            id="json-teste"
            value={jsonTeste}
            onChange={(e) => setJsonTeste(e.target.value)}
            rows={8}
            maxLength={20000}
            className="mt-1 font-mono text-xs"
          />
          {!jsonAnalisado && (
            <p role="alert" className="mt-1 text-xs text-destructive">O texto não é um objeto JSON válido.</p>
          )}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <Label className="text-xs">Qual campo é o NOME?</Label>
            <Select value={rascunho.path_nome_lead} onValueChange={(v) => patch("path_nome_lead", v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {opcoes(rascunho.path_nome_lead).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Qual campo é o TELEFONE?</Label>
            <Select value={rascunho.path_telefone_lead} onValueChange={(v) => patch("path_telefone_lead", v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {opcoes(rascunho.path_telefone_lead).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <TesteDePayload rascunho={rascunho} payload={jsonAnalisado} />
      </div>

      {/* Modo */}
      <div className="rounded-xl border border-border/60 bg-card p-5">
        <h3 className="font-semibold">Modo de mensagem</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            aria-pressed={rascunho.modo_mensagem === "manual"}
            onClick={() => patch("modo_mensagem", "manual")}
            className={`flex items-center gap-2 rounded-lg border p-4 text-left transition-colors ${
              rascunho.modo_mensagem === "manual" ? "border-primary bg-primary/10" : "border-border hover:bg-accent"
            }`}
          >
            <Type className="h-5 w-5 text-primary" />
            <div>
              <div className="font-medium text-sm">Texto Manual</div>
              <div className="text-xs text-muted-foreground">Template com tags {`{nome}`}</div>
            </div>
          </button>
          <button
            type="button"
            aria-pressed={rascunho.modo_mensagem === "ia"}
            onClick={() => patch("modo_mensagem", "ia")}
            className={`flex items-center gap-2 rounded-lg border p-4 text-left transition-colors ${
              rascunho.modo_mensagem === "ia" ? "border-primary bg-primary/10" : "border-border hover:bg-accent"
            }`}
          >
            <Sparkles className="h-5 w-5 text-primary" />
            <div>
              <div className="font-medium text-sm">Mensagem por IA</div>
              <div className="text-xs text-muted-foreground">Gerada para cada lead</div>
            </div>
          </button>
        </div>

        {rascunho.modo_mensagem === "manual" ? (
          <div className="mt-5">
            <Label htmlFor="tpl">Template da mensagem</Label>
            <Textarea
              id="tpl"
              rows={5}
              maxLength={1000}
              value={rascunho.mensagem_manual_template ?? ""}
              onChange={(e) => patch("mensagem_manual_template", e.target.value)}
              placeholder="Olá {nome}, tudo bem?"
              className="mt-1"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Dica: use <code className="rounded bg-muted px-1">{`{nome}`}</code> e <code className="rounded bg-muted px-1">{`{telefone}`}</code> para inserir os dados do lead.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div>
              <Label>Tom de voz</Label>
              <Select value={rascunho.ia_tom_voz ?? ""} onValueChange={(v) => patch("ia_tom_voz", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione um tom" /></SelectTrigger>
                <SelectContent>
                  {TONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ia-prompt">Objetivo / contexto para a IA</Label>
              <Textarea
                id="ia-prompt"
                rows={5}
                maxLength={2000}
                value={rascunho.ia_prompt_instrucao ?? ""}
                onChange={(e) => patch("ia_prompt_instrucao", e.target.value)}
                placeholder="Ex: Sou consultor financeiro. Quero qualificar o lead e marcar uma reunião de 15 min."
                className="mt-1"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={aoSalvar} disabled={salvar.isPending} size="lg">
          <Save className="mr-2 h-4 w-4" /> {salvar.isPending ? "Salvando..." : "Salvar configuração"}
        </Button>
      </div>
    </div>
  );
}

function TesteDePayload({ rascunho, payload }: { rascunho: Rascunho; payload: object | null }) {
  if (!payload) return null;
  const nome = toScalarString(getByPath(payload, rascunho.path_nome_lead));
  const telefoneBruto = getByPath(payload, rascunho.path_telefone_lead);
  const telefone = normalizePhone(telefoneBruto);
  const mensagem =
    rascunho.modo_mensagem === "manual" && nome && telefone.ok && rascunho.mensagem_manual_template
      ? renderTemplate(rascunho.mensagem_manual_template, { nome, telefone: telefone.phone })
      : null;

  return (
    <div className="mt-4 rounded-lg border border-border/60 bg-muted/30 p-4 text-sm" aria-live="polite">
      <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Teste do payload</h4>
      <ul className="space-y-1.5">
        <Linha ok={!!nome} rotulo="Nome" valor={nome} falha={`Campo "${rascunho.path_nome_lead}" não encontrado ou vazio`} />
        <Linha
          ok={telefone.ok}
          rotulo="Telefone"
          valor={telefone.ok ? `+${telefone.phone}` : null}
          falha={telefone.ok ? "" : telefone.reason}
        />
      </ul>
      {mensagem && (
        <div className="mt-3">
          <div className="text-xs text-muted-foreground">Mensagem que seria enviada:</div>
          <pre className="mt-1 whitespace-pre-wrap rounded-md bg-background p-3 text-xs">{mensagem}</pre>
        </div>
      )}
      {rascunho.modo_mensagem === "ia" && (
        <p className="mt-3 text-xs text-muted-foreground">No modo IA, a mensagem é gerada no momento do envio real.</p>
      )}
    </div>
  );
}

function Linha({ ok, rotulo, valor, falha }: { ok: boolean; rotulo: string; valor: string | null; falha: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? <CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> : <XCircle className="h-4 w-4 text-destructive" aria-hidden />}
      <span className="font-medium">{rotulo}:</span>
      <span className={ok ? "" : "text-destructive"}>{ok ? valor : falha}</span>
    </li>
  );
}
