import { invocarFuncao } from "@/lib/functions";
import type { StatusConexao } from "@/integrations/supabase/types";

export type EstadoWhatsapp = {
  instancia: string;
  status: StatusConexao;
  qrcode?: string | null;
  aviso?: string;
};

const chamar = (acao: "status" | "conectar" | "desconectar") =>
  invocarFuncao<EstadoWhatsapp>("whatsapp-instancia", { acao });

export const consultarStatusWhatsapp = () => chamar("status");
export const gerarQrCodeWhatsapp = () => chamar("conectar");
export const desconectarWhatsapp = () => chamar("desconectar");
