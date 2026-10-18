// Cliente da Evolution API (v2). Toda comunicação acontece no backend.
import { requireEnv } from "./env.ts";
import { HttpError } from "./http.ts";

const TIMEOUT_MS = 15_000;

export type EstadoInstancia = "open" | "connecting" | "close";

export class EvolutionError extends Error {
  constructor(
    readonly tipo: "nao_encontrada" | "indisponivel" | "rejeitada",
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

function config() {
  const url = requireEnv(
    "EVOLUTION_API_URL",
    "evolution_nao_configurada",
    "Evolution API não configurada no servidor (EVOLUTION_API_URL / EVOLUTION_API_KEY).",
  ).replace(/\/+$/, "");
  const apiKey = requireEnv(
    "EVOLUTION_API_KEY",
    "evolution_nao_configurada",
    "Evolution API não configurada no servidor (EVOLUTION_API_URL / EVOLUTION_API_KEY).",
  );
  return { url, apiKey };
}

async function chamar(metodo: string, caminho: string, corpo?: unknown): Promise<unknown> {
  const { url, apiKey } = config();
  let resposta: Response;
  try {
    resposta = await fetch(`${url}${caminho}`, {
      method: metodo,
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new EvolutionError("indisponivel", `Evolution API inacessível: ${err instanceof Error ? err.name : "erro"}`);
  }

  const texto = await resposta.text();
  let dados: unknown = null;
  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    dados = null;
  }
  if (resposta.status === 404) throw new EvolutionError("nao_encontrada", "Instância não encontrada", 404);
  if (resposta.status >= 500) throw new EvolutionError("indisponivel", `Evolution API respondeu ${resposta.status}`, resposta.status);
  if (!resposta.ok) throw new EvolutionError("rejeitada", `Evolution API rejeitou a requisição (${resposta.status})`, resposta.status);
  return dados;
}

const nomeInstancia = (nome: string) => encodeURIComponent(nome);

function objeto(valor: unknown): Record<string, unknown> {
  return valor !== null && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
}

function extrairQr(dados: unknown): string | null {
  const raiz = objeto(dados);
  const candidato = raiz.base64 ?? objeto(raiz.qrcode).base64;
  // Só aceitamos imagens PNG em data URL; qualquer outra coisa não é renderizada pelo frontend.
  return typeof candidato === "string" && candidato.startsWith("data:image/png;base64,") ? candidato : null;
}

export async function criarInstancia(nome: string): Promise<string | null> {
  const dados = await chamar("POST", "/instance/create", {
    instanceName: nome,
    qrcode: true,
    integration: "WHATSAPP-BAILEYS",
  });
  return extrairQr(dados);
}

/** Retorna o QR Code atual (null se a Evolution ainda não o gerou). */
export async function obterQrCode(nome: string): Promise<string | null> {
  return extrairQr(await chamar("GET", `/instance/connect/${nomeInstancia(nome)}`));
}

export async function obterEstado(nome: string): Promise<EstadoInstancia> {
  const dados = await chamar("GET", `/instance/connectionState/${nomeInstancia(nome)}`);
  const estado = objeto(objeto(dados).instance).state;
  if (estado === "open" || estado === "connecting" || estado === "close") return estado;
  throw new EvolutionError("indisponivel", "Estado da instância em formato inesperado");
}

export async function desconectar(nome: string): Promise<void> {
  try {
    await chamar("DELETE", `/instance/logout/${nomeInstancia(nome)}`);
  } catch (err) {
    // Instância inexistente ou já desconectada: o resultado desejado já foi alcançado.
    if (err instanceof EvolutionError && (err.tipo === "nao_encontrada" || err.status === 400)) return;
    throw err;
  }
}

export async function enviarTexto(nome: string, numero: string, texto: string): Promise<void> {
  await chamar("POST", `/message/sendText/${nomeInstancia(nome)}`, { number: numero, text: texto });
}

export function httpErrorDeEvolution(err: EvolutionError): HttpError {
  if (err.tipo === "indisponivel") return new HttpError(502, "evolution_indisponivel", "Evolution API indisponível. Tente novamente.");
  return new HttpError(502, "evolution_rejeitou", "A Evolution API recusou a operação.");
}
