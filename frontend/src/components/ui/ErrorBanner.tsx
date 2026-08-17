import type { ReactNode } from "react";
import { Button } from "./Button";

interface ErrorBannerProps {
  children: ReactNode;
  onRetry?: () => void;
}

export function ErrorBanner({ children, onRetry }: ErrorBannerProps) {
  return (
    <div className="error-banner" role="status">
      <span>⚠ {children}</span>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
