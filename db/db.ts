import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import * as schema from './schema';

// Create the client
const client = new Client({
  host: '/tmp',
  database: 'gmail',
  user: 'reeceharding'
});

let db: ReturnType<typeof drizzle>;

// Connect and create db instance
client.connect()
  .then(() => {
    console.log('Database connected successfully via Unix socket');
    db = drizzle(client, { schema });
  })
  .catch(error => {
    console.error('Database connection error:', error);
    process.exit(1);
  });

// Export the database instance and schema
export { db, schema }; 