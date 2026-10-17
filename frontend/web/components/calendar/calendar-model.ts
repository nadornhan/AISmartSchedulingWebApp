import type { TaskResponse } from '../../lib/tasks';

export type CalendarTaskStatus = 'pending' | 'in_progress' | 'done' | 'overdue';
export type CalendarTaskPriority = 'no_priority' | 'low' | 'medium' | 'high';

export type CalendarTask = {
  id: string;
  title: string;
  project: string;
  projectColor: string;
  calendarDate: string;
  dueDate: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  scheduleLocked: boolean;
  durationMinutes: number | null;
  priority: CalendarTaskPriority;
  status: CalendarTaskStatus;
};

export type CalendarView = 'month' | 'week' | 'day';

export type CalendarDay = {
  date: Date;
  key: string;
  isCurrentMonth: boolean;
  isToday: boolean;
};

export const weekdayLabels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function buildMonthDays(monthDate: Date): CalendarDay[] {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = addDays(firstOfMonth, -firstOfMonth.getDay());
  const todayKey = dateKey(new Date());

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index);

    return {
      date,
      key: dateKey(date),
      isCurrentMonth: date.getMonth() === monthDate.getMonth(),
      isToday: dateKey(date) === todayKey,
    };
  });
}

export function buildWeekDays(selectedDate: Date): CalendarDay[] {
  const start = addDays(selectedDate, -selectedDate.getDay());
  const todayKey = dateKey(new Date());

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);

    return {
      date,
      key: dateKey(date),
      isCurrentMonth: true,
      isToday: dateKey(date) === todayKey,
    };
  });
}

export function buildDay(selectedDate: Date): CalendarDay[] {
  const todayKey = dateKey(new Date());

  return [
    {
      date: selectedDate,
      key: dateKey(selectedDate),
      isCurrentMonth: true,
      isToday: dateKey(selectedDate) === todayKey,
    },
  ];
}

export function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat('en-AU', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function calendarTimeLabel(task: CalendarTask) {
  return `${task.scheduledStart ? 'Scheduled' : 'Due'} ${formatTime(task.calendarDate)}`;
}

export function formatSelectedDate(date: Date) {
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

export function formatWeekTitle(days: CalendarDay[]) {
  const start = days[0]?.date ?? new Date();
  const end = days.at(-1)?.date ?? start;

  const formatter = new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: '2-digit',
  });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

export function priorityClasses(task: CalendarTask) {
  if (task.status === 'done') {
    return 'border-dashboard-border bg-dashboard-raised/55 text-dashboard-muted';
  }

  if (task.priority === 'high') {
    return 'border-[var(--red-border)] bg-[var(--red-soft)] text-[var(--red-light)]';
  }

  if (task.priority === 'medium') {
    return 'border-[var(--orange-border)] bg-[var(--orange-soft)] text-[var(--yellow)]';
  }

  if (task.priority === 'low') {
    return 'border-[var(--blue-border)] bg-[var(--blue-soft)] text-[var(--blue-light)]';
  }

  return 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--green-300)]';
}

export function mobilePriorityLabel(priority: CalendarTaskPriority) {
  return priority === 'no_priority'
    ? 'No priority'
    : `${priority.charAt(0).toUpperCase()}${priority.slice(1)}`;
}

export function mobilePriorityClasses(priority: CalendarTaskPriority) {
  return {
    no_priority: 'border-dashboard-border bg-dashboard-raised text-dashboard-muted',
    low: 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-dashboard-accent',
    medium: 'border-[var(--orange-border)] bg-[var(--orange-soft)] text-[var(--yellow)]',
    high: 'border-[var(--red-border)] bg-[var(--red-soft)] text-[var(--red-light)]',
  }[priority];
}

export function mobileStatusLabel(status: CalendarTaskStatus) {
  return {
    pending: 'Pending',
    in_progress: 'In progress',
    done: 'Done',
    overdue: 'Overdue',
  }[status];
}

export function mobileStatusClasses(status: CalendarTaskStatus) {
  return {
    pending: 'border-[var(--red-border)] text-[var(--red-light)]',
    in_progress: 'border-[var(--orange-border)] text-[var(--yellow)]',
    done: 'border-[var(--accent-border)] text-dashboard-accent',
    overdue: 'border-[var(--red-border)] text-[var(--red-light)]',
  }[status];
}

export function calendarDotClass(task: CalendarTask) {
  if (task.status === 'done') return 'bg-dashboard-accent';
  if (task.priority === 'high') return 'bg-[var(--red-fill)]';
  if (task.priority === 'medium') return 'bg-[var(--yellow-fill)]';
  if (task.priority === 'low') return 'bg-[var(--blue-fill)]';
  return 'bg-dashboard-muted';
}

export function groupTasks(tasks: CalendarTask[]) {
  return tasks.reduce<Record<string, CalendarTask[]>>((groups, task) => {
    const key = dateKey(new Date(task.calendarDate));
    groups[key] = [...(groups[key] ?? []), task];
    return groups;
  }, {});
}

export function toCalendarTask(task: TaskResponse): CalendarTask | null {
  const calendarDate = task.scheduled_start ?? task.due_date;
  if (!calendarDate) return null;

  return {
    id: task.id,
    title: task.title,
    project: task.project?.name ?? 'Unassigned',
    projectColor: task.project?.color ?? 'var(--dashboard-muted)',
    calendarDate,
    dueDate: task.due_date,
    scheduledStart: task.scheduled_start,
    scheduledEnd: task.scheduled_end,
    scheduleLocked: task.schedule_locked,
    durationMinutes: task.estimated_duration_minutes,
    priority: task.priority,
    status: task.status,
  };
}
