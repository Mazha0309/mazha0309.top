import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectIconMark } from "../app/components/project-icon-mark";
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
    const icon = resolveProjectIcon({
      id: "radio",
      iconMode: "preset",
      iconValue: "heart",
      iconShape: "circle",
    });
    expect(icon).toMatchObject({ glyph: "♡", shape: "circle" });
    expect(icon.variant).toBeGreaterThanOrEqual(0);
    expect(icon.variant).toBeLessThan(4);
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

  it("renders complete organic SVG frames instead of clipped CSS polygons", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectIconMark, {
        project: {
          id: "soft-ticket",
          iconMode: "preset",
          iconValue: "spark",
          iconShape: "ticket",
        },
      }),
    );
    expect(html).toContain("<svg");
    expect(html).toContain("project-card__symbol-outline");
    expect(html).toContain("project-card__symbol-scratch");
    expect(html).not.toContain("<img");
  });
});
