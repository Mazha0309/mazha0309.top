import type { SiteAccent, SiteCustomization } from "./types";

export const defaultSiteCustomization: SiteCustomization = {
  siteTitle: "Mazha0309 — 喵喵喵的数字工作台",
  siteDescription: "项目、文章和正在发生的怪点子，全都钉在这张数字工作台上。",
  brandMark: "M",
  brandSubtitle: "HOMEPAGE & BLOG",
  footerText: "这张纸由 React、PostgreSQL 和一点不必要的执念驱动。",
  heroKicker: "HELLO, FRIEND / 欢迎来玩",
  primaryActionLabel: "翻阅博客",
  primaryActionUrl: "/blog",
  secondaryActionLabel: "看看项目",
  secondaryActionUrl: "/projects",
  marqueeText: "CODE / RADIO / SELF-HOSTED / ODD IDEAS /",
  projectsEyebrow: "THINGS I MADE / 近期施工",
  projectsTitle: "拿得出手的几个坑",
  blogEyebrow: "LATEST NOTES / 新贴上去的",
  blogTitle: "博客纸片",
  nowEyebrow: "THESE DAYS / 最近",
  nowTitle: "现在在干嘛",
  signoffText: "如果你也在造一些奇怪但认真的东西，我们大概聊得来。",
  signoffLinkLabel: "去 GitHub 敲门",
  signoffLinkUrl: "https://github.com/Mazha0309",
  accentColor: "pink",
  showProjects: true,
  showBlog: true,
  showNow: true,
  showSignoff: true,
};

const accents = new Set<SiteAccent>(["pink", "blue", "mint", "purple", "orange"]);

export function normalizeSiteCustomization(input: unknown): SiteCustomization {
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const text = (key: keyof SiteCustomization): string =>
    typeof source[key] === "string"
      ? String(source[key]).slice(0, 600)
      : String(defaultSiteCustomization[key]);
  const flag = (key: keyof SiteCustomization) =>
    typeof source[key] === "boolean"
      ? source[key] as boolean
      : defaultSiteCustomization[key] as boolean;
  const candidateAccent = source.accentColor;

  return {
    siteTitle: text("siteTitle"),
    siteDescription: text("siteDescription"),
    brandMark: text("brandMark").slice(0, 2) || defaultSiteCustomization.brandMark,
    brandSubtitle: text("brandSubtitle"),
    footerText: text("footerText"),
    heroKicker: text("heroKicker"),
    primaryActionLabel: text("primaryActionLabel"),
    primaryActionUrl: text("primaryActionUrl"),
    secondaryActionLabel: text("secondaryActionLabel"),
    secondaryActionUrl: text("secondaryActionUrl"),
    marqueeText: text("marqueeText"),
    projectsEyebrow: text("projectsEyebrow"),
    projectsTitle: text("projectsTitle"),
    blogEyebrow: text("blogEyebrow"),
    blogTitle: text("blogTitle"),
    nowEyebrow: text("nowEyebrow"),
    nowTitle: text("nowTitle"),
    signoffText: text("signoffText"),
    signoffLinkLabel: text("signoffLinkLabel"),
    signoffLinkUrl: text("signoffLinkUrl"),
    accentColor:
      typeof candidateAccent === "string" && accents.has(candidateAccent as SiteAccent)
        ? candidateAccent as SiteAccent
        : defaultSiteCustomization.accentColor,
    showProjects: flag("showProjects"),
    showBlog: flag("showBlog"),
    showNow: flag("showNow"),
    showSignoff: flag("showSignoff"),
  };
}

export function isAllowedDisplayUrl(value: string) {
  if (!value) return true;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return true;
  try {
    const parsed = new URL(value);
    return ["http:", "https:", "mailto:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}
