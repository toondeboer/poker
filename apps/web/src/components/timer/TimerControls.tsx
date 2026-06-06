import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";

interface TimerControlsProps {
  isRunning: boolean;
  onToggle: () => void;
  onReset: () => void;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}

const secondaryButton =
  "flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30";

export function TimerControls({
  isRunning,
  onToggle,
  onReset,
  onPrev,
  onNext,
  canPrev,
  canNext,
}: TimerControlsProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      <button
        onClick={onPrev}
        disabled={!canPrev}
        aria-label="Previous blind level"
        className={secondaryButton}
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        onClick={onReset}
        aria-label="Reset timer"
        className={secondaryButton}
      >
        <RotateCcw className="h-6 w-6" />
      </button>
      <button
        onClick={onToggle}
        aria-label={isRunning ? "Pause timer" : "Start timer"}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-gray-900 shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        {isRunning ? (
          <Pause className="h-9 w-9" fill="currentColor" />
        ) : (
          <Play className="ml-1 h-9 w-9" fill="currentColor" />
        )}
      </button>
      <button
        onClick={onNext}
        disabled={!canNext}
        aria-label="Next blind level"
        className={secondaryButton}
      >
        <ChevronRight className="h-6 w-6" />
      </button>
    </div>
  );
}
