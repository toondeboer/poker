import { describe, expect, it } from "vitest";
import {
  EXPIRY_SLACK_MS,
  accountFromIdToken,
  decodeBase64Url,
  confirmSignUpCall,
  deleteAccountCall,
  errorFrom,
  needsRefresh,
  refreshCall,
  resendCodeCall,
  signInCall,
  signOutCall,
  signUpCall,
  tokensFrom,
  type CognitoConfig,
} from "./cognito";

const CONFIG: CognitoConfig = {
  region: "eu-west-1",
  userPoolId: "eu-west-1_abc123",
  clientId: "client-1",
};

const bodyOf = (call: { body: string }) =>
  JSON.parse(call.body) as Record<string, unknown>;

describe("where the calls go", () => {
  it("is the regional endpoint, derived rather than configured", () => {
    // One fewer thing to get wrong in an environment file, and one fewer way
    // for dev to be pointed at prod.
    expect(signInCall(CONFIG, "a@b.com", "pw").url).toBe(
      "https://cognito-idp.eu-west-1.amazonaws.com/",
    );
  });

  it("names the action in the header, the way this API works", () => {
    expect(signUpCall(CONFIG, "a@b.com", "pw").headers["x-amz-target"]).toBe(
      "AWSCognitoIdentityProviderService.SignUp",
    );
  });

  it("uses the JSON 1.1 content type Cognito requires", () => {
    // A plain `application/json` is refused, and the error says nothing useful.
    expect(signInCall(CONFIG, "a@b.com", "pw").headers["content-type"]).toBe(
      "application/x-amz-json-1.1",
    );
  });

  it("carries the client id on everything that needs one", () => {
    const failures = [
      signUpCall(CONFIG, "a@b.com", "pw"),
      confirmSignUpCall(CONFIG, "a@b.com", "123456"),
      resendCodeCall(CONFIG, "a@b.com"),
      signInCall(CONFIG, "a@b.com", "pw"),
      refreshCall(CONFIG, "r"),
    ].filter((made) => bodyOf(made).ClientId !== "client-1");
    expect(failures).toEqual([]);
  });

  it("never sends the client id with a token-authenticated call", () => {
    // `GlobalSignOut` and `DeleteUser` are authorised by the access token.
    // Sending a client id as well is not wrong, it is noise that invites the
    // idea that one of these could be called without a token.
    expect(bodyOf(signOutCall(CONFIG, "at")).ClientId).toBeUndefined();
    expect(bodyOf(deleteAccountCall(CONFIG, "at")).ClientId).toBeUndefined();
  });
});

describe("signing up", () => {
  it("sends the email as the username and as an attribute", () => {
    // Both, deliberately: an account whose username is its email cannot change
    // that email without changing who it is, which is why nothing is keyed by
    // the attribute either.
    const body = bodyOf(signUpCall(CONFIG, "a@b.com", "hunter2hunter"));
    expect(body.Username).toBe("a@b.com");
    expect(body.UserAttributes).toEqual([{ Name: "email", Value: "a@b.com" }]);
  });

  it("asks for the code to be sent again", () => {
    expect(resendCodeCall(CONFIG, "a@b.com").headers["x-amz-target"]).toContain(
      "ResendConfirmationCode",
    );
  });
});

describe("signing in", () => {
  it("uses the password flow, which is the one available without a library", () => {
    const body = bodyOf(signInCall(CONFIG, "a@b.com", "pw"));
    expect(body.AuthFlow).toBe("USER_PASSWORD_AUTH");
    expect(body.AuthParameters).toEqual({
      USERNAME: "a@b.com",
      PASSWORD: "pw",
    });
  });

  it("refreshes with the refresh token and nothing else", () => {
    const body = bodyOf(refreshCall(CONFIG, "r-1"));
    expect(body.AuthFlow).toBe("REFRESH_TOKEN_AUTH");
    expect(body.AuthParameters).toEqual({ REFRESH_TOKEN: "r-1" });
    // No password anywhere near a refresh.
    expect(JSON.stringify(body)).not.toContain("PASSWORD");
  });
});

describe("signing out", () => {
  it("ends every session rather than forgetting this one", () => {
    // A phone handed to somebody else is the case this exists for. Forgetting
    // locally leaves the refresh token valid for its full ninety days.
    expect(signOutCall(CONFIG, "at").headers["x-amz-target"]).toContain(
      "GlobalSignOut",
    );
    expect(bodyOf(signOutCall(CONFIG, "at")).AccessToken).toBe("at");
  });
});

describe("reading the tokens back", () => {
  it("anchors expiry on the local clock at receipt", () => {
    // Same reason the shared timer does: the server's notion of now is not
    // comparable to this device's.
    const tokens = tokensFrom(
      {
        AuthenticationResult: {
          IdToken: "id",
          AccessToken: "ac",
          RefreshToken: "re",
          ExpiresIn: 3600,
        },
      },
      1_000_000,
    );
    expect(tokens?.expiresAt).toBe(1_000_000 + 3_600_000);
  });

  it("keeps the refresh token a refresh response does not return", () => {
    // Cognito reuses the one you sent. Reading `RefreshToken` here and storing
    // `undefined` is how a session ends after an hour instead of ninety days.
    const refreshed = tokensFrom(
      {
        AuthenticationResult: {
          IdToken: "id2",
          AccessToken: "ac2",
          ExpiresIn: 3600,
        },
      },
      0,
      "the-original",
    );
    expect(refreshed?.refreshToken).toBe("the-original");
  });

  it("refuses a challenge, which is not a signed-in session", () => {
    // Cognito answers `ChallengeName` instead of a result when it wants
    // something else. Treating that as success signs nobody in and looks it.
    expect(
      tokensFrom({ ChallengeName: "NEW_PASSWORD_REQUIRED", Session: "s" }, 0),
    ).toBeNull();
  });

  it("refuses anything missing a token it needs", () => {
    const failures = [
      {},
      null,
      "nope",
      { AuthenticationResult: null },
      { AuthenticationResult: { IdToken: "id" } },
      { AuthenticationResult: { IdToken: "id", AccessToken: "ac" } },
    ].filter((body) => tokensFrom(body, 0) !== null);
    expect(failures).toEqual([]);
  });

  it("assumes an hour when Cognito does not say", () => {
    const tokens = tokensFrom(
      { AuthenticationResult: { IdToken: "i", AccessToken: "a", RefreshToken: "r" } },
      0,
    );
    expect(tokens?.expiresAt).toBe(3_600_000);
  });
});

describe("knowing when to refresh", () => {
  const tokens = {
    idToken: "i",
    accessToken: "a",
    refreshToken: "r",
    expiresAt: 1_000_000,
  };

  it("refreshes before expiry, not after", () => {
    // A token that expires while the request is in flight fails exactly as
    // hard as one that expired an hour ago.
    expect(needsRefresh(tokens, 1_000_000 - EXPIRY_SLACK_MS)).toBe(true);
    expect(needsRefresh(tokens, 1_000_000 - EXPIRY_SLACK_MS - 1)).toBe(false);
  });

  it("refreshes something already expired", () => {
    expect(needsRefresh(tokens, 2_000_000)).toBe(true);
  });
});

describe("what went wrong, in words a form can show", () => {
  it("recognises the ones a person can act on", () => {
    const cases: [string, string][] = [
      ["UsernameExistsException", "email-taken"],
      ["UserNotFoundException", "email-unknown"],
      ["NotAuthorizedException", "credentials-wrong"],
      ["CodeMismatchException", "code-wrong"],
      ["ExpiredCodeException", "code-expired"],
      ["UserNotConfirmedException", "not-confirmed"],
      ["InvalidPasswordException", "password-weak"],
      ["TooManyRequestsException", "too-many-attempts"],
    ];
    const failures = cases.filter(
      ([name, expected]) => errorFrom({ __type: name }) !== expected,
    );
    expect(failures).toEqual([]);
  });

  it("strips the URL Cognito sometimes appends", () => {
    // `NotAuthorizedException:https://…` is a real response body.
    expect(
      errorFrom({ __type: "NotAuthorizedException:https://example.com/doc" }),
    ).toBe("credentials-wrong");
  });

  it("strips the namespace prefix too", () => {
    expect(errorFrom({ __type: "com.amazon.coral.service#CodeMismatchException" })).toBe(
      "code-wrong",
    );
  });

  it("says nothing rather than guessing at a name it does not know", () => {
    // A wrong guess here shows somebody the wrong instruction, which is worse
    // than "that didn't work".
    const failures = [
      { __type: "SomeNewException" },
      { __type: 42 },
      {},
      null,
      "a string",
    ].filter((body) => errorFrom(body) !== null);
    expect(failures).toEqual([]);
  });
});

describe("reading a token this device already had", () => {
  /** Build a JWT-shaped string. Only the payload matters here. */
  const jwt = (claims: Record<string, unknown>): string => {
    const payload = base64url(JSON.stringify(claims));
    return `header.${payload}.signature`;
  };

  const base64url = (value: string): string => {
    const alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const bytes: number[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const code = value.codePointAt(index)!;
      if (code < 0x80) bytes.push(code);
      else if (code < 0x800) {
        bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else if (code < 0x10000) {
        bytes.push(
          0xe0 | (code >> 12),
          0x80 | ((code >> 6) & 0x3f),
          0x80 | (code & 0x3f),
        );
      } else {
        index += 1; // consumed a surrogate pair
        bytes.push(
          0xf0 | (code >> 18),
          0x80 | ((code >> 12) & 0x3f),
          0x80 | ((code >> 6) & 0x3f),
          0x80 | (code & 0x3f),
        );
      }
    }
    let out = "";
    for (let index = 0; index < bytes.length; index += 3) {
      const chunk = bytes.slice(index, index + 3);
      const value24 =
        (chunk[0] << 16) | ((chunk[1] ?? 0) << 8) | (chunk[2] ?? 0);
      const digits = [18, 12, 6, 0].map((shift) => (value24 >> shift) & 0x3f);
      out += digits
        .slice(0, chunk.length + 1)
        .map((digit) => alphabet[digit])
        .join("");
    }
    return out;
  };

  it("finds the subject and the email", () => {
    expect(accountFromIdToken(jwt({ sub: "u-1", email: "a@b.com" }))).toEqual({
      id: "u-1",
      email: "a@b.com",
    });
  });

  it("survives an address that is not ASCII", () => {
    // A decoder that assumes ASCII mangles somebody's name on the one screen
    // that shows it back to them.
    expect(
      accountFromIdToken(jwt({ sub: "u-1", email: "jörg@münchen.example" })),
    ).toEqual({ id: "u-1", email: "jörg@münchen.example" });
  });

  it("survives something outside the basic plane", () => {
    // Emoji in a display name is not hypothetical, and it needs a surrogate
    // pair rather than one code unit.
    expect(accountFromIdToken(jwt({ sub: "u-1", email: "🂡@example.com" }))?.email).toBe(
      "🂡@example.com",
    );
  });

  it("does not need padding, and tolerates it", () => {
    const payload = base64url(JSON.stringify({ sub: "u-1" }));
    expect(decodeBase64Url(payload)).toBe('{"sub":"u-1"}');
    expect(decodeBase64Url(`${payload}==`)).toBe('{"sub":"u-1"}');
  });

  it("uses the base64url alphabet, not base64's", () => {
    // `-` and `_` where base64 has `+` and `/`. A decoder expecting the other
    // throws on some payloads and silently truncates others — so this looks
    // for real payloads that exercise those two characters rather than
    // hand-computing one, and round-trips them.
    const candidates = [
      '{"sub":"u~1"}',
      '{"sub":"ü?"}',
      '{"email":"a~b?@c.example"}',
      '{"email":"???~~~"}',
      '{"sub":"\u00fe\u00ff"}',
    ];
    const encoded = candidates.map(base64url);
    expect(
      encoded.some((value) => value.includes("-") || value.includes("_")),
    ).toBe(true);

    const failures = candidates.filter(
      (original, index) => decodeBase64Url(encoded[index]) !== original,
    );
    expect(failures).toEqual([]);

    // base64's own alphabet is refused, rather than quietly decoded to
    // something else.
    expect(decodeBase64Url("ab+/")).toBeNull();
  });

  it("gives up on anything malformed rather than half-decoding it", () => {
    const failures = [
      "not-a-jwt",
      "only.two",
      "a.b.c.d",
      "header..signature",
      "header.!!!!.signature",
      // Valid base64url, but not JSON.
      `header.${base64url("not json")}.signature`,
      // JSON, but nothing that identifies anybody.
      `header.${base64url("{}")}.signature`,
      `header.${base64url('{"sub":""}')}.signature`,
      `header.${base64url('{"sub":42}')}.signature`,
      `header.${base64url("[1,2,3]")}.signature`,
      // Valid JSON that is literally `null`, which `typeof` calls an object.
      `header.${base64url("null")}.signature`,
    ].filter((token) => accountFromIdToken(token) !== null);
    expect(failures).toEqual([]);
  });

  it("accepts a token with no email, because a federated one may not carry it", () => {
    expect(accountFromIdToken(jwt({ sub: "u-1" }))).toEqual({
      id: "u-1",
      email: "",
    });
  });

  it("survives the three-byte range, which is most of the world's scripts", () => {
    // Two-byte covers Latin accents and four-byte covers emoji; everything
    // between — CJK, Cyrillic beyond Latin-1, the euro sign — is three, and it
    // is the range an ASCII-shaped decoder gets wrong most often.
    const token = jwt({ sub: "u-1", email: "日本語@example.com" });
    expect(accountFromIdToken(token)?.email).toBe("日本語@example.com");
    expect(decodeBase64Url(base64url("€20 buy-in"))).toBe("€20 buy-in");
  });

  it("refuses a multi-byte character that was cut off", () => {
    // A truncated payload decodes to a string that is *nearly* right, which is
    // worse than one that fails: the JSON parses and a name is wrong.
    const full = base64url("é");
    expect(decodeBase64Url(full)).toBe("é");
    expect(decodeBase64Url(full.slice(0, 2))).toBeNull();
  });

  it("refuses bytes that are not UTF-8 at all", () => {
    // A continuation byte where a leading byte should be. Decoding it as
    // something would produce a string nobody sent.
    expect(decodeBase64Url("gA")).toBeNull();
    expect(decodeBase64Url("-A")).toBeNull();
    // A valid two-byte leading byte (0xc3) followed by an ASCII letter rather
    // than a continuation byte. The sequence starts well and is still wrong.
    expect(decodeBase64Url("w0E")).toBeNull();
  });
});
