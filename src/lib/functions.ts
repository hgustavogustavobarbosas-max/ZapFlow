import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly codigo?: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/** Chama uma Edge Function autenticada e converte falhas em ApiError com mensagem legível. */
export async function invocarFuncao<T>(nome: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(nome, { body });
  if (!error) return data as T;

  if (error instanceof FunctionsHttpError) {
    const resposta = error.context as Response;
    const corpo = (await resposta.json().catch(() => null)) as { erro?: string; codigo?: string } | null;
    throw new ApiError(corpo?.erro ?? "Não foi possível concluir a operação.", corpo?.codigo, resposta.status);
  }
  if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
    throw new ApiError("Sem conexão com o servidor. Verifique sua internet e tente novamente.");
  }
  throw new ApiError("Erro inesperado ao chamar o servidor.");
}

export function mensagemDeErro(erro: unknown, padrao = "Algo deu errado. Tente novamente."): string {
  return erro instanceof Error && erro.message ? erro.message : padrao;
}
