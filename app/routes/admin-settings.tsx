import { useEffect, useRef, useState } from "react";
import { Form, useActionData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { AdminLinkEditor } from "../components/admin-link-editor";
import { getSiteSettings, saveSiteSettings } from "../lib/content.server";
import { requireAdmin } from "../lib/auth.server";
import { deleteStoredImage, storeImage } from "../lib/media.server";
import { formString, requireSameOrigin } from "../lib/security.server";
import {
  isAllowedDisplayUrl,
  isAllowedImageUrl,
  normalizeSiteCustomization,
} from "../lib/site-customization";
import type { ContentLink, SiteAccent } from "../lib/types";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  return getSiteSettings();
}

const allowedAccents = new Set<SiteAccent>(["pink", "blue", "mint", "purple", "orange"]);

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  requireSameOrigin(request);
  const form = await request.formData();
  let uploadedAvatarId: string | null = null;
  try {
    const rawLinks = JSON.parse(formString(form, "linksJson")) as unknown;
    if (!Array.isArray(rawLinks)) throw new Error("链接配置格式不对，请刷新页面后重试。");
    const links = rawLinks.slice(0, 30).map((raw, index) => {
      if (!raw || typeof raw !== "object") throw new Error(`第 ${index + 1} 条链接格式不对。`);
      const item = raw as Record<string, unknown>;
      const kind = item.kind === "social" ? "social" : "nav";
      const label = String(item.label ?? "").trim().slice(0, 60);
      const url = String(item.url ?? "").trim().slice(0, 600);
      const enabled = item.enabled !== false;
      if (enabled && (!label || !url)) {
        throw new Error(`第 ${index + 1} 条公开链接缺少文字或地址。`);
      }
      if (!isAllowedDisplayUrl(url)) {
        throw new Error(`第 ${index + 1} 条链接只允许站内路径、HTTP(S) 或 mailto 地址。`);
      }
      return {
        kind,
        label,
        url,
        note: String(item.note ?? "").trim().slice(0, 160) || null,
        position: index,
        enabled,
      } satisfies Omit<ContentLink, "id">;
    }).filter((item) => item.label || item.url);

    const accent = formString(form, "accentColor", { max: 20 }) as SiteAccent;
    if (!allowedAccents.has(accent)) throw new Error("主色选项不在允许范围内。");

    const customization = normalizeSiteCustomization({
      siteTitle: formString(form, "siteTitle", { required: true, max: 120 }),
      siteDescription: formString(form, "siteDescription", { max: 240 }),
      brandMark: formString(form, "brandMark", { required: true, max: 2 }),
      brandSubtitle: formString(form, "brandSubtitle", { max: 60 }),
      footerText: formString(form, "footerText", { max: 220 }),
      heroKicker: formString(form, "heroKicker", { max: 120 }),
      primaryActionLabel: formString(form, "primaryActionLabel", { max: 40 }),
      primaryActionUrl: formString(form, "primaryActionUrl", { max: 600 }),
      secondaryActionLabel: formString(form, "secondaryActionLabel", { max: 40 }),
      secondaryActionUrl: formString(form, "secondaryActionUrl", { max: 600 }),
      marqueeText: formString(form, "marqueeText", { max: 400 }),
      projectsEyebrow: formString(form, "projectsEyebrow", { max: 100 }),
      projectsTitle: formString(form, "projectsTitle", { max: 100 }),
      blogEyebrow: formString(form, "blogEyebrow", { max: 100 }),
      blogTitle: formString(form, "blogTitle", { max: 100 }),
      nowEyebrow: formString(form, "nowEyebrow", { max: 100 }),
      nowTitle: formString(form, "nowTitle", { max: 100 }),
      signoffText: formString(form, "signoffText", { max: 240 }),
      signoffLinkLabel: formString(form, "signoffLinkLabel", { max: 60 }),
      signoffLinkUrl: formString(form, "signoffLinkUrl", { max: 600 }),
      accentColor: accent,
      showProjects: form.get("showProjects") === "on",
      showBlog: form.get("showBlog") === "on",
      showNow: form.get("showNow") === "on",
      showSignoff: form.get("showSignoff") === "on",
    });

    for (const [label, url] of [
      ["首页主按钮", customization.primaryActionUrl],
      ["首页次按钮", customization.secondaryActionUrl],
      ["页尾招呼链接", customization.signoffLinkUrl],
    ] as const) {
      if (!isAllowedDisplayUrl(url)) throw new Error(`${label}地址格式不安全。`);
    }

    const displayName = formString(form, "displayName", {
      required: true,
      max: 80,
    });
    let avatarUrl = formString(form, "avatarUrl", { max: 600 });
    const avatarFile = form.get("avatarFile");
    if (avatarFile instanceof File && avatarFile.size > 0) {
      const uploadedAvatar = await storeImage(
        avatarFile,
        `${displayName} 的头像`,
      );
      uploadedAvatarId = uploadedAvatar.id;
      avatarUrl =
        uploadedAvatar.variants.webp ?? uploadedAvatar.variants.original;
    }
    if (!isAllowedImageUrl(avatarUrl)) {
      throw new Error("头像地址只允许站内路径或 HTTP(S) 图片。");
    }

    await saveSiteSettings(
      {
        id: "main",
        displayName,
        handle: formString(form, "handle", { max: 80 }),
        heroEyebrow: formString(form, "heroEyebrow", { max: 120 }),
        heroTitle: formString(form, "heroTitle", { required: true, max: 160 }),
        heroIntro: formString(form, "heroIntro", { max: 500 }),
        bio: formString(form, "bio", { max: 500 }),
        avatarUrl,
        location: formString(form, "location", { max: 120 }),
        statusText: formString(form, "statusText", { max: 180 }),
        email: formString(form, "email", { max: 240 }),
        customization,
      },
      links,
    );
    return {
      ok: true,
      message: uploadedAvatarId
        ? "新头像已经贴好，站点外观与链接也一起保存啦。"
        : "站点外观、首页文案与链接都保存好了。",
      savedAt: Date.now(),
    };
  } catch (error) {
    if (uploadedAvatarId) {
      await deleteStoredImage(uploadedAvatarId).catch(() => undefined);
    }
    return { ok: false, error: error instanceof Error ? error.message : "保存失败。" };
  }
}

function PanelHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="settings-panel__heading">
      <span className="micro-label">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function AvatarUploadField({
  value,
  savedAt,
}: {
  value: string;
  savedAt?: number;
}) {
  const [avatarUrl, setAvatarUrl] = useState(value);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewSource = filePreview ?? avatarUrl.trim();

  useEffect(() => {
    setAvatarUrl(value);
  }, [value]);

  useEffect(() => {
    setPreviewFailed(false);
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview, previewSource]);

  useEffect(() => {
    if (!savedAt) return;
    if (fileInput.current) fileInput.current.value = "";
    setFileName("");
    setFilePreview(null);
  }, [savedAt]);

  function clearSelectedFile() {
    if (fileInput.current) fileInput.current.value = "";
    setFileName("");
    setFilePreview(null);
  }

  return (
    <div className="profile-avatar-editor field--wide">
      <div className="profile-avatar-editor__preview">
        {previewSource && !previewFailed ? (
          <img
            src={previewSource}
            alt="头像预览"
            onError={() => setPreviewFailed(true)}
          />
        ) : (
          <span aria-live="polite">还没贴头像</span>
        )}
        <small>{filePreview ? "NEW / 待保存" : "AVATAR / 当前预览"}</small>
      </div>
      <div className="profile-avatar-editor__controls">
        <label className="field">
          <span>
            头像地址 <small>URL / 可选兜底</small>
          </span>
          <input
            name="avatarUrl"
            type="text"
            inputMode="url"
            maxLength={600}
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.currentTarget.value)}
            placeholder="/media/... 或 https://..."
          />
        </label>
        <label className="avatar-file-picker">
          <input
            ref={fileInput}
            name="avatarFile"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            aria-describedby="avatar-upload-note"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) {
                clearSelectedFile();
                return;
              }
              setFileName(file.name);
              setFilePreview(URL.createObjectURL(file));
            }}
          />
          <span>从设备里挑一张 ↗</span>
          <output>{fileName || "PNG / JPEG / WEBP / GIF"}</output>
        </label>
        <div className="profile-avatar-editor__note" id="avatar-upload-note">
          <p>最大 8 MB；保存时会自动生成 WebP 与 AVIF，文件会进入媒体抽屉。</p>
          {fileName ? (
            <button
              className="text-button"
              type="button"
              onClick={clearSelectedFile}
            >
              撤回这次选择
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function AdminSettings({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const { profile, links } = loaderData;
  const customization = profile.customization;
  const actionData = useActionData<typeof action>();

  return (
    <>
      <header className="admin-heading admin-heading--actions">
        <div>
          <span className="micro-label">SITE CUSTOMIZER / 公开站点</span>
          <h1>把主页调成你的样子</h1>
          <p>品牌、首页栏目、链接与显示开关都在这里；保存后不需要重新构建。</p>
        </div>
        <a className="button button--small" href="/" target="_blank" rel="noreferrer">打开公开页 ↗</a>
      </header>

      {actionData?.ok ? <p className="form-message form-message--success">{actionData.message}</p> : null}
      {actionData && !actionData.ok ? <p className="form-message form-message--error">{actionData.error}</p> : null}

      <nav className="settings-jump" aria-label="设置区域">
        <a href="#identity">身份</a>
        <a href="#brand">品牌与 SEO</a>
        <a href="#homepage">首页文案</a>
        <a href="#modules">显示模块</a>
        <a href="#links">链接</a>
      </nav>

      <Form
        method="post"
        encType="multipart/form-data"
        className="admin-settings-form"
      >
        <section className="admin-panel settings-panel" id="identity">
          <PanelHeading
            eyebrow="01 / IDENTITY"
            title="你是谁"
            description="头像、名字和正在做什么，会被名片、关于页与页脚共同使用。"
          />
          <div className="form-grid">
            <label className="field"><span>显示名</span><input name="displayName" defaultValue={profile.displayName} required /></label>
            <label className="field"><span>Handle</span><input name="handle" defaultValue={profile.handle} /></label>
            <AvatarUploadField
              value={profile.avatarUrl}
              savedAt={actionData?.ok ? actionData.savedAt : undefined}
            />
            <label className="field"><span>位置</span><input name="location" defaultValue={profile.location} /></label>
            <label className="field"><span>当前状态</span><input name="statusText" defaultValue={profile.statusText} /></label>
            <label className="field"><span>公开邮箱（空则不显示）</span><input name="email" type="email" defaultValue={profile.email} /></label>
            <label className="field field--wide"><span>人物简介</span><textarea name="bio" rows={3} defaultValue={profile.bio} /></label>
          </div>
        </section>

        <section className="admin-panel settings-panel" id="brand">
          <PanelHeading
            eyebrow="02 / BRAND & SEARCH"
            title="站点名片"
            description="控制页头的小印章、浏览器标题、搜索摘要与全站页脚。"
          />
          <div className="form-grid">
            <label className="field">
              <span>印章字符 <small>最多 2 个字符</small></span>
              <input name="brandMark" maxLength={2} defaultValue={customization.brandMark} required />
            </label>
            <label className="field"><span>品牌副标题</span><input name="brandSubtitle" defaultValue={customization.brandSubtitle} /></label>
            <label className="field field--wide"><span>浏览器与分享标题</span><input name="siteTitle" defaultValue={customization.siteTitle} required /></label>
            <label className="field field--wide"><span>搜索与分享摘要</span><textarea name="siteDescription" rows={2} defaultValue={customization.siteDescription} /></label>
            <label className="field field--wide"><span>页脚小字</span><input name="footerText" defaultValue={customization.footerText} /></label>
          </div>
        </section>

        <section className="admin-panel settings-panel" id="homepage">
          <PanelHeading
            eyebrow="03 / HOME COPY"
            title="首页上写什么"
            description="所有固定文案都搬到这里了，按钮支持站内路径或 HTTP(S) 地址。"
          />
          <div className="form-grid">
            <label className="field field--wide"><span>Hero 眉题</span><input name="heroEyebrow" defaultValue={profile.heroEyebrow} /></label>
            <label className="field field--wide"><span>Hero 招呼</span><input name="heroKicker" defaultValue={customization.heroKicker} /></label>
            <label className="field field--wide"><span>Hero 主标题</span><input name="heroTitle" defaultValue={profile.heroTitle} required /></label>
            <label className="field field--wide"><span>Hero 简介</span><textarea name="heroIntro" rows={3} defaultValue={profile.heroIntro} /></label>
            <label className="field"><span>主按钮文字</span><input name="primaryActionLabel" defaultValue={customization.primaryActionLabel} /></label>
            <label className="field"><span>主按钮地址</span><input name="primaryActionUrl" defaultValue={customization.primaryActionUrl} /></label>
            <label className="field"><span>次按钮文字</span><input name="secondaryActionLabel" defaultValue={customization.secondaryActionLabel} /></label>
            <label className="field"><span>次按钮地址</span><input name="secondaryActionUrl" defaultValue={customization.secondaryActionUrl} /></label>
            <label className="field field--wide"><span>黄色跑马灯</span><input name="marqueeText" defaultValue={customization.marqueeText} /></label>
            <label className="field"><span>项目区眉题</span><input name="projectsEyebrow" defaultValue={customization.projectsEyebrow} /></label>
            <label className="field"><span>项目区标题</span><input name="projectsTitle" defaultValue={customization.projectsTitle} /></label>
            <label className="field"><span>博客区眉题</span><input name="blogEyebrow" defaultValue={customization.blogEyebrow} /></label>
            <label className="field"><span>博客区标题</span><input name="blogTitle" defaultValue={customization.blogTitle} /></label>
            <label className="field"><span>近况区眉题</span><input name="nowEyebrow" defaultValue={customization.nowEyebrow} /></label>
            <label className="field"><span>近况区标题</span><input name="nowTitle" defaultValue={customization.nowTitle} /></label>
            <label className="field field--wide"><span>页尾招呼</span><input name="signoffText" defaultValue={customization.signoffText} /></label>
            <label className="field"><span>页尾链接文字</span><input name="signoffLinkLabel" defaultValue={customization.signoffLinkLabel} /></label>
            <label className="field"><span>页尾链接地址</span><input name="signoffLinkUrl" defaultValue={customization.signoffLinkUrl} /></label>
          </div>
        </section>

        <section className="admin-panel settings-panel" id="modules">
          <PanelHeading
            eyebrow="04 / APPEARANCE"
            title="颜色与显示模块"
            description="仍然固定暖纸张，不恢复深色模式；这里只换强调色和首页模块。"
          />
          <div className="appearance-settings">
            <label className="field">
              <span>全站强调色</span>
              <select name="accentColor" defaultValue={customization.accentColor}>
                <option value="pink">莓果粉</option>
                <option value="blue">天空蓝</option>
                <option value="mint">薄荷绿</option>
                <option value="purple">葡萄紫</option>
                <option value="orange">橘子汽水</option>
              </select>
            </label>
            <div className="accent-swatches" aria-label="可选强调色预览">
              {["pink", "blue", "mint", "purple", "orange"].map((color) => <span key={color} data-color={color} />)}
            </div>
          </div>
          <div className="module-toggle-grid">
            <label className="module-toggle"><input name="showProjects" type="checkbox" defaultChecked={customization.showProjects} /><span><strong>项目施工区</strong><small>首页展示精选项目</small></span></label>
            <label className="module-toggle"><input name="showBlog" type="checkbox" defaultChecked={customization.showBlog} /><span><strong>博客纸片区</strong><small>首页展示最新文章</small></span></label>
            <label className="module-toggle"><input name="showNow" type="checkbox" defaultChecked={customization.showNow} /><span><strong>最近在干嘛</strong><small>首页展示 NOW 页面摘要</small></span></label>
            <label className="module-toggle"><input name="showSignoff" type="checkbox" defaultChecked={customization.showSignoff} /><span><strong>页尾招呼条</strong><small>首页底部粉色邀请条</small></span></label>
          </div>
        </section>

        <section className="admin-panel settings-panel" id="links">
          <AdminLinkEditor links={links} />
        </section>

        <div className="sticky-savebar settings-savebar">
          <span>改动只在按下保存后公开。</span>
          <button className="button button--primary" type="submit">保存全部设置</button>
        </div>
      </Form>
    </>
  );
}
