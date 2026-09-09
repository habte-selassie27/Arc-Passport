/**
 * mrzOcr.ts — Client-side MRZ extraction from ID/passport photos.
 *
 * What it does: OCRs an uploaded document photo (tesseract.js, in-browser),
 *   locates the Machine Readable Zone lines, parses TD3 (passport) and TD1/TD2
 *   (ID card) formats, and validates the ICAO 9303 check digits.
 * What it does NOT do: send the image or any field anywhere. Everything runs
 *   locally; only the caller decides what to do with the parsed fields.
 * What calls it: ZKPassport Vault tab (via useZkVault hook flow).
 */

// ── Types ─────────────────────────────────────────────────────────────────

export interface MrzResult {
  format: "TD1" | "TD2" | "TD3";
  fields: Record<string, string>;
  checks: { name: string; valid: boolean }[];
  allChecksValid: boolean;
  rawLines: string[];
}

export class MrzError extends Error {}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * OCR a document photo and extract + validate the MRZ.
 * `onProgress` receives 0..1 during recognition.
 */
export async function extractMrzFromImage(
  file: File,
  onProgress?: (p: number) => void
): Promise<MrzResult> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (onProgress && m.status === "recognizing text") onProgress(m.progress);
    },
  });

  let text: string;
  try {
    // PSM 6 = assume a uniform block of text — best for MRZ zones.
    await worker.setParameters({
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<",
      tessedit_pageseg_mode: "6",
    } as Record<string, string>);
    const { data } = await worker.recognize(file);
    text = data.text;
  } finally {
    await worker.terminate();
  }

  const result = parseMrzText(text);
  if (!result) {
    throw new MrzError(
      "Could not find a valid MRZ in this image. Try a sharper, straight-on photo where the two bottom lines of the document are fully visible."
    );
  }
  return result;
}

// ── Parsing ───────────────────────────────────────────────────────────────

/** ICAO 9303 check digit: weights 7,3,1 mod 10 over char values. */
function checkDigit(s: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    let v: number;
    if (c >= "0" && c <= "9") v = c.charCodeAt(0) - 48;
    else if (c >= "A" && c <= "Z") v = c.charCodeAt(0) - 55; // A=10
    else v = 0; // '<' filler
    sum += v * weights[i % 3];
  }
  return sum % 10;
}

function isValidCheck(field: string, digit: string): boolean {
  if (!/^\d$/.test(digit)) return false;
  return checkDigit(field) === Number(digit);
}

/** Clean an OCR line: keep MRZ charset, uppercase, require min length. */
function sanitize(line: string): string {
  return line
    .toUpperCase()
    .replace(/[^A-Z0-9<]/g, "")
    .trim();
}

/**
 * Parse raw OCR text into an MRZ result. Detects TD3 (2×44), TD2 (2×36),
 * TD1 (3×30) by line lengths after sanitization.
 */
export function parseMrzText(text: string): MrzResult | null {
  const lines = text
    .split("\n")
    .map(sanitize)
    .filter((l) => l.length >= 25 && l.includes("<"));

  // Try to find the best-matching format by expected line lengths
  // TD3: two lines of exactly 44 chars. Allow ±2 tolerance for OCR noise.
  for (let i = 0; i < lines.length - 1; i++) {
    const a = lines[i];
    const b = lines[i + 1];

    if (near(a, 44) && near(b, 44)) {
      return parseTd3(pad(a, 44), pad(b, 44));
    }
    if (near(a, 36) && near(b, 36)) {
      return parseTd2(pad(a, 36), pad(b, 36));
    }
    // TD1: three lines of 30
    const c = lines[i + 2];
    if (c && near(a, 30) && near(b, 30) && near(c, 30)) {
      return parseTd1(pad(a, 30), pad(b, 30), pad(c, 30));
    }
  }
  return null;
}

function near(s: string, len: number): boolean {
  return Math.abs(s.length - len) <= 2;
}

function pad(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : s + "<".repeat(len - s.length);
}

// ── Format parsers (ICAO 9303 part 5/6/7 layouts) ────────────────────────

function parseDates(
  birth: string,
  expiry: string,
  checks: { name: string; valid: boolean }[]
): { birthDate: string; expiryDate: string } {
  const birthValid = isValidCheck(birth.slice(0, 6), birth[6]);
  const expiryValid = isValidCheck(expiry.slice(0, 6), expiry[6]);
  checks.push({ name: "birthDate", valid: birthValid });
  checks.push({ name: "expiryDate", valid: expiryValid });
  return { birthDate: yyMMdd(birth), expiryDate: yyMMdd(expiry) };
}

function yyMMdd(s: string): string {
  // MRZ dates are YYMMDD; store ISO-ish YY-MM-DD for readability.
  return `${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4, 6)}`;
}

function parseTd3(l1: string, l2: string): MrzResult {
  const checks: { name: string; valid: boolean }[] = [];

  const documentNumber = l2.slice(0, 9).replace(/<+$/, "");
  checks.push({ name: "documentNumber", valid: isValidCheck(l2.slice(0, 10), l2[9]) });

  const nationality = l2.slice(10, 13).replace(/</g, "");
  const { birthDate, expiryDate } = parseDates(l2.slice(13, 20), l2.slice(21, 28), checks);

  // Composite check over positions 1–10, 14–20, 22–43 of line 2
  const composite = l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, 43);
  checks.push({ name: "composite", valid: isValidCheck(composite, l2[43]) });

  const names = parseName(l1.slice(5));
  checks.push({ name: "documentTypeCode", valid: /^[PID]/.test(l1[0]) });

  return {
    format: "TD3",
    fields: {
      documentType: l1[0] === "P" ? "passport" : "national_id",
      documentNumber,
      surname: names.surname,
      givenNames: names.givenNames,
      nationality,
      birthDate,
      expiryDate,
    },
    checks,
    allChecksValid: checks.every((c) => c.valid),
    rawLines: [l1, l2],
  };
}

function parseTd2(l1: string, l2: string): MrzResult {
  const checks: { name: string; valid: boolean }[] = [];

  const documentNumber = l1.slice(5, 14).replace(/<+$/, "");
  checks.push({ name: "documentNumber", valid: isValidCheck(l1.slice(5, 14), l1[14]) });

  const { birthDate, expiryDate } = parseDates(l2.slice(0, 7), l2.slice(8, 15), checks);
  const composite = l1.slice(5, 30) + l2.slice(0, 7) + l2.slice(8, 15) + l2.slice(18, 29);
  checks.push({ name: "composite", valid: isValidCheck(composite, l2[29]) });

  const names = parseName(l1.slice(20));
  const docCode = l1[0] === "P" ? "passport" : "national_id";

  return {
    format: "TD2",
    fields: {
      documentType: docCode,
      documentNumber,
      surname: names.surname,
      givenNames: names.givenNames,
      nationality: l1.slice(15, 18).replace(/</g, ""),
      birthDate,
      expiryDate,
    },
    checks,
    allChecksValid: checks.every((c) => c.valid),
    rawLines: [l1, l2],
  };
}

function parseTd1(l1: string, l2: string, l3: string): MrzResult {
  const checks: { name: string; valid: boolean }[] = [];

  const documentNumber = l1.slice(5, 14).replace(/<+$/, "");
  checks.push({ name: "documentNumber", valid: isValidCheck(l1.slice(5, 14), l1[14]) });

  const { birthDate, expiryDate } = parseDates(l2.slice(0, 7), l2.slice(8, 15), checks);
  const composite = l1.slice(5, 30) + l2.slice(0, 7) + l2.slice(8, 15) + l2.slice(18, 29);
  checks.push({ name: "composite", valid: isValidCheck(composite, l2[29]) });

  const names = parseName(l3);

  return {
    format: "TD1",
    fields: {
      documentType: l1[0] === "I" ? "national_id" : "national_id",
      documentNumber,
      surname: names.surname,
      givenNames: names.givenNames,
      nationality: l2.slice(15, 18).replace(/</g, ""),
      birthDate,
      expiryDate,
    },
    checks,
    allChecksValid: checks.every((c) => c.valid),
    rawLines: [l1, l2, l3],
  };
}

function parseName(s: string): { surname: string; givenNames: string } {
  // Surname << Given<Names
  const [surname, given = ""] = s.split("<<", 2);
  const clean = (t: string) => t.replace(/</g, " ").replace(/\s+/g, " ").trim();
  return { surname: clean(surname), givenNames: clean(given) };
}
