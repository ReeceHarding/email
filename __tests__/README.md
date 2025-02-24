# Search and Scrape System Tests

This directory contains simple tests for each component of the search and scrape system.

## Test Structure

Each test file focuses on a single component and tests its basic functionality with minimal dependencies:

- `search-service.test.ts` - Tests the search service
- `enhanced-scraper.test.ts` - Tests the website scraper
- `contact-research.test.ts` - Tests the contact research module
- `content-generation.test.ts` - Tests the email content generation
- `email-service.test.ts` - Tests the email sending service
- `scrape-controller.test.ts` - Tests the orchestration controller
- `search-scrape-actions.test.ts` - Tests the server actions

## Running Tests

To run all tests:

```bash
npm test
```

To run a specific test:

```bash
npm test -- __tests__/search-service.test.ts
```

## Test Configuration

Tests are configured in `jest.config.js` to:

1. Use TypeScript for tests
2. Map the `@/` import alias to the project root
3. Run the setup file in `__tests__/jest-setup.ts` before tests

## Mocking

All tests use mocked dependencies to isolate the component being tested. For example:

- API calls are mocked using Jest's mock functions
- External services like the Brave API are mocked
- Database operations are mocked
- OpenAI API calls are mocked

This approach ensures that:

1. Tests run quickly
2. Tests don't depend on external services
3. Tests can be run in any environment
4. Failure in one component doesn't cascade to other tests

## Adding More Tests

When adding new tests:

1. Create a file named `__tests__/your-component.test.ts`
2. Import the component to test
3. Mock all dependencies
4. Write simple test cases that validate core functionality
5. Keep tests focused on a single responsibility 