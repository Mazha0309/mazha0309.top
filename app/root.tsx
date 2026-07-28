import {
  isRouteErrorResponse,
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";
import type { LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import stylesheet from "./styles/global.css?url";
import articleStylesheet from "./styles/article.css?url";
import { getSiteShell } from "./lib/content.server";
import { SearchPalette } from "./components/search-palette";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  { rel: "stylesheet", href: articleStylesheet },
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
];

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => [
  { title: loaderData?.profile.customization.siteTitle ?? "Mazha0309" },
  {
    name: "description",
    content: loaderData?.profile.customization.siteDescription ?? "Mazha0309 的个人主页与博客。",
  },
  { property: "og:type", content: "website" },
  { property: "og:title", content: loaderData?.profile.customization.siteTitle ?? "Mazha0309" },
  {
    property: "og:description",
    content: loaderData?.profile.customization.siteDescription ?? "Mazha0309 的个人主页与博客。",
  },
];

export async function loader(_args: LoaderFunctionArgs) {
  return getSiteShell();
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#f5efe5" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function Brand({
  displayName,
  mark,
  subtitle,
}: {
  displayName: string;
  mark: string;
  subtitle: string;
}) {
  return (
    <NavLink to="/" className="brand" aria-label={`${displayName} 首页`}>
      <span className="brand__mark" aria-hidden="true">
        {mark}
      </span>
      <span>
        <strong>{displayName}</strong>
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
    </NavLink>
  );
}

export default function App() {
  const { profile, links } = useLoaderData<typeof loader>();
  const customization = profile.customization;
  const navigation = links.filter((link) => link.kind === "nav" && link.url);
  const socials = links.filter((link) => link.kind === "social" && link.url);

  return (
    <div className="site-frame" data-accent={customization.accentColor}>
      <a className="skip-link" href="#main">
        跳到正文
      </a>
      <header className="site-header">
        <Brand
          displayName={profile.displayName}
          mark={customization.brandMark}
          subtitle={customization.brandSubtitle}
        />
        <nav className="site-nav" aria-label="主要导航">
          {navigation.map((item) => (
            <NavLink
              key={item.id}
              to={item.url}
              end={item.url === "/"}
              className={({ isActive }) => (isActive ? "is-active" : undefined)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="header-tools">
          <SearchPalette />
        </div>
      </header>

      <main id="main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div>
          <span className="micro-label">SEE YOU AROUND / {new Date().getFullYear()}</span>
          <p>
            © {profile.displayName}{customization.footerText ? ` · ${customization.footerText}` : ""}
          </p>
        </div>
        {socials.length > 0 ? (
          <nav aria-label="社交链接" className="footer-links">
            {socials.map((link) => (
              <a key={link.id} href={link.url} rel="me noreferrer">
                {link.label} ↗
              </a>
            ))}
          </nav>
        ) : null}
      </footer>
    </div>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  let title = "纸张卡住了";
  let detail = "发生了一个没有被好好装进抽屉的错误。";
  let status = "ERR";

  if (isRouteErrorResponse(error)) {
    status = String(error.status);
    if (error.status === 404) {
      title = "这张纸不存在";
      detail = "可能被挪走了，也可能从一开始就只是幻觉。";
    } else {
      detail = typeof error.data === "string" ? error.data : detail;
    }
  } else if (import.meta.env.DEV && error instanceof Error) {
    detail = error.message;
  }

  return (
    <div className="error-page">
      <span className="scrap-label">LOST PAPER / {status}</span>
      <h1>{title}</h1>
      <p>{detail}</p>
      <a className="button button--primary" href="/">
        回到桌面
      </a>
    </div>
  );
}
