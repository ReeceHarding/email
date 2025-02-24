import { pool } from '../../db/client';
import { ScrapedBusinessData } from '../firecrawl';
import { createLead } from '../../actions/db/leads-actions';

/**
 * Enhanced logs to confirm which data we're storing in leads table. 
 * We store only text in all_page_texts array, plus any discovered team members in the leads table as well if needed.
 */
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
    _originalHtml: string
  ) {
    console.log("[ScrapeStorage] storePageData called with:", { userId, url });
    const client = await pool.connect();
    
    try {
      await client.query("BEGIN");
      
      console.log("[ScrapeStorage] -> createLead. userId=", userId, " url=", url);
      await createLead(userId, url, data);
      
      const mainText = data.rawText || "";
      console.log("[ScrapeStorage] mainText length=", mainText.length);

      const updateSql = `
        UPDATE leads
        SET all_page_texts = jsonb_set(
          COALESCE(all_page_texts, '[]'::jsonb),
          ARRAY[jsonb_array_length(COALESCE(all_page_texts, '[]'::jsonb))::text],
          to_jsonb(json_build_object('url', $2, 'text', $3))
        )
        WHERE user_id = $1 AND website_url = $4
      `;
      
      console.log("[ScrapeStorage] Running updateSql to store text snippet.");
      await client.query(updateSql, [
        userId,
        url,
        mainText,
        url
      ]);
      
      console.log("[ScrapeStorage] Update all_page_texts complete. Committing transaction...");
      await client.query("COMMIT");
      console.log("[ScrapeStorage] Successfully committed changes for userId=", userId, " url=", url);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("[ScrapeStorage] Error storing page data:", error);
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