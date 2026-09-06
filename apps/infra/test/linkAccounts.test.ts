import { afterEach, describe, expect, it } from "vitest";
import {
  decideLink,
  handler,
  parseFederatedUsername,
  useDirectory,
  type Directory,
  type ExistingUser,
  type PreSignUpEvent,
} from "../lib/lambda/linkAccounts";

const federated = (over: Partial<PreSignUpEvent> = {}): PreSignUpEvent => ({
  triggerSource: "PreSignUp_ExternalProvider",
  userName: "Google_1234567",
  userPoolId: "pool-1",
  request: {
    userAttributes: { email: "ann@example.com", email_verified: "true" },
  },
  ...over,
});

const native = (over: Partial<PreSignUpEvent> = {}): PreSignUpEvent => ({
  triggerSource: "PreSignUp_SignUp",
  userName: "ann@example.com",
  userPoolId: "pool-1",
  request: { userAttributes: { email: "ann@example.com" } },
  ...over,
});

const nativeUser: ExistingUser = { username: "abc-123", origin: "native" };
const googleUser: ExistingUser = { username: "Google_999", origin: "Google" };

afterEach(() => useDirectory(null));

describe("splitting a federated username", () => {
  it("takes the provider and the subject apart", () => {
    expect(parseFederatedUsername("Google_1234567")).toEqual({
      provider: "Google",
      sub: "1234567",
    });
  });

  it("splits on the first underscore only", () => {
    // **A provider subject can contain underscores.** Splitting on all of them
    // truncates the id to its first segment, which does not fail — it links a
    // different identity, or none, and looks like the trigger not running.
    expect(parseFederatedUsername("SignInWithApple_00_11_22")).toEqual({
      provider: "SignInWithApple",
      sub: "00_11_22",
    });
  });

  it("refuses a shape it cannot split", () => {
    expect(parseFederatedUsername("noseparator")).toBeNull();
    expect(parseFederatedUsername("_leading")).toBeNull();
    expect(parseFederatedUsername("trailing_")).toBeNull();
    expect(parseFederatedUsername(undefined)).toBeNull();
  });
});

describe("the provider's name as Cognito registered it", () => {
  it("corrects the casing Cognito uses in the username", () => {
    // **Observed, not guessed.** A real Apple sign-in against the dev pool on
    // 2026-09-06 produced the username
    // `signinwithapple_001004.951dcae980fd441fb4c4fbd2a30cd6d5.1603` — while
    // the identity provider is registered as `SignInWithApple`.
    // `AdminLinkProviderForUser` matches case-sensitively, so passing the
    // prefix straight through fails, and the handler treats a failed link as
    // allow-and-log — producing the silent duplicate this file exists to stop.
    expect(parseFederatedUsername("signinwithapple_001004.abc.1603")).toEqual({
      provider: "SignInWithApple",
      sub: "001004.abc.1603",
    });
    expect(parseFederatedUsername("google_12345")).toEqual({
      provider: "Google",
      sub: "12345",
    });
    // Already correct stays correct.
    expect(parseFederatedUsername("Google_12345")?.provider).toBe("Google");
  });

  it("refuses a provider this pool has not registered", () => {
    // Linking to a name nothing registered cannot succeed, and guessing at the
    // capitalisation of a provider added later is how this breaks again.
    expect(parseFederatedUsername("Facebook_123")).toBeNull();
    expect(
      decideLink(federated({ userName: "Facebook_123" }), [nativeUser]),
    ).toEqual({ action: "allow", why: "unknown-provider" });
  });

  it("still links with the corrected name end to end", () => {
    const decision = decideLink(federated({ userName: "signinwithapple_9" }), [
      nativeUser,
    ]);
    expect(decision).toEqual({
      action: "link",
      to: "abc-123",
      provider: "SignInWithApple",
      providerSub: "9",
    });
  });
});

describe("a provider arriving for somebody who already has a password", () => {
  it("links the two rather than making a second account", () => {
    // The whole point. Without this the person signs in successfully and finds
    // an empty account where their season was.
    expect(decideLink(federated(), [nativeUser])).toEqual({
      action: "link",
      to: "abc-123",
      provider: "Google",
      providerSub: "1234567",
    });
  });

  it("allows a brand-new person through untouched", () => {
    expect(decideLink(federated(), [])).toEqual({
      action: "allow",
      why: "no-account-to-link",
    });
  });

  it("does not link a second provider onto the first", () => {
    // Two providers for one address is not this trigger's business — there is
    // no native account to be the destination, and picking one federated
    // account to absorb another is a decision nothing here is entitled to make.
    expect(decideLink(federated(), [googleUser])).toEqual({
      action: "allow",
      why: "no-account-to-link",
    });
  });
});

describe("the email_verified guard", () => {
  it("refuses to link an address the provider has not verified", () => {
    // **This is the security boundary of the whole file.** Without it, any
    // provider that lets somebody register an address they do not own is a way
    // to inherit that person's account here.
    const unverified = federated({
      request: {
        userAttributes: { email: "ann@example.com", email_verified: "false" },
      },
    });
    expect(decideLink(unverified, [nativeUser])).toEqual({
      action: "allow",
      why: "email-unverified",
    });
  });

  it("treats a missing claim as unverified", () => {
    const absent = federated({
      request: { userAttributes: { email: "ann@example.com" } },
    });
    expect(decideLink(absent, [nativeUser])).toEqual({
      action: "allow",
      why: "email-unverified",
    });
  });

  it("is not satisfied by a truthy-looking value", () => {
    // Cognito sends these as strings. `"TRUE"` and `"1"` are not what it sends,
    // so accepting them would only ever loosen the guard.
    for (const value of ["TRUE", "True", "1", "yes"]) {
      const odd = federated({
        request: {
          userAttributes: { email: "ann@example.com", email_verified: value },
        },
      });
      expect(decideLink(odd, [nativeUser])).toEqual({
        action: "allow",
        why: "email-unverified",
      });
    }
  });
});

describe("a password sign-up for an address a provider already owns", () => {
  it("refuses, and says which provider to use", () => {
    // **Not symmetrical with linking.** Allowing this lets anybody who knows an
    // address put a password on somebody else's Google-backed account, with no
    // prompt to the owner.
    const decision = decideLink(native(), [googleUser]);
    expect(decision.action).toBe("refuse");
    expect(decision.action === "refuse" && decision.reason).toContain("Google");
  });

  it("allows an ordinary sign-up for an address nobody has", () => {
    expect(decideLink(native(), [])).toEqual({
      action: "allow",
      why: "not-federated",
    });
  });

  it("allows one for an address only a native account has", () => {
    // Cognito's own duplicate-email handling owns this case; refusing here
    // would change an error it already reports well into a different one.
    expect(decideLink(native(), [nativeUser])).toEqual({
      action: "allow",
      why: "not-federated",
    });
  });
});

describe("an event with no email at all", () => {
  it("is allowed rather than guessed at", () => {
    const anonymous = federated({ request: { userAttributes: {} } });
    expect(decideLink(anonymous, [nativeUser])).toEqual({
      action: "allow",
      why: "no-email",
    });
  });
});

describe("the handler", () => {
  const spyDirectory = (
    users: ExistingUser[],
  ): { linked: unknown[]; directory: Directory } => {
    const linked: unknown[] = [];
    return {
      linked,
      directory: {
        async findByEmail() {
          return users;
        },
        async link(params) {
          linked.push(params);
        },
      },
    };
  };

  it("links, and returns the event so Cognito carries on", async () => {
    const { linked, directory } = spyDirectory([nativeUser]);
    useDirectory(directory);
    const event = federated();
    await expect(handler(event)).resolves.toBe(event);
    expect(linked).toEqual([
      {
        userPoolId: "pool-1",
        username: "abc-123",
        provider: "Google",
        providerSub: "1234567",
      },
    ]);
  });

  it("throws on a refusal, because that is how Cognito is told", async () => {
    const { directory } = spyDirectory([googleUser]);
    useDirectory(directory);
    await expect(handler(native())).rejects.toThrow(/Google/);
  });

  it("allows the sign-up when the directory cannot be read", async () => {
    // **The judgement call.** Refusing would stop everybody signing up whenever
    // `ListUsers` is briefly unavailable; allowing risks one duplicate account,
    // which a person can fix and a sign-up nobody can complete is not.
    useDirectory({
      async findByEmail() {
        throw new Error("throttled");
      },
      async link() {
        throw new Error("should not be reached");
      },
    });
    const event = federated();
    await expect(handler(event)).resolves.toBe(event);
  });

  it("allows the sign-up when the link itself fails", async () => {
    // Same trade, one step later: a failed link costs a duplicate, and throwing
    // here would cost the person their sign-in entirely.
    useDirectory({
      async findByEmail() {
        return [nativeUser];
      },
      async link() {
        throw new Error("nope");
      },
    });
    const event = federated();
    await expect(handler(event)).resolves.toBe(event);
  });
});
