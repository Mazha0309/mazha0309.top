import { describe, expect, it } from "vitest";
import { createMarkdownEdit } from "../app/lib/markdown-editor";

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
});
