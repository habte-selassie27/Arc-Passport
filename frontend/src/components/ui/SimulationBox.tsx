import { Spinner } from "./Spinner";

export interface SimBoxItem {
  label: string;
  value?: string;
}

interface SimulationBoxProps {
  state: "loading" | "passed" | "failed";
  items?: SimBoxItem[];
  errorMessage?: string | null;
}

/**
 * Pre-flight check — the first-class checklist shown before a user signs.
 * Passed = mint checkmarks on a verified-tinted panel; failed = danger tint.
 */
export function SimulationBox({ state, items = [], errorMessage }: SimulationBoxProps) {
  if (state === "loading") {
    return (
      <div className="sim-box">
        <div className="sim-box__title">Pre-flight check</div>
        <div className="sim-box__row">
          <Spinner size={12} />
          Simulating transaction…
        </div>
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div className="sim-box sim-box--failed" role="alert">
        <div className="sim-box__title">Pre-flight check</div>
        <div className="sim-box__row">
          <span className="sim-box__fail" aria-hidden="true">✗</span>
          Simulation failed
        </div>
        {errorMessage && <div className="sim-box__message">{errorMessage}</div>}
      </div>
    );
  }

  return (
    <div className="sim-box">
      <div className="sim-box__title">Pre-flight check</div>
      {items.map((item, i) => (
        <div key={i} className="sim-box__row">
          <span className="sim-box__check" aria-hidden="true">✓</span>
          <span>
            {item.label}
            {item.value && <span className="c-subtle"> {item.value}</span>}
          </span>
        </div>
      ))}
      <p className="sim-box__hint">Review the transaction above, then sign below.</p>
    </div>
  );
}
