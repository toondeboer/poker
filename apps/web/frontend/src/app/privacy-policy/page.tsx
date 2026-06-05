import React from "react";
import {
  Shield,
  Eye,
  Database,
  Smartphone,
  Mail,
  Calendar,
  AlertCircle,
} from "lucide-react";

const PrivacyPolicy: React.FC = () => {
  const appName = "Poker Blinds Buzzer";
  const companyName = "Poker Blinds Buzzer";
  const contactEmail = "poker.blinds.buzzer@gmail.com";
  const lastUpdated = "August 2025";
  const sections = [
    {
      id: "information-collection",
      icon: <Database className="w-6 h-6" />,
      title: "Information We Do NOT Collect",
      content: (
        <div className="space-y-4">
          <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400 mb-4">
            <p className="text-green-800 font-semibold mb-2">
              Privacy First Approach
            </p>
            <p className="text-green-700">
              Poker Blinds Buzzer does not collect, transmit, or store any
              personal data on external servers. All your information stays on
              your device.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">
              We Do NOT Collect:
            </h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Personal information or contact details</li>
              <li>Usage analytics or tracking data</li>
              <li>Device identifiers or location data</li>
              <li>Network activity or browsing behavior</li>
              <li>Any data transmitted to external servers</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">
              Local Storage Only
            </h4>
            <p className="text-gray-600 mb-2">
              The following information is stored locally on your device only:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Your custom timer and blind level configurations</li>
              <li>Sound and notification preferences</li>
              <li>Tournament structures you create</li>
              <li>App display settings</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: "data-usage",
      icon: <Eye className="w-6 h-6" />,
      title: "How Your Local Data Works",
      content: (
        <div className="space-y-3">
          <p className="text-gray-600">
            Your locally stored information is used only to:
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            <li>Save your timer preferences and settings</li>
            <li>Remember your custom tournament structures</li>
            <li>Maintain your sound and notification preferences</li>
            <li>Provide a personalized poker timing experience</li>
          </ul>
          <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
            <p className="text-blue-800 font-medium">
              Your data never leaves your device. We have no servers collecting
              or storing your information.
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-2">
              Complete Privacy
            </h4>
            <p className="text-gray-600">
              Since no data is transmitted or collected, there are no privacy
              concerns about data sharing, third-party access, or data breaches
              from our servers.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "data-storage",
      icon: <Smartphone className="w-6 h-6" />,
      title: "Local Data Storage",
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">
              Device-Only Storage
            </h4>
            <p className="text-gray-600 mb-2">
              All your data is stored exclusively on your device using secure
              local storage:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Tournament structures and blind levels</li>
              <li>Timer configurations and preferences</li>
              <li>Sound and notification settings</li>
              <li>Custom app configurations</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">Data Control</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>You have complete control over your data</li>
              <li>Data is deleted when you uninstall the app</li>
              <li>No external backups or cloud storage</li>
              <li>No data synchronization across devices</li>
            </ul>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
            <p className="text-yellow-800">
              <strong>Important:</strong> Since data is stored locally only,
              uninstalling the app will permanently delete your custom settings
              and tournament structures.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "third-party",
      icon: <AlertCircle className="w-6 h-6" />,
      title: "Third-Party Services",
      content: (
        <div className="space-y-3">
          <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
            <p className="text-green-800 font-semibold">
              No Third-Party Data Sharing
            </p>
            <p className="text-green-700 mt-1">
              Poker Blinds Buzzer does not integrate with any third-party
              analytics, advertising, or data collection services.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">
              What This Means:
            </h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>No analytics tracking (Google Analytics, Firebase, etc.)</li>
              <li>No advertising networks or ad tracking</li>
              <li>No crash reporting services</li>
              <li>No social media integrations</li>
              <li>No cloud storage or backup services</li>
            </ul>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-blue-800 font-medium">App Store Services</p>
            <p className="text-blue-700 text-sm mt-1">
              The only external connection is through your device&apos;s app
              store (Apple App Store/Google Play Store) for app downloads and
              updates, which are governed by their respective privacy policies.
            </p>
          </div>
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
                <p className="font-medium text-green-800">Access and Control</p>
                <p className="text-sm text-green-700">
                  View, modify, or delete your locally stored data at any time
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div>
                <p className="font-medium text-blue-800">Opt-Out</p>
                <p className="text-sm text-blue-700">
                  Disable analytics and crash reporting in app settings
                </p>
              </div>
            </div>
          </div>
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
              Poker Blinds Buzzer is designed with privacy in mind. We do not
              collect, store, or transmit any personal data. All your tournament
              settings, preferences, and configurations are stored locally on
              your device only.
            </p>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                Key Privacy Principles
              </h3>
              <ul className="space-y-1 text-blue-800">
                <li>• No data collection or transmission to servers</li>
                <li>• All your data stays on your device</li>
                <li>• No third-party tracking or analytics</li>
                <li>• Complete privacy and offline functionality</li>
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
                <li>Posting the new policy in the app</li>
                <li>Updating the &quot;Last updated&quot; date</li>
                <li>Sending an in-app notification for significant changes</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 py-8 border-t border-gray-200">
          <p className="text-gray-500 text-sm">
            © 2025 {companyName}. This privacy policy is effective as of{" "}
            {lastUpdated}.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
