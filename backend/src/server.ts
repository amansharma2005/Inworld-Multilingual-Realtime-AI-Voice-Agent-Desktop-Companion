import http from 'http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { config, validateConfig } from './config/env.js';
import { InworldProxySession } from './services/inworldProxy.js';
import { ToolManager } from './tools/ToolManager.js';
import { GoogleCalendarTool } from './tools/calendar/GoogleCalendarTool.js';
import { GoogleOAuthService } from './auth/GoogleOAuthService.js';
import { GoogleCalendarService } from './tools/calendar/GoogleCalendarService.js';
import { ReminderScheduler } from './reminders/ReminderScheduler.js';

// Initialize ToolManager and register GoogleCalendarTool
const toolManager = ToolManager.getInstance();
const googleCalendarTool = new GoogleCalendarTool();
toolManager.registerTool(googleCalendarTool);

// Initialize Services
const oauthService = GoogleOAuthService.getInstance();
const calendarService = GoogleCalendarService.getInstance();
const reminderScheduler = ReminderScheduler.getInstance();

// Start proactive reminder monitoring
reminderScheduler.start(60000);

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
    name: 'Inworld Realtime Voice Agent API with Google Calendar Tools',
    status: 'online',
    endpoints: {
      health: '/api/health',
      config: '/api/config',
      googleAuthUrl: '/api/auth/google/url',
      googleAuthStatus: '/api/auth/google/status',
      websocket: '/ws',
    },
    voice: config.inworldVoiceId,
    model: config.inworldModel,
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const validation = validateConfig();
  const calendarStatus = oauthService.getConnectionStatus();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    inworldConfigured: !!config.inworldApiKey,
    googleCalendarConnected: calendarStatus.connected,
    warnings: validation.warnings,
    errors: validation.errors,
  });
});

// Safe public configuration endpoint (no secrets exposed)
app.get('/api/config', (req, res) => {
  const calendarStatus = oauthService.getConnectionStatus();
  res.json({
    defaultVoiceId: config.inworldVoiceId,
    defaultVoiceName: config.inworldVoiceId.includes('mukesh') ? 'Mukesh Sharma' : 'Hindi Person',
    defaultModel: config.inworldModel,
    defaultTtsModel: config.inworldTtsModel,
    availableModels: [
      { id: 'inworld/models/deepseek-v4-flash', name: 'DeepSeek V4 Flash (Fast, Accurate Hindi)', provider: 'Inworld' },
      { id: 'inworld/models/gemma-4-26b-a4b-it', name: 'Gemma 4 26B (Free On-Demand)', provider: 'Inworld' },
      { id: 'inworld/models/qwen3.8-27b', name: 'Qwen 3.8 27B (Free On-Demand)', provider: 'Inworld' },
      { id: 'google-ai-studio/gemini-2.5-flash', name: 'Gemini 2.5 Flash (Google)', provider: 'Google' },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (OpenAI)', provider: 'OpenAI' },
    ],
    availableTtsModels: [
      { id: 'inworld-tts-2', name: 'Inworld TTS-2 (Multilingual, 200+ Languages, High Quality)' },
      { id: 'inworld-tts-2-flash', name: 'Inworld TTS-2 Flash (Ultra Low Latency)' },
    ],
    hasApiKey: !!config.inworldApiKey,
    googleCalendar: calendarStatus,
  });
});

// =============================================================================
// GOOGLE CALENDAR OAUTH REST ENDPOINTS
// =============================================================================

// Get Google OAuth Authorization URL
app.get('/api/auth/google/url', (req, res) => {
  try {
    const url = oauthService.getAuthUrl();
    res.json({ success: true, url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ success: false, error: message });
  }
});

// OAuth Redirect Callback Handler
app.get('/api/auth/google/callback', async (req, res) => {
  const code = req.query.code as string;
  if (!code) {
    return res.redirect(`${config.frontendUrl}?google_auth=failed&error=missing_code`);
  }

  try {
    await oauthService.handleAuthCallback(code);
    res.redirect(`${config.frontendUrl}?google_auth=success`);
  } catch (err) {
    console.error('[Google Auth] Callback error:', err);
    res.redirect(`${config.frontendUrl}?google_auth=failed`);
  }
});

// Get Google Calendar Connection Status
app.get('/api/auth/google/status', (req, res) => {
  const status = oauthService.getConnectionStatus();
  res.json(status);
});

// Disconnect Google Calendar
app.post('/api/auth/google/disconnect', async (req, res) => {
  try {
    await oauthService.disconnect();
    res.json({ success: true, message: 'Google Calendar disconnected.' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// List User Calendars
app.get('/api/calendar/list', async (req, res) => {
  try {
    const calendars = await calendarService.listCalendars();
    res.json({ success: true, calendars });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// Set Default Calendar
app.post('/api/calendar/default', (req, res) => {
  const { calendarId } = req.body;
  if (!calendarId) {
    return res.status(400).json({ success: false, error: 'calendarId is required' });
  }
  oauthService.setDefaultCalendar(calendarId);
  res.json({ success: true, defaultCalendarId: calendarId });
});

// Snooze Reminder
app.post('/api/reminders/snooze', (req, res) => {
  const { eventId, minutes } = req.body;
  if (!eventId) {
    return res.status(400).json({ success: false, error: 'eventId is required' });
  }
  reminderScheduler.snoozeEvent(eventId, minutes || 5);
  res.json({ success: true, eventId, snoozedMinutes: minutes || 5 });
});

// =============================================================================
// WEBSOCKET SERVER ATTACHMENT
// =============================================================================

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WSS] Client connected from ${clientIp}`);

  // Create an Inworld proxy session with ToolManager integration
  const proxy = new InworldProxySession({
    browserWs: ws,
  });

  // Subscribe to proactive reminders
  const unsubscribeReminder = reminderScheduler.registerBroadcastCallback((notification) => {
    proxy.sendToBrowser({
      type: 'calendar.reminder',
      reminder: notification,
    });
  });

  ws.on('close', () => {
    console.log(`[WSS] Client disconnected from ${clientIp}`);
    unsubscribeReminder();
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
  console.log(`🔊 Default TTS Model: ${config.inworldTtsModel}`);
  console.log(`📅 Google Calendar Tools: Active & Integrated\n`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP and WebSocket server');
  reminderScheduler.stop();
  wss.close(() => {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
});
