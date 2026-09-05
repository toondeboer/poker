/**
 * Knowing what the backend is doing, and being told when it stops.
 *
 * **All CloudWatch, and that is a decision rather than the path of least
 * resistance.** This was built to export OpenTelemetry to Grafana Cloud, it
 * worked, and it was removed once there was a number attached to it: the
 * collector layer cost ~1.9 s of cold start against a published 50-200 ms, and
 * the CloudWatch scrape that fills in what OTel cannot see would have cost more
 * per month than the entire rest of the backend — to copy metrics out of the
 * place they already were. See the README.
 *
 * ## The split that used to matter, and why it stopped
 *
 * **OpenTelemetry runs inside a function**, so it sees spans and custom metrics
 * from code somebody wrote — and it cannot see API Gateway 5xx, DynamoDB
 * throttles, AppSync connection errors or a cold start, because those happen
 * outside it. Those are CloudWatch service metrics. With a third-party backend
 * that meant two pipelines and a scrape to join them; with CloudWatch both
 * halves are already in one place, and the dashboard below draws them together.
 *
 * ## Why the alarms were always CloudWatch
 *
 * Even under the Grafana plan, alerts lived here, for a reason that still
 * holds: **an alert defined in the telemetry pipeline stops working when the
 * telemetry pipeline is what broke**, which is exactly when it is needed.
 * CloudWatch alarms read service metrics that exist whether or not anything is
 * exporting, they are infrastructure-as-code rather than console clicks, and
 * they are checked by CI.
 */

import { Duration } from "aws-cdk-lib";
import {
  Alarm,
  AlarmStatusWidget,
  ComparisonOperator,
  Dashboard,
  GraphWidget,
  Metric,
  TreatMissingData,
  type IMetric,
} from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { Topic } from "aws-cdk-lib/aws-sns";
import { EmailSubscription } from "aws-cdk-lib/aws-sns-subscriptions";
import { CfnBudget } from "aws-cdk-lib/aws-budgets";
import { Construct } from "constructs";
import type { StageSettings } from "./stage";

export type ObservabilityProps = {
  settings: StageSettings;
  /**
   * Where an alarm goes. Optional, and the omission is loud rather than quiet:
   * an alarm with nowhere to go is a coloured square on a page nobody opens.
   */
  alertEmail?: string;
  /**
   * Dollars a month before somebody is told. The only alarm that catches a
   * loop nobody noticed, and the one whose absence costs actual money.
   *
   * Ignored without an `alertEmail`, because a budget nobody is subscribed to
   * is a line item in a console rather than a warning.
   */
  monthlyBudgetUsd?: number;
};

export class Observability extends Construct {
  /** Alarms publish here; the email subscription is what makes that useful. */
  readonly alarms: Topic;
  /**
   * One page showing whether the backend is healthy.
   *
   * **In CDK rather than clicked together in a console**, which is the whole
   * reason this is worth having at all: a dashboard somebody built by hand is
   * undocumented, unreviewable, and gone when the account is. This one is in
   * the diff of the pull request that changes it.
   *
   * Every alarm added through {@link watch} puts itself on here, so a metric
   * worth alarming on is automatically a metric worth looking at — and the two
   * cannot drift apart, which they do the moment they are maintained
   * separately.
   */
  readonly dashboard: Dashboard;
  private readonly watched: Alarm[] = [];
  private readonly graphs: GraphWidget[] = [];
  constructor(scope: Construct, id: string, props: ObservabilityProps) {
    super(scope, id);
    const { settings } = props;

    this.alarms = new Topic(this, "Alarms", {
      displayName: `Poker backend (${settings.stage})`,
    });
    if (props.alertEmail) {
      // Email, not SMS or a webhook: it is free, it works from a phone, and
      // there is nothing here that needs waking somebody at 3am.
      this.alarms.addSubscription(new EmailSubscription(props.alertEmail));
    }

    this.dashboard = new Dashboard(this, "Dashboard", {
      dashboardName: `poker-${settings.stage}`,
      // Three days. Long enough to cover the weekend a game was played on, and
      // short enough that opening it does not take a minute.
      defaultInterval: Duration.days(3),
    });

    // A budget with no subscriber notifies nobody, which is a line item in a
    // console rather than a warning. `!== undefined` rather than truthiness, so
    // that a deliberate 0 is a budget of zero rather than no budget at all.
    if (props.monthlyBudgetUsd !== undefined && props.alertEmail) {
      // A Budget rather than a billing alarm: billing metrics only exist in
      // us-east-1, so an alarm on them cannot live in a stack deployed
      // anywhere else. Budgets are global and have no such problem.
      new CfnBudget(this, "MonthlySpend", {
        budget: {
          budgetName: `poker-${settings.stage}`,
          budgetType: "COST",
          /**
           * **This stack's spend, not the whole account's.**
           *
           * Without a filter a budget measures every resource in the account,
           * which is wrong in both directions the moment anything else is
           * deployed beside it: another project's bill alone can hold the
           * forecast over the limit, so the alarm is permanently on and says
           * nothing — while this stack running away stays invisible inside a
           * much larger number. Both stages had one, so the account was
           * measured twice and attributed to neither.
           *
           * **One tag, not two, because Budgets ORs within a dimension.**
           * `TagKeyValue` takes a list, and a resource matching *any* entry is
           * counted. Passing `project$poker` and `stage$dev` would therefore
           * bill the dev budget for everything poker (prod included) plus
           * anything else in the account somebody happened to tag `stage=dev`
           * — broader than no filter in one direction and wrong in the other.
           * So the filter uses `billingScope`, which `PokerStack` sets to a
           * value unique per stack for exactly this reason. `project` and
           * `stage` stay as they are: they are for grouping in Cost Explorer,
           * which *can* combine two tags, and this cannot.
           *
           * **The tag must be activated once, by hand**, under Billing → Cost
           * allocation tags — CloudFormation cannot do it, and until it is done
           * a tag-filtered budget matches nothing at all. Activation is not
           * retroactive either. See the README.
           */
          costFilters: {
            TagKeyValue: [`user:billingScope$poker-${settings.stage}`],
          },
          timeUnit: "MONTHLY",
          budgetLimit: { amount: props.monthlyBudgetUsd, unit: "USD" },
        },
        notificationsWithSubscribers: [
          {
            // Forecast, not actual: being told you have already spent it is
            // information, and being told you are going to is a chance to act.
            notification: {
              notificationType: "FORECASTED",
              comparisonOperator: "GREATER_THAN",
              threshold: 100,
              thresholdType: "PERCENTAGE",
            },
            subscribers: [
              { subscriptionType: "EMAIL", address: props.alertEmail },
            ],
          },
        ],
      });
    }
  }

  /**
   * Watch a metric, and say what it means when it fires.
   *
   * The description is not decoration. An alarm arrives as an email at an
   * inconvenient moment, and the difference between acting on it and ignoring
   * it is whether it says what is actually wrong.
   */
  watch(
    id: string,
    options: {
      metric: IMetric;
      threshold: number;
      evaluationPeriods?: number;
      comparison?: ComparisonOperator;
      /** What this means, in words, for whoever reads the email. */
      meaning: string;
      /**
       * What "no data" means for this metric.
       *
       * Almost always `NOT_BREACHING`: a table that played no hands last night
       * reports nothing, and an alarm that goes off because nobody was playing
       * is an alarm somebody turns off.
       */
      missingData?: TreatMissingData;
    },
  ): Alarm {
    const alarm = new Alarm(this, id, {
      metric: options.metric,
      threshold: options.threshold,
      evaluationPeriods: options.evaluationPeriods ?? 1,
      comparisonOperator:
        options.comparison ?? ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: options.meaning,
      treatMissingData: options.missingData ?? TreatMissingData.NOT_BREACHING,
    });
    alarm.addAlarmAction(new SnsAction(this.alarms));
    this.watched.push(alarm);
    // Held rather than added, so `summarise()` can put the status row above the
    // graphs — widgets render in the order they are added, and "is anything
    // wrong right now" is the question somebody opens this to answer.
    this.graphs.push(
      new GraphWidget({
        title: `${id} — ${options.meaning.split(".")[0]}`,
        left: [options.metric],
        width: 12,
        height: 6,
      }),
    );
    return alarm;
  }

  /**
   * Lay the dashboard out. **Call once, after every {@link watch}.**
   *
   * The alarm status row goes first because it answers the question somebody
   * actually opens a dashboard to ask — is anything wrong right now — and the
   * graphs below it are for working out why. Nothing renders until this runs,
   * which is deliberate: a dashboard assembled as a side effect of declaring
   * alarms would order itself by whatever order the alarms happened to be
   * written in.
   */
  summarise(): void {
    if (this.watched.length === 0) return;
    this.dashboard.addWidgets(
      new AlarmStatusWidget({
        title: "Everything worth being woken for",
        alarms: this.watched,
        width: 24,
        height: 3,
      }),
    );
    for (const graph of this.graphs) this.dashboard.addWidgets(graph);
  }
}

/**
 * A CloudWatch metric for something the account owns rather than the stack.
 *
 * AppSync Events and Cognito are not modelled as CDK constructs with `.metric`
 * helpers, so their metrics are named by hand. Kept here so the dimension names
 * — the part that silently produces an empty graph when wrong — are in one
 * place rather than scattered through the stack.
 */
export const serviceMetric = (options: {
  namespace: string;
  metricName: string;
  dimensions: Record<string, string>;
  statistic?: string;
  period?: Duration;
}): Metric =>
  new Metric({
    namespace: options.namespace,
    metricName: options.metricName,
    dimensionsMap: options.dimensions,
    statistic: options.statistic ?? "Sum",
    period: options.period ?? Duration.minutes(5),
  });
