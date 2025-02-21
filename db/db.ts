import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { businessProfilesTable } from './schema/business-profiles-schema';
import { processedUrlsTable } from './schema/processed-urls-schema';
import { leads } from './schema';

// Use local database for development/testing
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gmail',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test the connection
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

pool.on('connect', () => {
  console.log('Connected to database');
});

export const db = drizzle(pool, {
  schema: {
    businessProfiles: businessProfilesTable,
    processedUrls: processedUrlsTable,
    leads: leads
  }
}); 