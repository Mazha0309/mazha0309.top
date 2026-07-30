import { evaluate } from "@mdx-js/mdx";
import { renderToStaticMarkup } from "react-dom/server";
import * as runtime from "react/jsx-runtime";
import rehypePrettyCode from "rehype-pretty-code";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import type { ReactNode } from "react";
import { slugify } from "./content-utils";
import type { MdxHeading } from "./types";

const ALLOWED_COMPONENTS = new Set(["Note", "Stamp", "Gallery"]);
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

export class UnsafeMdxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeMdxError";
  }
}

function validateUrl(value: string, image = false) {
  if (
    value.startsWith("/") ||
    value.startsWith("#") ||
    (image && value.startsWith("data:image/"))
  ) {
    return;
  }
  try {
    const url = new URL(value);
    if (!SAFE_PROTOCOLS.has(url.protocol)) {
      throw new UnsafeMdxError(`不允许的链接协议：${url.protocol}`);
    }
  } catch (error) {
    if (error instanceof UnsafeMdxError) throw error;
    throw new UnsafeMdxError(`链接格式不合法：${value}`);
  }
}

function parseAndValidateMdx(source: string) {
  if (source.length > 200_000) {
    throw new UnsafeMdxError("单篇文章不能超过 200,000 个字符。");
  }

  const tree = unified().use(remarkParse).use(remarkMdx).use(remarkGfm).parse(source);

  visit(tree, (node: any) => {
    if (
      node.type === "mdxjsEsm" ||
      node.type === "mdxFlowExpression" ||
      node.type === "mdxTextExpression" ||
      node.type === "mdxJsxAttributeValueExpression" ||
      node.type === "html"
    ) {
      throw new UnsafeMdxError(
        "为了安全，文章不支持 import、export、JavaScript 表达式或原始 HTML。",
      );
    }

    if (
      node.type === "mdxJsxFlowElement" ||
      node.type === "mdxJsxTextElement"
    ) {
      if (!node.name || !ALLOWED_COMPONENTS.has(node.name)) {
        throw new UnsafeMdxError(
          `组件 <${node.name ?? "unknown"}> 不在允许列表中。`,
        );
      }
      for (const attribute of node.attributes ?? []) {
        if (
          attribute.type !== "mdxJsxAttribute" ||
          (attribute.value !== null && typeof attribute.value !== "string")
        ) {
          throw new UnsafeMdxError("组件属性只允许使用静态字符串。");
        }
      }
    }

    if (node.type === "link" || node.type === "image") {
      validateUrl(node.url, node.type === "image");
    }
  });

  return tree;
}

export function validateMdx(source: string) {
  parseAndValidateMdx(source);
  return true;
}

function plainHeadingText(node: any): string {
  if (
    (node.type === "text" ||
      node.type === "inlineCode" ||
      node.type === "code") &&
    typeof node.value === "string"
  ) {
    return node.value;
  }
  if (node.type === "image" && typeof node.alt === "string") {
    return node.alt;
  }
  if (!Array.isArray(node.children)) return "";
  return node.children.map(plainHeadingText).join("");
}

function collectHeadings(tree: ReturnType<typeof parseAndValidateMdx>) {
  const headings: MdxHeading[] = [];
  const occurrences = new Map<string, number>();

  visit(tree, (node: any) => {
    if (
      node.type !== "heading" ||
      ![1, 2, 3, 4].includes(node.depth)
    ) {
      return;
    }

    const text = plainHeadingText(node).replace(/\s+/gu, " ").trim();
    if (!text) return;
    const base = slugify(text) || `section-${headings.length + 1}`;
    const occurrence = (occurrences.get(base) ?? 0) + 1;
    occurrences.set(base, occurrence);
    headings.push({
      id: `heading-${base}${occurrence > 1 ? `-${occurrence}` : ""}`,
      text,
      level: node.depth as MdxHeading["level"],
    });
  });

  return headings;
}

function Note({
  title = "NOTE",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <aside className="mdx-note">
      <span className="mdx-note__pin" aria-hidden="true" />
      <strong>{title}</strong>
      <div>{children}</div>
    </aside>
  );
}

function Stamp({ children }: { children?: ReactNode }) {
  return <span className="mdx-stamp">{children}</span>;
}

function Gallery({ children }: { children?: ReactNode }) {
  return <div className="mdx-gallery">{children}</div>;
}

const baseComponents = {
  Note,
  Stamp,
  Gallery,
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const external =
      typeof props.href === "string" && /^https?:\/\//.test(props.href);
    return (
      <a
        {...props}
        target={external ? "_blank" : props.target}
        rel={external ? "noreferrer noopener" : props.rel}
      />
    );
  },
};

function createComponents(headings: MdxHeading[]) {
  let headingCursor = 0;
  const headingComponent =
    (level: MdxHeading["level"]) =>
    ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLHeadingElement>) => {
      const heading = headings[headingCursor];
      headingCursor += 1;
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4";
      return (
        <Tag
          {...props}
          id={heading?.level === level ? heading.id : undefined}
        >
          {children}
        </Tag>
      );
    };

  return {
    ...baseComponents,
    h1: headingComponent(1),
    h2: headingComponent(2),
    h3: headingComponent(3),
    h4: headingComponent(4),
  };
}

export async function renderSafeMdxDocument(source: string) {
  const tree = parseAndValidateMdx(source);
  const headings = collectHeadings(tree);
  const components = createComponents(headings);

  const module = await evaluate(source, {
    ...runtime,
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      [
        rehypePrettyCode,
        {
          theme: "github-light",
          keepBackground: false,
        },
      ],
    ],
    useMDXComponents: () => components,
  });

  return {
    html: renderToStaticMarkup(<module.default components={components} />),
    headings,
  };
}

export async function renderSafeMdx(source: string) {
  return (await renderSafeMdxDocument(source)).html;
}
