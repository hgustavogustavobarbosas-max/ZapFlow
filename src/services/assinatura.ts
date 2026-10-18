import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { ApiError, invocarFuncao } from "@/lib/functions";

export type Assinatura = Database["public"]["Tables"]["assinaturas"]["Row"];

export async function buscarAssinatura(): Promise<Assinatura | null> {
  const { data, error } = await supabase.from("assinaturas").select("*").maybeSingle();
  if (error) throw new Error("Não foi possível carregar os dados de faturamento.");
  return data;
}

/** Cria o checkout no backend e devolve a URL de pagamento (somente domínios da AbacatePay). */
export async function iniciarCheckout(): Promise<string> {
  const { url } = await invocarFuncao<{ url: string }>("abacatepay-checkout");
  const destino = new URL(url);
  if (destino.protocol !== "https:" || !destino.hostname.endsWith("abacatepay.com")) {
    throw new ApiError("URL de pagamento inesperada. Tente novamente.");
  }
  return destino.toString();
}
