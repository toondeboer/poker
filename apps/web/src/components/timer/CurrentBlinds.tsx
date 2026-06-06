import { BlindLevel } from "@poker/core";

interface CurrentBlindsProps {
  current: BlindLevel;
  next?: BlindLevel;
}

export function CurrentBlinds({ current, next }: CurrentBlindsProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-sm uppercase tracking-[0.2em] text-white/60">
        Blinds
      </div>
      <div className="text-5xl font-bold tabular-nums lg:text-6xl">
        {current.small} <span className="text-white/40">/</span> {current.big}
      </div>
      {next && (
        <div className="text-lg text-white/60">
          Next: {next.small} / {next.big}
        </div>
      )}
    </div>
  );
}
