/**
 * livenessService.ts
 *
 * Custom webcam-liveness humanity verification (no third-party provider).
 *
 * Flow:
 * 1. POST /liveness/challenge → server issues a random action sequence
 *    ("blink" / "turn_left" / "turn_right") bound to the wallet, TTL-bounded.
 * 2. Client performs the sequence on camera; MediaPipe FaceLandmarker runs
 *    client-side to enforce it; keyframes are captured as evidence.
 * 3. POST /liveness/verify → server validates the challenge (exists, fresh,
 *    correct sequence), then issues the shared HUMANITY_PROOF attestation.
 *
 * ASSURANCE LEVEL (honest): moderate. The server validates structure and
 * freshness, not pixels — a determined attacker could replay synthetic frames.
 * Cross-wallet uniqueness comes from one-active-claim-per-subject in the
 * registry, not biometric dedup. Stronger providers (World ID) remain available.
 *
 * PRIVACY: camera frames are processed in-memory only and never persisted.
 * Records keep a keccak commitment of the evidence bundle + metadata.
 */
import { randomUUID } from "crypto";
import { existsSync, readFileSync, appendFileSync } from "fs";
import { join } from "path";
import { keccak256, encodePacked } from "viem";
import { ArcPassError, Errors } from "../utils/errors.js";
import {
  isClaimValidOnChain,
  claimExpiryOnChain,
  issueHumanityAttestation,
} from "./humanityShared.js";

const STORE_PATH = join(process.cwd(), ".liveness-verifications.jsonl");

const CHALLENGE_TTL_MS = 3 * 60 * 1000;
const MAX_FRAME_BYTES = 400 * 1024; // per-frame cap (~540p JPEG)
const MIN_FRAMES = 2;

type LivenessAction = "blink" | "turn_left" | "turn_right";

interface LivenessChallenge {
  id: string;
  subject: string;
  steps: LivenessAction[];
  createdAt: number;
  expiresAt: number;
}

// In-memory challenge store — ephemeral by design (resets on restart).
const CHALLENGES = new Map<string, LivenessChallenge>();

function pruneChallenges(): void {
  const now = Date.now();
  for (const [id, c] of CHALLENGES) {
    if (now > c.expiresAt || CHALLENGES.size > 10_000) CHALLENGES.delete(id);
  }
}

export interface LivenessChallengeResult {
  challengeId: string;
  steps: LivenessAction[];
  expiresAt: number;
}

/** Issue a fresh random liveness challenge bound to the authenticated wallet. */
export function createLivenessChallenge(subject: `0x${string}`): LivenessChallengeResult {
  pruneChallenges();

  // Random 3–4 step sequence with no immediate repeats.
  const pool: LivenessAction[] = ["blink", "turn_left", "turn_right"];
  const len = 3;
  const steps: LivenessAction[] = [];
  while (steps.length < len) {
    const next = pool[Math.floor(Math.random() * pool.length)];
    if (steps.length === 0 || steps[steps.length - 1] !== next) steps.push(next);
  }

  const challenge: LivenessChallenge = {
    id: randomUUID(),
    subject: subject.toLowerCase(),
    steps,
    createdAt: Date.now(),
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  };
  CHALLENGES.set(challenge.id, challenge);

  return {
    challengeId: challenge.id,
    steps: challenge.steps,
    expiresAt: challenge.expiresAt,
  };
}

// ── Verification record persistence (advisory JSONL) ──

interface LivenessRecord {
  challengeId: string;
  subject: string;
  mechanism: "liveness-web";
  evidenceCommitment: string; // keccak256 over frame bytes — no raw PII
  claimId?: string;
  txHash?: string;
  verifiedAt: number;
}

function readRecords(): LivenessRecord[] {
  if (!existsSync(STORE_PATH)) return [];
  try {
    return readFileSync(STORE_PATH, "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

function appendRecord(record: LivenessRecord): void {
  try {
    appendFileSync(STORE_PATH, JSON.stringify(record) + "\n");
  } catch {
    /* advisory */
  }
}

function findRecordBySubject(subject: string): LivenessRecord | undefined {
  const lower = subject.toLowerCase();
  return readRecords()
    .filter((r) => r.subject.toLowerCase() === lower)
    .sort((a, b) => b.verifiedAt - a.verifiedAt)[0];
}

// ── Public status ──

export interface LivenessStatus {
  subject: string;
  verified: boolean;
  onChain: boolean;
  mechanism?: string;
  claimId?: string;
  checkedAt?: number;
  expiresAt?: number;
}

export async function getLivenessStatus(address: `0x${string}`): Promise<LivenessStatus> {
  const record = findRecordBySubject(address);
  if (!record || !record.claimId) {
    return { subject: address, verified: false, onChain: false };
  }
  const onChain = await isClaimValidOnChain(record.claimId);
  const expiresAt = await claimExpiryOnChain(record.claimId);
  return {
    subject: address,
    verified: onChain,
    onChain,
    mechanism: record.mechanism,
    claimId: record.claimId,
    checkedAt: record.verifiedAt,
    expiresAt,
  };
}

// ── Verify & attest ──

export interface VerifyLivenessArgs {
  challengeId: string;
  /** The action steps performed, in order — must match the issued challenge. */
  steps: string[];
  /** Evidence frames (data URLs, JPEG). Processed in memory, never stored. */
  frames: string[];
}

export async function verifyAndAttestLiveness(
  subject: `0x${string}`,
  args: VerifyLivenessArgs
): Promise<{ claimId?: string; txHash?: string }> {
  const challenge = CHALLENGES.get(args.challengeId);
  if (!challenge) throw Errors.VerificationNotFound(args.challengeId);
  if (challenge.subject !== subject.toLowerCase()) throw Errors.VerificationMismatch();
  if (Date.now() > challenge.expiresAt) {
    CHALLENGES.delete(args.challengeId);
    throw Errors.VerificationExpired();
  }
  if (!Array.isArray(args.steps) || args.steps.join(",") !== challenge.steps.join(",")) {
    throw new ArcPassError("CHALLENGE_MISMATCH", "Liveness steps do not match the issued challenge", 400);
  }

  // Validate evidence frames structurally. Images stay in memory only.
  if (!Array.isArray(args.frames) || args.frames.length < MIN_FRAMES) {
    throw new ArcPassError("INVALID_EVIDENCE", `At least ${MIN_FRAMES} frames required`, 400);
  }
  let evidenceBytes = Buffer.alloc(0);
  for (const f of args.frames.slice(0, 12)) {
    const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(f ?? "");
    if (!m) throw new ArcPassError("INVALID_EVIDENCE", "Frames must be base64 JPEG data URLs", 400);
    const buf = Buffer.from(m[1], "base64");
    if (buf.length > MAX_FRAME_BYTES) {
      throw new ArcPassError("INVALID_EVIDENCE", "Frame too large", 400);
    }
    evidenceBytes = Buffer.concat([evidenceBytes, buf]);
  }

  // Single-use: consume the challenge before issuing.
  CHALLENGES.delete(args.challengeId);

  // Advisory dedup anchor scoped to this verification attempt.
  const nullifier32 = keccak256(
    encodePacked(["address", "string"], [subject, args.challengeId])
  );

  const { claimId, txHash } = await issueHumanityAttestation({
    subject,
    mechanism: "liveness-web",
    nullifier32,
  });

  appendRecord({
    challengeId: args.challengeId,
    subject,
    mechanism: "liveness-web",
    evidenceCommitment: keccak256(evidenceBytes),
    claimId,
    txHash,
    verifiedAt: Date.now(),
  });

  return { claimId, txHash };
}
