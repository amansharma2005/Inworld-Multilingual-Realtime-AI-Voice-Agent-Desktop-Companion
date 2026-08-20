import React from 'react';
import { Mic, MicOff, Keyboard, Settings, ExternalLink } from 'lucide-react';

interface AssistantMenuProps {
  isOpen: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenKeyboard: () => void;
  onOpenFullApp: () => void;
}

export const AssistantMenu: React.FC<AssistantMenuProps> = ({
  isOpen,
  isMuted,
  onToggleMute,
  onOpenKeyboard,
  onOpenFullApp,
}) => {
  if (!isOpen) return null;

  return (
    <div className="flex items-center gap-3 p-2 rounded-2xl bg-slate-900/95 border border-sky-400/30 backdrop-blur-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 z-50 select-none">
      {/* Control 1: Mute / Unmute */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleMute();
        }}
        title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        className={`p-3 rounded-xl transition-all flex items-center justify-center shadow-md ${
          isMuted
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
            : 'bg-slate-800 text-slate-300 border border-white/10 hover:text-emerald-300 hover:bg-emerald-500/20'
        }`}
      >
        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>

      {/* Control 2: Keyboard Text Input */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenKeyboard();
        }}
        title="Open Compact Keyboard Input"
        className="p-3 rounded-xl bg-slate-800 text-slate-300 border border-white/10 hover:text-sky-300 hover:bg-sky-500/20 shadow-md transition-all flex items-center justify-center"
      >
        <Keyboard className="w-5 h-5" />
      </button>

      {/* Control 3: Settings / Open Full App */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenFullApp();
        }}
        title="Open Full Web Control Center"
        className="p-3 rounded-xl bg-slate-800 text-slate-300 border border-white/10 hover:text-indigo-300 hover:bg-indigo-500/20 shadow-md transition-all flex items-center justify-center gap-1.5"
      >
        <Settings className="w-5 h-5" />
        <ExternalLink className="w-3 h-3 opacity-60" />
      </button>
    </div>
  );
};
