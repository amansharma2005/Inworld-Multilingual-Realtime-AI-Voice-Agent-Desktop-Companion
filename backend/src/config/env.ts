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
}

export const config: AppConfig = {
  inworldApiKey: process.env.INWORLD_API_KEY || '',
  inworldVoiceId: process.env.INWORLD_VOICE_ID || 'zippy-kite-2028__mukesh_sharma_voice',
  inworldModel: process.env.INWORLD_MODEL || 'inworld/models/deepseek-v4-flash',
  inworldTtsModel: process.env.INWORLD_TTS_MODEL || 'inworld-tts-2',
  port: parseInt(process.env.PORT || '4000', 10),
  inworldWsBaseUrl: process.env.INWORLD_WS_BASE_URL || 'wss://api.inworld.ai/api/v1/realtime/session',
};

export function validateConfig(): { valid: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!config.inworldApiKey) {
    errors.push(
      'INWORLD_API_KEY is not set. Please obtain your API key from https://platform.inworld.ai/ and configure it in your .env file.'
    );
  }

  if (config.inworldVoiceId === 'zippy-kite-2028__design-voice-7eea8ae2') {
    // Configured for custom voice
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}
