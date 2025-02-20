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
      socialMedia: mainResult.businessData?.socialMedia || {},
      usefulInfo: {
        yearFounded: mainResult.businessData?.yearFounded,
        industry: mainResult.businessData?.industry,
        companySize: mainResult.businessData?.companySize,
        hasContactForm: false,
        contactMethods: [] as string[],
        locations: [] as string[],
        awards: [] as string[],
        partnerships: [] as string[]
      }
    };

    // Get base URL
    const baseUrl = new URL(url);
    
    // Define important pages to check (both from discovered and known paths)
    const importantUrls = new Set([
      // Discovered pages
      ...(mainResult.businessData?.scrapedPages
        ?.filter(page => page.type === 'about' || page.type === 'team' || page.type === 'contact')
        .map(page => page.url) || []),
      // Common about page patterns
      `${baseUrl.origin}/about`,
      `${baseUrl.origin}/about-us`,
      `${baseUrl.origin}/about-culvers`,
      `${baseUrl.origin}/company`,
      `${baseUrl.origin}/our-story`,
      `${baseUrl.origin}/history`,
      // Common contact page patterns
      `${baseUrl.origin}/contact`,
      `${baseUrl.origin}/contact-us`,
      `${baseUrl.origin}/connect`,
      `${baseUrl.origin}/support`,
      `${baseUrl.origin}/help`,
      // Common team page patterns
      `${baseUrl.origin}/team`,
      `${baseUrl.origin}/leadership`,
      `${baseUrl.origin}/management`,
      `${baseUrl.origin}/executives`,
      // Common careers/jobs pages (often have team info)
      `${baseUrl.origin}/careers`,
      `${baseUrl.origin}/jobs`,
      // Common press/media pages (often have contact info)
      `${baseUrl.origin}/press`,
      `${baseUrl.origin}/media`,
      `${baseUrl.origin}/newsroom`,
      `${baseUrl.origin}/news`,
      // Common location pages
      `${baseUrl.origin}/locations`,
      `${baseUrl.origin}/find-us`,
      `${baseUrl.origin}/store-locator`,
      // Common award/recognition pages
      `${baseUrl.origin}/awards`,
      `${baseUrl.origin}/recognition`,
      `${baseUrl.origin}/achievements`,
      // Franchise and business pages (often have contact info)
      `${baseUrl.origin}/franchise`,
      `${baseUrl.origin}/franchising`,
      `${baseUrl.origin}/franchises`,
      `${baseUrl.origin}/own-a-franchise`,
      `${baseUrl.origin}/become-a-franchisee`,
      `${baseUrl.origin}/business`,
      `${baseUrl.origin}/business-development`,
      `${baseUrl.origin}/partnerships`,
      `${baseUrl.origin}/partner-with-us`,
      `${baseUrl.origin}/vendors`,
      `${baseUrl.origin}/suppliers`,
      `${baseUrl.origin}/supply-chain`,
      `${baseUrl.origin}/procurement`,
      `${baseUrl.origin}/investors`,
      `${baseUrl.origin}/investor-relations`
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

          // Update useful info if not already set
          if (!data.usefulInfo.yearFounded && pageResult.businessData.yearFounded) {
            data.usefulInfo.yearFounded = pageResult.businessData.yearFounded;
          }
          if (!data.usefulInfo.industry && pageResult.businessData.industry) {
            data.usefulInfo.industry = pageResult.businessData.industry;
          }
          if (!data.usefulInfo.companySize && pageResult.businessData.companySize) {
            data.usefulInfo.companySize = pageResult.businessData.companySize;
          }

          // Check for contact forms
          if (pageResult.html) {
            // Check for contact form indicators
            if (pageResult.html.match(/<form[^>]*>|contact-form|contact_form|wpcf7|formspree|hubspot-form/i)) {
              data.usefulInfo.hasContactForm = true;
              data.usefulInfo.contactMethods.push('Contact Form');
            }

            // Look for phone numbers
            const phoneMatches = pageResult.html.match(/(?:Phone|Tel|Call)(?:\s*(?:us|:))?\s*(?:at)?\s*[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4}/gi);
            if (phoneMatches) {
              data.usefulInfo.contactMethods.push(...phoneMatches.map(p => p.trim()));
            }

            // Look for locations
            const locationMatches = pageResult.html.match(/(?:Headquarters|Main Office|Corporate Office|Location)[^\n.]*?(?:,\s*[A-Z]{2}\s+\d{5}|[A-Z][a-z]+,\s*[A-Z]{2})/g);
            if (locationMatches) {
              data.usefulInfo.locations.push(...locationMatches.map(l => l.trim()));
            }

            // Look for awards and recognition
            const awardMatches = pageResult.html.match(/(?:award|recognition|achievement|honored|winner)[^\n.]*?\d{4}/gi);
            if (awardMatches) {
              data.usefulInfo.awards.push(...awardMatches.map(a => a.trim()));
            }

            // Look for partnerships
            const partnershipMatches = pageResult.html.match(/(?:partner|collaboration|alliance|teamed up)[^\n.]*?(?:with|alongside)[^\n.]*/gi);
            if (partnershipMatches) {
              data.usefulInfo.partnerships.push(...partnershipMatches.map(p => p.trim()));
            }
          }
        }
      } catch (error) {
        console.log(`Failed to scrape ${pageUrl}:`, error);
        // Continue with next URL
      }
    }

    // Remove duplicates from arrays
    data.usefulInfo.contactMethods = [...new Set(data.usefulInfo.contactMethods)];
    data.usefulInfo.locations = [...new Set(data.usefulInfo.locations)];
    data.usefulInfo.awards = [...new Set(data.usefulInfo.awards)];
    data.usefulInfo.partnerships = [...new Set(data.usefulInfo.partnerships)];

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
    
    console.log('\nUseful Information:');
    if (data.usefulInfo.yearFounded) console.log(`- Founded: ${data.usefulInfo.yearFounded}`);
    if (data.usefulInfo.industry) console.log(`- Industry: ${data.usefulInfo.industry}`);
    if (data.usefulInfo.companySize) console.log(`- Company Size: ${data.usefulInfo.companySize}`);
    
    if (data.usefulInfo.hasContactForm) {
      console.log('- Has contact form: Yes');
    }
    
    if (data.usefulInfo.contactMethods.length > 0) {
      console.log('\nContact Methods:');
      data.usefulInfo.contactMethods.forEach(method => console.log(`- ${method}`));
    }
    
    if (data.usefulInfo.locations.length > 0) {
      console.log('\nLocations:');
      data.usefulInfo.locations.forEach(location => console.log(`- ${location}`));
    }
    
    if (data.usefulInfo.awards.length > 0) {
      console.log('\nAwards & Recognition:');
      data.usefulInfo.awards.forEach(award => console.log(`- ${award}`));
    }
    
    if (data.usefulInfo.partnerships.length > 0) {
      console.log('\nPartnerships:');
      data.usefulInfo.partnerships.forEach(partnership => console.log(`- ${partnership}`));
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