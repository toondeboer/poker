import { describe, expect, it } from "vitest";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { PokerStack } from "../lib/pokerStack";
import { settingsFor } from "../lib/stage";

/** The identifiers as `cdk.json` actually declares them. */
const CONTEXT = {
  googleClientId: { prod: "prod-abc.apps.googleusercontent.com", dev: "dev-abc.apps.googleusercontent.com" },
  appleServicesId: {
    prod: "com.toondeboer.pokerkit.signin",
    dev: "com.toondeboer.pokerkit.signin.dev",
  },
  appleTeamId: "T288PUUUC8",
  appleKeyId: "93Z7KLR5HP",
  idpSecretName: { prod: "poker/prod/idp", dev: "poker/dev/idp" },
};

const configured = (stage: "dev" | "prod" = "prod") =>
  Template.fromStack(
    new PokerStack(new App({ context: CONTEXT }), "Social" + stage, {
      settings: settingsFor(stage),
    }),
  );

const bare = () =>
  Template.fromStack(
    new PokerStack(new App(), "NoSocial", { settings: settingsFor("prod") }),
  );

describe("signing in with Apple and Google", () => {
  it("is absent unless the credentials are configured", () => {
    // `cdk synth` and the tests have to work with no credentials at all, the
    // same way the API domain and the mail identity do.
    bare().resourceCountIs("AWS::Cognito::UserPoolIdentityProvider", 0);
  });

  it("uses the built-in provider types, not a generic OIDC one", () => {
    // **A generic OIDC provider works and bills every user on the 50-MAU
    // federated tier** instead of the 10,000-MAU one that includes social
    // providers. It looks identical on the login screen, and nothing on the
    // bill catches it until it is already wrong.
    const providers = Object.values(
      configured().findResources("AWS::Cognito::UserPoolIdentityProvider"),
    ).map((p) => (p.Properties as { ProviderType: string }).ProviderType);
    expect(providers.sort()).toEqual(["Google", "SignInWithApple"]);
    expect(providers).not.toContain("OIDC");
  });

  it("maps email_verified, without which nothing ever links", () => {
    // **Cognito only passes a federated attribute to a trigger if it is
    // mapped.** Unmapped, `email_verified` is absent from the PreSignUp event —
    // and the linking trigger correctly reads absent as unverified and
    // declines. The result is the silent duplicate account the trigger exists
    // to prevent, with nothing in the logs to say so. Observed on a real Apple
    // sign-in against dev on 2026-09-06.
    const mappings = Object.values(
      configured().findResources("AWS::Cognito::UserPoolIdentityProvider"),
    ).map(
      (p) =>
        (p.Properties as { AttributeMapping?: Record<string, string> })
          .AttributeMapping ?? {},
    );
    expect(mappings).toHaveLength(2);
    for (const mapping of mappings) {
      expect(mapping.email_verified).toBeDefined();
    }
  });

  it("takes both secrets from Secrets Manager, never the template", () => {
    // Parameter Store cannot do this job: `ssm-secure` is only honoured in a
    // fixed list of resource properties and Cognito is not on it, so the
    // literal `{{resolve:ssm-secure:...}}` would be stored as the key and fail
    // at sign-in rather than at deploy.
    const rendered = JSON.stringify(configured().toJSON());
    expect(rendered).toContain("{{resolve:secretsmanager:poker/prod/idp");
    expect(rendered).toContain("applePrivateKey");
    expect(rendered).toContain("googleClientSecret");
    // The values themselves are never in it.
    expect(rendered).not.toContain("BEGIN PRIVATE KEY");
    expect(rendered).not.toContain("ssm-secure");
  });

  it("gives each stage its own Google client", () => {
    // **Both stages shared one client, and it did not fail quietly.** dev's
    // Cognito sent Google the *prod* client id, whose allowed redirect list has
    // no dev callback — so Google refused with `redirect_uri_mismatch` before
    // sign-in, and the dev secret held prod's client secret to match.
    const clientOf = (t: Template) =>
      Object.values(t.findResources("AWS::Cognito::UserPoolIdentityProvider"))
        .map((p) => p.Properties as { ProviderType: string; ProviderDetails: Record<string, string> })
        .find((p) => p.ProviderType === "Google")?.ProviderDetails.client_id;
    expect(clientOf(configured("prod"))).toBe("prod-abc.apps.googleusercontent.com");
    expect(clientOf(configured("dev"))).toBe("dev-abc.apps.googleusercontent.com");
  });

  it("gives each stage its own Apple Services ID", () => {
    // A dev callback must not be a valid redirect for the production pool.
    const idOf = (t: Template) =>
      Object.values(t.findResources("AWS::Cognito::UserPoolIdentityProvider"))
        .map((p) => p.Properties as { ProviderType: string; ProviderDetails: Record<string, string> })
        .find((p) => p.ProviderType === "SignInWithApple")?.ProviderDetails.client_id;
    expect(idOf(configured("prod"))).toBe("com.toondeboer.pokerkit.signin");
    expect(idOf(configured("dev"))).toBe("com.toondeboer.pokerkit.signin.dev");
  });

  it("replaces CDK's example.com redirect default", () => {
    // **This became live the moment a hosted-UI domain existed.** With no
    // `oAuth` block CDK fills `callbackUrls` with `https://example.com`, which
    // is an authorised place to deliver an authorisation code on a domain
    // nobody here owns.
    const clients = Object.values(
      configured().findResources("AWS::Cognito::UserPoolClient"),
    ).map((c) => c.Properties as { CallbackURLs?: string[] });
    for (const client of clients) {
      expect(client.CallbackURLs ?? []).not.toContain("https://example.com");
    }
    configured().hasResourceProperties("AWS::Cognito::UserPoolClient", {
      CallbackURLs: ["pokerkit://auth"],
    });
  });

  it("allows only the authorisation-code flow", () => {
    // The implicit flow puts tokens in a URL fragment, where they reach browser
    // history and every handler on the way back.
    configured().hasResourceProperties("AWS::Cognito::UserPoolClient", {
      AllowedOAuthFlows: ["code"],
    });
  });

  it("keeps email and password alongside the providers", () => {
    // Everybody who has an account today signs in that way; dropping it would
    // sign all of them out.
    configured().hasResourceProperties("AWS::Cognito::UserPoolClient", {
      SupportedIdentityProviders: Match.arrayWith(["COGNITO"]),
    });
  });

  it("is all-or-nothing when the configuration is half filled", () => {
    // App Store guideline 4.8 requires Sign in with Apple wherever another
    // third-party provider is offered, so Google-without-Apple is a build that
    // cannot ship on iOS. Absent buttons are recoverable; a rejected build is
    // a week.
    const half = Template.fromStack(
      new PokerStack(
        new App({ context: { googleClientId: "123-abc.apps.googleusercontent.com" } }),
        "HalfSocial",
        { settings: settingsFor("prod") },
      ),
    );
    half.resourceCountIs("AWS::Cognito::UserPoolIdentityProvider", 0);
  });
});
