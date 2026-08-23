// src/components/payouts/PayoutScreen.tsx
import { useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  computePayouts,
  defaultPaidPlaces,
  formatPlace,
  MAX_PAID_PLACES,
  PAYOUT_SPLITS,
  suggestedBounty,
  toPayoutOptions,
  validatePayoutOptions,
  PayoutValidationError,
} from "@poker/core";
import { usePremium } from "@/src/contexts/PremiumContext";
import { usePayouts } from "@/src/contexts/PayoutContext";
import { useKeyboardFocusScroll } from "@/src/hooks/useKeyboardFocusScroll";
import {
  colors,
  isTabletWidth,
  space,
  text,
  TABLET_MAX_WIDTH_SETTINGS,
} from "@/src/theme";
import { Paywall } from "@/src/components/paywall/Paywall";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { ListRow } from "@/src/components/ui/ListRow";
import { NumberField } from "@/src/components/ui/NumberField";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";

/** Cash denominations a home game realistically settles in. */
const DENOMINATIONS = [1, 5, 10, 25] as const;

/** "Auto" tracks the field size; a number pins the count. */
const AUTO = "auto";

const VALIDATION_MESSAGE: Record<PayoutValidationError, string> = {
  "buy-in-not-positive": "Set a buy-in of at least 1 to work out the payouts.",
  "no-entrants": "Add at least one player to work out the payouts.",
  "bounty-negative": "A bounty can't be negative.",
  "bounty-not-below-buy-in":
    "The bounty has to be smaller than the buy-in — it comes out of it, so an equal bounty leaves nothing to win.",
};

export function PayoutScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = isTabletWidth(width);
  const { isPremium } = usePremium();
  const { settings, update } = usePayouts();

  const [showPaywall, setShowPaywall] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const containerRef = useRef<View>(null);

  // Android no longer resizes the window for the keyboard under edge-to-edge,
  // so the bounty field low on this page would sit under the keypad with
  // nothing to scroll to. iOS is covered by automaticallyAdjustKeyboardInsets.
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

  const options = toPayoutOptions(settings);
  const error = validatePayoutOptions(options);
  const structure = computePayouts(options);
  const autoPlaces = defaultPaidPlaces(settings.entrants);

  // Only offer place counts this field can actually seat.
  const placeOptions = [
    { value: AUTO, label: "Auto", meta: autoPlaces > 0 ? `${autoPlaces}` : "—" },
    ...Array.from(
      { length: Math.min(Math.floor(settings.entrants) || 1, MAX_PAID_PLACES) },
      (_, index) => ({ value: String(index + 1), label: String(index + 1) }),
    ),
  ];

  const content = isPremium ? (
    <>
      <Card>
        <CardHeader icon="cash" title="The money" />
        <CardContent>
          <NumberField
            label="Buy-in"
            value={settings.buyIn}
            onChangeValue={(buyIn) => update({ buyIn })}
            min={0}
            helper="What each player pays to enter. Whole units of whatever currency you're collecting."
          />
          <NumberField
            label="Players"
            value={settings.entrants}
            onChangeValue={(entrants) => update({ entrants })}
            min={0}
            helper={
              autoPlaces > 0
                ? `A field this size normally pays ${autoPlaces} ${autoPlaces === 1 ? "place" : "places"}.`
                : undefined
            }
          />
          <NumberField
            label="Bounty per knockout"
            value={settings.bounty}
            onChangeValue={(bounty) => update({ bounty })}
            min={0}
            helper={`Comes out of the buy-in, not on top of it — set 0 for no bounties. A ${settings.buyIn} buy-in usually carries about ${suggestedBounty(settings.buyIn)}.`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader icon="options" title="How it's split" />
        <CardContent>
          <SegmentedControl
            label="Paid places"
            options={placeOptions}
            value={
              settings.paidPlaces === null ? AUTO : String(settings.paidPlaces)
            }
            onChange={(value) =>
              update({
                paidPlaces: value === AUTO ? null : Number(value),
              })
            }
          />
          <Text style={styles.hint}>
            Auto follows the field — more players, more places paid.
          </Text>
          <SegmentedControl
            label="Round payouts to"
            options={DENOMINATIONS.map((value) => ({
              value: value as number,
              label: String(value),
            }))}
            value={settings.denomination}
            onChange={(denomination) => update({ denomination })}
          />
          <Text style={styles.hint}>
            The smallest note or chip you want to hand out. Everything is
            rounded to a multiple of it, and the pool still pays out in full.
          </Text>
        </CardContent>
      </Card>

      {error || !structure ? (
        <Card>
          <CardContent>
            <Text style={styles.error}>
              {error ? VALIDATION_MESSAGE[error] : ""}
            </Text>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader
              icon="trophy"
              title="Payouts"
              right={
                <Badge
                  label={`${structure.payouts.length} paid`}
                />
              }
            />
            <CardContent>
              <View style={styles.list}>
                {structure.payouts.map((payout, index) => (
                  <ListRow
                    key={payout.place}
                    title={formatPlace(payout.place)}
                    meta={`${PAYOUT_SPLITS[structure.payouts.length - 1][index]}% of the prize pool`}
                    right={
                      <Text style={styles.amount}>{payout.amount}</Text>
                    }
                  />
                ))}
              </View>
            </CardContent>
          </Card>

          <Card>
            <CardHeader icon="calculator" title="Where it comes from" />
            <CardContent>
              <View style={styles.list}>
                <ListRow
                  title="Collected"
                  meta={`${settings.entrants} × ${settings.buyIn}`}
                  right={
                    <Text style={styles.amount}>
                      {structure.totalCollected}
                    </Text>
                  }
                />
                <ListRow
                  title="Prize pool"
                  meta="Split across the places above"
                  right={
                    <Text style={styles.amount}>{structure.prizePool}</Text>
                  }
                />
                {structure.bountyPool > 0 && (
                  <ListRow
                    title="Bounties"
                    meta={`${structure.bountyPerKnockout} per knockout, paid at the table`}
                    right={
                      <Text style={styles.amount}>{structure.bountyPool}</Text>
                    }
                  />
                )}
              </View>
              {structure.bountyPool > 0 && (
                <Text style={styles.hint}>
                  Bounties are settled between players as knockouts happen — the
                  app doesn&apos;t track who knocked out whom.
                </Text>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  ) : (
    <Card>
      <CardHeader icon="trophy" title="Payouts" />
      <CardContent>
        <Text style={styles.description}>
          Set a buy-in and Poker Blinds Buzzer works out what each place wins —
          with optional knockout bounties, rounded to notes you can actually
          hand over. Agree the split before the first hand instead of arguing
          about it heads-up.
        </Text>
        <Button
          label="Unlock Pro"
          icon="star"
          variant="pro"
          onPress={() => setShowPaywall(true)}
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
          {
            paddingLeft: space.lg + insets.left,
            paddingRight: space.lg + insets.right,
            paddingBottom: 40 + insets.bottom + keyboardInset,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => {
          scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        automaticallyAdjustKeyboardInsets={true}
      >
        {content}
      </ScrollView>

      <Paywall visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollView: { flex: 1 },
  content: { paddingTop: space.lg, gap: space.xl },
  contentTablet: {
    maxWidth: TABLET_MAX_WIDTH_SETTINGS,
    alignSelf: "center",
    width: "100%",
  },
  description: text.body,
  hint: { ...text.meta, lineHeight: 18 },
  error: { ...text.body, color: colors.textLabel },
  list: { gap: space.md },
  amount: { ...text.mono, minWidth: 64, textAlign: "right" },
});
