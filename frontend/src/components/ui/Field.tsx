import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  htmlFor?: string;
  helper?: ReactNode;
  error?: string | null;
  children: ReactNode;
  style?: React.CSSProperties;
}

export function Field({ label, htmlFor, helper, error, children, style }: FieldProps) {
  return (
    <div className="field" style={style}>
      <label className="field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : helper ? (
        <p className="field__helper">{helper}</p>
      ) : null}
    </div>
  );
}
