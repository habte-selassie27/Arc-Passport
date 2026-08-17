import { useEffect, useState } from "react";
import { useRequests, fetchSchemaCatalog, type SchemaOption } from "../../hooks/useRequests";
import { Card } from "../ui/Card";
import { Field } from "../ui/Field";
import { Select } from "../ui/Select";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";

export function RequestCredentialForm({ address }: { address: `0x${string}` }) {
  const { create, isLoading, error } = useRequests(address);
  const [schemas, setSchemas] = useState<SchemaOption[]>([]);
  const [schemaId, setSchemaId] = useState("");
  const [issuer, setIssuer] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "success">("idle");

  useEffect(() => {
    void fetchSchemaCatalog().then((s) => setSchemas(s));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("idle");
    const ok = await create({ issuer, schemaId, note });
    if (ok) {
      setStatus("success");
      setNote("");
    }
  };

  return (
    <Card>
      <h3 className="display--medium t-lg" style={{ marginBottom: "var(--space-1)" }}>Request a credential</h3>
      <p className="t-xs c-muted" style={{ marginBottom: "var(--space-4)" }}>
        Ask an issuer to grant you a credential. They will review it on their dashboard.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Credential type" htmlFor="req-schema">
          <Select
            id="req-schema"
            value={schemaId}
            onChange={(e) => setSchemaId(e.target.value)}
            required
          >
            <option value="" disabled>
              {schemas.length === 0 ? "Loading credential types…" : "Select a credential type"}
            </option>
            {schemas.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.service})</option>
            ))}
          </Select>
        </Field>

        <Field label="Issuer address" htmlFor="req-issuer">
          <Input
            id="req-issuer"
            mono
            type="text"
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            placeholder="0x…"
            required
          />
        </Field>

        <Field label="Note (optional)" htmlFor="req-note">
          <textarea
            id="req-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="input"
            placeholder="Why are you requesting this credential?"
            maxLength={500}
          />
        </Field>

        {error && <p className="c-danger t-sm text-center">{error}</p>}
        {status === "success" && (
          <p className="c-verified t-sm text-center">Request sent! The issuer will review it.</p>
        )}

        <Button type="submit" block disabled={isLoading || !schemaId || !issuer} loading={isLoading}>
          Request credential
        </Button>
      </form>
    </Card>
  );
}
