# Gmail OAuth Integration

This document explains how the Gmail OAuth integration is implemented in our application.

## Overview

The Gmail integration allows users to connect their Gmail accounts to our application, enabling the app to send emails on their behalf. This integration uses OAuth 2.0 for authentication and authorization, ensuring secure access to user email accounts without storing their passwords.

## Setup Requirements

### Google Cloud Console Setup

1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Gmail API for your project
3. Configure OAuth consent screen:
   - Set user type (External for testing, Internal for organizational use)
   - Add required scopes:
     - `https://www.googleapis.com/auth/gmail.send` (for sending emails)
     - `https://www.googleapis.com/auth/gmail.readonly` (for reading emails)
   - Add authorized domains including your application domain
4. Create OAuth credentials:
   - Create an OAuth 2.0 Client ID
   - Add authorized JavaScript origins (e.g., `http://localhost:3000` for development, `https://your-domain.com` for production)
   - Add authorized redirect URIs:
     - `http://localhost:3000/api/email-gmail/oauth-callback` (for development)
     - `https://your-domain.com/api/email-gmail/oauth-callback` (for production)

### Environment Variables

Add the following environment variables to your `.env.local` file:

```
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REDIRECT=http://localhost:3000/api/email-gmail/oauth-callback
```

For production, update the `GOOGLE_OAUTH_REDIRECT` to use your production domain.

## Architecture

The Gmail integration consists of several components:

### 1. Database Schema

The user schema includes fields for storing Gmail tokens:

- `gmailAccessToken`: Stores the access token for Gmail API access
- `gmailRefreshToken`: Stores the refresh token to obtain new access tokens

### 2. API Routes

- `/api/email-gmail`: Initiates the OAuth flow
- `/api/email-gmail/oauth-callback`: Handles the OAuth callback after user authentication

### 3. Utility Functions

The `lib/gmail.ts` file contains utility functions for:

- Configuring the OAuth client
- Creating Gmail API clients
- Handling token refreshes
- Sending emails

### 4. Frontend Components

- `GmailConnect`: A component that allows users to connect/disconnect their Gmail accounts

## Authentication Flow

1. **Initiation**: 
   - User clicks "Connect Gmail" in the UI
   - Frontend makes a request to `/api/email-gmail`
   - Backend generates an authorization URL with appropriate scopes and redirects the user

2. **Authorization**:
   - User logs in to their Google account and grants permissions
   - Google redirects back to our callback URL with an authorization code

3. **Token Exchange**:
   - Backend exchanges the authorization code for access and refresh tokens
   - Tokens are stored in the database associated with the user's account

4. **Token Refresh**:
   - Access tokens expire after a set period (usually 1 hour)
   - When an access token expires, the refresh token is used to obtain a new one
   - The new access token is updated in the database

## Sending Emails

1. A Gmail client is created using the stored tokens
2. Email content is encoded in base64url format
3. The Gmail API's `users.messages.send` method is called to send the email

## Testing

The integration includes comprehensive tests in `lib/gmail-tests.ts`. These tests verify:

1. OAuth flow initiation
2. OAuth callback handling
3. Token exchange and storage
4. Gmail client creation
5. Email sending
6. Connection status checks
7. Gmail disconnection

To run the tests:

```bash
npm run test:gmail
```

## Troubleshooting

### Common Issues

1. **OAuth Error: invalid_request**: Check that your redirect URI exactly matches what's configured in Google Cloud Console.

2. **OAuth Error: access_denied**: The user denied permission or the scopes requested are not approved in the OAuth consent screen.

3. **Token Refresh Failures**: Ensure refresh tokens are being properly stored and that the OAuth client is correctly configured.

4. **Connection Issues After Deployment**: Verify that the `GOOGLE_OAUTH_REDIRECT` is updated to use the production domain.

### Debugging

1. Check the API route logs for detailed error information
2. Verify that tokens are being stored correctly in the database
3. Ensure the Gmail API is enabled in Google Cloud Console
4. Confirm that the OAuth consent screen is properly configured

## Security Considerations

1. Tokens are stored securely in the database
2. Access to email functionality is permission-based
3. Only the minimum required scopes are requested
4. Tokens can be revoked by the user at any time through Google's security settings
5. The application implements token refresh handling to maintain continuous access 