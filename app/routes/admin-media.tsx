import { Form, useActionData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { listMedia } from "../lib/content.server";
import { requireAdmin } from "../lib/auth.server";
import { deleteStoredMedia, storeImage } from "../lib/media.server";
import { formString, requireSameOrigin } from "../lib/security.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  return { media: await listMedia() };
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  requireSameOrigin(request);
  const form = await request.formData();
  try {
    const intent = formString(form, "intent", { max: 20 });
    if (intent === "delete") {
      const id = formString(form, "id", { required: true, max: 64 });
      const record = await deleteStoredMedia(id);
      return {
        ok: true,
        message: `已经删除 ${record.originalName} 及其媒体变体。`,
      };
    }

    const file = form.get("image");
    if (!(file instanceof File)) {
      return { ok: false, error: "请选择一张图片。" };
    }
    const record = await storeImage(
      file,
      formString(form, "alt", { required: true, max: 300 }),
    );
    return {
      ok: true,
      message: "图片已存入媒体抽屉。",
      url: record.variants.webp,
    };
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
        <p>图片在这里上传；音乐页上传的音频也会收进同一个持久化抽屉。</p>
      </header>
      {actionData?.ok ? (
        <p className="form-message form-message--success">
          {actionData.message}
          {"url" in actionData && actionData.url ? (
            <> URL: <code>{actionData.url}</code></>
          ) : null}
        </p>
      ) : null}
      {actionData && !actionData.ok ? (
        <p className="form-message form-message--error">{actionData.error}</p>
      ) : null}
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
        <button
          className="button button--primary"
          name="intent"
          value="upload"
          type="submit"
        >
          上传并生成变体
        </button>
      </Form>
      <div className="media-grid">
        {loaderData.media.map((item) => (
          <article key={item.id}>
            {item.mimeType.startsWith("audio/") ? (
              <div className="media-audio-preview">
                {item.variants.coverWebp ? (
                  <img src={item.variants.coverWebp} alt="" loading="lazy" />
                ) : (
                  <span aria-hidden="true">♫</span>
                )}
                <audio controls preload="metadata" src={item.variants.original}>
                  你的浏览器暂时不会播放这个音频。
                </audio>
              </div>
            ) : (
              <img src={item.variants.webp ?? item.variants.original} alt={item.alt} loading="lazy" />
            )}
            <div>
              <strong>{item.originalName}</strong>
              <p>{item.alt}</p>
              <code>{item.variants.webp ?? item.variants.original}</code>
              <small>
                {item.width && item.height ? `${item.width}×${item.height} · ` : ""}
                {(item.sizeBytes / 1024).toFixed(0)} KB
              </small>
              <Form method="post" className="media-card__actions">
                <input type="hidden" name="id" value={item.id} />
                <button
                  className="text-button text-button--danger"
                  name="intent"
                  value="delete"
                  type="submit"
                  onClick={(event) => {
                    if (
                      !window.confirm(
                        `删除 ${item.originalName} 及其所有变体？这一步不能撤回。`,
                      )
                    ) {
                      event.preventDefault();
                    }
                  }}
                >
                  删除媒体
                </button>
              </Form>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
