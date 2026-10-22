import { Suspense } from 'react';

import { FocusMode } from '@/components/focus/FocusMode';
import { BrandedLoadingScreen } from '@/components/layout/branded-loading-screen';

export default function FocusPage() {
  return (
    <Suspense
      fallback={<BrandedLoadingScreen className="min-h-[420px]" />}
    >
      <FocusMode />
    </Suspense>
  );
}
