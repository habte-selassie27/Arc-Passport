/**
 * ScoreHistoryChart — Pure SVG line chart showing score history over time.
 *
 * No external charting library. Follows the design system:
 * - JetBrains Mono for data labels
 * - Arc blue (#3B82F6) for the line
 * - Mint green (#00E5A0) for chain-committed points
 * - Amber (#F59E0B) for API-only points
 * - Surface colors for grid and axes
 */

import type { ScoreHistoryEntry } from "../../hooks/useScoreHistory";

interface ScoreHistoryChartProps {
  entries: ScoreHistoryEntry[];
  height?: number;
}

const CHART_PADDING = { top: 24, right: 24, bottom: 32, left: 40 };
const POINT_RADIUS = 4;
const CHAIN_COLOR = "#00E5A0";
const API_COLOR = "#F59E0B";
const LINE_COLOR = "#3B82F6";
const GRID_COLOR = "#1E2D40";
const LABEL_COLOR = "#94A3B8";

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  const month = d.toLocaleString("en", { month: "short" });
  const day = d.getDate();
  return `${month} ${day}`;
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
}

export function ScoreHistoryChart({ entries, height = 180 }: ScoreHistoryChartProps) {
  if (entries.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-6)" }}>
        <p className="t-sm c-subtle">No score history yet.</p>
        <p className="t-xs c-subtle" style={{ marginTop: "var(--space-1)" }}>
          Scores appear here after computation or on-chain commitment.
        </p>
      </div>
    );
  }

  // Sort by computedAt ascending
  const sorted = [...entries].sort((a, b) => a.computedAt - b.computedAt);

  // Compute bounds
  const minScore = 0;
  const maxScore = Math.max(1000, ...sorted.map((e) => e.score));
  const minTime = sorted[0]!.computedAt;
  const maxTime = sorted[sorted.length - 1]!.computedAt;
  const timeRange = Math.max(maxTime - minTime, 1); // avoid div by zero

  const chartW = 100; // percentage-based width
  const chartH = height - CHART_PADDING.top - CHART_PADDING.bottom;

  // Map data to SVG coordinates
  const points = sorted.map((entry, i) => {
    const x = CHART_PADDING.left + ((entry.computedAt - minTime) / timeRange) * (chartW - CHART_PADDING.left - CHART_PADDING.right);
    const y = CHART_PADDING.top + (1 - entry.score / maxScore) * chartH;
    return { x, y, entry, index: i };
  });

  // Build polyline path
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  // Build area fill path (under the line)
  const areaPath = `${linePath} L${points[points.length - 1]!.x},${CHART_PADDING.top + chartH} L${points[0]!.x},${CHART_PADDING.top + chartH} Z`;

  // Y-axis ticks (4 evenly spaced)
  const yTicks = [0, 250, 500, 750, 1000].filter((v) => v <= maxScore);
  const yTickPositions = yTicks.map((v) => ({
    value: v,
    y: CHART_PADDING.top + (1 - v / maxScore) * chartH,
  }));

  // X-axis labels (max 5)
  const xLabelCount = Math.min(sorted.length, 5);
  const xLabels = Array.from({ length: xLabelCount }, (_, i) => {
    const idx = Math.round((i / (xLabelCount - 1 || 1)) * (sorted.length - 1));
    return sorted[idx]!;
  });

  return (
    <div style={{ width: "100%", overflow: "hidden" }}>
      <svg
        viewBox={`0 0 ${chartW} ${height}`}
        width="100%"
        height={height}
        style={{ display: "block" }}
        role="img"
        aria-label="Score history chart"
      >
        {/* Grid lines */}
        {yTickPositions.map((tick) => (
          <line
            key={tick.value}
            x1={CHART_PADDING.left}
            y1={tick.y}
            x2={chartW - CHART_PADDING.right}
            y2={tick.y}
            stroke={GRID_COLOR}
            strokeWidth={0.3}
          />
        ))}

        {/* Area fill */}
        <path
          d={areaPath}
          fill="url(#scoreGradient)"
          opacity={0.15}
        />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={LINE_COLOR}
          strokeWidth={1.2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points */}
        {points.map((p) => (
          <g key={p.index}>
            <circle
              cx={p.x}
              cy={p.y}
              r={POINT_RADIUS * 0.4}
              fill={p.entry.source === "chain" ? CHAIN_COLOR : API_COLOR}
              stroke="var(--color-surface-0)"
              strokeWidth={0.6}
            />
            {/* Hover target (larger invisible circle) */}
            <circle
              cx={p.x}
              cy={p.y}
              r={POINT_RADIUS * 1.2}
              fill="transparent"
            >
              <title>
                {`${(p.entry.score / 10).toFixed(1)} · ${formatDate(p.entry.computedAt)} ${formatTime(p.entry.computedAt)} · ${p.entry.source === "chain" ? "on-chain" : "computed"}`}
              </title>
            </circle>
          </g>
        ))}

        {/* Y-axis labels */}
        {yTickPositions.map((tick) => (
          <text
            key={tick.value}
            x={CHART_PADDING.left - 3}
            y={tick.y + 1.5}
            textAnchor="end"
            fill={LABEL_COLOR}
            fontSize={3.5}
            fontFamily="var(--font-mono, monospace)"
          >
            {(tick.value / 10).toFixed(0)}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map((entry, i) => {
          const x = CHART_PADDING.left + ((entry.computedAt - minTime) / timeRange) * (chartW - CHART_PADDING.left - CHART_PADDING.right);
          return (
            <text
              key={i}
              x={x}
              y={CHART_PADDING.top + chartH + 8}
              textAnchor="middle"
              fill={LABEL_COLOR}
              fontSize={3.2}
              fontFamily="var(--font-body, sans-serif)"
            >
              {formatDate(entry.computedAt)}
            </text>
          );
        })}

        {/* Gradient definition */}
        <defs>
          <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={LINE_COLOR} stopOpacity={0.4} />
            <stop offset="100%" stopColor={LINE_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", gap: "var(--space-4)", marginTop: "var(--space-2)" }}>
        <LegendDot color={CHAIN_COLOR} label="On-chain committed" />
        <LegendDot color={API_COLOR} label="Computed (off-chain)" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
        }}
      />
      <span className="t-xs c-subtle">{label}</span>
    </div>
  );
}
