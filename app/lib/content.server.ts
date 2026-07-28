import {
  and,
  asc,
  desc,
  eq,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { getDb, getPool, hasDatabase } from "./db.server";
import {
  analyticsDaily,
  contentLinks,
  media,
  pages,
  postRevisions,
  postSlugs,
  posts,
  projects,
  siteProfiles,
} from "./schema.server";
import {
  fallbackLinks,
  fallbackPages,
  fallbackPosts,
  fallbackProfile,
  fallbackProjects,
} from "./seed-content";
import { estimateReadingMinutes, mdxToText, slugify, splitTags } from "./content-utils";
import type {
  ContentLink,
  MediaRecord,
  PageRecord,
  PostRecord,
  ProjectRecord,
  SearchHit,
  SiteProfile,
} from "./types";

const isPublicPost = (now = new Date()) =>
  or(
    eq(posts.status, "published"),
    and(eq(posts.status, "scheduled"), lte(posts.scheduledAt, now)),
  );

function withReadingTime<T extends { contentMdx: string }>(post: T) {
  return {
    ...post,
    readingMinutes: estimateReadingMinutes(post.contentMdx),
  };
}

export async function getSiteShell() {
  if (!hasDatabase()) {
    return { profile: fallbackProfile, links: fallbackLinks };
  }

  const db = getDb();
  const [profile] = await db.select().from(siteProfiles).limit(1);
  const links = await db
    .select()
    .from(contentLinks)
    .where(eq(contentLinks.enabled, true))
    .orderBy(asc(contentLinks.position));

  return {
    profile: (profile ?? fallbackProfile) as SiteProfile,
    links: links as ContentLink[],
  };
}

export async function getHomepageContent() {
  if (!hasDatabase()) {
    return {
      posts: fallbackPosts,
      projects: fallbackProjects,
      now: fallbackPages.find((page) => page.slug === "now")!,
    };
  }

  const db = getDb();
  const [postRows, projectRows, nowRows] = await Promise.all([
    db
      .select()
      .from(posts)
      .where(isPublicPost())
      .orderBy(desc(posts.featured), desc(posts.publishedAt))
      .limit(3),
    db
      .select()
      .from(projects)
      .orderBy(desc(projects.featured), asc(projects.position))
      .limit(6),
    db.select().from(pages).where(eq(pages.slug, "now")).limit(1),
  ]);

  return {
    posts: postRows.map(withReadingTime) as PostRecord[],
    projects: projectRows as ProjectRecord[],
    now:
      (nowRows[0] as PageRecord | undefined) ??
      fallbackPages.find((page) => page.slug === "now")!,
  };
}

export async function listPublicPosts(tag?: string) {
  if (!hasDatabase()) {
    return fallbackPosts.filter((post) => !tag || post.tags.includes(tag));
  }

  const db = getDb();
  const condition = tag
    ? and(isPublicPost(), sql`${tag} = ANY(${posts.tags})`)
    : isPublicPost();
  const rows = await db
    .select()
    .from(posts)
    .where(condition)
    .orderBy(desc(posts.publishedAt), desc(posts.createdAt));

  return rows.map(withReadingTime) as PostRecord[];
}

export async function getPublicPost(slug: string) {
  if (!hasDatabase()) {
    const post = fallbackPosts.find((candidate) => candidate.slug === slug);
    return post
      ? { post, redirectSlug: null }
      : { post: null, redirectSlug: null };
  }

  const db = getDb();
  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.slug, slug), isPublicPost()))
    .limit(1);

  if (post) {
    return {
      post: withReadingTime(post) as PostRecord,
      redirectSlug: null,
    };
  }

  const [oldSlug] = await db
    .select({ currentSlug: posts.slug })
    .from(postSlugs)
    .innerJoin(posts, eq(posts.id, postSlugs.postId))
    .where(and(eq(postSlugs.slug, slug), isPublicPost()))
    .limit(1);

  return {
    post: null,
    redirectSlug: oldSlug?.currentSlug ?? null,
  };
}

export async function listProjects() {
  if (!hasDatabase()) return fallbackProjects;
  return (await getDb()
    .select()
    .from(projects)
    .orderBy(asc(projects.position), desc(projects.createdAt))) as ProjectRecord[];
}

export async function getPage(slug: string) {
  if (!hasDatabase()) {
    return fallbackPages.find((page) => page.slug === slug) ?? null;
  }
  const [page] = await getDb().select().from(pages).where(eq(pages.slug, slug)).limit(1);
  return (page as PageRecord | undefined) ?? null;
}

export async function searchContent(rawQuery: string): Promise<SearchHit[]> {
  const query = rawQuery.trim().slice(0, 120);
  if (!query) return [];

  if (!hasDatabase()) {
    const needle = query.toLocaleLowerCase();
    const postHits: SearchHit[] = fallbackPosts
      .filter((post) =>
        [post.title, post.summary, post.contentText, ...post.tags]
          .join(" ")
          .toLocaleLowerCase()
          .includes(needle),
      )
      .map((post) => ({
        id: post.id,
        type: "post",
        title: post.title,
        summary: post.summary,
        href: `/blog/${post.slug}`,
        tags: post.tags,
      }));
    const projectHits: SearchHit[] = fallbackProjects
      .filter((project) =>
        [project.title, project.summary, ...project.stack]
          .join(" ")
          .toLocaleLowerCase()
          .includes(needle),
      )
      .map((project) => ({
        id: project.id,
        type: "project",
        title: project.title,
        summary: project.summary,
        href: `/projects#${project.slug}`,
        tags: project.stack,
      }));
    return [...postHits, ...projectHits];
  }

  const result = await getPool().query<{
    id: string;
    type: "post" | "project" | "page";
    title: string;
    summary: string;
    href: string;
    tags: string[];
    score: number;
  }>(
    `
      WITH hits AS (
        SELECT id::text,
               'post'::text AS type,
               title,
               summary,
               '/blog/' || slug AS href,
               tags,
               (
                 similarity(lower(title), lower($1)) * 5 +
                 similarity(lower(array_to_string(tags, ' ')), lower($1)) * 4 +
                 similarity(lower(summary), lower($1)) * 2 +
                 similarity(lower(content_text), lower($1))
               ) AS score
          FROM posts
         WHERE (
           status = 'published' OR
           (status = 'scheduled' AND scheduled_at <= now())
         )
           AND (
             title ILIKE '%' || $1 || '%' OR
             summary ILIKE '%' || $1 || '%' OR
             content_text ILIKE '%' || $1 || '%' OR
             array_to_string(tags, ' ') ILIKE '%' || $1 || '%'
           )
        UNION ALL
        SELECT id::text,
               'project'::text,
               title,
               summary,
               '/projects#' || slug,
               stack,
               (
                 similarity(lower(title), lower($1)) * 5 +
                 similarity(lower(array_to_string(stack, ' ')), lower($1)) * 4 +
                 similarity(lower(summary), lower($1)) * 2
               )
          FROM projects
         WHERE title ILIKE '%' || $1 || '%'
            OR summary ILIKE '%' || $1 || '%'
            OR array_to_string(stack, ' ') ILIKE '%' || $1 || '%'
        UNION ALL
        SELECT id::text,
               'page'::text,
               title,
               left(regexp_replace(content_mdx, '[#*_<>{}]', ' ', 'g'), 180),
               CASE WHEN slug = 'about' THEN '/about' ELSE '/' END,
               ARRAY[]::text[],
               similarity(lower(title || ' ' || content_mdx), lower($1)) * 2
          FROM pages
         WHERE title ILIKE '%' || $1 || '%'
            OR content_mdx ILIKE '%' || $1 || '%'
      )
      SELECT * FROM hits
      ORDER BY score DESC, title ASC
      LIMIT 24
    `,
    [query],
  );

  return result.rows as SearchHit[];
}

export async function listAdminPosts() {
  if (!hasDatabase()) return fallbackPosts;
  return (await getDb()
    .select()
    .from(posts)
    .orderBy(desc(posts.updatedAt))) as PostRecord[];
}

export async function getAdminPost(id: string) {
  if (!hasDatabase()) {
    return fallbackPosts.find((post) => post.id === id) ?? null;
  }
  const [post] = await getDb().select().from(posts).where(eq(posts.id, id)).limit(1);
  return (post as PostRecord | undefined) ?? null;
}

export async function createPost() {
  if (!hasDatabase()) {
    throw new Error("文章写入需要数据库。请通过 Docker Compose 启动 PostgreSQL。");
  }
  const suffix = crypto.randomUUID().slice(0, 8);
  const [post] = await getDb()
    .insert(posts)
    .values({
      slug: `untitled-${suffix}`,
      title: "没有标题的新纸片",
      summary: "",
      contentMdx: "从这里开始写。",
      contentText: "从这里开始写。",
    })
    .returning();
  return post;
}

type PostMutation = {
  title: string;
  slug: string;
  summary: string;
  contentMdx: string;
  tags: string[];
  coverUrl: string | null;
  status: "draft" | "scheduled" | "published";
  featured: boolean;
  scheduledAt: Date | null;
};

export async function savePost(
  id: string,
  input: PostMutation,
  reason: "manual" | "autosave" = "manual",
) {
  if (!hasDatabase()) {
    throw new Error("文章写入需要数据库。");
  }
  const db = getDb();
  const [current] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!current) throw new Response("Post not found", { status: 404 });

  const nextSlug = slugify(input.slug || input.title) || current.slug;
  if (current.slug !== nextSlug) {
    await db
      .insert(postSlugs)
      .values({ postId: current.id, slug: current.slug })
      .onConflictDoNothing();
  }

  if (
    reason === "manual" ||
    current.contentMdx !== input.contentMdx ||
    current.title !== input.title
  ) {
    await db.insert(postRevisions).values({
      postId: current.id,
      title: current.title,
      summary: current.summary,
      contentMdx: current.contentMdx,
      reason,
      snapshot: {
        slug: current.slug,
        tags: current.tags,
        status: current.status,
        coverUrl: current.coverUrl,
        featured: current.featured,
        scheduledAt: current.scheduledAt,
      },
    });
  }

  const publishedAt =
    input.status === "published"
      ? current.publishedAt ?? new Date()
      : current.publishedAt;
  const [saved] = await db
    .update(posts)
    .set({
      ...input,
      slug: nextSlug,
      contentText: mdxToText(input.contentMdx),
      scheduledAt: input.status === "scheduled" ? input.scheduledAt : null,
      publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, id))
    .returning();

  return saved;
}

export async function deletePost(id: string) {
  if (!hasDatabase()) throw new Error("文章写入需要数据库。");
  await getDb().delete(posts).where(eq(posts.id, id));
}

export async function listPostRevisions(postId: string) {
  if (!hasDatabase()) return [];
  return getDb()
    .select()
    .from(postRevisions)
    .where(eq(postRevisions.postId, postId))
    .orderBy(desc(postRevisions.createdAt))
    .limit(30);
}

export async function saveProject(input: {
  id?: string;
  title: string;
  slug: string;
  summary: string;
  bodyMdx: string;
  stack: string[];
  repoUrl: string | null;
  liveUrl: string | null;
  accent: string;
  statusLabel: string;
  featured: boolean;
  position: number;
}) {
  if (!hasDatabase()) throw new Error("项目写入需要数据库。");
  const values = {
    ...input,
    slug: slugify(input.slug || input.title),
    updatedAt: new Date(),
  };
  if (input.id) {
    const [saved] = await getDb()
      .update(projects)
      .set(values)
      .where(eq(projects.id, input.id))
      .returning();
    return saved;
  }
  const [saved] = await getDb().insert(projects).values(values).returning();
  return saved;
}

export async function deleteProject(id: string) {
  if (!hasDatabase()) throw new Error("项目写入需要数据库。");
  await getDb().delete(projects).where(eq(projects.id, id));
}

export async function listPages() {
  if (!hasDatabase()) return fallbackPages;
  return (await getDb().select().from(pages).orderBy(asc(pages.slug))) as PageRecord[];
}

export async function savePage(input: {
  id?: string;
  slug: string;
  title: string;
  eyebrow: string;
  contentMdx: string;
}) {
  if (!hasDatabase()) throw new Error("页面写入需要数据库。");
  if (input.id) {
    const [saved] = await getDb()
      .update(pages)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(pages.id, input.id))
      .returning();
    return saved;
  }
  const [saved] = await getDb().insert(pages).values(input).returning();
  return saved;
}

export async function saveSiteSettings(
  profile: SiteProfile,
  links: Omit<ContentLink, "id">[],
) {
  if (!hasDatabase()) throw new Error("站点设置写入需要数据库。");
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .insert(siteProfiles)
      .values({ ...profile, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: siteProfiles.id,
        set: { ...profile, updatedAt: new Date() },
      });
    await tx.delete(contentLinks);
    if (links.length) await tx.insert(contentLinks).values(links);
  });
}

export async function listMedia() {
  if (!hasDatabase()) return [];
  return (await getDb()
    .select()
    .from(media)
    .orderBy(desc(media.createdAt))) as MediaRecord[];
}

export async function createMediaRecord(
  input: Omit<MediaRecord, "id" | "createdAt">,
) {
  if (!hasDatabase()) throw new Error("媒体写入需要数据库。");
  const [record] = await getDb().insert(media).values(input).returning();
  return record as MediaRecord;
}

export async function recordPageView(path: string) {
  if (!hasDatabase()) return;
  const day = new Date().toISOString().slice(0, 10);
  await getDb()
    .insert(analyticsDaily)
    .values({ day, path, views: 1 })
    .onConflictDoUpdate({
      target: [analyticsDaily.day, analyticsDaily.path],
      set: { views: sql`${analyticsDaily.views} + 1` },
    });
}

export async function getAnalytics(days = 30) {
  if (!hasDatabase()) return [];
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const day = since.toISOString().slice(0, 10);
  return getDb()
    .select()
    .from(analyticsDaily)
    .where(sql`${analyticsDaily.day} >= ${day}`)
    .orderBy(desc(analyticsDaily.day), desc(analyticsDaily.views));
}

export async function getPublishedSlugs() {
  if (!hasDatabase()) {
    return fallbackPosts.map((post) => ({
      slug: post.slug,
      updatedAt: post.updatedAt,
    }));
  }
  return getDb()
    .select({ slug: posts.slug, updatedAt: posts.updatedAt })
    .from(posts)
    .where(isPublicPost())
    .orderBy(desc(posts.updatedAt));
}

export async function deleteMediaRecords(ids: string[]) {
  if (!hasDatabase() || ids.length === 0) return;
  await getDb().delete(media).where(inArray(media.id, ids));
}

export { splitTags };
