/**
 * @file db.ts
 * @description
 * This file sets up the main Drizzle ORM configuration and exports the `db` instance.
 * It also imports our table schemas and provides a single object schema that references
 * each table for Drizzle's type-safe operations.
 *
 * The environment variables determine the database connection details, including host,
 * database name, user, etc.
 *
 * NOTE: We are adding the userPersonalDataTable to the schema object so that we can
 * interact with user_personal_data via Drizzle.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// Schemas
import { businessProfilesTable } from './schema/business-profiles-schema';
import { processedUrlsTable } from './schema/processed-urls-schema';
import { leadsTable } from './schema/leads-schema';
import { emailsTable } from './schema/emails-schema';
import { usersTable } from './schema/users-schema';
import { userPersonalDataTable } from './schema/user-personal-data-schema';
import { offersTable } from './schema/offers-schema';
import { emailQueueTable } from './schema/email-queue-schema';
import { emailResponsesTable, emailThreadsTable } from './schema/email-responses-schema';
import { teamMembersTable } from './schema/team-members-schema';
import { contactInformationTable } from './schema/contact-information-schema';
import { researchDataTable } from './schema/research-data-schema';
import { emailCampaignsTable } from './schema/email-campaigns-schema';
import { emailMessagesTable } from './schema/email-messages-schema';

// Use local database for development/testing
export const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gmail',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * Log errors on idle clients
 */
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Log successful connection
 */
pool.on('connect', () => {
  console.log('Connected to database');
});

/**
 * Create and export our Drizzle instance, referencing each table in the schema.
 */
export const db = drizzle(pool, {
  schema: {
    businessProfiles: businessProfilesTable,
    processedUrls: processedUrlsTable,
    leads: leadsTable,
    emails: emailsTable,
    users: usersTable,

    // The newly added userPersonalDataTable
    userPersonalData: userPersonalDataTable,
    offers: offersTable,
    
    // Email queue table
    emailQueue: emailQueueTable,
    
    // Email responses and threads tables
    emailResponses: emailResponsesTable,
    emailThreads: emailThreadsTable,
    
    // Team members table
    teamMembers: teamMembersTable,
    
    // Newly added tables
    contactInformation: contactInformationTable,
    researchData: researchDataTable,
    emailCampaigns: emailCampaignsTable,
    emailMessages: emailMessagesTable
  },
}); 