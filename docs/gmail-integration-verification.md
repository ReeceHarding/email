# Gmail Integration Verification Guide

This guide provides step-by-step instructions for manually verifying the Gmail OAuth integration.

## Prerequisites

- A Google Cloud project with Gmail API enabled
- OAuth credentials (client ID and secret) configured
- The application running on a local development server or deployed

## Setup

1. Ensure your `.env.local` file has the following environment variables:
   ```
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_OAUTH_REDIRECT=http://localhost:3000/api/email-gmail/oauth-callback  # For local development
   ```

2. Verify the Google Cloud project has the Gmail API enabled:
   ```bash
   gcloud services list --enabled | grep gmail
   ```

3. Verify OAuth credentials are set up correctly:
   ```bash
   gcloud auth application-default print-access-token
   ```

## Testing OAuth Flow

### 1. OAuth Initiation

Manually test the OAuth initiation flow:

1. Navigate to the dashboard in your application
2. Click on the "Connect Gmail" button
3. Verify you are redirected to Google's consent screen
4. Verify the requested scopes include:
   - `https://www.googleapis.com/auth/gmail.send` (for sending emails)
   - `https://www.googleapis.com/auth/gmail.readonly` (for reading emails)

### 2. OAuth Callback

Test the callback handling:

1. After granting permission, verify you are redirected back to your application
2. Verify a success message is displayed
3. Verify the Gmail connection status shows as "Connected"
4. Check the database to see if the tokens are stored:
   ```sql
   SELECT clerk_id, gmail_access_token IS NOT NULL, gmail_refresh_token IS NOT NULL
   FROM users
   WHERE clerk_id = 'your-user-id';
   ```

### 3. Token Refresh

Test the token refresh process:

1. Modify the access token in the database to an expired or invalid token
2. Perform an action that requires the Gmail API (like sending an email)
3. Verify the action succeeds, indicating the token was refreshed
4. Check the database to see if the access token was updated

### 4. Sending Emails

Test sending emails:

1. Navigate to a screen where email sending is available
2. Compose an email with:
   - A specific subject line (e.g., "Gmail Integration Test")
   - Some unique text in the body
   - A test recipient email
3. Send the email
4. Verify the email is delivered
5. Check for the correct formatting, including any HTML content

### 5. Disconnecting Gmail

Test disconnecting the Gmail integration:

1. Navigate to settings or the integration management screen
2. Click on the "Disconnect Gmail" button
3. Verify a success message is displayed
4. Verify the Gmail connection status shows as "Not Connected"
5. Check the database to see if the tokens are removed:
   ```sql
   SELECT clerk_id, gmail_access_token IS NULL, gmail_refresh_token IS NULL
   FROM users
   WHERE clerk_id = 'your-user-id';
   ```

## Troubleshooting

### Common Issues

1. **OAuth Error: invalid_request**
   - Verify that your redirect URI exactly matches what's configured in Google Cloud Console.
   - Check for any missing or incorrect parameters in the authorization request.

2. **OAuth Error: access_denied**
   - The user denied permission or the scopes requested are not approved in the OAuth consent screen.
   - Verify that the scopes are correctly configured in the OAuth consent screen.

3. **Token Refresh Failures**
   - Ensure refresh tokens are being properly stored in the database.
   - Verify that the OAuth client is correctly configured with the client ID and secret.

4. **Connection Issues After Deployment**
   - Verify that the `GOOGLE_OAUTH_REDIRECT` is updated to use the production domain.
   - Check that the production domain is added to the authorized redirect URIs in Google Cloud Console.

### Debugging

1. Enable debug logs in the application to trace token exchanges and API calls.
2. Verify tokens are being properly stored in the database.
3. Check browser console logs for any client-side errors.
4. Inspect network requests to see API responses.

## Verification Checklist

Use this checklist to ensure all aspects of the Gmail integration have been verified:

- [ ] OAuth flow initiates successfully
- [ ] Authorization code is exchanged for tokens
- [ ] Tokens are stored correctly in the database
- [ ] Gmail API calls succeed with valid tokens
- [ ] Tokens are refreshed when they expire
- [ ] Emails are sent correctly
- [ ] Gmail can be disconnected
- [ ] Error handling works as expected

After completing these verification steps, the Gmail OAuth integration should be considered fully functional. 