/**
 * Inworld Realtime API Protocol Event Types
 * Based on official Inworld Realtime API AsyncAPI specifications
 */

export interface SessionAudioFormat {
  type: 'audio/pcm' | 'audio/pcmu' | 'audio/pcma' | 'audio/float32';
  rate?: number;
}

export interface SessionConfig {
  type?: 'realtime';
  model?: string;
  instructions?: string;
  output_modalities?: Array<'text' | 'audio'>;
  temperature?: number;
  max_output_tokens?: number | 'inf';
  audio?: {
    input?: {
      format?: SessionAudioFormat;
      transcription?: {
        model?: string;
        language?: string;
        prompt?: string;
      };
      turn_detection?: {
        type?: 'semantic_vad' | 'server_vad';
        eagerness?: 'low' | 'medium' | 'high' | 'auto';
        threshold?: number;
        prefix_padding_ms?: number;
        silence_duration_ms?: number;
        create_response?: boolean;
        interrupt_response?: boolean;
      };
    };
    output?: {
      format?: SessionAudioFormat;
      voice?: string;
      model?: string;
      speed?: number;
    };
  };
  providerData?: {
    tts?: {
      segmenter_strategy?: 'sentence' | 'paragraph' | 'smart';
      steering_handling?: 'emit_once' | 'strip';
      language?: string;
      delivery_mode?: 'STABLE' | 'BALANCED' | 'EXPRESSIVE' | 'CREATIVE';
      conversational?: boolean;
    };
    stt?: {
      voice_profile?: boolean;
      language_hints?: string[];
      end_of_turn_confidence_threshold?: number;
      min_end_of_turn_silence?: number;
      max_turn_silence?: number;
      vad_threshold?: number;
    };
    memory?: {
      enabled?: boolean;
      turn_interval?: number;
      max_facts?: number;
    };
    backchannel?: {
      enabled?: boolean;
    };
    responsiveness?: {
      enabled?: boolean;
    };
    auto_tool_response?: boolean;
  };
}

export interface ClientEventSessionUpdate {
  type: 'session.update';
  event_id?: string;
  session: SessionConfig;
}

export interface ConversationItemContent {
  type: 'input_text' | 'input_audio' | 'output_text' | 'output_audio';
  text?: string;
  audio?: string; // base64
}

export interface ConversationItem {
  id?: string;
  type: 'message' | 'function_call' | 'function_call_output';
  role: 'user' | 'assistant' | 'tool';
  content: ConversationItemContent[];
}

export interface ClientEventConversationItemCreate {
  type: 'conversation.item.create';
  event_id?: string;
  previous_item_id?: string | null;
  item: ConversationItem;
}

export interface ClientEventResponseCreate {
  type: 'response.create';
  event_id?: string;
  response?: {
    output_modalities?: Array<'text' | 'audio'>;
    instructions?: string;
    metadata?: Record<string, string>;
  };
}

export interface ClientEventResponseCancel {
  type: 'response.cancel';
  event_id?: string;
  response_id?: string;
}

export interface ClientEventInputAudioAppend {
  type: 'input_audio_buffer.append';
  audio: string; // Base64-encoded PCM16
}

export interface ClientEventInputAudioClear {
  type: 'input_audio_buffer.clear';
}

export type ClientEvent =
  | ClientEventSessionUpdate
  | ClientEventConversationItemCreate
  | ClientEventResponseCreate
  | ClientEventResponseCancel
  | ClientEventInputAudioAppend
  | ClientEventInputAudioClear;

// Server Events
export interface ServerEventSessionCreated {
  type: 'session.created';
  session: {
    id: string;
    model?: string;
    output_modalities?: string[];
    [key: string]: unknown;
  };
}

export interface ServerEventSessionUpdated {
  type: 'session.updated';
  session: Record<string, unknown>;
}

export interface ServerEventResponseCreated {
  type: 'response.created';
  response: {
    id: string;
    status: string;
    [key: string]: unknown;
  };
}

export interface ServerEventResponseOutputTextDelta {
  type: 'response.output_text.delta';
  response_id: string;
  output_index: number;
  content_index: number;
  delta: string;
}

export interface ServerEventResponseOutputTextDone {
  type: 'response.output_text.done';
  response_id: string;
  output_index: number;
  content_index: number;
  text: string;
}

export interface ServerEventResponseOutputAudioDelta {
  type: 'response.output_audio.delta';
  response_id: string;
  output_index: number;
  content_index: number;
  delta: string; // Base64 audio PCM16
}

export interface ServerEventResponseOutputAudioDone {
  type: 'response.output_audio.done';
  response_id: string;
  output_index: number;
  content_index: number;
}

export interface ServerEventResponseAudioTranscriptDelta {
  type: 'response.output_audio_transcript.delta';
  response_id: string;
  delta: string;
}

export interface ServerEventResponseAudioTranscriptDone {
  type: 'response.output_audio_transcript.done';
  response_id: string;
  transcript: string;
}

export interface ServerEventResponseDone {
  type: 'response.done';
  response: {
    id: string;
    status: 'completed' | 'cancelled' | 'failed' | 'in_progress';
    status_details?: Record<string, unknown>;
    usage?: {
      total_tokens?: number;
      input_tokens?: number;
      output_tokens?: number;
      llm?: { model?: string };
      tts?: { model?: string; characters?: number; audio_seconds?: number };
      stt?: { model?: string; audio_seconds?: number };
    };
  };
}

export interface ServerEventError {
  type: 'error';
  error: {
    type: string;
    code?: string;
    message: string;
    param?: string;
    event_id?: string;
  };
}

export type ServerEvent =
  | ServerEventSessionCreated
  | ServerEventSessionUpdated
  | ServerEventResponseCreated
  | ServerEventResponseOutputTextDelta
  | ServerEventResponseOutputTextDone
  | ServerEventResponseOutputAudioDelta
  | ServerEventResponseOutputAudioDone
  | ServerEventResponseAudioTranscriptDelta
  | ServerEventResponseAudioTranscriptDone
  | ServerEventResponseDone
  | ServerEventError
  | { type: string; [key: string]: unknown };
