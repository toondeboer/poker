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

interface PrivacyPolicyProps {
  appName?: string;
  companyName?: string;
  contactEmail?: string;
  lastUpdated?: string;
}

const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({
  appName = "Poker Blinds Buzzer",
  companyName = "Poker Blinds Buzzer",
  contactEmail = "poker.blinds.buzzer@gmail.com",
  lastUpdated = "August 2025",
}) => {
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
      title: "How We Use Your Information",
      content: (
        <div className="space-y-3">
          <p className="text-gray-600">We use the collected information to:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            <li>Provide and maintain the poker timer functionality</li>
            <li>Save your preferences and game settings</li>
            <li>Improve app performance and user experience</li>
            <li>Fix bugs and prevent crashes</li>
            <li>Analyze usage patterns to enhance features</li>
            <li>Provide customer support when requested</li>
          </ul>
          <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
            <p className="text-blue-800 font-medium">
              We do not share, sell, or rent your personal information to third
              parties for marketing purposes.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "data-storage",
      icon: <Smartphone className="w-6 h-6" />,
      title: "Data Storage and Security",
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">Local Storage</h4>
            <p className="text-gray-600 mb-2">
              Most of your data is stored locally on your device, including:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Tournament structures and blind levels</li>
              <li>Player information and game history</li>
              <li>App preferences and settings</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">
              Security Measures
            </h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Data encryption in transit and at rest</li>
              <li>Secure authentication protocols</li>
              <li>Regular security audits and updates</li>
              <li>Limited access to personal information</li>
            </ul>
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
          <p className="text-gray-600">
            Our app may use third-party services for:
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-2">Analytics</h4>
              <p className="text-sm text-gray-600">
                Anonymous usage statistics to improve the app experience
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-2">
                Crash Reporting
              </h4>
              <p className="text-sm text-gray-600">
                Error logs to identify and fix app issues
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-500 italic">
            These services have their own privacy policies and may collect
            additional information.
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
              At {companyName}, we respect your privacy and are committed to
              protecting your personal information. This Privacy Policy explains
              how we collect, use, and safeguard your information when you use{" "}
              {appName}.
            </p>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                Key Privacy Principles
              </h3>
              <ul className="space-y-1 text-blue-800">
                <li>• Your tournament data stays on your device</li>
                <li>• We don't sell your personal information</li>
                <li>• You control your data and privacy settings</li>
                <li>• Minimal data collection for essential functionality</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Privacy Sections */}
        <div className="space-y-8">
          {sections.map((section, index) => (
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
                <li>Updating the "Last updated" date</li>
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
