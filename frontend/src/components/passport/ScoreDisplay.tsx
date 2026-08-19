import type { OnChainScore } from "../../types/passport";

interface ScoreDisplayProps {
  score: OnChainScore | null;
  /** Display style: "compact" for sidebar, "detailed" for full view */
  variant?: "compact" | "detailed";
}

const SCORE_COLORS = {
  excellent: "#00E5A0",  // >= 700
  good: "#3B82F6",       // >= 400
  fair: "#F59E0B",       // >= 200
  low: "#EF4444",        // < 200
} as const;

function getScoreColor(score: number): string {
  if (score >= 700) return SCORE_COLORS.excellent;
  if (score >= 400) return SCORE_COLORS.good;
  if (score >= 200) return SCORE_COLORS.fair;
  return SCORE_COLORS.low;
}

function getScoreLabel(score: number): string {
  if (score >= 700) return "Excellent";
  if (score >= 400) return "Good";
  if (score >= 200) return "Fair";
  return "Low";
}

function formatScore(score: number): string {
  return (score / 10).toFixed(1);
}

export function ScoreDisplay({ score, variant = "compact" }: ScoreDisplayProps) {
  if (!score || !score.isValid) {
    return (
      <div>
        <p className="eyebrow" style={{ marginBottom: "var(--space-2)" }}>
          Humanity Score
        </p>
        <div className="data-row" style={{ borderBottom: "none", padding: "var(--space-1) 0" }}>
          <span className="data-row__label t-xs">On-chain score</span>
          <span className="t-sm c-subtle">Not yet computed</span>
        </div>
      </div>
    );
  }

  const color = getScoreColor(score.score);
  const label = getScoreLabel(score.score);
  const displayScore = formatScore(score.score);
  const isExpired = score.expiresAt > 0 && score.expiresAt * 1000 < Date.now();

  if (variant === "compact") {
    return (
      <div>
        <p className="eyebrow" style={{ marginBottom: "var(--space-2)" }}>
          Humanity Score
        </p>
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
          <span
            className="mono t-3xl"
            style={{ color, fontWeight: 700 }}
          >
            {displayScore}
          </span>
          <span className="t-xs c-subtle">/ 100.0</span>
        </div>
        <div
          style={{
            marginTop: "var(--space-2)",
            height: 6,
            borderRadius: 3,
            background: "var(--color-surface-1)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.min((score.score / 1000) * 100, 100)}%`,
              height: "100%",
              background: color,
              borderRadius: 3,
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <div className="flex justify-between items-center" style={{ marginTop: "var(--space-2)" }}>
          <span className="t-xs" style={{ color }}>
            {label}
          </span>
          {score.isHuman && (
            <span
              className="chip"
              style={{
                background: "rgba(0, 229, 160, 0.15)",
                color: "var(--color-verified)",
                fontSize: "0.65rem",
                padding: "1px 6px",
              }}
            >
              Human
            </span>
          )}
        </div>
        {isExpired && (
          <p className="t-xs" style={{ color: "var(--color-warning)", marginTop: "var(--space-1)" }}>
            Score expired — needs recomputation
          </p>
        )}
      </div>
    );
  }

  // Detailed variant
  return (
    <div>
      <p className="eyebrow" style={{ marginBottom: "var(--space-2)" }}>
        On-chain Humanity Score
      </p>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
        <span
          className="mono t-3xl"
          style={{ color, fontWeight: 700 }}
        >
          {displayScore}
        </span>
        <span className="t-xs c-subtle">/ 100.0</span>
      </div>
      <div
        style={{
          marginTop: "var(--space-2)",
          height: 8,
          borderRadius: 4,
          background: "var(--color-surface-1)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.min((score.score / 1000) * 100, 100)}%`,
            height: "100%",
            background: color,
            borderRadius: 4,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-x-4" style={{ marginTop: "var(--space-3)" }}>
        <div className="data-row" style={{ borderBottom: "none", padding: "var(--space-1) 0" }}>
          <span className="data-row__label t-xs">Status</span>
          <span className="t-sm" style={{ color }}>
            {label}
          </span>
        </div>
        <div className="data-row" style={{ borderBottom: "none", padding: "var(--space-1) 0" }}>
          <span className="data-row__label t-xs">Human</span>
          <span className="t-sm" style={{ color: score.isHuman ? "var(--color-verified)" : "var(--color-warning)" }}>
            {score.isHuman ? "Yes" : "No"}
          </span>
        </div>
        {score.computedAt > 0 && (
          <div className="data-row" style={{ borderBottom: "none", padding: "var(--space-1) 0" }}>
            <span className="data-row__label t-xs">Computed</span>
            <span className="t-sm" style={{ color: "var(--color-on-bright)" }}>
              {new Date(score.computedAt * 1000).toLocaleDateString()}
            </span>
          </div>
        )}
        {score.expiresAt > 0 && (
          <div className="data-row" style={{ borderBottom: "none", padding: "var(--space-1) 0" }}>
            <span className="data-row__label t-xs">Expires</span>
            <span
              className="t-sm"
              style={{ color: isExpired ? "var(--color-warning)" : "var(--color-on-bright)" }}
            >
              {new Date(score.expiresAt * 1000).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
      {isExpired && (
        <div
          className="callout"
          style={{ marginTop: "var(--space-3)", borderColor: "var(--color-warning)" }}
        >
          <p className="t-xs" style={{ color: "var(--color-warning)" }}>
            This score has expired. A new computation is needed to refresh it.
          </p>
        </div>
      )}
    </div>
  );
}
