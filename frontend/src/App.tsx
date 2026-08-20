import { useState } from 'react';
import { useRealtimeSession } from './hooks/useRealtimeSession.js';
import { Navbar } from './components/Navbar.js';
import { ChatWindow } from './components/ChatWindow.js';
import { MessageInput } from './components/MessageInput.js';
import { SettingsModal } from './components/SettingsModal.js';
import { ConnectionBanner } from './components/ConnectionBanner.js';
import { FloatingAssistantApp } from './components/floating/FloatingAssistantApp.js';

export function FullWebApp() {
  const {
    connectionState,
    messages,
    isGenerating,
    isSpeaking,
    errorMessage,
    preferences,
    isAudioMuted,
    audioManager,
    sendMessage,
    stopResponse,
    replayMessageAudio,
    updatePreferences,
    toggleMute,
    clearChat,
    reconnect,
  } = useRealtimeSession();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleEnableAudio = async () => {
    if (audioManager) {
      await audioManager.ensureContext();
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0B0F19] text-slate-100 overflow-hidden relative selection:bg-sky-500 selection:text-white">
      {/* Background glowing gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <Navbar
        connectionState={connectionState}
        preferences={preferences}
        isAudioMuted={isAudioMuted}
        isSpeaking={isSpeaking}
        audioManager={audioManager}
        onToggleMute={toggleMute}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onClearChat={clearChat}
      />

      {/* Connection & Error notification banner */}
      <ConnectionBanner
        connectionState={connectionState}
        errorMessage={errorMessage}
        onReconnect={reconnect}
        onEnableAudio={handleEnableAudio}
      />

      {/* Center Chat Area */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative z-10">
        <ChatWindow
          messages={messages}
          onSendMessage={sendMessage}
          onReplayAudio={replayMessageAudio}
        />
      </main>

      {/* Bottom Composer */}
      <MessageInput
        onSendMessage={sendMessage}
        onStopResponse={stopResponse}
        isGenerating={isGenerating}
        isConnected={connectionState === 'connected'}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        preferences={preferences}
        onClose={() => setIsSettingsOpen(false)}
        onSave={updatePreferences}
      />
    </div>
  );
}

export function App() {
  const [isFloatingMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'floating' || !!(window as any).desktopApi?.isDesktop;
  });

  // Render Experience B (Floating Desktop Assistant) or Experience A (Full Web App)
  if (isFloatingMode) {
    return <FloatingAssistantApp />;
  }

  return <FullWebApp />;
}

export default App;
