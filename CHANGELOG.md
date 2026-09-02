# Changelog

All notable user-facing changes to the **Poker Blinds Buzzer** mobile app are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the app
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Add changes under `[Unreleased]` as you merge them; roll that section into a dated,
platform-tagged heading (e.g. `## [1.1.3] - 2026-07-20 — Android`) when you cut a release.

## [Unreleased]

### Added
- **A leaderboard now survives having no signal.** Adding a player or recording a game writes the
  board on the phone first and tells the server second, keeping what could not be sent in an outbox
  that is retried when the app comes back to the foreground, when somebody signs in, and on the
  next cold launch. The night at a table with one bar of reception is the case the whole thing is
  built for: nothing waits on a network, and nothing is silently lost when the network never comes.
  A write the server *refuses* — a board somebody removed you from between Tuesday and Thursday —
  is kept aside to be shown rather than dropped or silently applied, and anything that depended on
  it is held back with it, so a game can never be recorded naming a player who was never added.
  The leaderboard says so plainly when that happens — what was not saved, why, and the part that
  matters: it is on your phone and the other players will not see it.
- **Boards can be shared.** A board's row in the groups sheet has a share button that makes an
  invite code and hands it to the usual share sheet; whoever gets it pastes it into *Join a board*
  in the same list, and the board arrives with its whole roster and season. Paste the code on its
  own or the entire message it came in — either works. The code never expires, so sharing again
  replaces the last one, which is the only way to take one back from somebody you did not mean to
  send it to. Boards follow the account rather than the phone: sign in on a second device, or
  reinstall, and every board you are on comes back. The share button only appears on boards you can
  actually invite people to. **The host pays and guests do not**: sharing a board of your own is a
  subscription, and joining one somebody sent you costs nothing at all — no account purchase, not
  even Pro, because a board you were invited to is visible without it. Everything Pro unlocks stays
  exactly as it is and nobody who has bought it loses anything — and the subscription includes Pro,
  so hosting is one purchase rather than two — and once a subscription has unlocked Pro it stays
  unlocked, so stopping it costs you the sharing and nothing else.
- **A board now reads back what other people did to it.** When the app comes to the foreground, and
  again once anything queued has been sent, each board is fetched and merged with what is already
  on the phone. Merged rather than replaced, which is the whole of the design: a board that
  existed before any of this has a history the server has never been told about, so trusting the
  server's copy would delete a season of game nights. Somebody else's additions arrive, removals
  they made are applied, and a game recorded thirty seconds ago does not flicker off the screen
  while the request is in flight. A game or player you delete stays deleted, and a board you rename
  keeps the name you gave it.
- **Claim yourself on a leaderboard.** Signed in, a player on the board can be linked to your
  account — and because every game ever recorded refers to the person rather than to an account,
  the whole season becomes yours with nothing rewritten. It can be undone, so a mis-tap costs
  nothing. Two things are refused rather than guessed at: a person somebody else has already
  claimed, and holding a second seat on the same board, since one person is one seat and holding
  two would double-count their nights. **Only visible while signed in**, which nobody can be yet.
  Signing out or deleting an account lets go of the players it had claimed, so nobody is left linked
  to an account that no longer exists — and if one ever is, it can still be unlinked rather than
  being stuck for good.
- The Pro sheet lists what Pro actually buys now. It was still selling the previous version's
  feature set — the screen where somebody decides to pay was describing an app with fewer things in
  it than the one they had just been using, and dealing a hand, the headline of this release, was
  missing from it entirely.
- The website describes the app that exists: dealing a hand when nobody brought cards, progressive
  bounties, and a dealt game putting itself on the leaderboard with knockouts included.
- Accounts can now talk to a real server. The sign-in screens are wired to Amazon Cognito, including
  the step nobody thinks about until they meet it: creating an account sends a code to your email
  and does **not** sign you in until it comes back, so the screen asks for it rather than saying
  "welcome" to somebody who is not logged in. Every refusal says what to do about it — that address
  is already taken, that code has expired, wait a minute and try again — rather than "that didn't
  work". **Nothing links to any of it yet**: the screens are reachable only by URL, and a shipped
  build still runs them against the same development stub, because a development server is a thing
  that gets deleted and rebuilt and nobody's account should live there.
- **Progressive bounties (Pro).** Knock somebody out and half their bounty is yours in cash — the
  other half goes onto your own head, so whoever is winning becomes the one worth beating. It is the
  format nobody can run on paper: the bounty on every head changes a dozen times an evening, and
  nobody is keeping that straight between hands. The app deals the game, so it keeps the ledger —
  who is worth what, who collected it, and the last player standing takes the bounty on their own
  head, which is theirs and came out of their own buy-in. The odd unit of an odd split goes into the
  pocket rather than onto the head, so somebody is handed real money tonight. If a pot goes unclaimed
  the bounty on that head has nowhere to go, and the app says so at the end rather than leaving
  somebody to count the cash and find it short. Flat bounties are unchanged and stay the default:
  one number, understood by everyone, settled at the table.
- **A game the app dealt now knows who knocked whom out (Pro).** A bounty is money that changes
  hands the moment somebody busts, a dozen times over an evening, usually while the host isn't
  watching — which is why a game written down afterwards has never tracked it, and why the
  leaderboard's money column was prize money only. A game the app deals watched every hand, so it
  knows exactly whose chips took whom out, and the board now counts knockouts and pays the bounty
  into the total. The credit goes to whoever won the pot the busted player's last chips were in,
  which with side pots is frequently *not* whoever won the most money that hand. A split pot splits
  the bounty — one bounty between the two of them, since only one was ever collected, divided the
  same way the pot itself was. A pot nobody could claim pays no bounty to anybody, rather than
  picking a winner.
  Games recorded by hand show nothing here rather than zeros — nobody can say, and a guess rendered
  as a total is worse than no total.
- **A way back when the app breaks.** Instead of a blank screen or the app closing on itself, there
  is now a page saying what went wrong, with the message on it — the only place that message exists,
  and what makes a bug report useful. Trying again is the first offer. The second is for the case
  that trying again cannot fix: something the app saved that it can no longer read, which is loaded
  again on every launch and so fails the same way forever. Starting fresh clears the round in
  progress, the blind structure, the payout setup, presets and the sound choice — and **keeps the
  leaderboard**, because deleting the app is what somebody stuck does otherwise, and that takes
  seasons of game nights with it. It says exactly what it will take before it takes it.
- Groundwork for one clock on several phones: a screen that starts a shared clock or joins one with
  a code, and the whole loop behind it — a local pause, resume, reset or level change goes out to
  the table, and anybody else's comes back and moves this phone. There is no host: whoever is
  nearest the phone presses it, and two people pressing at once settle on the same answer rather
  than the table quietly splitting in two. It says plainly when it has lost touch, and keeps
  counting down while it has, because the phone still knows how much of the round is left — it just
  no longer knows whether somebody paused it. **Nothing links to it yet**: there is no server behind
  it, and a join code nobody else can join is worse than no join code.
- Groundwork for one clock on several phones: the protocol a shared session runs on, and the join
  code that gets read out across the table. The code leaves out every character that can be misread
  — no `O`/`0`, no `I`/`1`, no `S`/`5` — and refuses a typo rather than guessing, because guessing
  can drop somebody into a stranger's game night with a plausible countdown on it. What travels
  between phones is **how much of the round is left**, never when it ends: two phones whose clocks
  disagree by half a minute would otherwise show different countdowns on the same table, so each
  one anchors what it receives to its own clock as it arrives. **Nothing in the app uses this yet**
  — there is no server behind it, and the wiring into the timer comes next.
- Groundwork for accounts: the sign-in, sign-out and delete-account screens exist and work, and the
  seam an identity provider plugs into is defined in `@poker/core`. **Nothing links to them and no
  account is real yet** — they run against a development stub with no server behind it, so the way
  in stays closed until there is. Account deletion is built in from the start rather than added
  later, since an app that lets people create an account has to let them delete it from inside the
  app.
- **A game the app dealt puts itself on the leaderboard (Pro).** When the last chip changes hands,
  one button saves the night: everybody's finishing position is already known, because the app dealt
  every hand and watched them go out. Winnings come from the payout structure you set, priced for
  the field that actually sat down. It records the top three even when fewer places pay, so a
  friendly game still has a winner and the board's tie-breaks still work — the same rule the
  record-a-game sheet follows by hand.
- A game in progress now survives the app being closed. Shut the app between hands — or have the
  phone die mid-evening — and reopening it puts you back at the same table, same stacks, same cards
  in the middle. A stored game is checked whole before it is trusted, and dropped entirely if
  anything about it no longer adds up: unlike the leaderboard, where one bad row is dropped and a
  season of history kept, a half-restored game is a table paying the wrong person from stacks that
  do not balance. Losing an evening you can deal again is the better of the two.
- Raising in a dealt hand now takes any amount, not just the minimum or everything. Type it, or tap
  Min, Pot or All in to fill it in — and then confirm, because a raise is the one thing on that
  screen that can end somebody's night by mis-tap. "Pot" is the size players actually name at a
  table: call first, then raise by what is in the middle after that. It only appears when it lands
  somewhere between the two ends, since a Pot button that quietly means "all in" is worse than no
  Pot button.
- **Play a hand from the phone (Pro).** For a table that has chips but no cards — on holiday, or
  when the deck is somewhere nobody can remember. The phone deals a real hand of hold'em: everyone
  can see the board, the pot and every stack, and only the player to act can see their own two
  cards, after tapping to reveal them. That last part is why the reveal is a tap rather than
  automatic: one phone goes round the table, and cards that appear by themselves are cards the
  previous player has already seen. Blinds, betting, side pots when somebody is all-in for less,
  and who wins at the showdown are all decided by the same rules the rest of the app is built on.
- Repo docs and store copy brought up to what 1.2.0 actually contains — the `README`, the
  architecture notes, and both stores' long descriptions and Pro feature lists, which all still
  described a timer whose only paid extras were presets and alarm sounds.
- Groundwork for accounts and online play: the backend is now defined as code in a new `apps/infra`
  workspace — accounts, one small database, and a realtime channel for a shared poker table.
  **Nothing in the app talks to it.** Two decisions are worth recording
  because they are hard to change later: hole cards are kept private by *where they are published*
  rather than by the app choosing not to draw them, so a card you should not see never reaches your
  phone at all; and only the server may publish, so every change to a table goes through the poker
  rules once — the same rules the phone runs, which is what stops the two disagreeing. The channel
  names both sides use are defined once and shared, because the app and the server disagreeing
  about them is the kind of mistake that is silent rather than obvious.
- Groundwork for leaderboards that several people share. A group can now live on the server rather
  than only on the host's phone: more than one person can be an admin, anybody at the table can add
  a player or record a game, and only an admin can remove one — because writing down a name should
  be easy and making a season disappear should not. People join by a link that does not expire, so
  it can be pinned in the group chat, and an admin can rotate it if it ever goes somewhere it should
  not. **Nothing in the app uses any of this yet**, and it is deliberately built so the app keeps
  working with no signal at a table: the things that only need your own phone — the timer, dealing,
  writing down who won — carry on offline and catch up later, and only the things that genuinely
  need everybody else wait for a connection. Deleting your account now removes what the server holds
  as well: the players you claimed are let go, but the games stay on the board, because a night of
  poker belongs to the table rather than to whoever wrote it down — and if you were the last person
  who could manage a group, somebody else is put in charge of it rather than it being left with
  nobody.
- That backend now actually runs. A development environment is deployed and has been exercised end
  to end: an account created from a real emailed code, signed in, a hand dealt and acted on, and the
  cards arriving on the right screens — including the part that matters, which is that a player's
  hole cards never travel to anybody else's phone and somebody not at the table cannot watch it at
  all. **Nothing in the app points at it**, deliberately: this release still ships with accounts
  switched off, because a development server is a thing that gets deleted and rebuilt, and nobody's
  account should live there. Two faults were found by deploying that no amount of testing beforehand
  could have: one that would only ever appear on the very first deploy of a fresh environment, and
  one that would have put an approval step in front of every website update.
- The server watches itself, and can say so: traces of every request, the numbers behind them, and
  seven alarms that email when something is actually wrong — one of which has been deliberately set
  off to check the email arrives. This was first built on an outside monitoring service and then
  moved onto Amazon's own, because measuring it showed the outside route was adding nearly two
  seconds to the first request after an idle period — on an app whose whole traffic pattern is one
  evening a week, so almost every request is that first one. Nobody would have seen a bug; they
  would have seen the app feeling slow to wake up.

### Removed
- The Maestro end-to-end suite (26 flows) is gone. It had rotted while nothing referenced it: a
  hardcoded LAN address and stale selectors, no npm script, and no CI job — running it would have
  meant a ~20-minute cold Gradle build per PR, which is why it never got wired up. Verification now splits along a clearer line: logic is unit-tested in `@poker/core`,
  and everything a unit test structurally cannot see (layout, real platform behaviour, purchases) is
  a human pass driven by [RELEASE_TESTING.md](./RELEASE_TESTING.md), which now spells those rows out
  instead of deferring them to a flow.

### Added
- Groundwork for the multiplayer game mode: a card model, a **seeded** shuffle and a hand
  evaluator in `@poker/core`. Nothing user-facing yet. Randomness is injected rather than
  generated, so a deal is reproducible from its seed — which is what lets the same hand be replayed
  exactly in a test, and lets a server prove after the fact that a shuffle wasn't rigged. The
  evaluator finds the best five cards out of seven by checking all 21 combinations rather than
  consulting a lookup table: there is no generated data to get wrong, and the correctness argument
  fits in a sentence. Hand strength is packed into a single integer so that comparing two hands and
  asking whether they *tie* are the same operation — split pots turn on exact equality, and a
  multi-field comparison is one wrong branch away from paying the wrong player. It is checked
  against the published five-card frequencies across all 2,598,960 hands in the deck, and against
  the number of genuinely different hands in each category, so every hand is verified rather than
  the handful someone thought to write down.
  The seeded shuffle is for **tests and replay only, never for dealing a real hand.** It carries
  32 bits of state, which is about four billion possible shuffles — a space one processor core can
  sweep in a quarter of an hour. Someone holding two cards and looking at the flop could narrow
  that to a few candidates and the turn would settle it, handing them the river and everybody
  else's cards. Choosing the seed carefully doesn't help, because the weakness is how few seeds
  there are. A real deal has to come from the platform's cryptographic random source, which the
  game will pass in; `@poker/core` deliberately doesn't ship one, since it has no platform to take
  it from and a guess would put a fake in the one place that can't have one.
- **Multiple leaderboards (Pro).** Keep a separate board for each set of people you play with —
  the regular Thursday game and the friends you only play with on holiday don't have to share one
  list of names and one set of standings any more. The leaderboard screen shows which board you're
  looking at and switches between them in two taps; groups can be renamed, and deleting one asks
  first and says how many games go with it. Players and games belong to the group they were added
  to, so nothing bleeds between them.
- The leaderboard is now stored as **groups** — a board per set of friends rather than one list for
  everybody. A leaderboard that already exists is turned into a group the first time the app opens
  after updating, keeping every player and every game, and it stays the one you are looking at, so
  nothing changes on screen. The migration is written back straight away rather than being redone
  every launch, and the board is also saved in the old format alongside the new one — so if this
  version ever had to be rolled back, the previous one would still find everybody's history rather
  than an empty board it would then overwrite. There is still only one board visible for now: a host who plays with one crowd
  never meets the concept, and the picker for switching between groups comes next.
- Groundwork for **poker groups** in `@poker/core` — a separate board for each set of friends you
  play with, instead of one list for everybody. Nothing user-facing yet. The important decision is
  that a group's roster is *people*, not accounts: someone who turns up to one game night on holiday
  and will never install anything still belongs on the board, so a name is all that is needed and
  signing in is an optional extra on top. Modelling it the other way round would mean nobody can be
  scored until they have downloaded the app, which is backwards for a game played in someone's
  kitchen. Because every recorded game refers to the person rather than to an account, **signing up
  later never rewrites anything**: you claim the name you have been playing under and every night
  you were ever part of is already yours. Two things are refused rather than guessed at — a person
  somebody else has already claimed, and holding two seats in the same group, since one person is
  one seat and holding two would double-count their nights. Claiming can also be undone, so a
  mistake doesn't mean rebuilding the group. An existing single board becomes a group when the time
  comes, keeping every player and every game, and someone who never used the leaderboard gets no
  group at all rather than an empty one to delete. The stored leaderboard already carries the
  account a player has been claimed by, so the first claim to be saved survives the next launch
  instead of quietly vanishing.
- A whole **game** in `@poker/core`, hand after hand until somebody has all the chips. Nothing
  user-facing yet. The button moves round, players who run out are left out of the next deal, and
  the order people went out in is kept as it happens — which is the part that cannot be worked out
  afterwards, since once everyone is on zero the final chip counts say nothing about who went out
  first. Two players busting in the same hand are separated by the stack they started it with, the
  bigger one finishing higher, which is what a table does. The point of all this is the last step:
  a finished game turns straight into a leaderboard entry, with everyone's finishing position and
  winnings already known, instead of the host tapping them in afterwards from memory. It records the
  top three finishers even when the game paid fewer places or no money at all, so a friendly game
  still has a winner and the board's tie-breaks still have something to work from — the same rule
  the record-a-game sheet already follows by hand.
- A whole hand of Texas hold'em in `@poker/core` — the piece that joins the others up. Nothing
  user-facing yet, but this is the first time the cards, the betting and the pots play a hand from
  the shuffle to the chips being pushed. It deals, posts the blinds, runs each street, deals the
  flop, turn and river, and settles: the last player standing takes it without showing, or the
  hands are compared and the pots — including side pots — go to whoever can win them. When everyone
  is all-in the rest of the board runs out with no more betting, the way a table does it. The
  heads-up exception is handled, because it is the one everybody forgets: with two players the
  button posts the small blind and acts first before the flop, then acts last on every street after
  it. There are no burn cards: a dealer burns one so a marked or glimpsed top card can't be read,
  and with a shuffle nobody can see it would remove a card for no gain. Asserted over two thousand
  randomly played hands — every hand finishes, no chip is created or destroyed, no card is ever
  dealt twice, every showdown is judged on a full five-card board, and what is paid out is exactly
  what went in. A player too short to cover the big blind is all-in for less and everybody behind
  still has to call the full amount, which is the rule rather than the easier thing to write.
- The betting round for the multiplayer game mode, in `@poker/core`. Nothing user-facing yet. It
  decides whose turn it is, what they may legally do, and when the round is over — including the
  three rules people actually get wrong at the table: a raise must be at least as big again as the
  last one; a player can always put their last chip in even when that falls short of a legal raise;
  and **going all-in for less than a full raise does not reopen the betting** — everyone still has
  to match it, but players who have already acted may only call or fold rather than raise again.
  A betting round that could never end would be the worst possible failure here, so termination is
  asserted over thousands of randomly played-out rounds, along with chip conservation and the
  guarantee that everyone still in has either matched the bet or is all-in.
- Side pots for the multiplayer game mode, in `@poker/core`. Nothing user-facing yet. When someone
  is all-in for less than the bet, the money splits into a main pot they can win and side pots they
  can't, so the biggest stack can't win chips nobody had to match — and a player who folds leaves
  their chips behind without being able to win them back. A pot that won't divide evenly hands its
  odd chips out one at a time starting to the left of the button, the way a dealer does it, rather
  than to whoever happens to be first in a list: the result is identical however the players are
  ordered, which is asserted by shuffling every input and comparing. What is paid out always adds
  up to exactly what went in.
- **Payouts (Pro).** Set a buy-in and the app works out what each place wins, so the split is agreed
  before the first hand instead of argued about heads-up. Bounties come **out of** the buy-in rather
  than sitting on top of it — a 20 buy-in with a 5 bounty is still 20 out of each pocket, 15 to the
  prize pool and 5 to knockouts — because the alternative means collecting more than the buy-in you
  advertised. Every payout is rounded to a note you can actually hand over (1, 5, 10 or 25) while
  the table still sums to *exactly* the prize pool: the split uses the largest-remainder method, so
  nothing is quietly lost to rounding and nothing is quietly handed to the winner. If the pool can't
  stretch to the usual number of places at your chosen note size, it pays fewer places rather than
  announcing one that wins nothing. Paid places
  follow the field size by default — roughly the top fifth, the home-game convention rather than a
  casino's tenth — and can be pinned instead. Bounties are flat by default: the app states the
  per-knockout figure and players settle it between themselves at the table. A game the app deals
  can do better than that — see the knockout and progressive-bounty entries above. The maths is in
  `@poker/core`, with the
  sums-to-the-pool invariant asserted across the whole realistic range of buy-ins, field sizes,
  bounties and denominations rather than at a handful of points.
  - **Rebuys and add-ons** are counted too. A rebuy is another buy-in — it grows the prize pool and
    re-arms that player's bounty, exactly as buying in did. An add-on is different: it buys chips,
    not a bounty, so all of it goes to the prize pool and it can carry its own price. How many
    places get paid still follows the number of *players* rather than the number of entries —
    thirteen players with five rebuys is thirteen people to pay, not eighteen — though the extra
    money can fund a place a thinner pool couldn't have paid at your chosen note size.
- **The timer offers to record a game when one ends (Pro).** Reset the timer after the blinds have
  climbed and the app asks whether to add the result to the leaderboard, opening the record sheet
  straight from the prompt. There is no true "tournament over" signal in a blinds timer — reset
  deliberately clears the round and leaves the blind level alone — so this is a deliberate
  heuristic: resetting *after progressing* is someone starting fresh, which almost always means the
  last game just finished. Resetting on level one is a mis-tap and is left alone, and the prompt
  stays quiet unless Pro is unlocked and there is someone on the roster to record against.
- **Chop the remaining money (Pro).** When the players still in agree to end it there, the payouts
  screen works out the deal: everyone left keeps the lowest prize still live, and whatever is above
  that is split by chip stack. A purely chip-proportional split is the obvious version and it's
  wrong — a short stack can come out below the place they'd already locked up, which no table would
  accept. The shares always add up to exactly the money still on the table.
- **Share the payouts or the standings to your group chat (Pro).** A button on each screen hands the
  table a plain-text message — buy-in, field, what each place wins and the bounty; or who's winning
  after however many nights. Plain text on purpose, since chat apps render no formatting, and with
  no app link appended: you're telling your table what the payouts are, not advertising.
- **Leaderboard (Pro).** Keep score across game nights: who has won most, who turns up, and what
  everyone has taken home. **Local-first and single-device** — no accounts, no sign-in, and nothing
  leaves the phone; the host's device is the source of truth for their group. Recording a game is
  two taps per player and no typing: tap who bought in, then tap them in the order they finished.
  Winnings are never entered by hand — they come from the payout structure above, recomputed for the
  field that actually turned up rather than the one you planned for. Games played counts everyone
  who bought in, not just who cashed, so a player on a bad run still appears on the board. The board
  ranks by wins and breaks ties predictably (podiums, then money, then fewer games). It shows money
  **won**, deliberately not net profit: a bounty settled by hand changes hands in cash during play
  and can't be reconstructed at the end of the night, so a profit figure would be confidently wrong
  for anyone in a bounty game. Bounties from a game the app dealt *are* counted, because it watched
  them happen.
- `@poker/core` coverage is now measured across **every** source file and enforced by a threshold in
  CI, so a module with no test at all fails the build instead of being invisible. Coverage read 97%
  before this and was really 86% — v8 only reports files a test imports. It is now 99% statements /
  100% functions, with 38 new tests covering preset, review and sound-pack persistence, the
  corrupt-value and storage-unavailable fallbacks in every loader, the shared store/entitlement ids,
  and blind-maths edges at the top and bottom of the chip ladder.

### Fixed
- Mobile: Android no longer asks twice for notification permission. The request passed a
  `rationale` object, and React Native responds to that by showing **its own** explanatory alert
  before the system permission sheet whenever `shouldShowRequestPermissionRationale` returns true —
  which it does on every launch after the first denial. So a fresh install saw one dialog and
  everyone who had ever tapped "Don't allow" saw two, for the rest of the app's life. The rationale
  is dropped: this is a timer whose entire job is to notify you, and the sheet says as much on its
  own. The service method behind the status check is also renamed
  `requestNotificationPermission` → `hasNotificationPermission`, because it only ever read the
  status and never prompted.
- Mobile: iOS no longer collects a stack of stale Live Activities. The app can only hold one, but
  its record of *which* one lived in memory alone — so force-quitting mid-round left iOS running a
  card the next launch knew nothing about, and the app started a second one beside it rather than
  taking the first one over. Do that across a few game nights and Notification Centre fills up with
  rounds that ended days ago. Every path that touches a Live Activity now reduces however many
  exist to exactly one first: it keeps the app's own card if it is still live, adopts the single
  survivor of a force-quit rather than replacing a perfectly good card, and otherwise ends
  everything and starts fresh. Stopping the timer now clears every card rather than only the
  remembered one. The decision itself moved into `@poker/core` with tests, because it has four
  cases and the previous version got one of them wrong — with no stored id it adopted whichever
  activity the platform happened to list first, and ActivityKit documents no ordering for that
  array, so it could keep a stale card and end the live one.
  - Three further faults in the same area, found reviewing the fix. **iOS reported activities that
    were no longer on screen**: the app read `Activity.activities` unfiltered, which keeps listing
    cards that have ended, been dismissed, or been closed by iOS itself at the eight-hour limit — so
    the app could adopt a dead card, update it to no effect, and leave the user staring at a frozen
    round while believing all was well. **Updating an activity always reported success**, even when
    the id named nothing, so the app's own fallback for that case could never run. And **ending an
    activity raced the timer reset**: resetting both ends the card and redraws it, and the two ran
    concurrently, so the redraw could land after the end had already looked for cards to close and
    found none — leaving a card on screen for a tournament that had finished. Every Live Activity
    operation now runs one at a time, the same way the screen-wake lock already did.
- Mobile: sheets no longer stretch the full width of a tablet. The generator and Pro sheets are
  capped at 640pt and centred, like every other tablet surface in the app — previously `Sheet.tsx`
  had no tablet handling at all, so a form's fields ran the entire width of an iPad. This was
  accepted as a known gap for 1.1.4 partly on the expectation that moving to native form sheets
  would fix it for free; that move is still blocked, so it's fixed here instead.
- Mobile: on iOS, the generator sheet's title and its Done button no longer sit underneath the status
  bar and Dynamic Island when the keypad is up. The sheet sized its scroll region from the full
  window height, so with the keyboard's share subtracted it grew to exactly the window height and
  its top edge landed at y=0 — putting the first row of the sheet behind the clock. It stayed
  scrollable and its footer still cleared the keypad, which is why 1.1.4's keyboard pass didn't
  catch it.
- Mobile: `npm start` / `npm run ios` / `npm run android` work again. Since the SDK 56 alignment,
  npm has installed `expo-router` under `apps/mobile/node_modules` instead of hoisting it, and the
  expo CLI resolves that package from its own nested location — so every one of those commands died
  with `Cannot find module 'expo-router/_ctx-shared'` before Metro served anything. The scripts now
  set `NODE_PATH`, which appends the workspace's own `node_modules` to the CLI's lookup path.

### Changed
- Mobile: brought every Expo package up to the version SDK 56 actually expects — the project had
  drifted 12 packages behind, including `expo` itself, the router, notifications, the splash screen
  and `react-native-screens`. No new features; it's the accumulated bug-fix releases Expo has
  published for this SDK.

## [1.1.4] - 2026-08-19 — iOS & Android

**Release notes (App Store / Play Console "What's New" text) are drafted in
[STORE_LISTING.md](./STORE_LISTING.md#release-notes--v114)** — kept there alongside
the rest of the store copy rather than duplicated here. Both platforms shipped
v1.1.3 together, so both sets of notes cover the same changes.

### Added
- Mobile: blind levels now have their own **Blind structure** screen, reached from Settings,
  replacing the fixed-height scrollable list that was nested inside the scrolling Settings page
  (a scroll-inside-a-scroll that made a 30-level schedule awkward to edit). The new screen is a
  single list, so the whole schedule scrolls normally.
- Mobile: a level can now be inserted or duplicated anywhere in the schedule, not just appended to
  the end. New levels inserted between two others are interpolated from their neighbours and
  rounded to chip-friendly numbers.
- Mobile: a structure **generator** — pick a starting small blind, a number of levels and a speed
  (Slow / Standard / Turbo), preview the result, and replace the whole schedule in one go instead
  of hand-editing every row. It follows the way real published structures are built rather than a
  flat percentage: each speed walks a ladder of round numbers (1, 1.5, 2, 3, 4, 6 …) that wraps
  into the next power of ten, so every blind is a value you can make with chips, the steps ease off
  within each decade, and the top end is predictable — the sheet states how many levels it takes to
  reach 10×. Slow keeps every step in the 20–33% band recommended for keeping players from lurching
  between deep- and short-stacked.
- Mobile: the generator takes a **smallest chip** (1 / 5 / 25 / 100), and every blind it produces is
  a multiple of it — no more levels like 6/12 that can't be posted at a table whose smallest chip is
  a 5. Where the next step would round back onto the previous level, the schedule advances by exactly
  one chip instead. It's seeded from the structure you're already editing, so it usually needs no
  thought. With 25-chips at slow speed this reproduces the standard casino sheet almost exactly:
  25/50 → 50/100 → 75/150 → 100/200 → 125/250 → 150/300 → 200/400 → 250/500.
- Mobile: tap a level number in the editor to jump the running tournament straight to that level
  (the web app has had this; mobile only had next/previous).
- Mobile: the editor marks which level the tournament is currently on, and the Settings entry point
  shows an "Unapplied changes" badge when the editor holds edits that haven't been applied yet.
- Web: new `/guide` page — "How to Run a Home Poker Tournament" — covering buy-ins, blind
  structures, payouts, and a blind-structure explainer, with `HowTo`/`FAQPage` structured data.
  Cross-linked from `/timer`.
- Mobile: the screen now stays on while a round is counting down, and is released once the timer is
  paused or stopped. A phone left on the table used to lock itself within a minute, which backgrounds
  the app and stops the round advancing on its own — so most tournaments dropped out of the
  foreground during their *first* level.
- Mobile: the timer notification (Android) and Live Activity (iOS) both carry a standing line —
  "Open the app at the buzzer to start the next level" — replacing the force-quit notes. Nothing
  of the app's runs while it's backgrounded, so the app is what advances the blinds; saying so
  beats a countdown that looks like the tournament is still progressing when it isn't.
- Mobile: the generator and Pro sheets can now be dismissed by **dragging the handle down** or
  tapping the dimmed area outside them. The handle was previously decorative — it looked draggable
  but did nothing — and tapping outside had no effect either, so on iOS the only way out was a
  button.

### Changed
- Round duration can now be as short as **1 second**, down from a 10-second floor that rewrote
  anything shorter without saying so — typing 5 and coming back to 10 reads as a broken field rather
  than a rule.
- Mobile: the dimmed backdrop behind those sheets now **fades in place** instead of sliding up with
  the sheet, and lightens as you drag one down, so the sheet reads as sitting over the screen rather
  than being part of it.
- Mobile: removed the small ✕ from the corner of both sheets. Each already has a labelled way out —
  "Cancel" on the generator, "Maybe later" on the Pro sheet — so it was a second, unlabelled control
  competing with them.
- Mobile: updated RevenueCat (`react-native-purchases` 10.4.0 → 10.4.4, which moves the native SDK
  from 5.78.0 to 5.81.1 via `PurchasesHybridCommon` 18.22.2). Purchase and restore should be
  smoke-tested on a real device before this release is submitted.
- Mobile: applying edited blind levels now **keeps your place in the tournament** instead of
  silently restarting at Level 1 — the current level is clamped into the new schedule, and you're
  only moved (to the new last level) if the level you were on no longer exists, which the Apply
  button warns about before you confirm. Loading a preset or resetting to defaults still restarts
  at Level 1, since those replace the whole tournament setup rather than editing the one you're
  playing.
- Mobile: round duration is now a minutes + seconds pair rather than a raw seconds field, and
  applies as you edit instead of needing a separate "Save Timer Settings" button. Changing it
  mid-round no longer requires a save step and still leaves a running round's remaining time alone.
- Mobile: Settings redesigned — Pro, Tournament (round length + blind structure), Presets and Sound
  Pack sections built on a shared theme and real icons instead of emoji placeholders, with the Pro
  card collapsing to a single line once unlocked.
- Mobile: numeric fields no longer turn into a literal `0` when you clear them — an empty field
  stays empty while you retype, and reverts to its previous value if you leave it blank.
- Mobile: saving a preset now captures the *active* blind structure rather than the editor's
  working copy, so a preset can't silently record edits you never applied.
- Mobile: recolored the Android foreground-service notification and iOS Live Activity/Dynamic
  Island to match the app's own timer palette (`#10B981` green / `#F59E0B` amber / `#DC2626` red)
  instead of each platform's own approximate shades. Also added two visual states neither platform
  distinguished before: an expired round (red + alarm icon on iOS) and a low-time warning at 60s
  or less remaining (amber, matching Android's existing threshold).
- Mobile: the Android foreground-service notification uses a custom `RemoteViews` layout rather
  than the stock one, so the round's state color reaches the timer text and the blinds get a line
  of their own. The expanded view mirrors the iOS Lock Screen's layout (header, timer + blinds,
  caption).
- Mobile: the paused state's icon/timer-text color on both the Android notification and iOS Live
  Activity changed from gray to amber, simplifying the palette to green (active) / amber (paused
  or low-time) / red (expired).
- Mobile: the blinds are much larger on the iOS Live Activity and the Android notification, now
  matching the countdown's weight rather than sitting a size below it. They're what you actually
  read off a lock screen — the countdown only tells you when to look again — and there's room for
  it since those surfaces no longer carry buttons. Long late-structure numbers shrink to fit
  instead of wrapping.

### Fixed
- Mobile: on Android, focusing the preset-name field on Settings only scrolled "Save Preset"
  about 40% clear of the keyboard instead of fully clear — `useKeyboardNudge.ts` mixed two
  coordinate frames that don't share an origin on Android (`measureInWindow`, excluding the
  status bar, vs. `Dimensions.get("window").height`, including it), a gap the narrower number-pad
  keyboards elsewhere never made large enough to notice. Fixed by threading a `topInset` prop
  through and subtracting it before the comparison, Android-only.
- Mobile: on Android, the generator sheet's footer ("Cancel"/"Replace structure") was unreachable
  behind the keyboard — `Sheet.tsx`'s `KeyboardAvoidingView` silently produced no
  adjustment at all inside this Modal's own separate Android window (same root cause
  `useKeyboardNudge.ts` already documents for Presets: measuring against
  `Dimensions.get('window').height` doesn't account for a Modal's own window). Fixed by tracking
  the keyboard height directly via `Keyboard.addListener` and applying it as `marginBottom` on the
  sheet, bypassing `KeyboardAvoidingView`'s broken Android measurement entirely.
- Mobile: the blind-structure editor list wasn't tablet-capped/centred on iPad at all — genuinely
  full-bleed, despite `BlindStructureScreen.tsx` having the same `isTablet`-based centering logic
  that works correctly on Settings on the same device. A `FlatList`'s `contentContainerStyle`
  combining `width: "100%"` with `alignSelf: "center"` + `maxWidth` resolved differently on iOS
  than the identical pattern on a plain `ScrollView` — dropping the redundant `width: "100%"`
  (`alignSelf: "center"` + `maxWidth` alone already caps and centers) fixed it, verified via
  screenshot on an iPad Pro 11-inch simulator with no regression on Android tablet.
- Mobile: on iOS, `NavRow`'s badge (e.g. the "Unapplied changes" pill on Settings' Blind structure
  row) was invisible to VoiceOver — `NavRow.tsx`'s `TouchableOpacity` sets an explicit
  `accessibilityLabel` that collapses its whole subtree, including the badge, into one opaque
  string. Added a `badgeLabel` prop that folds the badge's text into that same label
  (`"<title>. <summary>. <badgeLabel>"`), so a VoiceOver user now hears about the unapplied draft
  instead of just the title and summary. Found while building iOS Maestro coverage.
- Mobile: a `NumberField` (round duration's seconds, or any numeric field with a
  stricter clamp layered on top by its parent) could keep showing a stale, out-of-range
  digit string after blurring — e.g. typing `99` into the round-duration seconds field
  and tapping away left the box reading "99" even though the round was already
  correctly capped to 59 seconds underneath. `onBlur` was recomputing its own clamp
  from just `min`, overwriting the display with that instead of trusting the already
  fully-clamped `value` it had been passed. Found while building Maestro coverage for
  `RELEASE_TESTING.md`.
- Mobile: the Timer screen card no longer stretches edge-to-edge on tablets — capped it at the
  same tablet-aware `maxWidth` + centered layout `PokerSettings.tsx` already used, so blind values
  and buttons don't end up spread across the full iPad-width card. Found during a cross-device QA
  pass (see `ROADMAP.md`).
- Mobile: the Timer screen now fits on the smallest phones (iPhone SE-class) without feeling
  cramped or overflowing — the whitespace between sections (progress bar, Current Blinds, Next
  Level, etc.) now shrinks faster than text does as the screen gets tighter, instead of both
  shrinking at the same rate down to the same floor.
- Android: fixed tablets being letterboxed into a narrow portrait strip (black bars either side)
  regardless of the device's actual screen size. `MainActivity` locked the whole app to portrait
  via the manifest, but Android 12L+ letterboxes fixed-orientation activities on large screens
  instead of ignoring the restriction (the opposite of what an earlier fix assumed) — moved the
  portrait lock into code (`MainActivity.kt`, based on `smallestScreenWidthDp`) so it still applies
  to phones with no exceptions, while tablets get `SCREEN_ORIENTATION_UNSPECIFIED` and the OS stops
  letterboxing them. Tablets now use the full landscape screen, correctly triggering the existing
  tablet layouts (Settings' side-by-side cards, Timer's centered column).
- Android: app icon now has proper round/squircle corners matching the rest of the launcher —
  added the missing adaptive-icon config (`app.json` had none), so the OS was rendering the flat
  legacy square icon with no mask applied at all.
- Android: edge-to-edge display now survives a clean `expo prebuild` instead of silently
  reverting to the pre-v1.1.3 `Theme.AppCompat` theme. The `android.edgeToEdgeEnabled` app.json
  key stopped being honored by this Expo SDK (Android 16 makes edge-to-edge mandatory, so Expo's
  base prebuild config always resets `AppTheme` to the default theme now) and needed the
  `react-native-edge-to-edge` config plugin registered in `plugins` to reapply `Theme.EdgeToEdge`
  afterward — removed the stale key and added the plugin.
- Mobile: the Android notification/iOS Live Activity Pause/Resume button no longer gets stuck
  offering "Pause" once a round expires — it now correctly switches to "Resume" (Android also
  restores the "Active"/green title once resumed). Resuming an already-expired round no longer
  instantly re-expires it, and now correctly advances to the next blind level and starts a fresh
  round instead of restarting the same (already-finished) one.
- Mobile: the in-app "Time's Up" alert (and its alarm sound) could silently fail to show when a
  round expired while the app was genuinely in the foreground — it would auto-advance the blind
  level with no alert or sound instead, as if the app had been backgrounded the whole time.
- Android: reopening the app after force-quitting (swiping away from Recents) mid-round no longer
  resets the timer to the default 10-minute duration and blind Level 2 — a stale-closure race
  meant a pending notification action could be reconciled against pre-load default values instead
  of what was actually persisted.
- Android: fixed a "Poker Timer keeps stopping" crash (`NullPointerException` in react-native's
  `ReactActivityDelegate`) that could happen whenever the app was paused, resumed, or reconfigured
  before the JS bridge finished attaching — most likely right after a fresh launch. `MainActivity`
  now guards the affected lifecycle callbacks. See CLAUDE.md for the full root-cause writeup.
- Mobile: the Timer card no longer visibly resizes a few times right after a fresh launch. Its
  auto-fit-to-screen pass converges over several measure-and-rescale rounds, and does so
  non-monotonically (measured on a small Android screen: 1.00 → 0.78 → 0.92 → 0.81), so every one
  of those intermediate sizes was being painted. The card now stays hidden behind the native
  splash screen (a dependency that was installed but never actually invoked before now) until that
  fit has genuinely settled *and* the persisted timer state has loaded, then the splash lifts and
  the card appears in the same frame — so the first thing you see is the final layout. Capped at
  4s so a slow or stuck load can't hold the splash indefinitely.
- Mobile: the card no longer resizes when the ad banner appears, which on iOS happened around half
  a second after the app was already on screen (and on Android could be nearly three seconds in).
  An adaptive banner has no height until it has loaded, so the slot used to jump from nothing to
  full height under an already-visible layout; it now reserves that space up front, so the banner
  arriving changes nothing.
- Mobile: the auto-fit now converges in a couple of steps instead of visibly hunting for the right
  size — its size estimate systematically overshot, so it used to ping-pong around the answer (11
  steps in one measured case) and could come to rest on a size that still overflowed the screen
  slightly.
- iOS: the Pro sheet no longer offers "Unlock Pro · one-time" with no price in it. The price was
  fetched once at launch and every failure discarded silently, so a fetch that lost a race with
  store setup left the sheet price-less for the whole session — even though the same lookup
  succeeds by the time Unlock is tapped, which is why buying still worked. It's re-attempted each
  time the sheet opens, and with no price the button simply reads "Unlock Pro".
- Android: a sheet's footer buttons (the generator's Cancel and Replace structure) are no longer
  covered by the keypad. The sheet cleared the keyboard but not the navigation bar below it.
- iOS: the structure generator's sheet is usable with the keyboard up. It didn't shrink to the
  space left above the keyboard, so it couldn't scroll and its top went off-screen. Scrolling a
  sheet no longer dismisses the keypad either — the fields above and below the one you're typing in
  are the reason to scroll, so throwing the keyboard away mid-gesture cost two moves instead of one.
- iOS: number fields now carry a **Done** button above the keypad, since iOS's number pad has no
  Return key and nothing else dismissed it short of tapping elsewhere. On a full screen it's a
  floating pill that sits with the keyboard's rounded edge instead of squaring off against it; in a
  sheet, the sheet puts Done in its own header instead, so nothing is left hanging in the gap above
  the keypad. The keypad is dark either way, to match the app.
- Android: focusing a field near the bottom of the screen now scrolls it clear of the keypad, in
  Settings and the blind editor as well as the sheets. Android used to do this itself, and stopped
  when edge-to-edge became mandatory — the keyboard no longer resizes the window, so a field low on
  the page simply sat underneath it with no way to scroll to it.
- Both platforms: scrolling the blind editor no longer throws the keypad away mid-edit — the level
  above or below the one you're changing is usually the reason to scroll.
- Mobile: reopening the app after a round ran out while it was closed now always shows the
  end-of-round alert. If the alarm sound hadn't finished loading at that moment — likely on the
  reopen path specifically — the level used to advance silently with no alert and no sound, which
  looks exactly like the app losing your place. When more than one round's worth of time passed,
  the alert now says so, rather than presenting a long absence as an ordinary round change.

## [1.1.3] - 2026-07-21 — iOS & Android

**Release notes (App Store / Play Console "What's New" text) are drafted in
[STORE_LISTING.md](./STORE_LISTING.md#release-notes--v113)** — kept there
alongside the rest of the store copy rather than duplicated here. iOS's notes
cover only what's new since the live v1.1.2; Android's cover two versions'
worth since it's live at v1.1.1 (presets are new to Android users here, not
just Sound Packs).

### Added
- Sound Pack (Pro) — choose the alarm that plays when a round ends. Three bundled alternatives
  (Classic Beep, Bell Chime, Double Buzz) alongside the original Classic Alarm, picked from a new
  "Sound Pack" card in Settings, with a 3-second preview per option.
- A subtle "Share Poker Blinds Buzzer" row below the timer, so players at the table can share the
  app with one tap.
- Dev-only `FORCE_FREE_IN_DEV` toggle in `PremiumContext.tsx` (mirrors the existing
  `FORCE_PRO_IN_DEV`), for testing the free/ad experience on a device whose Apple/Google account
  already owns `pro_lifetime`. Always `false` in release builds; no user-facing effect.

### Changed
- Android: release builds now enable R8 code shrinking/obfuscation and resource shrinking
  (previously shipped unminified) — smaller, faster app for a smoother experience.

### Fixed
- Sound preview in Settings no longer plays the alarm's full length (up to ~11s) — capped at 3
  seconds and stoppable early.
- Selecting a new sound pack now applies immediately instead of only after restarting the app.
- Android: real edge-to-edge display instead of the transparent-status/nav-bar-color trick —
  content now respects safe-area insets and the system bars use `react-native-edge-to-edge`
  instead of deprecated `Window.setStatusBarColor`/`setNavigationBarColor` APIs.
- Android: two components that read window dimensions once at load time
  (`TimerExpirationAlert`, `PokerSettings`' tablet-layout check) now recompute reactively instead
  of staying stale, so tablets/foldables that get resized by Android 16 (which can still happen
  regardless of the app's portrait setting) don't end up with mis-sized layouts.
- Android: settings screen now pads for the left/right safe-area inset (previously only handled
  by the OS-provided header), fixing content clipping under the navigation bar on large-screen
  devices.
- Android: the timer screen now measures its own content and scales font sizes/spacing to fit one
  screen without scrolling — previously the ad banner could push the "Share" row off-screen with
  no way to reach it. The ad banner also moved to sit between the timer card and the share row
  instead of below both, and the screen now pads for all four safe-area insets instead of only
  the top.
- Android: portrait-only lock kept on `MainActivity` deliberately (product decision) —
  Android 16's large-screen orientation override only affects tablets/foldables anyway, so phones
  still honor it.
- iOS: locked iPhone to portrait only (was allowing all four orientations), matching the
  portrait-only decision already made for Android phones. iPad is unaffected — still supports all
  orientations.

## [1.1.2] - 2026-07-17 — iOS only

_Live on the App Store. Not shipped to Android (this version has Android-only bugs); the Android
fixes land in 1.1.3._

### Added
- Saved tournament presets (Pro) — save the current blind structure and round length, then
  load any of them in one tap.
- In-app review prompt, shown after 5 rounds played.

### Fixed
- The "Save current setup" preset field no longer lets the on-screen keyboard cover the Save
  Preset button or the preset list.

## [1.1.1] - 2026-06-19

_Also the version Android first launched with. Reconstructed from build history — approximate._

### Fixed
- Post-launch stability and App Store compliance fixes following the monetization release.

## [1.1.0] - 2026-06-17 — iOS only

_Before Android's launch. Reconstructed from build history — approximate._

### Added
- Monetization: an AdMob banner and a one-time **Pro / Remove Ads** purchase (RevenueCat), plus
  a Ko-fi tip jar on the web timer.
- iPad support — the app now ships universal (iPhone + iPad).

### Changed
- Upgraded to Expo SDK 56 / React Native 0.85.

## [1.0.0] - 2025-07 — iOS only

_Before Android's launch. Reconstructed from build history — approximate._

### Added
- Initial App Store release: a poker tournament timer with configurable blind levels, a
  per-round countdown, background timing, iOS Live Activities, and an Android foreground service.

[Unreleased]: https://github.com/toondeboer/poker/compare/v1.1.4...HEAD
[1.1.4]: https://github.com/toondeboer/poker/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/toondeboer/poker/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/toondeboer/poker/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/toondeboer/poker/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/toondeboer/poker/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/toondeboer/poker/releases/tag/v1.0.0
