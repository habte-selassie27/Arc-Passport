import { describe, it, expect } from "vitest";
import { parseCsv, csvToObjects } from "../../utils/csv.js";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    const text = "a,b,c\n1,2,3\n4,5,6";
    const { headers, rows } = parseCsv(text);
    expect(headers).toEqual(["a", "b", "c"]);
    expect(rows).toEqual([["1", "2", "3"], ["4", "5", "6"]]);
  });

  it("handles quoted fields with embedded commas", () => {
    const text = 'name,description\n"Foo, Inc.","a, b, c"';
    const { headers, rows } = parseCsv(text);
    expect(headers).toEqual(["name", "description"]);
    expect(rows).toEqual([["Foo, Inc.", "a, b, c"]]);
  });

  it("handles escaped double-quotes", () => {
    const text = 'a\n"He said ""hi"" ok"';
    const { headers, rows } = parseCsv(text);
    expect(headers).toEqual(["a"]);
    expect(rows).toEqual([['He said "hi" ok']]);
  });

  it("handles CRLF line endings", () => {
    const text = "a,b\r\n1,2\r\n3,4\r\n";
    const { headers, rows } = parseCsv(text);
    expect(headers).toEqual(["a", "b"]);
    expect(rows).toEqual([["1", "2"], ["3", "4"]]);
  });

  it("handles empty trailing line", () => {
    const text = "a,b\n1,2\n";
    const { headers, rows } = parseCsv(text);
    expect(headers).toEqual(["a", "b"]);
    expect(rows).toEqual([["1", "2"]]);
  });

  it("returns empty for empty input", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
    expect(parseCsv("   ")).toEqual({ headers: [], rows: [] });
  });

  it("strips UTF-8 BOM", () => {
    const text = "﻿a,b\n1,2";
    const { headers, rows } = parseCsv(text);
    expect(headers).toEqual(["a", "b"]);
    expect(rows).toEqual([["1", "2"]]);
  });
});

describe("csvToObjects", () => {
  it("splits valid and invalid rows with row numbers", () => {
    const text = "name,age\nalice,30\nbob,notANumber\ncarol,40";
    const { valid, errors } = csvToObjects<{ name: string; age: number }>(text, (raw) => {
      const age = parseInt(raw.age, 10);
      if (Number.isNaN(age)) {
        return { success: false as const, error: { row: 0, field: "age", error: "must be integer" } };
      }
      return { success: true as const, data: { name: raw.name, age } };
    });
    expect(valid).toEqual([{ name: "alice", age: 30 }, { name: "carol", age: 40 }]);
    expect(errors).toEqual([{ row: 3, field: "age", error: "must be integer" }]);
  });

  it("returns all-row error if header is missing", () => {
    const { valid, errors } = csvToObjects("", () => ({ success: true as const, data: {} }));
    expect(valid).toEqual([]);
    expect(errors.length).toBe(1);
    expect(errors[0]?.row).toBe(0);
  });

  it("preserves row alignment (1-indexed data + 1 for header)", () => {
    const text = "x\nv1\nv2\nv3";
    const { valid, errors } = csvToObjects<{ x: string }>(text, (raw) => {
      return { success: false as const, error: { row: 0, error: raw.x } };
    });
    expect(valid).toEqual([]);
    expect(errors.map((e) => e.row)).toEqual([2, 3, 4]);
  });
});
