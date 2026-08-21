import { google, calendar_v3 } from 'googleapis';
import { GoogleOAuthService } from '../../auth/GoogleOAuthService.js';

export interface CalendarEventSummary {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  attendees?: string[];
  hangoutLink?: string;
  htmlLink?: string;
  isAllDay: boolean;
  status?: string;
}

export interface CreateEventInput {
  title: string;
  startDateTime: string; // ISO String
  endDateTime: string;   // ISO String
  description?: string;
  location?: string;
  attendees?: string[];
  reminderMinutes?: number[];
  calendarId?: string;
}

export interface UpdateEventInput {
  title?: string;
  startDateTime?: string;
  endDateTime?: string;
  description?: string;
  location?: string;
  attendees?: string[];
  reminderMinutes?: number[];
  calendarId?: string;
}

export class GoogleCalendarService {
  private static instance: GoogleCalendarService;
  private oauthService: GoogleOAuthService;

  private constructor() {
    this.oauthService = GoogleOAuthService.getInstance();
  }

  public static getInstance(): GoogleCalendarService {
    if (!GoogleCalendarService.instance) {
      GoogleCalendarService.instance = new GoogleCalendarService();
    }
    return GoogleCalendarService.instance;
  }

  private async getCalendarClient(): Promise<calendar_v3.Calendar> {
    const authClient = await this.oauthService.getAuthenticatedClient();
    if (!authClient) {
      throw new Error(
        'Google Calendar is not connected. Please connect Google Calendar in Settings first.'
      );
    }
    return google.calendar({ version: 'v3', auth: authClient });
  }

  private getDefaultCalendarId(override?: string): string {
    if (override && override.trim()) {
      return override.trim();
    }
    const status = this.oauthService.getConnectionStatus();
    return status.defaultCalendarId || 'primary';
  }

  /**
   * Lists all available user calendars (Primary, Work, Personal, etc.)
   */
  public async listCalendars(): Promise<
    Array<{ id: string; summary: string; primary?: boolean; description?: string }>
  > {
    const calendar = await this.getCalendarClient();
    const res = await calendar.calendarList.list();
    return (res.data.items || []).map((item) => ({
      id: item.id || '',
      summary: item.summary || 'Untitled Calendar',
      primary: item.primary || false,
      description: item.description || undefined,
    }));
  }

  /**
   * Format Google API event to clean normalized structure
   */
  private formatEvent(item: calendar_v3.Schema$Event): CalendarEventSummary {
    const isAllDay = !item.start?.dateTime && !!item.start?.date;
    const start = item.start?.dateTime || item.start?.date || '';
    const end = item.end?.dateTime || item.end?.date || '';

    return {
      id: item.id || '',
      title: item.summary || 'Untitled Event',
      start,
      end,
      location: item.location || undefined,
      description: item.description || undefined,
      attendees: (item.attendees || []).map((a) => a.email || a.displayName || '').filter(Boolean),
      hangoutLink: item.hangoutLink || undefined,
      htmlLink: item.htmlLink || undefined,
      isAllDay,
      status: item.status || 'confirmed',
    };
  }

  /**
   * Get upcoming events from now onwards
   */
  public async getUpcomingEvents(
    limit = 5,
    calendarId?: string
  ): Promise<CalendarEventSummary[]> {
    const calendar = await this.getCalendarClient();
    const targetCalendar = this.getDefaultCalendarId(calendarId);
    const now = new Date();

    const res = await calendar.events.list({
      calendarId: targetCalendar,
      timeMin: now.toISOString(),
      maxResults: limit,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return (res.data.items || []).map((item) => this.formatEvent(item));
  }

  /**
   * Get today's complete schedule
   */
  public async getTodaySchedule(calendarId?: string): Promise<CalendarEventSummary[]> {
    const calendar = await this.getCalendarClient();
    const targetCalendar = this.getDefaultCalendarId(calendarId);

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const res = await calendar.events.list({
      calendarId: targetCalendar,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    return (res.data.items || []).map((item) => this.formatEvent(item));
  }

  /**
   * Get tomorrow's complete schedule
   */
  public async getTomorrowSchedule(calendarId?: string): Promise<CalendarEventSummary[]> {
    const calendar = await this.getCalendarClient();
    const targetCalendar = this.getDefaultCalendarId(calendarId);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startOfDay = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59, 999);

    const res = await calendar.events.list({
      calendarId: targetCalendar,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    return (res.data.items || []).map((item) => this.formatEvent(item));
  }

  /**
   * Search events by keyword query and optional date bounds
   */
  public async searchEvents(
    query: string,
    timeMin?: string,
    timeMax?: string,
    calendarId?: string
  ): Promise<CalendarEventSummary[]> {
    const calendar = await this.getCalendarClient();
    const targetCalendar = this.getDefaultCalendarId(calendarId);

    const res = await calendar.events.list({
      calendarId: targetCalendar,
      q: query,
      timeMin: timeMin || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(), // 30 days back
      timeMax: timeMax || new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(), // 60 days forward
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 10,
    });

    return (res.data.items || []).map((item) => this.formatEvent(item));
  }

  /**
   * Check availability for a specific time range
   */
  public async checkAvailability(
    startDateTime: string,
    endDateTime: string,
    calendarId?: string
  ): Promise<{ isFree: boolean; conflictingEvents: CalendarEventSummary[] }> {
    const calendar = await this.getCalendarClient();
    const targetCalendar = this.getDefaultCalendarId(calendarId);

    const res = await calendar.events.list({
      calendarId: targetCalendar,
      timeMin: startDateTime,
      timeMax: endDateTime,
      singleEvents: true,
    });

    const conflictingEvents = (res.data.items || [])
      .filter((e) => e.status !== 'cancelled')
      .map((item) => this.formatEvent(item));

    return {
      isFree: conflictingEvents.length === 0,
      conflictingEvents,
    };
  }

  /**
   * Find available free slots on a given date (default 9 AM to 6 PM)
   */
  public async findFreeTime(
    targetDate: Date,
    durationMinutes = 60,
    calendarId?: string
  ): Promise<Array<{ start: string; end: string; durationMinutes: number }>> {
    const calendar = await this.getCalendarClient();
    const targetCalendar = this.getDefaultCalendarId(calendarId);

    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 9, 0, 0);
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 18, 0, 0);

    const res = await calendar.events.list({
      calendarId: targetCalendar,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const busyEvents = (res.data.items || []).map((e) => ({
      start: new Date(e.start?.dateTime || e.start?.date || '').getTime(),
      end: new Date(e.end?.dateTime || e.end?.date || '').getTime(),
    }));

    const freeSlots: Array<{ start: string; end: string; durationMinutes: number }> = [];
    let currentPointer = startOfDay.getTime();
    const durationMs = durationMinutes * 60 * 1000;

    for (const busy of busyEvents) {
      if (busy.start - currentPointer >= durationMs) {
        freeSlots.push({
          start: new Date(currentPointer).toISOString(),
          end: new Date(busy.start).toISOString(),
          durationMinutes: Math.floor((busy.start - currentPointer) / 60000),
        });
      }
      if (busy.end > currentPointer) {
        currentPointer = busy.end;
      }
    }

    if (endOfDay.getTime() - currentPointer >= durationMs) {
      freeSlots.push({
        start: new Date(currentPointer).toISOString(),
        end: new Date(endOfDay.getTime()).toISOString(),
        durationMinutes: Math.floor((endOfDay.getTime() - currentPointer) / 60000),
      });
    }

    return freeSlots;
  }

  /**
   * Create a new event on Google Calendar
   */
  public async createEvent(input: CreateEventInput): Promise<CalendarEventSummary> {
    const calendar = await this.getCalendarClient();
    const targetCalendar = this.getDefaultCalendarId(input.calendarId);

    const requestBody: calendar_v3.Schema$Event = {
      summary: input.title,
      description: input.description,
      location: input.location,
      start: {
        dateTime: input.startDateTime,
      },
      end: {
        dateTime: input.endDateTime,
      },
      attendees: input.attendees?.map((email) => ({ email })),
    };

    if (input.reminderMinutes && input.reminderMinutes.length > 0) {
      requestBody.reminders = {
        useDefault: false,
        overrides: input.reminderMinutes.map((minutes) => ({
          method: 'popup',
          minutes,
        })),
      };
    }

    const res = await calendar.events.insert({
      calendarId: targetCalendar,
      requestBody,
    });

    console.log(`[GoogleCalendarService] Created event "${input.title}" (${res.data.id}) on ${targetCalendar}`);
    return this.formatEvent(res.data);
  }

  /**
   * Update an existing event on Google Calendar
   */
  public async updateEvent(
    eventId: string,
    input: UpdateEventInput
  ): Promise<CalendarEventSummary> {
    const calendar = await this.getCalendarClient();
    const targetCalendar = this.getDefaultCalendarId(input.calendarId);

    // Fetch existing event first
    const existing = await calendar.events.get({
      calendarId: targetCalendar,
      eventId,
    });

    const requestBody: calendar_v3.Schema$Event = {
      ...existing.data,
      summary: input.title !== undefined ? input.title : existing.data.summary,
      description: input.description !== undefined ? input.description : existing.data.description,
      location: input.location !== undefined ? input.location : existing.data.location,
    };

    if (input.startDateTime) {
      requestBody.start = { dateTime: input.startDateTime };
    }
    if (input.endDateTime) {
      requestBody.end = { dateTime: input.endDateTime };
    }
    if (input.attendees) {
      requestBody.attendees = input.attendees.map((email) => ({ email }));
    }

    const res = await calendar.events.update({
      calendarId: targetCalendar,
      eventId,
      requestBody,
    });

    console.log(`[GoogleCalendarService] Updated event ${eventId} on ${targetCalendar}`);
    return this.formatEvent(res.data);
  }

  /**
   * Delete an event from Google Calendar
   */
  public async deleteEvent(eventId: string, calendarId?: string): Promise<{ success: boolean; eventId: string }> {
    const calendar = await this.getCalendarClient();
    const targetCalendar = this.getDefaultCalendarId(calendarId);

    await calendar.events.delete({
      calendarId: targetCalendar,
      eventId,
    });

    console.log(`[GoogleCalendarService] Deleted event ${eventId} from ${targetCalendar}`);
    return { success: true, eventId };
  }
}
