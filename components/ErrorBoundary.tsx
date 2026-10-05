import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  titulo?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Evita tela em branco: captura erros de renderização dos filhos e mostra uma mensagem com opção de tentar de novo. */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Erro de renderização capturado pelo ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        <p className="font-bold">{this.props.titulo || 'Algo deu errado ao exibir esta página.'}</p>
        <p className="mt-1 text-xs">{this.state.error.message}</p>
        <button onClick={() => this.setState({ error: null })} className="mt-3 font-black uppercase underline">
          Tentar novamente
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
