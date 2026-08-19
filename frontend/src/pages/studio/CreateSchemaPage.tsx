import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { SchemaBuilder } from "../../components/studio/SchemaBuilder";

export function CreateSchemaPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="display--medium t-xl" style={{ marginBottom: "var(--space-1)" }}>Create Schema</h1>
          <p className="t-sm c-muted">Define a new claim schema and register it on-chain.</p>
        </div>
        <Link to="/studio/templates">
          <Button variant="ghost" size="sm">Browse Templates</Button>
        </Link>
      </div>
      <SchemaBuilder />
    </div>
  );
}
