/**
 * AudioPlaybackManager
 * High-performance, robust Web Audio API streaming player for Inworld Realtime PCM16 chunks (24kHz).
 * Features direct endian-safe PCM16 decoding, hardware-native sample rate adaptation,
 * continuous gapless timeline scheduling, micro-crossfades, and real-time frequency analysis.
 */

export class AudioPlaybackManager {
  private ctx: AudioContext | null = null;
  private pcmSampleRate = 24000;
  private queue: Float32Array[] = [];
  private isPlaying = false;
  private isMuted = false;
  private volume = 1.0;
  private gainNode: GainNode | null = null;
  public analyserNode: AnalyserNode | null = null;
  private currentSources: AudioBufferSourceNode[] = [];
  private nextPlayTime = 0;
  private onPlaybackStateChange?: (isPlaying: boolean) => void;
  private onEndedCallback?: () => void;

  constructor(options?: {
    pcmSampleRate?: number;
    onPlaybackStateChange?: (isPlaying: boolean) => void;
  }) {
    if (options?.pcmSampleRate) this.pcmSampleRate = options.pcmSampleRate;
    if (options?.onPlaybackStateChange) this.onPlaybackStateChange = options.onPlaybackStateChange;

    // Attach global user interaction listeners to auto-unlock AudioContext on first gesture
    if (typeof window !== 'undefined') {
      const unlockAudio = () => {
        this.ensureContext().catch(() => {});
      };
      window.addEventListener('click', unlockAudio, { once: true });
      window.addEventListener('keydown', unlockAudio, { once: true });
      window.addEventListener('touchstart', unlockAudio, { once: true });
    }
  }

  /**
   * Initializes and resumes the AudioContext with the browser's native hardware sample rate.
   */
  public async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      this.ctx = new AudioCtx();

      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);

      this.analyserNode = this.ctx.createAnalyser();
      this.analyserNode.fftSize = 64;
      this.analyserNode.smoothingTimeConstant = 0.8;

      // Connect Gain -> Destination (speaker) AND Gain -> Analyser (waveform) in parallel
      this.gainNode.connect(this.ctx.destination);
      this.gainNode.connect(this.analyserNode);

      console.log(`[AudioPlaybackManager] Initialized AudioContext at native rate ${this.ctx.sampleRate}Hz`);
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
      console.log('[AudioPlaybackManager] Resumed AudioContext to active state');
    }

    return this.ctx;
  }

  /**
   * Direct endian-safe decoder: Converts Base64 PCM16 (signed 16-bit little-endian) to Float32Array
   */
  private decodeBase64Pcm16(base64: string): Float32Array {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const sampleCount = Math.floor(len / 2);
    const float32 = new Float32Array(sampleCount);

    for (let i = 0; i < sampleCount; i++) {
      const byte1 = binaryString.charCodeAt(i * 2);
      const byte2 = binaryString.charCodeAt(i * 2 + 1);
      let int16 = byte1 | (byte2 << 8);
      if (int16 >= 32768) int16 -= 65536;
      float32[i] = int16 / 32768.0;
    }

    return float32;
  }

  /**
   * Enqueues and continuously streams every incoming base64 PCM16 chunk.
   */
  public async enqueueBase64Chunk(base64Chunk: string) {
    if (this.isMuted || !base64Chunk) return;

    try {
      await this.ensureContext();
      const float32Samples = this.decodeBase64Pcm16(base64Chunk);
      if (float32Samples.length === 0) return;

      this.queue.push(float32Samples);
      // Immediately schedule newly queued chunks onto the continuous timeline
      this.scheduleNextChunks();
    } catch (err) {
      console.error('[AudioPlaybackManager] Error enqueueing chunk:', err);
    }
  }

  /**
   * Schedules all pending chunks on the continuous Web Audio timeline.
   */
  private scheduleNextChunks() {
    if (!this.ctx || this.queue.length === 0) return;

    this.setPlayingState(true);

    while (this.queue.length > 0) {
      const float32 = this.queue.shift()!;
      const len = float32.length;
      if (len === 0) continue;

      // Apply subtle 48-sample edge smoothing to prevent pops between chunks
      const fadeSamples = Math.min(48, Math.floor(len / 4));
      for (let i = 0; i < fadeSamples; i++) {
        const factor = i / fadeSamples;
        float32[i] *= factor;
        float32[len - 1 - i] *= factor;
      }

      // Create AudioBuffer with Inworld's 24kHz PCM sample rate
      const audioBuffer = this.ctx.createBuffer(1, len, this.pcmSampleRate);
      audioBuffer.getChannelData(0).set(float32);

      const source = this.ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.gainNode!);

      // Calculate schedule time on continuous audio timeline
      const currentTime = this.ctx.currentTime;
      const startTime = Math.max(currentTime, this.nextPlayTime);
      this.nextPlayTime = startTime + audioBuffer.duration;

      this.currentSources.push(source);

      source.onended = () => {
        const idx = this.currentSources.indexOf(source);
        if (idx > -1) {
          this.currentSources.splice(idx, 1);
        }

        // If no more sources are playing and no new chunks are queued
        if (this.currentSources.length === 0 && this.queue.length === 0) {
          this.setPlayingState(false);
          this.nextPlayTime = 0;
          this.onEndedCallback?.();
        }
      };

      source.start(startTime);
    }
  }

  /**
   * Replays an entire array of base64 chunks for a completed message.
   */
  public async replayChunks(chunks: string[], onEnded?: () => void) {
    this.stop();
    this.onEndedCallback = onEnded;

    for (const chunk of chunks) {
      await this.enqueueBase64Chunk(chunk);
    }
  }

  /**
   * Immediately stops all current playback and flushes the queue.
   */
  public stop() {
    this.queue = [];
    this.nextPlayTime = 0;

    for (const src of this.currentSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // Source might already have ended
      }
    }
    this.currentSources = [];
    this.setPlayingState(false);
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(muted ? 0 : this.volume, this.ctx.currentTime);
    }
    if (muted) {
      this.stop();
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.gainNode && this.ctx && !this.isMuted) {
      this.gainNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  private setPlayingState(playing: boolean) {
    if (this.isPlaying !== playing) {
      this.isPlaying = playing;
      this.onPlaybackStateChange?.(playing);
    }
  }

  /**
   * Returns normalized frequency byte data (0 - 255) for rendering waveforms.
   */
  public getByteFrequencyData(): Uint8Array | null {
    if (!this.analyserNode) return null;
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(data);
    return data;
  }
}
