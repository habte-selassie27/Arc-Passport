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

// ── Preprocessing ───────────────────────────────────────────────────────

/**
 * Crop the bottom of the document (where the MRZ lives on ID cards and
 * passports), upscale it, and stretch contrast to full range. Feeding
 * Tesseract a clean, magnified strip instead of the whole angled/low-light
 * card photo massively improves recognition of the small monospace lines.
 * Returns null when the browser can't decode the image — caller falls back
 * to OCRing the original file.
 */
async function toMrzStrip(file: File): Promise<HTMLCanvasElement | null> {
  try {
    const img = await createImageBitmap(file);
    // MRZ sits in the bottom ~30% of ICAO 9303 documents; be generous.
    const stripH = Math.round(img.height * 0.3);
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = img.width * scale;
    canvas.height = stripH * scale;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, img.height - stripH, img.width, stripH, 0, 0, canvas.width, canvas.height);
    img.close();

    // Grayscale + contrast stretch (dark phone shots under-use the range).
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;
    let min = 255;
    let max = 0;
    for (let i = 0; i < px.length; i += 4) {
      const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      if (l < min) min = l;
      if (l > max) max = l;
    }
    const range = Math.max(1, max - min);
    for (let i = 0; i < px.length; i += 4) {
      const l = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2] - min) * (255 / range);
      px[i] = px[i + 1] = px[i + 2] = l;
    }
    ctx.putImageData(data, 0, 0);
    return canvas;
  } catch {
    return null;
  }
}

/**
 * Otsu binarization of an MRZ strip canvas (in place): pure black text on
 * white kills the gray smudge Tesseract hallucinates filler `<` from in
 * dark phone shots. Returns the same canvas for chaining.
 */
function binarize(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  const hist = new Array(256).fill(0);
  const n = px.length / 4;
  for (let i = 0; i < px.length; i += 4) hist[px[i]]++;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = n - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  for (let i = 0; i < px.length; i += 4) {
    const v = px[i] > threshold ? 255 : 0;
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

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
  let worker: Awaited<ReturnType<typeof createWorker>>;
  try {
    worker = await createWorker("eng", 1, {
      logger: (m: { status: string; progress: number }) => {
        if (onProgress && m.status === "recognizing text") onProgress(m.progress);
      },
    });
  } catch (err) {
    // tesseract.js spawns `new Worker(blobURL)` + importScripts from
    // cdn.jsdelivr.net. A missing `worker-src blob:` CSP directive (or a
    // blocked CDN) surfaces here as "Failed to construct 'Worker'".
    console.error("[mrzOcr] OCR worker failed to start", err);
    throw new MrzError(
      "Document scanner failed to start — the browser blocked the on-device text reader. " +
        "Reload the page (the site must allow `worker-src 'self' blob:` and cdn.jsdelivr.net in its Content-Security-Policy). " +
        "If it persists, try a different browser."
    );
  }

  let text: string;
  try {
    // PSM 6 = assume a uniform block of text — best for MRZ zones.
    await worker.setParameters({
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<",
      tessedit_pageseg_mode: "6",
    } as Record<string, string>);

    // Attempt 1: enhanced bottom-strip crop (best signal). Attempt 2: the
    // binarized strip (dark-phone-shot rescue). Attempt 3: the full original
    // photo, in case the MRZ sits unusually high or preprocessing failed.
    // First parseable result wins — parseMrzText prefers checksum-clean hits.
    text = "";
    const strip = await toMrzStrip(file);
    if (strip) {
      const { data } = await worker.recognize(strip);
      text = data.text;
    }
    if (!parseMrzText(text) && strip) {
      const { data } = await worker.recognize(binarize(strip));
      if (parseMrzText(data.text)) text = data.text;
    }
    if (!parseMrzText(text)) {
      const { data } = await worker.recognize(file);
      text = data.text;
    }
  } finally {
    await worker.terminate().catch(() => undefined);
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
    // Tesseract emits these for filler `<` despite the whitelist — map back
    // (length-preserving) instead of stripping, which would shift every field.
    .replace(/[|/\\¦]/g, "<")
    .replace(/[^A-Z0-9<]/g, "")
    .trim();
}

/**
 * Parse raw OCR text into an MRZ result. Detects TD3 (2×44), TD2 (2×36),
 * TD1 (3×30) by line lengths after sanitization.
 *
 * OCR noise shifts lengths and invents phantom lines, so every plausible
 * window is tried and the first checksum-clean hit wins; otherwise the
 * first length-plausible candidate is returned (caller still gets fields).
 */
export function parseMrzText(text: string): MrzResult | null {
  const lines = text
    .split("\n")
    .map(sanitize)
    .filter((l) => l.length >= 25 && l.includes("<"));

  let fallback: MrzResult | null = null;
  const consider = (r: MrzResult): MrzResult | null => {
    if (r.allChecksValid) return r;
    fallback ??= r;
    return null;
  };

  // Try to find the best-matching format by expected line lengths
  // TD3: two lines of exactly 44 chars. Allow ±2 tolerance for OCR noise.
  for (let i = 0; i < lines.length - 1; i++) {
    const a = lines[i];
    const b = lines[i + 1];

    if (near(a, 44) && near(b, 44)) {
      const hit = consider(parseTd3(pad(a, 44), pad(b, 44)));
      if (hit) return hit;
    }
    if (near(a, 36) && near(b, 36)) {
      const hit = consider(parseTd2(pad(a, 36), pad(b, 36)));
      if (hit) return hit;
    }
    // TD1: three lines of 30
    const c = lines[i + 2];
    if (c && near(a, 30) && near(b, 30) && near(c, 30)) {
      const hit = consider(parseTd1(pad(a, 30), pad(b, 30), pad(c, 30)));
      if (hit) return hit;
    }
  }
  return fallback;
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
  // Check digit covers the 9-char number only — never include itself.
  checks.push({ name: "documentNumber", valid: isValidCheck(l2.slice(0, 9), l2[9]) });

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

/**
 * TD2 layout (ICAO 9303, 2×36) — names live on line 1, everything else on
 * line 2. (A previous revision mistakenly reused the TD1 offsets here.)
 *
 * Line 1: 1–2 doc code, 3–5 issuing state, 6–36 names.
 * Line 2: 1–9 doc number, 10 its check, 11–13 nationality, 14–19 birth,
 *   20 birth check, 21 sex, 22–27 expiry, 28 expiry check, 29–35 optional
 *   data, 36 composite check (over 1–10, 14–20, 22–35).
 */
function parseTd2(l1: string, l2: string): MrzResult {
  const checks: { name: string; valid: boolean }[] = [];

  const documentNumber = l2.slice(0, 9).replace(/<+$/, "");
  checks.push({ name: "documentNumber", valid: isValidCheck(l2.slice(0, 9), l2[9]) });

  const { birthDate, expiryDate } = parseDates(l2.slice(13, 20), l2.slice(21, 28), checks);
  const composite = l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, 35);
  checks.push({ name: "composite", valid: isValidCheck(composite, l2[35]) });

  const names = parseName(l1.slice(5));
  const docCode = l1[0] === "P" ? "passport" : "national_id";

  return {
    format: "TD2",
    fields: {
      documentType: docCode,
      documentNumber,
      surname: names.surname,
      givenNames: names.givenNames,
      nationality: l2.slice(10, 13).replace(/</g, ""),
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
