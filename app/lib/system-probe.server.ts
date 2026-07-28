import { constants } from "node:fs";
import { access, statfs } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getPool, hasDatabase } from "./db.server";

export type ProbeStatus = "healthy" | "warning" | "critical";

type ProbeCheck = {
  key: string;
  label: string;
  status: ProbeStatus;
  detail: string;
};

function percent(used: number, total: number) {
  if (!total) return 0;
  return Math.round((used / total) * 1000) / 10;
}

function utilizationStatus(value: number, warning: number, critical: number): ProbeStatus {
  if (value >= critical) return "critical";
  if (value >= warning) return "warning";
  return "healthy";
}

function worstStatus(statuses: ProbeStatus[]): ProbeStatus {
  if (statuses.includes("critical")) return "critical";
  if (statuses.includes("warning")) return "warning";
  return "healthy";
}

async function inspectStorage(storagePath: string) {
  try {
    await access(storagePath, constants.R_OK | constants.W_OK);
    const stats = await statfs(storagePath);
    const totalBytes = stats.bsize * stats.blocks;
    const availableBytes = stats.bsize * stats.bavail;
    const usedBytes = Math.max(0, totalBytes - availableBytes);
    const usedPercent = percent(usedBytes, totalBytes);
    return {
      path: storagePath,
      accessible: true,
      totalBytes,
      usedBytes,
      availableBytes,
      usedPercent,
      status: utilizationStatus(usedPercent, 80, 92),
    } as const;
  } catch {
    return {
      path: storagePath,
      accessible: false,
      totalBytes: 0,
      usedBytes: 0,
      availableBytes: 0,
      usedPercent: 0,
      status: "critical" as const,
    };
  }
}

async function inspectDatabase() {
  if (!hasDatabase()) {
    return {
      status: "warning" as const,
      mode: "fallback",
      latencyMs: 0,
      sizeBytes: 0,
      version: "未连接数据库",
      pool: { total: 0, idle: 0, waiting: 0 },
    };
  }

  const pool = getPool();
  const startedAt = performance.now();
  try {
    const result = await pool.query<{
      size_bytes: string;
      version: string;
    }>(
      "select pg_database_size(current_database())::text as size_bytes, version() as version",
    );
    const latencyMs = Math.round((performance.now() - startedAt) * 10) / 10;
    const version = result.rows[0]?.version.match(/^PostgreSQL [^ ]+/)?.[0] ?? "PostgreSQL";
    return {
      status: latencyMs >= 800 ? "warning" as const : "healthy" as const,
      mode: "connected",
      latencyMs,
      sizeBytes: Number(result.rows[0]?.size_bytes ?? 0),
      version,
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
    };
  } catch {
    return {
      status: "critical" as const,
      mode: "unavailable",
      latencyMs: Math.round((performance.now() - startedAt) * 10) / 10,
      sizeBytes: 0,
      version: "连接失败",
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
    };
  }
}

export async function collectSystemProbe() {
  const memoryTotalBytes = os.totalmem();
  const memoryFreeBytes = os.freemem();
  const memoryUsedBytes = Math.max(0, memoryTotalBytes - memoryFreeBytes);
  const memoryUsedPercent = percent(memoryUsedBytes, memoryTotalBytes);
  const cpuCores = Math.max(1, os.cpus().length);
  const load = os.loadavg();
  const normalizedLoad = Math.round((load[0] / cpuCores) * 1000) / 10;
  const cpuStatus = utilizationStatus(normalizedLoad, 75, 100);
  const memoryStatus = utilizationStatus(memoryUsedPercent, 82, 94);
  const mediaPath = process.env.MEDIA_ROOT ?? path.resolve("data/media");
  const [storage, database] = await Promise.all([
    inspectStorage(mediaPath),
    inspectDatabase(),
  ]);
  const processMemory = process.memoryUsage();

  const checks: ProbeCheck[] = [
    {
      key: "database",
      label: "数据库",
      status: database.status,
      detail: database.mode === "connected" ? `${database.latencyMs} ms 往返` : database.version,
    },
    {
      key: "storage",
      label: "媒体磁盘",
      status: storage.status,
      detail: storage.accessible ? `${storage.usedPercent}% 已使用` : "不可读写",
    },
    {
      key: "memory",
      label: "主机内存",
      status: memoryStatus,
      detail: `${memoryUsedPercent}% 已使用`,
    },
    {
      key: "cpu",
      label: "CPU 负载",
      status: cpuStatus,
      detail: `${normalizedLoad}% / ${cpuCores} 核`,
    },
  ];

  return {
    status: worstStatus(checks.map((check) => check.status)),
    checkedAt: new Date().toISOString(),
    checks,
    app: {
      environment: process.env.NODE_ENV ?? "development",
      nodeVersion: process.version,
      pid: process.pid,
      uptimeSeconds: Math.round(process.uptime()),
      rssBytes: processMemory.rss,
      heapUsedBytes: processMemory.heapUsed,
      heapTotalBytes: processMemory.heapTotal,
    },
    host: {
      hostname: os.hostname(),
      platform: `${os.platform()} ${os.release()} / ${os.arch()}`,
      cpuModel: os.cpus()[0]?.model ?? "Unknown CPU",
      cpuCores,
      load1: Math.round(load[0] * 100) / 100,
      load5: Math.round(load[1] * 100) / 100,
      load15: Math.round(load[2] * 100) / 100,
      normalizedLoad,
      memoryTotalBytes,
      memoryUsedBytes,
      memoryFreeBytes,
      memoryUsedPercent,
    },
    storage,
    database,
  };
}

export async function collectReadiness() {
  const mediaPath = process.env.MEDIA_ROOT ?? path.resolve("data/media");
  const storagePromise = inspectStorage(mediaPath);
  const databasePromise = hasDatabase()
    ? getPool().query("select 1").then(
      () => "connected" as const,
      () => "unavailable" as const,
    )
    : Promise.resolve("fallback" as const);
  const [storage, database] = await Promise.all([storagePromise, databasePromise]);
  const databaseReady = database === "connected" || database === "fallback";
  return {
    ok: databaseReady && storage.accessible,
    database,
    storage: storage.accessible ? "writable" : "unavailable",
    timestamp: new Date().toISOString(),
  };
}
