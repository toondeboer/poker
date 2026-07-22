import Link from "next/link";

const FAQ = [
  {
    question: "Is this poker timer free?",
    answer:
      "Yes. The web timer is completely free to use, with no sign-up required. An optional Pro upgrade in the mobile app removes ads and adds saved tournament presets and alarm sound packs.",
  },
  {
    question: "Can I customize the blind levels?",
    answer:
      "Yes. Open Settings to change the round length, and add, remove, or edit any blind level to match your own tournament structure.",
  },
  {
    question: "Does it work without an internet connection?",
    answer:
      "The web timer needs a connection to load the page, but once it's open the countdown, blinds schedule, and controls all run locally in your browser — no server round-trips. The mobile app works fully offline.",
  },
  {
    question: "Is there a mobile app version?",
    answer:
      "Yes. Poker Blinds Buzzer is available for iOS and Android, with background timer notifications, haptics, and offline support that a browser tab can't provide.",
  },
];

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

export function TimerSeoContent() {
  return (
    <section className="bg-gray-900 px-4 py-16 text-gray-300 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        // Static, hand-written JSON — not user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-4 text-2xl font-bold text-white">
          About This Free Poker Timer
        </h2>
        <p className="mb-4">
          This poker blinds timer helps home games and small tournaments
          track rising blind levels without a dedicated clock. Set your round
          length and blind structure once, start the countdown, and it keeps
          everyone at the table honest about when blinds go up.
        </p>

        <h2 className="mb-4 mt-10 text-2xl font-bold text-white">
          How to Use It
        </h2>
        <ol className="mb-4 list-inside list-decimal space-y-2">
          <li>
            Open <strong>Settings</strong> to set the round length and edit
            the blind levels, or start with the default structure.
          </li>
          <li>Press start to begin the countdown for the current level.</li>
          <li>
            When a level ends, the timer plays a sound and moves to the next
            blinds automatically — or step through levels manually with the
            previous/next controls.
          </li>
        </ol>

        <h2 className="mb-4 mt-10 text-2xl font-bold text-white">
          Frequently Asked Questions
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
          Want it on your phone with offline support and background alerts?{" "}
          <Link href="/" className="underline hover:text-white">
            Get the Poker Blinds Buzzer app
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
