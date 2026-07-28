import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { getAdminPost } from "../lib/content.server";
import { requireAdmin } from "../lib/auth.server";
import { renderSafeMdx } from "../lib/mdx.server";

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => [
  { title: loaderData ? `预览：${loaderData.post.title}` : "文章预览" },
  { name: "robots", content: "noindex, nofollow" },
];

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAdmin(request);
  if (!params.id) throw new Response("Not found", { status: 404 });
  const post = await getAdminPost(params.id);
  if (!post) throw new Response("Not found", { status: 404 });
  return { post, html: await renderSafeMdx(post.contentMdx) };
}

export default function AdminPostPreview({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  return (
    <article className="article-shell preview-document">
      <header className="article-header">
        <span className="scrap-label">DRAFT PREVIEW / 还没贴出去</span>
        <h1>{loaderData.post.title}</h1>
        <p className="article-deck">{loaderData.post.summary}</p>
      </header>
      <div className="prose" dangerouslySetInnerHTML={{ __html: loaderData.html }} />
    </article>
  );
}
