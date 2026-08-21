import type { ITool, ToolContext, ToolResult } from '../types.js';
import { GoogleOAuthService } from '../../auth/GoogleOAuthService.js';
import { GoogleCalendarService } from './GoogleCalendarService.js';
import { CalendarIntentClassifier } from './CalendarIntent.js';
import { CalendarStateManager } from './CalendarStateManager.js';

export class GoogleCalendarTool implements ITool {
  public name = 'GoogleCalendar';
  public description =
    'Provides Google Calendar capabilities: schedule reading, availability checks, event creation with confirmation, event updates, and cancellations.';

  private oauthService = GoogleOAuthService.getInstance();
  private calendarService = GoogleCalendarService.getInstance();
  private stateManager = CalendarStateManager.getInstance();

  public async isAvailable(): Promise<boolean> {
    return this.oauthService.getConnectionStatus().connected;
  }

  public async canHandle(userMessage: string, context: ToolContext): Promise<boolean> {
    // 1. If there's an active pending action for this session, this tool handles follow-up (yes/no/details)
    const pending = this.stateManager.getActiveAction(context.sessionId);
    if (pending) {
      return true;
    }

    // 2. Otherwise parse intent
    const parsed = CalendarIntentClassifier.parseIntent(userMessage);
    return parsed.action !== 'NONE' && parsed.confidence >= 0.6;
  }

  public async execute(userMessage: string, context: ToolContext): Promise<ToolResult> {
    const isConnected = await this.isAvailable();
    if (!isConnected) {
      return {
        success: false,
        toolName: this.name,
        action: 'AUTH_REQUIRED',
        summary:
          'Google Calendar is not connected yet. Please connect your Google Calendar in the Settings menu to enable scheduling.',
        error: 'AUTH_REQUIRED',
      };
    }

    const pending = this.stateManager.getActiveAction(context.sessionId);
    const parsed = CalendarIntentClassifier.parseIntent(userMessage);

    // =========================================================================
    // CASE A: User gave Confirmation ("Yes", "हाँ", "Confirm")
    // =========================================================================
    if (parsed.action === 'CONFIRM_ACTION' && pending) {
      if (pending.status === 'READY_FOR_CONFIRMATION') {
        return await this.executeConfirmedAction(pending, context);
      }
    }

    // =========================================================================
    // CASE B: User gave Cancellation ("No", "Cancel", "Mat karo")
    // =========================================================================
    if (parsed.action === 'CANCEL_ACTION' && pending) {
      this.stateManager.setStatus(context.sessionId, 'CANCELLED');
      return {
        success: true,
        toolName: this.name,
        action: 'CANCELLED',
        summary: 'Action cancelled. I did not make any changes to your Google Calendar.',
      };
    }

    // =========================================================================
    // CASE C: Active Pending Action in Progress (Collecting Missing Details)
    // =========================================================================
    if (pending && (pending.status === 'COLLECTING_INFORMATION' || parsed.action === 'CREATE_EVENT')) {
      const updated = this.stateManager.updateDraft(context.sessionId, parsed);

      if (updated.missingFields.length > 0) {
        const nextMissing = updated.missingFields[0];
        let prompt = `What ${nextMissing} would you like for this event?`;
        if (nextMissing === 'time') {
          prompt = 'What time would you like the meeting?';
        } else if (nextMissing === 'title') {
          prompt = 'What should be the title of the event?';
        }
        return {
          success: true,
          toolName: this.name,
          action: 'COLLECTING_INFORMATION',
          summary: prompt,
          requiresFollowUp: true,
          pendingAction: updated as unknown as Record<string, unknown>,
        };
      }

      // Draft is now complete -> Create event directly
      try {
        const created = await this.calendarService.createEvent({
          title: updated.eventDraft.title || 'New Event',
          startDateTime: updated.eventDraft.startDateTime!,
          endDateTime: updated.eventDraft.endDateTime!,
          description: updated.eventDraft.description,
          location: updated.eventDraft.location || parsed.location,
          attendees: updated.eventDraft.attendees,
          reminderMinutes: updated.eventDraft.reminderMinutes || parsed.reminderMinutes,
          calendarId: updated.eventDraft.calendarId,
        });

        this.stateManager.setStatus(context.sessionId, 'COMPLETED');
        const start = new Date(updated.eventDraft.startDateTime!);
        const dateStr = start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

        let summary = `Done! I've added "${created.title}" for ${dateStr} at ${timeStr}`;
        if (parsed.location || updated.eventDraft.location) {
          summary += ` at ${parsed.location || updated.eventDraft.location}`;
        }
        if (updated.eventDraft.reminderMinutes && updated.eventDraft.reminderMinutes.length > 0) {
          summary += ` with a ${updated.eventDraft.reminderMinutes[0]}-minute reminder`;
        }
        summary += ` to your Google Calendar.`;

        return {
          success: true,
          toolName: this.name,
          action: 'CREATE_EVENT',
          summary,
          data: created as unknown as Record<string, unknown>,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          toolName: this.name,
          action: 'ERROR',
          summary: `Failed to create event in Google Calendar: ${message}`,
          error: message,
        };
      }
    }

    // =========================================================================
    // CASE D: Fresh Calendar Requests (Reads, Checks, Starts)
    // =========================================================================
    switch (parsed.action) {
      case 'GET_TODAY_SCHEDULE': {
        const events = await this.calendarService.getTodaySchedule(parsed.calendarTarget);
        if (events.length === 0) {
          return {
            success: true,
            toolName: this.name,
            action: 'GET_TODAY_SCHEDULE',
            summary: 'You have no events scheduled for today. Your calendar is clear!',
            data: { count: 0, events: [] },
          };
        }
        const eventList = events
          .map((e) => `${e.title} at ${new Date(e.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`)
          .join(', ');
        return {
          success: true,
          toolName: this.name,
          action: 'GET_TODAY_SCHEDULE',
          summary: `You have ${events.length} event${events.length > 1 ? 's' : ''} today: ${eventList}.`,
          data: { count: events.length, events },
        };
      }

      case 'GET_TOMORROW_SCHEDULE': {
        const events = await this.calendarService.getTomorrowSchedule(parsed.calendarTarget);
        if (events.length === 0) {
          return {
            success: true,
            toolName: this.name,
            action: 'GET_TOMORROW_SCHEDULE',
            summary: 'You have nothing scheduled for tomorrow. You are completely free!',
            data: { count: 0, events: [] },
          };
        }
        const eventList = events
          .map((e) => `${e.title} at ${new Date(e.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`)
          .join(', ');
        return {
          success: true,
          toolName: this.name,
          action: 'GET_TOMORROW_SCHEDULE',
          summary: `Tomorrow you have ${events.length} event${events.length > 1 ? 's' : ''}: ${eventList}.`,
          data: { count: events.length, events },
        };
      }

      case 'GET_UPCOMING_EVENTS': {
        const events = await this.calendarService.getUpcomingEvents(5, parsed.calendarTarget);
        if (events.length === 0) {
          return {
            success: true,
            toolName: this.name,
            action: 'GET_UPCOMING_EVENTS',
            summary: 'You have no upcoming events on your calendar.',
            data: { count: 0, events: [] },
          };
        }
        const first = events[0];
        const dateStr = new Date(first.start).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = new Date(first.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        return {
          success: true,
          toolName: this.name,
          action: 'GET_UPCOMING_EVENTS',
          summary: `Your next event is "${first.title}" on ${dateStr} at ${timeStr}. In total you have ${events.length} upcoming events.`,
          data: { count: events.length, events },
        };
      }

      case 'CHECK_AVAILABILITY': {
        if (!parsed.startDateTime || !parsed.endDateTime) {
          return {
            success: true,
            toolName: this.name,
            action: 'CHECK_AVAILABILITY',
            summary: 'What date and time would you like me to check your availability for?',
            requiresFollowUp: true,
          };
        }
        const { isFree, conflictingEvents } = await this.calendarService.checkAvailability(
          parsed.startDateTime,
          parsed.endDateTime,
          parsed.calendarTarget
        );
        const timeStr = new Date(parsed.startDateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        if (isFree) {
          return {
            success: true,
            toolName: this.name,
            action: 'CHECK_AVAILABILITY',
            summary: `Yes! You are completely free at ${timeStr} with no conflicts.`,
            data: { isFree: true },
          };
        }
        const conflicts = conflictingEvents.map((e) => `"${e.title}"`).join(', ');
        return {
          success: true,
          toolName: this.name,
          action: 'CHECK_AVAILABILITY',
          summary: `You are busy at ${timeStr}. You have conflicting event: ${conflicts}.`,
          data: { isFree: false, conflictingEvents },
        };
      }

      case 'FIND_FREE_TIME': {
        const targetDate = parsed.startDateTime ? new Date(parsed.startDateTime) : new Date();
        const slots = await this.calendarService.findFreeTime(targetDate, parsed.durationMinutes || 60, parsed.calendarTarget);
        if (slots.length === 0) {
          return {
            success: true,
            toolName: this.name,
            action: 'FIND_FREE_TIME',
            summary: `You have no free slots available on ${targetDate.toLocaleDateString()}.`,
            data: { slots: [] },
          };
        }
        const formattedSlots = slots
          .slice(0, 3)
          .map((s) => `${new Date(s.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} to ${new Date(s.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`)
          .join(', ');
        return {
          success: true,
          toolName: this.name,
          action: 'FIND_FREE_TIME',
          summary: `You have free slots available: ${formattedSlots}.`,
          data: { slots },
        };
      }

      case 'SEARCH_EVENTS': {
        const query = parsed.searchQuery || parsed.title || '';
        const events = await this.calendarService.searchEvents(query, undefined, undefined, parsed.calendarTarget);
        if (events.length === 0) {
          return {
            success: true,
            toolName: this.name,
            action: 'SEARCH_EVENTS',
            summary: `I could not find any events matching "${query}".`,
            data: { events: [] },
          };
        }
        const eventDescriptions = events
          .slice(0, 3)
          .map((e) => `"${e.title}" on ${new Date(e.start).toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${new Date(e.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`)
          .join('; ');
        return {
          success: true,
          toolName: this.name,
          action: 'SEARCH_EVENTS',
          summary: `I found ${events.length} event${events.length > 1 ? 's' : ''}: ${eventDescriptions}.`,
          data: { events },
        };
      }

      case 'CREATE_EVENT': {
        const action = this.stateManager.createAction(context.sessionId, 'CREATE_EVENT', parsed);
        if (action.missingFields.length > 0) {
          const nextMissing = action.missingFields[0];
          let prompt = `What ${nextMissing} would you like for this meeting?`;
          if (nextMissing === 'time') {
            prompt = 'What date or time would you like to schedule this event?';
          }
          return {
            success: true,
            toolName: this.name,
            action: 'COLLECTING_INFORMATION',
            summary: prompt,
            requiresFollowUp: true,
            pendingAction: action as unknown as Record<string, unknown>,
          };
        }

        // Direct creation on Google Calendar API
        try {
          const created = await this.calendarService.createEvent({
            title: action.eventDraft.title || 'New Event',
            startDateTime: action.eventDraft.startDateTime!,
            endDateTime: action.eventDraft.endDateTime!,
            description: action.eventDraft.description,
            location: action.eventDraft.location || parsed.location,
            attendees: action.eventDraft.attendees,
            reminderMinutes: action.eventDraft.reminderMinutes || parsed.reminderMinutes,
            calendarId: action.eventDraft.calendarId,
          });

          this.stateManager.setStatus(context.sessionId, 'COMPLETED');
          const start = new Date(action.eventDraft.startDateTime!);
          const dateStr = start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
          const timeStr = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

          let summary = `Done! I've added "${created.title}" for ${dateStr} at ${timeStr}`;
          if (parsed.location) summary += ` at ${parsed.location}`;
          if (parsed.reminderMinutes && parsed.reminderMinutes.length > 0) {
            summary += ` with a ${parsed.reminderMinutes[0]}-minute reminder`;
          }
          summary += ` to your Google Calendar.`;

          return {
            success: true,
            toolName: this.name,
            action: 'CREATE_EVENT',
            summary,
            data: created as unknown as Record<string, unknown>,
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            success: false,
            toolName: this.name,
            action: 'ERROR',
            summary: `Failed to create event in Google Calendar: ${message}`,
            error: message,
          };
        }
      }

      case 'DELETE_EVENT': {
        const query = parsed.title || parsed.searchQuery || '';
        const matching = await this.calendarService.searchEvents(query);
        if (matching.length === 0) {
          return {
            success: false,
            toolName: this.name,
            action: 'DELETE_EVENT',
            summary: `I couldn't find any meeting matching "${query}" to delete.`,
          };
        }
        const targetEvent = matching[0];
        const action = this.stateManager.createAction(context.sessionId, 'DELETE_EVENT', parsed);
        action.eventDraft.selectedEventId = targetEvent.id;
        action.eventDraft.title = targetEvent.title;
        action.status = 'READY_FOR_CONFIRMATION';

        const timeStr = new Date(targetEvent.start).toLocaleString([], {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
        const summary = `I found "${targetEvent.title}" scheduled for ${timeStr}. Would you like me to delete this event from your Google Calendar?`;
        action.confirmationPrompt = summary;

        return {
          success: true,
          toolName: this.name,
          action: 'READY_FOR_CONFIRMATION',
          summary,
          requiresFollowUp: true,
          pendingAction: action as unknown as Record<string, unknown>,
        };
      }

      case 'UPDATE_EVENT': {
        const query = parsed.title || parsed.searchQuery || '';
        const matching = await this.calendarService.searchEvents(query);
        if (matching.length === 0) {
          return {
            success: false,
            toolName: this.name,
            action: 'UPDATE_EVENT',
            summary: `I couldn't find any meeting matching "${query}" to update.`,
          };
        }
        const targetEvent = matching[0];
        const action = this.stateManager.createAction(context.sessionId, 'UPDATE_EVENT', parsed);
        action.eventDraft.selectedEventId = targetEvent.id;
        action.eventDraft.title = targetEvent.title;
        action.status = 'READY_FOR_CONFIRMATION';

        const newTimeStr = parsed.startDateTime
          ? new Date(parsed.startDateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
          : 'the new time';
        const summary = `"${targetEvent.title}" is currently at ${new Date(targetEvent.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Would you like me to move it to ${newTimeStr}?`;
        action.confirmationPrompt = summary;

        return {
          success: true,
          toolName: this.name,
          action: 'READY_FOR_CONFIRMATION',
          summary,
          requiresFollowUp: true,
          pendingAction: action as unknown as Record<string, unknown>,
        };
      }

      default:
        return {
          success: false,
          toolName: this.name,
          action: 'NONE',
          summary: 'Could not process calendar action.',
        };
    }
  }

  private async prepareCreateConfirmation(action: import('./CalendarStateManager.js').PendingCalendarAction): Promise<ToolResult> {
    const draft = action.eventDraft;
    const start = new Date(draft.startDateTime!);
    const end = new Date(draft.endDateTime!);
    const dateStr = start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} to ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;

    // Check availability conflict
    const { isFree } = await this.calendarService.checkAvailability(
      draft.startDateTime!,
      draft.endDateTime!,
      draft.calendarId
    );

    let summary = `I have "${draft.title || 'Meeting'}" on ${dateStr} from ${timeStr}.`;
    if (!isFree) {
      summary += ' (Note: you have a conflicting event during this slot).';
    }
    if (draft.reminderMinutes && draft.reminderMinutes.length > 0) {
      summary += ` with a reminder ${draft.reminderMinutes[0]} minutes before.`;
    }
    summary += ' Would you like me to add it to your Google Calendar?';

    action.confirmationPrompt = summary;
    action.status = 'READY_FOR_CONFIRMATION';

    return {
      success: true,
      toolName: this.name,
      action: 'READY_FOR_CONFIRMATION',
      summary,
      requiresFollowUp: true,
      pendingAction: action as unknown as Record<string, unknown>,
    };
  }

  private async executeConfirmedAction(
    pending: import('./CalendarStateManager.js').PendingCalendarAction,
    context: ToolContext
  ): Promise<ToolResult> {
    this.stateManager.setStatus(context.sessionId, 'EXECUTING');

    try {
      if (pending.actionType === 'CREATE_EVENT') {
        const created = await this.calendarService.createEvent({
          title: pending.eventDraft.title || 'Meeting',
          startDateTime: pending.eventDraft.startDateTime!,
          endDateTime: pending.eventDraft.endDateTime!,
          description: pending.eventDraft.description,
          location: pending.eventDraft.location,
          attendees: pending.eventDraft.attendees,
          reminderMinutes: pending.eventDraft.reminderMinutes,
          calendarId: pending.eventDraft.calendarId,
        });

        this.stateManager.setStatus(context.sessionId, 'COMPLETED');
        return {
          success: true,
          toolName: this.name,
          action: 'CREATE_EVENT',
          summary: `Done! I've added "${created.title}" to your Google Calendar.`,
          data: created as unknown as Record<string, unknown>,
        };
      }

      if (pending.actionType === 'DELETE_EVENT') {
        if (!pending.eventDraft.selectedEventId) {
          throw new Error('No event was selected for deletion.');
        }
        await this.calendarService.deleteEvent(pending.eventDraft.selectedEventId, pending.eventDraft.calendarId);
        this.stateManager.setStatus(context.sessionId, 'COMPLETED');
        return {
          success: true,
          toolName: this.name,
          action: 'DELETE_EVENT',
          summary: `Done! The meeting "${pending.eventDraft.title || 'event'}" has been removed from your Google Calendar.`,
        };
      }

      if (pending.actionType === 'UPDATE_EVENT') {
        if (!pending.eventDraft.selectedEventId) {
          throw new Error('No event was selected for update.');
        }
        const updated = await this.calendarService.updateEvent(pending.eventDraft.selectedEventId, {
          title: pending.eventDraft.title,
          startDateTime: pending.eventDraft.startDateTime,
          endDateTime: pending.eventDraft.endDateTime,
          calendarId: pending.eventDraft.calendarId,
        });

        this.stateManager.setStatus(context.sessionId, 'COMPLETED');
        return {
          success: true,
          toolName: this.name,
          action: 'UPDATE_EVENT',
          summary: `Done! I've updated "${updated.title}" on your Google Calendar.`,
          data: updated as unknown as Record<string, unknown>,
        };
      }

      throw new Error(`Unsupported action type: ${pending.actionType}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.stateManager.setStatus(context.sessionId, 'ERROR');
      return {
        success: false,
        toolName: this.name,
        action: 'ERROR',
        summary: `Failed to update calendar: ${message}`,
        error: message,
      };
    }
  }
}
