import { Component, type ReactNode, type ErrorInfo } from "react";
import { Button } from "../ui/Button";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

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
          <div className="error-state" role="alert">
            <p className="error-state__title">
              <span aria-hidden="true">✗</span> Something went wrong
            </p>
            <p className="error-state__body">This section failed to render. Please try again.</p>
            <div className="error-state__action">
              <Button variant="ghost" size="sm" onClick={() => this.setState({ error: null })}>
                Try again
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
