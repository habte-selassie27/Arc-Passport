import { describe, it, expect } from "vitest";
import { parseMrzText } from "../mrzOcr";

// Vectors from ICAO 9303 examples (all check digits verified).
const TD3 = [
  "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<",
  "L898902C36UTO7408122F1204159ZE184226B<<<<<10",
].join("\n");

const TD1 = [
  "I<UTOD231458907<<<<<<<<<<<<<<<",
  "7408122F1204159UTO<<<<<<<<<<<6",
  "ERIKSSON<<ANNA<MARIA<<<<<<<<<<",
].join("\n");

const TD2 = [
  "I<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<",
  "D231458907UTO7408122F1204159<<<<<<<6",
].join("\n");

describe("parseMrzText", () => {
  it("parses a TD3 passport with all checks valid", () => {
    const r = parseMrzText(TD3);
    expect(r).not.toBeNull();
    expect(r!.format).toBe("TD3");
    expect(r!.fields.documentNumber).toBe("L898902C3");
    expect(r!.fields.surname).toBe("ERIKSSON");
    expect(r!.fields.givenNames).toBe("ANNA MARIA");
    expect(r!.fields.nationality).toBe("UTO");
    expect(r!.allChecksValid).toBe(true);
  });

  it("parses a TD1 ID card with all checks valid", () => {
    const r = parseMrzText(TD1);
    expect(r).not.toBeNull();
    expect(r!.format).toBe("TD1");
    expect(r!.fields.documentNumber).toBe("D23145890");
    expect(r!.allChecksValid).toBe(true);
  });

  it("parses a TD2 document with all checks valid", () => {
    const r = parseMrzText(TD2);
    expect(r).not.toBeNull();
    expect(r!.format).toBe("TD2");
    expect(r!.fields.documentNumber).toBe("D23145890");
    expect(r!.fields.surname).toBe("ERIKSSON");
    expect(r!.fields.nationality).toBe("UTO");
    expect(r!.allChecksValid).toBe(true);
  });

  it("returns null when no MRZ lines exist (e.g. QR-code ID back side)", () => {
    expect(parseMrzText("ETHIOPIAN DIGITAL ID\nSOME QR CODE GARBAGE 12345")).toBeNull();
    expect(parseMrzText("")).toBeNull();
  });

  it("tolerates OCR filler misreads (|, /) as '<'", () => {
    const noisy = TD3.replace(/</g, "|");
    const r = parseMrzText(noisy);
    expect(r).not.toBeNull();
    expect(r!.format).toBe("TD3");
    expect(r!.fields.documentNumber).toBe("L898902C3");
  });

  it("prefers the checksum-clean candidate among noisy lines", () => {
    const garbled = "P<UTOERIKSSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
    const r = parseMrzText([garbled, ...TD3.split("\n")].join("\n"));
    expect(r).not.toBeNull();
    expect(r!.fields.documentNumber).toBe("L898902C3");
    expect(r!.allChecksValid).toBe(true);
  });
});
