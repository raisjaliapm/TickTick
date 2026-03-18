import { formatLocalDate } from './dateUtils';
import type { Priority } from '@/hooks/useTaskStore';

interface ParsedSpeech {
  cleanedText: string;
  priority: Priority | null;
  dueDate: string | null;
  dueTime: string | null;
}

const priorityPatterns: { pattern: RegExp; value: Priority }[] = [
  { pattern: /\b(urgent|urgently|asap|immediately|critical)\b/i, value: 'urgent' },
  { pattern: /\bhigh\s*priority\b/i, value: 'high' },
  { pattern: /\blow\s*priority\b/i, value: 'low' },
  { pattern: /\bmedium\s*priority\b/i, value: 'medium' },
  { pattern: /\bpriority\s*(is\s*)?(urgent|high|medium|low)\b/i, value: 'medium' }, // handled below
];

const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function parseSpeechInput(text: string): ParsedSpeech {
  let cleaned = text;
  let priority: Priority | null = null;
  let dueDate: string | null = null;
  let dueTime: string | null = null;

  // --- Priority extraction ---
  const urgentMatch = cleaned.match(/\b(urgent|urgently|asap|immediately|critical)\b/i);
  if (urgentMatch) {
    priority = 'urgent';
    cleaned = cleaned.replace(urgentMatch[0], '');
  }

  const priorityMatch = cleaned.match(/\b(?:priority\s*(?:is\s*)?|set\s*priority\s*(?:to\s*)?)(urgent|high|medium|low)\b/i)
    || cleaned.match(/\b(high|medium|low)\s*priority\b/i);
  if (priorityMatch) {
    const val = priorityMatch[1].toLowerCase() as Priority;
    priority = val;
    cleaned = cleaned.replace(priorityMatch[0], '');
  }

  // --- Time extraction ---
  // "at 3 PM", "at 15:30", "at 3:30 PM"
  const timeMatch = cleaned.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/i)
    || cleaned.match(/\b(?:at\s+)(\d{1,2}):(\d{2})\b/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const meridiem = timeMatch[3]?.toLowerCase().replace(/\./g, '');
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    dueTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    cleaned = cleaned.replace(timeMatch[0], '');
  }

  // --- Date extraction ---
  const today = new Date();

  // "today"
  if (/\btoday\b/i.test(cleaned)) {
    dueDate = formatLocalDate(today);
    cleaned = cleaned.replace(/\b(due\s+)?today\b/i, '');
  }
  // "tomorrow"
  else if (/\btomorrow\b/i.test(cleaned)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    dueDate = formatLocalDate(d);
    cleaned = cleaned.replace(/\b(due\s+)?tomorrow\b/i, '');
  }
  // "day after tomorrow"
  else if (/\bday\s+after\s+tomorrow\b/i.test(cleaned)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 2);
    dueDate = formatLocalDate(d);
    cleaned = cleaned.replace(/\b(due\s+)?day\s+after\s+tomorrow\b/i, '');
  }
  // "next Monday", "this Friday", "on Wednesday"
  else {
    const dayMatch = cleaned.match(/\b(?:next|this|on)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
    if (dayMatch) {
      const targetDay = dayNames.indexOf(dayMatch[1].toLowerCase());
      const currentDay = today.getDay();
      let daysAhead = targetDay - currentDay;
      if (daysAhead <= 0) daysAhead += 7;
      if (/next/i.test(dayMatch[0]) && daysAhead <= 7) {
        // "next" always means the upcoming occurrence, at least 1 day away
      }
      const d = new Date(today);
      d.setDate(d.getDate() + daysAhead);
      dueDate = formatLocalDate(d);
      cleaned = cleaned.replace(dayMatch[0], '');
    }
  }

  // "in X days/hours"
  const inDaysMatch = cleaned.match(/\bin\s+(\d+)\s+(day|days)\b/i);
  if (inDaysMatch && !dueDate) {
    const d = new Date(today);
    d.setDate(d.getDate() + parseInt(inDaysMatch[1]));
    dueDate = formatLocalDate(d);
    cleaned = cleaned.replace(inDaysMatch[0], '');
  }

  // "by/due/on" + date-like phrase cleanup
  cleaned = cleaned.replace(/\b(due|by|on|at|set|with)\s*$/i, '');

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  return { cleanedText: cleaned, priority, dueDate, dueTime };
}