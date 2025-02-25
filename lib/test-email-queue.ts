/**
 * Email Queue Manual Test
 * 
 * This script provides a way to manually test the email queue functionality.
 * It demonstrates how to:
 * 1. Add emails to the queue
 * 2. Process the queue
 * 3. Get queue metrics
 * 4. Check individual email status
 */

import { db } from "@/db/db";
import { addToEmailQueue, processEmailQueue, getEmailQueueMetrics, getEmailQueueItem } from "@/lib/email-queue-service";

const TEST_USER_ID = "test-user-123"; // Replace with a real user ID for testing

// Helper function to log results
function logResult(operation: string, result: any) {
  console.log(`\n----- ${operation} -----`);
  if (result.isSuccess) {
    console.log(`✅ Success: ${result.message}`);
    if (result.data) {
      console.log("📊 Data:", JSON.stringify(result.data, null, 2));
    }
  } else {
    console.error(`❌ Failed: ${result.message}`);
  }
  console.log("-".repeat(operation.length + 12));
}

// Add a test email to the queue
async function addTestEmail() {
  console.log("Adding test email to queue...");
  
  const result = await addToEmailQueue({
    userId: TEST_USER_ID,
    to: "test@example.com",
    subject: "Test Email from Queue",
    body: "<p>This is a test email sent through the email queue system.</p>",
    priority: "normal"
  });
  
  logResult("Add Email", result);
  return result.isSuccess ? result.data?.id : null;
}

// Add a scheduled email to the queue
async function addScheduledEmail() {
  console.log("Adding scheduled email to queue...");
  
  // Schedule email for 1 minute in the future
  const scheduledTime = new Date(Date.now() + 60 * 1000);
  
  const result = await addToEmailQueue({
    userId: TEST_USER_ID,
    to: "test@example.com",
    subject: "Scheduled Test Email",
    body: "<p>This is a scheduled test email.</p>",
    priority: "high",
    scheduledFor: scheduledTime
  });
  
  logResult("Add Scheduled Email", result);
  return result.isSuccess ? result.data?.id : null;
}

// Process the email queue
async function processQueue() {
  console.log("Processing email queue...");
  
  const result = await processEmailQueue();
  
  logResult("Process Queue", result);
  return result;
}

// Get queue metrics
async function getMetrics() {
  console.log("Getting queue metrics...");
  
  const result = await getEmailQueueMetrics();
  
  logResult("Queue Metrics", result);
  return result;
}

// Get details of a specific email
async function getEmailDetails(id: string) {
  console.log(`Getting details for email ${id}...`);
  
  const result = await getEmailQueueItem(id);
  
  logResult("Email Details", result);
  return result;
}

// Run the tests
async function runTests() {
  try {
    console.log("📧 TESTING EMAIL QUEUE SYSTEM 📧");
    console.log("================================");
    
    // Step 1: Add a regular email to the queue
    const emailId = await addTestEmail();
    
    // Step 2: Add a scheduled email to the queue
    const scheduledEmailId = await addScheduledEmail();
    
    // Step 3: Get initial queue metrics
    await getMetrics();
    
    // Step 4: Check the status of the queued emails
    if (emailId) {
      await getEmailDetails(emailId);
    }
    
    if (scheduledEmailId) {
      await getEmailDetails(scheduledEmailId);
    }
    
    // Step 5: Process the queue
    await processQueue();
    
    // Step 6: Check the status of the emails after processing
    if (emailId) {
      await getEmailDetails(emailId);
    }
    
    if (scheduledEmailId) {
      await getEmailDetails(scheduledEmailId);
    }
    
    // Step 7: Get final queue metrics
    await getMetrics();
    
    console.log("\n✅ Test completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    // Close the database connection
    process.exit(0);
  }
}

// Run the tests if this file is executed directly
if (require.main === module) {
  runTests();
}

// Export the functions for use in other scripts
export {
  addTestEmail,
  addScheduledEmail,
  processQueue,
  getMetrics,
  getEmailDetails,
  runTests
}; 