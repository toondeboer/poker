// src/components/leaderboard/SyncNotice.tsx
import { StyleSheet, Text, View } from "react-native";
import { describeWrite, type RefusedWrite } from "@poker/core";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { colors, radius, space, text } from "@/src/theme";

/**
 * What the server would not accept.
 *
 * **Without this the whole outbox is a lie.** A write is checked when it syncs,
 * not when it was made, so a game recorded on Tuesday can be refused on
 * Thursday because an admin removed you on Wednesday. The board on this phone
 * already shows it — that is the point of writing locally first — and the other
 * players' boards never will. Nobody would find out.
 *
 * So this says the one thing that actually matters: *this is on your phone and
 * not on anybody else's*. Dismissing is deliberate, because there is nothing
 * else to do about it: the queue has already stopped trying, and a person who
 * has read it is the only signal that it has been seen.
 *
 * Shown only when there is something to show — a card saying "everything is
 * fine" on every visit teaches people to stop reading it.
 */
export function SyncNotice({
  refused,
  onDismiss,
}: {
  refused: readonly RefusedWrite[];
  onDismiss: (id: string) => void;
}) {
  if (refused.length === 0) return null;

  // Newest first: the most recent refusal is the one somebody is most likely to
  // still remember making.
  const newestFirst = [...refused].reverse();

  return (
    <Card style={styles.card}>
      <CardHeader icon="cloud-offline" title="Not saved for others" />
      <CardContent>
        <Text style={styles.description}>
          {refused.length === 1
            ? "This change is on your phone, but the other players will not see it."
            : `These ${refused.length} changes are on your phone, but the other players will not see them.`}
        </Text>
        <View style={styles.list}>
          {newestFirst.map((item) => (
            <View key={item.write.id} style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.title}>{describeWrite(item.write)}</Text>
                <Text style={styles.reason}>{item.reason}</Text>
              </View>
              <Button
                label="Dismiss"
                variant="secondary"
                size="sm"
                onPress={() => onDismiss(item.write.id)}
              />
            </View>
          ))}
        </View>
      </CardContent>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderColor: colors.danger },
  description: { ...text.body, marginBottom: space.md },
  list: { gap: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: space.md,
  },
  info: { flex: 1 },
  title: text.rowTitle,
  reason: { ...text.meta, marginTop: 2 },
});
