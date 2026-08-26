#!/usr/bin/env node
/**
 * CDK entry point.
 *
 * Environment-agnostic on purpose: the stack contains no account or region
 * lookups, so `cdk synth` and the tests run with no AWS credentials at all —
 * which is what lets CI check the whole thing without anybody holding a key.
 */
import { App } from "aws-cdk-lib";
import { PokerStack } from "../lib/pokerStack";

const app = new App();

new PokerStack(app, "PokerBackend", {
  description: "Accounts, groups and the multiplayer table for Poker Blinds Buzzer",
});
