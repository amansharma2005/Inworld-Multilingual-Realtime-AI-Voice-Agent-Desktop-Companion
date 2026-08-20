# 🎙️ Inworld Multilingual Realtime AI Voice Agent & Desktop Companion

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-cyan.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-purple.svg)](https://vitejs.dev/)
[![Electron](https://img.shields.io/badge/Electron-33.4-lightblue.svg)](https://www.electronjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![Inworld AI](https://img.shields.io/badge/Inworld_AI-Realtime_API-0284c7.svg)](https://inworld.ai/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A production-grade, ultra-low-latency, multilingual conversational AI assistant powered by the **Inworld AI Realtime API**. Supports real-time text and audio streaming, custom Inworld voices (e.g. *Mukesh Sharma* & *Hindi Person*), natural Devanagari Hindi orthography, seamless barge-in interruption, and a dual-experience architecture with both a **Full Web Control Center** and an **Always-on-Top Floating Desktop AI Companion**.

---

## 🌟 Key Highlights

- 🗣️ **Multilingual Conversational Intelligence**: Speaks and understands Hindi (Devanagari script), Hinglish, and English with 100% accurate grammar and pronunciation.
- ⚡ **Ultra-Low Latency Streaming**: Progressive text and native PCM16 audio chunks stream in real-time as the AI generates its thoughts.
- 🔊 **Custom Inworld Voices**: Built-in support for custom voice cloning using **Inworld TTS-2** (defaulting to *Mukesh Sharma* `zippy-kite-2028__mukesh_sharma_voice`).
- ✋ **Automatic Barge-in / Interruption**: Speak or type mid-sentence and the assistant instantly cancels previous audio and seamlessly shifts to the new topic.
- 🛸 **Dual Experience Architecture**:
  - **Experience A — Full Web App**: Standalone web control center with full conversation history, audio replayer, live waveforms, and settings.
  - **Experience B — Floating Desktop AI Companion**: Frameless, transparent, draggable circular assistant on your screen with global hotkeys (`Ctrl + Space`), system tray, and background execution.

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          User Interface                                │
├──────────────────────────────────┬─────────────────────────────────────┤
│  [Experience A: Web Control Center]  │  [Experience B: Desktop Companion]  │
│  • Full chat history             │  • Always-on-top transparent orb    │
│  • Audio waveform visualizer     │  • Global shortcut (Ctrl + Space)   │
│  • Live voice & model switcher   │  • Compact floating keyboard panel  │
│  • Message replay & diagnostics  │  • System tray background mode      │
└─────────────────┬────────────────┴──────────────────┬──────────────────┘
                  │                                   │
                  └─────────────────┬─────────────────┘
                                    │ (WebSocket / Audio Stream)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Node.js / Express Proxy Server                     │
│  • Bi-directional WebSocket bridge                                     │
│  • Inworld session orchestration & voice configuration                 │
│  • API key security (keys stay safe on server)                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Inworld Realtime Protocol)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          Inworld AI Cloud                              │
│  • LLM Engine: DeepSeek V4 Flash / Gemini 2.5 Flash                    │
│  • Voice Synthesis: Inworld TTS-2 with Custom Voices                   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v18.0.0 or later ([Download Node.js](https://nodejs.org/))
- **Inworld AI API Key**: Get your Base64 API key from [Inworld Studio](https://platform.inworld.ai/) -> *Settings* -> *API Keys*.

### 2. Clone the Repository
```bash
git clone https://github.com/your-username/voice-agent-inworld.git
cd voice-agent-inworld
```

### 3. Install All Dependencies
```bash
npm install
npm install --prefix backend
npm install --prefix frontend
npm install --prefix desktop
```
*(Or run `npm run install:all` / on Windows PowerShell: `npm.cmd run install:all`)*

### 4. Configure Environment Variables
Copy `.env.example` to `.env` in the root directory:
```bash
cp .env.example .env
```
Open `.env` and insert your Inworld API credentials:
```env
INWORLD_API_KEY=your_inworld_base64_api_key_here
INWORLD_VOICE_ID=zippy-kite-2028__mukesh_sharma_voice
INWORLD_MODEL=inworld/models/deepseek-v4-flash
INWORLD_TTS_MODEL=inworld-tts-2
PORT=4000
```

---

## 💻 Running the Application

### Option A: Run the Floating Desktop AI Companion (Recommended)
Launches the backend, frontend, and the Electron desktop floating assistant:
```bash
# Windows PowerShell
npm.cmd run dev:desktop

# macOS / Linux
npm run dev:desktop
```
- **Activate Voice**: Press `Ctrl + Space` or `Alt + Space` anywhere on your computer.
- **Click the Orb**: Opens the 3-action menu (*Mute*, *Keyboard*, *Open Full Web App*).
- **Drag & Position**: Drag the orb anywhere; it saves coordinates across restarts.
- **System Tray**: Right-click the system tray icon for quick controls or to quit.

---

### Option B: Run the Full Web Control Center
Launches the standalone web application in your browser:
```bash
# Windows PowerShell
npm.cmd run dev

# macOS / Linux
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 🛠️ Project Structure

```
voice-agent-inworld/
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules for node_modules, build, secrets
├── LICENSE                   # MIT License
├── package.json              # Root orchestration scripts
├── backend/                  # Node.js WebSocket backend & Inworld proxy
│   ├── src/
│   │   ├── config/env.ts     # Validated environment configuration
│   │   ├── services/         # Inworld Realtime API WebSocket proxy
│   │   └── server.ts         # Express server & WebSocket entrypoint
│   ├── package.json
│   └── tsconfig.json
├── frontend/                 # React + Vite + Tailwind CSS frontend
│   ├── src/
│   │   ├── components/       # Chat, audio waveform, settings, navbar
│   │   │   └── floating/     # Floating orb, menu, compact keyboard panel
│   │   ├── hooks/            # useRealtimeSession hook
│   │   ├── services/         # AudioPlaybackManager (PCM16 Web Audio streaming)
│   │   ├── App.tsx           # Dual-mode router (Web vs. Desktop)
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
└── desktop/                  # Electron Desktop Shell
    ├── src/
    │   ├── main/main.ts      # Transparent window, tray, global shortcuts, IPC
    │   └── preload/preload.ts# Context bridge for renderer
    ├── package.json
    └── tsconfig.json
```

---

## ⚙️ Environment Variables Reference

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `INWORLD_API_KEY` | **Yes** | `None` | Base64-encoded Inworld API Key. |
| `INWORLD_VOICE_ID` | No | `zippy-kite-2028__mukesh_sharma_voice` | Custom voice ID (e.g. Mukesh Sharma or Hindi Person). |
| `INWORLD_MODEL` | No | `inworld/models/deepseek-v4-flash` | Selected LLM model. |
| `INWORLD_TTS_MODEL` | No | `inworld-tts-2` | Inworld TTS engine (`inworld-tts-2` or `inworld-tts-2-flash`). |
| `PORT` | No | `4000` | Backend proxy server port. |
| `VITE_PORT` | No | `5173` | Frontend Vite dev server port. |

---

## 📦 Building for Production

To compile TypeScript and bundle all packages:
```bash
npm.cmd run build
```

---

## 🔒 Security Best Practices

- **Never commit `.env`**: Your `.env` file contains private API credentials. It is listed in `.gitignore` to prevent accidental commits.
- **Server-Side Proxy**: API keys are securely held on the backend proxy server and never exposed to the frontend client.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
