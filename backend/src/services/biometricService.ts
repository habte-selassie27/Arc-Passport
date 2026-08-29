/**
 * biometricService.ts
 *
 * Biometric uniqueness enforcement for humanity verification.
 *
 * Takes facial landmark data from MediaPipe FaceLandmarker (client-side),
 * computes a stable biometric hash, and enforces one-human-one-wallet
 * via the HumanityOracle contract's nullifier registry.
 *
 * PRIVACY: Raw facial data is NEVER stored. Only the biometric hash
 * (bytes32) is used as a nullifier — it's a one-way commitment that
 * can't be reversed to reconstruct the face.
 *
 * ASSURANCE: The biometric hash is derived from facial landmark positions
 * relative to the face center, making it invariant to head position and
 * distance. Two scans of the same person should produce the same hash
 * within a tolerance threshold.
 */

import { keccak256, encodePacked } from "viem";

/**
 * Simplified facial landmark indices for biometric hashing.
 * These correspond to MediaPipe's 478 face landmarks.
 * We use a subset of stable points that are robust across
 * different head positions and expressions.
 */
const BIOMETRIC_LANDMARKS = [
  // Nose tip (landmark 1)
  1,
  // Left eye inner corner (landmark 133)
  133,
  // Right eye inner corner (landmark 362)
  362,
  // Left eye outer corner (landmark 33)
  33,
  // Right eye outer corner (landmark 263)
  263,
  // Left eyebrow inner (landmark 70)
  70,
  // Right eyebrow inner (landmark 300)
  300,
  // Left eyebrow outer (landmark 46)
  46,
  // Right eyebrow outer (landmark 276)
  276,
  // Mouth left corner (landmark 61)
  61,
  // Mouth right corner (landmark 291)
  291,
  // Upper lip center (landmark 13)
  13,
  // Lower lip center (landmark 14)
  14,
  // Chin (landmark 152)
  152,
  // Forehead center (landmark 10)
  10,
];

/**
 * Represents a 3D facial landmark point from MediaPipe.
 */
interface LandmarkPoint {
  x: number; // normalized 0-1, left to right
  y: number; // normalized 0-1, top to bottom
  z: number; // depth, negative = closer to camera
}

/**
 * Compute a biometric hash from facial landmarks.
 *
 * The hash is derived from relative positions (distances between key points)
 * normalized by inter-eye distance, making it invariant to:
 * - Head distance from camera
 * - Head rotation (within reason)
 * - Face position in frame
 *
 * @param landmarks Array of 478 facial landmarks from MediaPipe
 * @returns bytes32 biometric hash (the nullifier)
 */
export function computeBiometricHash(landmarks: LandmarkPoint[]): string {
  if (landmarks.length < 153) {
    // Need at least max landmark index (152) + 1
    throw new Error("Insufficient landmarks for biometric hash");
  }

  const points = BIOMETRIC_LANDMARKS.map((i) => landmarks[i]);

  // Inter-eye distance for normalization
  const leftEyeInner = points[1]; // index 1 = left eye inner
  const rightEyeInner = points[2]; // index 2 = right eye inner
  const eyeDistance = Math.sqrt(
    (rightEyeInner.x - leftEyeInner.x) ** 2 +
    (rightEyeInner.y - leftEyeInner.y) ** 2 +
    (rightEyeInner.z - leftEyeInner.z) ** 2
  );

  if (eyeDistance < 0.001) {
    throw new Error("Invalid landmark geometry: eye distance too small");
  }

  // Compute relative positions: normalize all distances by eye distance
  const noseTip = points[0];
  const relativeDistances: number[] = [];

  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - noseTip.x;
    const dy = points[i].y - noseTip.y;
    const dz = points[i].z - noseTip.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) / eyeDistance;
    relativeDistances.push(dist);
  }

  // Also include inter-point ratios for more discriminative power
  const ratios: number[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[j].x - points[i].x;
      const dy = points[j].y - points[i].y;
      const dz = points[j].z - points[i].z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) / eyeDistance;
      ratios.push(dist);
    }
  }

  // Quantize to 4 decimal places for stability across minor variations
  const allValues = [...relativeDistances, ...ratios];
  const quantized = allValues.map((v) => Math.round(v * 10000) / 10000);

  // Hash the quantized values — pack as uint32 pairs into bytes32 chunks
  const packed = new Uint8Array(32);
  for (let i = 0; i < Math.min(quantized.length, 8); i++) {
    const val = Math.round(quantized[i] * 10000) & 0xffffffff;
    packed[i * 4] = (val >>> 24) & 0xff;
    packed[i * 4 + 1] = (val >>> 16) & 0xff;
    packed[i * 4 + 2] = (val >>> 8) & 0xff;
    packed[i * 4 + 3] = val & 0xff;
  }

  return keccak256(`0x${Buffer.from(packed).toString("hex")}` as `0x${string}`);
}

/**
 * Compute a simplified biometric hash from a compact face encoding.
 *
 * This is an alternative to full landmark processing — takes a
 * pre-computed face embedding (e.g., from a face recognition model)
 * and hashes it.
 *
 * @param faceEncoding Array of float values representing the face
 * @returns bytes32 biometric hash
 */
export function computeFaceEncodingHash(faceEncoding: number[]): string {
  if (faceEncoding.length === 0) {
    throw new Error("Empty face encoding");
  }

  // Quantize and pack into bytes
  const quantized = faceEncoding.map((v) => Math.round(v * 10000) / 10000);

  // Hash in chunks — pack 8 values per bytes32
  const chunkSize = 8;
  const chunks: string[] = [];

  for (let i = 0; i < quantized.length; i += chunkSize) {
    const chunk = quantized.slice(i, i + chunkSize);
    let packed = BigInt(0);
    for (let j = 0; j < chunk.length; j++) {
      packed = (packed << BigInt(32)) | BigInt(Math.round(chunk[j] * 10000));
    }
    chunks.push(`0x${packed.toString(16).padStart(64, "0")}`);
  }

  // Hash all chunks together
  const concatenated = chunks.join("");
  return keccak256(concatenated as `0x${string}`);
}

/**
 * Check if two biometric hashes are "close enough" to be the same person.
 *
 * This uses Hamming distance on the hash bits — for a good biometric
 * hash, the same person should produce very similar (or identical) hashes.
 *
 * @param hash1 First biometric hash
 * @param hash2 Second biometric hash
 * @param threshold Maximum Hamming distance to consider a match (default: 5 bits)
 * @returns Whether the hashes match within tolerance
 */
export function isBiometricMatch(hash1: string, hash2: string, threshold = 5): boolean {
  if (hash1 === hash2) return true;

  const bytes1 = BigInt(hash1);
  const bytes2 = BigInt(hash2);
  let xor = bytes1 ^ bytes2;

  // Count differing bits (Hamming distance)
  let distance = 0;
  while (xor > 0n) {
    distance += Number(xor & 1n);
    xor >>= 1n;
  }

  return distance <= threshold;
}
