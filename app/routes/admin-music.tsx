import { useEffect, useRef, useState } from "react";
import { Form, useActionData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "../lib/auth.server";
import {
  deleteMusicTrack,
  findMusicTrackBySourceFingerprint,
  getMusicTrack,
  listMusicTracks,
  moveMusicTrack,
  saveMusicTrack,
} from "../lib/content.server";
import {
  deleteStoredMedia,
  storeAudio,
  storeImage,
} from "../lib/media.server";
import { formString, requireSameOrigin } from "../lib/security.server";
import { isAllowedMediaUrl } from "../lib/site-customization";
import type { MusicTrackRecord } from "../lib/types";
import { audioTitleFromFilename } from "../lib/audio-metadata.server";
import { BulkMusicImporter } from "../components/bulk-music-importer";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const tracks = await listMusicTracks({ includeDisabled: true });
  return {
    tracks,
    nextPosition:
      tracks.reduce((highest, track) => Math.max(highest, track.position), -1) +
      1,
  };
}

function fileFrom(form: FormData, name: string) {
  const value = form.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

function numericPosition(value: string) {
  const position = Number(value);
  if (!Number.isFinite(position)) return 0;
  return Math.max(-9999, Math.min(9999, Math.trunc(position)));
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  requireSameOrigin(request);
  const form = await request.formData();
  const intent = formString(form, "intent", { max: 20 });
  const id = formString(form, "id", { max: 64 }) || undefined;
  const createdMediaIds: string[] = [];

  try {
    if (
      !["new", "save", "delete", "move-up", "move-down"].includes(intent)
    ) {
      throw new Error("这张操作纸条的暗号不对。");
    }
    if (intent !== "new" && !id) {
      throw new Error("找不到要操作的那首歌。");
    }
    if (intent === "delete" && id) {
      await deleteMusicTrack(id);
      return {
        ok: true,
        intent,
        recordId: id,
        message: "这首歌已经从播放器拿下来了，源文件还乖乖待在媒体抽屉。",
      };
    }
    if ((intent === "move-up" || intent === "move-down") && id) {
      await moveMusicTrack(id, intent === "move-up" ? "up" : "down");
      return {
        ok: true,
        intent,
        recordId: id,
        message: "播放顺序挪好啦。",
      };
    }

    let title = formString(form, "title", { max: 160 });
    let artist = formString(form, "artist", { max: 160 });
    let lyrics = formString(form, "lyrics", { max: 80_000 });
    let audioUrl = formString(form, "audioUrl", { max: 600 });
    let coverUrl = formString(form, "coverUrl", { max: 600 });
    let sourceFingerprint: string | null | undefined;
    let embeddedCoverUrl = "";
    const discovered: string[] = [];
    const warnings: string[] = [];
    if (!isAllowedMediaUrl(audioUrl)) {
      throw new Error("音频地址只能使用站内路径或 HTTP(S) 地址。");
    }
    if (!isAllowedMediaUrl(coverUrl)) {
      throw new Error("封面地址只能使用站内路径或 HTTP(S) 地址。");
    }

    const audioFile = fileFrom(form, "audioFile");
    if (audioFile) {
      const storedAudio = await storeAudio(
        audioFile,
        `${title || audioTitleFromFilename(audioFile.name)} / 音频`,
      );
      createdMediaIds.push(storedAudio.record.id);
      const duplicate = await findMusicTrackBySourceFingerprint(
        storedAudio.fingerprint,
      );
      if (duplicate && duplicate.id !== id) {
        throw new Error(
          `「${duplicate.title}」和这份音频一模一样，歌单里已经有一只啦。`,
        );
      }
      audioUrl = storedAudio.record.variants.original;
      sourceFingerprint = storedAudio.fingerprint;
      warnings.push(...storedAudio.warnings);
      if (!title && storedAudio.embedded.title) {
        title = storedAudio.embedded.title;
        discovered.push("歌名");
      }
      if (!artist && storedAudio.embedded.artist) {
        artist = storedAudio.embedded.artist;
        discovered.push("歌手");
      }
      if (!lyrics && storedAudio.embedded.lyrics) {
        lyrics = storedAudio.embedded.lyrics;
        discovered.push(
          storedAudio.embedded.synchronizedLyrics ? "同步歌词" : "歌词",
        );
      }
      embeddedCoverUrl = storedAudio.embedded.coverUrl ?? "";
    } else if (id) {
      const existingTrack = await getMusicTrack(id);
      if (!existingTrack) {
        throw new Error("这首歌已经不在播放清单里了。");
      }
      if (existingTrack.audioUrl !== audioUrl) {
        // A fingerprint belongs to the uploaded bytes, not to a later URL the
        // owner may paste over them.
        sourceFingerprint = null;
      }
    }
    if (!title && audioFile) {
      title = audioTitleFromFilename(audioFile.name);
      discovered.push("文件名歌名");
    }
    const coverFile = fileFrom(form, "coverFile");
    if (coverFile) {
      const storedCover = await storeImage(coverFile, `${title} 的音乐封面`);
      createdMediaIds.push(storedCover.id);
      coverUrl = storedCover.variants.webp ?? storedCover.variants.original;
    } else if (!coverUrl && embeddedCoverUrl) {
      coverUrl = embeddedCoverUrl;
      discovered.push("内嵌封面");
    }
    if (!title) {
      throw new Error("远程音频没有可读标签，还是要给它写个歌名喔。");
    }
    if (!audioUrl) {
      throw new Error("还没有音频：上传一首，或者贴一个可以播放的地址。");
    }

    const track = await saveMusicTrack({
      id: intent === "new" ? undefined : id,
      title,
      artist,
      audioUrl,
      sourceFingerprint,
      coverUrl: coverUrl || null,
      lyrics,
      position: numericPosition(formString(form, "position", { max: 8 })),
      enabled: form.get("enabled") === "on",
    });
    return {
      ok: true,
      intent,
      recordId: track.id,
      message: [
        `「${track.title}」已经塞进播放清单啦。`,
        discovered.length
          ? `自动从音频里捡到：${discovered.join("、")}。`
          : "",
        ...warnings,
      ]
        .filter(Boolean)
        .join(" "),
    };
  } catch (error) {
    await Promise.all(
      createdMediaIds.map((mediaId) =>
        deleteStoredMedia(mediaId).catch(() => undefined),
      ),
    );
    return {
      ok: false,
      error: error instanceof Error ? error.message : "保存时纸带打结了。",
    };
  }
}

function TrackFields({ track }: { track?: MusicTrackRecord }) {
  return (
    <>
      {track ? <input type="hidden" name="id" value={track.id} /> : null}
      <div className="form-grid music-track-fields">
        <label className="field">
          <span>歌名 <small>TITLE / TAG AUTO</small></span>
          <input
            name="title"
            defaultValue={track?.title ?? ""}
            maxLength={160}
            placeholder="空着就读音频标签"
          />
        </label>
        <label className="field">
          <span>歌手 <small>ARTIST / TAG AUTO</small></span>
          <input
            name="artist"
            defaultValue={track?.artist ?? ""}
            maxLength={160}
            placeholder="空着就读音频标签"
          />
        </label>
        <label className="field field--wide">
          <span>音频地址 <small>INTERNAL / HTTP(S)</small></span>
          <input
            name="audioUrl"
            inputMode="url"
            defaultValue={track?.audioUrl ?? ""}
            maxLength={600}
            placeholder="/media/…/original.mp3 或 https://…"
          />
        </label>
        <label className="field field--wide music-upload-field">
          <span>上传音频 <small>FLAC / MP3 / WAV · MAX 64 MB</small></span>
          <input
            name="audioFile"
            type="file"
            accept=".flac,.mp3,.wav,.m4a,.ogg,audio/flac,audio/x-flac,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/ogg"
          />
          <small>
            {track
              ? "选新文件会替换音频；把文字项清空，才会让新文件的标签接管。"
              : "会自动读取歌名、歌手、内嵌封面与歌词；手填内容优先。"}
          </small>
        </label>
        <label className="field">
          <span>封面地址 <small>OPTIONAL / TAG AUTO</small></span>
          <input
            name="coverUrl"
            inputMode="url"
            defaultValue={track?.coverUrl ?? ""}
            maxLength={600}
            placeholder="/media/…/display.webp"
          />
        </label>
        <label className="field music-upload-field">
          <span>另传封面 <small>OVERRIDE / MAX 8 MB</small></span>
          <input
            name="coverFile"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
          />
        </label>
        <label className="field field--wide">
          <span>歌词 <small>LRC / TEXT / TAG AUTO</small></span>
          <textarea
            name="lyrics"
            rows={9}
            defaultValue={track?.lyrics ?? ""}
            placeholder={"空着就读取音频内嵌歌词。\n\n也可以手动贴：\n[00:03.20] 第一行会跟着进度亮起来\n[00:08.60] 第二行也会"}
          />
        </label>
        <label className="field">
          <span>排序数字 <small>POSITION</small></span>
          <input name="position" type="number" defaultValue={track?.position ?? 0} />
        </label>
        <label className="check-field">
          <input name="enabled" type="checkbox" defaultChecked={track?.enabled ?? true} />
          <span>放进公开播放器</span>
        </label>
      </div>
      {track?.audioUrl ? (
        <div className="music-track-preview">
          {track.coverUrl ? <img src={track.coverUrl} alt="" /> : <span aria-hidden="true">♫</span>}
          <div>
            <strong>{track.title}</strong>
            <small>{track.artist || "神秘演奏者"}</small>
          </div>
          <audio controls preload="metadata" src={track.audioUrl}>
            你的浏览器暂时不会播放这个音频。
          </audio>
        </div>
      ) : null}
    </>
  );
}

export default function AdminMusic({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const actionData = useActionData<typeof action>();
  const [createFormKey, setCreateFormKey] = useState(0);
  const handledCreate = useRef<string | null>(null);

  useEffect(() => {
    if (
      actionData?.ok &&
      actionData.intent === "new" &&
      actionData.recordId !== handledCreate.current
    ) {
      handledCreate.current = actionData.recordId;
      setCreateFormKey((current) => current + 1);
    }
  }, [actionData]);

  return (
    <>
      <header className="admin-heading">
        <span className="micro-label">POCKET RADIO / 小窗歌单</span>
        <h1>给右下角塞几首歌</h1>
        <p>FLAC、MP3、WAV 里的歌名、歌手、封面和歌词会自己跳出来；手填内容会优先覆盖标签。</p>
      </header>
      {actionData?.ok ? (
        <p className="form-message form-message--success">{actionData.message}</p>
      ) : null}
      {actionData && !actionData.ok ? (
        <p className="form-message form-message--error">{actionData.error}</p>
      ) : null}

      <BulkMusicImporter
        nextPosition={loaderData.nextPosition}
        knownFingerprints={loaderData.tracks.flatMap((track) =>
          track.sourceFingerprint ? [track.sourceFingerprint] : [],
        )}
      />

      <details className="admin-panel create-panel">
        <summary>＋ 往歌单塞一首</summary>
        <Form method="post" encType="multipart/form-data" key={createFormKey}>
          <TrackFields />
          <button className="button button--primary" name="intent" value="new">
            收进播放清单
          </button>
        </Form>
      </details>

      <div className="admin-card-stack music-admin-stack">
        {loaderData.tracks.map((track, index) => (
          <details className="admin-panel" key={track.id}>
            <summary>
              <strong>{track.title}</strong>
              <span>
                {track.enabled ? "ON AIR" : "躲起来了"} · {index + 1}/{loaderData.tracks.length}
              </span>
            </summary>
            <Form method="post" encType="multipart/form-data">
              <TrackFields track={track} />
              <div className="form-actions music-track-actions">
                <button className="button button--primary" name="intent" value="save">
                  保存这首
                </button>
                <button
                  className="button button--small"
                  name="intent"
                  value="move-up"
                  disabled={index === 0}
                >
                  ↑ 往前
                </button>
                <button
                  className="button button--small"
                  name="intent"
                  value="move-down"
                  disabled={index === loaderData.tracks.length - 1}
                >
                  ↓ 往后
                </button>
                <button
                  className="text-button text-button--danger"
                  name="intent"
                  value="delete"
                  onClick={(event) => {
                    if (!window.confirm(`把「${track.title}」从歌单拿下来？`)) {
                      event.preventDefault();
                    }
                  }}
                >
                  移出歌单
                </button>
              </div>
            </Form>
          </details>
        ))}
        {!loaderData.tracks.length ? (
          <div className="admin-empty">
            <strong>歌单现在空空的</strong>
            <p>先塞一首进去，公开页面右下角才会冒出唱片按钮。</p>
          </div>
        ) : null}
      </div>
    </>
  );
}
