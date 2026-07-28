import { Link } from "react-router";
import type { PostSummary } from "../lib/types";

function formatDate(value?: Date | string | null) {
  if (!value) return "尚未标日期";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function PostCard({
  post,
  index = 0,
}: {
  post: PostSummary;
  index?: number;
}) {
  return (
    <article className={`post-card post-card--${(index % 3) + 1}`}>
      <div className="post-card__meta">
        <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
        <span>{post.readingMinutes ?? 1} MIN READ</span>
      </div>
      <h3>
        <Link to={`/blog/${post.slug}`}>{post.title}</Link>
      </h3>
      <p>{post.summary}</p>
      <div className="post-card__foot">
        <div className="tag-list" aria-label="文章标签">
          {post.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
        <Link className="arrow-link" to={`/blog/${post.slug}`} aria-label={`阅读${post.title}`}>
          阅读纸片 ↗
        </Link>
      </div>
    </article>
  );
}
