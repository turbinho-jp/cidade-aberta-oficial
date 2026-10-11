import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // `generate` e `check` não conectam ao banco; quem aplica é `scripts/migrate.mjs`.
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
