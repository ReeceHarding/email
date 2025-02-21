import { db } from '@/db/db';
import { processedUrlsTable } from '@/db/schema/processed-urls-schema';
import { eq } from 'drizzle-orm';

async function testDatabaseSetup() {
  try {
    console.log('Testing database setup...');

    // Test inserting a URL
    const testUrl = 'https://test.example.com';
    console.log('Inserting test URL:', testUrl);
    
    await db.insert(processedUrlsTable)
      .values({ url: testUrl })
      .onConflictDoNothing();

    // Query the inserted URL
    console.log('Querying test URL...');
    const result = await db.query.processedUrls.findFirst({
      where: (urls, { eq }) => eq(urls.url, testUrl)
    });

    if (result) {
      console.log('Successfully found test URL:', result);
      
      // Test updating the URL to trigger the timestamp update
      console.log('Testing timestamp update...');
      await db.update(processedUrlsTable)
        .set({ url: testUrl })
        .where(eq(processedUrlsTable.url, testUrl));

      // Query again to check updated timestamp
      const updated = await db.query.processedUrls.findFirst({
        where: (urls, { eq }) => eq(urls.url, testUrl)
      });

      if (updated && updated.updatedAt > result.updatedAt) {
        console.log('Successfully updated timestamp:', updated);
      } else {
        console.log('Timestamp not updated as expected');
      }

      // Clean up test data
      console.log('Cleaning up test data...');
      await db.delete(processedUrlsTable)
        .where(eq(processedUrlsTable.url, testUrl));

      console.log('Test completed successfully!');
    } else {
      console.log('Failed to find test URL');
    }
  } catch (error) {
    console.error('Error testing database setup:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
  }
}

// Run the test
testDatabaseSetup(); 