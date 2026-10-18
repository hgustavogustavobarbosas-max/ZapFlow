// Webhook público de automação: recebe um lead, monta a mensagem (manual ou IA) e envia pelo WhatsApp.
// URL: POST /functions/v1/processar-webhook-automacao/:webhook_slug
//
// Autenticação: o slug é um segredo de 128 bits. Proteções: rate limit por IP e por slug,
// limite de payload, validação de estrutura e deduplicação de reenvios idênticos.
import { AiError, gerarMensagemIA } from "../_shared/ai.ts";
import { sha256Hex } from "../_shared/crypto.ts";
import { optionalEnv } from "../_shared/env.ts";
import { EvolutionError, enviarTexto, obterEstado } from "../_shared/evolution.ts";
import { clientIp, erro, HttpError, json, readBodyLimited, respostaDeExcecao } from "../_shared/http.ts";
import { getByPath, isPlainObjectWithinDepth, toScalarString } from "../_shared/json-path.ts";
import { normalizePhone } from "../_shared/phone.ts";
import { redactPayload } from "../_shared/redact.ts";
import { type Admin, consumirRateLimit, createAdminClient } from "../_shared/supabase.ts";
import { renderTemplate } from "../_shared/template.ts";

const MAX_PAYLOAD_BYTES = 64 * 1024;
const SLUG_REGEX = /^[A-Za-z0-9_-]{16,64}$/;
const JANELA_DEDUPLICACAO_MS = 60_000;

type Automacao = {
  id: string;
  usuario_id: string;
  modo_mensagem: "manual" | "ia";
  mensagem_manual_template: string | null;
  ia_prompt_instrucao: string | null;
  ia_tom_voz: string | null;
  path_nome_lead: string;
  path_telefone_lead: string;
};

type DadosLog = {
  payload: unknown;
  payloadHash?: string;
  leadNome?: string | null;
  leadTelefone?: string | null;
  mensagem?: string | null;
};

async function registrarLog(
  admin: Admin,
  automacao: Pick<Automacao, "id" | "usuario_id">,
  dados: DadosLog,
  status: "sucesso" | "erro",
  erroMensagem?: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("logs_automacao")
    .insert({
      usuario_id: automacao.usuario_id,
      automacao_id: automacao.id,
      dados_lead_recebidos: redactPayload(dados.payload),
      mensagem_gerada: dados.mensagem ?? null,
      lead_nome: dados.leadNome ?? null,
      lead_telefone: dados.leadTelefone ?? null,
      payload_hash: dados.payloadHash ?? null,
      status,
      erro_mensagem: erroMensagem ?? null,
    })
    .select("id")
    .single();
  if (error) {
    console.error(JSON.stringify({ contexto: "registrar_log", automacao: automacao.id, erro: error.message }));
    return null;
  }
  return data.id as string;
}

function extrairSlug(req: Request): string {
  const ultimo = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  if (!SLUG_REGEX.test(ultimo)) throw new HttpError(404, "webhook_nao_encontrado", "Webhook não encontrado");
  return ultimo;
}

async function processar(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return erro(405, "metodo_nao_permitido", "Use POST", { Allow: "POST" });
  }
  const admin = createAdminClient();

  // Rate limit por IP antes de qualquer consulta ao slug (dificulta varredura de slugs).
  if (!(await consumirRateLimit(admin, `wh-ip:${clientIp(req)}`, 120, 60))) {
    return erro(429, "limite_excedido", "Muitas requisições. Tente novamente em instantes.", { "Retry-After": "60" });
  }

  const slug = extrairSlug(req);

  const texto = await readBodyLimited(req, MAX_PAYLOAD_BYTES);
  let payload: unknown;
  try {
    payload = JSON.parse(texto);
  } catch {
    throw new HttpError(400, "json_invalido", "O corpo deve ser um JSON válido");
  }
  if (!isPlainObjectWithinDepth(payload)) {
    throw new HttpError(400, "payload_invalido", "O payload deve ser um objeto JSON com no máximo 10 níveis");
  }

  const { data: automacao, error: erroAutomacao } = await admin
    .from("configuracoes_automacao")
    .select(
      "id, usuario_id, modo_mensagem, mensagem_manual_template, ia_prompt_instrucao, ia_tom_voz, path_nome_lead, path_telefone_lead",
    )
    .eq("webhook_slug", slug)
    .eq("ativa", true)
    .maybeSingle<Automacao>();
  if (erroAutomacao) throw new Error(`consulta de automação: ${erroAutomacao.message}`);
  if (!automacao) throw new HttpError(404, "webhook_nao_encontrado", "Webhook não encontrado ou desativado");

  if (!(await consumirRateLimit(admin, `wh-slug:${slug}`, 30, 60))) {
    return erro(429, "limite_excedido", "Limite de envios por minuto atingido para este webhook.", { "Retry-After": "60" });
  }

  const payloadHash = await sha256Hex(`${automacao.id}:${texto}`);
  const falhar = async (status: number, codigo: string, mensagem: string, extra: Partial<DadosLog> = {}) => {
    await registrarLog(admin, automacao, { payload, payloadHash, ...extra }, "erro", mensagem);
    return erro(status, codigo, mensagem);
  };

  // Reenvio idêntico em curto intervalo (retentativas do remetente) não gera nova mensagem.
  const desde = new Date(Date.now() - JANELA_DEDUPLICACAO_MS).toISOString();
  const { data: duplicado } = await admin
    .from("logs_automacao")
    .select("id")
    .eq("automacao_id", automacao.id)
    .eq("payload_hash", payloadHash)
    .eq("status", "sucesso")
    .gte("criado_em", desde)
    .limit(1)
    .maybeSingle();
  if (duplicado) return json({ ok: true, duplicado: true });

  // Assinatura (opcional): REQUIRE_ACTIVE_SUBSCRIPTION=true bloqueia contas sem plano ativo.
  if (optionalEnv("REQUIRE_ACTIVE_SUBSCRIPTION") === "true") {
    const { data: assinatura } = await admin
      .from("assinaturas")
      .select("status_assinatura")
      .eq("usuario_id", automacao.usuario_id)
      .maybeSingle();
    if (assinatura?.status_assinatura !== "active") {
      return await falhar(402, "assinatura_inativa", "Assinatura inativa");
    }
  }

  // Dados do lead
  const nome = toScalarString(getByPath(payload, automacao.path_nome_lead));
  const telefoneBruto = getByPath(payload, automacao.path_telefone_lead);
  const telefone = normalizePhone(telefoneBruto);
  const leadNome = nome;
  if (!nome) {
    return await falhar(422, "nome_ausente", `Campo de nome "${automacao.path_nome_lead}" não encontrado no payload`);
  }
  if (!telefone.ok) {
    return await falhar(422, "telefone_invalido", `Telefone inválido em "${automacao.path_telefone_lead}": ${telefone.reason}`, { leadNome });
  }
  const leadTelefone = telefone.phone;

  // Instância WhatsApp: confirma o estado real na Evolution API antes de gerar/enviar.
  const { data: whatsapp, error: erroWhatsapp } = await admin
    .from("configuracoes_whatsapp")
    .select("id, instancia_nome, status_conexao")
    .eq("usuario_id", automacao.usuario_id)
    .maybeSingle();
  if (erroWhatsapp) throw new Error(`consulta de whatsapp: ${erroWhatsapp.message}`);
  if (!whatsapp) return await falhar(409, "whatsapp_nao_configurado", "WhatsApp não configurado", { leadNome, leadTelefone });

  try {
    const estado = await obterEstado(whatsapp.instancia_nome);
    const statusReal = estado === "open" ? "conectado" : estado === "connecting" ? "aguardando_leitura" : "desconectado";
    if (statusReal !== whatsapp.status_conexao) {
      await admin.from("configuracoes_whatsapp").update({ status_conexao: statusReal }).eq("id", whatsapp.id);
    }
    if (estado !== "open") {
      return await falhar(409, "whatsapp_desconectado", "Instância WhatsApp não conectada", { leadNome, leadTelefone });
    }
  } catch (err) {
    if (err instanceof EvolutionError && err.tipo === "nao_encontrada") {
      await admin.from("configuracoes_whatsapp").update({ status_conexao: "desconectado" }).eq("id", whatsapp.id);
      return await falhar(409, "whatsapp_desconectado", "Instância WhatsApp não encontrada na Evolution API", { leadNome, leadTelefone });
    }
    if (err instanceof EvolutionError) {
      return await falhar(502, "evolution_indisponivel", "Evolution API indisponível", { leadNome, leadTelefone });
    }
    if (err instanceof HttpError && err.codigo === "evolution_nao_configurada") {
      return await falhar(503, err.codigo, err.message, { leadNome, leadTelefone });
    }
    throw err;
  }

  // Mensagem
  let mensagem: string;
  try {
    if (automacao.modo_mensagem === "manual") {
      const template = automacao.mensagem_manual_template?.trim();
      if (!template) return await falhar(422, "template_vazio", "Template de mensagem não configurado", { leadNome, leadTelefone });
      mensagem = renderTemplate(template, { nome, telefone: leadTelefone });
    } else {
      const instrucao = automacao.ia_prompt_instrucao?.trim();
      if (!instrucao) return await falhar(422, "instrucao_ia_vazia", "Instrução da IA não configurada", { leadNome, leadTelefone });
      mensagem = await gerarMensagemIA({
        instrucao,
        tomDeVoz: automacao.ia_tom_voz,
        dadosLead: redactPayload(payload),
      });
    }
  } catch (err) {
    if (err instanceof AiError) {
      const status = err.tipo === "rate_limit" ? 429 : err.tipo === "configuracao" ? 503 : 502;
      return await falhar(status, `ia_${err.tipo}`, `Geração por IA falhou: ${err.message}`, { leadNome, leadTelefone });
    }
    if (err instanceof HttpError) return await falhar(err.status, err.codigo, err.message, { leadNome, leadTelefone });
    throw err;
  }

  // Envio
  try {
    await enviarTexto(whatsapp.instancia_nome, leadTelefone, mensagem);
  } catch (err) {
    if (err instanceof EvolutionError) {
      return await falhar(502, "envio_falhou", `Envio via Evolution API falhou: ${err.message}`, {
        leadNome,
        leadTelefone,
        mensagem,
      });
    }
    throw err;
  }

  const logId = await registrarLog(admin, automacao, { payload, payloadHash, leadNome, leadTelefone, mensagem }, "sucesso");
  return json({ ok: true, log_id: logId });
}

Deno.serve(async (req) => {
  try {
    return await processar(req);
  } catch (err) {
    return respostaDeExcecao(err, "processar-webhook-automacao");
  }
});
