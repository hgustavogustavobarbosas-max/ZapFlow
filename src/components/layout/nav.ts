import { CreditCard, History, Settings2, Smartphone } from "lucide-react";

export const NAV_DASHBOARD = [
  { to: "/dashboard/conexao", label: "Conexão WhatsApp", icon: Smartphone },
  { to: "/dashboard/automacao", label: "Automação", icon: Settings2 },
  { to: "/dashboard/historico", label: "Histórico", icon: History },
  { to: "/dashboard/faturamento", label: "Faturamento", icon: CreditCard },
] as const;
