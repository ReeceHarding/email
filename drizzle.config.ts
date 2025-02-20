import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";
dotenv.config();

const isLocalDev = process.env.NODE_ENV === 'development';
const connectionString = isLocalDev
  ? process.env.DATABASE_URL
  : process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? `postgresql://postgres:${encodeURIComponent(process.env.SUPABASE_SERVICE_ROLE_KEY)}@db.${process.env.SUPABASE_URL?.split('.')[0].split('//')[1]}.supabase.co:5432/postgres?sslmode=require`
    : null;

if (!connectionString) {
  throw new Error('Missing database connection string');
}

export default {
  schema: "./db/schema/*.ts",
  out: "./db/migrations",
  driver: "aws-data-api",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString
  }
} satisfies Config; 