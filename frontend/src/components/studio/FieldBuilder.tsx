export const SUPPORTED_FIELD_TYPES = [
  { value: "bool",      label: "Boolean (true/false)"        },
  { value: "uint8",     label: "Small number (0–255)"        },
  { value: "uint16",    label: "Medium number (0–65535)"     },
  { value: "uint32",    label: "Number (0–4B)"               },
  { value: "uint64",    label: "Timestamp / large number"    },
  { value: "uint256",   label: "Large number / token amount" },
  { value: "string",    label: "Text"                        },
  { value: "address",   label: "Wallet address"              },
  { value: "bytes32",   label: "Hash / identifier"           },
  { value: "address[]", label: "List of addresses"           },
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
            className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
          />
          <select
            value={f.type}
            onChange={(e) => update(i, { type: e.target.value as FieldType })}
            className="px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
          >
            {SUPPORTED_FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => remove(i)}
            className="px-2 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-sm"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
      >
        + Add field
      </button>
    </div>
  );
}
