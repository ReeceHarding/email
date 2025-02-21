"use server"

import OpenAI from "openai"

// Initialize OpenAI
let openai: OpenAI | null = null

export function initializeOpenAI(apiKey?: string) {
  if (!apiKey && !process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY in environment variables.")
  }
  openai = new OpenAI({
    apiKey: apiKey || process.env.OPENAI_API_KEY
  })
}

// For testing purposes
export function setOpenAI(mockOpenAI: any) {
  openai = mockOpenAI
}

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
    // Initialize OpenAI if not already initialized
    if (!openai) {
      initializeOpenAI()
    }

    // Ensure OpenAI is initialized
    if (!openai) {
      throw new Error("Failed to initialize OpenAI")
    }

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
Return them as an array of lines, one query per line, with no JSON formatting or quotes.
Example format:
dentists in Houston Texas
dentists in Dallas Texas
dentists in Austin Texas
`
    console.log('[QueryGen] System prompt:', systemPrompt);

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt.trim() },
        { role: "user", content: userPrompt.trim() }
      ],
      temperature: 0.7
    });

    const rawText = completion.choices[0]?.message?.content?.trim() || "";
    console.log('[QueryGen] Raw OpenAI response:', rawText);
    
    // First split by newlines
    const initialSplit = rawText.split('\n');
    console.log('[QueryGen] After newline split:', initialSplit);
    
    // Clean each line
    const cleanedLines = initialSplit
      .map((line: string) => line.trim())
      .map((line: string) => {
        // Remove JSON formatting characters
        const cleaned = line
          .replace(/^["'\[\],]+|["'\[\],]+$/g, '')
          .replace(/\\"/g, '"')
          .trim();
        console.log('[QueryGen] Cleaned line:', { original: line, cleaned });
        return cleaned;
      })
      .filter((line: string) => line.length > 0);
    
    console.log('[QueryGen] After cleaning:', cleanedLines);
    
    // If we got a single line with commas, split it
    const finalQueries = cleanedLines.length === 1 && cleanedLines[0].includes(',')
      ? cleanedLines[0]
          .split(',')
          .map(q => q.trim())
          .filter(q => q.length > 0)
      : cleanedLines;
    
    console.log('[QueryGen] Final queries:', finalQueries);
    
    // Ensure we only take max 10 queries
    const limitedQueries = finalQueries.slice(0, 10);
    
    // Add completion progress
    progress.push({
      type: 'complete',
      message: 'Generated search queries successfully',
      data: { queries: limitedQueries }
    });

    // Return both the queries and progress
    return {
      queries: limitedQueries,
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