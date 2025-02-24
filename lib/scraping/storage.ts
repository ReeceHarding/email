import { pool } from '../../db/client';
import { ScrapedBusinessData } from '../firecrawl';
import { createLead } from '../../actions/db/leads-actions';

export class ScrapeStorage {
  /**
   * storePageData
   *   - Called after we scrape a single page.
   *   - We'll store the extracted text from the page instead of the entire raw HTML.
   */
  async storePageData(
    userId: string,
    url: string,
    data: ScrapedBusinessData,
    originalHtml: string // no longer used, but let's keep param to avoid breakage
  ) {
    console.log('[ScrapeStorage] storePageData called:', { userId, url });
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Insert or update lead
      // We'll store partial data in the leads table or create a new row if needed
      console.log('[ScrapeStorage] Creating/updating lead with createLead...');
      await createLead(userId, url, data);
      
      // We used to store rawHtml in allPageTexts, but now we only store the main text
      const mainText = data.rawText || "";  // the main extracted text from the page

      console.log('[ScrapeStorage] Querying lead record to update allPage_texts with mainText...');
      const updateSql = `
        UPDATE leads
        SET all_page_texts = jsonb_set(
          COALESCE(all_page_texts, '[]'::jsonb),
          ARRAY[jsonb_array_length(COALESCE(all_page_texts, '[]'::jsonb))::text],
          to_jsonb(json_build_object('url', $2, 'text', $3))
        )
        WHERE user_id = $1 AND website_url = $4
      `;
      
      await client.query(updateSql, [
        userId,
        url,
        mainText,
        url
      ]);
      
      await client.query('COMMIT');
      console.log('[ScrapeStorage] Successfully stored main text in leads.all_page_texts JSON array');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[ScrapeStorage] Error storing page data:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  private processData(data: ScrapedBusinessData) {
    // Potentially normalize emails, phones, etc. but let's keep as is for now
    return {
      ...data
    };
  }
} 