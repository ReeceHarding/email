#!/bin/bash

# Script to run tests for the search and scrape system
# Shows detailed output and summarizes results

# Set colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting tests for Search and Scrape System${NC}"
echo -e "${BLUE}========================================${NC}"

# Function to run a specific test
run_test() {
  TEST_FILE=$1
  TEST_NAME=$2
  
  echo -e "\n${YELLOW}Testing $TEST_NAME...${NC}"
  
  # Run the test and capture exit code
  npx jest $TEST_FILE --verbose
  EXIT_CODE=$?
  
  if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ $TEST_NAME tests passed${NC}"
    return 0
  else
    echo -e "${RED}✗ $TEST_NAME tests failed${NC}"
    return 1
  fi
}

# Keep track of failures
FAILURES=0

# Run each test component
run_test "__tests__/search-service.test.ts" "Search Service" || ((FAILURES++))
run_test "__tests__/enhanced-scraper.test.ts" "Enhanced Scraper" || ((FAILURES++))
run_test "__tests__/contact-research.test.ts" "Contact Research" || ((FAILURES++))
run_test "__tests__/content-generation.test.ts" "Content Generation" || ((FAILURES++))
run_test "__tests__/email-service.test.ts" "Email Service" || ((FAILURES++))
run_test "__tests__/scrape-controller.test.ts" "Scrape Controller" || ((FAILURES++))
run_test "__tests__/search-scrape-actions.test.ts" "Server Actions" || ((FAILURES++))

# Print summary
echo -e "\n${BLUE}========================================${NC}"
if [ $FAILURES -eq 0 ]; then
  echo -e "${GREEN}All tests passed successfully!${NC}"
  exit 0
else
  echo -e "${RED}$FAILURES test suites failed${NC}"
  exit 1
fi 