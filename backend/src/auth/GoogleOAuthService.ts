import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { config } from '../config/env.js';
import { TokenStorage } from './TokenStorage.js';

export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

export class GoogleOAuthService {
  private static instance: GoogleOAuthService;
  private tokenStorage: TokenStorage;

  private constructor() {
    this.tokenStorage = TokenStorage.getInstance();
  }

  public static getInstance(): GoogleOAuthService {
    if (!GoogleOAuthService.instance) {
      GoogleOAuthService.instance = new GoogleOAuthService();
    }
    return GoogleOAuthService.instance;
  }

  public createOAuthClient(): OAuth2Client {
    const oauth2Client = new google.auth.OAuth2(
      config.googleClientId,
      config.googleClientSecret,
      config.googleRedirectUri
    );

    // Auto-update storage when Google library refreshes access token
    oauth2Client.on('tokens', (tokens) => {
      console.log('[GoogleOAuthService] Access tokens refreshed automatically by Google SDK');
      this.tokenStorage.saveTokens(tokens);
    });

    return oauth2Client;
  }

  /**
   * Generates authorization URL for Google OAuth consent screen
   */
  public getAuthUrl(): string {
    if (!config.googleClientId || !config.googleClientSecret) {
      throw new Error(
        'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing. Please configure them in .env'
      );
    }

    const oauth2Client = this.createOAuthClient();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline', // Requests refresh_token
      prompt: 'consent',     // Forces consent to ensure refresh_token is returned
      scope: CALENDAR_SCOPES,
    });
  }

  /**
   * Exchanges authorization code for access & refresh tokens
   */
  public async handleAuthCallback(code: string): Promise<{ email?: string; success: boolean }> {
    const oauth2Client = this.createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Fetch user email for display in UI
    let email: string | undefined;
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      email = userInfo.data.email || undefined;
    } catch (err) {
      console.warn('[GoogleOAuthService] Could not fetch user email info:', err);
    }

    this.tokenStorage.saveTokens({
      ...tokens,
      email,
      defaultCalendarId: 'primary',
    });

    console.log(`[GoogleOAuthService] Successfully authenticated Google Calendar for: ${email || 'user'}`);
    return { email, success: true };
  }

  /**
   * Returns authenticated OAuth2Client ready for Calendar API requests
   */
  public async getAuthenticatedClient(): Promise<OAuth2Client | null> {
    const stored = this.tokenStorage.getTokens();
    if (!stored || (!stored.access_token && !stored.refresh_token)) {
      return null;
    }

    const oauth2Client = this.createOAuthClient();
    oauth2Client.setCredentials({
      access_token: stored.access_token || undefined,
      refresh_token: stored.refresh_token || undefined,
      scope: stored.scope || undefined,
      token_type: stored.token_type || undefined,
      expiry_date: stored.expiry_date || undefined,
    });

    return oauth2Client;
  }

  /**
   * Checks current connection status
   */
  public getConnectionStatus(): {
    connected: boolean;
    email?: string;
    defaultCalendarId?: string;
    isConfigured: boolean;
  } {
    const isConfigured = !!(config.googleClientId && config.googleClientSecret);
    const stored = this.tokenStorage.getTokens();
    const connected = !!(stored && (stored.access_token || stored.refresh_token));

    return {
      connected,
      email: stored?.email,
      defaultCalendarId: stored?.defaultCalendarId || 'primary',
      isConfigured,
    };
  }

  /**
   * Disconnects Google Calendar and revokes tokens
   */
  public async disconnect(): Promise<void> {
    try {
      const stored = this.tokenStorage.getTokens();
      if (stored?.access_token) {
        const client = this.createOAuthClient();
        await client.revokeToken(stored.access_token).catch(() => {});
      }
    } catch (err) {
      console.warn('[GoogleOAuthService] Token revocation note:', err);
    } finally {
      this.tokenStorage.clearTokens();
    }
  }

  /**
   * Updates default calendar preference
   */
  public setDefaultCalendar(calendarId: string): void {
    this.tokenStorage.saveTokens({ defaultCalendarId: calendarId });
  }
}
