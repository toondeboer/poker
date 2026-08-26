// src/hooks/useSessionSync.ts
import { useEffect, useRef } from "react";
import {
  HEARTBEAT_MS,
  applySyncMessage,
  toSyncMessage,
  type TimerMachineState,
} from "@poker/core";
import { useSharedSession } from "@/src/contexts/SharedSessionContext";

/**
 * What identifies a *change worth telling the table about*.
 *
 * Not `timeLeft`, which moves every second — a running clock needs no traffic,
 * because every phone already knows how much of the round is left and counts it
 * down itself. What the others cannot work out on their own is a pause, a
 * resume, a reset, a level change or a different round length, and each of
 * those changes one of these four.
 */
const signatureOf = (state: TimerMachineState, blindIndex: number): string =>
  `${state.paused}|${state.timerDuration}|${blindIndex}|${state.endTime ?? "-"}`;

type Wiring = {
  state: TimerMachineState;
  blindIndex: number;
  isLoading: boolean;
  applyRemoteState: (state: TimerMachineState) => void;
  selectBlind: (index: number) => void;
};

/**
 * Marry the shared connection to the local timer.
 *
 * **The whole hazard of this feature is a loop**: a message arrives, changes
 * local state, which looks like a local change, which publishes, which comes
 * back. So it is all in one hook, where the suppression can be read rather than
 * inferred — the signature of anything applied from the table is remembered,
 * and the publishing effect skips a state matching it. Two phones can then hold
 * the same state without either of them having anything to say about it.
 */
export function useSessionSync({
  state,
  blindIndex,
  isLoading,
  applyRemoteState,
  selectBlind,
}: Wiring) {
  const { status, latest, publish, deviceId } = useSharedSession();

  const appliedVersionRef = useRef<number | null>(null);
  const suppressRef = useRef<string | null>(null);
  const publishedRef = useRef<string | null>(null);
  // Read through refs so the effects below don't depend on values that change
  // every second, or on callbacks rebuilt every render.
  const localRef = useRef({ state, blindIndex, publish });
  useEffect(() => {
    localRef.current = { state, blindIndex, publish };
  });

  // Forget everything on the way out, so re-joining doesn't start out believing
  // it has already published the state it is about to be told.
  useEffect(() => {
    if (status !== "off") return;
    appliedVersionRef.current = null;
    suppressRef.current = null;
    publishedRef.current = null;
  }, [status]);

  // Apply what the table says.
  useEffect(() => {
    if (status === "off" || !latest || isLoading) return;
    if (appliedVersionRef.current === latest.version) return;
    appliedVersionRef.current = latest.version;

    const remote = applySyncMessage(latest, Date.now());
    const signature = signatureOf(remote, latest.blindIndex);
    // Set *before* applying: the state change below re-runs the publishing
    // effect, which has to already know not to echo it.
    suppressRef.current = signature;
    publishedRef.current = signature;
    applyRemoteState(remote);
    selectBlind(latest.blindIndex);
    // `applyRemoteState` and `selectBlind` are rebuilt every render; the version
    // guard above is what decides whether this runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, latest, isLoading, deviceId]);

  // Tell the table about a local change.
  const signature = signatureOf(state, blindIndex);
  useEffect(() => {
    if (status === "off" || isLoading) return;
    if (signature === suppressRef.current) return;
    if (signature === publishedRef.current) return;
    publishedRef.current = signature;
    void localRef.current.publish((version) =>
      toSyncMessage({
        state: localRef.current.state,
        version,
        blindIndex: localRef.current.blindIndex,
        sender: deviceId,
      }),
    );
  }, [status, signature, isLoading, deviceId]);

  // Say the same thing again on a timer.
  //
  // A shared clock is silent for minutes at a stretch, so without this there is
  // no way for the other phones to tell a quiet round from a dead connection —
  // and a device that missed the original message would wait for the next time
  // somebody pressed something. The version does not move, so anyone already
  // holding it ignores the beat and merely counts it as being in touch.
  useEffect(() => {
    if (status === "off" || isLoading) return;
    const beat = setInterval(() => {
      const { state: current, blindIndex: level, publish: send } = localRef.current;
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
  }, [status, isLoading, deviceId]);
}
