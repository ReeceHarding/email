import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function testSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase credentials');
  }

  console.log('Supabase URL:', process.env.SUPABASE_URL);
  console.log('Using anon key:', process.env.SUPABASE_ANON_KEY.slice(0, 10) + '...');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  try {
    console.log('\nTesting Supabase connection...');

    // First test a simple query
    const { data, error } = await supabase
      .from('business_profiles')
      .select('count')
      .limit(1);

    if (error) {
      console.error('Query error:', error);
      throw error;
    }

    console.log('✓ Connection test successful');
    console.log('Current row count:', data);

    // Now test insert
    console.log('\nTesting insert...');
    const testProfile = {
      business_name: 'Test Business',
      website_url: 'https://test.com',
      outreach_status: 'pending'
    };

    const { data: insertData, error: insertError } = await supabase
      .from('business_profiles')
      .insert([testProfile])
      .select();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    console.log('✓ Test insert successful:', insertData);

    // Test select
    console.log('\nTesting select...');
    const { data: selectData, error: selectError } = await supabase
      .from('business_profiles')
      .select()
      .eq('website_url', 'https://test.com')
      .limit(1);

    if (selectError) {
      console.error('Select error:', selectError);
      throw selectError;
    }

    console.log('✓ Test select successful:', selectData);

    // Clean up test data
    console.log('\nCleaning up...');
    const { error: deleteError } = await supabase
      .from('business_profiles')
      .delete()
      .eq('website_url', 'https://test.com');

    if (deleteError) {
      console.error('Delete error:', deleteError);
      throw deleteError;
    }

    console.log('✓ Test cleanup successful');
    console.log('\nAll tests passed! Supabase is ready to use.');

  } catch (error) {
    console.error('\nError details:', error);
    process.exit(1);
  }
}

testSupabase().catch(error => {
  console.error('\nUnhandled error:', error);
  process.exit(1);
}); 