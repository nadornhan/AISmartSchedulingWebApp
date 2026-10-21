'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Clock3, LoaderCircle, Maximize, Minimize } from 'lucide-react';
import { FocusSettingsModal } from './FocusSettingsModal';
import { useFocusFullscreen } from './use-focus-fullscreen';
import { useFocusTasks, type FocusTask } from './use-focus-tasks';
import { modes, useFocusTimer } from './use-focus-timer';

export function FocusMode() {
  const searchParams = useSearchParams();
  const selectedTaskId = searchParams.get('task_id');
  const selectedTaskTitle = searchParams.get('task_title');
  const selectedDuration = Number(searchParams.get('duration'));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');
  const { panelRef, isFullscreen, fullscreenError, toggleFullscreen } = useFocusFullscreen();
  const { tasks, tasksLoading, tasksError } = useFocusTasks({ selectedTaskId, selectedTaskTitle });
  const {
    mode,
    durations,
    running,
    progress,
    minutes,
    remainder,
    sessionMessage,
    sessionError,
    isSessionMutating,
    sessionTaskLocked,
    selectedFocusTaskIds,
    setSelectedFocusTaskIds,
    timerActionLabel,
    selectMode,
    saveDurations,
    toggleTimer,
    skipSession,
    stopFocusSession,
    toggleFocusTask,
  } = useFocusTimer({ selectedTaskId, selectedDuration, setSettingsOpen });

  const selectedFocusTasks = tasks.filter((task) => selectedFocusTaskIds.includes(task.id));
  const selectedFocusTaskTitles = selectedFocusTasks.map((task) => task.title);
  if (
    selectedTaskId &&
    selectedTaskTitle &&
    selectedFocusTaskIds.includes(selectedTaskId) &&
    !selectedFocusTasks.some((task) => task.id === selectedTaskId)
  ) {
    selectedFocusTaskTitles.unshift(selectedTaskTitle);
  }
  const selectedFocusTaskSummary =
    selectedFocusTaskTitles.join(' • ') ||
    (selectedFocusTaskIds.length > 0
      ? `${selectedFocusTaskIds.length} linked ${selectedFocusTaskIds.length === 1 ? 'task' : 'tasks'}`
      : '');
  const normalizedTaskSearch = taskSearch.trim().toLocaleLowerCase();
  const visibleTasks = normalizedTaskSearch
    ? tasks.filter((task) =>
        [task.title, task.projectName]
          .filter(Boolean)
          .some((value) => value?.toLocaleLowerCase().includes(normalizedTaskSearch)),
      )
    : tasks;
  return (
    <div className="mx-auto max-w-[1450px] space-y-5 sm:space-y-7">
      <section
        ref={panelRef}
        aria-label="Focus timer"
        className={`focus-mode-panel relative overflow-hidden rounded-2xl border border-dashboard-border${isFullscreen ? ' is-fullscreen' : ''}`}
        data-phase={mode === 'Pomodoro' ? 'focus' : 'break'}
      >
        <div className="focus-panel-toolbar absolute right-3 top-3 z-20 flex gap-2 sm:right-6 sm:top-6">
          <button
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            aria-pressed={isFullscreen}
            className="focus-panel-tool"
            onClick={() => void toggleFullscreen()}
            title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
            type="button"
          >
            {isFullscreen ? (
              <Minimize aria-hidden="true" className="h-5 w-5" />
            ) : (
              <Maximize aria-hidden="true" className="h-5 w-5" />
            )}
          </button>
          <button
            aria-label="Focus settings"
            className="focus-panel-tool"
            onClick={() => setSettingsOpen(true)}
            type="button"
          >
            <GearIcon />
          </button>
        </div>

        <div className="focus-mode-tabs relative z-10 mx-auto flex w-full shrink-0 overflow-hidden rounded-xl border border-dashboard-border bg-dashboard-bg/70 p-1 sm:w-fit">
          {modes.map((item) => (
            <button
              className={`min-w-0 flex-1 rounded-lg px-2 py-2.5 text-sm transition sm:min-w-28 sm:flex-none sm:px-5 ${
                mode === item
                  ? 'focus-mode-tab--active bg-dashboard-accent/15 font-semibold text-dashboard-accent'
                  : 'text-dashboard-muted hover:text-dashboard-text'
              }`}
              key={item}
              aria-pressed={mode === item}
              disabled={isSessionMutating}
              onClick={() => void selectMode(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>

        <div className="focus-timer-stage">
          <svg aria-hidden="true" className="focus-timer-ring" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              fill="none"
              r="96"
              stroke="var(--focus-ring-track, rgba(34,240,177,.16))"
              strokeWidth="2"
            />
            <circle
              cx="100"
              cy="100"
              fill="none"
              pathLength="100"
              r="96"
              stroke="var(--focus-ring-progress, rgb(var(--accent-fill-strong-rgb)))"
              strokeDasharray={`${progress * 100} 100`}
              strokeLinecap="round"
              strokeWidth="2.6"
            />
          </svg>

          <div className="focus-timer-content">
            <Clock3 aria-hidden="true" className="focus-timer-clock text-dashboard-accent" />
            <p className="focus-timer-time font-poppins font-medium leading-none tracking-tight text-dashboard-text">
              {minutes}:{remainder}
            </p>

            <div
              className={`focus-timer-controls${mode === 'Pomodoro' && sessionTaskLocked ? ' focus-timer-controls--with-stop' : ''}`}
            >
              <button
                aria-label={timerActionLabel}
                className="focus-timer-action rounded-full bg-gradient-to-r from-dashboard-accent-strong to-dashboard-accent font-semibold text-dashboard-on-accent-inverse shadow-glow transition hover:brightness-110"
                disabled={isSessionMutating}
                onClick={() => void toggleTimer()}
                type="button"
              >
                <span className="focus-timer-action-label">{timerActionLabel}</span>
                <span aria-hidden="true" className="focus-timer-action-icon">
                  {isSessionMutating ? (
                    <LoaderCircle className="animate-spin motion-reduce:animate-none" />
                  ) : running ? (
                    <PauseIcon />
                  ) : (
                    <PlayIcon />
                  )}
                </span>
              </button>

              {mode === 'Pomodoro' && sessionTaskLocked ? (
                <button
                  aria-label="Stop current focus session"
                  className="focus-stop-action"
                  disabled={isSessionMutating}
                  onClick={stopFocusSession}
                  title="Stop focus session"
                  type="button"
                >
                  <StopIcon />
                </button>
              ) : null}

              <button
                aria-label={mode === 'Pomodoro' ? 'Skip to short break' : 'Skip to focus session'}
                className="focus-skip-action"
                disabled={isSessionMutating}
                onClick={() => void skipSession()}
                title={mode === 'Pomodoro' ? 'Skip to break' : 'Skip to focus'}
                type="button"
              >
                <SkipIcon />
              </button>
            </div>
          </div>
        </div>

        <div className="focus-timer-caption relative z-10 mt-4 text-center sm:mt-7">
          <p className="focus-timer-session-count text-sm text-dashboard-muted sm:text-lg">#1</p>
          <p className="focus-timer-session-title mt-1 text-sm font-medium text-dashboard-text sm:text-lg">
            {mode === 'Pomodoro' ? 'Time to focus!' : 'Take a breather'}
          </p>
          {sessionMessage ? (
            <p className="mt-3 text-sm text-dashboard-accent" role="status">
              {sessionMessage}
            </p>
          ) : null}
          {sessionError ? (
            <p className="mt-3 text-sm text-dashboard-danger" role="alert">
              {sessionError}
            </p>
          ) : null}
          {fullscreenError ? (
            <p className="mt-3 text-sm text-dashboard-danger" role="alert">
              {fullscreenError}
            </p>
          ) : null}
          {mode === 'Pomodoro' && selectedFocusTaskSummary ? (
            <p className="mt-2 text-sm text-dashboard-muted">
              Focusing on: <span className="text-dashboard-text">{selectedFocusTaskSummary}</span>
            </p>
          ) : null}
        </div>
        <FocusSettingsModal
          durations={durations}
          onClose={() => setSettingsOpen(false)}
          onSave={saveDurations}
          open={settingsOpen}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-dashboard-border bg-dashboard-surface/55">
        <div className="flex flex-col gap-4 border-b border-dashboard-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-medium text-dashboard-text">Choose a task</h2>
            <p className="mt-1 text-sm text-dashboard-muted">
              Select one or more active tasks for this focus session.
            </p>
          </div>

          <label className="flex h-10 w-full items-center gap-2 rounded-xl border border-dashboard-border bg-dashboard-bg/60 px-3 transition focus-within:border-dashboard-accent/60 sm:w-72">
            <SearchIcon />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm text-dashboard-text outline-none placeholder:text-dashboard-muted"
              onChange={(event) => setTaskSearch(event.target.value)}
              placeholder="Search tasks"
              type="search"
              value={taskSearch}
            />
          </label>
        </div>

        {selectedFocusTaskIds.length > 0 ? (
          <div className="flex items-center justify-between gap-4 border-b border-dashboard-border bg-dashboard-accent/[0.06] px-5 py-3 text-sm">
            <span className="min-w-0 truncate text-dashboard-muted">
              {selectedFocusTaskIds.length} selected:{' '}
              <strong className="font-medium text-dashboard-text">
                {selectedFocusTaskSummary}
              </strong>
            </span>
            <button
              className="shrink-0 text-dashboard-accent transition hover:text-dashboard-text disabled:cursor-not-allowed disabled:opacity-40"
              disabled={sessionTaskLocked}
              onClick={() => setSelectedFocusTaskIds([])}
              type="button"
            >
              Clear
            </button>
          </div>
        ) : null}

        <div className="accent-scrollbar max-h-80 overflow-y-auto">
          {tasksLoading ? (
            <p className="px-5 py-8 text-center text-sm text-dashboard-muted">Loading tasks...</p>
          ) : tasksError ? (
            <p className="px-5 py-8 text-center text-sm text-dashboard-danger" role="alert">
              {tasksError}
            </p>
          ) : visibleTasks.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-dashboard-muted">
                {taskSearch
                  ? 'No active tasks match your search.'
                  : 'You have no active tasks yet.'}
              </p>
              {!taskSearch ? (
                <a
                  className="mt-3 inline-block text-sm font-medium text-dashboard-accent hover:underline"
                  href="/tasks"
                >
                  Go to Tasks
                </a>
              ) : null}
            </div>
          ) : (
            visibleTasks.map((task) => {
              const selected = selectedFocusTaskIds.includes(task.id);
              const selectionLimitReached = selectedFocusTaskIds.length >= 20 && !selected;

              return (
                <button
                  aria-pressed={selected}
                  className={`flex w-full items-center gap-4 border-b border-dashboard-border px-5 py-4 text-left transition last:border-0 disabled:cursor-not-allowed disabled:opacity-55 ${
                    selected ? 'bg-dashboard-accent/[0.1]' : 'hover:bg-dashboard-raised/60'
                  }`}
                  disabled={sessionTaskLocked || selectionLimitReached}
                  key={task.id}
                  onClick={() => toggleFocusTask(task.id)}
                  type="button"
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
                      selected
                        ? 'border-dashboard-accent bg-dashboard-accent text-dashboard-on-accent'
                        : 'border-dashboard-muted/60 text-transparent'
                    }`}
                  >
                    <CheckIcon />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-dashboard-text">
                      {task.title}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dashboard-muted">
                      {task.projectName ? <span>{task.projectName}</span> : null}
                      {task.estimatedDurationMinutes ? (
                        <span>{task.estimatedDurationMinutes} min</span>
                      ) : null}
                      {task.dueDate ? <span>{formatTaskDueDate(task.dueDate)}</span> : null}
                    </span>
                  </span>

                  <span className={getTaskStatusClassName(task.status)}>
                    {formatTaskStatus(task.status)}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {sessionTaskLocked ? (
          <p className="border-t border-dashboard-border px-5 py-3 text-xs text-dashboard-muted">
            Finish or stop the current focus session before choosing another task.
          </p>
        ) : selectedFocusTaskIds.length >= 20 ? (
          <p className="border-t border-dashboard-border px-5 py-3 text-xs text-dashboard-muted">
            A focus session can include up to 20 tasks.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0 text-dashboard-muted"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16">
      <path d="m3.5 8 3 3 6-6" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function formatTaskStatus(status: FocusTask['status']) {
  if (status === 'in_progress') return 'In progress';
  if (status === 'overdue') return 'Overdue';
  return 'Pending';
}

function getTaskStatusClassName(status: FocusTask['status']) {
  const baseClassName = 'shrink-0 text-xs font-medium';

  if (status === 'overdue') return `${baseClassName} text-dashboard-danger`;
  if (status === 'in_progress') return `${baseClassName} text-dashboard-accent`;
  return `${baseClassName} text-dashboard-muted`;
}

function formatTaskDueDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Due date unavailable';

  return `Due ${new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date)}`;
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
      <path d="m8 5 11 7-11 7V5Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 5h4v14H6V5Zm8 0h4v14h-4V5Z" />
    </svg>
  );
}

function SkipIcon() {
  return (
    <svg aria-hidden="true" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6.5 5.7a1 1 0 0 1 1.5-.86l8.5 5.3a1 1 0 0 1 0 1.72L8 17.16a1 1 0 0 1-1.5-.86V5.7ZM18 5a1 1 0 0 1 1 1v12a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
      <rect height="9" rx="1.5" width="9" x="3.5" y="3.5" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1.1l2-1.5-2-3.5-2.4 1a7.7 7.7 0 0 0-1.9-1.1L14.3 3H9.7l-.3 2.8a7.7 7.7 0 0 0-1.9 1.1l-2.4-1-2 3.5 2 1.5A7.3 7.3 0 0 0 5 12c0 .4 0 .8.1 1.1l-2 1.5 2 3.5 2.4-1a7.7 7.7 0 0 0 1.9 1.1l.3 2.8h4.6l.3-2.8a7.7 7.7 0 0 0 1.9-1.1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1.1Z" />
    </svg>
  );
}
