import { Link } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import {
  getAnalytics,
  listAdminPosts,
  listFriendLinks,
  listMedia,
  listProjects,
} from "../lib/content.server";
import { requireAdmin } from "../lib/auth.server";
import { collectSystemProbe } from "../lib/system-probe.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const [posts, projects, friends, media, analytics, probe] = await Promise.all([
    listAdminPosts(),
    listProjects(),
    listFriendLinks({ includeDisabled: true }),
    listMedia(),
    getAnalytics(7),
    collectSystemProbe(),
  ]);
  return {
    counts: {
      posts: posts.length,
      drafts: posts.filter((post) => post.status === "draft").length,
      projects: projects.length,
      friends: friends.length,
      media: media.length,
      views: analytics.reduce((sum, row) => sum + row.views, 0),
    },
    recentPosts: posts.slice(0, 5),
    probe,
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
        <span className="micro-label">MY WRITING DESK / 内容抽屉</span>
        <h1>今天要动哪张纸？</h1>
        <p>保存后的内容直接进入数据库，不需要重新构建镜像。</p>
      </header>
      <div className="admin-stat-grid">
        <article><span>POSTS</span><strong>{loaderData.counts.posts}</strong><small>{loaderData.counts.drafts} 份草稿</small></article>
        <article><span>PROJECTS</span><strong>{loaderData.counts.projects}</strong><small>项目档案</small></article>
        <article><span>FRIENDS</span><strong>{loaderData.counts.friends}</strong><small>友链名片</small></article>
        <article><span>MEDIA</span><strong>{loaderData.counts.media}</strong><small>媒体文件</small></article>
        <article><span>7D VIEWS</span><strong>{loaderData.counts.views}</strong><small>尊重 DNT / GPC</small></article>
      </div>
      <div className="admin-dashboard-grid">
        <section className="admin-panel">
          <div className="admin-panel__heading admin-panel__heading--row">
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
            <div className="dashboard-empty">
              <span aria-hidden="true">✎</span>
              <div><strong>第一张纸还空着</strong><p>从一篇草稿开始，不公开也没关系。</p></div>
              <Link className="button button--small" to="/admin/posts">去写文章</Link>
            </div>
          )}
        </section>

        <aside className={`admin-panel system-peek system-peek--${loaderData.probe.status}`}>
          <div className="admin-panel__heading">
            <span>RESOURCE PROBES</span>
            <h2>机器体温</h2>
          </div>
          <div className="system-peek__status">
            <i />
            <strong>{loaderData.probe.status === "healthy" ? "一切正常" : loaderData.probe.status === "warning" ? "有点热" : "需要处理"}</strong>
          </div>
          <dl>
            <div><dt>内存</dt><dd>{loaderData.probe.host.memoryUsedPercent}%</dd></div>
            <div><dt>磁盘</dt><dd>{loaderData.probe.storage.usedPercent}%</dd></div>
            <div><dt>数据库</dt><dd>{loaderData.probe.database.mode === "connected" ? `${loaderData.probe.database.latencyMs} ms` : "离线"}</dd></div>
            <div><dt>进程</dt><dd>{Math.floor(loaderData.probe.app.uptimeSeconds / 3600)} h</dd></div>
          </dl>
          <Link className="arrow-link" to="/admin/system">打开完整探针 ↗</Link>
        </aside>
      </div>

      <section className="quick-action-grid" aria-label="常用操作">
        <Link to="/admin/settings"><span>✦</span><strong>调整主页</strong><small>品牌、文案、模块和链接</small></Link>
        <Link to="/admin/projects"><span>◇</span><strong>整理项目</strong><small>排序、状态与展示卡片</small></Link>
        <Link to="/admin/friends"><span>♡</span><strong>交换友链</strong><small>名片、头像与公开状态</small></Link>
        <Link to="/admin/media"><span>▧</span><strong>上传图片</strong><small>自动生成 WebP / AVIF</small></Link>
      </section>
    </>
  );
}
