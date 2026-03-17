/**
 * Format a Date to a local YYYY-MM-DD string (avoids UTC shift from toISOString).
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a Date to a local ISO-like string with time: YYYY-MM-DDTHH:mm:ss
 */
export function formatLocalDateTime(date: Date): string {
  const datePart = formatLocalDate(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${datePart}T${hours}:${minutes}:${seconds}`;
}

/**
 * Parse a YYYY-MM-DD string as a local date (not UTC).
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}
