/**
 * Accounts, and the seam an implementation plugs into.
 *
 * `@poker/core` describes what an account *is* and what can be asked of one; it
 * never talks to a server, exactly as `EntitlementProvider` never talks to a
 * store. The app supplies the implementation — a development stub today, and
 * Cognito once the backend is deployed — so nothing above this layer has to
 * change when that swap happens.
 *
 * **An account is not a player.** A player is a name on somebody's leaderboard
 * and most of them will never sign in; an account is optional identity that
 * *attaches* to one. See `leaderboard/groups.ts`, where that decision is
 * argued in full — this module exists to give the thing being attached a
 * shape.
 */

export type Account = {
  /** Stable id. Whatever the identity provider calls its subject. */
  id: string;
  email: string;
};

/** Why an email or password was refused, before anything is sent anywhere. */
export type CredentialError =
  | "email-empty"
  | "email-malformed"
  | "password-too-short";

/**
 * The shortest password worth allowing.
 *
 * Ten rather than the more common eight: this is checked locally so the number
 * has to match whatever the identity provider enforces, and a rejection that
 * only arrives from the server after a round trip is a worse experience than a
 * slightly longer minimum.
 */
export const MIN_PASSWORD_LENGTH = 10;

/**
 * Is this an email address?
 *
 * Deliberately permissive. The only address that matters is one that can
 * receive a verification message, and no pattern decides that — so this rules
 * out what is obviously not an address (no `@`, nothing before or after it,
 * whitespace, no dot in the domain) and lets the verification email be the
 * real test. Tightening it further only ever rejects somebody's genuine,
 * unusual address.
 */
export const isValidEmail = (email: string): boolean => {
  const trimmed = email.trim();
  if (trimmed.length === 0 || /\s/.test(trimmed)) return false;
  const at = trimmed.indexOf("@");
  if (at <= 0 || at !== trimmed.lastIndexOf("@")) return false;
  const domain = trimmed.slice(at + 1);
  if (domain.length === 0) return false;
  const dot = domain.indexOf(".");
  return dot > 0 && dot < domain.length - 1;
};

/** Check credentials before they leave the device. */
export const validateCredentials = (
  email: string,
  password: string,
): CredentialError | null => {
  if (email.trim().length === 0) return "email-empty";
  if (!isValidEmail(email)) return "email-malformed";
  if (password.length < MIN_PASSWORD_LENGTH) return "password-too-short";
  return null;
};

/**
 * What an account implementation has to be able to do.
 *
 * `deleteAccount` is not optional and not a convenience: App Store guideline
 * 5.1.1(v) requires an app that lets people create an account to let them
 * delete it from inside the app. An implementation that cannot is not
 * shippable.
 */
export interface AuthProvider {
  /** The account this device is signed in as, or `null`. */
  currentAccount(): Promise<Account | null>;
  signUp(email: string, password: string): Promise<Account>;
  signIn(email: string, password: string): Promise<Account>;
  signOut(): Promise<void>;
  /** Delete the account and everything the server holds for it. */
  deleteAccount(): Promise<void>;
}
