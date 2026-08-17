import type { ReactNode } from "react";

interface CodeBlockProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/** Terminal-style block — dark background, mono font. */
export function CodeBlock({ children, className = "", style }: CodeBlockProps) {
  return (
    <pre className={`terminal ${className}`} style={style}>
      {children}
    </pre>
  );
}
