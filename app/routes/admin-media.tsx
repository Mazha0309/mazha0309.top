import { Form, useActionData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { listMedia } from "../lib/content.server";
import { requireAdmin } from "../lib/auth.server";
import { storeImage } from "../lib/media.server";
import { formString, requireSameOrigin } from "../lib/security.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  return { media: await listMedia() };
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  requireSameOrigin(request);
  const form = await request.formData();
  const file = form.get("image");
  if (!(file instanceof File)) {
    return { ok: false, error: "请选择一张图片。" };
  }
  try {
    const record = await storeImage(file, formString(form, "alt", { required: true, max: 300 }));
    return { ok: true, message: "图片已存入媒体抽屉。", url: record.variants.webp };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "上传失败。" };
  }
}

export default function AdminMedia({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const actionData = useActionData<typeof action>();
  return (
    <>
      <header className="admin-heading">
        <span className="micro-label">MEDIA DRAWER / PERSISTENT VOLUME</span>
        <h1>图片与附件</h1>
        <p>接受 PNG / JPEG / WebP / GIF，最大 8 MB；SVG 会被拒绝。自动生成 WebP 与 AVIF。</p>
      </header>
      <Form method="post" encType="multipart/form-data" className="admin-panel upload-panel">
        <label className="upload-drop">
          <span>把图片放到这里</span>
          <small>IMAGE FILE / MAX 8 MB</small>
          <input name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required />
        </label>
        <label className="field">
          <span>替代文本 <small>ALT / REQUIRED</small></span>
          <input name="alt" required maxLength={300} placeholder="说明图片里真正重要的内容" />
        </label>
        <button className="button button--primary" type="submit">上传并生成变体</button>
        {actionData?.ok ? <p className="form-message form-message--success">{actionData.message} URL: <code>{actionData.url}</code></p> : null}
        {actionData && !actionData.ok ? <p className="form-message form-message--error">{actionData.error}</p> : null}
      </Form>
      <div className="media-grid">
        {loaderData.media.map((item) => (
          <article key={item.id}>
            <img src={item.variants.webp ?? item.variants.original} alt={item.alt} loading="lazy" />
            <div>
              <strong>{item.originalName}</strong>
              <p>{item.alt}</p>
              <code>{item.variants.webp ?? item.variants.original}</code>
              <small>{item.width}×{item.height} · {(item.sizeBytes / 1024).toFixed(0)} KB</small>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
