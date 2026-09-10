import { Suspense } from 'react';

import { TaskPage } from '../../../components/tasks/task-page';

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-lg border border-dashboard-border bg-dashboard-surface p-6 text-dashboard-muted">
          Loading tasks...
        </div>
      }
    >
      <TaskPage />
    </Suspense>
  );
}
