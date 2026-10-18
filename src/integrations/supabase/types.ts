// Tipos do schema `public`. Mantenha sincronizado com supabase/migrations
// (ou regenere com `supabase gen types typescript`).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type StatusConexao = "desconectado" | "aguardando_leitura" | "conectado";
export type StatusAssinatura = "inativa" | "pendente" | "active" | "inadimplente" | "cancelada";

type Tabela<Row, Insert = never, Update = never> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type AutomacaoEditavel = {
  modo_mensagem: "manual" | "ia";
  mensagem_manual_template: string | null;
  ia_prompt_instrucao: string | null;
  ia_tom_voz: string | null;
  path_nome_lead: string;
  path_telefone_lead: string;
  ativa: boolean;
};

export type Database = {
  public: {
    Tables: {
      perfis: Tabela<
        { id: string; nome: string | null; email: string | null; criado_em: string },
        never,
        { nome?: string | null }
      >;
      configuracoes_whatsapp: Tabela<{
        id: string;
        usuario_id: string;
        instancia_nome: string;
        status_conexao: StatusConexao;
        qrcode_url: string | null;
        atualizado_em: string;
      }>;
      configuracoes_automacao: Tabela<
        AutomacaoEditavel & { id: string; usuario_id: string; webhook_slug: string; criado_em: string },
        Partial<AutomacaoEditavel> & { usuario_id: string },
        Partial<AutomacaoEditavel>
      >;
      logs_automacao: Tabela<{
        id: string;
        usuario_id: string;
        automacao_id: string;
        dados_lead_recebidos: Json;
        mensagem_gerada: string | null;
        status: "sucesso" | "erro";
        erro_mensagem: string | null;
        lead_nome: string | null;
        lead_telefone: string | null;
        payload_hash: string | null;
        criado_em: string;
      }>;
      assinaturas: Tabela<{
        id: string;
        usuario_id: string;
        abacatepay_customer_id: string | null;
        abacatepay_subscription_id: string | null;
        abacatepay_checkout_id: string | null;
        status_assinatura: StatusAssinatura;
        plano: string | null;
        proxima_renovacao: string | null;
        atualizado_em: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      rotacionar_webhook_slug: { Args: Record<string, never>; Returns: string };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
