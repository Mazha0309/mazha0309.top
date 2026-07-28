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
  fallbackPosts,
  fallbackProfile,
  fallbackProjects,
} from "../app/lib/seed-content";

async function main() {
  const db = getDb();

  await db
    .insert(siteProfiles)
    .values({
      ...fallbackProfile,
      updatedAt: new Date(),
    })
    .onConflictDoNothing();

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

  for (const post of fallbackPosts) {
    const { readingMinutes: _readingMinutes, ...values } = post;
    await db
      .insert(posts)
      .values({
        ...values,
        publishedAt: values.publishedAt ? new Date(values.publishedAt) : null,
        scheduledAt: values.scheduledAt ? new Date(values.scheduledAt) : null,
        createdAt: values.createdAt ? new Date(values.createdAt) : new Date(),
        updatedAt: values.updatedAt ? new Date(values.updatedAt) : new Date(),
      })
      .onConflictDoNothing();
  }

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

  console.log("Initial content is present.");
  await getPool().end();
}

main().catch(async (error) => {
  console.error(error);
  await getPool().end().catch(() => undefined);
  process.exitCode = 1;
});
