export function visibleEvents<T extends { calendarId?: string }>(
  events: T[],
  hiddenIds: string[],
): T[] {
  const hidden = new Set(hiddenIds);
  return events.filter((event) => !event.calendarId || !hidden.has(event.calendarId));
}
