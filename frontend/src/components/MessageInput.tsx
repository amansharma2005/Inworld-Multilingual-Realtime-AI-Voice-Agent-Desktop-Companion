import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, Mic, MicOff, Zap } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (text: string) => void;
  onStopResponse: () => void;
  isGenerating: boolean;
  isConnected: boolean;
}

// Browser Web Speech Recognition interface
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onStopResponse,
  isGenerating,
  isConnected,
}) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition for live voice input / barge-in
  useEffect(() => {
    const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
    const SpeechRecognition = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'hi-IN,en-US'; // Multi-language detection (Hindi + English)

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          }
        }

        if (finalTranscript.trim()) {
          console.log('[VoiceInput] Detected final spoken phrase:', finalTranscript);
          // Automatically barge-in / interrupt assistant with spoken input!
          onSendMessage(finalTranscript.trim());
          setInputText('');
        }
      };

      recognition.onerror = (err: any) => {
        console.warn('[VoiceInput] Speech recognition error:', err);
        setIsListening(false);
      };

      recognition.onend = () => {
        // If still listening mode, restart
        if (isListening) {
          try {
            recognition.start();
          } catch {
            setIsListening(false);
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, [onSendMessage, isListening]);

  // Toggle Live Microphone Listening
  const toggleListening = () => {
    if (!speechSupported) {
      alert('Speech Recognition is not supported in this browser. Please use Chrome, Edge, or Brave.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      try {
        recognitionRef.current?.stop();
      } catch {}
    } else {
      setIsListening(true);
      try {
        recognitionRef.current?.start();
      } catch {}
    }
  };

  // Auto resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [inputText]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !isConnected) return;
    onSendMessage(inputText);
    setInputText('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-4 md:px-8 border-t border-white/10 glass-panel relative z-10">
      <div className="max-w-4xl mx-auto">
        <form
          onSubmit={handleSubmit}
          className="relative flex items-end gap-2 p-2 rounded-2xl glass-input border-white/10 shadow-2xl focus-within:border-sky-500/50 focus-within:ring-2 focus-within:ring-sky-500/20 transition-all"
        >
          {/* Live Microphone Barge-in Toggle */}
          <button
            type="button"
            onClick={toggleListening}
            className={`p-3 rounded-xl transition-all flex items-center justify-center shrink-0 ${
              isListening
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/40 animate-pulse'
                : 'bg-slate-800/80 text-slate-400 hover:text-sky-400 hover:bg-slate-700/80'
            }`}
            title={
              isListening
                ? 'Microphone is LIVE (Listening for your voice to auto-interrupt)... Click to turn off'
                : 'Click to turn ON Live Microphone (Auto-interrupt on voice)'
            }
          >
            {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          {/* Expanding Multiline Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isConnected}
            placeholder={
              !isConnected
                ? 'Connecting to Inworld Voice Agent...'
                : isGenerating
                ? 'AI is speaking... Type or speak to interrupt & ask next question (Enter)...'
                : isListening
                ? 'Listening... Speak in Hindi or English (will auto-send & interrupt)...'
                : 'Type a message in English, हिंदी, Hinglish, or any language (Enter to send)...'
            }
            className="flex-1 max-h-40 min-h-[44px] py-2.5 px-3 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none disabled:opacity-50 leading-relaxed"
          />

          {/* Right Action: Send & Optional Stop Button */}
          <div className="flex items-center gap-1.5 pb-0.5 pr-1">
            {isGenerating && (
              <button
                type="button"
                onClick={onStopResponse}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 transition-all flex items-center justify-center shrink-0"
                title="Stop generation & speech immediately"
              >
                <Square className="w-4 h-4 fill-current text-rose-400" />
              </button>
            )}

            <button
              type="submit"
              disabled={!inputText.trim() || !isConnected}
              className={`p-2.5 rounded-xl text-white shadow-lg transition-all shrink-0 flex items-center justify-center gap-1.5 ${
                isGenerating
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-amber-500/25'
                  : 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-sky-500/25'
              } disabled:opacity-40 disabled:hover:from-sky-500 disabled:hover:to-indigo-600`}
              title={isGenerating ? 'Interrupt & Send next message' : 'Send message'}
            >
              {isGenerating ? <Zap className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </form>

        {/* Bottom helper text */}
        <div className="flex items-center justify-between mt-2 px-2 text-[11px] text-slate-500 select-none">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-400">Enter</kbd> to send / interrupt
            </span>
            {isListening && (
              <span className="text-rose-400 font-semibold flex items-center gap-1 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Mic Listening (Auto-Barge-in active)
              </span>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-1 text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            <span>Voice: Mukesh Sharma (PCM16 24kHz)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
