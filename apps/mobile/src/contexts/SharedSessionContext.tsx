// src/contexts/SharedSessionContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  EMPTY_SHARED_SESSION,
  createJoinCode,
  isValidJoinCode,
  normaliseJoinCode,
  nextVersion,
  receiveSyncMessage,
  recordSentMessage,
  sessionHealth,
  type SessionHealth,
  type SharedSession,
  type TimerSyncMessage,
} from "@poker/core";
import { sessionTransport } from "@/src/services/loopbackSessionTransport";
import { generateId } from "@/src/utils/id";
import { logger } from "@/src/utils/logger";

/**
 * Which phone this is, for the run of the app.
 *
 * Only has to be unique among the phones in one session and stable while
 * connected, so it is generated rather than stored: a new id after a restart
 * costs nothing, and there is nothing here worth keeping on disk.
 */
const DEVICE_ID = generateId();

/** What went wrong joining, in words a form can show. */
export type JoinError = "code-malformed" | "no-such-session" | "failed";

export type SharedSessionStatus = "off" | "hosting" | "joined";

type SharedSessionContextValue = {
  /** This phone's id, which its own messages carry. */
  deviceId: string;
  /** False when there is no transport — the whole feature is then absent. */
  isAvailable: boolean;
  status: SharedSessionStatus;
  /** The code to read out, while hosting or joined. */
  code: string | null;
  health: SessionHealth;
  busy: boolean;
  /**
   * The newest message anybody sent, **including this phone's own**. `null`
   * before there is one.
   */
  latest: TimerSyncMessage | null;
  /** When {@link latest} was sent or received, on the local clock. */
  latestAt: number | null;
  startHosting: () => Promise<JoinError | null>;
  join: (code: string) => Promise<JoinError | null>;
  leave: () => void;
  /**
   * Send local timer state to the table. Does nothing while `off`.
   *
   * `repeat` re-sends under the current version rather than a new one — a
   * heartbeat, which anyone already holding that version ignores.
   */
  publish: (
    build: (version: number) => TimerSyncMessage,
    options?: { repeat?: boolean },
  ) => Promise<void>;
};

const SharedSessionContext = createContext<SharedSessionContextValue | null>(
  null,
);

/**
 * The connection half of a shared clock: who we are talking to, and what has
 * arrived. **It knows nothing about the timer.**
 *
 * That split is deliberate. The timer is the app's one indispensable feature,
 * and the thing most likely to go wrong here is a loop — a received message
 * changing local state, which publishes, which comes back. Keeping the
 * connection ignorant of the timer means the marrying happens in exactly one
 * place (`useSessionSync`), where the echo suppression can be read in full
 * rather than inferred across two providers.
 */
export function SharedSessionProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [status, setStatus] = useState<SharedSessionStatus>("off");
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Ordering runs over everything *anybody* sent, this phone included: two
  // people pressing at once produce the same version, and the sender tie-break
  // that settles it can only work if a device's own press is in the ordering.
  const [session, setSession] = useState<SharedSession>(EMPTY_SHARED_SESSION);
  // Re-derived on a timer so "stale" appears on its own rather than waiting for
  // the next message — which, when the connection is dead, never comes.
  const [now, setNow] = useState(() => Date.now());

  const sessionIdRef = useRef<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  // The highest version this device has *sent*, which is not necessarily one it
  // has seen: whether a publisher is delivered its own messages is a property
  // of the transport, and getting it wrong would mean reusing a version number
  // for a different state — which every other phone would then ignore. Tracked
  // here so correctness does not depend on that behaviour either way.
  const sentVersionRef = useRef(0);

  const disconnect = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    sessionIdRef.current = null;
    setSession(EMPTY_SHARED_SESSION);
    sentVersionRef.current = 0;
    setCode(null);
    setStatus("off");
  }, []);

  // Leaving on unmount, not just on the button: an orphaned subscription keeps
  // applying messages to a timer nobody is watching.
  useEffect(() => () => unsubscribeRef.current?.(), []);

  useEffect(() => {
    if (status === "off") return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [status]);

  const listen = useCallback((sessionId: string) => {
    if (!sessionTransport) return;
    unsubscribeRef.current?.();
    unsubscribeRef.current = sessionTransport.subscribe(
      sessionId,
      (message) => {
        // Our own message coming back. Some transports deliver it and some do
        // not, so it is dropped here rather than downstream: applying it would
        // re-anchor a running countdown to now for no reason, and counting it
        // as contact would report a table nobody else has joined as being in
        // step with itself. What we sent is recorded when we send it, below.
        if (message.sender === DEVICE_ID) return;
        const at = Date.now();
        setSession((current) => receiveSyncMessage(current, message, at));
      },
    );
  }, []);

  const startHosting = useCallback(async (): Promise<JoinError | null> => {
    if (!sessionTransport) return "failed";
    setBusy(true);
    try {
      const joinCode = createJoinCode(Math.random);
      const sessionId = await sessionTransport.host(joinCode);
      sessionIdRef.current = sessionId;
      listen(sessionId);
      setCode(joinCode);
      setStatus("hosting");
      return null;
    } catch (error) {
      logger.error("Failed to host a session:", error);
      return "failed";
    } finally {
      setBusy(false);
    }
  }, [listen]);

  const join = useCallback(
    async (typed: string): Promise<JoinError | null> => {
      if (!sessionTransport) return "failed";
      // Checked here as well as in the form: a code arriving from a deep link
      // or a paste has been through neither.
      if (!isValidJoinCode(typed)) return "code-malformed";
      const joinCode = normaliseJoinCode(typed);
      setBusy(true);
      try {
        const sessionId = await sessionTransport.resolve(joinCode);
        if (!sessionId) return "no-such-session";
        sessionIdRef.current = sessionId;
        listen(sessionId);
        setCode(joinCode);
        setStatus("joined");
        return null;
      } catch (error) {
        logger.error("Failed to join a session:", error);
        return "failed";
      } finally {
        setBusy(false);
      }
    },
    [listen],
  );

  const publish = useCallback(
    async (
      build: (version: number) => TimerSyncMessage,
      { repeat = false }: { repeat?: boolean } = {},
    ): Promise<void> => {
      const sessionId = sessionIdRef.current;
      if (!sessionTransport || !sessionId) return;
      // Above everything seen *and* everything sent, so a phone that joined
      // late does not send a 1 the table has long since passed, and a repeat is
      // the version this device is actually on.
      const highest = Math.max(nextVersion(session) - 1, sentVersionRef.current);
      const version = repeat ? Math.max(1, highest) : highest + 1;
      sentVersionRef.current = Math.max(sentVersionRef.current, version);
      const message = build(version);
      // Recorded before it is sent, not after: what this phone last said is
      // what everything else compares against, and a publish that fails still
      // reflects a press the user made.
      setSession((current) => recordSentMessage(current, message, Date.now()));
      try {
        await sessionTransport.publish(sessionId, message);
      } catch (error) {
        // Deliberately not surfaced: a dropped publish is what the heartbeat is
        // for, and a failed pause on a bad connection is not worth a dialog
        // over the timer.
        logger.warn("Failed to publish timer state:", error);
      }
    },
    [session],
  );

  const value = useMemo(
    () => ({
      deviceId: DEVICE_ID,
      isAvailable: sessionTransport !== null,
      status,
      code,
      health: sessionHealth(session, now),
      busy,
      latest: session.applied,
      latestAt: session.appliedAt,
      startHosting,
      join,
      leave: disconnect,
      publish,
    }),
    [
      status,
      code,
      session,
      now,
      busy,
      startHosting,
      join,
      disconnect,
      publish,
    ],
  );

  return (
    <SharedSessionContext.Provider value={value}>
      {children}
    </SharedSessionContext.Provider>
  );
}

export function useSharedSession() {
  const context = useContext(SharedSessionContext);
  if (!context) {
    throw new Error(
      "useSharedSession must be used within a SharedSessionProvider",
    );
  }
  return context;
}
