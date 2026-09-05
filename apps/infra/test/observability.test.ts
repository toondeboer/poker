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
    }),
  );
  return synthesised;
};

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
  it("watches the one thing a function cannot see about itself", () => {
    // A player whose subscription drops mid-hand gets no error and reports
    // nothing — the table just stops updating and they blame the wifi. It
    // happens in AppSync, so no handler logs and no request fails.
    const realtime = alarms().filter((alarm) =>
      ["ConnectServerError", "SubscribeServerError"].includes(
        alarm.MetricName ?? "",
      ),
    );
    expect(realtime).toHaveLength(2);
  });

  it("does not alarm on the guard refusing somebody", () => {
    // `ConnectClientError` and `SubscribeClientError` are what a refused
    // non-member looks like. Alarming on those would page somebody every time
    // the security boundary did its job.
    const clientSide = alarms().filter((alarm) =>
      (alarm.MetricName ?? "").endsWith("ClientError"),
    );
    expect(clientSide).toEqual([]);
  });

  it("watches the handful of things worth being woken for", () => {
    // Deliberately few. An alarm nobody acts on trains everybody to ignore the
    // next one. Ten on the backend itself, plus the two SES reputation alarms
    // that exist on prod only — this template is the prod one.
    expect(alarms()).toHaveLength(12);
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

  it("watches mail reputation in prod, and only in prod", () => {
    // **The metric is account-wide.** SES publishes one bounce rate for the
    // whole account and region, not one per stack, so watching it from both
    // stages would put two alarms on the same number and send two emails about
    // one problem. Prod owns the consequence, so prod watches it.
    const sesAlarms = (t: Template) =>
      Object.values(t.findResources("AWS::CloudWatch::Alarm"))
        .map((a) => a.Properties as { Namespace?: string; MetricName?: string })
        .filter((a) => a.Namespace === "AWS/SES")
        .map((a) => a.MetricName)
        .sort();

    expect(sesAlarms(template())).toEqual([
      "Reputation.BounceRate",
      "Reputation.ComplaintRate",
    ]);

    const dev = Template.fromStack(
      new PokerStack(new App(), "SesDev", {
        settings: settingsFor("dev"),
        alertEmail: "someone@example.com",
      }),
    );
    expect(sesAlarms(dev)).toEqual([]);
  });

  it("alarms at AWS's review thresholds, not at the pause thresholds", () => {
    // Sustained bounce over 5% or complaints over 0.1% puts an account under
    // review; roughly double either pauses sending. The alarm has to arrive
    // while there is still room to act.
    template().hasResourceProperties("AWS::CloudWatch::Alarm", {
      MetricName: "Reputation.BounceRate",
      Threshold: 0.05,
      // A rate, so `Sum` would be meaningless.
      Statistic: "Maximum",
    });
    template().hasResourceProperties("AWS::CloudWatch::Alarm", {
      MetricName: "Reputation.ComplaintRate",
      Threshold: 0.001,
      Statistic: "Maximum",
    });
  });

  it("measures this stack's spend and not the whole account's", () => {
    // **The budget used to have no filter at all**, so in an account running
    // anything else it forecast a number this stack was only part of: another
    // project could hold it permanently over the limit while a runaway here
    // stayed invisible inside the total.
    template().hasResourceProperties("AWS::Budgets::Budget", {
      Budget: Match.objectLike({
        CostFilters: { TagKeyValue: ["user:billingScope$poker-prod"] },
      }),
    });
  });

  it("filters on one tag, because Budgets ORs the values it is given", () => {
    // Not a style point. `TagKeyValue` matches a resource carrying *any* of
    // the values, so listing `project$poker` beside `stage$prod` would bill
    // this budget for every poker stack plus anything else in the account
    // tagged `stage=prod`. One value that is already unique per stack is the
    // only correct shape — hence the `billingScope` tag existing at all.
    const budgets = template().findResources("AWS::Budgets::Budget");
    const filters = Object.values(budgets).map(
      (budget) =>
        (budget.Properties as { Budget: { CostFilters?: { TagKeyValue?: string[] } } })
          .Budget.CostFilters?.TagKeyValue,
    );
    expect(filters).toHaveLength(1);
    expect(filters[0]).toHaveLength(1);
  });

  it("tags every stack uniquely, or the filter above matches the wrong one", () => {
    // `billingScope` is what the budget keys on, so dev and prod must never
    // produce the same value.
    const dev = Template.fromStack(
      new PokerStack(new App(), "TagDev", { settings: settingsFor("dev") }),
    );
    // Read off the SNS topic: `Tags.of(this)` reaches every taggable resource,
    // and this one carries them as a plain `Properties.Tags` list. The
    // DynamoDB table does not — a GlobalTable puts them under `Replicas` —
    // which is a detail of that resource and not of the tagging.
    const scopeOf = (t: Template) =>
      (
        Object.values(t.findResources("AWS::SNS::Topic"))[0].Properties as {
          Tags?: { Key: string; Value: string }[];
        }
      ).Tags?.find((tag) => tag.Key === "billingScope")?.Value;
    expect(scopeOf(dev)).toBe("poker-dev");
    expect(scopeOf(template())).toBe("poker-prod");
  });
});

describe("a stack nobody gave an address", () => {
  const quiet = () =>
    Template.fromStack(
      new PokerStack(new App(), "Quiet", { settings: settingsFor("dev") }),
    );

  it("still has the alarms, so turning them on is one property", () => {
    quiet().resourceCountIs("AWS::CloudWatch::Alarm", 10);
  });

  it("subscribes nobody rather than inventing a destination", () => {
    quiet().resourceCountIs("AWS::SNS::Subscription", 0);
  });

  it("does not create a budget it cannot report on", () => {
    quiet().resourceCountIs("AWS::Budgets::Budget", 0);
  });
});

describe("traces, without a collector in the way", () => {
  it("traces every function through X-Ray", () => {
    // Asserted as "none left out" rather than as a count, so a function added
    // later is traced or the test names the one that is not.
    const untraced = Object.entries(
      template().findResources("AWS::Lambda::Function"),
    )
      .filter(
        ([, fn]) =>
          (fn.Properties as { TracingConfig?: { Mode?: string } }).TracingConfig
            ?.Mode !== "Active",
      )
      .map(([id]) => id);
    expect(untraced).toEqual([]);
  });

  it("attaches no Lambda layer at all", () => {
    // The measurement that ended the OpenTelemetry collector: it cost ~1.9 s of
    // cold start against a published 50-200 ms, on an app where a table plays
    // one evening a week and therefore almost every invocation is a cold start.
    // A layer reappearing here is that cost coming back.
    const layered = Object.entries(
      template().findResources("AWS::Lambda::Function"),
    )
      .filter(
        ([, fn]) => ((fn.Properties as { Layers?: unknown[] }).Layers ?? []).length > 0,
      )
      .map(([id]) => id);
    expect(layered).toEqual([]);
  });

  it("resolves no secret into the template", () => {
    // There is no telemetry credential any more. This is what would catch one
    // being reintroduced as a dynamic reference, which puts the resolved value
    // on every function's configuration.
    expect(JSON.stringify(template().toJSON())).not.toContain(
      "{{resolve:secretsmanager:",
    );
  });
});

describe("the dashboard", () => {
  it("exists, in code rather than in somebody's console", () => {
    // A dashboard clicked together by hand is undocumented, unreviewable, and
    // gone with the account. This one is in the diff that changes it.
    template().resourceCountIs("AWS::CloudWatch::Dashboard", 1);
  });

  it("shows every alarm it is worth being woken for", () => {
    // The dashboard and the alarms are built from the same `watch` call, so
    // they cannot drift — which they do the moment they are maintained apart.
    const dashboards = Object.values(
      template().findResources("AWS::CloudWatch::Dashboard"),
    );
    // The body is a `Fn::Join` of escaped JSON, so the quotes are `\"` rather
    // than `"` once stringified — matching the unescaped shape silently finds
    // nothing and passes a `toBeGreaterThan(0)` written the obvious way.
    const body = JSON.stringify(dashboards[0].Properties.DashboardBody);
    const widgets = (type: string) =>
      (body.match(new RegExp(`\\\\"type\\\\":\\\\"${type}\\\\"`, "g")) ?? [])
        .length;
    // The status row first, then one graph per alarm — including the two SES
    // ones, which is the point of the dashboard being built from the same
    // `watch` call rather than maintained beside it.
    expect(widgets("alarm")).toBe(1);
    expect(widgets("metric")).toBe(12);
  });
});
