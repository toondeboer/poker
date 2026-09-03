// src/components/settings/AccountCard.tsx
import { useRouter } from "expo-router";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { NavRow } from "@/src/components/ui/NavRow";
import { accountsAreReal, useAuth } from "@/src/contexts/AuthContext";

/**
 * The way in to the account screens.
 *
 * **Nothing linked to `/account` before this**, deliberately — the screens were
 * written against a backend that had not been deployed, and a route reachable
 * only by typing a URL is a route nobody finds by accident. That reason is
 * gone: there is a real user pool, and an account is what a shared board is
 * keyed to.
 *
 * Still absent in a build with no backend at all. `accountsAreReal` is `false`
 * then, and a row that leads to a sign-in form which cannot sign anybody in is
 * worse than no row: it looks like a broken feature rather than an absent one.
 *
 * Signed in, the summary is the address rather than an invitation, because the
 * question somebody opens this to answer is usually "which account is this?".
 */
export function AccountCard() {
  const router = useRouter();
  const { account } = useAuth();

  if (!accountsAreReal) return null;

  return (
    <Card>
      <CardHeader icon="person-circle" title="Account" />
      <CardContent>
        <NavRow
          title={account ? "Your account" : "Sign in"}
          summary={
            account
              ? account.email
              : "Optional. An account keeps your boards across phones and lets you share one."
          }
          onPress={() => router.push("/account")}
        />
      </CardContent>
    </Card>
  );
}
