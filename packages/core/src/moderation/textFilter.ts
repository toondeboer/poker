// src/moderation/textFilter.ts

/**
 * The filter that stands between somebody's typing and everybody else's screen.
 *
 * Player names and board names are free text, and a shared board puts them on
 * other people's phones. That makes them user-generated content in the sense
 * both stores mean it, and both require *something* here: Apple's guideline 1.2
 * asks for "a method for filtering objectionable material", Google's UGC policy
 * for the same alongside a way to report what gets through.
 *
 * **This is a speed bump, not a moderator.** It exists to stop the lazy case —
 * somebody typing a slur into a name field to see whether it appears on their
 * friend's phone — and it will not stop anybody determined. That is why
 * reporting exists next to it: a filter catches what it knows, and a report
 * catches the rest. Neither works alone, and pretending the list is exhaustive
 * would be the more dangerous mistake.
 */

/**
 * A cap on any name shown to somebody else.
 *
 * Not a moderation rule so much as a layout one — a board's roster and the
 * standings both render a name in a fixed row — but it belongs here because it
 * closes the same hole: without a cap, a "name" is an arbitrary message posted
 * to everybody on the board.
 */
export const MAX_NAME_LENGTH = 40;

/**
 * Why a name was refused, or `null` when it wasn't.
 *
 * Deliberately an enum rather than a boolean: "that name is taken" and "that
 * name is not acceptable" want very different words on screen, and a caller
 * given a boolean has to guess which happened.
 */
export type NameRejection =
  "empty" | "too-long" | "duplicate" | "objectionable";

/**
 * Fold away the tricks that make a substring match miss.
 *
 * Lowercase, strip diacritics, map the common letter-for-symbol substitutions,
 * then drop everything that is not a letter or a digit. `S.h_i-t` and `Ｓ4ＩＴ`
 * both collapse onto the same string as the word itself.
 *
 * **The separator strip is what makes this worth doing and also what makes it
 * dangerous**: it joins adjacent words, so `mass hole` collapses into a term.
 * That is why the collapsed form is only used for the small unambiguous list
 * below, and ordinary words are matched against tokens instead.
 */
const collapse = (text: string): string =>
  text
    .normalize("NFKD")
    // Combining marks, so accented letters fold onto their base form.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[4@]/g, "a")
    .replace(/[3€]/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/0/g, "o")
    .replace(/[5$]/g, "s")
    .replace(/7/g, "t")
    .replace(/[^a-z0-9]/g, "");

/** The same folding, but keeping word breaks so tokens survive. */
const tokens = (text: string): string[] =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[4@]/g, "a")
    .replace(/[3€]/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/0/g, "o")
    .replace(/[5$]/g, "s")
    .replace(/7/g, "t")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);

/**
 * Matched anywhere in the collapsed string, separators and all.
 *
 * **Only terms that cannot appear inside an innocent word belong here**, because
 * this is the rule that produces the Scunthorpe problem — the town whose name
 * contains a slur and which has been blocked by naive filters for thirty years.
 * Every entry is long enough, and specific enough, that a false positive would
 * be a surprise. Anything shorter or more general goes in {@link WORD_TERMS}
 * and is matched as a whole word instead.
 */
const ANYWHERE_TERMS: readonly string[] = [
  "nigger",
  "nigga",
  "faggot",
  "wetback",
  "raghead",
  "tranny",
  "childporn",
  "kiddieporn",
  "heilhitler",
  "motherfucker",
  "hitler",
];

/**
 * Matched as whole words only.
 *
 * These appear inside ordinary words often enough that a substring rule would
 * refuse real names — `assassin` and `Cassidy` both contain one of them, and
 * `Bass`, `Hancock` and `Scunthorpe` are the standing examples of why this
 * distinction is not pedantry.
 */
const WORD_TERMS: readonly string[] = [
  // Slurs short enough to sit inside an ordinary word. Every one of these was
  // in the list above until a test caught it: `Scunthorpe` contains one,
  // `raccoon` another, `Pakistan` a third, and `therapist` the fourth.
  "cunt",
  "coon",
  "spic",
  "chink",
  "kike",
  "gook",
  "paki",
  "rapist",
  "fuck",
  "fucker",
  "fucking",
  "shit",
  "bitch",
  "whore",
  "slut",
  "rape",
  "nazi",
  "retard",
  "retarded",
  "dick",
  "cock",
  "penis",
  "vagina",
  "porn",
  "anal",
  "wank",
  "wanker",
  "twat",
  "bastard",
  "arsehole",
  "asshole",
  "prick",
  "pedo",
  "paedo",
];

/**
 * Whether a piece of free text should not be shown to other people.
 *
 * Exported on its own because both name kinds want it and so does anything
 * added later that puts typing in front of a stranger.
 */
export const isObjectionable = (text: string): boolean => {
  const collapsed = collapse(text);
  if (ANYWHERE_TERMS.some((term) => collapsed.includes(term))) return true;
  const words = tokens(text);
  return words.some((word) => WORD_TERMS.includes(word));
};

/**
 * Everything wrong with a proposed name, in the order worth telling somebody.
 *
 * Emptiness first because it is the state a field starts in and is not really
 * an error; length before content because it is the one somebody can see for
 * themselves.
 *
 * @param existing Names already in use, for the duplicate check. Compared
 *   case-insensitively on the trimmed value, which is what the roster shows.
 */
export const nameRejection = (
  name: string,
  existing: readonly string[] = [],
): NameRejection | null => {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "empty";
  if (trimmed.length > MAX_NAME_LENGTH) return "too-long";
  if (isObjectionable(trimmed)) return "objectionable";
  const taken = existing.some(
    (other) => other.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  return taken ? "duplicate" : null;
};

/**
 * The sentence to put under the field.
 *
 * Here rather than in the app so both platforms say the same thing, and so the
 * wording sits beside the rule it explains. The objectionable case deliberately
 * does not repeat what was typed or name the term it matched.
 */
export const messageForRejection = (
  rejection: NameRejection,
  subject: "name" | "board" = "name",
): string => {
  switch (rejection) {
    case "empty":
      return `Enter a ${subject === "board" ? "board name" : "name"}.`;
    case "too-long":
      return `Keep it under ${MAX_NAME_LENGTH} characters.`;
    case "duplicate":
      return subject === "board"
        ? "You already have a board with that name."
        : "That name is already on this board.";
    case "objectionable":
      return "That name can't be used. Other people on the board will see it.";
  }
};

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/**
 * Why somebody reported a board.
 *
 * **A closed set, and here rather than in the app or the backend**, because
 * both ends have to agree on it: the app puts these on buttons and the handler
 * refuses anything it does not recognise, so a reason added on one side and not
 * the other is a report the server rejects with the person none the wiser.
 *
 * Kept short deliberately. A long list makes somebody choose a category instead
 * of telling us what happened, and the free-text detail is the part that gets
 * acted on.
 */
export type ReportReason = "offensive-name" | "harassment" | "spam" | "other";

export const REPORT_REASONS: readonly ReportReason[] = [
  "offensive-name",
  "harassment",
  "spam",
  "other",
];

export const isReportReason = (value: unknown): value is ReportReason =>
  typeof value === "string" &&
  (REPORT_REASONS as readonly string[]).includes(value);

/** How much free text a report may carry. Enough to say what is wrong. */
export const MAX_REPORT_DETAIL = 1000;

/** What to put on the button for each reason. */
export const labelForReportReason = (reason: ReportReason): string => {
  switch (reason) {
    case "offensive-name":
      return "An offensive name";
    case "harassment":
      return "Harassment or bullying";
    case "spam":
      return "Spam or a scam";
    case "other":
      return "Something else";
  }
};
