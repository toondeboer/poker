// src/components/account/AccountScreen.tsx
import { useRef, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MIN_PASSWORD_LENGTH } from "@poker/core";
import {
  accountsAreReal,
  useAuth,
  type AuthError,
} from "@/src/contexts/AuthContext";
import { useLeaderboard } from "@/src/contexts/LeaderboardContext";
import { useKeyboardFocusScroll } from "@/src/hooks/useKeyboardFocusScroll";
import {
  colors,
  isTabletWidth,
  space,
  text,
  TABLET_MAX_WIDTH_SETTINGS,
} from "@/src/theme";
import { Button } from "@/src/components/ui/Button";
import type { HostedProvider } from "@poker/core";
import { signInWithProvider as signInWithProviderFlow } from "@/src/services/socialSignIn";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { TextField } from "@/src/components/ui/TextField";

/**
 * What to put under the form when something is refused.
 *
 * Every one of these is something a person can *do* something about, which is
 * the whole reason they are distinct: "that email is taken" is an instruction
 * and "that didn't work" is a shrug. The generic message is the last resort,
 * not the default.
 */
const MESSAGE: Record<AuthError, string> = {
  "email-empty": "Enter the email address you want to use.",
  "email-malformed": "That doesn't look like an email address.",
  "password-too-short": `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
  "email-taken":
    "There's already an account with that address. Sign in instead.",
  "email-unknown": "No account with that address. Create one below.",
  "credentials-wrong": "That email and password don't match an account.",
  "code-wrong": "That code isn't right. Check the email and try again.",
  "code-expired": "That code has expired. Send a new one.",
  "not-confirmed": "Confirm your email first — enter the code we sent you.",
  "password-weak": `Use at least ${MIN_PASSWORD_LENGTH} characters, with a letter and a number.`,
  "too-many-attempts": "Too many tries. Wait a minute and try again.",
  "session-expired": "You've been signed out. Sign in again.",
  network: "Couldn't reach the server. Check your connection.",
  failed: "That didn't work. Try again in a moment.",
};

/**
 * Sign in, sign out, and delete your account.
 *
 * **Not linked from anywhere**, deliberately. It runs against a development
 * stub that signs nobody up — see `stubAuthProvider` — so shipping a route to
 * it would be shipping a login that logs nobody in. The entry point goes in
 * when the backend does.
 *
 * Account deletion is here from the start rather than added later: App Store
 * guideline 5.1.1(v) requires an app that lets people create an account to let
 * them delete it from inside the app, and building the screen without it just
 * means building it twice.
 */
export function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = isTabletWidth(width);
  const {
    account,
    isLoading,
    busy,
    signUp,
    signIn,
    signInWithProvider,
    confirmSignUp,
    resendCode,
    signOut,
    deleteAccount,
  } = useAuth();
  const { releaseAllFor } = useLeaderboard();

  /**
   * Let go of any players this account claimed before the session ends.
   *
   * Boards live on the device and account ids do not, so a claim left behind
   * points at nothing: the player can't be claimed (something holds it) and
   * can't be released (it isn't yours). Done before signing out rather than
   * after, so the account id is still known.
   */
  const endSession = async (run: () => Promise<AuthError | null>) => {
    if (account) releaseAllFor(account.id);
    setError(await run());
  };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<AuthError | null>(null);
  /** True between creating an account and the code from the email coming back. */
  const [awaitingCode, setAwaitingCode] = useState(false);
  /** Email and password, revealed on request. Providers are the default. */
  const [showEmail, setShowEmail] = useState(false);
  const [code, setCode] = useState("");

  // Never leave the previous user's address and a filled password field on
  // screen after they sign out — that is one tap from restoring their session
  // on a phone that has just been handed to somebody else.
  const [lastAccountId, setLastAccountId] = useState(account?.id ?? null);
  if (lastAccountId !== (account?.id ?? null)) {
    setLastAccountId(account?.id ?? null);
    setEmail("");
    setPassword("");
    setError(null);
    setAwaitingCode(false);
    setCode("");
  }

  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const containerRef = useRef<View>(null);

  // Two text fields and two buttons is the whole screen, so a keypad covering
  // the lower half covers most of it. Android needs the hook specifically:
  // under edge-to-edge, `adjustResize` is a no-op and nothing scrolls on its
  // own — every other input screen in the app sets both of these.
  const { keyboardInset } = useKeyboardFocusScroll({
    scrollBy: (delta) =>
      scrollViewRef.current?.scrollTo({
        y: scrollOffsetRef.current + delta,
        animated: true,
      }),
    containerRef,
    bottomInset: insets.bottom,
    topInset: insets.top,
  });

  /**
   * Sign in, which either works or says why.
   */
  /**
   * Sign in through Apple or Google.
   *
   * **Cancelling is not an error.** Closing the sheet, or declining at the
   * provider, both arrive here as `cancelled` — showing a red message for
   * something somebody chose to do is how a sign-in screen feels broken.
   */
  const attemptProvider = async (provider: HostedProvider) => {
    setError(null);
    const result = await signInWithProviderFlow(provider);
    if (result.status === "cancelled") return;
    if (result.status === "failed") {
      setError("failed");
      return;
    }
    // `busy` belongs to the context, which sets it around the exchange. The
    // browser half is not covered by it — the sheet is modal, so there is
    // nothing behind it to disable.
    setError(await signInWithProvider(result));
  };

  /**
   * Sign in, which has to handle an account that exists but was never
   * confirmed.
   *
   * **That state is reached by ordinary use, not by misuse.** The code arrives
   * by email, so finishing sign-up means leaving the app for a mail client —
   * and `awaitingCode` is component state, so anything that tears the screen
   * down while somebody is away (the OS reclaiming memory on a busy phone, a
   * force-quit, a crash) loses the only route back to the code field.
   *
   * Without this branch the address is then **permanently unusable**: signing
   * in answers "confirm your email first" and creating an account answers
   * "there's already an account with that address", and neither offers a way
   * to confirm. Two instructions that contradict each other and a dead end
   * between them.
   *
   * The code is resent rather than assumed — whatever was sent before may have
   * expired, and the card this lands on says "We sent a code to …", which
   * should be true when they read it.
   */
  /**
   * **Which provider leads, by platform.**
   *
   * On iOS Apple has to. Guideline 4.8 and the HIG ask for Sign in with Apple
   * to be offered wherever another third-party sign-in is, and displayed **no
   * less prominently** — so making Google the highlighted one there is a review
   * risk rather than a design choice.
   *
   * On Android no such rule applies and the device's own account is Google's,
   * so leading with Apple offers the wrong default to everybody — which is what
   * it did on both platforms until the 1.2.0 pass looked at the Android phone.
   *
   * **Deliberately not brand-coloured buttons.** Apple and Google both publish
   * strict specs for those — official assets, exact padding, approved fonts and
   * colour variants — and approximating them with a themed `Button` and an
   * Ionicon glyph is more likely to breach the guidelines than a neutral
   * treatment that does not imply it is their artwork. It would also mean
   * hardcoded brand hex in a codebase whose styling goes through the theme.
   */
  const appleLeads = Platform.OS === "ios";
  const apple = {
    key: "apple",
    label: "Continue with Apple",
    icon: "logo-apple",
    provider: "SignInWithApple",
  } as const;
  const google = {
    key: "google",
    label: "Continue with Google",
    icon: "logo-google",
    provider: "Google",
  } as const;
  const providerButtons = appleLeads ? [apple, google] : [google, apple];

  const attemptSignIn = async () => {
    const failure = await signIn(email, password);
    if (failure === "not-confirmed") {
      setError(null);
      setAwaitingCode(true);
      void resendCode(email);
      return;
    }
    setError(failure);
  };

  /**
   * Sign up, which has a third outcome the other calls do not.
   *
   * A provider that emails a code has not signed anybody in yet, and saying
   * "welcome" at this point is the bug the union in `SignUpResult` exists to
   * prevent — an account is created, the screen looks successful, and nothing
   * is logged in.
   */
  const attemptSignUp = async () => {
    const result = await signUp(email, password);
    if (result === "needs-confirmation") {
      setError(null);
      setAwaitingCode(true);
      return;
    }
    setError(result);
  };

  const attemptConfirm = async () => {
    const failure = await confirmSignUp(email, code);
    if (failure) {
      setError(failure);
      return;
    }
    // Confirmed, not signed in: Cognito wants the password again. Doing it
    // here rather than making somebody type it a second time on a screen that
    // already has it.
    setAwaitingCode(false);
    setCode("");
    setError(await signIn(email, password));
  };

  const confirmDelete = () => {
    Alert.alert(
      "Delete account",
      "This deletes your account and everything stored against it. Leaderboards on this phone stay — they belong to the device, not the account. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void endSession(deleteAccount);
          },
        },
      ],
    );
  };

  const content = isLoading ? null : account ? (
    <Card>
      <CardHeader icon="person-circle" title="Your account" />
      <CardContent>
        <Text style={styles.email}>{account.email}</Text>
        {/* **Conditional, because both halves are true in some build.** A
            shipped 1.2.0 has `backendConfig` as `null`, so the boards really do
            stay on the phone; the moment that switch is flipped this sentence
            becomes a lie. Deriving it means it cannot be forgotten at the point
            somebody has other things to think about. */}
        <Text style={styles.blurb}>
          {accountsAreReal
            ? "Signed in on this device. Boards you share or join sync with your account, so they follow you to another phone."
            : "Signed in on this device. Your groups and leaderboards stay on the phone until sync is switched on."}
        </Text>
        {error ? <Text style={styles.error}>{MESSAGE[error]}</Text> : null}
        <Button
          label="Sign out"
          variant="secondary"
          icon="log-out-outline"
          onPress={() => void endSession(signOut)}
          disabled={busy}
        />
        <Button
          label="Delete account"
          variant="danger"
          icon="trash-outline"
          onPress={confirmDelete}
          disabled={busy}
        />
      </CardContent>
    </Card>
  ) : awaitingCode ? (
    <Card>
      <CardHeader icon="mail-open-outline" title="Check your email" />
      <CardContent>
        <Text style={styles.blurb}>
          {`We sent a code to ${email}. Enter it to finish setting up your account.`}
        </Text>
        <TextField
          label="Code"
          value={code}
          onChangeText={(next) => {
            setCode(next);
            setError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          placeholder="123456"
        />
        {error ? <Text style={styles.error}>{MESSAGE[error]}</Text> : null}
        <Button
          label="Confirm"
          icon="checkmark"
          onPress={() => void attemptConfirm()}
          disabled={busy || code.trim().length === 0}
        />
        <Button
          label="Send it again"
          variant="secondary"
          icon="refresh"
          onPress={() => void resendCode(email).then(setError)}
          disabled={busy}
        />
        {/* A way back that is not the OS back gesture. Somebody who typed the
            wrong address is otherwise stuck on a screen waiting for an email
            that will never arrive. */}
        <Button
          label="Use a different address"
          variant="ghost"
          onPress={() => {
            setAwaitingCode(false);
            setCode("");
            setError(null);
          }}
          disabled={busy}
        />
      </CardContent>
    </Card>
  ) : (
    <Card>
      <CardHeader icon="person-circle" title="Sign in" />
      <CardContent>
        <Text style={styles.blurb}>
          An account is optional. Everything works without one — it&apos;s for
          keeping your groups and leaderboards across phones.
        </Text>
        {/*
          **Providers first, and email behind a disclosure.** The emailed
          confirmation code is the step most people abandon, and Apple and
          Google have already checked the address. Signing in either way lands
          on the same account — see the linking trigger in `apps/infra`.
        */}
        {providerButtons.map(({ key, label, icon, provider }, index) => (
          <Button
            key={key}
            label={label}
            icon={icon}
            variant={index === 0 ? undefined : "secondary"}
            onPress={() => void attemptProvider(provider)}
            disabled={busy}
          />
        ))}
        {!showEmail ? (
          <Button
            label="Use email instead"
            variant="secondary"
            icon="mail-outline"
            onPress={() => {
              setShowEmail(true);
              setError(null);
            }}
            disabled={busy}
          />
        ) : null}
        {/* One error, one place. This card and the email form are on screen
            together once "Use email instead" is tapped, and both rendered the
            same `error` — so a failed email sign-in printed a red line under
            the Apple and Google buttons as well, about a provider nobody had
            touched. The email card keeps it while it is open, because that is
            where the action was. */}
        {error && !showEmail ? (
          <Text style={styles.error}>{MESSAGE[error]}</Text>
        ) : null}
      </CardContent>
    </Card>
  );

  /**
   * **Not while the code card is up.** `content` switches to "check your email"
   * once a sign-up is awaiting confirmation, and this used to keep rendering
   * underneath it — so the screen asked for a code and still showed the email
   * and password that had just been submitted, with a Create-an-account button
   * that would start the whole thing again.
   *
   * **Nor once somebody is signed in**, for the same reason. Signing in with
   * email left `showEmail` set, so the signed-in card sat above a second Sign in
   * and a Create-an-account button — and App Review signs in exactly that way,
   * with the demo accounts from the review notes.
   */
  const emailForm =
    !showEmail || awaitingCode || account ? null : (
      <Card>
        <CardHeader icon="mail" title="Email and password" />
        <CardContent>
          <TextField
            label="Email"
            value={email}
            onChangeText={(next) => {
              setEmail(next);
              setError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@example.com"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={(next) => {
              setPassword(next);
              setError(null);
            }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            helper={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          />
          {error ? <Text style={styles.error}>{MESSAGE[error]}</Text> : null}
          <Button
            label="Sign in"
            icon="log-in-outline"
            onPress={() => void attemptSignIn()}
            disabled={busy}
          />
          <Button
            label="Create an account"
            variant="secondary"
            icon="person-add-outline"
            onPress={() => void attemptSignUp()}
            disabled={busy}
          />
        </CardContent>
      </Card>
    );

  return (
    <View style={styles.container} ref={containerRef}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          isTablet && styles.contentTablet,
          { paddingBottom: insets.bottom + space.xl + keyboardInset },
        ]}
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => {
          scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        automaticallyAdjustKeyboardInsets={true}
      >
        {content}
        {emailForm}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollView: { flex: 1 },
  content: { paddingTop: space.lg, gap: space.xl, paddingHorizontal: space.lg },
  contentTablet: {
    maxWidth: TABLET_MAX_WIDTH_SETTINGS,
    alignSelf: "center",
    width: "100%",
  },
  blurb: { ...text.body, color: colors.textMuted },
  email: { ...text.cardTitle },
  error: { ...text.body, color: colors.danger },
});
