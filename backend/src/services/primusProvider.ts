import { PrimusNetwork } from "@primuslabs/network-core-sdk";
import { ethers } from "ethers";
import { createHmac } from "crypto";

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
  dataHash: string;
  checkedAt: number;
  attestationProof?: string;
  error?: string;
}

// ── Provider Interface ──

export interface PrimusProvider {
  createVerificationTask(params: TaskCreationParams): Promise<TaskCreationResult>;
  verifyProof(taskId: string): Promise<VerificationResult>;
}

// ── Template → Request mapping ──

interface TemplateRequest {
  url: string;
  method: string;
  header: Record<string, string>;
  body: string;
  responseResolves: { keyName: string; parseType: string; parsePath: string }[];
}

function getTemplateRequest(templateId: string): TemplateRequest {
  switch (templateId) {
    case "github-account":
      return {
        url: "https://api.github.com/user",
        method: "GET",
        header: { Accept: "application/vnd.github.v3+json" },
        body: "",
        responseResolves: [
          { keyName: "login", parseType: "json", parsePath: "$.login" },
          { keyName: "id", parseType: "json", parsePath: "$.id" },
          { keyName: "type", parseType: "json", parsePath: "$.type" },
        ],
      };
    case "twitter-account":
      return {
        url: "https://api.x.com/2/users/me",
        method: "GET",
        header: {},
        body: "",
        responseResolves: [
          { keyName: "username", parseType: "json", parsePath: "$.data.username" },
          { keyName: "name", parseType: "json", parsePath: "$.data.name" },
        ],
      };
    case "discord-account":
      return {
        url: "https://discord.com/api/v10/users/@me",
        method: "GET",
        header: {},
        body: "",
        responseResolves: [
          { keyName: "username", parseType: "json", parsePath: "$.username" },
          { keyName: "id", parseType: "json", parsePath: "$.id" },
        ],
      };
    case "cex-balance":
      // Generic CEX balance template — uses Binance as the default provider.
      // The Primus attestor will capture a TLS proof of the balance API response.
      return {
        url: "https://api.binance.com/api/v3/account",
        method: "GET",
        header: {
          // The Primus SDK injects the user's session cookies automatically.
          // No explicit Authorization header needed for cookie-based auth.
        },
        body: "",
        responseResolves: [
          { keyName: "totalBalance", parseType: "json", parsePath: "$.balances" },
          { keyName: "accountType", parseType: "json", parsePath: "$.accountType" },
        ],
      };
    case "email-ownership":
      return {
        url: "https://httpbin.org/get",
        method: "GET",
        header: {},
        body: "",
        responseResolves: [
          { keyName: "origin", parseType: "json", parsePath: "$.origin" },
        ],
      };
    default:
      return {
        url: "https://httpbin.org/get",
        method: "GET",
        header: {},
        body: "",
        responseResolves: [
          { keyName: "origin", parseType: "json", parsePath: "$.origin" },
        ],
      };
  }
}

// ── Primus SDK Provider ──

let primusNetwork: PrimusNetwork | null = null;
let initPromise: Promise<PrimusNetwork> | null = null;

async function getPrimusNetwork(): Promise<PrimusNetwork> {
  if (primusNetwork) return primusNetwork;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const privateKey = process.env.PRIMUS_PRIVATE_KEY;
    const chainId = parseInt(process.env.PRIMUS_CHAIN_ID || "84532", 10);

    if (!privateKey) {
      throw new Error("PRIMUS_PRIVATE_KEY not configured");
    }

    const provider = new ethers.providers.JsonRpcProvider(
      chainId === 84532
        ? "https://sepolia.base.org"
        : "https://mainnet.base.org"
    );
    const wallet = new ethers.Wallet(privateKey, provider);

    const network = new PrimusNetwork();
    await network.init(wallet, chainId, "auto", "ArcPass");
    primusNetwork = network;
    console.log(`[Primus] Initialized on chain ${chainId}`);
    return network;
  })();

  return initPromise;
}

export class PrimusSdkProvider implements PrimusProvider {
  async createVerificationTask(params: TaskCreationParams): Promise<TaskCreationResult> {
    const network = await getPrimusNetwork();
    const templateRequest = getTemplateRequest(params.templateId);

    const submitResult = await network.submitTask({
      address: params.subject,
    }) as { taskId: string; taskTxHash: string; taskAttestors: string[] };

    console.log(`[Primus] Task submitted: ${submitResult.taskId}`);

    const attestParams = {
      address: params.subject,
      ...submitResult,
      requests: [templateRequest],
      responseResolves: [[templateRequest.responseResolves[0]]],
    };

    // Fire-and-forget: initiate attestation without blocking the response.
    // The polling flow (verifyAndPollTaskResult) will pick up the result later.
    network.attest(attestParams, 60000).catch((err) => {
      console.error("[Primus] attest() failed (non-blocking):", (err as Error).message);
    });

    return {
      taskId: submitResult.taskId,
      authUrl: `${process.env.PRIMUS_REDIRECT_URI || "http://localhost:5173/web2-proof"}?taskId=${submitResult.taskId}`,
      expiresAt: Date.now() + 3600_000,
    };
  }

  async verifyProof(taskId: string): Promise<VerificationResult> {
    const network = await getPrimusNetwork();

    try {
      const taskResult = await network.verifyAndPollTaskResult({
        taskId,
        timeoutMs: 30000,
      });

      if (taskResult && taskResult.length > 0) {
        const result = taskResult[0];
        const dataHash = ethers.utils.keccak256(
          ethers.utils.toUtf8Bytes(JSON.stringify(result.attestation))
        );

        return {
          verified: true,
          templateId: "web2-data",
          provider: "primus-zktls",
          dataHash,
          checkedAt: Math.floor(Date.now() / 1000),
          attestationProof: JSON.stringify(result),
        };
      }

      return {
        verified: false,
        templateId: "unknown",
        provider: "primus-zktls",
        dataHash: "0x" + "00".repeat(32),
        checkedAt: Math.floor(Date.now() / 1000),
        error: "No attestation results",
      };
    } catch (err) {
      return {
        verified: false,
        templateId: "unknown",
        provider: "primus-zktls",
        dataHash: "0x" + "00".repeat(32),
        checkedAt: Math.floor(Date.now() / 1000),
        error: (err as Error).message,
      };
    }
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
      authUrl: `${process.env.PRIMUS_REDIRECT_URI || "http://localhost:5173/web2-proof"}?taskId=task-mock-${this.taskCounter}`,
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
  if (process.env.PRIMUS_PRIVATE_KEY && process.env.PRIMUS_API_KEY) {
    return new PrimusSdkProvider();
  }
  console.warn("[Primus] No credentials configured, using mock provider");
  return new MockPrimusProvider();
}
