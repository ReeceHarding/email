"use server"

import { pool } from "../../db/client";
import { ScrapedBusinessData } from "../../lib/firecrawl";

function mapScrapedDataToColumns(scrapedData: ScrapedBusinessData) {
  return {
    // Basic Info
    company_name: scrapedData.businessName,
    description: scrapedData.description,
    industry: scrapedData.industry,
    year_founded: scrapedData.yearFounded,
    company_size: scrapedData.companySize,
    
    // Contact Info
    contact_email: scrapedData.contactEmail,
    phone_number: scrapedData.phoneNumber,
    address: scrapedData.address,
    
    // Social Media
    linkedin_url: scrapedData.socialMedia?.linkedin,
    twitter_url: scrapedData.socialMedia?.twitter,
    facebook_url: scrapedData.socialMedia?.facebook,
    instagram_url: scrapedData.socialMedia?.instagram,
    
    // Team Information
    founders: JSON.stringify(scrapedData.founders || []),
    team_members: JSON.stringify(scrapedData.teamMembers || []),
    
    // Additional Data
    discovered_emails: JSON.stringify(scrapedData.allEmails || []),
    scraped_pages: JSON.stringify(scrapedData.scrapedPages || []),
    
    // Business Hours
    business_hours: scrapedData.businessHours ? JSON.stringify(scrapedData.businessHours) : null,
    
    // Store raw data for reference
    raw_scraped_data: JSON.stringify(scrapedData),
    
    // Update metadata
    last_scraped_at: new Date(),
    status: "scraped"
  };
}

export async function createLead(
  userId: string,
  websiteUrl: string,
  scrapedData: ScrapedBusinessData
) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Check if lead exists
    const existingLead = await client.query(
      'SELECT id FROM leads WHERE user_id = $1 AND website_url = $2 LIMIT 1',
      [userId, websiteUrl]
    );

    const mappedData = mapScrapedDataToColumns(scrapedData);
    const columns = Object.keys(mappedData);
    const values = Object.values(mappedData);
    const placeholders = values.map((_, i) => `$${i + 3}`); // +3 because userId and websiteUrl are 1 and 2

    if (existingLead.rows.length > 0) {
      // Update existing lead
      const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
      const query = `
        UPDATE leads 
        SET ${setClause}, updated_at = NOW()
        WHERE id = $${columns.length + 1}
        RETURNING *
      `;
      
      const result = await client.query(query, [...values, existingLead.rows[0].id]);
      await client.query('COMMIT');

      return {
        success: true,
        message: "Lead updated successfully",
        data: result.rows[0],
      };
    }

    // Insert new lead
    const query = `
      INSERT INTO leads (
        user_id,
        website_url,
        ${columns.join(', ')},
        created_at,
        updated_at
      ) VALUES (
        $1,
        $2,
        ${placeholders.join(', ')},
        NOW(),
        NOW()
      )
      RETURNING *
    `;

    const result = await client.query(query, [userId, websiteUrl, ...values]);
    await client.query('COMMIT');

    return {
      success: true,
      message: "Lead created successfully",
      data: result.rows[0],
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error creating/updating lead:", error);
    return {
      success: false,
      message: "Failed to create/update lead",
    };
  } finally {
    client.release();
  }
}

export async function getLeads(userId: string) {
  try {
    const result = await pool.query(
      'SELECT * FROM leads WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );

    return {
      success: true,
      message: "Leads retrieved successfully",
      data: result.rows,
    };
  } catch (error) {
    console.error("Error getting leads:", error);
    return {
      success: false,
      message: "Failed to get leads",
    };
  }
}

export async function updateLead(leadId: number, data: Record<string, any>) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
    
    const query = `
      UPDATE leads 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${columns.length + 1}
      RETURNING *
    `;

    const result = await client.query(query, [...values, leadId]);
    await client.query('COMMIT');

    return {
      success: true,
      message: "Lead updated successfully",
      data: result.rows[0],
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error updating lead:", error);
    return {
      success: false,
      message: "Failed to update lead",
    };
  } finally {
    client.release();
  }
}

export async function deleteLead(leadId: number) {
  try {
    await pool.query('DELETE FROM leads WHERE id = $1', [leadId]);

    return {
      success: true,
      message: "Lead deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting lead:", error);
    return {
      success: false,
      message: "Failed to delete lead",
    };
  }
}

// Test function to check basic database operations
export async function testLeadsTable() {
  const client = await pool.connect();
  
  try {
    // Test 1: Simple select
    console.log('Testing simple select...');
    const result = await client.query('SELECT * FROM leads LIMIT 1');
    console.log('Select successful:', result.rows);
    
    // Test 2: Simple insert
    console.log('\nTesting simple insert...');
    const inserted = await client.query(
      'INSERT INTO leads (user_id, website_url, status) VALUES ($1, $2, $3) RETURNING *',
      ['test', 'test.com', 'pending']
    );
    console.log('Insert successful:', inserted.rows[0]);
    
    // Test 3: Clean up
    console.log('\nCleaning up test data...');
    await client.query('DELETE FROM leads WHERE user_id = $1', ['test']);
    console.log('Cleanup successful');
    
    return { success: true, message: 'All database operations successful' };
  } catch (error: any) {
    console.error('Database test failed:', error);
    return { success: false, message: error?.message || 'Unknown error' };
  } finally {
    client.release();
  }
} 