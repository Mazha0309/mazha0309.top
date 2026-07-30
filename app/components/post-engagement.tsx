import { useEffect, useMemo, useState } from "react";
import { useFetcher } from "react-router";
import { authClient } from "../lib/auth-client";
import { buildAuthCallbackUrl } from "../lib/content-utils";
import {
  buildCommentThreads,
  COMMENT_BODY_MAX,
} from "../lib/comments";
import type {
  CommentThread,
  PublicCommentRecord,
} from "../lib/types";

type CommentViewer = {
  id: string;
  name: string;
  image?: string | null;
  isAdmin: boolean;
};

type CommentActionData =
  | {
      ok: true;
      intent: "create" | "delete-own";
      publication?: "published" | "review";
    }
  | { ok: false; error: string };

export function PageViewBeacon({ path }: { path: string }) {
  useEffect(() => {
    const navigatorWithPrivacy = navigator as Navigator & {
      globalPrivacyControl?: boolean;
    };
    if (
      navigator.doNotTrack === "1" ||
      navigatorWithPrivacy.globalPrivacyControl
    ) {
      return;
    }
    void fetch("/api/analytics/view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path }),
      keepalive: true,
    });
  }, [path]);

  return null;
}

function formatCommentTime(value: Date | string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function Avatar({
  name,
  src,
}: {
  name: string;
  src?: string | null;
}) {
  return src ? (
    <img className="comment-avatar" src={src} alt="" referrerPolicy="no-referrer" />
  ) : (
    <span className="comment-avatar comment-avatar--fallback" aria-hidden="true">
      {name.trim().slice(0, 1).toLocaleUpperCase() || "?"}
    </span>
  );
}

function CommentBody({
  comment,
}: {
  comment: PublicCommentRecord;
}) {
  if (comment.status === "hidden") {
    return (
      <p className="comment-paper__withheld">
        这张纸条被主人先收进抽屉啦。
      </p>
    );
  }
  if (comment.status === "deleted") {
    return (
      <p className="comment-paper__withheld">
        纸条已经被揉掉，只剩下一点折痕。
      </p>
    );
  }
  return <p className="comment-paper__body">{comment.body}</p>;
}

function CommentPaper({
  comment,
  viewer,
  submitting,
  canReply,
  onReply,
}: {
  comment: PublicCommentRecord;
  viewer: CommentViewer | null;
  submitting: boolean;
  canReply: boolean;
  onReply?: () => void;
}) {
  const fetcher = useFetcher<CommentActionData>();
  const busy = submitting || fetcher.state !== "idle";

  return (
    <article
      className={`comment-paper comment-paper--${comment.status}`}
      id={`comment-${comment.id}`}
    >
      <header className="comment-paper__head">
        <Avatar name={comment.authorName} src={comment.authorAvatarUrl} />
        <div>
          <strong>{comment.authorName}</strong>
          <span>
            {comment.authorGithubId ? `GH:${comment.authorGithubId}` : "GITHUB VISITOR"}
            {viewer?.isAdmin && comment.authorId === viewer.id ? " · 站点主人" : ""}
          </span>
        </div>
        <time dateTime={new Date(comment.createdAt).toISOString()}>
          {formatCommentTime(comment.createdAt)}
        </time>
      </header>

      <CommentBody comment={comment} />

      {comment.status === "active" ? (
        <footer className="comment-paper__actions">
          {canReply && onReply ? (
            <button
              className="comment-text-button"
              type="button"
              onClick={onReply}
            >
              ↳ 回一张小纸条
            </button>
          ) : null}
          {comment.isOwner ? (
            <fetcher.Form
              method="post"
              onSubmit={(event) => {
                if (!window.confirm("真的要把这张纸条揉掉吗？回复会保留。")) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="commentId" value={comment.id} />
              <button
                className="comment-text-button comment-text-button--danger"
                type="submit"
                name="intent"
                value="delete-own"
                disabled={busy}
              >
                揉掉自己的纸条
              </button>
            </fetcher.Form>
          ) : null}
        </footer>
      ) : null}
      {fetcher.data && !fetcher.data.ok ? (
        <p className="comment-inline-error" role="alert">
          {fetcher.data.error}
        </p>
      ) : null}
    </article>
  );
}

function ReplyComposer({
  thread,
  body,
  busy,
  error,
  onBodyChange,
  onCancel,
  onSent,
}: {
  thread: CommentThread;
  body: string;
  busy: boolean;
  error?: string;
  onBodyChange: (value: string) => void;
  onCancel: () => void;
  onSent: (publication: "published" | "review") => void;
}) {
  const fetcher = useFetcher<CommentActionData>();

  useEffect(() => {
    if (fetcher.data?.ok && fetcher.data.intent === "create") {
      onBodyChange("");
      onSent(fetcher.data.publication ?? "published");
      onCancel();
    }
  }, [fetcher.data, onBodyChange, onCancel, onSent]);

  const message =
    fetcher.data && !fetcher.data.ok ? fetcher.data.error : error;

  return (
    <fetcher.Form className="comment-reply-form" method="post">
      <input type="hidden" name="intent" value="create" />
      <input type="hidden" name="parentId" value={thread.id} />
      <label htmlFor={`reply-${thread.id}`}>
        回给 {thread.authorName} 的小纸条
      </label>
      <textarea
        id={`reply-${thread.id}`}
        name="body"
        value={body}
        maxLength={COMMENT_BODY_MAX}
        rows={4}
        autoFocus
        onChange={(event) => onBodyChange(event.currentTarget.value)}
        placeholder="悄悄写在这里，别只画一个句号哦……"
      />
      <div>
        <small>{Array.from(body).length} / {COMMENT_BODY_MAX}</small>
        <button
          className="comment-text-button"
          type="button"
          onClick={onCancel}
        >
          算了，收回去
        </button>
        <button
          className="button button--small"
          type="submit"
          disabled={!body.trim() || busy || fetcher.state !== "idle"}
        >
          {fetcher.state === "submitting" ? "正在贴……" : "贴上回复"}
        </button>
      </div>
      {message ? (
        <p className="comment-inline-error" role="alert">{message}</p>
      ) : null}
    </fetcher.Form>
  );
}

export function PostComments({
  comments,
  viewer,
  githubConfigured,
  developmentIdentity,
}: {
  comments: PublicCommentRecord[];
  viewer: CommentViewer | null;
  githubConfigured: boolean;
  developmentIdentity: boolean;
}) {
  const fetcher = useFetcher<CommentActionData>();
  const [draft, setDraft] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [notice, setNotice] = useState("");
  const threads = useMemo(() => buildCommentThreads(comments), [comments]);
  const activeCount = comments.filter(
    (comment) => comment.status === "active",
  ).length;

  useEffect(() => {
    if (fetcher.data?.ok && fetcher.data.intent === "create") {
      setDraft("");
      setNotice(
        fetcher.data.publication === "review"
          ? "AI 把纸条送进了待审抽屉，主人看过以后才会贴出来。"
          : "贴好啦，墨迹还新鲜着呢 ♡",
      );
    }
  }, [fetcher.data]);

  const actionError =
    fetcher.data && !fetcher.data.ok ? fetcher.data.error : "";
  const busy = fetcher.state !== "idle";

  return (
    <section className="comments-section" aria-labelledby="comments-title">
      <div className="section-title-row">
        <div>
          <span className="micro-label">PAPER MAILBOX / {activeCount} NOTES</span>
          <h2 id="comments-title">在纸条背面说两句</h2>
          <p>登录只为了认出是谁贴的，不会把你的邮箱展示出来。</p>
        </div>
        <span className="comments-stamp" aria-hidden="true">
          留言
          <small>OPEN</small>
        </span>
      </div>

      {viewer ? (
        <div className="comment-viewer">
          <Avatar name={viewer.name} src={viewer.image} />
          <p>
            <span>COMMENTING AS</span>
            <strong>{viewer.name}</strong>
          </p>
          {viewer.isAdmin ? <em>主人巡逻中</em> : <em>GitHub 路人证</em>}
          {developmentIdentity ? (
            <span
              className="comment-dev-identity"
              title="本地开发绕过已开启，身份由服务端固定。"
            >
              DEV 固定身份
            </span>
          ) : (
            <button
              className="comment-text-button"
              type="button"
              title="只退出本站的评论身份，不会退出 GitHub。"
              onClick={async () => {
                await authClient.signOut();
                window.location.reload();
              }}
            >
              退出评论身份
            </button>
          )}
        </div>
      ) : (
        <div className="comment-login-note">
          <span aria-hidden="true">↳</span>
          <div>
            <strong>先领一张 GitHub 路人证</strong>
            <p>点一下就能留言，不会因此拿到后台钥匙。</p>
          </div>
          <button
            className="button button--small"
            type="button"
            disabled={!githubConfigured || loginBusy}
            onClick={async () => {
              setLoginBusy(true);
              setLoginError("");
              const callbackURL = buildAuthCallbackUrl(
                `${window.location.pathname}${window.location.search}`,
                window.location.origin,
              );
              const result = await authClient.signIn.social({
                provider: "github",
                callbackURL,
              });
              if (result?.error) {
                setLoginError(result.error.message ?? "GitHub 登录失败啦。");
                setLoginBusy(false);
              }
            }}
          >
            {loginBusy ? "正在盖章……" : "用 GitHub 登录 ↗"}
          </button>
          {!githubConfigured ? (
            <small>主人还没把 GitHub OAuth 接好，这扇小窗暂时打不开。</small>
          ) : null}
          {loginError ? <small role="alert">{loginError}</small> : null}
        </div>
      )}

      {viewer ? (
        <fetcher.Form className="comment-composer" method="post">
          <span className="comment-composer__tape" aria-hidden="true" />
          <input type="hidden" name="intent" value="create" />
          <label htmlFor="new-comment">
            <span>NEW NOTE / 新纸条</span>
            写点有内容的，不许只来一句“前排”哦。
          </label>
          <textarea
            id="new-comment"
            name="body"
            value={draft}
            maxLength={COMMENT_BODY_MAX}
            rows={5}
            onChange={(event) => setDraft(event.currentTarget.value)}
            placeholder="比如：哪一段很有用、哪里没讲明白，或者你又想出了什么奇怪东西……"
          />
          <footer>
            <small>{Array.from(draft).length} / {COMMENT_BODY_MAX}</small>
            <button
              className="button button--primary button--small"
              type="submit"
              disabled={!draft.trim() || busy}
            >
              {busy ? "墨迹还没干……" : "把纸条贴上去 ♡"}
            </button>
          </footer>
          {actionError ? (
            <p className="comment-inline-error" role="alert">{actionError}</p>
          ) : null}
        </fetcher.Form>
      ) : null}

      {notice ? (
        <p className="comment-success-note" role="status">
          {notice}
          <button type="button" onClick={() => setNotice("")} aria-label="关闭提示">
            ×
          </button>
        </p>
      ) : null}

      <div className="comment-threads" aria-live="polite">
        {threads.length ? (
          threads.map((thread) => (
            <section className="comment-thread" key={thread.id}>
              <CommentPaper
                comment={thread}
                viewer={viewer}
                submitting={busy}
                canReply={Boolean(viewer)}
                onReply={
                  viewer
                    ? () => {
                        setReplyDraft("");
                        setReplyingTo(thread.id);
                      }
                    : undefined
                }
              />
              {replyingTo === thread.id ? (
                <ReplyComposer
                  thread={thread}
                  body={replyDraft}
                  busy={busy}
                  onBodyChange={setReplyDraft}
                  onCancel={() => setReplyingTo(null)}
                  onSent={(publication) => {
                    setNotice(
                      publication === "review"
                        ? "这张回复先去待审抽屉坐一会儿，主人确认后再露面。"
                        : "回复已经贴到楼下啦 ♡",
                    );
                  }}
                />
              ) : null}
              {thread.replies.length ? (
                <div className="comment-replies">
                  {thread.replies.map((reply) => (
                    <CommentPaper
                      key={reply.id}
                      comment={reply}
                      viewer={viewer}
                      submitting={busy}
                      canReply={false}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          ))
        ) : (
          <div className="comments-empty">
            <span aria-hidden="true">♡</span>
            <div>
              <strong>背面还干干净净</strong>
              <p>第一张有内容的小纸条，可以被你抢走。</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
