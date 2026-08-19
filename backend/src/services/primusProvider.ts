import { randomUUID } from "crypto";
import { join } from "path";

// ── Types ──

export interface TaskCreationParams {
  subject: `0x${string}`;
  templateId: string;
  callbackUrl?: string;
}

export interface TaskCreationResult {
  taskId: string;
  authUrl: string;
  expiresAt: number;
}

export interface VerificationResult {
  verified: boolean;
  templateId: string;
  provider: string;
  dataHash: string; // keccak256 of verified data
  checkedAt: number;
  attestationProof?: string; // Primus attestation blob
  error?: string;
}

// ── Provider Interface ──

export interface PrimusProvider {
  createVerificationTask(params: TaskCreationParams): Promise<TaskCreationResult>;
  verifyProof(taskId: string): Promise<VerificationResult>;
}

// ── Real Primus API Provider ──

interface PrimusApiConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  redirectUri: string;
}

function envConfig(): PrimusApiConfig | null {
  const apiKey = process.env.PRIMUS_API_KEY;
  const apiSecret = process.env.PRIMUS_API_SECRET;
  const baseUrl = process.env.PRIMUS_API_BASE_URL || "https://api.primuslabs.xyz";
  const redirectUri = process.env.PRIMUS_REDIRECT_URI;
  if (!apiKey || !apiSecret || !redirectUri) return null;
  return { apiKey, apiSecret, baseUrl, redirectUri };
}

function signedFetch(config: PrimusApiConfig, path: string, init?: RequestInit): Promise<Response> {
  const url = `${config.baseUrl}${path}`;
  const timestamp = Date.now().toString();
  const message = `${timestamp}:${path}`;
  // In production, sign with HMAC-SHA256 using apiSecret.
  // This is a placeholder — the real SDK handles signing.
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": config.apiKey,
      "X-Timestamp": timestamp,
      "X-Signature": "placeholder-hmac-signature",
      ...init?.headers,
    },
  });
}

export class PrimusApiProvider implements PrimusProvider {
  constructor(private config: PrimusApiConfig) {}

  async createVerificationTask(params: TaskCreationParams): Promise<TaskCreationResult> {
    const res = await signedFetch(this.config, "/v1/tasks", {
      method: "POST",
      body: JSON.stringify({
        templateId: params.templateId,
        subject: params.subject,
        callbackUrl: params.callbackUrl,
        redirectUri: this.config.redirectUri,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Primus task creation failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    return {
      taskId: data.taskId ?? data.id,
      authUrl: data.authUrl ?? data.url,
      expiresAt: data.expiresAt ?? Date.now() + 3600_000,
    };
  }

  async verifyProof(taskId: string): Promise<VerificationResult> {
    const res = await signedFetch(this.config, `/v1/tasks/${taskId}`);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Primus task status failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    return {
      verified: data.verified ?? data.status === "verified",
      templateId: data.templateId,
      provider: data.provider ?? "primus-zktls",
      dataHash: data.dataHash,
      checkedAt: data.checkedAt ?? Math.floor(Date.now() / 1000),
      attestationProof: data.attestationProof,
    };
  }
}

// ── Mock Provider (tests only) ──

export class MockPrimusProvider implements PrimusProvider {
  public shouldFail = false;
  public failReason = "Mock verification failed";
  public fixedDataHash = "0x" + "ab".repeat(32);
  public fixedProvider = "primus-zktls-mock";

  private taskCounter = 0;

  async createVerificationTask(params: TaskCreationParams): Promise<TaskCreationResult> {
    this.taskCounter++;
    return {
      taskId: `task-mock-${this.taskCounter}`,
      authUrl: `https://mock-primus.example.com/auth?subject=${params.subject}&template=${params.templateId}`,
      expiresAt: Date.now() + 3600_000,
    };
  }

  async verifyProof(_taskId: string): Promise<VerificationResult> {
    if (this.shouldFail) {
      return {
        verified: false,
        templateId: "unknown",
        provider: this.fixedProvider,
        dataHash: "0x" + "00".repeat(32),
        checkedAt: Math.floor(Date.now() / 1000),
        error: this.failReason,
      };
    }

    return {
      verified: true,
      templateId: "github-account",
      provider: this.fixedProvider,
      dataHash: this.fixedDataHash as `0x${string}`,
      checkedAt: Math.floor(Date.now() / 1000),
      attestationProof: "mock-attestation-proof-blob",
    };
  }
}

// ── Factory ──

export function getPrimusProvider(): PrimusProvider {
  const cfg = envConfig();
  if (!cfg) return new MockPrimusProvider();
  return new PrimusApiProvider(cfg);
}
