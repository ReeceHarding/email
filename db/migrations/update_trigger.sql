-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_processed_urls_updated_at ON processed_urls;

-- Create new trigger
CREATE TRIGGER update_processed_urls_updated_at
    BEFORE UPDATE ON processed_urls
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 