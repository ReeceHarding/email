import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function dropTable() {
  console.log('Dropping leads table...');
  
  try {
    await db.execute(sql`DROP TABLE IF EXISTS leads CASCADE`);
    console.log('✓ Leads table dropped successfully');
  } catch (error) {
    console.error('Error dropping table:', error);
  }
}

dropTable().catch(console.error); 