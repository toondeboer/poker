// src/services/adsConsent.ts
import {
  AdsConsent,
  AdsConsentDebugGeography,
  AdsConsentPrivacyOptionsRequirementStatus,
} from "react-native-google-mobile-ads";
import { initializeAds } from "@/src/services/ads";

/**
 * Local testing toggle: pretend this device is in the EEA, so the consent form
 * shows from anywhere. Only read under `__DEV__`, so a release build ignores it
 * whatever it says. Emulators are test devices automatically; a real device
 * also needs its hashed id (printed in the native log) passed as
 * `testDeviceIdentifiers`.
 */
const FORCE_EEA_IN_DEV = false;

export type AdsConsentState = {
  /**
   * True once the consent platform says ads may be requested and the ads SDK is
   * initialized. Feeds `shouldShowAds`; no banner mounts before it.
   */
  consentResolved: boolean;
  /**
   * Whether this user must be given a way to change their answer. True where
   * the consent form applies; Settings shows the link only then.
   */
  privacyOptionsRequired: boolean;
};

let state: AdsConsentState = {
  consentResolved: false,
  privacyOptionsRequired: false,
};
const listeners = new Set<() => void>();

/** For `useSyncExternalStore`: the banner slots and Settings share one answer. */
export function subscribeAdsConsent(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAdsConsentState() {
  return state;
}

function setState(next: AdsConsentState) {
  if (
    next.consentResolved === state.consentResolved &&
    next.privacyOptionsRequired === state.privacyOptionsRequired
  ) {
    return;
  }
  state = next;
  listeners.forEach((listener) => listener());
}

/**
 * Reads the consent platform's current answer into the shared state, and
 * initializes the ads SDK the first time that answer allows a request.
 *
 * The SDK is initialized here rather than at app start: with app measurement
 * delayed (`GADDelayAppMeasurementInit` / `DELAY_APP_MEASUREMENT_INIT`), nothing
 * is sent to Google until this runs.
 *
 * **The answer gates whether ads are requested, never which kind.** Every
 * request stays non-personalized whatever the user ticks (see `BannerAdSlot`):
 * the privacy policy and both store privacy declarations say so, and there is
 * no App Tracking Transparency prompt. What the form changes is eligibility. In
 * the EEA and UK Google serves little without an answer from a certified
 * consent platform, which is this one.
 */
async function refresh() {
  const info = await AdsConsent.getConsentInfo();
  const privacyOptionsRequired =
    info.privacyOptionsRequirementStatus ===
    AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;

  if (!info.canRequestAds) {
    setState({ consentResolved: false, privacyOptionsRequired });
    return;
  }

  await initializeAds();
  setState({ consentResolved: true, privacyOptionsRequired });
}

let inFlight: Promise<void> | null = null;

/**
 * Asks the consent platform whether this user needs to be shown the consent
 * form, shows it if so, and resolves the ad gate from the result. Safe to call
 * repeatedly: one run per launch once it has succeeded.
 *
 * **Only call this for a user who will actually see ads.** Somebody on Pro or
 * Club has no ads to consent to, and a consent form for them is a prompt about
 * nothing.
 *
 * When the update fails (offline, usually) the answer from the previous session
 * still stands, which is what Google's own guidance says to use. A first launch
 * with no network has no previous answer, so it shows no ads, and the next call
 * tries again.
 */
export function startAdsConsent() {
  inFlight ??= (async () => {
    try {
      await AdsConsent.gatherConsent(
        __DEV__ && FORCE_EEA_IN_DEV
          ? { debugGeography: AdsConsentDebugGeography.EEA }
          : {},
      );
    } catch {
      // Fall through to whatever the previous session left behind.
    }
    try {
      await refresh();
    } catch {
      // Leaves the gate closed; cleared below so a later call retries.
    }
    if (!state.consentResolved) inFlight = null;
  })();
  return inFlight;
}

/**
 * Reopens the consent form so the user can change their answer. The consent
 * platform requires the app to offer this wherever the form applies.
 */
export async function showAdPrivacyOptions() {
  await AdsConsent.showPrivacyOptionsForm();
  await refresh();
}
