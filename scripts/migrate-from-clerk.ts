#!/usr/bin/env ts-node

/**
 * Migration Script: From Clerk to Custom Auth
 * 
 * This script migrates existing users from Clerk to our custom auth system.
 * It creates the necessary columns in the users table.
 * 
 * Run with:
 * npx ts-node -r tsconfig-paths/register scripts/migrate-from-clerk.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

async function migrateTables() {
  try {
    console.log("Starting migration...");
    
    // Create a direct connection to run raw SQL
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    
    console.log("Database URL found: ", connectionString);
    
    const client = postgres(connectionString);
    const rawDb = drizzle(client);
    
    console.log("Checking if users table exists...");
    // First check if users table exists, create it if it doesn't
    const checkTableExists = await rawDb.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      );
    `);
    
    const tableExists = checkTableExists[0]?.exists;
    
    if (!tableExists) {
      console.log("Users table doesn't exist. Creating it...");
      await rawDb.execute(sql`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL,
          name TEXT,
          session_token TEXT,
          gmail_access_token TEXT,
          gmail_refresh_token TEXT,
          stripe_customer_id TEXT,
          stripe_subscription_id TEXT,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
      `);
      console.log("Users table created successfully.");
    } else {
      console.log("Users table exists. Checking columns...");
      
      // Check if user_id column exists
      const checkUserIdExists = await rawDb.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'user_id';
      `);
      
      // Add user_id column if it doesn't exist
      if (checkUserIdExists.length === 0) {
        console.log("Adding user_id column...");
        await rawDb.execute(sql`
          ALTER TABLE users
          ADD COLUMN user_id TEXT;
        `);
        
        // Check if clerk_id column exists to migrate data
        const checkClerkIdExists = await rawDb.execute(sql`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'clerk_id';
        `);
        
        if (checkClerkIdExists.length > 0) {
          console.log("Copying clerk_id values to user_id...");
          await rawDb.execute(sql`
            UPDATE users
            SET user_id = clerk_id
            WHERE user_id IS NULL AND clerk_id IS NOT NULL;
          `);
        }
        
        // Make user_id NOT NULL
        console.log("Adding NOT NULL constraint to user_id...");
        await rawDb.execute(sql`
          UPDATE users SET user_id = id::text WHERE user_id IS NULL;
          ALTER TABLE users ALTER COLUMN user_id SET NOT NULL;
        `);
        
        // Add UNIQUE constraint
        console.log("Adding UNIQUE constraint to user_id...");
        await rawDb.execute(sql`
          ALTER TABLE users ADD CONSTRAINT users_user_id_unique UNIQUE (user_id);
        `);
      } else {
        console.log("user_id column already exists.");
      }
      
      // Check if session_token column exists
      const checkSessionTokenExists = await rawDb.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'session_token';
      `);
      
      // Add session_token column if it doesn't exist
      if (checkSessionTokenExists.length === 0) {
        console.log("Adding session_token column...");
        await rawDb.execute(sql`
          ALTER TABLE users
          ADD COLUMN session_token TEXT;
        `);
      } else {
        console.log("session_token column already exists.");
      }
      
      // Check other required columns and add them if needed
      const requiredColumns = [
        'gmail_access_token',
        'gmail_refresh_token'
      ];
      
      for (const column of requiredColumns) {
        const checkColumnExists = await rawDb.execute(sql`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = ${column};
        `);
        
        if (checkColumnExists.length === 0) {
          console.log(`Adding ${column} column...`);
          await rawDb.execute(sql`
            ALTER TABLE users
            ADD COLUMN ${sql.identifier(column)} TEXT;
          `);
        } else {
          console.log(`${column} column already exists.`);
        }
      }
    }
    
    await client.end();
    console.log("Database connection closed.");
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

// Run the migration
migrateTables().then(() => {
  console.log("Migration completed successfully");
  process.exit(0);
}); 