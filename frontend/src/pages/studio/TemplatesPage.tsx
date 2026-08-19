import { TemplateSelector } from "../../components/studio/TemplateSelector";

export function TemplatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="display--medium t-xl" style={{ marginBottom: "var(--space-1)" }}>Schema Templates</h1>
        <p className="t-sm c-muted">Pre-built templates to accelerate schema creation. Click "Use" to pre-fill the Schema Builder.</p>
      </div>
      <TemplateSelector />
    </div>
  );
}
