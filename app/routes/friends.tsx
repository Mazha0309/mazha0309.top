import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { FriendCard } from "../components/friend-card";
import { PageHeading } from "../components/page-heading";
import { PageViewBeacon } from "../components/post-engagement";
import { getSiteShell, listFriendLinks } from "../lib/content.server";

export const meta: MetaFunction = () => [
  { title: "友链交换所 — Mazha0309" },
  {
    name: "description",
    content: "散落在互联网不同角落、值得顺着网线去拜访的朋友们。",
  },
];

export async function loader(_args: LoaderFunctionArgs) {
  const [friends, shell] = await Promise.all([
    listFriendLinks(),
    getSiteShell(),
  ]);
  return { friends, email: shell.profile.email };
}

export default function Friends({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  return (
    <div className="page-shell content-width friends-page">
      <PageViewBeacon path="/friends" />
      <PageHeading
        eyebrow="FRIEND EXCHANGE / 顺着网线串门"
        title="互联网邻居交换所"
        lead="这里放一些我愿意反复拜访的小站。没有排名，只有从不同角落递过来的纸条。"
        count={loaderData.friends.length}
      />
      {loaderData.friends.length ? (
        <div className="friend-grid">
          {loaderData.friends.map((friend, index) => (
            <FriendCard key={friend.id} friend={friend} index={index} />
          ))}
        </div>
      ) : (
        <section className="friend-empty">
          <span aria-hidden="true">〰</span>
          <div>
            <span className="micro-label">EMPTY PINBOARD / 等第一张名片</span>
            <h2>友链板刚擦干净</h2>
            <p>暂时还没有挂上名片。等主人慢慢把朋友们请进来。</p>
          </div>
        </section>
      )}
      <aside className="friend-invite">
        <span className="scrap-label">LINK SWAP / 敲门请轻一点</span>
        <div>
          <h2>想来交换一张名片？</h2>
          <p>带上站名、网址、一句介绍和头像地址就好。本站不要求互链，也不收漂亮话押金。</p>
        </div>
        {loaderData.email ? (
          <a className="button button--primary" href={`mailto:${loaderData.email}`}>
            投递友链纸条 ↗
          </a>
        ) : null}
      </aside>
    </div>
  );
}
