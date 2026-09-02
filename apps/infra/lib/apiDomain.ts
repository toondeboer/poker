/**
 * A name for the API that we own rather than one AWS generated.
 *
 * **This exists for durability, not for looks.** The generated host —
 * `https://<id>.execute-api.<region>.amazonaws.com` — is baked into every
 * shipped binary, and `<id>` belongs to the API Gateway resource. Recreate the
 * stack and that id changes, which **permanently breaks every copy of the app
 * already installed**, with no way to point them anywhere else. There is no
 * retroactive fix: a phone that has the old host has no channel through which
 * to be told the new one.
 *
 * It costs nothing to add now and cannot be added later for anybody who has
 * already installed. That asymmetry is the whole argument.
 *
 * ## Why it is opt-in
 *
 * `cdk synth` and the tests have to work with no AWS credentials at all — see
 * `bin/app.ts`, it is what lets CI check the template on every pull request.
 * So the hosted zone is named by context rather than looked up: a lookup needs
 * credentials, and `HostedZone.fromHostedZoneAttributes` needs nothing.
 *
 * Without the context flags the API is exactly what it was, which also means a
 * fork of this repo pointing at somebody else's account still synthesises.
 */

import { Certificate, CertificateValidation } from "aws-cdk-lib/aws-certificatemanager";
import { DomainName, IpAddressType } from "aws-cdk-lib/aws-apigatewayv2";
import { ARecord, AaaaRecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { ApiGatewayv2DomainProperties } from "aws-cdk-lib/aws-route53-targets";
import { Construct } from "constructs";
import type { Stage } from "./stage";

export type ApiDomain = { domainName: DomainName; hostName: string };

/**
 * The host for a stage: the configured name, with `-dev` spliced into the first
 * label for the dev stack.
 *
 * **`apiDomain` must not sit under the website's name, and this is not a
 * preference.** The site is served from Vercel, and Vercel publishes CAA
 * records on the name it manages that authorise Let's Encrypt, Google,
 * GlobalSign and Sectigo — **and not Amazon**. CAA is inherited by every name
 * beneath it, so ACM cannot issue a certificate for anything under
 * `poker-timer.<domain>` at all. It fails in about two minutes with
 * `Certificate validation failed with status: FAILED`, which reads exactly like
 * a DNS propagation problem and is nothing of the sort — no amount of waiting
 * or retrying fixes it.
 *
 * A name beside the site rather than beneath it inherits only the apex, which
 * has no CAA. Putting the API on the *same* host as the site was never viable
 * anyway: it would route every API call through Vercel to reach AWS, adding a
 * second thing to be down and a rewrite rule to keep in step with the routes.
 *
 * The stages are separated because a dev stack exists to be thrown away, and
 * one answering on the production host would take production with it.
 */
export const hostNameFor = (stage: Stage, apiHost: string): string => {
  if (stage === "prod") return apiHost;
  const dot = apiHost.indexOf(".");
  return dot === -1 ? `${apiHost}-dev` : `${apiHost.slice(0, dot)}-dev${apiHost.slice(dot)}`;
};

export const domainFor = (scope: Construct, stage: Stage): ApiDomain | undefined => {
  // The **production** host, in full. Dev derives from it — see `hostNameFor`.
  const base = scope.node.tryGetContext("apiDomain") as string | undefined;
  const hostedZoneId = scope.node.tryGetContext("hostedZoneId") as string | undefined;
  const zoneName = scope.node.tryGetContext("hostedZoneName") as string | undefined;
  // All three or none. Two of them is a half-configured domain that fails at
  // deploy time with something unhelpful about a missing zone.
  if (!base || !hostedZoneId || !zoneName) return undefined;

  const hostName = hostNameFor(stage, base);
  const zone = HostedZone.fromHostedZoneAttributes(scope, "Zone", {
    hostedZoneId,
    zoneName,
  });

  const certificate = new Certificate(scope, "ApiCertificate", {
    domainName: hostName,
    // **DNS, not email.** Email validation needs somebody to click a link every
    // time, including on renewal; DNS validation renews itself for as long as
    // the record stands, which for an API nobody watches is the only kind that
    // can be relied on.
    validation: CertificateValidation.fromDns(zone),
  });

  const domainName = new DomainName(scope, "ApiDomain", {
    domainName: hostName,
    certificate,
    /**
     * **Dual-stack, or the AAAA record below is decoration.**
     *
     * An API Gateway custom domain is IPv4-only unless told otherwise, and an
     * alias record can only answer with what its target has — so the AAAA
     * resolved to nothing at all until this was set. A phone on an IPv6-only
     * mobile network (several carriers are, with NAT64 doing the translating)
     * would have been relying on that translation rather than reaching us
     * directly, and where NAT64 is missing it simply could not connect.
     */
    ipAddressType: IpAddressType.DUAL_STACK,
  });

  const target = RecordTarget.fromAlias(
    new ApiGatewayv2DomainProperties(
      domainName.regionalDomainName,
      domainName.regionalHostedZoneId,
    ),
  );
  new ARecord(scope, "ApiAliasV4", { zone, recordName: hostName, target });
  // **IPv6 as well.** A mobile network on IPv6-only — which several are — cannot
  // reach an A record at all, and the failure looks like "the app doesn't work
  // on my phone" rather than anything to do with DNS.
  new AaaaRecord(scope, "ApiAliasV6", { zone, recordName: hostName, target });

  return { domainName, hostName };
};
