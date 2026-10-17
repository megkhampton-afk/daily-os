const DAY_MS = 24 * 60 * 60 * 1000;

export function calendarDay(value: number | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

/** Whole calendar days from today until `due` (negative when overdue). */
export function daysUntil(due: number) {
  return calendarDay(due) - calendarDay(new Date());
}

export function dueLabel(due?: number) {
  if (due === undefined) return "No due date";
  const days = daysUntil(due);
  if (days < 0) return `Due ${Math.abs(days)} day${days === -1 ? "" : "s"} ago`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 7) return `Due in ${days} days`;

  const date = new Date(due);
  const includeYear = date.getFullYear() !== new Date().getFullYear();
  return `Due ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  })}`;
}
