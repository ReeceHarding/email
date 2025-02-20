import 'dotenv/config';
import axios from 'axios';
import { BusinessInfo, extractBusinessInfo, scrapeUrl } from './test-scrape-system';

const BRAVE_API_KEY = 'BSA8vl0lEsMqmGAU-p9rLb4y_Cnb2LI';
const SCRAPING_BEE_API_KEY = process.env.SCRAPING_BEE_API_KEY!;

interface BraveSearchResult {
  url: string;
  title: string;
  description: string;
}

async function searchBusinesses(query: string): Promise<BraveSearchResult[]> {
  try {
    console.log('Searching Brave for:', query);
    const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
      params: {
        q: query,
        result_filter: 'web'
      },
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_API_KEY
      }
    });

    if (response.data && response.data.web && response.data.web.results) {
      return response.data.web.results.map((result: any) => ({
        url: result.url,
        title: result.title,
        description: result.description
      }));
    }

    return [];
  } catch (error: any) {
    console.error('Error searching with Brave:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return [];
  }
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function displayBusinessInfo(businessInfo: BusinessInfo) {
  console.log('\nExtracted Business Information:');
  console.log('=============================');
  
  if (businessInfo.name) console.log('Practice Name:', businessInfo.name);
  if (businessInfo.title) console.log('Page Title:', businessInfo.title);
  if (businessInfo.description) console.log('Description:', businessInfo.description);
  
  console.log('\nContact Information:');
  console.log('-------------------');
  if (businessInfo.address) console.log('Full Address:', businessInfo.address);
  if (businessInfo.city) console.log('City:', businessInfo.city);
  if (businessInfo.state) console.log('State:', businessInfo.state);
  if (businessInfo.zip) console.log('ZIP:', businessInfo.zip);
  if (businessInfo.phone) console.log('Phone:', businessInfo.phone);
  if (businessInfo.email) console.log('Email:', businessInfo.email);
  
  if (businessInfo.hours && businessInfo.hours.length > 0) {
    console.log('\nBusiness Hours:');
    console.log('---------------');
    businessInfo.hours.forEach(hour => console.log(`- ${hour}`));
  }
  
  if (businessInfo.services && businessInfo.services.length > 0) {
    console.log('\nServices:');
    console.log('---------');
    businessInfo.services.forEach(service => console.log(`- ${service}`));
  }

  if (businessInfo.procedures && businessInfo.procedures.length > 0) {
    console.log('\nProcedures:');
    console.log('-----------');
    businessInfo.procedures.forEach(proc => console.log(`- ${proc}`));
  }

  if (businessInfo.specialties && businessInfo.specialties.length > 0) {
    console.log('\nSpecialties:');
    console.log('------------');
    businessInfo.specialties.forEach(specialty => console.log(`- ${specialty}`));
  }

  if (businessInfo.education && businessInfo.education.length > 0) {
    console.log('\nEducation:');
    console.log('----------');
    businessInfo.education.forEach(edu => console.log(`- ${edu}`));
  }

  if (businessInfo.affiliations && businessInfo.affiliations.length > 0) {
    console.log('\nProfessional Affiliations:');
    console.log('------------------------');
    businessInfo.affiliations.forEach(aff => console.log(`- ${aff}`));
  }

  if (businessInfo.insurances && businessInfo.insurances.length > 0) {
    console.log('\nInsurance Information:');
    console.log('---------------------');
    businessInfo.insurances.forEach(insurance => console.log(`- ${insurance}`));
  }

  if (businessInfo.emergencyInfo) {
    console.log('\nEmergency Information:');
    console.log('---------------------');
    console.log(businessInfo.emergencyInfo);
  }
  
  if (businessInfo.socialLinks && Object.keys(businessInfo.socialLinks).length > 0) {
    console.log('\nSocial Media & Reviews:');
    console.log('----------------------');
    Object.entries(businessInfo.socialLinks).forEach(([platform, url]) => {
      console.log(`- ${platform}: ${url}`);
    });
  }
}

async function searchAndScrape(query: string) {
  console.log(`\nSearching for: ${query}`);
  console.log('='.repeat(50));

  // Search for businesses
  const searchResults = await searchBusinesses(query);
  console.log(`\nFound ${searchResults.length} results`);

  // Process only first 2 results as requested
  const resultsToProcess = searchResults.slice(0, 2);

  // Process each result
  for (let i = 0; i < resultsToProcess.length; i++) {
    const result = resultsToProcess[i];
    console.log(`\nProcessing result ${i + 1} of ${resultsToProcess.length}`);
    console.log('URL:', result.url);
    console.log('Title:', result.title);
    console.log('-'.repeat(50));

    try {
      // Skip non-website results or obvious non-dental sites
      if (result.url.includes('facebook.com') || 
          result.url.includes('yelp.com') ||
          result.url.includes('healthgrades.com') ||
          result.url.includes('ratemds.com') ||
          result.url.includes('youtube.com') ||
          result.url.includes('instagram.com') ||
          result.url.includes('twitter.com') ||
          result.url.includes('linkedin.com')) {
        console.log('Skipping non-website result');
        continue;
      }

      // Scrape the website
      console.log(`Scraping URL: ${result.url}`);
      const businessInfo = await scrapeUrl(result.url);
      displayBusinessInfo(businessInfo);

      // Wait between scrapes to avoid rate limiting
      if (i < resultsToProcess.length - 1) {
        console.log('\nWaiting before next scrape...');
        await delay(5000);
      }
    } catch (error: any) {
      console.error(`Error processing ${result.url}:`, error.message);
    }
  }
}

// Get search query from command line arguments
const searchQuery = process.argv.slice(2).join(' ') || 'dentist in pittsburgh';

// Run the search and scrape
searchAndScrape(searchQuery).catch(error => {
  console.error('Error:', error);
  process.exit(1);
}); 