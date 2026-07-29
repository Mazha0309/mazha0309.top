import { describe, expect, it } from "vitest";
import {
  buildCommentThreads,
  COMMENT_BODY_MAX,
  normalizeCommentBody,
} from "../app/lib/comments";
import type { PublicCommentRecord } from "../app/lib/types";

function comment(
  id: string,
  parentId: string | null = null,
): PublicCommentRecord {
  return {
    id,
    postId: "post-1",
    parentId,
    authorId: `author-${id}`,
    authorName: `路人 ${id}`,
    body: `纸条 ${id}`,
    status: "active",
    moderation: {},
    isOwner: false,
    createdAt: "2026-07-29T00:00:00.000Z",
    updatedAt: "2026-07-29T00:00:00.000Z",
  };
}

describe("comment body validation", () => {
  it("normalizes line endings and trims the paper note", () => {
    expect(normalizeCommentBody("  第一行\r\n第二行  ")).toEqual({
      ok: true,
      body: "第一行\n第二行",
    });
  });

  it("rejects empty and overlong notes", () => {
    expect(normalizeCommentBody(" \n ")).toMatchObject({ ok: false });
    expect(normalizeCommentBody("喵".repeat(COMMENT_BODY_MAX + 1))).toMatchObject({
      ok: false,
    });
  });

  it("counts emoji as one visible character", () => {
    expect(normalizeCommentBody("♡".repeat(COMMENT_BODY_MAX))).toMatchObject({
      ok: true,
    });
  });
});

describe("comment threads", () => {
  it("groups one-level replies under their paper note", () => {
    const threads = buildCommentThreads([
      comment("root"),
      comment("reply-a", "root"),
      comment("reply-b", "root"),
    ]);
    expect(threads).toHaveLength(1);
    expect(threads[0]?.replies.map((reply) => reply.id)).toEqual([
      "reply-a",
      "reply-b",
    ]);
  });

  it("keeps an orphaned reply readable as a root note", () => {
    const threads = buildCommentThreads([comment("orphan", "missing")]);
    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({ id: "orphan", parentId: null });
  });
});
