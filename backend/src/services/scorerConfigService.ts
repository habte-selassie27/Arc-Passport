import { publicClient } from "./arcService.js";
import { ADDRESSES } from "../config/arc.js";
import { SCORER_REGISTRY_ABI } from "../abis/ScoreRegistry.js";
import { Errors } from "../utils/errors.js";

export interface ScorerConfig {
  scorerId: number;
  owner: string;
  name: string;
  threshold: number;
  active: boolean;
}

export interface ScorerWeight {
  scorerId: number;
  schemaId: string;
  weight: number;
}

export async function getScorer(scorerId: number): Promise<ScorerConfig> {
  if (!ADDRESSES.scorerRegistry) throw Errors.ScorerNotFound(scorerId);

  const [owner, name, threshold, active] = await publicClient.readContract({
    address: ADDRESSES.scorerRegistry,
    abi: SCORER_REGISTRY_ABI,
    functionName: "scorers",
    args: [scorerId],
  });

  return {
    scorerId,
    owner,
    name,
    threshold: Number(threshold),
    active,
  };
}

export async function getScorerWeight(
  scorerId: number,
  schemaId: `0x${string}`
): Promise<number> {
  if (!ADDRESSES.scorerRegistry) throw Errors.ScorerNotFound(scorerId);

  const weight = await publicClient.readContract({
    address: ADDRESSES.scorerRegistry,
    abi: SCORER_REGISTRY_ABI,
    functionName: "getWeight",
    args: [scorerId, schemaId],
  });

  return Number(weight);
}

export async function getRequiredSchemas(
  scorerId: number
): Promise<string[]> {
  if (!ADDRESSES.scorerRegistry) throw Errors.ScorerNotFound(scorerId);

  const schemas = await publicClient.readContract({
    address: ADDRESSES.scorerRegistry,
    abi: SCORER_REGISTRY_ABI,
    functionName: "getRequireAll",
    args: [scorerId],
  });

  return schemas as string[];
}

export async function getScorerCount(): Promise<number> {
  if (!ADDRESSES.scorerRegistry) return 0;

  const count = await publicClient.readContract({
    address: ADDRESSES.scorerRegistry,
    abi: SCORER_REGISTRY_ABI,
    functionName: "scorerCount",
  });

  return Number(count);
}

export async function listScorers(): Promise<ScorerConfig[]> {
  const count = await getScorerCount();
  const scorers: ScorerConfig[] = [];

  for (let i = 0; i <= count; i++) {
    try {
      const scorer = await getScorer(i);
      if (scorer.owner !== "0x0000000000000000000000000000000000000000") {
        scorers.push(scorer);
      }
    } catch {
      // Skip scorers that fail to read
    }
  }

  return scorers;
}
