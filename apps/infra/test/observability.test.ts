import { describe, expect, it } from "vitest";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { PokerStack } from "../lib/pokerStack";
import { settingsFor } from "../lib/stage";

let synthesised: Template | null = null;
const template = (): Template => {
  synthesised ??= Template.fromStack(
    new PokerStack(new App(), "ObsTest", {
      settings: settingsFor("prod"),
      alertEmail: "someone@example.com",
      monthlyBudgetUsd: 50,
      telemetry: true,
    }),
  );
  return synthesised;
};

/** The same stack as it deploys the *first* time: no credential, no exporter. */
const beforeTelemetry = (): Template =>
  Template.fromStack(
    new PokerStack(new App(), "PreTelemetry", {
      settings: settingsFor("prod"),
      alertEmail: "someone@example.com",
    }),
  );

const alarms = () =>
  Object.values(template().findResources("AWS::CloudWatch::Alarm")).map(
    (alarm) =>
      alarm.Properties as {
        AlarmDescription?: string;
        AlarmActions?: unknown[];
        TreatMissingData?: string;
        MetricName?: string;
      },
  );

describe("being told when it stops", () => {
  it("watches the handful of things worth being woken for", () => {
    // Deliberately few. An alarm nobody acts on trains everybody to ignore the
    // next one.
    expect(alarms()).toHaveLength(7);
  });

  it("says what each one means, because that is what arrives in the email", () => {
    // An alarm named `ActionErrors` at an inconvenient moment is a shrug. One
    // that says what broke and where to look is an instruction.
    const silent = alarms().filter(
      (alarm) => (alarm.AlarmDescription ?? "").length < 40,
    );
    expect(silent).toEqual([]);
  });

  it("sends every one of them somewhere", () => {
    // An alarm with no action is a coloured square on a page nobody opens.
    const unrouted = alarms().filter(
      (alarm) => (alarm.AlarmActions ?? []).length === 0,
    );
    expect(unrouted).toEqual([]);
  });

  it("does not fire because nobody played last night", () => {
    // A table that plays one evening a week reports no metrics for six days.
    // An alarm that treats that as breaching is an alarm somebody turns off.
    const breaching = alarms().filter(
      (alarm) => alarm.TreatMissingData !== "notBreaching",
    );
    expect(breaching).toEqual([]);
  });

  it("emails somebody when it is given an address", () => {
    template().hasResourceProperties("AWS::SNS::Subscription", {
      Protocol: "email",
      Endpoint: "someone@example.com",
    });
  });

  it("warns before the bill arrives, not after", () => {
    // Forecast rather than actual: being told you have already spent it is
    // information, not a chance to do something about it.
    template().hasResourceProperties("AWS::Budgets::Budget", {
      Budget: Match.objectLike({
        BudgetType: "COST",
        TimeUnit: "MONTHLY",
        BudgetLimit: { Amount: 50, Unit: "USD" },
      }),
      NotificationsWithSubscribers: Match.arrayWith([
        Match.objectLike({
          Notification: Match.objectLike({ NotificationType: "FORECASTED" }),
        }),
      ]),
    });
  });
});

describe("a stack nobody gave an address", () => {
  const quiet = () =>
    Template.fromStack(
      new PokerStack(new App(), "Quiet", { settings: settingsFor("dev") }),
    );

  it("still has the alarms, so turning them on is one property", () => {
    quiet().resourceCountIs("AWS::CloudWatch::Alarm", 7);
  });

  it("subscribes nobody rather than inventing a destination", () => {
    quiet().resourceCountIs("AWS::SNS::Subscription", 0);
  });

  it("does not create a budget it cannot report on", () => {
    quiet().resourceCountIs("AWS::Budgets::Budget", 0);
  });
});

describe("a first deploy, before the credential exists", () => {
  it("attaches no collector, because one without an endpoint refuses to start", () => {
    // The failure this avoids is the worst kind: the API returns 502 to
    // everything, and the cause is a telemetry credential nobody was thinking
    // about. Deploy, create the secret, redeploy with telemetry on.
    const functions = Object.values(
      beforeTelemetry().findResources("AWS::Lambda::Function"),
    );
    const instrumented = functions.filter(
      (fn) => ((fn.Properties as { Layers?: unknown[] }).Layers ?? []).length > 0,
    );
    expect(instrumented).toEqual([]);
  });

  it("still alarms on everything, so the switch is only about export", () => {
    beforeTelemetry().resourceCountIs("AWS::CloudWatch::Alarm", 7);
  });

  it("asks for no secret it has not been told exists", () => {
    const rendered = JSON.stringify(beforeTelemetry().toJSON());
    expect(rendered).not.toContain("{{resolve:secretsmanager:");
  });
});

describe("telemetry reaching Grafana", () => {
  it("uses the Node wrapper, not the Python one", () => {
    // The names invite the wrong choice: `INSTRUMENT_HANDLER` is
    // `/opt/otel-instrument`, which is Python's. Node wants `/opt/otel-handler`,
    // and the wrong one fails at init on every single invocation.
    template().hasResourceProperties("AWS::Lambda::Function", {
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          AWS_LAMBDA_EXEC_WRAPPER: "/opt/otel-handler",
        }),
      }),
    });
  });

  it("instruments both functions without a line of code in either", () => {
    const functions = Object.values(
      template().findResources("AWS::Lambda::Function"),
    );
    const withLayer = functions.filter(
      (fn) => ((fn.Properties as { Layers?: unknown[] }).Layers ?? []).length > 0,
    );
    expect(withLayer).toHaveLength(2);
  });

  it("points the collector at the config that names Grafana", () => {
    // The ADOT layer's default configuration exports to X-Ray and nothing
    // else, so without this the traces never leave AWS.
    template().hasResourceProperties("AWS::Lambda::Function", {
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          OPENTELEMETRY_COLLECTOR_CONFIG_URI: "/var/task/collector.yaml",
        }),
      }),
    });
  });

  it("says which environment a span came from", () => {
    // Two stacks reporting into one Grafana with no way to tell them apart is
    // worse than one stack reporting into it.
    template().hasResourceProperties("AWS::Lambda::Function", {
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          OTEL_RESOURCE_ATTRIBUTES: Match.stringLikeRegexp(
            "deployment.environment=prod",
          ),
        }),
      }),
    });
  });

  it("keeps the credential out of the template entirely", () => {
    // A dynamic reference is resolved by CloudFormation at deploy time, so the
    // token is in neither this repository nor the synthesised artefact.
    const rendered = JSON.stringify(template().toJSON());
    expect(rendered).toContain("{{resolve:secretsmanager:");
    const secrets = ["unset-real-token", "glc_", "Basic "];
    expect(secrets.filter((needle) => rendered.includes(needle))).toEqual([]);
  });
});
