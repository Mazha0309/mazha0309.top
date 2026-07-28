import type { LoaderFunctionArgs } from "react-router";
import { getAnalytics } from "../lib/content.server";
import { requireAdmin } from "../lib/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const rows = await getAnalytics(30);
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.path, (totals.get(row.path) ?? 0) + row.views);
  return {
    rows,
    totalViews: rows.reduce((sum, row) => sum + row.views, 0),
    popular: [...totals.entries()]
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 12),
  };
}

export default function AdminAnalytics({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const max = Math.max(1, ...loaderData.popular.map((row) => row.views));
  return (
    <>
      <header className="admin-heading">
        <span className="micro-label">PRIVATE ANALYTICS / 30 DAYS</span>
        <h1>{loaderData.totalViews} 次被看见</h1>
        <p>只按“日期 + 路径”聚合；不保存完整 IP，且尊重 DNT 与 GPC。</p>
      </header>
      <section className="admin-panel analytics-list">
        <h2>热门路径</h2>
        {loaderData.popular.length ? loaderData.popular.map((row) => (
          <div key={row.path}>
            <code>{row.path}</code>
            <span><i style={{ width: `${(row.views / max) * 100}%` }} /></span>
            <strong>{row.views}</strong>
          </div>
        )) : <p className="empty-note">还没有统计数据。公开页面被访问后会出现在这里。</p>}
      </section>
      <details className="admin-panel">
        <summary>查看每日明细（{loaderData.rows.length} 条）</summary>
        <table className="admin-table">
          <thead><tr><th>日期</th><th>路径</th><th>浏览</th></tr></thead>
          <tbody>{loaderData.rows.map((row) => <tr key={`${row.day}-${row.path}`}><td>{row.day}</td><td><code>{row.path}</code></td><td>{row.views}</td></tr>)}</tbody>
        </table>
      </details>
    </>
  );
}
