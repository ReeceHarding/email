import { pool } from '../../db/client';
import { ScrapedBusinessData } from '../firecrawl';
import { createLead } from '../../actions/db/leads-actions';

export class ScrapeStorage {
  async storePageData(
    userId: string,
    url: string,
    data: ScrapedBusinessData
  ) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Store page-specific data
      await client.query(
        `INSERT INTO scraped_pages (
          user_id,
          url,
          raw_data,
          processed_data,
          created_at
        ) VALUES ($1, $2, $3, $4, NOW())`,
        [
          userId,
          url,
          JSON.stringify(data),
          JSON.stringify(this.processData(data))
        ]
      );
      
      // Update or create lead record
      await createLead(userId, url, data);
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  private processData(data: ScrapedBusinessData) {
    return {
      ...data,
      emails: this.normalizeEmails(data.allEmails || []),
      phones: this.normalizePhones(data.phoneNumber ? [data.phoneNumber] : [])
    };
  }
  
  private normalizeEmails(emails: string[]): string[] {
    return [...new Set(emails.map(email => 
      email.toLowerCase().trim()
    ))];
  }
  
  private normalizePhones(phones: string[]): string[] {
    return [...new Set(phones.map(phone => 
      phone.replace(/\D/g, '')
    ))];
  }
} 