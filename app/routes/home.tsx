import { Link } from "react-router";
import type { CSSProperties } from "react";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { getHomepageContent, getSiteShell } from "../lib/content.server";
import { renderSafeMdx } from "../lib/mdx.server";
import { PostCard } from "../components/post-card";
import { ProjectCard } from "../components/project-card";
import { PageViewBeacon } from "../components/post-engagement";

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => [
  { title: loaderData?.profile.customization.siteTitle ?? "Mazha0309" },
  {
    name: "description",
    content: loaderData?.profile.customization.siteDescription ?? "Mazha0309 的个人主页与博客。",
  },
  { property: "og:type", content: "website" },
  { property: "og:title", content: loaderData?.profile.customization.siteTitle ?? "Mazha0309" },
  {
    property: "og:description",
    content: loaderData?.profile.customization.siteDescription ?? "Mazha0309 的个人主页与博客。",
  },
];

export async function loader(_args: LoaderFunctionArgs) {
  const [{ profile }, content] = await Promise.all([
    getSiteShell(),
    getHomepageContent(),
  ]);
  const nowHtml = await renderSafeMdx(content.now.contentMdx);
  return { profile, ...content, nowHtml };
}

function buildMarqueeLoop(value: string) {
  const phrase = `${value.trim()}\u00a0`;
  const phraseLength = Math.max(1, Array.from(phrase).length);
  const repetitions = Math.max(2, Math.ceil(420 / phraseLength));
  const line = phrase.repeat(repetitions);
  const durationSeconds = Math.max(48, Math.round(Array.from(line).length / 4));
  return { line, durationSeconds };
}

export default function Home({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  const { profile, posts, projects, nowHtml } = loaderData;
  const customization = profile.customization;
  const showLowerDesk = customization.showBlog || customization.showNow;
  const showProjectsSection =
    customization.showProjects && projects.length > 0;
  const marquee = customization.marqueeText
    ? buildMarqueeLoop(customization.marqueeText)
    : null;

  const renderAction = (
    label: string,
    url: string,
    className: string,
    mark: string,
  ) => {
    if (!label || !url) return null;
    const content = <>{label} <span aria-hidden="true">{mark}</span></>;
    return url.startsWith("/")
      ? <Link className={className} to={url}>{content}</Link>
      : <a className={className} href={url} rel="noreferrer">{content}</a>;
  };

  return (
    <>
      <PageViewBeacon path="/" />
      <section className="home-hero content-width">
        <div className="hero-copy">
          <span className="scrap-label">{profile.heroEyebrow}</span>
          {customization.heroKicker ? <p className="hero-kicker">{customization.heroKicker}</p> : null}
          <h1>{profile.heroTitle}</h1>
          <p className="hero-intro">{profile.heroIntro}</p>
          <div className="hero-actions">
            {renderAction(
              customization.primaryActionLabel,
              customization.primaryActionUrl,
              "button button--primary",
              "↗",
            )}
            {renderAction(
              customization.secondaryActionLabel,
              customization.secondaryActionUrl,
              "button button--secondary",
              "⌁",
            )}
          </div>
          <p className="hero-footnote">
            <span aria-hidden="true">✦</span> 不保证有用，保证是本人制作
          </p>
        </div>

        <div className="identity-board" aria-label="Mazha0309 的个人名片">
          <span className="tape tape--top" aria-hidden="true" />
          <div className="avatar-frame">
            <img src={profile.avatarUrl} alt={`${profile.displayName} 的头像`} />
          </div>
          <div className="identity-board__copy">
            <span className="micro-label">NICE TO MEET YOU / 初次见面</span>
            <strong>{profile.displayName}</strong>
            <span>{profile.handle}</span>
          </div>
          <div className="status-sticker">
            <span>NOW</span>
            {profile.statusText}
          </div>
          {customization.identityStampText ? (
            <span className="identity-stamp" aria-hidden="true">
              {customization.identityStampText}
            </span>
          ) : null}
        </div>
      </section>

      {marquee ? (
        <section
          className="marquee-strip"
          aria-label={`站点状态：${customization.marqueeText}`}
        >
          <div
            className="marquee-strip__track"
            aria-hidden="true"
            style={{
              animationDuration: `${marquee.durationSeconds}s`,
            } satisfies CSSProperties}
          >
            {[0, 1].map((group) => (
              <span className="marquee-strip__group" key={group}>
                {marquee.line}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {showProjectsSection ? <section className="home-section content-width">
        <div className="section-title-row">
          <div>
            <span className="micro-label">{customization.projectsEyebrow}</span>
            <h2>{customization.projectsTitle}</h2>
          </div>
          <Link className="arrow-link" to="/projects">
            查看全部项目 ↗
          </Link>
        </div>
        <div className="project-grid project-grid--featured">
          {projects.map((project, index) => (
            <ProjectCard key={project.id} project={project} index={index} />
          ))}
        </div>
      </section> : null}

      {showLowerDesk ? <section className={`home-split content-width${customization.showBlog !== customization.showNow ? " home-split--single" : ""}`}>
        {customization.showBlog ? <div className="home-section home-section--posts">
          <div className="section-title-row">
            <div>
              <span className="micro-label">{customization.blogEyebrow}</span>
              <h2>{customization.blogTitle}</h2>
            </div>
            <span className="doodle-arrow" aria-hidden="true">
              ↓
            </span>
          </div>
          {posts.length ? (
            <div className="post-list">
              {posts.map((post, index) => (
                <PostCard key={post.id} post={post} index={index} />
              ))}
            </div>
          ) : (
            <p className="empty-note">正在写。墨水还没干，先不要催喔。</p>
          )}
        </div> : null}

        {customization.showNow ? <aside className="now-card">
          <span className="tape tape--corner" aria-hidden="true" />
          <span className="micro-label">{customization.nowEyebrow}</span>
          <h2>{customization.nowTitle}</h2>
          <div
            className="mini-prose"
            dangerouslySetInnerHTML={{ __html: nowHtml }}
          />
          <Link to="/about" className="arrow-link">
            多认识我一点 ↗
          </Link>
        </aside> : null}
      </section> : null}

      {customization.showSignoff ? <section className="home-signoff content-width">
        <span aria-hidden="true">♥</span>
        <p>{customization.signoffText}</p>
        {customization.signoffLinkLabel && customization.signoffLinkUrl ? (
          <a href={customization.signoffLinkUrl} rel="noreferrer">
            {customization.signoffLinkLabel} ↗
          </a>
        ) : null}
      </section> : null}
    </>
  );
}
