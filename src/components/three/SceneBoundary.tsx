import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; onFalha: () => void };

/** Isola falhas de renderização WebGL: a interface troca para a versão estática em vez de quebrar a página. */
export class SceneBoundary extends Component<Props, { falhou: boolean }> {
  state = { falhou: false };

  static getDerivedStateFromError() {
    return { falhou: true };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error("Falha ao renderizar cena 3D; usando versão estática.", erro, info.componentStack);
    this.props.onFalha();
  }

  render() {
    return this.state.falhou ? null : this.props.children;
  }
}
