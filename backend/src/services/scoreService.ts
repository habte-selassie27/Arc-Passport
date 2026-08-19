import { publicClient } from "./arcService.js";
import { ADDRESSES } from "../config/arc.js";
import { SCORE_REGISTRY_ABI } from "../abis/ScoreRegistry.js";
import { executeContractCall } from "./circleService.js";
import { Errors } from "../utils/errors.js";

const SCORE_WRITER_WALLET_ID = process.env.CIRCLE_SCORE_WRITER_WALLET_ID;

export interface ScoreResult {
  score: number;
  isValid: boolean;
  isHuman: boolean;
}

export interface ScoreDetail {
  subject: string;
  scorerId: number;
  score: number;
  dataCommitment: string;
  computedAt: number;
  expiresAt: number;
  exists: boolean;
}

export async function getScore(
  subject: `0x${string}`,
  scorerId: number
): Promise<ScoreResult> {
  if (!ADDRESSES.scoreRegistry) throw Errors.ScoreNotConfigured();

  const [score, isValid, isHuman] = await publicClient.readContract({
    address: ADDRESSES.scoreRegistry,
    abi: SCORE_REGISTRY_ABI,
    functionName: "getScore",
    args: [subject, scorerId],
  });

  return {
    score: Number(score),
    isValid,
    isHuman,
  };
}

export async function getScoreRaw(
  subject: `0x${string}`,
  scorerId: number
): Promise<ScoreDetail> {
  if (!ADDRESSES.scoreRegistry) throw Errors.ScoreNotConfigured();

  const result = await publicClient.readContract({
    address: ADDRESSES.scoreRegistry,
    abi: SCORE_REGISTRY_ABI,
    functionName: "scores",
    args: [subject, scorerId],
  });

  return {
    subject,
    scorerId,
    score: Number(result[0]),
    dataCommitment: result[1],
    computedAt: Number(result[2]),
    expiresAt: Number(result[3]),
    exists: result[4],
  };
}

export async function isHuman(subject: `0x${string}`): Promise<boolean> {
  if (!ADDRESSES.scoreRegistry) throw Errors.ScoreNotConfigured();

  return publicClient.readContract({
    address: ADDRESSES.scoreRegistry,
    abi: SCORE_REGISTRY_ABI,
    functionName: "isHuman",
    args: [subject],
  });
}

export async function getHumanityThreshold(): Promise<number> {
  if (!ADDRESSES.scoreRegistry) throw Errors.ScoreNotConfigured();

  const threshold = await publicClient.readContract({
    address: ADDRESSES.scoreRegistry,
    abi: SCORE_REGISTRY_ABI,
    functionName: "humanityThreshold",
  });

  return Number(threshold);
}

export async function commitScore(
  subject: `0x${string}`,
  scorerId: number,
  score: number,
  expiresAt: number,
  dataCommitment: string
): Promise<string> {
  if (!ADDRESSES.scoreRegistry) throw Errors.ScoreNotConfigured();
  if (!SCORE_WRITER_WALLET_ID) throw Errors.IssuerNotConfigured("score", "CIRCLE_SCORE_WRITER_WALLET_ID");

  const txHash = await executeContractCall(
    SCORE_WRITER_WALLET_ID,
    ADDRESSES.scoreRegistry,
    "commitScore(address,uint16,uint16,uint64,bytes32)",
    [
      subject,
      scorerId.toString(),
      score.toString(),
      expiresAt.toString(),
      dataCommitment,
    ]
  );

  return txHash;
}
