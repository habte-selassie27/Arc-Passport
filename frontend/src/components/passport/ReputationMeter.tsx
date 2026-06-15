interface ReputationMeterProps {
  count: number;
}

export function ReputationMeter({ count }: ReputationMeterProps) {
  const max = 20;
  const pct = Math.min((count / max) * 100, 100);

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className="bg-yellow-500 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">{count}</span>
      </div>
    </div>
  );
}
