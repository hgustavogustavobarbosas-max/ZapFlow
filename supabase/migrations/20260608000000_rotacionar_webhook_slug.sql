-- Permite ao usuário gerar um novo webhook_slug (por exemplo, se a URL vazou).
-- O slug não é editável diretamente (sem UPDATE de coluna); a troca passa por esta função,
-- que só atua na automação do próprio usuário autenticado.
CREATE OR REPLACE FUNCTION public.rotacionar_webhook_slug()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug TEXT := replace(gen_random_uuid()::text, '-', '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;

  UPDATE public.configuracoes_automacao SET webhook_slug = v_slug WHERE usuario_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Automação não encontrada' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_slug;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rotacionar_webhook_slug() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotacionar_webhook_slug() TO authenticated;
