// CORS para funções chamadas pelo navegador. A origem permitida vem de APP_URL (nunca "*").
import { optionalEnv } from "./env.ts";

export function corsHeaders(req: Request): Record<string, string> {
  const permitida = optionalEnv("APP_URL")?.replace(/\/+$/, "");
  const origem = req.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
  if (permitida && origem === permitida) headers["Access-Control-Allow-Origin"] = origem;
  return headers;
}

export function preflight(req: Request): Response | null {
  return req.method === "OPTIONS" ? new Response(null, { status: 204, headers: corsHeaders(req) }) : null;
}
