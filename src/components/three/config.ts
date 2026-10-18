/** Cores das cenas 3D. Valores hexadecimais aproximam os tokens do tema escuro (src/styles.css),
 *  pois o Three.js não interpreta oklch(). */
export const PALETA = {
  superficie: "#1b222b",
  superficieAlta: "#242d39",
  linha: "#3b4757",
  suave: "#77849a",
  primaria: "#3fd884",
  alerta: "#e8b64c",
  erro: "#ef5b57",
} as const;

/** Limite de resolução do canvas: acima disso o ganho visual não compensa o custo de GPU. */
export const DPR_MAXIMO = 1.75;
