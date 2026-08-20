/**
 * Frontend Type Definitions
 */

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export type MessageStatus =
  | 'generating'
  | 'speaking'
  | 'completed'
  | 'stopped'
  | 'error';

export interface MessageUsage {
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  audioSeconds?: number;
  llmModel?: string;
  ttsModel?: string;
}

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  audioChunks: string[]; // Array of base64 PCM16 chunks
  status: MessageStatus;
  timestamp: number;
  usage?: MessageUsage;
  errorMessage?: string;
  durationMs?: number;
}

export interface UserPreferences {
  model: string;
  ttsModel: string;
  voiceId: string;
  voiceSpeed: number;
  language: string; // 'auto' | 'en' | 'hi' | 'es' | 'fr' | etc.
  outputModality: 'text_audio' | 'text_only' | 'voice_only';
  systemInstructions: string;
  autoPlayAudio: boolean;
}

export interface InworldModelOption {
  id: string;
  name: string;
  provider: string;
}

export interface InworldTtsOption {
  id: string;
  name: string;
}
