import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { activeLyricIndex, parseLyrics } from "../lib/lyrics";
import type { MusicTrackRecord } from "../lib/types";

const CURRENT_TRACK_KEY = "mazha-music-current-track";
const TRACK_PROGRESS_PREFIX = "mazha-music-progress:";

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function readSavedTime(trackId: string) {
  try {
    const value = Number(
      window.localStorage.getItem(`${TRACK_PROGRESS_PREFIX}${trackId}`),
    );
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

function saveTrackState(trackId: string, currentTime: number) {
  try {
    window.localStorage.setItem(CURRENT_TRACK_KEY, trackId);
    window.localStorage.setItem(
      `${TRACK_PROGRESS_PREFIX}${trackId}`,
      String(Math.max(0, currentTime)),
    );
  } catch {
    // Private browsing may deny storage; music still works for this page visit.
  }
}

export function FloatingMusicPlayer({
  tracks,
}: {
  tracks: MusicTrackRecord[];
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lyricRefs = useRef<Array<HTMLButtonElement | HTMLParagraphElement | null>>([]);
  const pendingPlayRef = useRef(false);
  const nextStartTimeRef = useRef<number | null>(null);
  const lastSavedSecondRef = useRef(-1);
  const loadedTrackIdRef = useRef(tracks[0]?.id ?? "");
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"lyrics" | "playlist">("lyrics");
  const [currentTrackId, setCurrentTrackId] = useState(tracks[0]?.id ?? "");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState("");

  const currentIndex = Math.max(
    0,
    tracks.findIndex((track) => track.id === currentTrackId),
  );
  const track = tracks[currentIndex] ?? tracks[0];
  const parsedLyrics = useMemo(
    () => parseLyrics(track?.lyrics ?? ""),
    [track?.lyrics],
  );
  const activeIndex = parsedLyrics.timed
    ? activeLyricIndex(parsedLyrics.lines, currentTime)
    : -1;
  const currentLyric = parsedLyrics.timed
    ? parsedLyrics.lines[activeIndex]?.text ?? "前奏正慢吞吞地走过来…"
    : parsedLyrics.lines[0]?.text ?? "这首歌还没有贴歌词纸条。";

  useEffect(() => {
    try {
      const savedId = window.localStorage.getItem(CURRENT_TRACK_KEY);
      if (savedId && tracks.some((candidate) => candidate.id === savedId)) {
        setCurrentTrackId(savedId);
      }
    } catch {
      // Storage is only a convenience.
    }
  }, []);

  useEffect(() => {
    if (!tracks.some((candidate) => candidate.id === currentTrackId)) {
      setCurrentTrackId(tracks[0]?.id ?? "");
    }
  }, [currentTrackId, tracks]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open || panel !== "lyrics" || activeIndex < 0) return;
    const activeLine = lyricRefs.current[activeIndex];
    if (!activeLine?.scrollIntoView) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    activeLine.scrollIntoView({
      block: "center",
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [activeIndex, open, panel]);

  if (!track) return null;

  function selectTrack(index: number, shouldPlay: boolean) {
    const nextTrack = tracks[(index + tracks.length) % tracks.length];
    if (!nextTrack) return;
    const audio = audioRef.current;
    if (audio && nextTrack.id === loadedTrackIdRef.current) {
      audio.currentTime = 0;
      setCurrentTime(0);
      setError("");
      saveTrackState(nextTrack.id, 0);
      if (shouldPlay) void play();
      return;
    }
    if (audio && loadedTrackIdRef.current) {
      saveTrackState(loadedTrackIdRef.current, audio.currentTime);
    }
    pendingPlayRef.current = shouldPlay;
    nextStartTimeRef.current = 0;
    lastSavedSecondRef.current = -1;
    setError("");
    setCurrentTime(0);
    setDuration(0);
    setCurrentTrackId(nextTrack.id);
    try {
      window.localStorage.setItem(CURRENT_TRACK_KEY, nextTrack.id);
    } catch {
      // Ignore storage failures.
    }
  }

  async function play() {
    const audio = audioRef.current;
    if (!audio) return;
    setError("");
    try {
      await audio.play();
    } catch {
      setPlaying(false);
      setError("浏览器把这次播放拦住了，再戳一下播放键试试。");
    }
  }

  function togglePlaying() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void play();
    else audio.pause();
  }

  function onLoadedMetadata() {
    const audio = audioRef.current;
    if (!audio) return;
    loadedTrackIdRef.current = track.id;
    const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
    setDuration(nextDuration);
    const requestedTime =
      nextStartTimeRef.current ?? readSavedTime(track.id);
    nextStartTimeRef.current = null;
    if (requestedTime > 0 && requestedTime < nextDuration - 1) {
      audio.currentTime = requestedTime;
      setCurrentTime(requestedTime);
    } else {
      audio.currentTime = 0;
      setCurrentTime(0);
    }
    if (pendingPlayRef.current) {
      pendingPlayRef.current = false;
      void play();
    }
  }

  function onProgressChange(event: ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = Number(event.currentTarget.value);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
    saveTrackState(track.id, nextTime);
  }

  function onTimeUpdate() {
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = audio.currentTime;
    setCurrentTime(nextTime);
    if (Number.isFinite(audio.duration) && audio.duration !== duration) {
      setDuration(audio.duration);
    }
    const wholeSecond = Math.floor(nextTime);
    if (
      wholeSecond % 2 === 0 &&
      wholeSecond !== lastSavedSecondRef.current
    ) {
      lastSavedSecondRef.current = wholeSecond;
      saveTrackState(loadedTrackIdRef.current || track.id, nextTime);
    }
  }

  function previousTrack() {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      saveTrackState(track.id, 0);
      return;
    }
    selectTrack(currentIndex - 1, playing);
  }

  function nextTrack() {
    selectTrack(currentIndex + 1, playing);
  }

  return (
    <section className={`floating-music${open ? " is-open" : ""}`}>
      {open ? (
        <div
          className="floating-music__window"
          id="floating-music-window"
          role="region"
          aria-label="口袋音乐播放器"
        >
          <span className="floating-music__tape" aria-hidden="true" />
          <header className="floating-music__header">
            <div className={`floating-music__disc${playing ? " is-playing" : ""}`}>
              {track.coverUrl ? (
                <img src={track.coverUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span aria-hidden="true">♫</span>
              )}
            </div>
            <div className="floating-music__title">
              <small>NOW HUMMING / {currentIndex + 1} OF {tracks.length}</small>
              <strong>{track.title}</strong>
              <span>{track.artist || "神秘演奏者"}</span>
            </div>
            <button
              className="floating-music__close"
              type="button"
              onClick={() => setOpen(false)}
              aria-label="收起音乐播放器"
            >
              ×
            </button>
          </header>

          <p className="floating-music__current-lyric" aria-live="polite">
            {currentLyric}
          </p>

          <div className="floating-music__progress">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              onChange={onProgressChange}
              aria-label={`「${track.title}」播放进度`}
            />
            <div>
              <time>{formatTime(currentTime)}</time>
              <time>{formatTime(duration)}</time>
            </div>
          </div>

          <div className="floating-music__controls">
            <button type="button" onClick={previousTrack} aria-label="上一首">
              <span aria-hidden="true">↶</span>
            </button>
            <button
              className="floating-music__play"
              type="button"
              onClick={togglePlaying}
              aria-label={playing ? "暂停" : "播放"}
            >
              <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>
            </button>
            <button type="button" onClick={nextTrack} aria-label="下一首">
              <span aria-hidden="true">↷</span>
            </button>
          </div>

          {error ? <p className="floating-music__error">{error}</p> : null}

          <div className="floating-music__tabs" role="group" aria-label="播放器内容">
            <button
              type="button"
              aria-controls="floating-music-panel-lyrics"
              aria-pressed={panel === "lyrics"}
              onClick={() => setPanel("lyrics")}
            >
              歌词纸
            </button>
            <button
              type="button"
              aria-controls="floating-music-panel-playlist"
              aria-pressed={panel === "playlist"}
              onClick={() => setPanel("playlist")}
            >
              歌单 {tracks.length}
            </button>
          </div>

          {panel === "lyrics" ? (
            <div
              className="floating-music__lyrics"
              id="floating-music-panel-lyrics"
            >
              {parsedLyrics.lines.length ? (
                parsedLyrics.lines.map((line, index) =>
                  parsedLyrics.timed ? (
                    <button
                      key={`${line.time}-${index}`}
                      ref={(element) => {
                        lyricRefs.current[index] = element;
                      }}
                      type="button"
                      className={index === activeIndex ? "is-active" : undefined}
                      aria-current={index === activeIndex ? "true" : undefined}
                      onClick={() => {
                        const audio = audioRef.current;
                        if (!audio || line.time === null) return;
                        audio.currentTime = line.time;
                        setCurrentTime(line.time);
                      }}
                    >
                      {line.text}
                    </button>
                  ) : (
                    <p
                      key={`${line.text}-${index}`}
                      ref={(element) => {
                        lyricRefs.current[index] = element;
                      }}
                    >
                      {line.text}
                    </p>
                  ),
                )
              ) : (
                <p className="floating-music__empty">歌词纸忘在家里了，先听旋律吧。</p>
              )}
            </div>
          ) : (
            <div
              className="floating-music__playlist"
              id="floating-music-panel-playlist"
            >
              {tracks.map((candidate, index) => (
                <button
                  key={candidate.id}
                  type="button"
                  className={candidate.id === track.id ? "is-active" : undefined}
                  aria-current={candidate.id === track.id ? "true" : undefined}
                  onClick={() => {
                    if (candidate.id !== track.id) selectTrack(index, playing);
                    setPanel("lyrics");
                  }}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{candidate.title}</strong>
                  <small>{candidate.artist || "神秘演奏者"}</small>
                </button>
              ))}
            </div>
          )}

        </div>
      ) : null}

      <audio
        ref={audioRef}
        src={track.audioUrl}
        preload="metadata"
        aria-hidden="true"
        onLoadedMetadata={onLoadedMetadata}
        onDurationChange={() => {
          const audio = audioRef.current;
          if (audio && Number.isFinite(audio.duration)) {
            setDuration(audio.duration);
          }
        }}
        onTimeUpdate={onTimeUpdate}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          const audio = audioRef.current;
          if (audio && loadedTrackIdRef.current) {
            saveTrackState(loadedTrackIdRef.current, audio.currentTime);
          }
        }}
        onEnded={() => selectTrack(currentIndex + 1, true)}
        onError={() => {
          setPlaying(false);
          setError("这首歌的纸带读不出来，检查一下地址或文件格式吧。");
        }}
      />

      <button
        className={`floating-music__toggle${playing ? " is-playing" : ""}`}
        type="button"
        aria-label={
          open
            ? "收起音乐播放器"
            : playing
              ? "打开音乐播放器，正在播放"
              : "打开音乐播放器"
        }
        aria-expanded={open}
        aria-controls={open ? "floating-music-window" : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="floating-music__toggle-note" aria-hidden="true">♫</span>
        <span className="floating-music__toggle-label">{open ? "收起来" : "听点歌"}</span>
      </button>
    </section>
  );
}
