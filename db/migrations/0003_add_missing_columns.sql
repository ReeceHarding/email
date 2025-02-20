ALTER TABLE "leads" ADD COLUMN "industry" varchar(255);
ALTER TABLE "leads" ADD COLUMN "year_founded" varchar(4);
ALTER TABLE "leads" ADD COLUMN "company_size" varchar(50);
ALTER TABLE "leads" ADD COLUMN "founders" jsonb;
ALTER TABLE "leads" ADD COLUMN "team_members" jsonb;
ALTER TABLE "leads" ADD COLUMN "discovered_emails" jsonb;
ALTER TABLE "leads" ADD COLUMN "scraped_pages" jsonb; 