ALTER TABLE "leads" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "phone_number" varchar(50);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "linkedin_url" varchar(500);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "twitter_url" varchar(500);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "facebook_url" varchar(500);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "instagram_url" varchar(500);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "business_hours" jsonb;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "last_scraped_at" timestamp;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "raw_scraped_data" jsonb;--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "scraped_data";