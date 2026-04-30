
/**
 * Date Utilities to handle Timezone consistency (specifically for Chile/Local time)
 */

/**
 * Returns a string in YYYY-MM-DD format based on local time.
 * This avoids the common bug where .toISOString() jumps to the next day after 8:00 PM (UTC-4).
 */
export const getLocalDateString = (dateObj: Date = new Date()): string => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Formats a date or string to a human-readable local date.
 */
export const formatLocalDisplayDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Returns the current time in local format.
 */
export const getLocalTimeString = (dateObj: Date = new Date()): string => {
  return dateObj.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};
