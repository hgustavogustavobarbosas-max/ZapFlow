import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type EstadoSessao = { carregando: true; session: null } | { carregando: false; session: Session | null };

/** Sessão do Supabase Auth (restaurada do armazenamento local e mantida por onAuthStateChange). */
export function useSession(): EstadoSessao {
  const [estado, setEstado] = useState<EstadoSessao>({ carregando: true, session: null });

  useEffect(() => {
    let ativo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (ativo) setEstado({ carregando: false, session: data.session });
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (ativo) setEstado({ carregando: false, session });
    });
    return () => {
      ativo = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return estado;
}
