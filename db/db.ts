import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { businessProfilesTable } from './schema/business-profiles-schema';

// Use local database for development/testing
const isLocalDev = process.env.NODE_ENV === 'development';
const connectionString = isLocalDev 
  ? process.env.DATABASE_URL 
  : process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? `postgresql://postgres:${encodeURIComponent(process.env.SUPABASE_SERVICE_ROLE_KEY)}@db.${process.env.SUPABASE_URL?.split('.')[0].split('//')[1]}.supabase.co:5432/postgres?sslmode=require`
    : null;

if (!connectionString) {
  throw new Error('Missing database connection string');
}

// Create the client with appropriate credentials
const pool = new Pool({
  connectionString,
  max: 1,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 30000,
  application_name: 'drizzle-ipv4',
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  // Don't require SSL for local development
  ssl: !isLocalDev
});

// Create and export the database instance
export const db = drizzle(pool, { 
  schema: {
    ...schema,
    businessProfiles: businessProfilesTable
  }
});

// Test the connection
async function testConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('Connected to database successfully');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error connecting to database:', errorMessage);
    process.exit(1);
  }
}

// Initialize connection
testConnection().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  console.error('Error connecting to database:', errorMessage);
  process.exit(1);
}); 