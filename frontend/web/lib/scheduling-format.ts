function isSameCalendarDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatDateLabel(date: Date, now: Date) {
  if (isSameCalendarDate(date, now)) {
    return 'Today';
  }

  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function formatScheduleSuggestionRange(
  suggestedStart: string,
  suggestedEnd: string,
  now: Date = new Date(),
) {
  const start = new Date(suggestedStart);
  const end = new Date(suggestedEnd);

  return `${formatDateLabel(start, now)} · ${formatTime(start)}-${formatTime(end)}`;
}
