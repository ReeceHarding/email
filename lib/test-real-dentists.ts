import { searchAndScrape } from "./search-and-scrape";
import { clearProcessedUrls } from "./search-utils";
import { db } from "../db/db";
import { businessProfilesTable } from "../db/schema";

async function testRealDentistScraping() {
  console.log("Starting real dentist scraping test...");
  
  try {
    // Clear any previously processed URLs
    clearProcessedUrls();
    
    // Track progress
    const progressEvents: any[] = [];
    const errorEvents: any[] = [];
    
    // Run the search and scrape
    await searchAndScrape(
      "dentists in Austin Texas",
      (progress) => {
        progressEvents.push(progress);
        console.log("Progress:", progress);
      },
      (error) => {
        errorEvents.push(error);
        console.error("Error:", error);
      }
    );

    // Get all created profiles
    const profiles = await db.query.businessProfiles.findMany({
      where: (profiles, { eq }) => eq(profiles.sourceType, "search")
    });

    console.log("\nCreated Profiles:", profiles);
    console.log("\nTotal Profiles Created:", profiles.length);
    console.log("\nError Events:", errorEvents);
    
  } catch (error) {
    console.error("\nTest failed with error:", error);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testRealDentistScraping()
    .catch(console.error)
    .finally(() => process.exit());
} 