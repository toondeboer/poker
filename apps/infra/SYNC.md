# Groups, players and results in DynamoDB

The sync half of the backend — section C. **This is a design to agree before it is code**, because
the keys decide what account deletion can do, and deletion is the one thing that cannot be added
afterwards without a migration.

Nothing here is built. The types are not invented either: `Group`, `Player`, `GameResult` and
`Placing` already exist in [`packages/core/src/leaderboard`](../../packages/core/src/leaderboard)
and are what the app persists locally today. The schema serves those rather than a parallel model.

---

## What has to be answered

| Question                                       | Where it is answered                        |
| ---------------------------------------------- | ------------------------------------------- |
| Show me my boards                              | `pk = ACCOUNT#<sub>`                        |
| Show me one board                              | `pk = GROUP#<id>`, one query, whole board   |
| Record a game                                  | one `Put`, no read                          |
| Add / rename / remove a player                 | one item under the group                    |
| Claim a player as me                           | two items, one of them under my account     |
| **Delete everything about me**                 | `pk = ACCOUNT#<sub>`, then targeted writes  |

## The keys

One table, `pk`/`sk`, no index. Everything below is either "read one group" or "read one account",
and both are a single partition.

| Item          | `pk`               | `sk`                          | Holds                              |
| ------------- | ------------------ | ----------------------------- | ---------------------------------- |
| Group         | `GROUP#<groupId>`  | `META`                        | `name`, `createdAt`, `ownerId`, `version` |
| Player        | `GROUP#<groupId>`  | `PLAYER#<playerId>`           | `name`, `accountId?`               |
| Result        | `GROUP#<groupId>`  | `RESULT#<playedAt>#<id>`      | the whole `GameResult`, or a tombstone |
| Membership    | `ACCOUNT#<sub>`    | `GROUP#<groupId>`             | `role: owner \| player` — **the authorization fact** |
| Claim         | `ACCOUNT#<sub>`    | `CLAIM#<groupId>#<playerId>`  | — (existence is the fact)          |

Three things follow from this shape, and they are the reasons for it:

**A board is one query.** `pk = GROUP#<id>` returns the group, its players and its results together,
already sorted — `RESULT#<playedAt>#<id>` sorts newest-last by time because `playedAt` leads, and
the id only breaks ties between two games recorded in the same millisecond.

**Recording a game is a `Put` with no read.** Results are append-only and keyed by their own id, so
two phones recording different games cannot conflict at all. That is most of the sync problem gone
without a merge strategy — and it is the argument for item-per-result over storing the app's
`GroupedLeaderboard` blob, which would make every write a whole-document conflict.

**Deletion is a query, not a scan.** `pk = ACCOUNT#<sub>` returns every group the account touches
and every player it has claimed. Without the claim items, finding what to unclaim would mean
scanning every group in the table, and a `Scan` in a deletion path is how deletion quietly stops
working at scale. **This is the reason to settle the keys before writing anything.**

## Version, and where it is not needed

`version` is on the group's `META` item only, guarding the things that are genuinely
read-modify-write: renaming a group, removing a player. Results need none — a new id per game is its
own guarantee. Claiming needs none either; it is guarded by a condition instead (below).

This is deliberately unlike the poker table, which versions the whole hand: there, every action
depends on the exact state it was decided against. A leaderboard is a set of independent facts.

## Claiming, which is the one contended write

Two people must not claim the same player, and one account must not hold two seats on the same
board — the rules `@poker/core`'s `claimPlayer` already enforces locally. Server-side that is a
`TransactWriteItems`:

1. `Put` the claim item under `ACCOUNT#<sub>`, conditional on it not existing.
2. `Update` the player's `accountId`, conditional on `attribute_not_exists(accountId)`.

Both or neither. A claim item without the player update would show the account a board it is not on;
the player updated without the claim item would be invisible to deletion.

## Account deletion

`DELETE /me`, server-side, in this order — **and the order is the whole design**:

1. Query `pk = ACCOUNT#<sub>`.
2. For each claim: clear `accountId` on that player, conditional on it still being this account.
   **The player and the results stay.** Every game ever recorded refers to the person, not the
   account, so the board keeps its history and the group's other members lose nothing.
3. For each membership: see the open question below.
4. Delete the `ACCOUNT#<sub>` items.
5. `AdminDeleteUser` in Cognito, **last**.

Cognito goes last because once the user is gone the client's token is invalid, so nothing can
authenticate a retry. Steps 1–4 are idempotent: every write is conditional on the state it expects,
so a deletion that fails halfway can be re-run, and it has to be — the alternative is an account
that cannot be deleted because it is half deleted.

## Decided: boards are shared, and the phone stays authoritative

**A claimed player can read the board.** The people at the table are the people who want the
standings, which is the whole point of a leaderboard. Two consequences, and neither is free:

- **Every read of a group is authorized**, not just authenticated. The rule is "the caller owns this
  group or holds a claim in it", which is a lookup of `ACCOUNT#<sub>` / `GROUP#<id>` — the membership
  item stops being decoration and becomes the thing that decides. This is the same shape as the
  table's subscribe guard in `subscribeAuthorizer.ts`, for the same reason: membership is a fact
  about the group, not about the path, so it needs a read.
- **Other people's data arrives on your phone** — every player's name in that group, every game, and
  what everyone won. That is what a shared board *is*, and it is worth saying out loud because the
  local-first app has never had to: until now, the only leaderboard on your phone was one you typed.

**The phone stays the source of truth; the server is a backup.** The app works signed out and on a
bad connection at a table, and that is the environment it is actually used in. The cost is a merge,
and the merge has one genuinely hard case.

### The merge, and the case that breaks the easy version

Adds are trivial: results are keyed by their own id, so a union across devices is correct with no
comparison at all. **Deletes are not**, and the app has them — `deleteResult` and `removePlayer`
both exist in `LeaderboardContext`. A phone that deletes a mistyped game and syncs against a phone
that never saw the deletion will have it **resurrected**, silently, and the only symptom is a game
nobody remembers recording reappearing on the board.

So a delete writes a **tombstone** rather than removing the item: the `RESULT#…` row stays with its
payload stripped and `deletedAt` set, and reads filter it out. The same for a removed player.

- **Tombstones need a TTL** or the table grows forever with rows that mean "nothing".
- **A TTL reintroduces the bug for a phone that has been offline longer than it.** Anything past
  that horizon has to full-resync — replace local state from the server rather than merge into it —
  which is correct and worth building deliberately rather than discovering.
- Ninety days is the obvious starting number: a phone that has not opened the app in a season is
  going to want a clean board anyway.

---

## Open questions — one left, and it needs answering before code

**What happens to a group when its owner deletes their account?** This was a hypothetical under
owner-only boards and is now real: other people's history lives in that group.

- **Delete it**, and everyone else's seasons with it. Clean, and destroys data belonging to people
  who did not ask for anything.
- **Orphan it** — keep the board, clear the owner. Nobody can rename or delete it afterwards, and it
  cannot be cleaned up later without an admin path that does not exist.
- **Transfer it** to the longest-standing claimed member. Kindest, and the most surprising thing
  that can happen to somebody who has not opened the app in a month.

Step 3 of *Account deletion* above is a placeholder until this is settled.

## What this does not cover yet

Deliberately out of scope for the schema, and each needs its own pass:

- **How a group is joined.** Claiming happens on the host's phone today. A shared board implies
  somebody joining from their own — an invite, a code, or a scan — and that is a product decision
  before it is a key.
- **What the sync trigger is.** On foreground, on change, on a pull? The merge is designed above;
  when it runs is not.
- **Whether guest players are ever merged.** Two groups may hold the same person as two `Player`
  rows with different ids. Nothing here joins them, and probably nothing should.
