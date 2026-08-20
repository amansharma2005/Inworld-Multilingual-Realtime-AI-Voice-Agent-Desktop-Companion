import React from 'react';
import { Mic, MicOff, AlertCircle, Bot } from 'lucide-react';
import type { AudioPlaybackManager } from '../../services/AudioPlaybackManager.js';
import { AudioWaveform } from '../AudioWaveform.js';

export type AssistantState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'muted'
  | 'error';

interface FloatingOrbProps {
  state: AssistantState;
  isMuted: boolean;
  audioManager: AudioPlaybackManager | null;
  onClick: (e: React.MouseEvent) => void;
  size?: number; // default: 68px
}

export const FloatingOrb: React.FC<FloatingOrbProps> = ({
  state,
  isMuted,
  audioManager,
  onClick,
  size = 68,
}) => {
  // Determine gradient and glow classes based on assistant state
  const getStateStyles = () => {
    switch (state) {
      case 'listening':
        return {
          glow: 'bg-emerald-500/50 shadow-[0_0_35px_rgba(16,185,129,0.7)] animate-pulse',
          border: 'border-emerald-400 ring-4 ring-emerald-500/30',
          gradient: 'from-emerald-500 via-teal-500 to-sky-500',
        };
      case 'thinking':
        return {
          glow: 'bg-indigo-500/50 shadow-[0_0_35px_rgba(99,102,241,0.7)] animate-spin duration-[4000ms]',
          border: 'border-indigo-400 ring-4 ring-indigo-500/30',
          gradient: 'from-indigo-500 via-purple-500 to-pink-500',
        };
      case 'speaking':
        return {
          glow: 'bg-sky-500/50 shadow-[0_0_40px_rgba(14,165,233,0.8)] animate-pulse',
          border: 'border-sky-400 ring-4 ring-sky-500/40',
          gradient: 'from-sky-400 via-blue-600 to-indigo-600',
        };
      case 'muted':
        return {
          glow: 'bg-amber-500/30 shadow-[0_0_25px_rgba(245,158,11,0.4)]',
          border: 'border-amber-400/80 ring-2 ring-amber-500/20',
          gradient: 'from-slate-800 via-slate-900 to-slate-950',
        };
      case 'error':
        return {
          glow: 'bg-rose-500/40 shadow-[0_0_30px_rgba(244,63,94,0.6)] animate-bounce',
          border: 'border-rose-400 ring-2 ring-rose-500/30',
          gradient: 'from-rose-600 to-red-800',
        };
      case 'idle':
      default:
        return {
          glow: 'bg-sky-500/30 shadow-[0_0_30px_rgba(14,165,233,0.45)]',
          border: 'border-sky-400/40 ring-2 ring-sky-500/20 hover:border-sky-300 hover:ring-sky-400/40',
          gradient: 'from-slate-900 via-slate-800 to-slate-950',
        };
    }
  };

  const currentStyles = getStateStyles();

  return (
    <div className="relative flex items-center justify-center select-none group pointer-events-auto">
      {/* Outer ambient breathing glow aura */}
      <div
        className={`absolute rounded-full transition-all duration-700 pointer-events-none ${currentStyles.glow}`}
        style={{
          width: size + 24,
          height: size + 24,
        }}
      />

      {/* Main Circular Orb Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick(e);
        }}
        style={{
          width: size,
          height: size,
        }}
        className={`relative rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 transform active:scale-90 hover:scale-105 focus:outline-none backdrop-blur-xl border ${currentStyles.border} overflow-hidden shadow-2xl bg-gradient-to-tr ${currentStyles.gradient} z-40`}
        title={`Assistant: ${state.toUpperCase()} (Click to toggle menu)`}
      >
        {/* State-dependent internal visuals */}
        {state === 'speaking' ? (
          <div className="flex flex-col items-center justify-center gap-1 w-full h-full p-2 pointer-events-none">
            <AudioWaveform
              audioManager={audioManager}
              isActive={true}
              barCount={7}
              className="w-10 h-6"
            />
          </div>
        ) : state === 'listening' ? (
          <div className="relative flex items-center justify-center pointer-events-none">
            <span className="absolute w-10 h-10 rounded-full bg-emerald-400/40 animate-ping" />
            <Mic className="w-6 h-6 text-white drop-shadow-md z-10 animate-pulse" />
          </div>
        ) : state === 'thinking' ? (
          <div className="flex items-center justify-center pointer-events-none">
            <div className="w-7 h-7 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          </div>
        ) : state === 'muted' || isMuted ? (
          <MicOff className="w-6 h-6 text-amber-400 drop-shadow pointer-events-none" />
        ) : state === 'error' ? (
          <AlertCircle className="w-6 h-6 text-white animate-pulse drop-shadow pointer-events-none" />
        ) : (
          /* Idle Core with glowing Bot Icon */
          <div className="flex items-center justify-center relative pointer-events-none">
            <span className="w-3 h-3 rounded-full bg-sky-400 animate-ping absolute opacity-60" />
            <Bot className="w-6 h-6 text-sky-200 group-hover:text-white transition-colors drop-shadow" />
          </div>
        )}

        {/* Small Mute Status Badge */}
        {isMuted && state !== 'muted' && (
          <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-amber-500 border border-slate-900 flex items-center justify-center pointer-events-none">
            <MicOff className="w-2 h-2 text-slate-950" />
          </div>
        )}
      </button>
    </div>
  );
};
