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
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
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
    ): Promise<AuthError | null> => {
      const invalid = validateCredentials(email, password);
      if (invalid) return invalid;
      setBusy(true);
      try {
        setAccount(await run(email, password));
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

  const signUp = useCallback(
    (email: string, password: string) =>
      attempt(email, password, stubAuthProvider.signUp),
    [attempt],
  );

  const signIn = useCallback(
    (email: string, password: string) =>
      attempt(email, password, stubAuthProvider.signIn),
    [attempt],
  );

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await stubAuthProvider.signOut();
      setAccount(null);
    } catch (error) {
      logger.error("Failed to sign out:", error);
    } finally {
      setBusy(false);
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    setBusy(true);
    try {
      await stubAuthProvider.deleteAccount();
      setAccount(null);
    } catch (error) {
      logger.error("Failed to delete the account:", error);
    } finally {
      setBusy(false);
    }
  }, []);

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
