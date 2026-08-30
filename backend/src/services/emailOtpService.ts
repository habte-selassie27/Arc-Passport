import { randomUUID, randomInt } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { keccak256, encodePacked } from "viem";
import { publicClient } from "./arcService.js";
import { ATTESTATION_REGISTRY_ABI } from "../abis/AttestationRegistry.js";
import { executeContractCall } from "./circleService.js";
import { ArcPassError, Errors } from "../utils/errors.js";
import { SOCIAL_SCHEMAS } from "../constants/schemas.js";

// ── Constants ──

const OTP_LENGTH = 6;
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const VERIFICATION_TTL_SECONDS = 365 * 24 * 60 * 60; // 1 year
const STORE_PATH = join(process.cwd(), ".email-otp-verifications.jsonl");

// ── Types ──

export interface EmailOtpSession {
  verificationId: string;
  subject: `0x${string}`;
  email: string;
  otpHash: string;
  state: "pending" | "verified" | "attesting" | "complete" | "failed" | "expired";
  templateId: string;
  claimId?: string;
  txHash?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

// ── Persistence ──

function readAll(): EmailOtpSession[] {
  try {
    if (!existsSync(STORE_PATH)) return [];
    return readFileSync(STORE_PATH, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

function writeAll(records: EmailOtpSession[]): void {
  try {
    writeFileSync(STORE_PATH, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
  } catch { /* advisory */ }
}

function upsert(record: EmailOtpSession): void {
  const all = readAll();
  const idx = all.findIndex((r) => r.verificationId === record.verificationId);
  if (idx >= 0) all[idx] = record;
  else all.push(record);
  writeAll(all);
}

// ── OTP helpers ──

function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

function hashOtp(otp: string): string {
  return keccak256(encodePacked(["string"], [otp]));
}

// ── Email sending via Resend API (HTTP — works on Render) ──

const RESEND_API = "https://api.resend.com";

async function sendOtpEmail(email: string, otp: string, templateName: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Dev mode: log OTP to console
    console.log(`[email-otp] Dev mode — OTP for ${email}: ${otp} (template: ${templateName})`);
    return;
  }

  const from = process.env.SMTP_FROM || "ArcPass <onboarding@resend.dev>";
  const html = `
    <div style="font-family: monospace; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #00E5A0;">ArcPass Verification</h2>
      <p>Your verification code for <strong>${templateName}</strong> is:</p>
      <div style="font-size: 32px; letter-spacing: 8px; font-weight: bold; padding: 16px; background: #141b2d; color: #00E5A0; border-radius: 8px; text-align: center; margin: 16px 0;">${otp}</div>
      <p style="color: #888; font-size: 12px;">This code expires in 10 minutes. If you did not request this, ignore this email.</p>
    </div>
  `;

  const res = await fetch(`${RESEND_API}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `ArcPass Verification Code: ${otp}`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Email send failed (${res.status}): ${body}`);
  }
}

// ── On-chain helpers ──

async function isClaimValidOnChain(claimId: string): Promise<boolean> {
  if (!process.env.ATTESTATION_REGISTRY_ADDRESS) return false;
  try {
    return (await publicClient.readContract({
      address: process.env.ATTESTATION_REGISTRY_ADDRESS as `0x${string}`,
      abi: ATTESTATION_REGISTRY_ABI,
      functionName: "isValid",
      args: [claimId as `0x${string}`],
    })) as boolean;
  } catch {
    return false;
  }
}

// ── Public API ──

const TEMPLATE_NAMES: Record<string, string> = {
  "email-ownership": "Email Ownership",
  "github-account": "GitHub Account",
  "twitter-account": "X / Twitter Account",
  "discord-account": "Discord Account",
  "cex-balance": "CEX Balance",
};

export async function startEmailOtp(
  subject: `0x${string}`,
  email: string,
  templateId: string
): Promise<{ verificationId: string }> {
  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ArcPassError("INVALID_EMAIL", "Invalid email address format", 400);
  }

  const verificationId = randomUUID();
  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const templateName = TEMPLATE_NAMES[templateId] ?? templateId;

  const record: EmailOtpSession = {
    verificationId,
    subject,
    email: email.toLowerCase(),
    otpHash,
    state: "pending",
    templateId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    expiresAt: Date.now() + OTP_TTL_MS,
  };
  upsert(record);

  await sendOtpEmail(email, otp, templateName);

  console.log(`[email-otp] Sent OTP to ${email} for ${templateId} (id: ${verificationId})`);

  return { verificationId };
}

export async function verifyEmailOtp(
  verificationId: string,
  subject: `0x${string}`,
  code: string
): Promise<EmailOtpSession> {
  const record = readAll().find((r) => r.verificationId === verificationId);
  if (!record) throw Errors.VerificationNotFound(verificationId);
  if (record.subject.toLowerCase() !== subject.toLowerCase()) {
    throw Errors.VerificationMismatch();
  }
  if (record.state === "complete") return record;

  // Check expiry
  if (Date.now() > record.expiresAt) {
    record.state = "expired";
    record.updatedAt = Date.now();
    upsert(record);
    throw Errors.VerificationExpired();
  }

  // Verify OTP
  const codeHash = hashOtp(code.trim());
  if (codeHash !== record.otpHash) {
    record.error = "Invalid verification code";
    record.updatedAt = Date.now();
    upsert(record);
    throw new ArcPassError("INVALID_OTP", "Invalid verification code. Check your email and try again.", 400);
  }

  // Mark verified
  record.state = "verified";
  record.updatedAt = Date.now();
  upsert(record);

  // Issue on-chain attestation
  const walletId = process.env.CIRCLE_WEB2_PROOF_ISSUER_WALLET_ID;
  if (!walletId) {
    throw Errors.IssuerNotConfigured("web2-proof", "CIRCLE_WEB2_PROOF_ISSUER_WALLET_ID");
  }
  if (!process.env.ATTESTATION_REGISTRY_ADDRESS) {
    throw Errors.IssuerNotConfigured("web2-proof", "ATTESTATION_REGISTRY_ADDRESS");
  }

  const checkedAt = Math.floor(Date.now() / 1000);
  const expiresAt = checkedAt + VERIFICATION_TTL_SECONDS;
  const dataCommitment = keccak256(
    encodePacked(
      ["address", "bytes32", "string", "string", "uint64"],
      [subject, codeHash as `0x${string}`, "email-otp", record.templateId, BigInt(checkedAt)]
    )
  );

  record.state = "attesting";
  record.updatedAt = Date.now();
  upsert(record);

  try {
    const txHash = await executeContractCall(
      walletId,
      process.env.ATTESTATION_REGISTRY_ADDRESS as `0x${string}`,
      "attest(address,bytes32,bytes32,uint256)",
      [subject, SOCIAL_SCHEMAS.WEB2_DATA_PROOF.id!, dataCommitment, expiresAt.toString()]
    );
    record.txHash = txHash;
  } catch (err) {
    record.state = "failed";
    record.error = (err as Error).message;
    record.updatedAt = Date.now();
    upsert(record);
    throw Errors.AttestationFailed((err as Error).message);
  }

  record.state = "complete";
  record.updatedAt = Date.now();
  upsert(record);

  return record;
}

export async function getEmailOtpStatus(
  verificationId: string
): Promise<EmailOtpSession | undefined> {
  return readAll().find((r) => r.verificationId === verificationId);
}


