import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, MathUtils, Mesh } from "three";
import type { StatusConexao } from "@/integrations/supabase/types";
import { PALETA } from "./config";
import { Lights } from "./Lights";

const COR_STATUS: Record<StatusConexao, string> = {
  conectado: PALETA.primaria,
  aguardando_leitura: PALETA.alerta,
  desconectado: PALETA.suave,
};

/** Fração do anel exibida: completo = conectado; parcial e girando = aguardando; arco curto = desconectado. */
const COMPRIMENTO_ARCO: Record<StatusConexao, number> = {
  conectado: Math.PI * 2,
  aguardando_leitura: Math.PI * 1.4,
  desconectado: Math.PI * 0.5,
};

export default function InstanceStatusScene({ status }: { status: StatusConexao }) {
  const cor = COR_STATUS[status];
  const modelo = useRef<Group>(null);
  const anel = useRef<Mesh>(null);
  const luz = useRef<Mesh>(null);

  useFrame((estado, delta) => {
    const t = estado.clock.elapsedTime;
    if (modelo.current) modelo.current.rotation.y = Math.sin(t * 0.6) * 0.35;
    if (anel.current) {
      if (status === "aguardando_leitura") anel.current.rotation.z += delta * 1.6;
      else anel.current.rotation.z = MathUtils.damp(anel.current.rotation.z, 0, 6, delta);
    }
    if (luz.current) {
      const pulso = status === "aguardando_leitura" ? 1 + Math.sin(t * 4) * 0.18 : 1;
      luz.current.scale.setScalar(pulso);
    }
  });

  return (
    <>
      <Lights />
      <group ref={modelo}>
        <mesh>
          <boxGeometry args={[1, 1.9, 0.14]} />
          <meshStandardMaterial color={PALETA.superficieAlta} roughness={0.5} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0, 0.075]}>
          <planeGeometry args={[0.86, 1.72]} />
          <meshStandardMaterial color={PALETA.superficie} roughness={0.9} />
        </mesh>
        <mesh ref={luz} position={[0, 0, 0.09]}>
          <circleGeometry args={[0.2, 32]} />
          <meshStandardMaterial color={cor} emissive={cor} emissiveIntensity={status === "desconectado" ? 0.1 : 0.7} />
        </mesh>
      </group>
      <mesh ref={anel}>
        <ringGeometry args={[1.35, 1.42, 64, 1, 0, COMPRIMENTO_ARCO[status]]} />
        <meshBasicMaterial color={cor} opacity={status === "desconectado" ? 0.5 : 1} transparent />
      </mesh>
    </>
  );
}
