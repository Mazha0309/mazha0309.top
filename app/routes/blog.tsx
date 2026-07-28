import { Link } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { listPublicPosts } from "../lib/content.server";
import { PageHeading } from "../components/page-heading";
import { PostCard } from "../components/post-card";
import { PageViewBeacon } from "../components/post-engagement";

export const meta: MetaFunction = () => [
  { title: "博客纸片 — Mazha0309" },
  {
    name: "description",
    content: "技术记录、项目幕后和很难分类的生活碎片。",
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const tag = url.searchParams.get("tag")?.trim() || undefined;
  const posts = await listPublicPosts(tag);
  const allPosts = tag ? await listPublicPosts() : posts;
  const tags = [...new Set(allPosts.flatMap((post) => post.tags))].sort();
  return { posts, tag, tags };
}

export default function Blog({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  const { posts, tags, tag } = loaderData;
  return (
    <div className="page-shell content-width">
      <PageViewBeacon path="/blog" />
      <PageHeading
        eyebrow="BLOG ARCHIVE / INK STILL WET"
        title="博客纸片与施工记录"
        lead="技术、项目幕后，以及一些无法被准确归档的东西。每张纸都尽量说人话。"
        count={posts.length}
      />
      <nav className="filter-strip" aria-label="按标签筛选">
        <Link to="/blog" className={!tag ? "is-active" : undefined}>
          全部
        </Link>
        {tags.map((item) => (
          <Link
            key={item}
            to={`/blog?tag=${encodeURIComponent(item)}`}
            className={tag === item ? "is-active" : undefined}
          >
            #{item}
          </Link>
        ))}
      </nav>
      {posts.length ? (
        <div className="blog-grid">
          {posts.map((post, index) => (
            <PostCard key={post.id} post={post} index={index} />
          ))}
        </div>
      ) : (
        <div className="large-empty-state">
          <span>EMPTY POCKET</span>
          <h2>这一格还没贴东西</h2>
          <p>正在写，或者你选的标签太挑剔了。换一格看看？</p>
          <Link className="button button--secondary" to="/blog">
            清除筛选
          </Link>
        </div>
      )}
    </div>
  );
}
