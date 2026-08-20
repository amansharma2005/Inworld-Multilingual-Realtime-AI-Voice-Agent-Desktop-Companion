import React, { useEffect, useRef } from 'react';
import { Sparkles, MessageSquare, Volume2, Globe, Cpu } from 'lucide-react';
import type { ChatMessageItem } from '../types/realtime.js';
import { ChatMessage } from './ChatMessage.js';

interface ChatWindowProps {
  messages: ChatMessageItem[];
  onSendMessage: (text: string) => void;
  onReplayAudio: (messageId: string) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  onSendMessage,
  onReplayAudio,
}) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const samplePrompts = [
    {
      lang: 'Hindi',
      badge: 'हिंदी',
      text: 'नमस्ते! आप मुझे किन-किन विषयों में मदद कर सकते हैं?',
    },
    {
      lang: 'Hinglish',
      badge: 'Hinglish',
      text: 'Aaj ka weather kaisa hai aur AI me kya interesting chal raha hai?',
    },
    {
      lang: 'English',
      badge: 'English',
      text: 'Hello! How does Inworld Realtime speech-to-speech architecture work?',
    },
    {
      lang: 'Creative',
      badge: 'Story',
      text: 'Tell me a short 2-sentence conversational story about space exploration.',
    },
  ];

  // Auto-scroll to bottom whenever messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 flex flex-col justify-start">
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto text-center my-auto py-12 animate-in fade-in duration-500">
          {/* Hero Icon */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-sky-500/30 ring-1 ring-white/30 mb-6 voice-pulsing">
            <Sparkles className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mb-3">
            Multilingual Realtime Voice AI
          </h2>

          <p className="text-sm text-slate-300 mb-8 max-w-lg leading-relaxed">
            Experience real-time conversational intelligence powered by Inworld AI.
            Speak or type naturally in <span className="text-sky-400 font-medium">English</span>,{' '}
            <span className="text-purple-400 font-medium">हिंदी (Hindi)</span>, or{' '}
            <span className="text-emerald-400 font-medium">Hinglish</span> with real-time streaming audio using custom voice{' '}
            <span className="text-white font-semibold underline decoration-sky-500/50">Hindi Person</span>.
          </p>

          {/* Capabilities Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mb-8 text-left">
            <div className="glass-card p-4 rounded-xl border-white/5 flex flex-col gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Globe className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-white">Auto-Language Context</h3>
              <p className="text-[11px] text-slate-400">
                Automatically detects user language and responds naturally in the same tongue.
              </p>
            </div>

            <div className="glass-card p-4 rounded-xl border-white/5 flex flex-col gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Volume2 className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-white">Custom Voice Synthesis</h3>
              <p className="text-[11px] text-slate-400">
                Streams 24kHz PCM16 audio chunks in real-time with zero gaps or latency delay.
              </p>
            </div>

            <div className="glass-card p-4 rounded-xl border-white/5 flex flex-col gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Cpu className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-white">Official Protocol</h3>
              <p className="text-[11px] text-slate-400">
                Direct integration with Inworld Realtime API session events and response streaming.
              </p>
            </div>
          </div>

          {/* Prompt Starters */}
          <div className="w-full">
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Try asking something</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {samplePrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(prompt.text)}
                  className="p-3 rounded-xl glass-card border-white/10 hover:border-sky-500/40 hover:bg-slate-800/80 transition-all text-left group flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                      {prompt.badge}
                    </span>
                    <span className="text-xs text-slate-500 group-hover:text-sky-400 transition-colors">
                      Send ↵
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 group-hover:text-white transition-colors line-clamp-2">
                    {prompt.text}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl w-full mx-auto">
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              onReplayAudio={onReplayAudio}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
};
