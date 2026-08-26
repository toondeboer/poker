// src/contexts/AuthContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { validateCredentials, type Account, type CredentialError } from "@poker/core";
import { stubAuthProvider } from "@/src/services/stubAuthProvider";
import { logger } from "@/src/utils/logger";

/** What went wrong, in words a form can show. */
export type AuthError = CredentialError | "failed";

type AuthContextValue = {
  account: Account | null;
  isLoading: boolean;
  /** True while a sign-up, sign-in or deletion is in flight. */
  busy: boolean;
  signUp: (email: string, password: string) => Promise<AuthError | null>;
  signIn: (email: string, password: string) => Promise<AuthError | null>;
  /** Resolves to an error when it failed, so the screen can say so. */
  signOut: () => Promise<AuthError | null>;
  deleteAccount: () => Promise<AuthError | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Who this device is signed in as.
 *
 * Wired to an {@link AuthProvider}, which is a **development stub** today —
 * see `stubAuthProvider`. Nothing in the app links to the account screens
 * because of that, and the seam means swapping in Cognito changes one import.
 *
 * Credentials are checked locally before anything is attempted, so an obviously
 * wrong address is refused without a round trip and the form can say which
 * field is at fault.
 */
export function AuthProviderContext({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [account, setAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    stubAuthProvider
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
  }, []);

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
        return "failed";
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  // Wrapped rather than passed as `stubAuthProvider.signUp`: an unbound method
  // only works because the stub happens to reference itself by name, and the
  // whole point of the seam is that a class-based provider drops in without
  // anything above it changing. That one would throw on its first call.
  const signUp = useCallback(
    (email: string, password: string) =>
      attempt(email, password, (e, p) => stubAuthProvider.signUp(e, p)),
    [attempt],
  );

  const signIn = useCallback(
    (email: string, password: string) =>
      attempt(email, password, (e, p) => stubAuthProvider.signIn(e, p), {
        // A length rule governs the password being *created*, not the one
        // being presented. Enforcing it here locks out anyone whose existing
        // password is shorter than today's minimum.
        requireStrongPassword: false,
      }),
    [attempt],
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
        return "failed";
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const signOut = useCallback(
    () => end(() => stubAuthProvider.signOut(), "sign out"),
    [end],
  );

  const deleteAccount = useCallback(
    () => end(() => stubAuthProvider.deleteAccount(), "delete the account"),
    [end],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ account, isLoading, busy, signUp, signIn, signOut, deleteAccount }),
    [account, isLoading, busy, signUp, signIn, signOut, deleteAccount],
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
