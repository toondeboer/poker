import { formatTime, progress } from "@poker/core";

interface TimerDisplayProps {
  timeLeft: number;
  duration: number;
  level: number;
  total: number;
}

export function TimerDisplay({
  timeLeft,
  duration,
  level,
  total,
}: TimerDisplayProps) {
  const pct = progress(timeLeft, duration) * 100;
  return (
    <div className="w-full text-center">
      <div className="mb-2 text-sm uppercase tracking-[0.3em] text-white/60">
        Level {level + 1} of {total}
      </div>
      <div className="font-mono font-bold leading-none tabular-nums text-[24vw] sm:text-[18vw] lg:text-[13rem]">
        {formatTime(timeLeft)}
      </div>
      <div className="mx-auto mt-6 h-2 w-full max-w-2xl overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full bg-white/80 transition-[width] duration-500 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
