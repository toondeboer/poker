import { describe, expect, it } from "vitest";
import { identityFrom, handler } from "../lib/lambda/identity";

describe("who is calling", () => {
  it("is the subject, not the email", () => {
    // `sub` is stable and never reused. An email is a profile attribute that
    // changes when somebody changes it, and nothing is ever keyed by it.
    const identity = identityFrom({ sub: "u-1", email: "a@example.com" });
    expect(identity).toEqual({ accountId: "u-1", email: "a@example.com" });
  });

  it("is still an identity without an email", () => {
    // A token need not carry one — a federated sign-in may not release it.
    expect(identityFrom({ sub: "u-1" })).toEqual({
      accountId: "u-1",
      email: null,
    });
  });

  it("treats an empty email as no email rather than as an address", () => {
    expect(identityFrom({ sub: "u-1", email: "" })?.email).toBeNull();
  });

  it("refuses claims with no subject", () => {
    // Should be impossible: a token without a `sub` would not have been issued.
    // Checked anyway, because that is where the interesting failures live.
    const failures = [undefined, {}, { sub: "" }, { sub: 42 }].filter(
      (claims) => identityFrom(claims as never) !== null,
    );
    expect(failures).toEqual([]);
  });
});

describe("the route", () => {
  it("answers with the caller when the authorizer has done its job", async () => {
    const response = await handler({
      requestContext: { authorizer: { jwt: { claims: { sub: "u-9" } } } },
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      accountId: "u-9",
      email: null,
    });
  });

  it("says unauthenticated, not broken, when there are no claims", async () => {
    // The authorizer should have made this unreachable. If it somehow did not,
    // the honest answer is that we do not know who this is.
    const response = await handler({});
    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body)).toEqual({ error: "unauthenticated" });
  });

  it("never echoes anything it was not given", async () => {
    // A handler that reflected the request would be a handler that eventually
    // reflects a token into a log.
    const response = await handler({
      requestContext: {
        authorizer: {
          jwt: { claims: { sub: "u-9", secret: "do-not-echo" } },
        },
      },
    });
    expect(response.body).not.toContain("do-not-echo");
  });
});
