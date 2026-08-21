import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from root or backend directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface AppConfig {
  inworldApiKey: string;
  inworldVoiceId: string;
  inworldModel: string;
  inworldTtsModel: string;
  port: number;
  inworldWsBaseUrl: string;
  // Google Calendar OAuth & Token Security
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  googleTokenEncryptionKey: string;
  frontendUrl: string;
}

export const config: AppConfig = {
  inworldApiKey: process.env.INWORLD_API_KEY || '',
  inworldVoiceId: process.env.INWORLD_VOICE_ID || 'zippy-kite-2028__design-voice-7eea8ae2',
  inworldModel: process.env.INWORLD_MODEL || 'inworld/models/deepseek-v4-flash',
  inworldTtsModel: process.env.INWORLD_TTS_MODEL || 'inworld-tts-2',
  port: parseInt(process.env.PORT || '4000', 10),
  inworldWsBaseUrl: process.env.INWORLD_WS_BASE_URL || 'wss://api.inworld.ai/api/v1/realtime/session',
  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/auth/google/callback',
  googleTokenEncryptionKey: process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || 'inworld-voice-agent-encryption-32-chars!!',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};

export function validateConfig(): { valid: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!config.inworldApiKey) {
    errors.push(
      'INWORLD_API_KEY is not set. Please obtain your API key from https://platform.inworld.ai/ and configure it in your .env file.'
    );
  }

  if (!config.googleClientId || !config.googleClientSecret) {
    warnings.push(
      'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not configured in .env. Google Calendar integration will prompt for setup in Settings.'
    );
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}
