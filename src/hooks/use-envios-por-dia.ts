import { useQuery } from "@tanstack/react-query";
import { buscarEnviosPorDia } from "@/services/historico";

export function useEnviosPorDia(dias: number) {
  return useQuery({
    queryKey: ["envios-por-dia", dias],
    queryFn: () => buscarEnviosPorDia(dias),
    staleTime: 60_000,
  });
}
