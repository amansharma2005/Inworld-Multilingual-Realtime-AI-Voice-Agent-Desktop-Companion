import * as chrono from 'chrono-node';

export type CalendarActionType =
  | 'GET_TODAY_SCHEDULE'
  | 'GET_TOMORROW_SCHEDULE'
  | 'GET_UPCOMING_EVENTS'
  | 'SEARCH_EVENTS'
  | 'GET_EVENT_DETAILS'
  | 'CHECK_AVAILABILITY'
  | 'FIND_FREE_TIME'
  | 'CREATE_EVENT'
  | 'UPDATE_EVENT'
  | 'DELETE_EVENT'
  | 'CONFIRM_ACTION'
  | 'CANCEL_ACTION'
  | 'NONE';

export interface ExtractedCalendarEntities {
  action: CalendarActionType;
  title?: string;
  startDateTime?: string; // ISO
  endDateTime?: string;   // ISO
  durationMinutes?: number;
  location?: string;
  description?: string;
  searchQuery?: string;
  reminderMinutes?: number[];
  attendees?: string[];
  calendarTarget?: string;
  confidence: number;
  rawText: string;
}

export class CalendarIntentClassifier {
  /**
   * Translates common Hindi/Hinglish temporal and event phrases into English equivalents for parser
   */
  private static normalizeHindiKeywords(text: string): string {
    let s = text.toLowerCase();

    // Hindi/Hinglish Days & Relatives
    s = s.replace(/\baaj\b|\bआज\b/gi, 'today');
    s = s.replace(/\bkal\b|\bकल\b/gi, 'tomorrow');
    s = s.replace(/\bparson\b|\bparso\b|\bपरसों\b/gi, 'in 2 days');
    s = s.replace(/\bagle hafte\b|\bagle week\b|\bअगले हफ्ते\b/gi, 'next week');

    // Weekdays
    s = s.replace(/\bsomwar\b|\bसोमवार\b/gi, 'monday');
    s = s.replace(/\bmangalwar\b|\bमंगलवार\b/gi, 'tuesday');
    s = s.replace(/\bbudhwar\b|\bबुधवार\b/gi, 'wednesday');
    s = s.replace(/\bguruwar\b|\bgurubar\b|\bveervar\b|\bगुरुवार\b/gi, 'thursday');
    s = s.replace(/\bshukrawar\b|\bshukrwar\b|\bशुक्रवार\b/gi, 'friday');
    s = s.replace(/\bshaniwar\b|\bशनिवार\b/gi, 'saturday');
    s = s.replace(/\braviwar\b|\britiwar\b|\bitwar\b|\bरविवार\b/gi, 'sunday');

    // Times of day
    s = s.replace(/\bsubah\b|\bसुबह\b/gi, 'morning');
    s = s.replace(/\bdopahar\b|\bदोपहर\b/gi, 'afternoon');
    s = s.replace(/\bshaam\b|\bsham\b|\bशाम\b/gi, 'evening');
    s = s.replace(/\braat\b|\bरात\b/gi, 'night');

    // O'clock numbers (e.g. 4 baje -> 4:00)
    s = s.replace(/(\d+)\s*(baje|बजे)/gi, '$1:00');
    s = s.replace(/\bek baje\b|\bएक बजे\b/gi, '1:00');
    s = s.replace(/\bdo baje\b|\bदो बजे\b/gi, '2:00');
    s = s.replace(/\bteen baje\b|\bतीन बजे\b/gi, '3:00');
    s = s.replace(/\bchaar baje\b|\bचार बजे\b/gi, '4:00');
    s = s.replace(/\bpaanch baje\b|\bपांच बजे\b/gi, '5:00');
    s = s.replace(/\bche baje\b|\bछह बजे\b/gi, '6:00');
    s = s.replace(/\bsaat baje\b|\bसात बजे\b/gi, '7:00');
    s = s.replace(/\baath baje\b|\bआठ बजे\b/gi, '8:00');
    s = s.replace(/\bnau baje\b|\bनौ बजे\b/gi, '9:00');
    s = s.replace(/\bdas baje\b|\bदस बजे\b/gi, '10:00');
    s = s.replace(/\bgyarah baje\b|\bग्यारह बजे\b/gi, '11:00');
    s = s.replace(/\bbaarah baje\b|\bबारह बजे\b/gi, '12:00');

    // Durations
    s = s.replace(/(\d+)\s*(ghante|ghanta|घंटे|घंटा)/gi, '$1 hours');
    s = s.replace(/(\d+)\s*(minute|min|मिनट)/gi, '$1 minutes');
    s = s.replace(/\bhalf an hour\b|\baadha ghanta\b|\bआधा घंटा\b/gi, '30 minutes');
    s = s.replace(/\bek ghanta\b|\bएक घंटा\b/gi, '1 hour');

    // Common typos & variants
    s = s.replace(/calender/gi, 'calendar');
    s = s.replace(/gcalendar/gi, 'google calendar');

    return s;
  }

  /**
   * Detects confirmations or cancellations for pending multi-turn actions
   */
  public static detectConfirmation(text: string): 'CONFIRM' | 'CANCEL' | null {
    const clean = text.trim().toLowerCase();

    // Confirm patterns
    const confirmPatterns = [
      /^yes\b/i,
      /^yeah\b/i,
      /^yep\b/i,
      /^sure\b/i,
      /^okay\b/i,
      /^ok\b/i,
      /^haan\b/i,
      /^ha\b/i,
      /^हाँ\b/i,
      /^हां\b/i,
      /^confirm\b/i,
      /\bhaan kar do\b/i,
      /\bkar do\b/i,
      /\badd it\b/i,
      /\bcreate it\b/i,
      /\bdelete it\b/i,
      /\bmove it\b/i,
      /\bupdate it\b/i,
      /\bproceed\b/i,
      /\btheek hai\b/i,
      /\bbilkul\b/i,
    ];

    if (confirmPatterns.some((p) => p.test(clean))) {
      return 'CONFIRM';
    }

    // Cancel patterns
    const cancelPatterns = [
      /^no\b/i,
      /^nope\b/i,
      /^cancel\b/i,
      /^nahi\b/i,
      /^nahin\b/i,
      /^नहीं\b/i,
      /\bmat karo\b/i,
      /\brehne do\b/i,
      /\bdon't\b/i,
      /\bstop\b/i,
      /\babort\b/i,
    ];

    if (cancelPatterns.some((p) => p.test(clean))) {
      return 'CANCEL';
    }

    return null;
  }

  /**
   * Classifies user input into structured calendar action & extracts entities
   */
  public static parseIntent(userMessage: string): ExtractedCalendarEntities {
    const raw = userMessage.trim();
    const normalized = this.normalizeHindiKeywords(raw);
    const lower = normalized.toLowerCase();

    // 1. Check Confirmation / Cancellation first
    const conf = this.detectConfirmation(raw);
    if (conf === 'CONFIRM') {
      return { action: 'CONFIRM_ACTION', confidence: 0.95, rawText: raw };
    }
    if (conf === 'CANCEL') {
      return { action: 'CANCEL_ACTION', confidence: 0.95, rawText: raw };
    }

    // 2. Classify Action Type
    let action: CalendarActionType = 'NONE';
    let confidence = 0.5;

    // A. Today's schedule
    if (
      lower.includes('today') ||
      lower.includes('aaj') ||
      lower.includes('आज')
    ) {
      if (
        lower.includes('schedule') ||
        lower.includes('calendar') ||
        lower.includes('meeting') ||
        lower.includes('events') ||
        lower.includes('event') ||
        lower.includes('kya hai') ||
        lower.includes('what') ||
        lower.includes('plans') ||
        lower.includes('kya kya') ||
        lower.includes('koi event')
      ) {
        action = 'GET_TODAY_SCHEDULE';
        confidence = 0.95;
      }
    }

    // B. Tomorrow's schedule
    if (
      lower.includes('tomorrow') ||
      lower.includes('kal') ||
      lower.includes('कल')
    ) {
      if (
        lower.includes('schedule') ||
        lower.includes('calendar') ||
        lower.includes('meeting') ||
        lower.includes('events') ||
        lower.includes('event') ||
        lower.includes('kya hai') ||
        lower.includes('what') ||
        lower.includes('plans') ||
        lower.includes('what do i have')
      ) {
        action = 'GET_TOMORROW_SCHEDULE';
        confidence = 0.95;
      }
    }

    // C. Next / Upcoming Events / View Events
    if (
      action === 'NONE' &&
      (lower.includes('next meeting') ||
        lower.includes('upcoming') ||
        lower.includes('agli meeting') ||
        lower.includes('next event') ||
        lower.includes('what is next') ||
        lower.includes('aage kya hai') ||
        lower.includes('calendar events') ||
        lower.includes('show events') ||
        lower.includes('google calendar events') ||
        lower.includes('my events') ||
        lower.includes('check calendar') ||
        lower.includes('check my calendar') ||
        lower.includes('show my calendar') ||
        lower.includes('list events') ||
        lower.includes('events dikhao') ||
        lower.includes('meetings dikhao') ||
        lower.includes('kya kya events') ||
        lower.includes('kya events hai'))
    ) {
      action = 'GET_UPCOMING_EVENTS';
      confidence = 0.92;
    }

    // D. Availability Check / Free Time
    if (
      action === 'NONE' &&
      (lower.includes('am i free') ||
        lower.includes('free time') ||
        lower.includes('available') ||
        lower.includes('free hoon') ||
        lower.includes('free hu') ||
        lower.includes('fursat') ||
        lower.includes('free slot'))
    ) {
      if (lower.includes('when') || lower.includes('find')) {
        action = 'FIND_FREE_TIME';
      } else {
        action = 'CHECK_AVAILABILITY';
      }
      confidence = 0.88;
    }

    // E. Delete / Cancel Event
    if (
      action === 'NONE' &&
      (lower.includes('cancel') ||
        lower.includes('delete') ||
        lower.includes('remove') ||
        lower.includes('hata do') ||
        lower.includes('cancel kar do') ||
        lower.includes('delete kar do'))
    ) {
      if (
        lower.includes('meeting') ||
        lower.includes('event') ||
        lower.includes('appointment') ||
        lower.includes('call')
      ) {
        action = 'DELETE_EVENT';
        confidence = 0.9;
      }
    }

    // F. Update / Reschedule / Move Event
    if (
      action === 'NONE' &&
      (lower.includes('move') ||
        lower.includes('reschedule') ||
        lower.includes('postpone') ||
        lower.includes('shift') ||
        lower.includes('change time') ||
        lower.includes('badal do') ||
        lower.includes('aage kar do') ||
        lower.includes('shift kar do') ||
        lower.includes('move kar do'))
    ) {
      if (
        lower.includes('meeting') ||
        lower.includes('event') ||
        lower.includes('appointment') ||
        lower.includes('to ') ||
        lower.includes('pe ') ||
        lower.includes('ko ')
      ) {
        action = 'UPDATE_EVENT';
        confidence = 0.9;
      }
    }

    // G. Create / Schedule Event (Comprehensive detection)
    const hasCreationKeywords =
      lower.includes('schedule') ||
      lower.includes('create') ||
      lower.includes('add') ||
      lower.includes('set up') ||
      lower.includes('book') ||
      lower.includes('plan') ||
      lower.includes('lagao') ||
      lower.includes('laga do') ||
      lower.includes('schedule kar do') ||
      lower.includes('add kar do') ||
      lower.includes('rakh do') ||
      lower.includes('daal do') ||
      lower.includes('plan krna') ||
      lower.includes('plan karna') ||
      lower.includes('wapas try karo') ||
      lower.includes('dobara try karo') ||
      lower.includes('phir se add') ||
      lower.includes('add karo');

    const hasEventNoun =
      lower.includes('party') ||
      lower.includes('birthday') ||
      lower.includes('meeting') ||
      lower.includes('event') ||
      lower.includes('dinner') ||
      lower.includes('lunch') ||
      lower.includes('call') ||
      lower.includes('appointment') ||
      lower.includes('interview') ||
      lower.includes('session');

    const hasTimeExpression =
      lower.includes('pm') ||
      lower.includes('am') ||
      lower.includes('at ') ||
      lower.includes('today') ||
      lower.includes('tomorrow') ||
      lower.includes('tonight') ||
      lower.includes('baje') ||
      lower.includes(':00');

    if (action === 'NONE') {
      if (hasCreationKeywords || (hasEventNoun && hasTimeExpression)) {
        action = 'CREATE_EVENT';
        confidence = 0.88;
      }
    }

    // H. General Search / Question about calendar
    if (action === 'NONE') {
      if (
        lower.includes('calendar') ||
        lower.includes('meeting') ||
        lower.includes('appointment') ||
        lower.includes('events')
      ) {
        action = 'SEARCH_EVENTS';
        confidence = 0.8;
      }
    }

    // 3. Extract Dates & Times using Chrono NLP parser
    const parsedDates = chrono.parse(normalized);
    let startDateTime: string | undefined;
    let endDateTime: string | undefined;
    let durationMinutes = 60; // default 1 hour

    if (parsedDates && parsedDates.length > 0) {
      const first = parsedDates[0];
      const start = first.start.date();
      startDateTime = start.toISOString();

      if (first.end) {
        const end = first.end.date();
        endDateTime = end.toISOString();
        durationMinutes = Math.max(15, Math.floor((end.getTime() - start.getTime()) / 60000));
      } else {
        const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
        endDateTime = end.toISOString();
      }
    }

    // 4. Extract Location
    let location: string | undefined;
    const locMatch = raw.match(/\bat\s+([A-Za-z\u0900-\u097F\s]+?)(?:\s+(?:and|with|reminder|before|\d|today|tomorrow|kal|aaj|$))/i);
    if (locMatch && !locMatch[1].match(/^\d/i) && !locMatch[1].match(/^(?:am|pm|night|morning|evening)/i)) {
      location = locMatch[1].trim();
    }

    // 5. Extract Reminders
    let reminderMinutes: number[] | undefined;
    const reminderMatch = normalized.match(/reminder\s+(?:before\s+)?(\d+)\s*(minute|hour|min)/i);
    if (reminderMatch) {
      const val = parseInt(reminderMatch[1], 10);
      const unit = reminderMatch[2].toLowerCase();
      const mins = unit.startsWith('hour') ? val * 60 : val;
      reminderMinutes = [mins];
    }

    // 6. Extract Title
    let title: string | undefined;
    const withMatch = raw.match(/(?:with|ke saath|se|aur)\s+([A-Za-z\u0900-\u097F\s]+?)(?:\s+(?:tomorrow|today|at|on|ko|pe|for|from|\d|kal|aaj|$))/i);
    if (withMatch && withMatch[1]) {
      const person = withMatch[1].trim();
      title = `Meeting with ${person}`;
    } else {
      const beforeFor = raw.split(/\b(?:for today|for tomorrow|today|tomorrow|kal|aaj|at \d|from \d)\b/i)[0].trim();
      if (beforeFor && beforeFor.length > 2) {
        let clean = beforeFor.replace(/^(?:schedule|create|add|plan|set up|book|ek)\s+(?:a\s+|an\s+)?/i, '').trim();
        clean = clean.replace(/\b(?:krna hai|karna hai|rakhna hai|daalna hai)\b/gi, '').trim();
        if (clean.length > 2) {
          title = clean.charAt(0).toUpperCase() + clean.slice(1);
        }
      }
    }

    // Target Calendar
    let calendarTarget: string | undefined;
    if (lower.includes('work calendar') || lower.includes('office')) {
      calendarTarget = 'work';
    } else if (lower.includes('personal calendar') || lower.includes('home')) {
      calendarTarget = 'personal';
    }

    return {
      action,
      title: title || (action === 'CREATE_EVENT' ? 'New Event' : undefined),
      startDateTime,
      endDateTime,
      durationMinutes,
      location,
      reminderMinutes,
      searchQuery: title || raw,
      calendarTarget,
      confidence,
      rawText: raw,
    };
  }
}
