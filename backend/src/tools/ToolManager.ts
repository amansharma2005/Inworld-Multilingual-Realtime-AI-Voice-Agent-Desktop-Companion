import type { ITool, ToolContext, ToolResult } from './types.js';

export class ToolManager {
  private static instance: ToolManager;
  private tools: Map<string, ITool> = new Map();

  private constructor() {}

  public static getInstance(): ToolManager {
    if (!ToolManager.instance) {
      ToolManager.instance = new ToolManager();
    }
    return ToolManager.instance;
  }

  public registerTool(tool: ITool): void {
    console.log(`[ToolManager] Registering tool: ${tool.name}`);
    this.tools.set(tool.name, tool);
  }

  public getTool(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  public listTools(): Array<{ name: string; description: string }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
    }));
  }

  /**
   * Evaluates if any registered tool should handle the user's message.
   * Returns the first matching tool or null if normal chat should proceed.
   */
  public async findToolForMessage(
    userMessage: string,
    context: ToolContext
  ): Promise<ITool | null> {
    for (const tool of this.tools.values()) {
      try {
        const available = await tool.isAvailable(context);
        if (available) {
          const handles = await tool.canHandle(userMessage, context);
          if (handles) {
            return tool;
          }
        }
      } catch (err) {
        console.warn(`[ToolManager] Error checking tool ${tool.name}:`, err);
      }
    }
    return null;
  }

  /**
   * Executes a tool safely and returns a normalized structured result.
   */
  public async executeTool(
    toolName: string,
    userMessage: string,
    context: ToolContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        toolName,
        action: 'UNKNOWN',
        summary: `Tool '${toolName}' not found.`,
        error: `Tool '${toolName}' is not registered.`,
      };
    }

    try {
      console.log(`[ToolManager] Executing tool '${toolName}' for message: "${userMessage}"`);
      return await tool.execute(userMessage, context);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[ToolManager] Error executing tool '${toolName}':`, message);
      return {
        success: false,
        toolName,
        action: 'ERROR',
        summary: `An error occurred while executing ${toolName}: ${message}`,
        error: message,
      };
    }
  }
}
