import React, { useState } from 'react';
import { X, Sparkles, Sliders, MessageSquare, Volume2, Globe, Cpu, RefreshCw } from 'lucide-react';
import type { UserPreferences } from '../types/realtime.js';

interface SettingsModalProps {
  isOpen: boolean;
  preferences: UserPreferences;
  onClose: () => void;
  onSave: (newPrefs: UserPreferences) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  preferences,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<UserPreferences>({ ...preferences });

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
      model: 'google-ai-studio/gemini-2.5-flash',
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
              <h2 className="text-base font-bold text-white">Session & Voice Settings</h2>
              <p className="text-xs text-slate-400">Configure Inworld Realtime API models, custom voice, and language</p>
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
          {/* Section 1: Voice & TTS */}
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
                placeholder="zippy-kite-2028__mukesh_sharma_voice"
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-slate-100 focus:outline-none focus:border-sky-500 font-mono text-xs"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Your private custom voice ID. Configured with Inworld TTS-2 for natural Hindi, Hinglish, and multilingual synthesis.
              </p>
            </div>

            {/* TTS Model */}
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

              {/* Voice Speed */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1 flex justify-between">
                  <span>Voice Speed</span>
                  <span className="text-sky-400 font-mono">{formData.voiceSpeed.toFixed(2)}x</span>
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={formData.voiceSpeed}
                  onChange={(e) => setFormData({ ...formData, voiceSpeed: parseFloat(e.target.value) })}
                  className="w-full accent-sky-500 cursor-pointer mt-1"
                />
              </div>
            </div>
          </div>

          {/* Section 2: LLM & Modalities */}
          <div className="space-y-4 border-t border-white/10 pt-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              <span>Realtime LLM Model & Modality</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* LLM Model */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Realtime AI Model</label>
                <select
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  <option value="inworld/models/gemma-4-26b-a4b-it">Gemma 4 26B (Free On-Demand, Inworld Hosted)</option>
                  <option value="inworld/models/qwen3.8-27b">Qwen 3.8 27B (Free On-Demand, Inworld Hosted)</option>
                  <option value="inworld/models/deepseek-v4-flash">DeepSeek V4 Flash (Inworld Hosted)</option>
                  <option value="inworld/models/GLM-5.2">GLM 5.2 (Inworld Hosted)</option>
                  <option value="google-ai-studio/gemini-2.5-flash">Gemini 2.5 Flash (Paid / Credit Tier)</option>
                  <option value="openai/gpt-4o-mini">GPT-4o Mini (Paid / Credit Tier)</option>
                </select>
              </div>

              {/* Output Modality */}
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
                <option value="es">Spanish (Español)</option>
                <option value="fr">French (Français)</option>
                <option value="ja">Japanese (日本語)</option>
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
