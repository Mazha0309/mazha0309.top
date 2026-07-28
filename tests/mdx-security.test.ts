import { describe, expect, it } from "vitest";
import { UnsafeMdxError, renderSafeMdx, validateMdx } from "../app/lib/mdx.server";

describe("safe MDX", () => {
  it("accepts markdown and allowlisted components", async () => {
    const source = `## 标题

<Note title="提醒">这里是安全纸条。</Note>

- one
- two`;
    expect(validateMdx(source)).toBe(true);
    const html = await renderSafeMdx(source);
    expect(html).toContain("mdx-note");
    expect(html).toContain("这里是安全纸条");
  });

  it.each([
    ["ESM imports", `import x from "evil"\n\n# hi`],
    ["expressions", `# {globalThis.process}`],
    ["raw HTML", `<script>alert(1)</script>`],
    ["unknown components", `<Danger>nope</Danger>`],
    ["attribute expressions", `<Note title={globalThis.process}>nope</Note>`],
    ["javascript links", `[click](javascript:alert(1))`],
  ])("rejects %s", (_label, source) => {
    expect(() => validateMdx(source)).toThrow(UnsafeMdxError);
  });
});
