import React from 'react';
import { Volume2, X } from 'lucide-react';

interface TranscriptBubbleProps {
  text: string;
  isVisible: boolean;
  isSpeaking: boolean;
  onDismiss: () => void;
}

export const TranscriptBubble: React.FC<TranscriptBubbleProps> = ({
  text,
  isVisible,
  isSpeaking,
  onDismiss,
}) => {
  if (!isVisible || !text) return null;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-[320px] max-h-36 overflow-y-auto p-3 rounded-2xl bg-slate-900/95 border border-sky-400/40 backdrop-blur-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 z-40 text-xs text-slate-200 leading-relaxed scrollbar-thin select-none"
    >
      <div className="flex items-center justify-between text-[10px] text-sky-400 font-semibold mb-1">
        <div className="flex items-center gap-1">
          <Volume2 className="w-3 h-3" />
          <span>{isSpeaking ? 'Speaking...' : 'Assistant'}</span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-slate-500 hover:text-slate-300"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      <p className="whitespace-pre-wrap">{text}</p>
    </div>
  );
};
