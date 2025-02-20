import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";
dotenv.config();

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// Parse the connection string
const url = new URL(DATABASE_URL);
const [username, password] = (url.username && url.password) 
  ? [url.username, url.password] 
  : ["postgres", "postgres"];

export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    host: url.hostname,
    port: parseInt(url.port || "5432"),
    user: username,
    password: password,
    database: url.pathname.slice(1),
    ssl: {
      rejectUnauthorized: false
    }
  }
} satisfies Config; 