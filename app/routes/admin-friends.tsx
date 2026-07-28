import { Form, useActionData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useEffect, useRef, useState } from "react";
import {
  deleteFriendLink,
  listFriendLinks,
  saveFriendLink,
} from "../lib/content.server";
import { requireAdmin } from "../lib/auth.server";
import { formString, requireSameOrigin } from "../lib/security.server";
import {
  friendAccentOptions,
  isAllowedFriendAvatarUrl,
  isAllowedFriendUrl,
  normalizeFriendAccent,
} from "../lib/friend-links";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  return { friends: await listFriendLinks({ includeDisabled: true }) };
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  requireSameOrigin(request);
  const form = await request.formData();
  const intent = formString(form, "intent", { max: 20 });
  const id = formString(form, "id", { max: 64 }) || undefined;

  try {
    if (intent === "delete" && id) {
      await deleteFriendLink(id);
      return {
        ok: true,
        intent,
        recordId: id,
        message: "这张友链名片已经取下来了。",
      };
    }
    const url = formString(form, "url", { required: true, max: 600 });
    const avatarUrl = formString(form, "avatarUrl", { max: 600 });
    if (!isAllowedFriendUrl(url)) {
      throw new Error("友链地址需要是 HTTP(S) 网址。");
    }
    if (!isAllowedFriendAvatarUrl(avatarUrl)) {
      throw new Error("头像需要使用站内路径或 HTTP(S) 地址。");
    }
    const position = Number(formString(form, "position", { max: 8 }));
    const friend = await saveFriendLink({
      id: intent === "new" ? undefined : id,
      name: formString(form, "name", { required: true, max: 100 }),
      url,
      avatarUrl: avatarUrl || null,
      description: formString(form, "description", { max: 240 }),
      accent: normalizeFriendAccent(
        formString(form, "accent", { max: 20 }),
      ),
      position: Number.isFinite(position) ? Math.trunc(position) : 0,
      enabled: form.get("enabled") === "on",
    });
    return {
      ok: true,
      intent,
      recordId: friend.id,
      message: `已经挂好 ${friend.name} 的名片。`,
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return { ok: false, error: "这个网址已经挂过一张名片了。" };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "保存失败。",
    };
  }
}

function FriendFields({
  friend,
}: {
  friend?: Awaited<ReturnType<typeof listFriendLinks>>[number];
}) {
  return (
    <>
      {friend ? <input type="hidden" name="id" value={friend.id} /> : null}
      <div className="form-grid">
        <label className="field">
          <span>站名 <small>DISPLAY NAME</small></span>
          <input name="name" defaultValue={friend?.name} required maxLength={100} />
        </label>
        <label className="field">
          <span>网址 <small>HTTP(S)</small></span>
          <input name="url" defaultValue={friend?.url} inputMode="url" required maxLength={600} />
        </label>
        <label className="field field--wide">
          <span>一句介绍 <small>最多 240 字</small></span>
          <textarea name="description" defaultValue={friend?.description} rows={2} maxLength={240} />
        </label>
        <label className="field">
          <span>头像 URL <small>留空显示首字</small></span>
          <input name="avatarUrl" defaultValue={friend?.avatarUrl ?? ""} inputMode="url" maxLength={600} />
        </label>
        <label className="field">
          <span>名片颜色</span>
          <select name="accent" defaultValue={friend?.accent ?? "pink"}>
            {friendAccentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>排序 <small>数字越小越靠前</small></span>
          <input name="position" type="number" defaultValue={friend?.position ?? 0} />
        </label>
        <label className="check-field">
          <input name="enabled" type="checkbox" defaultChecked={friend?.enabled ?? true} />
          <span>在公开友链页展示</span>
        </label>
      </div>
    </>
  );
}

export default function AdminFriends({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const actionData = useActionData<typeof action>();
  const [createFormKey, setCreateFormKey] = useState(0);
  const handledCreate = useRef<string | null>(null);

  useEffect(() => {
    if (
      actionData?.ok &&
      actionData.intent === "new" &&
      actionData.recordId !== handledCreate.current
    ) {
      handledCreate.current = actionData.recordId;
      setCreateFormKey((current) => current + 1);
    }
  }, [actionData]);

  return (
    <>
      <header className="admin-heading">
        <span className="micro-label">
          FRIEND PINBOARD / {loaderData.friends.length} CARDS
        </span>
        <h1>友链名片</h1>
        <p>关闭展示会保留资料，只把名片暂时从公开页面取下来。</p>
      </header>
      {actionData?.ok ? <p className="form-message form-message--success">{actionData.message}</p> : null}
      {actionData && !actionData.ok ? <p className="form-message form-message--error">{actionData.error}</p> : null}
      <details className="admin-panel create-panel">
        <summary>＋ 挂一张新名片</summary>
        <Form method="post" key={createFormKey}>
          <FriendFields />
          <button className="button button--primary" name="intent" value="new">
            添加友链
          </button>
        </Form>
      </details>
      {loaderData.friends.length ? (
        <div className="admin-card-stack">
          {loaderData.friends.map((friend) => (
            <details className="admin-panel" key={friend.id}>
              <summary>
                <strong>{friend.name}</strong>
                <span>{friend.enabled ? "公开展示" : "暂时收起"} · POS {friend.position}</span>
              </summary>
              <Form method="post">
                <FriendFields friend={friend} />
                <div className="form-actions">
                  <button className="button button--primary" name="intent" value="save">
                    保存名片
                  </button>
                  <button
                    className="text-button text-button--danger"
                    name="intent"
                    value="delete"
                    onClick={(event) => {
                      if (!window.confirm(`取下 ${friend.name} 的友链名片？`)) {
                        event.preventDefault();
                      }
                    }}
                  >
                    删除
                  </button>
                </div>
              </Form>
            </details>
          ))}
        </div>
      ) : (
        <div className="dashboard-empty admin-panel">
          <span aria-hidden="true">♡</span>
          <div><strong>友链板还是空的</strong><p>上面的“挂一张新名片”可以添加第一位邻居。</p></div>
        </div>
      )}
    </>
  );
}
