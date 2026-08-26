import { describe, expect, it } from "vitest";
import {
  EMPTY_SHARED_SESSION,
  applySyncMessage,
  matchesSession,
  recordSentMessage,
  receiveSyncMessage,
  toSyncMessage,
  type SharedSession,
  type TimerSyncMessage,
} from "./timerSync";
import {
  createTimerState,
  pauseTimer,
  startTimer,
  type TimerMachineState,
} from "../timer/timerMachine";

/**
 * Two phones at one table, wired the way the app wires them.
 *
 * The app's hook is React and cannot be unit-tested here, but the *rules* it
 * follows are all in this module, and a rule that only works in one order is
 * the whole risk. So the loop is reproduced literally — apply anything that
 * isn't ours, publish whenever the local clock stops matching what the table
 * was told, repeat ourselves on a beat — and driven through the orderings that
 * a real table produces.
 */
type Phone = {
  id: string;
  state: TimerMachineState;
  blindIndex: number;
  session: SharedSession;
  sent: number;
};

const LEVELS = 5;

const phone = (id: string, state: TimerMachineState): Phone => ({
  id,
  state,
  blindIndex: 0,
  session: EMPTY_SHARED_SESSION,
  sent: 0,
});

/** What the app's publish does: number it above everything seen or sent. */
const send = (from: Phone, now: number, repeat = false): TimerSyncMessage => {
  const highest = Math.max(from.session.applied?.version ?? 0, from.sent);
  const version = repeat ? Math.max(1, highest) : highest + 1;
  from.sent = Math.max(from.sent, version);
  const message = toSyncMessage({
    state: from.state,
    version,
    blindIndex: from.blindIndex,
    sender: from.id,
  });
  from.session = recordSentMessage(from.session, message, now);
  return message;
};

/** What the app's receive does: skip our own, apply anything newer. */
const deliver = (to: Phone, message: TimerSyncMessage, now: number): void => {
  if (message.sender === to.id) return;
  const before = to.session.applied;
  to.session = receiveSyncMessage(to.session, message, now);
  if (to.session.applied === before) return;
  to.state = applySyncMessage(message, now);
  to.blindIndex = Math.min(message.blindIndex, LEVELS - 1);
};

/** What the app's publishing effect does: speak only when there is news. */
const speaksUp = (from: Phone, now: number): boolean => {
  if (!from.session.applied || from.session.appliedAt === null) return false;
  return !matchesSession({
    message: from.session.applied,
    receivedAt: from.session.appliedAt,
    state: from.state,
    blindIndex: from.blindIndex,
    levelCount: LEVELS,
    now,
  });
};

const agree = (a: Phone, b: Phone) => {
  expect(a.state.paused).toBe(b.state.paused);
  expect(a.state.timerDuration).toBe(b.state.timerDuration);
  expect(a.blindIndex).toBe(b.blindIndex);
  expect(Math.abs(a.state.timeLeft - b.state.timeLeft)).toBeLessThanOrEqual(1);
};

describe("two phones at one table", () => {
  it("puts a joiner on the host's round without the joiner saying anything", () => {
    // The joiner's own clock is idle and irrelevant. If it announced itself the
    // host would adopt it — and a table would lose its round to whoever walked
    // up last.
    const host = phone("host", startTimer(createTimerState(600), 1_000));
    const guest = phone("guest", createTimerState(900));

    deliver(guest, send(host, 5_000, true), 5_000);

    agree(host, guest);
    expect(guest.state.timeLeft).toBe(600);
    expect(speaksUp(guest, 5_000)).toBe(false);
  });

  it("carries a pause across, and does not bounce back", () => {
    const host = phone("host", startTimer(createTimerState(600), 1_000));
    const guest = phone("guest", createTimerState(900));
    deliver(guest, send(host, 5_000, true), 5_000);

    guest.state = pauseTimer(guest.state);
    expect(speaksUp(guest, 6_000)).toBe(true);
    deliver(host, send(guest, 6_000), 6_000);

    agree(host, guest);
    expect(host.state.paused).toBe(true);
    // The echo test: neither phone now has anything to say, at the moment it
    // lands or a minute later.
    const failures: string[] = [];
    for (const at of [6_001, 20_000, 66_000]) {
      if (speaksUp(host, at)) failures.push(`host at ${at}`);
      if (speaksUp(guest, at)) failures.push(`guest at ${at}`);
    }
    expect(failures).toEqual([]);
  });

  it("says the same pause again when it really is a second press", () => {
    // Pause, resume, pause. The third state is identical to the first, which is
    // exactly what a remembered-snapshot check gets wrong.
    const host = phone("host", startTimer(createTimerState(600), 1_000));
    const guest = phone("guest", createTimerState(600));
    deliver(guest, send(host, 5_000, true), 5_000);

    guest.state = pauseTimer(guest.state);
    deliver(host, send(guest, 6_000), 6_000);
    guest.state = startTimer(guest.state, 7_000);
    deliver(host, send(guest, 7_000), 7_000);
    guest.state = pauseTimer(guest.state);

    expect(speaksUp(guest, 8_000)).toBe(true);
    deliver(host, send(guest, 8_000), 8_000);
    agree(host, guest);
    expect(host.state.paused).toBe(true);
  });

  it("settles on one answer when both press at the same moment", () => {
    // The tie the version alone cannot break. Whichever wins, both must pick
    // the same one — a table that splits in two is the failure.
    const one = phone("phone-a", startTimer(createTimerState(600), 1_000));
    const two = phone("phone-b", startTimer(createTimerState(600), 1_000));
    deliver(two, send(one, 5_000, true), 5_000);

    one.state = pauseTimer(one.state);
    two.blindIndex = 1;
    const fromOne = send(one, 6_000);
    const fromTwo = send(two, 6_000);
    expect(fromOne.version).toBe(fromTwo.version);

    deliver(one, fromTwo, 6_010);
    deliver(two, fromOne, 6_010);

    agree(one, two);
  });

  it("keeps a silent running round silent", () => {
    // Nothing is published for minutes at a time: every phone counts the round
    // down itself, and only a press is news.
    const host = phone("host", startTimer(createTimerState(600), 1_000));
    const guest = phone("guest", createTimerState(600));
    deliver(guest, send(host, 5_000, true), 5_000);

    const failures: string[] = [];
    for (let elapsed = 1_000; elapsed <= 300_000; elapsed += 1_000) {
      const now = 5_000 + elapsed;
      for (const device of [host, guest]) {
        device.state = { ...device.state, timeLeft: 600 - elapsed / 1_000 };
        if (speaksUp(device, now)) failures.push(`${device.id} at ${elapsed}ms`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("does not drag the table back to a level a short schedule cannot reach", () => {
    const host = phone("host", startTimer(createTimerState(600), 1_000));
    host.blindIndex = 9;
    const guest = phone("guest", createTimerState(600));

    deliver(guest, send(host, 5_000, true), 5_000);

    expect(guest.blindIndex).toBe(LEVELS - 1);
    expect(speaksUp(guest, 5_000)).toBe(false);
  });
});
