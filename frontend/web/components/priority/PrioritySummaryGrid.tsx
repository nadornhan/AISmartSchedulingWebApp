import type { PriorityColumnData } from './priority.types';
import { PrioritySummaryCard } from './PrioritySummaryCard';

export function PrioritySummaryGrid({ columns }: { columns: PriorityColumnData[] }) {
  return (
    <section aria-label="Priority summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {columns.map((column) => <PrioritySummaryCard column={column} key={column.id} />)}
    </section>
  );
}
