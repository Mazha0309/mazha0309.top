import { Form, NavLink, Outlet } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { requireAdmin } from "../lib/auth.server";

export const meta: MetaFunction = () => [
  { title: "内容控制台 — Mazha0309" },
  { name: "robots", content: "noindex, nofollow" },
];

export function headers() {
  return { "Cache-Control": "private, no-store" };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requireAdmin(request);
  return {
    user: {
      name: session.user.name,
      image: session.user.image,
    },
  };
}

const adminGroups = [
  {
    label: "DESK / 内容",
    links: [
      ["/admin", "OVERVIEW", "总览", "⌂"],
      ["/admin/posts", "POSTS", "文章", "✎"],
      ["/admin/comments", "COMMENTS", "评论", "◌"],
      ["/admin/projects", "PROJECTS", "项目", "◇"],
      ["/admin/friends", "FRIENDS", "友链", "♡"],
      ["/admin/pages", "PAGES", "页面", "▤"],
      ["/admin/music", "MUSIC", "音乐", "♫"],
      ["/admin/media", "MEDIA", "媒体", "▧"],
    ],
  },
  {
    label: "SITE / 站点",
    links: [
      ["/admin/settings", "CUSTOMIZE", "自定义", "✦"],
      ["/admin/analytics", "ANALYTICS", "统计", "↗"],
      ["/admin/system", "PROBES", "资源探针", "◉"],
    ],
  },
] as const;

export default function AdminLayout({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <header>
          <span className="scrap-label">CMS / MY DRAWER</span>
          <h2>内容抽屉</h2>
          <div className="admin-sidebar__profile">
            {loaderData.user.image ? <img src={loaderData.user.image} alt="" /> : <span aria-hidden="true">M</span>}
            <p><strong>{loaderData.user.name}</strong><small>站点主人 · 已登录</small></p>
          </div>
        </header>
        <Form className="admin-sidebar__new" method="post" action="/admin/posts">
          <button className="button button--primary" name="intent" value="new">＋ 抽一张新纸</button>
        </Form>
        <nav aria-label="后台导航">
          {adminGroups.map((group) => (
            <section key={group.label}>
              <h3>{group.label}</h3>
              {group.links.map(([to, english, chinese, icon]) => (
                <NavLink key={to} to={to} end={to === "/admin"}>
                  <i aria-hidden="true">{icon}</i>
                  <span>{english}</span>
                  <strong>{chinese}</strong>
                </NavLink>
              ))}
            </section>
          ))}
        </nav>
        <a className="admin-sidebar__exit" href="/">
          ← 返回公开站点
        </a>
      </aside>
      <section className="admin-workspace">
        <Outlet />
      </section>
    </div>
  );
}
