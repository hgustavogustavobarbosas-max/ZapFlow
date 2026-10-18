import { Menu } from "lucide-react";

export function DashboardTopbar({ titulo, onAbrirMenu }: { titulo: string; onAbrirMenu: () => void }) {
  return (
    <header className="flex h-16 items-center gap-3 border-b border-border/60 bg-background px-4 md:px-8">
      <button className="md:hidden" onClick={onAbrirMenu} aria-label="Abrir menu">
        <Menu className="h-5 w-5" />
      </button>
      <h1 className="text-sm font-medium text-muted-foreground">{titulo}</h1>
    </header>
  );
}
