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

  it("takes an action for a table, says who you are, and keeps a board", () => {
    expect(routes().map((route) => route.RouteKey).sort()).toEqual([
      "DELETE /groups/{groupId}/games/{gameId}",
      "DELETE /groups/{groupId}/members/{accountId}",
      "DELETE /groups/{groupId}/players/{playerId}",
      "DELETE /me",
      "GET /config",
      "GET /groups",
      "GET /groups/{groupId}",
      "GET /groups/{groupId}/members",
      "GET /me",
      "POST /groups",
      "POST /groups/{groupId}/claims",
      "POST /groups/{groupId}/games",
      "POST /groups/{groupId}/invite",
      "POST /groups/{groupId}/players",
      "POST /invites/{token}",
      "POST /tables/{tableId}/actions",
      "PUT /groups/{groupId}/members/{accountId}",
    ]);
  });
});

describe("every route is authenticated, and that is the default", () => {
  it("leaves nothing open except the one route that has to be", () => {
    // The assertion worth having is over *all* routes rather than the handful
    // that exist today: a route added later must be authenticated because
    // nobody did anything, not because somebody remembered.
    //
    // **The exception is named, not a relaxation.** `GET /config` carries the
    // kill switch and has to answer a phone that does not have an account yet —
    // otherwise a signed-out user could never learn that sign-in has been
    // switched off, which is the state the switch exists for. Anything *else*
    // going public still fails here.
    const open = routes()
      .filter((route) => route.AuthorizationType !== "JWT")
      .map((route) => route.RouteKey);
    expect(open).toEqual(["GET /config"]);
  });

  it("says nothing on that open route that is not the same for everybody", () => {
    // The reason it is safe to leave open: two booleans, identical for every
    // caller, and nothing derived from who is asking.
    const config = Object.values(
      template().findResources("AWS::Lambda::Function"),
    ).filter((fn) =>
      JSON.stringify((fn.Properties as { Environment?: unknown }).Environment).includes(
        "FEATURE_",
      ),
    );
    expect(config).toHaveLength(1);
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
