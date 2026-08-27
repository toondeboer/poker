/**
 * Who is calling.
 *
 * The smallest useful authenticated route, and it exists for a reason beyond
 * being useful: it proves the entire chain end to end — a phone holding a
 * Cognito token, an API Gateway authorizer that verifies it, a Lambda that
 * receives the verified claims, and a log line somebody can find afterwards.
 * Every later route depends on all of that working, and none of it can be
 * checked without deploying, so it is worth having one route whose only job is
 * to fail loudly when it does not.
 *
 * **The claims are not read from the token here.** API Gateway's JWT authorizer
 * has already verified the signature, the issuer, the audience and the expiry
 * before this function is invoked, and it hands over the decoded claims. A
 * handler that parsed the `Authorization` header itself would be duplicating
 * that check, and the duplicate is the one that eventually gets it wrong.
 */

export type Claims = Record<string, string | number | boolean | string[]>;

export type Identity = {
  /** Cognito's `sub`: stable, unique, and never reused. This is the account id. */
  accountId: string;
  email: string | null;
};

/**
 * The identity a set of verified claims describes.
 *
 * `null` when the claims carry no subject at all, which should be impossible —
 * a token without a `sub` would not have been issued — and is still checked,
 * because "should be impossible" is where the interesting failures live.
 *
 * The email is optional on purpose. It is a **profile attribute**: it can be
 * absent from a token, and it changes when somebody changes it. Nothing is ever
 * keyed by it. The `sub` is the identity.
 */
export const identityFrom = (claims: Claims | undefined): Identity | null => {
  const sub = claims?.sub;
  if (typeof sub !== "string" || sub.length === 0) return null;
  const email = claims?.email;
  return {
    accountId: sub,
    email: typeof email === "string" && email.length > 0 ? email : null,
  };
};

type Event = {
  requestContext?: { authorizer?: { jwt?: { claims?: Claims } } };
};

type Response = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

const json = (statusCode: number, body: unknown): Response => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const handler = async (event: Event): Promise<Response> => {
  const identity = identityFrom(event.requestContext?.authorizer?.jwt?.claims);
  // 401 rather than 500: the authorizer should have made this unreachable, and
  // if it somehow did not, the honest answer is that we do not know who this
  // is — not that something broke.
  return identity ? json(200, identity) : json(401, { error: "unauthenticated" });
};
