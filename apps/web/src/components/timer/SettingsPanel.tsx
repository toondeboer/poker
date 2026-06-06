import { useState } from "react";
import { Plus, RotateCcw, X } from "lucide-react";
import { BlindLevel } from "@poker/core";

interface SettingsPanelProps {
  durationSeconds: number;
  onApplyDuration: (seconds: number) => void;
  customBlindLevels: BlindLevel[];
  onAddLevel: () => void;
  onRemoveLevel: (index: number) => void;
  onUpdateLevel: (index: number, field: "small" | "big", value: number) => void;
  onApplyBlinds: () => void;
  onResetBlinds: () => void;
  onClose: () => void;
}

const inputClass =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/40";

export function SettingsPanel({
  durationSeconds,
  onApplyDuration,
  customBlindLevels,
  onAddLevel,
  onRemoveLevel,
  onUpdateLevel,
  onApplyBlinds,
  onResetBlinds,
  onClose,
}: SettingsPanelProps) {
  const [minutes, setMinutes] = useState(Math.floor(durationSeconds / 60));
  const [seconds, setSeconds] = useState(durationSeconds % 60);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-gray-900 p-6 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-lg p-2 hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Round duration */}
        <section className="mb-8">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/60">
            Round duration
          </h3>
          <div className="flex items-end gap-3">
            <label className="flex-1">
              <span className="mb-1 block text-xs text-white/60">Minutes</span>
              <input
                type="number"
                min={0}
                max={180}
                value={minutes}
                onChange={(event) =>
                  setMinutes(Math.max(0, parseInt(event.target.value) || 0))
                }
                className={inputClass}
              />
            </label>
            <label className="flex-1">
              <span className="mb-1 block text-xs text-white/60">Seconds</span>
              <input
                type="number"
                min={0}
                max={59}
                value={seconds}
                onChange={(event) =>
                  setSeconds(
                    Math.min(59, Math.max(0, parseInt(event.target.value) || 0)),
                  )
                }
                className={inputClass}
              />
            </label>
          </div>
          <button
            onClick={() => onApplyDuration(minutes * 60 + seconds)}
            className="mt-3 w-full rounded-lg bg-blue-600 py-2 font-medium transition-colors hover:bg-blue-500"
          >
            Apply duration
          </button>
        </section>

        {/* Blind levels */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/60">
              Blind levels
            </h3>
            <div className="flex gap-2">
              <button
                onClick={onResetBlinds}
                className="flex items-center gap-1 rounded-md bg-white/10 px-3 py-1 text-xs transition-colors hover:bg-white/20"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
              <button
                onClick={onAddLevel}
                className="flex items-center gap-1 rounded-md bg-emerald-600/80 px-3 py-1 text-xs transition-colors hover:bg-emerald-600"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {customBlindLevels.map((level, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-6 text-right text-xs text-white/50">
                  {index + 1}.
                </span>
                <input
                  type="number"
                  min={1}
                  value={level.small}
                  onChange={(event) =>
                    onUpdateLevel(index, "small", parseInt(event.target.value) || 0)
                  }
                  className={inputClass}
                />
                <span className="text-white/40">/</span>
                <input
                  type="number"
                  min={1}
                  value={level.big}
                  onChange={(event) =>
                    onUpdateLevel(index, "big", parseInt(event.target.value) || 0)
                  }
                  className={inputClass}
                />
                <button
                  onClick={() => onRemoveLevel(index)}
                  aria-label={`Remove level ${index + 1}`}
                  className="rounded p-1 text-lg leading-none text-white/50 transition-colors hover:text-red-400"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={onApplyBlinds}
            className="mt-4 w-full rounded-lg bg-emerald-600 py-2 font-medium transition-colors hover:bg-emerald-500"
          >
            Apply blind levels
          </button>
        </section>
      </div>
    </div>
  );
}
