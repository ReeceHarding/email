#!/usr/bin/env node

/**
 * Gmail API Integration Test Runner
 * 
 * This script runs the Jest tests for the Gmail API integration.
 * It verifies all components of the Gmail integration are working correctly.
 * 
 * Usage:
 * npm run test:gmail-integration
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 Starting Gmail API Integration Tests...');
console.log('----------------------------------------');

try {
  // Run unit tests
  console.log('📋 Running unit tests for Gmail integration...');
  execSync('npx jest __tests__/unit/gmail-integration.test.ts --verbose', { stdio: 'inherit' });
  console.log('✅ Unit tests completed successfully!\n');

  // Run integration tests
  console.log('📋 Running integration tests for Gmail API endpoints...');
  execSync('npx jest __tests__/integration/gmail-integration.test.ts --verbose', { stdio: 'inherit' });
  console.log('✅ Integration tests completed successfully!\n');

  console.log('🎉 All Gmail API tests passed! The integration is functioning correctly.');
  console.log('\n📝 Manual Verification Steps:');
  console.log('1. Start the server with: npm run dev');
  console.log('2. Navigate to your dashboard');
  console.log('3. Click the "Connect Gmail" button to test the OAuth flow');
  console.log('4. After connecting, try sending a test email');
  console.log('5. Check the "Connection Status" endpoint to verify the connection');
  console.log('6. Test disconnecting Gmail to verify token removal');
} catch (error) {
  console.error('\n❌ Some tests failed. Please review the error messages above.');
  console.error('\n🔍 Troubleshooting tips:');
  console.error('- Check that environment variables are set correctly in .env.local');
  console.error('- Verify that the Gmail API is enabled in your Google Cloud Console');
  console.error('- Ensure OAuth 2.0 credentials are configured correctly');
  console.error('- Check that redirect URIs match between your code and Google Cloud Console');
  console.error('- Verify database connection is working properly');
  
  process.exit(1);
} 