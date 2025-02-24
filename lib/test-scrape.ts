import { config } from "dotenv";
import { scrapeWebsite } from "./firecrawl";
import { db } from "../db/db";
import { leadsTable } from "../db/schema";

// Load environment variables from .env file
config();

const TEST_USER_ID = "test_user_123";

async function testScrape() {
  console.log("[TestScrape] Starting scrape test for Buckner Family Dental...");
  
  try {
    const result = await scrapeWebsite("https://bucknerfamilydental.com/");
    
    console.log("\n=== Scrape Results ===\n");
    
    // Log success/failure
    console.log("Success:", result.success);
    if (result.error) {
      console.log("Error:", result.error);
      return;
    }
    
    // Store in database
    if (result.businessData) {
      const [lead] = await db.insert(leadsTable)
        .values({
          userId: TEST_USER_ID,
          websiteUrl: "https://bucknerfamilydental.com/",
          companyName: result.businessData.businessName,
          description: result.businessData.description,
          contactEmail: result.businessData.contactEmail,
          phoneNumber: result.businessData.phoneNumber,
          address: result.businessData.address,
          teamMembers: result.businessData.teamMembers,
          status: "scraped",
          rawScrapedData: result.businessData,
          lastScrapedAt: new Date(),
          allPageTexts: { "https://bucknerfamilydental.com/": result.extractedText }
        })
        .returning();
      
      console.log("\nStored in database with ID:", lead.id);
      
      // Log business data
      console.log("\nBusiness Name:", result.businessData.businessName);
      console.log("Contact Email:", result.businessData.contactEmail);
      console.log("Phone Number:", result.businessData.phoneNumber);
      
      // Log team members
      if (result.businessData.teamMembers && result.businessData.teamMembers.length > 0) {
        console.log("\nTeam Members Found:", result.businessData.teamMembers.length);
        console.log(JSON.stringify(result.businessData.teamMembers, null, 2));
      } else {
        console.log("\nNo team members found");
      }
    }
    
    // Log a sample of extracted text
    if (result.extractedText) {
      console.log("\nSample of Extracted Text (first 500 chars):");
      console.log(result.extractedText.substring(0, 500) + "...");
    }
    
  } catch (error) {
    console.error("[TestScrape] Error during test:", error);
  }
}

if (require.main === module) {
  testScrape().catch(console.error);
}

export { testScrape }; 