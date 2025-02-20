import 'dotenv/config';
import { db } from '../db';
import { leads } from '../db/schema';
import { eq } from 'drizzle-orm';

const TEST_USER_ID = 'test-user-123';

async function cleanup() {
  console.log('Cleaning up test data...');
  
  try {
    // Delete all leads for test user
    await db.delete(leads).where(eq(leads.userId, TEST_USER_ID));
    console.log('✓ Test leads deleted successfully');
  } catch (error) {
    console.error('Error cleaning up test data:', error);
  }
}

cleanup().catch(console.error); 