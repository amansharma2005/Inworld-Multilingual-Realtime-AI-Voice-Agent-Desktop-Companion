import React, { useEffect, useRef } from 'react';
import type { AudioPlaybackManager } from '../services/AudioPlaybackManager.js';

interface AudioWaveformProps {
  audioManager: AudioPlaybackManager | null;
  isActive: boolean;
  barCount?: number;
  className?: string;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  audioManager,
  isActive,
  barCount = 18,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const freqData = audioManager?.getByteFrequencyData();
      const width = canvas.width;
      const height = canvas.height;
      const barWidth = Math.floor(width / barCount) - 2;

      for (let i = 0; i < barCount; i++) {
        let barHeight = 4;

        if (isActive && freqData && freqData.length > 0) {
          const sampleIndex = Math.floor((i / barCount) * (freqData.length / 2));
          const value = freqData[sampleIndex] || 0;
          barHeight = Math.max(4, Math.floor((value / 255) * height));
        } else if (isActive) {
          // Synthetic subtle animation fallback
          barHeight = Math.max(4, Math.sin(Date.now() / 150 + i) * (height / 2.5) + height / 2.5);
        }

        const x = i * (barWidth + 2);
        const y = (height - barHeight) / 2;

        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, '#38bdf8'); // sky-400
        gradient.addColorStop(1, '#6366f1'); // indigo-500

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [audioManager, isActive, barCount]);

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={28}
      className={`inline-block ${className}`}
    />
  );
};
