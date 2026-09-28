/**
 * One person, one account, however they signed in.
 *
 * **The problem this exists for.** Cognito does not merge identities. Somebody
 * who signed up with a password is user `abc-123`; the same person tapping
 * *Continue with Google* a month later is `Google_1234567`, a different user
 * with a different `sub`. Every board, player claim and game on the server is
 * keyed by that `sub` — so without this the second sign-in lands on an empty
 * account and a season of game nights looks deleted. It is silent, it is
 * indistinguishable from data loss, and it only happens to people who were
 * here *before* social sign-in shipped, which is everybody who has an account
 * today.
 *
 * So the pool has a `PreSignUp` trigger, and this is it. Cognito calls it
 * before it creates any user, including the shadow user it makes the first time
 * somebody arrives from a provider, and the trigger gets to link that provider
 * identity onto an account that already exists instead.
 *
 * ## The direction that is safe, and the direction that is not
 *
 * **Provider onto password: link.** The provider has told us this person
 * controls the address, and controlling the address is exactly what the
 * emailed code proved when they signed up. The two are the same claim.
 *
 * **Password onto provider: refuse.** It looks symmetrical and is not. Allowing
 * it means anybody who knows an address can create a password on an account
 * backed by somebody's Google login, and the real owner never sees a prompt.
 * That is account takeover with extra steps. The person is told to continue
 * with the provider they already used, which they can always do.
 *
 * ## `email_verified` is the whole guard, and it is not decoration
 *
 * Linking on a matching address alone is a takeover vector against any provider
 * that does not verify addresses: register `victim@example.com` there, sign in
 * here, and inherit the victim's account. Apple and Google both verify, and
 * this **still** checks — because the guard has to hold for whichever provider
 * gets added next, by somebody who has not read this comment.
 *
 * ## What this deliberately does not solve
 *
 * **Apple's Hide My Email.** The relay gives a `@privaterelay.appleid.com`
 * address that matches nothing, so no link is found and the person gets a new
 * account. That is correct: we have no evidence the two are the same human,
 * and inventing some would be the takeover above. It is a real edge worth
 * telling somebody about in the UI, not a bug to fix here.
 */

import {
  AdminLinkProviderForUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { log } from "./logging";

/** What Cognito sends a PreSignUp trigger. Only these fields matter. */
export type PreSignUpEvent = {
  /**
   * Which flow is signing somebody up.
   *
   * `PreSignUp_ExternalProvider` is the one that matters — Cognito is about to
   * mint a shadow user for a federated identity. `PreSignUp_SignUp` is an
   * ordinary email/password registration.
   */
  triggerSource?: string;
  userName?: string;
  userPoolId?: string;
  request?: {
    userAttributes?: Record<string, string | undefined>;
  };
  response?: Record<string, unknown>;
};

/** An existing user, as much of one as the decision needs. */
export type ExistingUser = {
  username: string;
  /** How they sign in: `"native"` for email/password, or the provider name. */
  origin: "native" | string;
};

/** What to do about this sign-up. */
export type LinkDecision =
  /** Let Cognito create the user as it normally would. */
  | { action: "allow"; why: AllowReason }
  /**
   * Attach this provider identity to `username`, an account that already
   * exists, so the two share one `sub`.
   */
  | { action: "link"; to: string; provider: string; providerSub: string }
  /** Refuse, with a sentence a person can act on. */
  | { action: "refuse"; reason: string };

/**
 * `Google_1234567` → `{ provider: "Google", sub: "1234567" }`.
 *
 * Cognito builds the federated username this way, and it is the only place the
 * provider's own subject appears in the event — `AdminLinkProviderForUser`
 * needs both halves separately.
 *
 * Split on the **first** underscore only: a provider subject can contain them,
 * and splitting on all of them silently truncates the id to its first segment,
 * which links the wrong identity rather than failing.
 */
export const parseFederatedUsername = (
  userName: string | undefined,
): { provider: string; sub: string } | null => {
  if (!userName) return null;
  const at = userName.indexOf("_");
  if (at <= 0 || at === userName.length - 1) return null;
  const provider = canonicalProvider(userName.slice(0, at));
  if (!provider) return null;
  return { provider, sub: userName.slice(at + 1) };
};

/**
 * The provider's name **as Cognito registered it**, not as it appears in the
 * username.
 *
 * **These are not the same string, and finding that out costs a duplicate
 * account.** Cognito registers the provider as `SignInWithApple` and then names
 * the shadow user `signinwithapple_001004.…` — lowercased. Observed, not
 * guessed: that is the exact username a real Apple sign-in produced against
 * the dev pool on 2026-09-06.
 *
 * `AdminLinkProviderForUser` matches `ProviderName` case-sensitively, so
 * passing the username's prefix through fails. And it fails *quietly*: the
 * handler treats a failed link as "allow and log", because a duplicate account
 * is recoverable by hand and a sign-up nobody can complete is not — so the
 * symptom is the exact silent duplicate this file exists to prevent.
 *
 * Matched case-insensitively against the providers this pool actually has.
 * An unrecognised one returns `null` rather than being passed through: linking
 * to a provider name nothing registered cannot succeed, and guessing at the
 * capitalisation of a provider added later is how this breaks again.
 */
export const canonicalProvider = (prefix: string): string | null => {
  const known = ["Google", "SignInWithApple"];
  return (
    known.find((name) => name.toLowerCase() === prefix.toLowerCase()) ?? null
  );
};

/**
 * Decide, given who already exists. **No I/O**, so every branch is testable.
 *
 * `existing` is everybody already registered with this email address —
 * normally none, sometimes one, and more than one only if a previous version of
 * this let it happen.
 */
/**
 * Why a sign-up was allowed through untouched.
 *
 * **Carried so the quiet path is not silent.** Every interesting outcome here
 * logs, and `allow` did not — so a trigger that ran, decided not to link, and
 * returned looked exactly like a trigger that never fired. Diagnosing the
 * missing `email_verified` mapping meant proving invocation from CloudWatch
 * metrics because the logs said nothing at all.
 */
export type AllowReason =
  | "not-federated"
  | "no-email"
  | "email-unverified"
  | "unknown-provider"
  | "no-account-to-link";

export const decideLink = (
  event: PreSignUpEvent,
  existing: readonly ExistingUser[],
): LinkDecision => {
  const federated = event.triggerSource === "PreSignUp_ExternalProvider";
  const email = event.request?.userAttributes?.email;

  // No address, nothing to match on. A federated identity without one is
  // unusual but not wrong — it gets its own account, which is the honest
  // outcome of knowing nothing that ties it to another.
  if (!email) return { action: "allow", why: "no-email" };

  if (!federated) {
    // Ordinary sign-up. Refuse only when the address already belongs to a
    // provider-backed account — see the header for why this direction does not
    // link.
    const provider = existing.find((user) => user.origin !== "native");
    if (provider) {
      return {
        action: "refuse",
        reason: `You already have an account with this email. Sign in with ${provider.origin} instead.`,
      };
    }
    return { action: "allow", why: "not-federated" };
  }

  /**
   * **The guard.** Cognito passes the provider's own claim through, and a
   * provider that has not verified the address has told us nothing about who
   * controls it. Missing counts as unverified.
   */
  if (event.request?.userAttributes?.email_verified !== "true") {
    return { action: "allow", why: "email-unverified" };
  }

  const parsed = parseFederatedUsername(event.userName);
  if (!parsed) return { action: "allow", why: "unknown-provider" };

  const native = existing.find((user) => user.origin === "native");
  if (!native) return { action: "allow", why: "no-account-to-link" };

  return {
    action: "link",
    to: native.username,
    provider: parsed.provider,
    providerSub: parsed.sub,
  };
};

/** The Cognito calls this needs, so the handler can be tested without one. */
export type Directory = {
  /** Everybody registered with this address. */
  findByEmail(userPoolId: string, email: string): Promise<ExistingUser[]>;
  /** Attach a provider identity to an existing user. */
  link(params: {
    userPoolId: string;
    username: string;
    provider: string;
    providerSub: string;
  }): Promise<void>;
};

let directory: Directory | null = null;

/** Swap the directory out in tests. */
export const useDirectory = (next: Directory | null) => {
  directory = next;
};

/**
 * The real one, built lazily so importing this module needs no AWS.
 *
 * `ListUsers` with a `filter` is the only way to ask "who has this address" —
 * there is no get-by-email. The filter syntax is exact-match on a quoted value,
 * and quotes inside the address would break out of it, so an address
 * containing one is treated as matching nobody rather than as a query.
 */
const realDirectory = (): Directory => ({
  async findByEmail(userPoolId, email) {
    if (email.includes('"') || email.includes("\\")) return [];
    const client = new CognitoIdentityProviderClient({});
    const answer = await client.send(
      new ListUsersCommand({
        UserPoolId: userPoolId,
        Filter: `email = "${email}"`,
        Limit: 10,
      }),
    );
    return (answer.Users ?? []).flatMap((user) => {
      const username = user.Username;
      if (!username) return [];
      /**
       * **Federated-or-not is a different question from which-provider**, and
       * conflating them defeats the guard.
       *
       * `parseFederatedUsername` returns `null` for a provider this pool has
       * not registered, because linking to a name nothing registered cannot
       * succeed. Using it here would then classify that user as **native** —
       * and a native-looking federated account is exactly what the "password
       * onto provider: refuse" branch must not miss.
       *
       * So this asks only whether the username has a provider prefix at all,
       * and keeps the raw one for the message. Cognito's own usernames here
       * are generated UUIDs, which contain no underscore.
       */
      const at = username.indexOf("_");
      const federated = at > 0 && at < username.length - 1;
      return [
        { username, origin: federated ? username.slice(0, at) : "native" },
      ];
    });
  },
  async link({ userPoolId, username, provider, providerSub }) {
    const client = new CognitoIdentityProviderClient({});
    await client.send(
      new AdminLinkProviderForUserCommand({
        UserPoolId: userPoolId,
        // The account that survives, and whose `sub` everything is keyed by.
        DestinationUser: {
          ProviderName: "Cognito",
          ProviderAttributeValue: username,
        },
        // The identity being attached to it.
        SourceUser: {
          ProviderName: provider,
          ProviderAttributeName: "Cognito_Subject",
          ProviderAttributeValue: providerSub,
        },
      }),
    );
  },
});

/**
 * Cognito's contract: throwing refuses the sign-up and the message reaches the
 * client, returning the event allows it.
 *
 * **A failure to look somebody up allows rather than refuses**, which is the
 * one judgement call here. Refusing would lock everybody out of signing up
 * whenever `ListUsers` is briefly unavailable; allowing risks the duplicate
 * account this exists to prevent. A duplicate is recoverable by hand and a
 * sign-up nobody can complete is not, so it allows — and logs loudly, because
 * this is the branch that quietly stops doing its job.
 */
export const handler = async (
  event: PreSignUpEvent,
): Promise<PreSignUpEvent> => {
  const email = event.request?.userAttributes?.email;
  const userPoolId = event.userPoolId;

  let existing: ExistingUser[] = [];
  const dir = directory ?? realDirectory();
  if (email && userPoolId) {
    try {
      existing = await dir.findByEmail(userPoolId, email);
    } catch (error) {
      log("error", "could not look up existing accounts; allowing sign-up", {
        error: String(error),
        triggerSource: event.triggerSource,
      });
      return event;
    }
  }

  const decision = decideLink(event, existing);

  if (decision.action === "allow") {
    // **Every decision says something.** Nothing here is noisy — a sign-up is
    // rare — and the alternative is what happened once already: a trigger that
    // ran and declined to link was indistinguishable in the logs from one that
    // never fired at all.
    log("info", "sign-up allowed without linking", {
      why: decision.why,
      triggerSource: event.triggerSource,
      matches: existing.length,
    });
  }

  if (decision.action === "refuse") {
    log("warn", "sign-up refused", { reason: decision.reason });
    throw new Error(decision.reason);
  }

  if (decision.action === "link" && userPoolId) {
    try {
      await dir.link({
        userPoolId,
        username: decision.to,
        provider: decision.provider,
        providerSub: decision.providerSub,
      });
      log("info", "linked a provider to an existing account", {
        provider: decision.provider,
      });
    } catch (error) {
      // Same reasoning as the lookup: a failed link costs a duplicate account,
      // and refusing costs somebody their sign-in entirely.
      log("error", "could not link provider to existing account", {
        error: String(error),
        provider: decision.provider,
      });
    }
  }

  return event;
};
