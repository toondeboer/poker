/**
 * Signature Version 4, by hand.
 *
 * Publishing to AppSync Events over HTTP means an IAM-signed request, and the
 * options were a dependency or a hundred lines. This is the hundred lines, for
 * three reasons: `node:crypto` is in the Lambda runtime and needs no bundling,
 * SigV4 has **published test vectors** so the implementation can be checked
 * against AWS's own answers rather than against itself, and the failure mode
 * is safe — a wrong signature is *rejected*, so a bug here means nothing
 * publishes, never that somebody else can.
 *
 * The algorithm is fiddly in ways that are all specified: headers lowercased
 * and sorted, values trimmed and inner whitespace collapsed, the payload
 * hashed even when empty, and a key derived through four chained HMACs. Each
 * of those has a test below, because each of them silently produces a
 * signature that is merely *wrong* rather than an error.
 */

import { createHash, createHmac } from "node:crypto";

export type Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
  /** Present for the temporary credentials a Lambda always has. */
  sessionToken?: string;
};

export type SignableRequest = {
  method: string;
  /** Full URL. The host header and the canonical path both come from it. */
  url: string;
  /** Anything beyond `host` and the `x-amz-*` this adds. Case-insensitive. */
  headers?: Record<string, string>;
  body: string;
  region: string;
  service: string;
};

const sha256Hex = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");

const hmac = (key: Buffer | string, value: string): Buffer =>
  createHmac("sha256", key).update(value, "utf8").digest();

/** `20150830T123600Z`, which is the only date format any of this accepts. */
export const amzDate = (now: Date): string =>
  `${now.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;

/**
 * Everything a signature covers, in the exact shape AWS will rebuild.
 *
 * Exported for the tests: comparing a canonical request against AWS's
 * published one is what turns "the signature is wrong" into "the header
 * collapsing is wrong", which is the difference between a fix and an
 * afternoon.
 */
export const canonicalRequest = (
  request: SignableRequest,
  headers: Record<string, string>,
): { canonical: string; signedHeaders: string } => {
  const url = new URL(request.url);

  // Sorted by name, lowercased, values trimmed and inner runs of whitespace
  // collapsed to one space. All four of those are in the specification and
  // none of them is optional.
  const names = Object.keys(headers)
    .map((name) => name.toLowerCase())
    .sort();
  const canonicalHeaders = names
    .map((name) => {
      const value = headers[
        Object.keys(headers).find((key) => key.toLowerCase() === name)!
      ];
      return `${name}:${value.trim().replace(/\s+/g, " ")}\n`;
    })
    .join("");

  const query = [...url.searchParams.entries()]
    .map(
      ([key, value]) =>
        [encodeRfc3986(key), encodeRfc3986(value)] as [string, string],
    )
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const signedHeaders = names.join(";");
  const canonical = [
    request.method.toUpperCase(),
    url.pathname || "/",
    query,
    canonicalHeaders,
    signedHeaders,
    sha256Hex(request.body),
  ].join("\n");

  return { canonical, signedHeaders };
};

/**
 * Percent-encoding as SigV4 defines it, which is not `encodeURIComponent`.
 *
 * `!`, `'`, `(`, `)` and `*` are left alone by `encodeURIComponent` and must
 * be encoded here, and the result has to be uppercase.
 */
const encodeRfc3986 = (value: string): string =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/**
 * The headers to send, signature included.
 *
 * Returns headers rather than performing the request, so the whole thing is a
 * pure function of its inputs and a test can pin it to a known answer.
 */
export const signRequest = (
  request: SignableRequest,
  credentials: Credentials,
  now: Date,
): Record<string, string> => {
  const url = new URL(request.url);
  const timestamp = amzDate(now);
  const date = timestamp.slice(0, 8);

  const headers: Record<string, string> = {
    ...request.headers,
    host: url.host,
    "x-amz-date": timestamp,
  };
  // The token is part of the signature, not something added afterwards —
  // signing without it produces a signature AWS rebuilds differently.
  if (credentials.sessionToken) {
    headers["x-amz-security-token"] = credentials.sessionToken;
  }

  const { canonical, signedHeaders } = canonicalRequest(request, headers);
  const scope = `${date}/${request.region}/${request.service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    timestamp,
    scope,
    sha256Hex(canonical),
  ].join("\n");

  // Four chained HMACs, each keyed by the last. The first is keyed by the
  // literal string `AWS4` prefixed to the secret, which is easy to miss and
  // produces a signature that is wrong in no visible way.
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${credentials.secretAccessKey}`, date), request.region), request.service),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign, "utf8")
    .digest("hex");

  return {
    ...headers,
    authorization:
      `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
};

/**
 * The credentials a Lambda is given, from the environment it is given them in.
 *
 * `null` rather than a throw, so a caller can say "publishing is not
 * configured" instead of dying — which is what running these tests outside
 * Lambda looks like.
 */
export const credentialsFromEnvironment = (
  environment: NodeJS.ProcessEnv = process.env,
): Credentials | null => {
  const accessKeyId = environment.AWS_ACCESS_KEY_ID;
  const secretAccessKey = environment.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) return null;
  return {
    accessKeyId,
    secretAccessKey,
    sessionToken: environment.AWS_SESSION_TOKEN,
  };
};
