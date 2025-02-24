import { OpenAI } from "openai";
import "dotenv/config";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface QueryGenerationParams {
  businessType: string;
  location?: string;
  specificNiche?: string;
  companySize?: "small" | "medium" | "large";
  targetBudget?: "low" | "medium" | "high";
  maxResults?: number;
}

interface GeneratedQuery {
  searchQuery: string;
  targetType: string;
  explanation: string;
}

/**
 * Generate targeted search queries for finding potential leads
 * based on the business type and other parameters.
 */
export async function generateSearchQueries({
  businessType,
  location,
  specificNiche,
  companySize,
  targetBudget,
  maxResults = 5,
}: QueryGenerationParams): Promise<GeneratedQuery[]> {
  console.log(`[QueryGeneration] Generating queries for ${businessType} in ${location}`);
  
  // Prepare detailed instructions for GPT
  const instructions = `
    Generate ${maxResults} specific search queries to find potential leads for a business offering 
    "${businessType}"${location ? ` in ${location}` : ''}${specificNiche ? ` specializing in ${specificNiche}` : ''}.
    
    ${companySize ? `Target ${companySize}-sized businesses.` : ''}
    ${targetBudget ? `Target businesses with ${targetBudget} budget.` : ''}
    
    Format the results as JSON array with objects containing:
    1. "searchQuery" - The exact search query to use
    2. "targetType" - The type of businesses being targeted
    3. "explanation" - Brief explanation of why this query will find good leads
    
    Make queries specific and varied to capture different segments of the market.
    Focus on businesses that would need ${businessType} services.
    Include some queries targeting decision makers at these businesses.
    Include specific industries that would benefit from ${businessType}.
  `;

  try {
    // Call OpenAI API to generate queries
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: "You are a lead generation specialist who creates effective search queries to find promising business leads."
        },
        { 
          role: "user", 
          content: instructions 
        }
      ],
      response_format: { type: "json_object" },
    });

    // Parse the response
    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error("[QueryGeneration] Empty response from API");
      return [];
    }

    try {
      const parsedResponse = JSON.parse(content);
      const queries = parsedResponse.queries || [];
      
      console.log(`[QueryGeneration] Generated ${queries.length} queries`);
      return queries;
    } catch (parseError) {
      console.error("[QueryGeneration] Failed to parse API response:", parseError);
      return [];
    }
  } catch (error) {
    console.error("[QueryGeneration] Error calling OpenAI API:", error);
    return [];
  }
}

/**
 * Generate a location-specific search query
 */
export async function generateLocationQuery(
  businessType: string,
  location: string
): Promise<string> {
  // If either parameter is missing, return a simple formatted query
  if (!businessType || !location) {
    return businessType && location 
      ? `${businessType} in ${location}`
      : businessType || "";
  }

  try {
    // Call OpenAI API for more natural location-based query
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: "You are a search specialist who creates effective location-based search queries."
        },
        { 
          role: "user", 
          content: `Create a natural search query to find businesses offering "${businessType}" in the location "${location}". Return ONLY the query text with no explanation or additional formatting.` 
        }
      ],
      max_tokens: 50,
      temperature: 0.3,
    });

    const query = response.choices[0]?.message?.content?.trim();
    return query || `${businessType} in ${location}`;
  } catch (error) {
    console.error("[QueryGeneration] Error generating location query:", error);
    return `${businessType} in ${location}`;
  }
} 