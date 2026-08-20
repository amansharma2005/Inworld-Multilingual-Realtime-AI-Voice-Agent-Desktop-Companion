import React from 'react';
import {
  Volume2,
  VolumeX,
  Settings,
  Trash2,
  Sparkles,
  Bot,
} from 'lucide-react';
import type { ConnectionState, UserPreferences } from '../types/realtime.js';
import type { AudioPlaybackManager } from '../services/AudioPlaybackManager.js';
import { AudioWaveform } from './AudioWaveform.js';

interface NavbarProps {
  connectionState: ConnectionState;
  preferences: UserPreferences;
  isAudioMuted: boolean;
  isSpeaking: boolean;
  audioManager: AudioPlaybackManager | null;
  onToggleMute: () => void;
  onOpenSettings: () => void;
  onClearChat: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  connectionState,
  preferences,
  isAudioMuted,
  isSpeaking,
  audioManager,
  onToggleMute,
  onOpenSettings,
  onClearChat,
}) => {
  const getStatusBadge = () => {
    switch (connectionState) {
      case 'connected':
        return (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Connected</span>
          </div>
        );
      case 'connecting':
      case 'reconnecting':
        return (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>{connectionState === 'reconnecting' ? 'Reconnecting...' : 'Connecting...'}</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <span>Connection Error</span>
          </div>
        );
      case 'disconnected':
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span>Disconnected</span>
          </div>
        );
    }
  };

  return (
    <header className="h-16 px-4 md:px-8 border-b border-white/10 glass-panel flex items-center justify-between z-20 select-none">
      {/* Left: App title & brand */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 ring-1 ring-white/20">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
              Inworld Realtime AI
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30 font-semibold uppercase tracking-wider">
                Multilingual
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-400 hidden sm:block">
            Speech-to-Speech & Realtime Streaming Assistant
          </p>
        </div>
      </div>

      {/* Center: Custom Voice Badge + Waveform */}
      <div className="hidden lg:flex items-center gap-3 px-4 py-1.5 rounded-full bg-slate-900/60 border border-white/10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-sky-400" />
          <span className="text-xs text-slate-300 font-medium">Voice:</span>
          <span className="text-xs font-semibold text-white bg-white/10 px-2 py-0.5 rounded">
            {preferences.voiceId.includes('mukesh') ? 'Mukesh Sharma' : preferences.voiceId.includes('design-voice') ? 'Hindi Person' : preferences.voiceId}
          </span>
        </div>

        <div className="h-4 w-px bg-white/10" />

        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <span>Lang:</span>
          <span className="text-sky-400 font-medium uppercase">{preferences.language}</span>
        </div>

        <div className="h-4 w-px bg-white/10" />

        <div className="flex items-center gap-2">
          <AudioWaveform
            audioManager={audioManager}
            isActive={isSpeaking}
            barCount={14}
            className="w-24 h-5 opacity-90"
          />
          {isSpeaking && (
            <span className="text-[11px] text-sky-400 font-medium animate-pulse">
              Speaking...
            </span>
          )}
        </div>
      </div>

      {/* Right: Status & Action buttons */}
      <div className="flex items-center gap-2.5">
        {getStatusBadge()}

        {/* Audio Mute/Unmute */}
        <button
          onClick={onToggleMute}
          title={isAudioMuted ? 'Unmute Audio' : 'Mute Audio'}
          className={`p-2 rounded-xl border transition-all ${
            isAudioMuted
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
              : 'bg-slate-800/80 border-white/10 text-slate-300 hover:text-white hover:bg-slate-700/80'
          }`}
        >
          {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Clear Chat */}
        <button
          onClick={onClearChat}
          title="Clear Conversation"
          className="p-2 rounded-xl bg-slate-800/80 border border-white/10 text-slate-300 hover:text-rose-400 hover:bg-slate-700/80 transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Settings Modal Trigger */}
        <button
          onClick={onOpenSettings}
          title="Session & Voice Settings"
          className="p-2 rounded-xl bg-gradient-to-r from-sky-500/20 to-indigo-500/20 border border-sky-500/30 text-sky-300 hover:text-white hover:border-sky-400 transition-all flex items-center gap-1.5"
        >
          <Settings className="w-4 h-4" />
          <span className="text-xs font-medium hidden md:inline">Settings</span>
        </button>
      </div>
    </header>
  );
};
