import { describe, expect, it } from "vitest";
import { SESSION_NAMESPACE, sessionChannel } from "./channels";

/**
 * The table and player channels were removed with the table backend, and their
 * tests with them — including the one covering the guard that reads a player id
 * back out of a private path. That guard was the interesting part of this file:
 * it existed because an earlier path shape put the private channel under the
 * *table* namespace, where the subscribe rule never ran and any signed-in
 * account could read anyone's hole cards.
 *
 * **If a private channel is ever reintroduced, restore that test with it.** It
 * is at the `archive/betting-engine` tag, along with the guard, the authorizer
 * and the publisher.
 */
describe("the shared-clock channel", () => {
  it("has its own namespace, because its rule is its own", () => {
    // Anyone holding the join code may watch a clock. Namespaces are where
    // subscribe rules attach, so a channel with its own rule needs its own.
    expect(sessionChannel("s1")).toBe("/session/s1");
    expect(sessionChannel("s1").split("/")[1]).toBe(SESSION_NAMESPACE);
  });

  it("builds a distinct path per session", () => {
    expect(sessionChannel("a")).not.toBe(sessionChannel("b"));
  });
});
