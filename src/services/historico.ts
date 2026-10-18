import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { EnviosPorDia } from "@/types/envios";
import { agruparPorDia, inicioDaJanela } from "@/utils/envios";

export type LogAutomacao = Database["public"]["Tables"]["logs_automacao"]["Row"];
export type OrdemHistorico = "recentes" | "antigos";
export const TAMANHO_PAGINA = 20;

export async function listarLogs(params: { pagina: number; ordem: OrdemHistorico }) {
  const de = params.pagina * TAMANHO_PAGINA;
  const { data, error, count } = await supabase
    .from("logs_automacao")
    .select("*", { count: "exact" })
    .order("criado_em", { ascending: params.ordem === "antigos" })
    .range(de, de + TAMANHO_PAGINA - 1);
  if (error) throw new Error("Não foi possível carregar o histórico.");
  return { logs: data ?? [], total: count ?? 0 };
}

/** O PostgREST limita as linhas por requisição; acima disso o gráfico é marcado como parcial. */
export const LIMITE_AMOSTRA_GRAFICO = 1000;

export async function buscarEnviosPorDia(dias: number): Promise<EnviosPorDia> {
  const { data, error } = await supabase
    .from("logs_automacao")
    .select("criado_em, status")
    .gte("criado_em", inicioDaJanela(dias).toISOString())
    .order("criado_em", { ascending: false })
    .range(0, LIMITE_AMOSTRA_GRAFICO - 1);
  if (error) throw new Error("Não foi possível carregar o gráfico de envios.");
  const logs = data ?? [];
  return { dias: agruparPorDia(logs, dias), amostraParcial: logs.length === LIMITE_AMOSTRA_GRAFICO };
}
