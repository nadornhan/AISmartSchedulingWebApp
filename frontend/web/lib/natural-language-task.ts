import * as chrono from 'chrono-node';

import type { TaskPriorityValue } from './tasks';

export type ParsedNaturalLanguageTask = {
  title: string;
  priority: TaskPriorityValue | null;
  dueDate: string | null;
  dueTime: string | null;
  estimatedDurationMinutes: number | null;
  projectName: string | null;
  detectedFields: string[];
};

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeTemporalNotation(value: string) {
  // Chrono understands 11:15, but not 11h15 or common misspellings of tomorrow.
  return value
    .replace(/\b([01]?\d|2[0-3])h([0-5]\d)\b/gi, '$1:$2')
    .replace(/\btomor+ow\b/gi, 'tomorrow');
}

function normalizeTaskTitle(value: string) {
  let title = value
    .replace(/\s*,\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove common natural-language introductions without altering task content.
  title = title.replace(
    /^(?:i\s+need\s+to|i\s+have\s+to|i\s+should|remind\s+me\s+to|please)\s+/i,
    '',
  );

  // Chrono removes the date/time phrase, but its connector can remain.
  title = title.replace(/\s+(?:by|before|on|at|around)\s*$/i, '');

  title = title
    .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return title ? `${title[0].toLocaleUpperCase()}${title.slice(1)}` : '';
}

export function parseNaturalLanguageTask(
  input: string,
  referenceDate = new Date(),
): ParsedNaturalLanguageTask {
  let remaining = input.trim();
  const detectedFields: string[] = [];
  let priority: TaskPriorityValue | null = null;
  let dueDate: string | null = null;
  let dueTime: string | null = null;
  let estimatedDurationMinutes: number | null = null;
  let projectName: string | null = null;

  const priorityMatch = remaining.match(/\b(no|low|medium|high)\s+priority\b/i);
  if (priorityMatch) {
    priority = priorityMatch[1].toLowerCase() === 'no'
      ? 'no_priority'
      : (priorityMatch[1].toLowerCase() as TaskPriorityValue);
    detectedFields.push('priority');
    remaining = remaining.replace(priorityMatch[0], ' ');
  }

  const durationMatch = remaining.match(
    /\b(?:for\s+)?(?:around|about|approximately|approx\.?|roughly)?\s*(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|minutes?|mins?|min)\b/i,
  );
  if (durationMatch) {
    const amount = Number(durationMatch[1]);
    const unit = durationMatch[2].toLowerCase();
    estimatedDurationMinutes = Math.max(
      1,
      Math.round(unit.startsWith('h') ? amount * 60 : amount),
    );
    detectedFields.push('duration');
    remaining = remaining.replace(durationMatch[0], ' ');
  }

  const projectMatch = remaining.match(
    /\b(?:assign\s+to|in\s+folder|project)\s*:\s*["']?([^,"'\n]+?)["']?(?=\s*,|$)/i,
  );
  if (projectMatch) {
    projectName = projectMatch[1].trim();
    if (projectName) detectedFields.push('folder');
    remaining = remaining.replace(projectMatch[0], ' ');
  }

  remaining = normalizeTemporalNotation(remaining);
  const parsedDates = chrono.parse(remaining, referenceDate, { forwardDate: true });
  const dateResult =
    parsedDates.find((result) =>
      result.start.isCertain('day') ||
      result.start.isCertain('month') ||
      result.start.isCertain('year') ||
      result.start.isCertain('weekday'),
    ) ?? parsedDates[0];
  const timeResult = parsedDates.find((result) => result.start.isCertain('hour'));

  if (dateResult) {
    const date = dateResult.start.date();
    dueDate = toDateInputValue(date);
    detectedFields.push('due date');

    if (timeResult) {
      const time = timeResult.start.date();
      dueTime = `${String(time.getHours()).padStart(2, '0')}:${String(
        time.getMinutes(),
      ).padStart(2, '0')}`;
      detectedFields.push('time');
    }

    const usedResults =
      timeResult && timeResult !== dateResult ? [dateResult, timeResult] : [dateResult];
    for (const result of usedResults.sort(
      (left, right) => right.index - left.index,
    )) {
      remaining = `${remaining.slice(0, result.index)} ${remaining.slice(
        result.index + result.text.length,
      )}`;
    }
  }

  const title = normalizeTaskTitle(remaining);

  if (title) detectedFields.unshift('title');

  return {
    title,
    priority,
    dueDate,
    dueTime,
    estimatedDurationMinutes,
    projectName,
    detectedFields,
  };
}
