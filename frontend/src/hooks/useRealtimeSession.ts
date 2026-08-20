import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  ChatMessageItem,
  ConnectionState,
  UserPreferences,
} from '../types/realtime.js';
import { AudioPlaybackManager } from '../services/AudioPlaybackManager.js';

export const DEFAULT_PREFERENCES: UserPreferences = {
  model: 'inworld/models/deepseek-v4-flash',
  ttsModel: 'inworld-tts-2',
  voiceId: 'zippy-kite-2028__mukesh_sharma_voice', // Custom Voice "Mukesh Sharma"
  voiceSpeed: 1.0,
  language: 'auto',
  systemInstructions:
    'You are an articulate, friendly, and helpful native Hindi and English voice assistant. Understand and respond naturally in the user\'s preferred language (Hindi, Hinglish, English). Be conversational, clear, helpful, and natural. Keep your answers balanced and conversational without being overly verbose. When writing in Hindi (Devanagari script) or Hinglish, always maintain 100% accurate grammar, correct matras (मात्राएँ), and natural phrasing.',
  outputModality: 'text_audio',
  autoPlayAudio: true,
};

export function useRealtimeSession() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioManagerRef = useRef<AudioPlaybackManager | null>(null);
  const activeMessageIdRef = useRef<string | null>(null);
  const isStoppedRef = useRef<boolean>(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const isManuallyClosedRef = useRef<boolean>(false);

  // Initialize AudioPlaybackManager
  useEffect(() => {
    const manager = new AudioPlaybackManager({
      pcmSampleRate: 24000,
      onPlaybackStateChange: (playing) => {
        setIsSpeaking(playing);
        // If speaking finished and active message is in 'speaking' state, update it to 'completed'
        if (!playing && activeMessageIdRef.current) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === activeMessageIdRef.current && msg.status === 'speaking'
                ? { ...msg, status: 'completed' }
                : msg
            )
          );
        }
      },
    });
    audioManagerRef.current = manager;

    return () => {
      manager.stop();
    };
  }, []);

  // Connect to WebSocket proxy
  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setConnectionState((prev) => (prev === 'disconnected' ? 'connecting' : 'reconnecting'));
    setErrorMessage(null);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // If in dev mode on port 5173, connect directly to backend port 4000 to avoid proxy conflicts
    const hostname = window.location.hostname || 'localhost';
    const port = window.location.port === '5173' ? '4000' : window.location.port;
    const host = port ? `${hostname}:${port}` : hostname;
    const wsUrl = `${protocol}//${host}/ws`;

    console.log(`[useRealtimeSession] Connecting to ${wsUrl}...`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[useRealtimeSession] WebSocket connected');
      setConnectionState('connected');
      setErrorMessage(null);
      reconnectAttemptsRef.current = 0;

      // Send initial preferences to configure session with custom voice & multilingual prompt
      const outputModalities =
        preferences.outputModality === 'text_only'
          ? ['text']
          : preferences.outputModality === 'voice_only'
          ? ['audio']
          : ['text', 'audio'];

      ws.send(
        JSON.stringify({
          type: 'session.update',
          session: {
            type: 'realtime',
            model: preferences.model,
            instructions: preferences.systemInstructions,
            output_modalities: outputModalities,
            audio: {
              output: {
                voice: preferences.voiceId,
                model: preferences.ttsModel,
                speed: preferences.voiceSpeed,
              },
            },
            providerData: {
              tts: {
                language: preferences.language === 'auto' ? undefined : preferences.language,
                delivery_mode: 'BALANCED',
              },
            },
          },
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        handleServerEvent(payload);
      } catch (err) {
        console.error('[useRealtimeSession] Failed to parse event:', err);
      }
    };

    ws.onclose = (e) => {
      console.log(`[useRealtimeSession] WebSocket closed (code: ${e.code})`);
      setConnectionState('disconnected');

      if (!isManuallyClosedRef.current) {
        // Automatic exponential backoff reconnection
        const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 15000);
        reconnectAttemptsRef.current += 1;
        console.log(`[useRealtimeSession] Scheduling reconnect attempt #${reconnectAttemptsRef.current} in ${delay}ms`);

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    };

    ws.onerror = (err) => {
      console.error('[useRealtimeSession] WebSocket error:', err);
      setConnectionState('error');
      setErrorMessage('Connection to Voice Agent backend failed. Retrying...');
    };
  }, [preferences]);

  // Handle incoming Inworld events
  const handleServerEvent = useCallback((event: Record<string, unknown>) => {
    const type = event.type as string;

    switch (type) {
      case 'session.created':
        console.log('[Inworld] Session created:', event);
        break;

      case 'session.updated':
        console.log('[Inworld] Session updated successfully');
        break;

      case 'response.created': {
        if (isStoppedRef.current) break;
        setIsGenerating(true);
        break;
      }

      case 'response.output_text.delta': {
        if (isStoppedRef.current) break;
        const delta = (event.delta as string) || '';
        const currentActiveId = activeMessageIdRef.current;
        if (currentActiveId && delta) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === currentActiveId
                ? { ...msg, text: msg.text + delta, status: 'generating' }
                : msg
            )
          );
        }
        break;
      }

      case 'response.output_audio.delta': {
        if (isStoppedRef.current) break;
        const audioDelta = (event.delta as string) || '';
        const currentActiveId = activeMessageIdRef.current;
        if (audioDelta && currentActiveId) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === currentActiveId
                ? {
                    ...msg,
                    audioChunks: [...msg.audioChunks, audioDelta],
                    status: 'speaking',
                  }
                : msg
            )
          );

          // Stream chunk to AudioPlaybackManager
          if (preferences.autoPlayAudio && !isAudioMuted && audioManagerRef.current && !isStoppedRef.current) {
            audioManagerRef.current.enqueueBase64Chunk(audioDelta);
          }
        }
        break;
      }

      case 'response.output_audio_transcript.delta': {
        if (isStoppedRef.current) break;
        const delta = (event.delta as string) || '';
        const currentActiveId = activeMessageIdRef.current;
        if (currentActiveId && delta) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === currentActiveId
                ? { ...msg, text: msg.text + delta }
                : msg
            )
          );
        }
        break;
      }

      case 'response.done': {
        setIsGenerating(false);
        const resp = event.response as {
          status?: string;
          output?: Array<{
            content?: Array<{
              text?: string;
              transcript?: string;
            }>;
          }>;
          usage?: {
            total_tokens?: number;
            input_tokens?: number;
            output_tokens?: number;
            tts?: { audio_seconds?: number; model?: string };
            llm?: { model?: string };
          };
        };

        // Extract canonical full text if provided by Inworld response object
        const canonicalText =
          resp?.output?.[0]?.content?.[0]?.text ||
          resp?.output?.[0]?.content?.[0]?.transcript ||
          resp?.output?.[0]?.content?.[1]?.transcript;

        const currentActiveId = activeMessageIdRef.current;
        if (currentActiveId) {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === currentActiveId) {
                const isStillPlaying = audioManagerRef.current?.getIsPlaying();
                return {
                  ...msg,
                  text: canonicalText && canonicalText.length >= msg.text.length ? canonicalText : msg.text,
                  status: resp?.status === 'cancelled' ? 'stopped' : isStillPlaying ? 'speaking' : 'completed',
                  usage: {
                    totalTokens: resp?.usage?.total_tokens,
                    inputTokens: resp?.usage?.input_tokens,
                    outputTokens: resp?.usage?.output_tokens,
                    audioSeconds: resp?.usage?.tts?.audio_seconds,
                    llmModel: resp?.usage?.llm?.model,
                    ttsModel: resp?.usage?.tts?.model,
                  },
                };
              }
              return msg;
            })
          );
        }
        break;
      }

      case 'error': {
        const error = event.error as { message?: string; type?: string; code?: string; param?: string };
        const msg = error?.message || 'An unknown error occurred with Inworld Realtime API.';
        console.error('[Inworld] Realtime error:', error);
        setErrorMessage(msg);
        setIsGenerating(false);

        if (activeMessageIdRef.current) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === activeMessageIdRef.current
                ? { ...m, status: 'error', errorMessage: msg }
                : m
            )
          );
        }
        break;
      }

      default:
        // Handle unhandled events gracefully
        break;
    }
  }, [preferences.autoPlayAudio, isAudioMuted]);

  // Connect on mount
  useEffect(() => {
    isManuallyClosedRef.current = false;
    connect();

    return () => {
      isManuallyClosedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Send a user message
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // === AUTO-INTERRUPT / BARGE-IN ===
      // If AI was generating or speaking, immediately cancel previous response and cut off audio
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(
            JSON.stringify({
              type: 'response.cancel',
            })
          );
        } catch (err) {
          console.warn('[useRealtimeSession] Error sending cancel event on barge-in:', err);
        }
      }

      // Immediately silence any ongoing or scheduled audio
      if (audioManagerRef.current) {
        audioManagerRef.current.stop();
        await audioManagerRef.current.ensureContext();
      }

      // Mark previously active assistant message as stopped/completed
      if (activeMessageIdRef.current) {
        const prevActiveId = activeMessageIdRef.current;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === prevActiveId && (msg.status === 'generating' || msg.status === 'speaking')
              ? { ...msg, status: 'stopped' }
              : msg
          )
        );
      }

      const userMsgId = `user-${Date.now()}`;
      const assistantMsgId = `assistant-${Date.now() + 1}`;
      activeMessageIdRef.current = assistantMsgId;
      isStoppedRef.current = false;

      const userMessage: ChatMessageItem = {
        id: userMsgId,
        role: 'user',
        text: trimmed,
        audioChunks: [],
        status: 'completed',
        timestamp: Date.now(),
      };

      const assistantMessage: ChatMessageItem = {
        id: assistantMsgId,
        role: 'assistant',
        text: '',
        audioChunks: [],
        status: 'generating',
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsGenerating(true);
      setIsSpeaking(false);
      setErrorMessage(null);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        // 1. Create conversation item
        wsRef.current.send(
          JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: trimmed,
                },
              ],
            },
          })
        );

        // 2. Trigger assistant response
        const outputModalities =
          preferences.outputModality === 'text_only'
            ? ['text']
            : preferences.outputModality === 'voice_only'
            ? ['audio']
            : ['text', 'audio'];

        wsRef.current.send(
          JSON.stringify({
            type: 'response.create',
            response: {
              output_modalities: outputModalities,
            },
          })
        );
      } else {
        setErrorMessage('Cannot send message: Not connected to Voice Agent backend.');
        setIsGenerating(false);
      }
    },
    [preferences.outputModality]
  );

  // Stop / cancel active response
  const stopResponse = useCallback(() => {
    isStoppedRef.current = true;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'response.cancel',
        })
      );
    }

    if (audioManagerRef.current) {
      audioManagerRef.current.stop();
    }

    setIsGenerating(false);
    setIsSpeaking(false);

    if (activeMessageIdRef.current) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === activeMessageIdRef.current
            ? { ...msg, status: 'stopped' }
            : msg
        )
      );
      activeMessageIdRef.current = null;
    }
  }, []);

  // Replay message audio
  const replayMessageAudio = useCallback(async (messageId: string) => {
    const target = messages.find((m) => m.id === messageId);
    if (!target || target.audioChunks.length === 0 || !audioManagerRef.current) return;

    isStoppedRef.current = false;
    // Stop current audio if playing
    audioManagerRef.current.stop();

    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, status: 'speaking' } : m))
    );

    await audioManagerRef.current.replayChunks(target.audioChunks, () => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: 'completed' } : m))
      );
    });
  }, [messages]);

  // Update preferences & sync to session
  const updatePreferences = useCallback((newPrefs: Partial<UserPreferences>) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...newPrefs };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const outputModalities =
          updated.outputModality === 'text_only'
            ? ['text']
            : updated.outputModality === 'voice_only'
            ? ['audio']
            : ['text', 'audio'];

        wsRef.current.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              type: 'realtime',
              model: updated.model,
              instructions: updated.systemInstructions,
              output_modalities: outputModalities,
              audio: {
                output: {
                  voice: updated.voiceId,
                  model: updated.ttsModel,
                  speed: updated.voiceSpeed,
                },
              },
              providerData: {
                tts: {
                  language: updated.language === 'auto' ? undefined : updated.language,
                  delivery_mode: 'BALANCED',
                },
              },
            },
          })
        );
      }

      return updated;
    });
  }, []);

  const toggleMute = useCallback(() => {
    setIsAudioMuted((prev) => {
      const next = !prev;
      audioManagerRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const clearChat = useCallback(() => {
    stopResponse();
    setMessages([]);
  }, [stopResponse]);

  return {
    connectionState,
    messages,
    isGenerating,
    isSpeaking,
    errorMessage,
    preferences,
    isAudioMuted,
    audioManager: audioManagerRef.current,
    sendMessage,
    stopResponse,
    replayMessageAudio,
    updatePreferences,
    toggleMute,
    clearChat,
    reconnect: connect,
  };
}
