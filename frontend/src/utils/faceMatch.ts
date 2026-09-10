/**
 * faceMatch.ts — On-device 1:1 face matching for the ZK ID Vault.
 *
 * What it does: loads tiny face models (self-hosted in /public/models),
 *   extracts 128-d descriptors and compares them with euclidean distance.
 *   Everything runs locally — no image ever leaves the browser for matching.
 * What it does NOT do: liveness (that's useLiveness) or face detection-only
 *   presence checks (that's RegisterForm). Descriptors are identity-bearing.
 * What calls it: ZKPassport Vault tab (ID portrait ↔ selfie ↔ avatar).
 */

import type * as FaceApi from "@vladmandic/face-api";

/** Euclidean distance at/above which two faces count as different people.
 *  face-api's FaceMatcher default is 0.6 — same threshold, shown to users. */
export const FACE_MATCH_THRESHOLD = 0.6;

const MODEL_URL = "/models";

let api: typeof FaceApi | null = null;
let modelsPromise: Promise<void> | null = null;

/** Load the three nets once (detector + landmarks + recognition). */
export function loadFaceModels(): Promise<void> {
  if (!modelsPromise) {
    modelsPromise = (async () => {
      // Dynamic import keeps tfjs (~MBs) out of the initial app bundle.
      api = await import("@vladmandic/face-api");
      await api.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await api.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await api.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    })().catch((err) => {
      modelsPromise = null; // allow retry
      throw err;
    });
  }
  return modelsPromise;
}

export class FaceMatchError extends Error {}

/** Load an image element from a File/Blob, data-URL, or remote URL. */
export function loadImageEl(
  src: string | Blob,
  opts?: { crossOrigin?: boolean }
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = typeof src === "string" ? src : URL.createObjectURL(src);
    const img = new Image();
    if (opts?.crossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => {
      if (typeof src !== "string") URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      if (typeof src !== "string") URL.revokeObjectURL(url);
      reject(new FaceMatchError("Could not load image for face matching"));
    };
    img.src = url;
  });
}

/**
 * Descriptor for the single face in an image.
 * Throws when there is no face or more than one — matching must be 1:1.
 */
export async function describeFace(
  img: HTMLImageElement | HTMLCanvasElement
): Promise<Float32Array> {
  await loadFaceModels();
  const detection = await api!
    .detectSingleFace(
      img,
      new api!.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.5 })
    )
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!detection) {
    throw new FaceMatchError("No face found — use a clear, front-facing photo");
  }
  return detection.descriptor;
}

export function euclidean(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) throw new FaceMatchError("Descriptor length mismatch");
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export interface FacePairScore {
  /** e.g. "id-selfie" */
  pair: string;
  /** Euclidean distance — LOWER means more likely the same person. */
  distance: number;
  pass: boolean;
}

export interface FaceMatchResult {
  pass: boolean;
  scores: FacePairScore[];
  threshold: number;
}

/**
 * Compare named descriptors pairwise. Every pair must come in under the
 * threshold for the overall result to pass. Distances are rounded to 3dp
 * for display — the exact value is what the user sees and what we store.
 */
export function matchDescriptors(
  named: { name: string; descriptor: Float32Array }[],
  threshold = FACE_MATCH_THRESHOLD
): FaceMatchResult {
  const scores: FacePairScore[] = [];
  for (let i = 0; i < named.length; i++) {
    for (let j = i + 1; j < named.length; j++) {
      const distance = Math.round(euclidean(named[i].descriptor, named[j].descriptor) * 1000) / 1000;
      scores.push({
        pair: `${named[i].name}-${named[j].name}`,
        distance,
        pass: distance < threshold,
      });
    }
  }
  return { pass: scores.length > 0 && scores.every((s) => s.pass), scores, threshold };
}
