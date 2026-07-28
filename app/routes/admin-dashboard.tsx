import { Link } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import {
  getAnalytics,
  listAdminPosts,
  listMedia,
  listProjects,
} from "../lib/content.server";
import { requireAdmin } from "../lib/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const [posts, projects, media, analytics] = await Promise.all([
    listAdminPosts(),
    listProjects(),
    listMedia(),
    getAnalytics(7),
  ]);
  return {
    counts: {
      posts: posts.length,
      drafts: posts.filter((post) => post.status === "draft").length,
      projects: projects.length,
      media: media.length,
      views: analytics.reduce((sum, row) => sum + row.views, 0),
    },
    recentPosts: posts.slice(0, 5),
  };
}

export default function AdminDashboard({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  return (
    <>
      <header className="admin-heading">
        <span className="micro-label">CONTROL DESK / ALL SYSTEMS</span>
        <h1>今天要动哪张纸？</h1>
        <p>保存后的内容直接进入数据库，不需要重新构建镜像。</p>
      </header>
      <div className="admin-stat-grid">
        <article><span>POSTS</span><strong>{loaderData.counts.posts}</strong><small>{loaderData.counts.drafts} 份草稿</small></article>
        <article><span>PROJECTS</span><strong>{loaderData.counts.projects}</strong><small>项目档案</small></article>
        <article><span>MEDIA</span><strong>{loaderData.counts.media}</strong><small>媒体文件</small></article>
        <article><span>7D VIEWS</span><strong>{loaderData.counts.views}</strong><small>尊重 DNT / GPC</small></article>
      </div>
      <section className="admin-panel">
        <div className="admin-panel__heading">
          <div><span>RECENT EDITS</span><h2>最近碰过的文章</h2></div>
          <Link className="button button--small" to="/admin/posts">管理全部</Link>
        </div>
        {loaderData.recentPosts.length ? (
          <div className="admin-list">
            {loaderData.recentPosts.map((post) => (
              <Link key={post.id} to={`/admin/posts/${post.id}`}>
                <span className={`status-dot status-dot--${post.status}`} />
                <strong>{post.title}</strong>
                <small>{post.status.toUpperCase()}</small>
              </Link>
            ))}
          </div>
        ) : (
          <p className="empty-note">还没有文章。抽一张新纸开始吧。</p>
        )}
      </section>
    </>
  );
}
