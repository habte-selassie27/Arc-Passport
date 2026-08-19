import { Router } from "express";
import { getScore, getScoreRaw, isHuman, getHumanityThreshold, commitScore } from "../services/scoreService.js";
import { getScorer, listScorers, getScorerCount } from "../services/scorerConfigService.js";
import { requireSignedNonce } from "../middleware/auth.js";
import { ArcPassError, Errors } from "../utils/errors.js";
import { existsSync, appendFileSync, readFileSync } from "fs";
import { join } from "path";

const router = Router();

const SCORE_HISTORY_PATH = join(process.cwd(), ".score-history.jsonl");

function isValidAddress(addr: string): addr is `0x${string}` {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

function handleError(res: any, err: unknown) {
  if (err instanceof ArcPassError) {
    res.status(err.status).json({ success: false, error: { code: err.code, message: err.message } });
  } else {
    const e = err as Error;
    res.status(500).json({ success: false, error: { code: "SCORE_ERROR", message: e.message } });
  }
}

// ── Score history helpers ──

interface ScoreHistoryEntry {
  subject: string;
  scorerId: number;
  score: number;
  computedAt: number;
  expiresAt: number;
  source: "api" | "chain";
}

function appendScoreHistory(entry: ScoreHistoryEntry): void {
  try {
    appendFileSync(SCORE_HISTORY_PATH, JSON.stringify(entry) + "\n");
  } catch {
    // Advisory — don't crash if write fails
  }
}

function readScoreHistory(): ScoreHistoryEntry[] {
  if (!existsSync(SCORE_HISTORY_PATH)) return [];
  try {
    const raw = readFileSync(SCORE_HISTORY_PATH, "utf-8");
    return raw.split("\n").filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

// ── Public read endpoints (no auth) ──

router.get("/threshold", async (_req, res) => {
  try {
    const threshold = await getHumanityThreshold();
    res.json({ success: true, data: { threshold } });
  } catch (err) {
    handleError(res, err);
  }
});

router.get("/scorers", async (_req, res) => {
  try {
    const scorers = await listScorers();
    const count = await getScorerCount();
    res.json({ success: true, data: { count, scorers } });
  } catch (err) {
    handleError(res, err);
  }
});

router.get("/scorers/:scorerId", async (req, res) => {
  try {
    const scorerId = parseInt(req.params.scorerId, 10);
    if (isNaN(scorerId) || scorerId < 0) {
      throw Errors.InvalidBatchSize(scorerId);
    }
    const scorer = await getScorer(scorerId);
    if (scorer.owner === "0x0000000000000000000000000000000000000000") {
      throw Errors.ScorerNotFound(scorerId);
    }
    res.json({ success: true, data: scorer });
  } catch (err) {
    handleError(res, err);
  }
});

router.get("/human/:address", async (req, res) => {
  try {
    const address = req.params.address as `0x${string}`;
    if (!isValidAddress(address)) {
      throw Errors.InvalidSubject(address);
    }
    const human = await isHuman(address);
    res.json({ success: true, data: { address, isHuman: human } });
  } catch (err) {
    handleError(res, err);
  }
});

// ── Lightweight boolean checks (public, no auth) ──

/**
 * GET /score/:address/passes/:scorerId
 * Lightweight boolean pass/fail for access-gating checks.
 * Partner dApps poll this for gate checks.
 */
router.get("/:address/passes/:scorerId", async (req, res) => {
  try {
    const address = req.params.address as `0x${string}`;
    const scorerId = parseInt(req.params.scorerId, 10);
    if (!isValidAddress(address)) throw Errors.InvalidSubject(address);
    if (isNaN(scorerId) || scorerId < 0) throw Errors.InvalidBatchSize(scorerId);

    if (scorerId === 0) {
      const human = await isHuman(address);
      const score = await getScore(address, 0);
      res.json({
        success: true,
        data: {
          subject: address,
          scorerId: 0,
          passes: human,
          score: score.score,
          threshold: await getHumanityThreshold(),
          computedAt: Date.now(),
        },
      });
    } else {
      // Custom scorer: check if score exists and passes
      try {
        const score = await getScore(address, scorerId);
        const scorer = await getScorer(scorerId);
        const passes = score.isValid && score.score >= scorer.threshold;
        res.json({
          success: true,
          data: {
            subject: address,
            scorerId,
            passes,
            score: score.score,
            threshold: scorer.threshold,
            computedAt: Date.now(),
          },
        });
      } catch {
        res.json({
          success: true,
          data: {
            subject: address,
            scorerId,
            passes: false,
            score: 0,
            threshold: 0,
            computedAt: Date.now(),
          },
        });
      }
    }
  } catch (err) {
    handleError(res, err);
  }
});

/**
 * GET /score/:address/isHuman
 * Shorthand for scorerId=0 passes check.
 */
router.get("/:address/isHuman", async (req, res) => {
  try {
    const address = req.params.address as `0x${string}`;
    if (!isValidAddress(address)) throw Errors.InvalidSubject(address);

    const human = await isHuman(address);
    const score = await getScore(address, 0);
    res.json({
      success: true,
      data: {
        subject: address,
        isHuman: human,
        score: score.score,
        threshold: await getHumanityThreshold(),
      },
    });
  } catch (err) {
    handleError(res, err);
  }
});

/**
 * GET /score/:address/history
 * Returns historical score snapshots.
 */
router.get("/:address/history", async (req, res) => {
  try {
    const address = req.params.address as `0x${string}`;
    if (!isValidAddress(address)) throw Errors.InvalidSubject(address);

    const limit = Math.min(parseInt(req.query.limit as string || "20", 10), 100);
    const since = parseInt(req.query.since as string || "0", 10);
    const scorerId = parseInt(req.query.scorerId as string || "-1", 10);

    const history = readScoreHistory()
      .filter((e) => e.subject.toLowerCase() === address.toLowerCase())
      .filter((e) => scorerId === -1 || e.scorerId === scorerId)
      .filter((e) => since === 0 || e.computedAt >= since)
      .sort((a, b) => b.computedAt - a.computedAt)
      .slice(0, limit);

    res.json({ success: true, data: history });
  } catch (err) {
    handleError(res, err);
  }
});

/**
 * GET /score/distribution
 * Score distribution stats for analytics.
 */
router.get("/distribution", async (_req, res) => {
  try {
    const history = readScoreHistory();
    // Deduplicate: keep only the latest score per subject per scorerId
    const latest = new Map<string, ScoreHistoryEntry>();
    for (const entry of history) {
      const key = `${entry.subject}:${entry.scorerId}`;
      if (!latest.has(key) || entry.computedAt > latest.get(key)!.computedAt) {
        latest.set(key, entry);
      }
    }

    const scores = Array.from(latest.values());
    if (scores.length === 0) {
      res.json({
        success: true,
        data: { count: 0, histogram: [], avg: 0, median: 0, humanRate: 0 },
      });
      return;
    }

    // Build histogram buckets
    const buckets = [
      { min: 0, max: 20, count: 0 },
      { min: 20, max: 40, count: 0 },
      { min: 40, max: 60, count: 0 },
      { min: 60, max: 80, count: 0 },
      { min: 80, max: 101, count: 0 },
    ];

    let sum = 0;
    const sortedScores: number[] = [];
    for (const s of scores) {
      const display = s.score / 10; // raw 0–1000 → display 0–100
      sortedScores.push(display);
      sum += display;
      for (const b of buckets) {
        if (display >= b.min && display < b.max) {
          b.count++;
          break;
        }
      }
    }

    sortedScores.sort((a, b) => a - b);
    const median = sortedScores[Math.floor(sortedScores.length / 2)] ?? 0;

    // Human rate: scores >= 20 (threshold 200 raw / 10)
    const humanCount = scores.filter((s) => s.score >= 200).length;

    res.json({
      success: true,
      data: {
        count: scores.length,
        histogram: buckets.map((b) => ({
          range: `${b.min}–${b.max}`,
          count: b.count,
          percentage: Math.round((b.count / scores.length) * 100),
        })),
        avg: Math.round((sum / scores.length) * 10) / 10,
        median: Math.round(median * 10) / 10,
        humanRate: Math.round((humanCount / scores.length) * 100),
      },
    });
  } catch (err) {
    handleError(res, err);
  }
});

// ── Authenticated endpoints ──

/**
 * GET /score/:address
 * Full score data for the subject.
 */
router.get("/:address", requireSignedNonce, async (req, res) => {
  try {
    const address = req.params.address as `0x${string}`;
    if (!isValidAddress(address)) {
      throw Errors.InvalidSubject(address);
    }
    const scorerId = parseInt(req.query.scorerId as string || "0", 10);
    if (isNaN(scorerId) || scorerId < 0) {
      throw Errors.InvalidBatchSize(scorerId);
    }
    const score = await getScore(address, scorerId);
    const raw = await getScoreRaw(address, scorerId);

    // Append to history
    appendScoreHistory({
      subject: address,
      scorerId,
      score: score.score,
      computedAt: raw.computedAt,
      expiresAt: raw.expiresAt,
      source: "api",
    });

    res.json({ success: true, data: { ...score, detail: raw } });
  } catch (err) {
    handleError(res, err);
  }
});

/**
 * POST /score/commit
 * Commit a score on-chain (requires auth).
 */
router.post("/commit", requireSignedNonce, async (req, res) => {
  try {
    const { subject, scorerId, score, expiresAt, dataCommitment } = req.body;
    if (!subject || !isValidAddress(subject)) {
      throw Errors.InvalidSubject(subject);
    }
    if (typeof scorerId !== "number" || scorerId < 0) {
      throw Errors.MissingFields(["scorerId"]);
    }
    if (typeof score !== "number" || score < 0 || score > 1000) {
      throw Errors.MissingFields(["score (0-1000)"]);
    }
    if (typeof expiresAt !== "number" || expiresAt <= Math.floor(Date.now() / 1000)) {
      throw Errors.MissingFields(["expiresAt (future unix timestamp)"]);
    }

    const txHash = await commitScore(
      subject,
      scorerId,
      score,
      expiresAt,
      dataCommitment || "0x0000000000000000000000000000000000000000000000000000000000000000"
    );

    // Append to history
    appendScoreHistory({
      subject,
      scorerId,
      score,
      computedAt: Math.floor(Date.now() / 1000),
      expiresAt,
      source: "chain",
    });

    res.json({ success: true, data: { txHash, subject, scorerId, score } });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
