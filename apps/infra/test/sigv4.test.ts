import { describe, expect, it } from "vitest";
import {
  amzDate,
  canonicalRequest,
  credentialsFromEnvironment,
  signRequest,
} from "../lib/lambda/sigv4";

/**
 * AWS's own published test credentials, from the SigV4 test suite. Using them
 * means the expected values below are AWS's answers rather than this
 * implementation's — which is the only way to check an algorithm like this
 * without a network.
 */
const AWS_TEST_CREDENTIALS = {
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
};
const AWS_TEST_DATE = new Date("2015-08-30T12:36:00Z");

describe("against AWS's published vectors", () => {
  it("produces the get-vanilla signature exactly", () => {
    // The canonical example from the SigV4 test suite. If this passes, the
    // header canonicalisation, the scope, the key derivation and the string to
    // sign are all right — there is no way to get this value by accident.
    const headers = signRequest(
      {
        method: "GET",
        url: "https://example.amazonaws.com/",
        body: "",
        region: "us-east-1",
        service: "service",
      },
      AWS_TEST_CREDENTIALS,
      AWS_TEST_DATE,
    );

    expect(headers.authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, " +
        "SignedHeaders=host;x-amz-date, " +
        "Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31",
    );
  });

  it("builds the canonical request AWS builds", () => {
    // Compared separately from the signature, because "the signature is wrong"
    // and "the header collapsing is wrong" are the same symptom and very
    // different afternoons.
    const { canonical } = canonicalRequest(
      {
        method: "GET",
        url: "https://example.amazonaws.com/",
        body: "",
        region: "us-east-1",
        service: "service",
      },
      { host: "example.amazonaws.com", "x-amz-date": "20150830T123600Z" },
    );

    expect(canonical).toBe(
      [
        "GET",
        "/",
        "",
        "host:example.amazonaws.com",
        "x-amz-date:20150830T123600Z",
        "",
        "host;x-amz-date",
        // SHA-256 of the empty string.
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      ].join("\n"),
    );
  });
});

describe("the parts that are silently wrong when they are wrong", () => {
  it("lowercases and sorts header names", () => {
    const { canonical, signedHeaders } = canonicalRequest(
      {
        method: "POST",
        url: "https://example.com/event",
        body: "{}",
        region: "eu-west-1",
        service: "appsync",
      },
      { "X-Amz-Date": "20150830T123600Z", Host: "example.com", Zebra: "z" },
    );
    expect(signedHeaders).toBe("host;x-amz-date;zebra");
    expect(canonical).toContain("host:example.com\n");
  });

  it("trims values and collapses the whitespace inside them", () => {
    // In the specification and easy to skip. A header that arrives with two
    // spaces signs differently from the one AWS rebuilds with one.
    const { canonical } = canonicalRequest(
      {
        method: "POST",
        url: "https://example.com/",
        body: "",
        region: "eu-west-1",
        service: "appsync",
      },
      { host: "example.com", "x-test": "  a   b  " },
    );
    expect(canonical).toContain("x-test:a b\n");
  });

  it("signs the payload, not just the headers", () => {
    // Otherwise a request could be intercepted and its body swapped for
    // another while the signature stayed valid.
    const sign = (body: string) =>
      signRequest(
        {
          method: "POST",
          url: "https://example.com/event",
          body,
          region: "eu-west-1",
          service: "appsync",
        },
        AWS_TEST_CREDENTIALS,
        AWS_TEST_DATE,
      ).authorization;
    expect(sign('{"a":1}')).not.toBe(sign('{"a":2}'));
  });

  it("includes the session token in the signature rather than beside it", () => {
    // A Lambda always has temporary credentials. Adding the token as a header
    // afterwards produces a signature AWS rebuilds differently.
    const withToken = signRequest(
      {
        method: "POST",
        url: "https://example.com/event",
        body: "{}",
        region: "eu-west-1",
        service: "appsync",
      },
      { ...AWS_TEST_CREDENTIALS, sessionToken: "token" },
      AWS_TEST_DATE,
    );
    expect(withToken["x-amz-security-token"]).toBe("token");
    expect(withToken.authorization).toContain("x-amz-security-token");
  });

  it("scopes the signature to the region and service", () => {
    // A signature valid for one service in one region and nowhere else, which
    // is most of what SigV4 is for.
    const headers = signRequest(
      {
        method: "POST",
        url: "https://example.com/event",
        body: "{}",
        region: "eu-west-1",
        service: "appsync",
      },
      AWS_TEST_CREDENTIALS,
      AWS_TEST_DATE,
    );
    expect(headers.authorization).toContain(
      "Credential=AKIDEXAMPLE/20150830/eu-west-1/appsync/aws4_request",
    );
  });

  it("sorts and encodes the query string the way SigV4 wants", () => {
    // `encodeURIComponent` leaves `!'()*` alone and SigV4 does not.
    const { canonical } = canonicalRequest(
      {
        method: "GET",
        url: "https://example.com/?b=2&a=hello*world",
        body: "",
        region: "eu-west-1",
        service: "appsync",
      },
      { host: "example.com" },
    );
    expect(canonical.split("\n")[2]).toBe("a=hello%2Aworld&b=2");
  });
});

describe("the timestamp", () => {
  it("is the basic format, which is the only one accepted", () => {
    expect(amzDate(new Date("2026-08-27T09:05:03.123Z"))).toBe("20260827T090503Z");
  });
});

describe("credentials", () => {
  it("come from the environment a Lambda is given them in", () => {
    expect(
      credentialsFromEnvironment({
        AWS_ACCESS_KEY_ID: "a",
        AWS_SECRET_ACCESS_KEY: "s",
        AWS_SESSION_TOKEN: "t",
      }),
    ).toEqual({ accessKeyId: "a", secretAccessKey: "s", sessionToken: "t" });
  });

  it("are absent rather than half-present", () => {
    // Running outside Lambda looks exactly like this, and the caller should be
    // able to say "publishing is not configured" instead of dying.
    const failures = [
      {},
      { AWS_ACCESS_KEY_ID: "a" },
      { AWS_SECRET_ACCESS_KEY: "s" },
    ].filter((environment) => credentialsFromEnvironment(environment) !== null);
    expect(failures).toEqual([]);
  });
});
