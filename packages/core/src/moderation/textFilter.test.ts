import { describe, expect, it } from "vitest";
import {
  MAX_NAME_LENGTH,
  isObjectionable,
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
  it("says something different for a board", () => {
    expect(messageForRejection("duplicate", "board")).not.toBe(
      messageForRejection("duplicate", "name"),
    );
  });

  it("never repeats what was typed", () => {
    expect(messageForRejection("objectionable")).not.toContain("fuck");
  });
});
