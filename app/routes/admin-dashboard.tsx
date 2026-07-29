import { Link } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import {
  getAdminDashboardTotals,
  getAnalytics,
  listAdminPosts,
  listFriendLinks,
  listMedia,
  listPages,
  listProjects,
} from "../lib/content.server";
import { requireAdmin } from "../lib/auth.server";
import { estimateReadingMinutes } from "../lib/content-utils";
import { collectSystemProbe } from "../lib/system-probe.server";

const DAY_MS = 24 * 60 * 60 * 1000;

function formatStorage(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function formatDay(day: string | null) {
  if (!day) return "还没开张";
  const [, month, date] = day.split("-");
  return `${Number(month)} 月 ${Number(date)} 日`;
}

function percentageChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function mediaTypeLabel(mimeType: string) {
  const subtype = mimeType.split("/")[1]?.split("+")[0]?.toUpperCase() ?? "OTHER";
  return subtype === "JPEG" ? "JPG" : subtype;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatChange(value: number | null) {
  if (value === null) return "刚开张";
  return `${value > 0 ? "+" : ""}${value}%`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const [
    posts,
    projects,
    friends,
    media,
    pages,
    analytics,
    lifetime,
    probe,
  ] = await Promise.all([
    listAdminPosts(),
    listProjects(),
    listFriendLinks({ includeDisabled: true }),
    listMedia(),
    listPages(),
    getAnalytics(60),
    getAdminDashboardTotals(),
    collectSystemProbe(),
  ]);

  const dayTotals = new Map<string, number>();
  for (const row of analytics) {
    dayTotals.set(row.day, (dayTotals.get(row.day) ?? 0) + row.views);
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const sixtyDays = Array.from({ length: 60 }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (59 - index));
    const day = date.toISOString().slice(0, 10);
    return {
      day,
      label: `${date.getUTCMonth() + 1}/${date.getUTCDate()}`,
      views: dayTotals.get(day) ?? 0,
    };
  });
  const dailyViews = sixtyDays.slice(-7);
  const previousSevenDays = sixtyDays.slice(-14, -7);
  const currentThirtyDays = sixtyDays.slice(-30);
  const previousThirtyDays = sixtyDays.slice(0, 30);
  const views7 = dailyViews.reduce((sum, row) => sum + row.views, 0);
  const previousViews7 = previousSevenDays.reduce((sum, row) => sum + row.views, 0);
  const views30 = currentThirtyDays.reduce((sum, row) => sum + row.views, 0);
  const previousViews30 = previousThirtyDays.reduce((sum, row) => sum + row.views, 0);
  const activeDays30 = currentThirtyDays.filter((row) => row.views > 0).length;
  const peakDay = views30
    ? currentThirtyDays.reduce((peak, row) => row.views > peak.views ? row : peak)
    : null;
  const currentThirtyStart = currentThirtyDays[0]?.day ?? "";
  const pathTotals = new Map<string, number>();
  for (const row of analytics) {
    if (row.day < currentThirtyStart) continue;
    pathTotals.set(row.path, (pathTotals.get(row.path) ?? 0) + row.views);
  }

  const tagCounts = new Map<string, number>();
  const stackCounts = new Map<string, number>();
  const mediaTypeCounts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  for (const project of projects) {
    for (const item of project.stack) {
      stackCounts.set(item, (stackCounts.get(item) ?? 0) + 1);
    }
  }
  for (const item of media) {
    const label = mediaTypeLabel(item.mimeType);
    mediaTypeCounts.set(label, (mediaTypeCounts.get(label) ?? 0) + 1);
  }

  const totalCharacters = posts.reduce(
    (sum, post) => sum + post.contentText.replace(/\s/gu, "").length,
    0,
  );
  const totalReadingMinutes = posts.reduce(
    (sum, post) => sum + (post.contentText.trim() ? estimateReadingMinutes(post.contentMdx) : 0),
    0,
  );
  const mediaSizeBytes = media.reduce((sum, item) => sum + item.sizeBytes, 0);
  const largestMedia = media.reduce<(typeof media)[number] | null>(
    (largest, item) => !largest || item.sizeBytes > largest.sizeBytes ? item : largest,
    null,
  );
  const updatedSince = today.getTime() - 6 * DAY_MS;

  return {
    counts: {
      posts: posts.length,
      drafts: posts.filter((post) => post.status === "draft").length,
      published: posts.filter((post) => post.status === "published").length,
      scheduled: posts.filter((post) => post.status === "scheduled").length,
      projects: projects.length,
      featuredProjects: projects.filter((project) => project.featured).length,
      friends: friends.filter((friend) => friend.enabled).length,
      hiddenFriends: friends.filter((friend) => !friend.enabled).length,
      media: media.length,
      mediaSize: formatStorage(mediaSizeBytes),
      pages: pages.length,
      viewsLifetime: lifetime.views,
      uniqueVisitors: lifetime.uniqueVisitors,
      views7,
      views30,
      viewsToday: dayTotals.get(today.toISOString().slice(0, 10)) ?? 0,
      comments: lifetime.comments,
      commentsActive: lifetime.commentsActive,
      commentsPending: lifetime.commentsPending,
      commentAuthors: lifetime.commentAuthors,
    },
    traffic: {
      yesterday: sixtyDays.at(-2)?.views ?? 0,
      previousViews7,
      weekChange: percentageChange(views7, previousViews7),
      previousViews30,
      monthChange: percentageChange(views30, previousViews30),
      activeDays30,
      quietDays30: 30 - activeDays30,
      uniquePaths30: pathTotals.size,
      averageDaily30: Math.round((views30 / 30) * 10) / 10,
      averageActiveDay: activeDays30
        ? Math.round((views30 / activeDays30) * 10) / 10
        : 0,
      peakDay: peakDay?.day ?? null,
      peakViews: peakDay?.views ?? 0,
      trackedDays: lifetime.trackedDays,
      trackedPaths: lifetime.trackedPaths,
      firstTrackedDay: lifetime.firstTrackedDay,
    },
    writing: {
      totalCharacters,
      averageCharacters: posts.length ? Math.round(totalCharacters / posts.length) : 0,
      readingMinutes: totalReadingMinutes,
      uniqueTags: tagCounts.size,
      featured: posts.filter((post) => post.featured).length,
      revisions: lifetime.revisions,
      updated7: posts.filter((post) => {
        if (!post.updatedAt) return false;
        const value = new Date(post.updatedAt).getTime();
        return Number.isFinite(value) && value >= updatedSince;
      }).length,
      topTags: [...tagCounts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .slice(0, 5),
    },
    projectStats: {
      live: projects.filter((project) => Boolean(project.liveUrl)).length,
      repositories: projects.filter((project) => Boolean(project.repoUrl)).length,
      withCover: projects.filter((project) => Boolean(project.coverUrl)).length,
      uniqueStack: stackCounts.size,
      topStack: [...stackCounts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .slice(0, 5),
    },
    assetStats: {
      visibleFriends: friends.filter((friend) => friend.enabled).length,
      totalFriends: friends.length,
      friendsWithAvatar: friends.filter((friend) => Boolean(friend.avatarUrl)).length,
      mediaVariants: media.reduce(
        (sum, item) => sum + Object.keys(item.variants).length,
        0,
      ),
      mediaTypes: [...mediaTypeCounts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .slice(0, 5),
      largestMedia: largestMedia
        ? {
            name: largestMedia.originalName,
            size: formatStorage(largestMedia.sizeBytes),
          }
        : null,
    },
    dailyViews,
    popularPaths: [...pathTotals.entries()]
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5),
    recentPosts: posts.slice(0, 5),
    probe,
  };
}

export default function AdminDashboard({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const maxDailyViews = Math.max(1, ...loaderData.dailyViews.map((row) => row.views));
  const statusLabels = {
    draft: "还藏着",
    scheduled: "排队中",
    published: "公开中",
  } as const;

  return (
    <>
      <header className="admin-heading">
        <span className="micro-label">DESK CHECK-IN / 今天的小账本</span>
        <h1>站点今天也有乖乖运转♡</h1>
        <p>纸片、访客脚印和机器体温都替你数好啦，你只管挑一件想折腾的。</p>
      </header>

      <div className="admin-stat-grid">
        <article>
          <span>PAPER DRAWER / 文章抽屉</span>
          <strong>{loaderData.counts.posts}</strong>
          <small>{loaderData.counts.published} 公开 · {loaderData.counts.drafts} 草稿 · {loaderData.counts.scheduled} 定时</small>
        </article>
        <article>
          <span>PROJECT JAR / 项目罐头</span>
          <strong>{loaderData.counts.projects}</strong>
          <small>{loaderData.counts.featuredProjects ? `${loaderData.counts.featuredProjects} 个首页显眼包` : "还没挑首页显眼包"}</small>
        </article>
        <article>
          <span>NEIGHBORS / 友链邻居</span>
          <strong>{loaderData.counts.friends}</strong>
          <small>{loaderData.counts.hiddenFriends ? `${loaderData.counts.hiddenFriends} 张名片在躲猫猫` : "大家都亮着小灯"}</small>
        </article>
        <article>
          <span>IMAGE POCKET / 图片口袋</span>
          <strong>{loaderData.counts.media}</strong>
          <small>轻轻装了 {loaderData.counts.mediaSize}</small>
        </article>
        <article>
          <span>LITTLE PAGES / 固定纸片</span>
          <strong>{loaderData.counts.pages}</strong>
          <small>关于我之类的长期住户</small>
        </article>
        <article>
          <span>FOOTPRINTS / 访客脚印</span>
          <strong>{formatCount(loaderData.counts.viewsLifetime)}</strong>
          <small>今天 {loaderData.counts.viewsToday} · 7 天 {loaderData.counts.views7} · 30 天 {loaderData.counts.views30}</small>
        </article>
        <article>
          <span>VISITORS / 独立访客</span>
          <strong>{formatCount(loaderData.counts.uniqueVisitors)}</strong>
          <small>按匿名浏览器纸片估算，从启用统计后累计</small>
        </article>
        <article>
          <span>PAPER MAIL / 留言纸条</span>
          <strong>{loaderData.counts.comments}</strong>
          <small>
            {loaderData.counts.commentsActive} 公开 · {loaderData.counts.commentsPending} 待你看 · {loaderData.counts.commentAuthors} 位路人
          </small>
        </article>
      </div>

      <div className="admin-dashboard-grid admin-dashboard-grid--analytics">
        <section className="admin-panel visit-peek">
          <div className="admin-panel__heading admin-panel__heading--row">
            <div>
              <span>SEVEN LITTLE DAYS</span>
              <h2>这周谁来踩过纸张？</h2>
            </div>
            <Link className="button button--small" to="/admin/analytics">完整脚印 ↗</Link>
          </div>
          <div className="visit-peek__lead">
            <div>
              <strong>{formatCount(loaderData.counts.views7)}</strong>
              <span>次轻轻路过</span>
            </div>
            <p>
              {loaderData.counts.views7
                ? `今天捡到 ${loaderData.counts.viewsToday} 枚脚印，只认匿名浏览器纸片，不记 IP 和身份。`
                : "这周还安安静静的，第一枚脚印可能正在穿鞋。"}
            </p>
          </div>
          <dl className="visit-comparison">
            <div>
              <dt>昨天</dt>
              <dd>{formatCount(loaderData.traffic.yesterday)}</dd>
            </div>
            <div>
              <dt>上个 7 天</dt>
              <dd>{formatCount(loaderData.traffic.previousViews7)}</dd>
            </div>
            <div>
              <dt>周环比</dt>
              <dd>{formatChange(loaderData.traffic.weekChange)}</dd>
            </div>
            <div>
              <dt>30 天日均</dt>
              <dd>{loaderData.traffic.averageDaily30}</dd>
            </div>
          </dl>
          <div className="visit-sparkline" aria-label="最近七天浏览量">
            {loaderData.dailyViews.map((row) => (
              <div className="visit-sparkline__day" key={row.day}>
                <b>{row.views}</b>
                <span className="visit-sparkline__bar">
                  <i
                    data-empty={row.views === 0 ? "true" : undefined}
                    style={{ height: `${row.views ? Math.max(12, (row.views / maxDailyViews) * 100) : 5}%` }}
                  />
                </span>
                <small>{row.label}</small>
              </div>
            ))}
          </div>
        </section>

        <aside className="admin-panel popular-peek">
          <div className="admin-panel__heading">
            <div>
              <span>MOST PETTED</span>
              <h2>最常被摸的纸</h2>
            </div>
          </div>
          {loaderData.popularPaths.length ? (
            <ol className="popular-peek__list">
              {loaderData.popularPaths.map((row, index) => (
                <li key={row.path}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <code title={row.path}>{row.path}</code>
                  <strong>{row.views}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="popular-peek__empty">排行榜还在睡觉。公开页面有人来过以后，它就会自己醒啦。</p>
          )}
          <small className="popular-peek__privacy">不存 IP 或身份，并尊重 DNT / GPC。</small>
        </aside>
      </div>

      <section className="admin-panel stats-ledger">
        <div className="admin-panel__heading admin-panel__heading--row">
          <div>
            <span>DEEP POCKET CHECK / 全部翻出来看看</span>
            <h2>站点肚子里到底装了多少东西？</h2>
          </div>
          <small>实时从数据库和运行环境清点</small>
        </div>

        <div className="stats-ledger__grid">
          <section>
            <header>
              <span>01</span>
              <div><small>WRITING PILE</small><h3>文字小山</h3></div>
            </header>
            <dl>
              <div><dt>正文字符</dt><dd>{formatCount(loaderData.writing.totalCharacters)}</dd></div>
              <div><dt>预计总阅读</dt><dd>{formatCount(loaderData.writing.readingMinutes)} 分钟</dd></div>
              <div><dt>平均每篇</dt><dd>{formatCount(loaderData.writing.averageCharacters)} 字符</dd></div>
              <div><dt>独立标签</dt><dd>{loaderData.writing.uniqueTags}</dd></div>
              <div><dt>首页精选</dt><dd>{loaderData.writing.featured}</dd></div>
              <div><dt>7 天内碰过</dt><dd>{loaderData.writing.updated7}</dd></div>
              <div><dt>历史版本</dt><dd>{formatCount(loaderData.writing.revisions)}</dd></div>
              <div><dt>留言纸条</dt><dd>{formatCount(loaderData.counts.comments)}</dd></div>
              <div><dt>留言者</dt><dd>{formatCount(loaderData.counts.commentAuthors)}</dd></div>
            </dl>
            <div className="stats-ledger__chips" aria-label="常用文章标签">
              {loaderData.writing.topTags.length
                ? loaderData.writing.topTags.map((tag) => <span key={tag.label}>{tag.label} × {tag.count}</span>)
                : <small>标签篮子还是空的</small>}
            </div>
          </section>

          <section>
            <header>
              <span>02</span>
              <div><small>PROJECT SHELF</small><h3>项目小架子</h3></div>
            </header>
            <dl>
              <div><dt>项目总数</dt><dd>{loaderData.counts.projects}</dd></div>
              <div><dt>首页精选</dt><dd>{loaderData.counts.featuredProjects}</dd></div>
              <div><dt>已经上线</dt><dd>{loaderData.projectStats.live}</dd></div>
              <div><dt>挂了仓库</dt><dd>{loaderData.projectStats.repositories}</dd></div>
              <div><dt>贴了封面</dt><dd>{loaderData.projectStats.withCover}</dd></div>
              <div><dt>技术种类</dt><dd>{loaderData.projectStats.uniqueStack}</dd></div>
            </dl>
            <div className="stats-ledger__chips" aria-label="常用项目技术">
              {loaderData.projectStats.topStack.length
                ? loaderData.projectStats.topStack.map((item) => <span key={item.label}>{item.label} × {item.count}</span>)
                : <small>技术贴纸还没贴上</small>}
            </div>
          </section>

          <section>
            <header>
              <span>03</span>
              <div><small>ASSET POUCH</small><h3>素材小口袋</h3></div>
            </header>
            <dl>
              <div><dt>固定页面</dt><dd>{loaderData.counts.pages}</dd></div>
              <div><dt>友链亮灯</dt><dd>{loaderData.assetStats.visibleFriends} / {loaderData.assetStats.totalFriends}</dd></div>
              <div><dt>带头像邻居</dt><dd>{loaderData.assetStats.friendsWithAvatar}</dd></div>
              <div><dt>媒体文件</dt><dd>{loaderData.counts.media}</dd></div>
              <div><dt>媒体容量</dt><dd>{loaderData.counts.mediaSize}</dd></div>
              <div><dt>衍生格式</dt><dd>{loaderData.assetStats.mediaVariants}</dd></div>
              <div>
                <dt>最大一件</dt>
                <dd title={loaderData.assetStats.largestMedia?.name}>
                  {loaderData.assetStats.largestMedia?.size ?? "没有"}
                </dd>
              </div>
            </dl>
            <div className="stats-ledger__chips" aria-label="媒体格式分布">
              {loaderData.assetStats.mediaTypes.length
                ? loaderData.assetStats.mediaTypes.map((item) => <span key={item.label}>{item.label} × {item.count}</span>)
                : <small>图片口袋轻飘飘的</small>}
            </div>
          </section>

          <section>
            <header>
              <span>04</span>
              <div><small>VISITOR WINDOW</small><h3>访客小窗户</h3></div>
            </header>
            <dl>
              <div><dt>累计浏览</dt><dd>{formatCount(loaderData.counts.viewsLifetime)}</dd></div>
              <div><dt>独立访客</dt><dd>{formatCount(loaderData.counts.uniqueVisitors)}</dd></div>
              <div><dt>最近 30 天</dt><dd>{formatCount(loaderData.counts.views30)}</dd></div>
              <div><dt>前一个 30 天</dt><dd>{formatCount(loaderData.traffic.previousViews30)}</dd></div>
              <div><dt>月环比</dt><dd>{formatChange(loaderData.traffic.monthChange)}</dd></div>
              <div><dt>活跃 / 安静</dt><dd>{loaderData.traffic.activeDays30} / {loaderData.traffic.quietDays30} 天</dd></div>
              <div><dt>30 天路径</dt><dd>{loaderData.traffic.uniquePaths30}</dd></div>
              <div><dt>累计路径</dt><dd>{loaderData.traffic.trackedPaths}</dd></div>
              <div><dt>有数据天数</dt><dd>{loaderData.traffic.trackedDays}</dd></div>
              <div><dt>活跃日平均</dt><dd>{loaderData.traffic.averageActiveDay}</dd></div>
              <div><dt>最高一天</dt><dd>{loaderData.traffic.peakViews ? `${formatDay(loaderData.traffic.peakDay)} · ${loaderData.traffic.peakViews}` : "还没有"}</dd></div>
              <div><dt>从哪天开始</dt><dd>{formatDay(loaderData.traffic.firstTrackedDay)}</dd></div>
            </dl>
          </section>
        </div>
      </section>

      <div className="admin-dashboard-grid admin-dashboard-grid--activity">
        <div className="admin-dashboard-activity__main">
          <section className="admin-panel">
            <div className="admin-panel__heading admin-panel__heading--row">
              <div><span>RECENT PAW PRINTS</span><h2>最近摸过的纸片</h2></div>
              <Link className="button button--small" to="/admin/posts">去文章抽屉</Link>
            </div>
            {loaderData.recentPosts.length ? (
              <div className="admin-list">
                {loaderData.recentPosts.map((post) => (
                  <Link key={post.id} to={`/admin/posts/${post.id}`}>
                    <span className={`status-dot status-dot--${post.status}`} />
                    <strong>{post.title}</strong>
                    <small>{statusLabels[post.status]}</small>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="dashboard-empty">
                <span aria-hidden="true">✎</span>
                <div><strong>第一张纸还在装睡</strong><p>先写两行偷偷话也行，草稿不会跑出去告状。</p></div>
                <Link className="button button--small" to="/admin/posts">去叫醒它</Link>
              </div>
            )}
          </section>

          <section className="quick-action-grid" aria-label="常用操作">
            <Link to="/admin/settings"><span>✦</span><strong>给主页梳梳毛</strong><small>品牌、文案、模块和链接</small></Link>
            <Link to="/admin/projects"><span>◇</span><strong>摆弄项目罐头</strong><small>排序、状态与展示卡片</small></Link>
            <Link to="/admin/friends"><span>♡</span><strong>请新邻居进门</strong><small>名片、头像与公开状态</small></Link>
            <Link to="/admin/media"><span>▧</span><strong>往图片口袋里塞</strong><small>自动生成 WebP / AVIF</small></Link>
            <Link to="/admin/comments"><span>◌</span><strong>去留言值班室</strong><small>{loaderData.counts.commentsPending ? `${loaderData.counts.commentsPending} 张等你拿主意` : "待审抽屉很安静"}</small></Link>
          </section>
        </div>

        <aside className={`admin-panel system-peek system-peek--${loaderData.probe.status}`}>
          <div className="admin-panel__heading">
            <div>
              <span>MACHINE PAT-PAT</span>
              <h2>小机器的体温</h2>
            </div>
          </div>
          <div className="system-peek__status">
            <i />
            <strong>{loaderData.probe.status === "healthy" ? "精神得很♡" : loaderData.probe.status === "warning" ? "有点热，戳我看看" : "在冒小烟！"}</strong>
          </div>
          <dl>
            <div><dt>内存</dt><dd>{loaderData.probe.host.memoryUsedPercent}%</dd></div>
            <div><dt>CPU 负载</dt><dd>{loaderData.probe.host.normalizedLoad}%</dd></div>
            <div><dt>磁盘</dt><dd>{loaderData.probe.storage.usedPercent}%</dd></div>
            <div><dt>磁盘剩余</dt><dd>{formatStorage(loaderData.probe.storage.availableBytes)}</dd></div>
            <div><dt>数据库延迟</dt><dd>{loaderData.probe.database.mode === "connected" ? `${loaderData.probe.database.latencyMs} ms` : "离线"}</dd></div>
            <div><dt>数据库体积</dt><dd>{formatStorage(loaderData.probe.database.sizeBytes)}</dd></div>
            <div><dt>连接池</dt><dd>{loaderData.probe.database.pool.total} 总 · {loaderData.probe.database.pool.idle} 闲</dd></div>
            <div><dt>进程</dt><dd>{Math.floor(loaderData.probe.app.uptimeSeconds / 3600)} h</dd></div>
            <div><dt>进程内存</dt><dd>{formatStorage(loaderData.probe.app.rssBytes)}</dd></div>
          </dl>
          <Link className="arrow-link" to="/admin/system">去翻完整体检单 ↗</Link>
        </aside>
      </div>
    </>
  );
}
