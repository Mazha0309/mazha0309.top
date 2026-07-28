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

export function validateMdx(source: string) {
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

  return true;
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

const components = {
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

export async function renderSafeMdx(source: string) {
  validateMdx(source);

  const module = await evaluate(source, {
    ...runtime,
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      [
        rehypePrettyCode,
        {
          theme: {
            dark: "github-dark-dimmed",
            light: "github-light",
          },
          keepBackground: false,
        },
      ],
    ],
    useMDXComponents: () => components,
  });

  return renderToStaticMarkup(<module.default components={components} />);
}
