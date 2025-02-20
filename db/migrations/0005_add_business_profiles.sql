-- Create business_profiles table
CREATE TABLE IF NOT EXISTS business_profiles (
  id SERIAL PRIMARY KEY,
  
  -- Basic Info
  business_name VARCHAR(255),
  website_url VARCHAR(500) NOT NULL,
  
  -- Owner/Decision Maker Info
  owner_name VARCHAR(255),
  owner_title VARCHAR(255),
  owner_linkedin VARCHAR(500),
  owner_email VARCHAR(255),
  
  -- Contact Info
  primary_email VARCHAR(255),
  alternative_emails JSONB,
  phone_number VARCHAR(50),
  address TEXT,
  
  -- Business Differentiators
  unique_selling_points JSONB,
  specialties JSONB,
  awards JSONB,
  year_established VARCHAR(4),
  
  -- Services & Features
  services JSONB,
  technologies JSONB,
  insurances_accepted JSONB,
  
  -- Professional Info
  certifications JSONB,
  affiliations JSONB,
  
  -- Social Proof
  testimonial_highlights JSONB,
  social_media_links JSONB,
  
  -- Outreach Status
  outreach_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  last_email_sent_at TIMESTAMP,
  email_history JSONB,
  
  -- Source Tracking
  source_url VARCHAR(500),
  source_type VARCHAR(50),
  
  -- Metadata
  scraped_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  notes TEXT
);

-- Add indices for common queries
CREATE INDEX idx_business_profiles_status ON business_profiles(outreach_status);
CREATE INDEX idx_business_profiles_website ON business_profiles(website_url);
CREATE INDEX idx_business_profiles_scraped ON business_profiles(scraped_at);

-- Add function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_business_profiles_updated_at
    BEFORE UPDATE ON business_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 