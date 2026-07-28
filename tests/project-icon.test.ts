import { describe, expect, it } from "vitest";
import {
  isAllowedProjectIconUrl,
  normalizeProjectIconValue,
  resolveProjectIcon,
} from "../app/lib/project-icon";

describe("project icon choices", () => {
  it("keeps random icons stable for the same project", () => {
    const input = {
      id: "fixed-project",
      iconMode: "random",
      iconShape: "random",
    };
    expect(resolveProjectIcon(input)).toEqual(resolveProjectIcon(input));
    expect(resolveProjectIcon(input).shape).not.toBe("random");
  });

  it("honors preset glyphs and explicit frames", () => {
    expect(
      resolveProjectIcon({
        id: "radio",
        iconMode: "preset",
        iconValue: "heart",
        iconShape: "circle",
      }),
    ).toMatchObject({ glyph: "♡", shape: "circle" });
  });

  it("limits custom text by unicode characters", () => {
    expect(normalizeProjectIconValue("custom", "喵ฅABC猫猫")).toBe("喵ฅABC猫");
  });

  it("accepts only local or HTTP(S) icon images", () => {
    expect(isAllowedProjectIconUrl("/media/icon.webp")).toBe(true);
    expect(isAllowedProjectIconUrl("https://example.com/icon.png")).toBe(true);
    expect(isAllowedProjectIconUrl("//example.com/icon.png")).toBe(false);
    expect(isAllowedProjectIconUrl("javascript:alert(1)")).toBe(false);
  });
});
