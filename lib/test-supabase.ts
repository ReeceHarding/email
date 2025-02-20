import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { randomUUID } from 'crypto';

interface BusinessProfile {
  id?: string;
  business_name: string;
  website_url: string;
  owner_name?: string;
  owner_title?: string;
  owner_linkedin?: string;
  owner_email?: string;
  primary_email?: string;
  alternative_emails?: string[];
  phone_number?: string;
  address?: string;
  unique_selling_points?: string[];
  specialties?: string[];
  awards?: string[];
  year_established?: string;
  services?: string[];
  technologies?: string[];
  insurances_accepted?: string[];
  certifications?: string[];
  affiliations?: string[];
  testimonial_highlights?: string[];
  social_media_links?: Record<string, string>;
  outreach_status: 'pending' | 'contacted' | 'responded' | 'converted' | 'rejected';
  last_email_sent_at?: Date;
  email_history?: Array<{
    subject: string;
    content: string;
    sentAt: string;
  }>;
  source_url?: string;
  source_type?: string;
  notes?: string;
  created_at?: Date;
  updated_at?: Date;
}

async function testSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase credentials');
  }

  console.log('Supabase URL:', process.env.SUPABASE_URL);
  console.log('Using service role key:', process.env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 10) + '...');

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

  const testProfiles: BusinessProfile[] = [
    {
      business_name: 'Test Dental Practice',
      website_url: 'https://test-dental.com',
      outreach_status: 'pending',
      owner_name: 'Dr. Test Dentist',
      owner_title: 'Lead Dentist',
      owner_linkedin: 'https://linkedin.com/in/test-dentist',
      owner_email: 'dr.test@test-dental.com',
      primary_email: 'contact@test-dental.com',
      alternative_emails: ['info@test-dental.com', 'appointments@test-dental.com'],
      phone_number: '123-456-7890',
      address: '123 Test St, Test City, TS 12345',
      unique_selling_points: ['State-of-the-art facilities', '20+ years experience'],
      specialties: ['Cosmetic Dentistry', 'Pediatric Dentistry'],
      services: ['General Dentistry', 'Teeth Whitening', 'Dental Implants'],
      technologies: ['Digital X-rays', 'CEREC Same-day Crowns'],
      insurances_accepted: ['Delta Dental', 'Cigna', 'Aetna'],
      certifications: ['American Dental Association', 'State Board Certified'],
      affiliations: ['American Academy of Cosmetic Dentistry'],
      testimonial_highlights: ['Best dental experience ever!', 'Very professional staff'],
      social_media_links: {
        facebook: 'https://facebook.com/test-dental',
        twitter: 'https://twitter.com/test-dental'
      },
      source_url: 'https://search-results.com',
      source_type: 'search',
      notes: 'Test dental practice with comprehensive services'
    },
    {
      business_name: 'Another Test Practice',
      website_url: 'https://another-test.com',
      outreach_status: 'pending',
      primary_email: 'info@another-test.com',
      phone_number: '098-765-4321',
      services: ['Pediatric Dentistry', 'Orthodontics'],
      notes: 'Another test practice for batch operations'
    }
  ];

  try {
    console.log('\n1. Testing Database Connection...');
    const { data: versionData, error: versionError } = await supabase
      .from('business_profiles')
      .select('count');

    if (versionError) {
      throw new Error(`Connection test failed: ${versionError.message}`);
    }
    console.log('✓ Connection successful');

    console.log('\n2. Testing Single Insert...');
    const { data: insertData, error: insertError } = await supabase
      .from('business_profiles')
      .insert([testProfiles[0]])
      .select();

    if (insertError) {
      throw new Error(`Insert test failed: ${insertError.message}`);
    }
    console.log('✓ Single insert successful');
    const insertedId = insertData![0].id;

    console.log('\n3. Testing Duplicate Insert (should fail)...');
    const { error: dupError } = await supabase
      .from('business_profiles')
      .insert([testProfiles[0]]);

    if (dupError?.message.includes('duplicate')) {
      console.log('✓ Duplicate check working as expected');
    } else {
      throw new Error('Duplicate check failed - insert succeeded when it should have failed');
    }

    console.log('\n4. Testing Batch Insert...');
    const { data: batchData, error: batchError } = await supabase
      .from('business_profiles')
      .insert([{
        ...testProfiles[1],
        website_url: `https://another-test.com?${randomUUID()}`
      }])
      .select();

    if (batchError) {
      throw new Error(`Batch insert test failed: ${batchError.message}`);
    }
    console.log('✓ Batch insert successful');

    console.log('\n5. Testing Complex Query...');
    const { data: queryData, error: queryError } = await supabase
      .from('business_profiles')
      .select('*')
      .or(`website_url.eq.${testProfiles[0].website_url},website_url.like.${testProfiles[1].website_url}%`)
      .order('created_at', { ascending: false });

    if (queryError) {
      throw new Error(`Complex query test failed: ${queryError.message}`);
    }
    console.log('✓ Complex query successful');
    console.log(`Found ${queryData?.length} profiles`);

    console.log('\n6. Testing Update...');
    const { data: updateData, error: updateError } = await supabase
      .from('business_profiles')
      .update({ outreach_status: 'contacted' })
      .eq('id', insertedId)
      .select();

    if (updateError) {
      throw new Error(`Update test failed: ${updateError.message}`);
    }
    console.log('✓ Update successful');

    console.log('\n7. Testing Invalid Data (should fail)...');
    const { error: invalidError } = await supabase
      .from('business_profiles')
      .insert([{
        business_name: 'Invalid Test',
        website_url: 'not-a-url',
        outreach_status: 'invalid-status' as any
      }]);

    if (invalidError) {
      console.log('✓ Invalid data rejected as expected');
    } else {
      throw new Error('Invalid data check failed - insert succeeded when it should have failed');
    }

    console.log('\n8. Testing Cleanup...');
    // Clean up test data
    const { error: deleteError } = await supabase
      .from('business_profiles')
      .delete()
      .or(`website_url.eq.${testProfiles[0].website_url},website_url.like.${testProfiles[1].website_url}%`);

    if (deleteError) {
      throw new Error(`Cleanup failed: ${deleteError.message}`);
    }
    console.log('✓ Cleanup successful');

    console.log('\n✅ All Supabase tests passed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  }
}

// Run the tests
testSupabase().catch(error => {
  console.error('\nUnhandled error:', error);
  process.exit(1);
}); 