import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

async function pushSchema() {
  try {
    console.log('Pushing schema to Supabase...');

    // Create Supabase client with service role key
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // First create the execute_sql function if it doesn't exist
    const createFunctionSql = `
      create or replace function execute_sql(query text)
      returns void
      language plpgsql
      security definer
      as $$
      begin
        execute query;
      end;
      $$;
    `;

    // Create the function
    const { error: functionError } = await supabase.rpc('execute_sql', {
      query: createFunctionSql
    });

    if (functionError) {
      // Function doesn't exist yet, create it using direct SQL
      const { error } = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          query: createFunctionSql
        })
      }).then(res => res.json());

      if (error) {
        console.error('Error creating function:', error);
        throw error;
      }
    }

    // Read the SQL file
    const sqlPath = path.join(process.cwd(), 'db', 'migrations', 'supabase.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // Execute each statement
    for (const statement of statements) {
      const { error } = await supabase.rpc('execute_sql', {
        query: statement
      });

      if (error) {
        console.error('Error executing statement:', error);
        throw error;
      }
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
    console.log('\nSchema push completed successfully!');

    process.exit(0);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error pushing schema:', errorMessage);
    process.exit(1);
  }
}

pushSchema().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  console.error('Unhandled error:', errorMessage);
  process.exit(1);
}); 