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

  const parsedDate = chrono.parse(remaining, referenceDate, { forwardDate: true })[0];
  if (parsedDate) {
    const date = parsedDate.start.date();
    dueDate = toDateInputValue(date);
    detectedFields.push('due date');

    if (parsedDate.start.isCertain('hour')) {
      dueTime = `${String(date.getHours()).padStart(2, '0')}:${String(
        date.getMinutes(),
      ).padStart(2, '0')}`;
      detectedFields.push('time');
    }

    remaining = `${remaining.slice(0, parsedDate.index)} ${remaining.slice(
      parsedDate.index + parsedDate.text.length,
    )}`;
  }

  const title = remaining
    .replace(/\s*,\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '')
    .trim();

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
