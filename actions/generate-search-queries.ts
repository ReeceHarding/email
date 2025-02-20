"use server"

import OpenAI from "openai"
import { experimental_useOptimistic } from 'react'

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY in environment variables.")
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export interface QueryGenerationResult {
  queries: string[];
  progress: {
    type: 'start' | 'thinking' | 'complete' | 'error';
    message: string;
    data?: any;
  }[];
}

/**
 * Generates a list of Brave search queries covering multiple angles
 * for a given prompt (e.g. "dentists in Texas").
 */
export async function generateSearchQueriesAction(
  userPrompt: string
): Promise<QueryGenerationResult> {
  const progress: QueryGenerationResult['progress'] = [];
  
  try {
    // Add start progress
    progress.push({
      type: 'start',
      message: 'Starting query generation...',
      data: { prompt: userPrompt }
    });

    // Add thinking progress
    progress.push({
      type: 'thinking',
      message: 'Generating targeted search queries...'
    });

    // Customize the system & user prompts to control how queries are generated.
    const systemPrompt = `
You are an expert search strategist. The user wants to find many websites for a certain lead generation scenario.
The user may say "I want to find 'dentists in Texas'" or a broader region or different niche. 
Your job: Break it down into very thorough Brave search queries, enumerating city-based or category-based queries as needed. 
Focus only on relevant queries for the user domain. 
Generate EXACTLY 10 queries to thoroughly cover the entire region or domain specified.
Return them as an array of lines.
`
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt.trim() },
        { role: "user", content: userPrompt.trim() }
      ],
      temperature: 0.7
    });

    const rawText = completion.choices[0]?.message?.content?.trim() || "";
    // We'll do a simple split by line for demonstration. 
    // The user prompt instructs ChatGPT to produce lines, which we parse.
    const lines = rawText
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .slice(0, 10); // Ensure we only take max 10 queries
    
    // Add completion progress
    progress.push({
      type: 'complete',
      message: 'Generated search queries successfully',
      data: { queries: lines }
    });

    // Return both the queries and progress
    return {
      queries: lines,
      progress
    };
  } catch (error) {
    console.error("Error generating queries:", error);
    progress.push({
      type: 'error',
      message: 'Failed to generate queries',
      data: { error }
    });
    return {
      queries: [],
      progress
    };
  }
}

// Export the types
export type { QueryGenerationResult } 