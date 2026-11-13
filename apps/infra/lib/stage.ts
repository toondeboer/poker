/**
 * What separates a dev backend from the one holding people's leaderboards.
 *
 * Two stacks in one account rather than two accounts: hard isolation is the
 * right answer at scale and costs an Organization, SSO, two bootstraps and
 * cross-account roles today. What is *not* optional is that the two stacks
 * differ in the ways that matter — a dev stack somebody deletes on a Tuesday
 * must not be able to take a season of game nights with it, and a prod stack
 * must not be deletable by accident at all.
 */

import { RemovalPolicy } from "aws-cdk-lib";
import { RetentionDays } from "aws-cdk-lib/aws-logs";

export type Stage = "dev" | "prod";

export const STAGES: readonly Stage[] = ["dev", "prod"];

export const isStage = (value: unknown): value is Stage =>
  typeof value === "string" && (STAGES as readonly string[]).includes(value);

export type StageSettings = {
  stage: Stage;
  /**
   * What happens to stored data when the stack goes away.
   *
   * `RETAIN` in prod, always. Recreating a user pool is an afternoon;
   * recreating two years of results is impossible, and the moment that becomes
   * a live question is the moment it is too late to change this.
   */
  dataRemovalPolicy: RemovalPolicy;
  /** Restoring a table to a point in time. Off in dev, where there is nothing to restore. */
  pointInTimeRecovery: boolean;
  /** How long logs are kept. Long enough in dev to debug the deploy that just failed. */
  logRetention: RetentionDays;
  /**
   * Refuse to delete the user pool without turning this off first.
   *
   * The specific accident it prevents: `cdk destroy` pointed at the wrong
   * stack. `RETAIN` covers the data, and this covers the identities that the
   * data is keyed by — losing those means every account is orphaned even
   * though every row survived.
   */
  deletionProtection: boolean;
};

export const settingsFor = (stage: Stage): StageSettings =>
  stage === "prod"
    ? {
        stage,
        dataRemovalPolicy: RemovalPolicy.RETAIN,
        pointInTimeRecovery: true,
        logRetention: RetentionDays.ONE_MONTH,
        deletionProtection: true,
      }
    : {
        stage,
        // Dev exists to be thrown away and stood up again — that is the whole
        // point of having it, and a dev stack that cannot be destroyed is a
        // second production system nobody admits to.
        dataRemovalPolicy: RemovalPolicy.DESTROY,
        pointInTimeRecovery: false,
        logRetention: RetentionDays.ONE_WEEK,
        deletionProtection: false,
      };

/** `PokerBackend-dev`. Stage in the name, so a console never leaves it ambiguous. */
export const stackNameFor = (stage: Stage): string => `PokerBackend-${stage}`;
