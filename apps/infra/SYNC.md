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

| Item       | `pk`              | `sk`                         | Holds                               |
| ---------- | ----------------- | ---------------------------- | ----------------------------------- |
| Group      | `GROUP#<groupId>` | `META`                       | `name`, `createdAt`, `version`      |
| Player     | `GROUP#<groupId>` | `PLAYER#<playerId>`          | `name`, `accountId?`, `deletedAt?`  |
| Result     | `GROUP#<groupId>` | `RESULT#<playedAt>#<id>`     | the `GameResult`, or a tombstone    |
| Membership | `ACCOUNT#<sub>`   | `GROUP#<groupId>`            | `role: admin \| member`, `joinedAt` |
| Claim      | `ACCOUNT#<sub>`   | `CLAIM#<groupId>#<playerId>` | `claimedAt`                         |

**One inverted index**, `GSI1PK = sk`, `GSI1SK = pk`, for exactly one question: _who is in this
group?_ Querying `GSI1PK = GROUP#<id>` returns every `ACCOUNT#…` membership pointing at it.

The first draft of this design had no index and I would rather it still did not. It is earned now:
multiple admins means a group has to know its own members — to list them, and to notice when the
last admin is leaving — and the alternative is writing every membership twice and keeping the two
copies honest forever.

**Authorization never reads the index.** GSI reads are eventually consistent, so a permission check
against one can pass on a role revoked a second earlier. Every check is a strongly consistent
`GetItem` on `ACCOUNT#<sub>` / `GROUP#<id>` on the base table. The index is for _listing_, which
tolerates being a moment stale.

Two more things follow from the shape:

**A board is one query.** `pk = GROUP#<id>` returns the group, its players and its results together,
already ordered — `RESULT#<playedAt>#<id>` sorts by time because `playedAt` leads, and the id only
breaks ties between two games recorded in the same millisecond.

**Deletion is a query, not a scan.** `pk = ACCOUNT#<sub>` returns every group the account belongs to
and every player it has claimed. Without the claim items, finding what to unclaim would mean
scanning every group in the table — and a `Scan` in a deletion path is how deletion quietly stops
working once there is real data in it.

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

### A recorded game is immutable, and the key depends on it

`RESULT#<playedAt>#<id>` puts the date in the sort key, and `removeGameResult`
deletes **by id alone** — so removing a game means rebuilding its key from a
`GameResult` the client still holds. That works only because nothing in the app
edits a recorded game: `playedAt` cannot drift away from the key it was written
under.

**If a game ever becomes editable this breaks silently**: the tombstone lands at
a key nothing lives at, and the real row survives to be synced back. Every
tombstone write is therefore conditional on the row existing, so a wrong key
fails loudly instead of creating an orphan.

The stamp is also zero-padded to 13 digits. Epoch milliseconds are 13 digits now
and 12 before September 2001, and `playedAt` is a field somebody can set when
recording a game played earlier — unpadded, a backdated game sorts as the most
recent one on the board.

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
   - No other members at all → tombstone the group. Nobody else's history is in it.
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

Still open: **whether an invite expires, and whether it is single-use.** A link in a group chat
outlives the evening it was shared in.

**What does a person see of a group they were added to but never joined?** "Added by somebody else"
and "joined myself" are different states, and the first has no membership item — so today that
board is invisible to them entirely, which may be right or may be the missing half of joining.

## Not covered here

- **When sync runs.** On foreground, on change, on a pull. The merge is designed; the trigger is not.
- **Whether guest players are ever merged.** Two groups may hold the same person as two `Player`
  rows with different ids. Nothing here joins them, and probably nothing should.
