import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase credentials in environment variables');
}

export const supabase = createClient<Database>(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
); 