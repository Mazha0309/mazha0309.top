import { Link, redirect } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { getPublicPost } from "../lib/content.server";
import { renderSafeMdx } from "../lib/mdx.server";
import { PageViewBeacon, PostComments } from "../components/post-engagement";

function formatDate(value?: Date | string | null) {
  if (!value) return "未标日期";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

export async function loader({ params }: LoaderFunctionArgs) {
  const slug = params.slug;
  if (!slug) throw new Response("Not found", { status: 404 });
  const result = await getPublicPost(slug);
  if (result.redirectSlug) {
    throw redirect(`/blog/${result.redirectSlug}`, 301);
  }
  if (!result.post) throw new Response("Not found", { status: 404 });

  const html = await renderSafeMdx(result.post.contentMdx);
  const config =
    process.env.GISCUS_REPO &&
    process.env.GISCUS_REPO_ID &&
    process.env.GISCUS_CATEGORY &&
    process.env.GISCUS_CATEGORY_ID
      ? {
          repo: process.env.GISCUS_REPO as `${string}/${string}`,
          repoId: process.env.GISCUS_REPO_ID,
          category: process.env.GISCUS_CATEGORY,
          categoryId: process.env.GISCUS_CATEGORY_ID,
        }
      : null;
  return { post: result.post, html, giscus: config };
}

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
  if (!loaderData) return [{ title: "纸片不存在 — Mazha0309" }];
  return [
    { title: `${loaderData.post.title} — Mazha0309` },
    { name: "description", content: loaderData.post.summary },
    { property: "og:type", content: "article" },
    { property: "og:title", content: loaderData.post.title },
    { property: "og:description", content: loaderData.post.summary },
  ];
};

export default function BlogDetail({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const { post, html, giscus } = loaderData;
  return (
    <div className="article-shell content-width">
      <PageViewBeacon path={`/blog/${post.slug}`} />
      <Link className="back-link" to="/blog">
        ← 回到纸片堆
      </Link>
      <article>
        <header className="article-header">
          <span className="security-pill">BLOG FILE / {post.id.slice(0, 8)}</span>
          <h1>{post.title}</h1>
          <p className="article-deck">{post.summary}</p>
          <div className="article-byline">
            <span>{formatDate(post.publishedAt)}</span>
            <span>约 {post.readingMinutes} 分钟</span>
            <span>状态：已贴好</span>
          </div>
          <div className="tag-list">
            {post.tags.map((tag) => (
              <Link key={tag} to={`/blog?tag=${encodeURIComponent(tag)}`}>
                #{tag}
              </Link>
            ))}
          </div>
          <span className="article-stamp" aria-hidden="true">
            READ
            <br />
            ME
          </span>
        </header>
        <div
          className="prose"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>
      <PostComments postId={post.id} config={giscus} />
    </div>
  );
}
