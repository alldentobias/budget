import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  driver: "pg",
  dbCredentials: {
    connectionString: Deno.env.get("DATABASE_URL") ||
      "postgres://budget:budget_secret@localhost:5432/budget",
  },
} satisfies Config;


