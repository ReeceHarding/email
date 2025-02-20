import { Pool } from 'pg';

// Create a connection pool
const pool = new Pool({
  host: '/tmp',
  database: 'gmail',
  user: 'reeceharding',
  max: 1,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 10000,
});

// Log pool events
pool.on('connect', () => {
  console.log('Database connected successfully via Unix socket');
});

pool.on('error', (err) => {
  console.error('Database connection error:', err);
});

export { pool }; 