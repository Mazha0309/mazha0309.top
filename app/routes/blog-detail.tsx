import { Link, redirect } from "react-router";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "react-router";
import { getPublicPost } from "../lib/content.server";
import { renderSafeMdx } from "../lib/mdx.server";
import { PageViewBeacon, PostComments } from "../components/post-engagement";
import {
  CommentMutationError,
  createComment,
  deleteOwnComment,
  listPublicComments,
} from "../lib/comments.server";
import { normalizeCommentBody } from "../lib/comments";
import { getSession, isAdminSession } from "../lib/auth.server";
import { requireSameOrigin } from "../lib/security.server";

function formatDate(value?: Date | string | null) {
  if (!value) return "未标日期";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function asUuid(value: FormDataEntryValue | null) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value,
    )
  ) {
    return null;
  }
  return value;
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const slug = params.slug;
  if (!slug) throw new Response("Not found", { status: 404 });
  const [result, session] = await Promise.all([
    getPublicPost(slug),
    getSession(request),
  ]);
  if (result.redirectSlug) {
    throw redirect(`/blog/${result.redirectSlug}`, 301);
  }
  if (!result.post) throw new Response("Not found", { status: 404 });

  const [html, comments] = await Promise.all([
    renderSafeMdx(result.post.contentMdx),
    listPublicComments(result.post.id, session?.user.id),
  ]);
  return {
    post: result.post,
    html,
    comments,
    viewer: session
      ? {
          id: session.user.id,
          name: session.user.name || "GitHub 路人",
          image: session.user.image,
          isAdmin: isAdminSession(session),
        }
      : null,
    githubConfigured: Boolean(
      process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
    ),
  };
}

export async function action({ params, request }: ActionFunctionArgs) {
  requireSameOrigin(request);
  const slug = params.slug;
  if (!slug) {
    return Response.json({ ok: false, error: "文章地址不见了。" }, { status: 404 });
  }

  const [result, session] = await Promise.all([
    getPublicPost(slug),
    getSession(request),
  ]);
  if (!result.post) {
    return Response.json({ ok: false, error: "这篇文章已经不在这里啦。" }, { status: 404 });
  }
  if (!session) {
    return Response.json(
      { ok: false, error: "先用 GitHub 领一张路人证再贴纸条。" },
      { status: 401 },
    );
  }

  const form = await request.formData();
  const intent = form.get("intent");
  try {
    if (intent === "create") {
      const normalized = normalizeCommentBody(form.get("body"));
      if (!normalized.ok) {
        return Response.json(
          { ok: false, error: normalized.error },
          { status: 400 },
        );
      }
      const rawParentId = form.get("parentId");
      const parentId = rawParentId ? asUuid(rawParentId) : null;
      if (rawParentId && !parentId) {
        return Response.json(
          { ok: false, error: "要回复的纸条编号有点歪。" },
          { status: 400 },
        );
      }
      const user = session.user as typeof session.user & { githubId?: string };
      const created = await createComment({
        postId: result.post.id,
        parentId,
        authorId: user.id,
        authorGithubId: user.githubId,
        authorName: user.name || "GitHub 路人",
        authorAvatarUrl: user.image,
        body: normalized.body,
      });
      return Response.json({
        ok: true,
        intent: "create",
        publication: created.publication,
      });
    }

    if (intent === "delete-own") {
      const commentId = asUuid(form.get("commentId"));
      if (!commentId) {
        return Response.json(
          { ok: false, error: "找不到要揉掉的纸条。" },
          { status: 400 },
        );
      }
      await deleteOwnComment({
        id: commentId,
        postId: result.post.id,
        authorId: session.user.id,
      });
      return Response.json({ ok: true, intent: "delete-own" });
    }

    return Response.json(
      { ok: false, error: "这枚按钮没有对应的动作。" },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof CommentMutationError) {
      return Response.json(
        { ok: false, error: error.message },
        { status: error.status },
      );
    }
    throw error;
  }
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
  const { post, html, comments, viewer, githubConfigured } = loaderData;
  return (
    <div className="article-shell content-width">
      <PageViewBeacon path={`/blog/${post.slug}`} />
      <Link className="back-link" to="/blog">
        ← 回到纸片堆
      </Link>
      <article>
        <header className="article-header">
          <span className="scrap-label">BLOG NOTE / 新鲜墨迹</span>
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
      <PostComments
        comments={comments}
        viewer={viewer}
        githubConfigured={githubConfigured}
      />
    </div>
  );
}
