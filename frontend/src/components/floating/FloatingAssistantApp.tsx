import React, { useState, useEffect, useRef } from 'react';
import { useRealtimeSession } from '../../hooks/useRealtimeSession.js';
import { FloatingOrb, AssistantState } from './FloatingOrb.js';
import { AssistantMenu } from './AssistantMenu.js';
import { CompactKeyboardPanel } from './CompactKeyboardPanel.js';
import { TranscriptBubble } from './TranscriptBubble.js';

// Desktop API interface on window
interface DesktopApi {
  isDesktop?: boolean;
  openFullWebApp: () => void;
  setMuted: (isMuted: boolean) => void;
  setAssistantState: (state: string) => void;
  moveWindowBy: (deltaX: number, deltaY: number) => void;
  onGlobalShortcutTriggered: (callback: () => void) => () => void;
  onToggleMuteFromTray: (callback: () => void) => () => void;
  onOpenKeyboardMode: (callback: () => void) => () => void;
}

interface CustomWindow extends Window {
  desktopApi?: DesktopApi;
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export const FloatingAssistantApp: React.FC = () => {
  const {
    connectionState,
    messages,
    isGenerating,
    isSpeaking,
    preferences,
    isAudioMuted,
    audioManager,
    sendMessage,
    stopResponse,
    toggleMute,
  } = useRealtimeSession();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const recognitionRef = useRef<any>(null);
  const transcriptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const totalDragDistanceRef = useRef<number>(0);

  // Initialize Speech Recognition for voice mode & Ctrl+Space
  useEffect(() => {
    const win = typeof window !== 'undefined' ? (window as unknown as CustomWindow) : null;
    const SpeechRecognition = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'hi-IN,en-US';

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          }
        }

        if (finalTranscript.trim()) {
          console.log('[FloatingAssistant] Heard phrase:', finalTranscript);
          sendMessage(finalTranscript.trim());
          setShowTranscript(true);
        }
      };

      recognition.onerror = (err: any) => {
        console.warn('[FloatingAssistant] Speech error:', err);
        setIsListening(false);
      };

      recognition.onend = () => {
        if (isListening && !isAudioMuted) {
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
      try {
        recognitionRef.current?.stop();
      } catch {}
    };
  }, [isListening, isAudioMuted, sendMessage]);

  const startListening = async () => {
    if (isAudioMuted) {
      toggleMute();
    }
    if (audioManager) {
      await audioManager.ensureContext();
    }
    setIsListening(true);
    try {
      recognitionRef.current?.start();
    } catch {}
  };

  const stopListening = () => {
    setIsListening(false);
    try {
      recognitionRef.current?.stop();
    } catch {}
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Listen to Electron Global Shortcut (Ctrl + Space) & IPC signals
  useEffect(() => {
    const win = typeof window !== 'undefined' ? (window as unknown as CustomWindow) : null;
    const api = win?.desktopApi;

    if (api) {
      // 1. Ctrl + Space: Activate assistant
      const unsubscribeShortcut = api.onGlobalShortcutTriggered(() => {
        console.log('[FloatingAssistant] Global Ctrl+Space shortcut received in renderer');
        if (isSpeaking || isGenerating) {
          stopResponse();
        }
        // Open keyboard panel and start voice listening
        setIsKeyboardOpen(true);
        setIsMenuOpen(false);
        toggleListening();
      });

      // 2. Tray toggle mute
      const unsubscribeTrayMute = api.onToggleMuteFromTray(() => {
        toggleMute();
      });

      // 3. Tray open keyboard
      const unsubscribeTrayKeyboard = api.onOpenKeyboardMode(() => {
        setIsKeyboardOpen(true);
        setIsMenuOpen(false);
      });

      return () => {
        unsubscribeShortcut();
        unsubscribeTrayMute();
        unsubscribeTrayKeyboard();
      };
    }
  }, [isSpeaking, isGenerating, isListening, toggleMute, stopResponse]);

  // Sync mute state to desktop API
  useEffect(() => {
    const win = typeof window !== 'undefined' ? (window as unknown as CustomWindow) : null;
    win?.desktopApi?.setMuted(isAudioMuted);
  }, [isAudioMuted]);

  // Derive assistant visual state
  const getAssistantState = (): AssistantState => {
    if (connectionState === 'error') return 'error';
    if (isAudioMuted) return 'muted';
    if (isListening) return 'listening';
    if (isGenerating) return 'thinking';
    if (isSpeaking) return 'speaking';
    return 'idle';
  };

  const assistantState = getAssistantState();

  // Sync assistant state to desktop API
  useEffect(() => {
    const win = typeof window !== 'undefined' ? (window as unknown as CustomWindow) : null;
    win?.desktopApi?.setAssistantState(assistantState);
  }, [assistantState]);

  // Auto show/hide transcript bubble during speaking
  const lastAssistantMessage = messages
    .filter((m) => m.role === 'assistant')
    .slice(-1)[0]?.text;

  useEffect(() => {
    if (isSpeaking && lastAssistantMessage) {
      setShowTranscript(true);
      if (transcriptTimeoutRef.current) {
        clearTimeout(transcriptTimeoutRef.current);
      }
    } else if (!isSpeaking && showTranscript) {
      transcriptTimeoutRef.current = setTimeout(() => {
        setShowTranscript(false);
      }, 6000);
    }
  }, [isSpeaking, lastAssistantMessage]);

  // High precision mouse drag (requires > 15px displacement to count as drag)
  const handleMouseDown = (e: React.MouseEvent) => {
    dragStartRef.current = { x: e.screenX, y: e.screenY };
    totalDragDistanceRef.current = 0;
    isDraggingRef.current = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = moveEvent.screenX - dragStartRef.current.x;
      const dy = moveEvent.screenY - dragStartRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      totalDragDistanceRef.current += dist;

      if (totalDragDistanceRef.current > 15) {
        isDraggingRef.current = true;
        const win = typeof window !== 'undefined' ? (window as unknown as CustomWindow) : null;
        win?.desktopApi?.moveWindowBy(dx, dy);
        dragStartRef.current = { x: moveEvent.screenX, y: moveEvent.screenY };
      }
    };

    const handleMouseUp = () => {
      dragStartRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Click Orb handler: Toggle 3-action menu
  const handleOrbClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDraggingRef.current) {
      return;
    }
    console.log('[FloatingAssistant] Orb Clicked! Toggling menu, current isMenuOpen:', isMenuOpen);
    if (isKeyboardOpen) {
      setIsKeyboardOpen(false);
    }
    setIsMenuOpen((prev) => !prev);
  };

  // Open Full App action
  const handleOpenFullApp = () => {
    const win = typeof window !== 'undefined' ? (window as unknown as CustomWindow) : null;
    if (win?.desktopApi) {
      win.desktopApi.openFullWebApp();
    } else {
      window.open('http://localhost:5173', '_blank');
    }
    setIsMenuOpen(false);
  };

  return (
    <div
      onClick={() => {
        if (!isDraggingRef.current) {
          setIsMenuOpen(false);
        }
      }}
      className="w-screen h-screen flex flex-col items-center justify-end p-4 bg-transparent overflow-hidden select-none"
    >
      {/* Top Flex Area: Panels & Popups directly above Orb */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex-1 flex flex-col items-center justify-end w-full pb-3 pointer-events-auto"
      >
        {isKeyboardOpen ? (
          <CompactKeyboardPanel
            isOpen={isKeyboardOpen}
            onClose={() => setIsKeyboardOpen(false)}
            onSendMessage={(text) => {
              sendMessage(text);
              setIsKeyboardOpen(true);
            }}
            onStopResponse={stopResponse}
            isGenerating={isGenerating}
            isSpeaking={isSpeaking}
            lastAssistantMessage={lastAssistantMessage}
            voiceName={preferences.voiceId.includes('mukesh') ? 'Mukesh Sharma' : 'Hindi Person'}
          />
        ) : isMenuOpen ? (
          <AssistantMenu
            isOpen={isMenuOpen}
            isMuted={isAudioMuted}
            onToggleMute={() => {
              toggleMute();
              if (!isAudioMuted) {
                stopListening();
              }
            }}
            onOpenKeyboard={() => {
              setIsKeyboardOpen(true);
              setIsMenuOpen(false);
            }}
            onOpenFullApp={handleOpenFullApp}
          />
        ) : showTranscript ? (
          <TranscriptBubble
            text={lastAssistantMessage || ''}
            isVisible={showTranscript}
            isSpeaking={isSpeaking}
            onDismiss={() => setShowTranscript(false)}
          />
        ) : null}
      </div>

      {/* Bottom Area: Main Floating Orb */}
      <div
        onMouseDown={handleMouseDown}
        onClick={(e) => e.stopPropagation()}
        className="relative z-30 cursor-grab active:cursor-grabbing shrink-0"
      >
        <FloatingOrb
          state={assistantState}
          isMuted={isAudioMuted}
          audioManager={audioManager}
          onClick={handleOrbClick}
          size={70}
        />
      </div>
    </div>
  );
};
