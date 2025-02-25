import { delay } from './utils';

export interface DiscoveredPage {
  url: string;
  title: string;
  description?: string;
}

export class PageDiscovery {
  private visitedUrls = new Set<string>();
  private urlQueue = new Set<string>();
  private patterns = new Set<string>();
  private readonly skipPatterns = [
    /\/Profile\//i,
    /\/ShowUserReviews\//i,
    /\/Hotels\//i,
    /\/Attractions\//i,
    /\/Flights\//i,
    /\/VacationRentals\//i,
    /\/Cruises\//i,
    /\/RentalCars\//i,
    /\/ForumHome\//i,
    /\/ShowForum\//i,
    /\/Tourism\//i,
    /\/Articles\//i,
    /\/TravelersChoice\//i,
    /\/Airlines\//i,
    /\/AddListing\//i,
    /\/UpdateListing\//i,
    /\/ManagementCenter\//i,
    /\/TransparencyReport\//i,
    /\/SiteIndex\//i
  ];

  private readonly businessPatterns = [
    /\/Restaurant_Review-/i,
    /\/Business-/i,
    /\/LocalBusiness-/i,
    /\/about\/?$/i,
    /\/contact\/?$/i,
    /\/menu\/?$/i,
    /\/locations\/?$/i,
    /\/hours\/?$/i
  ];

  constructor(private maxDepth: number = 2, private maxPages: number = 10) {}

  private getNextUrl(): string | undefined {
    const next = Array.from(this.urlQueue)[0];
    if (next) {
      this.urlQueue.delete(next);
      this.visitedUrls.add(next);
    }
    return next;
  }

  private async processUrl(url: string): Promise<DiscoveredPage | null> {
    try {
      const response = await fetch(url);
      const html = await response.text();
      const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '';
      const description = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i)?.[1];
      
      return {
        url,
        title,
        description
      };
    } catch (error) {
      console.error(`Error processing URL ${url}:`, error);
      return null;
    }
  }

  async discoverPages(startUrl: string): Promise<DiscoveredPage[]> {
    this.urlQueue.add(startUrl);
    const discoveredPages: DiscoveredPage[] = [];
    const depth = 0;

    while (this.urlQueue.size > 0 && depth < this.maxDepth && discoveredPages.length < this.maxPages) {
      const url = this.getNextUrl();
      if (!url) break;

      // Skip if URL matches any skip patterns
      if (this.skipPatterns.some(pattern => pattern.test(url))) {
        console.log(`[PageDiscovery] Skipping filtered URL: ${url}`);
        continue;
      }

      // Prioritize business-relevant pages
      const isBusinessPage = this.businessPatterns.some(pattern => pattern.test(url));
      if (!isBusinessPage && depth > 0) {
        console.log(`[PageDiscovery] Skipping non-business page: ${url}`);
        continue;
      }

      try {
        console.log(`[PageDiscovery] Processing URL: ${url}`);
        const page = await this.processUrl(url);
        if (page) {
          discoveredPages.push(page);
        }
        await delay(1000); // Reduced delay
      } catch (error) {
        console.error(`[PageDiscovery] Error processing ${url}:`, error);
      }
    }

    return discoveredPages;
  }
} 