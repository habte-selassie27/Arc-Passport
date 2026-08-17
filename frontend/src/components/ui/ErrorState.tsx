import type { ReactNode } from "react";
import { Button } from "./Button";

interface ErrorStateProps {
  title: string;
  body?: ReactNode;
  onRetry?: () => void;
  /** Extra content rendered before the action (e.g. terminal hints). */
  children?: ReactNode;
}

export function ErrorState({ title, body, onRetry, children }: ErrorStateProps) {
  return (
    <div className="error-state" role="alert">
      <p className="error-state__title">
        <span aria-hidden="true">✗</span> {title}
      </p>
      {body && <div className="error-state__body">{body}</div>}
      {children}
      {onRetry && (
        <div className="error-state__action">
          <Button variant="ghost" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
