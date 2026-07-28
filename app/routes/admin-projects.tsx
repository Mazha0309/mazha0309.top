import { Form, useActionData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  deleteProject,
  listProjects,
  saveProject,
  splitTags,
} from "../lib/content.server";
import { requireAdmin } from "../lib/auth.server";
import { formString, requireSameOrigin } from "../lib/security.server";
import { validateMdx } from "../lib/mdx.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  return { projects: await listProjects() };
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  requireSameOrigin(request);
  const form = await request.formData();
  const intent = formString(form, "intent", { max: 20 });
  const id = formString(form, "id", { max: 64 }) || undefined;
  try {
    if (intent === "delete" && id) {
      await deleteProject(id);
      return { ok: true, message: "项目卡片已删除。" };
    }
    const bodyMdx = formString(form, "bodyMdx");
    validateMdx(bodyMdx);
    const project = await saveProject({
      id: intent === "new" ? undefined : id,
      title: formString(form, "title", { required: true, max: 160 }),
      slug: formString(form, "slug", { max: 96 }),
      summary: formString(form, "summary", { max: 500 }),
      bodyMdx,
      stack: splitTags(formString(form, "stack", { max: 320 })),
      repoUrl: formString(form, "repoUrl", { max: 600 }) || null,
      liveUrl: formString(form, "liveUrl", { max: 600 }) || null,
      accent: formString(form, "accent", { max: 20 }) || "pink",
      statusLabel:
        formString(form, "statusLabel", { max: 40 }) || "MAKING",
      featured: form.get("featured") === "on",
      position: Number(formString(form, "position", { max: 8 })) || 0,
    });
    return { ok: true, message: `已保存 ${project.title}。` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "保存失败。",
    };
  }
}

function ProjectFields({
  project,
}: {
  project?: Awaited<ReturnType<typeof listProjects>>[number];
}) {
  return (
    <>
      {project ? <input type="hidden" name="id" value={project.id} /> : null}
      <div className="form-grid">
        <label className="field">
          <span>项目名 <small>TITLE</small></span>
          <input name="title" defaultValue={project?.title} required />
        </label>
        <label className="field">
          <span>Slug <small>ANCHOR</small></span>
          <input name="slug" defaultValue={project?.slug} />
        </label>
        <label className="field field--wide">
          <span>一句话介绍 <small>SUMMARY</small></span>
          <textarea name="summary" rows={2} defaultValue={project?.summary} />
        </label>
        <label className="field field--wide">
          <span>详细内容 <small>SAFE MDX</small></span>
          <textarea name="bodyMdx" rows={5} defaultValue={project?.bodyMdx} />
        </label>
        <label className="field">
          <span>技术栈 <small>COMMA SEPARATED</small></span>
          <input name="stack" defaultValue={project?.stack.join(", ")} />
        </label>
        <label className="field">
          <span>状态章 <small>STATUS LABEL</small></span>
          <input name="statusLabel" defaultValue={project?.statusLabel ?? "MAKING"} />
        </label>
        <label className="field">
          <span>GitHub 地址</span>
          <input name="repoUrl" type="url" defaultValue={project?.repoUrl ?? ""} />
        </label>
        <label className="field">
          <span>在线地址</span>
          <input name="liveUrl" type="url" defaultValue={project?.liveUrl ?? ""} />
        </label>
        <label className="field">
          <span>卡片颜色</span>
          <select name="accent" defaultValue={project?.accent ?? "pink"}>
            <option value="pink">粉</option>
            <option value="yellow">黄</option>
            <option value="blue">蓝</option>
            <option value="mint">薄荷</option>
            <option value="lavender">薰衣草</option>
          </select>
        </label>
        <label className="field">
          <span>排序</span>
          <input name="position" type="number" defaultValue={project?.position ?? 0} />
        </label>
        <label className="check-field">
          <input name="featured" type="checkbox" defaultChecked={project?.featured} />
          <span>首页精选</span>
        </label>
      </div>
    </>
  );
}

export default function AdminProjects({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const actionData = useActionData<typeof action>();
  return (
    <>
      <header className="admin-heading">
        <span className="micro-label">PROJECT CABINET / EDITABLE</span>
        <h1>项目卡片</h1>
        <p>每一项都会直接出现在公开项目页；空链接不会渲染。</p>
      </header>
      {actionData?.ok ? <p className="form-message form-message--success">{actionData.message}</p> : null}
      {actionData && !actionData.ok ? <p className="form-message form-message--error">{actionData.error}</p> : null}
      <details className="admin-panel create-panel">
        <summary>＋ 新建项目卡片</summary>
        <Form method="post">
          <ProjectFields />
          <button className="button button--primary" name="intent" value="new">创建项目</button>
        </Form>
      </details>
      <div className="admin-card-stack">
        {loaderData.projects.map((project) => (
          <details className="admin-panel" key={project.id}>
            <summary>
              <strong>{project.title}</strong>
              <span>{project.statusLabel} · POS {project.position}</span>
            </summary>
            <Form method="post">
              <ProjectFields project={project} />
              <div className="form-actions">
                <button className="button button--primary" name="intent" value="save">保存项目</button>
                <button className="text-button text-button--danger" name="intent" value="delete" onClick={(event) => {
                  if (!window.confirm(`删除 ${project.title}？`)) event.preventDefault();
                }}>删除</button>
              </div>
            </Form>
          </details>
        ))}
      </div>
    </>
  );
}
