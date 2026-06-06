import { BlindLevel } from "@poker/core";

interface BlindsScheduleProps {
  levels: BlindLevel[];
  current: number;
  onSelect: (index: number) => void;
}

export function BlindsSchedule({
  levels,
  current,
  onSelect,
}: BlindsScheduleProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/60">
        Blind schedule
      </h2>
      <ol className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
        {levels.map((level, index) => {
          const isCurrent = index === current;
          return (
            <li key={index}>
              <button
                onClick={() => onSelect(index)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
                  isCurrent
                    ? "bg-white/90 text-gray-900"
                    : "text-white/90 hover:bg-white/10"
                }`}
              >
                <span className="text-sm opacity-70">Level {index + 1}</span>
                <span className="font-mono font-semibold tabular-nums">
                  {level.small} / {level.big}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
