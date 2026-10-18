import { Link } from "@tanstack/react-router";
import { LogOut, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NAV_DASHBOARD } from "./nav";

type Props = {
  caminhoAtual: string;
  aberto: boolean;
  email: string | null;
  onFechar: () => void;
  onSair: () => void;
};

export function DashboardSidebar({ caminhoAtual, aberto, email, onFechar, onSair }: Props) {
  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform md:relative md:translate-x-0",
          aberto ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
          <Link to="/dashboard/conexao" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Zap className="h-4 w-4" />
            </div>
            <span className="font-semibold tracking-tight">ZapFlow</span>
          </Link>
          <button className="md:hidden" onClick={onFechar} aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="Principal" className="space-y-1 p-3">
          {NAV_DASHBOARD.map(({ to, label, icon: Icon }) => {
            const ativo = caminhoAtual === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={onFechar}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  ativo ? "bg-primary/15 text-primary" : "text-sidebar-foreground/70 hover:bg-accent hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute inset-x-0 bottom-0 border-t border-sidebar-border p-3">
          <div className="mb-2 truncate px-3 text-xs text-muted-foreground">{email}</div>
          <Button onClick={onSair} variant="ghost" size="sm" className="w-full justify-start">
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>

      {aberto && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={onFechar} aria-hidden />}
    </>
  );
}
