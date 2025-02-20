# Setting Up Supabase Database

This guide explains how to set up a new database table in Supabase with proper schema, migrations, and tests.

## Step 1: Create Schema File

Create your schema file in `db/schema/your-schema.ts`:

```typescript
import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

export const yourTable = pgTable("your_table", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Add your columns here
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
});

export type InsertYourTable = typeof yourTable.$inferInsert;
export type SelectYourTable = typeof yourTable.$inferSelect;
```

## Step 2: Create SQL Migration

Create your SQL migration file in `db/migrations/your-schema.sql`:

```sql
-- Enable extensions
create extension if not exists "uuid-ossp";

-- Create table
create table if not exists public.your_table (
  id uuid primary key default uuid_generate_v4(),
  -- Add your columns here
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create indexes
create index if not exists idx_your_table_some_column 
  on public.your_table(some_column);

-- Create function to update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create trigger for updated_at
drop trigger if exists set_updated_at on public.your_table;
create trigger set_updated_at
  before update on public.your_table
  for each row
  execute function public.handle_updated_at();

-- Enable RLS
alter table public.your_table enable row level security;

-- Create policies
create policy "Enable read access for all users" on public.your_table
  for select
  using (true);

create policy "Enable insert access for all users" on public.your_table
  for insert
  with check (true);

create policy "Enable update access for all users" on public.your_table
  for update
  using (true);

-- Add unique constraints if needed
alter table public.your_table
  add constraint your_table_unique_key unique (some_column);
```

## Step 3: Initialize and Link Supabase

```bash
supabase init
supabase link --project-ref your-project-ref
```

## Step 4: Create Supabase Migration

```bash
supabase migration new create_your_table
cp db/migrations/your-schema.sql supabase/migrations/timestamp_create_your_table.sql
```

## Step 5: Push Migration

```bash
supabase db push
```

## Step 6: Create Test Script

Create a test script in `lib/test-supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function testSupabase() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Test insert
    const { data: insertData, error: insertError } = await supabase
      .from('your_table')
      .insert({ /* test data */ })
      .select();

    if (insertError) throw insertError;
    console.log('✓ Insert successful:', insertData);

    // Test select
    const { data: selectData, error: selectError } = await supabase
      .from('your_table')
      .select()
      .limit(1);

    if (selectError) throw selectError;
    console.log('✓ Select successful:', selectData);

    // Clean up
    const { error: deleteError } = await supabase
      .from('your_table')
      .delete()
      .eq('id', insertData[0].id);

    if (deleteError) throw deleteError;
    console.log('✓ Cleanup successful');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testSupabase().catch(console.error);
```

## Step 7: Add Test Script to package.json

Add this to your `package.json`:

```json
{
  "scripts": {
    "test:supabase": "tsx lib/test-supabase.ts"
  }
}
```

## Step 8: Test Setup

```bash
npm run test:supabase
```

## Features Included

This setup provides:
- UUID primary keys
- JSONB columns for complex data
- Automatic timestamps (created_at and updated_at)
- Row Level Security (RLS) policies
- Indexes for better query performance
- Unique constraints
- TypeScript types for type safety
- Test script for verification

## Common Issues

1. **Connection Issues**: Make sure your `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables are set correctly.

2. **Migration Errors**: If you get migration errors, try:
   ```bash
   supabase db reset
   supabase db push
   ```

3. **Type Errors**: Make sure your schema types match between Drizzle and Supabase.

4. **RLS Issues**: If you can't access data, check that your RLS policies are correct and that you're using the right API key. 