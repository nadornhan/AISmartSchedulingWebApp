'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { FocusTimerPanel } from './focus-timer-panel';
import { useFocusTasks } from './use-focus-tasks';
import { useFocusTimer } from './use-focus-timer';

export function FocusMode() {
  const searchParams = useSearchParams();
  const selectedTaskId = searchParams.get('task_id');
  const selectedTaskTitle = searchParams.get('task_title');
  const selectedDuration = Number(searchParams.get('duration'));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { tasks } = useFocusTasks({ selectedTaskId, selectedTaskTitle });
  const timer = useFocusTimer({ selectedTaskId, selectedDuration, setSettingsOpen });

  const selectedFocusTasks = tasks.filter((task) => timer.selectedFocusTaskIds.includes(task.id));
  const selectedFocusTaskTitles = selectedFocusTasks.map((task) => task.title);
  if (
    selectedTaskId &&
    selectedTaskTitle &&
    timer.selectedFocusTaskIds.includes(selectedTaskId) &&
    !selectedFocusTasks.some((task) => task.id === selectedTaskId)
  ) {
    selectedFocusTaskTitles.unshift(selectedTaskTitle);
  }
  const selectedFocusTaskSummary =
    selectedFocusTaskTitles.join(' • ') ||
    (timer.selectedFocusTaskIds.length > 0
      ? `${timer.selectedFocusTaskIds.length} linked ${timer.selectedFocusTaskIds.length === 1 ? 'task' : 'tasks'}`
      : '');

  return (
    <div className="mx-auto max-w-[1450px] space-y-5 sm:space-y-7">
      <FocusTimerPanel
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        taskSummary={selectedFocusTaskSummary}
        timer={timer}
      />
    </div>
  );
}
