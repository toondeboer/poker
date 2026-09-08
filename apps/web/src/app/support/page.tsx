import React from "react";
import type { Metadata } from "next";
import { LifeBuoy, Flag, Trash2, Mail, ShieldAlert, Coins } from "lucide-react";
import { CONTACT_EMAIL } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Support & Reporting — Poker Blinds Buzzer",
  description:
    "How to get help with Poker Blinds Buzzer, report offensive content on a shared leaderboard, and delete your account and data.",
};

const Support: React.FC = () => {
  const contactEmail = CONTACT_EMAIL;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="bg-white shadow-lg">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-600 rounded-xl">
              <LifeBuoy className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Support &amp; Reporting
              </h1>
              <p className="text-gray-600 mt-1">
                Poker Blinds Buzzer - how to reach a person
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="flex items-center space-x-4 mb-6">
            <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
              <Mail className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">Contact us</h2>
          </div>
          <p className="text-gray-600 mb-4">
            One address, read by a person, for everything below — bugs,
            questions, reports, refunds and data requests.
          </p>
          <p className="text-lg">
            <a
              href={`mailto:${contactEmail}`}
              className="font-medium text-blue-700 underline hover:text-blue-900"
            >
              {contactEmail}
            </a>
          </p>
          <p className="text-gray-600 text-sm mt-4">
            We aim to reply within <strong>2 business days</strong>. Reports of
            offensive content are looked at first.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="flex items-center space-x-4 mb-6">
            <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
              <Flag className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Reporting offensive content
            </h2>
          </div>
          <p className="text-gray-600 mb-4">
            A shared leaderboard carries names that the people on it typed —
            board names and player names. If something on a board you have
            joined is offensive, harassing, or spam, report it:
          </p>
          <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400 mb-4">
            <p className="text-blue-800 font-semibold mb-1">In the app</p>
            <p className="text-blue-700">
              Open the leaderboard, tap the boards list, and use the{" "}
              <strong>flag icon</strong> on the board in question. Pick a
              reason, add anything you want us to know, and send. That reaches
              us immediately.
            </p>
          </div>
          <p className="text-gray-600 mb-4">
            You can also email {contactEmail} with the board&apos;s name and
            what is wrong with it.
          </p>
          <div>
            <h3 className="font-semibold text-gray-800 mb-2">
              What happens next
            </h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>
                Every report is reviewed by a person, normally within 2 business
                days
              </li>
              <li>
                Content that breaks these rules is removed, and the account that
                posted it can be suspended or deleted
              </li>
              <li>We will tell you the outcome if you email us</li>
            </ul>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400 mt-4">
            <p className="text-yellow-800">
              <strong>You can also just leave.</strong> A shared board is the
              only way another person&apos;s content reaches you in this app.
              Tap the <strong>leave icon</strong> on that board in the boards
              list and it is removed from your phone and your account, and you
              stop getting its updates. You do not need to wait for us.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="flex items-center space-x-4 mb-6">
            <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
              <Coins className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Money, and what the app does with it
            </h2>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400 mb-4">
            <p className="text-blue-800 font-semibold mb-1">
              Nothing is wagered, staked or paid through this app.
            </p>
            <p className="text-blue-700">
              You cannot bet in it, buy chips in it, or cash anything out of it.
              There is no wallet, no balance and no payment of any kind between
              players — the only money the app ever handles is its own one-time
              Pro purchase, taken by Apple or Google.
            </p>
          </div>
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            <li>
              <strong>The card table deals, it does not run a game.</strong> It
              shuffles, deals two cards each, turns the flop, turn and river
              when you tell it to, and reads the showdown. It holds no chips —
              you play with the ones already in front of you
            </li>
            <li>
              <strong>The payout screen is a calculator.</strong> Enter a buy-in
              and it works out what each place wins tonight, the way a
              spreadsheet would. It settles nothing; the money changes hands at
              your table
            </li>
            <li>
              <strong>The leaderboard records results, not amounts.</strong> It
              keeps who played, who won and where people finished. No figure of
              any kind is stored or shared
            </li>
          </ul>
          <p className="text-gray-600 mt-4">
            If a home game plays for money, that happens between the people at
            the table and has nothing to do with this app — in the same way a
            kitchen timer has nothing to do with what is being cooked.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="flex items-center space-x-4 mb-6">
            <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">
              What isn&apos;t allowed
            </h2>
          </div>
          <p className="text-gray-600 mb-4">
            Board names and player names are seen by everyone on that board.
            They must not contain:
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            <li>Slurs, or anything degrading a person or a group</li>
            <li>Harassment, threats, or content targeting a specific person</li>
            <li>Sexual content, or anything involving a minor</li>
            <li>Spam, scams, or advertising</li>
            <li>Impersonation of somebody else</li>
          </ul>
          <p className="text-gray-600 mt-4">
            The app refuses the obvious cases as you type. That filter is a
            speed bump, not a moderator — which is why reporting exists beside
            it.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8" id="delete-account">
          <div className="flex items-center space-x-4 mb-6">
            <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
              <Trash2 className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Deleting your account and data
            </h2>
          </div>
          <p className="text-gray-600 mb-4">
            You can do this yourself, from inside the app:{" "}
            <strong>Settings → Account → Delete account</strong>. No form, and
            no waiting on us.
          </p>
          <div>
            <h3 className="font-semibold text-gray-800 mb-2">
              What is deleted
            </h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Your login and email address</li>
              <li>
                Every board membership and every claim linking you to a player
              </li>
              <li>
                Boards only you were on, including the games recorded on them
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-2 mt-4">
              What is kept
            </h3>
            <p className="text-gray-600">
              Games you recorded on a board other people are still on stay on
              that board — they are those players&apos; history as much as
              yours. Your account is no longer linked to them.
            </p>
          </div>
          <p className="text-gray-600 mt-4">
            If you can&apos;t reach the app, email {contactEmail} from the
            address on the account and we will delete it for you. See the{" "}
            <a href="/privacy-policy" className="underline hover:text-gray-900">
              Privacy Policy
            </a>{" "}
            for what is stored and why.
          </p>
        </div>

        <div className="text-center py-8 border-t border-gray-200">
          <p className="text-gray-500 text-sm">© 2026 Poker Blinds Buzzer.</p>
        </div>
      </div>
    </div>
  );
};

export default Support;
