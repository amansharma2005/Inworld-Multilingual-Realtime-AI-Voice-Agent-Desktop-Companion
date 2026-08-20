import http from 'http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { config, validateConfig } from './config/env.js';
import { InworldProxySession } from './services/inworldProxy.js';

const app = express();
app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path}`);
  next();
});

// Root endpoint with service info
app.get('/', (req, res) => {
  res.json({
    name: 'Inworld Realtime Voice Agent API',
    status: 'online',
    endpoints: {
      health: '/api/health',
      config: '/api/config',
      websocket: '/ws',
    },
    voice: config.inworldVoiceId,
    model: config.inworldModel,
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const validation = validateConfig();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    inworldConfigured: !!config.inworldApiKey,
    warnings: validation.warnings,
    errors: validation.errors,
  });
});

// Safe public configuration endpoint (no secrets exposed)
app.get('/api/config', (req, res) => {
  res.json({
    defaultVoiceId: config.inworldVoiceId,
    defaultVoiceName: 'Mukesh Sharma',
    defaultModel: config.inworldModel,
    defaultTtsModel: config.inworldTtsModel,
    availableModels: [
      { id: 'inworld/models/gemma-4-26b-a4b-it', name: 'Gemma 4 26B (Free On-Demand, Inworld Hosted)', provider: 'Inworld' },
      { id: 'inworld/models/qwen3.8-27b', name: 'Qwen 3.8 27B (Free On-Demand, Inworld Hosted)', provider: 'Inworld' },
      { id: 'inworld/models/deepseek-v4-flash', name: 'DeepSeek V4 Flash (Inworld Hosted)', provider: 'Inworld' },
      { id: 'inworld/models/GLM-5.2', name: 'GLM 5.2 (Inworld Hosted)', provider: 'Inworld' },
      { id: 'google-ai-studio/gemini-2.5-flash', name: 'Gemini 2.5 Flash (Paid / Credit Tier)', provider: 'Google' },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (Paid / Credit Tier)', provider: 'OpenAI' },
    ],
    availableTtsModels: [
      { id: 'inworld-tts-2', name: 'Inworld TTS-2 (Multilingual, 200+ Languages, High Quality)' },
      { id: 'inworld-tts-2-flash', name: 'Inworld TTS-2 Flash (Ultra Low Latency)' },
    ],
    hasApiKey: !!config.inworldApiKey,
  });
});

const server = http.createServer(app);

// WebSocket Server attached to /ws
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WSS] Client connected from ${clientIp}`);

  // Create an Inworld proxy session for this browser client
  const proxy = new InworldProxySession({
    browserWs: ws,
  });

  ws.on('close', () => {
    console.log(`[WSS] Client disconnected from ${clientIp}`);
    proxy.cleanup();
  });
});

const PORT = config.port;

const validation = validateConfig();
if (!validation.valid) {
  console.warn('\n======================================================');
  console.warn('⚠️  CONFIGURATION WARNINGS / ERRORS:');
  validation.errors.forEach((err) => console.error(`  - ${err}`));
  console.warn('======================================================\n');
}

server.listen(PORT, () => {
  console.log(`\n🚀 Inworld Voice Agent Backend Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket endpoint ready at ws://localhost:${PORT}/ws`);
  console.log(`🎤 Default Custom Voice: ${config.inworldVoiceId}`);
  console.log(`🧠 Default LLM Model: ${config.inworldModel}`);
  console.log(`🔊 Default TTS Model: ${config.inworldTtsModel}\n`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP and WebSocket server');
  wss.close(() => {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
});
