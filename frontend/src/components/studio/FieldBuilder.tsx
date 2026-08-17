export const SUPPORTED_FIELD_TYPES = [
  { value: "bool", label: "Boolean (true/false)" },
  { value: "uint8", label: "Small number (0–255)" },
  { value: "uint16", label: "Medium number (0–65535)" },
  { value: "uint32", label: "Number (0–4B)" },
  { value: "uint64", label: "Timestamp / large number" },
  { value: "uint256", label: "Large number / token amount" },
  { value: "string", label: "Text" },
  { value: "address", label: "Wallet address" },
  { value: "bytes32", label: "Hash / identifier" },
  { value: "address[]", label: "List of addresses" },
] as const;

export type FieldType = (typeof SUPPORTED_FIELD_TYPES)[number]["value"];

export interface FieldDef {
  name: string;
  type: FieldType;
}

interface FieldBuilderProps {
  fields: FieldDef[];
  onChange: (fields: FieldDef[]) => void;
}

export function FieldBuilder({ fields, onChange }: FieldBuilderProps) {
  const update = (i: number, patch: Partial<FieldDef>) => {
    const next = fields.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const add = () => onChange([...fields, { name: "", type: "string" }]);
  const remove = (i: number) => onChange(fields.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {fields.map((f, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            value={f.name}
            onChange={(e) => update(i, { name: e.target.value })}
            placeholder="field name"
            className="input input--mono"
            style={{ flex: 1, padding: "8px 12px", fontSize: "var(--text-sm)" }}
            aria-label={`Field ${i + 1} name`}
          />
          <select
            value={f.type}
            onChange={(e) => update(i, { type: e.target.value as FieldType })}
            className="select select--mono"
            style={{ width: 140, flexShrink: 0, padding: "8px 12px", fontSize: "var(--text-sm)" }}
            aria-label={`Field ${i + 1} type`}
          >
            {SUPPORTED_FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => remove(i)}
            className="btn btn--ghost btn--sm"
            style={{ color: "var(--color-subtle)", flexShrink: 0, padding: "6px 10px" }}
            title="Remove field"
            aria-label={`Remove field ${i + 1}`}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="btn btn--link btn--sm">
        + Add field
      </button>
    </div>
  );
}
