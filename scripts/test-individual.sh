#!/bin/bash

# Script to run tests for individual components
# Usage: ./test-individual.sh [component-name]
# Example: ./test-individual.sh search-service

# Set colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# List of available components
COMPONENTS=("search-service" "enhanced-scraper" "contact-research" "content-generation" "email-service" "scrape-controller" "search-scrape-actions")

# Function to show available components
show_components() {
  echo -e "${BLUE}Available components:${NC}"
  for comp in "${COMPONENTS[@]}"; do
    echo "  - $comp"
  done
}

# Check if component is provided
if [ -z "$1" ]; then
  echo -e "${RED}Error: No component specified${NC}"
  echo "Usage: ./test-individual.sh [component-name]"
  show_components
  exit 1
fi

# Check if component is valid
FOUND=0
for comp in "${COMPONENTS[@]}"; do
  if [ "$comp" == "$1" ]; then
    FOUND=1
    break
  fi
done

if [ $FOUND -eq 0 ]; then
  echo -e "${RED}Error: Invalid component '$1'${NC}"
  show_components
  exit 1
fi

COMPONENT=$1
TEST_FILE="__tests__/${COMPONENT}.test.ts"

# Make sure test file exists
if [ ! -f "$TEST_FILE" ]; then
  echo -e "${RED}Error: Test file not found: $TEST_FILE${NC}"
  exit 1
fi

echo -e "${BLUE}Running tests for $COMPONENT${NC}"
echo -e "${BLUE}========================================${NC}"

# Run the test with watch mode
npx jest $TEST_FILE --verbose --watch

# Exit with the same code as the test
exit $? 