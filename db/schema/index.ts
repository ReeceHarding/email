/**
 * @file index.ts
 * @description
 * This file re-exports all the various schema definitions from the db/schema directory.
 * Importing from this file allows easy access to any of the defined tables without
 * having to individually reference each schema file.
 *
 * NOTE: We've updated it to include the newly created user-personal-data-schema.
 */

export * from "./scraping-schema";
export * from "./business-profiles-schema";
export * from './processed-urls-schema';
export * from "./users-schema";
export * from "./leads-schema";
export * from "./emails-schema";
export * from "./offers-schema";
export * from "./user-personal-data-schema";
export * from "./team-members-schema";

// Add the email queue schema
export * from "./email-queue-schema";

// Add the email responses schema
export * from "./email-responses-schema";

// Add the newly created schemas
export * from "./contact-information-schema";
export * from "./research-data-schema";
export * from "./email-campaigns-schema";
export * from "./email-messages-schema"; 