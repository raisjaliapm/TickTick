import { formatLocalDate } from './dateUtils';
import type { Priority, TaskStatus, Category } from '@/hooks/useTaskStore';
import type { Recurrence } from '@/components/TaskInput';

interface ParsedSpeech {
  cleanedText: string;
  priority: Priority | null;
  dueDate: string | null;
  dueTime: string | null;
  status: TaskStatus | null;
  recurrence: Recurrence;
  categoryId: string | null;
}

const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

function removeMatch(text: string, match: RegExpMatchArray): string {
  return text.replace(match[0], ' ');
}

export function parseSpeechInput(text: string, categories: Category[] = []): ParsedSpeech {
  let cleaned = text;
  let priority: Priority | null = null;
  let dueDate: string | null = null;
  let dueTime: string | null = null;
  let status: TaskStatus | null = null;
  let recurrence: Recurrence = null;
  let categoryId: string | null = null;

  // --- Priority ---
  const urgentMatch = cleaned.match(/\b(urgent|urgently|asap|immediately|critical)\b/i);
  if (urgentMatch) {
    priority = 'urgent';
    cleaned = removeMatch(cleaned, urgentMatch);
  }
  const priorityMatch = cleaned.match(/\b(?:priority\s*(?:is\s*)?|set\s*priority\s*(?:to\s*)?)(urgent|high|medium|low)\b/i)
    || cleaned.match(/\b(high|medium|low)\s*priority\b/i);
  if (priorityMatch) {
    priority = priorityMatch[1].toLowerCase() as Priority;
    cleaned = removeMatch(cleaned, priorityMatch);
  }

  // --- Status ---
  const statusPatterns: { pattern: RegExp; value: TaskStatus }[] = [
    { pattern: /\b(?:status\s*(?:is\s*)?|mark\s*(?:as\s*)?|set\s*(?:status\s*)?(?:to\s*)?)completed\b/i, value: 'completed' },
    { pattern: /\b(?:status\s*(?:is\s*)?|mark\s*(?:as\s*)?|set\s*(?:status\s*)?(?:to\s*)?)in\s*progress\b/i, value: 'in_progress' },
    { pattern: /\b(?:status\s*(?:is\s*)?|mark\s*(?:as\s*)?|set\s*(?:status\s*)?(?:to\s*)?)on\s*hold\b/i, value: 'on_hold' },
    { pattern: /\b(?:status\s*(?:is\s*)?|mark\s*(?:as\s*)?|set\s*(?:status\s*)?(?:to\s*)?)not\s*started\b/i, value: 'not_started' },
    { pattern: /\bin\s*progress\b/i, value: 'in_progress' },
    { pattern: /\bon\s*hold\b/i, value: 'on_hold' },
    { pattern: /\bcompleted\b/i, value: 'completed' },
    { pattern: /\bnot\s*started\b/i, value: 'not_started' },
  ];
  for (const sp of statusPatterns) {
    const m = cleaned.match(sp.pattern);
    if (m) {
      status = sp.value;
      cleaned = removeMatch(cleaned, m);
      break;
    }
  }

  // --- Recurrence ---
  const recurrencePatterns: { pattern: RegExp; value: Recurrence }[] = [
    { pattern: /\b(?:repeat\s*)?daily\b/i, value: 'daily' },
    { pattern: /\bevery\s*day\b/i, value: 'daily' },
    { pattern: /\b(?:repeat\s*)?weekly\b/i, value: 'weekly' },
    { pattern: /\bevery\s*week\b/i, value: 'weekly' },
    { pattern: /\b(?:repeat\s*)?monthly\b/i, value: 'monthly' },
    { pattern: /\bevery\s*month\b/i, value: 'monthly' },
    { pattern: /\brecurring\s*(daily|weekly|monthly)\b/i, value: null }, // handled below
  ];
  for (const rp of recurrencePatterns) {
    const m = cleaned.match(rp.pattern);
    if (m) {
      if (rp.value === null && m[1]) {
        recurrence = m[1].toLowerCase() as Recurrence;
      } else {
        recurrence = rp.value;
      }
      cleaned = removeMatch(cleaned, m);
      break;
    }
  }

  // --- Category ---
  const catMatch = cleaned.match(/\b(?:category\s*(?:is\s*)?|under\s*|in\s*category\s*|tag\s*(?:as\s*)?)([a-zA-Z0-9]+(?:\s+[a-zA-Z0-9]+)?)\b/i);
  if (catMatch && categories.length > 0) {
    const spokenCat = catMatch[1].toLowerCase().trim();
    const found = categories.find(c => c.name.toLowerCase() === spokenCat);
    if (found) {
      categoryId = found.id;
      cleaned = removeMatch(cleaned, catMatch);
    }
  }
  // Also try matching category names directly anywhere in the text
  if (!categoryId && categories.length > 0) {
    for (const cat of categories) {
      const catRegex = new RegExp(`\\b${cat.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      const m = cleaned.match(catRegex);
      if (m) {
        categoryId = cat.id;
        // Don't remove - category name might be part of the task title
        break;
      }
    }
  }

  // --- Time ---
  const timeMatch = cleaned.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/i)
    || cleaned.match(/\bat\s+(\d{1,2}):(\d{2})\b/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const meridiem = timeMatch[3]?.toLowerCase().replace(/\./g, '');
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    dueTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    cleaned = removeMatch(cleaned, timeMatch);
  }

  // --- Date ---
  const today = new Date();

  if (/\btoday\b/i.test(cleaned)) {
    dueDate = formatLocalDate(today);
    cleaned = cleaned.replace(/\b(due\s+)?today\b/i, ' ');
  } else if (/\btomorrow\b/i.test(cleaned)) {
    const d = new Date(today); d.setDate(d.getDate() + 1);
    dueDate = formatLocalDate(d);
    cleaned = cleaned.replace(/\b(due\s+)?tomorrow\b/i, ' ');
  } else if (/\bday\s+after\s+tomorrow\b/i.test(cleaned)) {
    const d = new Date(today); d.setDate(d.getDate() + 2);
    dueDate = formatLocalDate(d);
    cleaned = cleaned.replace(/\b(due\s+)?day\s+after\s+tomorrow\b/i, ' ');
  } else {
    // "next/this/on Monday"
    const dayMatch = cleaned.match(/\b(?:next|this|on)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
    if (dayMatch) {
      const targetDay = dayNames.indexOf(dayMatch[1].toLowerCase());
      let daysAhead = targetDay - today.getDay();
      if (daysAhead <= 0) daysAhead += 7;
      const d = new Date(today); d.setDate(d.getDate() + daysAhead);
      dueDate = formatLocalDate(d);
      cleaned = removeMatch(cleaned, dayMatch);
    }

    // "January 15" / "15th January"
    if (!dueDate) {
      const monthDateMatch = cleaned.match(new RegExp(`\\b(${monthNames.join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'))
        || cleaned.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames.join('|')})\\b`, 'i'));
      if (monthDateMatch) {
        let monthStr: string, dayStr: string;
        if (monthNames.includes(monthDateMatch[1].toLowerCase())) {
          monthStr = monthDateMatch[1]; dayStr = monthDateMatch[2];
        } else {
          dayStr = monthDateMatch[1]; monthStr = monthDateMatch[2];
        }
        const month = monthNames.indexOf(monthStr.toLowerCase());
        const day = parseInt(dayStr);
        const d = new Date(today.getFullYear(), month, day);
        if (d < today) d.setFullYear(d.getFullYear() + 1);
        dueDate = formatLocalDate(d);
        cleaned = removeMatch(cleaned, monthDateMatch);
      }
    }
  }

  // "in X days"
  if (!dueDate) {
    const inDaysMatch = cleaned.match(/\bin\s+(\d+)\s+(day|days)\b/i);
    if (inDaysMatch) {
      const d = new Date(today); d.setDate(d.getDate() + parseInt(inDaysMatch[1]));
      dueDate = formatLocalDate(d);
      cleaned = removeMatch(cleaned, inDaysMatch);
    }
  }

  // Cleanup
  cleaned = cleaned.replace(/\b(due|by|on|at|set|with|repeat)\s*$/i, '');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  return { cleanedText: cleaned, priority, dueDate, dueTime, status, recurrence, categoryId };
}
