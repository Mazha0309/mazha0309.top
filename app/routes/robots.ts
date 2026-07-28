import type { LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const origin = process.env.APP_ORIGIN ?? new URL(request.url).origin;
  return new Response(
    `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/admin

Sitemap: ${origin}/sitemap.xml
`,
    {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    },
  );
}
