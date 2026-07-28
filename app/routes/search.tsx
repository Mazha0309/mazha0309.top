import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, Link } from "react-router";
import { searchContent } from "../lib/content.server";
import { PageHeading } from "../components/page-heading";

export const meta: MetaFunction = () => [
  { title: "全站翻找 — Mazha0309" },
  { name: "robots", content: "noindex" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  return { query, hits: await searchContent(query) };
}

export default function SearchPage({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const { query, hits } = loaderData;
  return (
    <div className="page-shell content-width search-page">
      <PageHeading
        eyebrow="GLOBAL SCANNER / QUERY"
        title="翻翻这张桌子"
        lead="标题和标签会被优先找到，正文里藏得再深也会尽量捞出来。"
        count={hits.length}
      />
      <Form method="get" className="search-page__form">
        <label htmlFor="page-search">关键词</label>
        <div className="search-input-row">
          <input
            id="page-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="想找什么？"
            autoFocus
          />
          <button className="button button--primary" type="submit">
            搜索
          </button>
        </div>
      </Form>
      {query && hits.length === 0 ? (
        <div className="large-empty-state">
          <span>NO MATCH / 0</span>
          <h2>抽屉里没有这个</h2>
          <p>换个更短、更模糊的词试试。它可能只是躲得很好。</p>
        </div>
      ) : (
        <div className="search-results">
          {hits.map((hit) => (
            <article key={`${hit.type}-${hit.id}`}>
              <span>{hit.type.toUpperCase()}</span>
              <h2>
                <Link to={hit.href}>{hit.title}</Link>
              </h2>
              <p>{hit.summary}</p>
              <div className="tag-list">
                {hit.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
