export const TASK_DATA_CHANGED_EVENT = 'chrono:task-data-changed';
export const PROJECT_DATA_CHANGED_EVENT = 'chrono:project-data-changed';

function emitDataChanged(eventName: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(eventName));
}

export function emitTaskDataChanged() {
  emitDataChanged(TASK_DATA_CHANGED_EVENT);
}

export function emitProjectDataChanged() {
  emitDataChanged(PROJECT_DATA_CHANGED_EVENT);
}

export function onTaskDataChanged(listener: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(TASK_DATA_CHANGED_EVENT, listener);
  return () => window.removeEventListener(TASK_DATA_CHANGED_EVENT, listener);
}

export function onProjectDataChanged(listener: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(PROJECT_DATA_CHANGED_EVENT, listener);
  return () => window.removeEventListener(PROJECT_DATA_CHANGED_EVENT, listener);
}
