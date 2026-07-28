import { Form, Link, useActionData, useNavigation } from "react-router";
import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "react-router";
import {
  getAdminPost,
  listPostRevisions,
  savePost,
  splitTags,
} from "../lib/content.server";
import { requireAdmin } from "../lib/auth.server";
import { parseDateInput } from "../lib/content-utils";
import { renderSafeMdx, validateMdx } from "../lib/mdx.server";
import { formString, requireSameOrigin } from "../lib/security.server";
import { MdxWorkbench } from "../components/mdx-workbench";

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAdmin(request);
  if (!params.id) throw new Response("Not found", { status: 404 });
  const post = await getAdminPost(params.id);
  if (!post) throw new Response("Not found", { status: 404 });
  const [html, revisions] = await Promise.all([
    renderSafeMdx(post.contentMdx),
    listPostRevisions(post.id),
  ]);
  return { post, html, revisions };
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireAdmin(request);
  requireSameOrigin(request);
  if (!params.id) throw new Response("Not found", { status: 404 });
  const form = await request.formData();
  const contentMdx = formString(form, "contentMdx");
  try {
    validateMdx(contentMdx);
    const rawStatus = formString(form, "status", { max: 20 });
    const status =
      rawStatus === "published" || rawStatus === "scheduled"
        ? rawStatus
        : "draft";
    const scheduledAt = parseDateInput(form.get("scheduledAt"));
    if (status === "scheduled" && !scheduledAt) {
      return { ok: false, error: "定时发布必须选择一个有效时间。" };
    }
    const saved = await savePost(params.id, {
      title: formString(form, "title", { required: true, max: 160 }),
      slug: formString(form, "slug", { max: 96 }),
      summary: formString(form, "summary", { max: 320 }),
      contentMdx,
      tags: splitTags(formString(form, "tags", { max: 320 })),
      coverUrl: formString(form, "coverUrl", { max: 600 }) || null,
      status,
      featured: form.get("featured") === "on",
      scheduledAt,
    });
    const message =
      saved.status === "published"
        ? "已经贴到公开博客上啦。"
        : saved.status === "scheduled"
          ? "定时贴纸已安排，到点会自动公开。"
          : "草稿已经压进数据库抽屉。";
    return { ok: true, status: saved.status, message };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "保存失败。",
    };
  }
}

function datetimeValue(value?: Date | string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.valueOf() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function AdminPostEditor({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const { post, html, revisions } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const saving = navigation.state !== "idle";
  const [status, setStatus] = useState(post.status);

  useEffect(() => {
    setStatus(post.status);
  }, [post.id, post.status]);

  const saveLabel =
    status === "published"
      ? "立即公开这张纸"
      : status === "scheduled"
        ? "安排定时发布"
        : "保存为草稿";

  return (
    <>
      <header className="admin-heading admin-heading--actions">
        <div>
          <Link className="back-link" to="/admin/posts">← 文章抽屉</Link>
          <h1>{post.title}</h1>
          <p>文章编号 {post.id} · 已保存 {revisions.length} 个近期版本</p>
        </div>
        <a className="button button--small" href={`/admin/posts/${post.id}/preview`} target="_blank" rel="noreferrer">
          独立预览 ↗
        </a>
      </header>
      <Form method="post" className="post-editor-form">
        <section className="admin-panel post-meta-panel">
          <div className="form-grid">
            <label className="field field--wide">
              <span>标题 <small>TITLE</small></span>
              <input name="title" defaultValue={post.title} required maxLength={160} />
            </label>
            <label className="field">
              <span>Slug <small>PERMALINK</small></span>
              <input name="slug" defaultValue={post.slug} maxLength={96} />
            </label>
            <label className="field">
              <span>标签 <small>COMMA SEPARATED</small></span>
              <input name="tags" defaultValue={post.tags.join(", ")} />
            </label>
            <label className="field field--wide">
              <span>摘要 <small>SUMMARY</small></span>
              <textarea name="summary" defaultValue={post.summary} rows={3} maxLength={320} />
            </label>
            <label className="field">
              <span>状态 <small>STATE</small></span>
              <select
                name="status"
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.currentTarget.value as
                      | "draft"
                      | "scheduled"
                      | "published",
                  )
                }
              >
                <option value="draft">草稿 / DRAFT</option>
                <option value="scheduled">定时 / SCHEDULED</option>
                <option value="published">公开 / PUBLISHED</option>
              </select>
            </label>
            <label className="field">
              <span>定时时间 <small>LOCAL TIME</small></span>
              <input
                name="scheduledAt"
                type="datetime-local"
                defaultValue={datetimeValue(post.scheduledAt)}
                required={status === "scheduled"}
              />
            </label>
            <label className="field field--wide">
              <span>封面 URL <small>OPTIONAL</small></span>
              <input name="coverUrl" defaultValue={post.coverUrl ?? ""} placeholder="/media/…/display.webp" />
            </label>
            <label className="check-field">
              <input type="checkbox" name="featured" defaultChecked={post.featured} />
              <span>放进首页精选</span>
            </label>
          </div>
        </section>

        <MdxWorkbench postId={post.id} initialSource={post.contentMdx} initialHtml={html} />

        <div className="sticky-savebar">
          <div>
            {actionData?.ok ? <span className="form-message form-message--success">{actionData.message}</span> : null}
            {actionData && !actionData.ok ? <span className="form-message form-message--error">{actionData.error}</span> : null}
          </div>
          <button className="button button--primary" type="submit" disabled={saving}>
            {saving ? "保存中…" : saveLabel}
          </button>
        </div>
      </Form>
      <details className="admin-panel revisions-panel">
        <summary>近期版本记录（{revisions.length}）</summary>
        <ol>
          {revisions.map((revision) => (
            <li key={revision.id}>
              <strong>{revision.title}</strong>
              <span>{revision.reason}</span>
              <time>{new Date(revision.createdAt).toLocaleString("zh-CN")}</time>
            </li>
          ))}
        </ol>
      </details>
    </>
  );
}
