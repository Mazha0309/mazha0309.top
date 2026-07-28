import { useState } from "react";
import { redirect, useSearchParams } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { authClient } from "../lib/auth-client";
import { getAdminSession } from "../lib/auth.server";
import { isSafeInternalPath } from "../lib/content-utils";

export const meta: MetaFunction = () => [
  { title: "控制台身份核验 — Mazha0309" },
  { name: "robots", content: "noindex, nofollow" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAdminSession(request);
  if (session) throw redirect("/admin");
  return {
    githubConfigured: Boolean(
      process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
    ),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
  };
}

export default function AdminLogin({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nextValue = params.get("next") ?? "/admin";
  const callbackURL = isSafeInternalPath(nextValue) ? nextValue : "/admin";
  const ready = loaderData.githubConfigured && loaderData.databaseConfigured;

  return (
    <div className="admin-login content-width">
      <span className="security-pill">OWNER CHECK / PRIVATE DRAWER</span>
      <div className="admin-login__card">
        <span className="tape tape--top" aria-hidden="true" />
        <p className="micro-label">GITHUB ID REQUIRED / 99137842</p>
        <h1>先证明你是这张桌子的主人</h1>
        <p>
          这里只有一个座位。GitHub 会负责核验，邮箱和密码都不在这里保存。
        </p>
        <button
          className="button button--primary"
          type="button"
          disabled={!ready || busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            const result = await authClient.signIn.social({
              provider: "github",
              callbackURL,
            });
            if (result?.error) {
              setError(result.error.message ?? "GitHub 身份核验失败。");
              setBusy(false);
            }
          }}
        >
          {busy ? "正在连接 GitHub…" : "使用 GitHub 进入控制台 ↗"}
        </button>
        {!ready ? (
          <p className="form-message form-message--warning">
            当前环境还没配置数据库或 GitHub OAuth；请先填写 `.env`。
          </p>
        ) : null}
        {error ? <p className="form-message form-message--error">{error}</p> : null}
        <small>非指定 GitHub 数字 ID 即使完成 OAuth，也无法进入后台。</small>
      </div>
    </div>
  );
}
