import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  Clock,
  Bell,
  Trophy,
  Shield,
  Smartphone,
  Monitor,
  LucideIcon,
} from "lucide-react";
import Image, { StaticImageData } from "next/image";
import icon from "../../assets/icon.png";
import screenshot_1 from "../../assets/screenshots/screenshot_1.jpeg";
import screenshot_2 from "../../assets/screenshots/screenshot_2.jpeg";
import screenshot_3 from "../../assets/screenshots/screenshot_3.jpeg";
import screenshot_4 from "../../assets/screenshots/screenshot_4.jpeg";
import screenshot_5 from "../../assets/screenshots/screenshot_5.jpeg";
import screenshot_6 from "../../assets/screenshots/screenshot_6.jpeg";
import screenshot_7 from "../../assets/screenshots/screenshot_7.jpeg";

const appleAppStoreLink: string =
  "https://apps.apple.com/nl/app/poker-blinds-buzzer/id6749512168?l=en-GB";
const googlePlayStoreLink: string = "https://google.com"; // TODO

interface ScreenshotMap {
  [key: number]: StaticImageData;
}

// Helper function to get screenshot imports
const getScreenshotImage = (number: number): StaticImageData => {
  const screenshots: ScreenshotMap = {
    1: screenshot_1,
    2: screenshot_2,
    3: screenshot_3,
    4: screenshot_4,
    5: screenshot_5,
    6: screenshot_6,
    7: screenshot_7,
  };
  return screenshots[number];
};

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const LandingPage: React.FC = () => {
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = (): void => {
      const userAgent: string =
        navigator.userAgent || navigator.vendor || (window as any).opera;
      setIsMobile(/android|iPad|iPhone|iPod/.test(userAgent.toLowerCase()));
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const scrollToSection = (id: string): void => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setIsMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-black/20 backdrop-blur-md border-b border-white/10 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Image
                src={icon}
                alt="Poker Timer Logo"
                className="w-10 h-10 rounded-lg flex items-center justify-center"
              />
              <span className="text-white font-bold text-xl">
                Poker Blinds Buzzer
              </span>
            </div>

            <div className="hidden md:flex items-center space-x-8">
              <button
                onClick={() => scrollToSection("features")}
                className="text-gray-300 hover:text-white transition-colors"
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection("screenshots")}
                className="text-gray-300 hover:text-white transition-colors"
              >
                Screenshots
              </button>
              <a
                href="/privacy"
                className="text-gray-300 hover:text-white transition-colors"
              >
                Privacy
              </a>
              <a
                href="/demo"
                className="text-gray-300 hover:text-white transition-colors"
              >
                Demo
              </a>
            </div>

            <button
              className="md:hidden text-white"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <div className="w-6 h-6 flex flex-col justify-center space-y-1">
                <div
                  className={`w-full h-0.5 bg-white transform transition-all ${isMenuOpen ? "rotate-45 translate-y-2" : ""}`}
                ></div>
                <div
                  className={`w-full h-0.5 bg-white transition-all ${isMenuOpen ? "opacity-0" : ""}`}
                ></div>
                <div
                  className={`w-full h-0.5 bg-white transform transition-all ${isMenuOpen ? "-rotate-45 -translate-y-2" : ""}`}
                ></div>
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-black/90 backdrop-blur-md border-t border-white/10">
            <div className="px-4 pt-2 pb-3 space-y-1">
              <button
                onClick={() => scrollToSection("features")}
                className="block w-full text-left px-3 py-2 text-gray-300 hover:text-white"
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection("screenshots")}
                className="block w-full text-left px-3 py-2 text-gray-300 hover:text-white"
              >
                Screenshots
              </button>
              <a
                href="/privacy"
                className="block px-3 py-2 text-gray-300 hover:text-white"
              >
                Privacy
              </a>
              <a
                href="/demo"
                className="block px-3 py-2 text-gray-300 hover:text-white"
              >
                Demo
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <Image
              src={icon}
              alt="Poker Timer Logo"
              className="w-24 h-24 mx-auto mb-8 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform"
            />

            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Poker Blinds Buzzer
            </h1>

            <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
              The ultimate poker tournament timer. Keep your games running
              smoothly with professional-grade timing, blinds management, and
              tournament controls.
            </p>

            {/* Download Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              {isMobile ? (
                <div className="w-full max-w-sm space-y-4">
                  <a
                    href={appleAppStoreLink}
                    className="flex items-center justify-center w-full px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg"
                  >
                    <svg
                      className="w-6 h-6 mr-3"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                    </svg>
                    Download for iOS
                  </a>
                  <a
                    href={googlePlayStoreLink}
                    className="flex items-center justify-center w-full px-8 py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg"
                  >
                    <svg
                      className="w-6 h-6 mr-3"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                    </svg>
                    Download for Android
                  </a>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4">
                  <a
                    href={appleAppStoreLink}
                    className="flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg"
                  >
                    <svg
                      className="w-6 h-6 mr-3"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                    </svg>
                    Download for iOS
                  </a>
                  <a
                    href={googlePlayStoreLink}
                    className="flex items-center px-8 py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg"
                  >
                    <svg
                      className="w-6 h-6 mr-3"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                    </svg>
                    Download for Android
                  </a>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a
                href="/demo"
                className="flex items-center px-6 py-3 border border-white/20 text-white font-medium rounded-xl hover:bg-white/10 transition-all"
              >
                <Monitor className="w-5 h-5 mr-2" />
                Try Web Demo
              </a>
              <a
                href="/privacy-policy"
                className="text-gray-400 hover:text-white transition-colors"
              >
                Privacy Policy
              </a>
            </div>
          </div>

          {/* Hero Image - Optimized for Portrait Phone Screenshot */}
          <div className="relative max-w-sm mx-auto">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-2xl p-4 border border-white/10">
              <div className="aspect-[9/19.5] overflow-hidden rounded-xl">
                <Image
                  src={screenshot_1}
                  alt="Poker Timer App Screenshot"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Everything You Need for Perfect Poker Tournaments
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Professional-grade features designed for poker enthusiasts,
              tournament organizers, and casual players alike.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {(
              [
                {
                  icon: Clock,
                  title: "Precision Timing",
                  description:
                    "Accurate blind level progression with customizable intervals. Never miss a beat in your tournament structure.",
                },
                {
                  icon: Bell,
                  title: "Background Operation",
                  description:
                    "Works seamlessly in the background, even when your phone is locked. Get alerts and notifications when blind levels change.",
                },
                {
                  icon: Trophy,
                  title: "Tournament Structures",
                  description:
                    "Pre-built tournament formats or create your own custom structures. From cash games to deep stack tournaments.",
                },
                {
                  icon: Shield,
                  title: "Reliable & Offline",
                  description:
                    "Works without internet connection. Your tournaments won't be interrupted by connectivity issues.",
                },
                {
                  icon: Smartphone,
                  title: "Mobile Optimized",
                  description:
                    "Perfect for mobile devices. Control your tournament from anywhere at the table.",
                },
                {
                  icon: Monitor,
                  title: "Display Ready",
                  description:
                    "Large, clear displays perfect for projecting blinds information to all players.",
                },
              ] as Feature[]
            ).map((feature: Feature, index: number) => (
              <div
                key={index}
                className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-white/20 transition-all transform hover:scale-105"
              >
                <div
                  className="w-12 h-12 rounded-lg mb-4 flex items-center justify-center"
                  style={{ backgroundColor: "#C64839" }}
                >
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Screenshots Section - Optimized for Portrait Screenshots */}
      <section
        id="screenshots"
        className="py-20 px-4 sm:px-6 lg:px-8 bg-black/20"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              See It In Action
            </h2>
            <p className="text-xl text-gray-300">
              Clean, intuitive interface designed for tournament play
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
            {Array.from({ length: 6 }, (_, index: number) => index + 1).map(
              (number: number) => (
                <div key={number} className="group">
                  <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-3 border border-white/10 hover:border-white/20 transition-all transform group-hover:scale-105">
                    <div className="aspect-[9/19.5] overflow-hidden rounded-lg">
                      <Image
                        src={getScreenshotImage(number + 1)}
                        alt={`Poker Timer Screenshot ${number + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      {/* Download CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Elevate Your Poker Game?
          </h2>
          <p className="text-xl text-gray-300 mb-12">
            Join thousands of players who trust Poker Blinds Buzzer for their
            tournaments
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <a
              href={appleAppStoreLink}
              className="group relative overflow-hidden rounded-xl transition-all transform hover:scale-105"
            >
              <div className="flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl shadow-xl">
                <svg
                  className="w-8 h-8 mr-3"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                Download for iOS
              </div>
            </a>

            <a
              href={googlePlayStoreLink}
              className="group relative overflow-hidden rounded-xl transition-all transform hover:scale-105"
            >
              <div className="flex items-center px-8 py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-xl shadow-xl">
                <svg
                  className="w-8 h-8 mr-3"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                </svg>
                Download for Android
              </div>
            </a>
          </div>

          <div className="mt-8 flex justify-center space-x-8 text-sm text-gray-400">
            <span>Free Download</span>
            <span>•</span>
            <span>No Ads</span>
            <span>•</span>
            <span>Works Offline</span>
          </div>
        </div>
      </section>

      {/* Mobile Download Banner */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-green-600 p-4 z-40 border-t border-white/20">
          <div className="flex items-center justify-between max-w-sm mx-auto">
            <div className="flex items-center space-x-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "#1D3B2A" }}
              >
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">
                  Poker Blinds Buzzer
                </p>
                <p className="text-white/80 text-xs">Free Download</p>
              </div>
            </div>
            <div className="flex space-x-2">
              <a
                href={appleAppStoreLink}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                iOS
              </a>
              <a
                href={googlePlayStoreLink}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Android
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <Image
                src={icon}
                alt="Poker Timer Logo"
                className="w-8 h-8 rounded-lg flex items-center justify-center"
              />
              <span className="text-white font-bold">Poker Blinds Buzzer</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-6 text-gray-400">
              <a href="/privacy" className="hover:text-white transition-colors">
                Privacy Policy
              </a>
              <a href="/demo" className="hover:text-white transition-colors">
                Web Demo
              </a>
              <span className="text-sm">
                © 2025 Poker Blinds Buzzer. All rights reserved.
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Action Button for Mobile */}
      {isMobile && (
        <button
          onClick={() => scrollToSection("features")}
          className="fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-30 transition-all transform hover:scale-110"
          style={{ backgroundColor: "#C64839" }}
        >
          <ChevronDown className="w-6 h-6 text-white" />
        </button>
      )}
    </div>
  );
};

export default LandingPage;
