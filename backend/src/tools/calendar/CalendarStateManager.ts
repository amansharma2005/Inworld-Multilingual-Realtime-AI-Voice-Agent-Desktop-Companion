import type { CalendarActionType, ExtractedCalendarEntities } from './CalendarIntent.js';

export type CalendarWorkflowState =
  | 'IDLE'
  | 'COLLECTING_INFORMATION'
  | 'SEARCHING_EVENT'
  | 'CHECKING_AVAILABILITY'
  | 'READY_FOR_CONFIRMATION'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ERROR';

export interface EventDraft {
  title?: string;
  startDateTime?: string; // ISO
  endDateTime?: string;   // ISO
  durationMinutes?: number;
  location?: string;
  description?: string;
  attendees?: string[];
  reminderMinutes?: number[];
  calendarId?: string;
  selectedEventId?: string;
}

export interface PendingCalendarAction {
  id: string;
  sessionId: string;
  actionType: CalendarActionType;
  status: CalendarWorkflowState;
  eventDraft: EventDraft;
  missingFields: string[];
  confirmationRequired: boolean;
  confirmationPrompt?: string;
  createdAt: number;
  expiresAt: number; // 5 min expiry
}

export class CalendarStateManager {
  private static instance: CalendarStateManager;
  private pendingActions: Map<string, PendingCalendarAction> = new Map();

  private constructor() {}

  public static getInstance(): CalendarStateManager {
    if (!CalendarStateManager.instance) {
      CalendarStateManager.instance = new CalendarStateManager();
    }
    return CalendarStateManager.instance;
  }

  public getActiveAction(sessionId: string): PendingCalendarAction | null {
    const action = this.pendingActions.get(sessionId);
    if (!action) return null;

    // Check expiration (5 minutes TTL)
    if (Date.now() > action.expiresAt) {
      console.log(`[CalendarStateManager] Pending action for session ${sessionId} expired.`);
      this.pendingActions.delete(sessionId);
      return null;
    }

    if (action.status === 'COMPLETED' || action.status === 'CANCELLED') {
      return null;
    }

    return action;
  }

  public createAction(
    sessionId: string,
    actionType: CalendarActionType,
    initialEntities: ExtractedCalendarEntities
  ): PendingCalendarAction {
    const draft: EventDraft = {
      title: initialEntities.title,
      startDateTime: initialEntities.startDateTime,
      endDateTime: initialEntities.endDateTime,
      durationMinutes: initialEntities.durationMinutes || 60,
      reminderMinutes: initialEntities.reminderMinutes,
      calendarId: initialEntities.calendarTarget,
    };

    const missingFields: string[] = [];
    if (!draft.title) missingFields.push('title');
    if (!draft.startDateTime) missingFields.push('time');

    const status: CalendarWorkflowState =
      missingFields.length > 0 ? 'COLLECTING_INFORMATION' : 'READY_FOR_CONFIRMATION';

    const action: PendingCalendarAction = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sessionId,
      actionType,
      status,
      eventDraft: draft,
      missingFields,
      confirmationRequired: true,
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes TTL
    };

    this.pendingActions.set(sessionId, action);
    return action;
  }

  /**
   * Merges multi-turn updates into the ongoing draft (e.g. "Actually make it Friday" or "At 5 PM")
   */
  public updateDraft(
    sessionId: string,
    entities: ExtractedCalendarEntities
  ): PendingCalendarAction {
    let action = this.getActiveAction(sessionId);
    if (!action) {
      action = this.createAction(sessionId, entities.action, entities);
    }

    // Merge non-empty fields
    if (entities.title && entities.title !== 'New Meeting') {
      action.eventDraft.title = entities.title;
    }
    if (entities.startDateTime) {
      action.eventDraft.startDateTime = entities.startDateTime;
      if (entities.endDateTime) {
        action.eventDraft.endDateTime = entities.endDateTime;
      } else {
        const duration = action.eventDraft.durationMinutes || 60;
        const end = new Date(new Date(entities.startDateTime).getTime() + duration * 60 * 1000);
        action.eventDraft.endDateTime = end.toISOString();
      }
    }
    if (entities.durationMinutes) {
      action.eventDraft.durationMinutes = entities.durationMinutes;
      if (action.eventDraft.startDateTime) {
        const start = new Date(action.eventDraft.startDateTime).getTime();
        const end = new Date(start + entities.durationMinutes * 60 * 1000);
        action.eventDraft.endDateTime = end.toISOString();
      }
    }
    if (entities.reminderMinutes) {
      action.eventDraft.reminderMinutes = entities.reminderMinutes;
    }

    // Re-evaluate missing fields
    const missing: string[] = [];
    if (!action.eventDraft.title) missing.push('title');
    if (!action.eventDraft.startDateTime) missing.push('time');

    action.missingFields = missing;
    action.status = missing.length > 0 ? 'COLLECTING_INFORMATION' : 'READY_FOR_CONFIRMATION';
    action.expiresAt = Date.now() + 5 * 60 * 1000;

    this.pendingActions.set(sessionId, action);
    return action;
  }

  public setStatus(sessionId: string, status: CalendarWorkflowState): void {
    const action = this.pendingActions.get(sessionId);
    if (action) {
      action.status = status;
      if (status === 'COMPLETED' || status === 'CANCELLED') {
        this.pendingActions.delete(sessionId);
      }
    }
  }

  public clearAction(sessionId: string): void {
    this.pendingActions.delete(sessionId);
  }
}
