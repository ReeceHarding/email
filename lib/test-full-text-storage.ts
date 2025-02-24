import { searchBusinessesWithBrave } from "./search-and-scrape";
import { scrapeWebsite } from "./firecrawl";
import { db } from "../db/db";
import { leadsTable } from "../db/schema";
import { eq } from "drizzle-orm";

interface StoredPageTexts {
  [url: string]: string;
}

async function testFullTextStorage() {
  try {
    console.log("Starting test scrape...");
    
    // Search for a business
    const results = await searchBusinessesWithBrave("austin chiropractic");
    console.log(`Found ${results.length} results`);
    
    if (results.length > 0) {
      const testUrl = results[0].url;
      console.log(`Testing with URL: ${testUrl}`);
      
      // Scrape the website
      const scrapeResult = await scrapeWebsite(testUrl);
      if (!scrapeResult?.extractedText) {
        throw new Error("Failed to extract text from website");
      }
      console.log(`Extracted text length: ${scrapeResult.extractedText.length}`);
      
      // Store in database
      const [lead] = await db.insert(leadsTable)
        .values({
          userId: "test_user",
          websiteUrl: testUrl,
          allPageTexts: { [testUrl]: scrapeResult.extractedText } as StoredPageTexts
        })
        .returning();
      
      console.log(`Stored lead with ID: ${lead.id}`);
      
      // Verify storage
      const stored = await db.query.leads.findFirst({
        where: eq(leadsTable.id, lead.id)
      });
      
      if (!stored?.allPageTexts) {
        throw new Error("Failed to retrieve stored text");
      }
      
      const pageTexts = stored.allPageTexts as StoredPageTexts;
      console.log(`Retrieved stored text length: ${pageTexts[testUrl].length}`);
      
      // Cleanup
      await db.delete(leadsTable)
        .where(eq(leadsTable.id, lead.id));
      
      console.log("Test completed successfully");
    }
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testFullTextStorage(); 