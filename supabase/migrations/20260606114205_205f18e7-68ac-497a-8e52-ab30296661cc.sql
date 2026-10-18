
-- =========================================
-- TABELA: perfis
-- =========================================
CREATE TABLE public.perfis (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  email TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfis TO authenticated;
GRANT ALL ON public.perfis TO service_role;
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios gerenciam proprio perfil" ON public.perfis
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- =========================================
-- TABELA: configuracoes_whatsapp
-- =========================================
CREATE TABLE public.configuracoes_whatsapp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  instancia_nome TEXT NOT NULL UNIQUE,
  status_conexao TEXT NOT NULL DEFAULT 'desconectado',
  qrcode_url TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes_whatsapp TO authenticated;
GRANT ALL ON public.configuracoes_whatsapp TO service_role;
ALTER TABLE public.configuracoes_whatsapp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios gerenciam propria conexao whatsapp" ON public.configuracoes_whatsapp
  FOR ALL USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);

-- =========================================
-- TABELA: configuracoes_automacao
-- =========================================
CREATE TABLE public.configuracoes_automacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  webhook_slug TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  modo_mensagem TEXT NOT NULL DEFAULT 'manual' CHECK (modo_mensagem IN ('manual','ia')),
  mensagem_manual_template TEXT,
  ia_prompt_instrucao TEXT,
  ia_tom_voz TEXT,
  path_nome_lead TEXT NOT NULL DEFAULT 'nome',
  path_telefone_lead TEXT NOT NULL DEFAULT 'telefone',
  ativa BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes_automacao TO authenticated;
GRANT ALL ON public.configuracoes_automacao TO service_role;
ALTER TABLE public.configuracoes_automacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios gerenciam propria automacao" ON public.configuracoes_automacao
  FOR ALL USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);

-- =========================================
-- TABELA: logs_automacao
-- =========================================
CREATE TABLE public.logs_automacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  automacao_id UUID NOT NULL REFERENCES public.configuracoes_automacao(id) ON DELETE CASCADE,
  dados_lead_recebidos JSONB NOT NULL,
  mensagem_gerada TEXT,
  status TEXT NOT NULL CHECK (status IN ('sucesso','erro')),
  erro_mensagem TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.logs_automacao TO authenticated;
GRANT ALL ON public.logs_automacao TO service_role;
ALTER TABLE public.logs_automacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios veem proprios logs" ON public.logs_automacao
  FOR ALL USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);

CREATE INDEX idx_logs_automacao_usuario_data ON public.logs_automacao(usuario_id, criado_em DESC);

-- =========================================
-- TABELA: assinaturas
-- =========================================
CREATE TABLE public.assinaturas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE UNIQUE,
  abacatepay_customer_id TEXT,
  abacatepay_subscription_id TEXT,
  status_assinatura TEXT NOT NULL DEFAULT 'inativa',
  plano TEXT,
  proxima_renovacao TIMESTAMPTZ,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assinaturas TO authenticated;
GRANT ALL ON public.assinaturas TO service_role;
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios veem propria assinatura" ON public.assinaturas
  FOR ALL USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);

-- =========================================
-- TRIGGER: criar perfil automaticamente
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfis (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
