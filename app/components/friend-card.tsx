import {
  friendHostLabel,
  friendInitial,
  normalizeFriendAccent,
} from "../lib/friend-links";
import type { FriendLinkRecord } from "../lib/types";

export function FriendCard({
  friend,
  index,
}: {
  friend: FriendLinkRecord;
  index: number;
}) {
  return (
    <a
      className={`friend-card friend-card--${normalizeFriendAccent(friend.accent)}`}
      href={friend.url}
      target="_blank"
      rel="friend noreferrer"
      style={{ "--friend-index": index } as React.CSSProperties}
    >
      <span className="friend-card__pin" aria-hidden="true" />
      <span className="friend-card__avatar">
        {friend.avatarUrl ? (
          <img
            src={friend.avatarUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span aria-hidden="true">{friendInitial(friend.name)}</span>
        )}
      </span>
      <span className="friend-card__copy">
        <span className="micro-label">
          FRIEND-{String(index + 1).padStart(2, "0")}
        </span>
        <strong>{friend.name}</strong>
        <span>{friend.description || "这位朋友没有写介绍，保持一点神秘。"}</span>
        <small>{friendHostLabel(friend.url)} ↗</small>
      </span>
    </a>
  );
}
