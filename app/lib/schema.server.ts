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
} from "drizzle-orm/pg-core";
import type { SiteCustomization } from "./types";

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
