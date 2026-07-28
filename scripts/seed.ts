import { getDb, getPool } from "../app/lib/db.server";
import {
  contentLinks,
  pages,
  posts,
  projects,
  siteProfiles,
} from "../app/lib/schema.server";
import {
  fallbackLinks,
  fallbackPages,
  fallbackProfile,
  fallbackProjects,
} from "../app/lib/seed-content";
import { and, eq, sql } from "drizzle-orm";

async function main() {
  const db = getDb();

  await db
    .insert(siteProfiles)
    .values({
      ...fallbackProfile,
      updatedAt: new Date(),
    })
    .onConflictDoNothing();

  await db
    .update(siteProfiles)
    .set({
      heroEyebrow: fallbackProfile.heroEyebrow,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(siteProfiles.id, fallbackProfile.id),
        eq(siteProfiles.heroEyebrow, "PERSONAL TERMINAL / ONLINE"),
      ),
    );

  const existingLinks = await db
    .select({ id: contentLinks.id })
    .from(contentLinks)
    .limit(1);
  if (existingLinks.length === 0) {
    for (const link of fallbackLinks) {
      const { id: _id, ...values } = link;
      await db.insert(contentLinks).values(values);
    }
  }
  const [friendsNavigation] = await db
    .select({ id: contentLinks.id })
    .from(contentLinks)
    .where(eq(contentLinks.url, "/friends"))
    .limit(1);
  if (!friendsNavigation) {
    const { id: _id, ...values } = fallbackLinks.find(
      (link) => link.url === "/friends",
    )!;
    await db.insert(contentLinks).values(values);
  }

  await db
    .delete(posts)
    .where(
      and(
        eq(posts.id, "8ef65724-7d2a-4e65-a58f-3a5a5a7f4b35"),
        eq(posts.slug, "hello-from-the-desk"),
        eq(posts.title, "总之，先把这里搭起来"),
      ),
    );

  for (const project of fallbackProjects) {
    await db
      .insert(projects)
      .values({
        id: project.id,
        slug: project.slug,
        title: project.title,
        summary: project.summary,
        bodyMdx: project.bodyMdx,
        stack: project.stack,
        repoUrl: project.repoUrl,
        liveUrl: project.liveUrl,
        coverUrl: project.coverUrl,
        accent: project.accent,
        iconMode: project.iconMode,
        iconValue: project.iconValue,
        iconShape: project.iconShape,
        featured: project.featured,
        position: project.position,
        statusLabel: project.statusLabel,
        createdAt: project.createdAt ? new Date(project.createdAt) : new Date(),
        updatedAt: project.updatedAt ? new Date(project.updatedAt) : new Date(),
      })
      .onConflictDoNothing();
  }

  for (const page of fallbackPages) {
    await db
      .insert(pages)
      .values({
        id: page.id,
        slug: page.slug,
        title: page.title,
        eyebrow: page.eyebrow,
        contentMdx: page.contentMdx,
        updatedAt: page.updatedAt ? new Date(page.updatedAt) : new Date(),
      })
      .onConflictDoNothing();
  }

  await db
    .update(pages)
    .set({ eyebrow: "ABOUT ME / 一点自我介绍", updatedAt: new Date() })
    .where(
      and(
        eq(pages.slug, "about"),
        eq(pages.eyebrow, "SUBJECT FILE / 0309"),
      ),
    );
  await db
    .update(pages)
    .set({
      contentMdx: sql`replace(${pages.contentMdx}, '<Stamp>100% 可疑但真诚</Stamp>', '<Stamp>认真制作，真心欢迎</Stamp>')`,
      updatedAt: new Date(),
    })
    .where(eq(pages.slug, "about"));
  await db
    .update(pages)
    .set({ eyebrow: "THESE DAYS / 最近", updatedAt: new Date() })
    .where(
      and(
        eq(pages.slug, "now"),
        eq(pages.eyebrow, "LIVE STATUS / RECENTLY"),
      ),
    );

  console.log("Initial content is present.");
  await getPool().end();
}

main().catch(async (error) => {
  console.error(error);
  await getPool().end().catch(() => undefined);
  process.exitCode = 1;
});
