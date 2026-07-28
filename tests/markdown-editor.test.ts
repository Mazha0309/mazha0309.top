import { describe, expect, it } from "vitest";
import {
  createMarkdownEdit,
  createMarkdownImageEdit,
  getActiveMarkdownFormats,
} from "../app/lib/markdown-editor";

function apply(
  source: string,
  from: number,
  to: number,
  format: Parameters<typeof createMarkdownEdit>[2],
) {
  const edit = createMarkdownEdit(source, { from, to }, format);
  return `${source.slice(0, edit.from)}${edit.insert}${source.slice(edit.to)}`;
}

describe("Markdown editor commands", () => {
  it("wraps a selected phrase without losing it", () => {
    expect(apply("一段文字", 2, 4, "bold")).toBe("一段**文字**");
    expect(apply("code", 0, 4, "inline-code")).toBe("`code`");
  });

  it("turns selected lines into headings and lists", () => {
    expect(apply("标题", 0, 2, "heading-2")).toBe("## 标题");
    expect(apply("苹果\n梨", 0, 4, "ordered-list")).toBe("1. 苹果\n2. 梨");
    expect(apply("苹果\n梨", 0, 4, "task-list")).toBe(
      "- [ ] 苹果\n- [ ] 梨",
    );
  });

  it("replaces an existing heading level", () => {
    expect(apply("### 旧标题", 0, 6, "heading-1")).toBe("# 旧标题");
  });

  it("creates useful link and image placeholders", () => {
    expect(apply("官网", 0, 2, "link")).toBe("[官网](https://)");
    expect(apply("", 0, 0, "image")).toBe("![图片描述](/media/图片地址)");
  });

  it("toggles wrappers and block styles off again", () => {
    expect(apply("**重点**", 2, 4, "bold")).toBe("重点");
    expect(apply("- 苹果", 0, 4, "bullet-list")).toBe("苹果");
    expect(apply("## 标题", 0, 5, "paragraph")).toBe("标题");
  });

  it("inserts common GFM blocks without deleting selected text", () => {
    expect(apply("", 0, 0, "horizontal-rule")).toBe("---");
    expect(apply("上文", 2, 2, "table")).toContain(
      "上文\n\n| 列 1 | 列 2 | 列 3 |",
    );
  });

  it("builds a safe media image and reports active styles", () => {
    const image = createMarkdownImageEdit(
      "",
      { from: 0, to: 0 },
      "/media/cute image.webp",
      "猫猫] 图",
    );
    expect(image.insert).toBe("![猫猫  图](/media/cute%20image.webp)");
    expect(
      getActiveMarkdownFormats("## **标题**", { from: 5, to: 7 }),
    ).toEqual(expect.arrayContaining(["heading-2", "bold"]));
  });
});
