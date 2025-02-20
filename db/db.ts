import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase credentials');
}

// Extract connection info from Supabase URL
const projectId = process.env.SUPABASE_URL?.split('.')[0].split('//')[1];

// Create the client with Supabase credentials
const pool = new Pool({
  connectionString: `postgresql://postgres:${encodeURIComponent(process.env.SUPABASE_SERVICE_ROLE_KEY)}@db.${projectId}.supabase.co:5432/postgres?sslmode=require`,
  max: 1,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 30000,
  // Force IPv4
  application_name: 'drizzle-ipv4',
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
});

// Create and export the database instance
export const db = drizzle(pool, { schema });

// Test the connection
async function testConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('Connected to Supabase database successfully');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error connecting to Supabase:', errorMessage);
    process.exit(1);
  }
}

// Initialize connection
testConnection().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  console.error('Error connecting to Supabase:', errorMessage);
  process.exit(1);
}); 