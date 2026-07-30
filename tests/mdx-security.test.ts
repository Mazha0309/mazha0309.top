import { describe, expect, it } from "vitest";
import {
  UnsafeMdxError,
  renderSafeMdx,
  renderSafeMdxDocument,
  validateMdx,
} from "../app/lib/mdx.server";

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

  it("builds stable, deduplicated heading anchors for the article index", async () => {
    const rendered = await renderSafeMdxDocument(`# 总览

## 安装 \`Docker\`

## 安装 Docker

### [深入看看](https://example.com)

#### 收尾`);

    expect(rendered.headings).toEqual([
      { id: "heading-总览", text: "总览", level: 1 },
      { id: "heading-安装-docker", text: "安装 Docker", level: 2 },
      { id: "heading-安装-docker-2", text: "安装 Docker", level: 2 },
      { id: "heading-深入看看", text: "深入看看", level: 3 },
      { id: "heading-收尾", text: "收尾", level: 4 },
    ]);
    expect(rendered.html).toContain('<h1 id="heading-总览">总览</h1>');
    expect(rendered.html).toContain(
      '<h2 id="heading-安装-docker">安装 <code>Docker</code></h2>',
    );
    expect(rendered.html).toContain('<h2 id="heading-安装-docker-2">');
    expect(rendered.html).toContain('<h4 id="heading-收尾">收尾</h4>');
  });
});
