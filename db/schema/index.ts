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

// ADD our newly created schema
export * from "./user-personal-data-schema"; 