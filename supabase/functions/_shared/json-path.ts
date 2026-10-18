// Acesso seguro a propriedades aninhadas de JSON (sem eval, sem prototype pollution).

const SEGMENTOS_PROIBIDOS = new Set(["__proto__", "constructor", "prototype"]);
export const MAX_PATH_LENGTH = 200;
export const MAX_PATH_DEPTH = 10;

export function getByPath(source: unknown, path: string): unknown {
  if (typeof path !== "string" || path.length === 0 || path.length > MAX_PATH_LENGTH) {
    return undefined;
  }
  const segmentos = path.split(".");
  if (segmentos.length > MAX_PATH_DEPTH) return undefined;

  let atual: unknown = source;
  for (const segmento of segmentos) {
    if (segmento === "" || SEGMENTOS_PROIBIDOS.has(segmento)) return undefined;
    if (Array.isArray(atual)) {
      if (!/^\d+$/.test(segmento)) return undefined;
      atual = atual[Number(segmento)];
    } else if (atual !== null && typeof atual === "object") {
      if (!Object.hasOwn(atual, segmento)) return undefined;
      atual = (atual as Record<string, unknown>)[segmento];
    } else {
      return undefined;
    }
  }
  return atual;
}

/** Converte valores escalares em texto; objetos, arrays e vazios viram null. */
export function toScalarString(value: unknown): string | null {
  if (typeof value === "string") {
    const texto = value.trim();
    return texto === "" ? null : texto;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/** Lista os caminhos folha de um objeto, usados para mapear campos na interface. */
export function listLeafPaths(value: unknown, prefix = "", depth = 0): string[] {
  if (depth > MAX_PATH_DEPTH || value === null || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([chave, v]) =>
    listLeafPaths(v, prefix ? `${prefix}.${chave}` : chave, depth + 1),
  );
}

/** Verifica se o valor é um objeto JSON simples e não excede a profundidade máxima. */
export function isPlainObjectWithinDepth(value: unknown, maxDepth = MAX_PATH_DEPTH): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const dentroDoLimite = (v: unknown, nivel: number): boolean => {
    if (v === null || typeof v !== "object") return true;
    if (nivel > maxDepth) return false;
    const filhos = Array.isArray(v) ? v : Object.values(v as Record<string, unknown>);
    return filhos.every((f) => dentroDoLimite(f, nivel + 1));
  };
  return dentroDoLimite(value, 1);
}
