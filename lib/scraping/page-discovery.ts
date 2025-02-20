export interface PagePriority {
  url: string;
  type: 'about' | 'team' | 'contact' | 'product' | 'blog' | 'other';
  priority: number; // 1-10
  depth: number;
}

export interface ScrapingConfig {
  maxPages: number;
  maxDepth: number;
  priorityThreshold: number;
  allowedDomains: string[];
  excludePatterns: RegExp[];
  rateLimit: number; // requests per second
  timeout: number;
}

function extractLinks(html: string): string[] {
  const links: string[] = [];
  
  // Match href attributes in anchor tags
  const hrefPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>/g;
  let match;
  
  while ((match = hrefPattern.exec(html)) !== null) {
    const href = match[1].trim();
    
    // Skip empty, javascript:, mailto:, tel:, and anchor links
    if (!href || 
        href.startsWith('javascript:') || 
        href.startsWith('mailto:') || 
        href.startsWith('tel:') || 
        href.startsWith('#')) {
      continue;
    }
    
    links.push(href);
  }
  
  // Also check for canonical and alternate links in meta tags
  const metaPattern = /<(?:link|meta)[^>]+(?:href|content)=["']([^"']+)["'][^>]*>/g;
  while ((match = metaPattern.exec(html)) !== null) {
    const url = match[1].trim();
    if (url && url.startsWith('http')) {
      links.push(url);
    }
  }
  
  return [...new Set(links)]; // Remove duplicates
}

function normalizeUrl(url: string, baseUrl: string): string {
  try {
    // Handle relative URLs
    if (url.startsWith('/')) {
      const base = new URL(baseUrl);
      return `${base.protocol}//${base.host}${url}`;
    }
    // Handle protocol-relative URLs
    if (url.startsWith('//')) {
      const base = new URL(baseUrl);
      return `${base.protocol}${url}`;
    }
    // Handle absolute URLs
    if (url.startsWith('http')) {
      return new URL(url).toString();
    }
    // Handle relative URLs without leading slash
    const base = new URL(baseUrl);
    return new URL(url, base.toString()).toString();
  } catch (error) {
    console.error('Error normalizing URL:', error);
    return '';
  }
}

function shouldProcessUrl(url: string, config: ScrapingConfig): boolean {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace(/^www\./, '');
    
    // Check if domain is allowed (same domain or subdomain)
    const baseDomain = config.allowedDomains[0];
    if (!domain.endsWith(baseDomain) && domain !== baseDomain) {
      return false;
    }
    
    // Check exclude patterns
    if (config.excludePatterns.some(pattern => pattern.test(url))) {
      return false;
    }
    
    // Skip common non-content paths
    const skipPaths = [
      '/cdn-cgi/',
      '/wp-content/',
      '/wp-includes/',
      '/wp-json/',
      '/feed/',
      '/rss/',
      '/xmlrpc.php',
      '/wp-login.php',
      '/wp-admin/',
      '/assets/',
      '/static/',
      '/dist/',
      '/build/',
      '/api/',
      '/login',
      '/logout',
      '/signup',
      '/register',
      '/cart',
      '/checkout',
      '/manifest.json'
    ];
    
    if (skipPaths.some(path => urlObj.pathname.includes(path))) {
      return false;
    }
    
    // Skip URLs that look like media files or assets
    if (urlObj.pathname.match(/\.(jpg|jpeg|png|gif|css|js|xml|txt|pdf|zip|rar|gz|tar|dmg|exe|apk|ipa|woff|woff2|ttf|eot|svg|ico)$/i)) {
      return false;
    }
    
    // Skip URLs that look like tracking or analytics
    if (urlObj.pathname.match(/\b(track|click|analytics|pixel|beacon|stat|log|metrics)\b/i)) {
      return false;
    }
    
    // Skip URLs that look like social media
    if (urlObj.hostname.match(/\b(facebook|twitter|instagram|youtube|linkedin|snapchat|tiktok)\b/i)) {
      return false;
    }
    
    // Skip URLs that look like external services
    if (urlObj.hostname.match(/\b(google|apple|microsoft|amazon|adobe|salesforce|hubspot|zendesk|disney|nielsen|truste|iab|onetrust)\b/i)) {
      return false;
    }
    
    // Skip URLs with too many query parameters (likely dynamic/tracking pages)
    const queryParams = Array.from(urlObj.searchParams.keys());
    if (queryParams.length > 2) {
      return false;
    }
    
    // Skip fragment-only URLs
    if (urlObj.pathname === '/' && urlObj.hash) {
      return false;
    }
    
    // Allow URLs that look like content pages
    const contentPatterns = [
      // Common content paths
      /\/(about|team|contact|company|careers|press|news|blog|article|post|story)/i,
      // Common content indicators
      /\/(p|page|entry|article|post)\/[\w-]+/i,
      // Common ID patterns
      /\/(\d+|[\w-]+)$/i,
      // Common slug patterns
      /\/[\w-]{3,}$/i
    ];
    
    // Always allow root path
    if (urlObj.pathname === '/') {
      return true;
    }
    
    // Allow if matches any content pattern
    if (contentPatterns.some(pattern => pattern.test(urlObj.pathname))) {
      return true;
    }
    
    // Allow paths with 1-3 segments that don't match skip patterns
    const segments = urlObj.pathname.split('/').filter(Boolean);
    if (segments.length <= 3) {
      return true;
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

function determinePageType(url: string): PagePriority['type'] {
  const path = new URL(url).pathname.toLowerCase();
  
  // About pages
  if (path.match(/\b(about|about-us|company|who-we-are|our-story)\b/)) {
    return 'about';
  }
  
  // Team pages
  if (path.match(/\b(team|people|leadership|founders|management|staff|our-team)\b/)) {
    return 'team';
  }
  
  // Contact pages
  if (path.match(/\b(contact|connect|get-in-touch|reach-us|location|contact-us)\b/)) {
    return 'contact';
  }
  
  // Product pages
  if (path.match(/\b(product|service|solution|offering|features|pricing)\b/)) {
    return 'product';
  }
  
  // Blog/News pages
  if (path.match(/\b(blog|news|article|post|press|media|story)\b/)) {
    return 'blog';
  }
  
  return 'other';
}

function calculatePriority(url: string, type: PagePriority['type']): number {
  // Base priorities by page type
  const typePriorities: Record<PagePriority['type'], number> = {
    contact: 10,
    team: 9,
    about: 8,
    product: 7,
    blog: 5,
    other: 3
  };
  
  let priority = typePriorities[type];
  
  // Adjust priority based on URL characteristics
  const urlObj = new URL(url);
  const path = urlObj.pathname;
  
  // Penalize deep paths
  const depth = path.split('/').filter(Boolean).length;
  priority -= Math.max(0, depth - 2); // Allow up to 2 segments without penalty
  
  // Slightly penalize URLs with query parameters
  if (urlObj.search) {
    priority -= 1;
  }
  
  // Boost priority for important-looking paths
  const boostPatterns = [
    /\b(main|index|home)\b/i,
    /\b(corporate|business)\b/i,
    /\b(careers|jobs)\b/i,
    /\b(support|help)\b/i,
    /^\/[^\/]+\/?$/  // Boost root-level pages
  ];
  
  if (boostPatterns.some(pattern => pattern.test(path))) {
    priority += 1;
  }
  
  // Ensure priority stays within 1-10 range
  return Math.max(1, Math.min(10, priority));
}

function calculateDepth(url: string, baseUrl: string): number {
  try {
    const urlObj = new URL(url);
    const baseUrlObj = new URL(baseUrl);
    
    // If different domains, treat as maximum depth
    if (urlObj.hostname !== baseUrlObj.hostname) {
      return Number.MAX_SAFE_INTEGER;
    }
    
    // Calculate depth based on path segments
    const urlPath = urlObj.pathname;
    const basePath = baseUrlObj.pathname;
    
    const urlSegments = urlPath.split('/').filter(Boolean);
    const baseSegments = basePath.split('/').filter(Boolean);
    
    // Calculate relative depth
    return Math.abs(urlSegments.length - baseSegments.length);
  } catch (error) {
    console.error('Error calculating depth:', error);
    return Number.MAX_SAFE_INTEGER;
  }
}

export async function findPagesToScrape(
  html: string,
  baseUrl: string,
  config: ScrapingConfig
): Promise<PagePriority[]> {
  const pages: PagePriority[] = [];
  const seen = new Set<string>();
  
  // Extract all links
  const links = extractLinks(html);
  console.log(`[Discovery] Found ${links.length} raw links`);
  
  for (const link of links) {
    const url = normalizeUrl(link, baseUrl);
    if (!url) {
      console.log(`[Discovery] Skipping invalid URL: ${link}`);
      continue;
    }
    
    // Skip if already seen or doesn't match config
    if (seen.has(url)) {
      console.log(`[Discovery] Skipping duplicate URL: ${url}`);
      continue;
    }
    
    if (!shouldProcessUrl(url, config)) {
      console.log(`[Discovery] Skipping filtered URL: ${url}`);
      continue;
    }
    
    seen.add(url);
    
    // Determine page type and priority
    const type = determinePageType(url);
    const priority = calculatePriority(url, type);
    const depth = calculateDepth(url, baseUrl);
    
    console.log(`[Discovery] Processing URL: ${url} (type: ${type}, priority: ${priority}, depth: ${depth})`);
    
    if (priority >= config.priorityThreshold && depth <= config.maxDepth) {
      pages.push({ url, type, priority, depth });
    }
  }
  
  // Sort by priority descending
  return pages.sort((a, b) => b.priority - a.priority);
} 