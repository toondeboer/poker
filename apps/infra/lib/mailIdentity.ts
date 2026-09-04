/**
 * Where confirmation emails come from.
 *
 * **Cognito's built-in sender cannot go to production**, and not as a matter of
 * taste: it is capped around 50 messages a day and its mail is widely junked —
 * observed here, with the smoke-test codes landing in spam every time. An app
 * whose sign-up depends on a code arriving cannot ship on it.
 *
 * SES fixes that by sending mail the receiver can *prove* is ours: the DKIM
 * records below are published in our own hosted zone, so a signature over the
 * message verifies against a key only this domain could have put there. That is
 * the whole reason a domain is needed. Sending from a free mailbox provider is
 * not an option regardless of intent — mail claiming to be `@gmail.com` from
 * Amazon's servers aligns with neither its SPF nor its DKIM, and every large
 * receiver treats that as spoofing.
 *
 * **No mailbox is involved.** `noreply@` never receives anything; it is a
 * `From` header. Nothing needs buying beyond the domain itself, which is why
 * this costs nothing here: the zone is already in Route 53, in this account.
 *
 * ## It takes two deploys, and that is not avoidable
 *
 * **Cognito checks the identity when it is updated, and verification is
 * asynchronous.** CloudFormation creates the identity and updates the pool in
 * parallel, so the pool is told to use an identity SES has not yet read the DKIM
 * records back for, and the whole stack rolls back with *"Email address is not
 * verified"*. No dependency between the resources fixes it: the wait is on SES,
 * not on a resource existing.
 *
 * So it is explicit. The first deploy creates the identity and its records; SES
 * verifies in its own time; a second deploy with `-c mailVerified=true` moves
 * the pool onto it. `aws sesv2 get-email-identity --email-identity <domain>`
 * says when that is true.
 *
 * ## Two things this deliberately does not do
 *
 * It does not leave the SES **sandbox**, which is a support request rather than
 * a resource — until it is granted, SES will only deliver to addresses that
 * have themselves been verified. Fine for the smoke accounts, useless for real
 * users, and it has a queue, so it wants requesting early.
 *
 * It also does not publish SPF or DMARC, or set a custom MAIL FROM. DKIM
 * alignment alone satisfies DMARC, and a `p=` policy on a domain that has never
 * sent mail is a good way to have your own future mail quarantined by a rule
 * you forgot you wrote.
 */

import { EmailIdentity, Identity } from "aws-cdk-lib/aws-ses";
import { CnameRecord, PublicHostedZone } from "aws-cdk-lib/aws-route53";
import { UserPoolEmail } from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";
import type { Stage } from "./stage";

/**
 * The sending domain for a stage.
 *
 * **Separate subdomains, because reputation is per-domain.** A dev stack sending
 * test mail to throwaway inboxes must not be able to spend the deliverability
 * that production's sign-up depends on.
 *
 * A subdomain rather than the root, too: it keeps this sender's reputation
 * apart from anything the root domain is used for later, and leaves the root
 * free for actual mailboxes.
 */
export const mailDomainFor = (stage: Stage, base: string): string =>
  stage === "prod" ? `poker.${base}` : `poker-dev.${base}`;

export type Mail = {
  /**
   * `undefined` until the identity has actually verified — see `mailFor`. The
   * pool keeps Cognito's own sender in the meantime.
   */
  email?: UserPoolEmail;
  domain: string;
};

/**
 * SES-backed email for the user pool, or Cognito's own sender.
 *
 * Opt-in through the same context the API domain uses, for the same reason:
 * `cdk synth` and the tests have to work with no credentials, and a hosted zone
 * that is not ours would fail at deploy time rather than here. Without the
 * flags the pool sends exactly as it did — badly, but harmlessly, since a dev
 * stack's mail only ever goes to accounts we made.
 */
export const mailFor = (scope: Construct, stage: Stage): Mail | undefined => {
  const base = scope.node.tryGetContext("mailDomain") as string | undefined;
  const hostedZoneId = scope.node.tryGetContext("hostedZoneId") as string | undefined;
  const zoneName = scope.node.tryGetContext("hostedZoneName") as string | undefined;
  /**
   * **A real region, not a token.** `UserPoolEmail.withSES` refuses to
   * synthesise against an environment-agnostic stack — it cannot work out which
   * SES to point at — and throwing there would break the credential-free synth
   * that CI depends on. Named rather than read off the stack for the same
   * reason the hosted zone is.
   */
  const region =
    (scope.node.tryGetContext("region") as string | undefined) ??
    /**
     * **The environment too, because that is the documented way to deploy.**
     * `bin/app.ts` names `CDK_DEFAULT_REGION` as the normal path and `-c
     * region=` as the override, so requiring the context flag here meant the
     * ordinary `npm run deploy` — and the documented `-c mailVerified=true`
     * follow-up, if it omitted the region — silently dropped the SES identity
     * and its DKIM records and put the pool back on Cognito's sender. Silently:
     * the identity is only created when all four are present, so there is no
     * error, just mail that starts going to spam again.
     */
    process.env.CDK_DEFAULT_REGION;
  if (!base || !hostedZoneId || !zoneName || !region) return undefined;

  const domain = mailDomainFor(stage, base);
  const zone = PublicHostedZone.fromPublicHostedZoneAttributes(scope, "MailZone", {
    hostedZoneId,
    zoneName,
  });

  /**
   * **The subdomain is the identity, not the zone it lives in.**
   *
   * `Identity.publicHostedZone(zone)` would verify `toondeboer.com` itself and
   * write the DKIM records for free — and SES would happily send from a
   * subdomain of a verified domain. But Cognito's `withSES` requires the
   * `fromEmail` domain and the verified domain to match exactly, so verifying
   * the root would force the address back to `noreply@toondeboer.com` and lose
   * the "poker" that makes the message recognisable before it is opened.
   *
   * So the identity is the subdomain, and its three DKIM `CNAME`s go into the
   * zone here rather than being created for us. Same outcome, one construct
   * more.
   */
  /**
   * **No custom MAIL FROM.** SES requires one to be a *strict* subdomain of the
   * identity, so naming the identity itself is rejected outright — and it buys
   * nothing here. A custom MAIL FROM exists to align SPF with the sending
   * domain; DMARC passes on *either* SPF or DKIM alignment, and the DKIM below
   * gives us that. Adding one would mean an extra MX and TXT record to keep
   * correct for a second guarantee we do not need.
   */
  const identity = new EmailIdentity(scope, "MailIdentity", {
    identity: Identity.domain(domain),
  });

  /**
   * Verification is asynchronous: the deploy finishes as soon as the records
   * exist, and SES reads them back in its own time. A send attempted in that
   * window fails, which looks like a broken sender and is not one.
   */
  identity.dkimRecords.forEach((record, index) => {
    new CnameRecord(scope, `MailDkim${index}`, {
      zone,
      /**
       * **The trailing dot is load-bearing.** SES hands these names back as
       * CloudFormation tokens, so CDK's "does this already end with the zone
       * name?" check cannot see inside them and appends the zone a second
       * time — the records land at
       * `…._domainkey.poker-dev.toondeboer.com.toondeboer.com`, SES never finds
       * them, and the identity sits at `PENDING` forever with nothing obviously
       * wrong. A name ending in `.` is treated as already fully qualified.
       */
      recordName: `${record.name}.`,
      domainName: record.value,
    });
  });

  /**
   * **Only once somebody has confirmed SES verified it.** Named rather than
   * looked up, because a lookup needs credentials and this has to synthesise
   * without them — and because it should be a deliberate second step, not
   * something that flips under a deploy that was about something else.
   */
  /**
   * **Both spellings, because `-c` only ever gives a string.** Checking for the
   * boolean alone meant `-c mailVerified=true` on the command line did nothing
   * at all and the deploy reported "no changes" — while a test setting it as a
   * boolean in `App` context passed happily. The flag could not be set the one
   * way anybody would set it.
   */
  const verified = scope.node.tryGetContext("mailVerified");
  if (verified !== true && verified !== "true") return { domain };

  return {
    domain,
    email: UserPoolEmail.withSES({
      // **The display name is what people actually read**, and it says the
      // product rather than the domain. The address carries "poker" so the
      // message is recognisable before it is opened.
      fromEmail: `noreply@${domain}`,
      fromName: "Poker Blinds Timer",
      // The subdomain we verified above — Cognito insists this matches the
      // `fromEmail` domain exactly.
      sesVerifiedDomain: domain,
      sesRegion: region,
    }),
  };
};
