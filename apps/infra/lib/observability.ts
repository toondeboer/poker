/**
 * Knowing what the backend is doing, and being told when it stops.
 *
 * Two paths, one destination, and the split is the part that is easy to get
 * wrong. **OpenTelemetry runs inside a function**, so it sees spans, custom
 * metrics and logs from code somebody wrote — and it cannot see API Gateway
 * 5xx, DynamoDB throttles, AppSync connection errors or a cold start, because
 * those happen outside it. Those are CloudWatch service metrics, and Grafana
 * pulls them in with its CloudWatch integration. Instrument the Lambda and
 * assume the system is covered, and the dashboard is half empty for reasons
 * nobody can see.
 *
 * ## Why the alarms are CloudWatch and not Grafana
 *
 * The plan for this said alerts would live in Grafana, beside the dashboards.
 * That was wrong in one specific way: **an alert defined in the telemetry
 * pipeline stops working when the telemetry pipeline is what broke**, which is
 * exactly when it is needed. CloudWatch alarms read service metrics that exist
 * whether or not anything is exporting, they are infrastructure-as-code rather
 * than console clicks, and they are checked by CI. Grafana still gets the
 * dashboards; it does not get the pager.
 */

import { Duration, SecretValue } from "aws-cdk-lib";
import {
  Alarm,
  ComparisonOperator,
  Metric,
  TreatMissingData,
  type IMetric,
} from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { Topic } from "aws-cdk-lib/aws-sns";
import { EmailSubscription } from "aws-cdk-lib/aws-sns-subscriptions";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
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
   */
  monthlyBudgetUsd?: number;
};

export class Observability extends Construct {
  /** Alarms publish here; the email subscription is what makes that useful. */
  readonly alarms: Topic;
  /**
   * The Grafana Cloud OTLP credential.
   *
   * Created empty-ish and filled in by hand, because it is not ours to
   * generate. Referenced from the functions by ARN so the value never appears
   * in the template, in `cdk.out`, or in this repository.
   *
   * **What this does not protect against:** anybody who can call
   * `lambda:GetFunctionConfiguration` can still read the resolved value off the
   * function. That is the accepted trade — the alternative is fetching it at
   * every cold start, which costs a round trip on the path that is already the
   * slow one. It is an ingest token: it can write telemetry, not read data.
   */
  readonly grafanaCredential: Secret;

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

    this.grafanaCredential = new Secret(this, "GrafanaOtlp", {
      description:
        "Grafana Cloud OTLP: set otlpEndpoint and otlpAuth by hand, once",
      secretObjectValue: {
        // Placeholders. A deploy must not overwrite a real value, so these are
        // only ever written when the secret is first created.
        otlpEndpoint: SecretValue.unsafePlainText("unset"),
        otlpAuth: SecretValue.unsafePlainText("unset"),
      },
      removalPolicy: settings.dataRemovalPolicy,
    });

    if (props.monthlyBudgetUsd) {
      // A Budget rather than a billing alarm: billing metrics only exist in
      // us-east-1, so an alarm on them cannot live in a stack deployed
      // anywhere else. Budgets are global and have no such problem.
      new CfnBudget(this, "MonthlySpend", {
        budget: {
          budgetName: `poker-${settings.stage}`,
          budgetType: "COST",
          timeUnit: "MONTHLY",
          budgetLimit: { amount: props.monthlyBudgetUsd, unit: "USD" },
        },
        notificationsWithSubscribers: props.alertEmail
          ? [
              {
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
            ]
          : [],
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
    return alarm;
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
