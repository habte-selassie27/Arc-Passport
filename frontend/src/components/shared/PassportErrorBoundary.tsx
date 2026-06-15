import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props { children: ReactNode }
interface State { error: Error | null }

export class PassportErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[PassportErrorBoundary]", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">Something went wrong loading this passport.</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
