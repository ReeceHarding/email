-- Create scraped_pages table
CREATE TABLE IF NOT EXISTS scraped_pages (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  raw_data JSONB,
  processed_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create scrape_metrics table
CREATE TABLE IF NOT EXISTS scrape_metrics (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  base_url TEXT NOT NULL,
  pages_scraped INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add indices for better query performance
CREATE INDEX IF NOT EXISTS idx_scraped_pages_user_id ON scraped_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_scraped_pages_url ON scraped_pages(url);
CREATE INDEX IF NOT EXISTS idx_scrape_metrics_job_id ON scrape_metrics(job_id);
CREATE INDEX IF NOT EXISTS idx_scrape_metrics_user_id ON scrape_metrics(user_id);

-- Add foreign key constraints
ALTER TABLE scraped_pages
  ADD CONSTRAINT fk_scraped_pages_user_id
  FOREIGN KEY (user_id)
  REFERENCES users(clerk_id)
  ON DELETE CASCADE;

ALTER TABLE scrape_metrics
  ADD CONSTRAINT fk_scrape_metrics_user_id
  FOREIGN KEY (user_id)
  REFERENCES users(clerk_id)
  ON DELETE CASCADE; 