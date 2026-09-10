import { Suspense } from 'react';

import { FocusMode } from '@/components/focus/FocusMode';

export default function FocusPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-lg border border-dashboard-border bg-dashboard-surface p-6 text-dashboard-muted">
          Loading focus mode...
        </div>
      }
    >
      <FocusMode />
    </Suspense>
  );
}
