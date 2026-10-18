import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, EdgesGeometry, Group, LineBasicMaterial, MathUtils, Mesh, MeshStandardMaterial } from "three";
import { PALETA } from "./config";
import { Lights } from "./Lights";

type Props = {
  quantidade: number;
  ativa: number;
  onAtivar: (indice: number) => void;
};

const ESPACAMENTO = 2.1;

// Geometrias e materiais compartilhados por todos os nós: nada é recriado por render.
const GEO_NO = new BoxGeometry(1, 1, 1);
const GEO_ARESTAS = new EdgesGeometry(GEO_NO);
const GEO_CONECTOR = new BoxGeometry(1, 0.05, 0.05);
const MAT_NO = new MeshStandardMaterial({ color: PALETA.superficie, roughness: 0.65, metalness: 0.1 });
const MAT_NO_ATIVO = new MeshStandardMaterial({
  color: PALETA.superficieAlta,
  emissive: PALETA.primaria,
  emissiveIntensity: 0.22,
  roughness: 0.55,
  metalness: 0.1,
});
const MAT_LINHA = new LineBasicMaterial({ color: PALETA.linha });
const MAT_LINHA_ATIVA = new LineBasicMaterial({ color: PALETA.primaria });
const MAT_PACOTE = new MeshStandardMaterial({ color: PALETA.primaria, emissive: PALETA.primaria, emissiveIntensity: 0.9 });

function posicao(indice: number, total: number): [number, number, number] {
  const x = (indice - (total - 1) / 2) * ESPACAMENTO;
  return [x, 0, indice % 2 === 0 ? 0.35 : -0.35];
}

function No({ posicao: pos, ativo, onAtivar }: { posicao: [number, number, number]; ativo: boolean; onAtivar: () => void }) {
  const grupo = useRef<Group>(null);

  useFrame((_, delta) => {
    if (!grupo.current) return;
    const escala = MathUtils.damp(grupo.current.scale.x, ativo ? 1.18 : 1, 8, delta);
    grupo.current.scale.setScalar(escala);
  });

  return (
    <group
      ref={grupo}
      position={pos}
      onPointerOver={(evento) => {
        evento.stopPropagation();
        onAtivar();
      }}
    >
      <mesh geometry={GEO_NO} material={ativo ? MAT_NO_ATIVO : MAT_NO} />
      <lineSegments geometry={GEO_ARESTAS} material={ativo ? MAT_LINHA_ATIVA : MAT_LINHA} />
    </group>
  );
}

function Conector({ de, para }: { de: [number, number, number]; para: [number, number, number] }) {
  const dx = para[0] - de[0];
  const dz = para[2] - de[2];
  return (
    <mesh
      geometry={GEO_CONECTOR}
      material={MAT_LINHA}
      position={[(de[0] + para[0]) / 2, 0, (de[2] + para[2]) / 2]}
      rotation={[0, -Math.atan2(dz, dx), 0]}
      scale={[Math.hypot(dx, dz) - 1, 1, 1]}
    />
  );
}

/** Pacote de dados percorrendo o fluxo: representa a direção webhook → histórico. */
function Pacote({ pontos }: { pontos: Array<[number, number, number]> }) {
  const malha = useRef<Mesh>(null);
  useFrame((estado) => {
    if (!malha.current) return;
    const progresso = (estado.clock.elapsedTime * 0.22) % 1;
    const trechos = pontos.length - 1;
    const posicaoNoTrecho = progresso * trechos;
    const i = Math.min(trechos - 1, Math.floor(posicaoNoTrecho));
    const t = posicaoNoTrecho - i;
    malha.current.position.set(
      MathUtils.lerp(pontos[i][0], pontos[i + 1][0], t),
      0.75,
      MathUtils.lerp(pontos[i][2], pontos[i + 1][2], t),
    );
  });
  return (
    <mesh ref={malha} material={MAT_PACOTE}>
      <sphereGeometry args={[0.11, 16, 16]} />
    </mesh>
  );
}

/** Leve movimento de câmera guiado pelo ponteiro (apenas desktop). */
function Parallax() {
  useFrame((estado, delta) => {
    const { camera, pointer } = estado;
    camera.position.x = MathUtils.damp(camera.position.x, pointer.x * 0.7, 3, delta);
    camera.position.y = MathUtils.damp(camera.position.y, 2.4 + pointer.y * 0.3, 3, delta);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function PipelineScene({ quantidade, ativa, onAtivar }: Props) {
  const posicoes = useMemo(() => Array.from({ length: quantidade }, (_, i) => posicao(i, quantidade)), [quantidade]);

  return (
    <>
      <Lights />
      <Parallax />
      <group>
        {posicoes.map((p, i) => (
          <No key={i} posicao={p} ativo={i === ativa} onAtivar={() => onAtivar(i)} />
        ))}
        {posicoes.slice(0, -1).map((p, i) => (
          <Conector key={i} de={p} para={posicoes[i + 1]} />
        ))}
        <Pacote pontos={posicoes} />
      </group>
    </>
  );
}
