import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type {
  CommentModerationSnapshot,
  SiteCustomization,
} from "./types";

export const siteProfiles = pgTable("site_profiles", {
  id: text("id").primaryKey().default("main"),
  displayName: text("display_name").notNull(),
  handle: text("handle").notNull(),
  heroEyebrow: text("hero_eyebrow").notNull(),
  heroTitle: text("hero_title").notNull(),
  heroIntro: text("hero_intro").notNull(),
  bio: text("bio").notNull(),
  avatarUrl: text("avatar_url").notNull(),
  location: text("location").notNull().default("Internet"),
  statusText: text("status_text").notNull().default("折腾中"),
  email: text("email").notNull().default(""),
  customization: jsonb("customization")
    .$type<Partial<SiteCustomization>>()
    .notNull()
    .default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const contentLinks = pgTable(
  "content_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind", { enum: ["nav", "social"] }).notNull(),
    label: text("label").notNull(),
    url: text("url").notNull(),
    note: text("note"),
    position: integer("position").notNull().default(0),
    enabled: boolean("enabled").notNull().default(true),
  },
  (table) => [index("content_links_kind_position_idx").on(table.kind, table.position)],
);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    contentMdx: text("content_mdx").notNull().default(""),
    contentText: text("content_text").notNull().default(""),
    tags: text("tags").array().notNull().default([]),
    coverUrl: text("cover_url"),
    status: text("status", {
      enum: ["draft", "scheduled", "published"],
    })
      .notNull()
      .default("draft"),
    featured: boolean("featured").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("posts_slug_idx").on(table.slug),
    index("posts_publication_idx").on(table.status, table.publishedAt),
  ],
);

export const postSlugs = pgTable(
  "post_slugs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("post_slugs_slug_idx").on(table.slug)],
);

export const postRevisions = pgTable(
  "post_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    contentMdx: text("content_mdx").notNull(),
    snapshot: jsonb("snapshot")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    reason: text("reason").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("post_revisions_post_created_idx").on(table.postId, table.createdAt)],
);

export const commentSettings = pgTable("comment_settings", {
  id: text("id").primaryKey().default("main"),
  aiEnabled: boolean("ai_enabled").notNull().default(false),
  apiBaseUrl: text("api_base_url")
    .notNull()
    .default("https://api.openai.com/v1"),
  model: text("model").notNull().default("gpt-5.6-luna"),
  extraPolicy: text("extra_policy").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Kept separate from content settings so CMS backups never contain API secrets.
// The value is additionally encrypted at rest before it reaches this table.
export const commentSecrets = pgTable("comment_secrets", {
  id: text("id").primaryKey().default("main"),
  apiKeyCiphertext: text("api_key_ciphertext").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references(
      (): AnyPgColumn => comments.id,
      { onDelete: "cascade" },
    ),
    authorId: text("author_id").notNull(),
    authorGithubId: text("author_github_id"),
    authorName: text("author_name").notNull(),
    authorAvatarUrl: text("author_avatar_url"),
    body: text("body").notNull(),
    status: text("status", {
      enum: ["active", "pending", "rejected", "hidden", "deleted"],
    })
      .notNull()
      .default("active"),
    moderation: jsonb("moderation")
      .$type<CommentModerationSnapshot>()
      .notNull()
      .default({}),
    moderatedBy: text("moderated_by"),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("comments_post_created_idx").on(table.postId, table.createdAt),
    index("comments_parent_idx").on(table.parentId),
    index("comments_status_created_idx").on(table.status, table.createdAt),
    index("comments_author_created_idx").on(table.authorId, table.createdAt),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    bodyMdx: text("body_mdx").notNull().default(""),
    stack: text("stack").array().notNull().default([]),
    repoUrl: text("repo_url"),
    liveUrl: text("live_url"),
    coverUrl: text("cover_url"),
    accent: text("accent").notNull().default("pink"),
    iconMode: text("icon_mode", {
      enum: ["random", "preset", "custom", "image"],
    })
      .notNull()
      .default("random"),
    iconValue: text("icon_value").notNull().default("spark"),
    iconShape: text("icon_shape", {
      enum: [
        "random",
        "blob",
        "circle",
        "rounded",
        "diamond",
        "hexagon",
        "ticket",
        "burst",
        "flower",
      ],
    })
      .notNull()
      .default("random"),
    featured: boolean("featured").notNull().default(false),
    position: integer("position").notNull().default(0),
    statusLabel: text("status_label").notNull().default("MAKING"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("projects_slug_idx").on(table.slug),
    index("projects_position_idx").on(table.position),
  ],
);

export const friendLinks = pgTable(
  "friend_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    avatarUrl: text("avatar_url"),
    description: text("description").notNull().default(""),
    accent: text("accent").notNull().default("pink"),
    position: integer("position").notNull().default(0),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("friend_links_position_idx").on(table.position),
    uniqueIndex("friend_links_url_idx").on(table.url),
  ],
);

export const pages = pgTable("pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  eyebrow: text("eyebrow").notNull().default("PAGE FILE"),
  contentMdx: text("content_mdx").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const musicTracks = pgTable(
  "music_tracks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    artist: text("artist").notNull().default(""),
    audioUrl: text("audio_url").notNull(),
    sourceFingerprint: text("source_fingerprint"),
    coverUrl: text("cover_url"),
    lyrics: text("lyrics").notNull().default(""),
    position: integer("position").notNull().default(0),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("music_tracks_enabled_position_idx").on(
      table.enabled,
      table.position,
    ),
    uniqueIndex("music_tracks_source_fingerprint_idx").on(
      table.sourceFingerprint,
    ),
  ],
);

export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  storageKey: text("storage_key").notNull().unique(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  alt: text("alt").notNull(),
  width: integer("width"),
  height: integer("height"),
  sizeBytes: integer("size_bytes").notNull(),
  variants: jsonb("variants")
    .$type<Record<string, string>>()
    .notNull()
    .default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const analyticsDaily = pgTable(
  "analytics_daily",
  {
    day: date("day").notNull(),
    path: text("path").notNull(),
    views: integer("views").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.day, table.path] }),
    index("analytics_day_idx").on(table.day),
  ],
);

export const analyticsVisitors = pgTable(
  "analytics_visitors",
  {
    visitorHash: text("visitor_hash").primaryKey(),
    views: integer("views").notNull().default(1),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("analytics_visitors_last_seen_idx").on(table.lastSeenAt)],
);
