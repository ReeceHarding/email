import pkg from 'pg';
const { Client } = pkg;
import 'dotenv/config';

async function testPg() {
  console.log('Testing native pg client...\n');
  
  const client = new Client({
    host: '/tmp',
    database: 'gmail',
    user: 'reeceharding'
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully');

    console.log('\nTesting query...');
    const result = await client.query('SELECT current_database()');
    console.log('Query result:', result.rows[0]);

    console.log('\nClosing connection...');
    await client.end();
    console.log('Connection closed');
  } catch (error: any) {
    console.error('Test failed:', error?.message || error);
  }
}

testPg().catch(console.error); 