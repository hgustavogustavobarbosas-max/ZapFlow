import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Automacao = Database["public"]["Tables"]["configuracoes_automacao"]["Row"];
export type AutomacaoEditavel = Database["public"]["Tables"]["configuracoes_automacao"]["Update"];

export async function buscarAutomacao(): Promise<Automacao> {
  const { data, error } = await supabase.from("configuracoes_automacao").select("*").maybeSingle();
  if (error) throw new Error("Não foi possível carregar a automação.");
  if (!data) throw new Error("Automação não encontrada para esta conta. Entre em contato com o suporte.");
  return data;
}

export async function salvarAutomacao(id: string, campos: AutomacaoEditavel): Promise<Automacao> {
  const { data, error } = await supabase
    .from("configuracoes_automacao")
    .update(campos)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error("Não foi possível salvar a configuração. Tente novamente.");
  return data;
}

export function urlDoWebhook(slug: string): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/processar-webhook-automacao/${slug}`;
}

/** Gera um novo slug; a URL antiga deixa de funcionar imediatamente. */
export async function rotacionarWebhookSlug(): Promise<string> {
  const { data, error } = await supabase.rpc("rotacionar_webhook_slug");
  if (error || !data) throw new Error("Não foi possível gerar uma nova URL. Tente novamente.");
  return data;
}
