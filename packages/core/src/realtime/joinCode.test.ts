import { describe, expect, it } from "vitest";
import {
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
  createJoinCode,
  isValidJoinCode,
  normaliseJoinCode,
} from "./joinCode";
import { createRandom } from "../poker/cards";

describe("the alphabet", () => {
  it("never contains both halves of a pair that can be misread", () => {
    // The property, not the string: a code is read aloud and typed by someone
    // watching their cards. Keeping one of each pair is fine — keeping both is
    // what turns a misread into a join.
    const lookalikes = [
      ["O", "0"],
      ["I", "1"],
      ["L", "1"],
      ["S", "5"],
      ["B", "8"],
      ["Z", "2"],
    ];
    const both = lookalikes.filter(([left, right]) =>
      JOIN_CODE_ALPHABET.includes(left) && JOIN_CODE_ALPHABET.includes(right),
    );
    expect(both).toEqual([]);
  });

  it("has no vowels, so six random characters never spell anything", () => {
    expect(JOIN_CODE_ALPHABET).not.toMatch(/[AEIOUY]/);
  });

  it("has no duplicates, which would skew which codes come up", () => {
    expect(new Set(JOIN_CODE_ALPHABET).size).toBe(JOIN_CODE_ALPHABET.length);
  });
});

describe("making a code", () => {
  it("is the agreed length, from the agreed characters", () => {
    const code = createJoinCode(createRandom(7));
    expect(code).toHaveLength(JOIN_CODE_LENGTH);
    expect(isValidJoinCode(code)).toBe(true);
  });

  it("is deterministic for a seed, so a test can name one", () => {
    expect(createJoinCode(createRandom(7))).toBe(createJoinCode(createRandom(7)));
    expect(createJoinCode(createRandom(7))).not.toBe(createJoinCode(createRandom(8)));
  });

  it("survives a random source that returns exactly 1", () => {
    // The same clamp `shuffle` needs: an unclamped index runs off the end and
    // concatenates a literal "undefined" into the code.
    const code = createJoinCode(() => 1);
    expect(code).toHaveLength(JOIN_CODE_LENGTH);
    expect(isValidJoinCode(code)).toBe(true);
  });

  it("survives a random source stuck at 0", () => {
    expect(createJoinCode(() => 0)).toBe(JOIN_CODE_ALPHABET[0].repeat(JOIN_CODE_LENGTH));
  });

  it("uses the whole alphabet rather than a corner of it", () => {
    const seen = new Set<string>();
    const random = createRandom(11);
    for (let round = 0; round < 400; round += 1) {
      for (const character of createJoinCode(random).split("")) seen.add(character);
    }
    expect(seen.size).toBe(JOIN_CODE_ALPHABET.length);
  });

  it("makes codes that are always valid, whatever the seed", () => {
    const failures: string[] = [];
    for (let seed = 0; seed < 500; seed += 1) {
      const code = createJoinCode(createRandom(seed));
      if (!isValidJoinCode(code)) failures.push(`${seed}: ${code}`);
    }
    expect(failures).toEqual([]);
  });
});

describe("reading one back", () => {
  it("forgives case and separators", () => {
    // Autocapitalisation must not be able to break a join, and people put
    // spaces and dashes in codes they were read out.
    const failures: string[] = [];
    for (const typed of ["4f7k2p", "4F7K2P", "4f7-k2p", "4F7 K2P", " 4f7k2p "]) {
      const normalised = normaliseJoinCode(typed);
      if (normalised !== "4F7K2P") failures.push(`${typed} -> ${normalised}`);
    }
    expect(failures).toEqual([]);
  });

  it("refuses a lookalike instead of guessing what was meant", () => {
    // Guessing can drop somebody into somebody else's session, with a
    // plausible countdown on it and nothing to say it is the wrong one.
    expect(isValidJoinCode("4F7K2O")).toBe(false);
    expect(isValidJoinCode("4F7K21")).toBe(false);
    expect(isValidJoinCode("4F7K2S")).toBe(false);
  });

  it("refuses the wrong length", () => {
    expect(isValidJoinCode("4F7K2")).toBe(false);
    expect(isValidJoinCode("4F7K2PP")).toBe(false);
    expect(isValidJoinCode("")).toBe(false);
  });

  it("does not let stripping a bad character shorten a code into a valid one", () => {
    // If normalisation dropped unknown characters, this would come out as the
    // valid "4F7K2P" — a typo silently becoming a different, real session.
    expect(isValidJoinCode("4F7K2P!")).toBe(false);
    expect(isValidJoinCode("4F7*K2P")).toBe(false);
  });
});
