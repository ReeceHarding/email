"use server"

import OpenAI from "openai"

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY in environment variables.")
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/**
 * Generates a list of Brave search queries covering multiple angles
 * for a given prompt (e.g. "dentists in Texas").
 */
export async function generateSearchQueriesAction(
  userPrompt: string
): Promise<string[]> {
  try {
    // Customize the system & user prompts to control how queries are generated.
    // In a real production scenario, you'd refine this prompt for better results.
    const systemPrompt = `
You are an expert search strategist. The user wants to find many websites for a certain lead generation scenario.
The user may say "I want to find 'dentists in Texas'" or a broader region or different niche. 
Your job: Break it down into very thorough Brave search queries, enumerating city-based or category-based queries as needed. 
Focus only on relevant queries for the user domain. 
Generate as many as possible (within reason) to thoroughly cover the entire region or domain specified.
Return them as an array of lines. 
`
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt.trim() },
        { role: "user", content: userPrompt.trim() }
      ],
      temperature: 0.7
    })

    const rawText = completion.choices[0]?.message?.content?.trim() || ""
    // We'll do a simple split by line for demonstration. 
    // The user prompt instructs ChatGPT to produce lines, which we parse.
    const lines = rawText
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
    
    // Return the lines as our search queries
    return lines
  } catch (error) {
    console.error("Error generating queries:", error)
    return []
  }
} 