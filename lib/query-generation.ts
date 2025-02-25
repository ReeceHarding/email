import { OpenAIClient, createOpenAIClient } from "./ai/openai";
import "dotenv/config";

// Create OpenAI client
const openaiClient = createOpenAIClient();

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
  score?: number;
}

interface BusinessAnalysis {
  businessType: string;
  industry: string;
  targetAudience: string;
  location?: string;
  problemSolved?: string;
  keyFeatures?: string[];
  sellingPoints?: string[];
  competitors?: string[];
  idealCustomerProfile?: string;
}

// Query type enum for diversification
enum QueryType {
  LocationBased = 'location-based',
  RoleBased = 'role-based',
  FeatureBased = 'feature-based',
  TechnologyBased = 'technology-based',
  ProblemBased = 'problem-based',
  CompetitorBased = 'competitor-based'
}

/**
 * Analyze a business description to extract key information
 * This helps generate more precise search queries
 */
export async function analyzeBusinessDescription(
  description: string
): Promise<BusinessAnalysis> {
  console.log(`[QueryGeneration] Analyzing business description: "${description.substring(0, 50)}..."`);
  
  if (!description || description.trim().length === 0) {
    throw new Error("Business description cannot be empty");
  }

  const instructions = `
    Analyze the following business description and extract key information.
    Return a JSON object with the following fields:
    - businessType: The type of business or service offered
    - industry: The industry the business serves
    - targetAudience: The target audience/customers
    - location: Geographic location if mentioned
    - problemSolved: The problem the business solves
    - keyFeatures: Array of key features/capabilities
    - sellingPoints: Array of unique selling points
    - competitors: Array of potential competitors if mentioned
    - idealCustomerProfile: Description of the ideal customer

    Business description: "${description}"
  `;

  try {
    const response = await openaiClient.complete({
      messages: [
        {
          role: "system",
          content: "You are a business analyst who extracts structured information from business descriptions."
        },
        {
          role: "user",
          content: instructions
        }
      ],
      temperature: 0.3,
    });

    try {
      return JSON.parse(response.content);
    } catch (parseError) {
      console.error("[QueryGeneration] Failed to parse business analysis:", parseError);
      // Return a minimal analysis with default values
      return {
        businessType: description.substring(0, 50),
        industry: "unknown",
        targetAudience: "unknown"
      };
    }
  } catch (error) {
    console.error("[QueryGeneration] Error analyzing business description:", error);
    // Return a minimal analysis with default values
    return {
      businessType: description.substring(0, 50),
      industry: "unknown",
      targetAudience: "unknown"
    };
  }
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
  console.log(`[QueryGeneration] Generating queries for ${businessType} in ${location || 'any location'}`);
  
  // Validate input
  if (!businessType || businessType.trim().length === 0) {
    console.warn("[QueryGeneration] Business type is required");
    return [];
  }

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
    const response = await openaiClient.complete({
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
      temperature: 0.7,
    });

    // Parse the response
    const content = response.content;
    if (!content) {
      console.error("[QueryGeneration] Empty response from API");
      return [];
    }

    try {
      const parsedResponse = JSON.parse(content);
      const queries = parsedResponse.queries || [];
      
      // Score and prioritize the queries
      const scoredQueries = await scoreAndPrioritizeQueries(queries);
      
      console.log(`[QueryGeneration] Generated ${scoredQueries.length} queries`);
      return scoredQueries;
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
 * Generate diverse query types to capture different segments
 * and intents for better lead generation coverage
 */
export async function generateDiverseQueryTypes(
  businessType: string,
  location?: string
): Promise<GeneratedQuery[]> {
  console.log(`[QueryGeneration] Generating diverse query types for ${businessType}`);
  
  if (!businessType || businessType.trim().length === 0) {
    console.warn("[QueryGeneration] Business type is required for diverse queries");
    return [];
  }

  // Collect query types we want to generate
  const queryTypes = [
    { type: QueryType.LocationBased, description: "Queries based on location and business type" },
    { type: QueryType.RoleBased, description: "Queries targeting specific roles or decision makers" },
    { type: QueryType.FeatureBased, description: "Queries focused on specific features or capabilities" },
    { type: QueryType.TechnologyBased, description: "Queries targeting businesses using specific technologies" },
    { type: QueryType.ProblemBased, description: "Queries focused on problems your solution solves" },
    { type: QueryType.CompetitorBased, description: "Queries related to competitors' customers" }
  ];

  const instructions = `
    Generate search queries for a business offering "${businessType}"${location ? ` in ${location}` : ''}.
    
    Create one search query for each of these query types:
    ${queryTypes.map(qt => `- ${qt.type}: ${qt.description}`).join('\n')}
    
    Format the results as a JSON array with objects containing:
    1. "searchQuery" - The exact search query to use
    2. "targetType" - One of the query types listed above
    3. "explanation" - Brief explanation of why this query will find good leads
    
    Make each query specific and optimized for its type.
    Focus on high-value potential leads who would need ${businessType}.
  `;

  try {
    // Call OpenAI API to generate diverse queries
    const response = await openaiClient.complete({
      messages: [
        { 
          role: "system", 
          content: "You are a lead generation specialist who creates targeted search queries across different categories."
        },
        { 
          role: "user", 
          content: instructions 
        }
      ],
      temperature: 0.7,
    });

    try {
      const parsedResponse = JSON.parse(response.content);
      const queries = parsedResponse.queries || [];
      
      console.log(`[QueryGeneration] Generated ${queries.length} diverse query types`);
      return queries;
    } catch (parseError) {
      console.error("[QueryGeneration] Failed to parse diverse queries response:", parseError);
      return [];
    }
  } catch (error) {
    console.error("[QueryGeneration] Error generating diverse queries:", error);
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
    const response = await openaiClient.complete({
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
      temperature: 0.3,
    });

    const query = response.content?.trim();
    return query || `${businessType} in ${location}`;
  } catch (error) {
    console.error("[QueryGeneration] Error generating location query:", error);
    return `${businessType} in ${location}`;
  }
}

/**
 * Score and prioritize queries based on relevance and potential value
 * Returns queries sorted by score in descending order
 */
export async function scoreAndPrioritizeQueries(
  queries: GeneratedQuery[]
): Promise<GeneratedQuery[]> {
  console.log(`[QueryGeneration] Scoring and prioritizing ${queries.length} queries`);
  
  if (!queries || queries.length === 0) {
    return [];
  }

  // Apply simple scoring logic directly based on query characteristics
  const scoredQueries = queries.map(query => {
    // Base score
    let score = 5;
    
    // Penalize very short or very long queries
    const wordCount = query.searchQuery.split(/\s+/).length;
    if (wordCount < 3) score -= 1;
    if (wordCount > 8) score -= 1;
    
    // Bonus for queries with specific indicators of value
    const lowerQuery = query.searchQuery.toLowerCase();
    if (lowerQuery.includes("manager") || lowerQuery.includes("director") || lowerQuery.includes("chief")) score += 2; // Decision makers
    if (lowerQuery.includes("software") || lowerQuery.includes("technology") || lowerQuery.includes("digital")) score += 1; // Tech-focused
    if (lowerQuery.includes("best") || lowerQuery.includes("top") || lowerQuery.includes("leading")) score += 1; // Quality indicators
    
    // Prioritize location-based queries if they're more specific
    if (query.targetType === QueryType.LocationBased && lowerQuery.includes("in ")) score += 1;
    
    // Return the original query with a score
    return {
      ...query,
      score
    };
  });
  
  // Sort by score (highest first)
  return scoredQueries.sort((a, b) => (b.score || 0) - (a.score || 0));
} 