import { describe, expect, it } from "vitest";
import {
  estimateReadingMinutes,
  isSafeInternalPath,
  mdxToText,
  slugify,
  splitTags,
} from "../app/lib/content-utils";

describe("content utilities", () => {
  it("creates stable unicode slugs", () => {
    expect(slugify("  你好，Docker 世界！ ")).toBe("你好-docker-世界");
    expect(slugify("RelayQR: v2")).toBe("relayqr-v2");
  });

  it("deduplicates and trims tags", () => {
    expect(splitTags("Docker, 自托管，Docker,  猫 ")).toEqual([
      "Docker",
      "自托管",
      "猫",
    ]);
  });

  it("produces searchable plain text from MDX", () => {
    expect(
      mdxToText("## 标题\n\n[链接](https://example.com) 与 `code`。\n\n<Note>纸条</Note>"),
    ).toBe("标题 链接 与 code。 纸条");
  });

  it("estimates at least one minute", () => {
    expect(estimateReadingMinutes("很短。")).toBe(1);
  });

  it("accepts only local redirect targets", () => {
    expect(isSafeInternalPath("/admin/posts")).toBe(true);
    expect(isSafeInternalPath("//evil.example")).toBe(false);
    expect(isSafeInternalPath("https://evil.example")).toBe(false);
    expect(isSafeInternalPath("/admin\\evil")).toBe(false);
  });
});
