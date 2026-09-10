import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText, Ban, Users, Flag, CreditCard, Mail } from "lucide-react";
import { CONTACT_EMAIL } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Terms of Use — Poker Blinds Buzzer",
  description:
    "The terms you agree to by using Poker Blinds Buzzer, including the zero-tolerance rule for objectionable content on shared leaderboards.",
};

const Terms: React.FC = () => {
  const contactEmail = CONTACT_EMAIL;
  const lastUpdated = "September 2026";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="bg-white shadow-lg">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-600 rounded-xl">
              <ScrollText className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Terms of Use</h1>
              <p className="text-gray-600 mt-1">
                Poker Blinds Buzzer — last updated {lastUpdated}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <p className="text-gray-600">
            Poker Blinds Buzzer is a blind timer and scorekeeper for home poker
            games. By using it you agree to what follows. If you do not agree,
            please do not use the app. Most of it works with no account and no
            network at all; the parts that involve other people are the parts
            these terms are mostly about.
          </p>
        </div>

        {/* The clause Guideline 1.2 is about. Kept first and kept blunt. */}
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="flex items-center space-x-4 mb-6">
            <div className="p-2 bg-red-100 rounded-lg text-red-600">
              <Ban className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Zero tolerance for objectionable content
            </h2>
          </div>
          <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-400 mb-4">
            <p className="text-red-800">
              <strong>
                There is no tolerance for objectionable content or abusive
                behaviour on a shared leaderboard.
              </strong>{" "}
              Accounts that post it lose access, and the content is removed.
            </p>
          </div>
          <p className="text-gray-600 mb-4">
            A shared leaderboard carries text that the people on it typed —
            board names and player names. You agree not to enter, and not to
            share, anything that is:
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-600 mb-4">
            <li>
              offensive, hateful, or degrading to any person or group, including
              slurs
            </li>
            <li>harassing, threatening, or intended to bully somebody</li>
            <li>sexually explicit, or otherwise obscene</li>
            <li>
              somebody else&apos;s personal information, posted without their
              agreement
            </li>
            <li>spam, advertising, or a link to anything above</li>
          </ul>
          <p className="text-gray-600">
            The app filters names as they are entered, but a filter catches only
            what it knows. Reporting is what catches the rest.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="flex items-center space-x-4 mb-6">
            <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
              <Flag className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Reporting, and what happens next
            </h2>
          </div>
          <p className="text-gray-600 mb-4">
            If something on a board you have joined breaks the rule above,
            report it from inside the app — open the board, then{" "}
            <strong>Report this board</strong>. You can also email{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="font-medium text-blue-700 underline hover:text-blue-900"
            >
              {contactEmail}
            </a>
            .
          </p>
          <p className="text-gray-600 mb-4">
            Reports are read first, ahead of everything else. Content that
            breaks these terms is removed, and the account responsible loses
            access to sharing — permanently, if it happens again. See the{" "}
            <Link
              href="/support"
              className="font-medium text-blue-700 underline hover:text-blue-900"
            >
              Support page
            </Link>{" "}
            for how quickly you can expect an answer.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="flex items-center space-x-4 mb-6">
            <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
              <Users className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Boards, and leaving one
            </h2>
          </div>
          <p className="text-gray-600 mb-4">
            Boards are invite-only. Nobody can add you to one; you join by
            opening a link somebody gave you, and until you do, nothing they
            type is visible to you.
          </p>
          <p className="text-gray-600">
            You can <strong>leave a board at any time</strong>, which removes
            its names from your device. An admin of a board can remove a member
            from it. Between them, that is how you stop seeing content from
            somebody you would rather not share a board with.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="flex items-center space-x-4 mb-6">
            <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
              <CreditCard className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Money, purchases, and what this app is not
            </h2>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400 mb-4">
            <p className="text-blue-800">
              <strong>
                Nothing is wagered, staked or paid through this app.
              </strong>{" "}
              There is no way to bet in it, buy chips in it, or cash anything
              out of it — no wallet, no balance, and no payment of any kind
              between players.
            </p>
          </div>
          <p className="text-gray-600 mb-4">
            The payout and chop screens are calculators for money that changes
            hands away from the phone, at a real table. They settle nothing and
            store nothing.
          </p>
          <p className="text-gray-600">
            The only money the app handles is its own purchases — a one-time Pro
            upgrade and the Club subscription — taken by Apple or Google, under
            their terms. Subscriptions renew until cancelled, and are cancelled
            in the App Store or Play Store rather than here.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="flex items-center space-x-4 mb-6">
            <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
              <Mail className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">
              The rest of it
            </h2>
          </div>
          <p className="text-gray-600 mb-4">
            The app is provided as it is, without warranty. It is a timer and a
            scorekeeper for a game among friends; it is not responsible for what
            anybody at the table agrees to, or for a game that ends badly.
          </p>
          <p className="text-gray-600 mb-4">
            You are responsible for what you type into it, and for keeping your
            account details to yourself. You can delete your account and its
            data from Settings, or by asking at the address below.
          </p>
          <p className="text-gray-600">
            What the app collects and why is in the{" "}
            <Link
              href="/privacy-policy"
              className="font-medium text-blue-700 underline hover:text-blue-900"
            >
              Privacy Policy
            </Link>
            . Questions about these terms go to{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="font-medium text-blue-700 underline hover:text-blue-900"
            >
              {contactEmail}
            </a>
            .
          </p>
        </div>

        <div className="text-center py-8 border-t border-gray-200">
          <p className="text-gray-500 text-sm">
            © 2026 Poker Blinds Buzzer. These terms are effective as of{" "}
            {lastUpdated}.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Terms;
