import { describe, expect, it } from "vitest";
import {
  MAX_NAME_LENGTH,
  MAX_REPORT_DETAIL,
  REPORT_REASONS,
  isObjectionable,
  isReportReason,
  labelForReportReason,
  messageForRejection,
  nameRejection,
} from "./textFilter";

describe("isObjectionable", () => {
  it("passes ordinary names", () => {
    for (const name of [
      "Dave",
      "Anne-Marie",
      "José",
      "Big Mike",
      "player 2",
      "O'Brien",
      "Дмитрий",
    ]) {
      expect(isObjectionable(name)).toBe(false);
    }
  });

  it("catches a slur typed plainly", () => {
    expect(isObjectionable("faggot")).toBe(true);
  });

  it("catches one hidden behind separators and substitutions", () => {
    expect(isObjectionable("f.a-g_g0t")).toBe(true);
    expect(isObjectionable("N1GG3R")).toBe(true);
  });

  it("catches profanity as a whole word regardless of case", () => {
    expect(isObjectionable("Fuck")).toBe(true);
    expect(isObjectionable("dave the SHIT")).toBe(true);
  });

  /**
   * The Scunthorpe problem, which is the whole reason `WORD_TERMS` is matched
   * on tokens rather than as substrings. A filter that refuses these is worse
   * than one that misses a term.
   */
  it.each([
    "Scunthorpe",
    "Assassin",
    "Cassidy",
    "Bass",
    "Hancock",
    "Dickinson",
    "Shitake",
    "Analysis",
    "Penistone",
    "Cockburn",
    "Therapist",
    "Raccoon",
    "Cocoon",
    "Pakistan",
    "Specific",
    "Despicable",
  ])("does not refuse %s", (name) => {
    expect(isObjectionable(name)).toBe(false);
  });

  it("still refuses an unambiguous term inside a longer string", () => {
    // `ANYWHERE_TERMS` are the ones that cannot appear innocently.
    expect(isObjectionable("thenigger1")).toBe(true);
  });
});

describe("nameRejection", () => {
  it("accepts a good name", () => {
    expect(nameRejection("Dave", ["Anne"])).toBeNull();
  });

  it("reports emptiness before anything else", () => {
    expect(nameRejection("   ")).toBe("empty");
  });

  it("reports length", () => {
    expect(nameRejection("a".repeat(MAX_NAME_LENGTH + 1))).toBe("too-long");
    expect(nameRejection("a".repeat(MAX_NAME_LENGTH))).toBeNull();
  });

  it("reports objectionable content before duplication", () => {
    expect(nameRejection("fuck", ["fuck"])).toBe("objectionable");
  });

  it("reports a case-insensitive duplicate on the trimmed value", () => {
    expect(nameRejection("  dave ", ["Dave"])).toBe("duplicate");
  });

  it("does not treat a name as a duplicate of itself when it is not listed", () => {
    expect(nameRejection("Dave", ["Anne", "Mo"])).toBeNull();
  });
});

describe("messageForRejection", () => {
  it.each(["empty", "too-long", "duplicate", "objectionable"] as const)(
    "has a sentence for %s",
    (rejection) => {
      // Every case reaches a field, so a missing one is a blank helper line
      // under a button that will not enable — the least debuggable state there
      // is. Both subjects, because they take different branches.
      expect(messageForRejection(rejection, "name").length).toBeGreaterThan(0);
      expect(messageForRejection(rejection, "board").length).toBeGreaterThan(0);
    },
  );

  it("says something different for a board", () => {
    expect(messageForRejection("duplicate", "board")).not.toBe(
      messageForRejection("duplicate", "name"),
    );
    expect(messageForRejection("empty", "board")).not.toBe(
      messageForRejection("empty", "name"),
    );
  });

  it("defaults to the player-name wording", () => {
    expect(messageForRejection("duplicate")).toBe(
      messageForRejection("duplicate", "name"),
    );
  });

  it("names the cap it is enforcing", () => {
    expect(messageForRejection("too-long")).toContain(String(MAX_NAME_LENGTH));
  });

  it("never repeats what was typed", () => {
    expect(messageForRejection("objectionable")).not.toContain("fuck");
  });
});

describe("report reasons", () => {
  it("recognises every reason it publishes", () => {
    // The app puts these on buttons and the handler refuses anything it does
    // not recognise, so the two have to agree — this is that agreement.
    for (const reason of REPORT_REASONS) {
      expect(isReportReason(reason)).toBe(true);
    }
  });

  it.each([
    ["an unknown string", "because I feel like it"],
    ["an empty string", ""],
    ["a number", 3],
    ["null", null],
    ["undefined", undefined],
    ["an object", { reason: "spam" }],
  ])("refuses %s", (_label, value) => {
    expect(isReportReason(value)).toBe(false);
  });

  it.each(REPORT_REASONS)("has a button label for %s", (reason) => {
    expect(labelForReportReason(reason).length).toBeGreaterThan(0);
  });

  it("gives every reason its own label", () => {
    const labels = REPORT_REASONS.map(labelForReportReason);
    expect(new Set(labels).size).toBe(REPORT_REASONS.length);
  });

  it("allows a detail long enough to describe a problem", () => {
    expect(MAX_REPORT_DETAIL).toBeGreaterThanOrEqual(500);
  });
});
