import 'dotenv/config';
import { Pool } from 'pg';
import postgres from 'postgres';

async function testConnections() {
  console.log('Testing different connection methods...\n');
  
  // Test 1: Basic pg Pool with connection string
  console.log('Test 1: Basic pg Pool with connection string');
  try {
    const pool1 = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    const res1 = await pool1.query('SELECT current_database()');
    console.log('✓ Pool with connection string works:', res1.rows[0]);
    await pool1.end();
  } catch (error: any) {
    console.error('✗ Pool with connection string failed:', error?.message || error);
  }

  // Test 2: pg Pool with explicit config
  console.log('\nTest 2: pg Pool with explicit config');
  try {
    const pool2 = new Pool({
      user: 'reeceharding',
      host: 'localhost',
      database: 'gmail',
      port: 5432
    });
    const res2 = await pool2.query('SELECT current_database()');
    console.log('✓ Pool with explicit config works:', res2.rows[0]);
    await pool2.end();
  } catch (error: any) {
    console.error('✗ Pool with explicit config failed:', error?.message || error);
  }

  // Test 3: postgres.js with connection string
  console.log('\nTest 3: postgres.js with connection string');
  try {
    const sql = postgres(process.env.DATABASE_URL!, {
      max: 1,
      ssl: false
    });
    const res3 = await sql`SELECT current_database()`;
    console.log('✓ postgres.js works:', res3[0]);
    await sql.end();
  } catch (error: any) {
    console.error('✗ postgres.js failed:', error?.message || error);
  }

  // Test 4: pg Pool with Unix socket
  console.log('\nTest 4: pg Pool with Unix socket');
  try {
    const pool4 = new Pool({
      host: '/tmp',
      database: 'gmail',
      user: 'reeceharding'
    });
    const res4 = await pool4.query('SELECT current_database()');
    console.log('✓ Pool with Unix socket works:', res4.rows[0]);
    await pool4.end();
  } catch (error: any) {
    console.error('✗ Pool with Unix socket failed:', error?.message || error);
  }
}

testConnections().catch(console.error); 