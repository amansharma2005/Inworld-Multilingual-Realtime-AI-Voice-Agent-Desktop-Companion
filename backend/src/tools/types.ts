/**
 * Extensible Tool Architecture Interface & Types
 * Designed for Google Calendar, Gmail, Reminders, Files, and Automation Tools.
 */

export interface ToolContext {
  userId?: string;
  sessionId: string;
  userMessage: string;
  language?: string; // 'en', 'hi', 'hinglish', 'auto'
  timezone?: string; // e.g. 'Asia/Kolkata', 'UTC'
  [key: string]: unknown;
}

export interface ToolResult {
  success: boolean;
  toolName: string;
  action: string;
  summary: string; // Clean concise summary for AI synthesis
  data?: Record<string, unknown> | Array<unknown> | null;
  error?: string;
  requiresFollowUp?: boolean;
  pendingAction?: Record<string, unknown> | null;
}

export interface ITool {
  name: string;
  description: string;
  isAvailable(context: ToolContext): Promise<boolean>;
  canHandle(userMessage: string, context: ToolContext): Promise<boolean>;
  execute(userMessage: string, context: ToolContext): Promise<ToolResult>;
}
