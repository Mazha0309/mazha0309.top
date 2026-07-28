import Giscus from "@giscus/react";
import { useEffect, useRef, useState } from "react";

type GiscusConfig = {
  repo: `${string}/${string}`;
  repoId: string;
  category: string;
  categoryId: string;
};

export function PageViewBeacon({ path }: { path: string }) {
  useEffect(() => {
    const navigatorWithPrivacy = navigator as Navigator & {
      globalPrivacyControl?: boolean;
    };
    if (
      navigator.doNotTrack === "1" ||
      navigatorWithPrivacy.globalPrivacyControl
    ) {
      return;
    }
    void fetch("/api/analytics/view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path }),
      keepalive: true,
    });
  }, [path]);

  return null;
}

export function PostComments({
  postId,
  config,
}: {
  postId: string;
  config: GiscusConfig | null;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!rootRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px" },
    );
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="comments-section" ref={rootRef}>
      <div className="section-title-row">
        <div>
          <span className="micro-label">DISCUSSION CHANNEL</span>
          <h2>在纸条背面留言</h2>
        </div>
        <span className="doodle-arrow" aria-hidden="true">
          ↘
        </span>
      </div>
      {!config ? (
        <p className="empty-note">
          评论频道还没接上。等 Giscus 的四个编号填好，它就会自己亮起来。
        </p>
      ) : visible ? (
        <Giscus
          repo={config.repo}
          repoId={config.repoId}
          category={config.category}
          categoryId={config.categoryId}
          mapping="specific"
          term={`post:${postId}`}
          reactionsEnabled="1"
          emitMetadata="0"
          inputPosition="top"
          theme="light"
          lang="zh-CN"
          loading="lazy"
        />
      ) : (
        <p className="empty-note">评论频道正在靠近……</p>
      )}
    </section>
  );
}
