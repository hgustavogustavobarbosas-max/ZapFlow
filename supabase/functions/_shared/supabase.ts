// Clientes Supabase e autenticação do usuário nas Edge Functions.
import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";
import { HttpError } from "./http.ts";
import { requireEnv } from "./env.ts";

export type Admin = SupabaseClient;

/** Cliente com service role: ignora RLS. Use somente em código de backend confiável. */
export function createAdminClient(): Admin {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Valida o JWT do usuário e devolve o usuário autenticado. */
export async function requireUser(req: Request): Promise<User> {
  const cabecalho = req.headers.get("authorization") ?? "";
  if (!cabecalho.startsWith("Bearer ")) {
    throw new HttpError(401, "nao_autenticado", "Sessão ausente. Faça login novamente.");
  }
  const cliente = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: cabecalho } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await cliente.auth.getUser(cabecalho.slice("Bearer ".length));
  if (error || !data.user) throw new HttpError(401, "nao_autenticado", "Sessão inválida ou expirada.");
  return data.user;
}

/** Retorna false quando o limite foi excedido. */
export async function consumirRateLimit(
  admin: Admin,
  chave: string,
  limite: number,
  janelaSegundos: number,
): Promise<boolean> {
  const { data, error } = await admin.rpc("consumir_rate_limit", {
    p_chave: chave,
    p_limite: limite,
    p_janela_segundos: janelaSegundos,
  });
  if (error) {
    // Falha fechada: sem contador confiável, é mais seguro recusar do que aceitar sem limite.
    console.error(JSON.stringify({ contexto: "rate_limit", erro: error.message }));
    throw new HttpError(503, "rate_limit_indisponivel", "Serviço temporariamente indisponível");
  }
  return data === true;
}
