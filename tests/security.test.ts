import { afterEach, describe, expect, it } from "vitest";
import { requireSameOrigin } from "../app/lib/security.server";

const originalAppOrigin = process.env.APP_ORIGIN;

afterEach(() => {
  if (originalAppOrigin === undefined) {
    delete process.env.APP_ORIGIN;
  } else {
    process.env.APP_ORIGIN = originalAppOrigin;
  }
});

function rejectedStatus(request: Request) {
  try {
    requireSameOrigin(request);
    return null;
  } catch (error) {
    return error instanceof Response ? error.status : -1;
  }
}

describe("same-origin mutation guard", () => {
  it("accepts the canonical public origin behind an internal HTTP proxy", () => {
    process.env.APP_ORIGIN = "https://mazha0309.com";
    const request = new Request("http://mazha0309.com/admin/projects", {
      method: "POST",
      headers: { origin: "https://mazha0309.com" },
    });

    expect(() => requireSameOrigin(request)).not.toThrow();
  });

  it("still rejects a foreign origin", () => {
    process.env.APP_ORIGIN = "https://mazha0309.com";
    const request = new Request("http://mazha0309.com/admin/projects", {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    });

    expect(rejectedStatus(request)).toBe(403);
  });

  it("falls back to Request.url when APP_ORIGIN is absent", () => {
    delete process.env.APP_ORIGIN;
    const request = new Request("http://localhost:5173/admin/projects", {
      method: "POST",
      headers: { origin: "http://localhost:5173/" },
    });

    expect(() => requireSameOrigin(request)).not.toThrow();
  });

  it("fails closed when APP_ORIGIN is malformed", () => {
    process.env.APP_ORIGIN = "not a public URL";
    const request = new Request("http://localhost:5173/admin/projects", {
      method: "POST",
      headers: { origin: "http://localhost:5173" },
    });

    expect(rejectedStatus(request)).toBe(500);
  });
});
