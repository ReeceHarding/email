import 'dotenv/config'
import { sendGmail } from './google'

/**
 * Simple test script for verifying email sending via Gmail.
 * Usage:
 *  npx tsx lib/test-email-sending.ts
 */
async function testEmailSending() {
  try {
    const userClerkId = process.env.TEST_CLERK_ID || "test_user_123"
    const toEmail = process.env.TEST_TO_EMAIL || "test@example.com"
    const subject = "Test Email from Automation"
    const body = "Hello! This is a test email sent via Gmail integration."
    
    console.log('Sending test email to:', toEmail)
    
    const { threadId, messageId } = await sendGmail({
      userClerkId,
      to: toEmail,
      subject,
      body
    })
    
    console.log('Email sent successfully!')
    console.log('Thread ID:', threadId)
    console.log('Message ID:', messageId)
  } catch (err: any) {
    console.error('Failed to send test email:', err.message || err)
    process.exit(1)
  }
}

// Run if called directly:
if (require.main === module) {
  testEmailSending()
} 