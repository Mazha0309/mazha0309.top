import type { LoaderFunctionArgs } from "react-router";
import { listPublicPosts } from "../lib/content.server";

function xml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function loader({ request }: LoaderFunctionArgs) {
  const origin = process.env.APP_ORIGIN ?? new URL(request.url).origin;
  const posts = await listPublicPosts();
  const items = posts
    .map(
      (post) => `<item>
  <title>${xml(post.title)}</title>
  <link>${origin}/blog/${encodeURIComponent(post.slug)}</link>
  <guid isPermaLink="false">post:${post.id}</guid>
  <description>${xml(post.summary)}</description>
  <pubDate>${new Date(post.publishedAt ?? post.createdAt ?? Date.now()).toUTCString()}</pubDate>
  ${post.tags.map((tag) => `<category>${xml(tag)}</category>`).join("\n  ")}
</item>`,
    )
    .join("\n");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
  <title>Mazha0309 的博客纸片</title>
  <link>${origin}/blog</link>
  <description>技术、项目幕后和很难分类的生活碎片。</description>
  <language>zh-CN</language>
  ${items}
</channel>
</rss>`,
    {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=900",
      },
    },
  );
}
