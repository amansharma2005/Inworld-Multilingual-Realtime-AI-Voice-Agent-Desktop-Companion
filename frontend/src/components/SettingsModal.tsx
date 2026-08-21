import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Sliders,
  MessageSquare,
  Volume2,
  Globe,
  RefreshCw,
  Calendar,
  CheckCircle,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import type { UserPreferences } from '../types/realtime.js';

interface SettingsModalProps {
  isOpen: boolean;
  preferences: UserPreferences;
  onClose: () => void;
  onSave: (newPrefs: UserPreferences) => void;
}

interface CalendarStatus {
  connected: boolean;
  email?: string;
  defaultCalendarId?: string;
  isConfigured: boolean;
}

interface CalendarItem {
  id: string;
  summary: string;
  primary?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  preferences,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<UserPreferences>({ ...preferences });
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [availableCalendars, setAvailableCalendars] = useState<CalendarItem[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  // Fetch Google Calendar status when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCalendarStatus();
    }
  }, [isOpen]);

  const fetchCalendarStatus = async () => {
    try {
      setLoadingCalendar(true);
      const res = await fetch('http://localhost:4000/api/auth/google/status');
      if (res.ok) {
        const data: CalendarStatus = await res.json();
        setCalendarStatus(data);

        if (data.connected) {
          // Fetch calendar list
          const listRes = await fetch('http://localhost:4000/api/calendar/list');
          if (listRes.ok) {
            const listData = await listRes.json();
            if (listData.calendars) {
              setAvailableCalendars(listData.calendars);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[SettingsModal] Failed to fetch calendar status:', err);
    } finally {
      setLoadingCalendar(false);
    }
  };

  const handleConnectCalendar = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/auth/google/url');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to generate Google authorization URL. Please check your .env configuration.');
      }
    } catch (err) {
      alert('Error initiating Google connection. Ensure backend is running.');
    }
  };

  const handleDisconnectCalendar = async () => {
    if (!confirm('Are you sure you want to disconnect your Google Calendar?')) return;
    try {
      await fetch('http://localhost:4000/api/auth/google/disconnect', { method: 'POST' });
      fetchCalendarStatus();
    } catch (err) {
      console.warn('[SettingsModal] Error disconnecting calendar:', err);
    }
  };

  const handleSelectDefaultCalendar = async (calendarId: string) => {
    try {
      await fetch('http://localhost:4000/api/calendar/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId }),
      });
      fetchCalendarStatus();
    } catch (err) {
      console.warn('[SettingsModal] Error setting default calendar:', err);
    }
  };

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handleResetDefaults = () => {
    setFormData({
      ...preferences,
      voiceId: 'zippy-kite-2028__design-voice-7eea8ae2',
      voiceSpeed: 1.0,
      language: 'auto',
      outputModality: 'text_audio',
      ttsModel: 'inworld-tts-2',
      model: 'inworld/models/deepseek-v4-flash',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Settings & Integrations</h2>
              <p className="text-xs text-slate-400">Configure Inworld AI, Custom Voice, and Google Calendar</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Section 1: Google Calendar Integration */}
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-sky-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Google Calendar Integration</h3>
                  <p className="text-[11px] text-slate-400">
                    Enable voice scheduling, availability checks, and proactive reminders.
                  </p>
                </div>
              </div>

              {calendarStatus?.connected ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Connected
                </span>
              ) : (
                <span className="text-[11px] text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full border border-white/10">
                  Not Connected
                </span>
              )}
            </div>

            {calendarStatus?.connected ? (
              <div className="space-y-2.5 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Authorized Account:</span>
                  <span className="font-mono text-sky-300 font-semibold">{calendarStatus.email || 'Google Account'}</span>
                </div>

                {availableCalendars.length > 0 && (
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Active Calendar</label>
                    <select
                      value={calendarStatus.defaultCalendarId || 'primary'}
                      onChange={(e) => handleSelectDefaultCalendar(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-slate-100 focus:outline-none focus:border-sky-500"
                    >
                      {availableCalendars.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.summary} {c.primary ? '(Primary)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleDisconnectCalendar}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-300 transition-colors flex items-center gap-1.5 text-[11px]"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Disconnect Calendar</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                <p className="text-[11px] text-slate-400 max-w-sm">
                  Connect your Google account to let the voice assistant read schedules and book meetings.
                </p>
                <button
                  type="button"
                  onClick={handleConnectCalendar}
                  disabled={loadingCalendar}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-md flex items-center gap-1.5 transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Connect Google Calendar</span>
                </button>
              </div>
            )}
          </div>

          {/* Section 2: Voice & TTS */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5" />
              <span>Voice & Speech Synthesis</span>
            </h3>

            {/* Custom Voice ID */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                <span>Inworld Custom Voice ID</span>
                <span className="text-[11px] text-sky-400 font-normal">
                  Active: {formData.voiceId.includes('mukesh') ? 'Mukesh Sharma' : formData.voiceId.includes('design-voice') ? 'Hindi Person' : formData.voiceId}
                </span>
              </label>
              <input
                type="text"
                value={formData.voiceId}
                onChange={(e) => setFormData({ ...formData, voiceId: e.target.value })}
                placeholder="zippy-kite-2028__design-voice-7eea8ae2"
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-slate-100 focus:outline-none focus:border-sky-500 font-mono text-xs"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Your private custom voice ID. Configured with Inworld TTS-2 for natural Hindi, Hinglish, and multilingual synthesis.
              </p>
            </div>

            {/* TTS Model & LLM Model */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Inworld TTS Model</label>
                <select
                  value={formData.ttsModel}
                  onChange={(e) => setFormData({ ...formData, ttsModel: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  <option value="inworld-tts-2">inworld-tts-2 (High Quality, 200+ Languages)</option>
                  <option value="inworld-tts-2-flash">inworld-tts-2-flash (Ultra Low Latency)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Realtime LLM Model</label>
                <select
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  <option value="inworld/models/deepseek-v4-flash">DeepSeek V4 Flash (Fast, Accurate Hindi)</option>
                  <option value="inworld/models/gemma-4-26b-a4b-it">Gemma 4 26B (Free On-Demand)</option>
                  <option value="inworld/models/qwen3.8-27b">Qwen 3.8 27B (Free On-Demand)</option>
                  <option value="google-ai-studio/gemini-2.5-flash">Gemini 2.5 Flash (Google)</option>
                  <option value="openai/gpt-4o-mini">GPT-4o Mini (OpenAI)</option>
                </select>
              </div>
            </div>

            {/* Speed & Modality */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Voice Speed ({formData.voiceSpeed.toFixed(2)}x)
                </label>
                <input
                  type="range"
                  min="0.75"
                  max="1.35"
                  step="0.05"
                  value={formData.voiceSpeed}
                  onChange={(e) => setFormData({ ...formData, voiceSpeed: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Output Modality</label>
                <select
                  value={formData.outputModality}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      outputModality: e.target.value as 'text_audio' | 'text_only' | 'voice_only',
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  <option value="text_audio">Text + Voice (Recommended)</option>
                  <option value="text_only">Text Only (No Voice)</option>
                  <option value="voice_only">Voice Only (Audio Stream)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Multilingual Settings */}
          <div className="space-y-4 border-t border-white/10 pt-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              <span>Language Strategy</span>
            </h3>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Language Normalization Mode</label>
              <select
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-slate-100 focus:outline-none focus:border-sky-500"
              >
                <option value="auto">Auto Detect (Default — Natural Multilingual Response)</option>
                <option value="hi">Hindi (हिंदी — Force Hindi TTS normalization)</option>
                <option value="en">English (en-US)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Auto-detect is recommended. The AI reads context from the prompt and responds in the exact user language (Hindi, Hinglish, English, etc.).
              </p>
            </div>
          </div>

          {/* Section 4: System Instructions */}
          <div className="space-y-2 border-t border-white/10 pt-5">
            <label className="block text-slate-300 font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                <span>System Instructions / Prompt</span>
              </span>
            </label>
            <textarea
              rows={4}
              value={formData.systemInstructions}
              onChange={(e) => setFormData({ ...formData, systemInstructions: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-slate-100 focus:outline-none focus:border-sky-500 text-xs font-mono leading-relaxed"
            />
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/10 bg-slate-950/50 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-sky-500/20 transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Apply to Session</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
