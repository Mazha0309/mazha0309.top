import { Form, Link, redirect } from "react-router";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "react-router";
import { requireAdmin } from "../lib/auth.server";
import {
  CommentMutationError,
  getCommentStats,
  getCommentSettings,
  listAdminComments,
  moderateComment,
  recheckCommentWithAI,
  saveCommentSettings,
} from "../lib/comments.server";
import { isSafeInternalPath } from "../lib/content-utils";
import { formString, requireSameOrigin } from "../lib/security.server";
import type { CommentStatus } from "../lib/types";

const filters = [
  "all",
  "pending",
  "rejected",
  "active",
  "hidden",
  "deleted",
] as const;
type CommentFilter = (typeof filters)[number];

function readFilter(value: string | null): CommentFilter {
  return filters.includes(value as CommentFilter)
    ? (value as CommentFilter)
    : "all";
}

function readUuid(value: FormDataEntryValue | null) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value,
    )
    ? value
    : null;
}

function formatTime(value: Date | string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const url = new URL(request.url);
  const status = readFilter(url.searchParams.get("status"));
  const settingsSaved = url.searchParams.get("saved") === "settings";
  const [comments, stats, moderationSettings] = await Promise.all([
    listAdminComments(status),
    getCommentStats(),
    getCommentSettings(),
  ]);
  return { comments, stats, status, moderationSettings, settingsSaved };
}

export async function action({ request }: ActionFunctionArgs) {
  requireSameOrigin(request);
  const session = await requireAdmin(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "save-settings") {
    try {
      await saveCommentSettings({
        aiEnabled: form.get("aiEnabled") === "on",
        apiBaseUrl: formString(form, "apiBaseUrl", {
          required: true,
          max: 500,
        }),
        model: formString(form, "model", { required: true, max: 160 }),
        extraPolicy: formString(form, "extraPolicy", { max: 4_000 }),
        apiKey: formString(form, "apiKey", { max: 2_049 }),
        clearApiKey: form.get("clearApiKey") === "on",
      });
    } catch (error) {
      if (error instanceof CommentMutationError) {
        throw new Response(error.message, { status: error.status });
      }
      throw error;
    }
    return redirect("/admin/comments?saved=settings");
  }

  const id = readUuid(form.get("id"));
  if (!id) {
    throw new Response("Invalid comment id", { status: 400 });
  }

  try {
    if (intent === "recheck") {
      await recheckCommentWithAI(id);
    } else if (
      intent === "hide" ||
      intent === "restore" ||
      intent === "approve" ||
      intent === "reject" ||
      intent === "delete"
    ) {
      await moderateComment({
        id,
        intent,
        moderatorId: session.user.id,
      });
    } else {
      throw new Response("Invalid moderation action", { status: 400 });
    }
  } catch (error) {
    if (error instanceof CommentMutationError) {
      throw new Response(error.message, { status: error.status });
    }
    throw error;
  }

  const returnTo = form.get("returnTo");
  return redirect(
    typeof returnTo === "string" && isSafeInternalPath(returnTo)
      ? returnTo
      : "/admin/comments",
  );
}

const statusCopy: Record<
  CommentStatus,
  { label: string; note: string }
> = {
  active: { label: "公开中", note: "正在文章背面待着" },
  pending: { label: "待审核", note: "AI 不确定或接口故障，等主人拿主意" },
  rejected: { label: "被拦下", note: "AI 判定不适合直接公开，主人仍可放行" },
  hidden: { label: "藏起来", note: "访客只能看见占位折痕" },
  deleted: { label: "揉掉了", note: "正文已经永久清空" },
};

const decisionCopy = {
  allow: "建议放行",
  review: "建议人工看",
  block: "建议拦下",
} as const;

export default function AdminComments({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const returnTo =
    loaderData.status === "all"
      ? "/admin/comments"
      : `/admin/comments?status=${loaderData.status}`;
  const filterCounts: Record<CommentFilter, number> = {
    all: loaderData.stats.total,
    pending: loaderData.stats.pending,
    rejected: loaderData.stats.rejected,
    active: loaderData.stats.active,
    hidden: loaderData.stats.hidden,
    deleted: loaderData.stats.deleted,
  };
  const filterLabels: Record<CommentFilter, string> = {
    all: "全部纸条",
    pending: "等你审核",
    rejected: "AI 拦下",
    active: "公开中",
    hidden: "藏起来",
    deleted: "揉掉了",
  };

  return (
    <>
      <header className="admin-heading admin-heading--actions">
        <div>
          <span className="micro-label">PAPER MAILROOM / 留言值班室</span>
          <h1>看看谁往文章背面塞纸条</h1>
          <p>可以先藏起来观察，也可以彻底揉掉；揉掉会清空正文，不能撤回哦。</p>
        </div>
        <Link className="button button--small" to="/blog">
          去公开文章看看 ↗
        </Link>
      </header>

      <section className="admin-panel comment-ai-settings">
        <div className="admin-panel__heading admin-panel__heading--row">
          <div>
            <span>AI GATEKEEPER / 可拔插门卫</span>
            <h2>让 AI 先闻闻纸条有没有怪味</h2>
          </div>
          <span
            className={`comment-ai-status comment-ai-status--${
              loaderData.moderationSettings.settings.aiEnabled
                ? "on"
                : "off"
            }`}
          >
            {loaderData.moderationSettings.settings.aiEnabled ? "ON" : "OFF"}
          </span>
        </div>
        <p className="comment-ai-settings__intro">
          关闭时评论直接公开；开启时使用 OpenAI Chat Completions
          兼容协议。放行才公开，不确定、超时或响应格式不对都会进入待审箱。
        </p>
        {loaderData.settingsSaved ? (
          <p className="form-message form-message--success">
            门卫设置收好啦，下一个新评论就按这套规则走。
          </p>
        ) : null}
        <Form className="comment-ai-settings__form" method="post">
          <label className="comment-ai-toggle">
            <input
              type="checkbox"
              name="aiEnabled"
              defaultChecked={
                loaderData.moderationSettings.settings.aiEnabled
              }
            />
            <span aria-hidden="true" />
            <strong>启用 AI 自动审核</strong>
            <small>随时可关，不影响已经贴出的评论</small>
          </label>
          <label>
            <span>CHAT API BASE URL</span>
            <input
              type="url"
              name="apiBaseUrl"
              required
              defaultValue={
                loaderData.moderationSettings.settings.apiBaseUrl
              }
              placeholder="https://api.openai.com/v1"
            />
            <small>请求会发送到此地址的 /chat/completions。</small>
          </label>
          <label>
            <span>MODEL</span>
            <input
              type="text"
              name="model"
              required
              defaultValue={loaderData.moderationSettings.settings.model}
              placeholder="gpt-5.6-luna"
            />
            <small>默认用适合高频小任务的 Luna，也可以填写兼容服务的模型名。</small>
          </label>
          <label className="comment-ai-settings__secret">
            <span>API KEY / 门卫钥匙</span>
            <input
              type="password"
              name="apiKey"
              maxLength={2_049}
              autoComplete="new-password"
              placeholder={
                loaderData.moderationSettings.apiKeyConfigured
                  ? "••••••••（留空就继续用原来的）"
                  : "在这里贴入 API Key"
              }
            />
            <small>
              提交后使用 AES-256-GCM 加密保存，页面不会回显，也不会进入 CMS
              备份；新填写的密钥会优先于服务器环境变量。
            </small>
          </label>
          {loaderData.moderationSettings.apiKeySource === "admin" ? (
            <label className="comment-ai-key-clear">
              <input type="checkbox" name="clearApiKey" />
              <span>清除后台保存的密钥</span>
              <small>保存后会删除密文；若服务器环境变量里另有 key，会自动退回使用它。</small>
            </label>
          ) : null}
          <label className="comment-ai-settings__policy">
            <span>EXTRA SITE POLICY / 站点附加规则</span>
            <textarea
              name="extraPolicy"
              rows={4}
              maxLength={4_000}
              defaultValue={
                loaderData.moderationSettings.settings.extraPolicy
              }
              placeholder="例如：允许对技术方案的尖锐批评；纯广告链接一律转人工审核。"
            />
            <small>
              这只会追加在服务端固定安全策略后面，访客评论永远不会进入高优先级提示词。
            </small>
          </label>
          <div className="comment-ai-settings__foot">
            <p
              className={
                loaderData.moderationSettings.apiKeyConfigured
                  ? "is-ready"
                  : "is-missing"
              }
            >
              <i />
              {loaderData.moderationSettings.storedKeyUnreadable
                ? "以前保存的密钥无法解密，请在上面重新填一次。"
                : loaderData.moderationSettings.apiKeySource === "admin"
                  ? "后台密钥已经加密收好啦（页面永远不会显示明文）。"
                  : loaderData.moderationSettings.apiKeySource === "environment"
                    ? "当前使用服务器环境变量；在上面填入可改为后台管理。"
                    : "还没有 API Key；此时开启会安全地转入人工审核。"}
            </p>
            <button
              className="button button--primary button--small"
              type="submit"
              name="intent"
              value="save-settings"
            >
              保存门卫设置
            </button>
          </div>
        </Form>
        <details className="comment-ai-defense-note">
          <summary>提示词注入是怎么防的？</summary>
          <p>
            固定规则放在 developer 消息；评论只作为 JSON 编码的 user
            数据传入；模型没有工具或数据库权限；输出必须匹配严格 JSON
            Schema，服务端还会再校验一次。任何超时、拒答、乱格式都不会放行。
          </p>
          <p>
            默认会拦截广告引流、诈骗、纯攻击性垃圾话、露骨黄色废料和以操纵审核器为目的的注入；
            正常吐槽、玩笑、技术争论与有上下文的项目链接尽量放行。没有提示词能保证绝对免疫，
            所以真正的兜底是“模型只能给建议，状态机决定能不能公开”。
          </p>
        </details>
      </section>

      <div className="admin-stat-grid comment-stat-grid">
        <article>
          <span>ALL NOTES / 全部</span>
          <strong>{loaderData.stats.total}</strong>
          <small>历史上贴过的每一张</small>
        </article>
        <article>
          <span>WAITING / 待审</span>
          <strong>{loaderData.stats.pending}</strong>
          <small>{loaderData.stats.rejected} 张另被 AI 拦下</small>
        </article>
        <article>
          <span>VISITORS / 留言者</span>
          <strong>{loaderData.stats.authors}</strong>
          <small>不同的 GitHub 路人证</small>
        </article>
        <article>
          <span>REPLIES / 回复</span>
          <strong>{loaderData.stats.replies}</strong>
          <small>楼中楼的小纸片</small>
        </article>
        <article>
          <span>TODAY / 今天</span>
          <strong>{loaderData.stats.today}</strong>
          <small>刚沾上墨水的新纸条</small>
        </article>
        <article>
          <span>SEVEN DAYS / 本周</span>
          <strong>{loaderData.stats.lastSevenDays}</strong>
          <small>最近七天的讨论声</small>
        </article>
      </div>

      <nav className="comment-filter-tabs" aria-label="筛选评论状态">
        {filters.map((filter) => (
          <Link
            key={filter}
            className={loaderData.status === filter ? "is-active" : undefined}
            to={
              filter === "all"
                ? "/admin/comments"
                : `/admin/comments?status=${filter}`
            }
          >
            {filterLabels[filter]} <span>{filterCounts[filter]}</span>
          </Link>
        ))}
      </nav>

      <section className="comment-moderation-list">
        {loaderData.comments.length ? (
          loaderData.comments.map((comment) => (
            <article
              className={`comment-moderation-card comment-moderation-card--${comment.status}`}
              key={comment.id}
            >
              <header>
                {comment.authorAvatarUrl ? (
                  <img
                    src={comment.authorAvatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span aria-hidden="true">
                    {comment.authorName.slice(0, 1) || "?"}
                  </span>
                )}
                <div>
                  <strong>{comment.authorName}</strong>
                  <small>
                    {comment.authorGithubId
                      ? `GITHUB ID ${comment.authorGithubId}`
                      : "GITHUB VISITOR"}
                  </small>
                </div>
                <time dateTime={new Date(comment.createdAt).toISOString()}>
                  {formatTime(comment.createdAt)}
                </time>
                <em>{statusCopy[comment.status].label}</em>
              </header>

              <div className="comment-moderation-card__context">
                <span>{comment.parentId ? "↳ 楼中楼回复" : "○ 顶层纸条"}</span>
                <Link to={`/blog/${comment.postSlug}#comment-${comment.id}`}>
                  《{comment.postTitle}》↗
                </Link>
              </div>

              <p className="comment-moderation-card__body">
                {comment.body ||
                  (comment.status === "deleted"
                    ? "正文已经被揉碎，找不回来啦。"
                    : "这张纸条没有留下可读正文。")}
              </p>
              {comment.moderation.mode === "ai" ? (
                <dl className="comment-moderation-card__ai">
                  <div>
                    <dt>AI 状态</dt>
                    <dd>
                      {comment.moderation.state === "checking"
                        ? "检查中"
                        : comment.moderation.state === "error"
                          ? "接口出错"
                          : comment.moderation.decision
                            ? decisionCopy[comment.moderation.decision]
                            : "已检查"}
                    </dd>
                  </div>
                  <div>
                    <dt>模型</dt>
                    <dd>{comment.moderation.model || "未记录"}</dd>
                  </div>
                  {typeof comment.moderation.confidence === "number" ? (
                    <div>
                      <dt>信心</dt>
                      <dd>{Math.round(comment.moderation.confidence * 100)}%</dd>
                    </div>
                  ) : null}
                  {comment.moderation.categories?.length ? (
                    <div>
                      <dt>标签</dt>
                      <dd>{comment.moderation.categories.join(" · ")}</dd>
                    </div>
                  ) : null}
                  <div className="comment-moderation-card__ai-reason">
                    <dt>判定小纸条</dt>
                    <dd>
                      {comment.moderation.reason ||
                        comment.moderation.error ||
                        "AI 还没留下解释。"}
                    </dd>
                  </div>
                </dl>
              ) : null}
              <small className="comment-moderation-card__state-note">
                {statusCopy[comment.status].note}
              </small>

              {comment.status !== "deleted" ? (
                <Form className="comment-moderation-card__actions" method="post">
                  <input type="hidden" name="id" value={comment.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  {comment.status === "active" ? (
                    <button
                      className="button button--small"
                      type="submit"
                      name="intent"
                      value="hide"
                    >
                      先藏进抽屉
                    </button>
                  ) : comment.status === "hidden" ? (
                    <button
                      className="button button--small"
                      type="submit"
                      name="intent"
                      value="restore"
                    >
                      重新贴回去
                    </button>
                  ) : (
                    <>
                      <button
                        className="button button--small"
                        type="submit"
                        name="intent"
                        value="approve"
                      >
                        主人确认放行
                      </button>
                      {comment.status === "pending" ? (
                        <button
                          className="button button--small"
                          type="submit"
                          name="intent"
                          value="reject"
                        >
                          拒收这张
                        </button>
                      ) : null}
                    </>
                  )}
                  {loaderData.moderationSettings.settings.aiEnabled ? (
                    <button
                      className="button button--small"
                      type="submit"
                      name="intent"
                      value="recheck"
                    >
                      让 AI 再闻一次
                    </button>
                  ) : null}
                  <button
                    className="button button--small button--danger"
                    type="submit"
                    name="intent"
                    value="delete"
                    onClick={(event) => {
                      if (
                        !window.confirm(
                          "这会永久清空评论正文，而且不能撤回。真的揉掉吗？",
                        )
                      ) {
                        event.preventDefault();
                      }
                    }}
                  >
                    永久揉掉
                  </button>
                </Form>
              ) : null}
            </article>
          ))
        ) : (
          <div className="dashboard-empty comment-moderation-empty">
            <span aria-hidden="true">♡</span>
            <div>
              <strong>这一格空空的</strong>
              <p>当前筛选里没有纸条，值班室可以先偷懒一会儿。</p>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
