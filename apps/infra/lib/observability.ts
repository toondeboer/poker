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

import { Duration } from "aws-cdk-lib";
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
import { Secret, type ISecret } from "aws-cdk-lib/aws-secretsmanager";
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
  /** Where the Grafana OTLP credential lives. Created by hand; never by CDK. */
  grafanaSecretName?: string;
};

/** The name the README tells you to create. */
export const DEFAULT_GRAFANA_SECRET = "poker/grafana-otlp";

export class Observability extends Construct {
  /** Alarms publish here; the email subscription is what makes that useful. */
  readonly alarms: Topic;
  /**
   * The Grafana Cloud OTLP credential, **imported and never created**.
   *
   * Deliberately not a CDK-managed secret. One that CDK owns has a value in the
   * template, and a later change to any of its properties rewrites that value
   * over whatever was set by hand — silently killing telemetry at the exact
   * moment somebody was deploying something else. Importing by name means CDK
   * can read the ARN and grant access to it, and can never write to it.
   *
   * Create it once, before turning telemetry on:
   *
   * ```
   * aws secretsmanager create-secret --name poker/grafana-otlp --secret-string \
   *   '{"otlpEndpoint":"https://otlp-gateway-prod-<zone>.grafana.net/otlp","otlpAuth":"Basic <base64>"}'
   * ```
   *
   * **What this does not protect against:** anybody who can call
   * `lambda:GetFunctionConfiguration` can read the resolved value off the
   * function. That is the accepted trade — the alternative is fetching it at
   * every cold start, on the path that is already the slow one. It is an
   * ingest token: it can write telemetry, not read data.
   */
  readonly grafanaCredential: ISecret;

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

    this.grafanaCredential = Secret.fromSecretNameV2(
      this,
      "GrafanaOtlp",
      props.grafanaSecretName ?? DEFAULT_GRAFANA_SECRET,
    );

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
