import { WebSocket } from 'ws';
import { config } from '../config/env.js';
import type { SessionConfig, ServerEvent, ClientEvent } from '../types/inworld.js';

export interface InworldProxyOptions {
  browserWs: WebSocket;
  sessionId?: string;
  initialConfig?: Partial<SessionConfig>;
}

export class InworldProxySession {
  private browserWs: WebSocket;
  private inworldWs: WebSocket | null = null;
  private sessionId: string;
  private isConfigured = false;
  private customConfig: Partial<SessionConfig>;
  private isClosed = false;

  constructor(options: InworldProxyOptions) {
    this.browserWs = options.browserWs;
    this.sessionId = options.sessionId || `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.customConfig = options.initialConfig || {};

    this.init();
  }

  private getAuthHeader(): string {
    const rawKey = config.inworldApiKey.trim();
    if (!rawKey) {
      return '';
    }

    // Inworld keys are Base64 encoded. If the key already looks base64-encoded (or has no colon),
    // use directly, otherwise encode if in key:secret format.
    if (rawKey.includes(':')) {
      const encoded = Buffer.from(rawKey).toString('base64');
      return `Basic ${encoded}`;
    }
    return `Basic ${rawKey}`;
  }

  private getDefaultSessionConfig(): SessionConfig {
    return {
      type: 'realtime',
      model: this.customConfig.model || config.inworldModel,
      instructions:
        this.customConfig.instructions ||
        `You are an articulate, friendly, and helpful native Hindi and English voice assistant.
Understand and respond naturally in the user's preferred language (Hindi, Hinglish, English).
Be conversational, clear, helpful, and natural. Keep your answers balanced and conversational — informative without being overly verbose or artificial.
When writing in Hindi (Devanagari script) or Hinglish, always maintain 100% accurate grammar, correct matras (मात्राएँ), and natural phrasing.`,
      output_modalities: this.customConfig.output_modalities || ['text', 'audio'],
      audio: {
        input: {
          format: { type: 'audio/pcm', rate: 24000 },
          transcription: {
            model: 'inworld/inworld-stt-1',
          },
          turn_detection: {
            type: 'semantic_vad',
            eagerness: 'medium',
            create_response: true,
            interrupt_response: true,
          },
        },
        output: {
          format: { type: 'audio/pcm', rate: 24000 },
          voice: this.customConfig.audio?.output?.voice || config.inworldVoiceId,
          model: this.customConfig.audio?.output?.model || config.inworldTtsModel,
          speed: this.customConfig.audio?.output?.speed ?? 1.0,
        },
      },
      providerData: {
        tts: {
          segmenter_strategy: 'sentence',
          delivery_mode: 'BALANCED',
          language: this.customConfig.providerData?.tts?.language || undefined,
        },
        memory: {
          enabled: true,
        },
      },
    };
  }

  private init() {
    const authHeader = this.getAuthHeader();

    if (!authHeader) {
      const errorEvent: ServerEvent = {
        type: 'error',
        error: {
          type: 'authentication_error',
          code: 'missing_api_key',
          message: 'INWORLD_API_KEY is not configured on the backend. Please check your .env configuration.',
        },
      };
      this.sendToBrowser(errorEvent);
      return;
    }

    const inworldUrl = `${config.inworldWsBaseUrl}?key=${encodeURIComponent(this.sessionId)}&protocol=realtime`;
    console.log(`[InworldProxy] Connecting session ${this.sessionId} to Inworld Realtime API...`);

    try {
      this.inworldWs = new WebSocket(inworldUrl, {
        headers: {
          Authorization: authHeader,
        },
      });

      this.setupInworldHandlers();
      this.setupBrowserHandlers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[InworldProxy] Connection initialization error:', message);
      this.sendToBrowser({
        type: 'error',
        error: {
          type: 'connection_error',
          message: `Failed to connect to Inworld Realtime API: ${message}`,
        },
      });
    }
  }

  private setupInworldHandlers() {
    if (!this.inworldWs) return;

    this.inworldWs.on('open', () => {
      console.log(`[InworldProxy] Connected upstream to Inworld Realtime for session ${this.sessionId}`);
    });

    this.inworldWs.on('message', (data: Buffer | string) => {
      try {
        const rawString = typeof data === 'string' ? data : data.toString('utf-8');
        const event: ServerEvent = JSON.parse(rawString);

        if (event.type === 'session.created') {
          console.log(`[InworldProxy] Upstream session created:`, (event as { session?: { id?: string } }).session?.id);
          // Send initial session.update with our custom voice and multilingual prompt
          const sessionUpdatePayload = {
            type: 'session.update',
            session: this.getDefaultSessionConfig(),
          };
          this.sendToInworld(sessionUpdatePayload);
          this.isConfigured = true;
        } else if (event.type === 'session.updated') {
          console.log(`[InworldProxy] Session configuration confirmed by Inworld`);
        } else if (event.type === 'error') {
          const err = (event as { error?: { message?: string; type?: string; code?: string; param?: string } }).error;
          console.error(`[InworldProxy] Upstream error:`, err?.type, err?.code, err?.message, err?.param);
        }

        // Forward event to browser
        this.sendToBrowser(event);
      } catch (err) {
        console.error('[InworldProxy] Error parsing upstream message:', err);
      }
    });

    this.inworldWs.on('close', (code, reason) => {
      console.log(`[InworldProxy] Inworld connection closed (code: ${code}, reason: ${reason.toString()})`);
      if (!this.isClosed && this.browserWs.readyState === WebSocket.OPEN) {
        this.sendToBrowser({
          type: 'error',
          error: {
            type: 'upstream_closed',
            message: `Inworld Realtime connection closed (Code: ${code})`,
          },
        });
      }
    });

    this.inworldWs.on('error', (err) => {
      console.error(`[InworldProxy] Inworld WebSocket error:`, err.message);
      this.sendToBrowser({
        type: 'error',
        error: {
          type: 'upstream_error',
          message: `Inworld connection error: ${err.message}`,
        },
      });
    });
  }

  private setupBrowserHandlers() {
    this.browserWs.on('message', (data: Buffer | string) => {
      try {
        const rawString = typeof data === 'string' ? data : data.toString('utf-8');
        const clientEvent: ClientEvent = JSON.parse(rawString);

        if (clientEvent.type === 'session.update') {
          // Merge custom config updates
          this.customConfig = {
            ...this.customConfig,
            ...clientEvent.session,
          };
          console.log(`[InworldProxy] Updating session configuration with client preferences`);
          this.sendToInworld(clientEvent);
        } else if (clientEvent.type === 'conversation.item.create') {
          console.log(`[InworldProxy] User message received, forwarding to Inworld`);
          this.sendToInworld(clientEvent);
        } else if (clientEvent.type === 'response.create') {
          console.log(`[InworldProxy] Triggering assistant response`);
          this.sendToInworld(clientEvent);
        } else if (clientEvent.type === 'response.cancel') {
          console.log(`[InworldProxy] Cancelling active response`);
          this.sendToInworld(clientEvent);
        } else {
          // Pass-through any other client events (e.g. input_audio_buffer.append)
          this.sendToInworld(clientEvent);
        }
      } catch (err) {
        console.error('[InworldProxy] Error processing client message:', err);
      }
    });

    this.browserWs.on('close', () => {
      console.log(`[InworldProxy] Browser client disconnected for session ${this.sessionId}`);
      this.cleanup();
    });

    this.browserWs.on('error', (err) => {
      console.error(`[InworldProxy] Browser client error:`, err.message);
      this.cleanup();
    });
  }

  public sendToInworld(event: unknown) {
    if (this.inworldWs && this.inworldWs.readyState === WebSocket.OPEN) {
      this.inworldWs.send(JSON.stringify(event));
    } else {
      console.warn(`[InworldProxy] Cannot send to Inworld; connection state: ${this.inworldWs?.readyState}`);
    }
  }

  public sendToBrowser(event: unknown) {
    if (this.browserWs && this.browserWs.readyState === WebSocket.OPEN) {
      this.browserWs.send(JSON.stringify(event));
    }
  }

  public cleanup() {
    this.isClosed = true;
    if (this.inworldWs) {
      if (this.inworldWs.readyState === WebSocket.OPEN || this.inworldWs.readyState === WebSocket.CONNECTING) {
        this.inworldWs.close();
      }
      this.inworldWs = null;
    }
  }
}
