import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";
dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase credentials');
}

// Extract connection info from Supabase URL
const projectId = process.env.SUPABASE_URL?.split('.')[0].split('//')[1];

export default {
  schema: "./db/schema/*.ts",
  out: "./db/migrations",
  driver: "pg",
  dbCredentials: {
    connectionString: `postgresql://postgres:${encodeURIComponent(process.env.SUPABASE_SERVICE_ROLE_KEY)}@db.${projectId}.supabase.co:5432/postgres?sslmode=require`
  }
} satisfies Config; 