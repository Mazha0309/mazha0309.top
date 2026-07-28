import { Form, Link, redirect } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  createPost,
  deletePost,
  listAdminPosts,
} from "../lib/content.server";
import { requireAdmin } from "../lib/auth.server";
import { requireSameOrigin } from "../lib/security.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  return { posts: await listAdminPosts() };
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  requireSameOrigin(request);
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "new") {
    const post = await createPost();
    throw redirect(`/admin/posts/${post.id}`);
  }
  if (intent === "delete") {
    const id = form.get("id");
    if (typeof id === "string") await deletePost(id);
  }
  return { ok: true };
}

export default function AdminPosts({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  return (
    <>
      <header className="admin-heading admin-heading--actions">
        <div>
          <span className="micro-label">POST DRAWER / {loaderData.posts.length} FILES</span>
          <h1>文章与草稿</h1>
          <p>定时文章到点后由查询自动公开，不需要额外 cron。</p>
        </div>
        <Form method="post">
          <button className="button button--primary" name="intent" value="new">
            + 抽一张新纸
          </button>
        </Form>
      </header>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>状态</th><th>标题</th><th>Slug</th><th>更新时间</th><th><span className="sr-only">操作</span></th></tr></thead>
          <tbody>
            {loaderData.posts.map((post) => (
              <tr key={post.id}>
                <td><span className={`status-chip status-chip--${post.status}`}>{post.status}</span></td>
                <td><Link to={`/admin/posts/${post.id}`}><strong>{post.title}</strong></Link></td>
                <td><code>{post.slug}</code></td>
                <td>{new Date(post.updatedAt ?? Date.now()).toLocaleString("zh-CN")}</td>
                <td>
                  <Form method="post" onSubmit={(event) => {
                    if (!window.confirm(`确定删除《${post.title}》？版本记录也会一起删除。`)) event.preventDefault();
                  }}>
                    <input type="hidden" name="id" value={post.id} />
                    <button className="text-button text-button--danger" name="intent" value="delete">删除</button>
                  </Form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
