import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNotNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import {
  getEnvironmentAIModerationApiKey,
  moderateCommentText,
  normalizeChatBaseUrl,
} from "./ai-moderation.server";
import { getDb, hasDatabase } from "./db.server";
import {
  comments,
  commentSecrets,
  commentSettings,
  posts,
} from "./schema.server";
import {
  decryptStoredSecret,
  encryptStoredSecret,
} from "./secret-storage.server";
import type {
  AdminCommentRecord,
  CommentSettingsRecord,
  CommentStatus,
  PublicCommentRecord,
} from "./types";

const COMMENT_COOLDOWN_MS = 15_000;

export class CommentMutationError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "CommentMutationError";
  }
}

function defaultCommentSettings(): CommentSettingsRecord {
  return {
    id: "main",
    aiEnabled: false,
    apiBaseUrl:
      process.env.AI_MODERATION_BASE_URL ?? "https://api.openai.com/v1",
    model: process.env.AI_MODERATION_MODEL ?? "gpt-5.6-luna",
    extraPolicy: "",
  };
}

async function loadCommentConfiguration() {
  if (!hasDatabase()) {
    return {
      settings: defaultCommentSettings(),
      storedApiKey: "",
      storedKeyUnreadable: false,
    };
  }

  const [[saved], [savedSecret]] = await Promise.all([
    getDb()
      .select()
      .from(commentSettings)
      .where(eq(commentSettings.id, "main"))
      .limit(1),
    getDb()
      .select({ ciphertext: commentSecrets.apiKeyCiphertext })
      .from(commentSecrets)
      .where(eq(commentSecrets.id, "main"))
      .limit(1),
  ]);
  let storedApiKey = "";
  let storedKeyUnreadable = false;
  if (savedSecret?.ciphertext) {
    try {
      storedApiKey = decryptStoredSecret(savedSecret.ciphertext);
    } catch {
      storedKeyUnreadable = true;
    }
  }

  return {
    settings: (saved as CommentSettingsRecord | undefined) ??
      defaultCommentSettings(),
    storedApiKey,
    storedKeyUnreadable,
  };
}

export async function getCommentSettings() {
  const loaded = await loadCommentConfiguration();
  const environmentApiKey = getEnvironmentAIModerationApiKey();
  const apiKeySource = loaded.storedApiKey
    ? ("admin" as const)
    : environmentApiKey
      ? ("environment" as const)
      : null;
  return {
    settings: loaded.settings,
    apiKeyConfigured: Boolean(loaded.storedApiKey || environmentApiKey),
    apiKeySource,
    storedKeyUnreadable: loaded.storedKeyUnreadable,
  };
}

export async function saveCommentSettings(input: {
  aiEnabled: boolean;
  apiBaseUrl: string;
  model: string;
  extraPolicy: string;
  apiKey?: string;
  clearApiKey?: boolean;
}) {
  if (!hasDatabase()) {
    throw new CommentMutationError("评论设置需要数据库。", 503);
  }

  let apiBaseUrl: string;
  try {
    apiBaseUrl = normalizeChatBaseUrl(input.apiBaseUrl);
  } catch (error) {
    throw new CommentMutationError(
      error instanceof Error ? error.message : "AI 接口地址无效。",
    );
  }
  const model = input.model.trim().slice(0, 160);
  if (!model) {
    throw new CommentMutationError("模型名不能空着。");
  }
  const apiKey = input.apiKey?.trim() ?? "";
  if (apiKey.length > 2_048) {
    throw new CommentMutationError("API Key 长得有点离谱，请检查后再填。");
  }
  if (apiKey && input.clearApiKey) {
    throw new CommentMutationError("新密钥和清除密钥不能同时勾选。");
  }
  let apiKeyCiphertext = "";
  try {
    apiKeyCiphertext = apiKey ? encryptStoredSecret(apiKey) : "";
  } catch (error) {
    throw new CommentMutationError(
      error instanceof Error ? error.message : "API Key 加密失败。",
      503,
    );
  }

  return getDb().transaction(async (tx) => {
    const [saved] = await tx
      .insert(commentSettings)
      .values({
        id: "main",
        aiEnabled: input.aiEnabled,
        apiBaseUrl,
        model,
        extraPolicy: input.extraPolicy.trim().slice(0, 4_000),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: commentSettings.id,
        set: {
          aiEnabled: input.aiEnabled,
          apiBaseUrl,
          model,
          extraPolicy: input.extraPolicy.trim().slice(0, 4_000),
          updatedAt: new Date(),
        },
      })
      .returning();

    if (apiKeyCiphertext) {
      await tx
        .insert(commentSecrets)
        .values({
          id: "main",
          apiKeyCiphertext,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: commentSecrets.id,
          set: { apiKeyCiphertext, updatedAt: new Date() },
        });
    } else if (input.clearApiKey) {
      await tx
        .delete(commentSecrets)
        .where(eq(commentSecrets.id, "main"));
    }
    return saved;
  });
}

function publicPostCondition(postId: string, now = new Date()) {
  return and(
    eq(posts.id, postId),
    or(
      eq(posts.status, "published"),
      and(eq(posts.status, "scheduled"), lte(posts.scheduledAt, now)),
    ),
  );
}

function cleanPublicComment(
  row: typeof comments.$inferSelect,
  viewerId?: string | null,
): PublicCommentRecord {
  return {
    ...row,
    body: row.status === "active" ? row.body : "",
    isOwner: row.status === "active" && row.authorId === viewerId,
  };
}

export async function listPublicComments(
  postId: string,
  viewerId?: string | null,
) {
  if (!hasDatabase()) return [];
  const rows = await getDb()
    .select()
    .from(comments)
    .where(
      and(
        eq(comments.postId, postId),
        inArray(comments.status, ["active", "hidden"]),
        isNotNull(comments.publishedAt),
      ),
    )
    .orderBy(asc(comments.createdAt));
  return rows.map((row) => cleanPublicComment(row, viewerId));
}

async function applyAIReview(
  comment: typeof comments.$inferSelect,
  settings: CommentSettingsRecord,
  apiKey: string,
) {
  const checkedAt = new Date().toISOString();
  const result = await moderateCommentText({
    body: comment.body,
    authorId: comment.authorId,
    settings,
    apiKey,
  });
  const nextStatus: CommentStatus = result.ok
    ? result.decision === "allow"
      ? "active"
      : result.decision === "block"
        ? "rejected"
        : "pending"
    : "pending";
  const moderation = result.ok
    ? {
        mode: "ai" as const,
        state: "complete" as const,
        decision: result.decision,
        confidence: result.confidence,
        categories: result.categories,
        reason: result.reason,
        model: result.model,
        checkedAt,
      }
    : {
        mode: "ai" as const,
        state: "error" as const,
        model: result.model,
        checkedAt,
        error: result.error,
      };

  const [saved] = await getDb()
    .update(comments)
    .set({
      status: nextStatus,
      moderation,
      ...(nextStatus === "active" ? { publishedAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(comments.id, comment.id),
        eq(comments.status, "pending"),
      ),
    )
    .returning();

  return {
    comment: saved ?? { ...comment, status: nextStatus, moderation },
    publication: nextStatus === "active"
      ? ("published" as const)
      : ("review" as const),
  };
}

export async function createComment(input: {
  postId: string;
  parentId?: string | null;
  authorId: string;
  authorGithubId?: string | null;
  authorName: string;
  authorAvatarUrl?: string | null;
  body: string;
}) {
  if (!hasDatabase()) {
    throw new CommentMutationError("评论抽屉还没接上数据库。", 503);
  }

  const db = getDb();
  const [post] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(publicPostCondition(input.postId))
    .limit(1);
  if (!post) {
    throw new CommentMutationError("这篇文章现在不接受纸条。", 404);
  }

  const [recent] = await db
    .select({ createdAt: comments.createdAt })
    .from(comments)
    .where(eq(comments.authorId, input.authorId))
    .orderBy(desc(comments.createdAt))
    .limit(1);
  if (
    recent &&
    Date.now() - new Date(recent.createdAt).getTime() < COMMENT_COOLDOWN_MS
  ) {
    throw new CommentMutationError("手速太快啦，等十五秒让墨迹干一干。", 429);
  }

  let parentId: string | null = null;
  if (input.parentId) {
    const [parent] = await db
      .select({
        id: comments.id,
        postId: comments.postId,
        parentId: comments.parentId,
        status: comments.status,
      })
      .from(comments)
      .where(eq(comments.id, input.parentId))
      .limit(1);
    if (
      !parent ||
      parent.postId !== input.postId ||
      parent.status !== "active"
    ) {
      throw new CommentMutationError("要回复的纸条已经不在这里啦。", 404);
    }
    parentId = parent.parentId ?? parent.id;
  }

  const loaded = await loadCommentConfiguration();
  const settings = loaded.settings;
  const apiKey =
    loaded.storedApiKey || getEnvironmentAIModerationApiKey();
  const aiEnabled = settings.aiEnabled;
  const [saved] = await db
    .insert(comments)
    .values({
      postId: input.postId,
      parentId,
      authorId: input.authorId,
      authorGithubId: input.authorGithubId?.slice(0, 80) || null,
      authorName: input.authorName.trim().slice(0, 120) || "GitHub 路人",
      authorAvatarUrl: input.authorAvatarUrl?.slice(0, 1_000) || null,
      body: input.body,
      status: aiEnabled ? "pending" : "active",
      publishedAt: aiEnabled ? null : new Date(),
      moderation: aiEnabled
        ? {
            mode: "ai",
            state: "checking",
            model: settings.model,
          }
        : { mode: "disabled", state: "complete" },
    })
    .returning();

  if (!aiEnabled) {
    return { comment: saved, publication: "published" as const };
  }
  return applyAIReview(saved, settings, apiKey);
}

export async function recheckCommentWithAI(id: string) {
  if (!hasDatabase()) {
    throw new CommentMutationError("评论抽屉还没接上数据库。", 503);
  }
  const loaded = await loadCommentConfiguration();
  const settings = loaded.settings;
  const apiKey =
    loaded.storedApiKey || getEnvironmentAIModerationApiKey();
  if (!settings.aiEnabled) {
    throw new CommentMutationError("先打开 AI 审核开关再重新检查。", 409);
  }

  const [comment] = await getDb()
    .select()
    .from(comments)
    .where(eq(comments.id, id))
    .limit(1);
  if (!comment || comment.status === "deleted" || !comment.body) {
    throw new CommentMutationError("这张纸条已经没有可审核的正文。", 404);
  }

  const [checking] = await getDb()
    .update(comments)
    .set({
      status: "pending",
      moderation: {
        mode: "ai",
        state: "checking",
        model: settings.model,
      },
      updatedAt: new Date(),
    })
    .where(eq(comments.id, id))
    .returning();
  return applyAIReview(checking, settings, apiKey);
}

export async function deleteOwnComment(input: {
  id: string;
  postId: string;
  authorId: string;
}) {
  if (!hasDatabase()) {
    throw new CommentMutationError("评论抽屉还没接上数据库。", 503);
  }
  const [deleted] = await getDb()
    .update(comments)
    .set({
      body: "",
      status: "deleted",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(comments.id, input.id),
        eq(comments.postId, input.postId),
        eq(comments.authorId, input.authorId),
        eq(comments.status, "active"),
      ),
    )
    .returning({ id: comments.id });
  if (!deleted) {
    throw new CommentMutationError("这张纸条不能由当前账号揉掉。", 403);
  }
}

export async function listAdminComments(
  status: CommentStatus | "all" = "all",
) {
  if (!hasDatabase()) return [];
  const query = getDb()
    .select({
      ...getTableColumns(comments),
      postTitle: posts.title,
      postSlug: posts.slug,
    })
    .from(comments)
    .innerJoin(posts, eq(posts.id, comments.postId));
  const rows =
    status === "all"
      ? await query.orderBy(desc(comments.createdAt)).limit(250)
      : await query
          .where(eq(comments.status, status))
          .orderBy(desc(comments.createdAt))
          .limit(250);
  return rows as AdminCommentRecord[];
}

export async function getCommentStats() {
  if (!hasDatabase()) {
    return {
      total: 0,
      active: 0,
      pending: 0,
      rejected: 0,
      hidden: 0,
      deleted: 0,
      replies: 0,
      authors: 0,
      today: 0,
      lastSevenDays: 0,
    };
  }

  const [row] = await getDb()
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${comments.status} = 'active')::int`,
      pending: sql<number>`count(*) filter (where ${comments.status} = 'pending')::int`,
      rejected: sql<number>`count(*) filter (where ${comments.status} = 'rejected')::int`,
      hidden: sql<number>`count(*) filter (where ${comments.status} = 'hidden')::int`,
      deleted: sql<number>`count(*) filter (where ${comments.status} = 'deleted')::int`,
      replies: sql<number>`count(*) filter (where ${comments.parentId} is not null)::int`,
      authors: sql<number>`count(distinct ${comments.authorId})::int`,
      today: sql<number>`count(*) filter (where ${comments.createdAt} >= date_trunc('day', now()))::int`,
      lastSevenDays: sql<number>`count(*) filter (where ${comments.createdAt} >= now() - interval '7 days')::int`,
    })
    .from(comments);

  return {
    total: Number(row?.total ?? 0),
    active: Number(row?.active ?? 0),
    pending: Number(row?.pending ?? 0),
    rejected: Number(row?.rejected ?? 0),
    hidden: Number(row?.hidden ?? 0),
    deleted: Number(row?.deleted ?? 0),
    replies: Number(row?.replies ?? 0),
    authors: Number(row?.authors ?? 0),
    today: Number(row?.today ?? 0),
    lastSevenDays: Number(row?.lastSevenDays ?? 0),
  };
}

type ModerationIntent =
  | "hide"
  | "restore"
  | "approve"
  | "reject"
  | "delete";

export async function moderateComment(input: {
  id: string;
  intent: ModerationIntent;
  moderatorId: string;
}) {
  if (!hasDatabase()) {
    throw new CommentMutationError("评论抽屉还没接上数据库。", 503);
  }

  const now = new Date();
  const values =
    input.intent === "hide"
      ? {
          status: "hidden" as const,
          moderatedBy: input.moderatorId,
          moderatedAt: now,
          updatedAt: now,
        }
      : input.intent === "restore" || input.intent === "approve"
        ? {
            status: "active" as const,
            moderatedBy: input.moderatorId,
            moderatedAt: now,
            publishedAt: now,
            updatedAt: now,
          }
        : input.intent === "reject"
          ? {
              status: "rejected" as const,
              moderatedBy: input.moderatorId,
              moderatedAt: now,
              updatedAt: now,
            }
          : {
              status: "deleted" as const,
              body: "",
              moderatedBy: input.moderatorId,
              moderatedAt: now,
              updatedAt: now,
            };

  const condition =
    input.intent === "restore"
      ? and(eq(comments.id, input.id), eq(comments.status, "hidden"))
      : input.intent === "approve"
        ? and(
            eq(comments.id, input.id),
            inArray(comments.status, ["pending", "rejected"]),
          )
        : input.intent === "reject"
          ? and(eq(comments.id, input.id), eq(comments.status, "pending"))
          : input.intent === "hide"
            ? and(eq(comments.id, input.id), eq(comments.status, "active"))
            : and(
                eq(comments.id, input.id),
                sql`${comments.status} <> 'deleted'`,
              );
  const [saved] = await getDb()
    .update(comments)
    .set(values)
    .where(condition)
    .returning({ id: comments.id });
  if (!saved) {
    throw new CommentMutationError("这张纸条的状态已经变过啦，刷新后再看一眼。", 409);
  }
}
