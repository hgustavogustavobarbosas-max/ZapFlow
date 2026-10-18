import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BoxGeometry, InstancedMesh, Object3D } from "three";
import type { EnvioDia } from "@/types/envios";
import { PALETA } from "./config";
import { Lights } from "./Lights";

type Props = {
  dias: ReadonlyArray<EnvioDia>;
  /** Maior contagem diária do período; define a escala de altura. */
  maximo: number;
  selecionado: number | null;
  onSelecionar: (indice: number | null) => void;
};

const LARGURA_SLOT = 0.9;
const LARGURA_BARRA = 0.32;
const ALTURA_MAXIMA = 3;
const ALTURA_MINIMA = 0.03;
const DURACAO_ENTRADA_S = 0.6;

// Origem na base da barra, para que a escala em Y cresça "para cima".
const GEO_BARRA = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const auxiliar = new Object3D();

const posicaoX = (indice: number, total: number) => (indice - (total - 1) / 2) * LARGURA_SLOT;

/** Ajusta a distância da câmera para que todos os dias caibam, qualquer que seja a proporção do contêiner. */
function AjusteDeCamera({ total }: { total: number }) {
  const camera = useThree((estado) => estado.camera);
  const size = useThree((estado) => estado.size);
  useLayoutEffect(() => {
    const aspecto = size.width / Math.max(size.height, 1);
    const larguraNecessaria = (total * LARGURA_SLOT) / 2 + 0.6;
    const distancia = Math.min(14, Math.max(6, larguraNecessaria / (Math.tan((32 / 2) * (Math.PI / 180)) * aspecto)));
    camera.position.set(0, 3.4, distancia);
    camera.lookAt(0, 1.25, 0);
    camera.updateProjectionMatrix();
  }, [camera, size, total]);
  return null;
}

export default function SendsBars({ dias, maximo, selecionado, onSelecionar }: Props) {
  const sucessos = useRef<InstancedMesh>(null);
  const erros = useRef<InstancedMesh>(null);
  const progresso = useRef(0);
  const invalidate = useThree((s) => s.invalidate);
  const total = dias.length;

  const escrever = useMemo(
    () => (fator: number) => {
      const escala = maximo > 0 ? ALTURA_MAXIMA / maximo : 0;
      const grupos: Array<[InstancedMesh | null, number, (d: EnvioDia) => number]> = [
        [sucessos.current, -0.18, (d) => d.sucesso],
        [erros.current, 0.18, (d) => d.erro],
      ];
      for (const [malha, deslocamento, valor] of grupos) {
        if (!malha) continue;
        dias.forEach((dia, i) => {
          auxiliar.position.set(posicaoX(i, total) + deslocamento, 0, 0);
          auxiliar.scale.set(LARGURA_BARRA, Math.max(ALTURA_MINIMA, valor(dia) * escala * fator), LARGURA_BARRA);
          auxiliar.updateMatrix();
          malha.setMatrixAt(i, auxiliar.matrix);
        });
        malha.instanceMatrix.needsUpdate = true;
        // Força o recálculo da esfera de colisão usada pelo raycast após mudar as matrizes.
        malha.boundingSphere = null;
      }
    },
    [dias, maximo, total],
  );

  // Novos dados reiniciam a animação de entrada.
  useEffect(() => {
    progresso.current = 0;
    invalidate();
  }, [dias, maximo, invalidate]);

  // Renderização sob demanda: só há frames enquanto a animação de entrada não termina.
  useFrame((estado, delta) => {
    if (progresso.current >= 1) return;
    progresso.current = Math.min(1, progresso.current + delta / DURACAO_ENTRADA_S);
    escrever(1 - Math.pow(1 - progresso.current, 3));
    if (progresso.current < 1) estado.invalidate();
  });

  return (
    <>
      <Lights />
      <AjusteDeCamera total={total} />

      <mesh position={[0, -0.04, 0]}>
        <boxGeometry args={[total * LARGURA_SLOT + 0.4, 0.06, 1.1]} />
        <meshStandardMaterial color={PALETA.superficieAlta} roughness={0.8} />
      </mesh>

      <instancedMesh ref={sucessos} args={[GEO_BARRA, undefined, total]}>
        <meshStandardMaterial color={PALETA.primaria} roughness={0.55} />
      </instancedMesh>
      <instancedMesh ref={erros} args={[GEO_BARRA, undefined, total]}>
        <meshStandardMaterial color={PALETA.erro} roughness={0.55} />
      </instancedMesh>

      {selecionado !== null && (
        <mesh position={[posicaoX(selecionado, total), ALTURA_MAXIMA / 2, -0.3]}>
          <planeGeometry args={[LARGURA_SLOT - 0.06, ALTURA_MAXIMA + 0.3]} />
          <meshBasicMaterial color={PALETA.suave} transparent opacity={0.14} />
        </mesh>
      )}

      {/* Áreas de seleção invisíveis: facilitam o hover mesmo em barras baixas. */}
      {dias.map((dia, i) => (
        <mesh
          key={dia.dia}
          position={[posicaoX(i, total), ALTURA_MAXIMA / 2, 0.3]}
          onPointerOver={(evento) => {
            evento.stopPropagation();
            onSelecionar(i);
          }}
          onPointerOut={() => onSelecionar(null)}
        >
          <planeGeometry args={[LARGURA_SLOT, ALTURA_MAXIMA + 0.3]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      ))}
    </>
  );
}
