// src/hooks/useSessionSync.ts
import { useEffect, useRef } from "react";
import {
  HEARTBEAT_MS,
  applySyncMessage,
  matchesSession,
  toSyncMessage,
  type TimerMachineState,
} from "@poker/core";
import { useSharedSession } from "@/src/contexts/SharedSessionContext";

type Wiring = {
  state: TimerMachineState;
  blindIndex: number;
  /** How many levels this device's schedule has, for clamping the table's. */
  levelCount: number;
  isLoading: boolean;
  /**
   * Increments whenever the timer's state came from storage rather than from a
   * press — see below for why that has to be distinguishable.
   */
  hydrationCount: number;
  applyRemoteState: (state: TimerMachineState) => void;
  selectBlind: (index: number) => void;
  /** Told about a state that arrived from the table, for anything a press
   * would have triggered — the iOS notification, in practice. */
  onRemoteApplied: (state: TimerMachineState) => void;
};

/**
 * Marry the shared connection to the local timer.
 *
 * **The whole hazard of this feature is a loop**: a message arrives, changes
 * local state, which looks like a local change, which publishes, which comes
 * back. So it is all in one hook, where it can be read rather than inferred
 * across two providers.
 *
 * What stops the loop is *not* remembering what we sent and comparing the
 * state against it — that collides, because a pause looks exactly like an
 * earlier pause at the same level and duration, and a real press then never
 * leaves the phone. It is `matchesSession`: publish when the local clock is not
 * what the table was last told, whoever told it. That comparison has no
 * collision, because the last message moves whenever anything happens.
 */
export function useSessionSync({
  state,
  blindIndex,
  levelCount,
  isLoading,
  hydrationCount,
  applyRemoteState,
  selectBlind,
  onRemoteApplied,
}: Wiring) {
  const { status, latest, latestAt, publish, deviceId } = useSharedSession();

  const appliedRef = useRef<string | null>(null);
  // A state that came from storage rather than from a press. Republishing one
  // would let a phone returning from the background impose its own stale round
  // on everybody — so it is adopted quietly and the table's next heartbeat,
  // seconds away, corrects it.
  const hydratedRef = useRef<number | null>(null);
  // Read through refs so the effects below don't depend on values that change
  // every second, or on callbacks rebuilt every render.
  const localRef = useRef({ state, blindIndex, publish, status });
  useEffect(() => {
    localRef.current = { state, blindIndex, publish, status };
  });

  useEffect(() => {
    if (status !== "off") return;
    appliedRef.current = null;
    hydratedRef.current = null;
  }, [status]);

  // Declared before the other two on purpose: all three run in the same commit
  // when a reload lands, and this one has to mark it first.
  //
  // **A mark to be consumed, not a standing flag.** This used to set the ref and
  // nothing ever cleared it, so `hydratedRef.current === hydrationCount` held
  // from mount onwards and the publishing effect below returned on every run:
  // no press ever left the phone, and the table moved only on heartbeats, which
  // repeat a version everyone already holds. Only a reload during a live
  // session is marked — one at launch, before anybody hosts, is not news to
  // anyone — and the publishing effect clears the mark when it skips.
  useEffect(() => {
    if (localRef.current.status === "off") return;
    hydratedRef.current = hydrationCount;
    // Forget what was applied, so the table's latest state is adopted again
    // over the one just read from storage instead of being skipped as seen.
    appliedRef.current = null;
  }, [hydrationCount]);

  // Apply what the table says.
  useEffect(() => {
    if (status === "off" || !latest || isLoading) return;
    // Our own message. It is in the ordering so the tie-break can see it, but
    // applying it would re-anchor a running countdown to now for nothing.
    if (latest.sender === deviceId) return;
    // Keyed on version *and* sender, because a tie-break winner arrives under a
    // version already applied and must not be mistaken for a repeat.
    const key = `${latest.version}:${latest.sender}`;
    if (appliedRef.current === key) return;
    appliedRef.current = key;

    const remote = applySyncMessage(latest, Date.now());
    applyRemoteState(remote);
    selectBlind(latest.blindIndex);
    onRemoteApplied(remote);
    // The callbacks are rebuilt every render; the key guard above is what
    // decides whether this runs. `hydrationCount` is here so a reload re-applies
    // the table over what came out of storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, latest, isLoading, deviceId, hydrationCount]);

  // Tell the table about a local change.
  //
  // Re-checked on every tick rather than only on a transition, so a clock that
  // has drifted out of step — a phone that was asleep, a message that never
  // arrived — corrects itself instead of waiting for the next press. While
  // everything agrees, which is almost always, it is a comparison and nothing
  // more.
  const settled = !isLoading && status !== "off";
  useEffect(() => {
    if (!settled || !latest || latestAt === null) return;
    // A clock that was just read back from storage is not news, and announcing
    // it would overwrite whatever the table did while this phone was away. The
    // table's next heartbeat, seconds away, puts this phone right instead.
    if (hydratedRef.current === hydrationCount) {
      hydratedRef.current = null;
      return;
    }
    if (
      matchesSession({
        message: latest,
        receivedAt: latestAt,
        state,
        blindIndex,
        levelCount,
        now: Date.now(),
      })
    ) {
      return;
    }
    void localRef.current.publish((version) =>
      toSyncMessage({
        state: localRef.current.state,
        version,
        blindIndex: localRef.current.blindIndex,
        sender: deviceId,
      }),
    );
  }, [
    settled,
    latest,
    latestAt,
    state,
    blindIndex,
    levelCount,
    hydrationCount,
    deviceId,
  ]);

  // A phone that joined says nothing until it has heard the table.
  //
  // Otherwise its first heartbeat announces its own idle clock under version 1
  // — the same version the host is on — and the tie-break, having no way to
  // know which of the two is the real round, can hand the table to the joiner.
  const mayPublish = status === "hosting" || latest !== null;

  // Say the same thing again on a timer.
  //
  // A shared clock is silent for minutes at a stretch, so without this there is
  // no way for the other phones to tell a quiet round from a dead connection —
  // and a device that missed the original message would wait for the next time
  // somebody pressed something. The version does not move, so anyone already
  // holding it ignores the beat and merely counts it as being in touch.
  useEffect(() => {
    if (!settled || !mayPublish) return;
    const beat = setInterval(() => {
      const {
        state: current,
        blindIndex: level,
        publish: send,
      } = localRef.current;
      void send(
        (version) =>
          toSyncMessage({
            state: current,
            version,
            blindIndex: level,
            sender: deviceId,
          }),
        { repeat: true },
      );
    }, HEARTBEAT_MS);
    return () => clearInterval(beat);
  }, [settled, mayPublish, deviceId]);
}
