import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

async function setupSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase credentials');
  }

  console.log('Setting up Supabase...');
  
  // Create Supabase client with service role key
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  try {
    console.log('\nCreating business_profiles table...');

    // Read the SQL file
    const sqlPath = path.join(process.cwd(), 'db', 'migrations', 'supabase.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the SQL using the SQL editor endpoint
    const { data, error } = await fetch(`${process.env.SUPABASE_URL}/rest/v1/pg/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        query: sql
      })
    }).then(res => res.json());

    if (error) {
      console.error('Error executing SQL:', error);
      throw error;
    }

    console.log('✓ Schema pushed successfully');

    // Test the table
    console.log('\nTesting table access...');
    const { data: countData, error: countError } = await supabase
      .from('business_profiles')
      .select('*')
      .limit(1);

    if (countError) {
      console.error('Error testing table:', countError);
      throw countError;
    }

    console.log('✓ Table is accessible');
    console.log('\nSupabase setup completed successfully!');

  } catch (error: any) {
    console.error('\nSetup failed:', error?.message || error);
    process.exit(1);
  }
}

setupSupabase().catch(error => {
  console.error('\nUnhandled error:', error);
  process.exit(1);
}); 