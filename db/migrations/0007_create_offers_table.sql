-- 0007_create_offers_table.sql
-- This migration creates the "offers" table if it doesn't already exist.

CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  business_profile_id uuid NOT NULL,
  
  -- Value Proposition
  dream_outcome TEXT NOT NULL,
  perceived_likelihood TEXT NOT NULL,
  time_delay TEXT NOT NULL,
  effort_and_sacrifice TEXT NOT NULL,
  value_equation JSONB NOT NULL DEFAULT '{"likedFeatures": [], "lackingFeatures": [], "uniqueAdvantages": []}',

  -- Core Service & Bonuses
  core_service TEXT NOT NULL,
  bonuses JSONB NOT NULL DEFAULT '[]',
  guarantee TEXT NOT NULL,

  -- Pitches
  short_pitch TEXT NOT NULL,
  long_pitch TEXT NOT NULL DEFAULT '',
  
  -- Payment/Pricing (JSONB for flexible structures)
  pricing JSONB NOT NULL DEFAULT '{"amount": 0, "currency": "USD"}',
  
  -- Scarcity
  scarcity_elements JSONB NOT NULL DEFAULT '{"type": "time", "deadline": null, "spots": null}',

  -- Offer status
  status TEXT NOT NULL DEFAULT 'draft',
  version TEXT NOT NULL DEFAULT '1.0',

  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create the function to auto-update "updated_at"
CREATE OR REPLACE FUNCTION update_offers_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
DROP TRIGGER IF EXISTS update_offers_updated_at ON offers;
CREATE TRIGGER update_offers_updated_at
    BEFORE UPDATE ON offers
    FOR EACH ROW
    EXECUTE FUNCTION update_offers_updated_at_column();

-- Create an index for user_id for quicker lookups
CREATE INDEX IF NOT EXISTS idx_offers_user_id ON offers(user_id);

-- Foreign key relationship to business_profiles if needed
-- (commented out if you haven't created an actual references clause in drizzle)
-- ALTER TABLE offers
--   ADD CONSTRAINT fk_offers_business_profile
--   FOREIGN KEY (business_profile_id)
--   REFERENCES business_profiles(id) ON DELETE CASCADE; 