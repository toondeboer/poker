import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  isValidEmail,
  validateCredentials,
} from "./account";

describe("isValidEmail", () => {
  it("accepts ordinary addresses", () => {
    const accepted = [
      "a@b.co",
      "poker.blinds.buzzer@gmail.com",
      "someone+tag@example.co.uk",
      "UPPER@EXAMPLE.COM",
      "  spaced@example.com  ",
    ];
    expect(accepted.filter((e) => !isValidEmail(e))).toEqual([]);
  });

  it("accepts addresses a stricter pattern would wrongly reject", () => {
    // The only test that matters is whether a verification message arrives,
    // and no pattern decides that. Tightening this only ever rejects
    // somebody's genuine, unusual address.
    const accepted = [
      "o'brien@example.com",
      "a_very-long.name@sub.domain.example.museum",
      "1@2.3",
    ];
    expect(accepted.filter((e) => !isValidEmail(e))).toEqual([]);
  });

  it("rejects what is obviously not an address", () => {
    const rejected = [
      "",
      "   ",
      "nobody",
      "@example.com",
      "someone@",
      "someone@example",
      "someone@.com",
      "someone@example.",
      "two@at@example.com",
      "has space@example.com",
      "someone@exam ple.com",
    ];
    expect(rejected.filter(isValidEmail)).toEqual([]);
  });
});

describe("validateCredentials", () => {
  it("passes a usable pair", () => {
    expect(validateCredentials("a@b.co", "correcthorse")).toBeNull();
  });

  it("says which thing is wrong, so the form can point at it", () => {
    expect(validateCredentials("  ", "correcthorse")).toBe("email-empty");
    expect(validateCredentials("nobody", "correcthorse")).toBe(
      "email-malformed",
    );
    expect(validateCredentials("a@b.co", "short")).toBe("password-too-short");
  });

  it("checks the email before the password", () => {
    // Both wrong: the email is the one the user is looking at first.
    expect(validateCredentials("nobody", "x")).toBe("email-malformed");
  });

  it("does not apply the sign-up length rule to a sign-in", () => {
    // Somebody whose existing password is eight characters would otherwise be
    // refused locally, told it is too short, and never have a request made —
    // locked out of their own account by a policy that governs new passwords.
    expect(
      validateCredentials("a@b.co", "8charact", {
        requireStrongPassword: false,
      }),
    ).toBeNull();
    expect(validateCredentials("a@b.co", "8charact")).toBe(
      "password-too-short",
    );
  });

  it("still needs some password, even signing in", () => {
    expect(
      validateCredentials("a@b.co", "", { requireStrongPassword: false }),
    ).toBe("password-too-short");
  });

  it("accepts a password of exactly the minimum", () => {
    expect(
      validateCredentials("a@b.co", "x".repeat(MIN_PASSWORD_LENGTH)),
    ).toBeNull();
    expect(
      validateCredentials("a@b.co", "x".repeat(MIN_PASSWORD_LENGTH - 1)),
    ).toBe("password-too-short");
  });
});
