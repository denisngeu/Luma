import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./postgres/generated",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {url: process.env.DATABASE_URL || ""},
});
