import type { ActionFunctionArgs } from "react-router";
import { requireAdmin } from "../lib/auth.server";
import {
  findMusicTrackBySourceFingerprint,
  saveMusicTrack,
} from "../lib/content.server";
import {
  deleteStoredMedia,
  storeAudio,
} from "../lib/media.server";
import { audioTitleFromFilename } from "../lib/audio-metadata.server";
import { formString, requireSameOrigin } from "../lib/security.server";

function importPosition(value: string) {
  const position = Number(value);
  if (!Number.isFinite(position)) return 0;
  return Math.max(-9999, Math.min(9999, Math.trunc(position)));
}

function errorMessage(error: unknown) {
  if (error instanceof Response) {
    if (error.status === 413) return "这首歌太胖了，单曲不能超过 64 MB。";
    if (error.status === 403) return "这张投喂纸条不是从本站递来的。";
  }
  return error instanceof Error ? error.message : "上传纸带突然打结了。";
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  requireSameOrigin(request);

  let createdMediaId: string | null = null;
  try {
    const form = await request.formData();
    const audioFile = form.get("audioFile");
    if (!(audioFile instanceof File) || audioFile.size <= 0) {
      return Response.json(
        { ok: false, error: "没有在这张纸条里找到音频文件。" },
        { status: 400 },
      );
    }

    const storedAudio = await storeAudio(
      audioFile,
      `${audioTitleFromFilename(audioFile.name)} / 批量导入`,
    );
    createdMediaId = storedAudio.record.id;

    const duplicate = await findMusicTrackBySourceFingerprint(
      storedAudio.fingerprint,
    );
    if (duplicate) {
      await deleteStoredMedia(createdMediaId);
      createdMediaId = null;
      return Response.json({
        ok: true,
        status: "duplicate",
        message: `「${duplicate.title}」已经趴在歌单里，不再复制一只。`,
        track: {
          id: duplicate.id,
          title: duplicate.title,
          artist: duplicate.artist,
          coverUrl: duplicate.coverUrl,
        },
      });
    }

    const title =
      storedAudio.embedded.title || audioTitleFromFilename(audioFile.name);
    const trackInput = {
      title,
      artist: storedAudio.embedded.artist,
      audioUrl: storedAudio.record.variants.original,
      sourceFingerprint: storedAudio.fingerprint,
      coverUrl: storedAudio.embedded.coverUrl,
      lyrics: storedAudio.embedded.lyrics,
      position: importPosition(formString(form, "position", { max: 8 })),
      enabled: true,
    };

    let track;
    try {
      track = await saveMusicTrack(trackInput);
    } catch (error) {
      // A second queue or browser tab may have finished the same file between
      // the first lookup and the unique insert. Treat that race as a duplicate.
      const racedDuplicate = await findMusicTrackBySourceFingerprint(
        storedAudio.fingerprint,
      );
      if (!racedDuplicate) throw error;
      await deleteStoredMedia(createdMediaId);
      createdMediaId = null;
      return Response.json({
        ok: true,
        status: "duplicate",
        message: `「${racedDuplicate.title}」刚刚已经被另一条队列收下啦。`,
        track: {
          id: racedDuplicate.id,
          title: racedDuplicate.title,
          artist: racedDuplicate.artist,
          coverUrl: racedDuplicate.coverUrl,
        },
      });
    }

    createdMediaId = null;
    return Response.json(
      {
        ok: true,
        status: "imported",
        message: [
          `「${track.title}」已经跳进播放器。`,
          ...storedAudio.warnings,
        ].join(" "),
        track: {
          id: track.id,
          title: track.title,
          artist: track.artist,
          coverUrl: track.coverUrl,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (createdMediaId) {
      await deleteStoredMedia(createdMediaId).catch(() => undefined);
    }
    return Response.json(
      { ok: false, error: errorMessage(error) },
      { status: error instanceof Response ? error.status : 400 },
    );
  }
}
