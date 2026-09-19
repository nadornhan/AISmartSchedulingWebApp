'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  finishFocusSession as saveFinishedFocusSession,
  getActiveFocusSession,
  startFocusSession,
  updateFocusSession,
} from '../../lib/focus';
import { listTasks, type TaskResponse } from '../../lib/tasks';
import { FocusSettingsModal, type FocusDurations } from './FocusSettingsModal';

type Mode = 'Pomodoro' | 'Short Break' | 'Long Break';

type FocusTask = {
  id: string;
  title: string;
  status: TaskResponse['status'];
  dueDate: string | null;
  estimatedDurationMinutes: number | null;
  projectName: string | null;
};

const modes: Mode[] = ['Pomodoro', 'Short Break', 'Long Break'];

const defaultDurations: FocusDurations = {
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
};

function getModeSeconds(mode: Mode, durations: FocusDurations) {
  if (mode === 'Pomodoro') return durations.focus * 60;
  if (mode === 'Short Break') return durations.shortBreak * 60;
  return durations.longBreak * 60;
}

export function FocusMode() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>('Pomodoro');
  const [durations, setDurations] = useState<FocusDurations>(defaultDurations);
  const [seconds, setSeconds] = useState(defaultDurations.focus * 60);
  const [running, setRunning] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tasks, setTasks] = useState<FocusTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [taskSearch, setTaskSearch] = useState('');
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isSessionMutating, setIsSessionMutating] = useState(false);
  const [sessionTaskLocked, setSessionTaskLocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const endTimeRef = useRef<number | null>(null);
  const remainingRef = useRef(defaultDurations.focus * 60);
  const completionSoundPlayedRef = useRef(false);
  const sessionStartedAtRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const activeSegmentStartedAtRef = useRef<number | null>(null);
  const focusedMillisecondsRef = useRef(0);
  const isSavingSessionRef = useRef(false);
  const selectedTaskId = searchParams.get('task_id');
  const selectedTaskTitle = searchParams.get('task_title');
  const selectedDuration = Number(searchParams.get('duration'));
  const [selectedFocusTaskIds, setSelectedFocusTaskIds] = useState<string[]>(() =>
    selectedTaskId && selectedTaskId.trim() ? [selectedTaskId] : [],
  );

  const totalSeconds = getModeSeconds(mode, durations);
  const progress = totalSeconds > 0 ? Math.min(1, Math.max(0, seconds / totalSeconds)) : 0;
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');

  useEffect(() => {
    remainingRef.current = seconds;
  }, [seconds]);

  useEffect(() => {
    audioRef.current = new Audio('/sounds/focus-complete.wav');
    audioRef.current.preload = 'auto';
    audioRef.current.volume = 0.28;
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void getActiveFocusSession(controller.signal)
      .then((session) => {
        setSessionError(null);
        if (!session) return;

        sessionIdRef.current = session.id;
        sessionStartedAtRef.current = session.started_at;
        focusedMillisecondsRef.current = session.actual_duration_seconds * 1000;
        setSelectedFocusTaskIds(
          session.task_ids.length > 0 ? session.task_ids : session.task_id ? [session.task_id] : [],
        );
        setSessionTaskLocked(true);
        const plannedSeconds = session.planned_duration_minutes * 60;
        setDurations((current) => ({
          ...current,
          focus: session.planned_duration_minutes,
        }));
        setMode('Pomodoro');
        setSeconds(Math.max(0, plannedSeconds - session.actual_duration_seconds));
        setRunning(false);
        setSessionMessage('Previous focus session restored · paused');

        if (session.status === 'active') {
          void updateFocusSession(session.id, {
            actual_duration_seconds: session.actual_duration_seconds,
            status: 'paused',
          });
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setSessionError('Unable to restore the active focus session.');
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    setTasksLoading(true);
    setTasksError(null);
    void listTasks(
      {
        page: 1,
        pageSize: 100,
        sortBy: 'due_date',
        sortOrder: 'asc',
      },
      { signal: controller.signal },
    )
      .then((response) => {
        const availableTasks = response.items
          .filter((task) => (task.workflow_status ?? task.status) !== 'done')
          .map((task) => ({
            id: task.id,
            title: task.title,
            status: task.status,
            dueDate: task.due_date,
            estimatedDurationMinutes: task.estimated_duration_minutes,
            projectName: task.project?.name ?? null,
          }));

        if (
          selectedTaskId &&
          selectedTaskTitle &&
          !availableTasks.some((task) => task.id === selectedTaskId)
        ) {
          availableTasks.unshift({
            id: selectedTaskId,
            title: selectedTaskTitle,
            status: 'pending',
            dueDate: null,
            estimatedDurationMinutes: null,
            projectName: null,
          });
        }

        setTasks(availableTasks);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setTasksError('Unable to load your tasks. Please try again.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setTasksLoading(false);
      });

    return () => controller.abort();
  }, [selectedTaskId, selectedTaskTitle]);

  useEffect(() => {
    if (!Number.isInteger(selectedDuration) || selectedDuration <= 0) return;

    setDurations((current) => ({
      ...current,
      focus: selectedDuration,
    }));
    setMode('Pomodoro');
    setSeconds(selectedDuration * 60);
    remainingRef.current = selectedDuration * 60;
    setRunning(false);
    endTimeRef.current = null;
    completionSoundPlayedRef.current = false;
  }, [selectedDuration]);

  useEffect(() => {
    if (!running) return;

    function tick() {
      if (endTimeRef.current === null) return;

      const nextSeconds = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));

      setSeconds((current) => {
        if (nextSeconds === 0 && current > 0 && !completionSoundPlayedRef.current) {
          completionSoundPlayedRef.current = true;
          audioRef.current?.play().catch(() => {});
        }

        return nextSeconds;
      });

      if (nextSeconds === 0) {
        setRunning(false);
        endTimeRef.current = null;
        if (mode === 'Pomodoro' && completionSoundPlayedRef.current) {
          void finishFocusSession(true);
        }
      }
    }

    tick();
    const timer = window.setInterval(tick, 250);

    return () => window.clearInterval(timer);
  }, [mode, running]);

  function captureActiveSegment() {
    if (activeSegmentStartedAtRef.current === null) return;

    focusedMillisecondsRef.current += Math.max(0, Date.now() - activeSegmentStartedAtRef.current);
    activeSegmentStartedAtRef.current = null;
  }

  async function finishFocusSession(completed: boolean): Promise<boolean> {
    if (!sessionIdRef.current) return true;
    if (isSavingSessionRef.current) return false;

    captureActiveSegment();
    const sessionId = sessionIdRef.current;
    const actualSeconds = Math.max(0, Math.round(focusedMillisecondsRef.current / 1000));
    const actualMinutes = Math.ceil(actualSeconds / 60);

    isSavingSessionRef.current = true;
    setIsSessionMutating(true);
    setSessionError(null);
    setSessionMessage('Saving focus session...');

    try {
      await saveFinishedFocusSession(sessionId, actualSeconds, completed);
      sessionIdRef.current = null;
      sessionStartedAtRef.current = null;
      focusedMillisecondsRef.current = 0;
      setSessionTaskLocked(false);
      setSessionMessage(
        completed
          ? `Focus session completed · ${actualMinutes} min recorded`
          : `Focus session stopped · ${actualMinutes} min recorded`,
      );
      return true;
    } catch (requestError) {
      setSessionMessage(null);
      setSessionTaskLocked(true);
      setSessionError(
        requestError instanceof Error ? requestError.message : 'Unable to save this focus session.',
      );
      return false;
    } finally {
      isSavingSessionRef.current = false;
      setIsSessionMutating(false);
    }
  }

  async function selectMode(nextMode: Mode) {
    if (mode === 'Pomodoro' && sessionStartedAtRef.current) {
      const stopped = await finishFocusSession(false);
      if (!stopped) return;
    }
    setMode(nextMode);
    setSeconds(getModeSeconds(nextMode, durations));
    remainingRef.current = getModeSeconds(nextMode, durations);
    setRunning(false);
    endTimeRef.current = null;
    completionSoundPlayedRef.current = false;
  }

  async function saveDurations(nextDurations: FocusDurations) {
    if (mode === 'Pomodoro' && sessionStartedAtRef.current) {
      const stopped = await finishFocusSession(false);
      if (!stopped) return;
    }
    setDurations(nextDurations);
    setSeconds(getModeSeconds(mode, nextDurations));
    remainingRef.current = getModeSeconds(mode, nextDurations);
    setRunning(false);
    endTimeRef.current = null;
    completionSoundPlayedRef.current = false;
    setSettingsOpen(false);
  }

  async function toggleTimer() {
    if (seconds === 0) {
      setSeconds(totalSeconds);
      remainingRef.current = totalSeconds;
      endTimeRef.current = null;
      completionSoundPlayedRef.current = false;
      return;
    }

    if (running) {
      captureActiveSegment();
      endTimeRef.current = null;
      setRunning(false);
      if (mode === 'Pomodoro' && sessionIdRef.current) {
        const actualSeconds = Math.round(focusedMillisecondsRef.current / 1000);
        void updateFocusSession(sessionIdRef.current, {
          actual_duration_seconds: actualSeconds,
          status: 'paused',
        }).catch(() => setSessionError('Timer paused, but progress could not be synced.'));
      }
      return;
    }

    setSessionError(null);
    setIsSessionMutating(true);
    try {
      if (mode === 'Pomodoro' && !sessionIdRef.current) {
        const session = await startFocusSession({
          task_ids: selectedFocusTaskIds,
          planned_duration_minutes: Math.max(1, Math.round(totalSeconds / 60)),
        });
        sessionIdRef.current = session.id;
        sessionStartedAtRef.current = session.started_at;
        focusedMillisecondsRef.current = session.actual_duration_seconds * 1000;
        setSessionTaskLocked(true);
        setSessionMessage(null);
      } else if (mode === 'Pomodoro' && sessionIdRef.current) {
        await updateFocusSession(sessionIdRef.current, {
          actual_duration_seconds: Math.round(focusedMillisecondsRef.current / 1000),
          status: 'active',
        });
      }

      completionSoundPlayedRef.current = false;
      endTimeRef.current = Date.now() + remainingRef.current * 1000;
      if (mode === 'Pomodoro') activeSegmentStartedAtRef.current = Date.now();
      audioRef.current?.load();
      setRunning(true);
    } catch (requestError) {
      setSessionError(
        requestError instanceof Error ? requestError.message : 'Unable to start focus session.',
      );
    } finally {
      setIsSessionMutating(false);
    }
  }

  function skipSession() {
    void selectMode(mode === 'Pomodoro' ? 'Short Break' : 'Pomodoro');
  }

  function resetTimer() {
    if (sessionTaskLocked || isSessionMutating) return;

    setRunning(false);
    setSeconds(totalSeconds);
    remainingRef.current = totalSeconds;
    endTimeRef.current = null;
    completionSoundPlayedRef.current = false;
    setSessionMessage(null);
    setSessionError(null);
  }

  function stopFocusSession() {
    if (!sessionIdRef.current || isSavingSessionRef.current) return;

    captureActiveSegment();
    setRunning(false);
    setSeconds(totalSeconds);
    remainingRef.current = totalSeconds;
    endTimeRef.current = null;
    completionSoundPlayedRef.current = false;
    void finishFocusSession(false);
  }

  function toggleFocusTask(taskId: string) {
    setSelectedFocusTaskIds((current) =>
      current.includes(taskId)
        ? current.filter((selectedId) => selectedId !== taskId)
        : current.length < 20
          ? [...current, taskId]
          : current,
    );
  }

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
      <section className="focus-mode-panel relative overflow-hidden rounded-2xl border border-dashboard-border">
        <button
          aria-label="Focus settings"
          className="absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-xl border border-dashboard-border bg-dashboard-surface text-dashboard-text hover:border-dashboard-accent/50 sm:right-6 sm:top-6 sm:h-11 sm:w-11"
          onClick={() => setSettingsOpen(true)}
          type="button"
        >
          <GearIcon />
        </button>

        <div className="mx-auto flex w-full overflow-hidden rounded-xl border border-dashboard-border bg-dashboard-bg/70 p-1 sm:w-fit">
          {modes.map((item) => (
            <button
              className={`min-w-0 flex-1 rounded-lg px-2 py-2.5 text-sm transition sm:min-w-28 sm:flex-none sm:px-5 ${
                mode === item
                  ? 'bg-dashboard-accent/15 font-semibold text-dashboard-accent'
                  : 'text-dashboard-muted hover:text-dashboard-text'
              }`}
              key={item}
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
              stroke="rgba(34,240,177,.16)"
              strokeWidth="2"
            />
            <circle
              cx="100"
              cy="100"
              fill="none"
              pathLength="100"
              r="96"
              stroke="var(--dashboard-accent)"
              strokeDasharray={`${progress * 100} 100`}
              strokeLinecap="round"
              strokeWidth="2.6"
            />
          </svg>

          <div className="relative z-10 flex flex-col items-center">
            <div className="mb-3 flex items-center gap-2 text-dashboard-accent sm:mb-5">
              <ClockIcon />
              <span className="text-sm font-medium sm:text-lg">
                {mode === 'Pomodoro' ? 'Focus Time' : mode}
              </span>
            </div>

            <p className="focus-timer-time font-poppins font-medium leading-none tracking-tight text-dashboard-text">
              {minutes}:{remainder}
            </p>

            <div className="focus-timer-controls">
              <button
                className="focus-timer-action rounded-full bg-gradient-to-r from-dashboard-accent-strong to-dashboard-accent px-6 py-2.5 text-base font-semibold text-white shadow-glow transition hover:brightness-110"
                disabled={isSessionMutating}
                onClick={() => void toggleTimer()}
                type="button"
              >
                {isSessionMutating
                  ? isSavingSessionRef.current
                    ? 'Saving...'
                    : 'Starting...'
                  : seconds === 0
                    ? 'Reset'
                    : running
                      ? 'Pause'
                      : 'Start'}
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

              {!sessionTaskLocked ? (
                <button
                  className="focus-reset-action"
                  disabled={isSessionMutating}
                  onClick={resetTimer}
                  type="button"
                >
                  Reset
                </button>
              ) : null}

              <button
                aria-label={mode === 'Pomodoro' ? 'Skip to short break' : 'Skip to focus session'}
                className="focus-skip-action"
                onClick={skipSession}
                title={mode === 'Pomodoro' ? 'Skip to break' : 'Skip to focus'}
                type="button"
              >
                <SkipIcon />
              </button>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-4 text-center sm:mt-7">
          <p className="text-sm text-dashboard-muted sm:text-lg">#1</p>
          <p className="mt-1 text-sm font-medium text-dashboard-text sm:text-lg">
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
          {mode === 'Pomodoro' && selectedFocusTaskSummary ? (
            <p className="mt-2 text-sm text-dashboard-muted">
              Focusing on: <span className="text-dashboard-text">{selectedFocusTaskSummary}</span>
            </p>
          ) : null}
        </div>
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
                    selected ? 'bg-dashboard-accent/[0.1]' : 'hover:bg-white/[0.025]'
                  }`}
                  disabled={sessionTaskLocked || selectionLimitReached}
                  key={task.id}
                  onClick={() => toggleFocusTask(task.id)}
                  type="button"
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
                      selected
                        ? 'border-dashboard-accent bg-dashboard-accent text-dashboard-bg'
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

      <FocusSettingsModal
        durations={durations}
        onClose={() => setSettingsOpen(false)}
        onSave={saveDurations}
        open={settingsOpen}
      />
    </div>
  );
}

function ClockIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2M8 2h8" />
    </svg>
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
