import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_DIR = path.resolve(__dirname, '../../.data');
const TOKEN_FILE = path.join(STORAGE_DIR, 'google_tokens.enc');

export interface StoredTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string | null;
  token_type?: string | null;
  expiry_date?: number | null;
  email?: string;
  defaultCalendarId?: string;
  updatedAt: string;
}

export class TokenStorage {
  private static instance: TokenStorage;
  private key: Buffer;

  private constructor() {
    // Derive 32-byte key from config.googleTokenEncryptionKey
    const rawKey = config.googleTokenEncryptionKey || 'inworld-voice-agent-default-secret-key-32';
    this.key = crypto.createHash('sha256').update(rawKey).digest();

    if (!fs.existsSync(STORAGE_DIR)) {
      try {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
      } catch (err) {
        console.warn('[TokenStorage] Could not create storage directory:', err);
      }
    }
  }

  public static getInstance(): TokenStorage {
    if (!TokenStorage.instance) {
      TokenStorage.instance = new TokenStorage();
    }
    return TokenStorage.instance;
  }

  private encrypt(data: string): string {
    const iv = crypto.randomBytes(12); // 12-byte IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  private decrypt(encryptedPayload: string): string {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted token payload format');
    }
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  public saveTokens(tokens: Partial<StoredTokens>): void {
    try {
      const current = this.getTokens() || { updatedAt: new Date().toISOString() };
      const merged: StoredTokens = {
        ...current,
        ...tokens,
        updatedAt: new Date().toISOString(),
      };
      const json = JSON.stringify(merged);
      const encrypted = this.encrypt(json);
      fs.writeFileSync(TOKEN_FILE, encrypted, 'utf8');
      console.log('[TokenStorage] Tokens safely encrypted and persisted.');
    } catch (err) {
      console.error('[TokenStorage] Failed to save tokens:', err);
      throw err;
    }
  }

  public getTokens(): StoredTokens | null {
    try {
      if (!fs.existsSync(TOKEN_FILE)) {
        return null;
      }
      const encrypted = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
      if (!encrypted) return null;
      const json = this.decrypt(encrypted);
      return JSON.parse(json);
    } catch (err) {
      console.warn('[TokenStorage] Could not read/decrypt stored tokens:', err);
      return null;
    }
  }

  public hasValidTokens(): boolean {
    const tokens = this.getTokens();
    return !!(tokens && (tokens.access_token || tokens.refresh_token));
  }

  public clearTokens(): void {
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        fs.unlinkSync(TOKEN_FILE);
      }
      console.log('[TokenStorage] Stored tokens cleared.');
    } catch (err) {
      console.warn('[TokenStorage] Error clearing tokens:', err);
    }
  }
}
