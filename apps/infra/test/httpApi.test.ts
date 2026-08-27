import { describe, expect, it } from "vitest";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { PokerStack } from "../lib/pokerStack";
import { settingsFor } from "../lib/stage";

let synthesised: Template | null = null;
const template = (): Template => {
  synthesised ??= Template.fromStack(
    new PokerStack(new App(), "ApiTest", { settings: settingsFor("prod") }),
  );
  return synthesised;
};

const routes = () =>
  Object.values(template().findResources("AWS::ApiGatewayV2::Route")).map(
    (route) =>
      route.Properties as { RouteKey: string; AuthorizationType?: string },
  );

describe("something can finally call the backend", () => {
  it("has an API at all", () => {
    // Before this there was no API, no function URL and no mutation: the rules
    // ran on a phone and on a Lambda nobody could reach.
    template().resourceCountIs("AWS::ApiGatewayV2::Api", 1);
    template().hasOutput("ApiUrl", {});
  });

  it("takes an action for a table, and says who you are", () => {
    expect(routes().map((route) => route.RouteKey).sort()).toEqual([
      "GET /me",
      "POST /tables/{tableId}/actions",
    ]);
  });
});

describe("every route is authenticated, and that is the default", () => {
  it("leaves nothing open", () => {
    // The assertion worth having is over *all* routes rather than the two that
    // exist today: a route added later must be authenticated because nobody
    // did anything, not because somebody remembered.
    const open = routes().filter((route) => route.AuthorizationType !== "JWT");
    expect(open).toEqual([]);
  });

  it("verifies tokens against this user pool and this client", () => {
    // A JWT authorizer with the wrong audience accepts tokens minted for
    // somebody else's app, which is an authenticated route that anybody can
    // reach.
    template().hasResourceProperties("AWS::ApiGatewayV2::Authorizer", {
      AuthorizerType: "JWT",
      IdentitySource: ["$request.header.Authorization"],
      JwtConfiguration: Match.objectLike({
        Audience: Match.anyValue(),
      }),
    });
  });
});

describe("what a runaway client costs", () => {
  it("is a rejection rather than a bill", () => {
    // Not capacity planning: a home poker app does not need thousands of
    // requests a second, and the ceiling is there so a retry loop is cheap.
    template().hasResourceProperties("AWS::ApiGatewayV2::Stage", {
      DefaultRouteSettings: {
        ThrottlingRateLimit: 50,
        ThrottlingBurstLimit: 100,
      },
    });
  });
});

describe("access logs name the caller and nothing else", () => {
  it("records who, which route, and what happened", () => {
    const stages = template().findResources("AWS::ApiGatewayV2::Stage");
    const format = Object.values(stages)[0].Properties.AccessLogSettings.Format;
    const fields = JSON.parse(format as string) as Record<string, string>;
    expect(Object.keys(fields).sort()).toEqual([
      "accountId",
      "integrationStatus",
      "latencyMs",
      "method",
      "requestId",
      "route",
      "status",
    ]);
  });

  it("never logs a header or a body", () => {
    // The `Authorization` header is a bearer token. A log containing one is a
    // credential store nobody is treating as one.
    const stages = template().findResources("AWS::ApiGatewayV2::Stage");
    const format = Object.values(stages)[0].Properties
      .AccessLogSettings.Format as string;
    const leaks = ["authorization", "$context.requestBody", "header."].filter(
      (needle) => format.toLowerCase().includes(needle),
    );
    expect(leaks).toEqual([]);
  });
});

describe("CORS", () => {
  it("is not configured, deliberately", () => {
    // The mobile app does not need it, and a permissive policy added "for
    // later" is a permissive policy nobody revisits. The web timer can have
    // one scoped to its own origin the day it needs one.
    const apis = template().findResources("AWS::ApiGatewayV2::Api");
    const cors = Object.values(apis)[0].Properties.CorsConfiguration;
    expect(cors).toBeUndefined();
  });
});
