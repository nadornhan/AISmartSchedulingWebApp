import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './dashboard-pagination.module.css';

export function DashboardPagination({
  ariaLabel,
  page,
  pageCount,
  onPageChange,
}: Readonly<{
  ariaLabel: string;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}>) {
  if (pageCount <= 1) return null;

  return (
    <nav
      aria-label={ariaLabel}
      className={`mt-auto flex h-10 shrink-0 items-center justify-between pt-3 ${styles.divider}`}
    >
      <span aria-live="polite" className="text-xs text-dashboard-muted">
        {page + 1} / {pageCount}
      </span>
      <div className="flex items-center gap-2">
        <button
          aria-label="Previous page"
          className="grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] border border-dashboard-border text-dashboard-muted transition hover:border-dashboard-accent hover:text-dashboard-accent disabled:cursor-not-allowed disabled:opacity-40"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          aria-label="Next page"
          className="grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] border border-dashboard-border text-dashboard-muted transition hover:border-dashboard-accent hover:text-dashboard-accent disabled:cursor-not-allowed disabled:opacity-40"
          disabled={page >= pageCount - 1}
          onClick={() => onPageChange(page + 1)}
          type="button"
        >
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
