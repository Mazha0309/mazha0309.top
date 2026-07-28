import type {
  ContentLink,
  PageRecord,
  PostRecord,
  ProjectRecord,
  SiteProfile,
} from "./types";
import { defaultSiteCustomization } from "./site-customization";

export const fallbackProfile: SiteProfile = {
  id: "main",
  displayName: "Mazha0309",
  handle: "@Mazha0309",
  heroEyebrow: "HELLO FROM MAZHA / 欢迎来玩",
  heroTitle: "喵喵喵，这里是 Mazha0309",
  heroIntro:
    "一个把代码、无线电、怪点子和生活碎片钉在同一块软木板上的个人主页。",
  bio: "喵喵喵。会写一点代码，也会认真把无聊的东西做得不那么无聊。",
  avatarUrl: "https://avatars.githubusercontent.com/u/99137842?v=4",
  location: "Internet",
  statusText: "正在折腾一只会长大的主页",
  email: "",
  customization: defaultSiteCustomization,
};

export const fallbackLinks: ContentLink[] = [
  {
    id: "nav-home",
    kind: "nav",
    label: "HOME",
    url: "/",
    position: 0,
    enabled: true,
  },
  {
    id: "nav-blog",
    kind: "nav",
    label: "BLOG",
    url: "/blog",
    position: 1,
    enabled: true,
  },
  {
    id: "nav-projects",
    kind: "nav",
    label: "PROJECTS",
    url: "/projects",
    position: 2,
    enabled: true,
  },
  {
    id: "nav-about",
    kind: "nav",
    label: "ABOUT",
    url: "/about",
    position: 3,
    enabled: true,
  },
  {
    id: "social-github",
    kind: "social",
    label: "GitHub",
    url: "https://github.com/Mazha0309",
    note: "代码和施工现场",
    position: 0,
    enabled: true,
  },
];

export const fallbackPosts: PostRecord[] = [];

export const fallbackProjects: ProjectRecord[] = [
  {
    id: "b7f174dd-f7f0-4822-b68d-a7cbb3662a37",
    slug: "open-log-tool",
    title: "OpenLogTool",
    summary: "开源的业余无线电模拟点名记录工具。",
    bodyMdx: "把点名记录做成一个更顺手、更开放的小工具。",
    stack: ["Dart", "Ham Radio"],
    repoUrl: "https://github.com/Mazha0309/OpenLogTool",
    liveUrl: null,
    coverUrl: null,
    accent: "yellow",
    featured: true,
    position: 0,
    statusLabel: "ON AIR",
  },
  {
    id: "eced6db1-a8ec-4375-8f7e-ed93f9f9beb7",
    slug: "the-evil-repository",
    title: "the-evil-repository",
    summary:
      "一个证据敌对、容器隔离的长时程 AI 软件代理基准与行为分析平台。",
    bodyMdx: "观察代理在不友好证据环境里会怎么行动。",
    stack: ["Python", "Agents", "Containers"],
    repoUrl: "https://github.com/Mazha0309/the-evil-repository",
    liveUrl: null,
    coverUrl: null,
    accent: "pink",
    featured: true,
    position: 1,
    statusLabel: "EXPERIMENT",
  },
  {
    id: "83b843fc-1884-4e5b-a190-90b3cc94ddac",
    slug: "relay-qr",
    title: "RelayQR",
    summary: "自托管动态二维码管理器，可以单独控制每个二维码的跳转。",
    bodyMdx: "让已经打印出去的二维码，仍然保有一点回旋余地。",
    stack: ["TypeScript", "Self-hosted"],
    repoUrl: "https://github.com/Mazha0309/RelayQR",
    liveUrl: null,
    coverUrl: null,
    accent: "blue",
    featured: true,
    position: 2,
    statusLabel: "DEPLOYABLE",
  },
];

export const fallbackPages: PageRecord[] = [
  {
    id: "4ba21619-0f62-4f74-8124-e589f20ae956",
    slug: "about",
    title: "关于这只 Mazha",
    eyebrow: "ABOUT ME / 一点自我介绍",
    contentMdx: `## 嗨，我是 Mazha0309

平时写代码、折腾自托管服务，也对业余无线电和各种不太必要但很好玩的工具感兴趣。

这个网站不是一份端正的简历。它更像一张长期不收拾的工作台：项目放左边，笔记压在下面，偶尔还有猫踩过。

<Stamp>认真制作，真心欢迎</Stamp>

## 可以在这里找到什么

- 做过的项目与仍在施工的洞
- 技术记录、设计过程和失败样本
- 一些没有合适平台可放的东西`,
  },
  {
    id: "9a27e990-d92d-4368-a76f-e55ee2381c67",
    slug: "now",
    title: "NOW",
    eyebrow: "THESE DAYS / 最近",
    contentMdx: `最近正在把这个主页从一张空白纸，慢慢贴成自己的样子。

- 整理旧项目
- 给博客后台加抽屉
- 尝试少开一点新坑（失败中）`,
  },
];
