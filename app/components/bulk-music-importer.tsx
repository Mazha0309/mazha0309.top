import { useEffect, useMemo, useRef, useState } from "react";
import { useRevalidator } from "react-router";
import {
  MUSIC_FILE_ACCEPT,
  fingerprintMusicFile,
  formatMusicFileSize,
  formatMusicRemainingTime,
  formatMusicTransferRate,
  musicFileDisplayName,
  musicFileProblem,
} from "../lib/music-import";
import {
  collectDirectoryFiles,
  type ReadableDirectoryHandle,
} from "../lib/directory-picker";

type ImportStatus =
  | "queued"
  | "checking"
  | "uploading"
  | "imported"
  | "duplicate"
  | "failed"
  | "skipped";

interface ImportItem {
  id: string;
  file: File;
  label: string;
  position: number;
  status: ImportStatus;
  progress: number;
  message: string;
  title: string;
}

interface ImportResponse {
  ok?: boolean;
  status?: "imported" | "duplicate";
  message?: string;
  error?: string;
  track?: {
    id?: string;
    title?: string;
    artist?: string;
    coverUrl?: string | null;
  };
}

const CONCURRENT_UPLOADS = 1;
const DIRECTORY_INPUT_ATTRIBUTES = {
  webkitdirectory: "",
  directory: "",
} as Record<string, string>;

interface SelectedMusicFile {
  file: File;
  label: string;
}

interface TransferStats {
  loadedBytes: number;
  totalBytes: number;
  startedAt: number;
  updatedAt: number;
}

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: (options?: {
    mode?: "read";
  }) => Promise<ReadableDirectoryHandle>;
}

function itemId(file: File, label: string, index: number) {
  return `${label}:${file.size}:${file.lastModified}:${index}`;
}

function statusLabel(item: ImportItem) {
  if (item.status === "checking") return "对暗号";
  if (item.status === "uploading") return `${item.progress}%`;
  if (item.status === "imported") return "收下啦";
  if (item.status === "duplicate") return "早就在";
  if (item.status === "failed") return "卡住了";
  if (item.status === "skipped") return "先略过";
  return "排队中";
}

export function BulkMusicImporter({
  nextPosition,
  knownFingerprints,
}: {
  nextPosition: number;
  knownFingerprints: string[];
}) {
  const revalidator = useRevalidator();
  const directoryInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeRequestsRef = useRef(new Set<XMLHttpRequest>());
  const runTokenRef = useRef(0);
  const preferLegacyPickerRef = useRef(false);
  const knownFingerprintsRef = useRef(new Set(knownFingerprints));
  const transferredByItemRef = useRef(new Map<string, number>());
  const transferTotalRef = useRef(0);
  const mountedRef = useRef(true);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [running, setRunning] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pickerNotice, setPickerNotice] = useState("");
  const [transferStats, setTransferStats] = useState<TransferStats>({
    loadedBytes: 0,
    totalBytes: 0,
    startedAt: 0,
    updatedAt: 0,
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runTokenRef.current += 1;
      for (const request of activeRequestsRef.current) request.abort();
      activeRequestsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    for (const fingerprint of knownFingerprints) {
      if (fingerprint) knownFingerprintsRef.current.add(fingerprint);
    }
  }, [knownFingerprints]);

  function patchItem(id: string, patch: Partial<ImportItem>) {
    if (!mountedRef.current) return;
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function recordTransferredBytes(id: string, loadedBytes: number) {
    transferredByItemRef.current.set(id, loadedBytes);
    const totalLoaded = Array.from(
      transferredByItemRef.current.values(),
    ).reduce((sum, loaded) => sum + loaded, 0);
    setTransferStats((current) => ({
      ...current,
      loadedBytes: totalLoaded,
      totalBytes: transferTotalRef.current,
      updatedAt: performance.now(),
    }));
  }

  function excludeKnownFile(item: ImportItem) {
    transferredByItemRef.current.delete(item.id);
    transferTotalRef.current = Math.max(
      0,
      transferTotalRef.current - item.file.size,
    );
    setTransferStats((current) => ({
      ...current,
      totalBytes: transferTotalRef.current,
      updatedAt: performance.now(),
    }));
  }

  async function uploadOne(item: ImportItem) {
    patchItem(item.id, {
      status: "checking",
      progress: 0,
      message: "先在本机算个小指纹，已经收过的就不走网络啦。",
    });
    let fingerprint = "";
    try {
      fingerprint = await fingerprintMusicFile(item.file);
    } catch {
      // Old or restricted browsers can still upload normally and let the
      // server perform its own duplicate check.
    }
    if (
      fingerprint &&
      knownFingerprintsRef.current.has(fingerprint)
    ) {
      excludeKnownFile(item);
      patchItem(item.id, {
        status: "duplicate",
        progress: 100,
        message: "本机对上指纹啦，这首已经在歌单里，连上传都省掉。",
      });
      return;
    }

    patchItem(item.id, {
      status: "uploading",
      progress: 0,
      message: "正在把音频和内嵌小纸条送上去……",
    });

    return new Promise<void>((resolve) => {
      const request = new XMLHttpRequest();
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        activeRequestsRef.current.delete(request);
        resolve();
      };

      activeRequestsRef.current.add(request);
      request.open("POST", "/api/admin/music/import");
      request.responseType = "json";
      request.timeout = 10 * 60 * 1000;
      request.withCredentials = true;

      request.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) return;
        recordTransferredBytes(
          item.id,
          Math.min(item.file.size, event.loaded),
        );
        patchItem(item.id, {
          progress: Math.min(99, Math.round((event.loaded / event.total) * 100)),
        });
      });
      request.upload.addEventListener("load", () => {
        recordTransferredBytes(item.id, item.file.size);
        patchItem(item.id, {
          progress: 99,
          message: "音频已经传完，服务器正在拆封面和歌词……",
        });
      });

      request.addEventListener("load", () => {
        const response =
          request.response && typeof request.response === "object"
            ? (request.response as ImportResponse)
            : null;
        let responsePath = "";
        try {
          responsePath = new URL(request.responseURL).pathname;
        } catch {
          responsePath = "";
        }

        if (responsePath === "/admin/login") {
          patchItem(item.id, {
            status: "failed",
            progress: 100,
            message: "登录大概过期了：重新登录后再选这批，收下的歌不会重复。",
          });
          finish();
          return;
        }

        if (!response) {
          patchItem(item.id, {
            status: "failed",
            progress: 100,
            message:
              request.status === 413
                ? "这首超过了服务器肯收下的大小。"
                : `服务器回了一张 ${request.status || "空白"} 纸条，没读懂。`,
          });
          finish();
          return;
        }

        if (
          request.status >= 200 &&
          request.status < 300 &&
          response.ok &&
          (response.status === "imported" || response.status === "duplicate")
        ) {
          if (fingerprint) knownFingerprintsRef.current.add(fingerprint);
          patchItem(item.id, {
            status: response.status,
            progress: 100,
            message:
              response.message ||
              (response.status === "duplicate"
                ? "歌单里已经有同一份音频。"
                : "已经塞进播放清单。"),
            title: response.track?.title || "",
          });
          finish();
          return;
        }

        patchItem(item.id, {
          status: "failed",
          progress: 100,
          message: response.error || `服务器回了一张 ${request.status} 纸条。`,
        });
        finish();
      });

      request.addEventListener("error", () => {
        patchItem(item.id, {
          status: "failed",
          message: "网络线打结了，等会儿可以只重试这一首。",
        });
        finish();
      });
      request.addEventListener("timeout", () => {
        patchItem(item.id, {
          status: "failed",
          message: "这首上传超过十分钟，先停下来喘口气。",
        });
        finish();
      });
      request.addEventListener("abort", finish);

      const body = new FormData();
      body.set("audioFile", item.file, item.file.name);
      body.set("position", String(item.position));
      request.send(body);
    });
  }

  async function runQueue(queue: ImportItem[]) {
    if (!queue.length) return;
    const runToken = ++runTokenRef.current;
    let cursor = 0;
    transferredByItemRef.current.clear();
    transferTotalRef.current = queue.reduce(
      (total, item) => total + item.file.size,
      0,
    );
    const startedAt = performance.now();
    setTransferStats({
      loadedBytes: 0,
      totalBytes: transferTotalRef.current,
      startedAt,
      updatedAt: startedAt,
    });
    setRunning(true);

    async function worker() {
      while (runTokenRef.current === runToken) {
        const item = queue[cursor];
        cursor += 1;
        if (!item) return;
        await uploadOne(item);
      }
    }

    await Promise.all(
      Array.from(
        { length: Math.min(CONCURRENT_UPLOADS, queue.length) },
        () => worker(),
      ),
    );
    if (!mountedRef.current || runTokenRef.current !== runToken) return;
    setRunning(false);
    revalidator.revalidate();
  }

  function importSelectedFiles(selectedFiles: SelectedMusicFile[]) {
    if (running || !selectedFiles.length) return;
    setPickerNotice("");
    let importPosition = nextPosition;
    const sorted = [...selectedFiles].sort((left, right) =>
      left.label.localeCompare(right.label, "zh-CN", {
        numeric: true,
        sensitivity: "base",
      }),
    );
    const prepared = sorted.map(({ file, label }, index): ImportItem => {
      const problem = musicFileProblem(file);
      const item: ImportItem = {
        id: itemId(file, label, index),
        file,
        label,
        position: importPosition,
        status: problem ? "skipped" : "queued",
        progress: problem ? 100 : 0,
        message: problem || "等前面的歌先钻进去。",
        title: "",
      };
      if (!problem) importPosition += 1;
      return item;
    });

    setItems(prepared);
    void runQueue(prepared.filter((item) => item.status === "queued"));
  }

  function importFiles(files: File[]) {
    importSelectedFiles(
      files.map((file) => ({
        file,
        label: musicFileDisplayName(file),
      })),
    );
  }

  async function openDirectory() {
    if (running || picking) return;
    setPickerNotice("");
    const browserWindow = window as DirectoryPickerWindow;
    const nativePicker = browserWindow.showDirectoryPicker;
    if (!nativePicker || preferLegacyPickerRef.current) {
      directoryInputRef.current?.click();
      return;
    }

    setPicking(true);
    try {
      const directory = await nativePicker.call(browserWindow, {
        mode: "read",
      });
      const selected = await collectDirectoryFiles(directory);
      if (!selected.length) {
        setPickerNotice("这个文件夹空空的，连一小段声音都没摸到。");
        return;
      }
      importSelectedFiles(
        selected.map(
          ({ file, relativePath }): SelectedMusicFile => ({
            file,
            label: relativePath,
          }),
        ),
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      preferLegacyPickerRef.current = true;
      setPickerNotice(
        "原生文件夹抽屉没拉开；再点一次按钮，会换兼容方式来选。",
      );
    } finally {
      setPicking(false);
    }
  }

  function retryFailed() {
    if (running) return;
    const retryQueue = items
      .filter((item) => item.status === "failed")
      .map((item) => ({
        ...item,
        status: "queued" as const,
        progress: 0,
        message: "重新排进队伍啦。",
      }));
    if (!retryQueue.length) return;
    const retriesById = new Map(
      retryQueue.map((item) => [item.id, item] as const),
    );
    setItems((current) =>
      current.map((item) => retriesById.get(item.id) ?? item),
    );
    void runQueue(retryQueue);
  }

  const counts = useMemo(
    () => ({
      imported: items.filter((item) => item.status === "imported").length,
      duplicate: items.filter((item) => item.status === "duplicate").length,
      failed: items.filter((item) => item.status === "failed").length,
      skipped: items.filter((item) => item.status === "skipped").length,
      uploadable: items.filter((item) => item.status !== "skipped").length,
    }),
    [items],
  );
  const progress = useMemo(() => {
    const uploadable = items.filter((item) => item.status !== "skipped");
    if (!uploadable.length) return 0;
    const total = uploadable.reduce((sum, item) => {
      if (
        item.status === "imported" ||
        item.status === "duplicate" ||
        item.status === "failed"
      ) {
        return sum + 100;
      }
      return sum + item.progress;
    }, 0);
    return Math.round(total / uploadable.length);
  }, [items]);
  const completed = counts.imported + counts.duplicate + counts.failed;
  const transferElapsedSeconds =
    transferStats.startedAt > 0
      ? Math.max(
          0,
          (transferStats.updatedAt - transferStats.startedAt) / 1000,
        )
      : 0;
  const transferRate =
    transferElapsedSeconds > 0
      ? transferStats.loadedBytes / transferElapsedSeconds
      : 0;
  const remainingSeconds =
    transferRate > 0
      ? Math.max(
          0,
          (transferStats.totalBytes - transferStats.loadedBytes) / transferRate,
        )
      : 0;

  return (
    <section
      className="admin-panel music-bulk-import"
      aria-labelledby="bulk-music-title"
    >
      <div className="music-bulk-import__heading">
        <div>
          <span className="micro-label">FOLDER FEEDER / 一次喂好多首</span>
          <h2 id="bulk-music-title">把整个音乐文件夹端上来</h2>
          <p>
            选完就自动投喂；一首一首搬，让慢网络也能尽快落下一首。会自己读取
            歌名、歌手、封面和双语歌词，重选目录时已经收过的歌连上传都省掉。
          </p>
        </div>
        <span className="music-bulk-import__stamp" aria-hidden="true">
          ×168
          <small>也行</small>
        </span>
      </div>

      <input
        {...DIRECTORY_INPUT_ATTRIBUTES}
        ref={directoryInputRef}
        className="sr-only"
        type="file"
        multiple
        tabIndex={-1}
        onChange={(event) => {
          importFiles(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        multiple
        accept={MUSIC_FILE_ACCEPT}
        tabIndex={-1}
        onChange={(event) => {
          importFiles(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }}
      />

      <div className="music-bulk-import__controls">
        <button
          className="button button--primary"
          type="button"
          disabled={running || picking}
          onClick={openDirectory}
        >
          {running
            ? "正在投喂，先别戳我"
            : picking
              ? "正在翻这个文件夹……"
              : "选音乐文件夹，一键开吃"}
        </button>
        <button
          className="button button--secondary"
          type="button"
          disabled={running || picking}
          onClick={() => fileInputRef.current?.click()}
        >
          只挑几首
        </button>
        {counts.failed ? (
          <button
            className="button button--small"
            type="button"
            disabled={running}
            onClick={retryFailed}
          >
            再哄哄失败的 {counts.failed} 首
          </button>
        ) : null}
      </div>
      {pickerNotice ? (
        <p
          className="form-message form-message--warning music-bulk-import__picker-note"
          aria-live="polite"
        >
          {pickerNotice}
        </p>
      ) : null}

      {items.length ? (
        <div className="music-bulk-import__receipt">
          <div className="music-bulk-import__summary">
            <strong>
              {running ? "投喂中" : completed === counts.uploadable ? "这轮投喂完毕" : "等待继续"}
            </strong>
            <span aria-live="polite">
              {completed}/{counts.uploadable} 首 · 新增 {counts.imported} · 已有{" "}
              {counts.duplicate} · 失败 {counts.failed}
              {counts.skipped ? ` · 略过 ${counts.skipped}` : ""}
              {running && transferRate > 0
                ? ` · ${formatMusicTransferRate(transferRate)} · ${formatMusicRemainingTime(remainingSeconds)}`
                : ""}
            </span>
          </div>
          <progress max={100} value={progress}>
            {progress}%
          </progress>
          <ol className="music-bulk-import__queue">
            {items.map((item) => (
              <li data-status={item.status} key={item.id}>
                <span className="music-bulk-import__status">
                  {statusLabel(item)}
                </span>
                <span className="music-bulk-import__file">
                  <strong>{item.title || item.label}</strong>
                  <small>
                    {item.title ? `${item.label} · ` : ""}
                    {formatMusicFileSize(item.file.size)} · {item.message}
                  </small>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="music-bulk-import__hint">
          支持 FLAC / MP3 / WAV / M4A / OGG，单曲最多 64 MB。目录不会整包上传，
          所以七百多 MB 也可以慢慢搬。
        </p>
      )}
    </section>
  );
}
