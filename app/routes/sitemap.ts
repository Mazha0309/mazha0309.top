import type { LoaderFunctionArgs } from "react-router";
import { getPublishedSlugs } from "../lib/content.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const origin = process.env.APP_ORIGIN ?? new URL(request.url).origin;
  const posts = await getPublishedSlugs();
  const staticPaths = ["/", "/blog", "/projects", "/about"];
  const urls = [
    ...staticPaths.map(
      (path) => `<url><loc>${origin}${path}</loc></url>`,
    ),
    ...posts.map(
      (post) =>
        `<url><loc>${origin}/blog/${encodeURIComponent(post.slug)}</loc><lastmod>${new Date(post.updatedAt ?? Date.now()).toISOString()}</lastmod></url>`,
    ),
  ].join("");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=900",
      },
    },
  );
}
