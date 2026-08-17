import type { ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  align?: "center" | "left";
}

export function PageHeader({ eyebrow, title, description, actions, align = "center" }: PageHeaderProps) {
  const centered = align === "center";
  return (
    <header style={{ marginBottom: "var(--space-8)" }}>
      <div className={centered ? "text-center" : ""}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="display t-2xl" style={{ marginTop: "var(--space-2)" }}>
          {title}
        </h1>
      </div>
      {description && (
        <p
          className={`c-muted t-sm ${centered ? "text-center" : ""}`}
          style={{
            maxWidth: 560,
            marginTop: "var(--space-3)",
            marginLeft: centered ? "auto" : 0,
            marginRight: centered ? "auto" : 0,
          }}
        >
          {description}
        </p>
      )}
      {actions && (
        <div style={{ marginTop: "var(--space-4)" }} className={centered ? "text-center" : ""}>
          {actions}
        </div>
      )}
    </header>
  );
}
