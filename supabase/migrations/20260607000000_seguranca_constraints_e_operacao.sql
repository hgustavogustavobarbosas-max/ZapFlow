-- Endurecimento de segurança, integridade e suporte operacional.
-- As migrations anteriores permanecem imutáveis; esta corrige o que elas deixaram aberto:
--   * usuários podiam alterar status_conexao/qrcode_url, assinaturas e logs diretamente (FOR ALL);
--   * faltavam constraints, índices de consulta e proteção contra abuso do webhook público.

-- =========================================
-- PRIVILÉGIOS (princípio do menor privilégio)
-- Escritas sensíveis passam a existir apenas via Edge Functions (service_role).
-- =========================================
REVOKE ALL ON public.perfis, public.configuracoes_whatsapp, public.configuracoes_automacao,
  public.logs_automacao, public.assinaturas FROM anon, authenticated;

-- perfis: ler e editar apenas o nome
DROP POLICY IF EXISTS "Usuarios gerenciam proprio perfil" ON public.perfis;
GRANT SELECT ON public.perfis TO authenticated;
GRANT UPDATE (nome) ON public.perfis TO authenticated;
CREATE POLICY "perfis_select_proprio" ON public.perfis
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "perfis_update_proprio" ON public.perfis
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- configuracoes_whatsapp: somente leitura (estado vem da Evolution API via Edge Function)
DROP POLICY IF EXISTS "Usuarios gerenciam propria conexao whatsapp" ON public.configuracoes_whatsapp;
GRANT SELECT ON public.configuracoes_whatsapp TO authenticated;
CREATE POLICY "whatsapp_select_proprio" ON public.configuracoes_whatsapp
  FOR SELECT TO authenticated USING (auth.uid() = usuario_id);

-- configuracoes_automacao: usuário edita apenas campos de configuração (não o slug)
DROP POLICY IF EXISTS "Usuarios gerenciam propria automacao" ON public.configuracoes_automacao;
GRANT SELECT ON public.configuracoes_automacao TO authenticated;
GRANT INSERT (usuario_id, modo_mensagem, mensagem_manual_template, ia_prompt_instrucao, ia_tom_voz,
  path_nome_lead, path_telefone_lead, ativa) ON public.configuracoes_automacao TO authenticated;
GRANT UPDATE (modo_mensagem, mensagem_manual_template, ia_prompt_instrucao, ia_tom_voz,
  path_nome_lead, path_telefone_lead, ativa) ON public.configuracoes_automacao TO authenticated;
CREATE POLICY "automacao_select_propria" ON public.configuracoes_automacao
  FOR SELECT TO authenticated USING (auth.uid() = usuario_id);
CREATE POLICY "automacao_insert_propria" ON public.configuracoes_automacao
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "automacao_update_propria" ON public.configuracoes_automacao
  FOR UPDATE TO authenticated USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);

-- logs_automacao: somente leitura (inseridos pela Edge Function)
DROP POLICY IF EXISTS "Usuarios veem proprios logs" ON public.logs_automacao;
GRANT SELECT ON public.logs_automacao TO authenticated;
CREATE POLICY "logs_select_proprios" ON public.logs_automacao
  FOR SELECT TO authenticated USING (auth.uid() = usuario_id);

-- assinaturas: somente leitura (atualizadas apenas pelo webhook validado da AbacatePay)
DROP POLICY IF EXISTS "Usuarios veem propria assinatura" ON public.assinaturas;
GRANT SELECT ON public.assinaturas TO authenticated;
CREATE POLICY "assinaturas_select_propria" ON public.assinaturas
  FOR SELECT TO authenticated USING (auth.uid() = usuario_id);

-- =========================================
-- DADOS FALSOS DO CHECKOUT SIMULADO
-- O fluxo antigo gravava assinaturas "active" sem pagamento. Neutraliza esses registros.
-- =========================================
UPDATE public.assinaturas
SET status_assinatura = 'inativa', abacatepay_customer_id = NULL,
    abacatepay_subscription_id = NULL, proxima_renovacao = NULL
WHERE abacatepay_subscription_id LIKE 'sub\_mock\_%' OR abacatepay_customer_id LIKE 'cus\_mock\_%';

-- =========================================
-- CONSTRAINTS
-- =========================================
ALTER TABLE public.configuracoes_whatsapp
  ADD CONSTRAINT configuracoes_whatsapp_usuario_unico UNIQUE (usuario_id),
  ADD CONSTRAINT configuracoes_whatsapp_status_valido
    CHECK (status_conexao IN ('desconectado', 'aguardando_leitura', 'conectado')),
  ADD CONSTRAINT configuracoes_whatsapp_instancia_formato
    CHECK (instancia_nome ~ '^[A-Za-z0-9_-]{3,64}$');

ALTER TABLE public.configuracoes_automacao
  ADD CONSTRAINT configuracoes_automacao_usuario_unico UNIQUE (usuario_id),
  ADD CONSTRAINT configuracoes_automacao_slug_formato CHECK (webhook_slug ~ '^[A-Za-z0-9_-]{16,64}$'),
  ADD CONSTRAINT configuracoes_automacao_template_tamanho
    CHECK (mensagem_manual_template IS NULL OR char_length(mensagem_manual_template) <= 1000),
  ADD CONSTRAINT configuracoes_automacao_prompt_tamanho
    CHECK (ia_prompt_instrucao IS NULL OR char_length(ia_prompt_instrucao) <= 2000),
  ADD CONSTRAINT configuracoes_automacao_tom_tamanho
    CHECK (ia_tom_voz IS NULL OR char_length(ia_tom_voz) <= 50),
  ADD CONSTRAINT configuracoes_automacao_paths_tamanho
    CHECK (char_length(path_nome_lead) BETWEEN 1 AND 200 AND char_length(path_telefone_lead) BETWEEN 1 AND 200);

ALTER TABLE public.assinaturas
  ADD COLUMN abacatepay_checkout_id TEXT,
  ADD CONSTRAINT assinaturas_status_valido
    CHECK (status_assinatura IN ('inativa', 'pendente', 'active', 'inadimplente', 'cancelada'));
CREATE UNIQUE INDEX assinaturas_subscription_id_unico
  ON public.assinaturas (abacatepay_subscription_id) WHERE abacatepay_subscription_id IS NOT NULL;
CREATE UNIQUE INDEX assinaturas_checkout_id_unico
  ON public.assinaturas (abacatepay_checkout_id) WHERE abacatepay_checkout_id IS NOT NULL;

-- =========================================
-- LOGS: colunas de consulta, limite de tamanho e índices
-- lead_nome/lead_telefone são gravados no momento do processamento, de modo que o histórico
-- continua correto mesmo que o mapeamento de campos mude depois.
-- =========================================
ALTER TABLE public.logs_automacao
  ADD COLUMN lead_nome TEXT,
  ADD COLUMN lead_telefone TEXT,
  ADD COLUMN payload_hash TEXT,
  ADD CONSTRAINT logs_automacao_payload_tamanho CHECK (pg_column_size(dados_lead_recebidos) <= 65536);

CREATE INDEX idx_logs_automacao_usuario_status_data
  ON public.logs_automacao (usuario_id, status, criado_em DESC);
CREATE INDEX idx_logs_automacao_automacao_hash
  ON public.logs_automacao (automacao_id, payload_hash, criado_em DESC) WHERE payload_hash IS NOT NULL;

-- Retenção: remove logs antigos. Agende com pg_cron (veja README), por exemplo diariamente.
CREATE OR REPLACE FUNCTION public.purgar_logs_antigos(p_dias INTEGER DEFAULT 90)
RETURNS BIGINT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  removidos BIGINT;
BEGIN
  DELETE FROM public.logs_automacao WHERE criado_em < now() - make_interval(days => p_dias);
  GET DIAGNOSTICS removidos = ROW_COUNT;
  RETURN removidos;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.purgar_logs_antigos(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purgar_logs_antigos(INTEGER) TO service_role;

-- =========================================
-- RATE LIMIT E IDEMPOTÊNCIA (acessadas apenas por Edge Functions)
-- =========================================
CREATE TABLE public.rate_limits (
  chave TEXT NOT NULL,
  janela_inicio TIMESTAMPTZ NOT NULL,
  contagem INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (chave, janela_inicio)
);
CREATE INDEX idx_rate_limits_janela ON public.rate_limits (janela_inicio);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM anon, authenticated;
GRANT ALL ON public.rate_limits TO service_role;

CREATE TABLE public.eventos_pagamento (
  id TEXT PRIMARY KEY,
  evento TEXT NOT NULL,
  recebido_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.eventos_pagamento ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eventos_pagamento FROM anon, authenticated;
GRANT ALL ON public.eventos_pagamento TO service_role;

-- Contador atômico por janela fixa. Retorna TRUE enquanto estiver dentro do limite.
CREATE OR REPLACE FUNCTION public.consumir_rate_limit(
  p_chave TEXT, p_limite INTEGER, p_janela_segundos INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_janela TIMESTAMPTZ;
  v_contagem INTEGER;
BEGIN
  v_janela := to_timestamp(floor(extract(epoch FROM now()) / p_janela_segundos) * p_janela_segundos);
  INSERT INTO public.rate_limits AS r (chave, janela_inicio, contagem)
  VALUES (p_chave, v_janela, 1)
  ON CONFLICT (chave, janela_inicio) DO UPDATE SET contagem = r.contagem + 1
  RETURNING r.contagem INTO v_contagem;

  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits WHERE janela_inicio < now() - interval '1 hour';
  END IF;
  RETURN v_contagem <= p_limite;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.consumir_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

-- =========================================
-- atualizado_em automático
-- =========================================
CREATE OR REPLACE FUNCTION public.set_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER configuracoes_whatsapp_atualizado_em BEFORE UPDATE ON public.configuracoes_whatsapp
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();
CREATE TRIGGER assinaturas_atualizado_em BEFORE UPDATE ON public.assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

-- =========================================
-- Automação padrão criada junto com o perfil (evita escrita ao abrir a tela)
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
  INSERT INTO public.configuracoes_automacao (usuario_id, mensagem_manual_template)
  VALUES (NEW.id, 'Olá {nome}, tudo bem? 👋');
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

INSERT INTO public.configuracoes_automacao (usuario_id, mensagem_manual_template)
SELECT p.id, 'Olá {nome}, tudo bem? 👋'
FROM public.perfis p
WHERE NOT EXISTS (SELECT 1 FROM public.configuracoes_automacao a WHERE a.usuario_id = p.id);
