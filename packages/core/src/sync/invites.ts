/**
 * The link that puts somebody on a board.
 *
 * **The whole feature is a string, so the string is where it can go wrong.** A
 * token that survives a round trip through a chat app, a mail client that
 * helpfully appends a full stop, and whatever the phone hands the app on the
 * way in. That is worth testing, and it is testable — unlike the sharing sheet
 * and the deep-link plumbing either side of it.
 *
 * The token is 24 random bytes as base64url, minted by the server. base64url is
 * chosen precisely so it survives a URL untouched: no `+`, no `/`, no padding,
 * so nothing needs escaping and nothing gets mangled by a client that decides
 * to be clever about links.
 */

/**
 * **The token is the code.** Nothing about it needs a URL wrapped round it: it
 * is 32 characters of base64url, and pasting it into a field is a complete way
 * to join a board that needs no domain, no universal links, and no page on a
 * website to catch the tap.
 *
 * That is not the six-character code this design considered and rejected — see
 * `SYNC.md`. **That one was rejected because these invites never expire**, so
 * short enough to say aloud is short enough to guess, and one lucky guess is
 * permanent access to a board's whole history. A pasted code keeps every bit of
 * the entropy and gives up nothing.
 */

/** Where a link points when the app is installed. */
export const INVITE_PATH = "join";

/**
 * base64url, and nothing else.
 *
 * Length is checked loosely rather than pinned to 32 characters: the server
 * mints the token and this only has to reject what is obviously not one. A
 * bound is still worth having, because without it every stray path segment in
 * the app becomes a "token" worth sending to the server.
 */
const TOKEN = /^[A-Za-z0-9_-]{16,128}$/;

export const isInviteToken = (value: unknown): value is string =>
  typeof value === "string" && TOKEN.test(value);

/**
 * Build the link to share.
 *
 * @param base Where the link points — an `https://` site, or the app's own
 *   `pokerkit://` scheme. **A custom scheme only works for somebody who already
 *   has the app**; a link sent to somebody who does not is a link that does
 *   nothing at all, which is most of the point of an invite. Passing an https
 *   base is what fixes that, and needs universal links configured either side.
 */
export const inviteUrlFor = (token: string, base: string): string => {
  // **`scheme://` is not a trailing slash.** Stripping them blindly turned
  // `pokerkit://` into `pokerkit:` and produced a single-slash link, which is
  // why the app's own base had to be written as the odd `"pokerkit:/"`. Now the
  // natural spelling works and both are handled.
  const root = /:\/\/$/.test(base) ? base.slice(0, -1) : base.replace(/\/+$/, "");
  return `${root}/${INVITE_PATH}/${encodeURIComponent(token)}`;
};

/**
 * Pull the token back out of whatever the phone handed us.
 *
 * Deliberately forgiving about the shape of the URL and strict about the token:
 * a link arrives having been through a chat app, and the parts worth trusting
 * are the last path segment and nothing else.
 *
 * `null` for anything that is not an invite, which includes every other deep
 * link the app handles.
 */
export const tokenFromUrl = (url: string): string | null => {
  // Query and fragment first: a mail client that appends `?utm_source=…` must
  // not turn a good token into a bad one.
  const withoutQuery = url.split(/[?#]/)[0];
  const segments = withoutQuery.split("/").filter((part) => part.length > 0);
  const last = segments[segments.length - 1];
  const before = segments[segments.length - 2];
  // The path segment before it has to say `join`, or any deep link at all would
  // be read as an invite — `pokerkit://account` would send "account" to the
  // server as a token.
  if (!last || before?.toLowerCase() !== INVITE_PATH) return null;
  let decoded = last;
  try {
    decoded = decodeURIComponent(last);
  } catch {
    // A malformed escape is not a token. Fall through to the check below rather
    // than throwing at whoever tapped the link.
  }
  // Trailing punctuation a chat app or a human put there. `.` and `,` are not
  // base64url, so a token never ends in one and this cannot eat a real
  // character.
  const trimmed = decoded.replace(/[.,;:!)\]]+$/, "");
  return isInviteToken(trimmed) ? trimmed : null;
};

/**
 * Read an invite out of whatever somebody pasted.
 *
 * **The one part of joining by code that can be wrong**, and therefore the part
 * that lives here rather than in a text field. People do not paste a bare token:
 * they paste it with a newline, or they paste the whole message it arrived in,
 * or they paste a link because they had one. All three should work, because the
 * alternative is telling somebody their perfectly good invite is invalid.
 *
 * Scanned from the end, because in every message this app produces the code is
 * the last thing on the line — which also means a board whose *name* happens to
 * look like a token cannot shadow the real one.
 */
export const readInviteCode = (input: string): string | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // A link, if that is what they had. Handles the query strings and trailing
  // full stops that `tokenFromUrl` already knows about.
  const fromUrl = tokenFromUrl(trimmed);
  if (fromUrl) return fromUrl;

  // A bare code is just a message of one word, so the scan below covers it too.
  const chunks = trimmed.split(/\s+/);
  for (let i = chunks.length - 1; i >= 0; i -= 1) {
    // Quotes and sentence punctuation somebody's chat app or keyboard added.
    // None of them are base64url, so this cannot eat part of a real code.
    const cleaned = chunks[i]
      .replace(/^["'\u201c\u2018([]+/, "")
      .replace(/["'\u201d\u2019.,;:!)\]]+$/, "");
    if (isInviteToken(cleaned)) return cleaned;
  }
  return null;
};
