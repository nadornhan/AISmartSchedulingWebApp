import { BrandedLoadingScreen } from '../layout/branded-loading-screen';

export function DashboardLoadingState() {
  return (
    <BrandedLoadingScreen className="min-h-[420px] rounded-[var(--radius-lg)] border border-dashboard-border bg-dashboard-surface/65" />
  );
}
