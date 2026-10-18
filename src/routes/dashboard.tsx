import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { NAV_DASHBOARD } from "@/components/layout/nav";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [menuAberto, setMenuAberto] = useState(false);
  const { carregando, session } = useSession();

  useEffect(() => {
    if (carregando) return;
    if (!session) {
      navigate({ to: "/auth", replace: true });
    } else if (path === "/dashboard" || path === "/dashboard/") {
      navigate({ to: "/dashboard/conexao", replace: true });
    }
  }, [carregando, session, path, navigate]);

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (carregando || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" role="status">
        <div className="h-8 w-8 animate-pulse rounded-full bg-primary/40" />
        <span className="sr-only">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar
        caminhoAtual={path}
        aberto={menuAberto}
        email={session.user.email ?? null}
        onFechar={() => setMenuAberto(false)}
        onSair={sair}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar
          titulo={NAV_DASHBOARD.find((n) => n.to === path)?.label ?? "Dashboard"}
          onAbrirMenu={() => setMenuAberto(true)}
        />
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
