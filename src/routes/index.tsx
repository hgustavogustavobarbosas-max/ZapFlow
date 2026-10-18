import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MessageSquare, Sparkles, Webhook, BarChart3, Zap, Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";
import { PipelineVisual } from "@/components/visuals/pipeline-visual";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZapFlow — Automação de WhatsApp com IA" },
      { name: "description", content: "Receba leads via webhook e dispare mensagens de WhatsApp personalizadas com IA, em segundos." },
      { property: "og:title", content: "ZapFlow — Automação de WhatsApp com IA" },
      { property: "og:description", content: "Do webhook ao envio, de forma automática." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.15] [background-image:linear-gradient(to_right,color-mix(in_oklab,var(--color-foreground)_10%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--color-foreground)_10%,transparent)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
        />
      </div>

      {/* Nav */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="sticky top-0 z-40 border-b border-border/60 bg-background/95"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground ">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-lg font-semibold tracking-tight">ZapFlow</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost" size="sm">Entrar</Button></Link>
            <Link to="/auth">
              <Button size="sm" className="group gap-1.5 transition-transform hover:scale-[1.02] active:scale-[0.98]">
                Começar grátis
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
          </div>
        </div>
      </motion.header>

      {/* Hero */}
      <section
        className="mx-auto max-w-6xl px-6 pb-24 pt-24 text-center md:pt-32"
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary "
        >
          <Sparkles className="h-3 w-3" /> Automação de WhatsApp com IA
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-3xl text-5xl font-semibold tracking-tight md:text-7xl"
        >
          <span className="text-primary">Transforme leads em conversas</span>,
          <br className="hidden md:block" /> automaticamente.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl"
        >
          Conecte seu WhatsApp, receba leads via webhook de qualquer ferramenta e
          dispare mensagens personalizadas escritas por IA em tempo real.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 flex flex-wrap justify-center gap-3"
        >
          <Link to="/auth">
            <Button
              size="lg"
              className="group h-12 gap-2 px-8 text-base transition-transform active:scale-[0.98]"
            >
              Começar agora
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
          <a href="#features">
            <Button variant="ghost" size="lg" className="h-12 px-6 text-base">
              Ver recursos
            </Button>
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-16 max-w-5xl"
        >
          <PipelineVisual />
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <Reveal className="mx-auto mb-16 max-w-2xl text-center">
          <div className="mb-3 text-xs font-medium uppercase tracking-widest text-primary">
            Tudo o que você precisa
          </div>
          <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Simples de configurar. <span className="text-muted-foreground">Impossível de ignorar.</span>
          </h2>
        </Reveal>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: MessageSquare, title: "WhatsApp White Label", desc: "Sua instância dedicada, conecte via QR Code em segundos." },
            { icon: Webhook, title: "Webhook universal", desc: "Mapeie qualquer JSON. Funciona com Typebot, n8n, formulários e CRMs." },
            { icon: Sparkles, title: "Mensagens por IA", desc: "Defina tom e objetivo. A IA escreve a mensagem perfeita para cada lead." },
            { icon: BarChart3, title: "Histórico completo", desc: "Auditoria de cada envio com payload, mensagem gerada e status." },
            { icon: Shield, title: "Dados isolados", desc: "RLS no banco. Seus dados nunca cruzam com os de outro cliente." },
            { icon: Zap, title: "Disparo instantâneo", desc: "Cada lead recebido pelo webhook é processado e enviado automaticamente." },
          ].map(({ icon: Icon, title, desc }, i) => (
            <Reveal key={title} delay={i * 0.06}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-6 transition-all duration-500 hover:border-primary/40">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-semibold tracking-tight">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card px-8 py-16 text-center md:px-16 md:py-24">
            <h2 className="mx-auto max-w-2xl text-4xl font-semibold tracking-tight md:text-5xl">
              Pronto para <span className="text-primary">automatizar</span> seus leads?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Configure em minutos. Sem cartão de crédito.
            </p>
            <div className="mt-8">
              <Link to="/auth">
                <Button size="lg" className="h-12 gap-2 px-8 text-base transition-transform active:scale-[0.98]">
                  Criar conta grátis <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border/40 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} ZapFlow. Todos os direitos reservados.
      </footer>
    </div>
  );
}
