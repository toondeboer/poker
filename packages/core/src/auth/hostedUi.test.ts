import { describe, expect, it } from "vitest";
import {
  authorizeUrl,
  hostedTokensFrom,
  isValidCodeVerifier,
  readRedirect,
  tokenExchangeCall,
  type HostedUiConfig,
} from "./hostedUi";
import type { CognitoConfig } from "./cognito";

const config: CognitoConfig = {
  region: "us-east-1",
  userPoolId: "us-east-1_abc",
  clientId: "client-123",
};

const hosted: HostedUiConfig = {
  domain: "https://pokerkit.auth.us-east-1.amazoncognito.com",
  redirectUri: "pokerkit://auth",
};

const params = (of: string) => new URL(of).searchParams;

describe("the URL that starts a sign-in", () => {
  it("goes straight to the provider rather than Cognito's own form", () => {
    // Without `identity_provider` the person lands on a hosted login page
    // asking for a password they may not have.
    const url = authorizeUrl(config, hosted, {
      provider: "SignInWithApple",
      codeChallenge: "challenge",
      state: "state-1",
    });
    expect(params(url).get("identity_provider")).toBe("SignInWithApple");
    expect(url.startsWith(`${hosted.domain}/oauth2/authorize?`)).toBe(true);
  });

  it("asks for the code flow and never the implicit one", () => {
    // The implicit flow returns tokens in a URL fragment, where they reach
    // browser history and every handler on the way back.
    const url = authorizeUrl(config, hosted, {
      provider: "Google",
      codeChallenge: "challenge",
      state: "s",
    });
    expect(params(url).get("response_type")).toBe("code");
  });

  it("carries the PKCE challenge as S256", () => {
    // The code comes back through a custom scheme any app on the device can
    // claim. Without this, intercepting it is enough.
    const url = authorizeUrl(config, hosted, {
      provider: "Google",
      codeChallenge: "abc-123",
      state: "s",
    });
    expect(params(url).get("code_challenge")).toBe("abc-123");
    expect(params(url).get("code_challenge_method")).toBe("S256");
  });

  it("asks for the three scopes an account needs", () => {
    const url = authorizeUrl(config, hosted, {
      provider: "Google",
      codeChallenge: "c",
      state: "s",
    });
    // `openid` makes it an id token at all; `email` is what the linking
    // trigger matches on.
    expect(params(url).get("scope")).toBe("openid email profile");
  });

  it("encodes a redirect URI that is not an https URL", () => {
    // `pokerkit://auth` has to survive being a query parameter.
    const url = authorizeUrl(config, hosted, {
      provider: "Google",
      codeChallenge: "c",
      state: "s",
    });
    expect(url).toContain("redirect_uri=pokerkit%3A%2F%2Fauth");
    expect(params(url).get("redirect_uri")).toBe("pokerkit://auth");
  });

  it("does not double up the slash on a domain with a trailing one", () => {
    const url = authorizeUrl(
      config,
      { ...hosted, domain: `${hosted.domain}/` },
      { provider: "Google", codeChallenge: "c", state: "s" },
    );
    expect(url).toContain(".com/oauth2/authorize?");
  });
});

describe("the PKCE verifier", () => {
  it("accepts what RFC 7636 allows", () => {
    expect(isValidCodeVerifier("a".repeat(43))).toBe(true);
    expect(isValidCodeVerifier("a".repeat(128))).toBe(true);
    expect(isValidCodeVerifier(`${"a".repeat(40)}-._~`)).toBe(true);
  });

  it("refuses what the token endpoint would only call invalid_grant", () => {
    // The remote failure is the same message as an expired code, a reused code
    // and a mismatched redirect — so it is worth failing locally instead.
    expect(isValidCodeVerifier("a".repeat(42))).toBe(false);
    expect(isValidCodeVerifier("a".repeat(129))).toBe(false);
    expect(isValidCodeVerifier(`${"a".repeat(42)}+`)).toBe(false);
    expect(isValidCodeVerifier(`${"a".repeat(42)}/`)).toBe(false);
    expect(isValidCodeVerifier("")).toBe(false);
  });
});

describe("reading the redirect back", () => {
  it("finds the code and the state", () => {
    expect(readRedirect("pokerkit://auth?code=abc&state=xyz")).toEqual({
      status: "code",
      code: "abc",
      state: "xyz",
    });
  });

  it("reports a refusal rather than treating it as missing", () => {
    // Cancelling at the provider is an ordinary outcome, not a failure.
    expect(
      readRedirect("pokerkit://auth?error=access_denied&state=xyz"),
    ).toEqual({ status: "error", error: "access_denied", state: "xyz" });
  });

  it("prefers the error when both somehow appear", () => {
    const result = readRedirect("pokerkit://auth?code=abc&error=bad");
    expect(result.status).toBe("error");
  });

  it("decodes percent-encoding and plus-as-space", () => {
    const result = readRedirect(
      "pokerkit://auth?error=access%20denied&state=a+b",
    );
    expect(result).toEqual({
      status: "error",
      error: "access denied",
      state: "a b",
    });
  });

  it("is unusable rather than wrong for a redirect carrying nothing", () => {
    expect(readRedirect("pokerkit://auth")).toEqual({ status: "unusable" });
    expect(readRedirect("pokerkit://auth?")).toEqual({ status: "unusable" });
    expect(readRedirect("pokerkit://auth?foo=bar")).toEqual({
      status: "unusable",
    });
  });

  it("returns the state rather than checking it", () => {
    // This cannot know what was sent. Comparing it here would be comparing it
    // to nothing.
    const result = readRedirect("pokerkit://auth?code=a&state=from-provider");
    expect(result.status === "code" && result.state).toBe("from-provider");
  });
});

describe("exchanging the code", () => {
  it("posts form-encoded, not JSON", () => {
    // The token endpoint answers `invalid_request` to JSON, which reads like a
    // problem with the values rather than with the encoding.
    const call = tokenExchangeCall(config, hosted, {
      code: "the-code",
      codeVerifier: "v".repeat(43),
    });
    expect(call.headers["content-type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(call.url).toBe(`${hosted.domain}/oauth2/token`);
  });

  it("sends no client secret, because the client is public", () => {
    const call = tokenExchangeCall(config, hosted, {
      code: "c",
      codeVerifier: "v".repeat(43),
    });
    expect(call.body).not.toContain("client_secret");
    expect(call.body).toContain("grant_type=authorization_code");
    expect(call.body).toContain("code_verifier=");
  });

  it("repeats the redirect URI, which the endpoint checks", () => {
    const call = tokenExchangeCall(config, hosted, {
      code: "c",
      codeVerifier: "v".repeat(43),
    });
    expect(call.body).toContain("redirect_uri=pokerkit%3A%2F%2Fauth");
  });
});

describe("tokens out of the hosted UI's answer", () => {
  it("reads the flat, snake-cased shape the OAuth endpoint returns", () => {
    // **A different shape from every other call in `cognito.ts`**, which
    // answers `{AuthenticationResult: {IdToken, …}}`. Passing one to the
    // other's parser returns null, which looks exactly like a refused sign-in.
    const tokens = hostedTokensFrom(
      {
        id_token: "id",
        access_token: "access",
        refresh_token: "refresh",
        expires_in: 3600,
      },
      1_000,
    );
    expect(tokens).toEqual({
      idToken: "id",
      accessToken: "access",
      refreshToken: "refresh",
      expiresAt: 1_000 + 3600 * 1000,
    });
  });

  it("refuses an answer with no refresh token", () => {
    // Without one the session ends silently in an hour.
    expect(
      hostedTokensFrom(
        { id_token: "id", access_token: "access", expires_in: 3600 },
        0,
      ),
    ).toBeNull();
  });

  it("refuses an error body rather than half-reading it", () => {
    expect(hostedTokensFrom({ error: "invalid_grant" }, 0)).toBeNull();
    expect(hostedTokensFrom(null, 0)).toBeNull();
    expect(hostedTokensFrom("nope", 0)).toBeNull();
  });
});
