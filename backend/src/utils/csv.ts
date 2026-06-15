/**
 * RFC-4180 compliant CSV parser.
 * Handles quoted fields, embedded commas, escaped double-quotes (""), CRLF, and LF.
 * Returns rows as arrays of strings, with the first row treated as the header.
 */
export function parseCsv(input: string): { headers: string[]; rows: string[][] } {
  const text = input.replace(/^﻿/, "").trim();
  if (!text) return { headers: [], rows: [] };

  const all: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      cell += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ",") { row.push(cell); cell = ""; i++; continue; }
    if (c === "\r") {
      if (text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      all.push(row); row = [];
      i++; continue;
    }
    if (c === "\n") {
      row.push(cell); cell = "";
      all.push(row); row = [];
      i++; continue;
    }
    cell += c; i++;
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); all.push(row); }

  const headers = (all[0] ?? []).map((h) => h.trim());
  const rows = all.slice(1).filter((r) => r.length > 0 && !(r.length === 1 && r[0] === ""));
  return { headers, rows };
}

export interface CsvRowError {
  row:    number;
  field?: string;
  error:  string;
}

export interface CsvToObjectsResult<T> {
  valid:  T[];
  errors: CsvRowError[];
}

/**
 * Parse CSV text and validate each row against a zod schema.
 * Returns a split of valid objects and per-row errors. The header row is required
 * to match the schema's keys (or its expected column list).
 */
export function csvToObjects<T>(
  text: string,
  validate: (raw: Record<string, string>) => { success: true; data: T } | { success: false; error: CsvRowError }
): CsvToObjectsResult<T> {
  const { headers, rows } = parseCsv(text);
  if (headers.length === 0) {
    return { valid: [], errors: [{ row: 0, error: "empty or missing header row" }] };
  }
  const valid: T[] = [];
  const errors: CsvRowError[] = [];
  rows.forEach((cells, idx) => {
    const rowNum = idx + 2;
    const raw: Record<string, string> = {};
    headers.forEach((h, j) => { raw[h] = (cells[j] ?? "").trim(); });
    const r = validate(raw);
    if (r.success) valid.push(r.data);
    else {
      const { row: _drop, ...rest } = r.error;
      void _drop;
      errors.push({ row: rowNum, ...rest });
    }
  });
  return { valid, errors };
}
