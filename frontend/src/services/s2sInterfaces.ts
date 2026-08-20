/**
 * Speech-to-Speech Architecture Interfaces
 * Provides clean modular abstractions for future continuous microphone streaming,
 * client-side turn detection, and WebRTC integration without rewriting chat components.
 */

export interface IAudioConfig {
  sampleRate: number;
  channels: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

export interface IMicrophoneManager {
  isSupported(): boolean;
  requestPermission(): Promise<boolean>;
  startCapture(config?: Partial<IAudioConfig>): Promise<MediaStream>;
  stopCapture(): void;
  getStream(): MediaStream | null;
}

export interface IAudioCapture {
  init(stream: MediaStream, onChunkAvailable: (base64Pcm16Chunk: string) => void): Promise<void>;
  start(): void;
  pause(): void;
  stop(): void;
  getSampleRate(): number;
}

export interface ITurnDetector {
  onSpeechStarted?: () => void;
  onSpeechStopped?: () => void;
  setSensitivity(threshold: number): void;
}

export interface IWebRTCTransport {
  connect(signalingUrl: string): Promise<void>;
  sendData(payload: unknown): void;
  disconnect(): void;
}

export class SpeechToSpeechRoadmap {
  public static readonly STATUS = 'PREPARED_FOR_INTEGRATION';
  public static readonly PLANNED_FEATURES = [
    'Direct browser AudioWorklet PCM16 capture at 24kHz',
    'Semantic VAD auto-interruption when user begins speaking',
    'Low-latency WebRTC data-channel transport option',
    'Live user microphone waveform visualizer'
  ];
}
