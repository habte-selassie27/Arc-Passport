import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { SchemaBuilder } from "../../components/studio/SchemaBuilder";

export function SchemasPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="display--medium t-xl" style={{ marginBottom: "var(--space-1)" }}>My Schemas</h1>
          <p className="t-sm c-muted">Register and manage claim schemas on-chain.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/studio/schemas/new">
            <Button variant="primary" size="sm">+ Create Schema</Button>
          </Link>
          <Link to="/studio/templates">
            <Button variant="ghost" size="sm">Templates</Button>
          </Link>
        </div>
      </div>
      <SchemaBuilder />
    </div>
  );
}
