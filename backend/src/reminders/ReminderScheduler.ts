import { GoogleCalendarService, CalendarEventSummary } from '../tools/calendar/GoogleCalendarService.js';
import { GoogleOAuthService } from '../auth/GoogleOAuthService.js';

export interface ProactiveReminderNotification {
  type: 'calendar.reminder';
  eventId: string;
  title: string;
  start: string;
  minutesUntilStart: number;
  message: string;
  spokenText: string;
}

export class ReminderScheduler {
  private static instance: ReminderScheduler;
  private calendarService = GoogleCalendarService.getInstance();
  private oauthService = GoogleOAuthService.getInstance();

  private intervalTimer: NodeJS.Timeout | null = null;
  private notifiedEventMap = new Map<string, number>(); // eventId -> notified timestamp
  private broadcastCallbacks: Set<(notification: ProactiveReminderNotification) => void> = new Set();

  private constructor() {}

  public static getInstance(): ReminderScheduler {
    if (!ReminderScheduler.instance) {
      ReminderScheduler.instance = new ReminderScheduler();
    }
    return ReminderScheduler.instance;
  }

  public registerBroadcastCallback(callback: (notification: ProactiveReminderNotification) => void): () => void {
    this.broadcastCallbacks.add(callback);
    return () => {
      this.broadcastCallbacks.delete(callback);
    };
  }

  public start(pollIntervalMs = 60000): void {
    if (this.intervalTimer) return;

    console.log('[ReminderScheduler] Starting proactive Google Calendar reminder monitor...');
    this.checkReminders();
    this.intervalTimer = setInterval(() => {
      this.checkReminders();
    }, pollIntervalMs);
  }

  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
      console.log('[ReminderScheduler] Stopped reminder monitor.');
    }
  }

  public snoozeEvent(eventId: string, snoozeMinutes = 5): void {
    // Postpone notification for snoozeMinutes
    const snoozeUntil = Date.now() + snoozeMinutes * 60 * 1000;
    this.notifiedEventMap.set(eventId, snoozeUntil);
    console.log(`[ReminderScheduler] Snoozed reminder for event ${eventId} for ${snoozeMinutes} minutes.`);
  }

  private async checkReminders(): Promise<void> {
    const isConnected = this.oauthService.getConnectionStatus().connected;
    if (!isConnected) {
      return;
    }

    try {
      // Check upcoming events in the next 15 minutes
      const upcoming = await this.calendarService.getUpcomingEvents(5);
      const now = Date.now();

      for (const event of upcoming) {
        if (!event.start || event.isAllDay) continue;

        const startTime = new Date(event.start).getTime();
        const diffMinutes = Math.round((startTime - now) / 60000);

        // Notify if starting within 1 to 15 minutes
        if (diffMinutes >= 0 && diffMinutes <= 15) {
          const lastNotified = this.notifiedEventMap.get(event.id);
          // If already notified or snoozed, skip until snooze time passes
          if (lastNotified && now < lastNotified) {
            continue;
          }

          // Mark as notified for 30 minutes
          this.notifiedEventMap.set(event.id, now + 30 * 60 * 1000);

          const timeString = new Date(event.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          const spokenText = diffMinutes <= 1
            ? `Your event "${event.title}" is starting right now!`
            : `Reminder: Your event "${event.title}" starts in ${diffMinutes} minutes at ${timeString}.`;

          const notification: ProactiveReminderNotification = {
            type: 'calendar.reminder',
            eventId: event.id,
            title: event.title,
            start: event.start,
            minutesUntilStart: diffMinutes,
            message: `Event starting in ${diffMinutes} min (${timeString})`,
            spokenText,
          };

          console.log(`[ReminderScheduler] Triggering proactive reminder for "${event.title}" (${diffMinutes}m remaining)`);
          this.broadcastCallbacks.forEach((cb) => {
            try {
              cb(notification);
            } catch (err) {
              console.warn('[ReminderScheduler] Error in broadcast callback:', err);
            }
          });
        }
      }
    } catch (err) {
      console.warn('[ReminderScheduler] Error checking calendar reminders:', err);
    }
  }
}
