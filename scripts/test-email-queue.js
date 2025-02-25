#!/usr/bin/env node

/**
 * Email Queue Test Script
 * 
 * This script runs tests for the email queue implementation.
 * It verifies the core functionality of:
 * - Email queue database schema
 * - Email queue service
 * - Email queue API endpoints
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Test files to run
const tests = [
  // Unit tests
  { 
    type: 'unit', 
    name: 'Email Queue Service',
    file: '__tests__/unit/email-queue-service.test.ts',
    description: 'Tests the email queue service functionality'
  },
  
  // Integration tests
  { 
    type: 'integration', 
    name: 'Email Queue API',
    file: '__tests__/integration/email-queue.test.ts',
    description: 'Tests the email queue API endpoints'
  }
];

console.log(`${colors.cyan}╔════════════════════════════════════════════╗${colors.reset}`);
console.log(`${colors.cyan}║         EMAIL QUEUE TEST SCRIPT            ║${colors.reset}`);
console.log(`${colors.cyan}╚════════════════════════════════════════════╝${colors.reset}`);
console.log('\nRunning tests for email queue implementation...\n');

let passedTests = 0;
let failedTests = 0;

// Run each test
tests.forEach((test, index) => {
  console.log(`${colors.magenta}[${index + 1}/${tests.length}] ${test.type.toUpperCase()}: ${test.name}${colors.reset}`);
  console.log(`${colors.blue}Description: ${test.description}${colors.reset}`);
  
  try {
    // Check if file exists
    const testPath = path.resolve(process.cwd(), test.file);
    if (!fs.existsSync(testPath)) {
      console.log(`${colors.red}❌ Test file not found: ${test.file}${colors.reset}`);
      failedTests++;
      return;
    }
    
    // Run the test
    console.log(`${colors.yellow}Running: ${test.file}${colors.reset}`);
    execSync(`npx jest ${test.file} --colors`, { stdio: 'inherit' });
    
    console.log(`${colors.green}✅ Passed: ${test.name}${colors.reset}\n`);
    passedTests++;
  } catch (error) {
    console.error(`${colors.red}❌ Failed: ${test.name}${colors.reset}`);
    console.error(`${colors.red}Error: ${error.message}${colors.reset}\n`);
    failedTests++;
  }
});

// Summary
console.log(`${colors.cyan}╔════════════════════════════════════════════╗${colors.reset}`);
console.log(`${colors.cyan}║               TEST SUMMARY                 ║${colors.reset}`);
console.log(`${colors.cyan}╚════════════════════════════════════════════╝${colors.reset}`);
console.log(`${colors.white}Total tests: ${tests.length}${colors.reset}`);
console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);

if (failedTests > 0) {
  console.log(`\n${colors.yellow}Troubleshooting tips:${colors.reset}`);
  console.log(`${colors.yellow}1. Check the specific test error messages above${colors.reset}`);
  console.log(`${colors.yellow}2. Verify that the database schema is correctly implemented${colors.reset}`);
  console.log(`${colors.yellow}3. Ensure the email queue service has all required functions${colors.reset}`);
  console.log(`${colors.yellow}4. Check API endpoint implementations${colors.reset}`);
  console.log(`${colors.yellow}5. Run individual tests using: npx jest <test-file> --watch${colors.reset}`);
  
  process.exit(1);
} else {
  console.log(`\n${colors.green}All email queue tests passed successfully!${colors.reset}`);
  process.exit(0);
} 