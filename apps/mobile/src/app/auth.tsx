// src/app/auth.tsx
import { Redirect } from "expo-router";

/**
 * Where the provider sign-in redirect lands, and nothing else.
 *
 * `AUTH_REDIRECT_URI` is `pokerkit://auth` (`src/services/socialSignIn.ts`),
 * and until this file existed there was no `auth` route to match it — so
 * Cognito's redirect opened the app through the scheme's intent filter and
 * expo-router answered with **"Unmatched Route — Page could not be found"**.
 *
 * **The sign-in itself always worked**, which is what made it easy to miss:
 * `openAuthSessionAsync` resolves from the same redirect and the code exchange
 * runs regardless, so the person was signed in behind the error and had to back
 * out and reopen the app to discover it.
 *
 * **Android-only in practice, and that is why iOS passing proved nothing.** On
 * iOS `ASWebAuthenticationSession` intercepts the callback URL inside the
 * session, so the OS never dispatches a deep link and the router never sees
 * this path at all. On Android the redirect arrives as a real intent, which
 * both resolves the promise and gets routed. §14b's iOS column was ticked on
 * the Simulator and could not have caught it.
 *
 * **It redirects to `/account` rather than rendering anything**, because that
 * is where every provider sign-in starts from — `AccountCard`, `JoinBoardScreen`
 * and `GroupsSheet` all push `/account` before offering a provider — so this
 * returns somebody to the screen they left, by then signed in. Nothing is
 * rendered in between; the redirect is immediate and the auth work is a promise
 * chain that does not care about navigation.
 */
export default function AuthRedirect() {
  return <Redirect href="/account" />;
}
