import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const queryClient = postgres(process.env.DATABASE_URL!, {
  max: 1, // keep small for serverless
  ssl: "require"
});

export const db = drizzle(queryClient); 