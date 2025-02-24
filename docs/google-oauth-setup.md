# Google OAuth Setup Guide

This guide will walk you through setting up the Google OAuth client for Gmail integration.

## Prerequisites

- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

## Step 1: Create or Select a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. From the project dropdown at the top, either select an existing project or create a new one:
   - Click "New Project"
   - Enter a project name (e.g., "Gmail Integration")
   - Click "Create"

## Step 2: Enable the Gmail API

1. In the left sidebar, navigate to "APIs & Services" > "Library"
2. Search for "Gmail API"
3. Click on the Gmail API from the results
4. Click "Enable" to enable the API for your project

## Step 3: Configure the OAuth Consent Screen

1. In the left sidebar, navigate to "APIs & Services" > "OAuth consent screen"
2. Select "External" as the user type (for testing) and click "Create"
3. Fill in the required information:
   - App name: "Gmail Integration" (or your preferred name)
   - User support email: Enter your email
   - Developer contact information: Enter your email
4. Click "Save and Continue"
5. Add the following scopes:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.readonly`
6. Click "Save and Continue"
7. Add your email address as a test user
8. Click "Save and Continue"
9. Review your settings and click "Back to Dashboard"

## Step 4: Create OAuth Client ID

1. In the left sidebar, navigate to "APIs & Services" > "Credentials"
2. Click "Create Credentials" and select "OAuth client ID"
3. Application type: Select "Web application"
4. Name: "Gmail Integration Web Client" (or your preferred name)
5. Add authorized JavaScript origins:
   - `http://localhost:3000` (for development)
   - Your production URL when deploying
6. Add authorized redirect URIs:
   - `http://localhost:3000/api/email-gmail/oauth-callback` (for development)
   - Your production redirect URL when deploying
7. Click "Create"
8. You'll see a popup with your Client ID and Client Secret. Click "Download JSON" to save a copy of these credentials.

## Step 5: Update Environment Variables

1. Open your `.env.local` file
2. Update the Google OAuth variables:
   ```
   GOOGLE_CLIENT_ID=your_new_client_id
   GOOGLE_CLIENT_SECRET=your_new_client_secret
   GOOGLE_OAUTH_REDIRECT=http://localhost:3000/api/email-gmail/oauth-callback
   ```

## Step 6: Test Your Configuration

1. Restart your development server:
   ```
   npm run dev
   ```
2. Navigate to your test page: `http://localhost:3000/test-auth.html`
3. Click "Login as Test User"
4. Click "Connect Gmail"
5. You should be redirected to Google's OAuth consent screen without errors

## Troubleshooting

### Invalid Client Error

If you see "Error 401: invalid_client":
- Double-check your client ID and secret are correctly copied to `.env.local`
- Verify the OAuth client is created as a "Web application" type
- Make sure the redirect URI in Google Cloud Console exactly matches what's in your code

### Redirect URI Mismatch

If you see "Error 400: redirect_uri_mismatch":
- Make sure the redirect URI in Google Cloud Console exactly matches your application's redirect URI
- Check for trailing slashes, protocol (http vs https), and port numbers

### Scope Issues

If you see permission errors:
- Make sure you've added the required scopes to the OAuth consent screen
- You might need to delete any existing tokens and re-authenticate

### Publishing Your App

When ready for production:
- Add your production URLs to the authorized origins and redirect URIs
- If needed, submit your OAuth consent screen for verification to remove the "unverified app" warning 