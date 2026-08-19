import type { HumanodeState } from "../../hooks/useHumanode";

const STEPS = [
  { key: "connect", label: "Connect Wallet" },
  { key: "prove", label: "Prove You're Human" },
  { key: "issue", label: "Issue Proof On-chain" },
  { key: "done", label: "Verified" },
] as const;

function activeStep(state: HumanodeState | "idle" | "starting" | "awaiting" | "verifying"): number {
  switch (state) {
    case "idle":
    case "starting":
      return 0;
    case "awaiting":
      return 1;
    case "verifying":
    case "initialized":
    case "verified":
    case "attesting":
      return 2;
    case "complete":
      return 3;
    default:
      return 0;
  }
}

interface Props {
  state: HumanodeState | "idle" | "starting" | "awaiting" | "verifying";
  failed?: boolean;
}

export function HumanNodeProgress({ state, failed }: Props) {
  const current = failed ? -1 : activeStep(state);
  return (
    <ol className="humanode-steps" aria-label="Verification progress">
      {STEPS.map((step, i) => {
        const done = i < current || state === "complete";
        const isActive = i === current && !failed;
        return (
          <li
            key={step.key}
            className={`humanode-step ${done ? "is-done" : ""} ${isActive ? "is-active" : ""}`}
            aria-current={isActive ? "step" : undefined}
          >
            <span className="humanode-step__marker" aria-hidden="true">
              {done ? "✓" : i + 1}
            </span>
            <span className="humanode-step__label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
