import { motion } from "framer-motion";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";

import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — ZapFlow" }] }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  senha: z.string().min(6, "Mínimo 6 caracteres").max(72),
  nome: z.string().trim().min(2, "Informe seu nome").max(100).optional(),
});

function mensagemDeAuth(mensagem: string): string {
  if (/invalid login credentials/i.test(mensagem)) return "E-mail ou senha incorretos.";
  if (/already registered/i.test(mensagem)) return "Este e-mail já está cadastrado.";
  if (/email not confirmed/i.test(mensagem)) return "Confirme seu e-mail antes de entrar.";
  if (/rate limit|too many/i.test(mensagem)) return "Muitas tentativas. Aguarde alguns instantes.";
  return "Não foi possível concluir. Tente novamente.";
}

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [modo, setModo] = useState<"entrar" | "recuperar" | "redefinir">("entrar");

  useEffect(() => {
    // O link de recuperação chega com type=recovery no hash e cria uma sessão temporária;
    // nesse caso o usuário define a nova senha em vez de ser enviado ao dashboard.
    const emRecuperacao = window.location.hash.includes("type=recovery");
    if (emRecuperacao) setModo("redefinir");
    const { data: assinatura } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "PASSWORD_RECOVERY") setModo("redefinir");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !emRecuperacao) navigate({ to: "/dashboard", replace: true });
    });
    return () => assinatura.subscription.unsubscribe();
  }, [navigate]);

  async function handleRecuperar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = z.string().trim().email("E-mail inválido").max(255).safeParse(new FormData(e.currentTarget).get("email"));
    if (!email.success) { toast.error(email.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setLoading(false);
    if (error) { toast.error(mensagemDeAuth(error.message)); return; }
    // Mensagem neutra: não revela se o e-mail está cadastrado.
    toast.success("Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.");
    setModo("entrar");
  }

  async function handleRedefinir(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const senha = schema.shape.senha.safeParse(fd.get("senha"));
    if (!senha.success) { toast.error(senha.error.issues[0].message); return; }
    if (fd.get("confirmar") !== senha.data) { toast.error("As senhas não conferem."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: senha.data });
    setLoading(false);
    if (error) { toast.error("Não foi possível redefinir a senha. Solicite um novo link."); return; }
    toast.success("Senha redefinida!");
    window.history.replaceState(null, "", window.location.pathname);
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({ email: fd.get("email"), senha: fd.get("senha") });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email, password: parsed.data.senha,
    });
    setLoading(false);
    if (error) { toast.error(mensagemDeAuth(error.message)); return; }
    toast.success("Bem-vindo!");
    navigate({ to: "/dashboard" });
  }

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      email: fd.get("email"), senha: fd.get("senha"), nome: fd.get("nome"),
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.senha,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { nome: parsed.data.nome },
      },
    });
    setLoading(false);
    if (error) { toast.error(mensagemDeAuth(error.message)); return; }
    if (data.session) {
      toast.success("Conta criada!");
      navigate({ to: "/dashboard" });
    } else {
      toast.success("Conta criada! Confirme seu e-mail para entrar.");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/4 h-[50vh] w-[70vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-primary)_28%,transparent),transparent_70%)] blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 transition-opacity hover:opacity-80">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Zap className="h-4 w-4" />
          </div>
          <span className="text-xl font-semibold tracking-tight">ZapFlow</span>
        </Link>

        <div className="glass rounded-2xl p-6 shadow-2xl shadow-primary/10 md:p-8">
          {modo === "recuperar" && (
            <form onSubmit={handleRecuperar} className="space-y-4">
              <h2 className="text-lg font-semibold">Recuperar senha</h2>
              <p className="text-sm text-muted-foreground">Informe seu e-mail para receber o link de redefinição.</p>
              <div className="space-y-2">
                <Label htmlFor="email-r">E-mail</Label>
                <Input id="email-r" name="email" type="email" autoComplete="email" required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setModo("entrar")}>
                Voltar
              </Button>
            </form>
          )}

          {modo === "redefinir" && (
            <form onSubmit={handleRedefinir} className="space-y-4">
              <h2 className="text-lg font-semibold">Definir nova senha</h2>
              <div className="space-y-2">
                <Label htmlFor="senha-n">Nova senha</Label>
                <Input id="senha-n" name="senha" type="password" autoComplete="new-password" required minLength={6} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senha-c">Confirmar nova senha</Label>
                <Input id="senha-c" name="confirmar" type="password" autoComplete="new-password" required minLength={6} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Salvando..." : "Redefinir senha"}
              </Button>
            </form>
          )}

          {modo === "entrar" && (
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-l">E-mail</Label>
                  <Input id="email-l" name="email" type="email" autoComplete="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senha-l">Senha</Label>
                  <Input id="senha-l" name="senha" type="password" autoComplete="current-password" required />
                </div>
                <Button type="submit" className="w-full transition-transform hover:scale-[1.01] active:scale-[0.99]" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
                <button
                  type="button"
                  onClick={() => setModo("recuperar")}
                  className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Esqueci minha senha
                </button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome-s">Nome</Label>
                  <Input id="nome-s" name="nome" type="text" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-s">E-mail</Label>
                  <Input id="email-s" name="email" type="email" autoComplete="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senha-s">Senha</Label>
                  <Input id="senha-s" name="senha" type="password" autoComplete="new-password" required minLength={6} />
                </div>
                <Button type="submit" className="w-full transition-transform hover:scale-[1.01] active:scale-[0.99]" disabled={loading}>
                  {loading ? "Criando..." : "Criar conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          )}
        </div>
      </motion.div>
    </div>
  );
}

