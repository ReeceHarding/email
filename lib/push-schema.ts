import { createClient, SupabaseClient } from '@supabase/supabase-js';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

async function createExecuteSqlFunction(supabase: SupabaseClient) {
  console.log('Creating execute_sql function...');
  
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

  try {
    // Try to create the function using direct SQL
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
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
    });

    if (!response.ok) {
      const error = await response.json();
      if (error.code === 'PGRST202') {
        // Function doesn't exist yet, create it using direct SQL
        const createResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/sql`, {
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
        });

        if (!createResponse.ok) {
          const createError = await createResponse.json();
          console.error('Error creating function:', createError);
          throw createError;
        }
      } else {
        console.error('Error creating function:', error);
        throw error;
      }
    }

    console.log('✓ execute_sql function created successfully');
  } catch (error) {
    console.error('Failed to create execute_sql function:', error);
    throw error;
  }
}

async function pushSchema() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase credentials');
  }

  console.log('Initializing Supabase client...');
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
    // First create the execute_sql function
    await createExecuteSqlFunction(supabase);

    console.log('\nReading schema file...');
    const schemaPath = path.join(process.cwd(), 'db', 'migrations', 'supabase.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    // Split into individual statements
    const statements = schemaSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => s + ';');

    console.log(`Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (const statement of statements) {
      console.log('\nExecuting statement:', statement.slice(0, 50) + '...');
      
      // Try using the execute_sql function first
      const { error } = await supabase.rpc('execute_sql', {
        query: statement
      });

      if (error) {
        // If that fails, try direct SQL execution
        const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            query: statement
          })
        });

        if (!response.ok) {
          const sqlError = await response.json();
          console.error('Error executing statement:', sqlError);
          throw sqlError;
        }
      }
    }

    console.log('\n✓ Schema pushed successfully');

    // Test the table
    console.log('\nTesting table access...');
    const { data: countData, error: countError } = await supabase
      .from('business_profiles')
      .select('count');

    if (countError) {
      console.error('Error testing table:', countError);
      throw countError;
    }

    console.log('✓ Table is accessible');
    console.log('\nSchema push completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\nError pushing schema:', error);
    process.exit(1);
  }
}

async function generateSql() {
  try {
    console.log('Reading schema file...');
    const schemaPath = path.join(process.cwd(), 'db', 'migrations', 'supabase.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    console.log('\nPlease run the following SQL commands in the Supabase SQL editor:');
    console.log('\n=== BEGIN SQL COMMANDS ===\n');
    console.log(schemaSQL);
    console.log('\n-- Refresh schema cache');
    console.log('NOTIFY pgrst, \'reload schema\';');
    console.log('\n=== END SQL COMMANDS ===\n');
    console.log('After running these commands, run the Supabase tests to verify the setup.');
    process.exit(0);
  } catch (error) {
    console.error('\nError reading schema:', error);
    process.exit(1);
  }
}

// Run the script
generateSql().catch(error => {
  console.error('\nUnhandled error:', error);
  process.exit(1);
}); 