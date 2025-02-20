import 'dotenv/config';
import { Pool } from 'pg';
import postgres from 'postgres';

async function testConnections() {
  console.log('Testing different connection methods...\n');
  
  // Extract connection info
  const projectId = process.env.SUPABASE_URL?.split('.')[0].split('//')[1];
  
  // Test 1: Basic pg Pool with direct host
  console.log('Test 1: Basic pg Pool with direct host');
  try {
    const pool1 = new Pool({
      host: `db.${projectId}.supabase.co`,
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: process.env.SUPABASE_SERVICE_ROLE_KEY,
      ssl: {
        rejectUnauthorized: false
      }
    });
    const res1 = await pool1.query('SELECT current_database()');
    console.log('✓ Pool with direct host works:', res1.rows[0]);
    await pool1.end();
  } catch (error: any) {
    console.error('✗ Pool with direct host failed:', error?.message || error);
  }

  // Test 2: pg Pool with connection string
  console.log('\nTest 2: pg Pool with connection string');
  try {
    const pool2 = new Pool({
      connectionString: `postgres://postgres:${encodeURIComponent(process.env.SUPABASE_SERVICE_ROLE_KEY!)}@db.${projectId}.supabase.co:5432/postgres`,
      ssl: {
        rejectUnauthorized: false
      }
    });
    const res2 = await pool2.query('SELECT current_database()');
    console.log('✓ Pool with connection string works:', res2.rows[0]);
    await pool2.end();
  } catch (error: any) {
    console.error('✗ Pool with connection string failed:', error?.message || error);
  }

  // Test 3: postgres.js with direct host
  console.log('\nTest 3: postgres.js with direct host');
  try {
    const sql = postgres({
      host: `db.${projectId}.supabase.co`,
      port: 5432,
      database: 'postgres',
      username: 'postgres',
      password: process.env.SUPABASE_SERVICE_ROLE_KEY,
      ssl: {
        rejectUnauthorized: false
      }
    });
    const res3 = await sql`SELECT current_database()`;
    console.log('✓ postgres.js works:', res3[0]);
    await sql.end();
  } catch (error: any) {
    console.error('✗ postgres.js failed:', error?.message || error);
  }

  // Test 4: pg Pool with pooler URL
  console.log('\nTest 4: pg Pool with pooler URL');
  try {
    const pool4 = new Pool({
      connectionString: `postgres://postgres.${projectId}:${encodeURIComponent(process.env.SUPABASE_SERVICE_ROLE_KEY!)}@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true`,
      ssl: {
        rejectUnauthorized: false
      }
    });
    const res4 = await pool4.query('SELECT current_database()');
    console.log('✓ Pool with pooler URL works:', res4.rows[0]);
    await pool4.end();
  } catch (error: any) {
    console.error('✗ Pool with pooler URL failed:', error?.message || error);
  }
}

testConnections().catch(console.error); 