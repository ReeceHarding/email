import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

async function testConnections() {
  console.log('Testing local database connection...\n');
  
  // Test local database connection
  console.log('Test: Local database connection');
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    const res = await pool.query('SELECT * FROM users LIMIT 1');
    console.log('✓ Local database connection works:', res.rows[0]);
    await pool.end();
  } catch (error: any) {
    console.error('✗ Local database connection failed:', error?.message || error);
  }
}

testConnections().catch(console.error); 