import { Pool } from 'pg';

// Create a connection pool
const pool = new Pool({
  host: '/tmp',
  database: 'gmail',
  user: 'reeceharding',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  allowExitOnIdle: true
});

// Log pool events
pool.on('connect', () => {
  console.log('Database connected successfully via Unix socket');
});

pool.on('error', (err) => {
  console.error('Database connection error:', err);
});

export { pool }; 