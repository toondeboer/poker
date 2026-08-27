/**
 * One log line, structured, with the things you actually search by.
 *
 * CloudWatch Logs Insights and Grafana both parse JSON out of a log line for
 * free and neither can do anything useful with a sentence. The difference
 * shows up at exactly the wrong moment: "something is erroring" is a shrug,
 * and `filter accountId = "..."` is an answer.
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
): LogLine => ({ level, message, ...redact(fields) });

/**
 * Field names that must never reach a log, whatever anybody passes.
 *
 * A blocklist is the weaker kind of defence and it is the right one here: the
 * fields are open-ended by design, so the alternative is a fixed schema that
 * somebody works around the first time they need to log something new. This
 * catches the names a mistake actually uses.
 */
const FORBIDDEN = [
  "authorization",
  "token",
  "accesstoken",
  "idtoken",
  "refreshtoken",
  "password",
  "secret",
  "cookie",
  "body",
];

const redact = (fields: LogFields): LogFields => {
  const safe: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    safe[key] = FORBIDDEN.includes(key.toLowerCase().replace(/[-_]/g, ""))
      ? "[redacted]"
      : value;
  }
  return safe;
};

/** Write it. One line, one JSON object, which is all either tool needs. */
export const log = (
  level: LogLevel,
  message: string,
  fields?: LogFields,
): void => {
  // `console` is the only transport a Lambda has to CloudWatch, and the
  // collector picks the same line up for Grafana.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(logLine(level, message, fields)));
};
