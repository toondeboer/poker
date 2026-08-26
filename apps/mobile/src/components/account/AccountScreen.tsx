// src/components/account/AccountScreen.tsx
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MIN_PASSWORD_LENGTH } from "@poker/core";
import { useAuth, type AuthError } from "@/src/contexts/AuthContext";
import {
  colors,
  isTabletWidth,
  space,
  text,
  TABLET_MAX_WIDTH_SETTINGS,
} from "@/src/theme";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { TextField } from "@/src/components/ui/TextField";

/** What to put under the form when something is refused. */
const MESSAGE: Record<AuthError, string> = {
  "email-empty": "Enter the email address you want to use.",
  "email-malformed": "That doesn't look like an email address.",
  "password-too-short": `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
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
  const { account, isLoading, busy, signUp, signIn, signOut, deleteAccount } =
    useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<AuthError | null>(null);

  const run = async (action: typeof signUp) => {
    setError(await action(email, password));
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
            void deleteAccount();
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
        <Text style={styles.blurb}>
          Signed in on this device. Your groups and leaderboards stay on the
          phone until sync is switched on.
        </Text>
        <Button
          label="Sign out"
          variant="secondary"
          icon="log-out-outline"
          onPress={() => void signOut()}
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
  ) : (
    <Card>
      <CardHeader icon="person-circle" title="Sign in" />
      <CardContent>
        <Text style={styles.blurb}>
          An account is optional. Everything works without one — it&apos;s for
          keeping your groups and leaderboards across phones.
        </Text>
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
          onPress={() => void run(signIn)}
          disabled={busy}
        />
        <Button
          label="Create an account"
          variant="secondary"
          icon="person-add-outline"
          onPress={() => void run(signUp)}
          disabled={busy}
        />
      </CardContent>
    </Card>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          isTablet && styles.contentTablet,
          { paddingBottom: insets.bottom + space.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {content}
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
