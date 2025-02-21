import { scrapeUrl } from "../lib/test-scrape-system";
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
    const businessInfo = await scrapeUrl(url);
    
    // Create results directory if it doesn't exist
    const resultsDir = path.join(process.cwd(), 'results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir);
    }

    // Write results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(resultsDir, `scrape-result-${timestamp}.json`);
    fs.writeFileSync(filename, JSON.stringify(businessInfo, null, 2));

    console.log('\n✅ Scraping Complete!\n==========================================');
    console.log('Final Business Profile:');

    // Log the extracted information in a structured way
    if (businessInfo.name) console.log('\n📝 Business Name:', businessInfo.name);
    if (businessInfo.description) console.log('📄 Description:', businessInfo.description);

    if (businessInfo.phone || businessInfo.email || businessInfo.address) {
      console.log('\n📞 Contact Information:');
      if (businessInfo.phone) console.log('   📱 Phone:', businessInfo.phone);
      if (businessInfo.email) console.log('   📧 Email:', businessInfo.email);
      if (businessInfo.address) console.log('   📍 Address:', businessInfo.address);
    }

    if (businessInfo.hours?.length) {
      console.log('\n🕒 Business Hours:');
      businessInfo.hours.forEach(hour => console.log(`   └─ ${hour}`));
    }

    if (businessInfo.services?.length) {
      console.log('\n🔧 Services:');
      businessInfo.services.forEach(service => console.log(`   └─ ${service}`));
    }

    if (businessInfo.teamMembers?.length) {
      console.log('\n👥 Team Members:');
      businessInfo.teamMembers.forEach(member => {
        console.log(`   └─ ${member.name}${member.role ? ` (${member.role})` : ''}`);
        if (member.email) console.log(`      📧 Email: ${member.email}`);
        if (member.bio) console.log(`      📝 Bio: ${member.bio.substring(0, 100)}...`);
      });
    }

    if (businessInfo.socialLinks && Object.keys(businessInfo.socialLinks).length) {
      console.log('\n🔗 Social Media Links:');
      Object.entries(businessInfo.socialLinks).forEach(([platform, url]) => {
        console.log(`   └─ ${platform}: ${url}`);
      });
    }

    if (businessInfo.insurances?.length) {
      console.log('\n💳 Insurance & Payment:');
      businessInfo.insurances.forEach(insurance => console.log(`   └─ ${insurance}`));
    }

    console.log('\n📁 Results saved to:', filename);

  } catch (error) {
    console.error('\n❌ Error during scraping:', error);
    process.exit(1);
  }
}

main(); 