import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SCHEMA_TEMPLATES, type SchemaTemplate } from "./SchemaTemplates";
import { ALL_SERVICE_KEYS, SERVICE_LABELS, type ServiceKey } from "../../types/passport";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

export function TemplateSelector() {
  const [active, setActive] = useState<ServiceKey>("kyc");
  const navigate = useNavigate();

  const handleUseTemplate = (template: SchemaTemplate) => {
    navigate("/studio/schemas/new", { state: { prefill: template } });
  };

  return (
    <div className="card">
      <h3 className="display--medium t-lg" style={{ marginBottom: "var(--space-2)" }}>Schema Templates</h3>
      <p className="t-sm c-muted" style={{ marginBottom: "var(--space-4)" }}>
        Pre-built schema templates for each service vertical. Click "Use" to pre-fill the Schema Builder.
      </p>

      {/* Category tabs */}
      <div className="studio-tabs" role="tablist" style={{ marginBottom: "var(--space-5)" }}>
        {ALL_SERVICE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active === key}
            className="studio-tab"
            onClick={() => setActive(key)}
          >
            {SERVICE_LABELS[key]}
          </button>
        ))}
      </div>

      {/* Templates grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SCHEMA_TEMPLATES[active].map((t: SchemaTemplate) => (
          <Card key={t.name} interactive style={{ padding: "var(--space-4)" }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0" style={{ flex: 1 }}>
                <p className="mono t-sm" style={{ color: "var(--color-on-bright)", marginBottom: "var(--space-1)" }}>
                  {t.name}
                </p>
                <p className="t-sm c-muted" style={{ marginBottom: "var(--space-2)" }}>
                  {t.description}
                </p>
                <p className="t-xs c-subtle">
                  {t.fields.length} field{t.fields.length === 1 ? "" : "s"} · v{t.version}
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleUseTemplate(t)}
                style={{ flexShrink: 0 }}
              >
                Use
              </Button>
            </div>
          </Card>
        ))}
        {SCHEMA_TEMPLATES[active].length === 0 && (
          <p className="t-xs c-subtle italic" style={{ gridColumn: "1 / -1", padding: "var(--space-4) 0" }}>
            No predefined templates — use the Schema Builder.
          </p>
        )}
      </div>
    </div>
  );
}
