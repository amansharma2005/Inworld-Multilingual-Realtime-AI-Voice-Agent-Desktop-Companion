import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, X, Sparkles } from 'lucide-react';

interface CompactKeyboardPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: (text: string) => void;
  onStopResponse: () => void;
  isGenerating: boolean;
  isSpeaking: boolean;
  lastAssistantMessage?: string;
  voiceName?: string;
}

export const CompactKeyboardPanel: React.FC<CompactKeyboardPanelProps> = ({
  isOpen,
  onClose,
  onSendMessage,
  onStopResponse,
  isGenerating,
  isSpeaking,
  lastAssistantMessage,
  voiceName = 'Mukesh Sharma',
}) => {
  const [inputText, setInputText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-[330px] p-3 rounded-2xl bg-slate-900/95 border border-sky-500/40 backdrop-blur-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 z-50 text-xs text-slate-100 flex flex-col gap-2.5 select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-1.5 font-bold text-sky-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Ask Assistant</span>
          <span className="text-[10px] text-slate-400 font-normal ml-1">({voiceName})</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Close (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Streaming Response Preview (if active) */}
      {(isGenerating || isSpeaking || lastAssistantMessage) && (
        <div className="max-h-28 overflow-y-auto p-2 rounded-xl bg-slate-800/80 border border-white/10 text-[11px] text-slate-200 leading-relaxed scrollbar-thin">
          <div className="flex items-center justify-between text-[10px] text-sky-400 font-medium mb-1">
            <span>Response:</span>
            {isSpeaking && <span className="text-emerald-400 animate-pulse">Speaking...</span>}
          </div>
          <p className="whitespace-pre-wrap">{lastAssistantMessage || 'Thinking...'}</p>
        </div>
      )}

      {/* Composer Input Form */}
      <div className="flex items-end gap-1.5 p-1 rounded-xl bg-slate-800 border border-white/10 focus-within:border-sky-500/50 focus-within:ring-1 focus-within:ring-sky-500/30 transition-all">
        <textarea
          ref={textareaRef}
          rows={2}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type in English, हिंदी, or Hinglish (Enter to send, Esc to close)..."
          className="flex-1 max-h-24 p-2 bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none resize-none leading-relaxed"
        />

        <div className="flex items-center gap-1 p-1">
          {isGenerating ? (
            <button
              type="button"
              onClick={onStopResponse}
              className="p-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow transition-all"
              title="Stop Response"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!inputText.trim()}
              className="p-2 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-40 text-white shadow transition-all"
              title="Send (Enter)"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
