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
 * ## Two things this deliberately does not do
 *
 * It does not leave the SES **sandbox**, which is a support request rather than
 * a resource — until it is granted, SES will only deliver to addresses that
 * have themselves been verified. Fine for the smoke accounts, useless for real
 * users, and it has a queue, so it wants requesting early.
 *
 * It also does not publish SPF or DMARC. DKIM alignment alone satisfies DMARC,
 * and a `p=` policy on a domain that has never sent mail is a good way to have
 * your own future mail quarantined by a rule you forgot you wrote.
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

export type Mail = { email: UserPoolEmail; domain: string };

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
  const region = scope.node.tryGetContext("region") as string | undefined;
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
  const identity = new EmailIdentity(scope, "MailIdentity", {
    identity: Identity.domain(domain),
    mailFromDomain: domain,
  });

  /**
   * Verification is asynchronous: the deploy finishes as soon as the records
   * exist, and SES reads them back in its own time. A send attempted in that
   * window fails, which looks like a broken sender and is not one.
   */
  identity.dkimRecords.forEach((record, index) => {
    new CnameRecord(scope, `MailDkim${index}`, {
      zone,
      recordName: record.name,
      domainName: record.value,
    });
  });

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
