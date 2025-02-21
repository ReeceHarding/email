"use server"

import { generateSearchQueriesAction, setOpenAI } from "../actions/generate-search-queries"

// Mock OpenAI response
const mockQueries = [
  "dentists in Houston Texas",
  "dentists in Dallas Texas",
  "dentists in Austin Texas",
  "dentists in San Antonio Texas",
  "dentists in Fort Worth Texas",
  "dentists in El Paso Texas",
  "dentists in Arlington Texas",
  "dentists in Corpus Christi Texas",
  "dentists in Plano Texas",
  "dentists in Lubbock Texas"
]

// Mock OpenAI API
const mockOpenAI = {
  chat: {
    completions: {
      create: async () => ({
        choices: [
          {
            message: {
              content: mockQueries.join("\n")
            }
          }
        ]
      })
    }
  }
}

async function testLeadFinderQueryGeneration() {
  console.log("Starting test for lead finder query generation...")

  // Set up mock OpenAI
  setOpenAI(mockOpenAI)

  // Test case 1: Basic prompt
  const prompt = "dentists in Texas"
  console.log("\nTesting basic prompt:", prompt)

  const result = await generateSearchQueriesAction(prompt)

  // Verify the result structure
  if (!result.queries || !Array.isArray(result.queries)) {
    console.error("Test failed: queries should be an array")
    process.exit(1)
  }

  // Verify we got exactly 10 queries
  if (result.queries.length !== 10) {
    console.error(`Test failed: expected 10 queries, got ${result.queries.length}`)
    process.exit(1)
  }

  // Verify each query matches our mock data
  for (let i = 0; i < result.queries.length; i++) {
    if (result.queries[i] !== mockQueries[i]) {
      console.error(`Test failed: query at index ${i} does not match mock data`)
      console.error(`Expected: "${mockQueries[i]}"`)
      console.error(`Got: "${result.queries[i]}"`)
      process.exit(1)
    }
  }

  // Verify progress events
  if (!result.progress || !Array.isArray(result.progress)) {
    console.error("Test failed: progress should be an array")
    process.exit(1)
  }

  const expectedEventTypes = ["start", "thinking", "complete"]
  for (const type of expectedEventTypes) {
    if (!result.progress.some(p => p.type === type)) {
      console.error(`Test failed: missing "${type}" event in progress`)
      process.exit(1)
    }
  }

  // Log success
  console.log("\nTest passed: Lead finder query generation works correctly")
  console.log("\nGenerated queries:", result.queries)
  console.log("\nProgress events:", result.progress)
}

// Run the test
if (require.main === module) {
  testLeadFinderQueryGeneration()
} 