import React from "react";
import {
  Shield,
  Eye,
  Database,
  Smartphone,
  Mail,
  Calendar,
  AlertCircle,
  Server,
  Users,
  Megaphone,
  Trash2,
} from "lucide-react";
import { CONTACT_EMAIL } from "@/lib/contact";

const PrivacyPolicy: React.FC = () => {
  const appName = "Poker Blinds Buzzer";
  const companyName = "Poker Blinds Buzzer";
  const contactEmail = CONTACT_EMAIL;
  const lastUpdated = "September 2026";
  const sections = [
    {
      id: "information-collection",
      icon: <Database className="w-6 h-6" />,
      title: "What the App Collects",
      content: (
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400 mb-4">
            <p className="text-blue-800 font-semibold mb-2">
              Local First, Server Only Where It Has To Be
            </p>
            <p className="text-blue-700">
              The timer, your blind structures, your settings and your payout
              maths all work with no account and no network. Two things reach
              our servers, and only if you choose them: an{" "}
              <strong>account</strong>, and a{" "}
              <strong>shared leaderboard</strong>. The app also shows{" "}
              <strong>ads</strong> unless you buy Pro, and ads involve Google.
              Each of those is described below.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">
              If You Never Sign In
            </h4>
            <p className="text-gray-600 mb-2">
              Nothing you create is sent anywhere. The app asks our server one
              question at launch — whether accounts and sharing are switched on
              — and that request carries no account, no identifier and no
              content. Beyond that, the only network activity is loading ads.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">
              If You Create an Account
            </h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>
                Your <strong>email address</strong>, so the account can be
                confirmed, signed in to, and recovered
              </li>
              <li>
                A <strong>password</strong>, which is stored by AWS Cognito in
                hashed form — we never see or store it ourselves
              </li>
              <li>
                An <strong>account identifier</strong> generated for you, which
                is what your boards and memberships are filed under
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">
              If You Share or Join a Leaderboard
            </h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>The board&apos;s name</li>
              <li>
                The <strong>player names you type</strong> — these are free text
                you choose, and they are visible to everyone on that board
              </li>
              <li>
                Recorded game results: who finished where, winnings, knockouts
                and bounties
              </li>
              <li>
                Who is a member of the board, which player each member has
                claimed as themselves, and who is an admin
              </li>
              <li>Invite codes for the board, until they are replaced</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">
              What the App Still Does Not Collect
            </h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>No analytics or usage tracking inside the app</li>
              <li>No location data</li>
              <li>No contacts, photos, microphone or camera access</li>
              <li>
                No advertising profile built by us, and no cross-app tracking
              </li>
              <li>
                No real names, addresses or payment details — purchases are
                handled entirely by Apple and Google
              </li>
            </ul>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-gray-600 text-sm">
              <strong>Version note:</strong> accounts and shared leaderboards
              were added in version 1.2.0. Earlier versions had no accounts and
              no server storage of any kind.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "data-storage",
      icon: <Smartphone className="w-6 h-6" />,
      title: "What Stays on Your Device",
      content: (
        <div className="space-y-4">
          <div>
            <p className="text-gray-600 mb-2">
              The following never leaves your phone unless you put it on a
              shared board yourself:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>
                Timer configurations, blind levels and tournament structures
              </li>
              <li>Saved tournament presets</li>
              <li>Sound, alarm and notification preferences</li>
              <li>Buy-in and payout setup</li>
              <li>
                Any leaderboard you keep to yourself, including every game
                recorded on it
              </li>
              <li>A game in progress, so it survives the app closing</li>
            </ul>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
            <p className="text-yellow-800">
              <strong>Important:</strong> data held only on your device is
              deleted when you uninstall the app, and we cannot recover it. A
              board you have shared is also stored on our servers, so that one
              comes back when you sign in again.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "accounts",
      icon: <Users className="w-6 h-6" />,
      title: "Accounts and Email",
      content: (
        <div className="space-y-3">
          <p className="text-gray-600">
            An account is optional. The timer, the payout maths and a private
            leaderboard all work without one — you need an account only to share
            a board, or to have your boards follow you to another device.
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            <li>
              Accounts are held in <strong>AWS Cognito</strong>, in the AWS{" "}
              <code className="text-sm">us-east-1</code> region (United States)
            </li>
            <li>
              When you sign up we email you a confirmation code using{" "}
              <strong>Amazon SES</strong>. That mail goes to the address you
              gave, and its purpose is confirming the address is yours
            </li>
            <li>
              We use your email address for account confirmation, sign-in and
              password reset. <strong>We do not send marketing email</strong>,
              and there is no mailing list to be added to
            </li>
            <li>
              Your email address is <strong>not</strong> shown to other members
              of a board you join — they see the player name, not the address
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: "shared-boards",
      icon: <Server className="w-6 h-6" />,
      title: "Shared Leaderboards",
      content: (
        <div className="space-y-3">
          <p className="text-gray-600">
            A shared board is stored in <strong>Amazon DynamoDB</strong> in the
            AWS <code className="text-sm">us-east-1</code> region (United
            States), so that everyone you play with sees the same standings.
          </p>
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">Who Can See It</h4>
            <p className="text-gray-600">
              Only accounts that have redeemed an invite code for that board.
              Boards are not public, not searchable, and not indexed. Whoever
              shares a board decides who gets the code; the code never expires,
              so sharing again replaces the previous one and is the way to take
              one back.
            </p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
            <p className="text-yellow-800">
              <strong>
                Player names are free text and other people see them.
              </strong>{" "}
              Type whatever the table calls each other, but treat a shared board
              the way you would a group chat: don&apos;t put anything in a name
              you wouldn&apos;t want the whole board to read.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">Retention</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>
                Board content is kept for as long as the board exists and you
                are on it
              </li>
              <li>
                When a player or a game is deleted, a record that it was deleted
                is kept for <strong>90 days</strong> so that the deletion also
                reaches the other phones on the board, then removed
                automatically
              </li>
              <li>
                Leaving a board removes your membership and your claim on a
                player. Games already recorded stay on the board — they are part
                of other people&apos;s history too
              </li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: "advertising",
      icon: <Megaphone className="w-6 h-6" />,
      title: "Advertising",
      content: (
        <div className="space-y-3">
          <p className="text-gray-600">
            The free version of the app shows banner ads supplied by{" "}
            <strong>Google AdMob</strong>. Buying Pro removes them entirely.
          </p>
          <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
            <p className="text-blue-800 font-medium">
              The app requests <strong>non-personalized ads only</strong>. Ads
              are chosen from the app&apos;s context rather than from a profile
              of you, and the app does not ask for permission to track you
              across other apps and websites — because it does not do that.
            </p>
          </div>
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            <li>
              To serve and measure an ad, and to prevent fraud, Google may
              process device information such as a device advertising
              identifier, coarse location derived from an IP address, and device
              type
            </li>
            <li>
              We do not receive that data. We see only aggregate counts of ads
              shown and revenue earned — nothing that identifies a person
            </li>
            <li>
              We do not combine advertising data with your account or your
              boards, and we never send your email address, player names or
              board contents to an advertiser
            </li>
            <li>
              Google&apos;s handling of this data is governed by the{" "}
              <a
                href="https://policies.google.com/technologies/partner-sites"
                className="underline hover:text-gray-800"
                target="_blank"
                rel="noreferrer"
              >
                Google Privacy &amp; Terms
              </a>
            </li>
            <li>
              You can reset or limit your advertising identifier in your
              device&apos;s own settings — iOS: Settings → Privacy &amp;
              Security → Tracking and Apple Advertising; Android: Settings →
              Privacy → Ads
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: "website-analytics",
      icon: <Eye className="w-6 h-6" />,
      title: "Website Analytics",
      content: (
        <div className="space-y-3">
          <p className="text-gray-600">
            This website (not the app itself) uses Google Analytics to help us
            understand how visitors find and use the site — for example, which
            pages are popular and how people arrive here.
          </p>
          <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
            <p className="text-blue-800 font-medium">
              Google Analytics only runs if you choose &quot;Accept&quot; on the
              cookie-consent banner shown when you first visit. If you choose
              &quot;Decline&quot; (or take no action), no analytics script loads
              and no data is sent to Google.
            </p>
          </div>
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            <li>
              When enabled, Google Analytics may collect information such as
              pages visited, approximate location, device/browser type, and how
              you interact with the site
            </li>
            <li>
              This data is processed by Google in line with the{" "}
              <a
                href="https://policies.google.com/privacy"
                className="underline hover:text-gray-800"
                target="_blank"
                rel="noreferrer"
              >
                Google Privacy Policy
              </a>
            </li>
            <li>
              You can change your choice at any time by clearing your
              browser&apos;s site data for this domain, which will show the
              consent banner again
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: "third-party",
      icon: <AlertCircle className="w-6 h-6" />,
      title: "Third-Party Services",
      content: (
        <div className="space-y-3">
          <p className="text-gray-600">
            These are every third party the app or this website involves, and
            what each one is for:
          </p>
          <div className="space-y-3">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-semibold text-gray-800">
                Amazon Web Services (AWS)
              </p>
              <p className="text-gray-600 text-sm mt-1">
                Cognito holds accounts, DynamoDB holds shared boards, and SES
                sends confirmation email. Hosted in{" "}
                <code className="text-sm">us-east-1</code> (United States). AWS
                acts as our processor.
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-semibold text-gray-800">Google AdMob</p>
              <p className="text-gray-600 text-sm mt-1">
                Serves the banner ads in the free version, requested as
                non-personalized. See &quot;Advertising&quot; above. Removed
                entirely by Pro.
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-semibold text-gray-800">RevenueCat</p>
              <p className="text-gray-600 text-sm mt-1">
                Checks whether a purchase entitles you to Pro. It receives an
                app-generated identifier and the receipt from the app store —
                not your email address, and no board content.
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-semibold text-gray-800">
                Apple App Store / Google Play
              </p>
              <p className="text-gray-600 text-sm mt-1">
                Handle downloads, updates and all payment. We never see your
                payment details. Governed by their own privacy policies.
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-semibold text-gray-800">
                Google Analytics (this website only)
              </p>
              <p className="text-gray-600 text-sm mt-1">
                Consent-based, and never running in the app. See &quot;Website
                Analytics&quot; above.
              </p>
            </div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
            <p className="text-blue-800 font-medium">
              We do not sell your personal information, and we do not share it
              with data brokers.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "deletion",
      icon: <Trash2 className="w-6 h-6" />,
      title: "Deleting Your Account and Data",
      content: (
        <div className="space-y-3">
          <p className="text-gray-600">
            You can delete your account from inside the app — Settings → Account
            → Delete account. No email, no form, no waiting on us.
          </p>
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">
              What Deletion Removes
            </h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Every board membership you hold</li>
              <li>Every claim linking you to a player on a board</li>
              <li>
                Boards that only you were on, including the games recorded on
                them
              </li>
              <li>
                Your login itself, which is deleted last so that nothing is left
                behind that no one can reach
              </li>
            </ul>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
            <p className="text-yellow-800">
              <strong>What survives, and why:</strong> games you recorded on a
              board other people are still on stay on that board. They are those
              players&apos; history as much as yours, and removing them would
              silently rewrite a season for everyone else. Your name is no
              longer linked to the account that recorded them.
            </p>
          </div>
          <p className="text-gray-600">
            Deleting the app without deleting the account leaves the account in
            place. If you can&apos;t reach the app, email us at {contactEmail}{" "}
            from the address on the account and we will delete it for you.
          </p>
        </div>
      ),
    },
    {
      id: "user-rights",
      icon: <Shield className="w-6 h-6" />,
      title: "Your Rights and Choices",
      content: (
        <div className="space-y-3">
          <p className="text-gray-600">You have the right to:</p>
          <div className="grid gap-3">
            <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <p className="font-medium text-green-800">
                  Use the App Without an Account
                </p>
                <p className="text-sm text-green-700">
                  The timer, structures, presets and a private leaderboard all
                  work with no sign-up and no server storage at all
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <p className="font-medium text-green-800">Delete Everything</p>
                <p className="text-sm text-green-700">
                  Delete your account and its server-side data from inside the
                  app at any time — see above
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div>
                <p className="font-medium text-blue-800">
                  Access and Correct Your Data
                </p>
                <p className="text-sm text-blue-700">
                  Player names and board names are editable in the app. For a
                  copy of what we hold on your account, email {contactEmail}{" "}
                  from the address on the account
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div>
                <p className="font-medium text-blue-800">Opt Out of Ads</p>
                <p className="text-sm text-blue-700">
                  Buying Pro removes ads entirely. Ads are non-personalized
                  either way, and your device settings can reset or limit the
                  advertising identifier
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div>
                <p className="font-medium text-blue-800">
                  Leave a Board, and Report One
                </p>
                <p className="text-sm text-blue-700">
                  Leaving a shared board ends your membership and stops its
                  content reaching you. If something on a board is offensive,
                  report it from the board&apos;s own menu and we will review it
                </p>
              </div>
            </div>
          </div>
          <p className="text-gray-600 text-sm">
            Depending on where you live, you may have further rights under laws
            such as the GDPR or the CCPA — including access, correction,
            deletion, and objecting to processing. Email {contactEmail} and we
            will action it.
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-lg">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-600 rounded-xl">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Privacy Policy
              </h1>
              <p className="text-gray-600 mt-1">
                {appName} - Protecting your privacy
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Overview */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
          <div className="flex items-center space-x-3 mb-6">
            <Calendar className="w-6 h-6 text-gray-500" />
            <span className="text-sm text-gray-500">
              Last updated: {lastUpdated}
            </span>
          </div>

          <div className="prose prose-gray max-w-none">
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              Poker Blinds Buzzer is built to work without knowing who you are.
              The timer, your blind structures, your settings and your payout
              maths all run entirely on your device, with no account and no
              network. Two optional features do involve our servers — an{" "}
              <strong>account</strong> and a <strong>shared leaderboard</strong>{" "}
              — and the free version shows <strong>ads</strong> supplied by
              Google. This policy says exactly what each of those involves.
            </p>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                Key Privacy Principles
              </h3>
              <ul className="space-y-1 text-blue-800">
                <li>
                  • Everything except accounts and shared boards works offline,
                  on your device only
                </li>
                <li>
                  • An account means an email address and nothing more — no
                  marketing, ever
                </li>
                <li>
                  • A shared board is visible only to people you send the invite
                  code to
                </li>
                <li>
                  • Ads are non-personalized, and Pro removes them altogether
                </li>
                <li>
                  • No analytics or tracking inside the app; this website loads
                  Google Analytics only if you accept the banner
                </li>
                <li>
                  • You can delete your account, and everything on our servers,
                  from inside the app
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Privacy Sections */}
        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.id} className="bg-white rounded-xl shadow-sm p-8">
              <div className="flex items-center space-x-4 mb-6">
                <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
                  {section.icon}
                </div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  {section.title}
                </h2>
              </div>
              {section.content}
            </div>
          ))}
        </div>

        {/* Contact and Updates */}
        <div className="bg-white rounded-xl shadow-sm p-8 mt-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <Mail className="w-6 h-6 text-gray-500" />
                <h3 className="text-xl font-semibold text-gray-900">
                  Contact Us
                </h3>
              </div>
              <p className="text-gray-600 mb-4">
                If you have questions about this Privacy Policy or our data
                practices, please contact us:
              </p>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">Email:</span> {contactEmail}
                </p>
                <p>
                  <span className="font-medium">Company:</span> {companyName}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-3 mb-4">
                <AlertCircle className="w-6 h-6 text-gray-500" />
                <h3 className="text-xl font-semibold text-gray-900">
                  Policy Updates
                </h3>
              </div>
              <p className="text-gray-600 mb-4">
                We may update this Privacy Policy from time to time. We will
                notify you of any changes by:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                <li>Posting the new policy on this page</li>
                <li>Updating the &quot;Last updated&quot; date</li>
                <li>Sending an in-app notification for significant changes</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 py-8 border-t border-gray-200">
          <p className="text-gray-500 text-sm">
            © 2026 {companyName}. This privacy policy is effective as of{" "}
            {lastUpdated}.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
