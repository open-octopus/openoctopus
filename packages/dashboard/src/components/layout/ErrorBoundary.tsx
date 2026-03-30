import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center h-screen bg-surface">
          <div className="bg-white rounded-card border border-red-200 p-8 max-w-md text-center">
            <p className="text-3xl mb-4">🐙</p>
            <h2 className="text-lg font-bold text-ocean mb-2">页面出错了</h2>
            <p className="text-sm text-gray-500 mb-4">{this.state.error.message}</p>
            <button
              onClick={() => {
                this.setState({ error: null });
              }}
              className="bg-cyan text-white px-4 py-2 rounded-xl text-sm hover:bg-cyan/90"
            >
              重试
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
