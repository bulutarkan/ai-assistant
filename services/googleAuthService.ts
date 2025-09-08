export class GoogleAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private scope: string = 'https://www.googleapis.com/auth/webmasters.readonly';
  private authUrl: string = 'https://accounts.google.com/o/oauth2/v2/auth';

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }

  // Generate OAuth URL for authorization
  generateAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scope,
      response_type: 'code',
      access_type: 'offline', // To get refresh token
      prompt: 'consent' // Force consent screen to get refresh token
    });

    return `${this.authUrl}?${params.toString()}`;
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: this.redirectUri,
        }),
      });

      if (!response.ok) {
        throw new Error(`OAuth token exchange failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`OAuth error: ${data.error}`);
      }

      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      };
    } catch (error) {
      console.error('Token exchange error:', error);
      throw error;
    }
  }

  // Refresh access token using refresh token
  async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    expires_in: number;
  }> {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`OAuth error: ${data.error}`);
      }

      return {
        access_token: data.access_token,
        expires_in: data.expires_in,
      };
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }

  // Get stored tokens
  getStoredTokens(): { accessToken: string; refreshToken: string; expiry: number } | null {
    try {
      const tokens = localStorage.getItem('googleAuthTokens');
      return tokens ? JSON.parse(tokens) : null;
    } catch (error) {
      console.error('Error reading stored tokens:', error);
      return null;
    }
  }

  // Store tokens
  storeTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
    const expiry = Date.now() + (expiresIn * 1000); // Convert to milliseconds
    const tokens = {
      accessToken,
      refreshToken,
      expiry
    };
    localStorage.setItem('googleAuthTokens', JSON.stringify(tokens));
    // Also set the token in the format expected by SearchConsoleService
    localStorage.setItem('searchConsoleToken', accessToken);
  }

  // Clear tokens
  clearTokens(): void {
    localStorage.removeItem('googleAuthTokens');
    localStorage.removeItem('searchConsoleToken');
  }

  // Check if current token is valid
  isAuthenticated(): boolean {
    const tokens = this.getStoredTokens();
    if (!tokens) return false;

    // Add 5-minute buffer before expiry
    return Date.now() < (tokens.expiry - 5 * 60 * 1000);
  }

  // Ensure valid token (refresh if needed)
  async ensureValidToken(): Promise<string> {
    const tokens = this.getStoredTokens();

    if (!tokens) {
      throw new Error('No stored tokens found');
    }

    // If token is still valid (with buffer)
    if (Date.now() < (tokens.expiry - 5 * 60 * 1000)) {
      return tokens.accessToken;
    }

    // Try to refresh token
    try {
      const newTokens = await this.refreshAccessToken(tokens.refreshToken);
      this.storeTokens(newTokens.access_token, tokens.refreshToken, newTokens.expires_in);
      return newTokens.access_token;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      this.clearTokens();
      throw new Error('Authentication expired. Please re-authenticate.');
    }
  }
}

// Factory function to create GoogleAuthService with environment variables
export function createGoogleAuthService(): GoogleAuthService {
  // Debug logging
  console.log('🔍 Loading Google OAuth credentials...');
  console.log('Available env vars:', {
    VITE_CLIENT_ID: !!import.meta.env.VITE_SEARCH_CONSOLE_CLIENT_ID,
    VITE_CLIENT_SECRET: !!import.meta.env.VITE_SEARCH_CONSOLE_CLIENT_SECRET,
    VITE_REDIRECT_URI: !!import.meta.env.VITE_SEARCH_CONSOLE_REDIRECT_URI,
  });

  const clientId = import.meta.env.VITE_SEARCH_CONSOLE_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_SEARCH_CONSOLE_CLIENT_SECRET;
  const redirectUri = import.meta.env.VITE_SEARCH_CONSOLE_REDIRECT_URI;

  console.log('Credential values:', {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    hasRedirectUri: !!redirectUri,
    clientIdStart: clientId ? clientId.substring(0, 20) + '...' : 'undefined',
  });

  if (!clientId) {
    throw new Error('VITE_SEARCH_CONSOLE_CLIENT_ID is missing. Check your .env file and restart the dev server.');
  }
  if (!clientSecret) {
    throw new Error('VITE_SEARCH_CONSOLE_CLIENT_SECRET is missing. Check your .env file and restart the dev server.');
  }
  if (!redirectUri) {
    throw new Error('VITE_SEARCH_CONSOLE_REDIRECT_URI is missing. Check your .env file and restart the dev server.');
  }

  console.log('✅ Google OAuth credentials loaded successfully');
  return new GoogleAuthService(clientId, clientSecret, redirectUri);
}
