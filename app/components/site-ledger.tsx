import { useEffect, useState } from "react";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function formatCount(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatSiteAge(startedAt: string, now: number) {
  const started = new Date(startedAt).getTime();
  const elapsed = Number.isFinite(started) ? Math.max(0, now - started) : 0;
  const days = Math.floor(elapsed / DAY_MS);
  const hours = Math.floor((elapsed % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((elapsed % HOUR_MS) / MINUTE_MS);

  if (days > 0) return `${formatCount(days)} 天 ${hours} 小时`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分钟`;
  return `${minutes} 分钟`;
}

export function SiteLedger({
  startedAt,
  views,
  uniqueVisitors,
  serverNow,
}: {
  startedAt: string;
  views: number;
  uniqueVisitors: number;
  serverNow: number;
}) {
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <aside className="site-ledger" aria-label="站点公开统计">
      <div className="site-ledger__label">
        <span className="micro-label">SITE LOG / 公开小账本</span>
        <small>数字会自己长大，不用每天拿尺子量。</small>
      </div>
      <dl>
        <div>
          <dt>本站已营业</dt>
          <dd>{formatSiteAge(startedAt, now)}</dd>
        </div>
        <div>
          <dt>纸张被翻阅</dt>
          <dd>{formatCount(views)} 次</dd>
        </div>
        <div>
          <dt>独立访客</dt>
          <dd>{formatCount(uniqueVisitors)} 位</dd>
        </div>
      </dl>
      <p>独立访客按匿名浏览器纸片估算；尊重 DNT / GPC，也不记完整 IP。</p>
    </aside>
  );
}
