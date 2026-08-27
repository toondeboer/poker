import { describe, expect, it } from "vitest";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { PokerStack } from "../lib/pokerStack";
import { STAGES, isStage, settingsFor, stackNameFor } from "../lib/stage";

const templateFor = (stage: "dev" | "prod") =>
  Template.fromStack(
    new PokerStack(new App(), stackNameFor(stage), {
      settings: settingsFor(stage),
    }),
  );

describe("telling the two backends apart", () => {
  it("names the stage in the stack, so a console is never ambiguous", () => {
    expect(stackNameFor("dev")).toBe("PokerBackend-dev");
    expect(stackNameFor("prod")).toBe("PokerBackend-prod");
  });

  it("recognises only the stages that exist", () => {
    const failures = ["dev", "prod", "staging", "DEV", "", "1"].filter(
      (value) => isStage(value) !== (value === "dev" || value === "prod"),
    );
    expect(failures).toEqual([]);
  });

  it("defaults to the strict end when nobody says", () => {
    // A settings mistake that makes prod behave like dev deletes data; one that
    // makes dev behave like prod costs a manual cleanup. Only one of those is
    // recoverable, so that is the way the default leans.
    const bare = Template.fromStack(new PokerStack(new App(), "Bare"));
    bare.hasResource("AWS::DynamoDB::GlobalTable", {
      DeletionPolicy: "Retain",
    });
  });
});

describe("prod keeps what cannot be recreated", () => {
  it("retains the table and the user pool", () => {
    // Recreating a user pool is an afternoon. Recreating two years of game
    // nights is impossible, and the moment this becomes a live question is the
    // moment it is too late to change it.
    const prod = templateFor("prod");
    prod.hasResource("AWS::DynamoDB::GlobalTable", { DeletionPolicy: "Retain" });
    prod.hasResource("AWS::Cognito::UserPool", { DeletionPolicy: "Retain" });
  });

  it("can restore the table to a point in time", () => {
    templateFor("prod").hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      Replicas: Match.arrayWith([
        Match.objectLike({
          PointInTimeRecoverySpecification: {
            PointInTimeRecoveryEnabled: true,
          },
        }),
      ]),
    });
  });

  it("refuses to delete the user pool by accident", () => {
    // `Retain` saves the rows; this saves the identities they are keyed by.
    // Losing those orphans every account even though every row survived.
    templateFor("prod").hasResourceProperties("AWS::Cognito::UserPool", {
      DeletionProtection: "ACTIVE",
    });
  });
});

describe("dev is disposable, which is the whole point of having it", () => {
  it("lets the table and the user pool be destroyed", () => {
    // A dev stack that cannot be torn down and stood up again is a second
    // production system nobody admits to.
    const dev = templateFor("dev");
    dev.hasResource("AWS::DynamoDB::GlobalTable", { DeletionPolicy: "Delete" });
    dev.hasResource("AWS::Cognito::UserPool", { DeletionPolicy: "Delete" });
  });

  it("does not pay for point-in-time recovery of nothing", () => {
    templateFor("dev").hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      Replicas: Match.arrayWith([
        Match.objectLike({
          PointInTimeRecoverySpecification: {
            PointInTimeRecoveryEnabled: false,
          },
        }),
      ]),
    });
  });

  it("keeps logs long enough to debug the deploy that just failed", () => {
    templateFor("dev").hasResourceProperties("AWS::Logs::LogGroup", {
      RetentionInDays: 7,
    });
    templateFor("prod").hasResourceProperties("AWS::Logs::LogGroup", {
      RetentionInDays: 30,
    });
  });
});

describe("both stages", () => {
  it("synthesise without an account, a region or a credential", () => {
    const failures: string[] = [];
    for (const stage of STAGES) {
      try {
        templateFor(stage);
      } catch (error) {
        failures.push(`${stage}: ${String(error)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("say which one they are, so a deploy can be checked afterwards", () => {
    for (const stage of STAGES) {
      templateFor(stage).hasOutput("Stage", { Value: stage });
    }
  });
});
