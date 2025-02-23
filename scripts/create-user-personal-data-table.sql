-- Create the user_personal_data table
CREATE TABLE IF NOT EXISTS user_personal_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  education TEXT,
  hobbies TEXT,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
); 