// src/components/settings/SoundPackRow.tsx
import { useEffect, useRef } from "react";
import { SoundPackId } from "@poker/core";
import { SOUND_BY_PACK_ID, useSounds } from "@/src/hooks/useSounds";
import { Button } from "@/src/components/ui/Button";
import { ListRow } from "@/src/components/ui/ListRow";

// Alarm sounds are designed to keep ringing until dismissed (so a round change
// is never missed) — fine for a real expiry, annoying for a Settings preview.
// Cap the preview instead of playing the sound's full length.
const PREVIEW_DURATION_MS = 3000;

/** One selectable sound-pack row, owning its own preview player. */
export function SoundPackRow({
  pack,
  selected,
  onSelect,
}: {
  pack: { id: SoundPackId; label: string };
  selected: boolean;
  onSelect: () => void;
}) {
  const { playSound, stopSound, isLoaded, isPlaying } = useSounds(
    SOUND_BY_PACK_ID[pack.id],
  );
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPreviewTimeout = () => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
  };

  const handlePreviewPress = async () => {
    if (isPlaying) {
      clearPreviewTimeout();
      await stopSound();
      return;
    }
    await playSound();
    previewTimeoutRef.current = setTimeout(() => {
      stopSound();
    }, PREVIEW_DURATION_MS);
  };

  // Stop a still-playing preview if the row unmounts (e.g. leaving Settings).
  useEffect(() => {
    return () => {
      clearPreviewTimeout();
      if (isPlaying) stopSound();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ListRow
      title={pack.label}
      meta={selected ? "Selected" : "Tap to select"}
      selected={selected}
      onPress={onSelect}
      right={
        <Button
          label={isPlaying ? "Stop" : "Preview"}
          icon={isPlaying ? "stop" : "play"}
          size="sm"
          onPress={handlePreviewPress}
          disabled={!isLoaded}
        />
      }
    />
  );
}
