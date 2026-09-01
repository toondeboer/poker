# Groups, players and results in DynamoDB

The sync half of the backend — section C. **This is a design to agree before it is code**, because
the keys decide what account deletion can do, and deletion is the one thing that cannot be added
afterwards without a migration.

Nothing here is built. The types are not invented either: `Group`, `Player`, `GameResult` and
`Placing` already exist in [`packages/core/src/leaderboard`](../../packages/core/src/leaderboard)
and are what the app persists locally today. The schema serves those rather than a parallel model.

---

## What has to be answered

| Question                       | How                                                       |
| ------------------------------ | --------------------------------------------------------- |
| Show me my boards              | `pk = ACCOUNT#<sub>`                                      |
| Show me one board              | `pk = GROUP#<id>` — one query, whole board                |
| **May this caller touch it?**  | `GetItem ACCOUNT#<sub> / GROUP#<id>`, strongly consistent |
| Who is in this group           | inverted index on `GROUP#<id>`                            |
| Record a game                  | one `Put`, no read                                        |
| Add a player                   | one `Put` — any member may                                |
| Remove a player or a game      | tombstone — **admins only**                               |
| Claim a player as me           | one transaction, three items                              |
| **Delete everything about me** | `pk = ACCOUNT#<sub>`, then targeted writes                |

## The keys

| Item       | `pk`              | `sk`                 | Holds                                          |
| ---------- | ----------------- | -------------------- | ---------------------------------------------- |
| Group      | `GROUP#<groupId>` | `META`               | `name`, `createdAt`, `version`, `inviteToken?` |
| Player     | `GROUP#<groupId>` | `PLAYER#<playerId>`  | `name`, `accountId?`, `deletedAt?`             |
| Result     | `GROUP#<groupId>` | `RESULT#<id>`        | the `GameResult`, or a tombstone               |
| **Member** | `GROUP#<groupId>` | `MEMBER#<accountId>` | `role`, `joinedAt`                             |
| Membership | `ACCOUNT#<sub>`   | `GROUP#<groupId>`    | `role`, `joinedAt`                             |
| Claim      | `ACCOUNT#<sub>`   | `CLAIM#<groupId>`    | `playerId`, `claimedAt`                        |

**No index.** Two partitions answer everything: a group's own partition holds the board _and_ its
members, and an account's holds its boards and its claims.

### This is the second schema, and the first one is why

The first had one membership row plus an inverted index, a separate `SEAT#` item to stop an account
holding two players, and an `adminCount` on the group. Three review rounds found the same class of
bug repeatedly, because each of those is an invariant kept in step **by hand** — and fixing one kept
breaking another. Two of the three fix rounds introduced defects of their own.

What changed, and what each change makes impossible rather than merely guarded:

- **One seat per board is the shape of a key.** `CLAIM#<groupId>` holds the player, so a second
  claim collides with the first. The old `CLAIM#<groupId>#<playerId>` could not express the rule at
  all and needed a second row that had to be created, deleted and remembered everywhere — and was
  forgotten in two places.
- **Membership is written twice**, under the group and under the account. That is the duplication
  the first design rejected as "keeping the copies honest forever", and it was the wrong call: two
  rows in one transaction are less to keep honest than a counter, a sparse index attribute and a
  read that might be stale. It also makes _who is in this group_ a **strongly consistent** query, so
  the decisions resting on it stop being races.
- **There is no `adminCount`.** "Is there another admin?" is answered by **naming one** and asserting
  inside the same transaction that they still are — a `ConditionCheck`, which cannot be raced. A
  count is a read somebody can invalidate before the write lands, and it needed four separate paths
  to remember to move it. One of them didn't.
- **There is no index**, which removes a hot partition with it. The obvious inverted index
  partitions on `sk` — and every poker table row carries the constant `sk: "STATE"`, so every table
  action in the system would have landed in one index partition, around 1000 WCU/s and not
  splittable by adaptive capacity.

## Who may do what

| Action                     | Who        |
| -------------------------- | ---------- |
| Add a player               | any member |
| Record a game              | any member |
| Claim a player as yourself | any member |
| **Remove a player**        | admin      |
| **Remove a game**          | admin      |
| Rename the group           | admin      |
| Promote or demote an admin | admin      |

**Adding is open and removing is not**, which is the asymmetry that matters: anybody at the table
can write down a name, and only somebody trusted can make a season disappear. It also puts the
permission read on the rare path — recording a game, the thing that happens every week, needs only
membership.

**More than one admin, always.** A group with one admin becomes unmanageable the moment that person
stops playing, and there is no support channel to fix it. The account-deletion path below enforces
this rather than assuming it.

## Online first, offline anyway

**The server holds the shared board**, because edits several people can make have to meet
somewhere. That is a change from today, where the phone's copy _is_ the board.

**The app still works with no connection**, because it is used in a room where the host has two
bars. The split is by whether an action needs anybody else:

| Works offline, syncs later         | Needs a connection                              |
| ---------------------------------- | ----------------------------------------------- |
| The timer, and everything about it | Seeing somebody else's changes                  |
| Dealing a hand on one phone        | The multiplayer table                           |
| Recording a game you just played   | Claiming a player — it must not double-claim    |
| Adding a player                    | Removing a player or a game — it is destructive |

**The queue that implements this carries additive writes only** — `addPlayer` and `recordGame`, and
nothing else (`packages/core/src/sync/pendingWrites.ts`). Two earlier versions of it were wider,
each contradicting the table above, and each brought its own class of bug: a queued claim let two
offline phones both believe they had the same player, and a queued removal hid something on one
phone that the server might refuse days later. Narrowing it to the safe direction also deleted the
collapse rules and the dependency guards they needed.

The rule behind that table: **an offline action is allowed when the worst case is that it merges
late, and refused when the worst case is that it merges wrongly.** Claiming is the clear example —
two people claiming the same player on two offline phones cannot both be right, and resolving it
afterwards means telling somebody they are not who they said they were.

### A queued write can be refused, and the app has to say so

The part that is easy to skip. A write made offline is checked **when it syncs, not when it was
made** — so a game recorded on Tuesday can be rejected on Thursday because an admin removed you from
the group on Wednesday. The app can neither silently drop it nor silently apply it. It needs
somewhere to say "this did not go through, here is what it was", which is UI that does not exist.

### The merge, and the case the easy version gets wrong

Adds are trivial: results and players are keyed by their own ids, so a union across devices is
correct with no comparison at all.

**Deletes are not**, and the app has them — `deleteResult` and `removePlayer` both exist in
`LeaderboardContext`. A phone that deletes a mistyped game and syncs against a phone that never saw
the deletion will have it **resurrected**, silently, and the only symptom is a game nobody remembers
recording reappearing on the board.

So a delete writes a **tombstone**: the row stays, its payload is stripped, `deletedAt` is set, and
reads filter it out.

- **Tombstones need a TTL**, or the table fills with rows meaning "nothing".
- **A TTL reintroduces the bug** for a phone offline longer than it. Anything past that horizon has
  to full-resync — replace local state rather than merge into it — which is worth building
  deliberately rather than discovering.
- Ninety days is the starting number: a phone that has not opened the app in a season wants a clean
  board anyway.

### A recorded game is immutable

Nothing in the app edits a recorded game — it is added and removed, never changed. The engine's own
`removeGameResult` deletes by id, which is now also how the API does it.

The stamp helper survives for ordering, clamped at 13 digits: epoch milliseconds are 13 digits now
and 12 before September 2001, `playedAt` is a field somebody can set, and past 13 digits `String()`
starts producing `"1e+21"`.

## Version, and where it is not needed

`version` sits on the group's `META` item only, guarding genuine read-modify-write: renaming,
changing roles. Results and players need none — a new id per item is its own guarantee, and a
deletion is a conditional write on the item itself.

Deliberately unlike the poker table, which versions the whole hand: there, every action depends on
the exact state it was decided against. A leaderboard is a set of independent facts.

## Claiming, the one contended write

Two people must not claim the same player, and one account must not hold two seats on the same
board — the rules `@poker/core`'s `claimPlayer` already enforces locally. Server-side, one
`TransactWriteItems`:

1. `Put` the claim under `ACCOUNT#<sub>`, conditional on it not existing.
2. `Update` the player's `accountId`, conditional on `attribute_not_exists(accountId)`.
3. `Put` the membership if absent — claiming yourself is how you join a board.

All three or none. A claim without the player update would show an account a board it is not on; the
player updated without the claim would be invisible to deletion.

## Account deletion

`DELETE /me`, server-side, in this order — **and the order is the whole design**:

1. Query `pk = ACCOUNT#<sub>`.
2. For each claim: clear `accountId` on that player, conditional on it still being this account.
   **The player and the results stay.** Every game refers to the person, not the account, so the
   board keeps its history and nobody else loses anything.
3. For each membership where this account is an **admin**: query the index for that group's members.
   - Another admin exists → nothing to do. **This is the common case now that groups have several.**
   - No other admin, but other members → **promote the longest-standing member by `joinedAt`.** A
     group must never be left with nobody who can manage it.
   - No other members at all → **nothing.** The group survives, empty. Deleting it would mean
     deciding "nobody else is here" from a read, and getting that wrong destroys somebody's season;
     leaving it costs a few rows nobody can see. See _Known gaps_.
4. Delete the `ACCOUNT#<sub>` items.
5. `AdminDeleteUser` in Cognito, **last**.

Cognito goes last because once the user is gone the client's token is invalid and nothing can
authenticate a retry. Steps 1–4 are idempotent — every write conditional on the state it expects —
and they have to be, or a deletion that fails halfway leaves an account that cannot be deleted
_because_ it is half deleted.

**Somebody promoted this way has to be told.** Being silently made responsible for a group is
indistinguishable from a bug. There is no notification path in the app today, and this is the first
thing that needs one.

---

## Open, and worth settling before code

**Joining is by invite link** — decided. The host shares a URL, tapping it opens the app on a join
screen, and redeeming it writes the membership. The token is its own partition (`INVITE#<token>`)
because whoever is redeeming it does not know the group id yet; any other keying is a scan.

Two things it needs that do not exist:

- **A long random token, not the six-character join code.** That code is built to be read across a
  table and deliberately drops `O`/`0`, `I`/`1` and `S`/`5` — it is short because it is spoken, and
  short means guessable. A link is not spoken, so it should carry something with real entropy.
- **Universal links.** `pokerkit://` is owned by the Expo dev launcher in development, so a
  cold-launch deep link cannot be tested from a dev client at all — this is already a known trap in
  CLAUDE.md and would need a real build to verify.

**An invite does not expire, and is not single-use** — decided. A link pinned in a group chat is how
a Thursday game actually works, and a link that dies mid-season is a link somebody has to reissue
every time a new person turns up.

That makes **revocation the necessary half**, because nothing else can undo a link once it is loose:
the group's `META` row holds the current token, and an admin rotating it deletes the old
`INVITE#<token>` partition and writes a new one. Without that, a link forwarded out of the group
chat is permanent, unfixable, and reads everyone's history — and there is no support channel to fix
it by hand.

One invite per group rather than many, so "the link" is a thing with one answer.

**What does a person see of a group they were added to but never joined?** "Added by somebody else"
and "joined myself" are different states, and the first has no membership item — so today that
board is invisible to them entirely, which may be right or may be the missing half of joining.

## Known gaps

- **An empty group is never deleted.** Account deletion used to tombstone a group whose last member
  was leaving, decided from the eventually consistent index — and a stale read there destroys a
  group that still has people in it. That trade is the wrong way round, so the destructive branch is
  gone and an emptied group survives with its players and results. Cleaning them up wants a
  deliberate path (a scheduled sweep, or a consistent member count on the group's own item), not a
  guess made during somebody's deletion.
- **Promotion and departure are two writes, not one.** When the last admin leaves, the heir is
  promoted and _then_ the leaver departs asserting that heir is an admin. Both orders have a window;
  this one's leaves the group with **two** admins rather than none, which is the survivable
  direction.
- **An emptied group is never deleted.** Deletion used to tombstone a group whose last member was
  leaving, decided from an eventually consistent read — and a stale one there destroys a group that
  still has people in it. Cleaning up an empty group wants a deliberate sweep rather than a guess
  made during somebody else's deletion.

## Not covered here

- **When sync runs.** On foreground, on change, on a pull. The merge is designed; the trigger is not.
- **Whether guest players are ever merged.** Two groups may hold the same person as two `Player`
  rows with different ids. Nothing here joins them, and probably nothing should.
