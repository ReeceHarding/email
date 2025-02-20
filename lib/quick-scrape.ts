import 'dotenv/config';
import { scrapeWebsite } from './firecrawl';

async function quickScrape(url: string) {
  console.log(`\nScraping ${url} for contact information...`);
  console.log('='.repeat(50));

  try {
    // First scrape the main page
    const mainResult = await scrapeWebsite(url, { maxDepth: 1 });
    if (!mainResult.success) {
      throw new Error('Failed to scrape main page');
    }

    // Extract initial data
    const data = {
      businessName: mainResult.businessData?.businessName,
      description: mainResult.businessData?.description,
      emails: mainResult.businessData?.allEmails || [],
      team: [...(mainResult.businessData?.founders || []), ...(mainResult.businessData?.teamMembers || [])],
      socialMedia: mainResult.businessData?.socialMedia || {}
    };

    // Get base URL
    const baseUrl = new URL(url);
    
    // Define important pages to check
    const importantUrls = new Set([
      // Discovered pages
      ...(mainResult.businessData?.scrapedPages
        ?.filter(page => page.type === 'about' || page.type === 'team' || page.type === 'contact')
        .map(page => page.url) || []),
      // Common about page patterns  
      `${baseUrl.origin}/about`,
      `${baseUrl.origin}/about-us`,
      `${baseUrl.origin}/company`,
      `${baseUrl.origin}/our-story`,
      // Common contact page patterns
      `${baseUrl.origin}/contact`,
      `${baseUrl.origin}/contact-us`,
      `${baseUrl.origin}/connect`,
      // Common team page patterns
      `${baseUrl.origin}/team`,
      `${baseUrl.origin}/leadership`,
      `${baseUrl.origin}/management`,
      `${baseUrl.origin}/executives`
    ]);

    console.log('\nChecking pages:', Array.from(importantUrls));

    // Scrape each important page
    for (const pageUrl of importantUrls) {
      try {
        console.log(`\nScraping ${pageUrl}...`);
        const pageResult = await scrapeWebsite(pageUrl, { maxDepth: 1 });
        
        if (pageResult.success && pageResult.businessData) {
          // Merge emails
          if (pageResult.businessData.allEmails) {
            data.emails = [...new Set([...data.emails, ...pageResult.businessData.allEmails])];
          }
          
          // Merge team members
          if (pageResult.businessData.founders) {
            data.team = [...data.team, ...pageResult.businessData.founders];
          }
          if (pageResult.businessData.teamMembers) {
            data.team = [...data.team, ...pageResult.businessData.teamMembers];
          }
          
          // Remove duplicates from team by name
          data.team = Array.from(new Map(data.team.map(t => [t.name, t])).values());
        }
      } catch (error) {
        console.log(`Failed to scrape ${pageUrl}:`, error);
        // Continue with next URL
      }
    }

    // Print results
    console.log('\nResults:');
    console.log('-'.repeat(50));
    console.log('Business Name:', data.businessName);
    console.log('Description:', data.description);
    
    if (data.emails.length > 0) {
      console.log('\nEmails found:');
      data.emails.forEach(email => console.log(`- ${email}`));
    } else {
      console.log('\nNo emails found');
    }
    
    if (data.team.length > 0) {
      console.log('\nTeam Members:');
      data.team.forEach(member => {
        console.log(`- ${member.name}${member.title ? ` (${member.title})` : ''}`);
        if (member.email) console.log(`  Email: ${member.email}`);
        if (member.linkedin) console.log(`  LinkedIn: ${member.linkedin}`);
      });
    } else {
      console.log('\nNo team members found');
    }
    
    if (Object.keys(data.socialMedia).length > 0) {
      console.log('\nSocial Media:');
      Object.entries(data.socialMedia).forEach(([platform, url]) => {
        console.log(`- ${platform}: ${url}`);
      });
    }

    return data;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Get URL from command line argument
const url = process.argv[2];
if (!url) {
  console.error('Please provide a URL to scrape');
  process.exit(1);
}

// Run the scraper
quickScrape(url).catch(error => {
  console.error('Scraping failed:', error);
  process.exit(1);
}); 