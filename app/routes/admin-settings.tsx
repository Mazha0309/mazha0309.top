import { Form, useActionData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getSiteShell, saveSiteSettings } from "../lib/content.server";
import { requireAdmin } from "../lib/auth.server";
import { formString, requireSameOrigin } from "../lib/security.server";
import type { ContentLink } from "../lib/types";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  return getSiteShell();
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  requireSameOrigin(request);
  const form = await request.formData();
  try {
    const rawLinks = JSON.parse(formString(form, "linksJson")) as unknown;
    if (!Array.isArray(rawLinks)) throw new Error("链接配置必须是一个 JSON 数组。");
    const links = rawLinks.slice(0, 30).map((raw, index) => {
      if (!raw || typeof raw !== "object") throw new Error(`第 ${index + 1} 条链接格式不对。`);
      const item = raw as Record<string, unknown>;
      const kind = item.kind === "social" ? "social" : "nav";
      return {
        kind,
        label: String(item.label ?? "").trim().slice(0, 60),
        url: String(item.url ?? "").trim().slice(0, 600),
        note: String(item.note ?? "").trim().slice(0, 160) || null,
        position: Number(item.position ?? index) || 0,
        enabled: item.enabled !== false,
      } satisfies Omit<ContentLink, "id">;
    });
    await saveSiteSettings(
      {
        id: "main",
        displayName: formString(form, "displayName", { required: true, max: 80 }),
        handle: formString(form, "handle", { max: 80 }),
        heroEyebrow: formString(form, "heroEyebrow", { max: 120 }),
        heroTitle: formString(form, "heroTitle", { required: true, max: 160 }),
        heroIntro: formString(form, "heroIntro", { max: 500 }),
        bio: formString(form, "bio", { max: 500 }),
        avatarUrl: formString(form, "avatarUrl", { max: 600 }),
        location: formString(form, "location", { max: 120 }),
        statusText: formString(form, "statusText", { max: 180 }),
        email: formString(form, "email", { max: 240 }),
      },
      links,
    );
    return { ok: true, message: "站点身份与链接已更新。" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "保存失败。" };
  }
}

export default function AdminSettings({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const { profile, links } = loaderData;
  const actionData = useActionData<typeof action>();
  const linksJson = JSON.stringify(
    links.map(({ kind, label, url, note, position, enabled }) => ({
      kind,
      label,
      url,
      note,
      position,
      enabled,
    })),
    null,
    2,
  );
  return (
    <>
      <header className="admin-heading">
        <span className="micro-label">SITE IDENTITY / GLOBAL</span>
        <h1>主页身份与链接</h1>
        <p>这里的改动会影响页头、首页 Hero、关于页和页脚。</p>
      </header>
      {actionData?.ok ? <p className="form-message form-message--success">{actionData.message}</p> : null}
      {actionData && !actionData.ok ? <p className="form-message form-message--error">{actionData.error}</p> : null}
      <Form method="post" className="admin-panel">
        <div className="form-grid">
          <label className="field"><span>显示名</span><input name="displayName" defaultValue={profile.displayName} required /></label>
          <label className="field"><span>Handle</span><input name="handle" defaultValue={profile.handle} /></label>
          <label className="field field--wide"><span>Hero 眉题</span><input name="heroEyebrow" defaultValue={profile.heroEyebrow} /></label>
          <label className="field field--wide"><span>Hero 主标题</span><input name="heroTitle" defaultValue={profile.heroTitle} required /></label>
          <label className="field field--wide"><span>Hero 简介</span><textarea name="heroIntro" rows={3} defaultValue={profile.heroIntro} /></label>
          <label className="field field--wide"><span>人物简介</span><textarea name="bio" rows={3} defaultValue={profile.bio} /></label>
          <label className="field field--wide"><span>头像 URL</span><input name="avatarUrl" type="url" defaultValue={profile.avatarUrl} /></label>
          <label className="field"><span>位置</span><input name="location" defaultValue={profile.location} /></label>
          <label className="field"><span>当前状态</span><input name="statusText" defaultValue={profile.statusText} /></label>
          <label className="field"><span>公开邮箱（空则不显示）</span><input name="email" type="email" defaultValue={profile.email} /></label>
          <label className="field field--wide">
            <span>导航与社交链接 <small>JSON / BLANK URLS NEVER RENDER</small></span>
            <textarea name="linksJson" rows={24} defaultValue={linksJson} spellCheck={false} />
          </label>
        </div>
        <button className="button button--primary" type="submit">保存全站设置</button>
      </Form>
    </>
  );
}
