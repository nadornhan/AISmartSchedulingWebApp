import { Suspense } from 'react';

import { TaskPage } from '../../../components/tasks/task-page';
import { BrandedLoadingScreen } from '../../../components/layout/branded-loading-screen';

export default function TasksPage() {
  return (
    <Suspense
      fallback={<BrandedLoadingScreen className="min-h-[420px]" />}
    >
      <TaskPage />
    </Suspense>
  );
}
