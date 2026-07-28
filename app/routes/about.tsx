import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { getPage, getSiteShell } from "../lib/content.server";
import { renderSafeMdx } from "../lib/mdx.server";
import { PageHeading } from "../components/page-heading";
import { PageViewBeacon } from "../components/post-engagement";

export const meta: MetaFunction = () => [
  { title: "关于我 — Mazha0309" },
  { name: "description", content: "关于 Mazha0309 和这张长期施工的数字工作台。" },
];

export async function loader(_args: LoaderFunctionArgs) {
  const [about, now, shell] = await Promise.all([
    getPage("about"),
    getPage("now"),
    getSiteShell(),
  ]);
  if (!about) throw new Response("Not found", { status: 404 });
  return {
    profile: shell.profile,
    about,
    aboutHtml: await renderSafeMdx(about.contentMdx),
    nowHtml: now ? await renderSafeMdx(now.contentMdx) : "",
  };
}

export default function About({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  const { profile, about, aboutHtml, nowHtml } = loaderData;
  return (
    <div className="page-shell content-width about-page">
      <PageViewBeacon path="/about" />
      <PageHeading
        eyebrow={about.eyebrow}
        title={about.title}
        lead={profile.bio}
      />
      <div className="about-layout">
        <article className="about-paper">
          <span className="tape tape--top" aria-hidden="true" />
          <div className="prose" dangerouslySetInnerHTML={{ __html: aboutHtml }} />
        </article>
        <aside className="about-sidebar">
          <div className="id-card">
            <img src={profile.avatarUrl} alt={`${profile.displayName} 的头像`} />
            <strong>{profile.displayName}</strong>
            <span>{profile.handle}</span>
            <dl>
              <div>
                <dt>住在哪里</dt>
                <dd>{profile.location}</dd>
              </div>
              <div>
                <dt>最近状态</dt>
                <dd>{profile.statusText}</dd>
              </div>
            </dl>
          </div>
          <div className="now-card now-card--small">
            <span className="micro-label">NOW / RECENTLY</span>
            <div className="mini-prose" dangerouslySetInnerHTML={{ __html: nowHtml }} />
          </div>
        </aside>
      </div>
    </div>
  );
}
