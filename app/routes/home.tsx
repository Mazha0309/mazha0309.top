import { Link } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { getHomepageContent, getSiteShell } from "../lib/content.server";
import { renderSafeMdx } from "../lib/mdx.server";
import { PostCard } from "../components/post-card";
import { ProjectCard } from "../components/project-card";
import { PageViewBeacon } from "../components/post-engagement";

export const meta: MetaFunction = () => [
  { title: "Mazha0309 — 喵喵喵的数字工作台" },
  {
    name: "description",
    content: "项目、文章和正在发生的怪点子，全都钉在这张数字工作台上。",
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

export default function Home({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  const { profile, posts, projects, nowHtml } = loaderData;

  return (
    <>
      <PageViewBeacon path="/" />
      <section className="home-hero content-width">
        <div className="hero-copy">
          <span className="security-pill">{profile.heroEyebrow}</span>
          <p className="hero-kicker">HELLO, STRANGER / 欢迎误入</p>
          <h1>{profile.heroTitle}</h1>
          <p className="hero-intro">{profile.heroIntro}</p>
          <div className="hero-actions">
            <Link className="button button--primary" to="/blog">
              翻阅博客 <span aria-hidden="true">↗</span>
            </Link>
            <Link className="button button--secondary" to="/projects">
              检查项目 <span aria-hidden="true">⌁</span>
            </Link>
          </div>
          <p className="hero-footnote">
            <span aria-hidden="true">✦</span> 不保证有用，保证是本人制作
          </p>
        </div>

        <div className="identity-board" aria-label="Mazha0309 身份卡">
          <span className="tape tape--top" aria-hidden="true" />
          <div className="avatar-frame">
            <img src={profile.avatarUrl} alt={`${profile.displayName} 的头像`} />
          </div>
          <div className="identity-board__copy">
            <span className="micro-label">SUBJECT / VERIFIED-ish</span>
            <strong>{profile.displayName}</strong>
            <span>{profile.handle}</span>
          </div>
          <div className="status-sticker">
            <span>NOW</span>
            {profile.statusText}
          </div>
          <span className="identity-stamp" aria-hidden="true">
            100%
            <br />
            可疑
          </span>
        </div>
      </section>

      <section className="marquee-strip" aria-label="站点状态">
        <div>
          <span>CODE / RADIO / SELF-HOSTED / ODD IDEAS /</span>
          <span aria-hidden="true">CODE / RADIO / SELF-HOSTED / ODD IDEAS /</span>
        </div>
      </section>

      <section className="home-section content-width">
        <div className="section-title-row">
          <div>
            <span className="micro-label">SELECTED EXPERIMENTS / 近期施工</span>
            <h2>拿得出手的几个坑</h2>
          </div>
          <Link className="arrow-link" to="/projects">
            查看全部项目 ↗
          </Link>
        </div>
        <div className="project-grid project-grid--featured">
          {projects.slice(0, 3).map((project, index) => (
            <ProjectCard key={project.id} project={project} index={index} />
          ))}
        </div>
      </section>

      <section className="home-split content-width">
        <div className="home-section home-section--posts">
          <div className="section-title-row">
            <div>
              <span className="micro-label">LATEST NOTES / 新贴上去的</span>
              <h2>博客纸片</h2>
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
        </div>

        <aside className="now-card">
          <span className="tape tape--corner" aria-hidden="true" />
          <span className="micro-label">NOW.LOG / LIVE-ish</span>
          <h2>现在在干嘛</h2>
          <div
            className="mini-prose"
            dangerouslySetInnerHTML={{ __html: nowHtml }}
          />
          <Link to="/about" className="arrow-link">
            查看人物档案 ↗
          </Link>
        </aside>
      </section>

      <section className="home-signoff content-width">
        <span aria-hidden="true">♥</span>
        <p>如果你也在造一些奇怪但认真的东西，我们大概聊得来。</p>
        <a href="https://github.com/Mazha0309" rel="noreferrer">
          去 GitHub 敲门 ↗
        </a>
      </section>
    </>
  );
}
