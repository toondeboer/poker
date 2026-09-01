/**
 * One log line, structured, with the things you actually search by.
 *
 * CloudWatch Logs Insights parses JSON out of a log line for free and can do
 * nothing useful with a sentence. The difference shows up at exactly the wrong
 * moment: "something is erroring" is a shrug, and `filter accountId = "..."` is
 * an answer.
 *
 * **Nothing here ever logs a request body, a header or a token.** The fields
 * are the ones that identify *which* request went wrong, not what was in it —
 * an access log holding an `Authorization` header is a credential store nobody
 * is treating as one, and the same is true a level down.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = {
  /** API Gateway's request id. The thread that ties a log line to an access log line. */
  requestId?: string;
  /** Cognito's `sub`. Never an email — that changes, and this has to be stable. */
  accountId?: string;
  tableId?: string;
  /** How long the interesting part took, when it is worth knowing. */
  durationMs?: number;
  /** Anything else, as long as it is not something the caller sent. */
  [key: string]: unknown;
};

export type LogLine = LogFields & {
  level: LogLevel;
  message: string;
};

/**
 * Build the line. Separated from writing it so it can be tested without
 * capturing stdout, and so the redaction below is a pure function.
 */
export const logLine = (
  level: LogLevel,
  message: string,
  fields: LogFields = {},
): LogLine => ({
  // Fields first, so `level` and `message` win. The other order lets a caller
  // passing `{ level: "info" }` demote an error line out of every `level =
  // "error"` query, which is a lie told by accident.
  ...(redact(fields) as LogFields),
  level,
  message,
});

/**
 * Fragments of a field name that mean "do not log this".
 *
 * A blocklist is the weaker kind of defence and it is the right one here: the
 * fields are open-ended by design, so the alternative is a fixed schema that
 * somebody works around the first time they need to log something new.
 *
 * **Matched as substrings, not as whole names.** An exact list catches
 * `token` and misses `sessionToken`, `apiKey` and `bearerToken` — which are
 * exactly the names a mistake reaches for, because nobody writing a field
 * called `token` needed a blocklist to know better.
 */
const FORBIDDEN = [
  "auth",
  "token",
  "password",
  "secret",
  "credential",
  "cookie",
  "apikey",
  "sessionid",
  "body",
];

/** How far down to look. Deep enough for anything real, bounded for anything not. */
const MAX_DEPTH = 4;

const isSensitive = (key: string): boolean => {
  const normalised = key.toLowerCase().replace(/[-_\s]/g, "");
  return FORBIDDEN.some((fragment) => normalised.includes(fragment));
};

/**
 * Redact, all the way down.
 *
 * Top-level-only redaction is the version that reads as safe and is not: the
 * moment somebody logs `{ request: { authorization } }` — which is the natural
 * shape of a thing you would log while debugging — the guarantee at the top of
 * this file stops being true.
 */
const redact = (value: unknown, depth = 0): unknown => {
  if (Array.isArray(value)) {
    return depth >= MAX_DEPTH
      ? "[too deep]"
      : value.map((entry) => redact(entry, depth + 1));
  }
  if (typeof value !== "object" || value === null) return value;
  if (depth >= MAX_DEPTH) return "[too deep]";

  const safe: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    safe[key] = isSensitive(key) ? "[redacted]" : redact(entry, depth + 1);
  }
  return safe;
};

/** Write it. One line, one JSON object, which is all Logs Insights needs. */
export const log = (
  level: LogLevel,
  message: string,
  fields?: LogFields,
): void => {
  // `console` is the only transport a Lambda has to CloudWatch, and CloudWatch
  // is where these are read: Logs Insights parses JSON out of a line for free,
  // so `filter accountId = "..."` is an answer where a sentence is a shrug.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(logLine(level, message, fields)));
};
