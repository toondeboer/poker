import Link from "next/link";

const STEPS = [
  {
    name: "Set the buy-in and starting stack",
    text: "Decide a buy-in everyone's comfortable with and give each player the same starting stack. A common ratio is 100x the starting big blind (e.g. a 1500-chip stack against a 10/15 opening level) — deep enough that early hands aren't a coin flip, shallow enough that the tournament doesn't run all night.",
  },
  {
    name: "Pick a blind structure and round length",
    text: "Blinds need to escalate on a schedule, or the game never ends — that's what a blinds timer is for. Poker Blinds Buzzer ships with a ready-made 30-level structure (5/10 up to 800/1600, big blind always double the small blind) and a 10-minute default round length, both fully editable in Settings if you want faster or slower blind increases.",
  },
  {
    name: "Agree on the payout structure before cards are dealt",
    text: "For a small home game, winner-take-all or a top-two split (e.g. 70/30) keeps things simple. Settle this before the first hand — not when it's down to the final two players.",
  },
  {
    name: "Start the timer and keep it visible",
    text: "Put the timer where the whole table can see it — a phone propped up or a laptop screen works. Start the countdown for the current level; it'll sound an alert and move to the next blind level automatically when time's up, or you can step through levels manually.",
  },
  {
    name: "Handle rebuys and breaks up front, not mid-game",
    text: "If you're allowing rebuys or an add-on, set a cutoff level (e.g. no rebuys after level 6) and announce it before starting. For longer sessions, pause the timer for a break between levels rather than mid-round.",
  },
];

const FAQ = [
  {
    question: "How many blind levels does a home tournament need?",
    answer:
      "It depends on how long you want to play. At the default 10-minute rounds, the app's built-in 30-level structure covers roughly 5 hours if you play every level — most home games end well before the final levels once players are eliminated. Shorten the round length for a quicker \"turbo\" night, or lengthen it for a deeper, more strategic game.",
  },
  {
    question: "Should blinds go up every 10 minutes?",
    answer:
      "10 minutes is a reasonable default for a casual home game — long enough to play real poker at each level, short enough that the tournament has a clear endpoint. Faster home games often use 8 minutes; deeper, slower games use 15–20.",
  },
  {
    question: "Do I need antes as well as blinds?",
    answer:
      "Not for a casual home game — most groups run fine on small/big blind alone, which is what Poker Blinds Buzzer's structure uses. Antes add complexity that mainly matters for longer, more formal tournaments.",
  },
  {
    question: "What if my group wants a different blind structure every time?",
    answer:
      "Edit the levels and round length in Settings, then save it as a named preset (Pro) so you can load the same structure again next game night without re-entering it.",
  },
];

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Run a Home Poker Tournament",
  description:
    "A step-by-step guide to running a home poker tournament: buy-ins, blind structure, payouts, and keeping the game on schedule.",
  step: STEPS.map(({ name, text }) => ({
    "@type": "HowToStep",
    name,
    text,
  })),
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: {
      "@type": "Answer",
      text: answer,
    },
  })),
};

export function GuideContent() {
  return (
    <section className="bg-gray-900 px-4 py-16 text-gray-300 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        // Static, hand-written JSON — not user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
      <script
        type="application/ld+json"
        // Static, hand-written JSON — not user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-4 text-3xl font-bold text-white">
          How to Run a Home Poker Tournament
        </h1>
        <p className="mb-10">
          Five things to settle before the first hand so the game runs
          itself from there: buy-in, blind structure, payouts, and a timer
          everyone can see.
        </p>

        <h2 className="mb-6 text-2xl font-bold text-white">
          Step by Step
        </h2>
        <ol className="mb-4 space-y-6">
          {STEPS.map(({ name, text }, i) => (
            <li key={name}>
              <h3 className="mb-1 font-semibold text-white">
                {i + 1}. {name}
              </h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>

        <h2 className="mb-4 mt-10 text-2xl font-bold text-white">
          Understanding Blind Structures
        </h2>
        <p className="mb-4">
          The blind structure is what keeps a tournament moving — without
          rising blinds, a deep-stacked table could play the same level all
          night. Each level is a small blind / big blind pair (the big blind
          is conventionally double the small blind), and the round length is
          how long each level lasts before the blinds step up.
        </p>
        <p className="mb-4">
          A <strong>faster</strong> structure (shorter rounds, bigger jumps
          between levels) favors an aggressive, short &quot;turbo&quot;
          session. A <strong>slower</strong> structure (longer rounds,
          smaller jumps) gives skill more room to matter but takes longer to
          reach a winner. Poker Blinds Buzzer&apos;s default structure — 30 levels from
          5/10 up to 800/1600, 10 minutes per level — sits in the middle,
          and every level and the round length can be edited in Settings to
          suit your group.
        </p>

        <h2 className="mb-4 mt-10 text-2xl font-bold text-white">
          FAQ
        </h2>
        <div className="space-y-6">
          {FAQ.map(({ question, answer }) => (
            <div key={question}>
              <h3 className="mb-1 font-semibold text-white">{question}</h3>
              <p>{answer}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-sm text-gray-400">
          Ready to run the clock?{" "}
          <Link href="/timer" className="underline hover:text-white">
            Use the free web timer
          </Link>{" "}
          or{" "}
          <Link href="/" className="underline hover:text-white">
            get the Poker Blinds Buzzer app
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
