#!/usr/bin/env ts-node

/**
 * Gmail OAuth Integration Test Runner
 * 
 * This script runs tests for the Gmail OAuth integration.
 * It verifies all components of the Gmail integration are working correctly.
 * 
 * Run with:
 * npm run test:gmail
 */

import * as path from 'path';
import { runTests } from '../lib/gmail-tests';

console.log("Starting Gmail OAuth Integration Tests...");
console.log(`Current working directory: ${process.cwd()}`);
console.log(`Script path: ${path.resolve(__filename)}`);

// Run all tests
runTests()
  .then(() => {
    console.log("All tests completed!");
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error("Test runner failed:", error);
    process.exit(1);
  }); 