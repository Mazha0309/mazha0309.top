import { useEffect } from "react";
import { useRevalidator } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "../lib/auth.server";
import { collectSystemProbe, type ProbeStatus } from "../lib/system-probe.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  return collectSystemProbe();
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** index;
  return `${amount >= 100 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
}

function formatDuration(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [days ? `${days} 天` : "", hours ? `${hours} 小时` : "", `${minutes} 分`].filter(Boolean).join(" ");
}

const statusCopy: Record<ProbeStatus, string> = {
  healthy: "状态很好",
  warning: "需要留意",
  critical: "需要处理",
};

function Meter({ value, status }: { value: number; status: ProbeStatus }) {
  return (
    <span className="probe-meter" aria-label={`${value}%`}>
      <i data-status={status} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

export default function AdminSystem({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const revalidator = useRevalidator();

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && revalidator.state === "idle") {
        void revalidator.revalidate();
      }
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [revalidator]);

  return (
    <>
      <header className="admin-heading admin-heading--actions">
        <div>
          <span className="micro-label">RESOURCE PROBES / PRIVATE</span>
          <h1>主机现在还精神吗？</h1>
          <p>每 10 秒刷新一次；详细数据只对管理员可见，不暴露在公开健康检查里。</p>
        </div>
        <button className="button button--small" type="button" disabled={revalidator.state !== "idle"} onClick={() => void revalidator.revalidate()}>
          {revalidator.state === "idle" ? "立即刷新 ↻" : "探针巡检中…"}
        </button>
      </header>

      <section className={`probe-overview probe-overview--${loaderData.status}`} aria-live="polite">
        <div className="probe-overview__stamp">
          <span>OVERALL</span>
          <strong>{statusCopy[loaderData.status]}</strong>
        </div>
        <div>
          <span className={`probe-status probe-status--${loaderData.status}`}>
            <i /> {loaderData.status.toUpperCase()}
          </span>
          <p>最近巡检：{new Date(loaderData.checkedAt).toLocaleString("zh-CN")}</p>
        </div>
        <small>自动刷新中 · 页面切到后台时暂停</small>
      </section>

      <div className="probe-summary-grid">
        {loaderData.checks.map((check) => (
          <article className={`probe-summary probe-summary--${check.status}`} key={check.key}>
            <span>{check.label}</span>
            <strong>{check.status === "healthy" ? "OK" : check.status === "warning" ? "注意" : "异常"}</strong>
            <small>{check.detail}</small>
          </article>
        ))}
      </div>

      <div className="probe-detail-grid">
        <section className="admin-panel probe-card">
          <div className="admin-panel__heading">
            <span>HOST MEMORY</span>
            <h2>主机内存</h2>
          </div>
          <strong className="probe-card__value">{loaderData.host.memoryUsedPercent}%</strong>
          <Meter
            value={loaderData.host.memoryUsedPercent}
            status={loaderData.checks.find((check) => check.key === "memory")?.status ?? "healthy"}
          />
          <dl>
            <div><dt>已使用</dt><dd>{formatBytes(loaderData.host.memoryUsedBytes)}</dd></div>
            <div><dt>可用</dt><dd>{formatBytes(loaderData.host.memoryFreeBytes)}</dd></div>
            <div><dt>总计</dt><dd>{formatBytes(loaderData.host.memoryTotalBytes)}</dd></div>
          </dl>
        </section>

        <section className="admin-panel probe-card">
          <div className="admin-panel__heading">
            <span>MEDIA STORAGE</span>
            <h2>媒体磁盘</h2>
          </div>
          <strong className="probe-card__value">{loaderData.storage.accessible ? `${loaderData.storage.usedPercent}%` : "不可用"}</strong>
          <Meter value={loaderData.storage.usedPercent} status={loaderData.storage.status} />
          <dl>
            <div><dt>已使用</dt><dd>{formatBytes(loaderData.storage.usedBytes)}</dd></div>
            <div><dt>可用</dt><dd>{formatBytes(loaderData.storage.availableBytes)}</dd></div>
            <div><dt>挂载路径</dt><dd><code>{loaderData.storage.path}</code></dd></div>
          </dl>
        </section>

        <section className="admin-panel probe-card">
          <div className="admin-panel__heading">
            <span>CPU LOAD</span>
            <h2>处理器负载</h2>
          </div>
          <strong className="probe-card__value">{loaderData.host.normalizedLoad}%</strong>
          <Meter
            value={loaderData.host.normalizedLoad}
            status={loaderData.checks.find((check) => check.key === "cpu")?.status ?? "healthy"}
          />
          <dl>
            <div><dt>1 / 5 / 15 分钟</dt><dd>{loaderData.host.load1} / {loaderData.host.load5} / {loaderData.host.load15}</dd></div>
            <div><dt>核心</dt><dd>{loaderData.host.cpuCores}</dd></div>
            <div><dt>型号</dt><dd>{loaderData.host.cpuModel}</dd></div>
          </dl>
        </section>

        <section className="admin-panel probe-card">
          <div className="admin-panel__heading">
            <span>POSTGRESQL</span>
            <h2>数据库</h2>
          </div>
          <strong className="probe-card__value">{loaderData.database.mode === "connected" ? `${loaderData.database.latencyMs} ms` : "离线"}</strong>
          <span className={`probe-status probe-status--${loaderData.database.status}`}><i /> {loaderData.database.version}</span>
          <dl>
            <div><dt>数据库容量</dt><dd>{formatBytes(loaderData.database.sizeBytes)}</dd></div>
            <div><dt>连接池</dt><dd>{loaderData.database.pool.total} 总 / {loaderData.database.pool.idle} 空闲</dd></div>
            <div><dt>等待连接</dt><dd>{loaderData.database.pool.waiting}</dd></div>
          </dl>
        </section>
      </div>

      <section className="admin-panel runtime-panel">
        <div className="admin-panel__heading">
          <span>RUNTIME NOTE</span>
          <h2>应用运行时</h2>
        </div>
        <dl className="runtime-grid">
          <div><dt>进程已运行</dt><dd>{formatDuration(loaderData.app.uptimeSeconds)}</dd></div>
          <div><dt>Node</dt><dd>{loaderData.app.nodeVersion}</dd></div>
          <div><dt>RSS 内存</dt><dd>{formatBytes(loaderData.app.rssBytes)}</dd></div>
          <div><dt>JS 堆</dt><dd>{formatBytes(loaderData.app.heapUsedBytes)} / {formatBytes(loaderData.app.heapTotalBytes)}</dd></div>
          <div><dt>环境</dt><dd>{loaderData.app.environment}</dd></div>
          <div><dt>主机</dt><dd>{loaderData.host.hostname}</dd></div>
          <div className="runtime-grid__wide"><dt>平台</dt><dd>{loaderData.host.platform}</dd></div>
        </dl>
      </section>

      <p className="probe-footnote">
        编排探针：<code>/healthz</code> 检查进程存活，<code>/readyz</code> 检查数据库与媒体盘；完整 JSON 位于 <code>/api/admin/probe</code>。
      </p>
    </>
  );
}
