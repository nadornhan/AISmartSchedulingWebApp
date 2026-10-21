'use client';

import { CalendarIcon, CheckIcon, ChevronRightIcon, CloseIcon } from '../layout/icons';
import { formatDurationLabel } from '../../lib/duration';
import {
  cn,
  weekdayLabels,
  formatSelectedDate,
  formatTime,
  calendarDotClass,
  calendarTimeLabel,
  mobilePriorityClasses,
  mobilePriorityLabel,
  priorityClasses,
  type CalendarDay,
  type CalendarTask,
  type CalendarView,
} from './calendar-model';

function OverdueBadge({ compact = false }: Readonly<{ compact?: boolean }>) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border border-[var(--red-border)] bg-[var(--red-soft)] font-semibold text-[var(--red-light)]',
        compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2.5 py-1 text-xs',
      )}
    >
      Overdue
    </span>
  );
}

function OverdueDayIndicator() {
  return (
    <span
      aria-label="Contains overdue tasks"
      className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[var(--red-border)] bg-[var(--red-soft)] text-xs font-bold leading-none text-[var(--red-light)] shadow-[0_0_12px_rgba(248,113,113,0.18)]"
      title="Contains overdue tasks"
    >
      !
    </span>
  );
}

export function MobileCalendarView({
  days,
  isLoading,
  loadError,
  mutatingTaskId,
  onMoveMonth,
  onReschedule,
  onSelectDate,
  onToggleTask,
  selectedDate,
  selectedKey,
  selectedTasks,
  tasksByDay,
  visibleMonth,
}: Readonly<{
  days: CalendarDay[];
  isLoading: boolean;
  loadError: string | null;
  mutatingTaskId: string | null;
  onMoveMonth: (delta: number) => void;
  onReschedule: (task: CalendarTask) => void;
  onSelectDate: (date: Date) => void;
  onToggleTask: (task: CalendarTask) => void;
  selectedDate: Date;
  selectedKey: string;
  selectedTasks: CalendarTask[];
  tasksByDay: Record<string, CalendarTask[]>;
  visibleMonth: Date;
}>) {
  const monthLabel = new Intl.DateTimeFormat('en-AU', { month: 'short' })
    .format(visibleMonth)
    .toUpperCase();
  const selectedLabel = new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
  }).format(selectedDate);

  return (
    <section className="lg:hidden">
      <div className="mb-8">
        <div className="mb-5 grid grid-cols-[40px_1fr_40px] items-center">
          <button
            aria-label="Previous month"
            className="grid h-10 w-10 place-items-center rounded-full text-dashboard-muted transition hover:bg-dashboard-surface hover:text-dashboard-accent"
            onClick={() => onMoveMonth(-1)}
            type="button"
          >
            <ChevronRightIcon className="h-4 w-4 rotate-180" />
          </button>
          <h2 className="text-center text-lg font-semibold tracking-wide text-dashboard-text">
            {monthLabel}
          </h2>
          <button
            aria-label="Next month"
            className="grid h-10 w-10 place-items-center rounded-full text-dashboard-muted transition hover:bg-dashboard-surface hover:text-dashboard-accent"
            onClick={() => onMoveMonth(1)}
            type="button"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7">
          {weekdayLabels.map((label) => (
            <span
              className="pb-3 text-center text-[11px] font-semibold text-dashboard-muted"
              key={label}
            >
              {label}
            </span>
          ))}

          {days.map((day) => {
            const dayTasks = tasksByDay[day.key] ?? [];
            const selected = day.key === selectedKey;
            const hasOverdueTasks = dayTasks.some((task) => task.status === 'overdue');
            return (
              <button
                aria-label={`${formatSelectedDate(day.date)}${dayTasks.length ? `, ${dayTasks.length} tasks` : ''}${hasOverdueTasks ? ', contains overdue tasks' : ''}`}
                aria-pressed={selected}
                className="relative flex h-[52px] flex-col items-center justify-center gap-1.5"
                key={day.key}
                onClick={() => onSelectDate(day.date)}
                type="button"
              >
                {hasOverdueTasks ? (
                  <span className="absolute right-0 top-0 scale-75">
                    <OverdueDayIndicator />
                  </span>
                ) : null}
                <span
                  className={cn(
                    'grid h-9 w-9 place-items-center rounded-[10px] text-sm font-medium transition',
                    !day.isCurrentMonth && 'text-dashboard-subtle',
                    day.isCurrentMonth && !selected && 'text-dashboard-text',
                    selected && 'bg-dashboard-accent font-semibold text-dashboard-on-accent shadow-glow',
                    day.isToday &&
                      !selected &&
                      'ring-1 ring-dashboard-accent/55 text-dashboard-accent',
                  )}
                >
                  {day.date.getDate()}
                </span>
                <span className="flex h-1 items-center justify-center gap-1">
                  {dayTasks.slice(0, 3).map((task) => (
                    <span
                      className={cn('h-1 w-1 rounded-full', calendarDotClass(task))}
                      key={task.id}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {loadError ? (
        <p
          className="mb-5 rounded-[var(--radius-md)] border border-dashboard-danger/30 bg-dashboard-danger/10 p-4 text-sm text-dashboard-danger"
          role="alert"
        >
          {loadError}
        </p>
      ) : null}

      <div>
        <h2 className="mb-3 font-poppins text-xl font-semibold text-dashboard-text">
          {selectedLabel}
        </h2>

        {isLoading ? (
          <div className="grid min-h-36 place-items-center rounded-[var(--radius-lg)] border border-dashboard-border bg-dashboard-surface/65 text-sm text-dashboard-muted">
            Loading tasks...
          </div>
        ) : selectedTasks.length ? (
          <div className="divide-y divide-dashboard-border overflow-hidden rounded-[var(--radius-lg)] border border-dashboard-border bg-dashboard-surface shadow-panel">
            {selectedTasks.map((task) => {
              const completed = task.status === 'done';
              return (
                <article className="flex items-center gap-3 px-4 py-3" key={task.id}>
                  <button
                    aria-label={completed ? `Reopen ${task.title}` : `Complete ${task.title}`}
                    className={cn(
                      'grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border transition',
                      completed
                        ? 'border-dashboard-accent bg-dashboard-accent text-dashboard-on-accent'
                        : 'border-dashboard-border-strong hover:border-dashboard-accent',
                    )}
                    disabled={mutatingTaskId === task.id}
                    onClick={() => onToggleTask(task)}
                    type="button"
                  >
                    {completed ? <CheckIcon className="h-3.5 w-3.5" /> : null}
                  </button>

                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onReschedule(task)}
                    type="button"
                  >
                    <span className="block truncate text-sm font-semibold text-dashboard-text">
                      {task.title}
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-dashboard-muted">
                      {task.durationMinutes !== null ? <span className="inline-flex items-center gap-1"><span aria-hidden="true">◷</span>{formatDurationLabel(task.durationMinutes)}</span> : null}
                      {task.durationMinutes !== null ? <span aria-hidden="true">·</span> : null}
                      <span>{formatTime(task.calendarDate)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="flex min-w-0 items-center gap-1.5 truncate">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: task.projectColor }}
                        />
                        <span className="truncate">{task.project}</span>
                      </span>
                    </span>
                  </button>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <button
                      aria-label={`Edit due date for ${task.title}`}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-dashboard-border text-dashboard-muted transition hover:bg-dashboard-surface-hover hover:text-dashboard-accent"
                      disabled={mutatingTaskId === task.id}
                      onClick={() => onReschedule(task)}
                      type="button"
                    >
                      <CalendarIcon className="h-4 w-4" />
                    </button>
                    <span className={cn('rounded-[var(--radius-pill)] border px-2.5 py-1 text-[10px] font-medium', mobilePriorityClasses(task.priority))}>
                      {mobilePriorityLabel(task.priority)}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="grid min-h-36 place-items-center rounded-[var(--radius-lg)] border border-dashed border-dashboard-border bg-dashboard-surface/40 px-6 text-center">
            <div>
              <p className="text-sm font-semibold text-dashboard-text">No tasks scheduled</p>
              <p className="mt-1 text-xs text-dashboard-muted">Use the + button to add a task.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function CalendarMainView({
  calendarView,
  days,
  mutatingTaskId,
  onDropTask,
  onReschedule,
  onSelectDate,
  onToggleTask,
  selectedKey,
  tasksByDay,
}: Readonly<{
  calendarView: CalendarView;
  days: CalendarDay[];
  mutatingTaskId: string | null;
  onDropTask: (taskId: string, date: Date) => void;
  onReschedule: (task: CalendarTask) => void;
  onSelectDate: (date: Date) => void;
  onToggleTask: (task: CalendarTask) => void;
  selectedKey: string;
  tasksByDay: Record<string, CalendarTask[]>;
}>) {
  if (calendarView === 'day') {
    const day = days[0];
    const tasks = tasksByDay[day.key] ?? [];

    return (
      <div className="p-4 sm:p-5">
        <DayTaskPanel
          mutatingTaskId={mutatingTaskId}
          onReschedule={onReschedule}
          onToggleTask={onToggleTask}
          tasks={tasks}
        />
      </div>
    );
  }

  if (calendarView === 'week') {
    return (
      <div className="grid min-h-[calc(100vh-17rem)] grid-cols-7">
        {days.map((day) => (
          <CalendarDayCell
            day={day}
            isSelected={day.key === selectedKey}
            key={day.key}
            onSelect={() => onSelectDate(day.date)}
            onDropTask={onDropTask}
            tasks={tasksByDay[day.key] ?? []}
            variant="week"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-7">
      {days.map((day) => (
        <CalendarDayCell
          day={day}
          isSelected={day.key === selectedKey}
          key={day.key}
          onSelect={() => onSelectDate(day.date)}
          onDropTask={onDropTask}
          tasks={tasksByDay[day.key] ?? []}
        />
      ))}
    </div>
  );
}

function DayTaskPanel({
  mutatingTaskId,
  onReschedule,
  onToggleTask,
  tasks,
}: Readonly<{
  mutatingTaskId: string | null;
  onReschedule: (task: CalendarTask) => void;
  onToggleTask: (task: CalendarTask) => void;
  tasks: CalendarTask[];
}>) {
  return (
    <div className="min-h-[420px] rounded-lg border border-dashboard-border bg-dashboard-bg/20 p-4">
      {tasks.length ? (
        <div className="space-y-3">
          {tasks.map((task) => (
            <DayViewTaskCard
              isMutating={mutatingTaskId === task.id}
              key={task.id}
              onReschedule={onReschedule}
              onToggleTask={onToggleTask}
              task={task}
            />
          ))}
        </div>
      ) : (
        <div className="grid min-h-[300px] place-items-center rounded-lg border border-dashed border-dashboard-border bg-dashboard-bg/20 px-6 text-center">
          <p className="text-sm font-semibold text-dashboard-text">No tasks scheduled</p>
        </div>
      )}
    </div>
  );
}

function DayViewTaskCard({
  isMutating,
  onReschedule,
  onToggleTask,
  task,
}: Readonly<{
  isMutating: boolean;
  onReschedule: (task: CalendarTask) => void;
  onToggleTask: (task: CalendarTask) => void;
  task: CalendarTask;
}>) {
  const priorityLabel =
    task.priority === 'no_priority'
      ? 'No priority'
      : `${task.priority.charAt(0).toUpperCase()}${task.priority.slice(1)}`;

  return (
    <article
      className={cn(
        'group rounded-xl border p-4 shadow-[0_12px_32px_rgb(var(--shadow-color)/calc(0.14*var(--shadow-strength)))] transition hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgb(var(--shadow-color)/calc(0.22*var(--shadow-strength)))] sm:p-5',
        priorityClasses(task),
        task.scheduleLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
        isMutating && 'cursor-wait opacity-60',
      )}
      draggable={!isMutating && !task.scheduleLocked}
      onDragEnd={(event) => event.currentTarget.classList.remove('opacity-50')}
      onDragStart={(event) => {
        if (task.scheduleLocked) return;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/calendar-task-id', task.id);
        event.currentTarget.classList.add('opacity-50');
      }}
      title={task.scheduleLocked ? 'Unlock this task before rescheduling' : calendarTimeLabel(task)}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <time className="shrink-0 rounded-lg border border-current/20 bg-dashboard-bg/45 px-3 py-2 text-sm font-semibold text-current">
            {formatTime(task.calendarDate)}
          </time>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h4 className="min-w-0 truncate text-lg font-semibold text-dashboard-text">
                {task.title}
              </h4>
              {task.status === 'overdue' ? <OverdueBadge /> : null}
            </div>
            <p className="mt-2 flex items-center gap-2 text-base text-dashboard-muted">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: task.projectColor }}
              />
              <span className="truncate">{task.project}</span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <button
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-dashboard-border-strong bg-dashboard-bg/60 px-3 text-xs font-semibold text-dashboard-muted transition hover:border-dashboard-accent/70 hover:text-dashboard-accent"
            disabled={isMutating || task.scheduleLocked}
            onClick={() => onReschedule(task)}
            title={task.scheduleLocked ? 'Unlock this task before rescheduling' : undefined}
            type="button"
          >
            <CalendarIcon className="h-[18px] w-[18px]" />
          </button>
          <button
            aria-label={task.status === 'done' ? 'Reopen task' : 'Complete task'}
            className={cn(
              'inline-flex h-10 items-center gap-2 rounded-lg border px-3.5 text-sm font-semibold transition',
              task.status === 'done'
                ? 'border-dashboard-accent bg-dashboard-accent text-dashboard-on-accent'
                : 'border-dashboard-border-strong bg-dashboard-bg/60 text-dashboard-muted hover:border-dashboard-accent/70 hover:text-dashboard-accent',
            )}
            disabled={isMutating}
            onClick={() => onToggleTask(task)}
            type="button"
          >
            <span className="grid h-[18px] w-[18px] place-items-center rounded border border-current/50">
              {task.status === 'done' ? <CheckIcon className="h-3.5 w-3.5" /> : null}
            </span>
            {task.status === 'done' ? 'Completed' : 'Complete'}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-current/10 pt-3">
        <span className="rounded-full border border-current/20 bg-dashboard-bg/35 px-3 py-1.5 text-sm font-semibold text-current">
          {priorityLabel}
        </span>
        {task.durationMinutes !== null ? (
          <span className="rounded-full border border-dashboard-border bg-dashboard-bg/35 px-3 py-1.5 text-sm font-medium text-dashboard-muted">
            {formatDurationLabel(task.durationMinutes)} estimated
          </span>
        ) : null}
        <span className="ml-auto text-xs font-medium text-dashboard-muted">
          {task.scheduledStart && task.scheduledEnd
            ? `Scheduled ${formatTime(task.scheduledStart)}–${formatTime(task.scheduledEnd)}`
            : `Due ${formatTime(task.calendarDate)}`}
        </span>
        {task.scheduledStart && task.dueDate ? (
          <span className="text-xs font-medium text-dashboard-muted">
            Due {formatTime(task.dueDate)}
          </span>
        ) : null}
      </div>
    </article>
  );
}

function CalendarDayCell({
  day,
  isSelected,
  onDropTask,
  onSelect,
  tasks,
  variant = 'month',
}: Readonly<{
  day: CalendarDay;
  isSelected: boolean;
  onDropTask: (taskId: string, date: Date) => void;
  onSelect: () => void;
  tasks: CalendarTask[];
  variant?: 'month' | 'week';
}>) {
  const hasOverdueTasks = tasks.some((task) => task.status === 'overdue');

  return (
    <button
      className={cn(
        'flex h-[128px] flex-col border-r border-t border-dashboard-border bg-dashboard-bg/10 p-3 text-left transition last:border-r-0 hover:bg-dashboard-surface/65 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-dashboard-accent/50',
        variant === 'week' && 'h-auto min-h-[520px]',
        !day.isCurrentMonth && 'bg-dashboard-bg/30 text-dashboard-subtle',
        isSelected &&
          'relative z-10 bg-dashboard-accent-soft ring-2 ring-inset ring-dashboard-accent/70',
      )}
      onClick={onSelect}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const taskId = event.dataTransfer.getData('text/calendar-task-id');
        if (taskId) onDropTask(taskId, day.date);
      }}
      type="button"
    >
      <div className="flex h-8 shrink-0 items-start justify-between">
        <span
          className={cn(
            'text-base font-semibold',
            day.isCurrentMonth ? 'text-dashboard-text' : 'text-dashboard-subtle',
            day.isToday &&
              'grid h-8 min-w-8 place-items-center rounded-full bg-dashboard-accent text-dashboard-on-accent',
          )}
        >
          {day.date.getDate()}
        </span>
        {hasOverdueTasks ? <OverdueDayIndicator /> : null}
      </div>

      <div className="accent-scrollbar mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {tasks.map((task) => (
          <CalendarTaskCard compact key={task.id} task={task} />
        ))}
      </div>
    </button>
  );
}

function CalendarTaskCard({
  compact = false,
  task,
}: Readonly<{
  compact?: boolean;
  task: CalendarTask;
}>) {
  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2.5 shadow-[0_10px_28px_rgb(var(--shadow-color)/calc(0.18*var(--shadow-strength)))]',
        priorityClasses(task),
        task.status === 'done' && 'opacity-70',
        task.scheduleLocked ? 'cursor-default' : 'cursor-grab',
      )}
      draggable={!task.scheduleLocked}
      onDragEnd={(event) => event.currentTarget.classList.remove('opacity-50')}
      onDragStart={(event) => {
        if (task.scheduleLocked) return;
        event.stopPropagation();
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/calendar-task-id', task.id);
        event.currentTarget.classList.add('opacity-50');
      }}
      title={task.scheduleLocked ? 'Unlock this task before rescheduling' : calendarTimeLabel(task)}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold leading-5 text-current">
          {task.title}
        </p>
        {task.status === 'overdue' ? <OverdueBadge compact /> : null}
      </div>
      <p
        className={cn('mt-0.5 truncate text-sm font-medium', compact ? 'opacity-85' : 'opacity-75')}
      >
        {calendarTimeLabel(task)}
      </p>
    </div>
  );
}

export function DayAgenda({
  actionError,
  mutatingTaskId,
  onNextDay,
  onPreviousDay,
  onReschedule,
  onShowCompletedChange,
  onToday,
  onToggleTask,
  selectedDate,
  showCompleted,
  tasks,
}: Readonly<{
  actionError: string | null;
  mutatingTaskId: string | null;
  onNextDay: () => void;
  onPreviousDay: () => void;
  onReschedule: (task: CalendarTask) => void;
  onShowCompletedChange: () => void;
  onToday: () => void;
  onToggleTask: (task: CalendarTask) => void;
  selectedDate: Date;
  showCompleted: boolean;
  tasks: CalendarTask[];
}>) {
  return (
    <aside className="rounded-[var(--radius-lg)] border border-dashboard-border bg-dashboard-surface/65 p-5 shadow-panel">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-dashboard-accent">
            Daily agenda
          </p>
          <h2 className="mt-1 truncate text-2xl font-medium tracking-[-0.02em] text-dashboard-text">
            {formatSelectedDate(selectedDate)}
          </h2>
          <p className="mt-1 text-sm text-dashboard-muted">
            {tasks.length} {tasks.length === 1 ? 'scheduled task' : 'scheduled tasks'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            aria-label="Previous day"
            className="grid h-10 w-10 place-items-center rounded-lg border border-dashboard-border bg-dashboard-raised text-dashboard-muted transition hover:border-dashboard-accent/60 hover:text-dashboard-accent"
            onClick={onPreviousDay}
            type="button"
          >
            <ChevronRightIcon className="h-4 w-4 rotate-180" />
          </button>
          <button
            className="h-10 rounded-lg border border-dashboard-border bg-dashboard-raised px-3.5 text-base font-medium text-dashboard-muted transition hover:border-dashboard-accent/60 hover:text-dashboard-text"
            onClick={onToday}
            type="button"
          >
            Today
          </button>
          <button
            aria-label="Next day"
            className="grid h-10 w-10 place-items-center rounded-lg border border-dashboard-border bg-dashboard-raised text-dashboard-muted transition hover:border-dashboard-accent/60 hover:text-dashboard-accent"
            onClick={onNextDay}
            type="button"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative min-h-[520px]">
        {actionError ? (
          <p
            className="mb-4 rounded-lg border border-dashboard-danger/30 bg-dashboard-danger/10 p-3 text-sm text-dashboard-danger"
            role="alert"
          >
            {actionError}
          </p>
        ) : null}

        {tasks.length ? (
          <>
            <div className="absolute bottom-0 left-[78px] top-0 w-px bg-gradient-to-b from-dashboard-accent/35 via-dashboard-border to-transparent" />
            <div className="space-y-3">
              {tasks.map((task) => (
                <AgendaTask
                  isMutating={mutatingTaskId === task.id}
                  key={task.id}
                  onReschedule={onReschedule}
                  onToggleTask={onToggleTask}
                  task={task}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="grid min-h-[420px] place-items-center rounded-lg border border-dashed border-dashboard-border bg-dashboard-bg/20 px-6 text-center">
            <div>
              <p className="text-sm font-semibold text-dashboard-text">No tasks scheduled</p>
            </div>
          </div>
        )}
      </div>

      <label className="mt-6 flex w-fit items-center gap-3 text-sm font-medium text-dashboard-muted">
        <button
          aria-pressed={showCompleted}
          className={cn(
            'grid h-5 w-5 place-items-center rounded-[5px] border transition',
            showCompleted
              ? 'border-dashboard-accent bg-dashboard-accent text-dashboard-on-accent'
              : 'border-dashboard-border-strong bg-dashboard-bg hover:border-dashboard-accent/70',
          )}
          onClick={onShowCompletedChange}
          type="button"
        >
          {showCompleted ? <CheckIcon className="h-3.5 w-3.5" /> : null}
        </button>
        Show completed events
      </label>
    </aside>
  );
}

function AgendaTask({
  isMutating,
  onReschedule,
  onToggleTask,
  task,
}: Readonly<{
  isMutating: boolean;
  onReschedule: (task: CalendarTask) => void;
  onToggleTask: (task: CalendarTask) => void;
  task: CalendarTask;
}>) {
  const priorityLabel =
    task.priority === 'no_priority'
      ? 'No priority'
      : `${task.priority.charAt(0).toUpperCase()}${task.priority.slice(1)}`;

  return (
    <article
      className={cn(
        'grid grid-cols-1 items-center gap-3 lg:grid-cols-[58px_14px_minmax(0,1fr)]',
        task.scheduleLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
      )}
      draggable={!isMutating && !task.scheduleLocked}
      onDragEnd={(event) => event.currentTarget.classList.remove('opacity-50')}
      onDragStart={(event) => {
        if (task.scheduleLocked) return;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/calendar-task-id', task.id);
        event.currentTarget.classList.add('opacity-50');
      }}
      title={task.scheduleLocked ? 'Unlock this task before rescheduling' : calendarTimeLabel(task)}
    >
      <time className="hidden text-right text-xs font-semibold tabular-nums tracking-[-0.01em] text-dashboard-muted lg:block">
        {formatTime(task.calendarDate)}
      </time>
      <span
        className="relative z-10 hidden h-3 w-3 justify-self-center rounded-full shadow-[0_0_0_4px_var(--bg-surface),0_0_12px_currentColor] lg:block"
        style={{ backgroundColor: task.projectColor }}
      />
      <div
        className={cn(
          'hidden rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 p-4 shadow-panel transition hover:bg-dashboard-surface lg:block',
        )}
      >
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <h3 className="min-w-0 truncate text-sm font-semibold leading-5 text-dashboard-text">
              {task.title}
            </h3>
            {task.status === 'overdue' ? <OverdueBadge /> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              aria-label={`Reschedule ${task.title}`}
              className="grid h-9 w-9 place-items-center rounded-lg border border-dashboard-border-strong bg-dashboard-bg/70 text-dashboard-muted transition hover:border-dashboard-accent/70 hover:text-dashboard-accent"
              disabled={isMutating || task.scheduleLocked}
              onClick={() => onReschedule(task)}
              title={task.scheduleLocked ? 'Unlock this task before rescheduling' : 'Reschedule'}
              type="button"
            >
              <CalendarIcon className="h-4 w-4" />
            </button>
            <button
              aria-label={task.status === 'done' ? 'Reopen task' : 'Complete task'}
              className={cn(
                'grid h-9 w-9 place-items-center rounded-lg border transition',
                task.status === 'done'
                  ? 'border-dashboard-accent bg-dashboard-accent text-dashboard-on-accent'
                  : 'border-dashboard-border-strong bg-dashboard-bg text-dashboard-muted hover:border-dashboard-accent/70 hover:text-dashboard-accent',
                isMutating && 'cursor-wait opacity-60',
              )}
              disabled={isMutating}
              onClick={() => onToggleTask(task)}
              type="button"
            >
              {task.status === 'done' ? <CheckIcon className="h-4 w-4" /> : null}
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-dashboard-muted">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: task.projectColor }}
            />
            <span className="truncate">{task.project}</span>
          </span>
          <span
            className={cn(
              'inline-flex rounded-[var(--radius-pill)] border px-2.5 py-1 text-xs font-medium',
              mobilePriorityClasses(task.priority),
            )}
          >
            {priorityLabel}
          </span>
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-dashboard-border bg-dashboard-surface px-3.5 py-3.5 shadow-panel lg:hidden">
        <button
          aria-label={task.status === 'done' ? 'Reopen task' : 'Complete task'}
          className={cn(
            'grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border transition',
            task.status === 'done'
              ? 'border-dashboard-accent bg-dashboard-accent text-dashboard-on-accent'
              : 'border-dashboard-border-strong bg-transparent hover:border-dashboard-accent',
            isMutating && 'cursor-wait opacity-60',
          )}
          disabled={isMutating}
          onClick={() => onToggleTask(task)}
          type="button"
        >
          {task.status === 'done' ? <CheckIcon className="h-3.5 w-3.5" /> : null}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <h3 className="min-w-0 break-words text-sm font-semibold leading-5 text-dashboard-text">{task.title}</h3>
          </div>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-dashboard-muted">
            {task.durationMinutes !== null ? <span className="inline-flex items-center gap-1"><span aria-hidden="true">◷</span>{formatDurationLabel(task.durationMinutes)}</span> : null}
            {task.durationMinutes !== null ? <span aria-hidden="true">·</span> : null}
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: task.projectColor }} />
              <span className="truncate">{task.project}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">{formatTime(task.calendarDate)}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <button
            aria-label={`Edit due date for ${task.title}`}
            className="grid h-8 w-8 place-items-center rounded-lg border border-dashboard-border text-dashboard-muted transition hover:bg-dashboard-surface-hover hover:text-dashboard-accent"
            disabled={isMutating}
            onClick={() => onReschedule(task)}
            type="button"
          >
            <CalendarIcon className="h-4 w-4" />
          </button>
          <span className={cn('inline-flex rounded-[var(--radius-pill)] border px-2.5 py-1 text-[10px] font-medium', mobilePriorityClasses(task.priority))}>
            {mobilePriorityLabel(task.priority)}
          </span>
        </div>
      </div>
    </article>
  );
}

export function RescheduleDialog({
  date,
  error,
  isSubmitting,
  onClose,
  onDateChange,
  onSubmit,
  onTimeChange,
  task,
  time,
}: Readonly<{
  date: string;
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onDateChange: (value: string) => void;
  onSubmit: () => void;
  onTimeChange: (value: string) => void;
  task: CalendarTask;
  time: string;
}>) {
  return (
    <div
      aria-labelledby="reschedule-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-[350] grid place-items-center overflow-y-auto bg-dashboard-overlay p-4 backdrop-blur-[5px]"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !isSubmitting) onClose();
      }}
      role="dialog"
    >
      <form
        className="w-full max-w-md rounded-[var(--radius-lg)] border border-dashboard-border-strong bg-[var(--bg-surface-raised)] p-6 shadow-modal"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-dashboard-text" id="reschedule-dialog-title">
              Reschedule task
            </h2>
            <p className="mt-1 truncate text-sm text-dashboard-muted">{task.title}</p>
          </div>
          <button
            aria-label="Close reschedule dialog"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-dashboard-muted transition hover:bg-dashboard-surface-hover hover:text-dashboard-text"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-dashboard-text">
              {task.scheduledStart ? 'Schedule date' : 'Due date'}
            </span>
            <input
              className="h-11 w-full rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-3 text-sm text-dashboard-text outline-none [color-scheme:dark] focus:border-dashboard-accent"
              disabled={isSubmitting}
              onChange={(event) => onDateChange(event.target.value)}
              required
              type="date"
              value={date}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-dashboard-text">Time</span>
            <input
              className="h-11 w-full rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-3 text-sm text-dashboard-text outline-none [color-scheme:dark] focus:border-dashboard-accent"
              disabled={isSubmitting}
              onChange={(event) => onTimeChange(event.target.value)}
              type="time"
              value={time}
            />
          </label>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-dashboard-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="h-10 rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 text-sm font-medium text-dashboard-text transition hover:border-dashboard-border-strong"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="h-10 rounded-[var(--radius-sm)] bg-dashboard-accent px-4 text-sm font-semibold text-dashboard-on-accent transition hover:bg-dashboard-accent/90 disabled:cursor-wait disabled:opacity-60"
            disabled={isSubmitting || !date}
            type="submit"
          >
            {isSubmitting ? 'Rescheduling...' : 'Save schedule'}
          </button>
        </div>
      </form>
    </div>
  );
}
