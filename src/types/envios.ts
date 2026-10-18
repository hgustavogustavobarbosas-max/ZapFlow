export type EnvioDia = {
  /** Data local no formato AAAA-MM-DD. */
  dia: string;
  sucesso: number;
  erro: number;
};

export type EnviosPorDia = {
  dias: EnvioDia[];
  /** Verdadeiro quando o limite de linhas consultadas foi atingido e os dias mais antigos podem estar incompletos. */
  amostraParcial: boolean;
};
