interface StatCardProps {
  label: string;
  /** Display value. Use "—" (em dash) when data failed to load — never "0". */
  value: string | number;
  tone?: "default" | "danger" | "warn";
  sub?: string;
}

const TONE_CLASS: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "",
  danger: "c-danger",
  warn: "c-warn",
};

export function StatCard({ label, value, tone = "default", sub }: StatCardProps) {
  return (
    <div className="stat-card">
      <p className="stat-card__label">{label}</p>
      <p className={`stat-card__value ${TONE_CLASS[tone]}`}>{value}</p>
      {sub && <p className="stat-card__sub">{sub}</p>}
    </div>
  );
}
