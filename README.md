# ZapFlow

Micro-SaaS multi-tenant de automação de mensagens no WhatsApp. O usuário conecta seu número via
[Evolution API](https://doc.evolution-api.com), configura uma automação e recebe leads por webhook;
para cada lead o sistema monta a mensagem (template manual ou IA), envia pelo WhatsApp e registra o
resultado em um histórico auditável. A assinatura é cobrada pela [AbacatePay](https://docs.abacatepay.com).

```
Cadastro/Login → Dashboard → Conectar WhatsApp (QR Code) → Configurar automação
   → Webhook recebe lead → Extrai nome/telefone → Mensagem (manual | IA)
   → Envio via Evolution API → Log → Histórico
```

## Arquitetura

| Camada | Tecnologia | Responsabilidade |
| --- | --- | --- |
| Frontend | React 19, TypeScript, Tailwind 4, TanStack Start/Router/Query, shadcn/ui | Interface. Só conhece a chave pública do Supabase. |
| Auth | Supabase Auth | Cadastro, login, sessão persistente. |
| Banco | PostgreSQL + RLS | Dados por tenant; escrita sensível restrita ao backend. |
| Backend | Supabase Edge Functions (Deno) | Webhook, WhatsApp, IA, checkout, webhook de pagamento. |
| Integrações | Evolution API, OpenAI ou Gemini, AbacatePay | Sempre chamadas pelo backend; secrets nunca chegam ao navegador. |

### Modelo de segurança

* **RLS em todas as tabelas.** Cada usuário só lê/escreve linhas com `usuario_id = auth.uid()`.
* **Privilégios mínimos.** O usuário autenticado só consegue editar a própria configuração de automação
  (colunas específicas, sem o `webhook_slug`) e o próprio nome. `configuracoes_whatsapp`, `logs_automacao`
  e `assinaturas` são **somente leitura** para o usuário: são escritas apenas pelas Edge Functions
  (service role). Assim ninguém consegue marcar a própria assinatura como ativa ou forjar o status do WhatsApp.
* **Webhook de leads público**, protegido por: slug secreto de 128 bits, rate limit por IP e por slug
  (tabela `rate_limits`), limite de 64 KB e 10 níveis de profundidade, deduplicação de reenvio idêntico em 60 s
  e redação de chaves sensíveis antes de gravar o payload no log.
* **Webhook de pagamento** exige secret na URL **e** assinatura HMAC-SHA256 (`X-Webhook-Signature`),
  com comparação em tempo constante e idempotência por id de evento (`eventos_pagamento`).
* **Rotação do webhook:** em Automação, "Gerar nova URL" troca o slug (função SQL `rotacionar_webhook_slug`, restrita ao dono); a URL antiga deixa de funcionar na hora.
* **Recuperação de senha** pelo Supabase Auth (tela de login → "Esqueci minha senha"), com mensagem neutra que não revela se o e-mail existe.
* CORS restrito a `APP_URL`. Erros nunca devolvem stack trace.

### Interface 3D

O 3D (React Three Fiber + Three.js, sem outras bibliotecas) é complementar: toda informação e todo controle existem
também em HTML convencional. Ele aparece onde representa dados ou estados reais:

| Tela | Cena | Dado de origem |
| --- | --- | --- |
| Landing | Fluxo webhook → histórico (`PipelineScene`) | Etapas reais do produto; hover/foco na lista destaca o nó |
| Conexão | Aparelho com anel de estado (`InstanceStatusScene`) | `status` retornado pela Evolution API via Edge Function |
| Histórico | Barras de envios dos últimos 14 dias (`SendsBars`) | `logs_automacao` do usuário (RLS), agregados no cliente |

Desempenho e acessibilidade: cenas carregadas sob demanda (`React.lazy`), fora do bundle inicial e do SSR; geometrias e
materiais compartilhados; gráfico em `frameloop="demand"`; resolução limitada (`dpr` ≤ 1.75); loop pausado fora da tela;
sem HDRI, fontes ou modelos externos. Em tela estreita, toque, `prefers-reduced-motion` ou sem WebGL, o app usa versões
2D equivalentes (a cena de status vira um indicador estático; o gráfico, barras HTML navegáveis por teclado). Se o
contexto WebGL falhar, a interface troca para a versão 2D sem quebrar a página.

O gráfico lê até 1000 logs recentes (limite do PostgREST) e avisa quando o período pode estar incompleto. Para totais
exatos em contas de alto volume, a evolução natural é uma função SQL de agregação por dia.

### Estrutura

```
src/
  routes/                  Páginas (TanStack Router, file-based)
  services/                Acesso a dados e Edge Functions (sem lógica na UI)
  hooks/use-session.ts     Sessão do Supabase Auth
  components/
    layout/                Sidebar e topbar do dashboard
    three/                 Cenas R3F isoladas da lógica de negócio (recebem dados por props)
    visuals/               Wrappers: escolhem 3D ou versão 2D e ligam os dados
    feedback.tsx, ui/      Loading/erro e shadcn/ui usados
  types/, utils/           Tipos de domínio e funções puras testadas
  integrations/supabase/   Cliente e tipos do banco
supabase/
  migrations/              Schema versionado (rode em ordem)
  functions/
    _shared/               Lógica reutilizável e testada (json-path, template, phone, ai, evolution...)
    processar-webhook-automacao/   Webhook público de leads
    whatsapp-instancia/            status | conectar (QR Code) | desconectar
    abacatepay-checkout/           Cria o checkout de assinatura
    abacatepay-webhook/            Atualiza a assinatura a partir de eventos pagos
```

## Configuração local

Pré-requisitos: Node 22+, [Supabase CLI](https://supabase.com/docs/guides/cli), uma Evolution API v2 acessível.

```bash
npm install
cp .env.example .env                                   # preencha VITE_SUPABASE_URL e a chave publishable
cp supabase/functions/.env.example supabase/functions/.env   # secrets do backend
```

### 1. Banco (migrations)

```bash
supabase link --project-ref <seu-project-ref>
supabase db push
```

As migrations são aplicadas em ordem. A `20260607...` endurece privilégios/RLS, adiciona constraints,
índices, rate limit e neutraliza assinaturas falsas criadas pelo antigo checkout simulado.

**Retenção de logs.** A tabela `logs_automacao` cresce com o uso. Agende a limpeza (pg_cron):

```sql
select cron.schedule('purgar-logs', '0 3 * * *', $$select public.purgar_logs_antigos(90)$$);
```

### 2. Edge Functions

```bash
supabase secrets set --env-file supabase/functions/.env
supabase functions deploy processar-webhook-automacao
supabase functions deploy whatsapp-instancia
supabase functions deploy abacatepay-checkout
supabase functions deploy abacatepay-webhook
```

`verify_jwt` já está configurado em `supabase/config.toml`: desligado nos dois webhooks públicos (que se autenticam
internamente) e ligado nas funções chamadas pelo dashboard.

Para desenvolver localmente: `supabase functions serve --env-file supabase/functions/.env`.

### 3. Supabase Auth

Em **Authentication → URL Configuration**, defina o *Site URL* como a URL do frontend e inclua `<APP_URL>/auth`
em *Redirect URLs*: é para onde o link de recuperação de senha leva. Configure o SMTP do projeto para e-mails em produção.

### 4. Frontend

```bash
npm run dev
```

## Variáveis de ambiente

**Frontend** (`.env`, públicas): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_PLANO_PRECO` (apenas exibição).

**Backend** (`supabase/functions/.env`, secrets):

| Variável | Uso |
| --- | --- |
| `APP_URL` | Origem permitida no CORS e base das URLs de retorno do checkout |
| `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` | Evolution API (chave global) |
| `AI_PROVIDER` | `openai` (padrão) ou `gemini` |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | Provedor OpenAI (modelo padrão `gpt-4o-mini`) |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Provedor Gemini (modelo padrão `gemini-2.5-flash`) |
| `ABACATEPAY_API_KEY` | Chave da API v2 |
| `ABACATEPAY_PRODUCT_ID` | Produto de assinatura (ciclo mensal) criado no dashboard da AbacatePay |
| `ABACATEPAY_WEBHOOK_SECRET` | Secret do webhook (query `webhookSecret`) |
| `ABACATEPAY_PUBLIC_KEY` | Chave pública HMAC da AbacatePay para validar `X-Webhook-Signature` |
| `REQUIRE_ACTIVE_SUBSCRIPTION` | `true` bloqueia envios (resposta `402`, registrada no histórico) de contas sem assinatura ativa; use `false` em desenvolvimento |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas automaticamente nas Edge Functions.
Se alguma credencial estiver ausente, a função responde `503` com um código explícito
(`evolution_nao_configurada`, `ia_nao_configurada`, `abacatepay_nao_configurada`) e a interface mostra a mensagem;
nada é simulado.

## Integrações

### Evolution API
Usa a v2 com a chave global: `POST /instance/create`, `GET /instance/connect/{instancia}` (QR Code),
`GET /instance/connectionState/{instancia}`, `DELETE /instance/logout/{instancia}` e
`POST /message/sendText/{instancia}`. A instância de cada usuário é `zap_<id>` e criada sob demanda.
O status exibido é sempre o retornado pela API; antes de cada envio o webhook reconfirma que a instância está `open`.

### IA
Provedor escolhido por `AI_PROVIDER`, atrás da interface `ProvedorIA` (`_shared/ai.ts`); para adicionar outro
basta implementar `gerar()`. Timeout de 20 s; trata rate limit, indisponibilidade, resposta inválida e vazia.
Resposta vazia, longa demais ou com preâmbulo ("Aqui está...") é rejeitada e **nenhuma mensagem é enviada**.
Os dados do lead vão em bloco delimitado e o prompt instrui a IA a ignorar instruções contidas neles.

### AbacatePay
1. No dashboard, crie um **produto com ciclo de assinatura mensal** e copie o ID para `ABACATEPAY_PRODUCT_ID`.
2. Cadastre o webhook apontando para
   `https://<projeto>.supabase.co/functions/v1/abacatepay-webhook?webhookSecret=<ABACATEPAY_WEBHOOK_SECRET>`
   com os eventos `subscription.completed`, `subscription.renewed`, `subscription.payment_failed` e `subscription.cancelled`.
3. O frontend só chama `abacatepay-checkout`, que devolve a URL de pagamento. O status da assinatura muda
   exclusivamente pelo webhook validado. A data de renovação é estimada pela frequência do plano
   (a API não a envia no evento).

## Fluxo do webhook de leads

`POST https://<projeto>.supabase.co/functions/v1/processar-webhook-automacao/<webhook_slug>`

1. Aceita só `POST`; valida o slug, aplica rate limit, lê o corpo com limite de 64 KB e valida o JSON.
2. Localiza a automação **ativa** pelo slug e a instância WhatsApp do mesmo usuário.
3. Extrai nome e telefone pelos caminhos configurados (`path_nome_lead`, `path_telefone_lead`), sem `eval`.
4. Normaliza o telefone (números sem DDI são tratados como brasileiros) e rejeita números inválidos.
5. Confirma na Evolution API que a instância está conectada.
6. Gera a mensagem: template (`{nome}`, `{telefone}`) ou IA.
7. Envia via Evolution API e registra o log (`sucesso` ou `erro`) com o payload já sem chaves sensíveis.

Exemplo — configuração `path_nome_lead = cliente.nome`, `path_telefone_lead = contato.telefone`:

```bash
curl -X POST "https://<projeto>.supabase.co/functions/v1/processar-webhook-automacao/<webhook_slug>" \
  -H "Content-Type: application/json" \
  -d '{"cliente":{"nome":"João"},"contato":{"telefone":"(11) 99999-9999"}}'
```

Respostas: `200` enviado (ou reenvio idêntico ignorado), `400` payload inválido, `402` assinatura inativa,
`404` webhook inexistente/desativado, `409` WhatsApp desconectado, `413` payload grande, `422` nome/telefone
inválidos, `429` limite excedido, `502` falha na IA/Evolution, `503` integração não configurada.

## Testes

```bash
npm test          # regras de maior risco: caminho JSON, template, telefone, redação, validação da IA, HMAC, renovação
npm run typecheck
```

## Build e deploy do frontend

`npm run build` gera o servidor SSR via Nitro (preset Node por padrão). Ajuste o preset em `vite.config.ts`
conforme a hospedagem (por exemplo `nitro({ preset: "cloudflare-module" })`). Configure `VITE_SUPABASE_URL` e
`VITE_SUPABASE_PUBLISHABLE_KEY` no ambiente de build e defina `APP_URL` nas Edge Functions com a URL final do site.
