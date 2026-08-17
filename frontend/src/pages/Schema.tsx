import { SchemaForm } from "../components/forms/SchemaForm";
import { PageHeader } from "../components/ui/PageHeader";

export function SchemaPage() {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Schema Registry"
        title="Register Schema"
        description="Define a new claim schema. The schema ID is computed deterministically from name + version + fields."
      />
      <SchemaForm />
    </div>
  );
}
