import { afterEach, describe, expect, it } from "vitest";
import {
  decryptStoredSecret,
  encryptStoredSecret,
} from "../app/lib/secret-storage.server";

const originalSecret = process.env.BETTER_AUTH_SECRET;

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.BETTER_AUTH_SECRET;
  } else {
    process.env.BETTER_AUTH_SECRET = originalSecret;
  }
});

describe("encrypted admin secret storage", () => {
  it("round-trips without embedding the plaintext", () => {
    process.env.BETTER_AUTH_SECRET = "test-auth-secret-with-enough-entropy";
    const plaintext = "provider-admin-only-test-value";
    const encrypted = encryptStoredSecret(plaintext);

    expect(encrypted).toMatch(/^v1\./u);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptStoredSecret(encrypted)).toBe(plaintext);
  });

  it("rejects tampering and a changed encryption secret", () => {
    process.env.BETTER_AUTH_SECRET = "first-test-auth-secret";
    const encrypted = encryptStoredSecret("provider-secret");
    const tampered = `${encrypted.slice(0, -1)}${
      encrypted.endsWith("A") ? "B" : "A"
    }`;

    expect(() => decryptStoredSecret(tampered)).toThrow();
    process.env.BETTER_AUTH_SECRET = "different-test-auth-secret";
    expect(() => decryptStoredSecret(encrypted)).toThrow();
  });
});
