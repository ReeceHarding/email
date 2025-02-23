import { scrapeUrl } from "../lib/test-scrape-system";
import { scrapePuppeteer } from "../lib/puppeteer-scraper";
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  // Get URL from command line argument
  const url = process.argv[2];
  if (!url) {
    console.error('Please provide a URL as a command line argument');
    process.exit(1);
  }

  console.log(`\n🔎 Starting scrape for: "${url}"\n`);
  
  try {
    // Try Puppeteer scraper first
    let businessInfo = await scrapePuppeteer(url);

    // If Puppeteer fails or returns minimal data, fallback to static scraper
    const hasMinimalData = !businessInfo.name && !businessInfo.description && !businessInfo.services?.length;
    if (hasMinimalData) {
      console.log('\n⚠️ Minimal data from Puppeteer scraper, trying static scraper...\n');
      businessInfo = await scrapeUrl(url);
    }
    
    // Create results directory if it doesn't exist
    const resultsDir = path.join(process.cwd(), 'results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir);
    }

    // Write results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(resultsDir, `scrape-result-${timestamp}.json`);
    fs.writeFileSync(filename, JSON.stringify(businessInfo, null, 2));

    console.log('\n✅ Scraping Complete!');
    console.log('==========================================');
    console.log('Final Business Profile:\n');

    console.log(`📝 Business Name: ${businessInfo.name}`);
    console.log(`📄 Description: ${businessInfo.description}\n`);

    if (businessInfo.address || businessInfo.phone || businessInfo.email) {
      console.log('📞 Contact Information:');
      if (businessInfo.address) console.log(`   📍 Address: ${businessInfo.address}`);
      if (businessInfo.phone) console.log(`   📱 Phone: ${businessInfo.phone}`);
      if (businessInfo.email) console.log(`   📧 Email: ${businessInfo.email}\n`);
    }

    if (businessInfo.hours?.length) {
      console.log('⏰ Business Hours:');
      businessInfo.hours.forEach(hour => console.log(`   └─ ${hour}`));
      console.log('');
    }

    if (businessInfo.services?.length) {
      console.log('🛠️ Services:');
      businessInfo.services.forEach(service => {
        console.log(`   └─ ${service.name}`);
        if (service.description) console.log(`      Description: ${service.description}`);
        if (service.price) console.log(`      Price: ${service.price}`);
      });
      console.log('');
    }

    if (businessInfo.teamMembers?.length) {
      console.log('👥 Team Members:');
      businessInfo.teamMembers.forEach(member => {
        console.log(`   └─ ${member.name}`);
        if (member.role) console.log(`      Role: ${member.role}`);
        if (member.bio) console.log(`      Bio: ${member.bio}`);
        if (member.email) console.log(`      Email: ${member.email}`);
        if (member.phone) console.log(`      Phone: ${member.phone}`);
      });
      console.log('');
    }

    if (businessInfo.companyValues?.length) {
      console.log('💫 Company Values:');
      businessInfo.companyValues.forEach(value => console.log(`   └─ ${value}`));
      console.log('');
    }

    if (businessInfo.certifications?.length) {
      console.log('🏆 Certifications:');
      businessInfo.certifications.forEach(cert => console.log(`   └─ ${cert}`));
      console.log('');
    }

    if (businessInfo.specialties?.length) {
      console.log('🎯 Specialties:');
      businessInfo.specialties.forEach(specialty => console.log(`   └─ ${specialty}`));
      console.log('');
    }

    if (businessInfo.locations?.length) {
      console.log('📍 Locations:');
      businessInfo.locations.forEach(location => {
        console.log(`   └─ ${location.name || 'Main Location'}`);
        console.log(`      Address: ${location.address}`);
        if (location.phone) console.log(`      Phone: ${location.phone}`);
        if (location.email) console.log(`      Email: ${location.email}`);
        if (location.hours?.length) {
          console.log('      Hours:');
          location.hours.forEach(hour => console.log(`         - ${hour}`));
        }
      });
      console.log('');
    }

    if (businessInfo.blogPosts?.length) {
      console.log('📝 Recent Blog Posts:');
      businessInfo.blogPosts.forEach(post => {
        console.log(`   └─ ${post.title}`);
        if (post.date) console.log(`      Date: ${post.date}`);
        if (post.excerpt) console.log(`      Excerpt: ${post.excerpt}`);
      });
      console.log('');
    }

    const socialLinks = Object.entries(businessInfo.socialLinks).filter(([_, url]) => url);
    if (socialLinks.length) {
      console.log('🔗 Social Media Links:');
      socialLinks.forEach(([platform, url]) => console.log(`   └─ ${platform}: ${url}`));
      console.log('');
    }

    console.log(`📁 Results saved to: ${filename}\n`);

  } catch (error) {
    console.error('\n❌ Error during scraping:', error);
    process.exit(1);
  }
}

main(); 