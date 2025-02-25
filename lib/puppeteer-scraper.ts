import puppeteer, { Page } from 'puppeteer';
import { BusinessInfo, TeamMember } from './test-scrape-system';

export async function scrapePuppeteer(url: string): Promise<BusinessInfo> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const info: BusinessInfo = {
    name: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    website: url,
    hours: [],
    services: [],
    socialLinks: {
      facebook: '',
      instagram: '',
      twitter: '',
      linkedin: '',
      youtube: ''
    },
    teamMembers: [],
    companyValues: [],
    certifications: [],
    industries: [],
    specialties: [],
    partnerships: [],
    locations: [],
    blogPosts: [],
    pressReleases: []
  };

  try {
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    // Set longer timeout for initial page load
    await page.setDefaultNavigationTimeout(60000);
    await page.setDefaultTimeout(30000);

    // Enable JavaScript and handle modern web features
    await page.setJavaScriptEnabled(true);
    await page.setRequestInterception(true);
    
    // Handle request interception
    page.on('request', request => {
      if (
        request.resourceType() === 'image' ||
        request.resourceType() === 'font' ||
        request.resourceType() === 'media' ||
        request.resourceType() === 'stylesheet' ||
        request.url().includes('google-analytics') ||
        request.url().includes('doubleclick') ||
        request.url().includes('facebook') ||
        request.url().includes('analytics')
      ) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Add error handling for navigation
    page.on('error', err => {
      console.log('Page error:', err);
    });

    page.on('pageerror', err => {
      console.log('Page error:', err);
    });

    // Navigate to URL with better error handling
    try {
      await page.goto(url, { 
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 60000 
      });
    } catch (error) {
      console.log('Initial navigation failed, retrying with different options...');
      try {
        await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
      } catch (error) {
        console.log('Navigation failed:', error);
        return info;
      }
    }

    // Wait for common selectors that indicate page load
    await Promise.race([
      page.waitForSelector('h1'),
      page.waitForSelector('[class*="header"]'),
      page.waitForSelector('[class*="main"]'),
      page.waitForSelector('[class*="content"]'),
      new Promise(resolve => setTimeout(resolve, 10000))
    ]);

    // Handle cookie banners and popups
    await handlePopups(page);

    // Wait for any lazy-loaded content and scroll
    await autoScroll(page);

    // Function to scroll page for lazy loading with better error handling
    async function autoScroll(page: Page) {
      try {
        await page.evaluate(async () => {
          await new Promise<void>(resolve => {
            let totalHeight = 0;
            const distance = 100;
            const maxScrolls = 50; // Limit scrolling
            let scrollCount = 0;
            
            const timer = setInterval(() => {
              const scrollHeight = document.body.scrollHeight;
              window.scrollBy(0, distance);
              totalHeight += distance;
              scrollCount++;

              if (totalHeight >= scrollHeight || scrollCount >= maxScrolls) {
                clearInterval(timer);
                resolve();
              }
            }, 100);
          });
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.log('Auto-scroll failed:', error);
      }
    }

    // Function to handle popups with better error handling
    async function handlePopups(page: Page) {
      const selectors = [
        'button[id*="cookie"]',
        'button[class*="cookie"]',
        'a[id*="cookie"]',
        'a[class*="cookie"]',
        'button[id*="accept"]',
        'button[class*="accept"]',
        'button[id*="close"]',
        'button[class*="close"]',
        '[aria-label*="cookie"]',
        '[aria-label*="accept"]',
        '[aria-label*="close"]',
        '[class*="modal"] button',
        '[class*="popup"] button',
        '[class*="dialog"] button'
      ];

      for (const selector of selectors) {
        try {
          const elements = await page.$$(selector);
          for (const element of elements) {
            await Promise.race([
              element.click().catch(() => {}),
              new Promise(resolve => setTimeout(resolve, 1000))
            ]);
          }
        } catch (error) {
          // Ignore errors from popup handling
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Function to safely extract text content
    async function extractText(selector: string): Promise<string> {
      try {
        const element = await page.$(selector);
        if (!element) return '';
        
        const text = await page.evaluate(el => el.textContent, element);
        return text?.trim() || '';
      } catch {
        return '';
      }
    }

    // Function to safely navigate to a page
    async function safeNavigate(targetUrl: string) {
      try {
        await page.goto(targetUrl, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        await autoScroll(page);
        return true;
      } catch (error) {
        console.log(`Navigation failed to ${targetUrl}`);
        return false;
      }
    }

    // Extract structured data with better error handling
    const structuredData = await page.evaluate(() => {
      try {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        return scripts
          .map(script => {
            try {
              const data = JSON.parse(script.textContent || '{}');
              return Array.isArray(data) ? data[0] : data;
            } catch {
              return null;
            }
          })
          .filter(data => data && (
            data['@type'] === 'LocalBusiness' || 
            data['@type'] === 'Organization' || 
            data['@type'] === 'Restaurant' ||
            data['@type'] === 'Store' ||
            data['@type'] === 'MedicalBusiness'
          ))[0] || null;
      } catch {
        return null;
      }
    });

    if (structuredData) {
      info.name = structuredData.name || info.name;
      info.description = structuredData.description || info.description;
      info.foundingYear = structuredData.foundingDate?.split('-')[0] || info.foundingYear;
      info.address = structuredData.address?.streetAddress || structuredData.address || info.address;
      info.phone = structuredData.telephone || info.phone;
      info.email = structuredData.email || info.email;
      
      if (structuredData.openingHours) {
        info.hours = Array.isArray(structuredData.openingHours) 
          ? structuredData.openingHours 
          : [structuredData.openingHours];
      }
    }

    // Try to find and visit About page
    const aboutPageUrl = await page.evaluate(() => {
      const aboutLinks = Array.from(document.querySelectorAll('a')).find(a => 
        /about|company|who-we-are|our-story/i.test(a.href) || 
        /about|company|who we are|our story/i.test(a.textContent || '')
      );
      return aboutLinks?.href;
    });

    if (aboutPageUrl && await safeNavigate(aboutPageUrl)) {
      // Extract mission statement and company values
      const aboutInfo = await page.evaluate(() => {
        const missionSelectors = [
          '[class*="mission"]',
          '[class*="vision"]',
          'h2:contains("Mission"), h2:contains("Vision")',
          'h3:contains("Mission"), h3:contains("Vision")'
        ];

        const valueSelectors = [
          '[class*="values"]',
          '[class*="principles"]',
          'li[class*="value"]',
          'div[class*="value"]'
        ];

        let missionStatement = '';
        const companyValues: string[] = [];

        // Find mission statement
        for (const selector of missionSelectors) {
          try {
            const element = document.querySelector(selector);
            if (element) {
              const text = element.textContent?.trim();
              if (text && text.length > 20) {
                missionStatement = text;
                break;
              }
            }
          } catch {}
        }

        // Find company values
        for (const selector of valueSelectors) {
          try {
            const elements = document.querySelectorAll(selector);
            if (elements.length) {
              elements.forEach(el => {
                const text = el.textContent?.trim();
                if (text && text.length > 3) {
                  companyValues.push(text);
                }
              });
              if (companyValues.length) break;
            }
          } catch {}
        }

        return { missionStatement, companyValues };
      });

      info.missionStatement = aboutInfo.missionStatement;
      info.companyValues = aboutInfo.companyValues;
    }

    // Try to find and visit Team page
    const teamPageUrl = await page.evaluate(() => {
      const teamLinks = Array.from(document.querySelectorAll('a')).find(a => 
        /team|staff|people|leadership|our-team|meet-the-team/i.test(a.href) || 
        /team|staff|people|leadership|our team|meet the team/i.test(a.textContent || '')
      );
      return teamLinks?.href;
    });

    if (teamPageUrl && await safeNavigate(teamPageUrl)) {
      // Extract team members
      const teamMembers = await page.evaluate(() => {
        const memberSelectors = [
          '[class*="team-member"]',
          '[class*="staff"]',
          '[class*="employee"]',
          '[class*="person"]',
          '.team .member',
          '.team-grid > div',
          '.staff-grid > div'
        ];

        const members: TeamMember[] = [];

        for (const selector of memberSelectors) {
          try {
            const elements = document.querySelectorAll(selector);
            if (elements.length) {
              elements.forEach(el => {
                const name = el.querySelector('h2, h3, h4, [class*="name"]')?.textContent?.trim() || '';
                const role = el.querySelector('[class*="title"], [class*="position"], [class*="role"]')?.textContent?.trim();
                const bio = el.querySelector('[class*="bio"], [class*="description"], p')?.textContent?.trim();
                const imageUrl = el.querySelector('img')?.getAttribute('src') || undefined;
                const email = el.querySelector('a[href^="mailto:"]')?.getAttribute('href')?.replace('mailto:', '');
                const phone = el.querySelector('a[href^="tel:"]')?.getAttribute('href')?.replace('tel:', '');
                
                const socialLinks: { [key: string]: string } = {};
                el.querySelectorAll('a').forEach(a => {
                  const href = a.href;
                  if (href.includes('linkedin.com')) socialLinks.linkedin = href;
                  if (href.includes('twitter.com')) socialLinks.twitter = href;
                });

                if (name) {
                  members.push({
                    name,
                    role,
                    bio,
                    image: imageUrl,
                    email,
                    phone,
                    socialLinks
                  });
                }
              });
              if (members.length) break;
            }
          } catch {}
        }

        return members;
      });

      info.teamMembers = teamMembers;
    }

    // Try to find and visit Locations page
    const locationsPageUrl = await page.evaluate(() => {
      const locationLinks = Array.from(document.querySelectorAll('a')).find(a => 
        /locations|branches|stores|find-us|contact-us/i.test(a.href) || 
        /locations|branches|stores|find us|contact us/i.test(a.textContent || '')
      );
      return locationLinks?.href;
    });

    if (locationsPageUrl && await safeNavigate(locationsPageUrl)) {
      // Extract locations
      const locations = await page.evaluate(() => {
        const locationSelectors = [
          '[class*="location"]',
          '[class*="branch"]',
          '[class*="store"]',
          '[itemtype*="LocalBusiness"]'
        ];

        const locations: Array<{
          name?: string;
          address: string;
          phone?: string;
          email?: string;
          hours?: string[];
        }> = [];

        for (const selector of locationSelectors) {
          try {
            const elements = document.querySelectorAll(selector);
            if (elements.length) {
              elements.forEach(el => {
                const name = el.querySelector('h2, h3, h4, [class*="name"]')?.textContent?.trim();
                const address = el.querySelector('[class*="address"], address')?.textContent?.trim() || '';
                const phone = el.querySelector('a[href^="tel:"]')?.getAttribute('href')?.replace('tel:', '');
                const email = el.querySelector('a[href^="mailto:"]')?.getAttribute('href')?.replace('mailto:', '');
                
                const hours: string[] = [];
                el.querySelectorAll('[class*="hours"] tr, [class*="hours"] li').forEach(hour => {
                  const text = hour.textContent?.trim();
                  if (text && /(?:mon|tue|wed|thu|fri|sat|sun)/i.test(text)) {
                    hours.push(text);
                  }
                });

                if (address) {
                  locations.push({
                    name,
                    address,
                    phone,
                    email,
                    hours: hours.length ? hours : undefined
                  });
                }
              });
              if (locations.length) break;
            }
          } catch {}
        }

        return locations;
      });

      info.locations = locations;
    }

    // Try to find and visit Blog/News page
    const blogPageUrl = await page.evaluate(() => {
      const blogLinks = Array.from(document.querySelectorAll('a')).find(a => 
        /blog|news|articles|press|updates/i.test(a.href) || 
        /blog|news|articles|press|updates/i.test(a.textContent || '')
      );
      return blogLinks?.href;
    });

    if (blogPageUrl && await safeNavigate(blogPageUrl)) {
      // Extract blog posts
      const blogPosts = await page.evaluate(() => {
        const postSelectors = [
          'article',
          '[class*="post"]',
          '[class*="article"]',
          '.blog-grid > div'
        ];

        const posts: Array<{
          title: string;
          url: string;
          date?: string;
          excerpt?: string;
        }> = [];

        for (const selector of postSelectors) {
          try {
            const elements = document.querySelectorAll(selector);
            if (elements.length) {
              elements.forEach(el => {
                const titleEl = el.querySelector('h2, h3, h4, [class*="title"]');
                const title = titleEl?.textContent?.trim() || '';
                const url = titleEl?.closest('a')?.href || '';
                const date = el.querySelector('[class*="date"], time')?.textContent?.trim();
                const excerpt = el.querySelector('[class*="excerpt"], [class*="summary"], p')?.textContent?.trim();

                if (title && url) {
                  posts.push({ title, url, date, excerpt });
                }
              });
              if (posts.length) break;
            }
          } catch {}
        }

        return posts;
      });

      info.blogPosts = blogPosts;
    }

    // Extract additional business information
    const additionalInfo = await page.evaluate(() => {
      const certifications: string[] = [];
      const industries: string[] = [];
      const specialties: string[] = [];
      const partnerships: string[] = [];

      // Look for certifications
      document.querySelectorAll('[class*="certification"], [class*="accreditation"]').forEach(el => {
        const text = el.textContent?.trim();
        if (text) certifications.push(text);
      });

      // Look for industries
      document.querySelectorAll('[class*="industry"], [class*="sector"]').forEach(el => {
        const text = el.textContent?.trim();
        if (text) industries.push(text);
      });

      // Look for specialties
      document.querySelectorAll('[class*="specialty"], [class*="expertise"]').forEach(el => {
        const text = el.textContent?.trim();
        if (text) specialties.push(text);
      });

      // Look for partnerships
      document.querySelectorAll('[class*="partner"], [class*="affiliation"]').forEach(el => {
        const text = el.textContent?.trim();
        if (text) partnerships.push(text);
      });

      return { certifications, industries, specialties, partnerships };
    });

    info.certifications = additionalInfo.certifications;
    info.industries = additionalInfo.industries;
    info.specialties = additionalInfo.specialties;
    info.partnerships = additionalInfo.partnerships;

    return info;
  } catch (error) {
    console.error('Error during Puppeteer scraping:', error);
    return info;
  } finally {
    await browser.close();
  }
} 