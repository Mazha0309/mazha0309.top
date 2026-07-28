export type PublishStatus = "draft" | "scheduled" | "published";

export type SiteAccent = "pink" | "blue" | "mint" | "purple" | "orange";
export type ProjectIconMode = "random" | "preset" | "custom" | "image";
export type ProjectIconShape =
  | "random"
  | "blob"
  | "circle"
  | "rounded"
  | "diamond"
  | "hexagon"
  | "ticket"
  | "burst"
  | "flower";

export interface SiteCustomization {
  siteTitle: string;
  siteDescription: string;
  brandMark: string;
  brandSubtitle: string;
  footerText: string;
  heroKicker: string;
  primaryActionLabel: string;
  primaryActionUrl: string;
  secondaryActionLabel: string;
  secondaryActionUrl: string;
  marqueeText: string;
  projectsEyebrow: string;
  projectsTitle: string;
  blogEyebrow: string;
  blogTitle: string;
  nowEyebrow: string;
  nowTitle: string;
  signoffText: string;
  signoffLinkLabel: string;
  signoffLinkUrl: string;
  accentColor: SiteAccent;
  showProjects: boolean;
  showBlog: boolean;
  showNow: boolean;
  showSignoff: boolean;
}

export interface SiteProfile {
  id: string;
  displayName: string;
  handle: string;
  heroEyebrow: string;
  heroTitle: string;
  heroIntro: string;
  bio: string;
  avatarUrl: string;
  location: string;
  statusText: string;
  email: string;
  customization: SiteCustomization;
  updatedAt?: Date | string;
}

export interface ContentLink {
  id: string;
  kind: "nav" | "social";
  label: string;
  url: string;
  note?: string | null;
  position: number;
  enabled: boolean;
}

export interface PostSummary {
  id: string;
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  coverUrl?: string | null;
  status: PublishStatus;
  featured: boolean;
  publishedAt?: Date | string | null;
  scheduledAt?: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  readingMinutes?: number;
}

export interface PostRecord extends PostSummary {
  contentMdx: string;
  contentText: string;
}

export interface ProjectRecord {
  id: string;
  slug: string;
  title: string;
  summary: string;
  bodyMdx: string;
  stack: string[];
  repoUrl?: string | null;
  liveUrl?: string | null;
  coverUrl?: string | null;
  accent: string;
  iconMode: ProjectIconMode;
  iconValue: string;
  iconShape: ProjectIconShape;
  featured: boolean;
  position: number;
  statusLabel: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface FriendLinkRecord {
  id: string;
  name: string;
  url: string;
  avatarUrl?: string | null;
  description: string;
  accent: string;
  position: number;
  enabled: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface PageRecord {
  id: string;
  slug: string;
  title: string;
  eyebrow: string;
  contentMdx: string;
  updatedAt?: Date | string;
}

export interface MediaRecord {
  id: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  alt: string;
  width?: number | null;
  height?: number | null;
  sizeBytes: number;
  variants: Record<string, string>;
  createdAt?: Date | string;
}

export interface SearchHit {
  id: string;
  type: "post" | "project" | "page";
  title: string;
  summary: string;
  href: string;
  tags: string[];
  score?: number;
}
