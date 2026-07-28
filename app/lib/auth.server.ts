import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { Pool } from "pg";
import { hasDatabase } from "./db.server";

const allowedGitHubId = process.env.ALLOWED_GITHUB_ID ?? "99137842";
const isDevelopmentBypass =
  process.env.NODE_ENV !== "production" &&
  process.env.DEV_ADMIN_BYPASS === "true";

function authConnectionString() {
  const source =
    process.env.DATABASE_URL ??
    "postgresql://mazha:mazha@127.0.0.1:5432/mazha_home";
  const url = new URL(source);
  const existingOptions = url.searchParams.get("options");
  const searchPath = "-c search_path=auth";
  url.searchParams.set(
    "options",
    existingOptions ? `${existingOptions} ${searchPath}` : searchPath,
  );
  return url.toString();
}

let authPool: Pool | undefined;

function getAuthPool() {
  const connectionString = authConnectionString();
  authPool ??= new Pool({ connectionString, max: 5 });
  return authPool;
}

const github =
  process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
          scope: ["read:user", "user:email"],
          overrideUserInfoOnSignIn: true,
          mapProfileToUser: (profile: { id: string }) => ({
            githubId: String(profile.id),
          }),
        },
      }
    : {};

export const auth = betterAuth({
  appName: "Mazha0309 Home Console",
  baseURL: process.env.APP_ORIGIN ?? "http://localhost:5173",
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "development-only-secret-change-before-production",
  database: getAuthPool(),
  socialProviders: github,
  account: {
    encryptOAuthTokens: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  user: {
    additionalFields: {
      githubId: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const githubId = (user as typeof user & { githubId?: string }).githubId;
          if (githubId !== allowedGitHubId) {
            throw new APIError("FORBIDDEN", {
              message: "这个控制台只认一只指定的 GitHub 账号。",
            });
          }
          return { data: user };
        },
      },
      update: {
        before: async (user) => {
          const githubId = (user as typeof user & { githubId?: string }).githubId;
          if (githubId && githubId !== allowedGitHubId) {
            throw new APIError("FORBIDDEN", {
              message: "GitHub 身份与站点管理员不匹配。",
            });
          }
          return { data: user };
        },
      },
    },
  },
});

export async function getAdminSession(request: Request) {
  if (isDevelopmentBypass) {
    return {
      session: {
        id: "development-session",
        userId: "development-admin",
        expiresAt: new Date(Date.now() + 3_600_000),
      },
      user: {
        id: "development-admin",
        name: "Mazha0309 (DEV)",
        email: "dev@localhost",
        image: null,
        githubId: allowedGitHubId,
      },
    };
  }

  if (!hasDatabase()) return null;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;
  const githubId = (session.user as typeof session.user & { githubId?: string })
    .githubId;
  return githubId === allowedGitHubId ? session : null;
}

export async function requireAdmin(request: Request) {
  const session = await getAdminSession(request);
  if (session) return session;

  const url = new URL(request.url);
  const destination = encodeURIComponent(url.pathname + url.search);
  throw new Response(null, {
    status: 302,
    headers: { Location: `/admin/login?next=${destination}` },
  });
}

export async function closeAuthPool() {
  if (authPool) {
    await authPool.end();
    authPool = undefined;
  }
}
