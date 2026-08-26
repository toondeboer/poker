import { describe, expect, it } from "vitest";
import {
  EMPTY_SHARED_SESSION,
  HEARTBEAT_MS,
  STALE_AFTER_MS,
  sessionHealth,
  applySyncMessage,
  nextVersion,
  receiveSyncMessage,
  shouldApply,
  toSyncMessage,
  type TimerSyncMessage,
} from "./timerSync";
import { createTimerState, startTimer } from "../timer/timerMachine";

const running = startTimer(createTimerState(600), 1_000_000);
const message = (over: Partial<TimerSyncMessage> = {}): TimerSyncMessage => ({
  version: 1,
  remaining: 600,
  duration: 600,
  paused: false,
  blindIndex: 0,
  ...over,
});

describe("what goes over the wire", () => {
  it("sends how much is left, never when it ends", () => {
    // The whole point: an absolute instant is meaningless on a phone whose
    // clock disagrees with the sender's.
    const sent = toSyncMessage({ state: running, version: 1, blindIndex: 2 });
    expect(sent).toEqual({
      version: 1,
      remaining: 600,
      duration: 600,
      paused: false,
      blindIndex: 2,
    });
    expect(Object.keys(sent)).not.toContain("endTime");
  });

  it("never sends a negative remaining", () => {
    const overrun = { ...running, timeLeft: -3 };
    expect(toSyncMessage({ state: overrun, version: 1, blindIndex: 0 }).remaining).toBe(0);
  });

  it("rounds to whole seconds, which is all the timer displays", () => {
    const fractional = { ...running, timeLeft: 42.4 };
    expect(toSyncMessage({ state: fractional, version: 1, blindIndex: 0 }).remaining).toBe(42);
  });
});

describe("clock skew", () => {
  it("anchors the countdown to the receiver's own clock", () => {
    // Two phones half a minute apart see the same remaining time, because
    // neither reads the other's clock.
    const sent = message({ remaining: 300 });
    const onTime = applySyncMessage(sent, 5_000_000);
    const fastByThirtySeconds = applySyncMessage(sent, 5_030_000);

    expect(onTime.timeLeft).toBe(300);
    expect(fastByThirtySeconds.timeLeft).toBe(300);
    // Each anchors 300s ahead of *its own* now.
    expect(onTime.endTime).toBe(5_000_000 + 300_000);
    expect(fastByThirtySeconds.endTime).toBe(5_030_000 + 300_000);
  });

  it("gives a paused round no expiry instant, like the local machine does", () => {
    const applied = applySyncMessage(message({ paused: true, remaining: 120 }), 9);
    expect(applied.paused).toBe(true);
    expect(applied.endTime).toBeUndefined();
    expect(applied.timeLeft).toBe(120);
  });

  it("carries the round length, so a device that joined late knows it", () => {
    expect(applySyncMessage(message({ duration: 480 }), 0).timerDuration).toBe(480);
  });
});

describe("ordering", () => {
  it("applies the first thing it ever sees", () => {
    expect(shouldApply(EMPTY_SHARED_SESSION, message())).toBe(true);
  });

  it("applies something newer", () => {
    const seen = receiveSyncMessage(EMPTY_SHARED_SESSION, message({ version: 4 }), 0);
    expect(shouldApply(seen, message({ version: 5 }))).toBe(true);
  });

  it("ignores something older, however it got here", () => {
    // Messages can arrive out of order, and a late one must not undo a pause.
    const seen = receiveSyncMessage(EMPTY_SHARED_SESSION, message({ version: 9 }), 0);
    expect(shouldApply(seen, message({ version: 8 }))).toBe(false);
    expect(receiveSyncMessage(seen, message({ version: 8 }), 1).applied).toBe(
      seen.applied,
    );
  });

  it("ignores the same version twice", () => {
    // A reconnect replaying the last state is the ordinary case. Reapplying
    // re-anchors the countdown to now, which on the phone at the table looks
    // like the clock jumping backwards by however long the round has run.
    const seen = receiveSyncMessage(EMPTY_SHARED_SESSION, message({ version: 3 }), 0);
    expect(shouldApply(seen, message({ version: 3, remaining: 1 }))).toBe(false);
    expect(
      receiveSyncMessage(seen, message({ version: 3, remaining: 1 }), 1).applied,
    ).toBe(seen.applied);
  });

  it("numbers a device's first message above whatever the table is on", () => {
    // A phone joining late must not send a 1 that everybody ignores.
    expect(nextVersion(EMPTY_SHARED_SESSION)).toBe(1);
    const seen = receiveSyncMessage(EMPTY_SHARED_SESSION, message({ version: 12 }), 0);
    expect(nextVersion(seen)).toBe(13);
  });

  it("cannot be corrupted through the shared empty value", () => {
    expect(Object.isFrozen(EMPTY_SHARED_SESSION)).toBe(true);
  });
});

describe("a session in use", () => {
  it("converges: whatever order two devices see the same messages in, they agree", () => {
    // The property that matters at a table. Any permutation of the same
    // messages leaves both phones on the same round.
    const stream = [1, 2, 3, 4, 5].map((version) =>
      message({ version, remaining: 600 - version * 60, paused: version === 3 }),
    );

    const failures: string[] = [];
    const permutations = [
      [0, 1, 2, 3, 4],
      [4, 3, 2, 1, 0],
      [2, 0, 4, 1, 3],
      [1, 1, 0, 4, 4, 2, 3],
    ];
    for (const order of permutations) {
      let session = EMPTY_SHARED_SESSION;
      for (const index of order) {
        session = receiveSyncMessage(session, stream[index], index);
      }
      if (session.applied?.version !== 5) {
        failures.push(`${order.join(",")} ended on ${session.applied?.version}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("a round trip through send and receive keeps the clock where it was", () => {
    const sent = toSyncMessage({ state: running, version: 1, blindIndex: 0 });
    const applied = applySyncMessage(sent, 2_000_000);
    expect(applied.timeLeft).toBe(running.timeLeft);
    expect(applied.paused).toBe(running.paused);
    expect(applied.timerDuration).toBe(running.timerDuration);
  });
});

describe("knowing whether we are still in touch", () => {
  const at = (millis: number) =>
    receiveSyncMessage(EMPTY_SHARED_SESSION, message(), millis);

  it("says so plainly before anything has arrived", () => {
    expect(sessionHealth(EMPTY_SHARED_SESSION, 1_000)).toBe("waiting");
  });

  it("is live while messages keep arriving", () => {
    expect(sessionHealth(at(1_000), 1_000 + STALE_AFTER_MS)).toBe("live");
  });

  it("goes stale once they stop", () => {
    // The countdown keeps running locally either way — the phone knows how much
    // of the round is left, it just no longer knows whether somebody paused it.
    expect(sessionHealth(at(1_000), 1_001 + STALE_AFTER_MS)).toBe("stale");
  });

  it("counts a repeat of an already-applied version as being in touch", () => {
    // Most heartbeats repeat the current version. Treating those as silence
    // reports a perfectly healthy session as stale within fifteen seconds.
    const seen = receiveSyncMessage(EMPTY_SHARED_SESSION, message({ version: 2 }), 0);
    const beat = receiveSyncMessage(seen, message({ version: 2 }), 12_000);
    expect(beat.applied?.version).toBe(2);
    expect(sessionHealth(beat, 13_000)).toBe("live");
  });

  it("tolerates a couple of dropped beats before complaining", () => {
    // A phone on a busy hotspot drops the odd message; saying "lost touch"
    // every time one goes missing is noise nobody would keep looking at.
    expect(STALE_AFTER_MS).toBeGreaterThanOrEqual(HEARTBEAT_MS * 3);
  });
});
