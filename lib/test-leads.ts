import 'dotenv/config';
import { testLeadsTable } from '../actions/db/leads-actions';

async function testLeads() {
  console.log('Testing leads table operations...\n');
  const result = await testLeadsTable();
  console.log('\nTest result:', result);
}

testLeads().catch(console.error); 