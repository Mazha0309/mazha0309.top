import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./app/lib/schema.server.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://mazha:mazha@localhost:5432/mazha_home",
  },
  strict: true,
  verbose: true,
});
