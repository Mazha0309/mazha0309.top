import { describe, expect, it } from "vitest";
import {
  defaultSiteCustomization,
  isAllowedDisplayUrl,
  isAllowedImageUrl,
  normalizeSiteCustomization,
} from "../app/lib/site-customization";

describe("site customization", () => {
  it("hydrates legacy empty JSON with current defaults", () => {
    expect(normalizeSiteCustomization({})).toEqual(defaultSiteCustomization);
  });

  it("preserves explicit module switches and validates the accent", () => {
    const customization = normalizeSiteCustomization({
      siteTitle: "我的小站",
      accentColor: "mint",
      showBlog: false,
      brandMark: "喵喵喵",
    });

    expect(customization.siteTitle).toBe("我的小站");
    expect(customization.accentColor).toBe("mint");
    expect(customization.showBlog).toBe(false);
    expect(customization.brandMark).toBe("喵喵");
    expect(customization.showProjects).toBe(true);
  });

  it("falls back from unknown accents", () => {
    expect(normalizeSiteCustomization({ accentColor: "neon" }).accentColor).toBe("pink");
  });

  it("keeps a valid launch time and repairs invalid legacy values", () => {
    expect(
      normalizeSiteCustomization({
        siteLaunchedAt: "2026-07-29T00:00:00+08:00",
      }).siteLaunchedAt,
    ).toBe("2026-07-28T16:00:00.000Z");
    expect(
      normalizeSiteCustomization({ siteLaunchedAt: "sometime maybe" })
        .siteLaunchedAt,
    ).toBe(defaultSiteCustomization.siteLaunchedAt);
  });

  it("hydrates the favicon for older saved customization", () => {
    expect(normalizeSiteCustomization({}).faviconUrl).toBe("/favicon.svg");
    expect(
      normalizeSiteCustomization({ faviconUrl: "/media/site/icon.png" })
        .faviconUrl,
    ).toBe("/media/site/icon.png");
  });
});

describe("profile image URL validation", () => {
  it.each([
    ["/media/avatar/display.webp", true],
    ["https://avatars.example/avatar.png", true],
    ["http://localhost/avatar.webp", true],
    ["", true],
    ["//evil.example/avatar.png", false],
    ["mailto:avatar@example.com", false],
    ["data:image/svg+xml,bad", false],
    ["javascript:alert(1)", false],
  ])("validates %s", (value, expected) => {
    expect(isAllowedImageUrl(value)).toBe(expected);
  });
});

describe("display URL validation", () => {
  it.each([
    ["/blog", true],
    ["https://example.com/path", true],
    ["mailto:hello@example.com", true],
    ["", true],
    ["//evil.example", false],
    ["/admin\\evil", false],
    ["javascript:alert(1)", false],
    ["not a url", false],
  ])("validates %s", (value, expected) => {
    expect(isAllowedDisplayUrl(value)).toBe(expected);
  });
});
