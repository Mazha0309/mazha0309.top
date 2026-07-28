import { Form, useActionData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { listPages, savePage } from "../lib/content.server";
import { requireAdmin } from "../lib/auth.server";
import { validateMdx } from "../lib/mdx.server";
import { formString, requireSameOrigin } from "../lib/security.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  return { pages: await listPages() };
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  requireSameOrigin(request);
  const form = await request.formData();
  try {
    const contentMdx = formString(form, "contentMdx");
    validateMdx(contentMdx);
    const saved = await savePage({
      id: formString(form, "id", { max: 64 }) || undefined,
      slug: formString(form, "slug", { required: true, max: 64 }),
      title: formString(form, "title", { required: true, max: 160 }),
      eyebrow: formString(form, "eyebrow", { max: 120 }),
      contentMdx,
    });
    return { ok: true, message: `已保存 ${saved.title}。` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "保存失败。" };
  }
}

export default function AdminPages({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const actionData = useActionData<typeof action>();
  return (
    <>
      <header className="admin-heading">
        <span className="micro-label">PAGE FILES / ABOUT + NOW</span>
        <h1>固定页面</h1>
        <p>ABOUT 是完整人物档案；NOW 会同时出现在首页和关于页。</p>
      </header>
      {actionData?.ok ? <p className="form-message form-message--success">{actionData.message}</p> : null}
      {actionData && !actionData.ok ? <p className="form-message form-message--error">{actionData.error}</p> : null}
      <div className="admin-card-stack">
        {loaderData.pages.map((page) => (
          <Form method="post" className="admin-panel page-editor" key={page.id} id={page.slug}>
            <input type="hidden" name="id" value={page.id} />
            <input type="hidden" name="slug" value={page.slug} />
            <div className="admin-panel__heading">
              <div><span>/{page.slug}</span><h2>{page.title}</h2></div>
              <button className="button button--small" type="submit">保存这一页</button>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>页面标题</span>
                <input name="title" defaultValue={page.title} required />
              </label>
              <label className="field">
                <span>系统眉题 <small>EYEBROW</small></span>
                <input name="eyebrow" defaultValue={page.eyebrow} />
              </label>
              <label className="field field--wide">
                <span>安全 MDX 内容</span>
                <textarea name="contentMdx" rows={18} defaultValue={page.contentMdx} />
              </label>
            </div>
          </Form>
        ))}
      </div>
    </>
  );
}
