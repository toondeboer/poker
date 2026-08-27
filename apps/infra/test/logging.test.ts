import { describe, expect, it } from "vitest";
import { logLine } from "../lib/lambda/logging";

describe("a log line", () => {
  it("is an object, because that is the only kind either tool can search", () => {
    // "Something is erroring" is a shrug. `filter accountId = "..."` is an
    // answer, and the difference is whether the line was JSON.
    expect(logLine("info", "acted", { accountId: "u-1", tableId: "t-1" })).toEqual(
      { level: "info", message: "acted", accountId: "u-1", tableId: "t-1" },
    );
  });

  it("leaves out fields nobody set", () => {
    // An explicit `undefined` in a log line is noise in every query that
    // touches it.
    expect(logLine("info", "acted", { accountId: undefined })).toEqual({
      level: "info",
      message: "acted",
    });
  });
});

describe("what must never reach a log", () => {
  it("redacts a credential whatever it is called", () => {
    const line = logLine("error", "failed", {
      authorization: "Bearer abc",
      idToken: "ey...",
      refresh_token: "r",
      password: "hunter2",
      cookie: "session=1",
    });
    const rendered = JSON.stringify(line);
    const leaks = ["Bearer abc", "ey...", "hunter2", "session=1"].filter(
      (secret) => rendered.includes(secret),
    );
    expect(leaks).toEqual([]);
  });

  it("catches the same name written a different way", () => {
    // `idToken`, `id_token`, `ID-TOKEN` — a mistake does not pick the spelling
    // the blocklist happens to have.
    const failures = ["idToken", "id_token", "ID-TOKEN", "AccessToken"].filter(
      (key) => logLine("info", "x", { [key]: "secret" })[key] !== "[redacted]",
    );
    expect(failures).toEqual([]);
  });

  it("catches names an exact list would have missed", () => {
    // The whole reason for matching fragments. Nobody who writes a field
    // called `token` needed a blocklist to know better; the names that actually
    // leak are the ones that look innocent.
    const failures = [
      "sessionToken",
      "apiKey",
      "bearerToken",
      "clientSecret",
      "sessionId",
      "authHeader",
    ].filter((key) => logLine("info", "x", { [key]: "s" })[key] !== "[redacted]");
    expect(failures).toEqual([]);
  });

  it("redacts a credential hidden inside an object", () => {
    // `{ request: { authorization } }` is the natural shape of something you
    // would log while debugging, and top-level-only redaction reads as safe
    // while letting it straight through.
    const line = logLine("error", "failed", {
      request: { headers: { authorization: "Bearer abc" } },
    });
    expect(JSON.stringify(line)).not.toContain("Bearer abc");
  });

  it("gives up rather than following something pathological all the way down", () => {
    let nested: Record<string, unknown> = { deepest: "value" };
    for (let level = 0; level < 20; level += 1) nested = { nested };
    expect(JSON.stringify(logLine("info", "x", nested))).toContain("[too deep]");
  });

  it("cannot be talked out of its own level or message", () => {
    // A caller passing `{ level: "info" }` on an error line would otherwise
    // demote it out of every `level = "error"` query — a lie told by accident.
    const line = logLine("error", "the real message", {
      level: "info",
      message: "not this",
    } as never);
    expect(line.level).toBe("error");
    expect(line.message).toBe("the real message");
  });

  it("refuses to log a request body at all", () => {
    // Not because a body is always sensitive, but because deciding which ones
    // are is a judgement made under time pressure by whoever adds the field.
    expect(logLine("info", "x", { body: '{"a":1}' }).body).toBe("[redacted]");
  });

  it("still lets through the things worth searching by", () => {
    const line = logLine("info", "acted", {
      requestId: "r-1",
      accountId: "u-1",
      durationMs: 12,
    });
    expect(line).toMatchObject({
      requestId: "r-1",
      accountId: "u-1",
      durationMs: 12,
    });
  });
});
