import type {
  CommentThread,
  PublicCommentRecord,
} from "./types";

export const COMMENT_BODY_MAX = 1_200;

export type CommentBodyResult =
  | { ok: true; body: string }
  | { ok: false; error: string };

export function normalizeCommentBody(raw: unknown): CommentBodyResult {
  if (typeof raw !== "string") {
    return { ok: false, error: "这张纸条好像不是文字，重新写一下嘛。" };
  }

  const body = raw.replace(/\r\n?/gu, "\n").trim();
  if (!body) {
    return { ok: false, error: "空纸条会被风吹走，至少写一个字啦。" };
  }
  if (Array.from(body).length > COMMENT_BODY_MAX) {
    return {
      ok: false,
      error: `这张纸条塞了超过 ${COMMENT_BODY_MAX} 个字，分成两张再贴吧。`,
    };
  }

  return { ok: true, body };
}

export function buildCommentThreads(
  comments: PublicCommentRecord[],
): CommentThread[] {
  const threads: CommentThread[] = [];
  const roots = new Map<string, CommentThread>();

  for (const comment of comments) {
    if (comment.parentId) continue;
    const thread = { ...comment, replies: [] };
    threads.push(thread);
    roots.set(comment.id, thread);
  }

  for (const comment of comments) {
    if (!comment.parentId) continue;
    const parent = roots.get(comment.parentId);
    if (parent) {
      parent.replies.push(comment);
      continue;
    }

    // A moderator or an old import may remove a parent independently. Keep the
    // reply readable instead of letting it disappear into an orphaned thread.
    const thread = { ...comment, parentId: null, replies: [] };
    threads.push(thread);
    roots.set(comment.id, thread);
  }

  return threads;
}
