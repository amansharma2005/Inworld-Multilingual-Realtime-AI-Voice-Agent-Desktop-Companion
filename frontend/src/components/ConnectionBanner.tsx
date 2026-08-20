import React from 'react';
import { AlertTriangle, RefreshCw, Volume2 } from 'lucide-react';
import type { ConnectionState } from '../types/realtime.js';

interface ConnectionBannerProps {
  connectionState: ConnectionState;
  errorMessage: string | null;
  onReconnect: () => void;
  onEnableAudio?: () => void;
}

export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({
  connectionState,
  errorMessage,
  onReconnect,
  onEnableAudio,
}) => {
  // Hide banner if successfully connected and no active error
  if (connectionState === 'connected' && !errorMessage) {
    return null;
  }

  return (
    <div className="w-full bg-gradient-to-r from-amber-950/60 via-slate-900/80 to-amber-950/60 border-b border-amber-500/30 px-4 py-2 text-xs flex items-center justify-between text-amber-200 z-30">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <span>
          {errorMessage ||
            (connectionState === 'reconnecting'
              ? 'Lost connection to Inworld Realtime API. Reconnecting...'
              : connectionState === 'connecting'
              ? 'Establishing secure session with Inworld Realtime API...'
              : 'Disconnected from voice agent backend.')}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {onEnableAudio && (
          <button
            onClick={onEnableAudio}
            className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-medium flex items-center gap-1 transition-colors text-[11px]"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Enable Audio</span>
          </button>
        )}

        {connectionState !== 'connecting' && connectionState !== 'reconnecting' && (
          <button
            onClick={onReconnect}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium flex items-center gap-1 transition-colors text-[11px]"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        )}
      </div>
    </div>
  );
};
