/**
 * The code somebody reads out so the other phones can join the clock.
 *
 * It gets spoken across a table, typed by someone half-watching their cards,
 * and occasionally sent by message. So the alphabet leaves out every character
 * that can be misread as another: no `O`/`0`, no `I`/`L`/`1`, no `S`/`5`, no
 * `B`/`8`, no `Z`/`2`. What is left is 24 characters that survive being read
 * aloud in a noisy room.
 *
 * **Excluding a character is better than accepting it and guessing.** A code
 * that quietly corrects `0` to `O` can drop somebody into a *different*
 * session — someone else's game night, with a plausible countdown on it and no
 * indication anything is wrong. Being told the code is invalid is the good
 * outcome; joining the wrong table silently is not.
 *
 * Vowels are gone too, which is what stops six random characters occasionally
 * spelling something the host would rather not read out.
 */

/** 24 unambiguous characters. No vowels, no lookalikes. */
export const JOIN_CODE_ALPHABET = "23456789CDFGHJKMNPQRTVWX";

/** Six characters — ~191 million codes, which is plenty for live sessions. */
export const JOIN_CODE_LENGTH = 6;

/**
 * Make a code from an injected random source.
 *
 * Randomness is a parameter, like everywhere else in the engine: the same
 * decision that lets a shuffle be replayed lets a code be tested.
 */
export const createJoinCode = (random: () => number): string => {
  let code = "";
  for (let index = 0; index < JOIN_CODE_LENGTH; index += 1) {
    // Clamped for the same reason `shuffle` clamps: a random source returning
    // exactly 1 would index off the end and produce `undefined`.
    const pick = Math.min(
      JOIN_CODE_ALPHABET.length - 1,
      Math.floor(random() * JOIN_CODE_ALPHABET.length),
    );
    code += JOIN_CODE_ALPHABET[pick];
  }
  return code;
};

/**
 * Tidy up what somebody typed, without inventing anything.
 *
 * Case and separators are noise — `4f7-k2p` and `4F7 K2P` are the same code,
 * and a keyboard's autocapitalisation should not be able to break a join. Any
 * character that is not in the alphabet is left in place so validation refuses
 * it, rather than stripped so the rest silently shuffles up into a valid but
 * different code.
 */
export const normaliseJoinCode = (raw: string): string =>
  raw.toUpperCase().replace(/[\s-]/g, "");

/** Is this a code we could have issued? */
export const isValidJoinCode = (raw: string): boolean => {
  const code = normaliseJoinCode(raw);
  if (code.length !== JOIN_CODE_LENGTH) return false;
  return code
    .split("")
    .every((character) => JOIN_CODE_ALPHABET.includes(character));
};
