// src/app/join/[token].tsx
import { JoinBoardScreen } from "@/src/components/leaderboard/JoinBoardScreen";

/**
 * Where `pokerkit://join/<token>` lands.
 *
 * A dynamic segment rather than a query parameter because that is the shape
 * `inviteUrlFor` builds, and the shape a link has to keep to survive an https
 * base later: a path is what a website can serve a landing page for, and a
 * query string on a bare domain is not.
 */
export default function JoinRoute() {
  return <JoinBoardScreen />;
}
