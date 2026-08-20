import React, { useState } from 'react';
import {
  Copy,
  Check,
  RotateCcw,
  Volume2,
  AlertCircle,
  Sparkles,
  User,
  Zap,
} from 'lucide-react';
import type { ChatMessageItem } from '../types/realtime.js';

interface ChatMessageProps {
  message: ChatMessageItem;
  onReplayAudio: (messageId: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onReplayAudio,
}) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    if (!message.text) return;
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div
      className={`flex w-full mb-6 ${
        isUser ? 'justify-end' : 'justify-start'
      } animate-in fade-in slide-in-from-bottom-2 duration-300`}
    >
      <div className={`flex gap-3 max-w-[85%] md:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-md ${
            isUser
              ? 'bg-gradient-to-tr from-sky-600 to-cyan-500 text-white'
              : 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white ring-1 ring-white/20'
          }`}
        >
          {isUser ? <User className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
        </div>

        {/* Message Content Body */}
        <div className="flex flex-col gap-1.5 min-w-0">
          {/* Header info */}
          <div className={`flex items-center gap-2 text-xs text-slate-400 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <span className="font-semibold text-slate-300">
              {isUser ? 'You' : 'Hindi Person (Inworld AI)'}
            </span>
            <span>•</span>
            <span>{formatTime(message.timestamp)}</span>

            {/* Status indicator badges for assistant */}
            {!isUser && (
              <>
                {message.status === 'generating' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    Generating...
                  </span>
                )}
                {message.status === 'speaking' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] animate-pulse">
                    <Volume2 className="w-3 h-3 text-emerald-400" />
                    Speaking
                  </span>
                )}
                {message.status === 'stopped' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px]">
                    Stopped
                  </span>
                )}
                {message.status === 'error' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px]">
                    <AlertCircle className="w-3 h-3 text-rose-400" />
                    Error
                  </span>
                )}
              </>
            )}
          </div>

          {/* Bubble container */}
          <div
            className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words transition-all ${
              isUser
                ? 'bg-sky-600/90 text-white shadow-lg shadow-sky-600/10 rounded-tr-none'
                : message.status === 'error'
                ? 'bg-rose-950/40 border border-rose-500/40 text-rose-200 rounded-tl-none'
                : 'glass-panel text-slate-100 shadow-xl rounded-tl-none border-white/10'
            }`}
          >
            {message.errorMessage ? (
              <div className="flex items-start gap-2 text-rose-300">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{message.errorMessage}</span>
              </div>
            ) : message.text ? (
              <span>{message.text}</span>
            ) : (
              <span className="text-slate-400 italic flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                Thinking & generating response...
              </span>
            )}

            {/* Blinking streaming cursor */}
            {!isUser && message.status === 'generating' && (
              <span className="inline-block w-2 h-4 ml-1 bg-sky-400 animate-pulse align-middle" />
            )}
          </div>

          {/* Footer Controls & Stats */}
          {!isUser && (message.text || message.audioChunks.length > 0) && (
            <div className="flex items-center justify-between mt-1 px-1">
              <div className="flex items-center gap-2">
                {/* Copy text */}
                <button
                  onClick={handleCopy}
                  title="Copy text"
                  className="p-1 text-slate-400 hover:text-slate-200 transition-colors rounded hover:bg-white/5 flex items-center gap-1 text-xs"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[11px] text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Copy</span>
                    </>
                  )}
                </button>

                {/* Replay Audio button */}
                {message.audioChunks.length > 0 && (
                  <button
                    onClick={() => onReplayAudio(message.id)}
                    title="Replay Spoken Audio"
                    className="p-1 text-slate-400 hover:text-sky-300 transition-colors rounded hover:bg-white/5 flex items-center gap-1 text-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Replay Voice</span>
                  </button>
                )}
              </div>

              {/* Usage / Metrics badge */}
              {message.usage && (
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                  {message.usage.outputTokens && (
                    <span className="flex items-center gap-0.5">
                      <Zap className="w-3 h-3 text-amber-400/80" />
                      {message.usage.outputTokens} tokens
                    </span>
                  )}
                  {message.usage.audioSeconds && (
                    <span>
                      {message.usage.audioSeconds.toFixed(1)}s audio
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
