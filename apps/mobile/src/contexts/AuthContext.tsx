// src/contexts/AuthContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { validateCredentials, type Account, type CredentialError } from "@poker/core";
import { stubAuthProvider } from "@/src/services/stubAuthProvider";
import { createCognitoAuthProvider, CognitoFailure } from "@/src/services/cognitoAuthProvider";
import { backendConfig } from "@/src/services/backendConfig";
import { logger } from "@/src/utils/logger";

/**
 * Cognito when there is a backend, the development stub when there is not.
 *
 * One line, decided once, at module load — which is the whole point of the
 * `AuthProvider` seam. Nothing above this knows which it got, and the stub is
 * not a fallback that could be reached accidentally in production: it is
 * reached when `backendConfig` is `null`, and `backendConfig` being null is
 * also what keeps the account screens unreachable.
 */
const auth = backendConfig
  ? createCognitoAuthProvider(backendConfig)
  : stubAuthProvider;

/** Whether accounts are real. The screens read this to know what to say. */
export const accountsAreReal = backendConfig !== null;

/**
 * A valid ID token for the API, or `null` when nobody is signed in.
 *
 * Exported from here rather than built again elsewhere, because a second
 * `createCognitoAuthProvider` would be a second thing deciding when to refresh
 * — and two refreshes racing is how a session ends for no reason. `null` covers
 * the stub, which has no tokens because it has no server.
 */
export const apiToken = (): Promise<string | null> =>
  "idToken" in auth && typeof auth.idToken === "function"
    ? auth.idToken()
    : Promise.resolve(null);

/**
 * Told whenever somebody becomes signed in — including a session restored at
 * launch.
 *
 * **The outbox needs this and cannot use the context for it.** `apiToken` is a
 * module-level export precisely so a consumer does not have to sit inside this
 * provider, and the sync hook is one of those consumers. Without a signal it
 * only tried on a new write or a foreground, so everything queued while signed
 * out — every write that returned *unreachable* for want of a token — sat there
 * after signing in until something else happened to poke it.
 */
/**
 * The signed-in account's id, readable **without** being inside the provider.
 *
 * Same reason `apiToken` is module-level: `AuthProvider` is mounted *inside*
 * `LeaderboardProvider`, so a consumer there cannot call `useAuth()` at all —
 * it would read a context that does not exist yet. That is also why
 * `claimPlayerAs` takes an account id as an argument rather than reading one.
 *
 * `null` when signed out, which is not the same as "somebody else": a board is
 * only somebody else's when a *different* account owns it, and nothing syncs
 * while there is no session anyway.
 */
let currentAccountId: string | null = null;

export const signedInAccountId = (): string | null => currentAccountId;

const signInListeners = new Set<() => void>();

/** Listen for that. Returns the unsubscribe. */
export const onSignedIn = (listener: () => void): (() => void) => {
  signInListeners.add(listener);
  return () => signInListeners.delete(listener);
};

/** What went wrong, in words a form can show. */
export type AuthError =
  | CredentialError
  | "failed"
  | "network"
  | "email-taken"
  | "email-unknown"
  | "credentials-wrong"
  | "code-wrong"
  | "code-expired"
  | "not-confirmed"
  | "password-weak"
  | "too-many-attempts"
  | "session-expired";

/**
 * Turn whatever was thrown into something a form can show.
 *
 * A `CognitoFailure` already carries a reason somebody can act on — "that
 * email is taken" is an instruction, "that didn't work" is a shrug — and
 * anything else is genuinely unknown and says so.
 */
const reasonFor = (error: unknown): AuthError =>
  error instanceof CognitoFailure && error.reason !== "unknown"
    ? (error.reason as AuthError)
    : "failed";

type AuthContextValue = {
  account: Account | null;
  isLoading: boolean;
  /** True while a sign-up, sign-in or deletion is in flight. */
  busy: boolean;
  /**
   * Create an account.
   *
   * Resolves to `"needs-confirmation"` when the provider emailed a code and is
   * waiting for it — which is not a failure and not a signed-in session, and
   * the screen has to be able to tell the difference.
   */
  signUp: (
    email: string,
    password: string,
  ) => Promise<AuthError | "needs-confirmation" | null>;
  /** Hand back the code from the email. */
  confirmSignUp: (email: string, code: string) => Promise<AuthError | null>;
  /** Send the code again. */
  resendCode: (email: string) => Promise<AuthError | null>;
  signIn: (email: string, password: string) => Promise<AuthError | null>;
  /**
   * Finish a hosted-UI sign-in with the code it handed back.
   *
   * Takes a code rather than opening the browser itself: opening it is
   * platform work and lives in `socialSignIn.ts`, and a context that did both
   * could not be reasoned about without a device.
   */
  signInWithProvider: (params: {
    code: string;
    codeVerifier: string;
  }) => Promise<AuthError | null>;
  /** Resolves to an error when it failed, so the screen can say so. */
  signOut: () => Promise<AuthError | null>;
  deleteAccount: () => Promise<AuthError | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Who this device is signed in as.
 *
 * Wired to an {@link AuthProvider}: **Cognito when `backendConfig` names a user
 * pool, and a development stub when it does not.** It does not today, because
 * the stack has never been deployed — which is also why nothing in the app
 * links to the account screens.
 *
 * Credentials are checked locally before anything is attempted, so an obviously
 * wrong address is refused without a round trip and the form can say which
 * field is at fault.
 */
export function AuthProviderContext({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [account, setAccountState] = useState<Account | null>(null);
  /**
   * Set the account, and the module-level mirror with it.
   *
   * **Both, always** — a consumer outside this provider reads `currentAccountId`
   * and would otherwise see a stale account for the rest of the session. Doing
   * it here rather than during render keeps it out of the render pass, which
   * `react-hooks` rejects as a side effect and is right to.
   */
  const setAccount = useCallback((next: Account | null) => {
    currentAccountId = next?.id ?? null;
    setAccountState(next);
  }, []);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    auth
      .currentAccount()
      .then((current) => {
        if (active) setAccount(current);
      })
      .catch((error) => logger.error("Failed to read the account:", error))
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [setAccount]);

  // Fired from an effect rather than from each `setAccount` call site, so no
  // future way of becoming signed in can forget to announce itself.
  const wasSignedIn = useRef(false);
  useEffect(() => {
    const signedIn = account !== null;
    if (signedIn && !wasSignedIn.current) {
      for (const listener of signInListeners) listener();
    }
    wasSignedIn.current = signedIn;
  }, [account]);

  const attempt = useCallback(
    async (
      email: string,
      password: string,
      run: (email: string, password: string) => Promise<Account>,
      options?: { requireStrongPassword?: boolean },
    ): Promise<AuthError | null> => {
      const invalid = validateCredentials(email, password, options);
      if (invalid) return invalid;
      setBusy(true);
      try {
        // Trim once, here, so the address that is validated is the address
        // that is sent. The stub trims internally and hides this; a real
        // provider will treat " a@b.co " as a different string.
        setAccount(await run(email.trim(), password));
        return null;
      } catch (error) {
        logger.error("Account request failed:", error);
        return reasonFor(error);
      } finally {
        setBusy(false);
      }
    },
    [setAccount],
  );

  // Wrapped rather than passed as `auth.signUp`: an unbound method only works
  // because the provider happens to reference itself by name, and the whole
  // point of the seam is that a class-based provider drops in without anything
  // above it changing. That one would throw on its first call.
  const signUp = useCallback(
    async (
      email: string,
      password: string,
    ): Promise<AuthError | "needs-confirmation" | null> => {
      const invalid = validateCredentials(email, password);
      if (invalid) return invalid;
      setBusy(true);
      try {
        const result = await auth.signUp(email.trim(), password);
        if (result.status === "needs-confirmation") return "needs-confirmation";
        setAccount(result.account);
        return null;
      } catch (error) {
        logger.error("Sign-up failed:", error);
        return reasonFor(error);
      } finally {
        setBusy(false);
      }
    },
    [setAccount],
  );

  /** Wraps a call that neither signs in nor signs out — just succeeds or does not. */
  const plain = useCallback(
    async (run: () => Promise<void>, what: string): Promise<AuthError | null> => {
      setBusy(true);
      try {
        await run();
        return null;
      } catch (error) {
        logger.error(`Failed to ${what}:`, error);
        return reasonFor(error);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const confirmSignUp = useCallback(
    (email: string, code: string) =>
      plain(() => auth.confirmSignUp(email.trim(), code.trim()), "confirm"),
    [plain],
  );

  const resendCode = useCallback(
    (email: string) =>
      plain(() => auth.resendCode(email.trim()), "resend the code"),
    [plain],
  );

  const signIn = useCallback(
    (email: string, password: string) =>
      attempt(email, password, (e, p) => auth.signIn(e, p), {
        // A length rule governs the password being *created*, not the one
        // being presented. Enforcing it here locks out anyone whose existing
        // password is shorter than today's minimum.
        requireStrongPassword: false,
      }),
    [attempt],
  );

  const signInWithProvider = useCallback(
    async (params: {
      code: string;
      codeVerifier: string;
    }): Promise<AuthError | null> => {
      setBusy(true);
      try {
        const account = await auth.signInWithProvider(params);
        setAccount(account);
        // Same as a password sign-in: the outbox has been waiting for a
        // session, and nothing else tells it one arrived.
        for (const listener of signInListeners) listener();
        return null;
      } catch (error) {
        logger.error("Failed to sign in with a provider:", error);
        // `network` survives as itself so the message can say the phone is
        // offline rather than blaming the provider; everything else is
        // `failed`, because a Cognito reason code means nothing to somebody
        // who just tapped a button with an Apple logo on it.
        return error instanceof CognitoFailure && error.reason === "network"
          ? "network"
          : "failed";
      } finally {
        setBusy(false);
      }
    },
    [setAccount],
  );

  /**
   * Run something that ends the session, reporting whether it worked.
   *
   * Both of these used to swallow their failure and log to a dev-only logger,
   * leaving `account` set and the screen identical to success — so a user
   * could confirm an irreversible dialog and be told nothing had gone wrong.
   * That is the exact flow App Store guideline 5.1.1(v) is reviewed against.
   */
  const end = useCallback(
    async (run: () => Promise<void>, what: string): Promise<AuthError | null> => {
      setBusy(true);
      try {
        await run();
        setAccount(null);
        return null;
      } catch (error) {
        logger.error(`Failed to ${what}:`, error);
        return reasonFor(error);
      } finally {
        setBusy(false);
      }
    },
    [setAccount],
  );

  const signOut = useCallback(
    () => end(() => auth.signOut(), "sign out"),
    [end],
  );

  const deleteAccount = useCallback(
    () => end(() => auth.deleteAccount(), "delete the account"),
    [end],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      account,
      isLoading,
      busy,
      signUp,
      signIn,
      signInWithProvider,
      confirmSignUp,
      resendCode,
      signOut,
      deleteAccount,
    }),
    [
      account,
      isLoading,
      busy,
      signUp,
      signIn,
      signInWithProvider,
      confirmSignUp,
      resendCode,
      signOut,
      deleteAccount,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProviderContext");
  }
  return context;
}
