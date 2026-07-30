import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { hasDatabase } from "./db.server";

const allowedGitHubId = process.env.ALLOWED_GITHUB_ID ?? "99137842";
const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:5173";
const isDevelopmentBypass =
  process.env.NODE_ENV !== "production" &&
  process.env.DEV_ADMIN_BYPASS === "true";

export function isDevelopmentAuthBypass() {
  return isDevelopmentBypass;
}

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
  baseURL: appOrigin,
  trustedOrigins: [appOrigin],
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
  rateLimit: {
    customRules: {
      "/sign-in/social": {
        window: 10,
        max: 10,
      },
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for"],
      trustedProxies: ["127.0.0.1", "::1"],
    },
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
});

export async function getSession(request: Request) {
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
  return auth.api.getSession({ headers: request.headers });
}

export function isAdminSession(
  session: Awaited<ReturnType<typeof getSession>>,
) {
  if (!session) return false;
  const githubId = (session.user as typeof session.user & { githubId?: string })
    .githubId;
  return githubId === allowedGitHubId;
}

export async function getAdminSession(request: Request) {
  const session = await getSession(request);
  return isAdminSession(session) ? session : null;
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
