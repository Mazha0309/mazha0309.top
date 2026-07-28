import { describe, expect, it } from "vitest";
import {
  defaultSiteCustomization,
  isAllowedDisplayUrl,
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
