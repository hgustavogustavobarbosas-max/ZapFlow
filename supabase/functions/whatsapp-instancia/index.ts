// Gerenciamento da instância WhatsApp do usuário autenticado.
// POST { acao: "status" | "conectar" | "desconectar" }
import { corsHeaders, preflight } from "../_shared/cors.ts";
import {
  criarInstancia,
  desconectar,
  EvolutionError,
  type EstadoInstancia,
  httpErrorDeEvolution,
  obterEstado,
  obterQrCode,
} from "../_shared/evolution.ts";
import { erro, HttpError, json, readBodyLimited, respostaDeExcecao } from "../_shared/http.ts";
import { type Admin, consumirRateLimit, createAdminClient, requireUser } from "../_shared/supabase.ts";

type StatusConexao = "desconectado" | "aguardando_leitura" | "conectado";
type Registro = { id: string; instancia_nome: string; status_conexao: StatusConexao };

const statusDe = (estado: EstadoInstancia): StatusConexao =>
  estado === "open" ? "conectado" : estado === "connecting" ? "aguardando_leitura" : "desconectado";

async function obterOuCriarRegistro(admin: Admin, usuarioId: string): Promise<Registro> {
  const colunas = "id, instancia_nome, status_conexao";
  const existente = await admin.from("configuracoes_whatsapp").select(colunas).eq("usuario_id", usuarioId).maybeSingle<Registro>();
  if (existente.error) throw new Error(`consulta de instância: ${existente.error.message}`);
  if (existente.data) return existente.data;

  const instancia = `zap_${usuarioId.replaceAll("-", "").slice(0, 16)}`;
  const criado = await admin
    .from("configuracoes_whatsapp")
    .upsert({ usuario_id: usuarioId, instancia_nome: instancia }, { onConflict: "usuario_id" })
    .select(colunas)
    .single<Registro>();
  if (criado.error) throw new Error(`criação de registro da instância: ${criado.error.message}`);
  return criado.data;
}

async function salvar(admin: Admin, id: string, status: StatusConexao, qrcode: string | null) {
  const { error } = await admin.from("configuracoes_whatsapp").update({ status_conexao: status, qrcode_url: qrcode }).eq("id", id);
  if (error) throw new Error(`atualização da instância: ${error.message}`);
}

async function consultarEstado(nome: string): Promise<EstadoInstancia> {
  try {
    return await obterEstado(nome);
  } catch (err) {
    if (err instanceof EvolutionError && err.tipo === "nao_encontrada") return "close";
    throw err;
  }
}

async function tratar(req: Request): Promise<Response> {
  if (req.method !== "POST") return erro(405, "metodo_nao_permitido", "Use POST", { Allow: "POST" });

  const user = await requireUser(req);
  const admin = createAdminClient();
  if (!(await consumirRateLimit(admin, `wpp-user:${user.id}`, 40, 60))) {
    return erro(429, "limite_excedido", "Muitas requisições. Aguarde um instante.");
  }

  let acao: unknown;
  try {
    acao = (JSON.parse(await readBodyLimited(req, 1024)) as { acao?: unknown }).acao;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, "json_invalido", "Corpo inválido");
  }

  const registro = await obterOuCriarRegistro(admin, user.id);

  try {
    if (acao === "status") {
      const status = statusDe(await consultarEstado(registro.instancia_nome));
      // Um QR Code só é válido enquanto aguardamos a leitura; fora disso é descartado.
      if (status !== "aguardando_leitura") await salvar(admin, registro.id, status, null);
      else await admin.from("configuracoes_whatsapp").update({ status_conexao: status }).eq("id", registro.id);
      return json({ instancia: registro.instancia_nome, status });
    }

    if (acao === "conectar") {
      const estado = await consultarEstado(registro.instancia_nome);
      if (estado === "open") {
        await salvar(admin, registro.id, "conectado", null);
        return json({ instancia: registro.instancia_nome, status: "conectado" });
      }
      let qrcode: string | null;
      try {
        qrcode = await obterQrCode(registro.instancia_nome);
      } catch (err) {
        if (!(err instanceof EvolutionError && err.tipo === "nao_encontrada")) throw err;
        qrcode = await criarInstancia(registro.instancia_nome);
        // A criação pode não devolver o QR imediatamente; tenta obtê-lo na sequência.
        qrcode ??= await obterQrCode(registro.instancia_nome).catch(() => null);
      }
      await salvar(admin, registro.id, qrcode ? "aguardando_leitura" : "desconectado", qrcode);
      return json({
        instancia: registro.instancia_nome,
        status: qrcode ? "aguardando_leitura" : "desconectado",
        qrcode,
        aviso: qrcode ? undefined : "O QR Code ainda está sendo gerado. Tente novamente em alguns segundos.",
      });
    }

    if (acao === "desconectar") {
      await desconectar(registro.instancia_nome);
      await salvar(admin, registro.id, "desconectado", null);
      return json({ instancia: registro.instancia_nome, status: "desconectado" });
    }
  } catch (err) {
    if (err instanceof EvolutionError) {
      console.error(JSON.stringify({ contexto: "whatsapp-instancia", acao, tipo: err.tipo, status: err.status }));
      throw httpErrorDeEvolution(err);
    }
    throw err;
  }

  throw new HttpError(400, "acao_invalida", "Ação inválida");
}

Deno.serve(async (req) => {
  const resposta = preflight(req);
  if (resposta) return resposta;
  try {
    const resultado = await tratar(req);
    for (const [k, v] of Object.entries(corsHeaders(req))) resultado.headers.set(k, v);
    return resultado;
  } catch (err) {
    const resultado = respostaDeExcecao(err, "whatsapp-instancia");
    for (const [k, v] of Object.entries(corsHeaders(req))) resultado.headers.set(k, v);
    return resultado;
  }
});
