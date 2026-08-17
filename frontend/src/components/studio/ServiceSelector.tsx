import { ALL_SERVICE_KEYS, type ServiceKey, SERVICE_LABELS } from "../../types/passport";

interface ServiceSelectorProps {
  value: ServiceKey | null;
  onChange: (key: ServiceKey) => void;
}

export function ServiceSelector({ value, onChange }: ServiceSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Service type">
      {ALL_SERVICE_KEYS.map((key) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(key)}
            className="px-3 py-2 rounded-lg border text-xs font-medium transition-colors text-left"
            style={{
              background: active ? "var(--color-surface-1)" : "transparent",
              borderColor: active ? "var(--color-arc-primary)" : "var(--color-border)",
              color: active ? "var(--color-on-bright)" : "var(--color-muted)",
            }}
          >
            <span
              className="dot"
              style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", marginRight: 6, background: active ? "var(--color-arc-primary)" : "var(--color-subtle)", verticalAlign: "middle" }}
              aria-hidden="true"
            />
            {SERVICE_LABELS[key]}
          </button>
        );
      })}
    </div>
  );
}
