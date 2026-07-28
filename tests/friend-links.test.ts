import { describe, expect, it } from "vitest";
import {
  friendHostLabel,
  friendInitial,
  isAllowedFriendAvatarUrl,
  isAllowedFriendUrl,
  normalizeFriendAccent,
} from "../app/lib/friend-links";

describe("friend link helpers", () => {
  it("allows web destinations but rejects executable protocols", () => {
    expect(isAllowedFriendUrl("https://example.com")).toBe(true);
    expect(isAllowedFriendUrl("http://example.com")).toBe(true);
    expect(isAllowedFriendUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedFriendUrl("/friends")).toBe(false);
  });

  it("allows local avatar paths without protocol-relative escapes", () => {
    expect(isAllowedFriendAvatarUrl("")).toBe(true);
    expect(isAllowedFriendAvatarUrl("/media/avatar.webp")).toBe(true);
    expect(isAllowedFriendAvatarUrl("//tracker.example/avatar")).toBe(false);
  });

  it("normalizes presentation details", () => {
    expect(normalizeFriendAccent("mint")).toBe("mint");
    expect(normalizeFriendAccent("invisible")).toBe("pink");
    expect(friendHostLabel("https://www.example.com/hello")).toBe("example.com");
    expect(friendInitial(" 喵站")).toBe("喵");
  });
});
