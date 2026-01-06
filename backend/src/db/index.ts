import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

const connectionString = Deno.env.get("DATABASE_URL") || "postgres://budget:budget_secret@localhost:5432/budget";

const client = postgres(connectionString);
export const db = drizzle(client, { schema });

export * from "./schema.ts";


