# Gmail OAuth Integration Setup Guide

This guide explains how to set up Google OAuth for Gmail integration in your application.

## Prerequisites

1. Google Cloud Platform account
2. A Google Cloud Project
3. Gmail API enabled in your project
4. OAuth 2.0 Client ID credentials

## Step 1: Create a Google Cloud Project

If you don't already have a project:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on "Select a project" at the top of the page
3. Click "New Project"
4. Name your project and click "Create"

## Step 2: Enable the Gmail API

1. From your project dashboard, go to "APIs & Services" > "Library"
2. Search for "Gmail API"
3. Click on the Gmail API and click "Enable"

## Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Select "External" user type (unless you're using Google Workspace)
3. Fill in the required fields:
   - App name
   - User support email
   - Developer contact information
4. Click "Save and Continue"
5. Add the following scopes:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.readonly`
6. Click "Save and Continue"
7. Add test users if needed
8. Click "Save and Continue"

## Step 4: Create OAuth Client ID

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Web application" as the application type
4. Name your OAuth client
5. Under "Authorized redirect URIs", add these exact URLs:
   - For development: `http://localhost:3000/api/email-gmail/oauth-callback`
   - For production: `https://your-domain.com/api/email-gmail/oauth-callback`
6. Click "Create"

## Step 5: Get Your Client ID and Secret

After creating the OAuth client, you'll see a modal with your client ID and client secret.

1. Note down your Client ID and Client Secret
2. Add them to your `.env.local` file:

```
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_OAUTH_REDIRECT=http://localhost:3000/api/email-gmail/oauth-callback
```

## Step 6: Verify the Setup

1. Start your development server with `npm run dev`
2. Go to your dashboard
3. Click the "Connect Gmail" button
4. You should be redirected to Google's consent screen
5. After granting access, you should be redirected back to your app
6. Check the console logs to verify the OAuth flow completed successfully

## Important Notes

- The redirect URI in your Google Cloud Console must match **exactly** what's in your `GOOGLE_OAUTH_REDIRECT` environment variable.
- For production, remember to update the `GOOGLE_OAUTH_REDIRECT` variable with your production domain.
- When publishing your app, you may need to go through Google's verification process if you want to make it available to all users.
- When running in production with a published OAuth application, make sure to add your production domain to the authorized redirect URIs.

## Troubleshooting

If you encounter issues with the OAuth flow:

1. **Check your redirect URI**: Ensure the URI in your Google Cloud Console matches exactly what's in your environment variables.
2. **Check your scopes**: Make sure you've added all required scopes to your OAuth consent screen.
3. **Check your environment variables**: Make sure your client ID and client secret are set correctly.
4. **Check your consent screen**: Make sure your OAuth consent screen is properly configured.
5. **Check the console logs**: Look for any error messages in your application's logs.

## Testing

You can run the integration tests to verify your setup:

```bash
npx ts-node lib/test-gmail.ts
```

This will run automated tests to ensure the OAuth flow is working correctly. 