import { NavLink, Outlet } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { requireAdmin } from "../lib/auth.server";

export const meta: MetaFunction = () => [
  { title: "内容控制台 — Mazha0309" },
  { name: "robots", content: "noindex, nofollow" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requireAdmin(request);
  return {
    user: {
      name: session.user.name,
      image: session.user.image,
    },
  };
}

const adminLinks = [
  ["/admin", "OVERVIEW", "总览"],
  ["/admin/posts", "POSTS", "文章"],
  ["/admin/projects", "PROJECTS", "项目"],
  ["/admin/pages", "PAGES", "页面"],
  ["/admin/media", "MEDIA", "媒体"],
  ["/admin/settings", "SETTINGS", "设置"],
  ["/admin/analytics", "ANALYTICS", "统计"],
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
          <span className="security-pill">CMS / OWNER MODE</span>
          <h2>内容抽屉</h2>
          <p>{loaderData.user.name}</p>
        </header>
        <nav aria-label="后台导航">
          {adminLinks.map(([to, english, chinese]) => (
            <NavLink key={to} to={to} end={to === "/admin"}>
              <span>{english}</span>
              {chinese}
            </NavLink>
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
